<div align="center">

<a id="top"></a>

# Zario: structured logger for Bun, Node.js and TypeScript

### The tiny logger that keeps secrets out of your logs

**Zero-dependency JSON logging with redaction, field encryption, child loggers, file rotation and transports. About 5 kB min+gzip.**

[![npm version](https://img.shields.io/npm/v/zario?style=for-the-badge&logo=npm&color=CB3837)](https://www.npmjs.com/package/zario)
[![license](https://img.shields.io/npm/l/zario?style=for-the-badge&color=green)](./LICENSE)
[![downloads](https://img.shields.io/npm/dt/zario?style=for-the-badge&logo=npm&color=orange)](https://www.npmjs.com/package/zario)
[![bundle size](https://img.shields.io/bundlephobia/minzip/zario?style=for-the-badge&logo=webpack&color=purple)](https://bundlephobia.com/package/zario)

[Japanese](README-JP.md)

</div>

Zario is a structured logging library for TypeScript and JavaScript servers. It writes JSON logs in production and readable, colored logs in development, removes passwords and tokens before they reach a file or service, and needs no other package. Use it on Bun or Node.js 20+, with Elysia, Express, Fastify, NestJS, or no framework.

## Install the logger

```bash
bun add zario
```

Node.js users can install the same package with their package manager of choice.

```bash
npm install zario
# or
pnpm add zario
```

## Quick start: log in 10 seconds

```ts
import { zario } from "zario";

const log = zario();

log.info("server started", { port: 3000 });
log.error(new Error("database unavailable"));

const requestLog = log.child({ requestId: "req-123" });
requestLog.info("request completed", { status: 200 });
```

`zario()` enables `info` and higher, writes synchronously to the console, and creates no log files. Production uses JSON, and development uses colored text with readable error stacks. Set the level with `LOG_LEVEL`. Options override those defaults.

## Why Zario?

- **Secrets stay out** — redact fields by path, or [encrypt fields and files](./docs/encryption.md) to the JWE standard, with a public key or a shared one.
- **Tamper-evident files** — a [hash chain](./docs/integrity.md) shows when a line was changed, removed or added.
- **Hard to break** — a hostile value, a throwing getter or a failed transport does not throw into your app, and user text cannot forge a log line. [Safety](./docs/safety.md) lists the guarantees and limits.
- **Small** — the core is about 5 kB min+gzip, with a size budget in CI. Import a transport only when you use it.
- **Zero runtime dependencies** — nothing else is pulled into production.
- **Bun-first, Node-compatible** — developed and benchmarked on Bun, tested on Node.js 20+.
- **Structured by default** — child context, `Error` objects with causes, circular values and BigInt work without serializers.
- **Predictable shutdown** — `flush()` and `close()` drain queued logs and transport work before exit.
- **Transports included** — File, HTTP, [Syslog](./docs/syslog.md) over UDP, TCP and TLS, WebSocket, Elasticsearch, retry, circuit breaker and dead letters.

## Redact and encrypt sensitive data in logs

```ts
import { zario } from "zario";
import { FieldEncryptor } from "zario/encryption";

const log = zario({
  redact: ["password", "headers.authorization"],
  encryptor: new FieldEncryptor({ paths: ["user.email"], key: process.env.LOG_KEY! }),
});

log.info("login", { user: { id: 42, email: "ada@example.com" }, password: "hunter2" });
// "user":{"id":42,"email":"eyJhbGciOi..."},"password":"[REDACTED]"
```

Use `**.password` to match a field at any depth. Redaction and encryption work on metadata fields, not on message text. Encrypted values are standard JWE (RFC 7516), so any JOSE library can read them. With a public key, the server that writes the logs cannot read them back. `LineEncryptor` encrypts whole log files. See [Encryption](./docs/encryption.md) for keys, algorithms and limits.

## Logging for Elysia, Express, Fastify and NestJS

Official adapters are available for common TypeScript backends:

- [elysia-zario](https://github.com/dev-dami/elysia-zario) — typed request logging for Elysia on Bun.
- [zario-express](https://github.com/dev-dami/zario-express) — Express logging middleware.
- [nestjs-zario](https://github.com/dev-dami/nestjs-zario) — NestJS custom logger service.
- [fastify-zario](https://github.com/dev-dami/fastify-zario) — Fastify custom logger wrapper.

### Elysia request logging on Bun

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

The adapter adds typed request loggers, request IDs, completion/error logs, and shutdown hooks. Check its README for the Zario versions it supports. See the [Bun guide](./docs/bun.md) for setup.

## Zario vs Pino, Winston and LogTape

| | Choose it for |
|---|---|
| **Zario** | Bun and Node.js services that want a small logger with redaction, encryption and transports, and no dependencies |
| **Pino** | The largest ecosystem of transports and tools, and worker-thread transports |
| **Winston** | Many community transports and custom formats |
| **LogTape** | Logging inside a library, or in browsers and edge runtimes |

The [comparison](./docs/comparison.md) shows the benchmarks that Zario wins and the ones it loses. Moving from Pino? See [the migration guide](./docs/migrating-from-pino.md).

## Structured logging examples

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

const timer = log.startTimer("query");
timer.end({ rows: 3 });                    // Adds durationMs

if (log.isLevelEnabled("debug")) {
  log.debug("Diagnostics", { details: {} });
}
```

Both argument orders work with every level and `logWithLevel`. Direct errors are stored under `err`; nested errors also retain their diagnostic fields, including `cause`. Object-only calls use an empty message. Existing `createChild({ context: ... })` calls continue to work; `child(context, options?)` is shorthand, and per-call metadata overrides child bindings.

Circular metadata is serialized as `"[Circular]"` in text, JSON, HTTP payloads, and dead-letter records. Shared objects that are not cycles remain intact. BigInt values become decimal strings. Serialization does not mutate your data.

## Graceful shutdown: flush logs before exit

```ts
await log.flush(); // Wait for queued logs and transport buffers
await log.close(); // Drain, release resources, stop accepting logs
```

Await shutdown before exiting the process. Closing a child leaves inherited transports open; closing its parent also closes its children. Failed delivery rejects `flush()`/`close()`; custom transports should implement lifecycle hooks for any background work they start.

## Log to a file with rotation

```ts
import { Logger } from "zario";
import { FileTransport } from "zario/transports";

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

## Prove that log files were not changed

```ts
import { FileTransport } from "zario/transports";
import { HashChain, verifyChainFiles } from "zario/integrity";

new FileTransport({ path: "./logs/audit.log", integrity: new HashChain({ key: process.env.LOG_CHAIN_KEY }) });

const report = await verifyChainFiles(["./logs/audit.log"], { key: process.env.LOG_CHAIN_KEY });
// report.ok, and report.problems: modified, gap, unchained, truncated ...
```

See [Tamper-evident logs](./docs/integrity.md) for checkpoints, and what a chain can and cannot prove.

## Send logs to syslog over UDP, TCP or TLS

```ts
import { zario } from "zario";
import { SyslogTransport } from "zario/transports";

const log = zario({
  json: true,
  transports: [new SyslogTransport({ host: "logs.example.com", protocol: "tls", appName: "api" })],
});
```

RFC 5424 with structured data, RFC 3164, RFC 5426 (UDP), RFC 6587 (TCP) and RFC 5425 (TLS). See the [syslog guide](./docs/syslog.md).

## Entry points

| Import | Contains |
|---|---|
| `zario` | `zario()`, `Logger`, `ConsoleTransport` |
| `zario/transports` | All transports |
| `zario/encryption` | `FieldEncryptor`, `LineEncryptor`, `decryptField`, `decryptLine` |
| `zario/integrity` | `HashChain`, `verifyChain`, `verifyChainFiles` |
| `zario/queue` | `MemoryQueueProvider` for async mode |
| `zario/filters`, `zario/aggregation`, `zario/structured` | Filters, aggregators, enrichers |
| `zario/context`, `zario/otel` | Request context, OpenTelemetry |
| `zario/full` | Everything, with the defaults of 0.x |

Upgrading from 0.x? See [Migrating to 1.0](./docs/migrating-to-1.0.md).

## Use Zario with AI coding agents

Zario ships an agent skill in `skills/zario` and an `llms.txt`. Or add this line to your `AGENTS.md` or `CLAUDE.md`:

```md
Use zario for logging: `import { zario } from "zario"`. Put data in metadata, not in the message. Call `await log.close()` before exit.
```

## FAQ

### Which logger should I use with Bun?

Zario is developed and tested on Bun first, has no dependencies, and has an Elysia adapter. Pino, Winston and LogTape also run on Bun. Start with the [Bun guide](./docs/bun.md) and the [comparison](./docs/comparison.md).

### Is Zario an alternative to Pino or Winston?

Yes, for JSON logs, child loggers, redaction and transports. It is not a drop-in replacement: level values and field names differ from Pino. See [Migrating from Pino](./docs/migrating-from-pino.md).

### Is Zario faster than Pino?

It depends on the workload and the runtime. The [comparison](./docs/comparison.md) has the cases, the method, and the commands to run it yourself.

### How do I remove passwords and tokens from Node.js logs?

Pass the field paths: `zario({ redact: ["**.password", "**.authorization"] })`. [Safety](./docs/safety.md) lists what redaction covers and what it does not.

### Can I encrypt fields in logs and read them later?

Yes. `FieldEncryptor` encrypts the fields you choose, and `LineEncryptor` whole files, as JWE with AES-256-GCM. `decryptField()` or any JOSE library reads them back. See [Encryption](./docs/encryption.md).

### How do I make audit logs tamper-evident?

Add `integrity: new HashChain()` to a `FileTransport`, and check files with `verifyChainFiles()`. See [Tamper-evident logs](./docs/integrity.md).

### How do I send Node.js or Bun logs to syslog?

Use `SyslogTransport`. It speaks RFC 5424 and RFC 3164 over UDP, TCP and TLS. See the [syslog guide](./docs/syslog.md).

### Why not let an AI agent write a logger?

An agent can write a good one. You then review, test and maintain that code in each project. Zario is one import, with a test suite that runs on Bun and Node.js, and transports you do not have to build.

## Documentation

| Section | Description |
|---|---|
| [Bun and Elysia](./docs/bun.md) | Bun-first setup, native usage, and typed Elysia integration |
| [Encryption](./docs/encryption.md) | Encrypt fields and files with JWE, choose keys, read values back |
| [Tamper-evident logs](./docs/integrity.md) | Hash chains, checkpoints, verification |
| [Syslog](./docs/syslog.md) | RFC 5424, 3164, 5425, 5426 and 6587, TLS and structured data |
| [Safety](./docs/safety.md) | What redaction and log calls guarantee, and their limits |
| [Migrating to 1.0](./docs/migrating-to-1.0.md) | Entry points and changed defaults |
| [Migrating from Pino](./docs/migrating-from-pino.md) | Call mapping and compatibility differences |
| [Comparison](./docs/comparison.md) | API examples and benchmark limitations |
| [Configuration](./docs/configuration.md) | Logger options, custom levels, and colors |
| [API Reference](./docs/api-reference.md) | Logger class and utilities |
| [Transports](./docs/transports.md) | Console, File, HTTP, Syslog, WebSocket, Elasticsearch, CircuitBreaker, DeadLetterQueue |
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
