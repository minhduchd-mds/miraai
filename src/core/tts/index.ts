import type { TTSAdapter } from '../types';
import type { TTSDiagnostics } from './diagnostics';
import { CloudTTS } from './cloud-tts';

export interface MiraTTS extends TTSAdapter {
  unlock(): void;
  test(voiceURI?: string): void;
  diagnostics(): TTSDiagnostics;
}

const LEGACY_CONFIG_KEY = 'mira.tts.config';
const BUILD_TTS_URL = String(import.meta.env.VITE_MIRA_TTS_URL || '').trim().replace(/\/$/, '');
const ELEVENLABS_REMOTE_URL = 'https://miraai-five.vercel.app/api';

function isGitHubPagesRuntime(): boolean {
  return typeof window !== 'undefined' && window.location.hostname.endsWith('.github.io');
}

function legacyGatewayOverride(): string {
  try {
    const raw = localStorage.getItem(LEGACY_CONFIG_KEY);
    if (!raw) return '';
    const value = JSON.parse(raw)?.serverUrl;
    if (typeof value !== 'string' || !/^https:\/\//i.test(value.trim())) return '';
    return value.trim().replace(/\/$/, '');
  } catch {
    return '';
  }
}

export function createTTS(): MiraTTS {
  const serverUrl = BUILD_TTS_URL
    || legacyGatewayOverride()
    || (isGitHubPagesRuntime() ? ELEVENLABS_REMOTE_URL : '/api');
  return new CloudTTS(serverUrl);
}

export type { TTSDiagnostics };
