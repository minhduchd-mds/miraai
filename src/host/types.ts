export interface HostContext {
  id: string;
  product: string;
  project?: string;
  screen?: string;
  locale?: string;
  metadata?: Record<string, string | number | boolean | null>;
}

export interface HostBridge {
  getContext(): HostContext | Promise<HostContext>;
}
