import type { TTSAdapter, TTSSpeakOptions, VoiceOption } from '../types';
import type { TTSDiagnostics } from './webspeech-tts';
import { attachAnalyser } from '../audio-level';

// TTS ElevenLabs — giọng đa ngôn ngữ tự nhiên hơn hẳn giọng hệ thống, hỗ trợ tiếng Việt.
// Gọi REST trực tiếp từ browser bằng xi-api-key (CORS mở). Free tier ~10k ký tự/tháng.
// v1: tải trọn file mp3 rồi phát (chưa streaming) → trễ hơn giọng hệ thống một chút.
// ⚠️ Key lưu localStorage — chỉ dùng dev cục bộ; production đi qua server proxy (§12).

// Vài giọng nữ đa ngôn ngữ đọc tiếng Việt tốt (voice ID public của ElevenLabs).
const PRESET_VOICES: VoiceOption[] = [
  { name: 'Sarah (ElevenLabs)', voiceURI: 'EXAVITQu4vr4xnSDxMaL', lang: 'vi-VN' },
  { name: 'Rachel (ElevenLabs)', voiceURI: '21m00Tcm4TlvDq8ikWAM', lang: 'vi-VN' },
  { name: 'Charlotte (ElevenLabs)', voiceURI: 'XB0fDUnXU5powFXDhCwa', lang: 'vi-VN' },
];

const MODEL_ID = 'eleven_multilingual_v2';

export class ElevenLabsTTS implements TTSAdapter {
  private audio: HTMLAudioElement | null = null;
  private abort: AbortController | null = null;
  private objectUrl: string | null = null;
  private detach: (() => void) | null = null;
  private fetching = false;
  private lastError: string | null = null;
  private cancelled = false;

  constructor(private apiKey: string) {}

  get available(): boolean {
    return !!this.apiKey;
  }

  unlock(): void {
    /* HTMLAudio chỉ cần user-activation của trang — các nút bấm đã cấp sẵn */
  }

  speak(opts: TTSSpeakOptions): void {
    this.cancel(); // một câu một lúc
    this.cancelled = false;
    const voiceId = opts.voiceURI || PRESET_VOICES[0].voiceURI;
    const ac = new AbortController();
    this.abort = ac;
    this.fetching = true;

    fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_64`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'xi-api-key': this.apiKey },
      body: JSON.stringify({
        text: opts.text,
        model_id: MODEL_ID,
        voice_settings: { stability: 0.45, similarity_boost: 0.75 },
      }),
      signal: ac.signal,
    })
      .then(async (res) => {
        if (!res.ok) {
          let detail = '';
          try {
            const j = await res.json();
            detail = j?.detail?.message || JSON.stringify(j).slice(0, 160);
          } catch {
            detail = res.statusText;
          }
          throw new Error(`ElevenLabs ${res.status}: ${detail}`);
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
        a.playbackRate = opts.rate ?? 1; // khớp "Chậm/Nhanh"
        a.preservesPitch = true; // đổi tốc độ KHÔNG đổi cao độ
        this.detach = attachAnalyser(a); // lipsync theo âm thanh thật
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
        if (this.cancelled || e?.name === 'AbortError') return; // mình chủ động huỷ (barge-in)
        const msg = e instanceof Error ? e.message : String(e);
        this.lastError = msg;
        console.error('[Mira TTS·EL]', msg);
        opts.onError?.(msg);
      });
  }

  cancel(): void {
    this.cancelled = true;
    try {
      this.abort?.abort();
    } catch {
      /* noop */
    }
    this.abort = null;
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
    return PRESET_VOICES;
  }

  test(voiceURI?: string): void {
    this.speak({
      text: 'Xin chào anh, em là Mira. Giọng mới của em nghe tự nhiên hơn chứ ạ?',
      lang: 'vi-VN',
      voiceURI,
    });
  }

  diagnostics(): TTSDiagnostics {
    return {
      voices: PRESET_VOICES.length,
      viVoices: PRESET_VOICES.length,
      speaking: !!this.audio && !this.audio.paused,
      pending: this.fetching,
      paused: !!this.audio?.paused && !this.fetching,
      unlocked: true,
      lastError: this.lastError,
    };
  }
}
