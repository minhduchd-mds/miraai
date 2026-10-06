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
  private voices: VoiceOption[];
  private failureThreshold: number;
  private cooldownMs: number;
  private consecutiveFailures = 0;
  private circuitOpenUntil = 0;
  private healthState: 'unknown' | 'healthy' | 'unhealthy' = 'unknown';
  private nextHealthProbeAt = 0;
  private healthProbePromise: Promise<boolean> | null = null;

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

  speak(opts: TTSSpeakOptions): void {
    this.cancel();
    this.cancelled = false;

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

    const controller = new AbortController();
    this.abortCtl = controller;
    this.fetching = true;

    fetch(`${this.serverUrl}/tts`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        text: opts.text,
        voice: opts.voiceURI || null,
        instructions: opts.instructions || null,
      }),
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          let detail = '';
          try { detail = JSON.stringify(await response.json()).slice(0, 160); }
          catch { detail = response.statusText; }
          throw new Error(`${this.label} ${response.status}: ${detail}`);
        }
        return response.blob();
      })
      .then((blob) => {
        this.fetching = false;
        if (this.cancelled) return;
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
        audio.onplaying = () => opts.onStart?.();
        audio.onended = () => {
          this.cleanupAudio();
          opts.onEnd?.();
        };
        audio.onerror = () => {
          this.cleanupAudio();
          this.fail(opts, 'audio_playback_failed');
        };
        return audio.play();
      })
      .catch((error: unknown) => {
        this.fetching = false;
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
    this.cancelled = true;
    try { this.abortCtl?.abort(); } catch { /* noop */ }
    this.abortCtl = null;
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
