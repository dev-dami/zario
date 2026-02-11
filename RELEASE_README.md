# Release Notes

## 2026-02-11

This release focuses on smaller bundles, logger hot-path performance, transport reliability, and benchmark/reporting consistency.

## Highlights

- New lean entrypoint: `zario/logger` for reduced bundle inclusion when only `Logger` is needed.
- Retry wrapping is now factory-based via `Logger.retryTransportFactory`.
- Logger internals optimized (level-priority cache, earlier filter short-circuit, faster metadata checks).
- Transport stability improvements across Retry/CircuitBreaker/DeadLetterQueue/File rotation paths.
- Benchmark CLI output standardized into one consistent table format across all sections.
- Documentation updated in English and Japanese, with Bun-first package manager guidance.

## Compatibility and Migration

- Root import (`import { Logger } from "zario"`) remains backward compatible and auto-configures retry wrapping.
- Lean import (`import { Logger } from "zario/logger"`) is intentionally minimal; if using `retryOptions`, configure:

```ts
import { Logger } from "zario/logger";
import { RetryTransport } from "zario/transports/RetryTransport";

Logger.retryTransportFactory = (options) => new RetryTransport(options);
```

- `LoggerOptions.retryOptions` now uses `LoggerRetryOptions` (no `wrappedTransport` field required from callers).

## Full Change Log

See `CHANGELOG.md` for the complete categorized change list.
