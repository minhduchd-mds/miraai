// Tuỳ chọn hội thoại dùng chung: tốc độ đọc, tính cách và độ dài câu trả lời.
// Object mutable được đọc tức thì bởi TTS/Brain nên thay đổi Settings không cần tạo lại engine.

export type ResponseLength = 'short' | 'auto' | 'detailed' | 'deep';

export interface VoicePrefs {
  rate: number; // tốc độ đọc TTS
  persona: string; // id tính cách
  responseLength: ResponseLength; // độ dài câu trả lời hội thoại
}

export const voicePrefs: VoicePrefs = {
  rate: 1.0,
  persona: 'friendly',
  responseLength: 'auto',
};

const LS = 'mira.voice.prefs';

export function isResponseLength(value: unknown): value is ResponseLength {
  return value === 'short' || value === 'auto' || value === 'detailed' || value === 'deep';
}

export function loadVoicePrefs(): VoicePrefs {
  try {
    const c = JSON.parse(localStorage.getItem(LS) || '{}');
    if (typeof c.rate === 'number') voicePrefs.rate = c.rate;
    if (typeof c.persona === 'string') voicePrefs.persona = c.persona;
    if (isResponseLength(c.responseLength)) voicePrefs.responseLength = c.responseLength;
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

export const SPEEDS: { id: string; label: string; rate: number }[] = [
  { id: 'slow', label: 'Chậm', rate: 0.85 },
  { id: 'normal', label: 'Bình thường', rate: 1.0 },
  { id: 'fast', label: 'Nhanh', rate: 1.18 },
];

export const RESPONSE_LENGTHS: { id: ResponseLength; label: string; description: string }[] = [
  { id: 'short', label: 'Gọn', description: 'Ưu tiên câu trả lời ngắn; vẫn mở rộng khi anh yêu cầu nói kỹ.' },
  { id: 'auto', label: 'Tự động', description: 'Mira tự cân độ dài theo độ khó và mục đích của câu hỏi. Khuyên dùng.' },
  { id: 'detailed', label: 'Chi tiết', description: 'Giải thích đầy đủ hơn, có ví dụ, bước làm và điểm cần lưu ý.' },
  { id: 'deep', label: 'Chuyên sâu', description: 'Trao đổi dài kiểu chuyên gia: bối cảnh, phân tích, phương án và đánh đổi.' },
];

/** Prompt policy. Explicit user requests such as “nói kỹ hơn” always override the preset for that turn. */
export function responseLengthInstruction(mode: ResponseLength): string {
  const common =
    'QUY TẮC ĐỘ DÀI HỘI THOẠI: yêu cầu trực tiếp của người dùng luôn ưu tiên preset. ' +
    'Nếu người dùng nói “nói kỹ hơn”, “phân tích sâu”, “giải thích đầy đủ”, “kể tiếp” hoặc tương đương, hãy mở rộng thật sự; ' +
    'nếu họ nói “ngắn thôi”, “tóm tắt”, “nói gọn” thì rút gọn. Khi trả lời dài, chia thành các đoạn nói ngắn 2–4 câu, ' +
    'chuyển ý tự nhiên; không đọc tiêu đề Markdown và không kết thúc sớm bằng lời mời “nếu anh muốn…” khi vẫn còn nội dung cần giải thích.';

  const policy: Record<ResponseLength, string> = {
    short:
      'Preset GỌN: câu hỏi trực tiếp thường 2–4 câu. Với nội dung cần giải thích có thể 5–8 câu; không cắt mất bước hoặc cảnh báo quan trọng.',
    auto:
      'Preset TỰ ĐỘNG: câu hỏi fact rất đơn giản có thể 1–3 câu; trao đổi thông thường 3–6 câu; giải thích/hướng dẫn 6–12 câu; ' +
      'phân tích kiến trúc, chiến lược, so sánh, kể chuyện hoặc chủ đề nhiều lớp nên 10–20 câu khi cần. Ưu tiên đầy đủ ý hơn là cố ngắn.',
    detailed:
      'Preset CHI TIẾT: mặc định giải thích khoảng 8–16 câu khi chủ đề có chiều sâu, kèm ví dụ/bước làm/đánh đổi phù hợp. ' +
      'Câu hỏi fact đơn giản vẫn được trả lời ngắn để tránh dài dòng.',
    deep:
      'Preset CHUYÊN SÂU: với câu hỏi phân tích, mặc định trao đổi 14–28 câu nếu nội dung cho phép; đi từ bối cảnh → phân tích → ví dụ/phương án → đánh đổi → kết luận. ' +
      'Không kéo dài câu hỏi đơn giản chỉ để đủ số câu.',
  };
  return `${common}\n${policy[mode]}`;
}

/** Client-side/dev budget; server independently validates the same preset instead of accepting raw token counts. */
export function responseTokenBudget(mode: ResponseLength): number {
  return { short: 450, auto: 1200, detailed: 1800, deep: 2200 }[mode];
}

export function responseTimeoutMs(mode: ResponseLength): number {
  return { short: 25_000, auto: 40_000, detailed: 50_000, deep: 60_000 }[mode];
}

export const PERSONAS: { id: string; icon: string; label: string; tone: string }[] = [
  { id: 'friendly', icon: '😊', label: 'Thân thiện', tone: 'Giọng điệu thân thiện, gần gũi, ấm áp.' },
  { id: 'pro', icon: '💼', label: 'Chuyên nghiệp', tone: 'Giọng điệu chuyên nghiệp, lịch sự, súc tích.' },
  { id: 'playful', icon: '✨', label: 'Vui tươi', tone: 'Giọng điệu vui tươi, dí dỏm nhẹ nhàng.' },
  { id: 'gentle', icon: '🌸', label: 'Dịu dàng', tone: 'Giọng điệu dịu dàng, nhẹ nhàng, chu đáo.' },
];

export function personaTone(id: string): string {
  return PERSONAS.find((p) => p.id === id)?.tone || '';
}
