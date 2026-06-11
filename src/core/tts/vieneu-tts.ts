import type { TTSAdapter, TTSSpeakOptions, VoiceOption } from '../types';
import type { TTSDiagnostics } from './webspeech-tts';
import { attachAnalyser } from '../audio-level';

// TTS VieNeu — server self-host (server/ trong repo): vinorm + VieNeu-TTS, Apache-2.0,
// chạy real-time trên CPU, dữ liệu giọng KHÔNG ra ngoài (hợp vùng bảo mật cao của Soi).
// Phát qua HTMLAudio + AnalyserNode → lipsync khớp âm thanh thật.
export const VIENEU_DEFAULT_URL = 'http://localhost:8017';

export class VieNeuTTS implements TTSAdapter {
  private audio: HTMLAudioElement | null = null;
  private abortCtl: AbortController | null = null;
  private objectUrl: string | null = null;
  private detach: (() => void) | null = null;
  private fetching = false;
  private lastError: string | null = null;
  private cancelled = false;
  private voices: VoiceOption[] = [{ name: 'Giọng mặc định (VieNeu)', voiceURI: '', lang: 'vi-VN' }];

  constructor(private serverUrl: string = VIENEU_DEFAULT_URL) {
    this.serverUrl = (serverUrl || VIENEU_DEFAULT_URL).replace(/\/$/, '');
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
          throw new Error(`VieNeu ${res.status}: ${detail}`);
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
        const msg =
          e instanceof TypeError
            ? `Không nối được server TTS (${this.serverUrl}) — chạy server/ trước nhé`
            : e instanceof Error
              ? e.message
              : String(e);
        this.lastError = msg;
        console.error('[Mira TTS·VieNeu]', msg);
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
    this.speak({
      text: 'Xin chào anh, em là Mira. Đây là giọng nói chạy trên máy của mình đó ạ.',
      lang: 'vi-VN',
      voiceURI,
    });
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
