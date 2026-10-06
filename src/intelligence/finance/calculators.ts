export interface FinanceCalculation {
  kind: 'compound-interest' | 'loan-payment' | 'percentage-change';
  inputs: Record<string,number>;
  outputs: Record<string,number>;
  formula: string;
}

const AMOUNT = '(\\d+(?:[.,]\\d+)?)\\s*(nghìn|ngàn|nghin|ngan|triệu|trieu|tỷ|ty|k|m|b)?';

function normalize(input: string): string {
  return input.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/đ/g,'d').replace(/\s+/g,' ').trim();
}

export function parseHumanNumber(value: string, unit = ''): number {
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
  const n = Number(raw);
  if (!Number.isFinite(n)) return NaN;
  const u = normalize(unit);
  const multiplier = /^(?:k|nghin|ngan)$/.test(u) ? 1e3 : /^(?:m|trieu)$/.test(u) ? 1e6 : /^(?:b|ty)$/.test(u) ? 1e9 : 1;
  return n * multiplier;
}

function amountAfter(input: string, labels: string[]): number | undefined {
  for (const label of labels) {
    const match = input.match(new RegExp(`(?:${label})\\s*(?:la\\s*)?${AMOUNT}`,'iu'));
    if (!match) continue;
    const value = parseHumanNumber(match[1],match[2] || '');
    if (Number.isFinite(value)) return value;
  }
  return undefined;
}

function rate(input: string): number | undefined {
  const match = input.match(/(\d+(?:[.,]\d+)?)\s*%/u);
  if (!match) return undefined;
  const value = parseHumanNumber(match[1]);
  return Number.isFinite(value) ? value / 100 : undefined;
}

function months(input: string): number | undefined {
  const year = input.match(/(\d+(?:[.,]\d+)?)\s*(?:năm|nam|years?|yrs?)/iu);
  if (year) return Math.round(parseHumanNumber(year[1]) * 12);
  const month = input.match(/(\d+(?:[.,]\d+)?)\s*(?:tháng|thang|months?)/iu);
  if (month) return Math.round(parseHumanNumber(month[1]));
  return undefined;
}

export function calculateFinance(input: string): FinanceCalculation | null {
  const q = normalize(input);

  const pct = input.match(new RegExp(`từ\\s+${AMOUNT}\\s+(?:lên|len|xuống|xuong|đến|den|to)\\s+${AMOUNT}`,'iu'));
  if (pct) {
    const from = parseHumanNumber(pct[1],pct[2] || '');
    const to = parseHumanNumber(pct[3],pct[4] || '');
    if (from > 0 && Number.isFinite(to)) {
      return {kind:'percentage-change',inputs:{from,to},outputs:{change:to-from,percentChange:(to-from)/from*100},formula:'(to - from) / from × 100'};
    }
  }

  const annualRate = rate(input);
  const termMonths = months(input);
  if (/\b(vay|khoan vay|tra gop)\b/.test(q) && annualRate != null && termMonths && termMonths > 0) {
    const principal = amountAfter(input,['vay','khoản vay','khoan vay','gốc','goc']);
    if (principal != null && principal > 0) {
      const monthlyRate = annualRate / 12;
      const payment = monthlyRate === 0 ? principal / termMonths : principal * monthlyRate * Math.pow(1 + monthlyRate,termMonths) / (Math.pow(1 + monthlyRate,termMonths) - 1);
      return {kind:'loan-payment',inputs:{principal,annualRate,termMonths},outputs:{monthlyPayment:payment,totalPayment:payment*termMonths,totalInterest:payment*termMonths-principal},formula:'P × r × (1+r)^n / ((1+r)^n - 1)'};
    }
  }

  if (/\b(lai kep|tiet kiem|dau tu|gui)\b/.test(q) && annualRate != null && termMonths && termMonths > 0) {
    const principal = amountAfter(input,['vốn','von','ban đầu','ban dau','có','co','gửi','gui','đầu tư','dau tu']) ?? 0;
    const monthly = amountAfter(input,['mỗi tháng','moi thang','hàng tháng','hang thang']) ?? 0;
    if (principal > 0 || monthly > 0) {
      const monthlyRate = annualRate / 12;
      const growth = Math.pow(1 + monthlyRate,termMonths);
      const futureValue = principal * growth + (monthlyRate === 0 ? monthly * termMonths : monthly * ((growth - 1) / monthlyRate));
      const contributed = principal + monthly * termMonths;
      return {kind:'compound-interest',inputs:{principal,monthlyContribution:monthly,annualRate,termMonths},outputs:{futureValue,totalContributed:contributed,estimatedGain:futureValue-contributed},formula:'P(1+r)^n + PMT × ((1+r)^n - 1) / r'};
    }
  }
  return null;
}
