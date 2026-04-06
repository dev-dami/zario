# Zario Benchmark Results

Results from running `npm run bench:high` (500,000 iterations/sample, 8 samples, 20% warmup).

Environment: Node.js v24.14.1, `--expose-gc`

---

## Sync Logging

| Benchmark | Iter/sample | Warmup | Median ops/sec | Mean ops/sec | P95 ops/sec | Median ns/op | Median total (ms) |
|---|---:|---:|---:|---:|---:|---:|---:|
| Simple message (sync) | 500,000 | 100,000 | 11,552,893 | 11,509,206 | 11,626,194 | 87 | 43.28 |
| Message with metadata (sync) | 500,000 | 100,000 | 10,572,753 | 10,538,822 | 10,653,341 | 95 | 47.29 |
| Message with deep metadata (sync) | 500,000 | 100,000 | 6,687,858 | 6,655,676 | 6,698,615 | 150 | 74.76 |

## Filtered Logs (Early Exit)

| Benchmark | Iter/sample | Warmup | Median ops/sec | Mean ops/sec | P95 ops/sec | Median ns/op | Median total (ms) |
|---|---:|---:|---:|---:|---:|---:|---:|
| Filtered debug log (level=error) | 500,000 | 100,000 | 1,008,217,655 | 993,001,783 | 1,724,197,386 | 1 | 0.50 |
| Filtered info log (level=error) | 500,000 | 100,000 | 1,005,689,767 | 930,771,268 | 1,597,270,584 | 1 | 0.50 |

## JSON Formatting

| Benchmark | Iter/sample | Warmup | Median ops/sec | Mean ops/sec | P95 ops/sec | Median ns/op | Median total (ms) |
|---|---:|---:|---:|---:|---:|---:|---:|
| Simple JSON log | 500,000 | 100,000 | 11,568,692 | 11,557,255 | 11,661,240 | 86 | 43.22 |
| JSON log with metadata | 500,000 | 100,000 | 10,543,431 | 10,419,380 | 10,687,100 | 95 | 47.43 |

## Async Logging

| Benchmark | Iter/sample | Warmup | Median ops/sec | Mean ops/sec | P95 ops/sec | Median ns/op | Median total (ms) |
|---|---:|---:|---:|---:|---:|---:|---:|
| Simple message (async enqueue) | 500,000 | 100,000 | 5,079,084 | 5,067,134 | 5,096,529 | 197 | 98.44 |
| Message with metadata (async enqueue) | 500,000 | 100,000 | 4,987,750 | 4,915,549 | 5,008,323 | 200 | 100.25 |

## Formatter Direct

| Benchmark | Iter/sample | Warmup | Median ops/sec | Mean ops/sec | P95 ops/sec | Median ns/op | Median total (ms) |
|---|---:|---:|---:|---:|---:|---:|---:|
| Format text (with metadata) | 500,000 | 100,000 | 2,181,644 | 2,179,942 | 2,189,498 | 458 | 229.19 |
| Format text (simple) | 500,000 | 100,000 | 3,790,382 | 3,784,413 | 3,806,556 | 264 | 131.91 |
| Format JSON (with metadata) | 500,000 | 100,000 | 931,265 | 929,513 | 939,866 | 1,074 | 536.90 |
| Format JSON (simple fast path) | 500,000 | 100,000 | 1,390,686 | 1,388,912 | 1,406,143 | 719 | 359.54 |

## Child Logger

| Benchmark | Iter/sample | Warmup | Median ops/sec | Mean ops/sec | P95 ops/sec | Median ns/op | Median total (ms) |
|---|---:|---:|---:|---:|---:|---:|---:|
| Child logger simple message | 500,000 | 100,000 | 10,453,676 | 10,445,592 | 10,480,180 | 96 | 47.83 |
| Child logger with metadata | 500,000 | 100,000 | 10,117,448 | 10,084,576 | 10,169,217 | 99 | 49.42 |

---

## Running the Benchmarks

```sh
# Standard benchmark (50k–200k iterations/sample)
npm run bench

# High-iteration benchmark (500k iterations/sample, 8 samples)
npm run bench:high

# Custom iterations/samples via environment variables
ZARIO_BENCH_ITERATIONS=1000000 ZARIO_BENCH_SAMPLES=10 npm run bench
```
