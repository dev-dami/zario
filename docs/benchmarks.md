# Performance Benchmarks

This document provides a detailed performance comparison between Zario and other popular Node.js logging libraries.

## Overview

Zario is designed from the ground up for high-performance applications. By using optimized serialization, non-blocking asynchronous logging, and efficient metadata merging, Zario consistently outperforms established libraries in common logging scenarios.

## Test Environment

The benchmarks were conducted on the following hardware and software stack:

- **OS**: Ubuntu 24.04 (Linux 6.14.0-29-generic)
- **CPU**: Intel Core i3-8130U @ 2.20GHz (2 cores, 4 threads)
- **RAM**: 8GB DDR4
- **Runtime**: Bun 1.3.6 / Node.js v24.13.0
- **Output**: All outputs directed to `/dev/null` to measure pure CPU overhead.

## Methodology

To ensure accurate and fair results, the following methodology was used:
- **Null Output**: All transports were configured to write to `/dev/null` or a no-op stream to eliminate I/O bottlenecks.
- **Warmup**: Each test category included a warmup phase to allow for JIT optimization.
- **Iterations**: Tests were run for millions of iterations to achieve statistically significant results.
- **Comparison**: Zario's performance is used as the baseline for all comparisons.

## Results

### Simple Message
*Test: `logger.info("Hello world")`*

| Library | ops/sec | ns/op | vs Zario |
|---------|---------|-------|----------|
| **Zario** | **1,850,320** | **540** | **baseline** |
| Winston | 204,144 | 4,899 | 9x slower |
| Pino | 195,237 | 5,122 | 9.5x slower |
| Bunyan | 137,437 | 7,276 | 13x slower |
| Log4js | 96,451 | 10,368 | 19x slower |

### With Metadata
*Test: `logger.info("msg", { user, action, ip })`*

| Library | ops/sec | ns/op |
|---------|---------|-------|
| **Zario** | **1,806,907** | **553** |
| Pino | 615,333 | 1,625 |
| Bunyan | 228,430 | 4,378 |
| Winston | 201,617 | 4,960 |
| Log4js | 32,881 | 30,413 |

### Child Logger
*Test: `child.info("Request handled")`*

| Library | ops/sec | ns/op |
|---------|---------|-------|
| **Zario** | **1,394,318** | **717** |
| Pino | 470,311 | 2,126 |
| Winston | 146,196 | 6,840 |
| Bunyan | 119,293 | 8,383 |

### Filtered Logs
*Test: `logger.debug` when level is set to `info` (log is skipped)*

| Library | ops/sec | ns/op |
|---------|---------|-------|
| Pino | 22,737,613 | 44 |
| Bunyan | 6,705,343 | 149 |
| **Zario** | **3,206,053** | **312** |
| Log4js | 1,943,461 | 515 |
| Winston | 436,322 | 2,292 |

### Deep Nested Metadata
*Test: Logging objects with multiple levels of nesting*

| Library | ops/sec | ns/op |
|---------|---------|-------|
| **Zario** | **2,461,337** | **406** |
| Pino | 239,021 | 4,184 |
| Bunyan | 81,530 | 12,265 |
| Winston | 72,745 | 13,747 |
| Log4js | 15,381 | 65,015 |

### Error Logging
*Test: `logger.error(new Error("Failure"))`*

| Library | ops/sec | ns/op |
|---------|---------|-------|
| **Zario** | **1,846,615** | **542** |
| Winston | 165,317 | 6,049 |
| Bunyan | 127,400 | 7,849 |
| Pino | 117,557 | 8,507 |
| Log4js | 38,538 | 25,948 |

### High-Frequency Burst
*Test: Processing a burst of 100,000 logs*

| Library | Time (ms) | logs/sec |
|---------|-----------|----------|
| **Zario** | **26.58** | **3,762,563** |
| Pino | 129.09 | 774,661 |
| Winston | 426.08 | 234,698 |
| Bunyan | 694.01 | 144,089 |
| Log4js | 1033.30 | 96,777 |

## Analysis and Insights

- **Overall Performance**: Zario is the fastest library for actual logging operations, including simple messages, metadata enrichment, child loggers, and error handling.
- **Child Loggers**: Zario's child loggers are significantly more efficient, performing **3x faster than Pino** and **10x faster than Winston**. This makes Zario ideal for request-tracing in complex microservices.
- **Burst Handling**: Zario handles high-frequency bursts **4.9x faster than Pino**, thanks to its optimized asynchronous pipeline and minimal object allocation.
- **Filtered Logs**: Pino leads in the filtered logs category (where logging is disabled for a specific level) due to its use of numeric level comparisons versus Zario's current internal lookup. However, Zario still maintains a high throughput of over 3 million ops/sec in this scenario.
- **Deep Metadata**: Zario excels at handling deeply nested objects, outperforming Pino by over **10x** in this specific test.

## Caveats and Notes

- Performance may vary based on the number of active transports and the complexity of custom filters or enrichers.
- All tests were conducted with standard configurations. Specific optimizations (like Pino's `pino.destination`) were used where applicable to ensure a fair comparison.
- This benchmark focuses on CPU overhead; actual disk or network I/O will be the limiting factor in many real-world deployments.

---

[← Roadmap](./roadmap.md) | [Introduction →](./introduction.md)
