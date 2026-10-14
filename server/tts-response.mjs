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

/** Relay binary audio progressively, with the same bounds as the buffered path.
 * The caller sets private/CORS/provider headers before the first write.
 * Any failure after the first byte MUST terminate the connection, not return JSON.
 */
export async function streamLimitedTtsAudio(response, writable, maxBytes = MAX_TTS_AUDIO_BYTES) {
  if (!response?.ok) throw new Error('tts_provider_unavailable');
  const type = String(response.headers?.get?.('content-type') || '').split(';')[0].trim().toLowerCase();
  if (type && !(type.startsWith('audio/') || type === 'application/octet-stream')) {
    throw new Error('tts_provider_invalid_content_type');
  }
  const rawLength = response.headers?.get?.('content-length');
  if (rawLength != null && rawLength !== '') {
    const declared = Number(rawLength);
    if (!Number.isSafeInteger(declared) || declared < 0 || declared > maxBytes)
      throw new Error('tts_provider_audio_too_large');
  }
  const reader = response.body?.getReader?.();
  if (!reader) throw new Error('tts_provider_stream_unavailable');
  let size = 0;
  try {
    while (true) {
      const {done, value} = await reader.read();
      if (done) break;
      if (!(value instanceof Uint8Array)) throw new Error('tts_provider_invalid_audio_chunk');
      size += value.byteLength;
      if (size > maxBytes) throw new Error('tts_provider_audio_too_large');
      if (value.byteLength) writable.write(Buffer.from(value));
    }
    if (size === 0) throw new Error('tts_provider_empty_audio');
    writable.end();
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
  return size;
}
