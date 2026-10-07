import type { MiraDeviceReport } from './device-diagnostics';

export type DeviceLabStatus = 'pass' | 'warn' | 'fail' | 'not-applicable';

export interface DeviceLabObservation {
  cameraStarted?: boolean;
  cameraStartMs?: number;
  faceDetected?: boolean;
  handDetected?: boolean;
  gestureStable?: boolean;
  voicePlayback?: boolean;
  voiceFirstAudioMs?: number;
  interruptionWorked?: boolean;
  desktopLaunch?: boolean;
  xrSessionStarted?: boolean;
  xrAnchorStable?: boolean;
}

export interface MiraDeviceLabResult {
  format: 'mira.device-lab-result';
  schemaVersion: 1;
  createdAt: string;
  label: string;
  releaseSha?: string;
  source: MiraDeviceReport;
  observation: DeviceLabObservation;
  privacy: {
    mediaCaptured: false;
    rawInputIncluded: false;
    identifiersIncluded: false;
    locationIncluded: false;
  };
}

export interface DeviceLabAssessment {
  label: string;
  overall: DeviceLabStatus;
  checks: Record<string, DeviceLabStatus>;
  blockers: string[];
  warnings: string[];
}

function permissionState(value: unknown): MiraDeviceReport['device']['cameraPermission'] {
  return value === 'granted' ||
    value === 'denied' ||
    value === 'prompt' ||
    value === 'unsupported' ||
    value === 'unknown'
    ? value
    : 'unknown';
}

function productMode(value: unknown): MiraDeviceReport['device']['productMode'] {
  return value === 'full' || value === 'balanced' || value === 'compatibility'
    ? value
    : 'compatibility';
}

function sanitizeDeviceReport(source: MiraDeviceReport): MiraDeviceReport {
  return {
    format: 'mira.device-report',
    schemaVersion: 1,
    createdAt: String(source?.createdAt || '').slice(0, 40),
    privacy: {
      mediaCaptured: false,
      rawInputIncluded: false,
      identifiersIncluded: false,
      locationIncluded: false,
    },
    device: {
      checkedAt: String(source?.device?.checkedAt || '').slice(0, 40),
      secureContext: Boolean(source?.device?.secureContext),
      mediaDevices: Boolean(source?.device?.mediaDevices),
      cameraPermission: permissionState(source?.device?.cameraPermission),
      microphonePermission: permissionState(source?.device?.microphonePermission),
      webxr: Boolean(source?.device?.webxr),
      immersiveAr: source?.device?.immersiveAr == null
        ? null
        : Boolean(source.device.immersiveAr),
      webgpu: Boolean(source?.device?.webgpu),
      webnn: Boolean(source?.device?.webnn),
      requestVideoFrameCallback: Boolean(source?.device?.requestVideoFrameCallback),
      audioWorklet: Boolean(source?.device?.audioWorklet),
      crossOriginIsolated: Boolean(source?.device?.crossOriginIsolated),
      productMode: productMode(source?.device?.productMode),
      hardwareConcurrency: Math.min(
        256,
        Math.max(0, Math.round(Number(source?.device?.hardwareConcurrency || 0))),
      ),
      deviceMemoryGb: Math.min(
        1024,
        Math.max(0, Number(source?.device?.deviceMemoryGb || 0)),
      ),
    },
    voice: {
      provider: String(source?.voice?.provider || 'unknown').trim().slice(0, 80),
      health: String(source?.voice?.health || 'unknown').trim().slice(0, 80),
    },
  };
}

function boundedLabel(value: unknown): string {
  const text = String(value || '').trim().slice(0, 80);
  return text || 'Unnamed device';
}

function finiteMs(value: unknown): number | undefined {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) return undefined;
  return Math.round(numeric);
}

function boolOrUndefined(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

export function buildDeviceLabResult(
  label: string,
  source: MiraDeviceReport,
  observation: DeviceLabObservation = {},
): MiraDeviceLabResult {
  return {
    format: 'mira.device-lab-result',
    schemaVersion: 1,
    createdAt: new Date().toISOString(),
    label: boundedLabel(label),
    source: sanitizeDeviceReport(source),
    observation: {
      cameraStarted: boolOrUndefined(observation.cameraStarted),
      cameraStartMs: finiteMs(observation.cameraStartMs),
      faceDetected: boolOrUndefined(observation.faceDetected),
      handDetected: boolOrUndefined(observation.handDetected),
      gestureStable: boolOrUndefined(observation.gestureStable),
      voicePlayback: boolOrUndefined(observation.voicePlayback),
      voiceFirstAudioMs: finiteMs(observation.voiceFirstAudioMs),
      interruptionWorked: boolOrUndefined(observation.interruptionWorked),
      desktopLaunch: boolOrUndefined(observation.desktopLaunch),
      xrSessionStarted: boolOrUndefined(observation.xrSessionStarted),
      xrAnchorStable: boolOrUndefined(observation.xrAnchorStable),
    },
    privacy: {
      mediaCaptured: false,
      rawInputIncluded: false,
      identifiersIncluded: false,
      locationIncluded: false,
    },
  };
}

function statusForBoolean(
  value: boolean | undefined,
  applicable = true,
): DeviceLabStatus {
  if (!applicable) return 'not-applicable';
  if (value === true) return 'pass';
  if (value === false) return 'fail';
  return 'warn';
}

export function assessDeviceLabResult(
  result: MiraDeviceLabResult,
): DeviceLabAssessment {
  const { source, observation } = result;
  const cameraApplicable = source.device.mediaDevices && source.device.cameraPermission !== 'denied';
  const voiceApplicable = source.voice.health !== 'unhealthy';
  const xrApplicable = source.device.immersiveAr === true;

  const checks: Record<string, DeviceLabStatus> = {
    secureContext: source.device.secureContext ? 'pass' : 'fail',
    mediaDevices: source.device.mediaDevices ? 'pass' : 'fail',
    cameraPermission: source.device.cameraPermission === 'denied' ? 'fail' : 'pass',
    microphonePermission: source.device.microphonePermission === 'denied' ? 'fail' : 'pass',
    cameraStarted: statusForBoolean(observation.cameraStarted, cameraApplicable),
    faceDetected: statusForBoolean(observation.faceDetected, cameraApplicable),
    handDetected: statusForBoolean(observation.handDetected, cameraApplicable),
    gestureStable: statusForBoolean(observation.gestureStable, cameraApplicable),
    voicePlayback: statusForBoolean(observation.voicePlayback, voiceApplicable),
    interruptionWorked: statusForBoolean(observation.interruptionWorked, voiceApplicable),
    desktopLaunch: statusForBoolean(observation.desktopLaunch),
    xrSessionStarted: statusForBoolean(observation.xrSessionStarted, xrApplicable),
    xrAnchorStable: statusForBoolean(observation.xrAnchorStable, xrApplicable),
  };

  if (observation.cameraStartMs != null) {
    checks.cameraStartLatency = observation.cameraStartMs <= 2500
      ? 'pass'
      : observation.cameraStartMs <= 4500
        ? 'warn'
        : 'fail';
  }

  if (observation.voiceFirstAudioMs != null) {
    checks.voiceFirstAudioLatency = observation.voiceFirstAudioMs <= 1800
      ? 'pass'
      : observation.voiceFirstAudioMs <= 3000
        ? 'warn'
        : 'fail';
  }

  const blockers: string[] = [];
  const warnings: string[] = [];

  for (const [name, status] of Object.entries(checks)) {
    if (status === 'fail') blockers.push(name);
    else if (status === 'warn') warnings.push(name);
  }

  const overall: DeviceLabStatus = blockers.length
    ? 'fail'
    : warnings.length
      ? 'warn'
      : 'pass';

  return {
    label: result.label,
    overall,
    checks,
    blockers,
    warnings,
  };
}

function hasForbiddenKey(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  const forbidden = new Set([
    'useragent',
    'deviceid',
    'rawframe',
    'rawaudio',
    'transcript',
    'preciselocation',
    'latitude',
    'longitude',
    'lasterror',
    'apikey',
    'cookie',
  ]);

  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (forbidden.has(key.toLowerCase())) return true;
    if (hasForbiddenKey(child)) return true;
  }
  return false;
}

export function isPrivateDeviceLabResult(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  const result = value as Partial<MiraDeviceLabResult>;
  if (result.format !== 'mira.device-lab-result' || result.schemaVersion !== 1) return false;
  if (result.source?.format !== 'mira.device-report' || result.source?.schemaVersion !== 1) return false;

  const privacy = result.privacy;
  const sourcePrivacy = result.source?.privacy;
  if (
    privacy?.mediaCaptured !== false ||
    privacy?.rawInputIncluded !== false ||
    privacy?.identifiersIncluded !== false ||
    privacy?.locationIncluded !== false ||
    sourcePrivacy?.mediaCaptured !== false ||
    sourcePrivacy?.rawInputIncluded !== false ||
    sourcePrivacy?.identifiersIncluded !== false ||
    sourcePrivacy?.locationIncluded !== false
  ) {
    return false;
  }

  return !hasForbiddenKey(value);
}
