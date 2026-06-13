import type { TTSAdapter } from '../types';
import { WebSpeechTTS, type TTSDiagnostics } from './webspeech-tts';
import { ElevenLabsTTS } from './elevenlabs-tts';
import { VieNeuTTS, VIENEU_DEFAULT_URL } from './vieneu-tts';
import { EdgeTTS, EDGE_DEFAULT_URL } from './edge-tts';

// Bề mặt TTS đầy đủ mà useMira cần (adapter + tiện ích unlock/test/chẩn đoán).
export interface MiraTTS extends TTSAdapter {
  unlock(): void;
  test(voiceURI?: string): void;
  diagnostics(): TTSDiagnostics;
}

export interface TTSConfig {
  engine: 'system' | 'edge' | 'elevenlabs' | 'vieneu';
  apiKey: string;
  voiceId: string;
  serverUrl: string;
}

const LS_KEY = 'mira.tts.config';

function isEngine(e: any): e is TTSConfig['engine'] {
  return e === 'edge' || e === 'elevenlabs' || e === 'vieneu';
}

export function loadTTSConfig(): TTSConfig {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const c = JSON.parse(raw);
      return {
        engine: isEngine(c?.engine) ? c.engine : 'system',
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
//  edge (Microsoft, tự nhiên + free, qua server nhẹ) | vieneu (server nhà, bảo mật cao) |
//  elevenlabs (cloud, cần key) | system (Web Speech, miễn phí, sẵn có)
export function createTTS(): MiraTTS {
  const cfg = loadTTSConfig();
  if (cfg.engine === 'edge') return new EdgeTTS(cfg.serverUrl || EDGE_DEFAULT_URL);
  if (cfg.engine === 'vieneu') return new VieNeuTTS(cfg.serverUrl || VIENEU_DEFAULT_URL);
  if (cfg.engine === 'elevenlabs' && cfg.apiKey) return new ElevenLabsTTS(cfg.apiKey);
  return new WebSpeechTTS();
}

export { VIENEU_DEFAULT_URL, EDGE_DEFAULT_URL };
export type { TTSDiagnostics };
