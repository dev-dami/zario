# Migrating to 1.0

The root `zario` import is now a small core. For the old behavior, change one import:

```diff
- import { Logger, FileTransport } from "zario";
+ import { Logger, FileTransport } from "zario/full";
```

To get the smaller bundle, import each part from its own entry point:

| You use | Import from |
|---|---|
| `zario`, `Logger`, `ConsoleTransport` | `zario` |
| `FileTransport`, `HttpTransport`, `RetryTransport`, `CircuitBreakerTransport`, `DeadLetterQueue`, `SyslogTransport`, `WebSocketTransport`, `ElasticsearchTransport` | `zario/transports` |
| `FieldEncryptor`, `decryptField` | `zario/encryption` |
| `MemoryQueueProvider` | `zario/queue` |
| `LevelFilter` and the other filters | `zario/filters` |
| `BatchAggregator` and the other aggregators | `zario/aggregation` |
| `MetadataEnricher`, `LogEnrichmentPipeline` | `zario/structured` |
| `RequestContext` | `zario/context` |
| OpenTelemetry providers | `zario/otel` |
| `Timer`, `Redactor` | `zario/full` |

`zario/logger` still works, and is the same as the root import.

## Changes in the root import

- `new Logger()` writes to the console, synchronously, also in production. It no
  longer creates `./logs/app.log`. Add a `FileTransport` if you need the file.
- `async: true` needs a queue: `queueProvider: new MemoryQueueProvider()`.
- `retryOptions` throws. Wrap the transport: `new RetryTransport({ wrappedTransport, maxAttempts: 5 })`.

## Safer defaults

- `redact` on a child adds to the paths of its parent. Before, it replaced them.
- Redaction ignores letter case, and works on a copy. Custom transports get plain data
  in place of class instances when `redact` or `encryptor` is on. Errors stay errors.
- Text output indents the lines after a newline, and escapes control characters.
- `FileTransport` creates files with mode `0o640`. Set `mode` if another user must read them.

Other breaking changes are in the [changelog](../CHANGELOG.md).
