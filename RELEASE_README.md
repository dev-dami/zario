# Zario

### ⚡ The Ultimate Minimal Logging Solution for Node.js

Zario is a fast, lightweight, zero-dependency, and TypeScript-native logging library for Node.js. It's designed to be simple enough for small scripts but powerful enough for complex microservices.

## ✨ Key Features
- **Super lightweight**: Minimal footprint, fast execution.
- **Pluggable Transports**: Console, File (with rotation/compression), and HTTP.
- **Structured Logging**: Automatic JSON formatting with metadata enrichment.
- **Advanced Filtering**: Fine-grained control over log output.
- **Child Loggers**: Hierarchical context for modular applications.
- **Performance Timer**: Built-in utility for measuring execution time.

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

## 📖 API at a Glance

### Logger Options
| Option | Description |
|--------|-------------|
| `level` | Minimum log level threshold. |
| `json` | Toggle JSON vs. Plain Text. |
| `transports`| Array of destinations (Console, File, Http). |
| `prefix` | Prepended label for all logs. |
| `asyncMode` | Enable non-blocking logging. |

### Main Methods
- `logger.info(msg, meta?)`, `logger.error(msg, meta?)`, etc.
- `logger.createChild(options)` - Inherit and extend logger.
- `logger.startTimer(name)` - Measure execution duration.
- `logger.addFilter(filter)` / `logger.addEnricher(enricher)` - Extend capabilities.

## 📁 Transports

### File Transport
```typescript
new FileTransport({
  path: './logs/app.log',
  maxSize: 10485760, // 10MB
  maxFiles: 5,
  compression: 'gzip'
})
```

### HTTP Transport
```typescript
new HttpTransport({
  url: 'https://api.example.com/logs',
  headers: { 'Authorization': 'Bearer <token>' }
})
```

## 📖 Full Documentation
For detailed guides on configuration, advanced filtering, and structured logging, visit our [GitHub Repository](https://github.com/Dev-Dami/zario#readme).

## 📄 License
MIT
