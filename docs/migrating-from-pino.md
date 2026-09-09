# Migrating from Pino

The factory and object-first calls reduce the mechanical changes. Zario is not
a drop-in replacement for Pino's output schema, levels, plugins, or destinations.
These examples describe the source in this checkout; publish a release containing
it before directing users of older npm versions to the new factory.

```ts
// Before
import pino from 'pino';
const log = pino();
const requestLog = log.child({ requestId: '123' });
requestLog.info({ status: 200 }, 'Request completed');

// After (in a separate module)
import { zario } from 'zario';
const log = zario({ json: true });
const requestLog = log.child({ requestId: '123' });
requestLog.info({ status: 200 }, 'Request completed');
// Also supported: requestLog.info('Request completed', { status: 200 });
```

| Pino usage | Zario equivalent / difference |
|---|---|
| `pino(options)` | `zario(options)`; review options individually |
| `log.child(bindings)` | Same call shape |
| `log.error(error)` | Same call; diagnostic data is under `err` |
| `log.level = 'debug'` | `log.setLevel('debug')` |
| `log.isLevelEnabled('debug')` | Same call |
| `redact: ['password']` | `redact: { paths: ['password'] }` |
| `log.flush(callback)` | `await log.flush()` |
| Destination stream / worker transport | A Zario `Transport` with `write(data, formatter)` |
| `trace`, printf interpolation, serializers, bindings mutation | No automatic equivalent; adapt explicitly |

Pino emits numeric levels with `msg` and `time` by default. Zario JSON uses string
levels, `message`, and an ISO `timestamp`. Metadata is flattened for text/JSON
formatting; HTTP transport keeps it under `metadata`. Update downstream parsers
and dashboards before switching. Keep `level`, `message`, `timestamp`, and
`prefix` out of metadata to avoid collisions with envelope fields.

Factory defaults differ: Zario writes synchronously to the console and formats
text in development. Set `json: true` for consistent JSON. `new Logger()` keeps
legacy defaults and is not equivalent to the factory.

Use `await log.close()` after stopping request intake and before process exit.
Queue overflow can still drop records under the configured policy; flushing
cannot recover dropped entries or promise remote persistence. Custom background
transports must implement `flush()` and `close()` (or `destroy()`).

Start migration with one service, assert the emitted schema and redaction paths,
and test destination outages before rolling it out broadly.

Pino call shapes and options: [official API](https://github.com/pinojs/pino/blob/main/docs/api.md).
