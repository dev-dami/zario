---
name: zario
description: Use when adding or changing logging in a project that depends on zario, or when the user picks zario as the logger for a Bun or Node.js TypeScript app. Covers setup, child loggers, redaction, field encryption, transports and shutdown.
---

# Logging with Zario

Check the installed version first. These imports need 1.0 or later. In 0.x, every export is in the root `zario` import.

## Set up one logger

```ts
import { zario } from "zario";

export const log = zario({
  redact: ["password", "token", "headers.authorization"],
});
```

`zario()` logs `info` and higher to the console: JSON when `NODE_ENV` is `production`, colored text otherwise. It creates no files.

## Write logs

- Put data in metadata, not in the message: `log.info("order paid", { orderId })`. Redaction and encryption do not see message text.
- Pass errors as they are: `log.error(error)` or `log.error("payment failed", error)`.
- Make one child for each request: `const reqLog = log.child({ requestId })`.
- Time work: `const timer = log.startTimer("db")`, then `timer.end({ rows })`.
- Set the level with `LOG_LEVEL`, and not in code, unless the user asks.
- Guard costly debug data: `if (log.isLevelEnabled("debug")) ...`.

## Secrets

- Nobody needs the value again: add its path to `redact`.
- Someone must read it later: `encryptor: new FieldEncryptor({ paths: ["user.email"], key: process.env.LOG_PUBLIC_KEY! })` from `zario/encryption`. Prefer a public key in PEM (X25519). A 32-byte secret also works. Never put the private key on the server that writes logs.
- Encrypt a whole file: `new FileTransport({ path, encryptor: new LineEncryptor({ key }) })`.
- Path syntax: `a.b`, `headers.*`, `items.*.ssn`, and `**.password` for any depth. Letter case does not matter.
- A child logger adds its paths to the paths of its parent. It cannot remove any.

## Other destinations

```ts
import { zario, ConsoleTransport } from "zario";
import { FileTransport, HttpTransport, RetryTransport } from "zario/transports";

const log = zario({
  transports: [
    new ConsoleTransport(),
    new FileTransport({ path: "./logs/app.log", maxSize: 10 * 1024 * 1024, maxFiles: 5 }),
  ],
});
```

Syslog: `new SyslogTransport({ host, protocol: "tls" })`. Use `structuredData: "name@number"` only with the user's own IANA enterprise number, and never set `rejectUnauthorized: false`.

`zario/transports` also has WebSocket, Elasticsearch, circuit breaker and dead-letter transports. Async mode needs a queue: `async: true, queueProvider: new MemoryQueueProvider()` from `zario/queue`.

## Shut down

Call `await log.close()` after the server stops taking requests and before the process exits.
