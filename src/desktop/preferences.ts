import { desktopInvoke, isDesktopRuntime } from './bridge';

export type DesktopPermissionKey = 'media.control' | 'media.library' | 'memory.affect';

export interface DesktopInfo { platform: string; localFrontend: boolean; dataDir: string; memoryDb: string; }
export interface DesktopMusicLibraryStatus { enabled: boolean; root: string | null; trackCount: number; lastScanAt: number | null; }
export interface DesktopPrivacyState {
  info: DesktopInfo | null;
  permissions: Record<DesktopPermissionKey, boolean>;
  musicLibrary: DesktopMusicLibraryStatus | null;
}

const DEFAULTS: Record<DesktopPermissionKey, boolean> = { 'media.control': true, 'media.library': false, 'memory.affect': true };

export async function loadDesktopMusicLibraryStatus(): Promise<DesktopMusicLibraryStatus | null> {
  if (!isDesktopRuntime()) return null;
  return desktopInvoke<DesktopMusicLibraryStatus>('desktop_music_library_status');
}
export async function chooseDesktopMusicFolder(): Promise<DesktopMusicLibraryStatus> {
  if (!isDesktopRuntime()) throw new Error('Mira Desktop bridge is unavailable.');
  return desktopInvoke<DesktopMusicLibraryStatus>('desktop_music_choose_folder');
}
export async function rescanDesktopMusicLibrary(): Promise<DesktopMusicLibraryStatus> {
  if (!isDesktopRuntime()) throw new Error('Mira Desktop bridge is unavailable.');
  return desktopInvoke<DesktopMusicLibraryStatus>('desktop_music_rescan');
}
export async function loadDesktopPrivacyState(): Promise<DesktopPrivacyState> {
  if (!isDesktopRuntime()) return { info: null, permissions: { ...DEFAULTS }, musicLibrary: null };
  const [info, mediaControl, mediaLibrary, memoryAffect, musicLibraryStatus] = await Promise.all([
    desktopInvoke<DesktopInfo>('desktop_info'),
    desktopInvoke<boolean>('desktop_permission_get', { key: 'media.control' }),
    desktopInvoke<boolean>('desktop_permission_get', { key: 'media.library' }),
    desktopInvoke<boolean>('desktop_permission_get', { key: 'memory.affect' }),
    loadDesktopMusicLibraryStatus(),
  ]);
  return { info, permissions: { 'media.control': mediaControl, 'media.library': mediaLibrary, 'memory.affect': memoryAffect }, musicLibrary: musicLibraryStatus };
}
export async function setDesktopPermission(key: DesktopPermissionKey, value: boolean): Promise<void> {
  if (!isDesktopRuntime()) return;
  await desktopInvoke('desktop_permission_set', { key, value });
}
