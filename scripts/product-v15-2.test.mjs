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

const caps = await importTypeScript('src/runtime/browser-capabilities.ts');
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
