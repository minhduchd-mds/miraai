import { loadAvatarSel, saveAvatarSel } from '../../core/avatar-config';
import { legacyDeviceId } from '../../core/history-store';
import { loadSmartTurn, saveSmartTurn } from '../../core/stt/turn-config';
import { loadVadEnabled, saveVadEnabled } from '../../core/vad/config';
import { loadVoicePrefs, saveVoicePrefs, type ResponseLength } from '../../core/voice-prefs';
import type { Theme } from '../../core/types';
import { memoryEnabled, setMemoryEnabled } from '../memory/preferences';

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
  const prefs = json?.preferences || capsule?.preferences || {};
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
