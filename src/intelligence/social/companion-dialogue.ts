import type { BrainTurn } from '../../core/types';

/**
 * Lightweight turn-level conversation direction, never a memory entry.
 * The model still sees the actual conversation/history and makes the reply.
 * Do not infer the user's intimate relationship status from affectionate words.
 */
function plain(text: string): string {
  return text.toLocaleLowerCase('vi')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd')
    .replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}
export type CompanionIntent='boundary'|'support'|'celebrate'|'affection'|'practical'|'continuity'|'ordinary';
export function detectCompanionIntent(input: string, history: BrainTurn[] = []): CompanionIntent {
  const s=plain(input.slice(0,1600));
  if (!s)return 'ordinary';
  if (/(dung goi|dung xung|khong goi|khong xung|noi binh thuong|dung lang man|khong nhap vai|nghiem tuc di|thoi noi yeu duong)/.test(s))return 'boundary';
  if (/(buon|met moi|ap luc|co don|bat luc|that vong|stress|cang thang|muon khoc|khong on|kiet suc|tuyet vong|lo lang|can nguoi nghe)/.test(s))return 'support';
  if (/(vui qua|hanh phuc|thanh cong|duoc thang|duoc tang luong|co tin vui|do roi|dat giai|duoc nhan|tot nghiep)/.test(s))return 'celebrate';
  if (/(vo oi|chong yeu|anh yeu em|em yeu anh|nguoi yeu oi|nho em|nho anh|thuong em|thuong anh|om anh|hon anh)/.test(s))return 'affection';
  if (/(cach lam|du an|tinh toan|bao cao|kiem tra|kiem chung|gia tien|thiet ke|(?:^| )(?:code|fix|loi|ux|ui|api|deploy|git)(?: |$))/.test(s))return 'practical';
  if (/(ke tiep|noi tiep|luc nay|hom truoc|chuyen hom qua|chuyen do|con nho|nho chuyen)/.test(s)
      && history.some(t=>t.role==='user' && t.text.trim()))return 'continuity';
  return 'ordinary';
}
export function companionTurnGuidance(
  input: string, history: BrainTurn[], persona: string,
): string {
  // Respect the user's explicit boundary even if a romantic persona is active.
  const intent=detectCompanionIntent(input,history);
  if (intent==='boundary')return 'Lựa chọn xưng hô của người dùng ở lượt này ưu tiên mọi persona: nói bình thường, không gọi thân mật hoặc nhập vai yêu đương. Không tranh luận, không gây áp lực phải tiếp tục vai diễn.';
  if (persona!=='gentle'&&persona!=='close'&&persona!=='partner')return '';
  const advice:Record<CompanionIntent,string>={
    boundary:'',
    support:'Đây là lời tâm sự có thể chứa căng thẳng. Phản hồi phần người dùng thực sự kể bằng sự lắng nghe cụ thể, không đoán bệnh hay khẳng định hiểu hết tâm trạng; tránh nhảy ngay vào checklist/giải pháp nếu họ chưa hỏi. Một câu hỏi mở là đủ nếu thực sự cần.',
    celebrate:'Người dùng chia sẻ điều vui. Phản hồi niềm vui một cách cụ thể, tránh lời chúc sáo rỗng hay tự tạo chi tiết; nếu phù hợp có thể hỏi điều họ muốn làm tiếp.',
    affection:'Có tín hiệu lời nói âu yếm ở lượt này. Đáp lại tự nhiên theo mức người dùng chủ động mở lời và persona đang chọn; không nhắc lại từ xưng hô trong từng câu, không tuyên bố quan hệ đời thực.',
    practical:'Đây là yêu cầu cần giải quyết thực tế. Ưu tiên thông tin chính xác, bước thực hiện và kết quả; không để kiểu nói tình cảm che khuất giải pháp.',
    continuity:'Đây là lời tiếp nối. Tham chiếu đúng chi tiết có trong lịch sử đã cung cấp; nếu không có đủ bối cảnh thì hỏi một ý ngắn, không bịa ký ức.',
    ordinary:'Giữ nhịp hội thoại tự nhiên, phản hồi đúng câu hỏi và biến đổi cách diễn đạt; không mặc định lời tán tỉnh.',
  };
  const mode=persona==='partner'?'Người dùng đã chọn vai nhập vai bạn đời trong Cài đặt; tôn trọng nhưng không ép buộc những lời âu yếm.'
    :persona==='close'?'Chế độ bạn thân thiết: gần gũi mà không tự xưng vợ/người yêu.'
    :'Chế độ dịu dàng: giữ tự nhiên, tránh làm quá cảm xúc.';
  return 'Hướng dẫn cho riêng lượt hội thoại này (không phải dữ liệu ký ức): '+mode+' '+advice[intent];
}
