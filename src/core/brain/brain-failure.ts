import type { BrainReply } from '../types';

type BrainFailure = NonNullable<BrainReply['failureCode']>;

/** Never relay raw model errors, tokens or response bodies to the UI. */
export function classifyBrainFailure(status: number, code = '', error?: unknown): BrainFailure {
  if (status === 429 || code === 'rate_limited' || code === 'global_rate_limited') return 'quota';
  if (status === 404) return 'deployment';
  if (status === 401 || status === 403 || code === 'quota_store_unavailable' ||
      code === 'quota_store_required') return 'configuration';
  if (code === 'free_models_unavailable' || code === 'brain_gateway_failed') return 'provider';
  if (status === 503 && /configur/i.test(code)) return 'configuration';
  if (status >= 500) return 'provider';
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return 'offline';
  if (error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')) return 'timeout';
  return 'provider';
}

export function brainFailureMessage(code?: BrainReply['failureCode']): string {
  switch (code) {
    case 'offline': return 'Thiết bị đang ngoại tuyến. Câu hỏi chưa được gửi tới AI.';
    case 'timeout': return 'AI phản hồi quá lâu. Anh thử lại; câu hỏi vừa rồi chưa được xử lý xong.';
    case 'quota': return 'Đã chạm giới hạn lượt gọi AI. Hãy thử lại khi quota hồi phục.';
    case 'configuration': return 'Máy chủ AI thiếu cấu hình hoặc kho quota đang lỗi; cần kiểm tra Vercel.';
    case 'deployment': return 'Bản web này không có API trò chuyện. Hãy dùng MiraAI trên Vercel.';
    default: return 'Các model AI hiện chưa phản hồi. Mira đang ở chế độ dự phòng, chưa có câu trả lời AI.';
  }
}
