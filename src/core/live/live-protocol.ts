// Mira Live — pure protocol helpers (no DOM, no network) so Node can test them directly.
// Gemini Live input: 16-bit little-endian PCM, mono, 16 kHz, base64 in realtimeInput.audio.
// Output: 16-bit PCM at the rate named in inlineData.mimeType (24 kHz in current docs).

export const LIVE_INPUT_RATE = 16_000;
export const LIVE_DEFAULT_OUTPUT_RATE = 24_000;

/** Linear-interpolation resample of mono float samples. */
export function resampleLinear(input: Float32Array, fromRate: number, toRate: number): Float32Array {
  if (!input.length || fromRate <= 0 || toRate <= 0) return new Float32Array(0);
  if (fromRate === toRate) return input.slice();
  const ratio = fromRate / toRate;
  const length = Math.max(1, Math.floor(input.length / ratio));
  const out = new Float32Array(length);
  for (let i = 0; i < length; i += 1) {
    const position = i * ratio;
    const left = Math.floor(position);
    const right = Math.min(input.length - 1, left + 1);
    const frac = position - left;
    out[i] = input[left] + (input[right] - input[left]) * frac;
  }
  return out;
}

export function floatToPcm16(input: Float32Array): Uint8Array {
  const bytes = new Uint8Array(input.length * 2);
  const view = new DataView(bytes.buffer);
  for (let i = 0; i < input.length; i += 1) {
    const sample = Math.max(-1, Math.min(1, input[i]));
    view.setInt16(i * 2, sample < 0 ? Math.round(sample * 0x8000) : Math.round(sample * 0x7fff), true);
  }
  return bytes;
}

export function pcm16ToFloat(bytes: Uint8Array): Float32Array<ArrayBuffer> {
  const samples = Math.floor(bytes.length / 2);
  const view = new DataView(bytes.buffer, bytes.byteOffset, samples * 2);
  const out = new Float32Array(samples);
  for (let i = 0; i < samples; i += 1) out[i] = view.getInt16(i * 2, true) / 0x8000;
  return out;
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
  return out;
}

export function rateFromMime(mimeType: string | undefined): number {
  const match = /rate=(\d{4,6})/i.exec(String(mimeType || ''));
  const rate = match ? Number(match[1]) : LIVE_DEFAULT_OUTPUT_RATE;
  return rate >= 8_000 && rate <= 96_000 ? rate : LIVE_DEFAULT_OUTPUT_RATE;
}

export function rms(samples: Float32Array): number {
  if (!samples.length) return 0;
  let sum = 0;
  for (let i = 0; i < samples.length; i += 1) sum += samples[i] * samples[i];
  return Math.sqrt(sum / samples.length);
}

export type LiveServerEvent =
  | { kind: 'setupComplete' }
  | { kind: 'audio'; data: string; rate: number }
  | { kind: 'inputTranscript'; text: string }
  | { kind: 'outputTranscript'; text: string }
  | { kind: 'interrupted' }
  | { kind: 'turnComplete' }
  | { kind: 'goAway'; timeLeft: string }
  | { kind: 'resumption'; handle: string }
  | { kind: 'error'; message: string };

type Json = Record<string, unknown>;
const isObject = (value: unknown): value is Json => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

/**
 * One server frame can carry several things (audio parts + a transcript + turnComplete),
 * so this returns an ordered list. Unknown fields are ignored, never thrown on.
 */
export function parseServerMessage(raw: unknown): LiveServerEvent[] {
  let message: unknown = raw;
  if (typeof raw === 'string') {
    try { message = JSON.parse(raw); } catch { return [{ kind: 'error', message: 'invalid_json' }]; }
  }
  if (!isObject(message)) return [];
  const events: LiveServerEvent[] = [];
  if ('setupComplete' in message) events.push({ kind: 'setupComplete' });

  const content = message.serverContent;
  if (isObject(content)) {
    if (content.interrupted === true) events.push({ kind: 'interrupted' });
    const input = content.inputTranscription;
    if (isObject(input) && typeof input.text === 'string' && input.text) events.push({ kind: 'inputTranscript', text: input.text });
    const turn = content.modelTurn;
    if (isObject(turn) && Array.isArray(turn.parts)) {
      for (const part of turn.parts) {
        if (!isObject(part)) continue;
        const inline = part.inlineData;
        if (isObject(inline) && typeof inline.data === 'string' && /^audio\//.test(String(inline.mimeType || 'audio/pcm'))) {
          events.push({ kind: 'audio', data: inline.data, rate: rateFromMime(inline.mimeType as string | undefined) });
        }
      }
    }
    const output = content.outputTranscription;
    if (isObject(output) && typeof output.text === 'string' && output.text) events.push({ kind: 'outputTranscript', text: output.text });
    if (content.turnComplete === true) events.push({ kind: 'turnComplete' });
  }

  const goAway = message.goAway;
  if (isObject(goAway)) events.push({ kind: 'goAway', timeLeft: String(goAway.timeLeft || '') });
  const resumption = message.sessionResumptionUpdate;
  if (isObject(resumption) && resumption.resumable === true && typeof resumption.newHandle === 'string' && resumption.newHandle) {
    events.push({ kind: 'resumption', handle: resumption.newHandle });
  }
  const error = message.error;
  if (isObject(error)) events.push({ kind: 'error', message: String(error.message || 'server_error').slice(0, 160) });
  return events;
}

/** Transcripts arrive as fragments; join without doubling spaces and keep it bounded. */
export function appendTranscript(current: string, fragment: string, max = 4000): string {
  const next = `${current}${fragment}`.replace(/\s+/g, ' ');
  return next.length > max ? next.slice(next.length - max) : next;
}

export function buildSetupMessage(model: string, resumeHandle?: string): Json {
  const setup: Json = {
    model: model.startsWith('models/') ? model : `models/${model}`,
    generationConfig: { responseModalities: ['AUDIO'] },
    inputAudioTranscription: {},
    outputAudioTranscription: {},
    sessionResumption: resumeHandle ? { handle: resumeHandle } : {},
  };
  return { setup };
}

export function buildAudioMessage(base64Pcm16k: string): Json {
  return { realtimeInput: { audio: { data: base64Pcm16k, mimeType: `audio/pcm;rate=${LIVE_INPUT_RATE}` } } };
}

export function buildTextMessage(text: string): Json {
  return { realtimeInput: { text: String(text).slice(0, 4000) } };
}

/** Flush the server-side audio cache when the mic pauses for > 1 s (tab hidden, mic lost). */
export function buildAudioStreamEndMessage(): Json {
  return { realtimeInput: { audioStreamEnd: true } };
}

/** Live session policy (pure, unit-tested). */
export const LIVE_IDLE_TIMEOUT_MS = 3 * 60_000;
export const LIVE_MAX_RECONNECTS = 3;
/** Reconnect with the same token while it is valid; otherwise a fresh token is required. */
export function liveReconnectPlan(input: { hasResumeHandle: boolean; tokenExpiresAt: string; now: number; attempts: number }):
  'reuse-token' | 'refresh-token' | 'give-up' {
  if (!input.hasResumeHandle || input.attempts >= LIVE_MAX_RECONNECTS) return 'give-up';
  const expires = Date.parse(input.tokenExpiresAt || '');
  return Number.isFinite(expires) && expires - input.now > 15_000 ? 'reuse-token' : 'refresh-token';
}
/** Backoff between reconnect attempts: 300 ms, 1.2 s, 3 s. */
export function liveReconnectDelayMs(attempt: number): number {
  return [300, 1200, 3000][Math.max(0, Math.min(2, attempt))];
}
