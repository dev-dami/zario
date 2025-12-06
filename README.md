<div align="center">

<a id="top"></a>

# 📝 Zario

### ⚡ The Ultimate Minimal Logging Solution for Node.js

[![npm version](https://img.shields.io/npm/v/zario?style=for-the-badge&logo=npm&color=CB3837)](https://www.npmjs.com/package/zario)
[![license](https://img.shields.io/npm/l/zario?style=for-the-badge&color=green)](./LICENSE)
[![downloads](https://img.shields.io/npm/dt/zario?style=for-the-badge&logo=npm&color=orange)](https://www.npmjs.com/package/zario)
[![bundle size](https://img.shields.io/bundlephobia/minzip/zario?style=for-the-badge&logo=webpack&color=purple)](https://bundlephobia.com/package/zario)

<br/>

**Fast** • **Lightweight** • **Zero Dependencies** • **TypeScript Native**

<br/>

[📖 Documentation](#-documentation) · [⚡ Quick Start](#-quick-start) · [✨ Features](#-features) · [💬 Community](#-community)

<br/>

![separator](https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/rainbow.png)

</div>

<br/>

## ✨ Highlights

*   ⚡ Super lightweight — minimal footprint, fast execution
*   🎯 Simple API — intuitive methods like `info()`, `warn()`, etc.
*   🎨 Custom formatting — plain text or JSON
*   ⏱️ Automatic timestamps
*   📁 Multiple transports
*   🧩 Child loggers for modular logging
*   🧵 Async writes — keeps Node responsive
*   🔒 Small, safe, dependency-light design
*   🌈 Custom log levels with color support

## 📦 Installation

```bash
npm install zario
```

<details>
<summary>📋 Other Package Managers</summary>

```bash
# Using Yarn
yarn add zario

# Using pnpm
pnpm add zario

# Using bun
bun add zario
```
</details>

### 🚀 Quick Start

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

Output:

```css
[MyApp] INFO  🚀 Server started on port 3000
[MyApp] WARN  ⚠️ High memory usage detected
[MyApp] ERROR ❌ Database connection failed { code: 500 }
```

### 📝 Log Levels

<table>
<thead>
<tr>
<th>Level</th>
<th>Method</th>
<th>Use Case</th>
<th>Example</th>
</tr>
</thead>
<tbody>
<tr>
<td>🔍 <strong>DEBUG</strong></td>
<td><code>logger.debug()</code></td>
<td>Detailed debugging info</td>
<td>Variable values, function calls</td>
</tr>
<tr>
<td>ℹ️ <strong>INFO</strong></td>
<td><code>logger.info()</code></td>
<td>General information</td>
<td>Server started, user logged in</td>
</tr>
<tr>
<td>⚠️ <strong>WARN</strong></td>
<td><code>logger.warn()</code></td>
<td>Warning messages</td>
<td>Deprecated API usage, high load</td>
</tr>
<tr>
<td>❌ <strong>ERROR</strong></td>
<td><code>logger.error()</code></td>
<td>Error conditions</td>
<td>Failed requests, exceptions</td>
</tr>
<tr>
<td>💀 <strong>FATAL</strong></td>
<td><code>logger.fatal()</code></td>
<td>Critical failures</td>
<td>System crash, data corruption</td>
</tr>
</tbody>
</table>

Example:

```js
logger.debug("Debugging user authentication flow");
logger.info("User successfully authenticated");
logger.warn("Session about to expire");
logger.error("Failed to save user data");
logger.fatal("Database connection lost");
```

### 🌱 Child Loggers

Perfect when you want separate logs per module or request:

```js
const main = new Logger({ prefix: "[APP]" });
const db = main.createChild({ prefix: "[DB]" });

main.info("App initialized");
db.error("Connection timeout");
```

Output:

```css
[APP] [INFO] App initialized
[APP][DB] [ERROR] Connection timeout
```

### ⏱️ Performance Timer

Built-in timer utility for measuring execution time:

```js
const logger = new Logger({ prefix: "[PERFORMANCE]" });

// Create a timer
const timer = logger.startTimer("Database query");

// Simulate some work
await databaseQuery();

// End the timer - logs the duration automatically
timer.end(); // Output: [PERFORMANCE] [INFO] Database query took 150ms
```

The timer is idempotent - calling `end()` multiple times will only log the duration once.

### 🌍 Environment Detection & Auto-Config

Auto-configure based on NODE_ENV:

```js
// Development: colorized, debug level, console transport, sync mode
process.env.NODE_ENV = 'development';
const devLogger = new Logger();

// Production: JSON, warn level, file transport, async mode
process.env.NODE_ENV = 'production';
const prodLogger = new Logger();
```

Auto-configuration behavior:
- **Development**: `level: 'debug'`, `colorize: true`, `json: false`, `asyncMode: false`, `transports: [new ConsoleTransport()]`
- **Production**: `level: 'warn'`, `colorize: false`, `json: true`, `asyncMode: true`, `transports: [new ConsoleTransport(), new FileTransport({path: './logs/app.log'})]`

All settings can be overridden with explicit options.

<br/>

![separator](https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/rainbow.png)

<br/>

## ✨ Features

### 🎯 Core Features

<table>
<tr>
<td width="33%">

#### 🚀 High Performance

- **Async logging** for non-blocking I/O
- **Optimized** for high-throughput apps
- **Minimal overhead** in production
- **Fast JSON serialization**

</td>
<td width="33%">

#### 🎨 Developer Experience

- **Beautiful colorized output**
- **TypeScript definitions**
- **Intuitive API**
- **Easy configuration**

</td>
<td width="33%">

#### 🔧 Flexible Configuration

- **Multiple transports**
- **Custom formatters**
- **Log level filtering**
- **Metadata support**
- **Custom log levels and colors**

</td>
</tr>
</table>

<br/>

### 📊 Transport Options

<details>
<summary><strong>📺 Console Transport</strong></summary>

```javascript
const logger = new Logger({
  transports: [
    consoleT({ colorize: true })
  ]
});
```

Perfect for development and debugging.

</details>

<details>
<summary><strong>📁 File Transport</strong></summary>

```javascript
const logger = new Logger({
  transports: [
    fileT({
      path: './logs/app.log',
      maxSize: 10485760, // 10MB in bytes
      maxFiles: 5
    })
  ]
});
```

Ideal for production logging and auditing.

</details>

<details>
<summary><strong>🌐 HTTP Transport</strong></summary>

```javascript
const logger = new Logger({
  transports: [
    httpT({
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

Send logs to a remote HTTP endpoint with retry logic and timeout handling.

</details>

<details>
<summary><strong>🔌 Custom Transport</strong></summary>

```javascript
const logger = new Logger({
  transports: [{
    type: 'custom',
    instance: {
      write: (log, formatter) => {
        // Send to external service
        sendToDatadog(log);
      }
    }
  }]
});
```

Integrate with any logging service.

</details>

<br/>

### 🎭 Advanced Features

<table>
<tr>
<td>

**🏷️ Metadata Support**
```javascript
logger.info('User login', {
  userId: 12345,
  ip: '192.168.1.1',
  timestamp: new Date()
});
```

</td>
<td>

**🔍 Error Tracking**
```javascript
try {
  riskyOperation();
} catch (error) {
  logger.error('Operation failed', error);
}
```

</td>
</tr>
<tr>
<td>

**🎯 Prefix/Namespace**
```javascript
const logger = new Logger({
  prefix: '[MyService]'
});
```

</td>
<td>

**⚙️ Environment Aware**
```javascript
const logger = new Logger({
  level: process.env.LOG_LEVEL || 'info'
});
```

</td>
</tr>
</table>

<br/>

### 🎨 Advanced Usage: Custom Levels & Colors

<details>
<summary><strong>Define Custom Log Levels</strong></summary>

Create your own log levels with specific priorities and colors for more granular logging.

```typescript
import { Logger } from 'zario';

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

</details>

<details>
<summary><strong>Log Level Filtering</strong></summary>

Set the logger's `level` to a custom level to filter messages based on their priority.

```typescript
// Only logs levels with priority >= 7 (critical in this case).
const highLevelLogger = new Logger({
  level: 'critical', 
  customLevels: {
    'success': 6,
    'verbose': 1,
    'critical': 7,
  },
  transports: [
    new ConsoleTransport()
  ]
});

// This will NOT be shown (verbose has priority 1 < critical threshold 7).
highLevelLogger.logWithLevel('verbose', 'This will not appear');

// This WILL be shown (critical has priority 7 >= threshold 7).
highLevelLogger.logWithLevel('critical', 'This critical message appears');
```
</details>

<details>
<summary><strong>Child Logger with Custom Levels</strong></summary>

Child loggers inherit custom levels and colors from their parent, and can also have their own.

```typescript
const parentLogger = new Logger({
  level: 'info',
  customLevels: {
    'parent_custom': 6,
  },
  customColors: {
    'parent_custom': 'blue',
  },
  transports: [
    new ConsoleTransport()
  ]
});

// Child will inherit parent's custom levels and can add its own.
const childLogger = parentLogger.createChild({
  customLevels: {
    'child_custom': 7,  // Add child-specific level.
  },
  customColors: {
    'child_custom': 'red',
  }
});

childLogger.logWithLevel('parent_custom', 'Inherited from parent');
childLogger.logWithLevel('child_custom', 'Defined in child');
```
</details>

<br/>

![separator](https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/rainbow.png)

<br/>

## 💡 Use Cases

<table>
<tr>
<td width="50%">

### 🌐 Web Applications

```javascript
import express from 'express';
import Logger from 'zario';

const app = express();
const logger = new Logger({ prefix: '[API]' });

app.use((req, res, next) => {
  const reqLogger = logger.createChild({ prefix: `[${req.method} ${req.url}]` });
  reqLogger.info("Incoming request");
  next();
});

app.get("/", (req, res) => {
  res.send("Hello!");
});

app.listen(3000, () => {
  logger.info("API running on port 3000");
});
```

**Perfect for:**
- Express.js applications
- Fastify servers
- Koa.js projects
- REST APIs

</td>
<td width="50%">

### ⚡ Serverless Functions

```javascript
import Logger from 'zario';

const logger = new Logger({
  level: 'info',
  transports: [new ConsoleTransport()]
});

export async function handler(event) {
  logger.info('Lambda invoked', { 
    requestId: event.requestId 
  });
  
  try {
    const result = await processEvent(event);
    logger.info('Processing complete');
    return result;
  } catch (error) {
    logger.error('Processing failed', error);
    throw error;
  }
}
```

**Perfect for:**
- AWS Lambda
- Vercel Functions
- Netlify Functions
- Cloudflare Workers

</td>
</tr>
<tr>
<td width="50%">

### 🔧 CLI Applications

```javascript
import Logger from 'zario';

const logger = new Logger({
  colorize: true,
  prefix: '[CLI]'
});

async function buildProject() {
  logger.info('Starting build process...');
  
  logger.debug('Reading config file');
  logger.info('Compiling TypeScript...');
  logger.info('Bundling assets...');
  
  logger.info('✅ Build completed successfully!');
}
```

**Perfect for:**
- Command-line tools
- Build scripts
- DevOps automation
- System utilities

</td>
<td width="50%">

### 🏗️ Microservices

```javascript
import Logger from 'zario';

// Create service-specific loggers
const userService = new Logger({
  prefix: '[UserService]'
});

const paymentService = new Logger({
  prefix: '[PaymentService]'
});

const orderService = new Logger({
  prefix: '[OrderService]'
});

// Use in distributed system
userService.info('User created', { id: 123 });
paymentService.info('Payment processed');
orderService.info('Order placed');
```

**Perfect for:**
- Distributed systems
- Message queues
- Event-driven architecture
- Container deployments

</td>
</tr>
</table>

<br/>

![separator](https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/rainbow.png)

<br/>

## 🧩 Log Formats

### Plain Text (default)
```pgsql
[2025-01-23 10:22:20] [INFO] User logged in
```
### JSON Format
```js
const logger = new Logger({ json: true });
```
Output:
```json
{
  "timestamp": "2025-01-23T10:22:20Z",
  "level": "info",
  "message": "User logged in"
}
```

<br/>

## 📐 Recommended Project Structure

```bash
/src
  /logs
  /modules
    database.js
    users.js
logger.js
server.js
```

### Example logger.js:
```js
import Logger from "zario";

export const logger = new Logger({
  prefix: "[API]",
  transports: [new ConsoleTransport()],
});
```

<br/>

## 🧪 Testing Example

```js
import Logger from "zario";

describe("Logger", () => {
  it("should log messages", () => {
    const logger = new Logger({ timestamp: false });
    logger.info("Testing logger");
  });
});
```

<br/>

## 📚 Full Options Reference

| Option         | Type     | Description             |
| -------------- | -------- | ----------------------- |
| **level**      | `string`   | Log level threshold     |
| **json**       | `boolean`  | Output in JSON format   |
| **timestamp**  | `boolean`  | Include timestamps      |
| **prefix**     | `string`   | Prepended label         |
| **transports** | `array`    | Where logs are written (with transport-specific options like `path`, `maxSize`, `maxFiles` for file transport) |
| **asyncMode**  | `boolean`  | Whether to enable asynchronous logging mode for better performance under heavy logging |
| **customLevels** | `object` | Define custom log levels and their priorities |
| **customColors** | `object` | Assign colors to custom log levels |
| **createChild()**    | `method`   | Creates a scoped logger |
| **setAsyncMode()**   | `method`   | Toggles asynchronous logging mode at runtime |
| **startTimer()**     | `method`   | Creates a timer to measure execution duration |

<br/>

![separator](https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/rainbow.png)

<br/>

## 📖 Documentation

<div align="center">

<table>
<thead>
<tr>
<th width="30%">📚 Resource</th>
<th width="50%">📝 Description</th>
<th width="20%">🔗 Link</th>
</tr>
</thead>
<tbody>
<tr>
<td><strong>📘 Usage Guide</strong></td>
<td>Complete guide with examples and best practices</td>
<td><a href="./docs/usage.md">Read →</a></td>
</tr>
<tr>
<td><strong>⚙️ Configuration</strong></td>
<td>All configuration options explained in detail</td>
<td><a href="./docs/configuration.md">Read →</a></td>
</tr>
<tr>
<td><strong>🎯 API Reference</strong></td>
<td>Full API documentation with type definitions</td>
<td><a href="./docs/api.md">Read →</a></td>
</tr>
<tr>
<td><strong>💼 Use Cases</strong></td>
<td>Real-world examples and implementation patterns</td>
<td><a href="./docs/use-cases.md">Read →</a></td>
</tr>
<tr>
<td><strong>🚀 Migration Guide</strong></td>
<td>Migrate from other logging libraries</td>
<td><a href="./docs/migration.md">Read →</a></td>
</tr>
<tr>
<td><strong>🔌 Custom Transports</strong></td>
<td>Build your own transport implementations</td>
<td><a href="./docs/transports.md">Read →</a></td>
</tr>
</tbody>
</table>

</div>

<br/>

![separator](https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/rainbow.png)

<br/>

## 🗺️ Roadmap

<table>
<tr>
<td width="33%">

### 🎯 Coming Soon

- [x] ✅ Console & File transports
- [x] ✅ Child loggers
- [x] ✅ TypeScript support
- [x] ✅ Log rotation
- [x] ✅ HTTP transport
- [ ] 🔄 Syslog support

</td>
<td width="33%">

### 🚀 Future Plans

- [ ] 📊 Performance metrics
- [ ] 🔍 Advanced filtering
- [ ] 📱 React Native support
- [x] 🌈 Custom themes
- [ ] 🔐 Log encryption
- [ ] 📈 Analytics dashboard

</td>
<td width="33%">

### 💡 Under Consideration

- [ ] WebSocket transport
- [ ] MongoDB transport
- [ ] Redis transport
- [ ] Elasticsearch integration
- [ ] Structured logging
- [ ] Log aggregation

</td>
</tr>
</table>

> 🗳️ **Vote for features:** Have a feature request? [Open an issue](../../issues/new) and let us know!

<br/>

![separator](https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/rainbow.png)

<br/>

## 🤝 Contributing

We ❤️ contributions! Whether it's bug reports, feature requests, or code contributions.

<table>
<tr>
<td width="25%" align="center">
<strong>🐛 Report Bugs</strong><br/>
<sub>Found a bug?</sub><br/>
<a href="../../issues/new">Report it →</a>
</td>
<td width="25%" align="center">
<strong>💡 Request Features</strong><br/>
<sub>Have an idea?</sub><br/>
<a href="../../issues/new">Suggest it →</a>
</td>
<td width="25%" align="center">
<strong>📖 Improve Docs</strong><br/>
<sub>Fix a typo?</sub><br/>
<a href="../../pulls">Submit PR →</a>
</td>
<td width="25%" align="center">
<strong>💬 Join Discussion</strong><br/>
<sub>Questions?</sub><br/>
<a href="../../discussions">Discuss →</a>
</td>
</tr>
</table>

### 🛠️ Development Setup

Follow these steps if you want to work on the project locally:

```bash
# Clone the repository
git clone https://github.com/Dev-Dami/zario.git

# Navigate into the project
cd zario

# Install dependencies
npm install

# Run tests
npm test

# Build the project
npm run build
```

<br/>

## 💬 Community

<div align="center">

[![GitHub Stars](https://img.shields.io/github/stars/Dev-Dami/zario?style=social)](../../stargazers)
[![GitHub Forks](https://img.shields.io/github/forks/Dev-Dami/zario?style=social)](../../network/members)
[![GitHub Issues](https://img.shields.io/github/issues/Dev-Dami/zario?style=social)](../../issues)

**Join our growing community!**

[💬 Discussions](../../discussions) • [🐛 Issues](../../issues) • [📢 Changelog](./CHANGELOG.md)

</div>

<br/>

![separator](https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/rainbow.png)

<br/>

## 📄 License

This project is licensed under the **MIT License** - see the [LICENSE](./LICENSE) file for full details.

```text
MIT License - feel free to use this in your projects!
```

### Made with ❤️ by developers, for developers

<br/>

## 🌟 Show Your Support

If **Zario** made your logging easier, consider:

<div align="center">

⭐ **Star this repository** to show your support

🐦 **Share on Twitter** to spread the word

☕ **Buy us a coffee** to fuel development

[![Star History Chart](https://api.star-history.com/svg?repos=Dev-Dami/zario&type=Date)](https://star-history.com/#Dev-Dami/zario&Date)

</div>

<br/>

[⬆ Back to Top](#top)
