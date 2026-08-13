// Cờ bật/tắt "turn-taking thông minh" (smart endpointing thích ứng — xem endpointer.ts).
// MẶC ĐỊNH BẬT: đây là hành vi nghe mới, tốt hơn cho hội thoại tự nhiên. Vẫn giữ escape hatch
// qua localStorage để tắt tức thì (về endpoint cứng của Web Speech) nếu môi trường nào đó lỗi —
// cùng pattern config-qua-localStorage như vad/config.ts.
const LS_KEY = 'mira.smartturn.enabled';

export function loadSmartTurn(): boolean {
  try {
    return localStorage.getItem(LS_KEY) !== '0'; // vắng mặt hoặc '1' → BẬT; chỉ '0' mới TẮT
  } catch {
    return true;
  }
}

export function saveSmartTurn(on: boolean): void {
  try {
    localStorage.setItem(LS_KEY, on ? '1' : '0');
  } catch {
    /* noop */
  }
}
