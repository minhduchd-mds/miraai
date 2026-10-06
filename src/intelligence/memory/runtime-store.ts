import { isDesktopRuntime } from '../../desktop/bridge';
import { DesktopMemoryStore } from './desktop-memory-store';
import { LocalMemoryStore } from './local-memory-store';

export type RuntimeMemoryStore = LocalMemoryStore | DesktopMemoryStore;

export function isGitHubPagesRuntime(): boolean {
  return typeof window !== 'undefined' && window.location.hostname.endsWith('.github.io');
}

export function isLocalOnlyMemoryRuntime(): boolean {
  return isDesktopRuntime() || isGitHubPagesRuntime();
}

export function createRuntimeMemoryStore(): RuntimeMemoryStore {
  return isDesktopRuntime() ? new DesktopMemoryStore() : new LocalMemoryStore();
}
