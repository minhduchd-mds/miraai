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

test('all in-memory TTS gateways share bounded rate-limit policy and prune buckets', () => {
  const contract = readFileSync('server/tts-contract.mjs', 'utf8');
  assert.match(contract, /MIRA_TTS_MAX_TRACKED_CLIENTS = 2048/);
  assert.match(contract, /MIRA_TTS_MAX_REQUESTS_PER_WINDOW = 48/);
  assert.match(contract, /MIRA_TTS_RATE_WINDOW_MS = 5 \* 60 \* 1000/);

  for (const path of [
    'server/tts-policy.mjs',
    'server/tts-gateway.mjs',
    'functions/miratts/index.mjs',
  ]) {
    const source = readFileSync(path, 'utf8');
    assert.match(source, /MIRA_TTS_MAX_TRACKED_CLIENTS/);
    assert.match(source, /MIRA_TTS_MAX_REQUESTS_PER_WINDOW/);
    assert.match(source, /function pruneRateBuckets\(now\)/);
    assert.match(source, /function ensureRateBucketCapacity\(\)/);
    assert.ok(!source.includes('MAX_REQUESTS_PER_WINDOW = 32'));
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

test('desktop music metadata parser is pinned, optional per file and preserves filename fallback', () => {
  const cargo = readFileSync('src-tauri/Cargo.toml', 'utf8');
  const media = readFileSync('src-tauri/src/media.rs', 'utf8');
  const prefs = readFileSync('src/desktop/preferences.ts', 'utf8');
  const settings = readFileSync('src/settings/SettingsPanel.tsx', 'utf8');

  assert.match(cargo, /rust-version = "1\.89"/);
  assert.match(cargo, /lofty = "=0\.25\.4"/);
  assert.match(media, /lofty::read_from_path\(path\)\.ok\(\)\?/);
  assert.match(media, /primary_tag\(\)\.or_else\(\|\| tagged_file\.first_tag\(\)\)/);
  assert.match(media, /fallback_artist/);
  assert.match(media, /fallback_title/);
  assert.match(media, /fallback_album/);
  assert.match(media, /embedded\.is_some\(\)/);
  assert.match(media, /music\.library\.tagged_track_count/);
  assert.match(prefs, /taggedTrackCount: number/);
  assert.match(settings, /bài có metadata/);
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

test('companion memory graph links co-occurring memories and music to user-stated context', () => {
  const memory = readFileSync('src-tauri/src/memory.rs', 'utf8');
  const media = readFileSync('src-tauri/src/media.rs', 'utf8');
  const skill = readFileSync('src/intelligence/skills/desktop-music-skill.ts', 'utf8');
  for (const token of ['CREATE TABLE IF NOT EXISTS memory_links', "'co_occurs'", 'link_structured_memories', 'Ký ức liên kết từ cùng bối cảnh trước đây']) {
    assert.ok(memory.includes(token), 'missing memory graph token: ' + token);
  }
  for (const token of ['CREATE TABLE IF NOT EXISTS music_context_history', 'contextual_local_track', 'record_music_context', 'explicit_context_hint', 'local-context-memory']) {
    assert.ok((memory + media).includes(token), 'missing music context memory token: ' + token);
  }
  assert.match(skill, /action: 'contextual'/);
  assert.match(skill, /Bật bài anh hay nghe lúc mệt/);
  assert.match(media, /hay nghe/);
  assert.match(media, /dung nho/);
});

test('desktop structured memory graph is inspectable and user-editable without fabricating semantic links', () => {
  const memory = readFileSync('src-tauri/src/memory.rs', 'utf8');
  const main = readFileSync('src-tauri/src/main.rs', 'utf8');
  const client = readFileSync('src/desktop/memory-graph.ts', 'utf8');
  const inspector = readFileSync('src/settings/StructuredMemoryInspector.tsx', 'utf8');
  const settings = readFileSync('src/settings/SettingsPanel.tsx', 'utf8');

  for (const token of [
    'desktop_memory_graph',
    'desktop_memory_structured_update',
    'desktop_memory_structured_delete',
  ]) {
    assert.ok(memory.includes(token), 'missing native memory graph command: ' + token);
    assert.ok(main.includes(token), 'native memory graph command is not registered: ' + token);
    assert.ok(client.includes(token), 'desktop client missing memory graph command: ' + token);
  }

  assert.match(memory, /LIMIT 240/);
  assert.match(memory, /LIMIT 600/);
  assert.match(memory, /relation='semantic_temporal'/);
  assert.match(memory, /DELETE FROM structured_memories WHERE id=\?1/);
  assert.match(memory, /normalized_text=\?2/);
  assert.match(memory, /another memory with the same normalized text already exists/);
  assert.match(inspector, /Ký ức có cấu trúc/);
  assert.match(inspector, /Liên kết gần nhất/);
  assert.match(inspector, /Quên ký ức/);
  assert.match(inspector, /Lưu thay đổi/);
  assert.match(settings, /lazy\(\(\) => import\('\.\/StructuredMemoryInspector'\)\)/);
  assert.match(settings, /desktopRuntime &&/);
});

test('desktop structured memory graph survives bounded merge-only Identity Capsule portability', () => {
  const memory = readFileSync('src-tauri/src/memory.rs', 'utf8');
  const main = readFileSync('src-tauri/src/main.rs', 'utf8');
  const localStore = readFileSync('src/intelligence/memory/local-memory-store.ts', 'utf8');
  const desktopStore = readFileSync('src/intelligence/memory/desktop-memory-store.ts', 'utf8');
  const capsule = readFileSync('src/intelligence/identity/capsule-client.ts', 'utf8');

  assert.match(memory, /desktop_memory_import_structured/);
  assert.match(main, /desktop_memory_import_structured/);
  assert.match(memory, /nodes\.into_iter\(\)\.take\(240\)/);
  assert.match(memory, /links\.into_iter\(\)\.take\(600\)/);
  assert.match(memory, /HashMap::<i64,i64>::new\(\)/);
  assert.match(memory, /"co_occurs"/);
  assert.match(memory, /"semantic_temporal"/);
  assert.match(memory, /weight\.clamp\(0\.0,3\.0\)/);
  assert.match(memory, /memory_links: Vec<StructuredMemoryLink>/);
  assert.match(memory, /#\[serde\(rename = "memoryLinks"\)\]/);

  assert.match(localStore, /structuredMemories\?: PortableStructuredMemory\[\]/);
  assert.match(localStore, /memoryLinks\?: PortableMemoryLink\[\]/);
  assert.match(localStore, /async importStructuredMemoryGraph/);
  assert.match(desktopStore, /desktop_memory_import_structured/);
  assert.match(desktopStore, /nodes\.slice\(-240\)/);
  assert.match(desktopStore, /links\.slice\(-600\)/);

  assert.match(capsule, /structuredMemory/);
  assert.match(capsule, /portableNodes/);
  assert.match(capsule, /portableLinks/);
  assert.match(capsule, /localMemory\.importStructuredMemoryGraph/);
  assert.match(capsule, /const CAPSULE_VERSION = 1/);
});

test('memory graph maintenance bounds derived edges without auto-deleting user memory nodes', () => {
  const memory = readFileSync('src-tauri/src/memory.rs', 'utf8');
  assert.match(memory, /MAX_MEMORY_LINKS_PER_NODE: usize = 24/);
  assert.match(memory, /WEAK_SEMANTIC_LINK_TTL_MS: i64 = 45 \* 24 \* 60 \* 60_000/);
  assert.match(memory, /relation='semantic_temporal' AND weight<0\.40/);
  assert.match(memory, /skip\(MAX_MEMORY_LINKS_PER_NODE\)/);
  assert.match(memory, /prune_memory_graph\(connection,&linked_ids,ts\)/);
  assert.match(memory, /prune_memory_graph\(&tx,&imported_ids,now\)/);

  const pruneStart = memory.indexOf('fn prune_memory_graph');
  const pruneEnd = memory.indexOf('fn link_recent_related_memories', pruneStart);
  const pruneSource = memory.slice(pruneStart, pruneEnd);
  assert.ok(!pruneSource.includes('DELETE FROM structured_memories'));
});

test('companion graph adds guarded semantic-temporal links and narrows passive music context window', () => {
  const memory = readFileSync('src-tauri/src/memory.rs', 'utf8');
  const media = readFileSync('src-tauri/src/media.rs', 'utf8');
  assert.match(memory, /fn semantic_tokens/);
  assert.match(memory, /semantic_temporal/);
  assert.match(memory, /score < 0\.25/);
  assert.match(memory, /7 \* 24 \* 60 \* 60_000/);
  assert.match(memory, /already_selected/);
  assert.match(media, /now - 45 \* 60_000/);
});

test('tool-first finance evidence runs before Brain and refuses unverified live prices', () => {
  const types = readFileSync('src/intelligence/skills/types.ts', 'utf8');
  const registry = readFileSync('src/intelligence/skills/registry.ts', 'utf8');
  const turn = readFileSync('src/runtime/turn-manager.ts', 'utf8');
  const live = readFileSync('src/intelligence/skills/finance-live-skill.ts', 'utf8');
  const policy = readFileSync('src/intelligence/skills/finance-policy-skill.ts', 'utf8');
  const gateway = readFileSync('api/finance.js', 'utf8');
  assert.match(types, /SkillExecutionMode = 'parallel' \| 'pre-brain'/);
  assert.match(registry, /financeCalculatorSkill/);
  assert.match(registry, /financeLiveSkill/);
  assert.match(turn, /preBrainPromise/);
  assert.match(turn, /MIRA_TOOL_EVIDENCE/);
  assert.match(live, /verified-live-data-unavailable/);
  assert.match(policy, /Không bịa giá hiện tại/);
  assert.match(gateway, /TWELVE_DATA_API_KEY/);
  assert.match(gateway, /api\.frankfurter\.dev\/v2\/rate/);
});

test('finance implementation stays behind a lazy boundary to protect initial bundle', () => {
  const registry = readFileSync('src/intelligence/skills/registry.ts', 'utf8');
  const lazy = readFileSync('src/intelligence/skills/finance-lazy.ts', 'utf8');
  assert.match(registry, /from '.\/finance-lazy'/);
  assert.doesNotMatch(registry, /from '.\/finance-live-skill'/);
  assert.doesNotMatch(registry, /from '.\/finance-calculator-skill'/);
  assert.match(lazy, /import\('\.\/finance-live-skill'\)/);
  assert.match(lazy, /import\('\.\/finance-calculator-skill'\)/);
  assert.match(lazy, /import\('\.\/finance-policy-skill'\)/);
});
