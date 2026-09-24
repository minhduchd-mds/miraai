let wakeLock: any = null;
let active = false;
let resumeCallback: (() => void) | null = null;
let listenersBound = false;

async function registerWorker(): Promise<void> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
  try {
    const base = import.meta.env.BASE_URL || './';
    await navigator.serviceWorker.register(base + 'sw.js', { scope: base });
  } catch (error) {
    console.warn('[Mira Background] service worker unavailable', error);
  }
}

async function requestWakeLock(): Promise<void> {
  if (!active || typeof navigator === 'undefined') return;
  try {
    const wake = (navigator as any).wakeLock;
    if (!wake?.request || document.visibilityState !== 'visible') return;
    wakeLock = await wake.request('screen');
    wakeLock?.addEventListener?.('release', () => { wakeLock = null; });
  } catch {
    wakeLock = null;
  }
}

async function releaseWakeLock(): Promise<void> {
  try { await wakeLock?.release?.(); } catch { /* noop */ }
  wakeLock = null;
}

function onVisibility(): void {
  if (!active || document.visibilityState !== 'visible') return;
  void requestWakeLock();
  resumeCallback?.();
}

function onFocus(): void {
  if (!active) return;
  resumeCallback?.();
}

export async function enableBackgroundCompanion(onResume?: () => void): Promise<void> {
  active = true;
  resumeCallback = onResume || null;
  if (!listenersBound) {
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('focus', onFocus);
    listenersBound = true;
  }
  await registerWorker();
  await requestWakeLock();
  try {
    navigator.serviceWorker?.controller?.postMessage?.({ type: 'MIRA_HEARTBEAT', live: true, at: Date.now() });
  } catch { /* noop */ }
}

export async function disableBackgroundCompanion(): Promise<void> {
  active = false;
  resumeCallback = null;
  await releaseWakeLock();
  try {
    navigator.serviceWorker?.controller?.postMessage?.({ type: 'MIRA_HEARTBEAT', live: false, at: Date.now() });
  } catch { /* noop */ }
}

export function backgroundCompanionActive(): boolean {
  return active;
}
