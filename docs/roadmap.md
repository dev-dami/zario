# Roadmap

Zario is the small, zero-dependency logger for Bun and Node.js that keeps secrets
out of logs and proves that logs were not changed. Work that serves that goes first.

## Done for 1.0

- Small core about 5 kB min+gzip, with entry points for everything else, and a size budget in CI.
- JSON and readable text output, child loggers, timers, `LOG_LEVEL`, `await using`.
- Redaction that `toJSON()`, getters and cycles cannot get around, with `**` paths.
- Log calls that do not throw or lose the record because of their data.
- Encryption of fields and files as JWE, with a public key or a shared key.
- Syslog to RFC 5424, 3164, 5425, 5426 and 6587, over UDP, TCP and TLS.
- Tamper-evident files with a hash chain and checkpoints.
- File, HTTP, WebSocket and Elasticsearch transports, retries, circuit breaker and dead letters.

## Before the 1.0 release

These are release gates. 1.0 is not published until they pass.

- **Stress:** file rotation, queue pressure, destination outages and memory over hours.
- **Adapters:** Elysia, Express, Fastify and NestJS against the packed 1.0 package.
- **Real receivers in CI:** rsyslog, and a TLS syslog server.
- **Benchmarks:** run again on a quiet machine, and publish the method and raw output.
- **Security review** of the JWE, redaction and hash chain code by someone who did not write it.
- **API review:** names, defaults, and the breaking changes in the changelog.

## Next

| Item | Why |
|---|---|
| OpenTelemetry log export (OTLP over HTTP) | One transport reaches Grafana, Datadog, Honeycomb, Axiom and most others |
| Request context with no setup | Every request log gets its request id, without passing a logger around |
| `trace` level | People coming from Pino expect it |
| `zario` CLI: `pretty`, `verify`, `decrypt` | Readable logs in development, and checks without writing code |
| Signed checkpoints (Ed25519) | Checkpoints that can be stored anywhere, also in public |
| Hono and Next.js adapters | The most common TypeScript servers that have no adapter yet |
| Chained syslog | Integrity, and loss detection, for logs that leave the machine |

## Later

- Edge runtimes: Cloudflare Workers and Deno.
- Loki and Datadog transports, if OTLP export does not cover them.
- Query local log files.

## Not planned

- **Database transports** (MongoDB, Redis, PostgreSQL). A database is a poor log store, and OTLP reaches better ones.
- **React Native.** It needs a different design, and other loggers do it well.
- **A metrics dashboard.** Metrics belong in a metrics system.

## Feedback

Have a request or found a bug? [Open an issue](https://github.com/Dev-Dami/zario/issues).

---

[← Log Formats](./log-formats.md) | [Benchmarks →](./benchmarks.md)
