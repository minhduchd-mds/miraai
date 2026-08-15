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
  continuous?: boolean;
  onResult: (result: STTResult) => void;
  onError: (error: string) => void;
  onEnd: () => void;
}

export interface STTAdapter {
  readonly available: boolean;
  start(options: STTStartOptions): void;
  stop(): void;
  abort(): void;
}

export interface TTSSpeakOptions {
  text: string;
  lang: string;
  voiceURI?: string;
  rate?: number;
  pitch?: number;
  /** Optional neural-TTS performance direction. Browser/system adapters may ignore it. */
  instructions?: string;
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

export interface TTSAdapter {
  readonly available: boolean;
  speak(options: TTSSpeakOptions): void;
  cancel(): void;
  listVoices(langPrefix?: string): VoiceOption[];
}

export type Mood = 'neutral' | 'happy' | 'curious' | 'thinking' | 'surprised';

export interface BrainToolCall {
  skillId: string;
  /** Natural-language input is intentional in V2; individual skills own structured parsing. */
  input: string;
  reason?: string;
}

export interface BrainReply {
  text: string;
  mood?: Mood;
  intent?: string;
  toolCalls?: BrainToolCall[];
}

export interface BrainTurn {
  role: 'user' | 'mira';
  text: string;
}

/** Brain adapters may ignore context/tool-call fields; the runtime keeps them backward compatible. */
export interface Brain {
  readonly name: string;
  reply(input: string, history: BrainTurn[], context?: string): Promise<BrainReply>;
}
