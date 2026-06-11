import type { TTSAdapter } from '../types';
import { WebSpeechTTS, type TTSDiagnostics } from './webspeech-tts';
import { ElevenLabsTTS } from './elevenlabs-tts';

// Bề mặt TTS đầy đủ mà useMira cần (adapter + tiện ích unlock/test/chẩn đoán).
export interface MiraTTS extends TTSAdapter {
  unlock(): void;
  test(voiceURI?: string): void;
  diagnostics(): TTSDiagnostics;
}

export interface TTSConfig {
  engine: 'system' | 'elevenlabs';
  apiKey: string;
  voiceId: string;
}

const LS_KEY = 'mira.tts.config';

export function loadTTSConfig(): TTSConfig {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const c = JSON.parse(raw);
      return {
        engine: c?.engine === 'elevenlabs' ? 'elevenlabs' : 'system',
        apiKey: typeof c?.apiKey === 'string' ? c.apiKey : '',
        voiceId: typeof c?.voiceId === 'string' ? c.voiceId : '',
      };
    }
  } catch {
    /* noop */
  }
  return { engine: 'system', apiKey: '', voiceId: '' };
}

export function saveTTSConfig(cfg: TTSConfig): void {
  try {
    if (cfg.engine === 'system') localStorage.removeItem(LS_KEY);
    else localStorage.setItem(LS_KEY, JSON.stringify(cfg));
  } catch {
    /* noop */
  }
}

// Chọn engine giọng nói: ElevenLabs (tự nhiên, cần key) > Web Speech hệ thống (miễn phí).
export function createTTS(): MiraTTS {
  const cfg = loadTTSConfig();
  if (cfg.engine === 'elevenlabs' && cfg.apiKey) return new ElevenLabsTTS(cfg.apiKey);
  return new WebSpeechTTS();
}

export type { TTSDiagnostics };
