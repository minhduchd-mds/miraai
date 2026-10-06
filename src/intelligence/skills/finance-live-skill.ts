import { miraCloudApiUrl } from '../../desktop/cloud-endpoints';
import { classifyFinanceIntent } from '../finance/finance-intent';
import type { MiraSkill } from './types';

interface FinanceApiResponse {
  ok?: boolean;
  kind?: 'fx' | 'quote';
  source?: string;
  sourceUrl?: string;
  asOf?: string;
  base?: string;
  quote?: string;
  rate?: number;
  amount?: number;
  converted?: number;
  symbol?: string;
  price?: number;
  change?: number | null;
  percentChange?: number | null;
  currency?: string | null;
  error?: string;
  hint?: string;
}

async function financeRequest(body: Record<string,unknown>): Promise<FinanceApiResponse> {
  const response = await fetch(miraCloudApiUrl('finance'),{
    method:'POST',
    headers:{'content-type':'application/json'},
    body:JSON.stringify(body),
    signal:AbortSignal.timeout(10_000),
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) return {...json,ok:false};
  return {...json,ok:true};
}

function fmt(value: number,currency?: string | null): string {
  if (currency) {
    try { return new Intl.NumberFormat('vi-VN',{maximumFractionDigits:4,style:'currency',currency}).format(value); } catch { /* fall through */ }
  }
  return new Intl.NumberFormat('vi-VN',{maximumFractionDigits:4}).format(value);
}

export const financeLiveSkill: MiraSkill = {
  id:'finance.live',
  description:'Lấy dữ liệu tài chính cần độ mới trước khi Brain trả lời: tỷ giá xác minh và market quote khi provider được cấu hình.',
  priority:145,
  executionMode:'pre-brain',
  risk:'external-read',
  requiresNetwork:true,
  supportsVoice:true,
  capabilities:['network.read'],
  examples:['100 USD sang VND bao nhiêu?','Giá NVDA hiện tại bao nhiêu?'],
  match(input) {
    const intent = classifyFinanceIntent(input);
    if (intent?.kind === 'fx-live' && intent.baseCurrency && intent.quoteCurrency) return 0.995;
    if (intent?.kind === 'market-live' && intent.symbol) return 0.99;
    return 0;
  },
  async execute(input) {
    const intent = classifyFinanceIntent(input);
    if (!intent) return null;
    const result = intent.kind === 'fx-live'
      ? await financeRequest({kind:'fx',base:intent.baseCurrency,quote:intent.quoteCurrency,amount:intent.amount ?? 1})
      : await financeRequest({kind:'quote',symbol:intent.symbol});
    if (!result.ok) {
      return {
        skillId:'finance.live',
        content:{kind:'card',data:{eyebrow:'Mira Finance · Verified data',title:'Chưa có dữ liệu xác minh',body:result.hint || 'Mira không dùng số liệu thị trường chưa được xác minh.'}},
        data:{evidenceType:'verified-live-data-unavailable',error:result.error || 'unavailable',instruction:'Không được đoán giá/tỷ giá hiện tại. Nói rõ dữ liệu live chưa xác minh được.'},
      };
    }
    const body = result.kind === 'fx' && result.converted != null
      ? `${fmt(result.amount || 1,result.base)} ≈ ${fmt(result.converted,result.quote)} · rate ${result.rate} · ${result.asOf}`
      : `${result.symbol}: ${fmt(result.price || 0,result.currency)}${result.percentChange == null ? '' : ` · ${result.percentChange >= 0 ? '+' : ''}${result.percentChange.toFixed(2)}%`} · ${result.asOf || 'latest'}`;
    return {
      skillId:'finance.live',
      content:{kind:'card',data:{eyebrow:'Mira Finance · Verified data',title:result.kind === 'fx' ? 'Tỷ giá tham chiếu' : 'Market quote',body,meta:[result.source || 'verified source']}},
      speechHint:body,
      data:{evidenceType:'verified-live-data',...result,instruction:'Ưu tiên tuyệt đối số liệu tool. Luôn nói ngày/thời điểm dữ liệu và nguồn. Không mô tả là realtime nếu nguồn chỉ là daily/latest available.'},
    };
  },
};
