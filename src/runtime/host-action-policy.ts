import type {
  HostActionAuthorization,
  HostActionDescriptor,
  HostBridge,
  HostContext,
} from '../host/types';

export interface HostAuthorizationDecision {
  allowed: boolean;
  reason: string;
  approvalId?: string;
}

/**
 * Host actions sit outside the native skill registry, so they require their own
 * execution boundary. Read actions remain backward-compatible unless a host
 * authorizer explicitly denies them. Write/sensitive actions fail closed unless
 * the embedding host explicitly authorizes this exact invocation.
 */
export async function authorizeHostAction(
  host: HostBridge,
  descriptor: HostActionDescriptor,
  input: string,
  context: HostContext,
): Promise<HostAuthorizationDecision> {
  if (host.authorizeAction) {
    try {
      const decision: HostActionAuthorization = await host.authorizeAction(
        descriptor,
        input,
        context,
      );
      if (decision.allowed) {
        return {
          allowed: true,
          reason: decision.reason || 'host-authorized',
          approvalId: decision.approvalId,
        };
      }
      return {
        allowed: false,
        reason: decision.reason || 'host-denied',
        approvalId: decision.approvalId,
      };
    } catch {
      return { allowed: false, reason: 'host-authorizer-failed' };
    }
  }

  if (descriptor.risk === 'read') {
    return { allowed: true, reason: 'read-default' };
  }
  return { allowed: false, reason: 'explicit-host-approval-required' };
}
