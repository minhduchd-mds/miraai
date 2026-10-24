// Free spoken-reply fallback: Gemini TTS (free tier) when ElevenLabs is unavailable.
// Server-side only (GEMINI_API_KEY never reaches the browser). Returns a WAV buffer
// (PCM16 mono from the model, wrapped with a RIFF header) or throws.

export const GEMINI_TTS_MODELS = Object.freeze(['gemini-3.8-flash-tts', 'gemini-3.8-flash-lite-tts']);
export const GEMINI_TTS_DEFAULT_VOICE = 'Aoede';
const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';

export function geminiTtsKey(env = process.env) {
  return String(env.GEMINI_API_KEY || env.GOOGLE_API_KEY || env.GOOGLE_GENERATIVE_AI_API_KEY || env.GEMINI_KEY || '').trim();
}

export function geminiTtsVoice(env = process.env) {
  const v = String(env.MIRA_GEMINI_TTS_VOICE || '').trim();
  return /^[A-Za-z][A-Za-z0-9_-]{1,40}$/.test(v) ? v : GEMINI_TTS_DEFAULT_VOICE;
}

export function geminiTtsModels(env = process.env) {
  const pinned = String(env.MIRA_GEMINI_TTS_MODEL || '').trim().replace(/^models\//, '');
  return /^gemini-[a-z0-9.\-]{2,60}-tts[a-z0-9.\-]*$/i.test(pinned) ? [pinned] : [...GEMINI_TTS_MODELS];
}

/** "Say …:" style prefix is how Gemini TTS takes delivery direction; the text itself is spoken. */
export function geminiTtsPrompt(text) {
  return `Say in Vietnamese, warm, gentle and natural, like a close friend on a voice call:\n${String(text).trim()}`;
}

export function pcmRateFromMime(mime) {
  const m = /rate=(\d{4,6})/i.exec(String(mime || ''));
  return m ? Number(m[1]) : 24000;
}

export function wavFromPcm16(pcm, sampleRate = 24000, channels = 1) {
  const header = Buffer.alloc(44);
  const byteRate = sampleRate * channels * 2;
  header.write('RIFF', 0, 'ascii');
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write('WAVE', 8, 'ascii');
  header.write('fmt ', 12, 'ascii');
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(channels * 2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36, 'ascii');
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

export function geminiTtsRequestBody(text, voice) {
  return {
    contents: [{ role: 'user', parts: [{ text: geminiTtsPrompt(text) }] }],
    generationConfig: {
      responseModalities: ['AUDIO'],
      speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } },
    },
  };
}

/**
 * Synthesize `text`. Tries each free model once; 429/5xx/timeouts fall through to the next.
 * @returns {Promise<{ audio: Buffer, contentType: 'audio/wav', model: string, voice: string }>}
 */
export async function geminiTtsSynthesize(text, { env = process.env, fetchImpl = globalThis.fetch, signal } = {}) {
  const key = geminiTtsKey(env);
  if (!key) throw new Error('gemini_tts_not_configured');
  const voice = geminiTtsVoice(env);
  let last = 'gemini_tts_failed';
  for (const model of geminiTtsModels(env)) {
    let response;
    try {
      response = await fetchImpl(`${ENDPOINT}/${model}:generateContent`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify(geminiTtsRequestBody(text, voice)),
        signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(15_000)]) : AbortSignal.timeout(15_000),
      });
    } catch (error) {
      if (signal?.aborted) throw error;
      last = `gemini_tts_network:${model}`;
      continue;
    }
    if (!response.ok) {
      let message = '';
      try { message = String((await response.json())?.error?.message || '').slice(0, 200); } catch { /* noop */ }
      last = `gemini_tts_${response.status}:${model}${message ? ` ${message}` : ''}`;
      continue;
    }
    let payload;
    try { payload = await response.json(); } catch { last = `gemini_tts_bad_json:${model}`; continue; }
    const part = (payload?.candidates?.[0]?.content?.parts || []).find((p) => p?.inlineData?.data);
    if (!part) { last = `gemini_tts_no_audio:${model}`; continue; }
    const pcm = Buffer.from(part.inlineData.data, 'base64');
    if (pcm.length < 2000) { last = `gemini_tts_short_audio:${model}`; continue; }
    return { audio: wavFromPcm16(pcm, pcmRateFromMime(part.inlineData.mimeType)), contentType: 'audio/wav', model, voice };
  }
  throw new Error(last);
}
