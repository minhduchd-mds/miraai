// Endpointer THÍCH ỨNG cho turn-taking (§ skill voice-agents — chống anti-pattern
// "silence-only turn detection"). Thay endpoint CỨNG của Web Speech bằng một quyết định:
// "chờ im lặng bao lâu trước khi CHỐT lượt nói?" — dựa vào việc câu nghe được đã có vẻ
// TRỌN Ý hay đang BỎ LỬNG ở từ nối/từ đệm.
//
//   • Câu có vẻ trọn (dấu câu kết, tiểu từ kết như "nhé/ạ/rồi") → chốt NHANH (đỡ trễ).
//   • Câu bỏ lửng ("… tôi muốn VÀ", "… tại VÌ", ậm ừ) → chờ LÂU hơn để người dùng nói tiếp,
//     rồi GỘP các mảnh thành MỘT lượt (thay vì cắt sớm → Mira trả lời hụt).
//
// Thiên lệch AN TOÀN: chờ thêm rẻ hơn nhiều so với cắt lời giữa chừng — khi phân vân, chờ.
// Hàm THUẦN (không side-effect) → dễ kiểm thử; tinh chỉnh ngưỡng ở ENDPOINT bên dưới.

export const ENDPOINT = {
  complete: 480, // câu có vẻ trọn ý → chốt nhanh
  base: 850, // trung tính (câu đủ dài, không có dấu hiệu bỏ lửng)
  trailing: 1500, // đang bỏ lửng ở từ nối/đệm, hoặc còn quá ngắn → chờ gộp thêm
  minWords: 4, // dưới ngưỡng này coi như chưa đủ một ý → nghiêng về chờ
} as const;

// Từ NỐI / GIỚI TỪ / mạo từ / thán từ đệm: nếu câu DỪNG ngay ở đây thì gần như chắc chắn
// người nói CÒN TIẾP. Chọn lọc thận trọng — chỉ các từ hiếm khi kết thúc một ý trọn.
const TRAILING = new Set([
  'và', 'với', 'cùng', 'hoặc', 'hay', 'nhưng', 'mà', 'thì', 'là', 'để', 'vì', 'bởi',
  'nên', 'cho', 'của', 'các', 'những', 'một', 'rằng', 'tại', 'do', 'nếu', 'dù', 'khi',
  'ờ', 'à', 'ừ', 'ừm', 'ưm', 'ậm', 'kiểu', 'thứ', 'cái',
]);

// Tiểu từ KẾT CÂU tiếng Việt: dừng ở đây thường là đã nói xong một ý → chốt nhanh.
const END_PARTICLE = new Set([
  'nhé', 'nha', 'nhá', 'nghen', 'ạ', 'ấy', 'đấy', 'thôi', 'vậy', 'ha', 'rồi', 'xong',
]);

const STRONG_END = /[.!?…]$/; // dấu câu kết (Web Speech vi-VN hiếm khi thêm, nhưng vẫn tôn trọng)

/** Từ CUỐI (đã bỏ dấu câu/ngoặc đuôi, thường hoá) — dùng để đọc tín hiệu bỏ lửng/kết câu. */
export function lastWord(text: string): string {
  const t = text.trim().toLowerCase().replace(/[.,!?…:;"'”’)\]]+$/g, '');
  const parts = t.split(/\s+/).filter(Boolean);
  return parts[parts.length - 1] || '';
}

/** Số ms nên chờ im lặng sau lời cuối trước khi CHỐT lượt. */
export function computeEndpointDelay(text: string): number {
  const t = text.trim();
  if (!t) return ENDPOINT.trailing;
  if (STRONG_END.test(t)) return ENDPOINT.complete;

  const w = lastWord(t);
  if (END_PARTICLE.has(w)) return ENDPOINT.complete;
  if (TRAILING.has(w)) return ENDPOINT.trailing;

  const words = t.split(/\s+/).filter(Boolean).length;
  if (words < ENDPOINT.minWords) return ENDPOINT.trailing; // câu còn ngắn → chờ gộp
  return ENDPOINT.base;
}

/** Nhãn phân loại (chỉ để hiển thị/gỡ lỗi trong DevConsole). */
export function classifyEnd(text: string): 'complete' | 'base' | 'trailing' {
  const d = computeEndpointDelay(text);
  return d <= ENDPOINT.complete ? 'complete' : d >= ENDPOINT.trailing ? 'trailing' : 'base';
}
