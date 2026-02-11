# Getting Started with Zario

This guide will help you set up and start using Zario in your Node.js application.

## Installation

Install Zario with Bun:

```bash
bun add zario
```

## Basic Usage

To start logging, create an instance of the `Logger` class.

```typescript
import { Logger, ConsoleTransport } from 'zario';

// Create a logger with custom options
const logger = new Logger({
  level: 'info',
  transports: [new ConsoleTransport()],
  prefix: '[APP]'
});

// Log messages at various levels
logger.debug('This is a debug message'); // Not shown if level is 'info'
logger.info('Application started');
logger.warn('Warning: Low disk space');
logger.error('Error: Connection failed');
logger.fatal('Fatal: System crash');
```

By default, Zario logs messages with a level of `info` or higher.

## Lean Logger Import (Smaller Bundles)

If your app only needs `Logger`, import from the slim entrypoint:

```typescript
import { Logger } from 'zario/logger';
```

This avoids loading the full root export surface in bundlers.

If you also use `retryOptions` with `zario/logger`, configure the retry factory once:

```typescript
import { Logger } from 'zario/logger';
import { RetryTransport } from 'zario/transports/RetryTransport';

Logger.retryTransportFactory = (options) => new RetryTransport(options);
```

## Environment Auto-Configuration

Zario can automatically configure itself based on the `NODE_ENV` environment variable. This simplifies setup between development and production environments.

### Development Mode
Enabled when `process.env.NODE_ENV` is set to `'development'` (or if not set).
- **Default Level**: `debug`
- **Formatting**: Plain text with colors (`colorize: true`, `json: false`)
- **Transports**: `ConsoleTransport`
- **Mode**: Synchronous (`asyncMode: false`)

### Production Mode
Enabled when `process.env.NODE_ENV` is set to `'production'`.
- **Default Level**: `warn`
- **Formatting**: Structured JSON (`colorize: false`, `json: true`)
- **Transports**: `ConsoleTransport` and `FileTransport` (defaulting to `./logs/app.log`)
- **Mode**: Asynchronous (`asyncMode: true`)

```javascript
// Automatically detects environment
const logger = new Logger();

// You can still override any setting
const logger = new Logger({
  level: 'info', // Force info level even in production
  asyncMode: false // Force synchronous logging
});
```

## Adding Context

You can add contextual metadata to your logs by passing an object as the second argument:

```javascript
logger.info('User logged in', { 
  userId: '123', 
  ip: '192.168.1.1' 
});
```

In JSON mode, these fields will be spread into the root of the JSON object.

---

[← Introduction](./introduction.md) | [Configuration →](./configuration.md)
