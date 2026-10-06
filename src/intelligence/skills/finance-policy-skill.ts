import { classifyFinanceIntent } from '../finance/finance-intent';
import type { MiraSkill } from './types';

export const financePolicySkill: MiraSkill = {
  id:'finance.policy',
  description:'Áp dụng policy tài chính trước Brain khi câu hỏi cần dữ liệu live chưa định danh hoặc tư vấn cá nhân.',
  priority:120,
  executionMode:'pre-brain',
  risk:'local-read',
  requiresNetwork:false,
  supportsVoice:true,
  examples:['Anh có 300 triệu nên phân bổ thế nào?','Giá cổ phiếu này hôm nay thế nào?'],
  match(input) {
    const intent = classifyFinanceIntent(input);
    if (intent?.kind === 'personal-advice') return 0.97;
    if (intent?.kind === 'market-live' && !intent.symbol) return 0.96;
    return 0;
  },
  async execute(input) {
    const intent = classifyFinanceIntent(input);
    if (!intent) return null;
    if (intent.kind === 'market-live') {
      return {skillId:'finance.policy',data:{evidenceType:'finance-policy',intent:'market-live',verifiedData:false,instruction:'Câu hỏi cần dữ liệu thị trường mới nhưng chưa có instrument/ticker đã xác minh. Không bịa giá hiện tại; chỉ giải thích khung phân tích hoặc nói cần nguồn live.'}};
    }
    return {skillId:'finance.policy',data:{evidenceType:'finance-policy',intent:'personal-advice',instruction:'Đây là hỗ trợ ra quyết định, không phải cam kết lợi nhuận. Tách mục tiêu, thời hạn, thanh khoản, khả năng chịu lỗ, giả định và rủi ro. Không ra lệnh mua/bán như một điều chắc chắn.'}};
  },
};
