export type SpeechPerformance = 'warm' | 'focused' | 'serious' | 'excited' | 'quiet';
export type VoicePersonaPreset = 'gentle' | 'friendly' | 'pro' | 'playful';
export type SpeechTurnRole =
  | 'opening'
  | 'explanation'
  | 'contrast'
  | 'emphasis'
  | 'warning'
  | 'conclusion'
  | 'question';

export interface DirectedVietnameseSpeech {
  speechText: string;
  performance: SpeechPerformance;
  instructions: string;
  rateMultiplier: number;
}

export interface DirectedSpeechSegment {
  text: string;
  role: SpeechTurnRole;
  performance: SpeechPerformance;
  instructions: string;
  rateMultiplier: number;
}

export interface DirectedVietnameseTurn extends DirectedVietnameseSpeech {
  segments: DirectedSpeechSegment[];
}

const PERFORMANCE_RATE: Record<SpeechPerformance, number> = {
  warm: 0.98,
  focused: 0.97,
  serious: 0.93,
  excited: 1.015,
  quiet: 0.91,
};

const VOICE_PRESET_GUIDANCE: Record<VoicePersonaPreset, string> = {
  gentle: 'Preset Dịu dàng: giữ chất giọng dịu dàng, hiền, mềm và thân mật; không cố làm nũng, không kéo dài âm.',
  friendly: 'Preset Thân thiện: ấm áp và cởi mở hơn một chút; giữ nụ cười nhẹ trong giọng nhưng không hoạt náo hoặc quá phấn khích.',
  pro: 'Preset Chuyên nghiệp: rõ chữ, gọn nhịp, bình tĩnh và tự tin; giảm từ đệm cảm xúc, không biến thành giọng bản tin.',
  playful: 'Preset Vui tươi: sáng và linh hoạt hơn một chút; nhấn nhá tự nhiên nhưng không reo, không tăng tốc quá mức.',
};

const VOICE_PRESET_RATE: Record<VoicePersonaPreset, number> = {
  gentle: 1,
  friendly: 1,
  pro: 0.99,
  playful: 1.02,
};

function normalizeVoicePreset(value: string): VoicePersonaPreset {
  return value === 'friendly' || value === 'pro' || value === 'playful' ? value : 'gentle';
}

const PERFORMANCE_GUIDANCE: Record<SpeechPerformance, string> = {
  warm: 'Ấm, mượt và gần gũi. Vào câu nhẹ, giữ âm lượng cảm nhận mềm, cuối câu hạ tự nhiên; không phát thanh viên.',
  focused: 'Rõ ý nhưng vẫn mềm. Chậm nhẹ trước kết luận, nhấn đúng từ khóa rồi thả giọng ngay, không đều đều như đọc tài liệu.',
  serious: 'Bình tĩnh, chắc nhưng không lạnh. Hạ năng lượng và tốc độ, nhấn cảnh báo vừa đủ, không kịch tính hóa.',
  excited: 'Tươi hơn một chút nhưng vẫn dịu. Không bật âm đầu quá mạnh, không reo, không đẩy tốc độ lên cao.',
  quiet: 'Rất nhẹ, riêng tư và gần. Chậm hơn một chút, âm lượng cảm nhận mềm, khoảng nghỉ tự nhiên, không thì thầm gượng.',
};

const ROLE_GUIDANCE: Record<SpeechTurnRole, string> = {
  opening: 'Đây là phần mở lời: vào câu tự nhiên, không lên giọng như đọc tiêu đề và không nhấn quá sớm.',
  explanation: 'Đây là phần giải thích: giữ nhịp đều vừa đủ, chia ý rõ nhưng vẫn liền mạch như đang trò chuyện.',
  contrast: 'Đây là ý chuyển hoặc phản biện: nghỉ rất nhẹ trước ý đối lập và nhấn vào điểm khác biệt, không tranh luận gay gắt.',
  emphasis: 'Đây là ý cần nhớ: chậm nhẹ ngay trước cụm quan trọng, nhấn một điểm chính rồi thả giọng trở lại.',
  warning: 'Đây là cảnh báo: hạ nhịp, nói chắc và rõ; tạo cảm giác đáng chú ý nhưng không gây hoảng.',
  conclusion: 'Đây là phần chốt: gom ý, hạ nhịp và kết câu dứt khoát nhưng mềm, không đọc như kết luận báo cáo.',
  question: 'Đây là câu hỏi hoặc gợi mở: lên giọng rất nhẹ ở cuối, giữ cảm giác đang thực sự chờ người đối diện trả lời.',
};

const ROLE_RATE: Record<SpeechTurnRole, number> = {
  opening: 1,
  explanation: 1,
  contrast: 0.98,
  emphasis: 0.96,
  warning: 0.95,
  conclusion: 0.97,
  question: 0.99,
};

const SPOKEN_REPLACEMENTS: Array<[RegExp, string]> = [
  [/\bUI\s*\/\s*UX\b/gi, 'UI, UX'],
  [/\bCI\s*\/\s*CD\b/gi, 'CI, CD'],
  [/\bNode\.js\b/gi, 'Node JS'],
  [/\bNext\.js\b/gi, 'Next JS'],
  [/\bTypeScript\b/g, 'TypeScript'],
  [/\bGitHub\b/gi, 'GitHub'],
  [/\bVercel\b/gi, 'Vercel'],
  [/\bPlaywright\b/gi, 'Playwright'],
  [/\bFigma\b/gi, 'Figma'],
  [/\bP0\b/gi, 'P không'],
  [/\bP1\b/gi, 'P một'],
  [/\bP2\b/gi, 'P hai'],
  [/\bP3\b/gi, 'P ba'],
];

const WARNING_RE = /(nghiêm trọng|cảnh báo|nguy hiểm|khẩn|rủi ro|sự cố|thất bại|không ổn|bị lỗi|lỗi nặng|cần dừng|không nên)/iu;
const SUCCESS_RE = /(xong rồi|hoàn tất|thành công|pass hết|đã pass|deploy success|ổn rồi|tốt rồi|đẹp rồi)/iu;
const QUIET_RE = /(xin lỗi|em hiểu|không sao|yên tâm|mệt|buồn|khó chịu|căng thẳng)/iu;
const FOCUSED_RE = /(phân tích|kiểm tra|đề xuất|ưu tiên|bước tiếp|kiến trúc|architecture|code|build|api|ui|ux|database|backend|frontend)/iu;
const EMPHASIS_RE = /(quan trọng nhất|ưu tiên(?: nhất)?|đáng chú ý(?: nhất)?|mấu chốt|điểm chính|cần nhớ)/iu;
const CONCLUSION_RE = /^(chốt lại|tóm lại|kết luận|vì vậy|do đó)|\b(em nghiêng về|mình nên|nên ưu tiên|chốt phương án)\b/iu;
const CONTRAST_RE = /^(nhưng|còn|ngược lại|tuy vậy|riêng|trong khi|mặt khác)\b/iu;

function detectPerformance(text: string): SpeechPerformance {
  const lower = text.toLocaleLowerCase('vi-VN');
  if (QUIET_RE.test(lower)) return 'quiet';
  if (WARNING_RE.test(lower)) return 'serious';
  if (SUCCESS_RE.test(lower)) return 'excited';
  if (FOCUSED_RE.test(lower)) return 'focused';
  return 'warm';
}

function makeConversational(text: string): string {
  let s = text
    .replace(/https?:\/\/\S+/gi, 'đường dẫn này')
    .replace(/\s+\/\s+/g, ', ')
    .replace(/\s*;\s*/g, '. ')
    .replace(/\bTuy nhiên,?\s*/gi, 'Nhưng ')
    .replace(/\bDo đó,?\s*/gi, 'Vì vậy, ')
    .replace(/\bThứ nhất,?\s*/gi, 'Đầu tiên, ')
    .replace(/\bThứ hai,?\s*/gi, 'Tiếp theo, ')
    .replace(/\bThứ ba,?\s*/gi, 'Sau đó, ')
    .replace(/\bTóm lại,?\s*/gi, 'Chốt lại, ')
    .replace(/\bCó thể thấy rằng\b/gi, 'Có thể thấy')
    .replace(/\s+([,.!?…])/g, '$1')
    .replace(/([.!?…])(?=[A-ZÀ-Ỹ])/g, '$1 ')
    .replace(/\s{2,}/g, ' ')
    .trim();

  for (const [pattern, replacement] of SPOKEN_REPLACEMENTS) s = s.replace(pattern, replacement);
  return s;
}

function extractEmphasis(text: string): string {
  const match = text.match(/(?:quan trọng nhất|ưu tiên(?: nhất)?|chốt lại|đáng chú ý(?: nhất)?|mấu chốt|điểm chính)[,:]?\s+([^.!?…]{3,72})/iu);
  if (!match) return '';
  return match[1].replace(/["'`]/g, '').trim().slice(0, 72);
}

function buildInstructions(performance: SpeechPerformance, emphasis: string, persona = 'gentle'): string {
  const lines = [
    'Nói tiếng Việt hội thoại tự nhiên, thiên nhịp miền Bắc nhưng không cường điệu vùng miền.',
    'Giữ chất giọng nữ tính tự nhiên, mượt và gần gũi. Âm đầu mềm, không sắc; không nâng năng lượng đột ngột; cuối câu thường hạ nhẹ và ấm. Tránh cảm giác đọc quảng cáo, đọc bản tin hoặc diễn quá mức.',
    VOICE_PRESET_GUIDANCE[normalizeVoicePreset(persona)],
    'Đây là lời nói trực tiếp, không phải đọc văn bản: chia câu thành các cụm ý ngắn, có nhịp thở và khoảng nghỉ theo nghĩa.',
    'Không đọc markdown, ký hiệu định dạng, tiêu đề hay cấu trúc danh sách như một tài liệu.',
    'Không kéo dài mọi dấu chấm, không nhấn đều từng từ, không dùng chất giọng phát thanh viên.',
    'Xưng em tự nhiên; chỉ dùng anh khi câu đã cần xưng hô, không chèn anh hoặc nhé vào mọi câu.',
    PERFORMANCE_GUIDANCE[performance],
  ];
  if (emphasis) lines.push(`Nhấn nhẹ cụm quan trọng “${emphasis}”, rồi hạ giọng tự nhiên sau cụm đó.`);
  return lines.filter(Boolean).join(' ');
}

function splitSemanticUnits(text: string): string[] {
  return text.match(/[^.!?…\n]+(?:[.!?…]+|$)/gu)?.map((part) => part.trim()).filter(Boolean) ?? (text.trim() ? [text.trim()] : []);
}

function classifyRole(text: string, index: number, total: number): SpeechTurnRole {
  const clean = text.trim();
  if (WARNING_RE.test(clean)) return 'warning';
  if (CONTRAST_RE.test(clean)) return 'contrast';
  if (EMPHASIS_RE.test(clean)) return 'emphasis';
  if (/\?$/.test(clean)) return 'question';
  if (CONCLUSION_RE.test(clean)) return 'conclusion';
  if (index === 0) return 'opening';
  if (index === total - 1 && total >= 3 && /\b(nên|ưu tiên|em nghĩ|mình|phương án)\b/iu.test(clean)) return 'conclusion';
  return 'explanation';
}

function performanceForSegment(text: string, role: SpeechTurnRole, turnPerformance: SpeechPerformance): SpeechPerformance {
  const localPerformance = detectPerformance(text);
  if (role === 'warning') return 'serious';
  if (role === 'contrast' || role === 'emphasis') return localPerformance === 'serious' ? 'serious' : 'focused';
  if (role === 'question') return localPerformance === 'quiet' ? 'quiet' : localPerformance === 'serious' ? 'serious' : 'warm';
  if (role === 'explanation') return localPerformance;
  if (role === 'conclusion') {
    if (localPerformance !== 'warm') return localPerformance;
    return turnPerformance === 'quiet' ? 'quiet' : turnPerformance === 'serious' ? 'focused' : turnPerformance;
  }
  return localPerformance;
}

function buildSegmentInstructions(role: SpeechTurnRole, performance: SpeechPerformance, text: string, persona: string): string {
  const emphasis = role === 'emphasis' || role === 'conclusion' ? extractEmphasis(text) : '';
  return `${buildInstructions(performance, emphasis, persona)} ${ROLE_GUIDANCE[role]} Không diễn lại phần trước; chuyển sắc thái mềm giữa các đoạn để cả lượt nói nghe liền mạch.`;
}

function segmentRate(performance: SpeechPerformance, role: SpeechTurnRole, persona: string): number {
  const preset = normalizeVoicePreset(persona);
  return Math.max(0.88, Math.min(1.06, PERFORMANCE_RATE[performance] * ROLE_RATE[role] * VOICE_PRESET_RATE[preset]));
}

export function directVietnameseSpeech(text: string, persona = 'gentle'): DirectedVietnameseSpeech {
  const speechText = makeConversational(text);
  const performance = detectPerformance(speechText);
  const emphasis = extractEmphasis(speechText);
  const preset = normalizeVoicePreset(persona);
  return {
    speechText,
    performance,
    instructions: buildInstructions(performance, emphasis, preset),
    rateMultiplier: Math.max(0.88, Math.min(1.06, PERFORMANCE_RATE[performance] * VOICE_PRESET_RATE[preset])),
  };
}

/** Plans prosody inside one response so opening/explanation/warning/conclusion do not share one flat delivery. */
export function planVietnameseTurn(text: string, persona = 'gentle'): DirectedVietnameseTurn {
  const preset = normalizeVoicePreset(persona);
  const directed = directVietnameseSpeech(text, preset);
  const units = splitSemanticUnits(directed.speechText);
  const segments = units.map((unit, index) => {
    const role = classifyRole(unit, index, units.length);
    const performance = performanceForSegment(unit, role, directed.performance);
    return {
      text: unit,
      role,
      performance,
      instructions: buildSegmentInstructions(role, performance, unit, preset),
      rateMultiplier: segmentRate(performance, role, preset),
    } satisfies DirectedSpeechSegment;
  });
  return { ...directed, segments };
}

export function semanticPauseMs(chunk: string, performance: SpeechPerformance): number {
  const clean = chunk.trim();
  if (!clean) return 0;
  let base = performance === 'quiet' || performance === 'serious' ? 150 : performance === 'focused' ? 120 : 90;
  if (/…$/.test(clean)) base += 150;
  else if (/[!?]$/.test(clean)) base += 45;
  else if (/:$/.test(clean)) base += 90;
  return base;
}

/** Pause between semantic roles inside the same answer; final segment naturally has no artificial tail pause. */
export function turnSegmentPauseMs(segment: DirectedSpeechSegment, index: number, total: number): number {
  if (index >= total - 1) return 0;
  const rolePause: Record<SpeechTurnRole, number> = {
    opening: 125,
    explanation: 105,
    contrast: 185,
    emphasis: 235,
    warning: 285,
    conclusion: 170,
    question: 210,
  };
  return Math.min(460, rolePause[segment.role] + Math.round(semanticPauseMs(segment.text, segment.performance) * 0.45));
}
