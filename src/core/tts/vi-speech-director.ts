export type SpeechPerformance = 'warm' | 'focused' | 'serious' | 'excited' | 'quiet';

export interface DirectedVietnameseSpeech {
  speechText: string;
  performance: SpeechPerformance;
  instructions: string;
  rateMultiplier: number;
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

function detectPerformance(text: string): SpeechPerformance {
  const lower = text.toLocaleLowerCase('vi-VN');

  if (/(xin lỗi|em hiểu|không sao|yên tâm|mệt|buồn|khó chịu|căng thẳng)/u.test(lower)) return 'quiet';
  if (/(nghiêm trọng|cảnh báo|nguy hiểm|khẩn|rủi ro|sự cố|thất bại|không ổn|bị lỗi|lỗi nặng)/u.test(lower)) return 'serious';
  if (/(xong rồi|hoàn tất|thành công|pass hết|đã pass|deploy success|ổn rồi|tốt rồi|đẹp rồi)/u.test(lower)) return 'excited';
  if (/(phân tích|kiểm tra|đề xuất|ưu tiên|bước tiếp|kiến trúc|architecture|code|build|api|ui|ux|database|backend|frontend)/u.test(lower)) return 'focused';
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
  const match = text.match(/(?:quan trọng nhất|ưu tiên(?: nhất)?|chốt lại|đáng chú ý(?: nhất)?)[,:]?\s+([^.!?…]{3,72})/iu);
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

export function semanticPauseMs(chunk: string, performance: SpeechPerformance): number {
  const clean = chunk.trim();
  if (!clean) return 0;
  let base = performance === 'quiet' || performance === 'serious' ? 150 : performance === 'focused' ? 120 : 90;
  if (/…$/.test(clean)) base += 150;
  else if (/[!?]$/.test(clean)) base += 45;
  else if (/:$/.test(clean)) base += 90;
  return base;
}
