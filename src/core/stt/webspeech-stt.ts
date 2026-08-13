import type { STTAdapter, STTStartOptions } from '../types';

// STT bằng Web Speech API (có sẵn trong Chrome/Edge, miễn phí, hỗ trợ vi-VN).
// LƯU Ý: Chrome gửi audio lên server Google để nhận dạng — KHÔNG phải on-device.
// Vùng bảo mật cao → thay adapter này bằng Whisper/Viettel self-host (xem §7, §12).
type AnyRecognition = any;

export class WebSpeechSTT implements STTAdapter {
  private Ctor: any;
  private rec: AnyRecognition | null = null;

  constructor() {
    this.Ctor =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition ||
      null;
  }

  get available(): boolean {
    return !!this.Ctor;
  }

  start(opts: STTStartOptions): void {
    if (!this.Ctor) {
      opts.onError('not-supported');
      return;
    }
    this.abort();

    const continuous = !!opts.continuous;
    const rec = new this.Ctor();
    rec.lang = opts.lang;
    // continuous=true (smart turn-taking): giữ session qua các quãng ngắt, TÍCH LUỸ mảnh final,
    // để useMira/endpointer tự quyết điểm kết lượt. false: 1 lượt/lần, Web Speech tự kết (cũ).
    rec.continuous = continuous;
    rec.interimResults = true; // partial transcript → caption trực tiếp
    rec.maxAlternatives = 1;

    // Tổng các đoạn final đã chốt trong session này (chỉ dùng ở chế độ continuous để gộp lượt).
    let finalAcc = '';
    rec.onresult = (e: any) => {
      let interim = '';
      let finalNew = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const seg = e.results[i];
        if (seg.isFinal) finalNew += seg[0].transcript;
        else interim += seg[0].transcript;
      }
      if (continuous) {
        finalAcc = (finalAcc + finalNew).replace(/\s{2,}/g, ' ');
        const full = `${finalAcc} ${interim}`.trim();
        // isFinal ở đây = "text hiện đã ổn định (không còn interim)", KHÔNG phải kết lượt.
        // useMira dùng cờ này để chọn độ trễ endpoint; điểm kết lượt do timer thích ứng quyết.
        if (full) opts.onResult({ transcript: full, isFinal: interim.trim() === '' && finalAcc.trim() !== '' });
        return;
      }
      // Hành vi cũ (không continuous): đoạn final đầu tiên là đủ để chốt lượt.
      if (finalNew.trim()) opts.onResult({ transcript: finalNew.trim(), isFinal: true });
      else if (interim.trim()) opts.onResult({ transcript: interim.trim(), isFinal: false });
    };

    rec.onerror = (e: any) => opts.onError(e?.error || 'stt_error');
    rec.onend = () => opts.onEnd();

    this.rec = rec;
    try {
      rec.start();
    } catch {
      opts.onError('stt_start_failed');
    }
  }

  stop(): void {
    try {
      this.rec?.stop();
    } catch {
      /* noop */
    }
  }

  abort(): void {
    const rec = this.rec;
    this.rec = null;
    if (rec) {
      // Gỡ handler TRƯỚC khi abort: tránh sự kiện 'end'/'error' trễ gọi lại callback cũ
      // (stale onEnd) sau khi đã chuyển trạng thái — nguồn gốc lỗi "lượt nghe ma".
      rec.onresult = null;
      rec.onerror = null;
      rec.onend = null;
      try {
        rec.abort();
      } catch {
        /* noop */
      }
    }
  }
}
