# Performance Benchmarks

This page records the repository's current benchmark results. These numbers are
indicative CPU measurements, not a promise of application-level throughput.

## Environment

- **OS**: Ubuntu 24.04 (Linux 6.14.0-29-generic)
- **CPU**: Intel Core i3-8130U @ 2.20GHz (2 cores, 4 threads)
- **RAM**: 8GB DDR4
- **Runtime**: Bun 1.4.0 and Node.js v24.14.0
- **Output**: In-process null/no-op sinks; no disk or network I/O

## Zario Hot-Path Suite

Run with `bun benchmarks/logger.bench.ts`. Each row uses six samples and reports
the median. The table below was run with the default iteration and warmup
settings from `benchmarks/logger.bench.ts`.

| Benchmark | Median ops/sec | Median ns/op |
|---|---:|---:|
| Simple message (sync) | 12,945,716 | 78 |
| Message with metadata (sync) | 12,210,208 | 82 |
| Message with deep metadata (sync) | 7,515,826 | 134 |
| Filtered debug log (level=error) | 164,273,841 | 6 |
| Filtered info log (level=error) | 204,739,764 | 5 |
| Simple JSON log (end-to-end) | 8,212,903 | 122 |
| JSON log with metadata (end-to-end) | 3,532,846 | 283 |
| Dynamic JSON message (end-to-end) | 2,703,703 | 371 |
| Simple message (async enqueue) | 3,637,374 | 276 |
| Message with metadata (async enqueue) | 4,321,454 | 231 |
| Format text (with metadata) | 4,631,418 | 217 |
| Format text (simple) | 15,930,759 | 63 |
| Format JSON (with metadata) | 3,324,086 | 301 |
| Format JSON (simple fast path) | 14,044,473 | 72 |
| Child logger simple message | 10,362,968 | 97 |
| Child logger with metadata | 10,281,366 | 97 |

Async rows measure enqueue/dispatch overhead. They do not measure the latency
or throughput of a real transport.

## Cross-Library Comparison

Run with `cd .benchmark && bun run bench:all`. The latest complete run used
`ZARIO_BENCH_DURATION_MS=500 ZARIO_BENCH_MIN_ITERATIONS=100000`, because the
default 2.5-second run exhausted the Node.js heap in this environment during
the third scenario. Each library uses the same in-process sink, and cases are
run in randomized order.

| Library | Simple ops/sec | Metadata ops/sec | Child ops/sec | Filtered ops/sec | Deep metadata ops/sec | Error ops/sec |
|---|---:|---:|---:|---:|---:|---:|
| Zario | 2,892,211 | 1,133,669 | **1,352,701** | **11,669,719** | 403,413 | 546,099 |
| Pino | 987,051 | 485,484 | 854,028 | 10,455,052 | 233,218 | 359,316 |
| Winston | 208,805 | 108,229 | 143,938 | 440,655 | 48,605 | 53,006 |
| Bunyan | 176,456 | 201,345 | 152,322 | 8,747,737 | 95,457 | 179,995 |
| Log4js | 815,356 | **1,286,107** | - | 2,868,417 | **739,115** | **750,633** |
| Loglevel | **19,004,827** | **10,994,588** | - | 10,207,611 | **10,202,277** | **10,068,812** |

For the 100,000-log burst, Zario completed in 26.29 ms (3,804,448 logs/sec),
behind Loglevel at 3.95 ms and ahead of Pino at 78.11 ms. These comparisons
measure framework and formatting overhead only; real transport I/O will change
the relative results.

## Reproducing Results

```bash
bun benchmarks/logger.bench.ts
cd .benchmark
bun install
ZARIO_BENCH_DURATION_MS=500 ZARIO_BENCH_MIN_ITERATIONS=100000 bun run bench:all
```

Results vary with CPU, runtime version, garbage collection, and background load.

---

[← Roadmap](./roadmap.md) | [Introduction →](./introduction.md)
