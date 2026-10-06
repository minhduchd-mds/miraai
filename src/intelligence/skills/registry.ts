import type { MiraSkill, SkillContext, SkillResult } from './types';
import { evaluateSkillCapabilityPolicy } from '../../runtime/capability-policy';
import { weatherSkill } from './weather-skill';
import { imageSkill } from './image-skill';
import { desktopMusicSkill } from './desktop-music-skill';
import { financeCalculatorSkill } from './finance-calculator-skill';
import { financeLiveSkill } from './finance-live-skill';
import { financePolicySkill } from './finance-policy-skill';

export class SkillRegistry {
  private readonly skills = new Map<string, MiraSkill>();

  constructor(initial: MiraSkill[] = []) {
    initial.forEach((skill) => this.register(skill));
  }

  register(skill: MiraSkill): this {
    this.skills.set(skill.id, skill);
    return this;
  }

  unregister(id: string): void {
    this.skills.delete(id);
  }

  get(id: string): MiraSkill | undefined {
    return this.skills.get(id);
  }

  list(): MiraSkill[] {
    return [...this.skills.values()];
  }

  describe(): string[] {
    return this.list().map((skill) => `${skill.id} [${skill.risk}] — ${skill.description}`);
  }

  private async run(skill: MiraSkill, input: string, context: SkillContext): Promise<SkillResult | null> {
    const decision = evaluateSkillCapabilityPolicy(skill, context);
    try {
      context.onPolicyDecision?.({
        skillId: skill.id,
        allowed: decision.allowed,
        reason: decision.reason,
        required: decision.required,
        blocked: decision.blocked,
      });
    } catch {
      // Audit hooks are observational only; they must never change execution.
    }

    if (!decision.allowed) {
      const blocked = decision.blocked.length ? ` (${decision.blocked.join(', ')})` : '';
      console.warn(
        `[Mira Capability] blocked ${skill.id}: ${decision.reason}${blocked}`,
      );
      return null;
    }

    try {
      return await skill.execute(input, context);
    } catch (error) {
      console.warn(`[Mira Skill] ${skill.id} failed`, error);
      return null;
    }
  }

  route(input: string): { skill: MiraSkill; score: number } | null {
    const ranked = this.list()
      .map((skill) => ({ skill, score: skill.match(input) }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score || (b.skill.priority ?? 0) - (a.skill.priority ?? 0));
    return ranked[0] ?? null;
  }

  async execute(input: string, context: SkillContext): Promise<SkillResult | null> {
    const route = this.route(input);
    if (!route) return null;
    return this.run(route.skill, input, context);
  }

  async executeById(id: string, input: string, context: SkillContext): Promise<SkillResult | null> {
    const skill = this.skills.get(id);
    if (!skill) return null;
    return this.run(skill, input, context);
  }
}

export function createDefaultSkillRegistry(): SkillRegistry {
  return new SkillRegistry([financeCalculatorSkill, financeLiveSkill, financePolicySkill, desktopMusicSkill, weatherSkill, imageSkill]);
}
