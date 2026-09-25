import { loadAvatarSel, saveAvatarSel } from '../../core/avatar-config';
import { legacyDeviceId } from '../../core/history-store';
import { loadSmartTurn, saveSmartTurn } from '../../core/stt/turn-config';
import { loadVadEnabled, saveVadEnabled } from '../../core/vad/config';
import { loadVoicePrefs, saveVoicePrefs, type ResponseLength } from '../../core/voice-prefs';
import type { Theme } from '../../core/types';
import { memoryEnabled, setMemoryEnabled } from '../memory/preferences';
import { LocalMemoryStore } from '../memory/local-memory-store';

const localMemory = new LocalMemoryStore();
const CAPSULE_FORMAT = 'mira.identity-capsule';
const CAPSULE_VERSION = 1;

function isGitHubPagesRuntime(): boolean {
  return typeof window !== 'undefined' && window.location.hostname.endsWith('.github.io');
}

async function digestPayload(payload: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function withIntegrity<T extends Record<string, unknown>>(payload: T): Promise<T & { integrity: { algorithm: 'sha256'; digest: string } }> {
  return {
    ...payload,
    integrity: { algorithm: 'sha256', digest: await digestPayload(payload) },
  };
}

async function verifyLocalCapsule(capsule: any): Promise<boolean> {
  if (!capsule || capsule.format !== CAPSULE_FORMAT || capsule.schemaVersion !== CAPSULE_VERSION) return false;
  if (capsule.integrity?.algorithm !== 'sha256' || typeof capsule.integrity?.digest !== 'string') return false;
  const { integrity, ...payload } = capsule;
  return await digestPayload(payload) === integrity.digest;
}

export interface CapsuleRestore {
  theme?: Theme;
  voiceURI?: string;
}

function collectPreferences(theme: Theme, voiceURI?: string) {
  const voice = loadVoicePrefs();
  const avatar = loadAvatarSel();
  let twoD = false;
  try { twoD = localStorage.getItem('mira.avatar2d') === '1'; } catch { /* noop */ }

  return {
    voice: { ...voice, voiceURI: voiceURI || '' },
    theme,
    smartTurn: loadSmartTurn(),
    vad: loadVadEnabled(),
    memoryEnabled: memoryEnabled(),
    avatar: { ...avatar, twoD },
  };
}

function downloadJson(value: unknown) {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `mira-identity-capsule-${new Date().toISOString().slice(0, 10)}.json`;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function exportIdentityCapsule(theme: Theme, voiceURI?: string): Promise<void> {
  if (isGitHubPagesRuntime()) {
    const snapshot = await localMemory.exportSnapshot();
    const history = snapshot.turns.slice(-500).map((turn) => ({
      role: turn.role,
      text: turn.text,
      createdAt: new Date(turn.ts).toISOString(),
    }));
    const capsule = await withIntegrity({
      format: CAPSULE_FORMAT,
      schemaVersion: CAPSULE_VERSION,
      createdAt: new Date().toISOString(),
      source: { app: 'Mira', purpose: 'Portable continuity record · local Pages' },
      mira: {
        name: 'Mira',
        description: 'Voice-first AI companion. This capsule stores local user-approved continuity data.',
      },
      continuity: {
        summary: '',
        interactionContext: '',
        priorities: [],
        generatedBy: null,
      },
      facts: [],
      history,
      preferences: collectPreferences(theme, voiceURI),
    });
    downloadJson(capsule);
    return;
  }

  const response = await fetch('/api/identity-capsule', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({
      action: 'snapshot',
      device: legacyDeviceId(),
      preferences: collectPreferences(theme, voiceURI),
    }),
  });
  if (!response.ok) throw new Error(`identity capsule ${response.status}`);
  const json = await response.json();
  if (!json?.capsule) throw new Error('Identity Capsule rỗng');
  downloadJson(json.capsule);
}

export async function importIdentityCapsule(file: File): Promise<CapsuleRestore> {
  if (file.size > 6 * 1024 * 1024) throw new Error('Capsule lớn hơn 6 MB');
  const capsule = JSON.parse(await file.text());

  let prefs: any;
  if (isGitHubPagesRuntime()) {
    if (!await verifyLocalCapsule(capsule)) throw new Error('Capsule không hợp lệ hoặc hash không khớp');
    await localMemory.importTurns(Array.isArray(capsule?.history) ? capsule.history : []);
    prefs = capsule?.preferences || {};
  } else {
    const response = await fetch('/api/identity-capsule', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ action: 'import', device: legacyDeviceId(), capsule }),
    });
    if (!response.ok) {
      const json = await response.json().catch(() => ({}));
      throw new Error(String(json?.error || `identity capsule ${response.status}`));
    }
    const json = await response.json();
    prefs = json?.preferences || capsule?.preferences || {};
  }
  const voice = prefs.voice || {};

  const responseLength: ResponseLength =
    voice.responseLength === 'short' || voice.responseLength === 'detailed' || voice.responseLength === 'deep'
      ? voice.responseLength
      : 'auto';

  saveVoicePrefs({
    rate: typeof voice.rate === 'number' ? voice.rate : 1,
    persona: typeof voice.persona === 'string' ? voice.persona : 'friendly',
    responseLength,
  });
  saveSmartTurn(prefs.smartTurn !== false);
  saveVadEnabled(prefs.vad === true);
  setMemoryEnabled(prefs.memoryEnabled !== false);

  if (prefs.avatar && typeof prefs.avatar === 'object') {
    saveAvatarSel({
      scene: prefs.avatar.scene === 'office' || prefs.avatar.scene === 'intimate' ? prefs.avatar.scene : 'home',
      gender: prefs.avatar.gender === 'male' ? 'male' : 'female',
      outfit: typeof prefs.avatar.outfit === 'string' ? prefs.avatar.outfit : 'idol',
    });
    try { localStorage.setItem('mira.avatar2d', prefs.avatar.twoD === true ? '1' : '0'); } catch { /* noop */ }
  }

  return {
    theme: ['nova', 'aura', 'ember', 'iris'].includes(prefs.theme) ? prefs.theme as Theme : undefined,
    voiceURI: typeof voice.voiceURI === 'string' ? voice.voiceURI : undefined,
  };
}
