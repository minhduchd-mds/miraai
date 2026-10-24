import test from 'node:test';
import assert from 'node:assert/strict';
import { looksLikeModel, MODELS } from './vision-assets.mjs';
import { visionAssetCandidates, CDN_WASM } from '../src/core/vision/mediapipe-assets.ts';

test('E8: model format check accepts .task zips and TFL3 flatbuffers only', () => {
  const big = (head) => { const b = new Uint8Array(200_000); b.set(head); return b; };
  assert.equal(looksLikeModel('x.task', big([0x50, 0x4b, 3, 4])), true);
  assert.equal(looksLikeModel('x.task', big([0, 0, 0x50, 0x4b, 3, 4])), true, 'real face_landmarker.task header');
  assert.equal(looksLikeModel('x.task', big([0, 0, 0, 0, 0x50, 0x4b, 3, 4])), true, 'real holistic_landmarker.task header');
  assert.equal(looksLikeModel('x.task', big([0x3c, 0x68])), false, 'an HTML error page is rejected');
  assert.equal(looksLikeModel('x.tflite', big([0, 0, 0, 0, 0x54, 0x46, 0x4c, 0x33])), true);
  assert.equal(looksLikeModel('x.task', new Uint8Array(10)), false);
  assert.equal(Object.keys(MODELS).length, 5);
});

test('E8: runtime tries self-hosted, then self-hosted wasm + CDN model, then the CDN', () => {
  const root = 'https://mira.example/mediapipe';
  assert.deepEqual(visionAssetCandidates(null, 'face', 'cdn://face.task', root).map((c) => c.source), ['cdn']);
  const partial = visionAssetCandidates({ version: '0.10.35', wasm: true, models: {} }, 'face', 'cdn://face.task', root);
  assert.deepEqual(partial.map((c) => [c.source, c.wasm, c.model]), [['mixed', `${root}/wasm`, 'cdn://face.task'], ['cdn', CDN_WASM, 'cdn://face.task']]);
  const full = visionAssetCandidates({ version: '0.10.35', wasm: true, models: { face: 'models/face_landmarker.task' } }, 'face', 'cdn://face.task', root);
  assert.equal(full[0].source, 'self-hosted');
  assert.equal(full[0].model, `${root}/models/face_landmarker.task`);
});
