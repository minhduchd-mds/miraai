import type { MiraBrowserCapabilities } from '../../runtime/browser-capabilities';

export type AcceleratorProvider = 'webgpu' | 'webnn-npu' | 'webnn-gpu' | 'wasm';

export interface AcceleratorBenchmarkSample {
  provider: AcceleratorProvider;
  loadMs: number;
  preprocessMs: number;
  inferenceMs: number;
  endToEndMs: number;
  ok: boolean;
  error?: string;
}

export interface AcceleratorBenchmarkSummary {
  provider: AcceleratorProvider;
  supported: boolean;
  successes: number;
  failures: number;
  p50InferenceMs: number;
  p95InferenceMs: number;
  p50EndToEndMs: number;
  p95EndToEndMs: number;
}

function percentile(values: number[], percentileValue: number): number {
  if (!values.length) return Number.POSITIVE_INFINITY;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil(sorted.length * percentileValue) - 1),
  );
  return sorted[index];
}

export function acceleratorCandidates(
  capabilities: Pick<MiraBrowserCapabilities, 'webgpu' | 'webnn'>,
): AcceleratorProvider[] {
  const providers: AcceleratorProvider[] = [];
  if (capabilities.webgpu) providers.push('webgpu');
  if (capabilities.webnn) providers.push('webnn-npu', 'webnn-gpu');
  providers.push('wasm');
  return providers;
}

export function summarizeAcceleratorBenchmark(
  provider: AcceleratorProvider,
  samples: AcceleratorBenchmarkSample[],
  supported = true,
): AcceleratorBenchmarkSummary {
  const success = samples.filter((sample) => sample.ok);
  const failures = samples.length - success.length;
  return {
    provider,
    supported,
    successes: success.length,
    failures,
    p50InferenceMs: percentile(success.map((sample) => sample.inferenceMs), 0.5),
    p95InferenceMs: percentile(success.map((sample) => sample.inferenceMs), 0.95),
    p50EndToEndMs: percentile(success.map((sample) => sample.endToEndMs), 0.5),
    p95EndToEndMs: percentile(success.map((sample) => sample.endToEndMs), 0.95),
  };
}

export function chooseMeasuredAccelerator(
  summaries: AcceleratorBenchmarkSummary[],
): AcceleratorProvider | null {
  const healthy = summaries
    .filter((item) =>
      item.supported &&
      item.successes >= 2 &&
      item.failures <= 1 &&
      Number.isFinite(item.p95InferenceMs) &&
      Number.isFinite(item.p95EndToEndMs)
    )
    .sort((a, b) =>
      a.p95EndToEndMs - b.p95EndToEndMs ||
      a.p50EndToEndMs - b.p50EndToEndMs ||
      a.p95InferenceMs - b.p95InferenceMs
    );

  return healthy[0]?.provider || null;
}
