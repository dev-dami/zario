# Changelog

All notable changes to this project are documented in this file.

## [Unreleased]

### Breaking

- `CircuitBreakerTransport` uses the standard state names, as the docs already said: `closed` is healthy, `open` is tripped, `half-open` probes. `onTrip` runs when the circuit opens. `onReset` runs when it closes again.
- A transport config that is not a transport instance (for example `{ type: "file" }`) throws a `TypeError`. Before, the logger dropped it and wrote nowhere. `TransportConfig` is now `Transport`.
- JSON output moves metadata keys named `level`, `message`, `timestamp` or `prefix` under a nested `metadata` object, so they cannot overwrite the built-in fields.
- Removed options that nothing read: `LoggerOptions.deadLetterQueue`, and `FileTransportOptions.batchInterval` and `maxQueueSize`.

### Fixed

- A child logger copies the parent's transports and enrichers, so `child.addTransport()` and `child.addEnricher()` do not change the parent.
- A transport that throws in sync mode no longer throws into the caller or skips the other transports. The logger emits `error` with `type: "transport"`.
- `setAsyncMode(false)` on a child no longer destroys the queue that the parent shares.
- Redaction runs after the enrichers, keeps arrays as arrays, and keeps the message and stack of an `Error`.
- `RetryTransport` opens its circuit again when a half-open probe fails.
- OpenTelemetry context works in Node ESM. The parent span id comes from the SDK span.
- `HttpTransport.write()` uses the `retries` option.
- `DeadLetterQueue` records delivery failures of async transports such as `HttpTransport`, and has `flush()` and `close()`.
- `FileTransport` rotates by rename, so concurrent writes lose no line. Compression runs in the background, and ANSI color codes do not go into the file.
- `MemoryQueueProvider` with `flushInterval` uses a timer only while logs wait, so an idle queue does not keep the process alive.
- In production, `new Logger()` falls back to the console when it cannot create `./logs/app.log`.
- `Logger.global` replaces a closed logger. `fatal` has a color.

### Added

- `SyslogTransport`: RFC 5424 or RFC 3164 messages over UDP or TCP, with facility, app name and a level-to-severity map (#87).
- `WebSocketTransport`: live log streaming with a bounded queue while disconnected, capped reconnect backoff, and `flush()`/`close()` support. It uses the global `WebSocket` (Bun, Node 22+) or a `createSocket` factory (#88).
- `ElasticsearchTransport`: batched `_bulk` indexing for Elasticsearch and OpenSearch, with data streams, API key or basic auth, ingest pipelines, retries for 429 and 5xx, and a bounded queue.
- Limits on background work: `HttpTransport` `maxPendingRequests`, `RetryTransport` `maxPendingWrites`, and `DeadLetterQueue` `maxDeadLetters` and `maxPendingWrites`. Each default is 1000.

### Removed

- The unused internal `BufferedWriteStream`.

## [0.9.0]

### Added

- Named `zario()` factory in the full and lean entrypoints, with console-only defaults.
- Object-first logging, direct Error logging, scoped `child()` loggers, and level inspection.
- Awaitable `flush()` and `close()` with child resource ownership and transport hooks.
- Bun-native runtime tests, a Chalk/ANSI installation regression test, and Elysia guidance.

### Fixed

- Circular metadata and BigInt serialization in formatters, HTTP and dead-letter output.
- Error diagnostic fields, timestamp options, inherited child formatting, and silent mode.
- Queue flush races, parent/child routing, and draining background transport work.

### Tooling and documentation

- Bun is the default package manager, with isolated installs and one Bun lockfile per repo.
- Removed npm lockfiles and the unsupported nested Chalk override.
- CI and release scripts install/build with Bun; the Node compatibility suite remains available.
- Added an evidence-backed comparison, Pino migration notes, and release-readiness checklist.

## [Unreleased] - 2026-02-11

### Added
- Added `zario/logger` as a lean subpath export for apps that only need `Logger`.
- Added `Logger.retryTransportFactory` and `Logger.defaultTransportsFactory` static extension points for configurable transport wiring.
- Added `LoggerRetryOptions` type (retry options without `wrappedTransport`) and retry-factory injection tests.
- Added modular utility files: `src/utils/ColorUtil.ts`, `src/utils/TimeUtil.ts`, and `src/utils/Timer.ts`.

### Changed
- Optimized `Logger` hot path:
  - cache level priority to avoid per-log recomputation,
  - run filters before enrichers to skip unnecessary enrichment on dropped logs,
  - use efficient own-key metadata checks.
- Refactored logger enrichment handling to an internal lightweight pipeline shape for reduced coupling.
- Updated root exports to keep backward compatibility while enabling smaller-import paths.
- Updated package exports to publish `./logger`.
- Normalized benchmark runner output to a single markdown-table format across all sections.
- Standardized benchmark docs tables in English and Japanese (`ops/sec` + `ns/op` schema).
- Switched install/build docs and prepublish script to Bun-first usage.

### Fixed
- Prevented retry double-wrapping by tagging retry-wrapped transports.
- Improved `CircuitBreakerTransport` metrics accounting for async-capable base transports.
- Simplified and hardened `DeadLetterQueue` write/retry paths and dead-letter file persistence.
- Improved `FileTransport` rotation behavior and uniqueness of rotated file names.
- Stabilized related test expectations around async timing and transport behavior.

### Documentation
- Updated `README`, `README-JP`, getting-started/configuration/API docs (EN/JP) for:
  - Bun-based installation,
  - lean `zario/logger` import guidance,
  - retry factory setup and `retryOptions` behavior.

### Compatibility Notes
- Existing root imports from `zario` remain compatible and auto-configure retry wrapping.
- New `zario/logger` entrypoint is opt-in and intentionally minimal.
- When using `zario/logger` with `retryOptions`, set `Logger.retryTransportFactory` once at app startup.
- `retryOptions.wrappedTransport` is no longer user-supplied in `LoggerOptions`; wrapping is handled internally via factory.
