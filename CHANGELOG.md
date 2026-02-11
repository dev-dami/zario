# Changelog

All notable changes to this project are documented in this file.

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
