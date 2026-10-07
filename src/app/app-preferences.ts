import type { Theme } from '../core/types';
import {
  sanitizePresenceReturnSamples,
  type PresenceReturnSample,
} from '../presence/presence-scene';

const THEME_STORAGE = 'mira.theme';
const AFFECT_FOLLOW_STORAGE = 'mira.affect.follow';
const PRESENCE_RETURN_STORAGE = 'mira.presence.return-samples.v1';

export function loadTheme(): Theme {
  try {
    const raw = localStorage.getItem(THEME_STORAGE);
    if (raw === 'nova' || raw === 'aura' || raw === 'ember' || raw === 'iris') return raw;
  } catch {
    // Local preferences are best-effort.
  }
  return 'nova';
}

export function saveTheme(theme: Theme): void {
  try {
    localStorage.setItem(THEME_STORAGE, theme);
  } catch {
    // Local preferences are best-effort.
  }
}

export function loadAffectFollowing(): boolean {
  try {
    return localStorage.getItem(AFFECT_FOLLOW_STORAGE) !== '0';
  } catch {
    return true;
  }
}

export function saveAffectFollowing(enabled: boolean): void {
  try {
    localStorage.setItem(AFFECT_FOLLOW_STORAGE, enabled ? '1' : '0');
  } catch {
    // Local preferences are best-effort.
  }
}

export function loadPresenceReturnSamples(): PresenceReturnSample[] {
  try {
    const raw = localStorage.getItem(PRESENCE_RETURN_STORAGE);
    if (!raw) return [];
    return sanitizePresenceReturnSamples(JSON.parse(raw));
  } catch {
    return [];
  }
}

export function savePresenceReturnSamples(samples: PresenceReturnSample[]): void {
  try {
    localStorage.setItem(PRESENCE_RETURN_STORAGE, JSON.stringify(samples));
  } catch {
    // Presence learning is local-only and best-effort.
  }
}
