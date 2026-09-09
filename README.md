<div align="center">

<a id="top"></a>

# Zario

### Fast structured logging without the ceremony

[![npm version](https://img.shields.io/npm/v/zario?style=for-the-badge&logo=npm&color=CB3837)](https://www.npmjs.com/package/zario)
[![license](https://img.shields.io/npm/l/zario?style=for-the-badge&color=green)](./LICENSE)
[![downloads](https://img.shields.io/npm/dt/zario?style=for-the-badge&logo=npm&color=orange)](https://www.npmjs.com/package/zario)
[![bundle size](https://img.shields.io/bundlephobia/minzip/zario?style=for-the-badge&logo=webpack&color=purple)](https://bundlephobia.com/package/zario)

[Japanese](README-JP.md)

<br/>

**Fast** • **Simple** • **Zero Dependencies** • **TypeScript Native**

<br/>

[Quick Start](#quick-start) · [Documentation](#documentation) · [Contributing](#contributing)

<br/>

![separator](https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/rainbow.png)

</div>

<br/>

## Features

- **Zero dependencies** — nothing to install, nothing to break
- **Simple API** — `logger.info()`, `logger.warn()`, `logger.error()`
- **Flexible formatting** — plain text or structured JSON
- **Multiple transports** — Console, File (rotation + compression), HTTP (with retry)
- **Child loggers** — scoped logging for modules or requests
- **Async mode** — non-blocking writes for high-throughput apps
- **Customizable** — custom log levels, colors, and filters
## Ecosystem

We provide official adapters to easily integrate Zario into your favorite web frameworks:

- [elysia-zario](https://github.com/dev-dami/elysia-zario) — typed request logging for Elysia on Bun.
- [zario-express](https://github.com/dev-dami/zario-express) — Express logging middleware.
- [nestjs-zario](https://github.com/dev-dami/nestjs-zario) — NestJS custom logger service.
- [fastify-zario](https://github.com/dev-dami/fastify-zario) — Fastify custom logger wrapper.

## Zario, Pino, or Winston?

Start with the [API comparison and measurement caveats](./docs/comparison.md).
The [benchmark report](./docs/benchmarks.md) includes reproducible commands and
raw output. Historical numbers do not describe the current serialization and
shutdown implementation; no universal throughput claim is made here.

## Installation

```bash
bun add zario
```

## Quick Start

```ts
import { zario } from "zario";

const log = zario();
log.info("server started", { port: 3000 });
```

`zario()` enables `info` and higher, writes synchronously to the console, and
creates no log files. Production uses JSON; development uses colored text.
Options override those defaults. `new Logger()` and the default class export
remain available with their existing environment-dependent defaults.

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

The adapter adds typed request loggers, request IDs, completion/error logs, and
shutdown hooks. It targets Zario 0.9.0; release the core before the adapter.
See the [Bun guide](./docs/bun.md) for setup and local development.

### Everyday logging

```ts
import { zario } from 'zario';

const log = zario();
log.info('Server ready', { port: 3000 });
log.info({ port: 3000 }, 'Server ready'); // Object-first works too
log.info({ event: 'heartbeat' });         // Message is optional for objects
log.error(new Error('Connection failed')); // Keeps name, message and stack
log.error('Query failed', new Error('Database unavailable'));

const requestLog = log.child({ requestId: 'req-123' });
requestLog.info('Request completed', { status: 200 });

if (log.isLevelEnabled('debug')) {
  log.debug('Diagnostics', { details: /* compute expensive diagnostics here */ {} });
}
```

Both argument orders work with every level and `logWithLevel`. Direct errors
are stored under `err`; nested errors also retain their diagnostic fields,
including `cause`. Object-only calls use an empty message. Existing
`createChild({ context: ... })` calls continue to work; `child(context, options?)`
is shorthand, and per-call metadata overrides child bindings.

Circular metadata is serialized as `"[Circular]"` in text, JSON, HTTP payloads,
and dead-letter records. Shared objects that are not cycles remain intact.
BigInt values become decimal strings. Serialization does not mutate your data.

### Child Logger

```ts
const requestLog = log.child({ requestId: "req-123" });
requestLog.info("Incoming request");
```

### JSON and Redaction

```ts
const log = zario({
  json: true,
  redact: { paths: ["password", "user.token"] },
});
log.info("Login", { user: { id: 42, token: "secret" } });
```

### Shutdown

```ts
await log.flush(); // Wait for queued logs and transport buffers
await log.close(); // Drain, release resources, stop accepting logs
```

Await shutdown before exiting the process. Closing a child leaves inherited
transports open; closing its parent also closes its children. Failed delivery
rejects `flush()`/`close()`; custom transports should implement lifecycle hooks
for any background work they start.

### File Transport

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

### Lean Import

If you only need the core logger:

```typescript
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

Bug reports, feature requests, and pull requests welcome. See [Contributing Guide](./CONTRIBUTING.md).

## License

[MIT License](./LICENSE)

<br/>

<div align="center">

Star this repository if you find it useful

</div>

<br/>

[Back to Top](#top)
