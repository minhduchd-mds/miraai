import { isDesktopRuntime } from './bridge';

const MIRA_CLOUD_API = 'https://miraai-five.vercel.app/api';

export function miraCloudApiUrl(route: string): string {
  const clean = String(route || '').replace(/^\/+/, '');
  return `${MIRA_CLOUD_API}/${clean}`;
}

export function miraApiUrl(route: string): string {
  const clean = String(route || '').replace(/^\/+/, '');
  return isDesktopRuntime() ? `${MIRA_CLOUD_API}/${clean}` : `/api/${clean}`;
}
