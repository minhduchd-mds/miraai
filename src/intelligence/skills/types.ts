import type { HostContext } from '../../host';
import type { ResultView } from './result-view';

export type SkillRisk = 'local-read' | 'external-read' | 'write' | 'sensitive';

export type MiraCapability =
  | 'host.read'
  | 'host.write'
  | 'network.read'
  | 'network.write'
  | 'storage.read'
  | 'storage.write'
  | 'sensitive.read';

export interface RuntimeCapabilityPolicy {
  /** Omit to keep the capability allow-list open. When present, only listed capabilities may run. */
  allowedCapabilities?: readonly MiraCapability[];
  /** Second key for write/sensitive capabilities. Skill approval alone is not enough when a policy is supplied. */
  approvedCapabilities?: readonly MiraCapability[];
  /** Emergency circuit breaker for any network-backed skill. */
  denyNetwork?: boolean;
}

export interface SkillContext {
  locale: string;
  host: HostContext;
  /** Write/sensitive skills must be explicitly approved by the interaction layer before execution. */
  approvedSkillIds?: readonly string[];
  /** Optional runtime capability boundary. Existing callers remain backward-compatible when omitted. */
  capabilityPolicy?: RuntimeCapabilityPolicy;
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
  /** Explicit capabilities override conservative inference from risk/requiresNetwork. */
  capabilities?: readonly MiraCapability[];
  examples?: string[];
  /** 0 = no match, 1 = exact intent. */
  match(input: string): number;
  execute(input: string, context: SkillContext): Promise<SkillResult | null>;
}
