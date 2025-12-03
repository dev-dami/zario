<div align="center">

<a id="top"></a>

# 📝 dd-tinylog

### ⚡ The Ultimate Minimal Logging Solution for Node.js

[![npm version](https://img.shields.io/npm/v/dd-tinylog?style=for-the-badge&logo=npm&color=CB3837)](https://www.npmjs.com/package/dd-tinylog)
[![license](https://img.shields.io/npm/l/dd-tinylog?style=for-the-badge&color=green)](./LICENSE)
[![downloads](https://img.shields.io/npm/dt/dd-tinylog?style=for-the-badge&logo=npm&color=orange)](https://www.npmjs.com/package/dd-tinylog)
[![bundle size](https://img.shields.io/bundlephobia/minzip/dd-tinylog?style=for-the-badge&logo=webpack&color=purple)](https://bundlephobia.com/package/dd-tinylog)

<br/>

**Fast** • **Lightweight** • **Zero Dependencies** • **TypeScript Native**

<br/>

[📖 Documentation](#-documentation) · [⚡ Quick Start](#-quick-start) · [✨ Features](#-features) · [💬 Community](#-community)

<br/>

![separator](https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/rainbow.png)

</div>

<br/>

## ✨ Highlights

⚡ Super lightweight — minimal footprint, fast execution

🎯 Simple API — intuitive methods like info(), warn(), etc.

🎨 Custom formatting — plain text or JSON

⏱️ Automatic timestamps

📁 Multiple transports

🧩 Child loggers for modular logging

🧵 Async writes — keeps Node responsive

🔒 Small, safe, dependency-light design

## 📦 Installation

```bash
npm install dd-tinylog
```

<details>
<summary>📋 Other Package Managers</summary>
```bash
# Using Yarn
yarn add dd-tinylog
# Using pnpm
pnpm add dd-tinylog
# Using bun
bun add dd-tinylog
```
</details>

### 🚀 Quick Start

```js
import Logger from "dd-tinylog";

const logger = new Logger({
  level: "info",
  colorize: true,
  transports: [{ type: "console" }],
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
}
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
const db = main.child({ prefix: "[DB]" });

main.info("App initialized");
db.error("Connection timeout");
```

Output:

```css
[APP] [INFO] App initialized
[APP][DB] [ERROR] Connection timeout
```

![separator](https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/rainbow.png)

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

</td>
</tr>
</table>

<br/>

## 📁 Transports

### Console Transport

```js
const logger = new Logger({
  transports: [
    {
      type: "console",
      colorize: true,
    },
  ],
});
```

<B>⭐⭐⭐ Perfect for development and debugging. ⭐⭐⭐</B>

### File Transport

```js
transports: [{ type: "file", path: "./logs/server.log" }];
```

- Creates the file automatically

- Appends logs asynchronously

- Avoids blocking the main thread

### Multiple Transports

```js
transports: [{ type: "console" }, { type: "file", path: "./logs/main.log" }];
```

### Custom Transport

```js
transports: [
  {
    type: "custom",
    write: (entry) => {
      sendToMonitoring(entry);
    },
  },
];
```

Use this for:
→ Slack alerts
→ Logstash ingestion
→ DB logging
→ External APIs

### 🎭 Advanced Features

<div align="center">
  <table>
  <tr>
  <td>

**🏷️ Metadata Support**

```javascript
logger.info("User login", {
  userId: 12345,
  ip: "192.168.1.1",
  timestamp: new Date(),
});
```

  </td>
  <td>

  **🔍 Error Tracking**

  ```javascript
  try {
    riskyOperation();
  } catch (error) {
    logger.error("Operation failed", error);
  }
  ```

  </td>
  </tr>
  <tr>
  <td>
  **🎯 Prefix/Namespace**

  ```javascript
  const logger = new Logger({
    prefix: "[MyService]",
  });
  ```
  </td>
  <td>

  **⚙️ Environment Aware**
  ```javascript
  const logger = new Logger({
    level: process.env.LOG_LEVEL || "info",
  });
  ```
  </td>
  </tr>
  </table>
</div>

![separator](https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/rainbow.png)

## 💡 Use Cases

<table>
<tr>
<td width="50%">

### 🌐 Web Applications

```javascript
import express from 'express';
import Logger from 'dd-tinylog';

const app = express();
const logger = new Logger({ prefix: '[API]' });

app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`);
  next();
});

app.listen(3000, () => {
  logger.info('Server started on port 3000');
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
import Logger from 'dd-tinylog';

const logger = new Logger({
  level: 'info',
  transports: [{ type: 'console' }]
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
import Logger from 'dd-tinylog';

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
import Logger from 'dd-tinylog';

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

[📖 Documentation](#-documentation) · [⚡ Quick Start](#-quick-start) · [✨ Features](#-features) · [💬 Community](#-community)

<br/>

![separator](https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/rainbow.png)

</div>

<br/>

## ✨ Highlights

⚡ Super lightweight — minimal footprint, fast execution

🎯 Simple API — intuitive methods like info(), warn(), etc.

🎨 Custom formatting — plain text or JSON

⏱️ Automatic timestamps

📁 Multiple transports

🧩 Child loggers for modular logging

🧵 Async writes — keeps Node responsive

🔒 Small, safe, dependency-light design

## 📦 Installation

```bash
npm install dd-tinylog
```
## 🧩 Log Formats

<details>
<summary>📋 Other Package Managers</summary>
```bash
# Using Yarn
yarn add dd-tinylog
# Using pnpm
pnpm add dd-tinylog
# Using bun
bun add dd-tinylog
```
</details>

<details>
<summary>📋 Other Package Managers</summary>

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
import Logger from "dd-tinylog";

export const logger = new Logger({
  prefix: "[API]",
  transports: [{ type: "console" }],
});
```

## 💼 Express.js Example
```js
import express from "express";
import Logger from "dd-tinylog";

const app = express();
const logger = new Logger({ prefix: "[API]" });

app.use((req, res, next) => {
  const reqLogger = logger.child({ prefix: `[${req.method} ${req.url}]` });
  reqLogger.info("Incoming request");
  next();
});
```

```
// Start logging
logger.info('🚀 Server started on port 3000');
logger.warn('⚠️ High memory usage detected');
logger.error('❌ Database connection failed', { code: 500 });
```

**Output:**
```
[MyApp] INFO  🚀 Server started on port 3000
[MyApp] WARN  ⚠️ High memory usage detected
[MyApp] ERROR ❌ Database connection failed { code: 500 }
```

<br/>

### 🎨 Log Levels

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

```javascript
logger.debug('Debugging user authentication flow');
logger.info('User successfully authenticated');
logger.warn('Session about to expire');
logger.error('Failed to save user data');
logger.fatal('Database connection lost');
```

<br/>

### 👶 Child Loggers

Create contextual loggers for different modules:

```javascript
const mainLogger = new Logger({ prefix: '[App]' });

// Create child loggers with context
const apiLogger = mainLogger.child({ module: 'API' });
const dbLogger = mainLogger.child({ module: 'Database' });
const authLogger = mainLogger.child({ module: 'Auth' });

apiLogger.info('Request received');     // [App] [API] Request received
dbLogger.info('Query executed');        // [App] [Database] Query executed
authLogger.info('User authenticated');  // [App] [Auth] User authenticated
```

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

</td>
</tr>
</table>

<br/>

### 📊 Transport Options

<details>
<summary><strong>📺 Console Transport</strong></summary>

```javascript
const logger = new Logger({
  transports: [{ 
    type: 'console',
    colorize: true 
  }]
});
```

Perfect for development and debugging.

</details>

<details>
<summary><strong>📁 File Transport</strong></summary>

```javascript
const logger = new Logger({
  transports: [{ 
    type: 'file',
    filename: 'app.log',
    maxSize: '10m',
    maxFiles: 5
  }]
});
```

Ideal for production logging and auditing.

</details>

<details>
<summary><strong>🔌 Custom Transport</strong></summary>

```javascript
const logger = new Logger({
  transports: [{
    type: 'custom',
    write: (log) => {
      // Send to external service
      sendToDatadog(log);
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

![separator](https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/rainbow.png)

<br/>

## 💡 Use Cases

<table>
<tr>
<td width="50%">

### 🌐 Web Applications

```javascript
import express from 'express';
import { Logger } from 'dd-tinylog';

const app = express();
const logger = new Logger({ prefix: '[API]' });

app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`);
  next();
});

app.listen(3000, () => {
  logger.info('Server started on port 3000');
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
import { Logger } from 'dd-tinylog';

const logger = new Logger({
  level: 'info',
  transports: [{ type: 'console' }]
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
import { Logger } from 'dd-tinylog';

const logger = new Logger({
  colorize: true,
  prefix: '[CLI]'
});
```
## 🧩 Log Formats

### Plain Text (default)
```pgsql
[2025-01-23 10:22:20] [INFO] User logged in
```
### JSON Format
```js
const logger = new Logger({ format: "json" });
```
Output:
```json
{
  "timestamp": "2025-01-23T10:22:20Z",
  "level": "info",
  "message": "User logged in"
}
```
```typescript
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
import { Logger } from 'dd-tinylog';

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
```

## 📚 Full Options Reference

| Option         | Type     | Description             |               |
| -------------- | -------- | ----------------------- | ------------- |
| **level**      | string   | Log level threshold     |               |
| **format**     | `"plain" | "json"`                 | Output format |
| **timestamp**  | boolean  | Include timestamps      |               |
| **prefix**     | string   | Prepended label         |               |
| **transports** | array    | Where logs are written  |               |
| **child()**    | method   | Creates a scoped logger |               |

![separator](https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/rainbow.png)

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

![separator](https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/rainbow.png)

## 🗺️ Roadmap

<table>
<tr>
<td width="33%">

### 🎯 Coming Soon

- [x] ✅ Console & File transports
- [x] ✅ Child loggers
- [x] ✅ TypeScript support
- [ ] 🔄 Log rotation
- [ ] 🔄 HTTP transport
- [ ] 🔄 Syslog support

</td>
<td width="33%">

### 🚀 Future Plans

- [ ] 📊 Performance metrics
- [ ] 🔍 Advanced filtering
- [ ] 📱 React Native support
- [ ] 🌈 Custom themes
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

## 🛠️ Development Setup
Follow these steps if you want to work on the project locally:

```bash
# Clone the repository
git clone https://github.com/Dev-Dami/dd-tinylog.git

# Navigate into the project
cd dd-tinylog

# Install dependencies
npm install

# Run tests (if available)
npm test

# Build the project
npm run build
```

## 💬 Community
<div align="center">

[![GitHub Stars](https://img.shields.io/github/stars/yourusername/dd-tinylog?style=social)](../../stargazers)
[![GitHub Forks](https://img.shields.io/github/forks/yourusername/dd-tinylog?style=social)](../../network/members)
[![GitHub Issues](https://img.shields.io/github/issues/yourusername/dd-tinylog?style=social)](../../issues)

**Join our growing community!**

[💬 Discussions](../../discussions) • [🐛 Issues](../../issues) • [📢 Changelog](./CHANGELOG.md)

</div>

![separator](https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/rainbow.png)

## 📄 License
This project is licensed under the **MIT License** - see the [LICENSE](./LICENSE) file for full details.

// Use in distributed system
userService.info('User created', { id: 123 });
paymentService.info('Payment processed');
orderService.info('Order placed');
```
MIT License - feel free to use this in your projects!
```

## 💬 Final Thoughts
<B>dd-tinylog</B> focuses on clarity, simplicity, and developer-friendliness.
It gives you the power of bigger loggers like Winston or Pino while keeping the API tiny and elegant.

If you're building small services, APIs, CLIs, or educational projects, this logger will feel right at home.

## 🌟 Show Your Support

If **dd-tinylog** focuses on clarity, simplicity, and developer-friendliness.
It gives you the power of bigger loggers like Winston or Pino while keeping the API tiny and elegant.

If you're building small services, APIs, CLIs, or educational projects, this logger will feel right at home, consider:

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
- [ ] 🔄 Log rotation
- [ ] 🔄 HTTP transport
- [ ] 🔄 Syslog support

</td>
<td width="33%">

### 🚀 Future Plans

- [ ] 📊 Performance metrics
- [ ] 🔍 Advanced filtering
- [ ] 📱 React Native support
- [ ] 🌈 Custom themes
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

### 📝 Development Setup

```bash
# Clone the repository
git clone https://github.com/yourusername/dd-tinylog.git

# Install dependencies
cd dd-tinylog
npm install

# Run tests
npm test

# Build the project
npm run build
```

<br/>

## 💬 Community

<div align="center">

[![GitHub Stars](https://img.shields.io/github/stars/yourusername/dd-tinylog?style=social)](../../stargazers)
[![GitHub Forks](https://img.shields.io/github/forks/yourusername/dd-tinylog?style=social)](../../network/members)
[![GitHub Issues](https://img.shields.io/github/issues/yourusername/dd-tinylog?style=social)](../../issues)

**Join our growing community!**

[💬 Discussions](../../discussions) • [🐛 Issues](../../issues) • [📢 Changelog](./CHANGELOG.md)

</div>

<br/>

![separator](https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/rainbow.png)

<br/>

## 📄 License

This project is licensed under the **MIT License** - see the [LICENSE](./LICENSE) file for full details.

```
MIT License - feel free to use this in your projects!
```

<br/>

## 🌟 Show Your Support

If **dd-tinylog** made your logging easier, consider:

<div align="center">

⭐ **Star this repository** to show your support

🐦 **Share on Twitter** to spread the word

☕ **Buy us a coffee** to fuel development

[![Star History Chart](https://api.star-history.com/svg?repos=yourusername/dd-tinylog&type=Date)](https://star-history.com/#yourusername/dd-tinylog&Date)

</div>

<br/>

app.get("/", (req, res) => {
  res.send("Hello!");
});

app.listen(3000, () => {
  logger.info("API running on port 3000");
});
```

## 🧪 Testing Example
```js
import Logger from "dd-tinylog";

describe("Logger", () => {
  it("should log messages", () => {
    const logger = new Logger({ timestamp: false });
    logger.info("Testing logger");
  });
});
```

## 📚 Full Options Reference

| Option         | Type     | Description             |               |
| -------------- | -------- | ----------------------- | ------------- |
| **level**      | string   | Log level threshold     |               |
| **format**     | `"plain" | "json"`                 | Output format |
| **timestamp**  | boolean  | Include timestamps      |               |
| **prefix**     | string   | Prepended label         |               |
| **transports** | array    | Where logs are written  |               |
| **child()**    | method   | Creates a scoped logger |               |

![separator](https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/rainbow.png)

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

![separator](https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/rainbow.png)

## 🗺️ Roadmap

<table>
<tr>
<td width="33%">

### 🎯 Coming Soon

- [x] ✅ Console & File transports
- [x] ✅ Child loggers
- [x] ✅ TypeScript support
- [ ] 🔄 Log rotation
- [ ] 🔄 HTTP transport
- [ ] 🔄 Syslog support

</td>
<td width="33%">

### 🚀 Future Plans

- [ ] 📊 Performance metrics
- [ ] 🔍 Advanced filtering
- [ ] 📱 React Native support
- [ ] 🌈 Custom themes
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

## 🛠️ Development Setup
Follow these steps if you want to work on the project locally:

```bash
# Clone the repository
git clone https://github.com/Dev-Dami/dd-tinylog.git

# Navigate into the project
cd dd-tinylog

# Install dependencies
npm install

# Run tests (if available)
npm test

# Build the project
npm run build
```

## 💬 Community
<div align="center">

[![GitHub Stars](https://img.shields.io/github/stars/yourusername/dd-tinylog?style=social)](../../stargazers)
[![GitHub Forks](https://img.shields.io/github/forks/yourusername/dd-tinylog?style=social)](../../network/members)
[![GitHub Issues](https://img.shields.io/github/issues/yourusername/dd-tinylog?style=social)](../../issues)

**Join our growing community!**

[💬 Discussions](../../discussions) • [🐛 Issues](../../issues) • [📢 Changelog](./CHANGELOG.md)

</div>

![separator](https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/rainbow.png)

## 📄 License
This project is licensed under the **MIT License** - see the [LICENSE](./LICENSE) file for full details.

```text
MIT License - feel free to use this in your projects!
```

### Made with ❤️ by developers, for developers

[⬆ Back to Top](#top)