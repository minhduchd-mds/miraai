// E8 — self-host MediaPipe so camera emotion reading survives a blocked CDN.
// Copies the tasks-vision wasm (SIMD + non-SIMD) from node_modules into dist/mediapipe/wasm and,
// when the build machine has internet (Vercel), fetches the .task/.tflite models into
// dist/mediapipe/models with a format check. The runtime (src/core/vision/mediapipe-assets.ts)
// reads dist/mediapipe/manifest.json and falls back to the CDNs for anything missing.
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const DIST = 'dist';
const OUT = join(DIST, 'mediapipe');
const PKG = 'node_modules/@mediapipe/tasks-vision';
const version = JSON.parse(readFileSync(join(PKG, 'package.json'), 'utf8')).version;
const WASM = ['vision_wasm_internal.js', 'vision_wasm_internal.wasm', 'vision_wasm_nosimd_internal.js', 'vision_wasm_nosimd_internal.wasm'];
export const MODELS = {
  holistic: 'https://storage.googleapis.com/mediapipe-models/holistic_landmarker/holistic_landmarker/float16/1/holistic_landmarker.task',
  face: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
  gesture: 'https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task',
  pose: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
  object: 'https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite0/int8/1/efficientdet_lite0.tflite',
};

/** .task bundles are zip files; .tflite files carry the "TFL3" flatbuffer identifier at byte 4. */
export function looksLikeModel(name, bytes) {
  if (bytes.length < 100_000) return false;
  if (name.endsWith('.task')) return bytes[0] === 0x50 && bytes[1] === 0x4b;
  if (name.endsWith('.tflite')) return Buffer.from(bytes.subarray(4, 8)).toString('ascii') === 'TFL3';
  return false;
}

async function main() {
  if (!existsSync(DIST)) throw new Error('run after vite build');
  mkdirSync(join(OUT, 'wasm'), { recursive: true });
  for (const f of WASM) copyFileSync(join(PKG, 'wasm', f), join(OUT, 'wasm', f));
  const manifest = { version, wasm: true, models: {}, fetchedAt: new Date().toISOString() };
  if (process.env.MIRA_VISION_FETCH !== '0') {
    mkdirSync(join(OUT, 'models'), { recursive: true });
    for (const [key, url] of Object.entries(MODELS)) {
      const file = url.split('/').pop();
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(25_000) });
        if (!res.ok) throw new Error(`http_${res.status}`);
        const bytes = new Uint8Array(await res.arrayBuffer());
        if (!looksLikeModel(file, bytes)) throw new Error(`unexpected_format ${bytes.length}B head=${Buffer.from(bytes.subarray(0, 8)).toString('hex')}`);
        writeFileSync(join(OUT, 'models', file), bytes);
        manifest.models[key] = `models/${file}`;
      } catch (error) {
        const why = `${key}: not self-hosted (${error?.message || error}); runtime uses the CDN.`;
        console.warn(`[vision-assets] ${why}`);
        if (process.env.GITHUB_ACTIONS) console.log(`::warning title=vision-assets::${why}`);
      }
    }
  }
  writeFileSync(join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 1));
  const size = (p) => statSync(p).size;
  const wasmMb = WASM.reduce((s, f) => s + size(join(OUT, 'wasm', f)), 0) / 1048576;
  const modelMb = Object.values(manifest.models).reduce((s, f) => s + size(join(OUT, f)), 0) / 1048576;
  console.log(`[vision-assets] tasks-vision ${version}: wasm ${wasmMb.toFixed(1)} MiB, models ${Object.keys(manifest.models).length}/5 (${modelMb.toFixed(1)} MiB)`);
}

if (import.meta.url === `file://${process.argv[1]}`) await main();
