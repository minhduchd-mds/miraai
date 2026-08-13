// ── Kiểu dữ liệu lõi cho engine Mira (không phụ thuộc UI) ──

export type MiraState =
  | 'idle'
  | 'listening'
  | 'thinking'
  | 'speaking'
  | 'interrupted'
  | 'error';

export type Theme = 'nova' | 'aura' | 'ember' | 'iris';

export interface STTResult {
  transcript: string;
  isFinal: boolean;
}

export interface STTStartOptions {
  lang: string;
  /** Giữ session nghe LIÊN TỤC qua các quãng ngắt để endpointer tự quyết điểm kết lượt
   *  (smart turn-taking). false = 1 lượt/lần, Web Speech tự kết theo im lặng (hành vi cũ). */
  continuous?: boolean;
  onResult: (r: STTResult) => void;
  onError: (error: string) => void;
  onEnd: () => void;
}

/** Adapter STT — đổi provider (Web Speech → Viettel/FPT/Whisper) chỉ cần thay lớp này. */
export interface STTAdapter {
  readonly available: boolean;
  start(opts: STTStartOptions): void;
  stop(): void;
  abort(): void;
}

export interface TTSSpeakOptions {
  text: string;
  lang: string;
  voiceURI?: string;
  rate?: number;
  pitch?: number;
  onStart?: () => void;
  onBoundary?: (charIndex: number) => void;
  onEnd?: () => void;
  onError?: (error: string) => void;
}

export interface VoiceOption {
  name: string;
  voiceURI: string;
  lang: string;
}

/** Adapter TTS — đổi provider (Web Speech → Vbee/Viettel/ElevenLabs) chỉ cần thay lớp này. */
export interface TTSAdapter {
  readonly available: boolean;
  speak(opts: TTSSpeakOptions): void;
  cancel(): void;
  listVoices(langPrefix?: string): VoiceOption[];
}

export type Mood = 'neutral' | 'happy' | 'curious' | 'thinking' | 'surprised';

export interface BrainReply {
  text: string;
  mood?: Mood;
}

export interface BrainTurn {
  role: 'user' | 'mira';
  text: string;
}

/** "Bộ não" — đổi từ canned demo sang Claude/GPT chỉ cần thay lớp này.
 *  memory: ký ức ngữ nghĩa truy hồi được (RAG) để chèn vào ngữ cảnh — tuỳ chọn, brain có thể bỏ qua. */
export interface Brain {
  readonly name: string;
  reply(input: string, history: BrainTurn[], memory?: string): Promise<BrainReply>;
}
