import type { MiraSkill } from './types';

function q(input: string): string {
  return input.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/đ/g, 'd').replace(/[^a-z0-9%./\s-]/g, ' ').replace(/\s+/g, ' ').trim();
}

const FX = /\b(?:usd|vnd|eur|gbp|jpy|cny|krw|aud|cad|sgd|chf|hkd|thb|myr|idr|php|inr|nzd|dollar|dola|dong|euro|pound|yen|yuan|won)\b/g;
const LIVE = /\b(?:hom nay|hien tai|bay gio|gia|quote|current|latest|thi truong)\b/;
const MARKET = /\b(?:co phieu|stock|vn index|vnindex|bitcoin|ethereum|crypto|nasdaq|s&p|dow|gia vang|gold|nvidia|apple|tesla|microsoft|google|alphabet|amazon|meta)\b/;
const ADVICE = /\b(?:nen mua|nen ban|nen dau tu|phan bo|chia tien|danh muc|portfolio|rui ro vua|dau tu the nao|co nen)\b/;
const CALC = /\b(?:lai kep|lai suat|tiet kiem|vay|tra gop|moi thang|hang thang|phan tram)\b|%/;

function fxPair(text: string): boolean {
  return new Set(text.match(FX) || []).size >= 2;
}

function explicitTicker(input: string): boolean {
  return /\b[A-Z]{1,6}(?:[./-][A-Z0-9]{1,8})?\b/.test(input);
}

export const financeCalculatorSkill: MiraSkill = {
  id: 'finance.calculate',
  description: 'Tính tài chính deterministic trước khi Brain diễn giải.',
  priority: 150,
  executionMode: 'pre-brain',
  risk: 'local-read',
  requiresNetwork: false,
  supportsVoice: true,
  examples: ['Vay 500 triệu 5 năm lãi 9%/năm thì mỗi tháng trả bao nhiêu?'],
  match(input) {
    const text = q(input);
    return /\d/.test(text) && CALC.test(text) && !fxPair(text) ? 1 : 0;
  },
  async execute(input, context) {
    const { financeCalculatorSkill: skill } = await import('./finance-calculator-skill');
    return skill.execute(input, context);
  },
};

export const financeLiveSkill: MiraSkill = {
  id: 'finance.live',
  description: 'Lấy dữ liệu tài chính cần độ mới từ nguồn xác minh trước Brain.',
  priority: 145,
  executionMode: 'pre-brain',
  risk: 'external-read',
  requiresNetwork: true,
  supportsVoice: true,
  capabilities: ['network.read'],
  examples: ['100 USD sang VND bao nhiêu?', 'Giá NVDA hiện tại bao nhiêu?'],
  match(input) {
    const text = q(input);
    if (fxPair(text)) return 0.995;
    if (LIVE.test(text) && (MARKET.test(text) || explicitTicker(input))) return 0.99;
    return 0;
  },
  async execute(input, context) {
    const { financeLiveSkill: skill } = await import('./finance-live-skill');
    return skill.execute(input, context);
  },
};

export const financePolicySkill: MiraSkill = {
  id: 'finance.policy',
  description: 'Policy tài chính cho tư vấn cá nhân và live-data không đủ định danh.',
  priority: 120,
  executionMode: 'pre-brain',
  risk: 'local-read',
  requiresNetwork: false,
  supportsVoice: true,
  examples: ['Anh có 300 triệu nên phân bổ thế nào?'],
  match(input) {
    const text = q(input);
    if (ADVICE.test(text)) return 0.97;
    if (LIVE.test(text) && /\b(?:co phieu|stock|thi truong|vn index|vnindex)\b/.test(text) && !MARKET.test(text) && !explicitTicker(input)) return 0.96;
    return 0;
  },
  async execute(input, context) {
    const { financePolicySkill: skill } = await import('./finance-policy-skill');
    return skill.execute(input, context);
  },
};
