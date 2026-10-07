import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const sha = 'a'.repeat(40);
const privacy = { mediaCaptured: false, rawInputIncluded: false, identifiersIncluded: false, locationIncluded: false };
// Test fixtures only: these are never release evidence or retained artifacts.
function fixture(index) {
  return {
    format: 'mira.device-lab-result', schemaVersion: 1, releaseSha: sha,
    createdAt: `2026-10-07T0${index}:00:00Z`, label: `Test fixture ${index}`, privacy,
    source: {
      format: 'mira.device-report', schemaVersion: 1, privacy,
      createdAt: `2026-10-07T0${index}:00:00Z`,
      device: { secureContext: true, mediaDevices: true, cameraPermission: 'granted', microphonePermission: 'granted', immersiveAr: false },
      voice: { health: 'healthy', provider: 'test' },
    },
    observation: {
      cameraStarted: true, cameraStartMs: 1000, faceDetected: true,
      handDetected: true, gestureStable: true, voicePlayback: true,
      voiceFirstAudioMs: 1000, interruptionWorked: true, desktopLaunch: true,
    },
  };
}
function temp(run) {
  mkdirSync('work', { recursive: true });
  const dir = mkdtempSync(join('work', 'release-gate-test-'));
  try { return run(dir); } finally { rmSync(dir, { recursive: true, force: true }); }
}
function matrix(results, args = []) {
  return temp(dir => {
    results.forEach((result, i) => writeFileSync(join(dir, `${i}.json`), JSON.stringify(result)));
    return spawnSync(process.execPath, ['scripts/device-lab-matrix.mjs', `--dir=${dir}`, '--require=3', '--no-write', `--release-sha=${sha}`, ...args], { encoding: 'utf8' });
  });
}
test('release matrix accepts complete evidence for the exact commit', () => {
  const run = matrix([fixture(1), fixture(2), fixture(3)]);
  assert.equal(run.status, 0, run.stderr);
});
for (const [name, mutate] of [
  ['failed observation', r => { r.observation.gestureStable = false; }],
  ['missing observation', r => { delete r.observation.interruptionWorked; }],
  ['warning latency', r => { r.observation.voiceFirstAudioMs = 2000; }],
  ['missing latency', r => { delete r.observation.cameraStartMs; }],
  ['invalid latency', r => { r.observation.cameraStartMs = '1000'; }],
  ['unhealthy voice', r => { r.source.voice.health = 'unhealthy'; }],
  ['unknown voice', r => { r.source.voice.health = 'unknown'; }],
  ['stale commit', r => { r.releaseSha = 'b'.repeat(40); }],
  ['unbound capture', r => { delete r.releaseSha; }],
  ['private input', r => { r.source.device.deviceId = 'forbidden'; }],
  ['XR observation missing', r => { r.source.device.immersiveAr = true; }],
  ['unresolved XR preflight', r => { r.source.device.immersiveAr = null; }],
  ['malformed capability', r => { r.source.device.secureContext = 'false'; }],
]) {
  test(`release matrix rejects ${name}`, () => {
    const results = [fixture(1), fixture(2), fixture(3)];
    mutate(results[0]);
    assert.notEqual(matrix(results).status, 0);
  });
}
test('release matrix rejects insufficient and duplicate evidence', () => {
  assert.notEqual(matrix([fixture(1), fixture(2)]).status, 0);
  const duplicate = structuredClone(fixture(1));
  duplicate.label = 'Renamed fixture';
  assert.notEqual(matrix([fixture(1), duplicate, fixture(3)]).status, 0);
  const repeatedLabel = fixture(2);
  repeatedLabel.label = fixture(1).label;
  assert.notEqual(matrix([fixture(1), repeatedLabel, fixture(3)]).status, 0);
});
test('invalid gate arguments cannot silently disable the evidence requirement', () => {
  for (const arg of ['--require=NaN', '--require=-1', '--require=1.5', '--release-sha=bad', '--requre=3']) {
    assert.notEqual(matrix([fixture(1), fixture(2), fixture(3)], [arg]).status, 0);
  }
});
test('contract-only matrix allows a clean checkout without empirical data', () => {
  temp(dir => {
    const run = spawnSync(process.execPath, ['scripts/device-lab-matrix.mjs', `--dir=${join(dir, 'missing')}`, '--no-write']);
    assert.equal(run.status, 0);
    assert.notEqual(spawnSync(process.execPath, ['scripts/device-lab-matrix.mjs', `--dir=${join(dir, 'missing')}`, '--require=3']).status, 0);
  });
});
test('desktop publisher rejects unsigned, stale, unnotarized and altered artifacts', () => {
  temp(dir => {
    const artifact = 'Mira-v0.1.0-macOS-Intel.dmg';
    const bytes = Buffer.from('test fixture, not a DMG');
    const hash = createHash('sha256').update(bytes).digest('hex');
    writeFileSync(join(dir, artifact), bytes);
    writeFileSync(join(dir, `${artifact}.sha256`), `${hash}  ${artifact}\n`);
    const valid = { format: 'mira.desktop-release-validation', schemaVersion: 1, commit: sha, platform: 'macos-intel', artifact, sha256: hash, signed: true, notarized: true };
    function run(validation) {
      writeFileSync(join(dir, 'release-validation.json'), JSON.stringify(validation));
      return spawnSync(process.execPath, ['scripts/validate-desktop-release.mjs', dir], { env: { ...process.env, GITHUB_SHA: sha }, encoding: 'utf8' });
    }
    assert.equal(run(valid).status, 0);
    for (const change of [{ signed: false }, { notarized: false }, { commit: 'b'.repeat(40) }, { sha256: '0'.repeat(64) }]) {
      assert.notEqual(run({ ...valid, ...change }).status, 0);
    }
    writeFileSync(join(dir, artifact), 'altered');
    assert.notEqual(run(valid).status, 0);
  });
});

test('private CI gate requires matching evidence and does not log malformed secret input', () => {
  temp(dir => {
    const env = { ...process.env, RUNNER_TEMP: dir, GITHUB_SHA: sha };
    delete env.DEVICE_LAB_RESULTS;
    function run(input) {
      return spawnSync(process.execPath, ['scripts/check-device-release.mjs'], {
        env: input === undefined ? env : { ...env, DEVICE_LAB_RESULTS: input }, encoding: 'utf8',
      });
    }
    assert.notEqual(run().status, 0);
    const secret = 'DO_NOT_LOG_PRIVATE_PAYLOAD';
    const malformed = run(secret);
    assert.notEqual(malformed.status, 0);
    assert.ok(!malformed.stderr.includes(secret));
    const results = [fixture(1), fixture(2), fixture(3)];
    assert.equal(run(JSON.stringify(results)).status, 0);
    results[0].releaseSha = 'b'.repeat(40);
    assert.notEqual(run(JSON.stringify(results)).status, 0);
  });
});
