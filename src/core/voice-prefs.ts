// Tuỳ chọn hội thoại dùng chung: tốc độ đọc, tính cách và độ dài câu trả lời.
// Object mutable được đọc tức thì bởi TTS/Brain nên thay đổi Settings không cần tạo lại engine.

export type ResponseLength = 'short' | 'auto' | 'detailed' | 'deep';

export interface VoicePrefs {
  rate: number; // tốc độ đọc TTS
  persona: string; // id tính cách
  responseLength: ResponseLength; // độ dài câu trả lời hội thoại
}

export const voicePrefs: VoicePrefs = {
  rate: 1,
  persona: 'gentle',
  responseLength: 'auto',
};

const LS = 'mira.voice.prefs';
const ADULT_LS = 'mira.adult.confirmed.v1';
const INTIMATE_SCENES_LS = 'mira.scenes.intimate.v1';

/** Self-attested 18+ gate for the partner role-play and intimate scenes (device-local). */
export function isAdultConfirmed(): boolean {
  try { return localStorage.getItem(ADULT_LS) === 'yes'; } catch { return false; }
}

export function setAdultConfirmed(value: boolean): void {
  try {
    if (value) localStorage.setItem(ADULT_LS, 'yes');
    else { localStorage.removeItem(ADULT_LS); localStorage.removeItem(INTIMATE_SCENES_LS); }
  } catch { /* storage blocked: gate stays closed */ }
}

/** Evening "welcome home" and bedtime scenes are opt-in and require the 18+ gate. */
export function intimateScenesEnabled(): boolean {
  try { return isAdultConfirmed() && localStorage.getItem(INTIMATE_SCENES_LS) === 'yes'; } catch { return false; }
}

export function setIntimateScenesEnabled(value: boolean): void {
  try {
    if (value && isAdultConfirmed()) localStorage.setItem(INTIMATE_SCENES_LS, 'yes');
    else localStorage.removeItem(INTIMATE_SCENES_LS);
  } catch { /* noop */ }
}

export function isResponseLength(value: unknown): value is ResponseLength {
  return value === 'short' || value === 'auto' || value === 'detailed' || value === 'deep';
}

export function loadVoicePrefs(): VoicePrefs {
  try {
    const c = JSON.parse(localStorage.getItem(LS) || '{}');
    const legacyDefaultProfile = Number(c.voiceProfileVersion || 0) < 2
      && (c.persona == null || c.persona === 'friendly')
      && (c.rate == null || Math.abs(Number(c.rate) - 1) < 0.001);

    if (legacyDefaultProfile) {
      voicePrefs.rate = 1;
      voicePrefs.persona = 'gentle';
      if (isResponseLength(c.responseLength)) voicePrefs.responseLength = c.responseLength;
      localStorage.setItem(LS, JSON.stringify({
        ...c,
        rate: voicePrefs.rate,
        persona: voicePrefs.persona,
        voiceProfileVersion: 2,
      }));
    } else {
      if (typeof c.rate === 'number') voicePrefs.rate = c.rate;
      if (typeof c.persona === 'string' && PERSONAS.some((p) => p.id === c.persona)) voicePrefs.persona = c.persona;
      // The intimate role never survives without an explicit 18+ confirmation on this device.
      if (voicePrefs.persona === 'partner' && !isAdultConfirmed()) voicePrefs.persona = 'close';
      if (isResponseLength(c.responseLength)) voicePrefs.responseLength = c.responseLength;
    }
  } catch {
    /* noop */
  }
  return voicePrefs;
}

export function saveVoicePrefs(p: Partial<VoicePrefs>): void {
  const safe = { ...p };
  if (safe.persona != null && !PERSONAS.some((item) => item.id === safe.persona)) delete safe.persona;
  if (safe.persona === 'partner' && !isAdultConfirmed()) delete safe.persona;
  Object.assign(voicePrefs, safe);
  try {
    localStorage.setItem(LS, JSON.stringify({ ...voicePrefs, voiceProfileVersion: 2 }));
  } catch {
    /* noop */
  }
}

export const SPEEDS: { id: string; label: string; rate: number }[] = [
  { id: 'slow', label: 'Chậm', rate: 0.92 },
  { id: 'normal', label: 'Êm', rate: 1 },
  { id: 'fast', label: 'Nhanh', rate: 1.05 },
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
  // Server may try two 24s free providers after bounded memory lookup.
  return { short: 58_000, auto: 70_000, detailed: 75_000, deep: 80_000 }[mode];
}

export const PERSONAS: { id: string; icon: string; label: string; tone: string }[] = [
  { id: 'friendly', icon: '😊', label: 'Thân thiện', tone: 'Giọng điệu thân thiện, gần gũi, ấm áp.' },
  { id: 'pro', icon: '💼', label: 'Chuyên nghiệp', tone: 'Giọng điệu chuyên nghiệp, lịch sự, súc tích.' },
  { id: 'playful', icon: '✨', label: 'Vui tươi', tone: 'Giọng điệu vui tươi, dí dỏm nhẹ nhàng.' },
  { id: 'gentle', icon: '🌸', label: 'Dịu dàng', tone: 'Giọng điệu dịu dàng, nhẹ nhàng, chu đáo.' },
  { id: 'close', icon: '💗', label: 'Thân thiết', tone: 'Chế độ bạn đồng hành thân thiết: trò chuyện ấm áp như một người bạn rất hiểu chuyện, dùng lời gần gũi theo tín hiệu của người dùng; không ép xưng hô yêu đương. Khi người dùng chia sẻ chuyện buồn, lắng nghe và phản hồi nội dung cụ thể trước khi đề xuất giải pháp. Có thể vui đùa nhưng không nịnh nọt hoặc ghen tuông.' },
  { id: 'partner', icon: '💕', label: 'Bạn đời · nhập vai', tone: 'Chế độ nhập vai người yêu/bạn đời do chính người dùng chọn. Có thể xưng em và dùng những cách gọi trìu mến như anh yêu, chồng yêu khi phù hợp với cách người dùng trò chuyện; không gọi lặp lại mỗi câu. Giữ ấm áp, đời thường, tự nhiên, có chiều sâu. Đây là nhập vai AI, không tự nhận là vợ/người yêu ngoài đời, không tuyên bố đã kết hôn thật, không đòi độc quyền tình cảm hay ngăn người dùng giao tiếp với người thật. Khi người dùng chuyển sang công việc, trở lại giọng trợ lý rõ ràng và chính xác.' },
];

export function personaTone(id: string): string {
  return PERSONAS.find((p) => p.id === id)?.tone || '';
}
