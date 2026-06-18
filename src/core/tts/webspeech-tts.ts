import type { TTSAdapter, TTSSpeakOptions, VoiceOption } from '../types';

export interface TTSDiagnostics {
  voices: number;
  viVoices: number;
  speaking: boolean;
  pending: boolean;
  paused: boolean;
  unlocked: boolean;
  lastError: string | null;
}

// TTS bằng Web Speech API (speechSynthesis) — miễn phí, có giọng vi-VN trên hầu hết máy.
// Đã vá các lỗi câm tiếng kinh điển của Chrome:
//  (1) unlock() trong user-gesture để câu nói async sau này không bị câm
//  (2) GIỮ THAM CHIẾU utterance đang nói — Chrome GC mất utterance → câm không báo lỗi
//  (3) speak() ngay sau cancel() bị "nuốt" → luôn chờ một nhịp sau cancel gần đây
//  (4) getVoices() rỗng lúc gọi sớm → chờ 'voiceschanged' rồi mới nói
//  (5) keep-alive resume() né bug Chrome tự pause synth sau ~15s
// Nâng cấp: thay bằng Vbee/Viettel/ElevenLabs (streaming theo câu, giọng nữ tự nhiên hơn — §6).
export class WebSpeechTTS implements TTSAdapter {
  private synth = typeof window !== 'undefined' ? window.speechSynthesis : null;
  private unlocked = false;
  private keepAlive: number | null = null;
  private current: SpeechSynthesisUtterance | null = null; // chống GC (2)
  private lastCancelAt = 0;
  private lastError: string | null = null;
  private pendingFire: number | null = null;

  get available(): boolean {
    return !!this.synth;
  }

  /** Gọi trong một user-gesture (click/keydown) để "mồi" engine — idempotent. */
  unlock(): void {
    if (!this.synth || this.unlocked) return;
    try {
      const u = new SpeechSynthesisUtterance(' ');
      u.volume = 0;
      this.synth.speak(u);
      this.synth.resume();
      this.unlocked = true;
      // eslint-disable-next-line no-console
      console.info('[Mira TTS] engine unlocked');
    } catch {
      /* noop */
    }
  }

  speak(opts: TTSSpeakOptions): void {
    const synth = this.synth;
    if (!synth) {
      opts.onError?.('not-supported');
      return;
    }
    if (this.pendingFire != null) {
      clearTimeout(this.pendingFire);
      this.pendingFire = null;
    }

    const buildAndFire = () => {
      const u = new SpeechSynthesisUtterance(opts.text);
      u.lang = opts.lang;
      u.rate = opts.rate ?? 1;
      u.pitch = opts.pitch ?? 1;
      u.volume = 1;

      const voices = synth.getVoices();
      let voice =
        (opts.voiceURI && voices.find((v) => v.voiceURI === opts.voiceURI)) || undefined;
      if (!voice) {
        const p = opts.lang.slice(0, 2).toLowerCase();
        voice =
          voices.find((v) => v.lang?.toLowerCase().startsWith('vi')) ||
          voices.find((v) => v.lang?.toLowerCase().startsWith(p));
      }
      if (voice) u.voice = voice;

      u.onstart = () => {
        this.startKeepAlive();
        // eslint-disable-next-line no-console
        console.info('[Mira TTS] speaking:', voice?.name || u.lang);
        opts.onStart?.();
      };
      u.onboundary = (e) => opts.onBoundary?.(e.charIndex);
      u.onend = () => {
        this.stopKeepAlive();
        if (this.current === u) this.current = null;
        opts.onEnd?.();
      };
      u.onerror = (e: any) => {
        this.stopKeepAlive();
        if (this.current === u) this.current = null;
        const err = e?.error || 'tts_error';
        if (err === 'interrupted' || err === 'canceled') return; // do mình chủ động cancel (barge-in)
        this.lastError = err;
        // eslint-disable-next-line no-console
        console.warn('[Mira TTS] error:', err);
        opts.onError?.(err);
      };

      this.current = u; // giữ tham chiếu tới khi end/error (2)
      try {
        synth.speak(u);
        synth.resume(); // nudge: một số bản Chrome ở trạng thái paused sau cancel
      } catch {
        this.lastError = 'tts_speak_failed';
        opts.onError?.('tts_speak_failed');
      }
    };

    const fire = () => {
      // (4) voices chưa nạp → chờ voiceschanged (tối đa 1s) rồi nói
      if (synth.getVoices().length === 0) {
        let done = false;
        const go = () => {
          if (done) return;
          done = true;
          synth.removeEventListener?.('voiceschanged', go);
          buildAndFire();
        };
        synth.addEventListener?.('voiceschanged', go);
        window.setTimeout(go, 1000);
        return;
      }
      buildAndFire();
    };

    // (3) Đang nói dở HOẶC vừa cancel xong → chờ một nhịp mới speak, tránh race "nuốt câu".
    const sinceCancel = Date.now() - this.lastCancelAt;
    if (synth.speaking || synth.pending) {
      synth.cancel();
      this.lastCancelAt = Date.now();
      this.pendingFire = window.setTimeout(fire, 120);
    } else if (sinceCancel < 300) {
      this.pendingFire = window.setTimeout(fire, 320 - sinceCancel);
    } else {
      fire();
    }
  }

  cancel(): void {
    try {
      this.stopKeepAlive();
      if (this.pendingFire != null) {
        clearTimeout(this.pendingFire);
        this.pendingFire = null;
      }
      this.current = null;
      this.lastCancelAt = Date.now();
      this.synth?.cancel();
    } catch {
      /* noop */
    }
  }

  listVoices(langPrefix?: string): VoiceOption[] {
    if (!this.synth) return [];
    // Bỏ hết giọng Google (không dùng) khỏi danh sách chọn.
    const all = this.synth.getVoices().filter((v) => !/google/i.test(v.name));
    const list = langPrefix
      ? all.filter((v) => v.lang?.toLowerCase().startsWith(langPrefix.toLowerCase()))
      : all;
    return list.map((v) => ({ name: v.name, voiceURI: v.voiceURI, lang: v.lang }));
  }

  /** Đọc câu thử cố định — gọi TRONG user-gesture (nút bấm) để loại trừ autoplay-block. */
  test(voiceURI?: string): void {
    this.unlock();
    this.speak({
      text: 'Xin chào anh, em là Mira. Anh nghe rõ em chứ ạ?',
      lang: 'vi-VN',
      voiceURI,
    });
  }

  diagnostics(): TTSDiagnostics {
    const voices = this.synth?.getVoices() || [];
    return {
      voices: voices.length,
      viVoices: voices.filter((v) => v.lang?.toLowerCase().startsWith('vi')).length,
      speaking: !!this.synth?.speaking,
      pending: !!this.synth?.pending,
      paused: !!this.synth?.paused,
      unlocked: this.unlocked,
      lastError: this.lastError,
    };
  }

  private startKeepAlive(): void {
    this.stopKeepAlive();
    this.keepAlive = window.setInterval(() => {
      try {
        this.synth?.resume();
      } catch {
        /* noop */
      }
    }, 8000);
  }

  private stopKeepAlive(): void {
    if (this.keepAlive != null) {
      clearInterval(this.keepAlive);
      this.keepAlive = null;
    }
  }
}
