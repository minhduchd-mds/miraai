import { calculateFinance } from '../finance/calculators';
import { classifyFinanceIntent } from '../finance/finance-intent';
import type { MiraSkill } from './types';

function money(value: number): string {
  return new Intl.NumberFormat('vi-VN',{maximumFractionDigits:0}).format(Math.round(value));
}

export const financeCalculatorSkill: MiraSkill = {
  id:'finance.calculate',
  description:'Tính tài chính xác định trước khi Brain diễn giải: lãi kép, khoản vay và phần trăm thay đổi.',
  priority:150,
  executionMode:'pre-brain',
  risk:'local-read',
  requiresNetwork:false,
  supportsVoice:true,
  examples:['Có 300 triệu, thêm 10 triệu mỗi tháng, lợi suất 8%/năm trong 10 năm được bao nhiêu?','Vay 500 triệu 5 năm lãi 9%/năm thì mỗi tháng trả bao nhiêu?'],
  match(input) { return classifyFinanceIntent(input)?.kind === 'calculation' && calculateFinance(input) ? 1 : 0; },
  async execute(input) {
    const result = calculateFinance(input);
    if (!result) return null;
    const body = result.kind === 'compound-interest'
      ? `Giá trị ước tính: ${money(result.outputs.futureValue)} · Vốn đóng: ${money(result.outputs.totalContributed)} · Phần tăng: ${money(result.outputs.estimatedGain)}`
      : result.kind === 'loan-payment'
        ? `Trả/tháng: ${money(result.outputs.monthlyPayment)} · Tổng trả: ${money(result.outputs.totalPayment)} · Tổng lãi: ${money(result.outputs.totalInterest)}`
        : `Thay đổi: ${result.outputs.percentChange.toFixed(2)}%`;
    return {
      skillId:'finance.calculate',
      content:{kind:'card',data:{eyebrow:'Mira Finance · Calculator',title:'Kết quả tính toán',body}},
      speechHint:body,
      data:{evidenceType:'deterministic-calculation',calculation:result,instruction:'Dùng đúng các số đã tính. Nêu giả định và không tự thay đổi input.'},
    };
  },
};
