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

export interface MiraDeviceReportVoice {
  provider: string;
  health: string;
}

export interface MiraDeviceReport {
  format: 'mira.device-report';
  schemaVersion: 1;
  createdAt: string;
  privacy: {
    mediaCaptured: false;
    rawInputIncluded: false;
    identifiersIncluded: false;
    locationIncluded: false;
  };
  device: {
    checkedAt: string;
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
  };
  voice: MiraDeviceReportVoice;
}

function safeIsoDate(value: number): string {
  const date = new Date(Number.isFinite(value) && value > 0 ? value : Date.now());
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

function boundedLabel(value: unknown, fallback: string): string {
  const text = String(value || '').trim().slice(0, 80);
  return text || fallback;
}

export function buildDeviceDiagnosticsReport(
  diagnostics: MiraDeviceDiagnostics,
  voice: Partial<MiraDeviceReportVoice> = {},
): MiraDeviceReport {
  return {
    format: 'mira.device-report',
    schemaVersion: 1,
    createdAt: new Date().toISOString(),
    privacy: {
      mediaCaptured: false,
      rawInputIncluded: false,
      identifiersIncluded: false,
      locationIncluded: false,
    },
    device: {
      checkedAt: safeIsoDate(diagnostics.checkedAt),
      secureContext: Boolean(diagnostics.secureContext),
      mediaDevices: Boolean(diagnostics.mediaDevices),
      cameraPermission: diagnostics.cameraPermission,
      microphonePermission: diagnostics.microphonePermission,
      webxr: Boolean(diagnostics.webxr),
      immersiveAr: diagnostics.immersiveAr == null ? null : Boolean(diagnostics.immersiveAr),
      webgpu: Boolean(diagnostics.webgpu),
      webnn: Boolean(diagnostics.webnn),
      requestVideoFrameCallback: Boolean(diagnostics.requestVideoFrameCallback),
      audioWorklet: Boolean(diagnostics.audioWorklet),
      crossOriginIsolated: Boolean(diagnostics.crossOriginIsolated),
      productMode: diagnostics.productMode,
      hardwareConcurrency: Math.max(0, Math.round(Number(diagnostics.hardwareConcurrency || 0))),
      deviceMemoryGb: Math.max(0, Number(diagnostics.deviceMemoryGb || 0)),
    },
    voice: {
      provider: boundedLabel(voice.provider, 'unknown'),
      health: boundedLabel(voice.health, 'unknown'),
    },
  };
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
