export type FinanceIntentKind =
  | 'knowledge'
  | 'calculation'
  | 'fx-live'
  | 'market-live'
  | 'personal-advice';

export interface FinanceIntent {
  kind: FinanceIntentKind;
  score: number;
  freshnessRequired: boolean;
  symbol?: string;
  baseCurrency?: string;
  quoteCurrency?: string;
  amount?: number;
}

const CURRENCY_ALIASES: Record<string,string> = {
  usd:'USD', dollar:'USD', dola:'USD',
  vnd:'VND', dong:'VND',
  eur:'EUR', euro:'EUR',
  gbp:'GBP', pound:'GBP',
  jpy:'JPY', yen:'JPY',
  cny:'CNY', yuan:'CNY',
  krw:'KRW', won:'KRW',
  aud:'AUD', cad:'CAD', sgd:'SGD', chf:'CHF',
};
const ISO_CURRENCIES = new Set(['USD','VND','EUR','GBP','JPY','CNY','KRW','AUD','CAD','SGD','CHF','HKD','THB','MYR','IDR','PHP','INR','NZD']);

const COMPANY_SYMBOLS: Array<[RegExp,string]> = [
  [/\bnvidia\b/i,'NVDA'], [/\bapple\b/i,'AAPL'], [/\btesla\b/i,'TSLA'],
  [/\bmicrosoft\b/i,'MSFT'], [/\b(?:google|alphabet)\b/i,'GOOGL'],
  [/\bamazon\b/i,'AMZN'], [/\bmeta\b/i,'META'],
  [/\bbitcoin\b/i,'BTC/USD'], [/\bethereum\b/i,'ETH/USD'],
];

export function normalizeFinanceText(input: string): string {
  return input.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/đ/g,'d').replace(/[^a-z0-9%./\s-]/g,' ').replace(/\s+/g,' ').trim();
}

function humanNumber(value: string, unit = ''): number {
  let raw = value.trim();
  const comma = raw.lastIndexOf(',');
  const dot = raw.lastIndexOf('.');
  if (comma >= 0 && dot < 0) {
    const decimals = raw.length - comma - 1;
    raw = decimals <= 2 ? raw.replace(',','.') : raw.replace(/,/g,'');
  } else if (dot >= 0 && comma < 0) {
    const decimals = raw.length - dot - 1;
    if (decimals === 3 && raw.length > 4) raw = raw.replace(/\./g,'');
  } else if (comma >= 0 && dot >= 0) {
    raw = comma > dot ? raw.replace(/\./g,'').replace(',','.') : raw.replace(/,/g,'');
  }
  const base = Number(raw);
  if (!Number.isFinite(base)) return NaN;
  const normalizedUnit = normalizeFinanceText(unit);
  const multiplier = /^(?:k|nghin|ngan)$/.test(normalizedUnit) ? 1e3
    : /^(?:m|trieu)$/.test(normalizedUnit) ? 1e6
      : /^(?:b|ty)$/.test(normalizedUnit) ? 1e9 : 1;
  return base * multiplier;
}

function currencyMentions(input: string): string[] {
  const normalized = normalizeFinanceText(input);
  const tokens = normalized.split(/\s+/);
  const found: string[] = [];
  for (const token of tokens) {
    const upper = token.toUpperCase();
    const code = CURRENCY_ALIASES[token] || (ISO_CURRENCIES.has(upper) ? upper : '');
    if (code && !found.includes(code)) found.push(code);
  }
  return found;
}

function extractAmount(input: string): number | undefined {
  const match = input.match(/(\d+(?:[.,]\d+)?)\s*(nghìn|ngàn|nghin|ngan|triệu|trieu|tỷ|ty|k|m|b)?/iu);
  if (!match) return undefined;
  const value = humanNumber(match[1],match[2] || '');
  return Number.isFinite(value) ? value : undefined;
}

function explicitSymbol(input: string): string | undefined {
  for (const [pattern,symbol] of COMPANY_SYMBOLS) if (pattern.test(input)) return symbol;
  const excluded = new Set(['USD','VND','EUR','GBP','JPY','CNY','KRW','AUD','CAD','SGD','CHF','PE','PB','ROE','ETF','AI']);
  const symbols = input.match(/\b[A-Z]{1,6}(?:[./-][A-Z0-9]{1,8})?\b/g) || [];
  return symbols.find((symbol) => !excluded.has(symbol));
}

export function classifyFinanceIntent(input: string): FinanceIntent | null {
  const q = normalizeFinanceText(input);
  if (!q) return null;
  const financeTerms = /\b(tai chinh|dau tu|lai suat|lai kep|tiet kiem|khoan vay|vay|tra gop|co phieu|stock|trai phieu|bond|danh muc|portfolio|p\/e|pe|p\/b|pb|roe|ty gia|exchange rate|forex|bitcoin|ethereum|crypto|vn index|vnindex)\b/;
  const currencies = currencyMentions(input);
  const fxCue = /\b(ty gia|doi|quy doi|sang|to|exchange|bao nhieu.*(?:vnd|usd|eur|gbp|jpy))\b/.test(q);
  if (currencies.length >= 2 && (fxCue || financeTerms.test(q))) {
    return {
      kind:'fx-live', score:0.995, freshnessRequired:true,
      baseCurrency:currencies[0], quoteCurrency:currencies[1], amount:extractAmount(input) ?? 1,
    };
  }

  const calculationCue = /\b(lai kep|lai suat|tiet kiem|vay|tra gop|moi thang|hang thang|sau \d|phan tram|%\/nam|% nam)\b/.test(q);
  if (calculationCue && /\d/.test(q)) return {kind:'calculation',score:0.99,freshnessRequired:false};

  const liveCue = /\b(hom nay|hien tai|bay gio|gia|quote|current|latest|thi truong)\b/.test(q);
  const marketCue = /\b(co phieu|stock|vn index|vnindex|bitcoin|ethereum|crypto|nasdaq|s&p|dow|gia vang|gold)\b/.test(q);
  const detectedSymbol = explicitSymbol(input);
  if (liveCue && (marketCue || detectedSymbol)) {
    return {kind:'market-live',score:0.985,freshnessRequired:true,symbol:detectedSymbol};
  }

  const adviceCue = /\b(nen mua|nen ban|nen dau tu|phan bo|chia tien|danh muc|portfolio|rui ro vua|dau tu the nao|co nen)\b/.test(q);
  if (adviceCue) return {kind:'personal-advice',score:0.96,freshnessRequired:false};

  if (financeTerms.test(q)) return {kind:'knowledge',score:0.72,freshnessRequired:false};
  return null;
}
