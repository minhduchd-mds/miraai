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

const selection = await importTypeScript('src/core/vision/accelerator-selection.ts');

test('v15.3 provider candidates prefer WebGPU but preserve WebNN and WASM fallbacks', () => {
  assert.deepEqual(
    selection.acceleratorCandidates({ webgpu: true, webnn: true }),
    ['webgpu', 'webnn-npu', 'webnn-gpu', 'wasm'],
  );
  assert.deepEqual(
    selection.acceleratorCandidates({ webgpu: false, webnn: false }),
    ['wasm'],
  );
});

test('v15.3 benchmark summary exposes p50/p95 without treating failures as zero latency', () => {
  const summary = selection.summarizeAcceleratorBenchmark('webgpu', [
    { provider: 'webgpu', loadMs: 20, preprocessMs: 2, inferenceMs: 10, endToEndMs: 12, ok: true },
    { provider: 'webgpu', loadMs: 20, preprocessMs: 3, inferenceMs: 20, endToEndMs: 23, ok: true },
    { provider: 'webgpu', loadMs: 20, preprocessMs: 0, inferenceMs: 0, endToEndMs: 0, ok: false, error: 'lost device' },
  ]);
  assert.equal(summary.successes, 2);
  assert.equal(summary.failures, 1);
  assert.equal(summary.p50InferenceMs, 10);
  assert.equal(summary.p95InferenceMs, 20);
  assert.equal(summary.p95EndToEndMs, 23);
});

test('v15.3 automatic provider choice uses measured end-to-end tail latency', () => {
  const selected = selection.chooseMeasuredAccelerator([
    {
      provider: 'webgpu', supported: true, successes: 3, failures: 0,
      p50InferenceMs: 7, p95InferenceMs: 13, p50EndToEndMs: 14, p95EndToEndMs: 24,
    },
    {
      provider: 'webnn-npu', supported: true, successes: 3, failures: 0,
      p50InferenceMs: 8, p95InferenceMs: 11, p50EndToEndMs: 12, p95EndToEndMs: 18,
    },
    {
      provider: 'wasm', supported: true, successes: 3, failures: 0,
      p50InferenceMs: 25, p95InferenceMs: 31, p50EndToEndMs: 29, p95EndToEndMs: 36,
    },
  ]);
  assert.equal(selected, 'webnn-npu');
});

test('v15.3 never selects an unstable provider solely because one sample was fast', () => {
  const selected = selection.chooseMeasuredAccelerator([
    {
      provider: 'webgpu', supported: true, successes: 1, failures: 2,
      p50InferenceMs: 3, p95InferenceMs: 3, p50EndToEndMs: 5, p95EndToEndMs: 5,
    },
    {
      provider: 'wasm', supported: true, successes: 3, failures: 0,
      p50InferenceMs: 30, p95InferenceMs: 35, p50EndToEndMs: 34, p95EndToEndMs: 39,
    },
  ]);
  assert.equal(selected, 'wasm');
});
