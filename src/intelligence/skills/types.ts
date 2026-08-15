import type { Content } from '../../core/content';
import type { HostContext } from '../../host';

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

export interface MiraSkill {
  id: string;
  description: string;
  priority?: number;
  /** 0 = no match, 1 = exact intent. */
  match(input: string): number;
  execute(input: string, context: SkillContext): Promise<SkillResult | null>;
}
