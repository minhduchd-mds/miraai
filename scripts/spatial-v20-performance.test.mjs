import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
import { readFileSync } from 'node:fs';

async function load(path) {
  const content = readFileSync(path, 'utf8');
  const js = ts.transpileModule(content, {
    fileName: path, compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  return import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'));
}

const { VisionVideoFrameGate } = await load('src/core/vision/vision-frame-gate.ts');
const { SpatialHandFrameCache } = await load('src/core/vision/spatial-hand-frame-cache.ts');

test('v20: RVFC decodes a presented camera frame at most once', () => {
  const gate = new VisionVideoFrameGate();
  assert.equal(gate.accept({ presentedFrames: 12, mediaTime: 1 }), true);
  assert.equal(gate.accept({ presentedFrames: 12, mediaTime: 1 }), false);
  assert.equal(gate.accept({ presentedFrames: 11, mediaTime: 0.9 }), false);
  assert.equal(gate.accept({ presentedFrames: 13, mediaTime: 1.04 }), true);
  gate.reset();
  assert.equal(gate.accept({ presentedFrames: 1 }), true);
});

test('v20: animation-frame fallback rejects repeated and reversed timestamps', () => {
  const gate = new VisionVideoFrameGate();
  assert.equal(gate.accept(undefined, 1.5), true);
  assert.equal(gate.accept(undefined, 1.5), false);
  assert.equal(gate.accept(undefined, 1.4), false);
  assert.equal(gate.accept(undefined, 1.54), true);
  assert.equal(gate.accept({ mediaTime: 1.56 }, 1.54), true);
  assert.equal(gate.accept({ mediaTime: 1.56 }, 1.54), false);
  gate.reset();
  assert.equal(gate.accept(undefined, 1.5), true);
  assert.equal(gate.accept(undefined, 0), true); // Unknown clock must not freeze input.
});

test('v20: repeated UI polls never re-run hand motion on the same frame', () => {
  const cache = new SpatialHandFrameCache();
  let builds = 0;
  let drops = 0;
  const build = at => { builds += 1; return [{ frameAt: at, velocity: builds }]; };
  const first = cache.read(100, build, () => { drops += 1; });
  assert.strictEqual(cache.read(100, build), first);
  assert.strictEqual(cache.read(100, build), first);
  assert.equal(builds, 1);
  assert.equal(cache.read(120, build)[0].velocity, 2);
  assert.equal(builds, 2);
  assert.deepEqual(cache.read(0, build, () => { drops += 1; }), []);
  assert.equal(drops, 1);
  cache.read(0, build, () => { drops += 1; });
  assert.equal(drops, 1);
  assert.equal(cache.read(140, build)[0].velocity, 3);
  cache.reset();
  assert.equal(cache.read(140, build)[0].velocity, 4);
  assert.deepEqual(cache.read(NaN, build), []);
});

test('v20: integration keeps v19 freshness and private hidden-tab behavior', () => {
  const runtime = readFileSync('src/presence/vision-runtime.ts', 'utf8');
  const tracker = readFileSync('src/core/vision/holistic-tracker.ts', 'utf8');
  assert.match(runtime, /handFrameCache\.read\(/);
  assert.match(runtime, /handFresh \? handData\.lastFrameAt : 0/);
  assert.match(runtime, /function buildHandSnapshot\(frameAt: number\)/);
  assert.match(runtime, /}, frameAt\);/);
  assert.match(runtime, /handFrameCache\.reset\(\)/);
  assert.match(runtime, /now - handData\.lastFrameAt <= 350/);
  assert.match(tracker, /frameGate\.accept\(metadata, video\.currentTime\)/);
  assert.match(tracker, /document\.hidden/);
  assert.match(tracker, /frameGate\.reset\(\)/);
});
