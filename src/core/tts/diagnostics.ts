export interface TTSDiagnostics {
  voices: number;
  viVoices: number;
  speaking: boolean;
  pending: boolean;
  paused: boolean;
  unlocked: boolean;
  lastError: string | null;
  provider?: string;
  health?: 'unknown' | 'healthy' | 'unhealthy';
}
