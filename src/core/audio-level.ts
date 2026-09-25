// Biên độ âm thanh THẬT của TTS đang phát (0..1) — nguồn cho lipsync khớp âm.
// Adapter nào phát qua HTMLAudio (VieNeu, ElevenLabs) thì attachAnalyser() vào element;
// VRMAvatar đọc audioLevel mỗi frame: active=true → dùng amp thật, false → envelope giả lập (Web Speech).
export const audioLevel = { value: 0, active: false };

export interface MicProsodySnapshot {
  energy: number;
  activity: number;
  silenceRatio: number;
  pitchHz: number;
  pitchVariability: number;
  confidence: number;
}

const micProsody: MicProsodySnapshot = {
  energy: 0, activity: 0, silenceRatio: 1, pitchHz: 0, pitchVariability: 0, confidence: 0,
};

export function micProsodySnapshot(): MicProsodySnapshot {
  return { ...micProsody };
}

function estimatePitchHz(samples: Float32Array, sampleRate: number): number {
  let rms = 0;
  for (let i = 0; i < samples.length; i += 1) rms += samples[i] * samples[i];
  rms = Math.sqrt(rms / samples.length);
  if (rms < 0.012) return 0;

  const minLag = Math.floor(sampleRate / 360);
  const maxLag = Math.min(samples.length - 2, Math.floor(sampleRate / 75));
  let bestLag = 0;
  let bestScore = 0;
  for (let lag = minLag; lag <= maxLag; lag += 1) {
    let score = 0, normA = 0, normB = 0;
    for (let i = 0; i < samples.length - lag; i += 2) {
      const a = samples[i], b = samples[i + lag];
      score += a * b; normA += a * a; normB += b * b;
    }
    const normalized = score / Math.sqrt(Math.max(1e-9, normA * normB));
    if (normalized > bestScore) { bestScore = normalized; bestLag = lag; }
  }
  return bestScore >= 0.48 && bestLag > 0 ? sampleRate / bestLag : 0;
}

let ctx: AudioContext | null = null;

// Mồi AudioContext TRONG user-gesture (mở khoá autoplay) → attachAnalyser sau này route được + lipsync chạy.
export function primeAudio(): void {
  try {
    ctx = ctx || new (window.AudioContext || (window as any).webkitAudioContext)();
    if (ctx.state === 'suspended') void ctx.resume();
  } catch {
    /* noop */
  }
}

export function attachAnalyser(el: HTMLAudioElement): () => void {
  try {
    ctx = ctx || new (window.AudioContext || (window as any).webkitAudioContext)();
    if (ctx.state === 'suspended') void ctx.resume();
    // CHỐT CHỐNG CÂM: nếu context CHƯA chạy (autoplay chưa mở khoá) → route qua nó sẽ MẤT TIẾNG.
    // Bỏ analyser, để <audio> phát THẲNG (chắc chắn nghe được); lipsync rơi về envelope giả lập.
    if (ctx.state !== 'running') return () => {};
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

// ── Biên độ MIC thật khi đang NGHE (orb/waveform/footglow nảy theo giọng người dùng) ──
// Dùng stream getUserMedia riêng (Web Speech STT không cho audio node). KHÔNG nối ra
// destination → không nghe lại tiếng mình. Mic bị từ chối → im lặng rơi về envelope giả lập.
let micStream: MediaStream | null = null;
let micRaf = 0;
let micStopped = true;

export async function startMicLevel(): Promise<void> {
  if (micStream) return; // đang chạy rồi
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
    micStream = stream;
    ctx = ctx || new (window.AudioContext || (window as any).webkitAudioContext)();
    void ctx.resume();
    const src = ctx.createMediaStreamSource(stream);
    const an = ctx.createAnalyser();
    an.fftSize = 1024;
    an.smoothingTimeConstant = 0.5;
    src.connect(an); // analyser cụt — không phát ra loa
    const buf = new Uint8Array(an.fftSize);
    const floatBuf = new Float32Array(an.fftSize);
    const pitchHistory: number[] = [];
    let activityEma = 0;
    let silenceEma = 1;
    let lastPitchAt = 0;
    micStopped = false;
    audioLevel.active = true;
    const loop = () => {
      if (micStopped) return;
      an.getByteTimeDomainData(buf);
      let sum = 0;
      for (let i = 0; i < buf.length; i++) {
        const d = (buf[i] - 128) / 128;
        sum += d * d;
      }
      audioLevel.value = Math.min(1, Math.sqrt(sum / buf.length) * 4); // mic nhỏ → scale mạnh hơn output
      micRaf = requestAnimationFrame(loop);
    };
    micRaf = requestAnimationFrame(loop);
  } catch {
    // mic bị chặn/không có → orb dùng envelope giả lập, STT vẫn chạy bình thường
  }
}

export function stopMicLevel(): void {
  if (micStopped && !micStream) return;
  micStopped = true;
  cancelAnimationFrame(micRaf);
  if (micStream) {
    micStream.getTracks().forEach((t) => t.stop());
    micStream = null;
  }
  audioLevel.value = 0;
  audioLevel.active = false;
  micProsody.energy = 0;
  micProsody.activity = 0;
  micProsody.silenceRatio = 1;
  micProsody.pitchHz = 0;
  micProsody.pitchVariability = 0;
  micProsody.confidence = 0;
}

if (import.meta.env.DEV) (window as any).__audioLevel = audioLevel; // debug trong dev
