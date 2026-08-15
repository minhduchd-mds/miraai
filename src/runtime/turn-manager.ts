import type { Brain, BrainReply, BrainTurn } from '../core/types';
import type { HostBridge } from '../host';
import { assembleBrainContext } from '../intelligence/context/context-assembler';
import { MemoryService } from '../intelligence/memory/memory-service';
import type { SkillRegistry, SkillResult } from '../intelligence/skills';

export interface TurnResult {
  reply: BrainReply;
  latencyMs: number;
}

function now(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

/** Coordinates context, memory, skills and Brain for one user turn. UI state stays in the React hook. */
export class TurnManager {
  constructor(
    private readonly getBrain: () => Brain,
    private readonly memory: MemoryService,
    private readonly skills: SkillRegistry,
    private readonly host: HostBridge,
  ) {}

  async run(input: string, prior: BrainTurn[], onSkill?: (result: SkillResult) => void): Promise<TurnResult> {
    const started = now();
    const hostPromise = Promise.resolve(this.host.getContext());

    // Visual/tool skills run in parallel and never block the conversational answer.
    void hostPromise
      .then((host) => this.skills.execute(input, { locale: host.locale || 'vi-VN', host }))
      .then((result) => result && onSkill?.(result))
      .catch((error) => console.warn('[Mira Skill] execution failed', error));

    const [memory, host] = await Promise.all([this.memory.recall(input), hostPromise]);
    const context = assembleBrainContext(memory, host, this.skills.list().map((skill) => skill.id));
    const reply = await this.getBrain().reply(input, prior, context);

    this.memory.distill(`Người dùng: ${input}\nMira: ${reply.text}`);
    return { reply, latencyMs: Math.round(now() - started) };
  }
}
