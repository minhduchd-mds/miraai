export const MAX_TTS_AUDIO_BYTES = 8 * 1024 * 1024;

/**
 * Bounded audio fetch: never materialize arbitrary provider responses with
 * response.arrayBuffer(). A hostile/failed upstream must not exhaust function
 * memory or deliver HTML/JSON under an audio response.
 */
export async function readLimitedTtsAudio(response, maxBytes = MAX_TTS_AUDIO_BYTES) {
  if (!response?.ok) throw new Error('tts_provider_unavailable');
  const type = String(response.headers?.get?.('content-type') || '').split(';')[0].trim().toLowerCase();
  if (type && !(type.startsWith('audio/') || type === 'application/octet-stream')) {
    throw new Error('tts_provider_invalid_content_type');
  }
  const rawLength = response.headers?.get?.('content-length');
  if (rawLength != null && rawLength !== '') {
    const advertised = Number(rawLength);
    if (!Number.isSafeInteger(advertised) || advertised < 0 || advertised > maxBytes) {
      throw new Error('tts_provider_audio_too_large');
    }
  }
  const reader = response.body?.getReader?.();
  if (!reader) throw new Error('tts_provider_stream_unavailable');
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!(value instanceof Uint8Array)) throw new Error('tts_provider_invalid_audio_chunk');
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel().catch(() => {});
        throw new Error('tts_provider_audio_too_large');
      }
      chunks.push(Buffer.from(value));
    }
  } finally {
    reader.releaseLock();
  }
  if (!size) throw new Error('tts_provider_empty_audio');
  return { audio: Buffer.concat(chunks, size), contentType: type || 'audio/mpeg' };
}
