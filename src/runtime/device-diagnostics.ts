import {
  browserCapabilitySummary,
  type MiraProductMode,
} from './browser-capabilities';

export type DevicePermissionState =
  | 'granted'
  | 'denied'
  | 'prompt'
  | 'unsupported'
  | 'unknown';

export interface MiraDeviceDiagnostics {
  checkedAt: number;
  secureContext: boolean;
  mediaDevices: boolean;
  cameraPermission: DevicePermissionState;
  microphonePermission: DevicePermissionState;
  webxr: boolean;
  immersiveAr: boolean | null;
  webgpu: boolean;
  webnn: boolean;
  requestVideoFrameCallback: boolean;
  audioWorklet: boolean;
  crossOriginIsolated: boolean;
  productMode: MiraProductMode;
  hardwareConcurrency: number;
  deviceMemoryGb: number;
}

async function permissionState(
  nav: any,
  name: 'camera' | 'microphone',
): Promise<DevicePermissionState> {
  if (!nav?.permissions?.query) return 'unsupported';

  try {
    const result = await nav.permissions.query({ name });
    const state = String(result?.state || 'unknown');
    if (state === 'granted' || state === 'denied' || state === 'prompt') {
      return state;
    }
    return 'unknown';
  } catch {
    // Some browsers expose Permissions API but do not support camera/microphone names.
    return 'unsupported';
  }
}

export async function runDeviceDiagnostics(
  scope: any = globalThis,
  nav: any = typeof navigator === 'undefined' ? null : navigator,
): Promise<MiraDeviceDiagnostics> {
  const summary = browserCapabilitySummary(scope, nav);
  const [cameraPermission, microphonePermission] = await Promise.all([
    permissionState(nav, 'camera'),
    permissionState(nav, 'microphone'),
  ]);

  let immersiveAr: boolean | null = false;
  if (nav?.xr?.isSessionSupported) {
    try {
      immersiveAr = Boolean(await nav.xr.isSessionSupported('immersive-ar'));
    } catch {
      immersiveAr = null;
    }
  }

  return {
    checkedAt: Date.now(),
    secureContext: Boolean(scope?.isSecureContext),
    mediaDevices: Boolean(nav?.mediaDevices?.getUserMedia),
    cameraPermission,
    microphonePermission,
    webxr: summary.capabilities.webxr,
    immersiveAr,
    webgpu: summary.capabilities.webgpu,
    webnn: summary.capabilities.webnn,
    requestVideoFrameCallback: summary.capabilities.requestVideoFrameCallback,
    audioWorklet: summary.capabilities.audioWorklet,
    crossOriginIsolated: summary.capabilities.crossOriginIsolated,
    productMode: summary.mode,
    hardwareConcurrency: summary.capabilities.hardwareConcurrency,
    deviceMemoryGb: summary.capabilities.deviceMemoryGb,
  };
}
