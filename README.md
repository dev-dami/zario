<div align="center">

<a id="top"></a>

# 📝 Zario

### A Minimal Logging Solution for TypeScript

[![npm version](https://img.shields.io/npm/v/zario?style=for-the-badge&logo=npm&color=CB3837)](https://www.npmjs.com/package/zario)
[![license](https://img.shields.io/npm/l/zario?style=for-the-badge&color=green)](./LICENSE)
[![downloads](https://img.shields.io/npm/dt/zario?style=for-the-badge&logo=npm&color=orange)](https://www.npmjs.com/package/zario)
[![bundle size](https://img.shields.io/bundlephobia/minzip/zario?style=for-the-badge&logo=webpack&color=purple)](https://bundlephobia.com/package/zario)
![GitHub Workflow Status](https://img.shields.io/github/workflow/status/Dev-Dami/zario?label=build)](https://github.com/Dev-Dami/zario/actions)

**Built on January 8, 2026**

<br/>

**Fast** • **Lightweight** • **Zero Dependencies** • **TypeScript Native**

<br/>

[📖 Documentation](#-documentation) · [⚡ Quick Start](#-quick-start) · [✨ Features](#-features) · [🤝 Contributing](#-contributing)

<br/>

![separator](https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/rainbow.png)

</div>

<br/>

## Features

- **Lightweight** — minimal footprint, fast execution
- **Simple API** — intuitive methods like `info()`, `warn()`, `error()`
- **Flexible formatting** — plain text or structured JSON
- **Multiple transports** — Console, File (streaming rotation), HTTP (async retry), CircuitBreaker, and DeadLetterQueue
- **Child loggers** — scoped logging for modules or requests
- **Async mode** — non-blocking writes for high-performance applications
- **Memory safe** — bounded queues and memory-efficient streaming
- **Customizable** — custom log levels, colors, and filtering

## 📦 Installation

```bash
npm install zario
```

## 🚀 Quick Start

```typescript
import { Logger, ConsoleTransport } from "zario";

const logger = new Logger({
  level: "info",
  colorize: true,
  transports: [new ConsoleTransport()],
  prefix: "[MyApp]",
});

logger.info("🚀 Server started on port 3000");
logger.warn("⚠️ High memory usage detected");
logger.error("❌ Database connection failed", { code: 500 });
```

## 📖 Documentation

Documentation:

| Section                                             | Description                                                                   |
| --------------------------------------------------- | ----------------------------------------------------------------------------- |
| [📘 **Introduction**](./docs/introduction.md)       | Philosophy, core features, and common use cases.                              |
| [🚀 **Getting Started**](./docs/getting-started.md) | Detailed installation and environment auto-configuration.                     |
| [⚙️ **Configuration**](./docs/configuration.md)     | Full reference for all logger options, custom levels, and colors.             |
| [📖 **API Reference**](./docs/api-reference.md)     | Detailed API documentation for the Logger class and utilities.                |
| [📁 **Transports**](./docs/transports.md)           | Guide to Console, File, HTTP, CircuitBreaker, and DeadLetterQueue transports. |
| [🧩 **Advanced Usage**](./docs/advanced-usage.md)   | Filters, Enrichers (Structured Logging), and Aggregators.                     |
| [📊 **Log Formats**](./docs/log-formats.md)         | Specification for Text and JSON output formats.                               |
| [🗺️ **Roadmap**](./docs/roadmap.md)                 | Future plans and upcoming features.                                           |

## 🤝 Contributing

We welcome contributions! Whether it's bug reports, feature requests, or code contributions. Please see our [Contributing Guide](./CONTRIBUTING.md) for more details.

## 📄 License

This project is licensed under the **MIT License** - see the [LICENSE](./LICENSE) file for full details.

<br/>

<div align="center">

### Developed for developers

⭐ Star this repository to show your support

</div>

<br/>

[⬆ Back to Top](#top)
