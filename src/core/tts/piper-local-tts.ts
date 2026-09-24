import type { TTSAdapter, TTSSpeakOptions, VoiceOption } from '../types';
import type { TTSDiagnostics } from './webspeech-tts';
import { WebSpeechTTS } from './webspeech-tts';

const PIPER_MODULE_URL = 'https://cdn.jsdelivr.net/npm/@mintplex-labs/piper-tts-web@1.0.4/+esm';
const DEFAULT_VOICE = 'vi_VN-vais1000-medium';

const PIPER_VOICE: VoiceOption = {
  name: 'Mira Local Neural · Piper VI',
  voiceURI: 'piper:' + DEFAULT_VOICE,
  lang: 'vi-VN',
};

interface PiperModule {
  predict(
    config: { text: string; voiceId: string },
    progress?: (event: unknown) => void,
  ): Promise<Blob>;
  download?(voiceId: string, progress?: (event: unknown) => void): Promise<void>;
  stored?(): Promise<string[]>;
}

/**
 * Local neural TTS for the static Pages build.
 * The Vietnamese Piper model is downloaded once and cached in OPFS.
 * Inference then runs in-browser through ONNX/WASM with no TTS API key.
 */
export class PiperLocalTTS implements TTSAdapter {
  private modulePromise: Promise<PiperModule> | null = null;
  private preparePromise: Promise<void> | null = null;
  private audio: HTMLAudioElement | null = null;
  private objectUrl: string | null = null;
  private fallback = new WebSpeechTTS();
  private token = 0;
  private unlocked = false;
  private lastError: string | null = null;
  private preparing = false;

  get available(): boolean {
    if (typeof window === 'undefined' || typeof Audio === 'undefined') return false;
    const storage = typeof navigator !== 'undefined' ? (navigator.storage as any) : null;
    return typeof storage?.getDirectory === 'function';
  }

  private loadModule(): Promise<PiperModule> {
    if (!this.modulePromise) {
      const moduleUrl = PIPER_MODULE_URL;
      this.modulePromise = import(/* @vite-ignore */ moduleUrl) as Promise<PiperModule>;
    }
    return this.modulePromise;
  }

  private prepare(): Promise<void> {
    if (!this.preparePromise) {
      this.preparePromise = (async () => {
        if (!this.available) throw new Error('OPFS/WASM unavailable');
        this.preparing = true;
        try {
          const mod = await this.loadModule();
          const stored = typeof mod.stored === 'function' ? await mod.stored().catch(() => []) : [];
          if (!stored.includes(DEFAULT_VOICE) && typeof mod.download === 'function') {
            await mod.download(DEFAULT_VOICE);
          }
        } finally {
          this.preparing = false;
        }
      })().catch((error) => {
        this.preparePromise = null;
        throw error;
      });
    }
    return this.preparePromise;
  }

  unlock(): void {
    this.unlocked = true;
    this.fallback.unlock();
    if (this.available) {
      void this.prepare().catch((error) => {
        this.lastError = error instanceof Error ? error.message : String(error);
      });
    }
  }

  speak(opts: TTSSpeakOptions): void {
    this.cancelAudioOnly();
    const token = ++this.token;
    const text = opts.text.trim();
    if (!text) {
      opts.onEnd?.();
      return;
    }
    void this.generateAndPlay(text, opts, token);
  }

  private async generateAndPlay(text: string, opts: TTSSpeakOptions, token: number): Promise<void> {
    try {
      await this.prepare();
      if (token !== this.token) return;
      const mod = await this.loadModule();
      const wav = await mod.predict({ text, voiceId: DEFAULT_VOICE });
      if (token !== this.token) return;

      const url = URL.createObjectURL(wav);
      this.objectUrl = url;
      const audio = new Audio(url);
      this.audio = audio;
      audio.preload = 'auto';
      audio.playbackRate = Math.max(0.78, Math.min(1.2, opts.rate ?? 1));
      try { (audio as any).preservesPitch = true; } catch { /* browser-specific */ }

      audio.onplaying = () => {
        if (token === this.token) opts.onStart?.();
      };
      audio.onended = () => {
        if (token !== this.token) return;
        this.cancelAudioOnly();
        opts.onEnd?.();
      };
      audio.onerror = () => {
        if (token !== this.token) return;
        this.lastError = 'piper_audio_playback_failed';
        this.cancelAudioOnly();
        this.fallbackSpeak(opts, token);
      };
      await audio.play();
    } catch (error) {
      if (token !== this.token) return;
      this.lastError = error instanceof Error ? error.message : String(error);
      this.cancelAudioOnly();
      this.fallbackSpeak(opts, token);
    }
  }

  private fallbackSpeak(opts: TTSSpeakOptions, token: number): void {
    if (token !== this.token) return;
    this.fallback.speak({
      ...opts,
      voiceURI: undefined,
      onStart: () => token === this.token && opts.onStart?.(),
      onEnd: () => token === this.token && opts.onEnd?.(),
      onError: (error) => token === this.token && opts.onError?.(error),
    });
  }

  private cancelAudioOnly(): void {
    if (this.audio) {
      try {
        this.audio.pause();
        this.audio.src = '';
      } catch { /* noop */ }
      this.audio = null;
    }
    if (this.objectUrl) {
      URL.revokeObjectURL(this.objectUrl);
      this.objectUrl = null;
    }
  }

  cancel(): void {
    this.token += 1;
    this.cancelAudioOnly();
    this.fallback.cancel();
  }

  listVoices(_langPrefix?: string): VoiceOption[] {
    return [PIPER_VOICE];
  }

  test(voiceURI?: string): void {
    this.unlock();
    this.speak({
      text: 'Em nghe anh. Đây là giọng Mira chạy local ngay trên máy, không cần API giọng nói.',
      lang: 'vi-VN',
      voiceURI,
      rate: 0.96,
    });
  }

  diagnostics(): TTSDiagnostics {
    return {
      voices: 1,
      viVoices: 1,
      speaking: !!this.audio && !this.audio.paused,
      pending: this.preparing || (!!this.audio && this.audio.readyState < 2),
      paused: !!this.audio?.paused,
      unlocked: this.unlocked,
      lastError: this.lastError,
    };
  }
}
