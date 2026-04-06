# Performance Benchmarks

This document provides a detailed performance comparison between Zario and other popular Node.js logging libraries.

## Overview

Zario is designed from the ground up for high-performance applications. By using optimized serialization, non-blocking asynchronous logging, and efficient metadata merging, Zario consistently outperforms established libraries in common logging scenarios.

## Test Environment

The benchmarks were conducted on the following hardware and software stack:

- **OS**: Ubuntu 24.04 (Linux 6.14.0-29-generic)
- **CPU**: Intel Core i3-8130U @ 2.20GHz (2 cores, 4 threads)
- **RAM**: 8GB DDR4
- **Runtime**: Node.js v24.13.0
- **Output**: All outputs directed to `/dev/null` to measure pure CPU overhead.

## Methodology

To ensure accurate and fair results, the following methodology was used:
- **Time-based runs**: Each scenario runs for a fixed duration and enforces a high minimum iteration count to reduce timer noise.
- **Proportional warmup**: Warmup is duration-based (minimum 500ms, ~20% of run duration) before each measured case.
- **Randomized order**: Libraries are shuffled per scenario to reduce order-dependent JIT/GC bias.
- **Output parity**: Libraries use equivalent in-process null-style destinations to focus on logging overhead.
- **Error payload parity**: Error benchmarks use equivalent pre-normalized metadata fields across libraries.
- **Summary Stats**: Median/mean/p95 are used to reduce noise from one-off spikes.
- **Comparison**: Zario's performance is used as the baseline for all comparisons.

> Note: You can override benchmark duration and minimum iterations for local sanity runs via `ZARIO_BENCH_DURATION_MS` and `ZARIO_BENCH_MIN_ITERATIONS`.

## Results

### Simple Message
*Test: `logger.info("Hello world")`*

| Library | ops/sec | ns/op |
|---------|---------|-------|
| **Zario** | **2,348,910** | **426** |
| Bunyan | 247,597 | 4,039 |
| Pino | 220,167 | 4,542 |
| Log4js | 190,691 | 5,244 |
| Winston | 155,386 | 6,436 |

### With Metadata
*Test: `logger.info("msg", { user, action, ip })`*

| Library | ops/sec | ns/op |
|---------|---------|-------|
| **Zario** | **3,968,123** | **252** |
| Pino | 230,902 | 4,331 |
| Bunyan | 168,165 | 5,947 |
| Winston | 133,166 | 7,509 |
| Log4js | 137,313 | 7,283 |

### Child Logger
*Test: `child.info("Request handled")`*

| Library | ops/sec | ns/op |
|---------|---------|-------|
| **Zario** | **3,317,270** | **301** |
| Winston | 257,385 | 3,885 |
| Pino | 236,269 | 4,232 |
| Bunyan | 190,315 | 5,254 |

### Filtered Logs
*Test: `logger.debug` when level is set to `info` (log is skipped)*

| Library | ops/sec | ns/op |
|---------|---------|-------|
| **Zario** | **94,656,364** | **11** |
| Pino | 94,299,145 | 11 |
| Bunyan | 9,784,512 | 102 |
| Log4js | 2,986,302 | 335 |
| Winston | 627,424 | 1,594 |

### Deep Nested Metadata
*Test: Logging objects with multiple levels of nesting*

| Library | ops/sec | ns/op |
|---------|---------|-------|
| **Zario** | **3,433,850** | **291** |
| Winston | 143,122 | 6,987 |
| Pino | 93,766 | 10,665 |
| Bunyan | 106,448 | 9,394 |
| Log4js | 63,028 | 15,866 |

### Error Logging
*Test: `logger.error("msg", { error })`*

| Library | ops/sec | ns/op |
|---------|---------|-------|
| **Zario** | **2,968,153** | **337** |
| Bunyan | 245,550 | 4,072 |
| Winston | 189,005 | 5,291 |
| Pino | 127,733 | 7,829 |
| Log4js | 118,795 | 8,418 |

### High-Frequency Burst
*Test: Processing a burst of 100,000 logs*

| Library | Time (ms) | logs/sec |
|---------|-----------|----------|
| **Zario** | **13.79** | **7,252,995** |
| Winston | 224.95 | 444,534 |
| Bunyan | 337.71 | 296,112 |
| Pino | 371.47 | 269,200 |
| Log4js | 394.60 | 253,420 |

## Analysis and Insights

- **Zario leads in every scenario.** After recent hot-path optimizations, Zario now outperforms all compared libraries across all test categories — including the filtered-logs case, where it ties with pino at 11 ns/op.
- **Filtered logs:** Previously the weakest area (312 ns/op), now at 11 ns/op — matching pino's performance by using noop method stubs for disabled log levels.
- **Child loggers:** Zario remains strong for request-scoped tracing workloads.
- **Deep metadata:** Zario remains competitive on nested-object logging.
- **High-frequency burst:** Burst performance remains a key strength under the revised methodology.

## Caveats and Notes

- Performance may vary based on the number of active transports and the complexity of custom filters or enrichers.
- All tests were conducted with standard configurations and aligned output/serialization assumptions for comparability.
- This benchmark focuses on CPU overhead; actual disk or network I/O will be the limiting factor in many real-world deployments.

---

[← Roadmap](./roadmap.md) | [Introduction →](./introduction.md)
