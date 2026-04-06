export interface BenchCase {
  name: string;
  fn: () => void;
}

export interface TimedResult {
  iterations: number;
  totalMs: number;
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
