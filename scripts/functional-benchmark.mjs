import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
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
const visionPerformance = await importTypeScript('src/core/vision/vision-performance.ts');
const worldModel = await importTypeScript('src/core/vision/world-model.ts');
const actionSequence = await importTypeScript('src/core/vision/action-sequence.ts');
const spatialPhysics = await importTypeScript('src/core/vision/spatial-physics.ts');
const timing = await importTypeScript('src/runtime/conversation-timing.ts');

function clamp01(value) {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

function actionGraph(nodes, events, now) {
  return {
    nodes,
    relations: [],
    focus: null,
    pointerActive: false,
    peopleCount: 0,
    events,
    updatedAt: now,
  };
}

function actionNode(id, label, x, y, score = 0.9) {
  const box = { x, y, width: 0.16, height: 0.2 };
  return {
    id,
    label,
    score,
    box,
    centerX: x + 0.08,
    centerY: y + 0.1,
    kind: 'object',
  };
}

function percentile(values, p) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[index];
}

function timed(label, iterations, fn) {
  const samples = [];
  for (let i = 0; i < iterations; i += 1) {
    const started = performance.now();
    fn(i);
    samples.push(performance.now() - started);
  }
  const totalMs = samples.reduce((sum, value) => sum + value, 0);
  return {
    label,
    iterations,
    totalMs: Number(totalMs.toFixed(3)),
    meanMs: Number((totalMs / Math.max(1, iterations)).toFixed(6)),
    p50Ms: Number(percentile(samples, 50).toFixed(6)),
    p95Ms: Number(percentile(samples, 95).toFixed(6)),
    p99Ms: Number(percentile(samples, 99).toFixed(6)),
    opsPerSecond: Number((iterations / Math.max(0.001, totalMs / 1000)).toFixed(1)),
  };
}

function f1(tp, fp, fn) {
  const precision = tp + fp ? tp / (tp + fp) : 1;
  const recall = tp + fn ? tp / (tp + fn) : 1;
  const score = precision + recall ? (2 * precision * recall) / (precision + recall) : 0;
  return {
    tp,
    fp,
    fn,
    precision: Number(precision.toFixed(4)),
    recall: Number(recall.toFixed(4)),
    f1: Number(score.toFixed(4)),
  };
}

function runGestureCase({ name, expected, samples }) {
  const tracker = new gestureIntent.GestureIntentTracker();
  const emitted = [];
  for (const sample of samples) {
    const state = tracker.update(sample.value, sample.at);
    if (state.intent !== 'none') emitted.push(state.intent);
  }
  const matched = expected === null
    ? emitted.length === 0
    : emitted.includes(expected) && emitted.filter((value) => value === expected).length === 1;
  return { name, expected, emitted, matched };
}

function holdSamples(gesture, score, startAt, stepMs, count) {
  return Array.from({ length: count }, (_, index) => ({
    at: startAt + index * stepMs,
    value: { gesture, score, pinching: false, wave: false },
  }));
}

const gestureCases = [
  { name: 'victory stable hold', expected: 'victory_hold', samples: holdSamples('Victory', 0.9, 1000, 100, 6) },
  { name: 'open palm stable hold', expected: 'open_palm_hold', samples: holdSamples('Open_Palm', 0.9, 2000, 100, 8) },
  { name: 'closed fist stable hold', expected: 'fist_hold', samples: holdSamples('Closed_Fist', 0.9, 3000, 100, 6) },
  { name: 'point stable hold', expected: 'point_hold', samples: holdSamples('Pointing_Up', 0.9, 4000, 100, 5) },
  { name: 'thumb up stable hold', expected: 'thumb_up_hold', samples: holdSamples('Thumb_Up', 0.9, 5000, 100, 6) },
  {
    name: 'alternating high-confidence noise',
    expected: null,
    samples: Array.from({ length: 16 }, (_, index) => ({
      at: 6000 + index * 90,
      value: {
        gesture: index % 2 ? 'Victory' : 'Open_Palm',
        score: 0.92,
        pinching: false,
        wave: false,
      },
    })),
  },
  {
    name: 'low-confidence persistent false gesture',
    expected: null,
    samples: Array.from({ length: 20 }, (_, index) => ({
      at: 8000 + index * 100,
      value: { gesture: 'Pointing_Up', score: 0.42, pinching: false, wave: false },
    })),
  },
];

const gestureResults = gestureCases.map(runGestureCase);
let gestureTp = 0;
let gestureFp = 0;
let gestureFn = 0;
for (const result of gestureResults) {
  if (result.expected === null) {
    if (result.emitted.length) gestureFp += 1;
  } else if (result.matched) {
    gestureTp += 1;
  } else {
    gestureFn += 1;
  }
}
const gestureMetrics = f1(gestureTp, gestureFp, gestureFn);

const pinchTracker = new gestureIntent.GestureIntentTracker();
const pinchEvents = [
  pinchTracker.update({ gesture: 'Pointing_Up', score: 0.82, pinching: false }, 10_000),
  pinchTracker.update({ gesture: 'Pointing_Up', score: 0.82, pinching: true }, 10_300),
  pinchTracker.update({ gesture: 'Pointing_Up', score: 0.82, pinching: true }, 10_420),
  pinchTracker.update({ gesture: 'Pointing_Up', score: 0.82, pinching: false }, 10_580),
].map((state) => state.intent).filter((intent) => intent !== 'none');

assert.deepEqual(pinchEvents, ['pinch_down', 'pinch_up']);
assert.equal(gestureMetrics.precision, 1);
assert.equal(gestureMetrics.recall, 1);

function benchmarkWorldModel() {
  const permanence = new worldModel.ShortTermWorldModelTracker();
  const cup = actionNode('world-cup-a', 'cup', 0.4, 0.4, 0.92);
  let state = permanence.update(actionGraph([cup], [], 1000), null, 1000);
  const worldId = state.objects[0].id;
  state = permanence.update(actionGraph([], [
    { id: 'world-left', type: 'object_left', label: 'cup', at: 2200 },
  ], 2200), null, 2200);
  const missingConfidence = state.objects[0].confidence;
  const decayed = permanence.update(actionGraph([], [], 9000), null, 9000);
  const expired = permanence.update(actionGraph([], [], 32_500), null, 32_500);

  const relocation = new worldModel.ShortTermWorldModelTracker();
  const before = actionNode('world-book-a', 'book', 0.25, 0.4, 0.91);
  let relocated = relocation.update(actionGraph([before], [], 1000), null, 1000);
  const relocationWorldId = relocated.objects[0].id;
  relocation.update(actionGraph([], [
    { id: 'book-left', type: 'object_left', label: 'book', at: 2200 },
  ], 2200), null, 2200);
  const after = actionNode('world-book-b', 'book', 0.7, 0.4, 0.93);
  relocated = relocation.update(actionGraph([after], [
    { id: 'book-left', type: 'object_left', label: 'book', at: 2200 },
    { id: 'book-relocated', type: 'object_relocated', label: 'book', distance: 0.45, at: 3000 },
  ], 3000), null, 3000);

  const ambiguous = new worldModel.ShortTermWorldModelTracker();
  ambiguous.update(actionGraph([
    actionNode('cup-a', 'cup', 0.2, 0.4, 0.92),
    actionNode('cup-b', 'cup', 0.58, 0.4, 0.91),
  ], [], 1000), null, 1000);
  ambiguous.update(actionGraph([], [
    { id: 'cup-a-left', type: 'object_left', label: 'cup', at: 2200 },
    { id: 'cup-b-left', type: 'object_left', label: 'cup', at: 2200 },
  ], 2200), null, 2200);
  const ambiguousState = ambiguous.update(actionGraph([
    actionNode('cup-c', 'cup', 0.78, 0.4, 0.94),
  ], [
    { id: 'cup-a-left', type: 'object_left', label: 'cup', at: 2200 },
    { id: 'cup-b-left', type: 'object_left', label: 'cup', at: 2200 },
    { id: 'cup-relocated', type: 'object_relocated', label: 'cup', distance: 0.4, at: 3000 },
  ], 3000), null, 3000);

  const checks = {
    permanenceKeepsId: decayed.objects[0]?.id === worldId,
    confidenceDecays: decayed.objects[0]?.confidence < missingConfidence && decayed.objects[0]?.confidence > 0.12,
    unresolvedExpires: expired.objects.length === 0 && expired.events.some((event) => event.type === 'expired'),
    relocationRebinds: relocated.objects.length === 1 &&
      relocated.objects[0].id === relocationWorldId &&
      relocated.objects[0].sourceObjectId === 'world-book-b' &&
      relocated.objects[0].status === 'relocated',
    ambiguousFarRebindSuppressed: !ambiguousState.events.some((event) =>
      event.type === 'identity_rebind' && event.worldObjectId === ambiguousState.objects.find((item) => item.sourceObjectId === 'cup-c')?.id
    ),
  };
  for (const [name, passed] of Object.entries(checks)) assert.equal(passed, true, `world model gate failed: ${name}`);
  return checks;
}

function benchmarkActionSequence() {
  const positive = new actionSequence.ActionSequenceTracker();
  const cup = actionNode('cup-1', 'cup', 0.4, 0.4);
  positive.update(actionGraph([cup], [], 1000), [{
    handedness: 'Right', x: 0.18, y: 0.5, pinching: false, gesture: 'Open_Palm', score: 0.72,
  }], 1000);
  let state = positive.update(actionGraph([cup], [], 1400), [{
    handedness: 'Right', x: 0.39, y: 0.5, pinching: true, gesture: 'None', score: 0.7,
  }], 1400);
  positive.update(actionGraph([], [
    { id: 'positive-left', type: 'object_left', label: 'cup', at: 1700 },
  ], 1700), [], 1700);
  const moved = actionNode('cup-2', 'cup', 0.7, 0.4, 0.92);
  positive.update(actionGraph([moved], [
    { id: 'positive-left', type: 'object_left', label: 'cup', at: 1700 },
    { id: 'positive-relocated', type: 'object_relocated', label: 'cup', distance: 0.3, at: 2400 },
  ], 2400), [], 2400);
  state = positive.update(actionGraph([moved], [
    { id: 'positive-left', type: 'object_left', label: 'cup', at: 1700 },
    { id: 'positive-relocated', type: 'object_relocated', label: 'cup', distance: 0.3, at: 2400 },
  ], 2750), [], 2750);

  const shake = new actionSequence.ActionSequenceTracker();
  const cupA = actionNode('shake-cup', 'cup', 0.34, 0.4);
  const bookA = actionNode('shake-book', 'book', 0.62, 0.38);
  shake.update(actionGraph([cupA, bookA], [], 1000), [{
    handedness: 'Right', x: 0.1, y: 0.5, pinching: false, gesture: 'Open_Palm', score: 0.7,
  }], 1000);
  const shakeState = shake.update(actionGraph([
    actionNode('shake-cup', 'cup', 0.38, 0.4),
    actionNode('shake-book', 'book', 0.66, 0.38),
  ], [
    { id: 'shake-move', type: 'object_moved', label: 'cup', distance: 0.04, at: 1400 },
  ], 1400), [{
    handedness: 'Right', x: 0.37, y: 0.5, pinching: true, gesture: 'None', score: 0.75,
  }], 1400);

  const idSwitch = new actionSequence.ActionSequenceTracker();
  const oldCup = actionNode('old-cup', 'cup', 0.4, 0.4);
  idSwitch.update(actionGraph([oldCup], [], 1000), [{
    handedness: 'Right', x: 0.18, y: 0.5, pinching: false, gesture: 'Open_Palm', score: 0.7,
  }], 1000);
  idSwitch.update(actionGraph([oldCup], [], 1400), [{
    handedness: 'Right', x: 0.39, y: 0.5, pinching: true, gesture: 'None', score: 0.7,
  }], 1400);
  const reboundState = idSwitch.update(actionGraph([
    actionNode('new-cup-id', 'cup', 0.415, 0.405, 0.91),
  ], [
    { id: 'id-left', type: 'object_left', label: 'cup', at: 1650 },
    { id: 'id-return', type: 'object_returned', label: 'cup', distance: 0.02, at: 1650 },
  ], 1650), [], 1650);

  const checks = {
    positiveSequenceDetected: state.stage === 'possible_reposition_sequence',
    positiveConfidenceUseful: state.confidence >= 0.35,
    coherentCameraMotionBlocked: shakeState.stage === 'idle' && shakeState.cameraStable === false,
    detectorIdSwitchDoesNotInventOcclusion: reboundState.stage === 'hand_approach' &&
      reboundState.identityRebound === true &&
      reboundState.objectId === 'new-cup-id',
  };
  for (const [name, passed] of Object.entries(checks)) assert.equal(passed, true, `action sequence gate failed: ${name}`);
  return checks;
}

function benchmarkVisionGovernor() {
  const governor = new visionPerformance.VisionPerformanceGovernor('holistic', 'GPU', 'high');
  const base = governor.snapshot().intervalMs;
  governor.noteFrame(100, 84, 553);
  const loaded = governor.snapshot();
  let now = 240;
  for (let i = 0; i < 24; i += 1) {
    governor.noteFrame(now, 16, 553);
    now += 45;
  }
  const recovered = governor.snapshot();
  const checks = {
    backsOffUnderLoad: loaded.intervalMs > base,
    recoversWithoutOvershoot: recovered.intervalMs < loaded.intervalMs && recovered.intervalMs >= base,
    telemetryFinite: [
      recovered.inferenceMs,
      recovered.intervalMs,
      recovered.fps,
      recovered.landmarkCount,
      recovered.postprocessMs,
    ].every(Number.isFinite),
    hiddenTabThrottled: governor.shouldProcess(now + 50, true) === false,
  };
  for (const [name, passed] of Object.entries(checks)) assert.equal(passed, true, `vision governor gate failed: ${name}`);
  return { baseIntervalMs: base, loadedIntervalMs: loaded.intervalMs, recoveredIntervalMs: recovered.intervalMs, checks };
}

function benchmarkSpatialPhysics() {
  const runtime = new spatialPhysics.SpatialPhysicsRuntime();
  runtime.beginGrab('card', { x: 0, y: 0, z: 0 }, 1000);
  runtime.sampleGrab('card', { x: 0.12, y: 0, z: 0 }, 1100);
  runtime.sampleGrab('card', { x: 0.24, y: 0, z: 0 }, 1200);
  const release = runtime.release('card', 0, 1210);
  let pose = {
    position: { x: 0, y: 0, z: 0 },
    scale: 1,
    rotation: { x: 0, y: 0, z: 0 },
  };
  let state = runtime.snapshot('card');
  for (let i = 1; i <= 240; i += 1) {
    const step = runtime.step('card', pose, 1210 + i * 16);
    pose = step.pose;
    state = step.state;
    for (const value of Object.values(pose.position)) assert.equal(Number.isFinite(value), true);
    assert.ok(Math.abs(pose.position.x) <= 0.480001);
    assert.ok(Math.abs(pose.position.y) <= 0.480001);
    assert.ok(Math.abs(pose.position.z) <= 0.700001);
  }

  const collision = new spatialPhysics.SpatialPhysicsRuntime();
  collision.setVelocity('edge', { x: 1.8, y: 0, z: 0 }, 1000, true);
  const edge = collision.step('edge', {
    position: { x: 0.47, y: 0, z: 0 },
    scale: 1,
    rotation: { x: 0, y: 0, z: 0 },
  }, 1050);

  const checks = {
    throwDetected: release.mode === 'throw',
    inertiaSettles: state.settled === true && state.speed < 0.035,
    boundsPreserved: Math.abs(pose.position.x) <= 0.480001,
    edgeCollisionContained: edge.collided === true && Math.abs(edge.pose.position.x) <= 0.480001,
  };
  for (const [name, passed] of Object.entries(checks)) assert.equal(passed, true, `spatial physics gate failed: ${name}`);
  return { releaseSpeed: release.speed, finalSpeed: state.speed, finalPosition: pose.position, checks };
}

function benchmarkConversationTiming() {
  const fast = timing.planConversationTiming({
    input: 'Phân tích kiến trúc API và backend này giúp anh',
    source: 'voice',
    turnIndex: 1,
    previousLatencyMs: 520,
  });
  const slow = timing.planConversationTiming({
    input: 'Phân tích kiến trúc API và backend này giúp anh',
    source: 'voice',
    turnIndex: 2,
    previousLatencyMs: 3400,
  });
  const interrupted = timing.planConversationTiming({
    input: 'Phân tích kiến trúc API và backend này giúp anh',
    source: 'voice',
    turnIndex: 3,
    previousLatencyMs: 1500,
    interrupted: true,
  });
  const normal = timing.planConversationTiming({
    input: 'Phân tích kiến trúc API và backend này giúp anh',
    source: 'voice',
    turnIndex: 3,
    previousLatencyMs: 1500,
  });
  const sensitive = timing.planConversationTiming({
    input: 'Hôm nay anh rất buồn và mệt',
    source: 'voice',
    turnIndex: 4,
    previousLatencyMs: 1500,
  });

  const checks = {
    slowBackendGetsEarlierBackchannel: slow.audibleCueDelayMs < fast.audibleCueDelayMs,
    interruptionGetsMoreFloorTime: interrupted.audibleCueDelayMs > normal.audibleCueDelayMs,
    sensitiveTurnStaysQuiet: sensitive.audibleCue === null,
    questionReopensMicFaster: timing.resumeListeningDelayMs('Anh muốn em làm tiếp phần nào?') <
      timing.resumeListeningDelayMs('Em đã kiểm tra xong toàn bộ phần này và hiện chưa có cảnh báo nghiêm trọng nào.'),
    bargeInRecoveryBounded: timing.interruptionRecoveryDelayMs() <= 180,
  };
  for (const [name, passed] of Object.entries(checks)) assert.equal(passed, true, `conversation timing gate failed: ${name}`);
  return {
    fastCueDelayMs: fast.audibleCueDelayMs,
    slowCueDelayMs: slow.audibleCueDelayMs,
    interruptedCueDelayMs: interrupted.audibleCueDelayMs,
    checks,
  };
}

const worldChecks = benchmarkWorldModel();
const actionChecks = benchmarkActionSequence();
const visionGovernor = benchmarkVisionGovernor();
const physics = benchmarkSpatialPhysics();
const conversation = benchmarkConversationTiming();

const perfGestureTracker = new gestureIntent.GestureIntentTracker();
const perfPhysics = new spatialPhysics.SpatialPhysicsRuntime();
perfPhysics.setVelocity('perf', { x: 0.8, y: 0.1, z: 0 }, 1000, true);
let perfPose = {
  position: { x: 0, y: 0, z: 0 },
  scale: 1,
  rotation: { x: 0, y: 0, z: 0 },
};

const telemetry = [
  timed('gesture-intent-update', 20_000, (i) => {
    perfGestureTracker.update({
      gesture: i % 9 < 6 ? 'Pointing_Up' : 'None',
      score: i % 7 ? 0.82 : 0.44,
      pinching: false,
      wave: false,
    }, 20_000 + i * 17);
  }),
  timed('spatial-physics-step', 20_000, (i) => {
    const step = perfPhysics.step('perf', perfPose, 1016 + i * 16);
    perfPose = step.pose;
    if (!perfPhysics.isActive('perf')) perfPhysics.setVelocity('perf', { x: 0.8, y: 0.1, z: 0 }, 1016 + i * 16, true);
  }),
  timed('conversation-timing-plan', 10_000, (i) => {
    timing.planConversationTiming({
      input: i % 2
        ? 'Kiểm tra kiến trúc runtime và benchmark giúp anh'
        : 'Đánh giá luồng này và cho phương án tối ưu',
      source: 'voice',
      turnIndex: i,
      previousLatencyMs: 400 + (i % 30) * 100,
      interrupted: i % 17 === 0,
    });
  }),
];

for (const item of telemetry) {
  assert.equal(Number.isFinite(item.meanMs), true);
  assert.equal(Number.isFinite(item.p95Ms), true);
  assert.ok(item.opsPerSecond > 0);
}

const report = {
  schema: 'mira.functional-benchmark.v1',
  generatedAt: new Date().toISOString(),
  methodology: {
    correctness: 'deterministic synthetic contract scenarios; hard CI gate',
    performance: 'local wall-clock telemetry only; never a hard cross-runner speed gate',
    limitation: 'does not claim real-camera precision/recall; dataset and device-lab validation remain separate',
  },
  gesture: {
    metrics: gestureMetrics,
    cases: gestureResults,
    pinchEvents,
  },
  worldModel: worldChecks,
  actionSequence: actionChecks,
  visionGovernor,
  spatialPhysics: physics,
  conversationTiming: conversation,
  telemetry,
  status: 'PASS',
};

console.log(JSON.stringify(report, null, 2));
