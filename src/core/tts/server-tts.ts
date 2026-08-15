import type { TTSAdapter, TTSSpeakOptions, VoiceOption } from '../types';
import type { TTSDiagnostics } from './webspeech-tts';
import { attachAnalyser } from '../audio-level';

export interface ServerTTSOptions {
  serverUrl: string;
  label: string;
  fallbackVoice: VoiceOption;
  sampleText?: string;
  fallback?: TTSAdapter & { unlock?: () => void };
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
  private fallbackTTS: (TTSAdapter & { unlock?: () => void }) | null;

  constructor(opts: ServerTTSOptions) {
    this.serverUrl = (opts.serverUrl || '').replace(/\/$/, '');
    this.label = opts.label;
    this.sampleText = opts.sampleText || DEFAULT_SAMPLE;
    this.voices = [opts.fallbackVoice];
    this.fallbackTTS = opts.fallback ?? null;
    fetch(`${this.serverUrl}/voices`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        const raw: any[] = j?.voices || [];
        const parsed = raw.map((v) => typeof v === 'string' ? { id: v, label: v } : v && typeof v === 'object' && v.id ? { id: String(v.id), label: String(v.label || v.id) } : null).filter(Boolean) as { id: string; label: string }[];
        if (parsed.length) this.voices = parsed.map((v) => ({ name: v.label, voiceURI: v.id, lang: 'vi-VN' }));
      })
      .catch(() => { this.lastError = 'không nối được server — dùng giọng hệ thống'; });
  }

  get available(): boolean { return true; }

  unlock(): void {
    this.fallbackTTS?.unlock?.();
  }

  private speakFallback(opts: TTSSpeakOptions, reason: unknown): boolean {
    if (!this.fallbackTTS || this.cancelled) return false;
    this.lastError = reason instanceof Error ? reason.message : String(reason || 'server_tts_failed');
    console.warn(`[Mira TTS·${this.label}] chuyển sang giọng hệ thống.`, this.lastError);
    // Voice ID của cloud/ElevenLabs không tồn tại trong Web Speech. Bỏ ID để fallback tự chọn vi-VN.
    this.fallbackTTS.speak({ ...opts, voiceURI: undefined });
    return true;
  }

  speak(opts: TTSSpeakOptions): void {
    this.cancel();
    this.cancelled = false;
    const ac = new AbortController();
    this.abortCtl = ac;
    this.fetching = true;

    fetch(`${this.serverUrl}/tts`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        text: opts.text,
        voice: opts.voiceURI || null,
        instructions: opts.instructions || null,
      }),
      signal: ac.signal,
    })
      .then(async (res) => {
        if (!res.ok) {
          let detail = '';
          try { detail = JSON.stringify(await res.json()).slice(0, 160); }
          catch { detail = res.statusText; }
          throw new Error(`${this.label} ${res.status}: ${detail}`);
        }
        return res.blob();
      })
      .then((blob) => {
        this.fetching = false;
        if (this.cancelled) return;
        if (!blob.size) throw new Error('empty_audio');
        const url = URL.createObjectURL(blob);
        this.objectUrl = url;
        const a = new Audio(url);
        this.audio = a;
        a.playbackRate = opts.rate ?? 1;
        a.preservesPitch = true;
        this.detach = attachAnalyser(a);
        a.onplaying = () => opts.onStart?.();
        a.onended = () => { this.cleanupAudio(); opts.onEnd?.(); };
        a.onerror = () => {
          this.cleanupAudio();
          if (!this.cancelled && !this.speakFallback(opts, 'audio_playback_failed')) opts.onError?.('audio_playback_failed');
        };
        return a.play();
      })
      .catch((error: any) => {
        this.fetching = false;
        if (this.cancelled || error?.name === 'AbortError') return;
        if (!this.speakFallback(opts, error)) {
          const msg = error instanceof Error ? error.message : String(error);
          this.lastError = msg;
          console.error(`[Mira TTS·${this.label}]`, msg);
          opts.onError?.(msg);
        }
      });
  }

  cancel(): void {
    this.cancelled = true;
    try { this.abortCtl?.abort(); } catch { /* noop */ }
    this.abortCtl = null;
    this.fetching = false;
    if (this.audio) { try { this.audio.pause(); } catch { /* noop */ } }
    this.fallbackTTS?.cancel();
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
    if (this.objectUrl) { URL.revokeObjectURL(this.objectUrl); this.objectUrl = null; }
  }

  listVoices(_langPrefix?: string): VoiceOption[] { return this.voices; }
  test(voiceURI?: string): void { this.unlock(); this.speak({ text: this.sampleText, lang: 'vi-VN', voiceURI }); }
  diagnostics(): TTSDiagnostics {
    return { voices: this.voices.length, viVoices: this.voices.length, speaking: !!this.audio && !this.audio.paused, pending: this.fetching, paused: !!this.audio?.paused && !this.fetching, unlocked: true, lastError: this.lastError };
  }
}
