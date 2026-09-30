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

const machine = await importTypeScript('src/runtime/conversation-machine.ts');
const speech = await importTypeScript('src/runtime/speech-utils.ts');
const timing = await importTypeScript('src/runtime/conversation-timing.ts');
const voice = await importTypeScript('src/core/voice-prefs.ts');
const viSpeech = await importTypeScript('src/core/tts/vi-normalize.ts');
const director = await importTypeScript('src/core/tts/vi-speech-director.ts');
const spatial = await importTypeScript('src/presence/spatial-math.ts');
const affect = await importTypeScript('src/intelligence/affect/mood-engine.ts');
const affectControl = await importTypeScript('src/intelligence/affect/affect-control.ts');
const proactive = await importTypeScript('src/intelligence/proactive/proactive-engine.ts');
const facialGesture = await importTypeScript('src/core/face/facial-gesture.ts');
const facs = await importTypeScript('src/core/face/facs-proxy.ts');
const realPresence = await importTypeScript('src/core/vision/real-presence.ts');
const microExpression = await importTypeScript('src/core/face/micro-expression.ts');
const postureModel = await importTypeScript('src/core/vision/posture-model.ts');
const rppgSignal = await importTypeScript('src/core/vision/rppg-signal.ts');
const interaction = await importTypeScript('src/intelligence/social/interaction-engine.ts');
const faceSocialControl = await importTypeScript('src/intelligence/social/face-social-control.ts');
const presenceContinuity = await importTypeScript('src/intelligence/social/presence-continuity.ts');
const behaviorTimeline = await importTypeScript('src/intelligence/social/behavior-timeline.ts');
const handGestureLite = await importTypeScript('src/core/vision/hand-gesture-lite.ts');
const visionPerformance = await importTypeScript('src/core/vision/vision-performance.ts');
const gazeCalibration = await importTypeScript('src/intelligence/social/gaze-head-calibration.ts');
const gestureIntent = await importTypeScript('src/core/vision/gesture-intent.ts');
const environmentModel = await importTypeScript('src/core/vision/environment-model.ts');
const spatialSceneGraph = await importTypeScript('src/core/vision/spatial-scene-graph.ts');
const deicticVision = await importTypeScript('src/intelligence/vision/deictic-vision.ts');
const faceFrameGuard = await importTypeScript('src/core/vision/face-frame-guard.ts');
const objectInteraction = await importTypeScript('src/core/vision/object-interaction.ts');
const actionSequence = await importTypeScript('src/core/vision/action-sequence.ts');
const causalActionGraph = await importTypeScript('src/core/vision/causal-action-graph.ts');
const worldModel = await importTypeScript('src/core/vision/world-model.ts');
const spatialUiControl = await importTypeScript('src/core/vision/spatial-ui-control.ts');
const spatialRay = await importTypeScript('src/core/vision/spatial-ray.ts');
const spatialAnchor = await importTypeScript('src/core/vision/spatial-anchor.ts');
const spatialObject = await importTypeScript('src/core/vision/spatial-object.ts');
const spatialWorld = await importTypeScript('src/core/vision/spatial-world.ts');
const spatialPhysics = await importTypeScript('src/core/vision/spatial-physics.ts');
const spatialCollision = await importTypeScript('src/core/vision/spatial-collision.ts');
const spatialJoint = await importTypeScript('src/core/vision/spatial-joint.ts');
const spatialLayout = await importTypeScript('src/core/vision/spatial-layout.ts');
const spatialGroup = await importTypeScript('src/core/vision/spatial-group.ts');
const spatialDevice = await importTypeScript('src/core/vision/spatial-device-adapter.ts');
const spatialWebXR = await importTypeScript('src/core/vision/spatial-webxr-session.ts');
const spatialXRProjection = await importTypeScript('src/core/vision/spatial-xr-projection.ts');
const spatialXRSurface = await importTypeScript('src/core/vision/spatial-xr-surface.ts');
const spatialXRManipulation = await importTypeScript('src/core/vision/spatial-xr-manipulation.ts');
const spatialXRBimanual = await importTypeScript('src/core/vision/spatial-xr-bimanual.ts');
const spatialXRRigidBody = await importTypeScript('src/core/vision/spatial-xr-rigid-body.ts');
const photorealDepth = await importTypeScript('src/presence/photoreal-depth.ts');
const photorealCameraDepth = await importTypeScript('src/presence/photoreal-camera-depth.ts');
const photorealEnvironment = await importTypeScript('src/presence/photoreal-environment.ts');
const spatialHandKinematics = await importTypeScript('src/core/vision/spatial-hand-kinematics.ts');
const spatialHandContact = await importTypeScript('src/core/vision/spatial-hand-contact.ts');
const spatialHandIntent = await importTypeScript('src/core/vision/spatial-hand-intent.ts');
const spatialXRHandBridge = await importTypeScript('src/core/vision/spatial-xr-hand-bridge.ts');

test('voice lifecycle follows the expected state path', () => {
  let state = 'idle';
  state = machine.transition(state, 'MIC_START'); assert.equal(state, 'listening');
  state = machine.transition(state, 'STT_FINAL'); assert.equal(state, 'thinking');
  state = machine.transition(state, 'SPEAK'); assert.equal(state, 'speaking');
  state = machine.transition(state, 'TTS_DONE'); assert.equal(state, 'idle');
});

test('text input enters the same thinking/speaking pipeline', () => {
  assert.equal(machine.transition('idle', 'TEXT_SUBMIT'), 'thinking');
  assert.equal(machine.transition('thinking', 'SPEAK'), 'speaking');
});

test('barge-in is deterministic from listening/thinking/speaking and resumes listening', () => {
  for (const state of ['listening', 'thinking', 'speaking']) assert.equal(machine.transition(state, 'INTERRUPT'), 'interrupted');
  assert.equal(machine.transition('interrupted', 'MIC_START'), 'listening');
});

test('unsupported events do not cause surprise transitions', () => {
  assert.equal(machine.transition('idle', 'TTS_DONE'), 'idle');
  assert.equal(machine.transition('error', 'TTS_DONE'), 'error');
});

test('canTransition reflects the declared state graph', () => {
  assert.equal(machine.canTransition('idle', 'listening'), true);
  assert.equal(machine.canTransition('idle', 'speaking'), true);
  assert.equal(machine.canTransition('idle', 'interrupted'), false);
  assert.equal(machine.canTransition('thinking', 'interrupted'), true);
});

test('speech cleanup removes markdown links, formatting and emoji', () => {
  assert.equal(speech.cleanForSpeech('**Mira** xem [báo cáo](https://example.com) nhé 😊'), 'Mira xem báo cáo nhé');
});

test('speech cleanup converts written bullet structure into spoken phrases', () => {
  assert.equal(speech.cleanForSpeech('- UI\n- Backend\n- Hiệu năng'), 'UI. Backend. Hiệu năng');
});

test('speech chunking emits the first sentence early and preserves content', () => {
  const input = 'Câu đầu tiên để nói sớm. Câu thứ hai dài hơn một chút để kiểm tra hàng đợi. Câu cuối.';
  const chunks = speech.chunkSpeech(input);
  assert.ok(chunks.length >= 2);
  assert.match(chunks[0], /^Câu đầu tiên/);
  assert.equal(chunks.join(' ').replace(/\s+/g, ' ').trim(), input);
});

test('Vietnamese normalizer reads common product and reporting shorthand naturally', () => {
  const normalized = viSpeech.normalizeVietnameseSpeech('Mức 16.5M, độ đúng 99.9%, ngày 12/08/2026.');
  assert.match(normalized, /mười sáu phẩy năm triệu/);
  assert.match(normalized, /chín mươi chín phẩy chín phần trăm/);
  assert.match(normalized, /ngày mười hai tháng tám năm hai nghìn không trăm hai mươi sáu/);
});

test('Vietnamese speech director keeps facts but turns written phrasing into conversation', () => {
  const plan = director.directVietnameseSpeech('Tuy nhiên, ưu tiên UI/UX trước. P0 đang có lỗi nghiêm trọng.');
  assert.match(plan.speechText, /^Nhưng /);
  assert.match(plan.speechText, /UI, UX/);
  assert.match(plan.speechText, /P không/);
  assert.equal(plan.performance, 'serious');
  assert.ok(plan.rateMultiplier < 1);
  assert.match(plan.instructions, /hội thoại tự nhiên/);
  assert.match(plan.instructions, /không phải đọc văn bản/);
});

test('speech director raises energy subtly for successful completion', () => {
  const plan = director.directVietnameseSpeech('Xong rồi anh, build đã pass hết và deploy thành công.');
  assert.equal(plan.performance, 'excited');
  assert.ok(plan.rateMultiplier > 1);
});

test('semantic pauses are longer for quiet/serious delivery than warm delivery', () => {
  const warm = director.semanticPauseMs('Em xem xong rồi.', 'warm');
  const serious = director.semanticPauseMs('Có một lỗi nghiêm trọng.', 'serious');
  assert.ok(serious > warm);
});

test('turn-level prosody assigns different roles inside one response', () => {
  const plan = director.planVietnameseTurn(
    'Xong rồi anh, phần đầu đã ổn. Em kiểm tra API thêm một lượt. Nhưng hiện có một lỗi nghiêm trọng. Quan trọng nhất, ưu tiên UI/UX trước. Chốt lại, mình xử lý voice sau cùng.',
  );
  assert.ok(plan.segments.length >= 5);
  assert.equal(plan.segments[0].role, 'opening');
  assert.equal(plan.segments[0].performance, 'excited');
  assert.ok(plan.segments.some((segment) => segment.role === 'warning' && segment.performance === 'serious'));
  assert.ok(plan.segments.some((segment) => segment.role === 'emphasis' && segment.performance === 'focused'));
  assert.equal(plan.segments.at(-1).role, 'conclusion');
});

test('turn-level prosody changes rate and direction locally instead of flattening the whole turn', () => {
  const plan = director.planVietnameseTurn(
    'Xong rồi anh, build đã pass hết. Nhưng có một cảnh báo nghiêm trọng. Chốt lại, mình kiểm tra API trước.',
  );
  const opening = plan.segments[0];
  const warning = plan.segments.find((segment) => segment.role === 'warning');
  const conclusion = plan.segments.at(-1);
  assert.ok(warning);
  assert.ok(conclusion);
  assert.ok(opening.rateMultiplier > warning.rateMultiplier);
  assert.notEqual(opening.instructions, warning.instructions);
  assert.notEqual(warning.instructions, conclusion.instructions);
  assert.match(warning.instructions, /cảnh báo/);
  assert.match(conclusion.instructions, /phần chốt/);
});

test('turn-level pauses are strongest around warning and emphasis transitions', () => {
  const plan = director.planVietnameseTurn(
    'Em xem xong rồi. Phần này hoạt động bình thường. Quan trọng nhất, giữ API ổn định. Có một cảnh báo nghiêm trọng. Mình xử lý ngay nhé.',
  );
  const emphasisIndex = plan.segments.findIndex((segment) => segment.role === 'emphasis');
  const warningIndex = plan.segments.findIndex((segment) => segment.role === 'warning');
  const explanationIndex = plan.segments.findIndex((segment) => segment.role === 'explanation');
  assert.ok(emphasisIndex >= 0 && warningIndex >= 0 && explanationIndex >= 0);
  const emphasisPause = director.turnSegmentPauseMs(plan.segments[emphasisIndex], emphasisIndex, plan.segments.length);
  const warningPause = director.turnSegmentPauseMs(plan.segments[warningIndex], warningIndex, plan.segments.length);
  const explanationPause = director.turnSegmentPauseMs(plan.segments[explanationIndex], explanationIndex, plan.segments.length);
  assert.ok(emphasisPause > explanationPause);
  assert.ok(warningPause > emphasisPause);
});

test('conversation timing stays silent for short acknowledgements and text-mode turns', () => {
  const ack = timing.planConversationTiming({ input: 'Vâng', source: 'voice', turnIndex: 1 });
  const textTurn = timing.planConversationTiming({ input: 'Phân tích kiến trúc này giúp anh', source: 'text', turnIndex: 2 });
  assert.equal(ack.audibleCue, null);
  assert.equal(ack.audibleCueDelayMs, null);
  assert.equal(textTurn.audibleCue, null);
});

test('conversation timing adapts audible backchannel delay from observed latency', () => {
  const fast = timing.planConversationTiming({
    input: 'Phân tích kiến trúc API và backend này giúp anh',
    source: 'voice',
    turnIndex: 3,
    previousLatencyMs: 520,
  });
  const slow = timing.planConversationTiming({
    input: 'Phân tích kiến trúc API và backend này giúp anh',
    source: 'voice',
    turnIndex: 4,
    previousLatencyMs: 3400,
  });
  assert.ok(fast.audibleCueDelayMs != null && slow.audibleCueDelayMs != null);
  assert.ok(slow.audibleCueDelayMs < fast.audibleCueDelayMs);
});

test('conversation timing gives more floor time after interruption', () => {
  const normal = timing.planConversationTiming({
    input: 'Đánh giá phương án này giúp anh', source: 'voice', turnIndex: 5, previousLatencyMs: 1500,
  });
  const interrupted = timing.planConversationTiming({
    input: 'Đánh giá phương án này giúp anh', source: 'voice', turnIndex: 5, previousLatencyMs: 1500, interrupted: true,
  });
  assert.ok(normal.audibleCueDelayMs != null && interrupted.audibleCueDelayMs != null);
  assert.ok(interrupted.audibleCueDelayMs > normal.audibleCueDelayMs);
});

test('thinking cue selection avoids immediate repetition deterministically', () => {
  const input = 'Kiểm tra repo và build giúp anh';
  const first = timing.chooseThinkingCue(input, 10, '');
  const second = timing.chooseThinkingCue(input, 10, first);
  assert.notEqual(first, second);
});

test('turn-taking reopens mic faster after a question and immediately after barge-in', () => {
  const question = timing.resumeListeningDelayMs('Anh muốn em làm tiếp phần nào?');
  const statement = timing.resumeListeningDelayMs('Em đã kiểm tra xong toàn bộ phần này và hiện chưa có cảnh báo nghiêm trọng nào.');
  assert.ok(question < statement);
  assert.ok(timing.interruptionRecoveryDelayMs() < question);
});

test('hands-free silence retry cadence grows gently and remains bounded', () => {
  const first = timing.silenceRetryDelayMs(1);
  const third = timing.silenceRetryDelayMs(3);
  const many = timing.silenceRetryDelayMs(20);
  assert.ok(third > first);
  assert.ok(many <= 620);
});

test('adaptive response presets expand token and timeout budgets monotonically', () => {
  const modes = ['short', 'auto', 'detailed', 'deep'];
  const budgets = modes.map((mode) => voice.responseTokenBudget(mode));
  const timeouts = modes.map((mode) => voice.responseTimeoutMs(mode));
  assert.deepEqual([...budgets].sort((a, b) => a - b), budgets);
  assert.deepEqual([...timeouts].sort((a, b) => a - b), timeouts);
  assert.ok(budgets[3] > budgets[0] * 4);
});

test('auto/deep response policies explicitly allow long spoken explanations', () => {
  assert.match(voice.responseLengthInstruction('auto'), /10–20 câu/);
  assert.match(voice.responseLengthInstruction('deep'), /14–28 câu/);
  assert.match(voice.responseLengthInstruction('auto'), /nói kỹ hơn/);
});


test('spatial two-hand geometry measures center distance and angle deterministically', () => {
  const geometry = spatial.measureTwoHands({ x: 0.2, y: 0.4 }, { x: 0.8, y: 0.4 });
  assert.equal(geometry.center.x, 0.5);
  assert.equal(geometry.center.y, 0.4);
  assert.ok(Math.abs(geometry.distance - 0.6) < 1e-9);
  assert.ok(Math.abs(geometry.angleDeg) < 1e-9);
});

test('spatial scale is proportional and clamped for mobile safety', () => {
  assert.ok(Math.abs(spatial.scaleFromDistance(1, 0.4, 0.6) - 1.5) < 1e-9);
  assert.equal(spatial.scaleFromDistance(1, 0.4, 1.2), 1.55);
  assert.equal(spatial.scaleFromDistance(1, 0.4, 0.1), 0.72);
});

test('spatial rotation uses the shortest angular path and remains bounded', () => {
  assert.equal(spatial.shortestAngleDeltaDeg(170, -170), 20);
  assert.equal(spatial.shortestAngleDeltaDeg(-170, 170), -20);
  assert.equal(spatial.rotationFromAngles(0, 0, 80), 24);
  assert.equal(spatial.rotationFromAngles(0, 0, -80), -24);
});

test('spatial smoothing dampens jitter instead of jumping to raw input', () => {
  const smoothed = spatial.smoothValue(0.5, 1, 0.25);
  assert.equal(smoothed, 0.625);
});


test('face affect scoring separates a strong smile from a frown without claiming diagnosis', () => {
  const happy = affect.inferAffect({ present: true, smile: 0.92, cheekSquint: 0.55, frown: 0.02 });
  const sad = affect.inferAffect({ present: true, smile: 0.02, frown: 0.82, browUp: 0.42 });
  assert.equal(happy.mood, 'happy');
  assert.equal(sad.mood, 'sad');
  assert.match(sad.promptContext, /ước lượng|tín hiệu/i);
});

test('affect tracker rejects a single-frame tired blink until the signal is stable', () => {
  const tracker = new affect.AffectTracker();
  const blink = { present: true, blinkL: 0.95, blinkR: 0.95, smile: 0.02 };
  const first = tracker.update(blink, 1000);
  const later = tracker.update(blink, 3400);
  assert.equal(first.mood, 'neutral');
  assert.equal(later.mood, 'tired');
});

test('proactive engine waits for a stable confident mood and emits one conservative prompt', () => {
  const engine = new proactive.ProactiveEngine();
  const state = {
    mood: 'happy',
    confidence: 0.9,
    speechRate: 1.02,
    visualEnergy: 0.8,
    promptContext: '',
    metrics: { positive: 0.9, negative: 0, fatigue: 0, surprise: 0, tension: 0 },
  };
  engine.observeAffect(state, 1000);
  assert.equal(engine.nextForSilence(state, 4000), null);
  assert.match(engine.nextForSilence(state, 10000) || '', /cười|vui/i);
});


test('facial gesture classifier separates wink, smile and mouth-open signals', () => {
  const wink = facialGesture.inferFacialGesture({ blinkL: 0.94, blinkR: 0.08, smile: 0.05 });
  const smile = facialGesture.inferFacialGesture({ smile: 0.92, cheekSquint: 0.5, blinkL: 0.05, blinkR: 0.05 });
  const mouth = facialGesture.inferFacialGesture({ jaw: 0.9, smile: 0.04, frown: 0.02 });
  assert.equal(wink.gesture, 'wink_left');
  assert.equal(smile.gesture, 'smile');
  assert.equal(mouth.gesture, 'mouth_open');
  assert.ok(wink.confidence > 0.7);
});


test('real presence estimates conversation distance and stable scene placement from face landmarks', () => {
  const points = Array.from({ length: 478 }, (_, index) => {
    const angle = (index / 478) * Math.PI * 2;
    return {
      x: 0.5 + Math.cos(angle) * 0.12,
      y: 0.46 + Math.sin(angle) * 0.16,
      z: 0,
    };
  });
  const pose = realPresence.estimateRealPresencePose(points);
  assert.equal(pose.present, true);
  assert.equal(pose.proximity, 'conversation');
  assert.ok(pose.distanceM > 0.45 && pose.distanceM < 1.1);
  assert.ok(pose.confidence > 0.7);
  assert.ok(Math.abs(pose.sceneOffsetX) < 2);
});

test('real presence rejects incomplete landmark scans and keeps raw identity out of the pose model', () => {
  const pose = realPresence.estimateRealPresencePose([{ x: 0.5, y: 0.5 }]);
  assert.equal(pose.present, false);
  assert.equal(pose.proximity, 'unknown');
  assert.equal('embedding' in pose, false);
});


test('FACS proxy maps MediaPipe blendshapes into stable AU-like signals', () => {
  const mapped = facs.facsProxyFromBlendshapes({
    browInnerUp: 0.72,
    browDownLeft: 0.1,
    browDownRight: 0.2,
    cheekSquintLeft: 0.62,
    cheekSquintRight: 0.66,
    mouthSmileLeft: 0.83,
    mouthSmileRight: 0.79,
    eyeBlinkLeft: 0.12,
    eyeBlinkRight: 0.1,
    jawOpen: 0.22,
  });
  assert.ok(mapped.AU01 > 0.7);
  assert.ok(mapped.AU06 > 0.6);
  assert.ok(mapped.AU12 > 0.78);
  assert.ok(mapped.AU45 < 0.2);
  assert.ok(mapped.symmetry > 0.9);
});

test('affect v2 exposes continuous valence/arousal/engagement and fuses acoustic arousal conservatively', () => {
  const state = affect.inferAffect({
    present: true,
    smile: 0.82,
    cheekSquint: 0.56,
    eyeWide: 0.24,
    gazeX: 0.05,
    gazeY: 0.03,
    actionUnits: { AU12: 0.85, AU06: 0.6, AU04: 0.04 },
    voice: { energy: 0.62, activity: 0.8, pitchVariability: 0.35, confidence: 0.8 },
  });
  assert.equal(state.mood, 'happy');
  assert.ok(state.dimensions.valence > 0.45);
  assert.ok(state.dimensions.arousal > 0.2);
  assert.ok(state.dimensions.engagement > 0.7);
  assert.ok(state.channels.voice > 0.7);
});

test('affect tracker keeps temporal stability before adopting a new expression label', () => {
  const tracker = new affect.AffectTracker();
  let state = tracker.update({ present: true, smile: 0.02, frown: 0.03 }, 1000);
  state = tracker.update({ present: true, smile: 0.9, cheekSquint: 0.6, actionUnits: { AU12: 0.9, AU06: 0.62 } }, 1200);
  assert.equal(state.mood, 'neutral');
  state = tracker.update({ present: true, smile: 0.9, cheekSquint: 0.6, actionUnits: { AU12: 0.9, AU06: 0.62 } }, 2000);
  assert.equal(state.mood, 'happy');
});


test('micro-expression tracker emits only a brief temporal AU-proxy excursion', () => {
  const tracker = new microExpression.MicroExpressionTracker();
  const base = { AU01:0,AU02:0,AU04:0,AU05:0,AU06:0,AU07:0,AU09:0,AU10:0,AU12:0,AU14:0,AU15:0,AU17:0,AU20:0,AU23:0,AU25:0,AU26:0,AU45:0,activity:0,symmetry:1 };
  tracker.update(base, 0);
  tracker.update({ ...base, AU12: 0.86, AU06: 0.62 }, 120);
  const event = tracker.update({ ...base, AU12: 0.05, AU06: 0.04 }, 310);
  assert.equal(event.kind, 'smile_flash');
  assert.ok(event.confidence >= 0.28);
  assert.ok(event.durationMs >= 55 && event.durationMs <= 720);
});

test('posture model distinguishes upright from visibly slouched 2D geometry', () => {
  const make = (noseY) => {
    const points = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 0.95 }));
    points[0] = { x: 0.5, y: noseY, visibility: 0.95 };
    points[11] = { x: 0.42, y: 0.4, visibility: 0.95 };
    points[12] = { x: 0.58, y: 0.4, visibility: 0.95 };
    points[23] = { x: 0.44, y: 0.7, visibility: 0.95 };
    points[24] = { x: 0.56, y: 0.7, visibility: 0.95 };
    return points;
  };
  const upright = postureModel.derivePosture(make(0.17));
  const slouched = postureModel.derivePosture(make(0.34));
  assert.equal(upright.present, true);
  assert.ok(upright.upright > slouched.upright);
  assert.ok(slouched.slump > upright.slump);
});

test('rPPG signal estimator finds a clean synthetic 72 BPM trend without claiming clinical accuracy', () => {
  const samples = [];
  const bpm = 72;
  const hz = bpm / 60;
  for (let i = 0; i < 180; i += 1) {
    const t = i * (1000 / 15);
    const phase = 2 * Math.PI * hz * (t / 1000);
    samples.push({
      t,
      r: 128 + Math.sin(phase) * 1.6,
      g: 118 + Math.sin(phase) * 3.2,
      b: 105 + Math.sin(phase) * 0.8,
      motion: 0.02,
      illumination: 0.7,
    });
  }
  const result = rppgSignal.estimatePulseFromSamples(samples);
  assert.ok(Math.abs(result.bpm - bpm) <= 3);
  assert.ok(result.quality > 0.35);
});

test('multimodal affect v3 keeps physiology low-weight and uses posture as supporting context', () => {
  const state = affect.inferAffect({
    present: true,
    smile: 0.15,
    frown: 0.08,
    eyeWide: 0.2,
    actionUnits: { AU12: 0.12, AU04: 0.08 },
    voice: { energy: 0.45, activity: 0.55, pitchVariability: 0.2, confidence: 0.7 },
    posture: { present: true, confidence: 0.9, upright: 0.88, slump: 0.08, motion: 0.05 },
    physiology: { quality: 0.82, relativeActivation: 0.7 },
    microExpression: { kind: 'none', confidence: 0 },
  });
  assert.equal(state.mood, 'neutral');
  assert.ok(state.dimensions.arousal > 0.05);
  assert.ok(state.dimensions.engagement > 0.65);
  assert.equal(state.channels.posture, 0.9);
  assert.equal(state.channels.physiology, 0.82);
});


test('social interaction tracker separates focus, look-away, absence and return without claiming intent', () => {
  const tracker = new interaction.InteractionTracker();
  const focusedSample = {
    facePresent: true,
    faceConfidence: 0.88,
    yaw: 0.02,
    pitch: 0.01,
    gazeX: 0.02,
    gazeY: 0.01,
    posturePresent: true,
    postureConfidence: 0.85,
    postureMotion: 0.04,
    distanceM: 0.82,
  };
  tracker.update(focusedSample, 100);
  tracker.update(focusedSample, 700);
  tracker.update(focusedSample, 1400);
  tracker.update(focusedSample, 2200);
  tracker.update(focusedSample, 3800);
  const focused = tracker.update(focusedSample, 5400);
  assert.equal(focused.state, 'focused');
  assert.ok(focused.attention > 0.7);
  assert.ok(focused.eyeContact > 0.9);

  const lookAway = tracker.update({ ...focusedSample, yaw: 0.9, gazeX: 0.82 }, 6000);
  assert.equal(lookAway.state, 'looking_away');

  tracker.update({ facePresent: false }, 6500);
  const absent = tracker.update({ facePresent: false }, 7900);
  assert.equal(absent.state, 'absent');

  const returning = tracker.update(focusedSample, 8100);
  assert.equal(returning.state, 'returning');
  assert.ok(returning.lastAwayMs >= 1500);
  assert.match(interaction.interactionPrompt(lookAway), /không suy diễn|im lặng|ngắn/i);
});

test('behavior timeline keeps recent observable transitions ephemeral and deduplicated', () => {
  const timeline = new behaviorTimeline.BehaviorTimeline();
  const engaged = { state: 'engaged', attention: 0.72, eyeContact: 0.7, headAlignment: 0.8, continuityMs: 2000, awayMs: 0, lastAwayMs: 0, confidence: 0.82 };
  let events = timeline.observe({ interaction: engaged, postureLabel: 'upright', postureConfidence: 0.9, proximity: 'conversation' }, 1000);
  const firstCount = events.length;
  events = timeline.observe({ interaction: engaged, postureLabel: 'upright', postureConfidence: 0.9, proximity: 'conversation' }, 1200);
  assert.equal(events.length, firstCount);

  events = timeline.observe({ interaction: { ...engaged, state: 'looking_away' }, microKind: 'brow_flash', microConfidence: 0.7, gesture: 'Open_Palm', gestureScore: 0.8 }, 2000);
  assert.ok(events.some((event) => event.type === 'micro'));
  assert.ok(events.some((event) => event.label === 'looking_away'));
  const withMicro = events.length;
  events = timeline.observe({ interaction: { ...engaged, state: 'looking_away' }, microKind: 'brow_flash', microConfidence: 0.72, gesture: 'Open_Palm', gestureScore: 0.82 }, 2120);
  assert.equal(events.length, withMicro);
  assert.match(timeline.promptSummary(2500), /ngữ cảnh phụ|không suy diễn/i);
});

test('proactive engine stays quiet when social geometry says user is away', () => {
  const engine = new proactive.ProactiveEngine();
  const state = {
    mood: 'happy',
    confidence: 0.92,
    speechRate: 1,
    visualEnergy: 0.8,
    promptContext: '',
    dimensions: { valence: 0.7, arousal: 0.5, engagement: 0.3, fatigue: 0, tension: 0 },
    channels: { face: 0.9, voice: 0, posture: 0, physiology: 0, micro: 0, baselineReady: 1 },
    metrics: { positive: 0.9, negative: 0, fatigue: 0, surprise: 0, tension: 0 },
    interaction: { state: 'absent', attention: 0, eyeContact: 0, headAlignment: 0, continuityMs: 0, awayMs: 5000, lastAwayMs: 0, confidence: 0.8 },
  };
  engine.observeAffect(state, 1000);
  assert.equal(engine.nextForSilence(state, 20_000), null);
});


test('holistic lite gesture geometry preserves Mira open-palm and fist controls without a second ML model', () => {
  const open = Array.from({ length: 21 }, () => ({ x: 0.5, y: 0.72, z: 0 }));
  open[0] = { x: 0.5, y: 0.92, z: 0 };
  const fingers = [
    [5,6,8,0.38], [9,10,12,0.46], [13,14,16,0.54], [17,18,20,0.62],
  ];
  for (const [mcp,pip,tip,x] of fingers) {
    open[mcp] = { x, y: 0.68, z: 0 };
    open[pip] = { x, y: 0.49, z: 0 };
    open[tip] = { x, y: 0.24, z: 0 };
  }
  open[2] = { x: 0.43, y: 0.72, z: 0 };
  open[3] = { x: 0.34, y: 0.62, z: 0 };
  open[4] = { x: 0.23, y: 0.51, z: 0 };

  const openResult = handGestureLite.inferLiteGesture(open);
  assert.equal(openResult.gesture, 'Open_Palm');
  assert.ok(openResult.score > 0.7);

  const fist = open.map((point) => ({ ...point }));
  for (const [mcp,pip,tip,x] of fingers) {
    fist[mcp] = { x, y: 0.68, z: 0 };
    fist[pip] = { x, y: 0.57, z: 0 };
    fist[tip] = { x: x + 0.01, y: 0.68, z: 0 };
  }
  fist[2] = { x: 0.45, y: 0.72, z: 0 };
  fist[3] = { x: 0.43, y: 0.69, z: 0 };
  fist[4] = { x: 0.45, y: 0.66, z: 0 };
  const fistResult = handGestureLite.inferLiteGesture(fist);
  assert.equal(fistResult.gesture, 'Closed_Fist');
  assert.ok(fistResult.score > 0.55);
});

test('vision performance governor backs off under heavy holistic inference and keeps hidden-tab cadence low', () => {
  const governor = new visionPerformance.VisionPerformanceGovernor('holistic', 'GPU', 'high');
  assert.equal(governor.state.intervalMs, 38);
  assert.equal(governor.shouldProcess(100, false), true);
  governor.noteFrame(100, 82, 553);
  const loaded = governor.snapshot();
  assert.ok(loaded.intervalMs > 38);
  assert.equal(loaded.landmarkCount, 553);
  assert.equal(loaded.delegate, 'GPU');

  assert.equal(governor.shouldProcess(110, false), false);
  governor.noteFrame(240, 20, 520);
  assert.ok(governor.snapshot().fps > 0);
  assert.equal(governor.shouldProcess(300, true), false);
});


test('gaze/head calibration learns a local camera-facing center without storing images', () => {
  const calibrator = new gazeCalibration.GazeHeadCalibrator();
  for (let i = 0; i < 95; i += 1) {
    calibrator.observe({
      facePresent: true,
      confidence: 0.9,
      gazeX: 0.16,
      gazeY: -0.08,
      yaw: 0.12,
      pitch: -0.06,
      motion: 0.03,
    });
  }
  const profile = calibrator.snapshot();
  assert.equal(profile.ready, true);
  assert.equal(profile.progress, 1);
  const calibrated = calibrator.apply({ gazeX: 0.16, gazeY: -0.08, yaw: 0.12, pitch: -0.06 });
  assert.ok(Math.abs(calibrated.gazeX) < 0.03);
  assert.ok(Math.abs(calibrated.gazeY) < 0.03);
  assert.ok(Math.abs(calibrated.yaw) < 0.03);
  assert.ok(Math.abs(calibrated.pitch) < 0.03);
});

test('gaze/head calibration ignores unstable or low-confidence frames', () => {
  const calibrator = new gazeCalibration.GazeHeadCalibrator();
  calibrator.reset();
  for (let i = 0; i < 30; i += 1) {
    calibrator.observe({
      facePresent: true,
      confidence: 0.3,
      gazeX: 0.1,
      gazeY: 0.1,
      yaw: 0.1,
      pitch: 0.1,
      motion: 0.7,
    });
  }
  assert.equal(calibrator.snapshot().samples, 0);
});

test('temporal gesture intent requires a stable hold before triggering UI commands', () => {
  const tracker = new gestureIntent.GestureIntentTracker();
  let state = tracker.update({ gesture: 'Victory', score: 0.9, pinching: false }, 1000);
  assert.equal(state.intent, 'none');
  state = tracker.update({ gesture: 'Victory', score: 0.9, pinching: false }, 1250);
  assert.equal(state.intent, 'none');
  state = tracker.update({ gesture: 'Victory', score: 0.9, pinching: false }, 1460);
  assert.equal(state.intent, 'victory_hold');
  const victoryEventId = state.eventId;

  state = tracker.update({ gesture: 'Victory', score: 0.92, pinching: false }, 1600);
  assert.equal(state.intent, 'none');
  assert.equal(state.eventId, victoryEventId);
});

test('temporal gesture intent emits pinch down/up edges once', () => {
  const tracker = new gestureIntent.GestureIntentTracker();
  let state = tracker.update({ gesture: 'Pointing_Up', score: 0.8, pinching: false }, 1000);
  assert.equal(state.intent, 'none');
  state = tracker.update({ gesture: 'Pointing_Up', score: 0.8, pinching: true }, 1300);
  assert.equal(state.intent, 'pinch_down');
  const downId = state.eventId;
  state = tracker.update({ gesture: 'Pointing_Up', score: 0.8, pinching: true }, 1400);
  assert.equal(state.intent, 'none');
  assert.equal(state.eventId, downId);
  state = tracker.update({ gesture: 'Pointing_Up', score: 0.8, pinching: false }, 1550);
  assert.equal(state.intent, 'pinch_up');
  assert.ok(state.eventId > downId);
});

test('vision performance telemetry reports worker postprocess separately from model inference', () => {
  const governor = new visionPerformance.VisionPerformanceGovernor('holistic', 'GPU', 'balanced');
  governor.setPostprocess('worker', 6);
  governor.noteFrame(1000, 25, 553);
  const snapshot = governor.snapshot();
  assert.equal(snapshot.postprocess, 'worker');
  assert.ok(snapshot.postprocessMs > 0);
  assert.equal(snapshot.landmarkCount, 553);
});


test('environment object tracker keeps session-local IDs stable across overlapping detections', () => {
  const tracker = new environmentModel.ObjectTemporalTracker();
  const first = tracker.update([
    { label: 'laptop', score: 0.88, box: { x: 0.2, y: 0.3, width: 0.35, height: 0.28 } },
  ], 1000);
  assert.equal(first.length, 1);
  assert.equal(first[0].stable, false);
  const id = first[0].id;

  const second = tracker.update([
    { label: 'laptop', score: 0.91, box: { x: 0.21, y: 0.31, width: 0.34, height: 0.27 } },
  ], 1800);
  assert.equal(second[0].id, id);
  assert.equal(second[0].stable, true);
  assert.ok(second[0].hits >= 2);
});

test('environment context classifies stable workspace-like objects without claiming a real room type', () => {
  const objects = [
    { id: 'a', label: 'laptop', score: 0.94, box: { x: 0.1, y: 0.2, width: 0.4, height: 0.3 }, hits: 4, stable: true, firstSeenAt: 0, lastSeenAt: 1000 },
    { id: 'b', label: 'keyboard', score: 0.87, box: { x: 0.25, y: 0.6, width: 0.3, height: 0.12 }, hits: 3, stable: true, firstSeenAt: 0, lastSeenAt: 1000 },
    { id: 'c', label: 'person', score: 0.93, box: { x: 0.55, y: 0.05, width: 0.4, height: 0.9 }, hits: 4, stable: true, firstSeenAt: 0, lastSeenAt: 1000 },
  ];
  const context = environmentModel.inferEnvironment(objects, 1200);
  assert.equal(context.label, 'workspace');
  assert.ok(context.confidence > 0.55);
  assert.equal(context.peopleCount, 1);
  assert.ok(context.evidence.includes('laptop'));
  assert.match(environmentModel.environmentPrompt(context), /không khẳng định|suy luận từ vật thể/i);
});

test('environment context reports additional people only as a camera-frame proxy', () => {
  const objects = [
    { id: 'p1', label: 'person', score: 0.92, box: { x: 0.05, y: 0.05, width: 0.4, height: 0.9 }, hits: 3, stable: true, firstSeenAt: 0, lastSeenAt: 1000 },
    { id: 'p2', label: 'person', score: 0.86, box: { x: 0.52, y: 0.08, width: 0.4, height: 0.86 }, hits: 3, stable: true, firstSeenAt: 0, lastSeenAt: 1000 },
  ];
  const context = environmentModel.inferEnvironment(objects, 1200);
  assert.equal(context.label, 'person_nearby');
  assert.equal(context.peopleCount, 2);
  assert.ok(context.confidence >= 0.5);
});

test('behavior timeline can carry environment transitions without persisting raw object boxes', () => {
  const timeline = new behaviorTimeline.BehaviorTimeline();
  let events = timeline.observe({ environment: 'workspace', environmentConfidence: 0.78 }, 1000);
  assert.ok(events.some((event) => event.type === 'environment' && event.label === 'workspace'));
  const count = events.length;
  events = timeline.observe({ environment: 'workspace', environmentConfidence: 0.8 }, 1300);
  assert.equal(events.length, count);
});


test('spatial scene graph mirrors camera geometry into the user-visible preview and derives person-relative relations', () => {
  const tracker = new spatialSceneGraph.SpatialSceneGraphTracker();
  const objects = [
    {
      id: 'person-1', label: 'person', score: 0.95,
      box: { x: 0.08, y: 0.08, width: 0.34, height: 0.84 },
      hits: 4, stable: true, firstSeenAt: 0, lastSeenAt: 1000,
    },
    {
      id: 'laptop-1', label: 'laptop', score: 0.9,
      box: { x: 0.68, y: 0.54, width: 0.22, height: 0.18 },
      hits: 4, stable: true, firstSeenAt: 0, lastSeenAt: 1000,
    },
  ];
  const graph = tracker.update(objects, { active: false, x: 0.5, y: 0.5, confidence: 0 }, 1000);
  const laptop = graph.nodes.find((node) => node.label === 'laptop');
  const person = graph.nodes.find((node) => node.label === 'person');
  assert.ok(laptop && person);
  assert.ok(laptop.centerX < person.centerX);
  assert.ok(graph.relations.some((relation) =>
    relation.from === laptop.id &&
    relation.to === person.id &&
    relation.type === 'left_of'
  ));
});

test('spatial pointing focus requires a stable target before "cái này" context is exposed', () => {
  const tracker = new spatialSceneGraph.SpatialSceneGraphTracker();
  const objects = [
    {
      id: 'phone-1', label: 'cell phone', score: 0.9,
      box: { x: 0.62, y: 0.42, width: 0.18, height: 0.24 },
      hits: 4, stable: true, firstSeenAt: 0, lastSeenAt: 1000,
    },
  ];
  const pointer = { active: true, x: 0.29, y: 0.54, confidence: 0.88 };
  let graph = tracker.update(objects, pointer, 1000);
  assert.equal(graph.focus, null);
  graph = tracker.update(objects, pointer, 1200);
  assert.equal(graph.focus, null);
  graph = tracker.update(objects, pointer, 1360);
  assert.equal(graph.focus?.label, 'cell phone');
  assert.ok((graph.focus?.confidence || 0) > 0.7);
  assert.match(spatialSceneGraph.spatialScenePrompt(graph, 1360), /cái này\/vật này|cell phone/i);

  graph = tracker.update(objects, { active: true, x: 0.9, y: 0.08, confidence: 0.9 }, 1850);
  assert.equal(graph.focus, null);
});

test('spatial scene graph emits only camera-box people-count changes, not identity claims', () => {
  const tracker = new spatialSceneGraph.SpatialSceneGraphTracker();
  const onePerson = [{
    id: 'p1', label: 'person', score: 0.91,
    box: { x: 0.1, y: 0.05, width: 0.35, height: 0.9 },
    hits: 3, stable: true, firstSeenAt: 0, lastSeenAt: 1000,
  }];
  tracker.update(onePerson, { active: false, x: 0.5, y: 0.5, confidence: 0 }, 1000);
  const twoPeople = [
    ...onePerson,
    {
      id: 'p2', label: 'person', score: 0.88,
      box: { x: 0.56, y: 0.08, width: 0.34, height: 0.86 },
      hits: 3, stable: true, firstSeenAt: 1200, lastSeenAt: 1500,
    },
  ];
  const graph = tracker.update(twoPeople, { active: false, x: 0.5, y: 0.5, confidence: 0 }, 1600);
  assert.equal(graph.peopleCount, 2);
  assert.ok(graph.events.some((event) => event.type === 'people_changed' && event.label === '2'));
  assert.match(spatialSceneGraph.spatialScenePrompt(graph, 1600), /box người|không phải nhận dạng danh tính/i);
});

test('behavior timeline records spatial target transitions as ephemeral context', () => {
  const timeline = new behaviorTimeline.BehaviorTimeline();
  let events = timeline.observe({ spatialTarget: 'laptop', spatialConfidence: 0.82 }, 1000);
  assert.ok(events.some((event) => event.type === 'spatial' && event.label === 'target:laptop'));
  const count = events.length;
  events = timeline.observe({ spatialTarget: 'laptop', spatialConfidence: 0.86 }, 1300);
  assert.equal(events.length, count);
  events = timeline.observe({ spatialTarget: '', spatialConfidence: 0 }, 1500);
  events = timeline.observe({ spatialTarget: 'phone', spatialConfidence: 0.79 }, 1800);
  assert.ok(events.some((event) => event.type === 'spatial' && event.label === 'target:phone'));
});


test('deictic vision bridge answers "cái này là gì" from a locked visual target without calling the brain', () => {
  const context = '[MIRA_VISUAL_TARGET label="cell phone" confidence="89"] Bàn tay đang trỏ ổn định.';
  assert.equal(deicticVision.isDeicticObjectQuestion('Cái này là gì?'), true);
  const target = deicticVision.extractVisualTarget(context);
  assert.equal(target?.label, 'cell phone');
  assert.equal(target?.confidence, 89);
  const reply = deicticVision.deicticVisualReply('Cái này là gì?', context);
  assert.match(reply || '', /điện thoại/i);
  assert.match(reply || '', /89%/);
});

test('deictic vision bridge refuses to guess while pointer has no stable object', () => {
  const context = '[MIRA_VISUAL_POINTER target="none"] Bàn tay đang chỉ nhưng chưa khóa object.';
  const reply = deicticVision.deicticVisualReply('Đây là gì?', context);
  assert.match(reply || '', /chưa khóa được vật thể|giữ tay thêm/i);
});

test('spatial scene prompt emits machine-readable target markers only after stable pointing focus', () => {
  const tracker = new spatialSceneGraph.SpatialSceneGraphTracker();
  const objects = [{
    id: 'book-1', label: 'book', score: 0.92,
    box: { x: 0.6, y: 0.42, width: 0.2, height: 0.26 },
    hits: 4, stable: true, firstSeenAt: 0, lastSeenAt: 1000,
  }];
  const pointer = { active: true, x: 0.3, y: 0.55, confidence: 0.9 };
  tracker.update(objects, pointer, 1000);
  tracker.update(objects, pointer, 1200);
  const graph = tracker.update(objects, pointer, 1360);
  const prompt = spatialSceneGraph.spatialScenePrompt(graph, 1360);
  assert.match(prompt, /\[MIRA_VISUAL_TARGET label="book" confidence="\d+"\]/);
});


test('face frame guard keeps face presence alive when landmarks exist but blendshapes are temporarily missing', () => {
  const landmarks = Array.from({ length: 478 }, (_, index) => ({
    x: 0.25 + (index % 20) * 0.01,
    y: 0.2 + (index % 25) * 0.01,
    z: -0.02,
  }));
  const signal = faceFrameGuard.readFaceFrame({
    faceLandmarks: [landmarks],
    faceBlendshapes: [],
  });
  assert.equal(signal.usable, true);
  assert.equal(signal.landmarks.length, 478);
  assert.equal(signal.blendshapesReady, false);
});

test('face frame guard rejects malformed meshes instead of converting invalid points into valid zeros', () => {
  const broken = Array.from({ length: 478 }, () => ({ x: Number.NaN, y: Number.NaN, z: 0 }));
  const signal = faceFrameGuard.readFaceFrame({
    faceLandmarks: [broken],
    faceBlendshapes: [],
  });
  assert.equal(signal.usable, false);
  assert.equal(signal.landmarks.length, 0);
});

test('face frame guard clamps blendshape scores but does not use them as a presence gate', () => {
  const landmarks = Array.from({ length: 120 }, () => ({ x: 0.5, y: 0.5, z: 0 }));
  const signal = faceFrameGuard.readFaceFrame({
    faceLandmarks: [landmarks],
    faceBlendshapes: [{
      categories: [
        { categoryName: 'jawOpen', score: 1.4 },
        { categoryName: 'eyeBlinkLeft', score: -0.2 },
      ],
    }],
  });
  assert.equal(signal.usable, true);
  assert.equal(signal.blendshapesReady, true);
  assert.equal(signal.blendshapes.jawOpen, 1);
  assert.equal(signal.blendshapes.eyeBlinkLeft, 0);
});


test('spatial memory emits object_moved for a stable tracked object that changes screen position', () => {
  const tracker = new spatialSceneGraph.SpatialSceneGraphTracker();
  const make = (x) => [{
    id: 'laptop-1', label: 'laptop', score: 0.92,
    box: { x, y: 0.42, width: 0.2, height: 0.2 },
    hits: 5, stable: true, firstSeenAt: 0, lastSeenAt: 1000,
  }];
  tracker.update(make(0.68), { active: false, x: 0.5, y: 0.5, confidence: 0 }, 1000);
  const graph = tracker.update(make(0.5), { active: false, x: 0.5, y: 0.5, confidence: 0 }, 2100);
  const moved = graph.events.find((event) => event.type === 'object_moved' && event.label === 'laptop');
  assert.ok(moved);
  assert.ok((moved?.distance || 0) >= 0.065);
});

test('spatial memory matches a same-label object after disappearance and reports relocation conservatively', () => {
  const tracker = new spatialSceneGraph.SpatialSceneGraphTracker();
  const oldObject = [{
    id: 'book-old', label: 'book', score: 0.9,
    box: { x: 0.72, y: 0.42, width: 0.18, height: 0.22 },
    hits: 4, stable: true, firstSeenAt: 0, lastSeenAt: 1000,
  }];
  tracker.update(oldObject, { active: false, x: 0.5, y: 0.5, confidence: 0 }, 1000);
  tracker.update([], { active: false, x: 0.5, y: 0.5, confidence: 0 }, 2200);

  const reappeared = [{
    id: 'book-new', label: 'book', score: 0.91,
    box: { x: 0.18, y: 0.44, width: 0.18, height: 0.22 },
    hits: 4, stable: true, firstSeenAt: 2600, lastSeenAt: 3000,
  }];
  const graph = tracker.update(reappeared, { active: false, x: 0.5, y: 0.5, confidence: 0 }, 3000);
  const relocated = graph.events.find((event) => event.type === 'object_relocated' && event.label === 'book');
  assert.ok(relocated);
  assert.ok((relocated?.distance || 0) >= 0.12);
  assert.match(spatialSceneGraph.spatialScenePrompt(graph, 3000), /không suy ra ai đã cầm|chỉ là thay đổi box/i);
});

test('spatial memory calls a near same-label reappearance returned, not relocated', () => {
  const tracker = new spatialSceneGraph.SpatialSceneGraphTracker();
  tracker.update([{
    id: 'cup-a', label: 'cup', score: 0.88,
    box: { x: 0.4, y: 0.4, width: 0.12, height: 0.18 },
    hits: 4, stable: true, firstSeenAt: 0, lastSeenAt: 1000,
  }], { active: false, x: 0.5, y: 0.5, confidence: 0 }, 1000);
  tracker.update([], { active: false, x: 0.5, y: 0.5, confidence: 0 }, 2000);
  const graph = tracker.update([{
    id: 'cup-b', label: 'cup', score: 0.9,
    box: { x: 0.43, y: 0.41, width: 0.12, height: 0.18 },
    hits: 4, stable: true, firstSeenAt: 2200, lastSeenAt: 2600,
  }], { active: false, x: 0.5, y: 0.5, confidence: 0 }, 2600);
  assert.ok(graph.events.some((event) => event.type === 'object_returned' && event.label === 'cup'));
  assert.equal(graph.events.some((event) => event.type === 'object_relocated' && event.label === 'cup'), false);
});


test('object interaction proxy reports hand_near without escalating to manipulation', () => {
  const tracker = new objectInteraction.ObjectInteractionTracker();
  const graph = {
    nodes: [{
      id: 'laptop-1', label: 'laptop', score: 0.9,
      box: { x: 0.3, y: 0.3, width: 0.28, height: 0.24 },
      centerX: 0.44, centerY: 0.42, kind: 'object',
    }],
    relations: [], focus: null, pointerActive: false, peopleCount: 0, events: [], updatedAt: 1000,
  };
  const state = tracker.update(graph, [{
    handedness: 'Right', x: 0.45, y: 0.43, pinching: false, gesture: 'None', score: 0,
  }], 1000);
  assert.equal(state.stage, 'hand_near');
  assert.equal(state.objectLabel, 'laptop');
  assert.equal(objectInteraction.objectInteractionPrompt(state, 1000), '');
});

test('object interaction proxy emits possible_manipulation only when hand proximity precedes object motion', () => {
  const tracker = new objectInteraction.ObjectInteractionTracker();
  const baseNode = {
    id: 'book-1', label: 'book', score: 0.9,
    box: { x: 0.35, y: 0.38, width: 0.2, height: 0.22 },
    centerX: 0.45, centerY: 0.49, kind: 'object',
  };
  tracker.update({
    nodes: [baseNode], relations: [], focus: null, pointerActive: false, peopleCount: 0, events: [], updatedAt: 1000,
  }, [{
    handedness: 'Right', x: 0.46, y: 0.5, pinching: true, gesture: 'None', score: 0.2,
  }], 1000);

  const state = tracker.update({
    nodes: [baseNode], relations: [], focus: null, pointerActive: false, peopleCount: 0,
    events: [{ id: 'scene-1', type: 'object_moved', label: 'book', distance: 0.16, at: 1500 }],
    updatedAt: 1500,
  }, [{
    handedness: 'Right', x: 0.46, y: 0.5, pinching: true, gesture: 'None', score: 0.2,
  }], 1500);

  assert.equal(state.stage, 'possible_manipulation');
  assert.equal(state.objectLabel, 'book');
  assert.ok(state.confidence >= 0.52);
  assert.match(objectInteraction.objectInteractionPrompt(state, 1500), /proxy 2D|không khẳng định/i);
});

test('object interaction proxy does not infer manipulation from object motion without a nearby hand', () => {
  const tracker = new objectInteraction.ObjectInteractionTracker();
  const state = tracker.update({
    nodes: [{
      id: 'cup-1', label: 'cup', score: 0.88,
      box: { x: 0.3, y: 0.4, width: 0.12, height: 0.18 },
      centerX: 0.36, centerY: 0.49, kind: 'object',
    }],
    relations: [], focus: null, pointerActive: false, peopleCount: 0,
    events: [{ id: 'scene-2', type: 'object_moved', label: 'cup', distance: 0.2, at: 1200 }],
    updatedAt: 1200,
  }, [], 1200);
  assert.equal(state.stage, 'none');
  assert.equal(objectInteraction.objectInteractionPrompt(state, 1200), '');
});

test('object interaction proxy links hand-near disappearance to conservative possible_reposition', () => {
  const tracker = new objectInteraction.ObjectInteractionTracker();
  const node = {
    id: 'phone-old', label: 'cell phone', score: 0.91,
    box: { x: 0.44, y: 0.42, width: 0.16, height: 0.2 },
    centerX: 0.52, centerY: 0.52, kind: 'object',
  };
  const hand = [{
    handedness: 'Left', x: 0.52, y: 0.52, pinching: false, gesture: 'Open_Palm', score: 0.7,
  }];
  tracker.update({
    nodes: [node], relations: [], focus: null, pointerActive: false, peopleCount: 0, events: [], updatedAt: 1000,
  }, hand, 1000);
  tracker.update({
    nodes: [], relations: [], focus: null, pointerActive: false, peopleCount: 0,
    events: [{ id: 'scene-3', type: 'object_left', label: 'cell phone', at: 1400 }],
    updatedAt: 1400,
  }, [], 1400);
  const state = tracker.update({
    nodes: [{
      ...node, id: 'phone-new', centerX: 0.76, box: { ...node.box, x: 0.68 },
    }],
    relations: [], focus: null, pointerActive: false, peopleCount: 0,
    events: [
      { id: 'scene-3', type: 'object_left', label: 'cell phone', at: 1400 },
      { id: 'scene-4', type: 'object_relocated', label: 'cell phone', distance: 0.24, at: 2400 },
    ],
    updatedAt: 2400,
  }, [], 2400);
  assert.equal(state.stage, 'possible_reposition');
  assert.equal(state.objectLabel, 'cell phone');
  assert.match(state.note, /không đủ bằng chứng/i);
});


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

test('action sequence v12 links approach, occlusion and stable reappearance elsewhere', () => {
  const tracker = new actionSequence.ActionSequenceTracker();
  const cup = actionNode('cup-1', 'cup', 0.4, 0.4);

  tracker.update(actionGraph([cup], [], 1000), [{
    handedness: 'Right', x: 0.18, y: 0.5, pinching: false, gesture: 'Open_Palm', score: 0.72,
  }], 1000);

  let state = tracker.update(actionGraph([cup], [], 1400), [{
    handedness: 'Right', x: 0.39, y: 0.5, pinching: true, gesture: 'None', score: 0.7,
  }], 1400);
  assert.equal(state.stage, 'hand_approach');

  state = tracker.update(actionGraph([], [{
    id: 'scene-v12-1', type: 'object_left', label: 'cup', at: 1700,
  }], 1700), [], 1700);
  assert.equal(state.stage, 'object_occluded');

  const moved = actionNode('cup-2', 'cup', 0.7, 0.4, 0.92);
  state = tracker.update(actionGraph([moved], [
    { id: 'scene-v12-1', type: 'object_left', label: 'cup', at: 1700 },
    { id: 'scene-v12-2', type: 'object_relocated', label: 'cup', distance: 0.3, at: 2400 },
  ], 2400), [], 2400);
  assert.equal(state.stage, 'object_reappeared');

  state = tracker.update(actionGraph([moved], [
    { id: 'scene-v12-1', type: 'object_left', label: 'cup', at: 1700 },
    { id: 'scene-v12-2', type: 'object_relocated', label: 'cup', distance: 0.3, at: 2400 },
  ], 2750), [], 2750);
  assert.equal(state.stage, 'possible_reposition_sequence');
  assert.deepEqual(state.steps, ['hand_approach', 'object_occluded', 'object_reappeared_elsewhere']);
  assert.match(actionSequence.actionSequencePrompt(state, 2750), /possible temporal sequence|proxy 2D/i);
});

test('action sequence v12 rebinds detector ID near the old box instead of inventing occlusion', () => {
  const tracker = new actionSequence.ActionSequenceTracker();
  const oldCup = actionNode('cup-old', 'cup', 0.4, 0.4);

  tracker.update(actionGraph([oldCup], [], 1000), [{
    handedness: 'Right', x: 0.18, y: 0.5, pinching: false, gesture: 'Open_Palm', score: 0.7,
  }], 1000);
  tracker.update(actionGraph([oldCup], [], 1400), [{
    handedness: 'Right', x: 0.39, y: 0.5, pinching: true, gesture: 'None', score: 0.7,
  }], 1400);

  const rebound = actionNode('cup-new-id', 'cup', 0.415, 0.405, 0.91);
  const state = tracker.update(actionGraph([rebound], [
    { id: 'scene-v12-id-1', type: 'object_left', label: 'cup', at: 1650 },
    { id: 'scene-v12-id-2', type: 'object_returned', label: 'cup', distance: 0.02, at: 1650 },
  ], 1650), [], 1650);

  assert.equal(state.stage, 'hand_approach');
  assert.equal(state.identityRebound, true);
  assert.equal(state.objectId, 'cup-new-id');
});

test('action sequence v12 suppresses sequence advancement during coherent camera shake', () => {
  const tracker = new actionSequence.ActionSequenceTracker();
  const cupA = actionNode('cup-1', 'cup', 0.34, 0.4);
  const bookA = actionNode('book-1', 'book', 0.62, 0.38);

  tracker.update(actionGraph([cupA, bookA], [], 1000), [{
    handedness: 'Right', x: 0.1, y: 0.5, pinching: false, gesture: 'Open_Palm', score: 0.7,
  }], 1000);

  const cupB = actionNode('cup-1', 'cup', 0.38, 0.4);
  const bookB = actionNode('book-1', 'book', 0.66, 0.38);
  const state = tracker.update(actionGraph([cupB, bookB], [{
    id: 'scene-v12-shake', type: 'object_moved', label: 'cup', distance: 0.04, at: 1400,
  }], 1400), [{
    handedness: 'Right', x: 0.37, y: 0.5, pinching: true, gesture: 'None', score: 0.75,
  }], 1400);

  assert.equal(state.stage, 'idle');
  assert.equal(state.cameraStable, false);
  assert.ok(state.cameraMotion >= 0.028);
});

test('action sequence v12 confidence decays instead of staying latched', () => {
  const tracker = new actionSequence.ActionSequenceTracker();
  const phone = actionNode('phone-1', 'cell phone', 0.4, 0.4);

  tracker.update(actionGraph([phone], [], 1000), [{
    handedness: 'Left', x: 0.18, y: 0.5, pinching: false, gesture: 'Open_Palm', score: 0.72,
  }], 1000);
  tracker.update(actionGraph([phone], [], 1400), [{
    handedness: 'Left', x: 0.39, y: 0.5, pinching: true, gesture: 'None', score: 0.72,
  }], 1400);
  tracker.update(actionGraph([], [{
    id: 'scene-v12-decay-1', type: 'object_left', label: 'cell phone', at: 1700,
  }], 1700), [], 1700);

  const moved = actionNode('phone-2', 'cell phone', 0.72, 0.4, 0.93);
  tracker.update(actionGraph([moved], [
    { id: 'scene-v12-decay-1', type: 'object_left', label: 'cell phone', at: 1700 },
    { id: 'scene-v12-decay-2', type: 'object_relocated', label: 'cell phone', distance: 0.32, at: 2300 },
  ], 2300), [], 2300);
  const completed = tracker.update(actionGraph([moved], [
    { id: 'scene-v12-decay-1', type: 'object_left', label: 'cell phone', at: 1700 },
    { id: 'scene-v12-decay-2', type: 'object_relocated', label: 'cell phone', distance: 0.32, at: 2300 },
  ], 2650), [], 2650);

  const later = tracker.update(actionGraph([moved], [
    { id: 'scene-v12-decay-1', type: 'object_left', label: 'cell phone', at: 1700 },
    { id: 'scene-v12-decay-2', type: 'object_relocated', label: 'cell phone', distance: 0.32, at: 2300 },
  ], 3850), [], 3850);

  assert.equal(later.stage, 'possible_reposition_sequence');
  assert.ok(later.confidence < completed.confidence);
});


function v13Guard(cameraStable = true, cameraMotion = 0) {
  return {
    stage: 'idle',
    sequenceId: 0,
    objectId: '',
    objectLabel: '',
    handedness: '',
    confidence: 0,
    startedAt: 0,
    updatedAt: 0,
    cameraMotion,
    cameraStable,
    identityRebound: false,
    steps: [],
    note: '',
  };
}

test('causal action graph v13 keeps multiple hypotheses in parallel', () => {
  const tracker = new causalActionGraph.CausalActionGraphTracker();
  const cup = actionNode('cup-v13', 'cup', 0.28, 0.4);
  const book = actionNode('book-v13', 'book', 0.62, 0.4);

  tracker.update(actionGraph([cup, book], [], 1000), [
    { handedness: 'Left', x: 0.08, y: 0.5, pinching: false, gesture: 'Open_Palm', score: 0.7 },
    { handedness: 'Right', x: 0.92, y: 0.5, pinching: false, gesture: 'Open_Palm', score: 0.7 },
  ], v13Guard(), 1000);

  const state = tracker.update(actionGraph([cup, book], [], 1400), [
    { handedness: 'Left', x: 0.27, y: 0.5, pinching: true, gesture: 'None', score: 0.75 },
    { handedness: 'Right', x: 0.79, y: 0.5, pinching: true, gesture: 'None', score: 0.75 },
  ], v13Guard(), 1400);

  assert.equal(state.competingCount, 2);
  assert.equal(state.hypotheses.length, 2);
  assert.equal(state.leader, null);
});

test('causal action graph v13 completes four-step evidence chain before exposing a leader', () => {
  const tracker = new causalActionGraph.CausalActionGraphTracker();
  const cup = actionNode('cup-v13-a', 'cup', 0.4, 0.4);

  tracker.update(actionGraph([cup], [], 1000), [{
    handedness: 'Right', x: 0.18, y: 0.5, pinching: false, gesture: 'Open_Palm', score: 0.72,
  }], v13Guard(), 1000);
  tracker.update(actionGraph([cup], [], 1400), [{
    handedness: 'Right', x: 0.39, y: 0.5, pinching: true, gesture: 'None', score: 0.76,
  }], v13Guard(), 1400);

  let state = tracker.update(actionGraph([], [{
    id: 'scene-v13-left', type: 'object_left', label: 'cup', at: 1700,
  }], 1700), [], v13Guard(), 1700);
  assert.equal(state.hypotheses[0]?.stage, 'occluded');

  const moved = actionNode('cup-v13-b', 'cup', 0.66, 0.4, 0.94);
  state = tracker.update(actionGraph([moved], [
    { id: 'scene-v13-left', type: 'object_left', label: 'cup', at: 1700 },
    { id: 'scene-v13-relocated', type: 'object_relocated', label: 'cup', distance: 0.32, at: 2300 },
  ], 2300), [{
    handedness: 'Right', x: 0.75, y: 0.5, pinching: true, gesture: 'None', score: 0.75,
  }], v13Guard(), 2300);
  assert.equal(state.hypotheses[0]?.stage, 'reappeared');
  assert.equal(state.leader, null);

  state = tracker.update(actionGraph([moved], [
    { id: 'scene-v13-left', type: 'object_left', label: 'cup', at: 1700 },
    { id: 'scene-v13-relocated', type: 'object_relocated', label: 'cup', distance: 0.32, at: 2300 },
  ], 2700), [{
    handedness: 'Right', x: 0.99, y: 0.5, pinching: false, gesture: 'Open_Palm', score: 0.7,
  }], v13Guard(), 2700);

  assert.equal(state.leader?.stage, 'supported');
  assert.equal(state.leader?.objectLabel, 'cup');
  assert.ok((state.leader?.evidence.length || 0) >= 4);
  assert.match(causalActionGraph.causalActionGraphPrompt(state, 2700), /leading hypothesis|không chứng minh nguyên nhân/i);
});

test('causal action graph v13 rebinds near ID switch instead of creating disappearance evidence', () => {
  const tracker = new causalActionGraph.CausalActionGraphTracker();
  const cup = actionNode('cup-v13-old', 'cup', 0.4, 0.4);

  tracker.update(actionGraph([cup], [], 1000), [{
    handedness: 'Left', x: 0.18, y: 0.5, pinching: false, gesture: 'Open_Palm', score: 0.7,
  }], v13Guard(), 1000);
  tracker.update(actionGraph([cup], [], 1400), [{
    handedness: 'Left', x: 0.39, y: 0.5, pinching: true, gesture: 'None', score: 0.75,
  }], v13Guard(), 1400);

  const rebound = actionNode('cup-v13-new', 'cup', 0.415, 0.405, 0.91);
  const state = tracker.update(actionGraph([rebound], [{
    id: 'scene-v13-id-left', type: 'object_left', label: 'cup', at: 1650,
  }], 1650), [], v13Guard(), 1650);

  assert.equal(state.hypotheses[0]?.stage, 'approach');
  assert.equal(state.hypotheses[0]?.identityRebound, true);
  assert.ok(state.hypotheses[0]?.evidence.some((item) => item.kind === 'identity_rebind'));
});

test('causal action graph v13 suppresses near-position detector return alternative', () => {
  const tracker = new causalActionGraph.CausalActionGraphTracker();
  const cup = actionNode('cup-v13-return-a', 'cup', 0.4, 0.4);

  tracker.update(actionGraph([cup], [], 1000), [{
    handedness: 'Right', x: 0.18, y: 0.5, pinching: false, gesture: 'Open_Palm', score: 0.7,
  }], v13Guard(), 1000);
  tracker.update(actionGraph([cup], [], 1400), [{
    handedness: 'Right', x: 0.39, y: 0.5, pinching: true, gesture: 'None', score: 0.75,
  }], v13Guard(), 1400);
  tracker.update(actionGraph([], [{
    id: 'scene-v13-return-left', type: 'object_left', label: 'cup', at: 1700,
  }], 1700), [], v13Guard(), 1700);

  const returned = actionNode('cup-v13-return-b', 'cup', 0.42, 0.405, 0.9);
  const state = tracker.update(actionGraph([returned], [
    { id: 'scene-v13-return-left', type: 'object_left', label: 'cup', at: 1700 },
    { id: 'scene-v13-return', type: 'object_returned', label: 'cup', distance: 0.02, at: 2200 },
  ], 2200), [], v13Guard(), 2200);

  assert.equal(state.competingCount, 0);
  assert.equal(state.leader, null);
});

test('causal action graph v13 does not advance evidence while camera motion guard is active', () => {
  const tracker = new causalActionGraph.CausalActionGraphTracker();
  const cup = actionNode('cup-v13-shake', 'cup', 0.4, 0.4);

  tracker.update(actionGraph([cup], [], 1000), [{
    handedness: 'Right', x: 0.18, y: 0.5, pinching: false, gesture: 'Open_Palm', score: 0.7,
  }], v13Guard(false, 0.05), 1000);

  const state = tracker.update(actionGraph([cup], [], 1400), [{
    handedness: 'Right', x: 0.39, y: 0.5, pinching: true, gesture: 'None', score: 0.75,
  }], v13Guard(false, 0.05), 1400);

  assert.equal(state.hypotheses.length, 0);
  assert.equal(state.cameraStable, false);
});


test('affect presentation waits for a stable visual signal before showing a label', () => {
  const reading = affectControl.describeAffectSignal({
    faceSeen: true,
    mood: 'happy',
    confidence: 0.31,
    faceChannel: 0.3,
  });
  assert.equal(reading.ready, false);
  assert.equal(reading.label, 'Đang đọc biểu cảm');

  const stable = affectControl.describeAffectSignal({
    faceSeen: true,
    mood: 'happy',
    confidence: 0.63,
    faceChannel: 0.58,
  });
  assert.equal(stable.ready, true);
  assert.equal(stable.label, 'Tín hiệu tích cực');
});

test('face nod only starts listening when voice is already ready and face lock is reliable', () => {
  assert.equal(affectControl.resolveFaceControlAction({
    faceSeen: true,
    faceConfidence: 0.72,
    headGesture: 'nod',
    state: 'idle',
    voiceReady: true,
  }), 'listen');
  assert.equal(affectControl.resolveFaceControlAction({
    faceSeen: true,
    faceConfidence: 0.72,
    headGesture: 'nod',
    state: 'idle',
    voiceReady: false,
  }), 'none');
});

test('face shake can interrupt active Mira speech but not trigger an unrelated idle action', () => {
  assert.equal(affectControl.resolveFaceControlAction({
    faceSeen: true,
    faceConfidence: 0.72,
    headGesture: 'shake',
    state: 'speaking',
    voiceReady: true,
  }), 'interrupt');
  assert.equal(affectControl.resolveFaceControlAction({
    faceSeen: true,
    faceConfidence: 0.72,
    headGesture: 'shake',
    state: 'idle',
    voiceReady: true,
  }), 'none');
});

test('face control refuses low-confidence head movement', () => {
  assert.equal(affectControl.resolveFaceControlAction({
    faceSeen: true,
    faceConfidence: 0.4,
    headGesture: 'shake',
    state: 'thinking',
    voiceReady: true,
  }), 'none');
});


test('facial social control requires temporal confirmation before a wink action', () => {
  const tracker = new faceSocialControl.FaceSocialControlTracker();
  let event = tracker.update({
    faceSeen: true, faceConfidence: 0.82, gesture: 'wink_left', gestureConfidence: 0.86,
  }, 1000);
  assert.equal(event.action, 'none');

  event = tracker.update({
    faceSeen: true, faceConfidence: 0.82, gesture: 'wink_left', gestureConfidence: 0.86,
  }, 1120);
  assert.equal(event.action, 'toggle_affect');
  assert.equal(event.cue, 'wink_left');
});

test('facial social control rejects low-confidence wink classification', () => {
  const tracker = new faceSocialControl.FaceSocialControlTracker();
  tracker.update({
    faceSeen: true, faceConfidence: 0.8, gesture: 'wink_right', gestureConfidence: 0.54,
  }, 1000);
  const event = tracker.update({
    faceSeen: true, faceConfidence: 0.8, gesture: 'wink_right', gestureConfidence: 0.54,
  }, 1200);
  assert.equal(event.action, 'none');
});

test('facial social control requires release before the same gesture can fire again', () => {
  const tracker = new faceSocialControl.FaceSocialControlTracker();
  tracker.update({
    faceSeen: true, faceConfidence: 0.8, gesture: 'wink_right', gestureConfidence: 0.9,
  }, 1000);
  let event = tracker.update({
    faceSeen: true, faceConfidence: 0.8, gesture: 'wink_right', gestureConfidence: 0.9,
  }, 1120);
  assert.equal(event.action, 'cycle_theme');

  event = tracker.update({
    faceSeen: true, faceConfidence: 0.8, gesture: 'wink_right', gestureConfidence: 0.9,
  }, 1300);
  assert.equal(event.action, 'none');

  tracker.update({
    faceSeen: true, faceConfidence: 0.8, gesture: 'none', gestureConfidence: 0,
  }, 1400);
  tracker.update({
    faceSeen: true, faceConfidence: 0.8, gesture: 'wink_right', gestureConfidence: 0.9,
  }, 2800);
  event = tracker.update({
    faceSeen: true, faceConfidence: 0.8, gesture: 'wink_right', gestureConfidence: 0.9,
  }, 2920);
  assert.equal(event.action, 'cycle_theme');
});

test('smile and brow raise create social cues without destructive UI actions', () => {
  const smileTracker = new faceSocialControl.FaceSocialControlTracker();
  smileTracker.update({
    faceSeen: true, faceConfidence: 0.82, gesture: 'smile', gestureConfidence: 0.78,
  }, 1000);
  smileTracker.update({
    faceSeen: true, faceConfidence: 0.82, gesture: 'smile', gestureConfidence: 0.78,
  }, 1220);
  const smile = smileTracker.update({
    faceSeen: true, faceConfidence: 0.82, gesture: 'smile', gestureConfidence: 0.78,
  }, 1440);
  assert.equal(smile.cue, 'smile');
  assert.equal(smile.action, 'none');

  assert.equal(faceSocialControl.gazePresenceLabel('focused'), 'Ánh nhìn · Kết nối');
  assert.equal(faceSocialControl.gazePresenceLabel('looking_away'), 'Ánh nhìn · Lệch');
});


test('presence continuity treats short absence as a silent reconnect micro-response', () => {
  const tracker = new presenceContinuity.PresenceContinuityTracker();
  tracker.update({ faceSeen: true, interactionState: 'engaged', attention: 0.7 }, 1000);
  tracker.update({ faceSeen: false, interactionState: 'absent', attention: 0 }, 2000);
  tracker.update({ faceSeen: false, interactionState: 'absent', attention: 0 }, 5000);
  const returned = tracker.update({ faceSeen: true, interactionState: 'returning', attention: 0.68 }, 5200);
  assert.equal(returned.mode, 'reconnect');
  assert.equal(returned.cue, 'return');
  assert.ok(returned.lastAwayMs >= 3000);
  assert.match(presenceContinuity.presenceContinuityPrompt(returned), /tiếp tục tự nhiên|không cần chào lại/i);
});

test('presence continuity emits one focus pulse after stable focused gaze', () => {
  const tracker = new presenceContinuity.PresenceContinuityTracker();
  tracker.update({ faceSeen: true, interactionState: 'focused', attention: 0.82 }, 1000);
  tracker.update({ faceSeen: true, interactionState: 'focused', attention: 0.84 }, 2200);
  const focused = tracker.update({ faceSeen: true, interactionState: 'focused', attention: 0.86 }, 2900);
  assert.equal(focused.mode, 'attentive');
  assert.equal(focused.cue, 'focus');
  assert.ok(focused.focusedMs >= 1800);

  const stillFocused = tracker.update({ faceSeen: true, interactionState: 'focused', attention: 0.86 }, 3200);
  assert.equal(stillFocused.cueId, focused.cueId);
});

test('presence continuity maps smile and brow events to non-verbal micro cues only', () => {
  const tracker = new presenceContinuity.PresenceContinuityTracker();
  tracker.update({ faceSeen: true, interactionState: 'engaged', attention: 0.72, socialCue: 'none' }, 1000);
  const smile = tracker.update({ faceSeen: true, interactionState: 'engaged', attention: 0.75, socialCue: 'smile' }, 1200);
  assert.equal(smile.cue, 'smile');

  tracker.update({ faceSeen: true, interactionState: 'engaged', attention: 0.75, socialCue: 'none' }, 2100);
  const brow = tracker.update({ faceSeen: true, interactionState: 'engaged', attention: 0.75, socialCue: 'brow_raise' }, 2300);
  assert.equal(brow.cue, 'brow');
});

test('presence continuity is quiet when the face remains absent and stores no durable profile', () => {
  const tracker = new presenceContinuity.PresenceContinuityTracker();
  tracker.update({ faceSeen: false, interactionState: 'absent', attention: 0 }, 1000);
  const absent = tracker.update({ faceSeen: false, interactionState: 'absent', attention: 0 }, 2400);
  assert.equal(absent.mode, 'quiet');
  assert.equal(absent.presentMs, 0);
  assert.match(presenceContinuity.presenceContinuityPrompt(absent), /không chủ động phát lời/i);
});


test('world model v14 preserves short-term object permanence with confidence decay', () => {
  const tracker = new worldModel.ShortTermWorldModelTracker();
  const cup = actionNode('world-cup-a', 'cup', 0.4, 0.4, 0.92);

  let state = tracker.update(actionGraph([cup], [], 1000), null, 1000);
  assert.equal(state.version, 14);
  assert.equal(state.objects.length, 1);
  assert.equal(state.objects[0].status, 'visible');
  const worldId = state.objects[0].id;

  state = tracker.update(actionGraph([], [
    { id: 'world-scene-left', type: 'object_left', label: 'cup', at: 2200 },
  ], 2200), null, 2200);
  assert.equal(state.objects[0].id, worldId);
  assert.equal(state.objects[0].status, 'temporarily_missing');
  const missingConfidence = state.objects[0].confidence;

  state = tracker.update(actionGraph([], [], 9000), null, 9000);
  assert.equal(state.objects[0].id, worldId);
  assert.equal(state.objects[0].status, 'temporarily_missing');
  assert.ok(state.objects[0].confidence < missingConfidence);
  assert.ok(state.objects[0].confidence > 0.12);
});

test('world model v14 conservatively rebinds one missing same-label object after relocation', () => {
  const tracker = new worldModel.ShortTermWorldModelTracker();
  const before = actionNode('world-book-a', 'book', 0.25, 0.4, 0.91);

  let state = tracker.update(actionGraph([before], [], 1000), null, 1000);
  const worldId = state.objects[0].id;

  state = tracker.update(actionGraph([], [
    { id: 'world-book-left', type: 'object_left', label: 'book', at: 2200 },
  ], 2200), null, 2200);
  assert.equal(state.objects[0].status, 'temporarily_missing');

  const after = actionNode('world-book-b', 'book', 0.7, 0.4, 0.93);
  state = tracker.update(actionGraph([after], [
    { id: 'world-book-left', type: 'object_left', label: 'book', at: 2200 },
    { id: 'world-book-relocated', type: 'object_relocated', label: 'book', distance: 0.45, at: 3000 },
  ], 3000), null, 3000);

  assert.equal(state.objects.length, 1);
  assert.equal(state.objects[0].id, worldId);
  assert.equal(state.objects[0].sourceObjectId, 'world-book-b');
  assert.equal(state.objects[0].status, 'relocated');
  assert.ok(state.objects[0].relocationDistance >= 0.12);
  assert.ok(state.events.some((event) => event.type === 'identity_rebind'));
  assert.ok(state.events.some((event) => event.type === 'relocated'));

  const prompt = worldModel.worldModelPrompt(state, 3000);
  assert.match(prompt, /MIRA_WORLD_MODEL version="14"/);
  assert.match(prompt, /không xác nhận danh tính vật thể|không suy ra ai/i);
});

test('world model v14 uses causal v13 only as supporting evidence, never proof', () => {
  const tracker = new worldModel.ShortTermWorldModelTracker();
  const phone = actionNode('world-phone-a', 'cell phone', 0.35, 0.4, 0.9);
  tracker.update(actionGraph([phone], [], 1000), null, 1000);
  tracker.update(actionGraph([], [
    { id: 'world-phone-left', type: 'object_left', label: 'cell phone', at: 2200 },
  ], 2200), null, 2200);

  const causal = {
    hypotheses: [],
    leader: {
      id: 'cause-world',
      objectId: 'world-phone-a',
      objectLabel: 'cell phone',
      handedness: 'Right',
      stage: 'supported',
      confidence: 0.82,
      startedAt: 1000,
      updatedAt: 2700,
      lastEvidenceAt: 2700,
      identityRebound: false,
      evidence: [],
      edges: [],
      note: 'support only',
    },
    competingCount: 1,
    margin: 0.2,
    cameraStable: true,
    updatedAt: 2700,
    note: '',
  };

  const moved = actionNode('world-phone-b', 'cell phone', 0.7, 0.4, 0.93);
  const state = tracker.update(actionGraph([moved], [
    { id: 'world-phone-left', type: 'object_left', label: 'cell phone', at: 2200 },
    { id: 'world-phone-relocated', type: 'object_relocated', label: 'cell phone', distance: 0.35, at: 2800 },
  ], 2800), causal, 2800);

  assert.equal(state.objects[0].supportedByActionHypothesis, true);
  assert.match(worldModel.worldModelPrompt(state, 2800), /không suy ra ai hoặc điều gì đã gây ra thay đổi/i);
});

test('world model v14 expires unresolved object memories instead of keeping them indefinitely', () => {
  const tracker = new worldModel.ShortTermWorldModelTracker();
  const bottle = actionNode('world-bottle-a', 'bottle', 0.4, 0.4, 0.9);
  tracker.update(actionGraph([bottle], [], 1000), null, 1000);
  tracker.update(actionGraph([], [], 2200), null, 2200);
  const state = tracker.update(actionGraph([], [], 32_500), null, 32_500);
  assert.equal(state.objects.length, 0);
  assert.ok(state.events.some((event) => event.type === 'expired'));
});

test('world model snapshot is read-only and reset clears session state', () => {
  const tracker = new worldModel.ShortTermWorldModelTracker();
  const laptop = actionNode('world-laptop-a', 'laptop', 0.4, 0.4, 0.92);
  tracker.update(actionGraph([laptop], [], 1000), null, 1000);
  const snapshot = tracker.snapshot(1500);
  assert.equal(snapshot.objects[0].status, 'visible');
  tracker.reset();
  assert.equal(tracker.snapshot(1600).objects.length, 0);
});


function spatialIntent(intent, at, stableMs = 0) {
  return {
    eventId: intent === 'none' ? 0 : 1,
    intent,
    gesture: intent.startsWith('pinch') ? 'None' : 'Pointing_Up',
    confidence: intent === 'none' ? 0 : 0.9,
    stableMs,
    at,
  };
}

function spatialFace(overrides = {}) {
  return {
    present: true,
    confidence: 0.82,
    gazeX: 0,
    gazeY: 0,
    yaw: 0,
    pitch: 0,
    calibrationProgress: 1,
    ...overrides,
  };
}

function spatialHand(overrides = {}) {
  return {
    present: false,
    confidence: 0,
    x: 0.5,
    y: 0.5,
    z: 0,
    pinching: false,
    direct: false,
    ...overrides,
  };
}

const centerActionTarget = [{
  id: 'theme.cycle',
  label: 'Đổi màu',
  kind: 'action',
  left: 0.42,
  top: 0.42,
  right: 0.58,
  bottom: 0.58,
  priority: 0.14,
}];

test('spatial UI uses gaze focus with pinch commit like indirect spatial input', () => {
  const controller = new spatialUiControl.SpatialUIController();

  let frame = controller.update({
    face: spatialFace(),
    hand: spatialHand({ present: true, confidence: 0.8, pinching: false }),
    gestureIntent: spatialIntent('none', 1000),
    headGesture: 'none',
    targets: centerActionTarget,
  }, 1000);
  assert.equal(frame.pointer.source, 'face');
  assert.equal(frame.focus?.id, 'theme.cycle');
  assert.equal(frame.focus?.ready, false);

  frame = controller.update({
    face: spatialFace(),
    hand: spatialHand({ present: true, confidence: 0.8, pinching: false }),
    gestureIntent: spatialIntent('none', 1320),
    headGesture: 'none',
    targets: centerActionTarget,
  }, 1320);
  assert.equal(frame.focus?.ready, true);

  frame = controller.update({
    face: spatialFace(),
    hand: spatialHand({ present: true, confidence: 0.9, pinching: true }),
    gestureIntent: spatialIntent('pinch_down', 1400),
    headGesture: 'none',
    targets: centerActionTarget,
  }, 1400);

  const activation = frame.events.find((event) => event.type === 'activate');
  assert.equal(activation?.targetId, 'theme.cycle');
  assert.equal(activation?.source, 'hand');
  assert.equal(frame.pointer.source, 'face');
});

test('spatial UI supports nod-to-activate as a face-only fallback', () => {
  const controller = new spatialUiControl.SpatialUIController();
  controller.update({
    face: spatialFace(),
    hand: spatialHand(),
    gestureIntent: spatialIntent('none', 1000),
    headGesture: 'none',
    targets: centerActionTarget,
  }, 1000);
  controller.update({
    face: spatialFace(),
    hand: spatialHand(),
    gestureIntent: spatialIntent('none', 1320),
    headGesture: 'none',
    targets: centerActionTarget,
  }, 1320);

  const frame = controller.update({
    face: spatialFace(),
    hand: spatialHand(),
    gestureIntent: spatialIntent('none', 1420),
    headGesture: 'nod',
    targets: centerActionTarget,
  }, 1420);

  const activation = frame.events.find((event) => event.type === 'activate');
  assert.equal(activation?.targetId, 'theme.cycle');
  assert.equal(activation?.source, 'face');
});

test('spatial UI switches to direct hand pointer for explicit pointing', () => {
  const controller = new spatialUiControl.SpatialUIController();
  const rightTarget = [{
    id: 'settings.open',
    label: 'Cài đặt',
    kind: 'action',
    left: 0.72,
    top: 0.42,
    right: 0.9,
    bottom: 0.58,
  }];

  controller.update({
    face: spatialFace({ present: false, confidence: 0 }),
    hand: spatialHand({ present: true, confidence: 0.86, x: 0.8, y: 0.5, direct: true }),
    gestureIntent: spatialIntent('none', 1000),
    headGesture: 'none',
    targets: rightTarget,
  }, 1000);

  let frame = controller.update({
    face: spatialFace({ present: false, confidence: 0 }),
    hand: spatialHand({ present: true, confidence: 0.86, x: 0.8, y: 0.5, direct: true }),
    gestureIntent: spatialIntent('none', 1140),
    headGesture: 'none',
    targets: rightTarget,
  }, 1140);
  assert.equal(frame.pointer.source, 'hand');
  assert.equal(frame.focus?.ready, true);

  frame = controller.update({
    face: spatialFace({ present: false, confidence: 0 }),
    hand: spatialHand({ present: true, confidence: 0.9, x: 0.8, y: 0.5, z: -0.12, pinching: true, direct: true }),
    gestureIntent: spatialIntent('pinch_down', 1220),
    headGesture: 'none',
    targets: rightTarget,
  }, 1220);
  assert.ok(frame.events.some((event) => event.type === 'activate' && event.targetId === 'settings.open'));
  assert.ok(frame.pointer.z < 0);
});

test('spatial UI emits a complete pinch-grab window lifecycle', () => {
  const controller = new spatialUiControl.SpatialUIController();
  const windowTarget = [{
    id: 'result',
    label: 'Di chuyển kết quả',
    kind: 'window',
    left: 0.42,
    top: 0.42,
    right: 0.58,
    bottom: 0.58,
  }];

  controller.update({
    face: spatialFace(),
    hand: spatialHand({ present: true, confidence: 0.82 }),
    gestureIntent: spatialIntent('none', 1000),
    headGesture: 'none',
    targets: windowTarget,
  }, 1000);
  controller.update({
    face: spatialFace(),
    hand: spatialHand({ present: true, confidence: 0.82 }),
    gestureIntent: spatialIntent('none', 1320),
    headGesture: 'none',
    targets: windowTarget,
  }, 1320);

  let frame = controller.update({
    face: spatialFace(),
    hand: spatialHand({ present: true, confidence: 0.9, x: 0.52, y: 0.48, pinching: true }),
    gestureIntent: spatialIntent('pinch_down', 1400),
    headGesture: 'none',
    targets: windowTarget,
  }, 1400);
  assert.ok(frame.events.some((event) => event.type === 'grab_start' && event.targetId === 'result'));
  assert.equal(frame.grabbing, true);

  frame = controller.update({
    face: spatialFace(),
    hand: spatialHand({ present: true, confidence: 0.9, x: 0.68, y: 0.58, pinching: true }),
    gestureIntent: spatialIntent('none', 1520),
    headGesture: 'none',
    targets: windowTarget,
  }, 1520);
  assert.ok(frame.events.some((event) => event.type === 'grab_move' && event.targetId === 'result'));

  frame = controller.update({
    face: spatialFace(),
    hand: spatialHand({ present: true, confidence: 0.9, x: 0.68, y: 0.58, pinching: false }),
    gestureIntent: spatialIntent('pinch_up', 1640, 240),
    headGesture: 'none',
    targets: windowTarget,
  }, 1640);
  assert.ok(frame.events.some((event) => event.type === 'grab_end' && event.targetId === 'result'));
  assert.equal(frame.grabbing, false);
});

test('spatial pointer mapping clamps noisy webcam gaze instead of producing invalid coordinates', () => {
  const point = spatialUiControl.faceSpatialPoint(spatialFace({
    gazeX: 4,
    gazeY: -4,
    yaw: 3,
    pitch: -3,
  }));
  assert.ok(point.x >= 0.025 && point.x <= 0.975);
  assert.ok(point.y >= 0.035 && point.y <= 0.965);
  assert.equal(point.source, 'face');
});


test('spatial hand ray is derived from index direction and mirrors camera x', () => {
  const landmarks = Array.from({ length: 21 }, () => ({ x: 0.5, y: 0.5, z: 0 }));
  landmarks[5] = { x: 0.62, y: 0.58, z: -0.05 };
  landmarks[8] = { x: 0.42, y: 0.38, z: -0.12 };
  const ray = spatialRay.handRayFromLandmarks(landmarks);
  assert.ok(ray);
  assert.ok(ray.confidence >= 0.55);
  assert.ok(Math.abs(ray.origin.x - 0.38) < 1e-6);
  assert.ok(ray.direction.x > 0);
  assert.ok(ray.direction.y < 0);
  assert.ok(ray.direction.z < 0);
});

test('spatial ray hit-test selects only explicit depth-aware target planes', () => {
  const ray = {
    origin: { x: 0.5, y: 0.5, z: -0.2 },
    direction: { x: 0, y: 0, z: 1 },
    confidence: 0.9,
    source: 'hand',
  };
  const hit = spatialRay.hitTestSpatialRay(ray, [{
    id: 'volume',
    label: 'Volume',
    left: 0.42,
    top: 0.42,
    right: 0.58,
    bottom: 0.58,
    z: 0,
    depthRadius: 0.02,
  }]);
  assert.equal(hit?.targetId, 'volume');
  assert.ok(Math.abs(hit.point.x - 0.5) < 1e-6);
  assert.ok(Math.abs(hit.point.y - 0.5) < 1e-6);
  assert.ok(Math.abs(hit.point.z) < 1e-6);
});

test('spatial depth anchor stays locked until relative z becomes stable', () => {
  const tracker = new spatialRay.SpatialDepthAnchorTracker();
  let state = tracker.begin(-0.08);
  assert.equal(state.ready, false);

  for (let i = 0; i < 6; i += 1) state = tracker.update(-0.08);
  assert.equal(state.ready, true);
  assert.ok(state.confidence > 0.5);
  assert.equal(state.normalizedDelta, 0);

  for (let i = 0; i < 8; i += 1) state = tracker.update(-0.13);
  assert.equal(state.ready, true);
  assert.ok(state.normalizedDelta > 0);
  assert.ok(state.normalizedDelta <= 1);

  const ended = tracker.end();
  assert.equal(ended.active, true);
  assert.equal(tracker.snapshot().active, false);
});

test('spatial depth anchor rejects jittery monocular depth', () => {
  const tracker = new spatialRay.SpatialDepthAnchorTracker();
  tracker.begin(-0.08);
  let state = tracker.snapshot();
  for (const z of [-0.02, -0.15, -0.03, -0.16, -0.04, -0.14, -0.02]) {
    state = tracker.update(z);
  }
  assert.equal(state.ready, false);
  assert.equal(state.normalizedDelta, 0);
});

test('spatial UI can prioritize a ray hit for an explicit depth-aware target', () => {
  const controller = new spatialUiControl.SpatialUIController();
  const targets = [{
    id: 'depth.window',
    label: 'Depth window',
    kind: 'window',
    left: 0.42,
    top: 0.42,
    right: 0.58,
    bottom: 0.58,
    z: 0,
    depthRadius: 0.02,
  }];
  const ray = {
    origin: { x: 0.5, y: 0.5, z: -0.2 },
    direction: { x: 0, y: 0, z: 1 },
    confidence: 0.9,
    source: 'hand',
  };
  const rayHit = spatialRay.hitTestSpatialRay(ray, [{
    id: 'depth.window',
    label: 'Depth window',
    left: 0.42,
    top: 0.42,
    right: 0.58,
    bottom: 0.58,
    z: 0,
    depthRadius: 0.02,
  }]);
  const input = {
    face: spatialFace({ present: false, confidence: 0 }),
    hand: spatialHand({
      present: true,
      confidence: 0.9,
      x: 0.2,
      y: 0.2,
      direct: true,
      ray,
    }),
    rayHit,
    gestureIntent: spatialIntent('none', 1000),
    headGesture: 'none',
    targets,
  };
  let frame = controller.update(input, 1000);
  assert.equal(frame.rayHit?.targetId, 'depth.window');
  assert.equal(frame.focus?.id, 'depth.window');

  frame = controller.update({
    ...input,
    gestureIntent: spatialIntent('none', 1140),
  }, 1140);
  assert.equal(frame.focus?.ready, true);
});


test('spatial anchor builds a bounded 3D collision volume from UI geometry', () => {
  const anchor = spatialAnchor.spatialAnchorFromRect({
    id: 'result.close',
    label: 'Đóng kết quả',
    kind: 'action',
    left: 0.4,
    top: 0.3,
    right: 0.5,
    bottom: 0.4,
    z: -0.08,
    depthRadius: 0.06,
  });
  assert.equal(anchor.id, 'result.close');
  assert.ok(Math.abs(anchor.center.x - 0.45) < 1e-6);
  assert.ok(Math.abs(anchor.center.y - 0.35) < 1e-6);
  assert.ok(Math.abs(anchor.center.z + 0.08) < 1e-6);
  assert.ok(anchor.halfExtents.x > 0.05);
  assert.ok(anchor.halfExtents.y > 0.05);
  assert.equal(anchor.halfExtents.z, 0.06);
});

test('fingertip collision requires x y and z to be inside the target volume', () => {
  const anchor = spatialAnchor.spatialAnchorFromRect({
    id: 'window',
    label: 'Window',
    kind: 'window',
    left: 0.4,
    top: 0.4,
    right: 0.6,
    bottom: 0.6,
    z: -0.1,
    depthRadius: 0.05,
  });
  const hit = spatialAnchor.hitTestSpatialPoint(
    { x: 0.5, y: 0.5, z: -0.11 },
    [anchor],
    0.9,
  );
  assert.equal(hit?.targetId, 'window');

  const outsideDepth = spatialAnchor.hitTestSpatialPoint(
    { x: 0.5, y: 0.5, z: 0.08 },
    [anchor],
    0.9,
  );
  assert.equal(outsideDepth, null);
});

test('direct spatial touch needs a stable dwell before contact becomes ready', () => {
  const tracker = new spatialAnchor.SpatialDirectTouchTracker();
  const anchors = [spatialAnchor.spatialAnchorFromRect({
    id: 'result',
    label: 'Di chuyển kết quả',
    kind: 'window',
    left: 0.4,
    top: 0.4,
    right: 0.6,
    bottom: 0.6,
    z: -0.08,
    depthRadius: 0.08,
  })];
  const input = {
    active: true,
    confidence: 0.9,
    point: { x: 0.5, y: 0.5, z: -0.08 },
    pinching: false,
    anchors,
  };

  let state = tracker.update(input, 1000);
  assert.equal(state.phase, 'hover');
  assert.equal(state.ready, false);

  state = tracker.update(input, 1080);
  assert.equal(state.ready, false);

  state = tracker.update(input, 1100);
  assert.equal(state.phase, 'contact');
  assert.equal(state.ready, true);
  assert.equal(state.targetId, 'result');
});

test('direct spatial touch enters holding only after stable contact plus pinch', () => {
  const tracker = new spatialAnchor.SpatialDirectTouchTracker();
  const anchors = [spatialAnchor.spatialAnchorFromRect({
    id: 'camera',
    label: 'Di chuyển camera',
    kind: 'window',
    left: 0.4,
    top: 0.4,
    right: 0.6,
    bottom: 0.6,
    z: -0.05,
    depthRadius: 0.08,
  })];
  const base = {
    active: true,
    confidence: 0.88,
    point: { x: 0.5, y: 0.5, z: -0.05 },
    anchors,
  };
  tracker.update({ ...base, pinching: false }, 1000);
  tracker.update({ ...base, pinching: false }, 1100);
  const state = tracker.update({ ...base, pinching: true }, 1120);
  assert.equal(state.ready, true);
  assert.equal(state.phase, 'holding');
  assert.equal(state.pinching, true);
});

test('direct spatial touch rejects weak confidence and passing hands', () => {
  const tracker = new spatialAnchor.SpatialDirectTouchTracker();
  const anchors = [spatialAnchor.spatialAnchorFromRect({
    id: 'theme.cycle',
    label: 'Đổi màu',
    kind: 'action',
    left: 0.4,
    top: 0.4,
    right: 0.6,
    bottom: 0.6,
    z: 0,
    depthRadius: 0.1,
  })];

  let state = tracker.update({
    active: true,
    confidence: 0.4,
    point: { x: 0.5, y: 0.5, z: 0 },
    pinching: false,
    anchors,
  }, 1000);
  assert.equal(state.phase, 'idle');
  assert.equal(state.ready, false);

  state = tracker.update({
    active: true,
    confidence: 0.9,
    point: { x: 0.5, y: 0.5, z: 0 },
    pinching: false,
    anchors,
  }, 1100);
  assert.equal(state.phase, 'hover');

  state = tracker.update({
    active: true,
    confidence: 0.9,
    point: { x: 0.9, y: 0.9, z: 0.4 },
    pinching: false,
    anchors,
  }, 1250);
  assert.equal(state.phase, 'idle');
  assert.equal(state.targetId, '');
});


test('spatial object runtime supports grab move depth and release', () => {
  const runtime = new spatialObject.SpatialObjectRuntime([{
    id: 'mira.core',
    label: 'Mira Core',
  }]);

  let object = runtime.beginGrab('mira.core', { x: 0.5, y: 0.5, z: -0.08 });
  assert.equal(object?.grabbed, true);

  object = runtime.moveGrab(
    { x: 0.62, y: 0.42, z: -0.12 },
    { depthDelta: 0.4, xyGain: 1, depthGain: 0.5 },
  );
  assert.ok(object);
  assert.ok(object.pose.position.x > 0.1);
  assert.ok(object.pose.position.y < -0.05);
  assert.ok(object.pose.position.z > 0.15);

  object = runtime.endGrab();
  assert.equal(object?.grabbed, false);
});

test('spatial object runtime clamps pose and transform boundaries', () => {
  const runtime = new spatialObject.SpatialObjectRuntime([{
    id: 'mira.core',
    label: 'Mira Core',
    minScale: 0.72,
    maxScale: 1.65,
  }]);
  runtime.beginGrab('mira.core', { x: 0.5, y: 0.5, z: 0 });
  let object = runtime.moveGrab(
    { x: 2, y: -2, z: 2 },
    { xyGain: 3, depthGain: 2 },
  );
  assert.equal(object?.pose.position.x, 0.48);
  assert.equal(object?.pose.position.y, -0.48);
  assert.equal(object?.pose.position.z, 0.7);

  object = runtime.applyTransform('mira.core', { scale: 9, rotation: 420 });
  assert.equal(object?.pose.scale, 1.65);
  assert.equal(object?.pose.rotation, 60);
});

test('spatial object cancel restores the pre-grab pose', () => {
  const runtime = new spatialObject.SpatialObjectRuntime([{
    id: 'mira.core',
    label: 'Mira Core',
    pose: { position: { x: 0.08, y: -0.06, z: 0.1 }, scale: 1.1, rotation: 8 },
  }]);
  const before = runtime.get('mira.core');
  runtime.beginGrab('mira.core', { x: 0.4, y: 0.4, z: 0 });
  runtime.moveGrab({ x: 0.7, y: 0.7, z: 0.2 });
  const restored = runtime.cancelGrab();

  assert.deepEqual(restored?.pose, before?.pose);
  assert.equal(restored?.grabbed, false);
});

test('spatial object transform supports two-hand scale and rotation updates', () => {
  const runtime = new spatialObject.SpatialObjectRuntime([{
    id: 'mira.core',
    label: 'Mira Core',
  }]);
  const object = runtime.applyTransform('mira.core', {
    scale: 1,
    scaleRatio: 1.3,
    rotation: 10,
    rotationDelta: 22,
  });
  assert.ok(object);
  assert.ok(Math.abs(object.pose.scale - 1.3) < 1e-6);
  assert.equal(object.pose.rotation, 32);
});

test('spatial UI emits object grab lifecycle without auto-activating it', () => {
  const controller = new spatialUiControl.SpatialUIController();
  const objectTarget = [{
    id: 'mira.core',
    label: 'Mira Core',
    kind: 'object',
    left: 0.42,
    top: 0.42,
    right: 0.58,
    bottom: 0.58,
  }];

  controller.update({
    face: spatialFace({ present: false, confidence: 0 }),
    hand: spatialHand({ present: true, confidence: 0.9, x: 0.5, y: 0.5, direct: true }),
    gestureIntent: spatialIntent('none', 1000),
    headGesture: 'none',
    targets: objectTarget,
  }, 1000);
  controller.update({
    face: spatialFace({ present: false, confidence: 0 }),
    hand: spatialHand({ present: true, confidence: 0.9, x: 0.5, y: 0.5, direct: true }),
    gestureIntent: spatialIntent('none', 1140),
    headGesture: 'none',
    targets: objectTarget,
  }, 1140);

  let frame = controller.update({
    face: spatialFace({ present: false, confidence: 0 }),
    hand: spatialHand({ present: true, confidence: 0.9, x: 0.5, y: 0.5, pinching: true, direct: true }),
    gestureIntent: spatialIntent('pinch_down', 1220),
    headGesture: 'none',
    targets: objectTarget,
  }, 1220);
  assert.ok(frame.events.some((event) =>
    event.type === 'grab_start' &&
    event.targetId === 'mira.core' &&
    event.targetKind === 'object'
  ));
  assert.equal(frame.events.some((event) => event.type === 'activate'), false);

  frame = controller.update({
    face: spatialFace({ present: false, confidence: 0 }),
    hand: spatialHand({ present: true, confidence: 0.9, x: 0.6, y: 0.52, pinching: true, direct: true }),
    gestureIntent: spatialIntent('none', 1300),
    headGesture: 'none',
    targets: objectTarget,
  }, 1300);
  assert.ok(frame.events.some((event) => event.type === 'grab_move' && event.targetKind === 'object'));

  frame = controller.update({
    face: spatialFace({ present: false, confidence: 0 }),
    hand: spatialHand({ present: true, confidence: 0.9, x: 0.6, y: 0.52, pinching: false, direct: true }),
    gestureIntent: spatialIntent('pinch_up', 1420),
    headGesture: 'none',
    targets: objectTarget,
  }, 1420);
  assert.ok(frame.events.some((event) => event.type === 'grab_end' && event.targetKind === 'object'));
});


test('spatial world resolves parent child anchor pose', () => {
  const world = new spatialWorld.SpatialWorldRuntime();
  world.setAnchors([{
    id: 'root',
    label: 'Root',
    kind: 'workspace',
    pose: { position: { x: 0.1, y: 0.2, z: 0.05 }, scale: 1, rotation: 0 },
    snapRadius: 0.05,
  }, {
    id: 'surface',
    label: 'Surface',
    kind: 'surface',
    parentId: 'root',
    pose: { position: { x: 0.2, y: -0.1, z: 0.1 }, scale: 1, rotation: 0 },
    snapRadius: 0.05,
  }, {
    id: 'dock',
    label: 'Dock',
    kind: 'dock',
    parentId: 'surface',
    pose: { position: { x: 0, y: -0.05, z: 0.02 }, scale: 1, rotation: 0 },
    snapRadius: 0.16,
  }]);

  const pose = world.resolveAnchorPose('dock');
  assert.ok(pose);
  assert.ok(Math.abs(pose.position.x - 0.3) < 1e-6);
  assert.ok(Math.abs(pose.position.y - 0.05) < 1e-6);
  assert.ok(Math.abs(pose.position.z - 0.17) < 1e-6);
});

test('spatial world snaps object to nearest eligible anchor', () => {
  const world = new spatialWorld.SpatialWorldRuntime();
  world.setAnchors([{
    id: 'dock.left',
    label: 'Left dock',
    kind: 'dock',
    pose: { position: { x: -0.2, y: 0, z: 0 }, scale: 1, rotation: 0 },
    snapRadius: 0.14,
    priority: 0.2,
  }, {
    id: 'dock.right',
    label: 'Right dock',
    kind: 'dock',
    pose: { position: { x: 0.24, y: 0, z: 0 }, scale: 1, rotation: 0 },
    snapRadius: 0.14,
    priority: 0.2,
  }]);

  const snap = world.snapObject('mira.core', {
    position: { x: 0.2, y: 0.01, z: 0 },
    scale: 1.2,
    rotation: 12,
  }, 1000);

  assert.equal(snap?.anchorId, 'dock.right');
  assert.ok(Math.abs(snap.worldPose.position.x - 0.24) < 1e-6);
  assert.equal(snap.worldPose.scale, 1.2);
  assert.equal(snap.worldPose.rotation, 12);
  assert.equal(world.attachment('mira.core')?.anchorId, 'dock.right');
});

test('attached spatial object follows a moved parent anchor', () => {
  const world = new spatialWorld.SpatialWorldRuntime();
  world.setAnchors([{
    id: 'surface.camera',
    label: 'Camera',
    kind: 'surface',
    pose: { position: { x: 0.1, y: 0.1, z: 0 }, scale: 1, rotation: 0 },
    snapRadius: 0.04,
  }, {
    id: 'dock.camera',
    label: 'Camera dock',
    kind: 'dock',
    parentId: 'surface.camera',
    pose: { position: { x: 0, y: -0.05, z: 0.02 }, scale: 1, rotation: 0 },
    snapRadius: 0.16,
  }]);

  const snap = world.snapObject('mira.core', {
    position: { x: 0.1, y: 0.05, z: 0.02 },
    scale: 1,
    rotation: 0,
  }, 1000);
  assert.equal(snap?.anchorId, 'dock.camera');

  world.setAnchors([{
    id: 'surface.camera',
    label: 'Camera',
    kind: 'surface',
    pose: { position: { x: 0.3, y: 0.2, z: 0.1 }, scale: 1, rotation: 0 },
    snapRadius: 0.04,
  }, {
    id: 'dock.camera',
    label: 'Camera dock',
    kind: 'dock',
    parentId: 'surface.camera',
    pose: { position: { x: 0, y: -0.05, z: 0.02 }, scale: 1, rotation: 0 },
    snapRadius: 0.16,
  }]);

  const followed = world.resolveObjectPose('mira.core');
  assert.ok(followed);
  assert.ok(Math.abs(followed.position.x - 0.3) < 1e-6);
  assert.ok(Math.abs(followed.position.y - 0.15) < 1e-6);
  assert.ok(Math.abs(followed.position.z - 0.12) < 1e-6);
});

test('spatial world detaches object when released outside all snap radii', () => {
  const world = new spatialWorld.SpatialWorldRuntime();
  world.setAnchors([{
    id: 'dock.home',
    label: 'Home',
    kind: 'dock',
    pose: { position: { x: 0, y: 0, z: 0 }, scale: 1, rotation: 0 },
    snapRadius: 0.1,
  }]);
  world.attachObject('mira.core', 'dock.home', {
    position: { x: 0, y: 0, z: 0 },
    scale: 1,
    rotation: 0,
  }, 1000);

  const snap = world.snapObject('mira.core', {
    position: { x: 0.4, y: 0.4, z: 0.4 },
    scale: 1,
    rotation: 0,
  }, 1200);
  assert.equal(snap, null);
  assert.equal(world.attachment('mira.core'), null);
});

test('spatial world rejects cyclic parent anchor graphs', () => {
  const world = new spatialWorld.SpatialWorldRuntime();
  world.setAnchors([{
    id: 'a',
    label: 'A',
    kind: 'surface',
    parentId: 'b',
    pose: { position: { x: 0, y: 0, z: 0 }, scale: 1, rotation: 0 },
    snapRadius: 0.1,
  }, {
    id: 'b',
    label: 'B',
    kind: 'surface',
    parentId: 'a',
    pose: { position: { x: 0, y: 0, z: 0 }, scale: 1, rotation: 0 },
    snapRadius: 0.1,
  }]);
  assert.equal(world.resolveAnchorPose('a'), null);
  assert.equal(world.resolveAnchorPose('b'), null);
});

test('spatial object setPose accepts resolved world pose while preserving limits', () => {
  const runtime = new spatialObject.SpatialObjectRuntime([{
    id: 'mira.core',
    label: 'Mira Core',
    minScale: 0.72,
    maxScale: 1.65,
  }]);
  const object = runtime.setPose('mira.core', {
    position: { x: 2, y: -2, z: 2 },
    scale: 4,
    rotation: 390,
  });
  assert.equal(object?.pose.position.x, 0.48);
  assert.equal(object?.pose.position.y, -0.48);
  assert.equal(object?.pose.position.z, 0.7);
  assert.equal(object?.pose.scale, 1.65);
  assert.equal(object?.pose.rotation, 30);
});


test('spatial placement preview increases magnetic strength near an anchor', () => {
  const world = new spatialWorld.SpatialWorldRuntime();
  world.setAnchors([{
    id: 'dock.center',
    label: 'Center',
    kind: 'dock',
    pose: { position: { x: 0, y: 0, z: 0 }, scale: 1, rotation: 0 },
    snapRadius: 0.2,
    priority: 0.2,
  }]);

  const far = world.previewSnapObject('mira.core', {
    position: { x: 0.18, y: 0, z: 0 },
    scale: 1,
    rotation: 0,
  });
  const near = world.previewSnapObject('mira.core', {
    position: { x: 0.05, y: 0, z: 0 },
    scale: 1,
    rotation: 0,
  });

  assert.ok(far);
  assert.ok(near);
  assert.ok(near.strength > far.strength);
  assert.ok(Math.abs(near.targetPose.position.x) < 1e-6);
  assert.ok(Math.abs(near.worldPose.position.x) < 0.05);
});

test('surface constraint projects placement to the nearest point on the plane', () => {
  const world = new spatialWorld.SpatialWorldRuntime();
  world.setAnchors([{
    id: 'surface.result',
    label: 'Result surface',
    kind: 'surface',
    pose: { position: { x: 0, y: 0, z: 0.1 }, scale: 1, rotation: 0 },
    snapRadius: 0.2,
    constraint: {
      axis: 'xy',
      halfExtents: { x: 0.2, y: 0.1, z: 0.04 },
      offset: 0,
    },
  }]);

  const preview = world.previewSnapObject('mira.core', {
    position: { x: 0.15, y: 0.08, z: 0.18 },
    scale: 1,
    rotation: 0,
  });

  assert.ok(preview);
  assert.equal(preview.constrained, true);
  assert.equal(preview.anchorKind, 'surface');
  assert.ok(Math.abs(preview.targetPose.position.x - 0.15) < 1e-6);
  assert.ok(Math.abs(preview.targetPose.position.y - 0.08) < 1e-6);
  assert.ok(Math.abs(preview.targetPose.position.z - 0.1) < 1e-6);
});

test('surface constraint clamps placement to plane bounds', () => {
  const world = new spatialWorld.SpatialWorldRuntime();
  world.setAnchors([{
    id: 'surface.camera',
    label: 'Camera surface',
    kind: 'surface',
    pose: { position: { x: 0, y: 0, z: 0 }, scale: 1, rotation: 0 },
    snapRadius: 0.3,
    constraint: {
      axis: 'xy',
      halfExtents: { x: 0.12, y: 0.08, z: 0.04 },
      offset: 0,
    },
  }]);

  const snap = world.snapObject('mira.core', {
    position: { x: 0.2, y: 0.11, z: 0.04 },
    scale: 1,
    rotation: 0,
  }, 1000);

  assert.ok(snap);
  assert.ok(Math.abs(snap.worldPose.position.x - 0.12) < 1e-6);
  assert.ok(Math.abs(snap.worldPose.position.y - 0.08) < 1e-6);
  assert.ok(Math.abs(snap.worldPose.position.z) < 1e-6);
});

test('object-to-object parenting resolves child pose from parent object anchor', () => {
  const world = new spatialWorld.SpatialWorldRuntime();
  world.setAnchors([{
    id: 'workspace.root',
    label: 'Root',
    kind: 'workspace',
    pose: { position: { x: 0, y: 0, z: 0 }, scale: 1, rotation: 0 },
    snapRadius: 0.025,
  }, {
    id: 'object.parent',
    label: 'Parent object',
    kind: 'object',
    parentId: 'workspace.root',
    ownerObjectId: 'parent',
    pose: { position: { x: 0.2, y: -0.1, z: 0.15 }, scale: 1.2, rotation: 10 },
    snapRadius: 0.18,
    priority: 0.5,
  }]);

  const snap = world.snapObject('child', {
    position: { x: 0.22, y: -0.09, z: 0.15 },
    scale: 0.9,
    rotation: 5,
  }, 1000);
  assert.equal(snap?.anchorId, 'object.parent');

  world.setAnchors([{
    id: 'workspace.root',
    label: 'Root',
    kind: 'workspace',
    pose: { position: { x: 0, y: 0, z: 0 }, scale: 1, rotation: 0 },
    snapRadius: 0.025,
  }, {
    id: 'object.parent',
    label: 'Parent object',
    kind: 'object',
    parentId: 'workspace.root',
    ownerObjectId: 'parent',
    pose: { position: { x: 0.35, y: 0.05, z: 0.2 }, scale: 1.2, rotation: 10 },
    snapRadius: 0.18,
    priority: 0.5,
  }]);

  const followed = world.resolveObjectPose('child');
  assert.ok(followed);
  assert.ok(Math.abs(followed.position.x - 0.35) < 1e-6);
  assert.ok(Math.abs(followed.position.y - 0.05) < 1e-6);
  assert.ok(Math.abs(followed.position.z - 0.2) < 1e-6);
});

test('object anchor never snaps an object to itself', () => {
  const world = new spatialWorld.SpatialWorldRuntime();
  world.setAnchors([{
    id: 'object.mira.core',
    label: 'Mira Core',
    kind: 'object',
    ownerObjectId: 'mira.core',
    pose: { position: { x: 0, y: 0, z: 0 }, scale: 1, rotation: 0 },
    snapRadius: 0.2,
    priority: 1,
  }]);

  assert.equal(world.previewSnapObject('mira.core', {
    position: { x: 0.01, y: 0, z: 0 },
    scale: 1,
    rotation: 0,
  }), null);
});


test('spatial physics classifies slow release as place', () => {
  const physics = new spatialPhysics.SpatialPhysicsRuntime();
  physics.beginGrab('mira.core', { x: 0.5, y: 0.5, z: 0 }, 1000);
  physics.sampleGrab('mira.core', { x: 0.51, y: 0.5, z: 0 }, 1100);
  const release = physics.release('mira.core', 0, 1120);
  assert.equal(release.mode, 'place');
  assert.equal(physics.snapshot('mira.core').mode, 'idle');
});

test('spatial physics classifies a fast release as throw', () => {
  const physics = new spatialPhysics.SpatialPhysicsRuntime();
  physics.beginGrab('mira.core', { x: 0.4, y: 0.5, z: 0 }, 1000);
  physics.sampleGrab('mira.core', { x: 0.55, y: 0.5, z: 0 }, 1050);
  const release = physics.release('mira.core', 0, 1060);
  assert.equal(release.mode, 'throw');
  assert.equal(physics.snapshot('mira.core').mode, 'inertia');
  assert.ok(release.speed >= 0.72);
});

test('strong magnetic placement overrides a fast throw', () => {
  const physics = new spatialPhysics.SpatialPhysicsRuntime();
  physics.beginGrab('mira.core', { x: 0.4, y: 0.5, z: 0 }, 1000);
  physics.sampleGrab('mira.core', { x: 0.58, y: 0.5, z: 0 }, 1050);
  const release = physics.release('mira.core', 0.8, 1060);
  assert.equal(release.mode, 'place');
  assert.equal(physics.snapshot('mira.core').mode, 'idle');
});

test('spatial inertia moves the object and damps velocity over time', () => {
  const physics = new spatialPhysics.SpatialPhysicsRuntime();
  physics.beginGrab('mira.core', { x: 0.4, y: 0.5, z: 0 }, 1000);
  physics.sampleGrab('mira.core', { x: 0.56, y: 0.5, z: 0 }, 1050);
  physics.release('mira.core', 0, 1060);

  const pose = {
    position: { x: 0, y: 0, z: 0 },
    scale: 1,
    rotation: 0,
  };
  const first = physics.step('mira.core', pose, 1110);
  const second = physics.step('mira.core', first.pose, 1160);

  assert.ok(first.pose.position.x > 0);
  assert.ok(second.pose.position.x > first.pose.position.x);
  assert.ok(second.state.speed < first.state.speed);
});

test('spatial physics uses soft collision and bounded bounce at world edges', () => {
  const physics = new spatialPhysics.SpatialPhysicsRuntime();
  physics.beginGrab('mira.core', { x: 0.4, y: 0.5, z: 0 }, 1000);
  physics.sampleGrab('mira.core', { x: 0.58, y: 0.5, z: 0 }, 1050);
  physics.release('mira.core', 0, 1060);

  const step = physics.step('mira.core', {
    position: { x: 0.475, y: 0, z: 0 },
    scale: 1,
    rotation: 0,
  }, 1110);

  assert.equal(step.collided, true);
  assert.ok(step.pose.position.x <= 0.48);
  assert.ok(step.state.velocity.x < 0);
});

test('spatial spring constraint approaches an anchor without teleporting', () => {
  const current = {
    position: { x: 0, y: 0, z: 0 },
    scale: 1,
    rotation: 0,
  };
  const target = {
    position: { x: 0.3, y: -0.2, z: 0.1 },
    scale: 1,
    rotation: 0,
  };
  const sprung = spatialPhysics.applySpatialSpringConstraint(current, target, 0.8, 0.05);

  assert.ok(sprung.position.x > 0 && sprung.position.x < 0.3);
  assert.ok(sprung.position.y < 0 && sprung.position.y > -0.2);
  assert.ok(sprung.position.z > 0 && sprung.position.z < 0.1);
});

test('spatial physics reset clears inertia state', () => {
  const physics = new spatialPhysics.SpatialPhysicsRuntime();
  physics.beginGrab('mira.core', { x: 0.4, y: 0.5, z: 0 }, 1000);
  physics.sampleGrab('mira.core', { x: 0.58, y: 0.5, z: 0 }, 1050);
  physics.release('mira.core', 0, 1060);
  assert.equal(physics.isActive('mira.core'), true);
  physics.reset();
  assert.equal(physics.snapshot('mira.core').mode, 'idle');
});


test('multi object collision separates overlapping spatial bodies', () => {
  const result = spatialCollision.resolveSpatialObjectCollisions([{
    id: 'core',
    pose: { position: { x: 0, y: 0, z: 0 }, scale: 1, rotation: 0 },
    radius: 0.06,
    mass: 1.4,
  }, {
    id: 'node',
    pose: { position: { x: 0.07, y: 0, z: 0 }, scale: 1, rotation: 0 },
    radius: 0.05,
    mass: 0.6,
  }]);

  assert.equal(result.contacts.length, 1);
  const distance = Math.abs(result.poses.node.position.x - result.poses.core.position.x);
  assert.ok(distance > 0.07);
  assert.ok(result.poses.core.position.x < 0);
  assert.ok(result.poses.node.position.x > 0.07);
});

test('collision impulse transfers motion from heavier core to lighter node', () => {
  const result = spatialCollision.resolveSpatialObjectCollisions([{
    id: 'core',
    pose: { position: { x: 0, y: 0, z: 0 }, scale: 1, rotation: 0 },
    radius: 0.06,
    mass: 1.5,
  }, {
    id: 'node',
    pose: { position: { x: 0.095, y: 0, z: 0 }, scale: 1, rotation: 0 },
    radius: 0.05,
    mass: 0.6,
  }], {
    core: { x: 1.1, y: 0, z: 0 },
    node: { x: 0, y: 0, z: 0 },
  });

  assert.ok(result.contacts[0].impulse > 0);
  assert.ok(result.velocityDeltas.core.x < 0);
  assert.ok(result.velocityDeltas.node.x > 0);
  assert.ok(Math.abs(result.velocityDeltas.node.x) > Math.abs(result.velocityDeltas.core.x));
});

test('static attached object stays fixed while free object is separated', () => {
  const result = spatialCollision.resolveSpatialObjectCollisions([{
    id: 'anchored',
    pose: { position: { x: 0, y: 0, z: 0 }, scale: 1, rotation: 0 },
    radius: 0.06,
    mass: 1,
    dynamic: false,
  }, {
    id: 'free',
    pose: { position: { x: 0.08, y: 0, z: 0 }, scale: 1, rotation: 0 },
    radius: 0.05,
    mass: 0.6,
    dynamic: true,
  }]);

  assert.equal(result.poses.anchored.position.x, 0);
  assert.ok(result.poses.free.position.x > 0.08);
});

test('spatial objects preserve collision radius and mass definitions', () => {
  const runtime = new spatialObject.SpatialObjectRuntime([{
    id: 'core',
    label: 'Core',
    collisionRadius: 0.07,
    mass: 1.8,
  }, {
    id: 'node',
    label: 'Node',
    collisionRadius: 0.035,
    mass: 0.55,
  }]);
  assert.equal(runtime.get('core')?.collisionRadius, 0.07);
  assert.equal(runtime.get('core')?.mass, 1.8);
  assert.equal(runtime.get('node')?.collisionRadius, 0.035);
  assert.equal(runtime.get('node')?.mass, 0.55);
});

test('anchor eligibility prevents objects from snapping to another object home', () => {
  const world = new spatialWorld.SpatialWorldRuntime();
  world.setAnchors([{
    id: 'core.home',
    label: 'Core home',
    kind: 'dock',
    acceptsObjectId: 'core',
    pose: { position: { x: 0, y: 0, z: 0 }, scale: 1, rotation: 0 },
    snapRadius: 0.2,
    priority: 1,
  }, {
    id: 'node.home',
    label: 'Node home',
    kind: 'dock',
    acceptsObjectId: 'node',
    pose: { position: { x: 0.08, y: 0, z: 0 }, scale: 1, rotation: 0 },
    snapRadius: 0.2,
    priority: 1,
  }]);

  const snap = world.snapObject('node', {
    position: { x: 0.01, y: 0, z: 0 },
    scale: 1,
    rotation: 0,
  }, 1000);
  assert.equal(snap?.anchorId, 'node.home');
});

test('stack anchor makes child follow the parent object as a cluster', () => {
  const world = new spatialWorld.SpatialWorldRuntime();
  world.setAnchors([{
    id: 'workspace.root',
    label: 'Root',
    kind: 'workspace',
    pose: { position: { x: 0, y: 0, z: 0 }, scale: 1, rotation: 0 },
    snapRadius: 0.025,
  }, {
    id: 'object.core',
    label: 'Core',
    kind: 'object',
    parentId: 'workspace.root',
    ownerObjectId: 'core',
    pose: { position: { x: 0.1, y: 0.1, z: 0 }, scale: 1, rotation: 0 },
    snapRadius: 0.14,
  }, {
    id: 'stack.core',
    label: 'Stack on Core',
    kind: 'dock',
    parentId: 'object.core',
    ownerObjectId: 'core',
    pose: { position: { x: 0, y: -0.08, z: 0.04 }, scale: 1, rotation: 0 },
    snapRadius: 0.14,
    priority: 0.6,
  }]);

  const snap = world.snapObject('node', {
    position: { x: 0.1, y: 0.03, z: 0.04 },
    scale: 0.8,
    rotation: 0,
  }, 1000);
  assert.equal(snap?.anchorId, 'stack.core');

  world.setAnchors([{
    id: 'workspace.root',
    label: 'Root',
    kind: 'workspace',
    pose: { position: { x: 0, y: 0, z: 0 }, scale: 1, rotation: 0 },
    snapRadius: 0.025,
  }, {
    id: 'object.core',
    label: 'Core',
    kind: 'object',
    parentId: 'workspace.root',
    ownerObjectId: 'core',
    pose: { position: { x: 0.25, y: -0.05, z: 0.1 }, scale: 1, rotation: 0 },
    snapRadius: 0.14,
  }, {
    id: 'stack.core',
    label: 'Stack on Core',
    kind: 'dock',
    parentId: 'object.core',
    ownerObjectId: 'core',
    pose: { position: { x: 0, y: -0.08, z: 0.04 }, scale: 1, rotation: 0 },
    snapRadius: 0.14,
    priority: 0.6,
  }]);

  const followed = world.resolveObjectPose('node');
  assert.ok(followed);
  assert.ok(Math.abs(followed.position.x - 0.25) < 1e-6);
  assert.ok(Math.abs(followed.position.y + 0.13) < 1e-6);
  assert.ok(Math.abs(followed.position.z - 0.14) < 1e-6);
});


test('slow vertical collision is classified as stack candidate', () => {
  const result = spatialCollision.resolveSpatialObjectCollisions([{
    id: 'core',
    pose: { position: { x: 0, y: 0.04, z: 0 }, scale: 1, rotation: 0 },
    radius: 0.055,
    mass: 1.4,
  }, {
    id: 'node',
    pose: { position: { x: 0.01, y: -0.045, z: 0.005 }, scale: 1, rotation: 0 },
    radius: 0.038,
    mass: 0.6,
  }], {
    core: { x: 0, y: 0.02, z: 0 },
    node: { x: 0, y: 0, z: 0 },
  });

  assert.equal(result.contacts.length, 1);
  assert.equal(result.contacts[0].stackCandidate, true);
  assert.ok(result.contacts[0].relativeSpeed <= 0.22);
});

test('fast or lateral collision is not classified as stack candidate', () => {
  const fast = spatialCollision.resolveSpatialObjectCollisions([{
    id: 'core',
    pose: { position: { x: 0, y: 0, z: 0 }, scale: 1, rotation: 0 },
    radius: 0.055,
  }, {
    id: 'node',
    pose: { position: { x: 0.08, y: 0.01, z: 0 }, scale: 1, rotation: 0 },
    radius: 0.038,
  }], {
    core: { x: 1.2, y: 0, z: 0 },
    node: { x: 0, y: 0, z: 0 },
  });
  assert.equal(fast.contacts[0].stackCandidate, false);

  const lateral = spatialCollision.resolveSpatialObjectCollisions([{
    id: 'core',
    pose: { position: { x: 0, y: 0, z: 0 }, scale: 1, rotation: 0 },
    radius: 0.055,
  }, {
    id: 'node',
    pose: { position: { x: 0.08, y: -0.01, z: 0 }, scale: 1, rotation: 0 },
    radius: 0.038,
  }]);
  assert.equal(lateral.contacts[0].stackCandidate, false);
});

test('stack attachment resolves child above parent and follows the cluster', () => {
  const world = new spatialWorld.SpatialWorldRuntime();
  world.setAnchors([{
    id: 'workspace.root',
    label: 'Root',
    kind: 'workspace',
    pose: { position: { x: 0, y: 0, z: 0 }, scale: 1, rotation: 0 },
    snapRadius: 0.025,
  }, {
    id: 'object.core',
    label: 'Core',
    kind: 'object',
    parentId: 'workspace.root',
    ownerObjectId: 'core',
    pose: { position: { x: 0.1, y: 0.08, z: 0 }, scale: 1, rotation: 0 },
    snapRadius: 0.14,
  }, {
    id: 'stack.core',
    label: 'Stack Core',
    kind: 'dock',
    parentId: 'object.core',
    ownerObjectId: 'core',
    pose: { position: { x: 0, y: -0.11, z: 0.03 }, scale: 1, rotation: 0 },
    snapRadius: 0.12,
  }]);

  const attached = world.attachObject('node', 'stack.core', {
    position: { x: 0.1, y: -0.03, z: 0.03 },
    scale: 0.78,
    rotation: 0,
  }, 1000);
  assert.equal(attached?.anchorId, 'stack.core');

  world.setAnchors([{
    id: 'workspace.root',
    label: 'Root',
    kind: 'workspace',
    pose: { position: { x: 0, y: 0, z: 0 }, scale: 1, rotation: 0 },
    snapRadius: 0.025,
  }, {
    id: 'object.core',
    label: 'Core',
    kind: 'object',
    parentId: 'workspace.root',
    ownerObjectId: 'core',
    pose: { position: { x: 0.28, y: -0.02, z: 0.12 }, scale: 1, rotation: 0 },
    snapRadius: 0.14,
  }, {
    id: 'stack.core',
    label: 'Stack Core',
    kind: 'dock',
    parentId: 'object.core',
    ownerObjectId: 'core',
    pose: { position: { x: 0, y: -0.11, z: 0.03 }, scale: 1, rotation: 0 },
    snapRadius: 0.12,
  }]);

  const followed = world.resolveObjectPose('node');
  assert.ok(followed);
  assert.ok(Math.abs(followed.position.x - 0.28) < 1e-6);
  assert.ok(Math.abs(followed.position.y + 0.13) < 1e-6);
  assert.ok(Math.abs(followed.position.z - 0.15) < 1e-6);
});

test('collision impulse can activate inertia on a resting object', () => {
  const physics = new spatialPhysics.SpatialPhysicsRuntime();
  const state = physics.addVelocity('mira.node', { x: 0.8, y: 0, z: 0 }, 1000);
  assert.equal(state.mode, 'inertia');
  assert.ok(state.speed > 0.7);
});


test('spatial world reports cluster root and recursive members', () => {
  const world = new spatialWorld.SpatialWorldRuntime();
  world.setAnchors([{
    id: 'workspace.root',
    label: 'Root',
    kind: 'workspace',
    pose: { position: { x: 0, y: 0, z: 0 }, scale: 1, rotation: 0 },
    snapRadius: 0.025,
  }, {
    id: 'object.core',
    label: 'Core',
    kind: 'object',
    parentId: 'workspace.root',
    ownerObjectId: 'core',
    pose: { position: { x: 0.1, y: 0, z: 0 }, scale: 1, rotation: 0 },
    snapRadius: 0.14,
  }, {
    id: 'object.node',
    label: 'Node',
    kind: 'object',
    parentId: 'object.core',
    ownerObjectId: 'node',
    pose: { position: { x: 0.02, y: -0.08, z: 0 }, scale: 1, rotation: 0 },
    snapRadius: 0.1,
  }]);

  world.attachObject('node', 'object.core', {
    position: { x: 0.12, y: -0.08, z: 0 },
    scale: 0.8,
    rotation: 0,
  }, 1000);
  world.attachObject('leaf', 'object.node', {
    position: { x: 0.14, y: -0.16, z: 0 },
    scale: 0.6,
    rotation: 0,
  }, 1100);

  assert.equal(world.clusterRootObjectId('leaf'), 'core');
  assert.deepEqual(world.clusterObjectIds('core'), ['core', 'node', 'leaf']);
});

test('spatial world can update attachment local pose without detaching cluster', () => {
  const world = new spatialWorld.SpatialWorldRuntime();
  world.setAnchors([{
    id: 'object.core',
    label: 'Core',
    kind: 'object',
    ownerObjectId: 'core',
    pose: { position: { x: 0.2, y: 0.1, z: 0 }, scale: 1, rotation: 0 },
    snapRadius: 0.14,
  }]);
  world.attachObject('node', 'object.core', {
    position: { x: 0.2, y: 0, z: 0 },
    scale: 0.8,
    rotation: 0,
  }, 1000);

  const before = world.attachment('node');
  assert.ok(before);
  world.updateAttachmentLocalPose('node', {
    ...before.localPose,
    position: { ...before.localPose.position, x: 0.08 },
  });
  const after = world.resolveObjectPose('node');
  assert.ok(after);
  assert.ok(Math.abs(after.position.x - 0.28) < 1e-6);
});

test('fixed spatial joint preserves bound local pose', () => {
  const joints = new spatialJoint.SpatialJointRuntime();
  joints.setJoint({
    id: 'joint.node',
    kind: 'fixed',
    parentObjectId: 'core',
    childObjectId: 'node',
  });
  const base = {
    position: { x: 0, y: -0.1, z: 0.02 },
    scale: 0.8,
    rotation: 7,
  };
  const result = joints.constrainLocalPose('node', base, 99);
  assert.ok(result);
  assert.equal(result.kind, 'fixed');
  assert.deepEqual(result.localPose, base);
});

test('hinge joint clamps angle and applies bounded local rotation', () => {
  const joints = new spatialJoint.SpatialJointRuntime();
  joints.setJoint({
    id: 'joint.node',
    kind: 'hinge',
    parentObjectId: 'core',
    childObjectId: 'node',
    axis: 'z',
    min: -42,
    max: 42,
    stiffness: 0.9,
  });
  const result = joints.constrainLocalPose('node', {
    position: { x: 0, y: -0.1, z: 0 },
    scale: 1,
    rotation: 5,
  }, 90);

  assert.ok(result);
  assert.equal(result.value, 42);
  assert.ok(Math.abs(result.localPose.rotation - 42.8) < 1e-6);
});

test('slider joint clamps travel to one configured axis', () => {
  const joints = new spatialJoint.SpatialJointRuntime();
  joints.setJoint({
    id: 'joint.node',
    kind: 'slider',
    parentObjectId: 'core',
    childObjectId: 'node',
    axis: 'x',
    min: -0.11,
    max: 0.11,
    stiffness: 0.9,
  });
  const result = joints.constrainLocalPose('node', {
    position: { x: 0.02, y: -0.08, z: 0.01 },
    scale: 1,
    rotation: 0,
  }, 0.5);

  assert.ok(result);
  assert.equal(result.value, 0.11);
  assert.ok(Math.abs(result.localPose.position.x - 0.119) < 1e-6);
  assert.equal(result.localPose.position.y, -0.08);
  assert.equal(result.localPose.position.z, 0.01);
});

test('detaching a cluster child can remove its joint independently', () => {
  const joints = new spatialJoint.SpatialJointRuntime();
  joints.setJoint({
    id: 'joint.node',
    kind: 'hinge',
    parentObjectId: 'core',
    childObjectId: 'node',
  });
  assert.equal(joints.findForChild('node')?.kind, 'hinge');
  const removed = joints.removeForChild('node');
  assert.equal(removed?.childObjectId, 'node');
  assert.equal(joints.findForChild('node'), null);
});

test('collision solver skips contacts between members of the same cluster', () => {
  const result = spatialCollision.resolveSpatialObjectCollisions([{
    id: 'core',
    clusterId: 'core',
    pose: { position: { x: 0, y: 0, z: 0 }, scale: 1, rotation: 0 },
    radius: 0.06,
    mass: 1.4,
  }, {
    id: 'node',
    clusterId: 'core',
    pose: { position: { x: 0.04, y: 0, z: 0 }, scale: 1, rotation: 0 },
    radius: 0.04,
    mass: 0.6,
  }]);

  assert.equal(result.contacts.length, 0);
  assert.equal(result.poses.core.position.x, 0);
  assert.equal(result.poses.node.position.x, 0.04);
});


test('session spatial layout survives runtime remount without browser storage', () => {
  const runtime = new spatialLayout.SpatialSessionLayoutRuntime();
  const snapshot = runtime.capture({
    objects: [{
      id: 'core',
      label: 'Core',
      pose: { position: { x: 0.1, y: -0.1, z: 0.05 }, scale: 1.1, rotation: 12 },
      minScale: 0.7,
      maxScale: 1.6,
      collisionRadius: 0.05,
      mass: 1.4,
      grabbed: true,
    }],
    attachments: [],
    joints: [],
    selectedClusterRoots: ['core'],
  }, 1000);

  assert.equal(snapshot.version, 1);
  assert.equal(snapshot.objects[0].grabbed, false);
  const restored = runtime.restore();
  assert.deepEqual(restored?.selectedClusterRoots, ['core']);
  restored.objects[0].pose.position.x = 0.4;
  assert.equal(runtime.restore().objects[0].pose.position.x, 0.1);
});

test('session spatial layout enforces bounded snapshot budgets', () => {
  const runtime = new spatialLayout.SpatialSessionLayoutRuntime();
  const objects = Array.from({ length: 40 }, (_, index) => ({
    id: 'obj-' + index,
    label: 'Object ' + index,
    pose: { position: { x: 0, y: 0, z: 0 }, scale: 1, rotation: 0 },
    minScale: 0.5,
    maxScale: 2,
    collisionRadius: 0.03,
    mass: 1,
    grabbed: false,
  }));
  const snapshot = runtime.capture({
    objects,
    attachments: [],
    joints: [],
    selectedClusterRoots: objects.map((item) => item.id),
  }, 1000);
  assert.equal(snapshot.objects.length, 32);
  assert.equal(snapshot.selectedClusterRoots.length, 16);
});

test('spatial selection toggles and clears cluster roots deterministically', () => {
  const selection = new spatialLayout.SpatialSelectionRuntime();
  assert.deepEqual(selection.toggle('core'), ['core']);
  assert.deepEqual(selection.toggle('node'), ['core', 'node']);
  assert.equal(selection.has('core'), true);
  assert.deepEqual(selection.toggle('core'), ['node']);
  assert.deepEqual(selection.clear(), []);
});

test('multi cluster group transform moves scale and rotates around centroid', () => {
  const objects = [{
    id: 'a',
    label: 'A',
    pose: { position: { x: -0.1, y: 0, z: 0 }, scale: 1, rotation: 0 },
    minScale: 0.5,
    maxScale: 2,
    collisionRadius: 0.03,
    mass: 1,
    grabbed: false,
  }, {
    id: 'b',
    label: 'B',
    pose: { position: { x: 0.1, y: 0, z: 0 }, scale: 1, rotation: 0 },
    minScale: 0.5,
    maxScale: 2,
    collisionRadius: 0.03,
    mass: 1,
    grabbed: false,
  }];

  const session = spatialGroup.beginSpatialGroupTransform(objects, ['a', 'b']);
  assert.ok(session);
  const transformed = spatialGroup.applySpatialGroupTransform(session, {
    translateX: 0.05,
    translateY: 0.02,
    scaleRatio: 1.5,
    rotationDelta: 90,
  });

  const centerX = (transformed.a.position.x + transformed.b.position.x) / 2;
  const centerY = (transformed.a.position.y + transformed.b.position.y) / 2;
  assert.ok(Math.abs(centerX - 0.05) < 1e-6);
  assert.ok(Math.abs(centerY - 0.02) < 1e-6);
  assert.ok(transformed.a.position.y < centerY);
  assert.ok(transformed.b.position.y > centerY);
  assert.ok(Math.abs(transformed.a.scale - 1.5) < 1e-6);
  assert.equal(transformed.a.rotation, 55);
});

test('spatial device adapter keeps webcam input relative and gates metric points', () => {
  const adapter = new spatialDevice.SpatialDeviceAdapterRuntime();
  const point = adapter.webcamPoint({ x: 2, y: -1, z: 2, confidence: 0.8 });
  assert.deepEqual(point, { x: 1, y: 0, z: 1, confidence: 0.8, space: 'relative' });
  assert.equal(adapter.metricPoint({ x: 1, y: 2, z: 3 }), null);
  assert.equal(adapter.snapshot().mode, 'webcam-relative');
});

test('spatial device adapter can switch to WebXR metric capability contract', async () => {
  const adapter = new spatialDevice.SpatialDeviceAdapterRuntime();
  const capabilities = await adapter.detectWebXR({
    navigator: {
      xr: {
        isSessionSupported: async (mode) => mode === 'immersive-ar',
      },
    },
  });
  assert.equal(capabilities.mode, 'webxr-metric');
  assert.equal(capabilities.metric, true);
  assert.equal(capabilities.worldSpace, true);
  assert.equal(adapter.metricPoint({ x: 1, y: 2, z: 3 })?.space, 'metric');
});

test('spatial world rejects object attachment cycles', () => {
  const world = new spatialWorld.SpatialWorldRuntime();
  world.setAnchors([{
    id: 'object.a',
    label: 'A',
    kind: 'object',
    ownerObjectId: 'a',
    pose: { position: { x: 0, y: 0, z: 0 }, scale: 1, rotation: 0 },
    snapRadius: 0.2,
  }, {
    id: 'object.b',
    label: 'B',
    kind: 'object',
    ownerObjectId: 'b',
    pose: { position: { x: 0.1, y: 0, z: 0 }, scale: 1, rotation: 0 },
    snapRadius: 0.2,
  }]);

  assert.ok(world.attachObject('b', 'object.a', {
    position: { x: 0.1, y: 0, z: 0 },
    scale: 1,
    rotation: 0,
  }, 1000));
  assert.equal(world.wouldCreateAttachmentCycle('a', 'object.b'), true);
  assert.equal(world.attachObject('a', 'object.b', {
    position: { x: 0, y: 0, z: 0 },
    scale: 1,
    rotation: 0,
  }, 1100), null);
});

test('world model keeps a bounded number of visual memories', () => {
  const tracker = new worldModel.ShortTermWorldModelTracker();
  const nodes = Array.from({ length: 40 }, (_, index) =>
    actionNode(
      'budget-' + index,
      'object-' + index,
      (index % 8) * 0.1,
      Math.floor(index / 8) * 0.1,
      0.9,
    )
  );
  const state = tracker.update(actionGraph(nodes, [], 1000), null, 1000);
  assert.ok(state.objects.length <= 32);
});


test('WebXR session runtime requests immersive AR with optional hand and hit features', async () => {
  let requestedMode = '';
  let requestedOptions = null;
  let frameCallback = null;
  let ended = false;
  let hitSourceCancelled = false;

  const hand = new Map([
    ['wrist', { name: 'wrist' }],
    ['thumb-tip', { name: 'thumb-tip' }],
    ['index-finger-tip', { name: 'index-finger-tip' }],
  ]);

  const session = {
    enabledFeatures: ['hand-tracking', 'hit-test', 'anchors', 'depth-sensing'],
    inputSources: [{ handedness: 'right', hand }],
    requestReferenceSpace: async (type) => ({ type }),
    requestHitTestSource: async () => ({
      cancel: () => { hitSourceCancelled = true; },
    }),
    requestAnimationFrame: (callback) => {
      frameCallback = callback;
      return 1;
    },
    cancelAnimationFrame: () => {},
    addEventListener: () => {},
    end: async () => { ended = true; },
  };

  const runtime = new spatialWebXR.SpatialWebXRSessionRuntime();
  const started = await runtime.start({
    navigator: {
      xr: {
        requestSession: async (mode, options) => {
          requestedMode = mode;
          requestedOptions = options;
          return session;
        },
      },
    },
  });

  assert.equal(requestedMode, 'immersive-ar');
  assert.ok(requestedOptions.optionalFeatures.includes('hand-tracking'));
  assert.ok(requestedOptions.optionalFeatures.includes('hit-test'));
  assert.ok(requestedOptions.optionalFeatures.includes('anchors'));
  assert.ok(requestedOptions.optionalFeatures.includes('depth-sensing'));
  assert.equal(started.active, true);
  assert.equal(started.mode, 'immersive-ar');
  assert.ok(frameCallback);

  const jointPose = (space) => {
    const positions = {
      wrist: { x: 0, y: 1.2, z: -0.4 },
      'thumb-tip': { x: 0.01, y: 1.3, z: -0.3 },
      'index-finger-tip': { x: 0.025, y: 1.3, z: -0.3 },
    };
    const point = positions[space.name];
    return point ? {
      transform: { position: point },
      radius: 0.009,
    } : null;
  };

  const identity = [
    1,0,0,0,
    0,1,0,0,
    0,0,1,0,
    0,0,0,1,
  ];
  const frame = {
    getJointPose: (space) => jointPose(space),
    getViewerPose: () => ({
      views: [{
        eye: 'none',
        projectionMatrix: identity,
        transform: { inverse: { matrix: identity } },
      }],
    }),
    getHitTestResults: () => [{
      getPose: () => ({
        transform: { position: { x: 0.4, y: 0.2, z: -1.1 } },
      }),
    }],
  };

  frameCallback(1000, frame);
  const snapshot = runtime.snapshot();
  assert.equal(snapshot.hands.length, 1);
  assert.equal(snapshot.views.length, 1);
  assert.equal(snapshot.views[0].projectionMatrix.length, 16);
  assert.equal(snapshot.hands[0].handedness, 'right');
  assert.equal(snapshot.hands[0].pinching, true);
  assert.ok(snapshot.hands[0].pinchDistanceM < 0.028);
  assert.deepEqual(snapshot.hit, { x: 0.4, y: 0.2, z: -1.1, confidence: 1 });

  const stopped = await runtime.stop();
  assert.equal(ended, true);
  assert.equal(hitSourceCancelled, true);
  assert.equal(stopped.active, false);
});

test('WebXR session runtime does not fabricate XR when requestSession is unavailable', async () => {
  const runtime = new spatialWebXR.SpatialWebXRSessionRuntime();
  const snapshot = await runtime.start({ navigator: {} });
  assert.equal(snapshot.active, false);
  assert.ok(snapshot.error.includes('WebXR'));
});

test('spatial device adapter trusts only enabled WebXR session features', async () => {
  const adapter = new spatialDevice.SpatialDeviceAdapterRuntime();
  const detected = await adapter.detectWebXR({
    navigator: {
      xr: {
        isSessionSupported: async () => true,
      },
    },
  });
  assert.equal(detected.mode, 'webxr-metric');
  assert.equal(detected.handTracking, false);
  assert.equal(detected.hitTest, false);
  assert.equal(detected.anchors, false);
  assert.equal(detected.depth, false);

  const negotiated = adapter.useWebXRSessionFeatures(['hand-tracking', 'hit-test']);
  assert.equal(negotiated.handTracking, true);
  assert.equal(negotiated.hitTest, true);
  assert.equal(negotiated.anchors, false);
  assert.equal(negotiated.depth, false);
});


test('XR projection maps metric center to DOM center', () => {
  const identity = [
    1,0,0,0,
    0,1,0,0,
    0,0,1,0,
    0,0,0,1,
  ];
  const projected = spatialXRProjection.projectMetricPointToView(
    { x: 0, y: 0, z: 0 },
    { eye: 'none', projectionMatrix: identity, viewMatrix: identity },
  );
  assert.ok(projected);
  assert.ok(Math.abs(projected.x - 0.5) < 1e-6);
  assert.ok(Math.abs(projected.y - 0.5) < 1e-6);
  assert.equal(projected.visible, true);
});

test('XR projection converts NDC orientation into DOM top-left coordinates', () => {
  const identity = [
    1,0,0,0,
    0,1,0,0,
    0,0,1,0,
    0,0,0,1,
  ];
  const projected = spatialXRProjection.projectMetricPointToView(
    { x: 0.5, y: 0.5, z: 0 },
    { eye: 'none', projectionMatrix: identity, viewMatrix: identity },
  );
  assert.ok(projected);
  assert.ok(Math.abs(projected.x - 0.75) < 1e-6);
  assert.ok(Math.abs(projected.y - 0.25) < 1e-6);
});

test('XR stereo projection averages valid eye views', () => {
  const identity = [
    1,0,0,0,
    0,1,0,0,
    0,0,1,0,
    0,0,0,1,
  ];
  const shifted = [...identity];
  shifted[12] = 0.2;
  const projected = spatialXRProjection.projectMetricPointAcrossViews(
    { x: 0, y: 0, z: 0 },
    [
      { eye: 'left', projectionMatrix: identity, viewMatrix: identity },
      { eye: 'right', projectionMatrix: identity, viewMatrix: shifted },
    ],
  );
  assert.ok(projected);
  assert.ok(projected.x > 0.5 && projected.x < 0.61);
});

test('XR DOM calibration recenters a projected viewer-ray hit', () => {
  const runtime = new spatialXRProjection.SpatialXRProjectionRuntime();
  const calibration = runtime.calibrateCenter({ x: 0.58, y: 0.46 });
  assert.ok(Math.abs(calibration.offsetX + 0.08) < 1e-6);
  assert.ok(Math.abs(calibration.offsetY - 0.04) < 1e-6);
});

test('XR projection rejects points behind the view', () => {
  const projection = [
    1,0,0,0,
    0,1,0,0,
    0,0,1,1,
    0,0,0,0,
  ];
  const identity = [
    1,0,0,0,
    0,1,0,0,
    0,0,1,0,
    0,0,0,1,
  ];
  assert.equal(spatialXRProjection.projectMetricPointToView(
    { x: 0, y: 0, z: -1 },
    { eye: 'none', projectionMatrix: projection, viewMatrix: identity },
  ), null);
});


function syntheticHand(scale = 1, offsetX = 0, offsetY = 0) {
  const base = [
    [0.50,0.80,0],[0.46,0.74,0],[0.43,0.66,0],[0.41,0.57,0],[0.39,0.48,0],
    [0.46,0.65,0],[0.45,0.50,0],[0.44,0.36,0],[0.43,0.22,0],
    [0.50,0.64,0],[0.50,0.48,0],[0.50,0.33,0],[0.50,0.18,0],
    [0.54,0.66,0],[0.55,0.51,0],[0.56,0.38,0],[0.57,0.25,0],
    [0.58,0.70,0],[0.60,0.58,0],[0.61,0.47,0],[0.62,0.36,0],
  ];
  return base.map(([x,y,z]) => ({
    x: 0.5 + (x - 0.5) * scale + offsetX,
    y: 0.5 + (y - 0.5) * scale + offsetY,
    z,
  }));
}

function pinchedSyntheticHand(scale = 1) {
  const points = syntheticHand(scale);
  points[4] = {
    x: points[8].x + 0.008 * scale,
    y: points[8].y + 0.004 * scale,
    z: 0,
  };
  return points;
}

test('human hand pinch ratio is scale invariant', () => {
  const trackerA = new spatialHandKinematics.SpatialHandKinematicsTracker();
  const trackerB = new spatialHandKinematics.SpatialHandKinematicsTracker();
  const a = trackerA.update({
    handedness: 'Right',
    landmarks: pinchedSyntheticHand(1),
    confidence: 0.9,
  }, 1000);
  const b = trackerB.update({
    handedness: 'Right',
    landmarks: pinchedSyntheticHand(0.5),
    confidence: 0.9,
  }, 1000);

  assert.ok(Math.abs(a.pinchRatio - b.pinchRatio) < 1e-6);
  assert.equal(a.pinching, true);
  assert.equal(b.pinching, true);
  assert.ok(a.pinchConfidence > 0.5);
});

test('human hand kinematics measures fingertip velocity and stability over time', () => {
  const tracker = new spatialHandKinematics.SpatialHandKinematicsTracker();
  const first = syntheticHand();
  tracker.update({ handedness: 'Right', landmarks: first, confidence: 0.9 }, 1000);
  const second = syntheticHand();
  second[8] = { ...second[8], x: second[8].x + 0.08 };
  const state = tracker.update({ handedness: 'Right', landmarks: second, confidence: 0.9 }, 1050);

  assert.ok(state.index.velocity.x > 1);
  assert.ok(state.stability > 0.8);
  assert.ok(Number.isFinite(state.contactRadius));
  assert.ok(state.contactRadius >= 0.012 && state.contactRadius <= 0.038);
});

test('world hand geometry drives shape while screen landmarks drive fingertip position', () => {
  const tracker = new spatialHandKinematics.SpatialHandKinematicsTracker();
  const screen = syntheticHand();
  const world = syntheticHand(0.25).map((point, index) => ({
    x: point.x - 0.5,
    y: point.y - 0.5,
    z: index === 8 ? -0.04 : 0,
  }));
  const state = tracker.update({
    handedness: 'Right',
    landmarks: screen,
    worldLandmarks: world,
    confidence: 0.92,
  }, 1000);

  assert.equal(state.source, 'world-shape');
  assert.equal(state.index.tip.x, screen[8].x);
  assert.ok(Number.isFinite(state.palmFacingConfidence));
});

test('mirrored hand kinematics flips screen x and x velocity only', () => {
  const tracker = new spatialHandKinematics.SpatialHandKinematicsTracker();
  tracker.update({ handedness: 'Right', landmarks: syntheticHand(), confidence: 0.9 }, 1000);
  const moved = syntheticHand();
  moved[8] = { ...moved[8], x: moved[8].x + 0.05 };
  const state = tracker.update({ handedness: 'Right', landmarks: moved, confidence: 0.9 }, 1050);
  const mirrored = spatialHandKinematics.mirrorSpatialHandKinematicsX(state);

  assert.ok(Math.abs(mirrored.index.tip.x - (1 - state.index.tip.x)) < 1e-6);
  assert.ok(Math.abs(mirrored.index.velocity.x + state.index.velocity.x) < 1e-6);
  assert.equal(mirrored.index.velocity.y, state.index.velocity.y);
});

test('multi finger contact progresses hover contact press without auto activation', () => {
  const tracker = new spatialHandKinematics.SpatialHandKinematicsTracker();
  const contact = new spatialHandContact.SpatialHandContactRuntime();
  const points = syntheticHand();
  const volume = [{
    id: 'surface',
    label: 'Surface',
    kind: 'object',
    center: { x: points[8].x, y: points[8].y, z: 0 },
    halfExtents: { x: 0.05, y: 0.05, z: 0.03 },
  }];

  const hand0 = tracker.update({ handedness: 'Right', landmarks: points, confidence: 0.9 }, 1000);
  const first = contact.update(hand0, volume, 1000);
  assert.ok(first.active);
  assert.ok(['hover', 'approach'].includes(first.phase));

  const hand1 = tracker.update({ handedness: 'Right', landmarks: points, confidence: 0.9 }, 1070);
  const second = contact.update(hand1, volume, 1070);
  assert.ok(['contact', 'press'].includes(second.phase));

  const hand2 = tracker.update({ handedness: 'Right', landmarks: points, confidence: 0.9 }, 1140);
  const third = contact.update(hand2, volume, 1140);
  assert.ok(['contact', 'press'].includes(third.phase));
  assert.ok(third.pressure >= 0 && third.pressure <= 1);
});

test('pinch with index and thumb on same target becomes grab candidate', () => {
  const tracker = new spatialHandKinematics.SpatialHandKinematicsTracker();
  const contact = new spatialHandContact.SpatialHandContactRuntime();
  const points = pinchedSyntheticHand();
  const center = {
    x: (points[8].x + points[4].x) / 2,
    y: (points[8].y + points[4].y) / 2,
    z: 0,
  };
  const volume = [{
    id: 'orb',
    label: 'Orb',
    kind: 'object',
    center,
    halfExtents: { x: 0.05, y: 0.05, z: 0.04 },
  }];

  contact.update(
    tracker.update({ handedness: 'Right', landmarks: points, confidence: 0.95 }, 1000),
    volume,
    1000,
  );
  const result = contact.update(
    tracker.update({ handedness: 'Right', landmarks: points, confidence: 0.95 }, 1070),
    volume,
    1070,
  );

  assert.equal(result.grabCandidate, true);
  assert.equal(result.phase, 'grab');
  assert.ok(result.contactCount >= 2);
});

test('human hand intent recognizes release and push pull without mapping arbitrary UI actions', () => {
  const runtime = new spatialHandIntent.SpatialHandIntentRuntime();
  const contact = { ...spatialHandContact.EMPTY_HAND_CONTACT, contacts: [] };
  const base = {
    ...spatialHandKinematics.EMPTY_HAND_KINEMATICS,
    handedness: 'Right',
    present: true,
    confidence: 0.9,
    pinching: true,
    pinchConfidence: 0.9,
    pointingConfidence: 0.7,
    stability: 0.7,
    palmFacingConfidence: 0.7,
    index: {
      ...spatialHandKinematics.EMPTY_HAND_KINEMATICS.index,
      velocity: { x: 0, y: 0, z: 0.7 },
    },
  };

  const push = runtime.update(base, contact, 1000);
  assert.equal(push.intent, 'push');

  const released = runtime.update({ ...base, pinching: false, pinchConfidence: 0 }, contact, 1100);
  assert.equal(released.intent, 'release');
});

test('human hand intent recognizes fast directional swipes', () => {
  const runtime = new spatialHandIntent.SpatialHandIntentRuntime();
  const contact = { ...spatialHandContact.EMPTY_HAND_CONTACT, contacts: [] };
  const hand = {
    ...spatialHandKinematics.EMPTY_HAND_KINEMATICS,
    handedness: 'Right',
    present: true,
    confidence: 0.92,
    pointingConfidence: 0.92,
    stability: 0.45,
    index: {
      ...spatialHandKinematics.EMPTY_HAND_KINEMATICS.index,
      velocity: { x: 1.8, y: 0.2, z: 0 },
    },
  };
  const result = runtime.update(hand, contact, 1000);
  assert.equal(result.intent, 'swipe_right');
});

test('XR hand bridge produces a MediaPipe-compatible 21 point topology', () => {
  const names = [
    'wrist',
    'thumb-metacarpal','thumb-phalanx-proximal','thumb-phalanx-distal','thumb-tip',
    'index-finger-metacarpal','index-finger-phalanx-proximal','index-finger-phalanx-intermediate','index-finger-phalanx-distal','index-finger-tip',
    'middle-finger-metacarpal','middle-finger-phalanx-proximal','middle-finger-phalanx-intermediate','middle-finger-phalanx-distal','middle-finger-tip',
    'ring-finger-metacarpal','ring-finger-phalanx-proximal','ring-finger-phalanx-intermediate','ring-finger-phalanx-distal','ring-finger-tip',
    'pinky-finger-metacarpal','pinky-finger-phalanx-proximal','pinky-finger-phalanx-intermediate','pinky-finger-phalanx-distal','pinky-finger-tip',
  ];
  const joints = names.map((name, index) => ({
    name,
    x: index * 0.001,
    y: 1 + index * 0.001,
    z: -0.3,
    radius: 0.008,
  }));
  const result = spatialXRHandBridge.bridgeXRHandTo21({
    handedness: 'right',
    joints,
    indexTip: joints.find((joint) => joint.name === 'index-finger-tip'),
    thumbTip: joints.find((joint) => joint.name === 'thumb-tip'),
    wrist: joints[0],
    pinching: false,
    pinchDistanceM: 0.04,
  });

  assert.equal(result.worldLandmarks.length, 21);
  assert.equal(result.complete, true);
  assert.equal(result.worldLandmarks[0].x, 0);
  assert.equal(result.worldLandmarks[8].x, joints.find((joint) => joint.name === 'index-finger-tip').x);
});

test('human hand runtime remains finite across 600 jittered frames', () => {
  const tracker = new spatialHandKinematics.SpatialHandKinematicsTracker();
  const contact = new spatialHandContact.SpatialHandContactRuntime();
  const intent = new spatialHandIntent.SpatialHandIntentRuntime();
  const volume = [{
    id: 'stress',
    label: 'Stress',
    kind: 'object',
    center: { x: 0.5, y: 0.3, z: 0 },
    halfExtents: { x: 0.1, y: 0.1, z: 0.06 },
  }];

  let last;
  for (let frame = 0; frame < 600; frame += 1) {
    const points = syntheticHand();
    const jitter = Math.sin(frame * 0.37) * 0.004;
    points.forEach((point, index) => {
      point.x += jitter * ((index % 3) - 1);
      point.y += Math.cos(frame * 0.23 + index) * 0.002;
      point.z = Math.sin(frame * 0.17 + index * 0.11) * 0.012;
    });
    const state = tracker.update({
      handedness: 'Right',
      landmarks: points,
      confidence: 0.86,
    }, 1000 + frame * 16.67);
    const touch = contact.update(state, volume, 1000 + frame * 16.67);
    last = intent.update(state, touch, 1000 + frame * 16.67);

    for (const value of [
      state.pinchRatio,
      state.speed,
      state.stability,
      state.contactRadius,
      state.index.velocity.x,
      state.index.velocity.y,
      state.index.velocity.z,
      touch.pressure,
      last.confidence,
    ]) {
      assert.equal(Number.isFinite(value), true);
    }
    assert.ok(touch.pressure >= 0 && touch.pressure <= 1);
    assert.ok(last.confidence >= 0 && last.confidence <= 1);
  }
  assert.ok(last);
});


test('boundary jitter never escalates to press or grab without entering contact radius', () => {
  const tracker = new spatialHandKinematics.SpatialHandKinematicsTracker();
  const contact = new spatialHandContact.SpatialHandContactRuntime();
  const volume = [{
    id: 'edge',
    label: 'Edge',
    kind: 'object',
    center: { x: 0.47, y: 0.22, z: 0 },
    halfExtents: { x: 0.012, y: 0.012, z: 0.018 },
  }];

  for (let frame = 0; frame < 420; frame += 1) {
    const points = syntheticHand();
    points[8] = {
      ...points[8],
      x: 0.43 + Math.sin(frame * 0.41) * 0.0025,
      y: 0.22 + Math.cos(frame * 0.29) * 0.002,
      z: Math.sin(frame * 0.17) * 0.002,
    };
    const now = 1000 + frame * 16.67;
    const state = tracker.update({
      handedness: 'Right',
      landmarks: points,
      confidence: 0.9,
    }, now);
    const touch = contact.update(state, volume, now);
    assert.notEqual(touch.phase, 'press');
    assert.notEqual(touch.phase, 'grab');
    assert.equal(touch.grabCandidate, false);
  }
});

test('two fingertips on one target cannot become grab without adaptive pinch', () => {
  const tracker = new spatialHandKinematics.SpatialHandKinematicsTracker();
  const contact = new spatialHandContact.SpatialHandContactRuntime();
  const points = syntheticHand();
  const center = {
    x: (points[8].x + points[4].x) / 2,
    y: (points[8].y + points[4].y) / 2,
    z: 0,
  };
  const volume = [{
    id: 'wide-target',
    label: 'Wide target',
    kind: 'object',
    center,
    halfExtents: { x: 0.06, y: 0.16, z: 0.04 },
  }];

  let result = spatialHandContact.EMPTY_HAND_CONTACT;
  for (const now of [1000, 1070, 1140, 1210]) {
    const state = tracker.update({
      handedness: 'Right',
      landmarks: points,
      confidence: 0.95,
    }, now);
    assert.equal(state.pinching, false);
    result = contact.update(state, volume, now);
  }

  assert.equal(result.grabCandidate, false);
  assert.notEqual(result.phase, 'grab');
});

test('XR hand bridge preserves metric values instead of clamping them into webcam coordinates', () => {
  const joints = [
    { name: 'wrist', x: 1.2, y: -0.4, z: -1.8, radius: 0.01 },
    { name: 'thumb-tip', x: 1.25, y: -0.3, z: -1.75, radius: 0.008 },
    { name: 'index-finger-tip', x: 1.32, y: -0.22, z: -1.7, radius: 0.008 },
  ];
  const result = spatialXRHandBridge.bridgeXRHandTo21({
    handedness: 'right',
    joints,
    wrist: joints[0],
    thumbTip: joints[1],
    indexTip: joints[2],
    pinching: false,
    pinchDistanceM: 0.09,
  });

  assert.equal(result.worldLandmarks[0].x, 1.2);
  assert.equal(result.worldLandmarks[4].x, 1.25);
  assert.equal(result.worldLandmarks[8].x, 1.32);
  assert.ok(result.worldLandmarks.some((point) => Math.abs(point.z) > 1));
});

test('hand contact releases cleanly after target exit and grace window', () => {
  const tracker = new spatialHandKinematics.SpatialHandKinematicsTracker();
  const contact = new spatialHandContact.SpatialHandContactRuntime();
  const points = syntheticHand();
  const volume = [{
    id: 'touch',
    label: 'Touch',
    kind: 'object',
    center: { x: points[8].x, y: points[8].y, z: 0 },
    halfExtents: { x: 0.04, y: 0.04, z: 0.03 },
  }];

  contact.update(
    tracker.update({ handedness: 'Right', landmarks: points, confidence: 0.9 }, 1000),
    volume,
    1000,
  );
  const stable = contact.update(
    tracker.update({ handedness: 'Right', landmarks: points, confidence: 0.9 }, 1070),
    volume,
    1070,
  );
  assert.equal(stable.active, true);

  const far = syntheticHand(1, -0.35, 0.25);
  const released = contact.update(
    tracker.update({ handedness: 'Right', landmarks: far, confidence: 0.9 }, 1180),
    volume,
    1180,
  );
  assert.equal(released.active, false);
  assert.equal(released.phase, 'away');
});


test('XR surface probe distinguishes front touch and occluded depth', () => {
  const depth = {
    available: true,
    usage: 'cpu-optimized',
    dataFormat: 'float32',
    frameAt: 1000,
    views: [{
      eye: 'none',
      width: 5,
      height: 5,
      samples: [
        { x: 0.3, y: 0.3, depthM: 1.0, valid: true },
        { x: 0.5, y: 0.3, depthM: 1.0, valid: true },
        { x: 0.7, y: 0.3, depthM: 1.0, valid: true },
        { x: 0.3, y: 0.5, depthM: 1.0, valid: true },
        { x: 0.5, y: 0.5, depthM: 1.0, valid: true },
        { x: 0.7, y: 0.5, depthM: 1.0, valid: true },
        { x: 0.3, y: 0.7, depthM: 1.0, valid: true },
        { x: 0.5, y: 0.7, depthM: 1.0, valid: true },
        { x: 0.7, y: 0.7, depthM: 1.0, valid: true },
      ],
    }],
  };

  const front = spatialXRSurface.probeXRSurface(depth, 0.5, 0.5, 0.9);
  assert.ok(front);
  assert.equal(front.nearSurface, false);
  assert.equal(front.occluded, false);

  const touch = spatialXRSurface.probeXRSurface(depth, 0.5, 0.5, 0.98);
  assert.ok(touch);
  assert.equal(touch.nearSurface, true);
  assert.equal(touch.touchingSurface, true);
  assert.equal(touch.occluded, false);

  const behind = spatialXRSurface.probeXRSurface(depth, 0.5, 0.5, 1.06);
  assert.ok(behind);
  assert.equal(behind.behindSurface, true);
  assert.equal(behind.occluded, true);
});

test('XR sparse depth reconstruction creates finite interaction surface patches', () => {
  const samples = [];
  for (const y of [0.2, 0.5, 0.8]) {
    for (const x of [0.2, 0.5, 0.8]) {
      samples.push({
        x,
        y,
        depthM: 1 + x * 0.08 + y * 0.04,
        valid: true,
      });
    }
  }
  const patches = spatialXRSurface.reconstructXRSurfacePatches({
    available: true,
    usage: 'cpu-optimized',
    dataFormat: 'float32',
    views: [{ eye: 'none', width: 3, height: 3, samples }],
    frameAt: 1000,
  });

  assert.equal(patches.length, 9);
  for (const patch of patches) {
    assert.equal(Number.isFinite(patch.depthM), true);
    assert.equal(Number.isFinite(patch.normalX), true);
    assert.equal(Number.isFinite(patch.normalY), true);
    assert.equal(Number.isFinite(patch.normalZ), true);
    assert.ok(patch.confidence >= 0 && patch.confidence <= 1);
  }
});

test('XR surface runtime tolerates invalid depth samples without fabricating contact', () => {
  const runtime = new spatialXRSurface.SpatialXRSurfaceRuntime();
  runtime.update({
    available: false,
    usage: 'cpu-optimized',
    dataFormat: 'float32',
    views: [{
      eye: 'none',
      width: 3,
      height: 3,
      samples: [
        { x: 0.5, y: 0.5, depthM: 0, valid: false },
        { x: 0.7, y: 0.5, depthM: Number.NaN, valid: false },
      ],
    }],
    frameAt: 1000,
  });
  assert.equal(runtime.probe(0.5, 0.5, 1), null);
  assert.deepEqual(runtime.snapshotPatches(), []);
});

test('WebXR session samples CPU depth and tracks a hit-test-created anchor', async () => {
  let frameCallback = null;
  const tracked = new Set();
  const anchor = {
    anchorSpace: { kind: 'anchor-space' },
    delete: () => {},
    requestPersistentHandle: async () => 'persistent-test-handle',
  };
  const hitResult = {
    getPose: () => ({
      transform: { position: { x: 0.15, y: -0.1, z: -1.0 } },
    }),
    createAnchor: async () => anchor,
  };
  const session = {
    enabledFeatures: ['hit-test', 'anchors', 'depth-sensing'],
    depthUsage: 'cpu-optimized',
    depthDataFormat: 'float32',
    inputSources: [],
    requestReferenceSpace: async (type) => ({ type }),
    requestHitTestSource: async () => ({ cancel: () => {} }),
    requestAnimationFrame: (callback) => {
      frameCallback = callback;
      return 1;
    },
    cancelAnimationFrame: () => {},
    addEventListener: () => {},
    end: async () => {},
  };

  const runtime = new spatialWebXR.SpatialWebXRSessionRuntime();
  const started = await runtime.start({
    navigator: {
      xr: {
        requestSession: async () => session,
      },
    },
  });
  assert.equal(started.active, true);
  assert.equal(runtime.requestAnchorAtCurrentHit('object.mira.core', 'Mira Core', true), true);

  const identity = [
    1,0,0,0,
    0,1,0,0,
    0,0,1,0,
    0,0,0,1,
  ];
  const view = {
    eye: 'none',
    projectionMatrix: identity,
    transform: { inverse: { matrix: identity } },
  };
  const firstFrame = {
    trackedAnchors: tracked,
    getViewerPose: () => ({ views: [view] }),
    getHitTestResults: () => [hitResult],
    getDepthInformation: () => ({
      width: 5,
      height: 5,
      getDepthInMeters: (x, y) => 0.9 + x * 0.1 + y * 0.05,
    }),
    getPose: () => null,
  };

  frameCallback(1000, firstFrame);
  await Promise.resolve();
  await Promise.resolve();

  let snapshot = runtime.snapshot();
  assert.equal(snapshot.depth.available, true);
  assert.equal(snapshot.depth.usage, 'cpu-optimized');
  assert.equal(snapshot.depth.views.length, 1);
  assert.equal(snapshot.depth.views[0].samples.length, 25);

  tracked.add(anchor);
  const secondFrame = {
    ...firstFrame,
    trackedAnchors: tracked,
    getPose: (space) => space === anchor.anchorSpace
      ? {
          transform: {
            position: { x: 0.16, y: -0.09, z: -1.01 },
          },
        }
      : null,
  };
  frameCallback(1016, secondFrame);
  await Promise.resolve();

  snapshot = runtime.snapshot();
  assert.equal(snapshot.anchors.length, 1);
  assert.equal(snapshot.anchors[0].id, 'object.mira.core');
  assert.equal(snapshot.anchors[0].tracked, true);
  assert.equal(snapshot.anchors[0].persistentHandle, 'persistent-test-handle');
  assert.ok(Math.abs(snapshot.anchors[0].z + 1.01) < 1e-6);

  await runtime.stop();
});

test('XR depth request is CPU optimized because frame sampling uses getDepthInformation', async () => {
  let requestedOptions = null;
  const session = {
    enabledFeatures: [],
    inputSources: [],
    requestReferenceSpace: async () => ({}),
    requestAnimationFrame: () => 1,
    cancelAnimationFrame: () => {},
    addEventListener: () => {},
    end: async () => {},
  };
  const runtime = new spatialWebXR.SpatialWebXRSessionRuntime();
  await runtime.start({
    navigator: {
      xr: {
        requestSession: async (_mode, options) => {
          requestedOptions = options;
          return session;
        },
      },
    },
  });
  assert.deepEqual(requestedOptions.depthSensing.usagePreference, ['cpu-optimized']);
  await runtime.stop();
});


test('late XR anchor creation is discarded after session stop', async () => {
  let frameCallback = null;
  let resolveAnchor = null;
  let deleted = false;
  const anchor = {
    anchorSpace: {},
    delete: () => { deleted = true; },
  };
  const session = {
    enabledFeatures: ['hit-test', 'anchors'],
    inputSources: [],
    requestReferenceSpace: async (type) => ({ type }),
    requestHitTestSource: async () => ({ cancel: () => {} }),
    requestAnimationFrame: (callback) => {
      frameCallback = callback;
      return 1;
    },
    cancelAnimationFrame: () => {},
    addEventListener: () => {},
    end: async () => {},
  };

  const runtime = new spatialWebXR.SpatialWebXRSessionRuntime();
  await runtime.start({
    navigator: {
      xr: {
        requestSession: async () => session,
      },
    },
  });
  assert.equal(runtime.requestAnchorAtCurrentHit('object.late', 'Late', false), true);

  const hitResult = {
    getPose: () => ({
      transform: { position: { x: 0, y: 0, z: -1 } },
    }),
    createAnchor: () => new Promise((resolve) => {
      resolveAnchor = resolve;
    }),
  };
  frameCallback(1000, {
    getViewerPose: () => ({ views: [] }),
    getHitTestResults: () => [hitResult],
    trackedAnchors: new Set(),
  });

  await runtime.stop();
  resolveAnchor(anchor);
  await Promise.resolve();
  await Promise.resolve();

  assert.equal(runtime.snapshot().anchors.length, 0);
  assert.equal(deleted, true);
});


test('XR metric manipulation maps meter depth delta into bounded interaction z', () => {
  const runtime = new spatialXRManipulation.SpatialXRMetricManipulationRuntime();
  const start = runtime.begin('core', 0.8, 1, null, 0.03);
  assert.ok(start);
  const moved = runtime.update('core', 1.0, null, 0);
  assert.ok(moved);
  assert.ok(Math.abs(moved.depthDeltaM - 0.2) < 1e-6);
  assert.ok(Math.abs(moved.normalizedDepthDelta - 0.164) < 1e-6);
  assert.ok(moved.visualScaleRatio < 1);
  assert.equal(moved.constrainedToSurface, false);
});

test('XR metric manipulation prevents object center from crossing measured surface', () => {
  const runtime = new spatialXRManipulation.SpatialXRMetricManipulationRuntime();
  runtime.begin('core', 0.85, 1, 1.0, 0.03);
  const moved = runtime.update('core', 1.12, 1.0, 0.95);
  assert.ok(moved);
  assert.equal(moved.constrainedToSurface, true);
  assert.equal(moved.occluded, true);
  assert.ok(moved.depthDeltaM <= 0.120001);
  assert.ok(moved.normalizedDepthDelta <= 0.1);
});

test('XR metric manipulation surface snap remains stable near clearance plane', () => {
  const runtime = new spatialXRManipulation.SpatialXRMetricManipulationRuntime();
  runtime.begin('node', 0.9, 0.8, 1.0, 0.03);
  const first = runtime.update('node', 0.955, 1.0, 0.9);
  const second = runtime.update('node', 0.965, 1.0, 0.9);
  assert.ok(first && second);
  assert.equal(second.constrainedToSurface, true);
  assert.ok(second.handDepthM > 0.9);
  assert.ok(second.visualScaleRatio >= 0.72 && second.visualScaleRatio <= 1.42);
});

test('XR metric manipulation never accepts invalid metric depth', () => {
  const runtime = new spatialXRManipulation.SpatialXRMetricManipulationRuntime();
  assert.equal(runtime.begin('core', Number.NaN, 1, null), null);
  assert.equal(runtime.begin('core', 0, 1, null), null);
  const started = runtime.begin('core', 0.7, 1, null);
  assert.ok(started);
  const previous = runtime.snapshot();
  const invalidMove = runtime.update('core', Number.NaN, null, 1);
  assert.deepEqual(invalidMove, previous);
});

test('XR metric manipulation ends and clears session deterministically', () => {
  const runtime = new spatialXRManipulation.SpatialXRMetricManipulationRuntime();
  runtime.begin('core', 0.8, 1, 1.2);
  runtime.update('core', 0.9, 1.2, 1);
  const ended = runtime.end('core');
  assert.ok(ended);
  assert.equal(runtime.snapshot(), null);
  assert.equal(runtime.update('core', 1.0, 1.2, 1), null);
});


function makeBimanualHand(handedness, center, wrist, pinching = true) {
  return {
    handedness,
    pinching,
    indexTip: { x: center.x - 0.004, y: center.y, z: center.z },
    thumbTip: { x: center.x + 0.004, y: center.y, z: center.z },
    wrist: { ...wrist },
  };
}

test('XR bimanual runtime requires two pinched metric hands', () => {
  const runtime = new spatialXRBimanual.SpatialXRBimanualRuntime();
  const left = makeBimanualHand('left', { x: -0.1, y: 1.25, z: -0.55 }, { x: -0.1, y: 1.12, z: -0.62 });
  const right = makeBimanualHand('right', { x: 0.1, y: 1.25, z: -0.55 }, { x: 0.1, y: 1.12, z: -0.62 }, false);
  assert.equal(runtime.begin('core', [left, right]), null);
  right.pinching = true;
  const started = runtime.begin('core', [right, left]);
  assert.ok(started);
  assert.equal(started.active, true);
  assert.equal(started.scaleRatio, 1);
});

test('XR bimanual runtime emits bounded scale orientation and metric center delta', () => {
  const runtime = new spatialXRBimanual.SpatialXRBimanualRuntime();
  const startLeft = makeBimanualHand('left', { x: -0.1, y: 1.2, z: -0.6 }, { x: -0.1, y: 1.08, z: -0.7 });
  const startRight = makeBimanualHand('right', { x: 0.1, y: 1.2, z: -0.6 }, { x: 0.1, y: 1.08, z: -0.7 });
  runtime.begin('core', [startLeft, startRight]);

  const nextLeft = makeBimanualHand('left', { x: -0.13, y: 1.18, z: -0.63 }, { x: -0.12, y: 1.05, z: -0.73 });
  const nextRight = makeBimanualHand('right', { x: 0.17, y: 1.31, z: -0.47 }, { x: 0.15, y: 1.13, z: -0.62 });
  const moved = runtime.update('core', [nextRight, nextLeft]);
  assert.ok(moved);
  assert.ok(moved.scaleRatio > 1);
  assert.ok(Math.abs(moved.yawDeg) <= 72);
  assert.ok(Math.abs(moved.pitchDeg) <= 58);
  assert.ok(Math.abs(moved.rollDeg) <= 95);
  assert.ok(Number.isFinite(moved.metricCenterDelta.x));
  assert.ok(Number.isFinite(moved.metricCenterDelta.y));
  assert.ok(Number.isFinite(moved.metricCenterDelta.z));
  assert.notEqual(moved.metricCenterDelta.z, 0);
});

test('XR bimanual runtime commits transform and resumes without resetting pose', () => {
  const runtime = new spatialXRBimanual.SpatialXRBimanualRuntime();
  const left = makeBimanualHand('left', { x: -0.1, y: 1.2, z: -0.6 }, { x: -0.1, y: 1.08, z: -0.7 });
  const right = makeBimanualHand('right', { x: 0.1, y: 1.2, z: -0.6 }, { x: 0.1, y: 1.08, z: -0.7 });
  runtime.begin('node', [left, right]);
  const moved = runtime.update('node', [
    makeBimanualHand('left', { x: -0.14, y: 1.2, z: -0.62 }, { x: -0.13, y: 1.08, z: -0.72 }),
    makeBimanualHand('right', { x: 0.16, y: 1.28, z: -0.5 }, { x: 0.14, y: 1.1, z: -0.64 }),
  ]);
  assert.ok(moved);
  const ended = runtime.end('node');
  assert.ok(ended);
  assert.equal(ended.active, false);
  const committed = runtime.snapshot('node');
  assert.equal(committed.scaleRatio, ended.scaleRatio);
  const resumed = runtime.begin('node', [left, right]);
  assert.ok(resumed);
  assert.equal(resumed.scaleRatio, committed.scaleRatio);
  assert.equal(resumed.yawDeg, committed.yawDeg);
});

test('XR bimanual runtime resets ephemeral object transform deterministically', () => {
  const runtime = new spatialXRBimanual.SpatialXRBimanualRuntime();
  const left = makeBimanualHand('left', { x: -0.1, y: 1.2, z: -0.6 }, { x: -0.1, y: 1.08, z: -0.7 });
  const right = makeBimanualHand('right', { x: 0.1, y: 1.2, z: -0.6 }, { x: 0.1, y: 1.08, z: -0.7 });
  runtime.begin('core', [left, right]);
  runtime.update('core', [
    makeBimanualHand('left', { x: -0.16, y: 1.2, z: -0.65 }, { x: -0.15, y: 1.08, z: -0.74 }),
    makeBimanualHand('right', { x: 0.18, y: 1.3, z: -0.48 }, { x: 0.16, y: 1.11, z: -0.62 }),
  ]);
  runtime.end('core');
  const reset = runtime.resetObject('core');
  assert.equal(reset.scaleRatio, 1);
  assert.equal(reset.yawDeg, 0);
  assert.equal(reset.pitchDeg, 0);
  assert.equal(reset.rollDeg, 0);
  assert.deepEqual(reset.metricCenterDelta, { x: 0, y: 0, z: 0 });
});


test('XR bimanual window transform resumes from committed 6DoF presentation', () => {
  const runtime = new spatialXRBimanual.SpatialXRBimanualRuntime();
  const left = makeBimanualHand('left', { x: -0.12, y: 1.2, z: -0.62 }, { x: -0.12, y: 1.06, z: -0.72 });
  const right = makeBimanualHand('right', { x: 0.12, y: 1.2, z: -0.62 }, { x: 0.12, y: 1.06, z: -0.72 });
  const key = 'window.camera';

  assert.ok(runtime.begin(key, [left, right]));
  const moved = runtime.update(key, [
    makeBimanualHand('left', { x: -0.16, y: 1.16, z: -0.68 }, { x: -0.15, y: 1.02, z: -0.78 }),
    makeBimanualHand('right', { x: 0.18, y: 1.31, z: -0.5 }, { x: 0.16, y: 1.12, z: -0.64 }),
  ]);
  assert.ok(moved);
  assert.ok(moved.scaleRatio > 1);
  assert.ok(Math.abs(moved.yawDeg) + Math.abs(moved.pitchDeg) + Math.abs(moved.rollDeg) > 0);

  const committed = runtime.end(key);
  assert.ok(committed);
  assert.equal(committed.active, false);

  const resumed = runtime.begin(key, [left, right]);
  assert.ok(resumed);
  assert.equal(resumed.scaleRatio, committed.scaleRatio);
  assert.equal(resumed.yawDeg, committed.yawDeg);
  assert.equal(resumed.pitchDeg, committed.pitchDeg);
  assert.equal(resumed.rollDeg, committed.rollDeg);
});


test('XR rigid body derives release velocity and angular inertia from bimanual motion', () => {
  const runtime = new spatialXRRigidBody.SpatialXRRigidBodyRuntime();
  const start = {
    objectId: 'core',
    active: true,
    scaleRatio: 1,
    yawDeg: 0,
    pitchDeg: 0,
    rollDeg: 0,
    metricCenterDelta: { x: 0, y: 0, z: 0 },
  };
  runtime.begin('core', start, 1000);
  const moved = runtime.sample('core', {
    ...start,
    scaleRatio: 1.08,
    yawDeg: 18,
    pitchDeg: -9,
    rollDeg: 24,
    metricCenterDelta: { x: 0.08, y: 0.04, z: -0.06 },
  }, 1100);
  assert.ok(moved);
  const released = runtime.release('core', 1110);
  assert.ok(released);
  assert.equal(released.throwing, true);
  assert.ok(released.linearSpeed > 0.2);
  assert.ok(released.angularSpeed > 30);
  assert.ok(Number.isFinite(released.linearVelocity.x));
  assert.ok(Number.isFinite(released.angularVelocity.rollDegPerSec));
});

test('XR rigid body angular inertia decays while presentation remains bounded', () => {
  const runtime = new spatialXRRigidBody.SpatialXRRigidBodyRuntime();
  const start = {
    objectId: 'node',
    active: true,
    scaleRatio: 1,
    yawDeg: 0,
    pitchDeg: 0,
    rollDeg: 0,
    metricCenterDelta: { x: 0, y: 0, z: 0 },
  };
  runtime.begin('node', start, 1000);
  runtime.sample('node', {
    ...start,
    scaleRatio: 1.1,
    yawDeg: 35,
    pitchDeg: 22,
    rollDeg: -40,
    metricCenterDelta: { x: 0.04, y: -0.03, z: -0.04 },
  }, 1100);
  const released = runtime.release('node', 1110);
  assert.ok(released?.throwing);
  const first = runtime.step('node', 1160);
  const second = runtime.step('node', 1210);
  assert.ok(first && second);
  assert.ok(Math.abs(second.transform.yawDeg) <= 72);
  assert.ok(Math.abs(second.transform.pitchDeg) <= 58);
  assert.ok(Math.abs(second.transform.rollDeg) <= 95);
  assert.ok(second.transform.scaleRatio >= 0.58 && second.transform.scaleRatio <= 1.72);
  assert.ok(second.angularSpeed <= first.angularSpeed + 1e-6);
});

test('XR hand collision emits bounded impulse only for stable non-pinch contact', () => {
  const runtime = new spatialXRRigidBody.SpatialXRHandCollisionRuntime();
  const hand = {
    present: true,
    confidence: 0.92,
    pinching: false,
    index: { velocity: { x: 0.8, y: -0.25, z: 0.18 } },
    middle: { velocity: { x: 0.45, y: -0.1, z: 0.12 } },
    ring: { velocity: { x: 0, y: 0, z: 0 } },
    pinky: { velocity: { x: 0, y: 0, z: 0 } },
    thumb: { velocity: { x: 0, y: 0, z: 0 } },
  };
  const contact = {
    active: true,
    primaryTargetId: 'mira.core',
    phase: 'press',
    pressure: 0.72,
    contactCount: 2,
    contacts: [
      { finger: 'index', targetId: 'mira.core', phase: 'press', pressure: 0.78, confidence: 0.9 },
      { finger: 'middle', targetId: 'mira.core', phase: 'contact', pressure: 0.48, confidence: 0.82 },
    ],
  };
  const impulse = runtime.update(hand, contact, 1000);
  assert.ok(impulse);
  assert.equal(impulse.targetId, 'mira.core');
  assert.ok(Math.hypot(impulse.impulse.x, impulse.impulse.y, impulse.impulse.z) <= 0.620001);
  assert.ok(impulse.intensity >= 0 && impulse.intensity <= 1);
  assert.equal(runtime.update(hand, contact, 1080), null);

  hand.pinching = true;
  assert.equal(runtime.update(hand, contact, 1300), null);
});

test('XR bimanual external commit keeps rigid inertia pose for next grab', () => {
  const runtime = new spatialXRBimanual.SpatialXRBimanualRuntime();
  const committed = runtime.commitExternal('core', {
    objectId: 'core',
    active: false,
    scaleRatio: 1.18,
    yawDeg: 26,
    pitchDeg: -14,
    rollDeg: 31,
    metricCenterDelta: { x: 0.02, y: 0.01, z: -0.03 },
  });
  assert.equal(committed.scaleRatio, 1.18);
  assert.equal(committed.yawDeg, 26);
  const snapshot = runtime.snapshot('core');
  assert.equal(snapshot.pitchDeg, -14);
  assert.equal(snapshot.rollDeg, 31);
});


test('photoreal visual quality respects device capability and render budget', () => {
  assert.equal(photorealDepth.resolvePhotorealVisualQuality({
    dpr: 2,
    width: 1440,
    height: 900,
    hardwareConcurrency: 12,
    deviceMemoryGb: 16,
    reducedMotion: false,
  }), 'ultra');

  assert.equal(photorealDepth.resolvePhotorealVisualQuality({
    dpr: 2.5,
    width: 390,
    height: 844,
    hardwareConcurrency: 2,
    deviceMemoryGb: 2,
    reducedMotion: false,
  }), 'lite');

  assert.equal(photorealDepth.resolvePhotorealVisualQuality({
    dpr: 2,
    width: 1366,
    height: 768,
    hardwareConcurrency: 8,
    deviceMemoryGb: 8,
    reducedMotion: true,
  }), 'high');
});

test('photoreal clarity adds bounded sharpness without exceeding DPR', () => {
  const high = photorealDepth.clarityProfile('high', 2, 0.7);
  assert.ok(high.renderDpr <= 2);
  assert.ok(high.renderDpr >= 1);
  assert.ok(high.sharpness > 0 && high.sharpness <= 0.28);
  assert.ok(high.contrast >= 1 && high.contrast <= 1.06);
  assert.ok(high.midOpacity > 0);
  assert.ok(high.nearOpacity > high.midOpacity - 0.02);

  const lite = photorealDepth.clarityProfile('lite', 3, 1);
  assert.equal(lite.renderDpr, 1);
  assert.ok(lite.sharpness <= 0.03);
  assert.equal(lite.midOpacity, 0);
  assert.equal(lite.nearOpacity, 0);
});

test('photoreal depth parallax remains subtle and layered', () => {
  const frame = photorealDepth.computePhotorealDepthFrame({
    pointerX: 1,
    pointerY: -1,
    gazeX: 0.8,
    gazeY: -0.6,
    attention: 0.9,
    quality: 'ultra',
  });
  assert.ok(Math.abs(frame.backX) <= 1.8);
  assert.ok(Math.abs(frame.midX) <= 3.4);
  assert.ok(Math.abs(frame.nearX) <= 5.2);
  assert.ok(Math.abs(frame.backY) <= 1.1);
  assert.ok(Math.abs(frame.midY) <= 2.1);
  assert.ok(Math.abs(frame.nearY) <= 3.2);
  assert.ok(Math.abs(frame.tiltXDeg) <= 0.36);
  assert.ok(Math.abs(frame.tiltYDeg) <= 0.5);
  assert.ok(Math.abs(frame.nearX) >= Math.abs(frame.midX));
  assert.ok(Math.abs(frame.midX) >= Math.abs(frame.backX));
});

test('lite photoreal depth disables motion layers deterministically', () => {
  const frame = photorealDepth.computePhotorealDepthFrame({
    pointerX: 1,
    pointerY: 1,
    gazeX: 1,
    gazeY: 1,
    attention: 1,
    quality: 'lite',
  });
  assert.deepEqual(frame, {
    backX: 0,
    backY: 0,
    midX: 0,
    midY: 0,
    nearX: 0,
    nearY: 0,
    tiltXDeg: 0,
    tiltYDeg: 0,
  });
});


test('camera-driven photoreal 3D stays bounded and directionally layered', () => {
  const frame = photorealCameraDepth.computeCameraSpatialFrame({
    enabled: true,
    yaw: 0.68,
    pitch: -0.52,
    roll: 0.48,
    distanceM: 0.55,
    baselineDistanceM: 0.72,
    confidence: 0.92,
    quality: 'ultra',
  });

  assert.ok(Math.abs(frame.roomX) <= 4.2);
  assert.ok(Math.abs(frame.roomY) <= 2.8);
  assert.ok(Math.abs(frame.subjectX) <= 8.4);
  assert.ok(Math.abs(frame.subjectY) <= 5.6);
  assert.ok(Math.abs(frame.foregroundX) <= 12.6);
  assert.ok(Math.abs(frame.foregroundY) <= 8.1);
  assert.ok(Math.abs(frame.rotateXDeg) <= 1.9);
  assert.ok(Math.abs(frame.rotateYDeg) <= 3.1);
  assert.ok(Math.abs(frame.rollDeg) <= 0.7);
  assert.ok(frame.scale >= 0.968 && frame.scale <= 1.038);
  assert.ok(Math.abs(frame.foregroundX) >= Math.abs(frame.subjectX));
  assert.ok(Math.abs(frame.subjectX) >= Math.abs(frame.roomX));
  assert.ok(frame.scale > 1);
});

test('camera-driven photoreal 3D disables on low confidence and lite quality', () => {
  const base = {
    enabled: true,
    yaw: 0.4,
    pitch: 0.3,
    roll: 0.2,
    distanceM: 0.5,
    baselineDistanceM: 0.7,
  };
  const lowConfidence = photorealCameraDepth.computeCameraSpatialFrame({
    ...base,
    confidence: 0.3,
    quality: 'ultra',
  });
  const lite = photorealCameraDepth.computeCameraSpatialFrame({
    ...base,
    confidence: 0.95,
    quality: 'lite',
  });

  for (const frame of [lowConfidence, lite]) {
    assert.equal(frame.roomX, 0);
    assert.equal(frame.subjectX, 0);
    assert.equal(frame.foregroundX, 0);
    assert.equal(frame.rotateXDeg, 0);
    assert.equal(frame.rotateYDeg, 0);
    assert.equal(frame.scale, 1);
    assert.equal(frame.intensity, 0);
  }
});

test('camera-driven photoreal zoom is relative to session baseline', () => {
  const common = {
    enabled: true,
    yaw: 0,
    pitch: 0,
    roll: 0,
    baselineDistanceM: 0.7,
    confidence: 1,
    quality: 'high',
  };
  const closer = photorealCameraDepth.computeCameraSpatialFrame({ ...common, distanceM: 0.48 });
  const baseline = photorealCameraDepth.computeCameraSpatialFrame({ ...common, distanceM: 0.7 });
  const farther = photorealCameraDepth.computeCameraSpatialFrame({ ...common, distanceM: 0.92 });

  assert.ok(closer.scale > baseline.scale);
  assert.equal(baseline.scale, 1);
  assert.ok(farther.scale < baseline.scale);
});


test('photoreal environment maps context into restrained room-light cues', () => {
  const rest = photorealEnvironment.computePhotorealEnvironmentFrame({
    label: 'rest_area',
    confidence: 0.92,
    attention: 0.8,
    cameraIntensity: 0.7,
    quality: 'ultra',
    performanceTier: 'full',
  });
  const workspace = photorealEnvironment.computePhotorealEnvironmentFrame({
    label: 'workspace',
    confidence: 0.92,
    attention: 0.8,
    cameraIntensity: 0.7,
    quality: 'ultra',
    performanceTier: 'full',
  });

  for (const frame of [rest, workspace]) {
    for (const value of Object.values(frame)) {
      assert.ok(value >= 0 && value <= 1);
    }
  }
  assert.ok(rest.warm > workspace.warm);
  assert.ok(workspace.cool > rest.cool);
  assert.ok(rest.practicalLight > 0);
  assert.ok(workspace.windowGlow > 0);
});

test('photoreal environment degrades decorative cues with performance tier', () => {
  const input = {
    label: 'rest_area',
    confidence: 1,
    attention: 1,
    cameraIntensity: 1,
    quality: 'high',
  };
  const full = photorealEnvironment.computePhotorealEnvironmentFrame({
    ...input,
    performanceTier: 'full',
  });
  const reduced = photorealEnvironment.computePhotorealEnvironmentFrame({
    ...input,
    performanceTier: 'reduced',
  });
  const minimal = photorealEnvironment.computePhotorealEnvironmentFrame({
    ...input,
    performanceTier: 'minimal',
  });

  assert.ok(full.reflection > reduced.reflection);
  assert.ok(reduced.reflection > minimal.reflection);
  assert.ok(full.dust > reduced.dust);
  assert.ok(reduced.dust > minimal.dust);
});

test('photoreal performance governor steps down after sustained slow frames', () => {
  const governor = new photorealEnvironment.PhotorealPerformanceGovernor();
  let tier = 'full';

  for (let index = 0; index < 50; index += 1) {
    tier = governor.update(30, 100 + index * 100);
  }
  assert.ok(tier === 'reduced' || tier === 'minimal');

  for (let index = 0; index < 50; index += 1) {
    tier = governor.update(34, 6_000 + index * 100);
  }
  assert.equal(tier, 'minimal');
});

test('photoreal performance governor can recover after sustained healthy frames', () => {
  const governor = new photorealEnvironment.PhotorealPerformanceGovernor();
  let tier = 'full';

  for (let index = 0; index < 60; index += 1) {
    tier = governor.update(34, 100 + index * 100);
  }
  assert.equal(tier, 'minimal');

  for (let index = 0; index < 80; index += 1) {
    tier = governor.update(16.2, 8_000 + index * 100);
  }
  assert.ok(tier === 'reduced' || tier === 'full');

  for (let index = 0; index < 80; index += 1) {
    tier = governor.update(16, 18_000 + index * 100);
  }
  assert.equal(tier, 'full');
});
