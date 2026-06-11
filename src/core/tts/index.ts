import type { TTSAdapter } from '../types';
import { WebSpeechTTS, type TTSDiagnostics } from './webspeech-tts';
import { ElevenLabsTTS } from './elevenlabs-tts';
import { VieNeuTTS, VIENEU_DEFAULT_URL } from './vieneu-tts';

// Bề mặt TTS đầy đủ mà useMira cần (adapter + tiện ích unlock/test/chẩn đoán).
export interface MiraTTS extends TTSAdapter {
  unlock(): void;
  test(voiceURI?: string): void;
  diagnostics(): TTSDiagnostics;
}

export interface TTSConfig {
  engine: 'system' | 'elevenlabs' | 'vieneu';
  apiKey: string;
  voiceId: string;
  serverUrl: string;
}

const LS_KEY = 'mira.tts.config';

export function loadTTSConfig(): TTSConfig {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const c = JSON.parse(raw);
      return {
        engine: c?.engine === 'elevenlabs' || c?.engine === 'vieneu' ? c.engine : 'system',
        apiKey: typeof c?.apiKey === 'string' ? c.apiKey : '',
        voiceId: typeof c?.voiceId === 'string' ? c.voiceId : '',
        serverUrl: typeof c?.serverUrl === 'string' ? c.serverUrl : '',
      };
    }
  } catch {
    /* noop */
  }
  return { engine: 'system', apiKey: '', voiceId: '', serverUrl: '' };
}

export function saveTTSConfig(cfg: TTSConfig): void {
  try {
    if (cfg.engine === 'system') localStorage.removeItem(LS_KEY);
    else localStorage.setItem(LS_KEY, JSON.stringify(cfg));
  } catch {
    /* noop */
  }
}

// Chọn engine giọng nói:
//  vieneu (server nhà, tự nhiên + bảo mật) | elevenlabs (cloud, cần key) | system (miễn phí)
export function createTTS(): MiraTTS {
  const cfg = loadTTSConfig();
  if (cfg.engine === 'vieneu') return new VieNeuTTS(cfg.serverUrl || VIENEU_DEFAULT_URL);
  if (cfg.engine === 'elevenlabs' && cfg.apiKey) return new ElevenLabsTTS(cfg.apiKey);
  return new WebSpeechTTS();
}

export { VIENEU_DEFAULT_URL };
export type { TTSDiagnostics };
