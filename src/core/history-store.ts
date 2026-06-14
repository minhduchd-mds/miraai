import type { BrainTurn } from './types';

// Lưu/đọc lịch sử hội thoại qua /api/history (Neon). Hỏng/thiếu DB → im lặng dùng bộ nhớ tạm (không vỡ app).
// Khoá theo "device id" sinh 1 lần/máy (localStorage) → mỗi trình duyệt 1 luồng nhớ riêng, không cần đăng nhập.
const DEVICE_KEY = 'mira.device';

function deviceId(): string {
  try {
    let id = localStorage.getItem(DEVICE_KEY);
    if (!id) {
      id = 'dev_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
      localStorage.setItem(DEVICE_KEY, id);
    }
    return id;
  } catch {
    return 'dev_anon';
  }
}

// Lấy các lượt gần nhất để "mồi" ngữ cảnh cho não → Mira nhớ chuyện đã nói ở phiên trước.
export async function loadHistory(): Promise<BrainTurn[]> {
  try {
    const r = await fetch(`/api/history?device=${encodeURIComponent(deviceId())}`);
    if (!r.ok) return [];
    const j = await r.json();
    const turns = Array.isArray(j?.turns) ? j.turns : [];
    return turns
      .filter((t: any) => (t?.role === 'user' || t?.role === 'mira') && typeof t?.text === 'string')
      .map((t: any) => ({ role: t.role, text: t.text }) as BrainTurn);
  } catch {
    return [];
  }
}

// Ghi 1 lượt (fire-and-forget — không chặn luồng nói/nghe; lỗi thì bỏ qua).
export function saveTurn(turn: BrainTurn): void {
  try {
    void fetch('/api/history', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ device: deviceId(), role: turn.role, text: turn.text }),
    }).catch(() => {});
  } catch {
    /* noop */
  }
}
