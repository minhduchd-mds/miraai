import type { HostContext } from '../../host';
import type { ResultView } from './result-view';

export type SkillRisk = 'local-read' | 'external-read' | 'write' | 'sensitive';

export interface SkillContext {
  locale: string;
  host: HostContext;
  /** Write/sensitive skills must be explicitly approved by the interaction layer before execution. */
  approvedSkillIds?: readonly string[];
}

export interface SkillResult {
  skillId: string;
  content?: ResultView;
  speechHint?: string;
  data?: unknown;
}

/** Native Mira capability contract. Matching is pure; execution owns all side effects/network work. */
export interface MiraSkill {
  id: string;
  description: string;
  priority?: number;
  risk: SkillRisk;
  requiresNetwork: boolean;
  supportsVoice: boolean;
  examples?: string[];
  /** 0 = no match, 1 = exact intent. */
  match(input: string): number;
  execute(input: string, context: SkillContext): Promise<SkillResult | null>;
}
