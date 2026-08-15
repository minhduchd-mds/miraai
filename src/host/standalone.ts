import type { HostBridge, HostContext } from './types';

declare global {
  interface Window {
    /** Host applications (for example Soi) may inject current product/project/screen context. */
    __MIRA_HOST_CONTEXT__?: Partial<HostContext>;
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
}
