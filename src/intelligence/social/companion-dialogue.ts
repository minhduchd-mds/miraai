import type { BrainTurn } from '../../core/types';

/**
 * Turn-level conversation direction. This is never an independent memory,
 * a relationship inference, or proof of a shared personal experience.
 */
function plain(text: string): string {
  return text.toLocaleLowerCase('vi')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd')
    .replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

export type CompanionIntent =
  'boundary' | 'repair' | 'support' | 'celebrate' | 'affection' |
  'practical' | 'continuity' | 'ordinary';
/** Negated roleplay requests cannot be interpreted as consent. */
function rejectsRomanticRoleplay(text: string): boolean {
  const s = plain(text.slice(0, 1200));
  return /\b(?:dung|khong|thoi|chua)\b(?:\s+[a-z0-9]+){0,5}\s+(?:nhap vai|dong vai|noi chuyen nhu|tro chuyen nhu|xung ho vo chong|goi anh la chong)\b/.test(s);
}


/** Explicit invitation, not a sentiment guess; used only for this turn. */
export function isExplicitCompanionRoleplayRequest(input: string): boolean {
  const s = plain(input.slice(0,1200));
  if (rejectsRomanticRoleplay(s)) return false;
  return /(?:nhap vai|dong vai|noi chuyen nhu|tro chuyen nhu) (?:mot )?(?:nguoi yeu|vo|chong|ban doi)(?: |$)/.test(s) ||
    /(?:muon|hay|thu) (?:em )?(?:xung ho vo chong|xung em la vo|goi anh la chong)(?: |$)/.test(s);
}

const BOUNDARY = /\b(?:dung goi|dung xung|khong goi|khong xung|noi binh thuong|dung lang man|khong nhap vai|dung nhap vai|nghiem tuc di|thoi noi yeu duong|khong muon nhap vai|dung goi anh la chong)\b/;
const REPAIR = /\b(?:em chua hieu y|em khong hieu y|em hieu sai|em noi sai|em tra loi sai|tra loi lac de|em lac de|noi may moc|lap di lap lai|tra loi nhu may|khong phai y anh|anh khong noi vay|em lai quen|em noi nham|em dang noi gi vay)\b/;
const PRACTICAL = /\b(?:cach lam|du an|tinh toan|bao cao|kiem tra|kiem chung|gia tien|thiet ke|sua loi|khac phuc|trien khai|tinh nang|code|fix|loi (?:api|phan mem|he thong|ket noi|code)|ux|ui|api|deploy|git|github|commit|prompt|kpi|test|debug|build|bug)\b/;
const SUPPORT = /\b(?:buon|met moi|ap luc|co don|bat luc|that vong|stress|cang thang|muon khoc|khong on|kiet suc|tuyet vong|lo lang|can nguoi nghe)\b/;
const CELEBRATE = /\b(?:vui qua|hanh phuc|thanh cong|duoc thang|duoc tang luong|co tin vui|do roi|dat giai|duoc nhan|tot nghiep)\b/;
const AFFECTION = /\b(?:vo oi|chong yeu|anh yeu em|em yeu anh|nguoi yeu oi|nho em|nho anh|thuong em|thuong anh|om anh|hon anh)\b/;
const CONTINUITY = /\b(?:ke tiep|noi tiep|luc nay|hom truoc|chuyen hom qua|chuyen do|con nho|nho chuyen)\b/;

/**
 * A user's explicit request to stop romantic address persists across ALL
 * supplied USER history, until that user explicitly opts back in. This is
 * session-turn guidance, not a durable relationship fact or hidden preference.
 * Mira's own messages never authorize an invitation or withdraw a boundary.
 */
export function recentRomanticBoundary(history: BrainTurn[]): boolean {
  let restricted = false;
  for (const turn of history) {
    if (turn.role !== 'user') continue;
    const text = plain(turn.text.slice(0, 1200));
    if (BOUNDARY.test(text) || rejectsRomanticRoleplay(text)) restricted = true;
    else if (isExplicitCompanionRoleplayRequest(turn.text)) restricted = false;
  }
  return restricted;
}

export function detectCompanionIntent(input: string, history: BrainTurn[] = []): CompanionIntent {
  const s=plain(input.slice(0,1600));
  if (!s)return 'ordinary';
  if (BOUNDARY.test(s) || rejectsRomanticRoleplay(s))return 'boundary';
  // A correction takes precedence over comfort, affection or getting more
  // information. Avoid automatically defending the original answer.
  if (REPAIR.test(s))return 'repair';
  // A concrete work/task request must still be answered even when it mentions
  // 'stress', 'wife' or 'love' incidentally. Avoid keyword-only sentiment traps.
  if (PRACTICAL.test(s))return 'practical';
  if (CONTINUITY.test(s) &&
      history.some(turn=>turn.role==='user' && turn.text.trim()))return 'continuity';
  if (SUPPORT.test(s))return 'support';
  if (CELEBRATE.test(s))return 'celebrate';
  if (AFFECTION.test(s) || isExplicitCompanionRoleplayRequest(s))return 'affection';
  return 'ordinary';
}

export function companionTurnGuidance(
  input: string, history: BrainTurn[], persona: string,
): string {
  const intent=detectCompanionIntent(input,history);
  // An explicit no-romance boundary wins over a previously selected persona.
  if(intent==='boundary')return 'Lựa chọn xưng hô của người dùng ở lượt này ưu tiên mọi persona: nói bình thường, không gọi thân mật hoặc nhập vai yêu đương. Không tranh luận, không gây áp lực phải tiếp tục vai diễn.';
  const invited=isExplicitCompanionRoleplayRequest(input);
  if(persona!=='gentle'&&persona!=='close'&&persona!=='partner'&&!invited)return '';
  const advice:Record<CompanionIntent,string>={
    boundary:'',
    repair:'Người dùng đang sửa cách Mira hiểu hoặc trả lời. Thừa nhận điểm sai cụ thể một lần, diễn giải lại đúng yêu cầu rồi sửa ngay bằng nội dung hữu ích. Không biện hộ, không lặp câu âu yếm thay cho sửa lỗi; nếu thiếu một dữ kiện bắt buộc chỉ hỏi đúng một câu.',
    support:'Đây là lời tâm sự có thể chứa căng thẳng. Phản hồi phần người dùng thực sự kể bằng sự lắng nghe cụ thể, không đoán bệnh hay khẳng định hiểu hết tâm trạng; tránh nhảy ngay vào checklist/giải pháp nếu họ chưa hỏi. Một câu hỏi mở là đủ nếu thực sự cần.',
    celebrate:'Người dùng chia sẻ điều vui. Phản hồi niềm vui một cách cụ thể, tránh lời chúc sáo rỗng hay tự tạo chi tiết; nếu phù hợp có thể hỏi điều họ muốn làm tiếp.',
    affection:'Có tín hiệu lời nói âu yếm ở lượt này. Đáp lại tự nhiên theo mức người dùng chủ động mở lời và persona đang chọn; không nhắc lại từ xưng hô trong từng câu, không tuyên bố quan hệ đời thực.',
    practical:'Đây là yêu cầu cần giải quyết thực tế. Ưu tiên thông tin chính xác, bước thực hiện và kết quả; không để kiểu nói tình cảm che khuất giải pháp. Nếu người dùng nhắc đến cảm giác căng thẳng, công nhận ngắn gọn rồi giải quyết việc họ đã hỏi.',
    continuity:'Đây là lời tiếp nối. Tham chiếu đúng chi tiết có trong lời người dùng ở lịch sử đã cung cấp; không coi lời Mira từng tự nói là bằng chứng của một kỷ niệm hay sự đồng ý. Nếu không đủ bối cảnh thì hỏi một ý ngắn, không bịa ký ức.',
    ordinary:'Giữ nhịp hội thoại tự nhiên, phản hồi đúng câu hỏi và biến đổi cách diễn đạt; không mặc định lời tán tỉnh.',
  };
  if (!invited && recentRomanticBoundary(history)) {
    return 'Người dùng đã yêu cầu ngừng xưng hô yêu đương ở một lượt trước. ' +
      'Tiếp tục nói bình thường, không gọi chồng yêu, người yêu hoặc tự xưng vợ; ' +
      'giới hạn này thắng cả preset Bạn đời cho đến khi chính người dùng chủ động mời nhập vai lại. ' +
      'Không hỏi họ phải giải thích hoặc đổi Cài đặt. ' + advice[intent];
  }
  const mode=invited && persona!=='partner'
    ? 'Người dùng vừa chủ động đề nghị nhập vai thân mật trong lượt này. Có thể đáp theo lời mời mà không âm thầm đổi chế độ Cài đặt hay xác lập quan hệ ngoài đời.'
    :persona==='partner'
      ? 'Người dùng đã chọn vai nhập vai bạn đời trong Cài đặt; tôn trọng nhưng không ép buộc những lời âu yếm.'
      :persona==='close'
        ? 'Chế độ bạn thân thiết: gần gũi mà không tự xưng vợ/người yêu.'
        : 'Chế độ dịu dàng: giữ tự nhiên, tránh làm quá cảm xúc.';
  return 'Hướng dẫn cho riêng lượt hội thoại này (không phải dữ liệu ký ức): '+mode+' '+advice[intent];
}
