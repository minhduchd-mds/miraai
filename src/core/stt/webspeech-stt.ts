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

    const rec = new this.Ctor();
    rec.lang = opts.lang;
    rec.continuous = false; // 1 lượt nói / lần (v1). Always-on + Silero VAD = nâng cấp sau (§5).
    rec.interimResults = true; // partial transcript → caption trực tiếp
    rec.maxAlternatives = 1;

    rec.onresult = (e: any) => {
      let interim = '';
      let final = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const seg = e.results[i];
        if (seg.isFinal) final += seg[0].transcript;
        else interim += seg[0].transcript;
      }
      if (final.trim()) opts.onResult({ transcript: final.trim(), isFinal: true });
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
