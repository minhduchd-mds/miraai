// Tuỳ chọn giọng nói dùng chung: tốc độ đọc + tính cách. Đọc TỨC THÌ lúc nói (TTS rate) và
// lúc trả lời (ghép tông vào system prompt LLM). Lưu localStorage, không cần tạo lại engine/brain.

export interface VoicePrefs {
  rate: number; // tốc độ đọc TTS
  persona: string; // id tính cách
}

// Object mutable dùng chung (giống audioLevel) — speak()/brain đọc trực tiếp.
export const voicePrefs: VoicePrefs = { rate: 1.0, persona: 'friendly' };

const LS = 'mira.voice.prefs';

export function loadVoicePrefs(): VoicePrefs {
  try {
    const c = JSON.parse(localStorage.getItem(LS) || '{}');
    if (typeof c.rate === 'number') voicePrefs.rate = c.rate;
    if (typeof c.persona === 'string') voicePrefs.persona = c.persona;
  } catch {
    /* noop */
  }
  return voicePrefs;
}

export function saveVoicePrefs(p: Partial<VoicePrefs>): void {
  Object.assign(voicePrefs, p);
  try {
    localStorage.setItem(LS, JSON.stringify(voicePrefs));
  } catch {
    /* noop */
  }
}

// Tốc độ (mặc định "Bình thường" ~ giọng Google dịch).
export const SPEEDS: { id: string; label: string; rate: number }[] = [
  { id: 'slow', label: 'Chậm', rate: 0.85 },
  { id: 'normal', label: 'Bình thường', rate: 1.0 },
  { id: 'fast', label: 'Nhanh', rate: 1.18 },
];

// Tính cách (icon + text) → tông giọng ghép vào system prompt của LLM.
export const PERSONAS: { id: string; icon: string; label: string; tone: string }[] = [
  { id: 'friendly', icon: '😊', label: 'Thân thiện', tone: 'Giọng điệu thân thiện, gần gũi, ấm áp.' },
  { id: 'pro', icon: '💼', label: 'Chuyên nghiệp', tone: 'Giọng điệu chuyên nghiệp, lịch sự, súc tích.' },
  { id: 'playful', icon: '✨', label: 'Vui tươi', tone: 'Giọng điệu vui tươi, dí dỏm nhẹ nhàng.' },
  { id: 'gentle', icon: '🌸', label: 'Dịu dàng', tone: 'Giọng điệu dịu dàng, nhẹ nhàng, chu đáo.' },
];

export function personaTone(id: string): string {
  return PERSONAS.find((p) => p.id === id)?.tone || '';
}
