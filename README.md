<div align="center">

<a id="top"></a>

# Zario

### Fast and simple logging library for TypeScript

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

- [zario-express](https://github.com/dev-dami/zario-express) — Express logging middleware.
- [nestjs-zario](https://github.com/dev-dami/nestjs-zario) — NestJS custom logger service.
- [fastify-zario](https://github.com/dev-dami/fastify-zario) — Fastify custom logger wrapper.

## Comparison with Winston and Pino

To ensure a fair and objective evaluation, we benchmarked Zario against Winston and Pino under identical conditions:
1. **Bundle Size**: Measured using `esbuild` to bundle and minify a minimal setup importing each package and performing a single logging operation.
2. **Performance**: Measured by logging 100,000 iterations to a shared Node.js `Writable` null stream (to isolate formatting and framework overhead from system I/O latency).

### Factual Comparison

| Metric / Feature | Zario (Lean) | Zario (Full) | Pino | Winston |
| :--- | :---: | :---: | :---: | :---: |
| **Bundle Size (Minified)** | 11.80 KB | 24.72 KB | 60.65 KB | 143.92 KB |
| **Speed (Simple Log)** | 586k ops/sec | 586k ops/sec | 942k ops/sec | 177k ops/sec |
| **Speed (With Metadata)** | 391k ops/sec | 391k ops/sec | 839k ops/sec | 110k ops/sec |
| **Runtime Dependencies** | 0 | 0 | 8+ | 10+ |
| **Resilience Transports** | Built-in (via setup) | Built-in (out-of-the-box) | Needs custom streams | Needs custom transports |
| **Tree-shakeability** | Yes | Yes | No | No |

## Installation

```bash
npm install zario
```

## Quick Start

```typescript
import { Logger, ConsoleTransport } from "zario";

const logger = new Logger({
  level: "info",
  colorize: true,
  transports: [new ConsoleTransport()],
  prefix: "[MyApp]",
});

logger.info("Server started on port 3000");
logger.warn("High memory usage detected");
logger.error("Database connection failed", { code: 500 });
```

### Child Logger

```ts
const requestLogger = logger.createChild({
  context: { scope: "request" },
});
requestLogger.info("Incoming request");
```

### JSON Logging

```ts
import { Logger, ConsoleTransport } from "zario";

const jsonLogger = new Logger({
  json: true,
  transports: [new ConsoleTransport()],
});
```

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
import { Logger } from "zario/logger";
```

## Documentation

| Section | Description |
|---|---|
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
