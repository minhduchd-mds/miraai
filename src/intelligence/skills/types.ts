import type { Content } from '../../core/content';
import type { HostContext } from '../../host';

export type SkillRisk = 'local-read' | 'external-read' | 'write' | 'sensitive';

export interface SkillContext {
  locale: string;
  host: HostContext;
}

export interface SkillResult {
  skillId: string;
  content?: Content;
  speechHint?: string;
  data?: unknown;
}

/**
 * Native Mira capability contract.
 * Metadata stays cheap and inspectable; execute owns the actual side effect/network work.
 */
export interface MiraSkill {
  id: string;
  description: string;
  priority?: number;
  risk: SkillRisk;
  requiresNetwork: boolean;
  supportsVoice: boolean;
  examples?: string[];
  /** 0 = no match, 1 = exact intent. Matching must be side-effect free. */
  match(input: string): number;
  execute(input: string, context: SkillContext): Promise<SkillResult | null>;
}
