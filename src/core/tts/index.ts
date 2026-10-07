import type { TTSAdapter } from '../types';
import type { TTSDiagnostics } from './diagnostics';
import { CloudTTS } from './cloud-tts';

export interface MiraTTS extends TTSAdapter {
  unlock(): void;
  test(voiceURI?: string): void;
  diagnostics(): TTSDiagnostics;
}

const BUILD_TTS_URL = String(import.meta.env.VITE_MIRA_TTS_URL || '').trim().replace(/\/$/, '');
const ELEVENLABS_REMOTE_URL = 'https://miraai-five.vercel.app/api';

function isGitHubPagesRuntime(): boolean {
  return typeof window !== 'undefined' && window.location.hostname.endsWith('.github.io');
}

function isTauriRuntime(): boolean {
  if (typeof window === 'undefined') return false;
  const host = window as typeof window & { __TAURI_INTERNALS__?: unknown; __TAURI__?: unknown };
  return Boolean(host.__TAURI_INTERNALS__ || host.__TAURI__);
}

export function createTTS(): MiraTTS {
  const needsRemoteGateway = isGitHubPagesRuntime() || isTauriRuntime();
  const serverUrl = BUILD_TTS_URL || (needsRemoteGateway ? ELEVENLABS_REMOTE_URL : '/api');
  return new CloudTTS(serverUrl);
}

export type { TTSDiagnostics };
