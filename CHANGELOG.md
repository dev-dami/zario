# Changelog

All notable changes to this project are documented in this file.

## [Unreleased]

### Breaking

- The root `zario` import is now the small core: `zario`, `Logger`, `ConsoleTransport` and types. Change the import to `zario/full` to keep the old exports and defaults, or import each part from its own entry point. See [Migrating to 1.0](./docs/migrating-to-1.0.md).
- `new Logger()` from `zario` writes to the console, synchronously, also in production. The file output and async default are in `zario/full`.
- `retryOptions` without a retry factory throws. Before, it was ignored.
- A child logger adds its `redact` paths and `encryptor` to those of its parent, and cannot remove them.
- Redaction ignores letter case and works on a plain copy, so custom transports get plain data in place of class instances.
- Text output indents the lines after a newline, and escapes control characters other than tab and, with color on, color codes.
- New log and dead-letter files have mode `0o640` on POSIX systems.
- An unknown `level` option throws. Before, it turned off every level with no message.
- Text output shows an Error as a stack with real lines, its own fields and its causes, in place of one escaped JSON line.
- Private members of `Logger` and other classes have short names in the published build.
- `CircuitBreakerTransport` uses the standard state names, as the docs already said: `closed` is healthy, `open` is tripped, `half-open` probes. `onTrip` runs when the circuit opens. `onReset` runs when it closes again.
- A transport config that is not a transport instance (for example `{ type: "file" }`) throws a `TypeError`. Before, the logger dropped it and wrote nowhere. `TransportConfig` is now `Transport`.
- JSON output moves metadata keys named `level`, `message`, `timestamp` or `prefix` under a nested `metadata` object, so they cannot overwrite the built-in fields.
- Removed options that nothing read: `LoggerOptions.deadLetterQueue`, and `FileTransportOptions.batchInterval` and `maxQueueSize`.

### Fixed

- Redaction leaks: a value from `toJSON()`, a cycle back to a redacted object, another letter case, or a key with a literal dot.
- A log call does not throw or lose the record when metadata has a throwing getter, `toJSON()` or proxy, is too deep, or when a filter, enricher or error listener throws.
- JSON output stays valid for array metadata, and a custom level name cannot add a field.
- `serialize()` does not throw, and a dense cyclic graph takes bounded time.
- `FileTransport` keeps the file open, for up to one second at a time, in place of one open for each line.
- `HttpTransport` keeps at most 1 to 2 kB of an error reply, and its `timeout` covers the whole request, including the DNS lookup.
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

- `SyslogTransport`: RFC 5424, with structured data and MSGID, or RFC 3164. UDP (RFC 5426), TCP with octet counting or newline framing (RFC 6587), or TLS with certificate checks (RFC 5425). Messages are cut between UTF-8 characters, and control characters are escaped (#87).
- `WebSocketTransport`: live log streaming with a bounded queue while disconnected, capped reconnect backoff, and `flush()`/`close()` support. It uses the global `WebSocket` (Bun, Node 22+) or a `createSocket` factory (#88).
- `ElasticsearchTransport`: batched `_bulk` indexing for Elasticsearch and OpenSearch, with data streams, API key or basic auth, ingest pipelines, retries for 429 and 5xx, and a bounded queue.
- `FieldEncryptor`: encryption of selected metadata fields as JWE (RFC 7516) with A256GCM, and key ids for rotation. The key is a 32-byte secret (`A256KW` or `dir`), RSA (`RSA-OAEP-256`), or P-256, P-384, P-521 or X25519 (`ECDH-ES`). `decryptField()` or any JOSE library reads a value back.
- `HashChain`, and `integrity` of `FileTransport`: tamper-evident log files. Each line links to the one before with SHA-256 or HMAC-SHA256, and checkpoints go to `onCheckpoint`. `verifyChain()` and `verifyChainFiles()` report changed, removed, added and cut lines.
- `LineEncryptor`, and `encryptor` of `FileTransport`: encryption of whole log lines. `decryptLine()` reads a line back.
- Entry points: `zario/full`, `zario/encryption`, `zario/queue`, `zario/transports`, `zario/filters`, `zario/aggregation`, `zario/structured`, `zario/context` and `zario/otel`.
- `LOG_LEVEL` sets the default level. `redact` takes a plain list of paths.
- Timers write `timer` and `durationMs` fields, take more fields in `end()`, and work with `using`. A logger works with `await using`.
- A second argument that is not an object is kept under `details`, in place of being dropped.
- `LogMethod` type, and a size budget for the core in CI.
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
