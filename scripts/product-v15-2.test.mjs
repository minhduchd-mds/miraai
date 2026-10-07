import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';

async function importTypeScript(path) {
  const source = readFileSync(path, 'utf8');
  let output = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
    fileName: path,
  }).outputText;

  if (output.includes("from './browser-capabilities'")) {
    const dependencySource = readFileSync('src/runtime/browser-capabilities.ts', 'utf8');
    const dependency = ts.transpileModule(dependencySource, {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
      fileName: 'src/runtime/browser-capabilities.ts',
    }).outputText;
    const dependencyUrl = `data:text/javascript;base64,${Buffer.from(dependency).toString('base64')}`;
    output = output.replace("from './browser-capabilities'", `from '${dependencyUrl}'`);
  }

  return import(`data:text/javascript;base64,${Buffer.from(output).toString('base64')}`);
}

const caps = await importTypeScript('src/runtime/browser-capabilities.ts');
const deviceDiagnostics = await importTypeScript('src/runtime/device-diagnostics.ts');
const trace = await importTypeScript('src/core/vision/perception-trace.ts');
const camera = await importTypeScript('src/core/vision/camera-profile.ts');

test('v15.2 capability matrix recognizes modern accelerated browser features', () => {
  class FakeVideo {}
  FakeVideo.prototype.requestVideoFrameCallback = () => 1;
  const scope = {
    HTMLVideoElement: FakeVideo,
    VideoFrame: function VideoFrame() {},
    MediaStreamTrackProcessor: function MediaStreamTrackProcessor() {},
    OffscreenCanvas: function OffscreenCanvas() {},
    AudioWorkletNode: function AudioWorkletNode() {},
    SharedArrayBuffer: function SharedArrayBuffer() {},
    crossOriginIsolated: true,
    PerformanceObserver: { supportedEntryTypes: ['long-animation-frame'] },
  };
  const nav = { gpu: {}, ml: {}, xr: {}, hardwareConcurrency: 12, deviceMemory: 16, userAgent: 'Chrome Desktop' };
  const result = caps.browserCapabilitySummary(scope, nav);
  assert.equal(result.mode, 'full');
  assert.equal(result.acceleratedMl, true);
  assert.equal(result.workerVideoPath, true);
  assert.equal(result.capabilities.longAnimationFrame, true);
});

test('v15.2 product mode degrades conservatively on a small mobile device', () => {
  class FakeVideo {}
  FakeVideo.prototype.requestVideoFrameCallback = () => 1;
  const scope = { HTMLVideoElement: FakeVideo, PerformanceObserver: { supportedEntryTypes: [] } };
  const nav = { hardwareConcurrency: 4, deviceMemory: 4, userAgent: 'Android Mobile' };
  const result = caps.browserCapabilitySummary(scope, nav);
  assert.equal(result.mode, 'compatibility');
  assert.equal(result.acceleratedMl, false);
});

test('device preflight reads capabilities without opening camera or microphone', async () => {
  class FakeVideo {}
  FakeVideo.prototype.requestVideoFrameCallback = () => 1;

  let getUserMediaCalls = 0;
  const permissionStates = { camera: 'granted', microphone: 'prompt' };
  const scope = {
    isSecureContext: true,
    HTMLVideoElement: FakeVideo,
    AudioWorkletNode: function AudioWorkletNode() {},
    crossOriginIsolated: true,
    PerformanceObserver: { supportedEntryTypes: [] },
  };
  const nav = {
    gpu: {},
    hardwareConcurrency: 8,
    deviceMemory: 8,
    userAgent: 'Chrome Desktop',
    mediaDevices: {
      getUserMedia() {
        getUserMediaCalls += 1;
        throw new Error('device preflight must not open media');
      },
    },
    permissions: {
      async query({ name }) {
        return { state: permissionStates[name] || 'prompt' };
      },
    },
    xr: {
      async isSessionSupported(mode) {
        return mode === 'immersive-ar';
      },
    },
  };

  const result = await deviceDiagnostics.runDeviceDiagnostics(scope, nav);
  assert.equal(getUserMediaCalls, 0);
  assert.equal(result.secureContext, true);
  assert.equal(result.mediaDevices, true);
  assert.equal(result.cameraPermission, 'granted');
  assert.equal(result.microphonePermission, 'prompt');
  assert.equal(result.webxr, true);
  assert.equal(result.immersiveAr, true);
  assert.equal(result.webgpu, true);
  assert.equal(result.webnn, false);
  assert.equal(result.productMode, 'full');
  assert.equal(result.hardwareConcurrency, 8);
  assert.equal(result.deviceMemoryGb, 8);
});

test('device report is versioned and excludes raw or identifying fields', async () => {
  class FakeVideo {}
  FakeVideo.prototype.requestVideoFrameCallback = () => 1;
  const scope = {
    isSecureContext: true,
    HTMLVideoElement: FakeVideo,
    AudioWorkletNode: function AudioWorkletNode() {},
    crossOriginIsolated: false,
    PerformanceObserver: { supportedEntryTypes: [] },
  };
  const nav = {
    userAgent: 'SECRET_USER_AGENT',
    gpu: {},
    hardwareConcurrency: 10,
    deviceMemory: 16,
    mediaDevices: {
      enumerateDevices: async () => [{ deviceId: 'SECRET_DEVICE_ID', label: 'SECRET_CAMERA_LABEL' }],
      getUserMedia() { throw new Error('must not open media'); },
    },
    permissions: { async query() { return { state: 'granted' }; } },
  };
  const diagnostics = await deviceDiagnostics.runDeviceDiagnostics(scope, nav);
  const polluted = {
    ...diagnostics,
    userAgent: nav.userAgent,
    deviceId: 'SECRET_DEVICE_ID',
    rawFrame: 'SECRET_FRAME',
    preciseLocation: 'SECRET_LOCATION',
  };
  const report = deviceDiagnostics.buildDeviceDiagnosticsReport(polluted, {
    provider: 'ElevenLabs',
    health: 'healthy',
    lastError: 'SECRET_PROVIDER_ERROR',
  });
  const serialized = JSON.stringify(report);

  assert.equal(report.format, 'mira.device-report');
  assert.equal(report.schemaVersion, 1);
  assert.equal(report.privacy.mediaCaptured, false);
  assert.equal(report.privacy.rawInputIncluded, false);
  assert.equal(report.privacy.identifiersIncluded, false);
  assert.equal(report.privacy.locationIncluded, false);
  assert.equal(report.voice.provider, 'ElevenLabs');
  assert.equal(report.voice.health, 'healthy');
  assert.equal(report.device.hardwareConcurrency, 10);
  assert.equal(report.device.deviceMemoryGb, 16);

  for (const secret of [
    'SECRET_USER_AGENT',
    'SECRET_DEVICE_ID',
    'SECRET_CAMERA_LABEL',
    'SECRET_FRAME',
    'SECRET_LOCATION',
    'SECRET_PROVIDER_ERROR',
  ]) {
    assert.ok(!serialized.includes(secret), `device report leaked ${secret}`);
  }
  for (const forbiddenKey of ['userAgent', 'deviceId', 'rawFrame', 'preciseLocation', 'lastError']) {
    assert.equal(Object.prototype.hasOwnProperty.call(report.device, forbiddenKey), false);
  }
});

test('device preflight degrades permission and WebXR probes without throwing', async () => {
  const scope = { isSecureContext: false, PerformanceObserver: { supportedEntryTypes: [] } };
  const nav = {
    userAgent: 'Unknown',
    permissions: { async query() { throw new Error('unsupported permission name'); } },
    xr: { async isSessionSupported() { throw new Error('XR unavailable'); } },
  };

  const result = await deviceDiagnostics.runDeviceDiagnostics(scope, nav);
  assert.equal(result.secureContext, false);
  assert.equal(result.mediaDevices, false);
  assert.equal(result.cameraPermission, 'unsupported');
  assert.equal(result.microphonePermission, 'unsupported');
  assert.equal(result.webxr, true);
  assert.equal(result.immersiveAr, null);
});

test('adaptive camera profile prioritizes latency on constrained devices', () => {
  assert.equal(camera.selectCameraProfile({ hardwareConcurrency: 12, deviceMemory: 16, userAgent: 'Desktop' }), 'quality');
  assert.equal(camera.selectCameraProfile({ hardwareConcurrency: 4, deviceMemory: 4, userAgent: 'Android Mobile' }), 'battery');
  const constraints = camera.cameraConstraintsForProfile('battery');
  assert.equal(constraints.width.ideal, 480);
  assert.equal(constraints.height.ideal, 360);
  assert.equal(constraints.frameRate.max, 24);
});

test('perception trace is bounded and never stores raw image fields', () => {
  const recorder = new trace.PerceptionTraceRecorder(2);
  recorder.start(100);
  for (let i = 0; i < 3; i += 1) {
    recorder.record({
      at: 100 + i * 33,
      inferenceMs: 18 + i,
      landmarkCount: 553,
      facePresent: true,
      handPresent: i > 0,
      gesture: 'Open_Palm',
      gestureScore: 0.88,
      pinching: false,
      scheduler: 'video-frame',
      frameLatenessMs: 0.2,
      width: 640,
      height: 480,
      rawFrame: 'must-not-survive',
    });
  }
  const session = recorder.stop(250);
  assert.equal(session.samples.length, 2);
  assert.equal(session.droppedSamples, 1);
  assert.equal(session.privacy, 'normalized-signals-only');
  assert.equal('rawFrame' in session.samples[0], false);
});
