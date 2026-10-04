import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

async function importTypeScript(path) {
  const source = readFileSync(path, 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
    fileName: path,
  }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(output).toString('base64')}`);
}

const gestureIntent = await importTypeScript('src/core/vision/gesture-intent.ts');
const identity = await importTypeScript('src/core/vision/object-identity-hypothesis.ts');
const recorded = await importTypeScript('src/core/vision/recorded-benchmark.ts');

const inputPath = process.argv[2] || 'benchmarks/camera-v1/trace.json';
const dataset = JSON.parse(readFileSync(inputPath, 'utf8'));

assert.equal(dataset.schema, 'mira.camera-trace.v1');
const reports = [];
let eventTp = 0;
let eventFp = 0;
let eventFn = 0;
let identityPass = 0;
let identityTotal = 0;

for (const scenario of dataset.scenarios || []) {
  if (scenario.kind === 'gesture') {
    const tracker = new gestureIntent.GestureIntentTracker();
    const predicted = [];
    for (const frame of scenario.frames || []) {
      const state = tracker.update({
        gesture: frame.gesture,
        score: frame.score,
        pinching: Boolean(frame.pinching),
        wave: Boolean(frame.wave),
      }, frame.at);
      if (state.intent !== 'none') predicted.push(state.intent);
    }
    const metrics = recorded.compareEventSets(scenario.expectedEvents || [], predicted);
    eventTp += metrics.tp;
    eventFp += metrics.fp;
    eventFn += metrics.fn;
    reports.push({ id: scenario.id, kind: scenario.kind, predicted, expected: scenario.expectedEvents || [], metrics });
    assert.deepEqual(predicted, scenario.expectedEvents || [], `camera trace mismatch: ${scenario.id}`);
  } else if (scenario.kind === 'identity') {
    identityTotal += 1;
    const result = identity.evaluateObjectIdentityHypothesis(scenario.input);
    const passed = result.decision === scenario.expectedDecision;
    if (passed) identityPass += 1;
    reports.push({
      id: scenario.id,
      kind: scenario.kind,
      expectedDecision: scenario.expectedDecision,
      decision: result.decision,
      score: result.score,
      evidence: result.evidence,
      passed,
    });
    assert.equal(result.decision, scenario.expectedDecision, `identity trace mismatch: ${scenario.id}`);
  }
}

const eventMetrics = recorded.summarizeConfusion(eventTp, eventFp, eventFn);
assert.equal(eventMetrics.precision, 1);
assert.equal(eventMetrics.recall, 1);

console.log(JSON.stringify({
  schema: 'mira.camera-trace-report.v1',
  datasetKind: dataset.datasetKind,
  disclaimer: dataset.disclaimer,
  scenarios: reports,
  eventMetrics,
  identity: {
    passed: identityPass,
    total: identityTotal,
    accuracy: identityTotal ? identityPass / identityTotal : 1,
  },
  status: 'PASS',
}, null, 2));
