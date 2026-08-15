export type SpeechPerformance = 'warm' | 'focused' | 'serious' | 'excited' | 'quiet';
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
  serious: 0.94,
  excited: 1.03,
  quiet: 0.93,
};

const PERFORMANCE_GUIDANCE: Record<SpeechPerformance, string> = {
  warm: 'Ấm áp, gần gũi, tự nhiên. Nhịp vừa phải, cuối câu mềm, không phát thanh viên.',
  focused: 'Tập trung và rõ ý. Chậm nhẹ trước kết luận, nhấn đúng từ khóa, không đều đều như đọc tài liệu.',
  serious: 'Bình tĩnh, chắc, hơi chậm. Hạ năng lượng, nhấn cảnh báo vừa đủ, không kịch tính hóa.',
  excited: 'Tươi và có năng lượng hơn một chút. Nói gọn, sáng, vẫn giữ sự tinh tế và không reo quá mức.',
  quiet: 'Nhẹ, riêng tư, chậm hơn một chút. Giữ âm lượng cảm nhận mềm và khoảng nghỉ tự nhiên.',
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

function buildInstructions(performance: SpeechPerformance, emphasis: string): string {
  const lines = [
    'Nói tiếng Việt hội thoại tự nhiên, thiên nhịp miền Bắc nhưng không cường điệu vùng miền.',
    'Đây là lời nói trực tiếp, không phải đọc văn bản: chia câu thành các cụm ý ngắn, có nhịp thở và khoảng nghỉ theo nghĩa.',
    'Không đọc markdown, ký hiệu định dạng, tiêu đề hay cấu trúc danh sách như một tài liệu.',
    'Không kéo dài mọi dấu chấm, không nhấn đều từng từ, không dùng chất giọng phát thanh viên.',
    'Xưng em tự nhiên; chỉ dùng anh khi câu đã cần xưng hô, không chèn anh hoặc nhé vào mọi câu.',
    PERFORMANCE_GUIDANCE[performance],
  ];
  if (emphasis) lines.push(`Nhấn nhẹ cụm quan trọng “${emphasis}”, rồi hạ giọng tự nhiên sau cụm đó.`);
  return lines.join(' ');
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
  if (role === 'warning') return 'serious';
  if (role === 'contrast' || role === 'emphasis') return WARNING_RE.test(text) ? 'serious' : 'focused';
  if (role === 'question') return QUIET_RE.test(text) ? 'quiet' : 'warm';
  if (role === 'explanation') {
    if (QUIET_RE.test(text)) return 'quiet';
    if (WARNING_RE.test(text)) return 'serious';
    if (FOCUSED_RE.test(text)) return 'focused';
    return 'warm';
  }
  if (role === 'conclusion') {
    if (WARNING_RE.test(text)) return 'serious';
    if (SUCCESS_RE.test(text)) return 'excited';
    return turnPerformance === 'quiet' ? 'quiet' : turnPerformance === 'serious' ? 'focused' : turnPerformance;
  }
  return turnPerformance;
}

function buildSegmentInstructions(role: SpeechTurnRole, performance: SpeechPerformance, text: string): string {
  const emphasis = role === 'emphasis' || role === 'conclusion' ? extractEmphasis(text) : '';
  return `${buildInstructions(performance, emphasis)} ${ROLE_GUIDANCE[role]} Không diễn lại phần trước; chuyển sắc thái mềm giữa các đoạn để cả lượt nói nghe liền mạch.`;
}

function segmentRate(performance: SpeechPerformance, role: SpeechTurnRole): number {
  return Math.max(0.88, Math.min(1.06, PERFORMANCE_RATE[performance] * ROLE_RATE[role]));
}

/**
 * Builds a spoken-only Vietnamese version of display text.
 * It deliberately keeps transformations conservative: factual wording is preserved,
 * while written/list-like phrasing, pronunciation hints and performance direction are adjusted.
 */
export function directVietnameseSpeech(text: string): DirectedVietnameseSpeech {
  const speechText = makeConversational(text);
  const performance = detectPerformance(speechText);
  const emphasis = extractEmphasis(speechText);
  return {
    speechText,
    performance,
    instructions: buildInstructions(performance, emphasis),
    rateMultiplier: PERFORMANCE_RATE[performance],
  };
}

/** Plans prosody inside one response so opening/explanation/warning/conclusion do not share one flat delivery. */
export function planVietnameseTurn(text: string): DirectedVietnameseTurn {
  const directed = directVietnameseSpeech(text);
  const units = splitSemanticUnits(directed.speechText);
  const segments = units.map((unit, index) => {
    const role = classifyRole(unit, index, units.length);
    const performance = performanceForSegment(unit, role, directed.performance);
    return {
      text: unit,
      role,
      performance,
      instructions: buildSegmentInstructions(role, performance, unit),
      rateMultiplier: segmentRate(performance, role),
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
