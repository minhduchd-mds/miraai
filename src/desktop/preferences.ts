import { desktopInvoke, isDesktopRuntime } from './bridge';

export type DesktopPermissionKey = 'media.control' | 'memory.affect';

export interface DesktopInfo {
  platform: string;
  localFrontend: boolean;
  dataDir: string;
  memoryDb: string;
}

export interface DesktopPrivacyState {
  info: DesktopInfo | null;
  permissions: Record<DesktopPermissionKey, boolean>;
}

const DEFAULTS: Record<DesktopPermissionKey, boolean> = {
  'media.control': true,
  'memory.affect': true,
};

export async function loadDesktopPrivacyState(): Promise<DesktopPrivacyState> {
  if (!isDesktopRuntime()) {
    return { info: null, permissions: { ...DEFAULTS } };
  }
  const [info, mediaControl, memoryAffect] = await Promise.all([
    desktopInvoke<DesktopInfo>('desktop_info'),
    desktopInvoke<boolean>('desktop_permission_get', { key: 'media.control' }),
    desktopInvoke<boolean>('desktop_permission_get', { key: 'memory.affect' }),
  ]);
  return {
    info,
    permissions: {
      'media.control': mediaControl,
      'memory.affect': memoryAffect,
    },
  };
}

export async function setDesktopPermission(key: DesktopPermissionKey, value: boolean): Promise<void> {
  if (!isDesktopRuntime()) return;
  await desktopInvoke('desktop_permission_set', { key, value });
}
