import type { TTSAdapter } from '../types';
import { WebSpeechTTS, type TTSDiagnostics } from './webspeech-tts';
import { ElevenLabsTTS } from './elevenlabs-tts';
import { VieNeuTTS, VIENEU_DEFAULT_URL } from './vieneu-tts';
import { EdgeTTS, EDGE_DEFAULT_URL } from './edge-tts';
import { CloudTTS } from './cloud-tts';
import { PiperLocalTTS } from './piper-local-tts';

export interface MiraTTS extends TTSAdapter {
  unlock(): void;
  test(voiceURI?: string): void;
  diagnostics(): TTSDiagnostics;
}

export interface TTSConfig {
  engine: 'system' | 'edge' | 'elevenlabs' | 'vieneu' | 'cloud';
  apiKey: string;
  voiceId: string;
  serverUrl: string;
}

const LS_KEY = 'mira.tts.config';

function isGitHubPagesRuntime(): boolean {
  return typeof window !== 'undefined' && window.location.hostname.endsWith('.github.io');
}

function isEngine(e: any): e is TTSConfig['engine'] {
  return e === 'system' || e === 'edge' || e === 'elevenlabs' || e === 'vieneu' || e === 'cloud';
}

export function loadTTSConfig(): TTSConfig {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const c = JSON.parse(raw);
      return {
        engine: isEngine(c?.engine) ? c.engine : 'cloud',
        apiKey: typeof c?.apiKey === 'string' ? c.apiKey : '',
        voiceId: typeof c?.voiceId === 'string' ? c.voiceId : '',
        serverUrl: typeof c?.serverUrl === 'string' ? c.serverUrl : '',
      };
    }
  } catch { /* noop */ }
  return { engine: 'cloud', apiKey: '', voiceId: '', serverUrl: '' };
}

export function saveTTSConfig(cfg: TTSConfig): void {
  try {
    if (cfg.engine === 'system') localStorage.removeItem(LS_KEY);
    else localStorage.setItem(LS_KEY, JSON.stringify(cfg));
  } catch { /* noop */ }
}

export function createTTS(): MiraTTS {
  const cfg = loadTTSConfig();
  if (isGitHubPagesRuntime()) return new PiperLocalTTS();
  if (cfg.engine === 'edge') return new EdgeTTS(cfg.serverUrl || EDGE_DEFAULT_URL);
  if (cfg.engine === 'vieneu') return new VieNeuTTS(cfg.serverUrl || VIENEU_DEFAULT_URL);
  if (cfg.engine === 'elevenlabs' && cfg.apiKey) return new ElevenLabsTTS(cfg.apiKey);
  if (cfg.engine === 'system') return new WebSpeechTTS();
  return new CloudTTS();
}

export { VIENEU_DEFAULT_URL, EDGE_DEFAULT_URL };
export type { TTSDiagnostics };
