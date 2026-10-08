export interface DesktopInvokeApi {
  invoke<T>(command: string, args?: Record<string, unknown>): Promise<T>;
}
declare global {
  interface Window {
    __TAURI__?: { core?: DesktopInvokeApi };
    __TAURI_INTERNALS__?: { invoke?: DesktopInvokeApi['invoke'] };
  }
}
function nativeInvoker(): DesktopInvokeApi['invoke'] | undefined {
  if (typeof window === 'undefined') return undefined;
  const publicInvoke = window.__TAURI__?.core?.invoke;
  if (typeof publicInvoke === 'function') return publicInvoke;
  const internalInvoke = window.__TAURI_INTERNALS__?.invoke;
  return typeof internalInvoke === 'function' ? internalInvoke : undefined;
}
/**
 * An old v0.1.0 DMG embeds a REMOTE Vercel page. Even if that webview exposes
 * Tauri IPC globals, it does not ship our local SQLite commands. Never treat
 * that remote origin as the new local frontend: preserve legacy IndexedDB.
 *
 * Tauri local frontend: macOS tauri://localhost, Windows
 * http(s)://tauri.localhost; loopback hosts support Tauri development.
 */
function isLocalFrontendOrigin(): boolean {
  if (typeof window === 'undefined' || !window.location) return false;
  const { protocol, hostname } = window.location;
  return (protocol === 'tauri:' && hostname === 'localhost')
    || ((protocol === 'http:' || protocol === 'https:') &&
      (hostname === 'tauri.localhost' || hostname === 'localhost' || hostname === '127.0.0.1'));
}

export function isDesktopRuntime(): boolean {
  return Boolean(nativeInvoker()) && isLocalFrontendOrigin();
}
export async function desktopInvoke<T>(
  command: string, args: Record<string, unknown> = {},
): Promise<T> {
  const invoke = nativeInvoker();
  if (!invoke || !isLocalFrontendOrigin()) {
    throw new Error('Mira Desktop native bridge is unavailable on this origin. Install the local-frontend desktop build.');
  }
  return invoke<T>(command, args);
}
