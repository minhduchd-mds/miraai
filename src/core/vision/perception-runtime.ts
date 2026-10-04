export type PerceptionProviderId =
  | 'mediapipe-gpu'
  | 'mediapipe-cpu'
  | 'webgpu'
  | 'webnn-npu'
  | 'webnn-gpu'
  | 'wasm';

export type PerceptionTask = 'holistic' | 'segmentation' | 'embedding' | 'object-detection';
export type ProviderMaturity = 'production' | 'experimental' | 'fallback';

export interface PerceptionCapabilities {
  webgpu: boolean;
  webnn: boolean;
  webnnNpu: boolean;
  webnnGpu: boolean;
  wasm: boolean;
  worker: boolean;
  crossOriginIsolated: boolean;
}

export interface PerceptionProviderCandidate {
  id: PerceptionProviderId;
  available: boolean;
  maturity: ProviderMaturity;
  device: 'gpu' | 'npu' | 'cpu';
  zeroCopyPotential: boolean;
  reason: string;
}

export interface PerceptionRuntimePlan {
  task: PerceptionTask;
  allowExperimental: boolean;
  candidates: PerceptionProviderCandidate[];
  selected: PerceptionProviderId | null;
  generatedAt: number;
}

export interface ProviderHealth {
  failures: number;
  successes: number;
  cooldownUntil: number;
  lastError: string;
}

const EMPTY_HEALTH: ProviderHealth = {
  failures: 0,
  successes: 0,
  cooldownUntil: 0,
  lastError: '',
};

function globalNavigator(): any {
  return typeof navigator === 'undefined' ? null : navigator;
}

export function detectPerceptionCapabilities(nav: any = globalNavigator()): PerceptionCapabilities {
  const hasWebGpu = Boolean(nav?.gpu);
  const hasWebNn = Boolean(nav?.ml);
  const ua = String(nav?.userAgent || '');
  const mobile = /Android|iPhone|iPad|iPod|Mobile/i.test(ua);

  return {
    webgpu: hasWebGpu,
    webnn: hasWebNn,
    webnnNpu: hasWebNn && !mobile,
    webnnGpu: hasWebNn,
    wasm: typeof WebAssembly !== 'undefined',
    worker: typeof Worker !== 'undefined',
    crossOriginIsolated: Boolean((globalThis as any).crossOriginIsolated),
  };
}

function candidate(
  id: PerceptionProviderId,
  available: boolean,
  maturity: ProviderMaturity,
  device: PerceptionProviderCandidate['device'],
  zeroCopyPotential: boolean,
  reason: string,
): PerceptionProviderCandidate {
  return { id, available, maturity, device, zeroCopyPotential, reason };
}

export function buildPerceptionRuntimePlan(
  capabilities: PerceptionCapabilities,
  options: { task?: PerceptionTask; allowExperimental?: boolean } = {},
): PerceptionRuntimePlan {
  const task = options.task || 'holistic';
  const allowExperimental = Boolean(options.allowExperimental);

  const production = [
    candidate(
      'mediapipe-gpu',
      true,
      'production',
      'gpu',
      false,
      'Current Mira production path; preserves the proven MediaPipe Holistic delegate.',
    ),
    candidate(
      'mediapipe-cpu',
      true,
      'fallback',
      'cpu',
      false,
      'Stable fallback when the MediaPipe GPU delegate is unavailable or fails at runtime.',
    ),
  ];

  const experimental = [
    candidate(
      'webnn-npu',
      capabilities.webnn && capabilities.webnnNpu,
      'experimental',
      'npu',
      true,
      'Future on-device neural path; intended for models validated for WebNN/NPU execution.',
    ),
    candidate(
      'webgpu',
      capabilities.webgpu,
      'experimental',
      'gpu',
      true,
      'Future ORT/WebGPU path with GPU-resident tensors and graph-capture potential.',
    ),
    candidate(
      'webnn-gpu',
      capabilities.webnn && capabilities.webnnGpu,
      'experimental',
      'gpu',
      true,
      'Future WebNN GPU path for compatible auxiliary perception models.',
    ),
    candidate(
      'wasm',
      capabilities.wasm,
      'fallback',
      'cpu',
      false,
      'Portable CPU fallback for auxiliary ONNX models when accelerated providers are unavailable.',
    ),
  ];

  const candidates = task === 'holistic'
    ? [...production, ...(allowExperimental ? experimental : [])]
    : [...(allowExperimental ? experimental : []), ...production];

  const selected = candidates.find((item) => item.available && (allowExperimental || item.maturity !== 'experimental'))?.id || null;

  return {
    task,
    allowExperimental,
    candidates,
    selected,
    generatedAt: Date.now(),
  };
}

export function currentPerceptionRuntimePlan(
  task: PerceptionTask = 'holistic',
  allowExperimental = false,
): PerceptionRuntimePlan {
  return buildPerceptionRuntimePlan(detectPerceptionCapabilities(), { task, allowExperimental });
}

export class PerceptionProviderHealthRegistry {
  private health = new Map<PerceptionProviderId, ProviderHealth>();

  snapshot(id: PerceptionProviderId): ProviderHealth {
    return { ...(this.health.get(id) || EMPTY_HEALTH) };
  }

  noteSuccess(id: PerceptionProviderId): ProviderHealth {
    const current = this.snapshot(id);
    const next = {
      failures: 0,
      successes: current.successes + 1,
      cooldownUntil: 0,
      lastError: '',
    };
    this.health.set(id, next);
    return { ...next };
  }

  noteFailure(
    id: PerceptionProviderId,
    error: unknown,
    now = Date.now(),
    failureThreshold = 2,
    cooldownMs = 30_000,
  ): ProviderHealth {
    const current = this.snapshot(id);
    const failures = current.failures + 1;
    const next = {
      failures,
      successes: current.successes,
      cooldownUntil: failures >= failureThreshold ? now + cooldownMs : 0,
      lastError: error instanceof Error ? error.message : String(error || 'provider_failure'),
    };
    this.health.set(id, next);
    return { ...next };
  }

  choose(plan: PerceptionRuntimePlan, now = Date.now()): PerceptionProviderCandidate | null {
    for (const item of plan.candidates) {
      if (!item.available) continue;
      if (!plan.allowExperimental && item.maturity === 'experimental') continue;
      const health = this.snapshot(item.id);
      if (health.cooldownUntil > now) continue;
      return item;
    }
    return null;
  }

  reset(): void {
    this.health.clear();
  }
}
