const TARGET_RE = /\[MIRA_VISUAL_TARGET\s+label="([^"]+)"\s+confidence="(\d{1,3})"\]/i;
const POINTER_NONE_RE = /\[MIRA_VISUAL_POINTER\s+target="none"\]/i;

const LABEL_VI: Record<string, string> = {
  'cell phone': 'điện thoại',
  laptop: 'máy tính xách tay',
  keyboard: 'bàn phím',
  mouse: 'chuột',
  book: 'sách',
  cup: 'cốc',
  bottle: 'chai',
  chair: 'ghế',
  bed: 'giường',
  couch: 'ghế sofa',
  tv: 'TV',
  'dining table': 'bàn ăn',
  bowl: 'bát',
  fork: 'nĩa',
  knife: 'dao',
  spoon: 'thìa',
  apple: 'quả táo',
  banana: 'quả chuối',
  person: 'người',
};

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/đ/g, 'd')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function isDeicticObjectQuestion(input: string): boolean {
  const text = normalize(input);
  if (!text) return false;
  return (
    /^(cai|vat|do) (nay|do) (la )?(gi|cai gi)$/.test(text) ||
    /^day (la )?(gi|cai gi)$/.test(text) ||
    /^(em )?(thay|nhin) (cai|vat) (nay|do) (la )?gi$/.test(text) ||
    /^(what is|whats) (this|that)( thing| object)?$/.test(text) ||
    /^what am i pointing (at|to)$/.test(text)
  );
}

export interface VisualTargetContext {
  label: string;
  confidence: number;
}

export function extractVisualTarget(runtimeContext: string): VisualTargetContext | null {
  const match = String(runtimeContext || '').match(TARGET_RE);
  if (!match) return null;
  return {
    label: match[1].trim().toLowerCase(),
    confidence: Math.max(0, Math.min(100, Number(match[2]) || 0)),
  };
}

export function deicticVisualReply(input: string, runtimeContext: string): string | null {
  if (!isDeicticObjectQuestion(input)) return null;

  const target = extractVisualTarget(runtimeContext);
  if (target) {
    const vi = LABEL_VI[target.label] || target.label;
    return 'Vật anh đang chỉ vào có vẻ là ' + vi +
      ' — camera đang nhận diện khoảng ' + target.confidence +
      '%. Đây là nhận diện hình ảnh nên vẫn có thể nhầm.';
  }

  if (POINTER_NONE_RE.test(runtimeContext)) {
    return 'Em thấy anh đang chỉ, nhưng em chưa khóa được vật thể ổn định dưới ngón tay. Anh giữ tay thêm một chút hoặc đưa vật vào rõ hơn nhé.';
  }

  return null;
}
