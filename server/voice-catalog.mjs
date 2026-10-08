import { createHash } from 'node:crypto';

export const VOICE_CATALOG_MAX_BYTES = 256 * 1024;
export const VOICE_CATALOG_MAX_ENTRIES = 48;
export const VOICE_CATALOG_TTL_MS = 5 * 60_000;
export const VOICE_CATALOG_STALE_MS = 30 * 60_000;

function string(value, limit) {
  return typeof value === 'string' ? value.slice(0, limit) : '';
}

function normalizeVoice(voice) {
  const labels = voice?.labels && typeof voice.labels === 'object' ? voice.labels : {};
  const id = string(voice?.voice_id, 100);
  if (!/^[A-Za-z0-9_-]{8,100}$/.test(id)) return null;
  return {
    id: 'elevenlabs:' + id,
    voiceId: id,
    name: string(voice?.name, 100),
    category: string(voice?.category, 30),
    gender: string(labels.gender, 30).toLowerCase(),
    accent: string(labels.accent, 50).toLowerCase(),
    language: string(labels.language, 50).toLowerCase(),
    description: string(labels.description, 240),
    useCase: string(labels.use_case, 80),
  };
}

export async function readBoundedVoiceCatalogJson(response, maxBytes = VOICE_CATALOG_MAX_BYTES) {
  if (!response.ok) throw new Error('voice_catalog_provider_unavailable');
  const declared = response.headers.get('content-length');
  if (declared !== null && (!/^\d+$/.test(declared) || Number(declared) > maxBytes)) {
    throw new Error('voice_catalog_too_large');
  }
  const reader = response.body?.getReader?.();
  if (!reader) throw new Error('voice_catalog_no_stream');
  const chunks = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!(value instanceof Uint8Array)) throw new Error('voice_catalog_invalid_chunk');
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel().catch(() => {});
        throw new Error('voice_catalog_too_large');
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const joined = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    joined.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(joined));
}

function normalizeCatalog(body) {
  const voices = (Array.isArray(body?.voices) ? body.voices : [])
    .slice(0, 500)
    .map(normalizeVoice)
    .filter(Boolean)
    .filter((v) => v.category === 'premade' || v.category === 'generated')
    .sort((a, b) => {
      const female = Number(b.gender === 'female') - Number(a.gender === 'female');
      return female || a.name.localeCompare(b.name);
    })
    .slice(0, VOICE_CATALOG_MAX_ENTRIES);
  return { discovery: voices.length ? 'default_or_owned' : 'none', voices };
}

/** Per-instance cache; never expose provider keys or mix caches across key rotations. */
export function createVoiceCatalogLoader({
  fetcher = fetch,
  ttlMs = VOICE_CATALOG_TTL_MS,
  staleMs = VOICE_CATALOG_STALE_MS,
  now = () => Date.now(),
} = {}) {
  let cache = null;
  let expires = 0;
  let fetchedAt = 0;
  let fingerprint = '';
  let inflight = null;

  return async function getVoiceCatalog(key) {
    if (!key) return { discovery: 'not_configured', voices: [] };
    const nextFingerprint = createHash('sha256').update(key).digest('hex');
    if (fingerprint !== nextFingerprint) {
      cache = null;
      expires = 0;
      fetchedAt = 0;
      inflight = null;
      fingerprint = nextFingerprint;
    }
    const current = now();
    if (cache && current < expires) return cache;
    if (inflight) return inflight;
    const requestFingerprint = fingerprint;
    const work = (async () => {
      try {
        const response = await fetcher('https://api.elevenlabs.io/v1/voices', {
          headers: { 'xi-api-key': key },
          signal: AbortSignal.timeout(8_000),
        });
        const result = normalizeCatalog(await readBoundedVoiceCatalogJson(response));
        if (fingerprint === requestFingerprint) {
          cache = result;
          fetchedAt = now();
          expires = fetchedAt + ttlMs;
        }
        return result;
      } catch {
        if (fingerprint === requestFingerprint && cache && now() - fetchedAt < staleMs) {
          return { ...cache, discovery: 'stale' };
        }
        return { discovery: 'unavailable', voices: [] };
      }
    })();
    inflight = work;
    try {
      return await work;
    } finally {
      if (inflight === work) inflight = null;
    }
  };
}

export const loadVoiceCatalog = createVoiceCatalogLoader();
