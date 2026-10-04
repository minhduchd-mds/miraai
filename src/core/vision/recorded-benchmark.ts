export interface BenchmarkConfusion {
  tp: number;
  fp: number;
  fn: number;
  precision: number;
  recall: number;
  f1: number;
}

export interface BenchmarkLatencySummary {
  count: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  maxMs: number;
}

export function summarizeConfusion(tp: number, fp: number, fn: number): BenchmarkConfusion {
  const precision = tp + fp ? tp / (tp + fp) : 1;
  const recall = tp + fn ? tp / (tp + fn) : 1;
  const f1 = precision + recall ? (2 * precision * recall) / (precision + recall) : 0;
  return { tp, fp, fn, precision, recall, f1 };
}

function percentile(values: number[], p: number): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[index];
}

export function summarizeLatency(values: number[]): BenchmarkLatencySummary {
  const clean = values.filter((value) => Number.isFinite(value) && value >= 0);
  return {
    count: clean.length,
    p50Ms: percentile(clean, 50),
    p95Ms: percentile(clean, 95),
    p99Ms: percentile(clean, 99),
    maxMs: clean.length ? Math.max(...clean) : 0,
  };
}

export function compareEventSets(expected: string[], predicted: string[]): BenchmarkConfusion {
  const expectedCounts = new Map<string, number>();
  const predictedCounts = new Map<string, number>();
  for (const item of expected) expectedCounts.set(item, (expectedCounts.get(item) || 0) + 1);
  for (const item of predicted) predictedCounts.set(item, (predictedCounts.get(item) || 0) + 1);

  let tp = 0;
  let fp = 0;
  let fn = 0;
  const labels = new Set([...expectedCounts.keys(), ...predictedCounts.keys()]);
  for (const label of labels) {
    const expectedCount = expectedCounts.get(label) || 0;
    const predictedCount = predictedCounts.get(label) || 0;
    tp += Math.min(expectedCount, predictedCount);
    fp += Math.max(0, predictedCount - expectedCount);
    fn += Math.max(0, expectedCount - predictedCount);
  }
  return summarizeConfusion(tp, fp, fn);
}
