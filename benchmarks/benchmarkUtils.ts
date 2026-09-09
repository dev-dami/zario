export interface BenchCase {
  name: string;
  fn: () => void;
}

export interface TimedResult {
  iterations: number;
  totalMs: number;
}

export interface SampleMetrics {
  totalMs: number;
  perOpNs: number;
  opsPerSec: number;
}

export interface BenchmarkSummary {
  name: string;
  iterations: number;
  warmupIterations: number;
  medianOpsPerSec: number;
  meanOpsPerSec: number;
  p95OpsPerSec: number;
  medianPerOpNs: number;
  medianTotalMs: number;
}

export function resolveWarmupMs(durationMs: number): number {
  return Math.max(500, Math.floor(durationMs * 0.2));
}

export function runForDuration(
  fn: () => void,
  durationMs: number,
  now: () => number = () => performance.now()
): TimedResult {
  const start = now();
  let elapsedMs = 0;
  let iterations = 0;

  do {
    fn();
    iterations++;
    elapsedMs = now() - start;
  } while (elapsedMs < durationMs);

  return { iterations, totalMs: elapsedMs };
}

export function shuffleCases(cases: BenchCase[], random: () => number = Math.random): BenchCase[] {
  const shuffled = [...cases];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    const tmp = shuffled[i];
    shuffled[i] = shuffled[j];
    shuffled[j] = tmp;
  }
  return shuffled;
}

// Deterministic Fisher-Yates shuffle; same seed replays the same order.
export function seededShuffle<T>(items: T[], seed: number): T[] {
  const copy = [...items];
  let state = seed >>> 0;
  for (let i = copy.length - 1; i > 0; i--) {
    state = (state * 1_664_525 + 1_013_904_223) >>> 0;
    const j = state % (i + 1);
    const tmp = copy[i]!;
    copy[i] = copy[j]!;
    copy[j] = tmp;
  }
  return copy;
}

export function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1]! + sorted[mid]!) / 2;
  }
  return sorted[mid]!;
}

export function mean(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function percentile(values: number[], p: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil(p * sorted.length) - 1));
  return sorted[idx]!;
}

export function formatInt(value: number): string {
  return Math.round(value).toLocaleString();
}

export function maybeGC(): void {
  const gcFn = (globalThis as { gc?: () => void }).gc;
  if (typeof gcFn === "function") {
    gcFn();
  }
}
