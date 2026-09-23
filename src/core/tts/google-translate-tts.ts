import type { TTSAdapter, TTSSpeakOptions, VoiceOption } from '../types';
import type { TTSDiagnostics } from './webspeech-tts';
import { WebSpeechTTS } from './webspeech-tts';

const GOOGLE_VOICE: VoiceOption = {
  name: 'Google TTS · Tiếng Việt',
  voiceURI: 'google:vi',
  lang: 'vi-VN',
};

function googleSpeechUrl(text: string, lang: string): string {
  const tl = lang.toLowerCase().startsWith('vi') ? 'vi' : lang.split('-')[0] || 'vi';
  const params = new URLSearchParams({
    ie: 'UTF-8',
    client: 'tw-ob',
    tl,
    q: text,
  });
  return `https://translate.google.com/translate_tts?${params.toString()}`;
}

/**
 * Static-host TTS inspired by ESP32-audioI2S connecttospeech():
 * play Google speech audio directly, so GitHub Pages does not fall back
 * to the harsh OS/WebSpeech voice. No API key is stored in the browser.
 *
 * This endpoint is best treated as a lightweight/demo path. If it is
 * unavailable, Mira automatically falls back to Web Speech.
 */
export class GoogleTranslateTTS implements TTSAdapter {
  private audio: HTMLAudioElement | null = null;
  private fallback = new WebSpeechTTS();
  private cancelled = false;
  private lastError: string | null = null;
  private unlocked = false;

  get available(): boolean {
    return typeof Audio !== 'undefined';
  }

  unlock(): void {
    this.unlocked = true;
    this.fallback.unlock();
  }

  speak(opts: TTSSpeakOptions): void {
    this.cancel();
    this.cancelled = false;

    const text = opts.text.trim();
    if (!text) {
      opts.onEnd?.();
      return;
    }

    try {
      const audio = new Audio(googleSpeechUrl(text, opts.lang || 'vi-VN'));
      this.audio = audio;
      audio.preload = 'auto';
      audio.playbackRate = Math.max(0.75, Math.min(1.25, opts.rate ?? 1));
      audio.preservesPitch = true;

      audio.onplaying = () => opts.onStart?.();
      audio.onended = () => {
        if (this.audio === audio) this.audio = null;
        if (!this.cancelled) opts.onEnd?.();
      };
      audio.onerror = () => {
        if (this.audio === audio) this.audio = null;
        if (this.cancelled) return;
        this.lastError = 'google_tts_playback_failed';
        this.fallback.speak({
          ...opts,
          voiceURI: undefined,
          onStart: opts.onStart,
          onEnd: opts.onEnd,
          onError: opts.onError,
        });
      };

      const played = audio.play();
      if (played && typeof played.catch === 'function') {
        played.catch((error) => {
          if (this.cancelled) return;
          this.lastError = error instanceof Error ? error.message : String(error);
          if (this.audio === audio) this.audio = null;
          this.fallback.speak({
            ...opts,
            voiceURI: undefined,
            onStart: opts.onStart,
            onEnd: opts.onEnd,
            onError: opts.onError,
          });
        });
      }
    } catch (error) {
      this.lastError = error instanceof Error ? error.message : String(error);
      if (!this.cancelled) {
        this.fallback.speak({
          ...opts,
          voiceURI: undefined,
          onStart: opts.onStart,
          onEnd: opts.onEnd,
          onError: opts.onError,
        });
      }
    }
  }

  cancel(): void {
    this.cancelled = true;
    if (this.audio) {
      try {
        this.audio.pause();
        this.audio.src = '';
      } catch {
        /* noop */
      }
      this.audio = null;
    }
    this.fallback.cancel();
  }

  listVoices(_langPrefix?: string): VoiceOption[] {
    return [GOOGLE_VOICE];
  }

  test(voiceURI?: string): void {
    this.unlock();
    this.speak({
      text: 'Em nghe anh. Đây là giọng Mira mới, mềm và tự nhiên hơn giọng hệ thống.',
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
      pending: !!this.audio && this.audio.readyState < 2,
      paused: !!this.audio?.paused,
      unlocked: this.unlocked,
      lastError: this.lastError,
    };
  }
}
