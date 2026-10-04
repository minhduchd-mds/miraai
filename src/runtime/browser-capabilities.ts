export interface MiraBrowserCapabilities {
  webgpu: boolean;
  webnn: boolean;
  webxr: boolean;
  videoFrame: boolean;
  requestVideoFrameCallback: boolean;
  mediaStreamTrackProcessor: boolean;
  offscreenCanvas: boolean;
  audioWorklet: boolean;
  longAnimationFrame: boolean;
  sharedArrayBuffer: boolean;
  crossOriginIsolated: boolean;
  hardwareConcurrency: number;
  deviceMemoryGb: number;
}

export type MiraProductMode = 'full' | 'balanced' | 'compatibility';

function supportedEntryTypes(scope: any): string[] {
  const Observer = scope?.PerformanceObserver;
  return Array.isArray(Observer?.supportedEntryTypes) ? Observer.supportedEntryTypes : [];
}

export function detectBrowserCapabilities(
  scope: any = globalThis,
  nav: any = typeof navigator === 'undefined' ? null : navigator,
): MiraBrowserCapabilities {
  const videoProto = scope?.HTMLVideoElement?.prototype;
  return {
    webgpu: Boolean(nav?.gpu),
    webnn: Boolean(nav?.ml),
    webxr: Boolean(nav?.xr),
    videoFrame: typeof scope?.VideoFrame === 'function',
    requestVideoFrameCallback: typeof videoProto?.requestVideoFrameCallback === 'function',
    mediaStreamTrackProcessor: typeof scope?.MediaStreamTrackProcessor === 'function',
    offscreenCanvas: typeof scope?.OffscreenCanvas === 'function',
    audioWorklet: typeof scope?.AudioWorkletNode === 'function',
    longAnimationFrame: supportedEntryTypes(scope).includes('long-animation-frame'),
    sharedArrayBuffer: typeof scope?.SharedArrayBuffer === 'function',
    crossOriginIsolated: Boolean(scope?.crossOriginIsolated),
    hardwareConcurrency: Math.max(0, Number(nav?.hardwareConcurrency || 0)),
    deviceMemoryGb: Math.max(0, Number(nav?.deviceMemory || 0)),
  };
}

export function recommendProductMode(
  capabilities: MiraBrowserCapabilities,
  nav: any = typeof navigator === 'undefined' ? null : navigator,
): MiraProductMode {
  const mobile = /Android|iPhone|iPad|iPod|Mobile/i.test(String(nav?.userAgent || ''));
  const lowMemory = capabilities.deviceMemoryGb > 0 && capabilities.deviceMemoryGb <= 4;
  const lowCpu = capabilities.hardwareConcurrency > 0 && capabilities.hardwareConcurrency <= 4;

  if (!capabilities.requestVideoFrameCallback || (mobile && lowMemory && lowCpu)) {
    return 'compatibility';
  }
  if (mobile || lowMemory || lowCpu || (!capabilities.webgpu && !capabilities.webnn)) {
    return 'balanced';
  }
  return 'full';
}

export function browserCapabilitySummary(
  scope: any = globalThis,
  nav: any = typeof navigator === 'undefined' ? null : navigator,
) {
  const capabilities = detectBrowserCapabilities(scope, nav);
  return {
    capabilities,
    mode: recommendProductMode(capabilities, nav),
    acceleratedMl: capabilities.webgpu || capabilities.webnn,
    workerVideoPath: capabilities.videoFrame &&
      capabilities.mediaStreamTrackProcessor &&
      capabilities.offscreenCanvas,
  };
}
