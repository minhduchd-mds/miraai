// Ngắt lời bằng GIỌNG (full-duplex như Grok): Silero VAD chạy trong trình duyệt
// (@ricky0123/vad-web → onnxruntime-web WASM). LAZY-load: không nằm trong bundle chính;
// lỗi tải/khởi tạo (offline, WASM bị chặn…) → available=false, app rơi về ngắt lời bằng
// nút/Space như cũ. Tải model + xin quyền mic chỉ khi người dùng bật ở Developer Console.

interface VADHandlers {
  onSpeechStart?: () => void;
  /** Fires only after `minSpeechMs` of speech: use this to interrupt Mira (fewer false barge-ins). */
  onSpeechConfirmed?: () => void;
  onSpeechEnd?: () => void;
}

/** Tuned by experiment E3 (24/10/2026, TEN VAD public test set, 30 clips × clean/10 dB/0 dB):
 *  positive 0.7 + 200 ms → barge-in p50 235–275 ms, 0–2 false triggers in total, fewer misses in
 *  noise than 0.85. Echo from Mira's own voice was NOT measured (needs real devices). */
export const VAD_TUNING = Object.freeze({ positiveSpeechThreshold: 0.7, negativeSpeechThreshold: 0.55, minSpeechMs: 200, redemptionMs: 240 });

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
        ...VAD_TUNING,
        onSpeechStart: () => h.onSpeechStart?.(),
        onSpeechRealStart: () => h.onSpeechConfirmed?.(),
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
