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

  list(): MiraSkill[] {
    return [...this.skills.values()];
  }

  async execute(input: string, context: SkillContext): Promise<SkillResult | null> {
    const ranked = this.list()
      .map((skill) => ({ skill, score: skill.match(input) }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score || (b.skill.priority ?? 0) - (a.skill.priority ?? 0));
    if (!ranked.length) return null;
    try {
      return await ranked[0].skill.execute(input, context);
    } catch (error) {
      console.warn(`[Mira Skill] ${ranked[0].skill.id} failed`, error);
      return null;
    }
  }
}

export function createDefaultSkillRegistry(): SkillRegistry {
  return new SkillRegistry([weatherSkill, imageSkill]);
}
