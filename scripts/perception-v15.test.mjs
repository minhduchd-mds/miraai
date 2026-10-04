import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';

async function importTypeScript(path) {
  const source = readFileSync(path, 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
    fileName: path,
  }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(output).toString('base64')}`);
}

const runtime = await importTypeScript('src/core/vision/perception-runtime.ts');
const identity = await importTypeScript('src/core/vision/object-identity-hypothesis.ts');
const recorded = await importTypeScript('src/core/vision/recorded-benchmark.ts');

const caps = {
  webgpu: true,
  webnn: true,
  webnnNpu: true,
  webnnGpu: true,
  wasm: true,
  worker: true,
  crossOriginIsolated: true,
};

test('v15.1 keeps MediaPipe Holistic as the production path', () => {
  const plan = runtime.buildPerceptionRuntimePlan(caps, { task: 'holistic', allowExperimental: false });
  assert.equal(plan.selected, 'mediapipe-gpu');
  assert.deepEqual(plan.candidates.slice(0, 2).map((item) => item.id), ['mediapipe-gpu', 'mediapipe-cpu']);
  assert.equal(plan.candidates.some((item) => item.maturity === 'experimental'), false);
});

test('v15.1 exposes accelerated experimental providers without silently activating them', () => {
  const plan = runtime.buildPerceptionRuntimePlan(caps, { task: 'segmentation', allowExperimental: true });
  assert.deepEqual(plan.candidates.slice(0, 4).map((item) => item.id), [
    'webnn-npu', 'webgpu', 'webnn-gpu', 'wasm',
  ]);
  assert.equal(plan.selected, 'webnn-npu');
});

test('provider health circuit skips a cooling provider and recovers after success', () => {
  const registry = new runtime.PerceptionProviderHealthRegistry();
  const plan = runtime.buildPerceptionRuntimePlan(caps, { task: 'segmentation', allowExperimental: true });
  registry.noteFailure('webnn-npu', new Error('npu init failed'), 1000, 1, 30_000);
  assert.equal(registry.choose(plan, 1500)?.id, 'webgpu');
  registry.noteSuccess('webnn-npu');
  assert.equal(registry.choose(plan, 2000)?.id, 'webnn-npu');
});

test('identity hypothesis accepts a near detector-id switch with geometric continuity', () => {
  const result = identity.evaluateObjectIdentityHypothesis({
    sameLabel: true,
    previousBox: { x: 0.4, y: 0.4, width: 0.16, height: 0.2 },
    currentBox: { x: 0.415, y: 0.405, width: 0.16, height: 0.2 },
    ageMs: 250,
    sceneContinuity: true,
    uniqueCandidate: true,
  });
  assert.equal(result.decision, 'accept');
  assert.ok(result.score > 0.7);
  assert.ok(result.evidence.includes('near_position'));
});

test('identity hypothesis refuses to resolve an ambiguous far same-label match', () => {
  const result = identity.evaluateObjectIdentityHypothesis({
    sameLabel: true,
    previousBox: { x: 0.2, y: 0.4, width: 0.16, height: 0.2 },
    currentBox: { x: 0.72, y: 0.4, width: 0.16, height: 0.2 },
    ageMs: 900,
    sceneContinuity: true,
    uniqueCandidate: false,
  });
  assert.equal(result.decision, 'ambiguous');
});

test('identity hypothesis can use mask and appearance evidence without requiring them', () => {
  const base = {
    sameLabel: true,
    previousBox: { x: 0.2, y: 0.4, width: 0.16, height: 0.2 },
    currentBox: { x: 0.58, y: 0.4, width: 0.16, height: 0.2 },
    ageMs: 900,
    sceneContinuity: true,
    uniqueCandidate: true,
  };
  const geometryOnly = identity.evaluateObjectIdentityHypothesis(base);
  const enriched = identity.evaluateObjectIdentityHypothesis({
    ...base,
    appearanceSimilarity: 0.94,
    maskIoU: 0.88,
  });
  assert.ok(enriched.score > geometryOnly.score);
  assert.equal(enriched.decision, 'accept');
});

test('recorded benchmark metrics count duplicate events correctly', () => {
  const metrics = recorded.compareEventSets(
    ['pinch_down', 'pinch_up', 'point_hold'],
    ['pinch_down', 'pinch_up', 'point_hold', 'point_hold'],
  );
  assert.equal(metrics.tp, 3);
  assert.equal(metrics.fp, 1);
  assert.equal(metrics.fn, 0);
  assert.ok(metrics.f1 < 1);
});

test('recorded benchmark latency exposes percentile tails', () => {
  const latency = recorded.summarizeLatency([10, 11, 12, 13, 14, 15, 20, 30, 40, 80]);
  assert.equal(latency.count, 10);
  assert.ok(latency.p95Ms >= latency.p50Ms);
  assert.ok(latency.p99Ms >= latency.p95Ms);
  assert.equal(latency.maxMs, 80);
});
