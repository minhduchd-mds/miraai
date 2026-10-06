import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function fakeStream(label) {
  let stopped = 0;
  const track = {
    readyState: 'live',
    stop() {
      if (this.readyState === 'ended') return;
      this.readyState = 'ended';
      stopped += 1;
    },
    getSettings() {
      return { width: 640, height: 480, frameRate: 30 };
    },
  };
  return {
    label,
    stream: {
      getTracks: () => [track],
      getVideoTracks: () => [track],
    },
    stopped: () => stopped,
  };
}

async function importCameraManager() {
  const source = readFileSync('src/core/vision/camera-manager.ts', 'utf8');
  const dependency = [
    "export function selectCameraProfile(){ return 'balanced'; }",
    "export function cameraConstraintsForProfile(){ return { width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 30 } }; }",
  ].join('\n');
  const dependencyUrl = `data:text/javascript;base64,${Buffer.from(dependency).toString('base64')}`;

  let output = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
    fileName: 'src/core/vision/camera-manager.ts',
  }).outputText;

  output = output.replace(/from ['"]\.\/camera-profile['"]/, `from '${dependencyUrl}'`);
  const moduleUrl = `data:text/javascript;base64,${Buffer.from(output).toString('base64')}#camera-${Date.now()}`;
  return import(moduleUrl);
}

test('camera lifecycle rejects stale getUserMedia results and preserves a newer reacquisition', async () => {
  const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  const originalDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  const opens = [];

  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: {
      mediaDevices: {
        getUserMedia() {
          const gate = deferred();
          opens.push(gate);
          return gate.promise;
        },
      },
    },
  });

  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: {
      createElement(kind) {
        assert.equal(kind, 'video');
        return {
          playsInline: false,
          muted: false,
          autoplay: false,
          paused: false,
          srcObject: null,
          videoWidth: 640,
          videoHeight: 480,
          async play() { this.paused = false; },
          pause() { this.paused = true; },
        };
      },
    },
  });

  try {
    const camera = await importCameraManager();
    const stale = fakeStream('stale');
    const current = fakeStream('current');

    const firstAcquire = camera.acquireVisionCamera('face').then(
      () => null,
      (error) => error,
    );
    assert.equal(opens.length, 1);

    camera.releaseVisionCamera('face');

    const secondAcquire = camera.acquireVisionCamera('face');
    assert.equal(opens.length, 2);

    opens[1].resolve(current.stream);
    const activeVideo = await secondAcquire;
    assert.equal(activeVideo.srcObject, current.stream);
    assert.equal(camera.getVisionCameraStream(), current.stream);
    assert.equal(camera.visionCameraStatus().active, true);
    assert.deepEqual(camera.visionCameraStatus().consumers, ['face']);

    opens[0].resolve(stale.stream);
    const staleError = await firstAcquire;
    assert.ok(staleError instanceof Error);
    assert.equal(staleError.name, 'AbortError');
    assert.equal(stale.stopped(), 1);
    assert.equal(current.stopped(), 0);
    assert.equal(camera.getVisionCameraStream(), current.stream);
    assert.deepEqual(camera.visionCameraStatus().consumers, ['face']);

    camera.releaseVisionCamera('face');
    assert.equal(current.stopped(), 1);
    assert.equal(camera.getVisionCameraStream(), null);
    assert.equal(camera.visionCameraStatus().active, false);
    assert.deepEqual(camera.visionCameraStatus().consumers, []);
  } finally {
    if (originalNavigator) Object.defineProperty(globalThis, 'navigator', originalNavigator);
    else delete globalThis.navigator;
    if (originalDocument) Object.defineProperty(globalThis, 'document', originalDocument);
    else delete globalThis.document;
  }
});

test('all in-memory TTS gateways bound and prune rate-limit buckets', () => {
  for (const path of [
    'server/tts-policy.mjs',
    'server/tts-gateway.mjs',
    'functions/miratts/index.mjs',
  ]) {
    const source = readFileSync(path, 'utf8');
    assert.match(source, /MAX_TRACKED_CLIENTS\s*=\s*2048/);
    assert.match(source, /function pruneRateBuckets\(now\)/);
    assert.match(source, /function ensureRateBucketCapacity\(\)/);
  }
});

test('desktop local actions are guarded by persisted native permissions', () => {
  const memory = readFileSync('src-tauri/src/memory.rs', 'utf8');
  const media = readFileSync('src-tauri/src/media.rs', 'utf8');
  const skill = readFileSync('src/intelligence/skills/desktop-music-skill.ts', 'utf8');
  assert.match(memory, /permission_enabled/);
  assert.match(memory, /"media\.control"/);
  assert.match(memory, /"memory\.affect"/);
  assert.match(media, /permission_enabled\(&app,\s*"media\.control"/);
  assert.match(skill, /desktopMusicRequest/);
  assert.match(skill, /action: 'search'/);
  assert.match(skill, /Mở bài The Night I Found You/);
});

test('desktop music library is opt-in, root-scoped and keeps local play history', () => {
  const memory = readFileSync('src-tauri/src/memory.rs', 'utf8');
  const media = readFileSync('src-tauri/src/media.rs', 'utf8');
  const prefs = readFileSync('src/desktop/preferences.ts', 'utf8');
  const skill = readFileSync('src/intelligence/skills/desktop-music-skill.ts', 'utf8');
  assert.match(memory, /\("media\.library", 0_i64\)/);
  assert.match(memory, /CREATE TABLE IF NOT EXISTS music_tracks/);
  assert.match(media, /MAX_LIBRARY_TRACKS: usize = 20_000/);
  assert.match(media, /path\.starts_with\(root\)/);
  assert.match(media, /desktop_music_choose_folder/);
  assert.match(media, /last_played_at/);
  assert.match(media, /play_count=play_count\+1/);
  assert.match(prefs, /desktop_music_rescan/);
  assert.match(skill, /action: 'recent'/);
  assert.match(skill, /Bật lại bài hôm trước anh nghe/);
});

test('desktop companion memory distills only user-stated structured memories and tracks open threads', () => {
  const memory = readFileSync('src-tauri/src/memory.rs', 'utf8');
  const prompt = readFileSync('src/core/brain/prompt.ts', 'utf8');
  for (const token of [
    'CREATE TABLE IF NOT EXISTS structured_memories',
    'user_statement',
    'split_once("\\nMira:")',
    '"preference"',
    '"life_event"',
    '"relationship_context"',
    '"emotional_episode"',
    '"active_thread"',
    "status='resolved'",
    'Mạch đang theo dõi gần đây',
    'không phải suy luận của Mira',
  ]) assert.ok(memory.includes(token), 'missing structured companion memory token: ' + token);
  assert.match(memory, /dung nho/);
  assert.match(memory, /DELETE FROM structured_memories/);
  assert.match(prompt, /Ký ức dài hạn chỉ được xem là điều người dùng từng tự nói/);
  assert.match(prompt, /Tín hiệu biểu cảm\/camera chỉ là quan sát có độ tin cậy/);
});

test('memory opt-out stays session-only and blocks raw turn plus distillation persistence', () => {
  const service = readFileSync('src/intelligence/memory/memory-service.ts', 'utf8');
  assert.match(service, /function memoryOptOut/);
  assert.match(service, /skipAssistantPersistenceOnce/);
  assert.match(service, /if \(memoryOptOut\(turn\.text\)\)/);
  assert.match(service, /if \(memoryOptOut\(userText\)\) return/);
  assert.match(service, /dung nho/);
  assert.match(service, /dung luu/);
});
