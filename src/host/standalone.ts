import type { HostActionDescriptor, HostActionResult, HostBridge, HostContext } from './types';

declare global {
  interface Window {
    /** Host applications (for example Soi) may inject current product/project/screen context. */
    __MIRA_HOST_CONTEXT__?: Partial<HostContext>;
    /** Same-window hosts may expose read/write actions without coupling Mira core to that product. */
    __MIRA_HOST_ACTIONS__?: {
      actions: HostActionDescriptor[];
      execute: (id: string, input: string, context: HostContext) => Promise<HostActionResult | null>;
    };
  }
}

const DEFAULT_CONTEXT: HostContext = {
  id: 'standalone',
  product: 'Mira',
  locale: 'vi-VN',
};

export class StandaloneHostBridge implements HostBridge {
  getContext(): HostContext {
    const injected = typeof window !== 'undefined' ? window.__MIRA_HOST_CONTEXT__ : undefined;
    return {
      ...DEFAULT_CONTEXT,
      ...injected,
      id: injected?.id || DEFAULT_CONTEXT.id,
      product: injected?.product || DEFAULT_CONTEXT.product,
    };
  }

  listActions(): HostActionDescriptor[] {
    if (typeof window === 'undefined') return [];
    return Array.isArray(window.__MIRA_HOST_ACTIONS__?.actions) ? window.__MIRA_HOST_ACTIONS__!.actions : [];
  }

  async executeAction(id: string, input: string, context: HostContext): Promise<HostActionResult | null> {
    const runtime = typeof window !== 'undefined' ? window.__MIRA_HOST_ACTIONS__ : undefined;
    if (!runtime?.execute) return null;
    return runtime.execute(id, input, context);
  }
}
