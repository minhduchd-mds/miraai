import type { Brain, BrainReply, BrainTurn } from '../core/types';
import type { HostActionDescriptor, HostActionResult, HostBridge, HostContext } from '../host';
import { assembleBrainContext } from '../intelligence/context/context-assembler';
import { ownerIdentityReply } from '../intelligence/identity/owner-profile';
import { deicticVisualReply } from '../intelligence/vision/deictic-vision';
import { MemoryService } from '../intelligence/memory/memory-service';
import type { SkillPolicyAuditEvent, SkillRegistry, SkillResult } from '../intelligence/skills';
import { authorizeHostAction } from './host-action-policy';
import { runtimeAuditTrail } from './runtime-audit';

export interface TurnResult {
  reply: BrainReply;
  latencyMs: number;
}

function now(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

function hostActionToSkillResult(id: string, result: HostActionResult): SkillResult {
  return {
    skillId: 'host:' + id,
    content: result.content,
    speechHint: result.speechHint,
    data: result.data,
  };
}

export class TurnManager {
  constructor(
    private readonly getBrain: () => Brain,
    private readonly memory: MemoryService,
    private readonly skills: SkillRegistry,
    private readonly host: HostBridge,
  ) {}

  private skillContext(host: HostContext) {
    return {
      locale: host.locale || 'vi-VN',
      host,
      onPolicyDecision: (event: SkillPolicyAuditEvent) => {
        runtimeAuditTrail.record({
          kind: 'skill',
          id: event.skillId,
          outcome: event.allowed ? 'allowed' : 'blocked',
          reason: event.reason,
          capabilities: event.required,
          hostId: host.id,
        });
      },
    };
  }

  private async listHostActions(): Promise<HostActionDescriptor[]> {
    if (!this.host.listActions) return [];
    try {
      const actions = await this.host.listActions();
      return Array.isArray(actions) ? actions : [];
    } catch (error) {
      console.warn('[Mira Host] listActions failed', error);
      return [];
    }
  }

  private async executeHostAction(
    descriptor: HostActionDescriptor,
    input: string,
    context: HostContext,
    onSkill?: (result: SkillResult) => void,
  ): Promise<void> {
    const authorization = await authorizeHostAction(this.host, descriptor, input, context);
    runtimeAuditTrail.record({
      kind: 'host',
      id: descriptor.id,
      risk: descriptor.risk,
      outcome: authorization.allowed ? 'allowed' : 'blocked',
      reason: authorization.reason,
      hostId: context.id,
    });

    if (!authorization.allowed) {
      onSkill?.({
        skillId: 'host:' + descriptor.id,
        content: {
          kind: 'card',
          data: {
            eyebrow: 'Cần xác nhận',
            title: descriptor.title,
            body:
              descriptor.risk === 'read'
                ? 'Ứng dụng chủ đã chặn thao tác này.'
                : 'Thao tác này chỉ chạy sau khi ứng dụng chủ xác nhận rõ quyền thực thi.',
          },
        },
      });
      return;
    }

    if (!this.host.executeAction) {
      runtimeAuditTrail.record({
        kind: 'host',
        id: descriptor.id,
        risk: descriptor.risk,
        outcome: 'failed',
        reason: 'host-executor-unavailable',
        hostId: context.id,
      });
      return;
    }

    try {
      const result = await this.host.executeAction(descriptor.id, input, context);
      runtimeAuditTrail.record({
        kind: 'host',
        id: descriptor.id,
        risk: descriptor.risk,
        outcome: 'executed',
        reason: authorization.reason,
        hostId: context.id,
      });
      if (result) onSkill?.(hostActionToSkillResult(descriptor.id, result));
    } catch (error) {
      runtimeAuditTrail.record({
        kind: 'host',
        id: descriptor.id,
        risk: descriptor.risk,
        outcome: 'failed',
        reason: 'host-execution-failed',
        hostId: context.id,
      });
      console.warn('[Mira Host] action ' + descriptor.id + ' failed', error);
    }
  }

  async run(
    input: string,
    prior: BrainTurn[],
    onSkill?: (result: SkillResult) => void,
    runtimeContext = '',
  ): Promise<TurnResult> {
    const started = now();
    const identity = ownerIdentityReply(input);
    if (identity) {
      return { reply: { text: identity, mood: 'happy' }, latencyMs: Math.round(now() - started) };
    }

    const visualReply = deicticVisualReply(input, runtimeContext);
    if (visualReply) {
      return { reply: { text: visualReply, mood: 'neutral' }, latencyMs: Math.round(now() - started) };
    }

    const hostPromise = Promise.resolve(this.host.getContext());
    const hostActionsPromise = this.listHostActions();

    void hostPromise
      .then((host) => this.skills.execute(input, this.skillContext(host)))
      .then((result) => result && onSkill?.(result))
      .catch((error) => console.warn('[Mira Skill] execution failed', error));

    const [memory, host, hostActions] = await Promise.all([
      this.memory.recall(input),
      hostPromise,
      hostActionsPromise,
    ]);
    const baseContext = assembleBrainContext(
      memory,
      host,
      this.skills.describe(),
      hostActions.map((action) => 'host:' + action.id + ' [' + action.risk + '] — ' + action.description),
    );
    const context = [baseContext, runtimeContext.trim()].filter(Boolean).join('\n\n');
    const reply = await this.getBrain().reply(input, prior, context);

    for (const call of reply.toolCalls || []) {
      if (call.skillId.startsWith('host:')) {
        const id = call.skillId.slice('host:'.length);
        const descriptor = hostActions.find((action) => action.id === id);
        if (descriptor) void this.executeHostAction(descriptor, call.input || input, host, onSkill);
        continue;
      }
      void this.skills
        .executeById(call.skillId, call.input || input, this.skillContext(host))
        .then((result) => result && onSkill?.(result))
        .catch((error) => console.warn('[Mira ToolCall] ' + call.skillId + ' failed', error));
    }

    this.memory.distill('Người dùng: ' + input + '\nMira: ' + reply.text);
    return { reply, latencyMs: Math.round(now() - started) };
  }
}
