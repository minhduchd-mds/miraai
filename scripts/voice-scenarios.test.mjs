import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  LIVE_IDLE_TIMEOUT_MS, LIVE_MAX_RECONNECTS, buildAudioStreamEndMessage, liveReconnectDelayMs, liveReconnectPlan,
} from '../src/core/live/live-protocol.ts';

// Voice scenario matrix (docs/MIRA-VOICE-SCENARIOS.md): policy + wiring guards.
const read = (p) => readFileSync(p, 'utf8');
const session = read('src/core/live/live-session.ts');
const hook = read('src/core/live/useLiveConversation.ts');
const mira = read('src/core/useMira.ts');
const lifecycle = read('src/app/useVoiceSessionLifecycle.ts');
const now = Date.parse('2026-10-24T08:00:00Z');

test('Live reconnect: reuse a valid token, mint a new one after 30 min, give up after 3 tries or without a handle', () => {
  const base = { hasResumeHandle: true, now, attempts: 0 };
  assert.equal(liveReconnectPlan({ ...base, tokenExpiresAt: new Date(now + 20 * 60_000).toISOString() }), 'reuse-token');
  assert.equal(liveReconnectPlan({ ...base, tokenExpiresAt: new Date(now + 5_000).toISOString() }), 'refresh-token');
  assert.equal(liveReconnectPlan({ ...base, tokenExpiresAt: '' }), 'refresh-token');
  assert.equal(liveReconnectPlan({ ...base, hasResumeHandle: false, tokenExpiresAt: new Date(now + 60_000).toISOString() }), 'give-up');
  assert.equal(liveReconnectPlan({ ...base, attempts: LIVE_MAX_RECONNECTS, tokenExpiresAt: new Date(now + 60_000).toISOString() }), 'give-up');
  assert.deepEqual([0, 1, 2, 9].map(liveReconnectDelayMs), [300, 1200, 3000, 3000]);
});

test('Live: audioStreamEnd flush message and a bounded idle timeout', () => {
  assert.deepEqual(buildAudioStreamEndMessage(), { realtimeInput: { audioStreamEnd: true } });
  assert.equal(LIVE_IDLE_TIMEOUT_MS, 180_000);
  assert.match(session, /idle_timeout/);
  assert.match(session, /this\.lastActivity = Date\.now\(\);\s*this\.enqueueAudio/);
});

test('Live on iOS: the AudioContext is created before any await in the tap handler', () => {
  const start = hook.slice(hook.indexOf('const start = useCallback(async () => {'));
  const ctxAt = start.indexOf('unlockedAudioContext()');
  const firstAwait = start.indexOf('await ');
  assert.ok(ctxAt > 0 && ctxAt < firstAwait, 'context must be created synchronously');
  assert.match(hook, /audioContext,\n\s*\}\);/);
  assert.doesNotMatch(session, /playCtx|captureCtx/, 'one shared context, no late-created contexts');
});

test('Live: lost mic, hidden tab and spent tokens are handled', () => {
  assert.match(session, /addEventListener\('ended', \(\) => \{ if \(!this\.stopped\) this\.fail\('mic_lost'\); \}\)/);
  assert.match(session, /document\.addEventListener\('visibilitychange', this\.onVisibility\)/);
  assert.match(session, /plan === 'refresh-token'[\s\S]*this\.fetchToken\(\)/);
});

test('Hands-free: silence auto-stop, noise filter, STT error copy, network retry, background pause', async () => {
  assert.match(mira, /const SILENCE_AUTO_STOP = 8;/);
  assert.match(mira, /silentStreakRef\.current >= SILENCE_AUTO_STOP/);
  for (const code of ["'audio-capture'", "'language-not-supported'", "'network'"]) assert.ok(mira.includes(`err === ${code}`), code);
  assert.match(mira, /sttNetworkRetryRef\.current = true;\s*schedulePendingListen\(1200/);
  assert.match(lifecycle, /visibilityState === 'hidden'\) \{ mira\.pauseForBackground\(\); return; \}/);
  // Pure filter, extracted for a behavioural check.
  const src = mira.match(/export function isMeaningfulTranscript\(text: string\): boolean \{\n\s*return (.+);\n\}/)[1];
  const isMeaningful = new Function('text', `return ${src};`);
  assert.equal(isMeaningful('...'), false);
  assert.equal(isMeaningful(' ?! '), false);
  assert.equal(isMeaningful('ừ'), true);
  assert.equal(isMeaningful('12'), true);
});

test('Privacy: the mic button never turns the camera on', () => {
  const activate = lifecycle.slice(lifecycle.indexOf('const activateVoice = useCallback'), lifecycle.indexOf('const onKey'));
  assert.doesNotMatch(activate, /toggleVision\(/);
});

test('Live capture: worklet is routed to the destination and addModule is time-bounded', () => {
  assert.match(session, /node\.connect\(mute\);\s*mute\.connect\(ctx\.destination\);/);
  assert.match(session, /Promise\.race\(\[\s*ctx\.audioWorklet\.addModule\(url\)/);
  assert.match(session, /worklet_timeout/);
});

test('Mic/STT failures reset the caption instead of leaving "Đang nghe…"', () => {
  assert.match(mira, /const failMic = \(message: string\) => \{[\s\S]*setCaption\(IDLE_CAPTION\);[\s\S]*setError\(message\);/);
});
