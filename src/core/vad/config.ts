// Cờ bật/tắt "ngắt lời bằng giọng" (VAD). Mặc định TẮT vì cần tải model + quyền mic +
// chỉ chạy ổn khi online — bật ở Developer Console khi muốn trải nghiệm full-duplex.
const LS_KEY = 'mira.vad.enabled';

export function loadVadEnabled(): boolean {
  try {
    return localStorage.getItem(LS_KEY) === '1';
  } catch {
    return false;
  }
}

export function saveVadEnabled(on: boolean): void {
  try {
    if (on) localStorage.setItem(LS_KEY, '1');
    else localStorage.removeItem(LS_KEY);
  } catch {
    /* noop */
  }
}
