// Ngắt lời bằng GIỌNG (full-duplex như Grok): Silero VAD chạy trong trình duyệt
// (@ricky0123/vad-web → onnxruntime-web WASM). LAZY-load: không nằm trong bundle chính;
// lỗi tải/khởi tạo (offline, WASM bị chặn…) → available=false, app rơi về ngắt lời bằng
// nút/Space như cũ. Tải model + xin quyền mic chỉ khi người dùng bật ở Developer Console.

interface VADHandlers {
  onSpeechStart?: () => void;
  onSpeechEnd?: () => void;
}

export class SileroVAD {
  private vad: { start: () => void; pause: () => void; destroy?: () => void } | null = null;
  private busy = false;
  available = false;
  lastError: string | null = null;

  async init(h: VADHandlers): Promise<boolean> {
    if (this.vad || this.busy) return this.available;
    this.busy = true;
    try {
      const mod = await import('@ricky0123/vad-web');
      this.vad = await mod.MicVAD.new({
        // Thiên về TRÁNH báo nhầm để đỡ tự cắt lời do tiếng ồn/echo nhỏ (đơn vị ms).
        positiveSpeechThreshold: 0.85,
        negativeSpeechThreshold: 0.6,
        minSpeechMs: 120,
        redemptionMs: 240,
        onSpeechStart: () => h.onSpeechStart?.(),
        onSpeechEnd: () => h.onSpeechEnd?.(),
      });
      this.available = true;
      return true;
    } catch (e) {
      this.available = false;
      this.lastError = e instanceof Error ? e.message : String(e);
      console.warn('[Mira VAD] không khởi tạo được — ngắt lời bằng nút/Space vẫn chạy.', this.lastError);
      return false;
    } finally {
      this.busy = false;
    }
  }

  start(): void {
    try {
      this.vad?.start();
    } catch {
      /* noop */
    }
  }

  pause(): void {
    try {
      this.vad?.pause();
    } catch {
      /* noop */
    }
  }

  destroy(): void {
    try {
      this.vad?.destroy?.();
    } catch {
      /* noop */
    }
    this.vad = null;
    this.available = false;
  }
}
