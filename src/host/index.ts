import type { HostBridge } from './types';
import { StandaloneHostBridge } from './standalone';

let bridge: HostBridge | null = null;

export function getHostBridge(): HostBridge {
  if (!bridge) bridge = new StandaloneHostBridge();
  return bridge;
}

/** Embedders can replace the bridge before starting a conversation. */
export function setHostBridge(next: HostBridge): void {
  bridge = next;
}

export type { HostBridge, HostContext } from './types';
