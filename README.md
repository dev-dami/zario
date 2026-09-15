<div align="center">

<a id="top"></a>

# Zario

### Fast structured logging without the ceremony

**Bun-first structured logging for TypeScript and Node.js. Zero runtime dependencies.**

[![npm version](https://img.shields.io/npm/v/zario?style=for-the-badge&logo=npm&color=CB3837)](https://www.npmjs.com/package/zario)
[![license](https://img.shields.io/npm/l/zario?style=for-the-badge&color=green)](./LICENSE)
[![downloads](https://img.shields.io/npm/dt/zario?style=for-the-badge&logo=npm&color=orange)](https://www.npmjs.com/package/zario)
[![bundle size](https://img.shields.io/bundlephobia/minzip/zario?style=for-the-badge&logo=webpack&color=purple)](https://bundlephobia.com/package/zario)

[Japanese](README-JP.md)

</div>

## Install

```bash
bun add zario
```

Node.js users can install the same package with their package manager of choice.

```bash
npm install zario
# or
pnpm add zario
```

## 10-second start

```ts
import { zario } from "zario";

const log = zario();

log.info("server started", { port: 3000 });
log.error(new Error("database unavailable"));

const requestLog = log.child({ requestId: "req-123" });
requestLog.info("request completed", { status: 200 });
```

`zario()` enables `info` and higher, writes synchronously to the console, and creates no log files. Production uses JSON; development uses colored text. Options override those defaults.

## Why Zario?

- **Zero runtime dependencies** — a small dependency surface with nothing else pulled into production.
- **Bun-first, Node-compatible** — Bun is the primary development and benchmark runtime; Node.js 20+ is supported.
- **Structured by default** — metadata, child context, direct `Error` objects, circular values, and BigInt are handled without custom serializers for common cases.
- **Predictable shutdown** — `flush()` and `close()` let applications drain queued logs and transport work before exit.
- **Built-in redaction** — redact sensitive paths before output.
- **Transport surface included** — Console, File, HTTP, retry/circuit-breaker and dead-letter patterns are available without adding a logging plugin stack.
- **Lean import available** — use `zario/logger` when you only need the core logger.

## Framework integrations

Official adapters are available for common TypeScript backends:

- [elysia-zario](https://github.com/dev-dami/elysia-zario) — typed request logging for Elysia on Bun.
- [zario-express](https://github.com/dev-dami/zario-express) — Express logging middleware.
- [nestjs-zario](https://github.com/dev-dami/nestjs-zario) — NestJS custom logger service.
- [fastify-zario](https://github.com/dev-dami/fastify-zario) — Fastify custom logger wrapper.

### Elysia on Bun

```ts
import { Elysia } from "elysia";
import { elysiaLogger } from "elysia-zario";

new Elysia()
  .use(elysiaLogger())
  .get("/", ({ log, requestId }) => {
    log.info("request handled");
    return { requestId };
  })
  .listen(3000);
```

The adapter adds typed request loggers, request IDs, completion/error logs, and shutdown hooks. It targets Zario 0.9.0; release the core before the adapter. See the [Bun guide](./docs/bun.md) for setup and local development.

## Zario, Pino, or Winston?

Zario is not presented as universally faster than every logger in every workload. The checked-in comparison reports where it wins, where it loses, the exact environment, and how to reproduce the measurements.

Start with the [API comparison and measurement caveats](./docs/comparison.md). The [benchmark report](./docs/benchmarks.md) includes reproducible commands and raw output. Historical numbers do not describe the current serialization and shutdown implementation; no universal throughput claim is made here.

If you are migrating an existing service, see [Migrating from Pino](./docs/migrating-from-pino.md).

## Everyday logging

```ts
import { zario } from "zario";

const log = zario();
log.info("Server ready", { port: 3000 });
log.info({ port: 3000 }, "Server ready"); // Object-first works too
log.info({ event: "heartbeat" });          // Message is optional for objects
log.error(new Error("Connection failed")); // Keeps name, message and stack
log.error("Query failed", new Error("Database unavailable"));

const requestLog = log.child({ requestId: "req-123" });
requestLog.info("Request completed", { status: 200 });

if (log.isLevelEnabled("debug")) {
  log.debug("Diagnostics", { details: {} });
}
```

Both argument orders work with every level and `logWithLevel`. Direct errors are stored under `err`; nested errors also retain their diagnostic fields, including `cause`. Object-only calls use an empty message. Existing `createChild({ context: ... })` calls continue to work; `child(context, options?)` is shorthand, and per-call metadata overrides child bindings.

Circular metadata is serialized as `"[Circular]"` in text, JSON, HTTP payloads, and dead-letter records. Shared objects that are not cycles remain intact. BigInt values become decimal strings. Serialization does not mutate your data.

## JSON and redaction

```ts
const log = zario({
  json: true,
  redact: { paths: ["password", "user.token"] },
});

log.info("Login", { user: { id: 42, token: "secret" } });
```

## Shutdown

```ts
await log.flush(); // Wait for queued logs and transport buffers
await log.close(); // Drain, release resources, stop accepting logs
```

Await shutdown before exiting the process. Closing a child leaves inherited transports open; closing its parent also closes its children. Failed delivery rejects `flush()`/`close()`; custom transports should implement lifecycle hooks for any background work they start.

## File transport

```ts
import { Logger, FileTransport } from "zario";

const logger = new Logger({
  transports: [
    new FileTransport({
      path: "./logs/app.log",
      maxSize: 10 * 1024 * 1024,
      maxFiles: 5,
    }),
  ],
});
```

## Lean import

If you only need the core logger:

```ts
import { zario } from "zario/logger";

const log = zario();
```

## Documentation

| Section | Description |
|---|---|
| [Bun and Elysia](./docs/bun.md) | Bun-first setup, native usage, and typed Elysia integration |
| [Migrating from Pino](./docs/migrating-from-pino.md) | Call mapping and compatibility differences |
| [Comparison](./docs/comparison.md) | API examples and benchmark limitations |
| [Configuration](./docs/configuration.md) | Logger options, custom levels, and colors |
| [API Reference](./docs/api-reference.md) | Logger class and utilities |
| [Transports](./docs/transports.md) | Console, File, HTTP, CircuitBreaker, DeadLetterQueue |
| [Advanced Usage](./docs/advanced-usage.md) | Filters, enrichers, aggregators, async mode |
| [Log Formats](./docs/log-formats.md) | Text and JSON output spec |
| [Benchmarks](./docs/benchmarks.md) | Performance comparison with other libraries |
| [Roadmap](./docs/roadmap.md) | Future plans |

## Contributing

Bug reports, feature requests, and pull requests are welcome. See the [Contributing Guide](./CONTRIBUTING.md).

## License

[MIT License](./LICENSE)

<div align="center">

If Zario is useful in your project, consider starring the repository.

[Back to Top](#top)

</div>
