import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { NEUTRAL_FACE, deformRig, prepareRig, visemeFromAudio } from '../src/presence/live-avatar/rig-deform.ts';
import { AvatarMotion } from '../src/presence/live-avatar/motion.ts';

// Behavioural tests over the real shipped rig (public/mira-assets/live/*.rig.json).
const rig = JSON.parse(readFileSync('public/mira-assets/live/mira-live-face-v1.rig.json', 'utf8'));
const prep = prepareRig(rig);
const out = new Float32Array(prep.count * 2);
const y = (i) => out[i * 2 + 1];
const x = (i) => out[i * 2];
const pose = (over) => ({ ...NEUTRAL_FACE, ...over });

function signedArea(pos, a, b, c) {
  return (pos[b * 2] - pos[a * 2]) * (pos[c * 2 + 1] - pos[a * 2 + 1]) - (pos[c * 2] - pos[a * 2]) * (pos[b * 2 + 1] - pos[a * 2 + 1]);
}
function flippedTriangles(params) {
  deformRig(prep, params, out);
  let flips = 0;
  const t = rig.triangles;
  for (let i = 0; i < t.length; i += 3) {
    const before = signedArea(prep.rest, t[i], t[i + 1], t[i + 2]);
    const after = signedArea(out, t[i], t[i + 1], t[i + 2]);
    if (Math.abs(before) > 1e-3 && Math.sign(before) !== Math.sign(after)) flips += 1;
  }
  return flips;
}

test('shipped rig is well-formed: 478 face landmarks + halo/border, valid indices, mouth cavity strip', () => {
  assert.equal(rig.schema, 'mira.live-avatar.rig.v1');
  assert.equal(prep.count, rig.vertices.length / 3);
  assert.ok(prep.count > 478);
  for (const i of [...rig.triangles, ...rig.mouthTriangles]) assert.ok(Number.isInteger(i) && i >= 0 && i < prep.count);
  assert.equal(rig.triangles.length % 3, 0);
  assert.equal(rig.mouthTriangles.length, 20 * 3);
  assert.equal(rig.headWeight.length, prep.count);
});

test('neutral pose is the identity (the still photo is reproduced exactly)', () => {
  const open = deformRig(prep, pose({}), out);
  assert.equal(open, 0);
  for (let i = 0; i < out.length; i += 1) assert.ok(Math.abs(out[i] - prep.rest[i]) < 1e-3, `vertex ${i >> 1}`);
});

test('jaw opens like a lens: centre drops most, corners stay nearly closed, upper face untouched', () => {
  const restLower = prep.rest[14 * 2 + 1], restUpper = prep.rest[13 * 2 + 1];
  const restCorner = prep.rest[61 * 2 + 1], restNose = prep.rest[1 * 2 + 1], restBrow = prep.rest[105 * 2 + 1];
  const open = deformRig(prep, pose({ jaw: 1 }), out);
  assert.ok(open > prep.faceH * 0.06, 'visible opening');
  const centreDrop = y(14) - restLower;
  assert.ok(centreDrop > prep.faceH * 0.06);
  assert.ok(Math.abs(y(61) - restCorner) < centreDrop * 0.15, 'corner stays closed');
  assert.ok(y(13) < restUpper, 'upper lip lifts slightly');
  assert.ok(Math.abs(y(1) - restNose) < 0.01 && Math.abs(y(105) - restBrow) < 0.01, 'nose and brow unaffected');
});

test('blink closes the upper lids onto the lower lids', () => {
  deformRig(prep, pose({ blinkL: 1, blinkR: 1 }), out);
  const gapL = Math.abs(y(145) - y(159)), gapR = Math.abs(y(374) - y(386));
  const restGapL = Math.abs(prep.rest[145 * 2 + 1] - prep.rest[159 * 2 + 1]);
  assert.ok(gapL < restGapL * 0.15 && gapR < restGapL * 0.2, `gaps ${gapL.toFixed(2)} / ${gapR.toFixed(2)}`);
});

test('pucker narrows the mouth and stretch widens it', () => {
  deformRig(prep, pose({}), out); const rest = Math.abs(x(291) - x(61));
  deformRig(prep, pose({ round: 1 }), out); const round = Math.abs(x(291) - x(61));
  deformRig(prep, pose({ spread: 1 }), out); const spread = Math.abs(x(291) - x(61));
  assert.ok(round < rest * 0.92 && spread > rest * 1.05);
});

test('no skin triangle folds over (no tearing) at extreme combined poses', () => {
  for (const params of [
    pose({ jaw: 1 }), pose({ jaw: 1, round: 1 }), pose({ jaw: 1, spread: 1, smile: 1 }),
    pose({ blinkL: 1, blinkR: 1, gazeX: 1, gazeY: -1 }), pose({ blinkL: 0.5, blinkR: 0.5 }),
    pose({ gazeX: 1, gazeY: 1 }), pose({ gazeX: -1, gazeY: -1 }),
    pose({ jaw: 0.8, yaw: 0.08, pitch: 0.06, roll: 0.06, brow: 1, breath: 1 }),
    pose({ jaw: 0.8, yaw: -0.08, pitch: -0.06, roll: -0.06, brow: -1, breath: -1 }),
  ]) {
    assert.equal(flippedTriangles(params), 0, JSON.stringify(params));
    for (const v of out) assert.ok(Number.isFinite(v));
  }
});

test('visemes: amplitude drives the jaw, low band rounds, high band spreads', () => {
  assert.deepEqual(visemeFromAudio(0, null), { jaw: 0, round: 0, spread: 0 });
  assert.ok(visemeFromAudio(0.8, { low: 0.8, mid: 0.1, high: 0.05 }).round > 0.3);
  assert.ok(visemeFromAudio(0.8, { low: 0.05, mid: 0.2, high: 0.7 }).spread > 0.3);
});

test('motion: the mouth never moves unless Mira herself is speaking', () => {
  const motion = new AvatarMotion(7);
  let maxJaw = 0;
  for (let t = 0; t < 3000; t += 16) {
    const p = motion.update({ timeMs: t, state: 'listening', voiceLevel: -1, voiceBands: null, userLevel: 0.9, reducedMotion: false });
    maxJaw = Math.max(maxJaw, p.jaw);
  }
  assert.equal(maxJaw, 0);
  let spoke = 0;
  for (let t = 3000; t < 4000; t += 16) {
    spoke = Math.max(spoke, motion.update({ timeMs: t, state: 'speaking', voiceLevel: 0.7, voiceBands: { low: 0.3, mid: 0.4, high: 0.2 }, userLevel: 0, reducedMotion: false }).jaw);
  }
  assert.ok(spoke > 0.5);
});

test('motion: natural blinks happen every few seconds; reduced motion keeps the head almost still', () => {
  const motion = new AvatarMotion(3);
  let blinks = 0, wasClosed = false, maxYaw = 0;
  for (let t = 0; t < 12000; t += 16) {
    const p = motion.update({ timeMs: t, state: 'idle', voiceLevel: -1, voiceBands: null, userLevel: 0, reducedMotion: false });
    const closed = p.blinkL > 0.9;
    if (closed && !wasClosed) blinks += 1;
    wasClosed = closed;
    maxYaw = Math.max(maxYaw, Math.abs(p.yaw));
  }
  assert.ok(blinks >= 2 && blinks <= 7, `blinks=${blinks}`);
  const calm = new AvatarMotion(3);
  let calmYaw = 0;
  for (let t = 0; t < 12000; t += 16) calmYaw = Math.max(calmYaw, Math.abs(calm.update({ timeMs: t, state: 'idle', voiceLevel: -1, voiceBands: null, userLevel: 0, reducedMotion: true }).yaw));
  assert.ok(calmYaw < maxYaw * 0.4);
});

test('face asset is an original, budgeted WebP with provenance on file', () => {
  const bytes = statSync('public/mira-assets/live/mira-live-face-v1.webp').size;
  assert.ok(bytes < 180 * 1024, `${bytes} bytes`);
  const provenance = readFileSync('docs/MIRA-LIVE-AVATAR-FACE-PROVENANCE.md', 'utf8');
  assert.match(provenance, /gemini-3\.1-flash-image/);
  assert.match(provenance, /4ZUXPxQvSWfWJXsAJwRr8V/);
});

test('empathy: camera mood nudges the face (joy → warmer smile, sadness → concerned brows), never folds', async () => {
  const { EMPATHY_OFFSETS } = await import('../src/presence/live-avatar/motion.ts');
  const run = (userMood) => {
    const m = new AvatarMotion(11);
    let last;
    for (let t = 0; t < 3000; t += 16) last = m.update({ timeMs: t, state: 'listening', voiceLevel: -1, voiceBands: null, userLevel: 0, reducedMotion: false, userMood });
    return last;
  };
  const neutral = run('neutral'), happy = run('happy'), sad = run('sad'), surprised = run('surprised');
  assert.ok(happy.smile > neutral.smile + 0.1, `happy ${happy.smile} vs ${neutral.smile}`);
  assert.ok(sad.smile < neutral.smile && sad.brow > neutral.brow + 0.15);
  assert.ok(surprised.brow > neutral.brow + 0.25);
  assert.ok(EMPATHY_OFFSETS.angry.smile <= 0 && EMPATHY_OFFSETS.angry.brow < 0.2, 'calm attention, no anger mirroring');
  for (const p of [happy, sad, surprised]) assert.equal(flippedTriangles(p), 0);
});
