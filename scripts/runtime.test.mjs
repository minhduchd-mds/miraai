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
const proactive = await importTypeScript('src/intelligence/proactive/proactive-engine.ts');
const facialGesture = await importTypeScript('src/core/face/facial-gesture.ts');
const facs = await importTypeScript('src/core/face/facs-proxy.ts');
const realPresence = await importTypeScript('src/core/vision/real-presence.ts');
const microExpression = await importTypeScript('src/core/face/micro-expression.ts');
const postureModel = await importTypeScript('src/core/vision/posture-model.ts');
const rppgSignal = await importTypeScript('src/core/vision/rppg-signal.ts');
const interaction = await importTypeScript('src/intelligence/social/interaction-engine.ts');
const behaviorTimeline = await importTypeScript('src/intelligence/social/behavior-timeline.ts');
const handGestureLite = await importTypeScript('src/core/vision/hand-gesture-lite.ts');
const visionPerformance = await importTypeScript('src/core/vision/vision-performance.ts');
const gazeCalibration = await importTypeScript('src/intelligence/social/gaze-head-calibration.ts');
const gestureIntent = await importTypeScript('src/core/vision/gesture-intent.ts');
const environmentModel = await importTypeScript('src/core/vision/environment-model.ts');

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
