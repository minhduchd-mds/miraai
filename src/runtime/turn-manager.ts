import type { Brain, BrainReply, BrainTurn } from '../core/types';
import type { HostActionDescriptor, HostActionResult, HostBridge, HostContext } from '../host';
import { assembleBrainContext } from '../intelligence/context/context-assembler';
import { ownerIdentityReply } from '../intelligence/identity/owner-profile';
import { MemoryService } from '../intelligence/memory/memory-service';
import type { SkillRegistry, SkillResult } from '../intelligence/skills';

export interface TurnResult {
  reply: BrainReply;
  latencyMs: number;
}

function now(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

function hostActionToSkillResult(id: string, result: HostActionResult): SkillResult {
  return {
    skillId: `host:${id}`,
    content: result.content,
    speechHint: result.speechHint,
    data: result.data,
  };
}

/** Coordinates context, memory, skills, host actions and Brain for one user turn. */
export class TurnManager {
  constructor(
    private readonly getBrain: () => Brain,
    private readonly memory: MemoryService,
    private readonly skills: SkillRegistry,
    private readonly host: HostBridge,
  ) {}

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
    if (descriptor.risk !== 'read') {
      onSkill?.({
        skillId: `host:${descriptor.id}`,
        content: {
          kind: 'card',
          data: {
            eyebrow: 'Cần xác nhận',
            title: descriptor.title,
            body: `Mira chưa tự thực thi action ${descriptor.risk}. Hãy xác nhận trong ứng dụng chủ trước khi chạy.`,
          },
        },
      });
      return;
    }
    if (!this.host.executeAction) return;
    try {
      const result = await this.host.executeAction(descriptor.id, input, context);
      if (result) onSkill?.(hostActionToSkillResult(descriptor.id, result));
    } catch (error) {
      console.warn(`[Mira Host] action ${descriptor.id} failed`, error);
    }
  }

  async run(input: string, prior: BrainTurn[], onSkill?: (result: SkillResult) => void): Promise<TurnResult> {
    const started = now();

    // Product identity is deterministic and must not depend on provider memory/history.
    const identity = ownerIdentityReply(input);
    if (identity) {
      return {
        reply: { text: identity, mood: 'happy' },
        latencyMs: Math.round(now() - started),
      };
    }

    const hostPromise = Promise.resolve(this.host.getContext());
    const hostActionsPromise = this.listHostActions();

    // Fast deterministic skills can render in parallel and never block the spoken response.
    void hostPromise
      .then((host) => this.skills.execute(input, { locale: host.locale || 'vi-VN', host }))
      .then((result) => result && onSkill?.(result))
      .catch((error) => console.warn('[Mira Skill] execution failed', error));

    const [memory, host, hostActions] = await Promise.all([
      this.memory.recall(input),
      hostPromise,
      hostActionsPromise,
    ]);
    const context = assembleBrainContext(
      memory,
      host,
      this.skills.describe(),
      hostActions.map((action) => `host:${action.id} [${action.risk}] — ${action.description}`),
    );
    const reply = await this.getBrain().reply(input, prior, context);

    for (const call of reply.toolCalls || []) {
      if (call.skillId.startsWith('host:')) {
        const id = call.skillId.slice('host:'.length);
        const descriptor = hostActions.find((action) => action.id === id);
        if (descriptor) void this.executeHostAction(descriptor, call.input || input, host, onSkill);
        continue;
      }
      void this.skills
        .executeById(call.skillId, call.input || input, { locale: host.locale || 'vi-VN', host })
        .then((result) => result && onSkill?.(result))
        .catch((error) => console.warn(`[Mira ToolCall] ${call.skillId} failed`, error));
    }

    this.memory.distill(`Người dùng: ${input}\nMira: ${reply.text}`);
    return { reply, latencyMs: Math.round(now() - started) };
  }
}
