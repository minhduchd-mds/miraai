import { browserCapabilitySummary } from '../../runtime/browser-capabilities';
import {
  acceleratorCandidates,
  chooseMeasuredAccelerator,
  summarizeAcceleratorBenchmark,
  type AcceleratorBenchmarkSample,
  type AcceleratorBenchmarkSummary,
  type AcceleratorProvider,
} from './accelerator-selection';

const ORT_VERSION = '1.30.0';
const ORT_DIST_BASE = `https://cdn.jsdelivr.net/npm/onnxruntime-web@${ORT_VERSION}/dist/`;
const ORT_MODULE_URL = ORT_DIST_BASE + 'ort.all.min.mjs';
const MODEL_URL =
  'https://raw.githubusercontent.com/onnx/models/b1eeaa1ac722dcc1cd1a8284bde34393dab61c3d/validated/vision/classification/squeezenet/model/squeezenet1.1-7.onnx';
const LABELS_URL =
  'https://raw.githubusercontent.com/microsoft/Windows-Machine-Learning/02b586811c8beb1ae2208c8605393267051257ae/Samples/SqueezeNetObjectDetection/Desktop/cpp/Labels.txt';

const INPUT_SIZE = 224;
const MEAN = [0.485, 0.456, 0.406];
const STD = [0.229, 0.224, 0.225];

export interface AcceleratorPrediction {
  provider: AcceleratorProvider;
  classIndex: number;
  label: string;
  confidence: number;
  logit: number;
  preprocessMs: number;
  inferenceMs: number;
  endToEndMs: number;
}

export interface AcceleratorComparison {
  schema: 'mira.accelerator-benchmark.v1';
  model: 'squeezenet1.1-7';
  runtimeVersion: string;
  summaries: AcceleratorBenchmarkSummary[];
  selected: AcceleratorProvider | null;
  measuredAt: number;
}

type OrtModule = {
  env: any;
  Tensor: new (type: string, data: Float32Array, dims: number[]) => any;
  InferenceSession: {
    create: (model: string, options: any) => Promise<any>;
  };
};

function executionProvider(provider: AcceleratorProvider): any {
  if (provider === 'webnn-npu') {
    return { name: 'webnn', deviceType: 'npu', powerPreference: 'low-power' };
  }
  if (provider === 'webnn-gpu') {
    return { name: 'webnn', deviceType: 'gpu', powerPreference: 'high-performance' };
  }
  return provider;
}

async function loadOrt(): Promise<OrtModule> {
  const ort = await import(/* @vite-ignore */ ORT_MODULE_URL) as unknown as OrtModule;
  if (ort?.env?.wasm) {
    ort.env.wasm.wasmPaths = ORT_DIST_BASE;
    const cores = typeof navigator === 'undefined' ? 1 : Math.max(1, Number(navigator.hardwareConcurrency || 1));
    ort.env.wasm.numThreads = Boolean((globalThis as any).crossOriginIsolated)
      ? Math.max(1, Math.min(4, Math.floor(cores / 2)))
      : 1;
  }
  return ort;
}

function softmaxTop1(values: ArrayLike<number>): { index: number; confidence: number; logit: number } {
  if (!values.length) return { index: -1, confidence: 0, logit: 0 };
  let topIndex = 0;
  let topLogit = Number(values[0] || 0);
  for (let i = 1; i < values.length; i += 1) {
    const value = Number(values[i] || 0);
    if (value > topLogit) {
      topLogit = value;
      topIndex = i;
    }
  }
  let denominator = 0;
  for (let i = 0; i < values.length; i += 1) {
    denominator += Math.exp(Math.max(-80, Math.min(80, Number(values[i] || 0) - topLogit)));
  }
  return {
    index: topIndex,
    confidence: denominator > 0 ? 1 / denominator : 0,
    logit: topLogit,
  };
}

function parseLabels(text: string): string[] {
  const labels: string[] = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const comma = line.indexOf(',');
    if (comma > 0 && /^\d+$/.test(line.slice(0, comma).trim())) {
      labels[Number(line.slice(0, comma).trim())] = line.slice(comma + 1).trim();
    } else {
      labels.push(line.trim());
    }
  }
  return labels;
}

async function imageTensor(
  ort: OrtModule,
  source: CanvasImageSource,
): Promise<{ tensor: any; preprocessMs: number }> {
  const started = performance.now();
  const pixelCount = INPUT_SIZE * INPUT_SIZE;
  let imageData: ImageData;

  if (typeof OffscreenCanvas !== 'undefined') {
    const canvas = new OffscreenCanvas(INPUT_SIZE, INPUT_SIZE);
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('OffscreenCanvas 2D context unavailable.');
    ctx.drawImage(source, 0, 0, INPUT_SIZE, INPUT_SIZE);
    imageData = ctx.getImageData(0, 0, INPUT_SIZE, INPUT_SIZE);
  } else {
    const canvas = document.createElement('canvas');
    canvas.width = INPUT_SIZE;
    canvas.height = INPUT_SIZE;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('Canvas 2D context unavailable.');
    ctx.drawImage(source, 0, 0, INPUT_SIZE, INPUT_SIZE);
    imageData = ctx.getImageData(0, 0, INPUT_SIZE, INPUT_SIZE);
  }

  const tensorData = new Float32Array(pixelCount * 3);
  for (let i = 0; i < pixelCount; i += 1) {
    const rgba = i * 4;
    tensorData[i] = (imageData.data[rgba] / 255 - MEAN[0]) / STD[0];
    tensorData[pixelCount + i] = (imageData.data[rgba + 1] / 255 - MEAN[1]) / STD[1];
    tensorData[pixelCount * 2 + i] = (imageData.data[rgba + 2] / 255 - MEAN[2]) / STD[2];
  }

  return {
    tensor: new ort.Tensor('float32', tensorData, [1, 3, INPUT_SIZE, INPUT_SIZE]),
    preprocessMs: performance.now() - started,
  };
}

async function loadLabels(): Promise<string[]> {
  try {
    const response = await fetch(LABELS_URL, { cache: 'force-cache' });
    if (!response.ok) return [];
    return parseLabels(await response.text());
  } catch {
    return [];
  }
}

export function acceleratorLabEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  const params = new URLSearchParams(window.location.search);
  return params.get('accelerator') === '1';
}

export function acceleratorComparisonEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  const params = new URLSearchParams(window.location.search);
  return params.get('accelerator-benchmark') === '1';
}

export class OnnxAcceleratorLab {
  private ort: OrtModule | null = null;
  private labels: string[] | null = null;
  private session: any = null;
  private provider: AcceleratorProvider | null = null;
  private loadMs = 0;

  supportedProviders(): AcceleratorProvider[] {
    const summary = browserCapabilitySummary();
    return acceleratorCandidates(summary.capabilities);
  }

  async open(provider: AcceleratorProvider): Promise<number> {
    if (this.provider === provider && this.session) return this.loadMs;
    this.close();

    const loadStarted = performance.now();
    this.ort ||= await loadOrt();
    this.labels ||= await loadLabels();
    this.session = await this.ort.InferenceSession.create(MODEL_URL, {
      executionProviders: [executionProvider(provider)],
      graphOptimizationLevel: 'all',
      enableGraphCapture: provider === 'webgpu',
    });
    this.provider = provider;
    this.loadMs = performance.now() - loadStarted;
    return this.loadMs;
  }

  async predict(source: CanvasImageSource, provider = this.provider): Promise<AcceleratorPrediction> {
    if (!provider) throw new Error('Accelerator provider is not initialized.');
    if (!this.session || this.provider !== provider) await this.open(provider);
    if (!this.ort || !this.session) throw new Error('ONNX Runtime Web session unavailable.');

    const totalStarted = performance.now();
    const prepared = await imageTensor(this.ort, source);
    const inputName = this.session.inputNames?.[0];
    if (!inputName) throw new Error('SqueezeNet input name unavailable.');

    const inferenceStarted = performance.now();
    const outputs = await this.session.run({ [inputName]: prepared.tensor });
    const inferenceMs = performance.now() - inferenceStarted;
    const outputName = this.session.outputNames?.[0] || Object.keys(outputs)[0];
    const output = outputs[outputName];
    const top = softmaxTop1(output?.data || []);

    return {
      provider,
      classIndex: top.index,
      label: this.labels?.[top.index] || `imagenet-${top.index}`,
      confidence: top.confidence,
      logit: top.logit,
      preprocessMs: prepared.preprocessMs,
      inferenceMs,
      endToEndMs: performance.now() - totalStarted,
    };
  }

  async openBest(): Promise<AcceleratorProvider> {
    const providers = this.supportedProviders();
    let lastError: unknown = null;
    for (const provider of providers) {
      try {
        await this.open(provider);
        return provider;
      } catch (error) {
        lastError = error;
        this.close();
      }
    }
    throw lastError instanceof Error ? lastError : new Error('No ONNX Runtime Web provider could initialize.');
  }

  async compare(
    source: CanvasImageSource,
    iterations = 3,
  ): Promise<AcceleratorComparison> {
    const summaries: AcceleratorBenchmarkSummary[] = [];

    for (const provider of this.supportedProviders()) {
      const samples: AcceleratorBenchmarkSample[] = [];
      let supported = true;
      try {
        const loadMs = await this.open(provider);
        await this.predict(source, provider);
        for (let i = 0; i < Math.max(2, iterations); i += 1) {
          try {
            const prediction = await this.predict(source, provider);
            samples.push({
              provider,
              loadMs,
              preprocessMs: prediction.preprocessMs,
              inferenceMs: prediction.inferenceMs,
              endToEndMs: prediction.endToEndMs,
              ok: true,
            });
          } catch (error) {
            samples.push({
              provider,
              loadMs,
              preprocessMs: 0,
              inferenceMs: 0,
              endToEndMs: 0,
              ok: false,
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }
      } catch (error) {
        supported = false;
        samples.push({
          provider,
          loadMs: 0,
          preprocessMs: 0,
          inferenceMs: 0,
          endToEndMs: 0,
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        });
      } finally {
        this.close();
      }
      summaries.push(summarizeAcceleratorBenchmark(provider, samples, supported));
    }

    const selected = chooseMeasuredAccelerator(summaries);
    if (selected) await this.open(selected);

    return {
      schema: 'mira.accelerator-benchmark.v1',
      model: 'squeezenet1.1-7',
      runtimeVersion: ORT_VERSION,
      summaries,
      selected,
      measuredAt: Date.now(),
    };
  }

  snapshot() {
    return {
      provider: this.provider,
      loadMs: this.loadMs,
      runtimeVersion: ORT_VERSION,
      model: 'squeezenet1.1-7' as const,
    };
  }

  close(): void {
    try { this.session?.release?.(); } catch { /* noop */ }
    this.session = null;
    this.provider = null;
    this.loadMs = 0;
  }
}
