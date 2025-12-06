# zario

A minimal, fast logging library for Node.js with TypeScript support.

## Installation

```bash
npm install zario
```

## Quick Start

```js
import { Logger, ConsoleTransport } from "zario";

const logger = new Logger({
  level: "info",
  colorize: true,
  transports: [new ConsoleTransport()],
  prefix: "[MyApp]",
});

// Start logging
logger.info("🚀 Server started on port 3000");
logger.warn("⚠️ High memory usage detected");
logger.error("❌ Database connection failed", { code: 500 });
```

## API Documentation

### Logger Constructor Options

| Option         | Type     | Description             |
| -------------- | -------- | ----------------------- |
| **level**      | `string` | Log level threshold     |
| **json**       | `boolean`| Output in JSON format   |
| **timestamp**  | `boolean`| Include timestamps      |
| **prefix**     | `string` | Prepended label         |
| **transports** | `array`  | Where logs are written (with transport-specific options like `path`, `maxSize`, `maxFiles` for file transport) |
| **customLevels** | `object` | Define custom log levels and their priorities |
| **customColors** | `object` | Assign colors to custom log levels |

### Log Levels

| Level    | Method        | Use Case                   |
|----------|---------------|----------------------------|
| 🔍 DEBUG  | `logger.debug()` | Detailed debugging info    |
| ✨ INFO   | `logger.info()`  | General information       |
| ⚠️ WARN   | `logger.warn()`  | Warning messages          |
| ❌ ERROR  | `logger.error()` | Error messages            |
| 🤫 SILENT | `logger.silent()`| Not output to console     |
| 📝 BORING | `logger.boring()`| Lowest priority messages  |

### Transports

#### Console Transport
```js
import { Logger, ConsoleTransport } from "zario";

const logger = new Logger({
  transports: [
    new ConsoleTransport({ colorize: true })
  ]
});
```

#### File Transport
```js
import { Logger, FileTransport } from "zario";

const logger = new Logger({
  transports: [
    new FileTransport({
      path: './logs/app.log',
      maxSize: 10485760, // 10MB in bytes
      maxFiles: 5
    })
  ]
});
```

#### HTTP Transport
```js
import { Logger, HttpTransport } from "zario";

const logger = new Logger({
  transports: [
    new HttpTransport({
      url: 'https://api.example.com/logs',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer your-token-here'
      },
      timeout: 10000,  // Request timeout in ms
      retries: 3       // Number of retry attempts
    })
  ]
});
```

### Methods

- `logger.debug(message, metadata?)` - Debug level logging
- `logger.info(message, metadata?)` - Info level logging  
- `logger.warn(message, metadata?)` - Warning level logging
- `logger.error(message, metadata?)` - Error level logging
- `logger.createChild(options)` - Creates a child logger with inherited settings
- `logger.setLevel(level)` - Change the logger level at runtime
- `logger.setFormat(format)` - Set the output format to text or json

## Usage Examples

### Basic Usage
```js
import { Logger, ConsoleTransport } from "zario";

const logger = new Logger({
  level: "info",
  colorize: true,
  transports: [new ConsoleTransport()]
});

logger.info("Application started");
logger.error("Something went wrong", { userId: 123 });
```

### JSON Format
```js
const logger = new Logger({ json: true });
```

### Custom Levels & Colors
```js
import { Logger, ConsoleTransport } from "zario";

const logger = new Logger({
  level: 'info',
  customLevels: {
    'success': 6,      // Higher priority than error (5).
    'verbose': 1,      // Lower priority than debug (2).
    'critical': 7,     // Highest priority.
  },
  customColors: {
    'success': 'green',
    'verbose': 'cyan',
    'critical': 'brightRed',
  },
  transports: [
    new ConsoleTransport()
  ]
});

// Using custom levels.
logger.logWithLevel('success', 'This is a success message in green!');
logger.logWithLevel('verbose', 'This is a verbose message in cyan');
logger.logWithLevel('critical', 'This is a critical message in bright red');
```

### Child Loggers
```js
const main = new Logger({ prefix: "[APP]" });
const db = main.createChild({ prefix: "[DB]" });

main.info("App initialized");
db.error("Connection timeout");
```

### Multiple Transports
```js
import { Logger, ConsoleTransport, FileTransport } from "zario";

const logger = new Logger({
  level: 'info',
  transports: [
    new ConsoleTransport(),
    new FileTransport({ path: './logs/app.log' })
  ]
});
```
