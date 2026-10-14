import type { TTSAdapter, TTSSpeakOptions, VoiceOption } from '../types';
import type { TTSDiagnostics } from './diagnostics';
import { attachAnalyser } from '../audio-level';

export interface ServerTTSOptions {
  serverUrl: string;
  label: string;
  fallbackVoice: VoiceOption;
  sampleText?: string;
  failureThreshold?: number;
  cooldownMs?: number;
}

const DEFAULT_SAMPLE = 'Xin chào anh, em là Mira. Đây là giọng nói tiếng Việt của em đó ạ.';

export class ServerTTS implements TTSAdapter {
  protected serverUrl: string;
  protected label: string;
  protected sampleText: string;
  private audio: HTMLAudioElement | null = null;
  private abortCtl: AbortController | null = null;
  private objectUrl: string | null = null;
  private detach: (() => void) | null = null;
  private fetching = false;
  private lastError: string | null = null;
  private cancelled = false;
  private utteranceId = 0;
  private voices: VoiceOption[];
  private failureThreshold: number;
  private cooldownMs: number;
  private consecutiveFailures = 0;
  private circuitOpenUntil = 0;
  private healthState: 'unknown' | 'healthy' | 'unhealthy' = 'unknown';
  private nextHealthProbeAt = 0;
  private healthProbePromise: Promise<boolean> | null = null;
  // One in-flight or completed next segment. No persistent audio cache, no
  // unbounded background requests, and never more than one speculative fetch.
  private prefetched: {
    key: string;
    controller: AbortController;
    audio: Promise<Blob | null>;
  } | null = null;

  constructor(opts: ServerTTSOptions) {
    this.serverUrl = (opts.serverUrl || '').replace(/\/$/, '');
    this.label = opts.label;
    this.sampleText = opts.sampleText || DEFAULT_SAMPLE;
    this.voices = [opts.fallbackVoice];
    this.failureThreshold = Math.max(1, Math.floor(opts.failureThreshold ?? 2));
    this.cooldownMs = Math.max(5_000, Math.floor(opts.cooldownMs ?? 30_000));
    void this.probeHealth().catch(() => false);

    fetch(`${this.serverUrl}/voices`)
      .then((response) => (response.ok ? response.json() : null))
      .then((body) => {
        const raw: unknown[] = Array.isArray(body?.voices) ? body.voices : [];
        const parsed = raw
          .map((voice) => {
            if (typeof voice === 'string') return { id: voice, label: voice };
            if (!voice || typeof voice !== 'object' || !('id' in voice)) return null;
            const item = voice as { id?: unknown; label?: unknown };
            if (!item.id) return null;
            return { id: String(item.id), label: String(item.label || item.id) };
          })
          .filter((voice): voice is { id: string; label: string } => Boolean(voice));

        if (parsed.length) {
          this.voices = parsed.map((voice) => ({
            name: voice.label,
            voiceURI: voice.id,
            lang: 'vi-VN',
          }));
        }
      })
      .catch((error) => {
        this.lastError = error instanceof Error ? error.message : 'voice_catalog_unavailable';
      });
  }

  get available(): boolean { return true; }

  unlock(): void {
    // The app shell primes AudioContext from the user's interaction.
  }

  private probeHealth(force = false): Promise<boolean> {
    const now = Date.now();
    if (!force && now < this.nextHealthProbeAt) {
      return Promise.resolve(this.healthState === 'healthy');
    }
    if (this.healthProbePromise) return this.healthProbePromise;

    this.healthProbePromise = (async () => {
      const controller = new AbortController();
      const timer = window.setTimeout(() => controller.abort(), 4_000);
      try {
        const response = await fetch(`${this.serverUrl}/health`, {
          method: 'GET',
          cache: 'no-store',
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(`health_${response.status}`);
        const body = await response.json().catch(() => ({}));
        const healthy = body?.ok === true && body?.configured !== false;
        this.healthState = healthy ? 'healthy' : 'unhealthy';
        this.nextHealthProbeAt = Date.now() + (healthy ? 120_000 : 15_000);
        if (healthy) {
          this.consecutiveFailures = 0;
          this.circuitOpenUntil = 0;
          this.lastError = null;
        }
        return healthy;
      } catch (error) {
        this.healthState = 'unhealthy';
        this.nextHealthProbeAt = Date.now() + 15_000;
        this.lastError = error instanceof Error ? error.message : String(error);
        return false;
      } finally {
        window.clearTimeout(timer);
        this.healthProbePromise = null;
      }
    })();

    return this.healthProbePromise;
  }

  private fail(opts: TTSSpeakOptions, reason: unknown): void {
    if (this.cancelled) return;
    const message = reason instanceof Error ? reason.message : String(reason || 'server_tts_failed');
    this.lastError = message;
    console.error(`[Mira TTS·${this.label}]`, message);
    opts.onError?.(message);
  }

  private speechKey(opts: Pick<TTSSpeakOptions, 'text' | 'voiceURI' | 'instructions'>): string {
    return JSON.stringify([opts.text, opts.voiceURI || null, opts.instructions || null]);
  }

  private async requestAudio(
    opts: Pick<TTSSpeakOptions, 'text' | 'voiceURI' | 'instructions'>,
    signal: AbortSignal,
  ): Promise<Blob> {
    const response = await fetch(`${this.serverUrl}/tts`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        text: opts.text,
        voice: opts.voiceURI || null,
        instructions: opts.instructions || null,
      }),
      signal,
    });
    if (!response.ok) {
      let detail = '';
      try { detail = JSON.stringify(await response.json()).slice(0, 160); }
      catch { detail = response.statusText; }
      throw new Error(`${this.label} ${response.status}: ${detail}`);
    }
    const blob = await response.blob();
    if (!blob.size) throw new Error('empty_audio');
    return blob;
  }

  /**
   * Native progressive playback of ElevenLabs MP3 chunks.
   * No second/paid retry: a broken stream fails closed and reports TTS error.
   * The same AbortController owns the HTTP stream and MediaSource lifetime.
   */
  private async speakProgressively(opts: TTSSpeakOptions, controller: AbortController, utteranceId: number): Promise<void> {
    const isCurrent = () => this.utteranceId === utteranceId && !controller.signal.aborted;
    try {
      const response = await fetch(`${this.serverUrl}/tts?stream=1`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({text: opts.text, voice: opts.voiceURI || null, instructions: opts.instructions || null}),
        signal: controller.signal,
      });
      if (!response.ok || !response.body) throw new Error('elevenlabs_stream_unavailable');
      if (!isCurrent()) { await response.body.cancel().catch(() => {}); return; }
      const source = new MediaSource();
      const url = URL.createObjectURL(source);
      const audio = new Audio(url);
      this.objectUrl = url;
      this.audio = audio;
      audio.playbackRate = opts.rate ?? 1;
      audio.preservesPitch = true;
      this.detach = attachAnalyser(audio);
      audio.onplaying = () => {
        if (!isCurrent()) return;
        this.fetching = false;
        this.healthState = 'healthy';
        this.nextHealthProbeAt = Date.now() + 120_000;
        this.consecutiveFailures = 0;
        this.lastError = null;
        opts.onStart?.();
      };
      audio.onended = () => {
        if (!isCurrent() || this.audio !== audio) return;
        this.cleanupAudio();
        if (this.abortCtl === controller) this.abortCtl = null;
        opts.onEnd?.();
      };
      audio.onerror = () => {
        if (!isCurrent() || this.audio !== audio) return;
        this.cleanupAudio();
        this.fail(opts, 'progressive_audio_playback_failed');
      };
      const open = new Promise<void>((resolve, reject) => {
        const cleanup = () => {
          source.removeEventListener('sourceopen', opened);
          source.removeEventListener('sourceclose', closed);
          controller.signal.removeEventListener('abort', aborted);
        };
        const opened = () => { cleanup(); resolve(); };
        const closed = () => { cleanup(); reject(new Error('progressive_audio_closed')); };
        const aborted = () => { cleanup(); reject(new Error('progressive_audio_aborted')); };
        source.addEventListener('sourceopen', opened, {once:true});
        source.addEventListener('sourceclose', closed, {once:true});
        controller.signal.addEventListener('abort', aborted, {once:true});
        if (source.readyState === 'open') opened();
      });
      audio.load?.(); // Triggers sourceopen without falsely marking playback started.
      await open;
      if (!isCurrent()) return;
      const buffer = source.addSourceBuffer('audio/mpeg');
      const reader = response.body.getReader();
      let bytes = 0;
      let playbackRequested = false;
      try {
        while (isCurrent()) {
          const {done,value} = await reader.read();
          if (done) break;
          if (!(value instanceof Uint8Array)) throw new Error('progressive_audio_invalid_chunk');
          bytes += value.byteLength;
          if (bytes > 8 * 1024 * 1024) throw new Error('progressive_audio_too_large');
          if (!value.byteLength) continue;
          await new Promise<void>((resolve,reject) => {
            const cleanup = () => {
              buffer.removeEventListener('updateend', updated);
              buffer.removeEventListener('error', failed);
              controller.signal.removeEventListener('abort', aborted);
            };
            const updated = () => {cleanup();resolve();};
            const failed = () => {cleanup();reject(new Error('progressive_audio_decode_failed'));};
            const aborted = () => {cleanup();reject(new Error('progressive_audio_aborted'));};
            buffer.addEventListener('updateend', updated, {once:true});
            buffer.addEventListener('error', failed, {once:true});
            controller.signal.addEventListener('abort', aborted, {once:true});
            try { buffer.appendBuffer(value); } catch (error) { cleanup(); reject(error); }
          });
          if (!playbackRequested && isCurrent()) {
            playbackRequested = true;
            void audio.play().catch((error) => {
              if (isCurrent()) this.fail(opts, error);
            });
          }
        }
        if (isCurrent() && !bytes) throw new Error('progressive_audio_empty');
        if (isCurrent() && source.readyState === 'open') source.endOfStream();
      } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
    } catch (error) {
      if (!isCurrent()) return;
      this.fetching = false;
      if (this.abortCtl === controller) this.abortCtl = null;
      this.cleanupAudio();
      this.fail(opts, error);
    }
  }

  /** Starts only after onplaying, preserving voice/model/normalization intact. */
  prefetch(opts: Pick<TTSSpeakOptions, 'text' | 'voiceURI' | 'instructions'>): void {
    // Speculation is only allowed during active audio playback. Do not spend
    // provider quota while waiting for the first audio chunk or on idle.
    if (!this.audio || this.audio.paused || this.cancelled ||
        this.healthState !== 'healthy' || Date.now() < this.circuitOpenUntil) return;
    const key = this.speechKey(opts);
    if (this.prefetched?.key === key) return;
    this.prefetched?.controller.abort();
    const controller = new AbortController();
    const audio = this.requestAudio(opts, controller.signal)
      .catch(() => null); // No unhandled rejection if speech ends/interruption wins.
    this.prefetched = { key, controller, audio };
  }

  speak(opts: TTSSpeakOptions): void {
    // Keep only the exact matching speculative result across normal TTS
    // segment transitions. cancel() still aborts everything on interruption.
    const ready = this.prefetched?.key === this.speechKey(opts) ? this.prefetched : null;
    if (ready) this.prefetched = null;
    this.cancel();
    this.cancelled = false;
    const utteranceId = this.utteranceId;

    const now = Date.now();
    if (this.healthState === 'unhealthy') {
      if (now >= this.nextHealthProbeAt) void this.probeHealth(true);
      this.fail(opts, 'server_tts_unhealthy');
      return;
    }

    if (now < this.circuitOpenUntil) {
      if (now >= this.nextHealthProbeAt) void this.probeHealth(true);
      this.fail(opts, 'server_tts_cooldown');
      return;
    }

    const controller = ready?.controller ?? new AbortController();
    this.abortCtl = controller;
    this.fetching = true;

    // Progressive ElevenLabs MP3 works in Chromium and other MSE audio/mpeg
    // browsers. Keep all other browsers on the proven buffered Blob path.
    const canStream = !ready && typeof MediaSource !== 'undefined'
      && typeof MediaSource.isTypeSupported === 'function'
      && MediaSource.isTypeSupported('audio/mpeg');
    if (canStream) {
      void this.speakProgressively(opts, controller, utteranceId);
      return;
    }

    // Reuse prefetched audio only when its original text, voice and direction
    // match exactly. If it failed, retry once through the normal validated path.
    const request = ready
      ? ready.audio.then(blob => blob ?? this.requestAudio(opts, controller.signal))
      : this.requestAudio(opts, controller.signal);
    request
      .then((blob) => {
        if (this.utteranceId !== utteranceId || controller.signal.aborted) return;
        this.fetching = false;
        if (this.abortCtl === controller) this.abortCtl = null;
        if (this.cancelled || !blob) return;
        if (!blob.size) throw new Error('empty_audio');

        this.consecutiveFailures = 0;
        this.circuitOpenUntil = 0;
        this.healthState = 'healthy';
        this.nextHealthProbeAt = Date.now() + 120_000;
        this.lastError = null;

        const url = URL.createObjectURL(blob);
        this.objectUrl = url;
        const audio = new Audio(url);
        this.audio = audio;
        audio.playbackRate = opts.rate ?? 1;
        audio.preservesPitch = true;
        this.detach = attachAnalyser(audio);
        audio.onplaying = () => { if (this.utteranceId === utteranceId) opts.onStart?.(); };
        audio.onended = () => {
          if (this.utteranceId !== utteranceId || this.audio !== audio) return;
          this.cleanupAudio();
          opts.onEnd?.();
        };
        audio.onerror = () => {
          if (this.utteranceId !== utteranceId || this.audio !== audio) return;
          this.cleanupAudio();
          this.fail(opts, 'audio_playback_failed');
        };
        return audio.play();
      })
      .catch((error: unknown) => {
        if (this.utteranceId !== utteranceId || controller.signal.aborted) return;
        this.fetching = false;
        if (this.abortCtl === controller) this.abortCtl = null;
        if (this.cancelled || (error instanceof DOMException && error.name === 'AbortError')) return;

        this.consecutiveFailures += 1;
        if (this.consecutiveFailures >= this.failureThreshold) {
          this.circuitOpenUntil = Date.now() + this.cooldownMs;
          this.healthState = 'unhealthy';
          this.nextHealthProbeAt = this.circuitOpenUntil;
        }
        this.fail(opts, error);
      });
  }

  cancel(): void {
    this.utteranceId += 1;
    this.cancelled = true;
    try { this.abortCtl?.abort(); } catch { /* noop */ }
    this.abortCtl = null;
    this.prefetched?.controller.abort();
    this.prefetched = null;
    this.fetching = false;
    if (this.audio) {
      try { this.audio.pause(); } catch { /* noop */ }
    }
    this.cleanupAudio();
  }

  private cleanupAudio(): void {
    this.detach?.();
    this.detach = null;
    if (this.audio) {
      this.audio.onplaying = null;
      this.audio.onended = null;
      this.audio.onerror = null;
      this.audio = null;
    }
    if (this.objectUrl) {
      URL.revokeObjectURL(this.objectUrl);
      this.objectUrl = null;
    }
  }

  listVoices(_langPrefix?: string): VoiceOption[] { return this.voices; }

  test(voiceURI?: string): void {
    this.unlock();
    this.speak({ text: this.sampleText, lang: 'vi-VN', voiceURI });
  }

  diagnostics(): TTSDiagnostics {
    const healthNote = this.healthState === 'healthy' ? null : `gateway_${this.healthState}`;
    return {
      voices: this.voices.length,
      viVoices: this.voices.length,
      speaking: !!this.audio && !this.audio.paused,
      pending: this.fetching || !!this.healthProbePromise,
      paused: !!this.audio?.paused && !this.fetching,
      unlocked: true,
      lastError: this.lastError || healthNote,
      provider: this.label,
      health: this.healthState,
    };
  }
}
