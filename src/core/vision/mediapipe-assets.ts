// MediaPipe assets: same-origin first (copied/fetched at build by scripts/vision-assets.mjs),
// then the public CDNs. Experiment E8 (24/10/2026): when cdn.jsdelivr.net or
// storage.googleapis.com is blocked, the camera ran but emotion reading silently died.

export const MEDIAPIPE_VERSION = '0.10.35';
export const CDN_WASM = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_VERSION}/wasm`;

export type VisionModelName = 'holistic' | 'face' | 'gesture' | 'pose' | 'object';

interface VisionManifest {
  version: string;
  wasm: boolean;
  models: Partial<Record<VisionModelName, string>>;
}

export interface VisionAssetCandidate { wasm: string; model: string; source: 'self-hosted' | 'mixed' | 'cdn' }

const base = () => `${(import.meta as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? '/'}mediapipe/`;
let manifestPromise: Promise<VisionManifest | null> | null = null;
let lastSource: VisionAssetCandidate['source'] | null = null;

function absolute(path: string): string {
  try { return new URL(path, window.location.href).href.replace(/\/$/, ''); } catch { return path; }
}

export function loadVisionManifest(fetcher: typeof fetch = fetch): Promise<VisionManifest | null> {
  if (!manifestPromise) {
    manifestPromise = fetcher(`${base()}manifest.json`, { cache: 'no-cache' })
      .then((r) => (r.ok ? r.json() as Promise<VisionManifest> : null))
      .then((m) => (m && m.version === MEDIAPIPE_VERSION ? m : null))
      .catch(() => null);
  }
  return manifestPromise;
}

/** Ordered candidates: self-hosted wasm + model, self-hosted wasm + CDN model, then all-CDN. */
export function visionAssetCandidates(manifest: VisionManifest | null, model: VisionModelName, cdnModel: string, root = absolute(base())): VisionAssetCandidate[] {
  const out: VisionAssetCandidate[] = [];
  if (manifest?.wasm) {
    const local = manifest.models[model];
    out.push(local
      ? { wasm: `${root}/wasm`, model: `${root}/${local}`, source: 'self-hosted' }
      : { wasm: `${root}/wasm`, model: cdnModel, source: 'mixed' });
  }
  out.push({ wasm: CDN_WASM, model: cdnModel, source: 'cdn' });
  return out;
}

export async function createWithVisionAssets<T>(
  model: VisionModelName,
  cdnModel: string,
  build: (wasmBase: string, modelAssetPath: string) => Promise<T>,
): Promise<T> {
  const candidates = visionAssetCandidates(await loadVisionManifest(), model, cdnModel);
  let lastError: unknown = new Error('no vision asset candidates');
  for (const candidate of candidates) {
    try {
      const created = await build(candidate.wasm, candidate.model);
      lastSource = candidate.source;
      return created;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

/** Where the last successful tracker loaded from (diagnostics only). */
export function visionAssetSource(): VisionAssetCandidate['source'] | null { return lastSource; }
