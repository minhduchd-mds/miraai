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
export function isDesktopRuntime(): boolean {
  return Boolean(nativeInvoker());
}
export async function desktopInvoke<T>(
  command: string, args: Record<string, unknown> = {},
): Promise<T> {
  const invoke = nativeInvoker();
  if (!invoke) throw new Error('Mira Desktop native bridge is unavailable. Install the local-frontend desktop build.');
  return invoke<T>(command, args);
}
