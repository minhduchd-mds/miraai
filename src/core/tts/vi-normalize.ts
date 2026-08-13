// Chuẩn hoá văn bản TIẾNG VIỆT trước khi đọc (TTS) → giọng nghe TỰ NHIÊN hơn trên MỌI engine
// (Edge/ElevenLabs/VieNeu/Web Speech). Số, phần trăm, độ, giờ, tiền… đọc bằng CHỮ như người Việt nói,
// thay vì để engine đọc thô "ba mươi độ xê" kiểu máy hoặc đọc sai "1.234" thành "một chấm hai ba bốn".
//
// Prompt đã dặn LLM đọc số tự nhiên, nhưng: (1) LLM (nhất là Gemini free) không phải lúc nào cũng theo;
// (2) văn bản KHÔNG do LLM sinh (thời tiết, câu mẫu, lỗi) không được nhắc. Bộ chuẩn hoá này lấp cả hai.
//
// Hàm THUẦN (string→string) → dễ kiểm thử. Chỉ xử lý các mẫu AN TOÀN, phổ biến; số > 12 chữ số để nguyên.

const DIGITS = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];
const GROUPS = ['', 'nghìn', 'triệu', 'tỷ']; // đơn vị · nghìn · triệu · tỷ (đủ cho số đời thường)

// Hai chữ số cuối (chục + đơn vị), có "linh" khi cần giữ giá trị hàng.
function readTwo(tens: number, unit: number, needLinh: boolean): string {
  if (tens === 0) {
    if (unit === 0) return '';
    return (needLinh ? 'linh ' : '') + DIGITS[unit];
  }
  if (tens === 1) {
    if (unit === 0) return 'mười';
    return 'mười ' + (unit === 5 ? 'lăm' : DIGITS[unit]); // 15 = "mười lăm"
  }
  // chục >= 2: "mốt" (x1), "tư" (x4), "lăm" (x5) theo cách nói Việt
  let u = '';
  if (unit === 1) u = 'mốt';
  else if (unit === 4) u = 'tư';
  else if (unit === 5) u = 'lăm';
  else if (unit > 0) u = DIGITS[unit];
  return DIGITS[tens] + ' mươi' + (u ? ' ' + u : '');
}

// Một cụm 3 chữ số (0..999). pad=true → thêm "không trăm"/"linh" để giữ giá trị khi đứng sau nhóm lớn hơn.
function readTriple(n: number, pad: boolean): string {
  const h = Math.floor(n / 100);
  const rem = n % 100;
  const parts: string[] = [];
  if (h > 0) parts.push(DIGITS[h] + ' trăm');
  else if (pad && rem > 0) parts.push('không trăm');
  const two = readTwo(Math.floor(rem / 10), rem % 10, h > 0 || pad);
  if (two) parts.push(two);
  return parts.join(' ');
}

/** Đọc một số NGUYÊN (chuỗi chữ số, ≤ 12 chữ số) thành chữ tiếng Việt. */
export function readIntVi(numStr: string): string {
  const s = numStr.replace(/^0+(?=\d)/, ''); // bỏ 0 ở đầu
  if (!s || /^0+$/.test(s)) return 'không';
  const triples: number[] = [];
  for (let i = s.length; i > 0; i -= 3) triples.unshift(parseInt(s.slice(Math.max(0, i - 3), i), 10));
  const words: string[] = [];
  let started = false;
  for (let gi = 0; gi < triples.length; gi++) {
    const val = triples[gi];
    const place = triples.length - 1 - gi; // 0 = hàng đơn vị
    if (val === 0) continue; // nhóm rỗng → bỏ (cách đọc thông dụng)
    const tripleWords = readTriple(val, started); // đã đọc nhóm trước → pad để giữ giá trị
    words.push(tripleWords + (place > 0 && place < GROUPS.length ? ' ' + GROUPS[place] : ''));
    started = true;
  }
  return words.join(' ').replace(/\s{2,}/g, ' ').trim();
}

// Đọc một token số (có thể có dấu âm, phân tách nghìn "." và thập phân ","). Phần thập phân đọc từng chữ số.
function numToWords(raw: string): string {
  let tok = raw.trim().replace(/[.,]+$/, ''); // bỏ dấu phân tách thừa ở đuôi
  let neg = false;
  if (tok.startsWith('-')) {
    neg = true;
    tok = tok.slice(1);
  }
  const hasComma = tok.includes(',');
  const hasDot = tok.includes('.');
  let intPart = tok;
  let decPart = '';
  if (hasComma && hasDot) {
    // Quy ước VN: "." nghìn, "," thập phân (vd 1.234.567,89)
    const p = tok.split(',');
    intPart = p[0].replace(/\./g, '');
    decPart = p[1] || '';
  } else if (hasComma) {
    const p = tok.split(',');
    intPart = p[0];
    decPart = p[1] || '';
  } else if (hasDot) {
    // "." là phân tách nghìn khi đúng dạng nhóm-3 (1.234 / 12.345.678); còn lại coi là thập phân (3.14)
    if (/^\d{1,3}(\.\d{3})+$/.test(tok)) intPart = tok.replace(/\./g, '');
    else {
      const p = tok.split('.');
      intPart = p[0];
      decPart = p[1] || '';
    }
  }
  intPart = intPart.replace(/\D/g, '') || '0';
  decPart = decPart.replace(/\D/g, '');
  if (intPart.length > 12) return raw; // số quá lớn → giữ nguyên, tránh đọc sai
  let words = readIntVi(intPart);
  if (decPart) words += ' phẩy ' + decPart.split('').map((d) => DIGITS[+d]).join(' ');
  return (neg ? 'âm ' : '') + words;
}

// Đọc THÁNG: tháng 4 = "tháng tư" (không phải "bốn"); còn lại đọc số bình thường.
function readMonthVi(m: string): string {
  return parseInt(m, 10) === 4 ? 'tư' : readIntVi(m);
}

/** Chuẩn hoá text để ĐỌC: số/%/độ/giờ/tiền/ngày/thứ/SĐT → chữ tiếng Việt tự nhiên. */
export function normalizeVietnameseSpeech(text: string): string {
  let s = text;
  // ngày/tháng/năm — "13/8/2026" → "ngày … tháng … năm …"; chỉ nhận khi ngày≤31 & tháng≤12.
  s = s.replace(/\b(?:ngày\s+)?(\d{1,2})\/(\d{1,2})\/(\d{4})\b/gi, (m0, d: string, mo: string, y: string) =>
    +d < 1 || +d > 31 || +mo < 1 || +mo > 12
      ? m0
      : `ngày ${readIntVi(d)} tháng ${readMonthVi(mo)} năm ${readIntVi(y)}`,
  ); // nuốt luôn "ngày" dẫn trước (nếu có) → tránh "ngày ngày"
  // "ngày 13/8" (có chữ "ngày" dẫn) → "ngày mười ba tháng tám"; bare "d/m" để nguyên (tránh nuốt phân số).
  s = s.replace(/\bngày\s+(\d{1,2})\/(\d{1,2})(?!\/|\d)/gi, (m0, d: string, mo: string) =>
    +d < 1 || +d > 31 || +mo < 1 || +mo > 12 ? m0 : `ngày ${readIntVi(d)} tháng ${readMonthVi(mo)}`,
  );
  // số điện thoại VN (bắt đầu 0, 9–11 chữ số) → đọc TỪNG chữ số.
  s = s.replace(/\b0\d{8,10}\b/g, (tok) => tok.split('').map((d) => DIGITS[+d]).join(' '));
  // thứ trong tuần / thứ hạng — "thứ 2".."thứ 7" → "thứ hai".."thứ bảy"; thứ 1="nhất", thứ 4="tư".
  s = s.replace(/\bthứ\s+(\d{1,2})\b/gi, (_, n: string) => {
    const k = +n;
    return `thứ ${k === 1 ? 'nhất' : k === 4 ? 'tư' : readIntVi(n)}`;
  });
  // "tháng 4" → "tháng tư" (số đứng SAU chữ "tháng"); "3 tháng" (số đứng trước) không bị đụng.
  s = s.replace(/\btháng\s+(\d{1,2})\b/gi, (_, n: string) => `tháng ${readMonthVi(n)}`);
  // giờ:phút (24h) → "X giờ" / "X giờ Y phút"
  s = s.replace(/\b([01]?\d|2[0-3]):([0-5]\d)\b/g, (_, h: string, m: string) => {
    const mm = parseInt(m, 10);
    return mm === 0 ? `${readIntVi(h)} giờ` : `${readIntVi(h)} giờ ${readIntVi(String(mm))} phút`;
  });
  // phần trăm
  s = s.replace(/(-?\d[\d.,]*)\s*%/g, (_, n: string) => `${numToWords(n)} phần trăm`);
  // độ (C) — "30°C" / "30 °"
  s = s.replace(/(-?\d[\d.,]*)\s*°\s*[Cc]?/g, (_, n: string) => `${numToWords(n)} độ`);
  // tiền VND — "5000đ" / "5.000 đồng" / "50000 VNĐ".
  // Dùng lookahead unicode (?!\p{L}) thay \b: \b của JS là ASCII → KHÔNG nhận ranh giới sau "đ".
  // Xếp "đồng" trước "đ" để khớp trọn; (?!\p{L}) tránh nuốt nhầm "đ" của từ khác (vd "điểm").
  s = s.replace(/(-?\d[\d.,]*)\s*(?:đồng|vnđ|vnd|đ)(?!\p{L})/giu, (_, n: string) => `${numToWords(n)} đồng`);
  // đô la — "$5" / "$ 5.5"
  s = s.replace(/\$\s*(-?\d[\d.,]*)/g, (_, n: string) => `${numToWords(n)} đô la`);
  // các số còn lại
  s = s.replace(/-?\d+(?:[.,]\d+)*/g, (tok) => numToWords(tok));
  return s.replace(/\s{2,}/g, ' ').trim();
}
