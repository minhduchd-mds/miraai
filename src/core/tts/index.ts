import type { TTSAdapter } from '../types';
import type { TTSDiagnostics } from './webspeech-tts';
import { CloudTTS } from './cloud-tts';

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
const BUILD_TTS_URL = String(import.meta.env.VITE_MIRA_TTS_URL || '').trim().replace(/\/$/, '');
const ELEVENLABS_REMOTE_URL = 'https://miraai-five.vercel.app/api';

function isGitHubPagesRuntime(): boolean {
  return typeof window !== 'undefined' && window.location.hostname.endsWith('.github.io');
}

export function loadTTSConfig(): TTSConfig {
  let serverUrl = BUILD_TTS_URL;
  let voiceId = '';
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const c = JSON.parse(raw);
      if (typeof c?.serverUrl === 'string' && /^https:\/\//i.test(c.serverUrl.trim())) {
        serverUrl = c.serverUrl.trim().replace(/\/$/, '');
      }
      if (typeof c?.voiceId === 'string') voiceId = c.voiceId;
    }
  } catch { /* noop */ }

  if (!serverUrl && isGitHubPagesRuntime()) serverUrl = ELEVENLABS_REMOTE_URL;
  return { engine: 'cloud', apiKey: '', voiceId, serverUrl };
}

export function saveTTSConfig(cfg: TTSConfig): void {
  try {
    const serverUrl = typeof cfg.serverUrl === 'string' && /^https:\/\//i.test(cfg.serverUrl.trim())
      ? cfg.serverUrl.trim().replace(/\/$/, '')
      : BUILD_TTS_URL;
    localStorage.setItem(LS_KEY, JSON.stringify({
      engine: 'cloud',
      apiKey: '',
      voiceId: cfg.voiceId || '',
      serverUrl,
      elevenLabsOnly: true,
    }));
  } catch { /* noop */ }
}

export function createTTS(): MiraTTS {
  const cfg = loadTTSConfig();
  const serverUrl = cfg.serverUrl || (isGitHubPagesRuntime() ? ELEVENLABS_REMOTE_URL : '/api');
  return new CloudTTS(serverUrl);
}

export type { TTSDiagnostics };
