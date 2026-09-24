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
