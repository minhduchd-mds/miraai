export interface TTSDiagnostics {
  voices: number;
  viVoices: number;
  speaking: boolean;
  pending: boolean;
  paused: boolean;
  unlocked: boolean;
  lastError: string | null;
  provider?: string;
  /** The voice that actually spoke last (primary, Gemini fallback or device voice). */
  activeProvider?: string;
  health?: 'unknown' | 'healthy' | 'unhealthy';
}
