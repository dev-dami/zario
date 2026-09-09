# Zario vs Pino vs Winston

**Fast structured logging without the ceremony.** Choose based on the API,
output contract, and your workload. This page describes unreleased Zario source;
benchmarks are observations from one machine, not a universal ranking.

## Hello world and metadata

```ts
// Zario
import { zario } from 'zario';
const log = zario();
log.info('saved', { id: 42 });
log.info({ id: 42 }, 'saved');

// Pino (separate module)
import pino from 'pino';
const log = pino();
log.info({ id: 42 }, 'saved');

// Winston (separate module)
import winston from 'winston';
const log = winston.createLogger({
  format: winston.format.json(),
  transports: [new winston.transports.Console()],
});
log.info('saved', { id: 42 });
```

## Common operations

| Operation | Zario | Pino | Winston |
|---|---|---|---|
| Bound context | `log.child({ requestId })` | `log.child({ requestId })` | `log.child({ requestId })` |
| Error | `log.error(error)`; also serializes nested errors | `log.error(error)` or `{ err: error }` with standard serializer | Configure `format.errors({ stack: true })` |
| Redaction | `redact: { paths: ['password'] }` | `redact: ['password']` | A custom format/transformation |
| Output defaults | Factory: console; text in development, JSON in production | JSON | Configure format and transport on `createLogger` |
| Shutdown | `await log.close()` | Flush and manage destination/transport lifecycle | End logger stream and await `finish` |

The Pino examples follow its [official API](https://github.com/pinojs/pino/blob/main/docs/api.md).
Winston setup, child loggers, errors and stream completion follow its
[official README](https://github.com/winstonjs/winston/blob/master/README.md).
These examples do not imply wire-format or plugin compatibility.

Zario keeps runtime dependencies at zero. Its lean entrypoint avoids loading the
full transport surface. Dependency and bundle sizes depend on exact versions,
entrypoints and bundlers; do not reuse old bundle-size tables for this checkout.
The final root-versus-lean smoke check measured **24.92 KiB** and **14.59 KiB**
respectively (Bun 1.4.0, minified Node target, the script's `new Logger()` fixtures).
Run `bun run check-bundle-size` to reproduce. Other libraries were not bundled
with that check, so these sizes are not a cross-library size ranking.

## Current measurement

Raw output: [2026-09-09 adversarial run](./benchmark-results/2026-09-09-adversarial.txt).
See the accompanying [environment record](./benchmark-results/2026-09-09-environment.txt).
The run measures the working tree containing the circular serializer and
lifecycle work, rather than the published npm version.

| Case (median ops/sec) | Zario | Pino | Winston |
|---|---:|---:|---:|
| Simple constant | 2,750,829 | 1,742,836 | 431,729 |
| Dynamic message | 1,093,116 | 875,243 | 377,938 |
| Flat metadata | 430,867 | 460,322 | 186,194 |
| Deep metadata | 178,549 | 337,039 | 103,494 |
| 16 KiB message | 127,963 | 66,268 | 47,997 |
| Child context | 394,606 | 534,817 | 197,811 |
| Error object | 190,237 | 349,635 | 170,099 |
| Filtered debug | 4,330,091 | 6,335,015 | 464,913 |

Pino leads Zario on flat/deep metadata, child context, the configured Error case,
and filtered calls. Zario leads these three on constant/dynamic messages and the
16 KiB message case in this run. All six libraries are included in the raw output.

| 100,000-record burst | Zario | Pino | Winston |
|---|---:|---:|---:|
| Elapsed ms | 56.94 | 196.12 | 482.24 |
| Sink writes | 100,000 | 100,000 | 100,000 |
| Emitted bytes | 4,300,000 | 3,500,000 | 4,300,000 |
| Circular probe threw | No | No | No |

All reported heap deltas rounded to 0.00 MiB. This run provides no meaningful
comparative memory result. The snapshot predates final resource-ownership and
silent-level refinements; rerun against a tagged release for release claims.


## What these measurements do and do not establish

- Five 250 ms samples per case, medians reported; 100,000 writes in the burst.
- Bun runs with `--smol --expose-gc`. GC runs between samples. The timer and
  argument construction are inside the measured loop. Re-run on your runtime.
- All candidates write to the same kind of synchronous in-process sink, but
  their schemas and emitted byte counts differ. No disk or network I/O occurs.
- Pino has base fields and timestamps disabled. Zario uses JSON with timestamps
  disabled. Bunyan retains mandatory fields. Loglevel and Log4js use custom
  JSON-emitting adapters, so their failure behavior also reflects those adapters.
- The error case puts an Error under `error`, not Pino's default `err` key.
  It tests that configuration, not the best possible Error configuration for
  every library. The harness's stack probe is a message-or-stack substring
  check, not a proof that every diagnostic field survived.
- The heap column is a single before/after heap-used delta without a post-burst
  full-GC retention measurement. It can be negative and is not a memory ranking.
- The circular probe reports whether a call throws. It does not assert semantic
  equivalence, flush durability, or tolerance of every JavaScript object.
- A single development run is not release certification. Historical measurements
  are retained separately in [benchmarks](./benchmarks.md).

## Reproduce

```bash
bun install
cd .benchmark
bun install
bun run bench:adversarial
```

The checked-in script and lockfile pin the methodology and installed versions.
Publish the complete output, environment and source revision alongside results.
For migration, use [the call mapping and compatibility notes](./migrating-from-pino.md).
