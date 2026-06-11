// Biên độ âm thanh THẬT của TTS đang phát (0..1) — nguồn cho lipsync khớp âm.
// Adapter nào phát qua HTMLAudio (VieNeu, ElevenLabs) thì attachAnalyser() vào element;
// VRMAvatar đọc audioLevel mỗi frame: active=true → dùng amp thật, false → envelope giả lập (Web Speech).
export const audioLevel = { value: 0, active: false };

let ctx: AudioContext | null = null;

export function attachAnalyser(el: HTMLAudioElement): () => void {
  try {
    ctx = ctx || new AudioContext();
    void ctx.resume(); // cần user-activation — các nút bấm trong app đã cấp
    const src = ctx.createMediaElementSource(el); // mỗi element chỉ attach được 1 lần (mỗi câu 1 element mới)
    const an = ctx.createAnalyser();
    an.fftSize = 512;
    an.smoothingTimeConstant = 0.4;
    src.connect(an);
    an.connect(ctx.destination); // analyser nằm giữa → vẫn nghe được tiếng
    const buf = new Uint8Array(an.fftSize);

    audioLevel.active = true;
    let raf = 0;
    let stopped = false;
    const loop = () => {
      if (stopped) return;
      an.getByteTimeDomainData(buf);
      let sum = 0;
      for (let i = 0; i < buf.length; i++) {
        const d = (buf[i] - 128) / 128;
        sum += d * d;
      }
      const rms = Math.sqrt(sum / buf.length);
      audioLevel.value = Math.min(1, rms * 3.2); // RMS giọng nói ~0.05–0.3 → scale lên 0..1
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      audioLevel.value = 0;
      audioLevel.active = false;
      try {
        src.disconnect();
        an.disconnect();
      } catch {
        /* noop */
      }
    };
  } catch {
    // AudioContext bị chặn/lỗi → lipsync rơi về envelope giả lập, audio vẫn phát bình thường
    return () => {
      /* noop */
    };
  }
}

if (import.meta.env.DEV) (window as any).__audioLevel = audioLevel; // debug trong dev
