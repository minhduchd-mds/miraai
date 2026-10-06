export interface DesktopInvokeApi {
  invoke<T>(command: string, args?: Record<string, unknown>): Promise<T>;
}

declare global {
  interface Window {
    __TAURI__?: {
      core?: DesktopInvokeApi;
    };
  }
}

export function isDesktopRuntime(): boolean {
  return typeof window !== 'undefined' && typeof window.__TAURI__?.core?.invoke === 'function';
}

export async function desktopInvoke<T>(
  command: string,
  args: Record<string, unknown> = {},
): Promise<T> {
  const invoke = typeof window !== 'undefined' ? window.__TAURI__?.core?.invoke : undefined;
  if (!invoke) throw new Error('Mira Desktop bridge is unavailable in this runtime.');
  return invoke<T>(command, args);
}
