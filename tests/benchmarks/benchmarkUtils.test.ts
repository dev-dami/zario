import { BenchCase, resolveWarmupMs, runForDuration, shuffleCases } from '../../benchmarks/benchmarkUtils';

describe('benchmarkUtils', () => {
  it('uses at least 500ms warmup and scales with duration', () => {
    expect(resolveWarmupMs(100)).toBe(500);
    expect(resolveWarmupMs(4000)).toBe(800);
  });

  it('runs until the target duration has elapsed', () => {
    const timestamps = [0, 1, 2, 3, 4, 5];
    const now = jest.fn(() => timestamps.shift() ?? 5);
    const fn = jest.fn();

    const result = runForDuration(fn, 5, now);

    expect(fn).toHaveBeenCalledTimes(5);
    expect(result.iterations).toBe(5);
    expect(result.totalMs).toBe(5);
  });

  it('shuffles without losing entries', () => {
    const cases: BenchCase[] = [
      { name: 'A', fn: () => {} },
      { name: 'B', fn: () => {} },
      { name: 'C', fn: () => {} },
      { name: 'D', fn: () => {} },
    ];
    const random = jest.fn()
      .mockReturnValueOnce(0.1)
      .mockReturnValueOnce(0.5)
      .mockReturnValueOnce(0.9);

    const shuffled = shuffleCases(cases, random);

    expect(shuffled).toHaveLength(cases.length);
    expect(new Set(shuffled.map((c) => c.name))).toEqual(new Set(cases.map((c) => c.name)));
    expect(shuffled.map((c) => c.name)).not.toEqual(cases.map((c) => c.name));
  });
});
