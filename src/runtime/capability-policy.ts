import type {
  MiraCapability,
  MiraSkill,
  SkillContext,
} from '../intelligence/skills/types';

const APPROVAL_GATED = new Set<MiraCapability>([
  'host.write',
  'network.write',
  'storage.write',
  'sensitive.read',
]);

export interface CapabilityDecision {
  allowed: boolean;
  required: MiraCapability[];
  blocked: MiraCapability[];
  reason: 'allowed' | 'skill-approval-required' | 'network-disabled' | 'capability-not-allowed' | 'capability-approval-required';
}

function unique(values: readonly MiraCapability[]): MiraCapability[] {
  return [...new Set(values)];
}

/**
 * Conservative fallback for legacy skills. New side-effecting skills should
 * declare capabilities explicitly so policy is not inferred from naming.
 */
export function inferSkillCapabilities(skill: MiraSkill): MiraCapability[] {
  if (skill.capabilities?.length) return unique(skill.capabilities);

  const required: MiraCapability[] = [];
  switch (skill.risk) {
    case 'local-read':
      required.push('storage.read');
      break;
    case 'external-read':
      required.push('network.read');
      break;
    case 'write':
      required.push(skill.requiresNetwork ? 'network.write' : 'host.write');
      break;
    case 'sensitive':
      required.push('sensitive.read');
      if (skill.requiresNetwork) required.push('network.read');
      break;
  }

  if (
    skill.requiresNetwork &&
    !required.includes('network.read') &&
    !required.includes('network.write')
  ) {
    required.push('network.read');
  }

  return unique(required);
}

function isNetwork(capability: MiraCapability): boolean {
  return capability === 'network.read' || capability === 'network.write';
}

/**
 * Two-key execution gate:
 * 1) write/sensitive skills still need explicit per-skill approval;
 * 2) when a runtime policy is supplied, every required capability must be
 *    allowed and write/sensitive capabilities need capability approval too.
 *
 * No policy means backward-compatible behavior for current Mira callers.
 */
export function evaluateSkillCapabilityPolicy(
  skill: MiraSkill,
  context: SkillContext,
): CapabilityDecision {
  const required = inferSkillCapabilities(skill);

  if (
    (skill.risk === 'write' || skill.risk === 'sensitive') &&
    context.approvedSkillIds?.includes(skill.id) !== true
  ) {
    return {
      allowed: false,
      required,
      blocked: required,
      reason: 'skill-approval-required',
    };
  }

  const policy = context.capabilityPolicy;
  if (!policy) {
    return { allowed: true, required, blocked: [], reason: 'allowed' };
  }

  if (policy.denyNetwork) {
    const blocked = required.filter(isNetwork);
    if (blocked.length) {
      return { allowed: false, required, blocked, reason: 'network-disabled' };
    }
  }

  if (policy.allowedCapabilities) {
    const allowed = new Set(policy.allowedCapabilities);
    const blocked = required.filter((capability) => !allowed.has(capability));
    if (blocked.length) {
      return { allowed: false, required, blocked, reason: 'capability-not-allowed' };
    }
  }

  const gated = required.filter((capability) => APPROVAL_GATED.has(capability));
  if (gated.length) {
    const approved = new Set(policy.approvedCapabilities ?? []);
    const blocked = gated.filter((capability) => !approved.has(capability));
    if (blocked.length) {
      return {
        allowed: false,
        required,
        blocked,
        reason: 'capability-approval-required',
      };
    }
  }

  return { allowed: true, required, blocked: [], reason: 'allowed' };
}
