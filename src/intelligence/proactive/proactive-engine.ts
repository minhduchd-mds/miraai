import type { AffectState, ObservedMood } from '../affect/mood-engine';

const STORAGE_KEY = 'mira.proactive.last-prompt';
const COOLDOWN_MS = 5 * 60_000;

function loadLastPrompt(): number {
  try {
    const value = Number(localStorage.getItem(STORAGE_KEY) || '');
    return Number.isFinite(value) && value > 0 ? value : Number.NEGATIVE_INFINITY;
  } catch {
    return Number.NEGATIVE_INFINITY;
  }
}

function saveLastPrompt(value: number): void {
  try { localStorage.setItem(STORAGE_KEY, String(value)); } catch { /* noop */ }
}

export class ProactiveEngine {
  private lastPromptAt = loadLastPrompt();
  private lastUserAt = Date.now();
  private mood: ObservedMood = 'neutral';
  private moodSince = Date.now();

  noteUserActivity(now = Date.now()): void {
    this.lastUserAt = now;
  }

  observeAffect(affect: AffectState, now = Date.now()): void {
    if (affect.mood !== this.mood) {
      this.mood = affect.mood;
      this.moodSince = now;
    }
  }

  private commit(prompt: string, now: number): string {
    this.lastPromptAt = now;
    saveLastPrompt(now);
    return prompt;
  }

  nextForSilence(affect: AffectState, now = Date.now()): string | null {
    this.observeAffect(affect, now);
    if (now - this.lastPromptAt < COOLDOWN_MS) return null;

    const interaction = affect.interaction;
    if (interaction?.state === 'absent' || interaction?.state === 'looking_away') return null;
    if (interaction?.state === 'returning' && interaction.lastAwayMs >= 15_000 && interaction.confidence >= 0.55) {
      return this.commit('Anh quay lại rồi. Em tiếp tục ở đây nhé.', now);
    }

    if (affect.confidence >= 0.58 && now - this.moodSince >= 8_000) {
      if (affect.mood === 'happy') return this.commit('Em thấy tín hiệu nụ cười đang rõ hơn. Có chuyện vui anh muốn kể em không?', now);
      if (affect.mood === 'sad') {
        return this.commit('Nét mặt của anh đang trầm hơn baseline một chút. Anh muốn em nói nhẹ hơn hay mình cứ tiếp tục như bình thường?', now);
      }
      if (affect.mood === 'tired') {
        return this.commit('Tín hiệu mắt và tư thế đang có vẻ chậm hơn bình thường. Em sẽ nói ngắn và chậm hơn một chút nhé.', now);
      }
      if (affect.mood === 'angry') {
        return this.commit('Em thấy tín hiệu brow và lip-press đang căng hơn. Em sẽ nói gọn và rõ để mình đỡ bị ngắt nhịp.', now);
      }
      if (affect.mood === 'surprised') {
        return this.commit('Camera vừa thấy một phản ứng mở khá nhanh ở mắt và hàm. Em đang nghe đây.', now);
      }
    }

    const idleMs = now - this.lastUserAt;
    const hour = new Date(now).getHours();
    if (idleMs > 20 * 60_000 && hour >= 23) {
      return this.commit('Muộn rồi, em vẫn ở đây. Nếu anh tiếp tục làm việc, em sẽ giữ câu trả lời ngắn và yên hơn.', now);
    }
    return null;
  }

  nextContextPrompt(kind: 'resume' | 'wake', affect: AffectState, now = Date.now()): string | null {
    this.observeAffect(affect, now);
    if (now - this.lastPromptAt < COOLDOWN_MS) return null;
    if (affect.interaction?.state === 'absent' || affect.interaction?.state === 'looking_away') return null;
    const awayMs = now - this.lastUserAt;
    if ((kind === 'resume' || kind === 'wake') && awayMs > 30 * 60_000) {
      return this.commit('Anh quay lại rồi à. Em vẫn ở đây.', now);
    }
    return null;
  }
}
