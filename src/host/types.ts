import type { ResultView } from '../intelligence/skills/result-view';

export interface HostContext {
  id: string;
  product: string;
  project?: string;
  screen?: string;
  locale?: string;
  metadata?: Record<string, string | number | boolean | null>;
}

export type HostActionRisk = 'read' | 'write' | 'sensitive';

export interface HostActionDescriptor {
  id: string;
  title: string;
  description: string;
  risk: HostActionRisk;
  supportsVoice: boolean;
}

export interface HostActionResult {
  content?: ResultView;
  speechHint?: string;
  data?: unknown;
}

export interface HostBridge {
  getContext(): HostContext | Promise<HostContext>;
  listActions?(): HostActionDescriptor[] | Promise<HostActionDescriptor[]>;
  executeAction?(id: string, input: string, context: HostContext): Promise<HostActionResult | null>;
}
