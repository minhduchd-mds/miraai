import type { TTSAdapter, TTSSpeakOptions, VoiceOption } from '../types';
import type { TTSDiagnostics } from './webspeech-tts';
import { attachAnalyser } from '../audio-level';

// Lớp TTS chung cho mọi engine chạy SAU một server HTTP nói đúng hợp đồng:
//   GET  /voices          → {voices: [{id,label} | "tên"...]}
//   POST /tts {text,voice} → audio/* (wav hoặc mp3)
// VieNeu (self-host, model nặng) và Edge (Microsoft, nhẹ — chỉ pip install edge-tts)
// đều dùng chung lớp này; khác nhau chỉ ở URL mặc định, nhãn, giọng fallback, câu đọc thử.
// Phát qua HTMLAudio + AnalyserNode → lipsync khớp âm thanh thật.
export interface ServerTTSOptions {
  serverUrl: string;
  label: string; // tên engine hiện trong log/lỗi: 'VieNeu' | 'Edge'
  fallbackVoice: VoiceOption; // hiện trước khi /voices nạp xong (hoặc khi server lỗi)
  sampleText?: string; // câu cho test()/Đọc thử
  fallback?: TTSAdapter & { unlock?: () => void }; // server không tới được → dùng giọng này (vd Web Speech)
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
    // Nạp danh sách giọng preset từ server (async — listVoices trả cache, useMira refresh sau).
    fetch(`${this.serverUrl}/voices`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        const raw: any[] = j?.voices || [];
        const parsed = raw
          .map((v) =>
            typeof v === 'string'
              ? { id: v, label: v }
              : v && typeof v === 'object' && v.id
                ? { id: String(v.id), label: String(v.label || v.id) }
                : null,
          )
          .filter(Boolean) as { id: string; label: string }[];
        if (parsed.length) {
          this.voices = parsed.map((v) => ({ name: v.label, voiceURI: v.id, lang: 'vi-VN' }));
        }
      })
      .catch(() => {
        this.lastError = 'không nối được server — đã chạy server/ chưa?';
      });
  }

  get available(): boolean {
    return true;
  }

  unlock(): void {
    /* HTMLAudio dùng user-activation của trang */
    this.fallbackTTS?.unlock?.(); // mồi sẵn Web Speech để fallback không bị câm
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
      body: JSON.stringify({ text: opts.text, voice: opts.voiceURI || null }),
      signal: ac.signal,
    })
      .then(async (res) => {
        if (!res.ok) {
          let detail = '';
          try {
            detail = JSON.stringify(await res.json()).slice(0, 160);
          } catch {
            detail = res.statusText;
          }
          throw new Error(`${this.label} ${res.status}: ${detail}`);
        }
        return res.blob();
      })
      .then((blob) => {
        this.fetching = false;
        if (this.cancelled) return;
        const url = URL.createObjectURL(blob);
        this.objectUrl = url;
        const a = new Audio(url);
        this.audio = a;
        a.playbackRate = opts.rate ?? 1; // khớp "Chậm/Nhanh" — trước đây chỉ Web Speech ăn, server/cloud bỏ qua
        a.preservesPitch = true; // đổi tốc độ KHÔNG đổi cao độ (khỏi méo giọng)
        this.detach = attachAnalyser(a); // ← lipsync theo âm thật
        a.onplaying = () => opts.onStart?.();
        a.onended = () => {
          this.cleanupAudio();
          opts.onEnd?.();
        };
        a.onerror = () => {
          this.cleanupAudio();
          if (!this.cancelled) {
            this.lastError = 'audio_playback_failed';
            opts.onError?.('audio_playback_failed');
          }
        };
        return a.play();
      })
      .catch((e: any) => {
        this.fetching = false;
        if (this.cancelled || e?.name === 'AbortError') return;
        // Server không tới được / lỗi → nếu có fallback (Web Speech) thì nói bằng nó, không để câm.
        if (this.fallbackTTS) {
          console.warn(`[Mira TTS·${this.label}] server lỗi → dùng giọng hệ thống.`, e?.message || e);
          this.fallbackTTS.speak(opts);
          return;
        }
        const msg =
          e instanceof TypeError
            ? `Không nối được server TTS (${this.serverUrl}) — chạy server/ trước nhé`
            : e instanceof Error
              ? e.message
              : String(e);
        this.lastError = msg;
        console.error(`[Mira TTS·${this.label}]`, msg);
        opts.onError?.(msg);
      });
  }

  cancel(): void {
    this.cancelled = true;
    try {
      this.abortCtl?.abort();
    } catch {
      /* noop */
    }
    this.abortCtl = null;
    this.fetching = false;
    if (this.audio) {
      try {
        this.audio.pause();
      } catch {
        /* noop */
      }
    }
    this.fallbackTTS?.cancel(); // dừng cả giọng fallback nếu đang nói
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

  listVoices(_langPrefix?: string): VoiceOption[] {
    return this.voices;
  }

  test(voiceURI?: string): void {
    this.speak({ text: this.sampleText, lang: 'vi-VN', voiceURI });
  }

  diagnostics(): TTSDiagnostics {
    return {
      voices: this.voices.length,
      viVoices: this.voices.length,
      speaking: !!this.audio && !this.audio.paused,
      pending: this.fetching,
      paused: !!this.audio?.paused && !this.fetching,
      unlocked: true,
      lastError: this.lastError,
    };
  }
}
