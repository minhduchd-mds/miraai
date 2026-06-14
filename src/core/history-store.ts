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

// Truy hồi ký ức NGỮ NGHĨA liên quan câu hỏi (top-k lượt cũ gần nghĩa) → chuỗi để "mồi" cho não.
// Lỗi/thiếu DB hoặc key embedding → trả '' (Mira vẫn chạy bằng 12 lượt gần nhất). Lọc theo điểm cosine.
export async function recallMemory(query: string): Promise<string> {
  const q = (query || '').trim();
  if (!q) return '';
  try {
    const r = await fetch(`/api/memory?device=${encodeURIComponent(deviceId())}&q=${encodeURIComponent(q)}`);
    if (!r.ok) return '';
    const j = await r.json();
    const mems = Array.isArray(j?.memories) ? j.memories : [];
    const useful = mems
      .filter((m: any) => typeof m?.text === 'string' && (m.score == null || m.score > 0.55))
      .slice(0, 5);
    if (!useful.length) return '';
    return useful.map((m: any) => `- ${m.role === 'mira' ? 'Mira đã nói' : 'Người dùng đã nói'}: ${m.text}`).join('\n');
  } catch {
    return '';
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
