import { BenchCase, formatInt, mean, median, percentile, resolveWarmupMs, runForDuration, seededShuffle, shuffleCases } from '../../benchmarks/benchmarkUtils';

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

  it('shuffles without losing entries', () => {    const cases: BenchCase[] = [
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

  it('computes median, mean and percentile', () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 3, 2])).toBe(2.5);
    expect(mean([1, 2, 3])).toBe(2);
    expect(percentile([1, 2, 3, 4], 0.95)).toBe(4);
    expect(percentile([1, 2, 3, 4], 0.5)).toBe(2);
  });

  it('replays the same seeded shuffle deterministically', () => {
    const items = ['a', 'b', 'c', 'd', 'e'];
    expect(seededShuffle(items, 42)).toEqual(seededShuffle(items, 42));
    expect([...seededShuffle(items, 42)].sort()).toEqual([...items].sort());
    expect(formatInt(1234567.4)).toBe(Math.round(1234567.4).toLocaleString());
  });
});
