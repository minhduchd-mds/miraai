import type { MiraSkill, SkillContext, SkillResult } from './types';
import { weatherSkill } from './weather-skill';
import { imageSkill } from './image-skill';

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

  private allowed(skill: MiraSkill, context: SkillContext): boolean {
    if (skill.risk !== 'write' && skill.risk !== 'sensitive') return true;
    return context.approvedSkillIds?.includes(skill.id) === true;
  }

  private async run(skill: MiraSkill, input: string, context: SkillContext): Promise<SkillResult | null> {
    if (!this.allowed(skill, context)) {
      console.warn(`[Mira Skill] blocked unapproved ${skill.risk} skill: ${skill.id}`);
      return null;
    }
    try {
      return await skill.execute(input, context);
    } catch (error) {
      console.warn(`[Mira Skill] ${skill.id} failed`, error);
      return null;
    }
  }

  async execute(input: string, context: SkillContext): Promise<SkillResult | null> {
    const ranked = this.list()
      .map((skill) => ({ skill, score: skill.match(input) }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score || (b.skill.priority ?? 0) - (a.skill.priority ?? 0));
    if (!ranked.length) return null;
    return this.run(ranked[0].skill, input, context);
  }

  async executeById(id: string, input: string, context: SkillContext): Promise<SkillResult | null> {
    const skill = this.skills.get(id);
    if (!skill) return null;
    return this.run(skill, input, context);
  }
}

export function createDefaultSkillRegistry(): SkillRegistry {
  return new SkillRegistry([weatherSkill, imageSkill]);
}
