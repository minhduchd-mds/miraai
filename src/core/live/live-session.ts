// Mira Live — realtime duplex voice session (browser only, lazy-loaded on first use).
//
// mic → AudioWorklet → 16 kHz PCM16 → WebSocket (Gemini Live, ephemeral token)
// server audio (24 kHz PCM16) → scheduled AudioBufferSources → AnalyserNode → speakers
//                                                             └→ audioLevel / ttsLevel (lip-sync for 2D & 3D presence)
// The API key never reaches the browser; the token is single-use and server-constrained.

import { audioLevel, ttsLevel } from '../audio-level';
import { miraApiUrl } from '../../desktop/cloud-endpoints';
import {
  LIVE_INPUT_RATE,
  appendTranscript,
  base64ToBytes,
  buildAudioMessage,
  buildSetupMessage,
  buildTextMessage,
  bytesToBase64,
  floatToPcm16,
  parseServerMessage,
  pcm16ToFloat,
  resampleLinear,
  rms,
} from './live-protocol';

export type LivePhase = 'connecting' | 'listening' | 'speaking' | 'interrupted' | 'closed' | 'error';

export interface LiveTurn { role: 'user' | 'mira'; text: string }

export interface LiveSessionOptions {
  persona: string;
  adultConfirmed: boolean;
  context: string;
  onPhase: (phase: LivePhase) => void;
  onUserText: (text: string, final: boolean) => void;
  onMiraText: (text: string, final: boolean) => void;
  onTurn: (turn: LiveTurn) => void;
  onError: (message: string) => void;
}

interface TokenResponse { token: string; model: string; wsUrl: string; expiresAt: string }

const WORKLET_SOURCE = `
class MiraLiveCapture extends AudioWorkletProcessor {
  constructor() { super(); this.buffer = []; this.size = 0; }
  process(inputs) {
    const channel = inputs[0] && inputs[0][0];
    if (channel) {
      this.buffer.push(new Float32Array(channel));
      this.size += channel.length;
      if (this.size >= 2048) {
        const out = new Float32Array(this.size);
        let offset = 0;
        for (const part of this.buffer) { out.set(part, offset); offset += part.length; }
        this.buffer = []; this.size = 0;
        this.port.postMessage(out, [out.buffer]);
      }
    }
    return true;
  }
}
registerProcessor('mira-live-capture', MiraLiveCapture);
`;

const ERROR_COPY: Record<string, string> = {
  live_not_configured: 'Máy chủ chưa bật Mira Live.',
  live_disabled: 'Mira Live đang tạm tắt.',
  rate_limited: 'Anh mở Live hơi nhiều lần, đợi vài phút rồi thử lại nhé.',
  global_rate_limited: 'Mira Live đang quá tải, anh thử lại sau ít phút nhé.',
  origin_not_allowed: 'Trang này chưa được phép dùng Mira Live.',
  mic_denied: 'Mic bị chặn. Cho phép micro rồi bật Live lại nhé.',
  socket: 'Mất kết nối Mira Live.',
};

export function liveErrorMessage(code: string): string {
  return ERROR_COPY[code] || 'Mira Live chưa kết nối được. Em chuyển về chế độ thường.';
}

export class LiveSession {
  private ws: WebSocket | null = null;
  private token: TokenResponse | null = null;
  private resumeHandle = '';
  private micStream: MediaStream | null = null;
  private captureCtx: AudioContext | null = null;
  private captureNode: AudioWorkletNode | ScriptProcessorNode | null = null;
  private playCtx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private playing = new Set<AudioBufferSourceNode>();
  private nextStart = 0;
  private raf = 0;
  private userText = '';
  private miraText = '';
  private phase: LivePhase = 'connecting';
  private stopped = false;
  private reconnecting = false;
  private ready = false;

  constructor(private readonly options: LiveSessionOptions) {}

  async start(): Promise<void> {
    this.setPhase('connecting');
    try {
      // Ask for the mic first: if it is denied we never spend a token.
      this.micStream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
    } catch {
      this.fail('mic_denied');
      return;
    }
    const response = await fetch(miraApiUrl('chat?route=live-token'), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({
        persona: this.options.persona,
        adultConfirmed: this.options.adultConfirmed,
        context: this.options.context.slice(0, 2400),
      }),
    }).catch(() => null);
    if (!response?.ok) {
      let code = response ? `http_${response.status}` : 'socket';
      try { code = String((await response?.json())?.error || code); } catch { /* keep generic */ }
      this.fail(code);
      return;
    }
    this.token = await response.json() as TokenResponse;
    if (this.stopped) return;
    this.setupPlayback();
    this.connect();
  }

  /** Text typed while Live is open goes into the same realtime conversation. */
  sendText(text: string): void {
    if (!this.ready || !this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.stopPlayback();
    this.ws.send(JSON.stringify(buildTextMessage(text)));
  }

  stop(): void {
    this.stopped = true;
    this.ready = false;
    this.flushTurn();
    try { this.ws?.close(1000, 'user_stop'); } catch { /* noop */ }
    this.ws = null;
    this.stopPlayback();
    cancelAnimationFrame(this.raf);
    this.captureNode?.disconnect();
    this.captureNode = null;
    this.micStream?.getTracks().forEach((track) => track.stop());
    this.micStream = null;
    void this.captureCtx?.close().catch(() => undefined);
    void this.playCtx?.close().catch(() => undefined);
    this.captureCtx = null;
    this.playCtx = null;
    audioLevel.value = 0; audioLevel.active = false;
    ttsLevel.value = 0; ttsLevel.active = false;
    ttsLevel.bands.low = 0; ttsLevel.bands.mid = 0; ttsLevel.bands.high = 0;
    this.setPhase('closed');
  }

  private setPhase(phase: LivePhase): void {
    if (this.phase === phase) return;
    this.phase = phase;
    this.options.onPhase(phase);
  }

  private fail(code: string): void {
    this.options.onError(liveErrorMessage(code));
    this.setPhase('error');
    this.stop();
  }

  private connect(): void {
    if (!this.token) return;
    const url = `${this.token.wsUrl}?access_token=${encodeURIComponent(this.token.token)}`;
    const ws = new WebSocket(url);
    this.ws = ws;
    ws.onopen = () => ws.send(JSON.stringify(buildSetupMessage(this.token!.model, this.resumeHandle || undefined)));
    ws.onmessage = (event) => { void this.onMessage(event.data); };
    ws.onerror = () => { /* onclose decides */ };
    ws.onclose = (event) => {
      this.ready = false;
      if (this.stopped) return;
      if (this.resumeHandle && !this.reconnecting && Date.parse(this.token?.expiresAt || '') > Date.now()) {
        this.reconnecting = true;
        window.setTimeout(() => { this.reconnecting = false; if (!this.stopped) this.connect(); }, 300);
        return;
      }
      this.fail(event.code === 1008 ? 'origin_not_allowed' : 'socket');
    };
  }

  private async onMessage(data: unknown): Promise<void> {
    const text = typeof data === 'string' ? data : data instanceof Blob ? await data.text() : '';
    for (const event of parseServerMessage(text)) {
      switch (event.kind) {
        case 'setupComplete':
          if (!this.ready) {
            this.ready = true;
            await this.startCapture();
            this.setPhase('listening');
          }
          break;
        case 'audio':
          this.enqueueAudio(event.data, event.rate);
          break;
        case 'inputTranscript':
          this.userText = appendTranscript(this.userText, event.text);
          this.options.onUserText(this.userText.trim(), false);
          break;
        case 'outputTranscript':
          this.miraText = appendTranscript(this.miraText, event.text);
          this.options.onMiraText(this.miraText.trim(), false);
          break;
        case 'interrupted':
          this.stopPlayback();
          this.setPhase('interrupted');
          break;
        case 'turnComplete':
          this.flushTurn();
          if (!this.playing.size) this.setPhase('listening');
          break;
        case 'resumption':
          this.resumeHandle = event.handle;
          break;
        case 'goAway':
          // Server will close soon; onclose reconnects with the resumption handle.
          break;
        case 'error':
          this.options.onError('Mira Live báo lỗi từ máy chủ.');
          break;
      }
    }
  }

  private flushTurn(): void {
    const user = this.userText.trim();
    const mira = this.miraText.trim();
    if (user) { this.options.onUserText(user, true); this.options.onTurn({ role: 'user', text: user }); }
    if (mira) { this.options.onMiraText(mira, true); this.options.onTurn({ role: 'mira', text: mira }); }
    this.userText = '';
    this.miraText = '';
  }

  private async startCapture(): Promise<void> {
    if (!this.micStream || this.captureNode) return;
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    this.captureCtx = ctx;
    if (ctx.state === 'suspended') await ctx.resume().catch(() => undefined);
    const source = ctx.createMediaStreamSource(this.micStream);
    const send = (chunk: Float32Array) => {
      if (!this.ready || !this.ws || this.ws.readyState !== WebSocket.OPEN) return;
      // Mic level drives the listening glow only while Mira is silent.
      if (!this.playing.size) { audioLevel.active = true; audioLevel.value = Math.min(1, rms(chunk) * 4); }
      const pcm = floatToPcm16(resampleLinear(chunk, ctx.sampleRate, LIVE_INPUT_RATE));
      this.ws.send(JSON.stringify(buildAudioMessage(bytesToBase64(pcm))));
    };
    if (ctx.audioWorklet) {
      const url = URL.createObjectURL(new Blob([WORKLET_SOURCE], { type: 'application/javascript' }));
      try {
        await ctx.audioWorklet.addModule(url);
        const node = new AudioWorkletNode(ctx, 'mira-live-capture');
        node.port.onmessage = (event: MessageEvent<Float32Array>) => send(event.data);
        source.connect(node);
        this.captureNode = node;
        return;
      } catch { /* fall back below */ }
      finally { URL.revokeObjectURL(url); }
    }
    const processor = ctx.createScriptProcessor(4096, 1, 1);
    processor.onaudioprocess = (event) => send(new Float32Array(event.inputBuffer.getChannelData(0)));
    source.connect(processor);
    // ScriptProcessor only runs when connected; route through a muted gain so the mic is never heard.
    const mute = ctx.createGain();
    mute.gain.value = 0;
    processor.connect(mute);
    mute.connect(ctx.destination);
    this.captureNode = processor;
  }

  private setupPlayback(): void {
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctor();
    this.playCtx = ctx;
    if (ctx.state === 'suspended') void ctx.resume().catch(() => undefined);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    analyser.smoothingTimeConstant = 0.4;
    analyser.connect(ctx.destination);
    this.analyser = analyser;
    const wave = new Uint8Array(analyser.fftSize);
    const spectrum = new Uint8Array(analyser.frequencyBinCount);
    const binHz = ctx.sampleRate / analyser.fftSize;
    const band = (from: number, to: number) => {
      const start = Math.max(1, Math.floor(from / binHz));
      const end = Math.min(spectrum.length, Math.ceil(to / binHz));
      if (start >= end) return 0;
      let sum = 0;
      for (let i = start; i < end; i += 1) sum += spectrum[i];
      return sum / ((end - start) * 255);
    };
    const loop = () => {
      if (this.stopped) return;
      if (this.playing.size) {
        analyser.getByteTimeDomainData(wave);
        let sum = 0;
        for (let i = 0; i < wave.length; i += 1) { const d = (wave[i] - 128) / 128; sum += d * d; }
        const level = Math.min(1, Math.sqrt(sum / wave.length) * 3.2);
        analyser.getByteFrequencyData(spectrum);
        ttsLevel.active = true;
        ttsLevel.value = level;
        ttsLevel.bands.low = band(120, 450);
        ttsLevel.bands.mid = band(450, 1600);
        ttsLevel.bands.high = band(1600, 4000);
        audioLevel.active = true;
        audioLevel.value = level;
      } else if (ttsLevel.active) {
        ttsLevel.value = 0; ttsLevel.active = false;
      }
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  private enqueueAudio(base64: string, rate: number): void {
    const ctx = this.playCtx;
    if (!ctx || !this.analyser) return;
    const samples = pcm16ToFloat(base64ToBytes(base64));
    if (!samples.length) return;
    const buffer = ctx.createBuffer(1, samples.length, rate);
    buffer.copyToChannel(samples, 0);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(this.analyser);
    const startAt = Math.max(ctx.currentTime + 0.02, this.nextStart);
    source.start(startAt);
    this.nextStart = startAt + buffer.duration;
    this.playing.add(source);
    this.setPhase('speaking');
    source.onended = () => {
      this.playing.delete(source);
      if (!this.playing.size && !this.stopped && this.phase === 'speaking') this.setPhase('listening');
    };
  }

  /** Barge-in: drop every scheduled chunk immediately. */
  private stopPlayback(): void {
    for (const source of this.playing) {
      try { source.onended = null; source.stop(); source.disconnect(); } catch { /* already stopped */ }
    }
    this.playing.clear();
    this.nextStart = 0;
    ttsLevel.value = 0; ttsLevel.active = false;
  }
}
