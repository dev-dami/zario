# Getting Started with teeny-logger

This guide will walk you through the basics of using `teeny-logger` in your Node.js application.

## Installation

First, install the library using npm:

```bash
npm install teeny-logger
```

## Basic Usage

To start logging, you need to create an instance of the `Logger` class.

```typescript
import { Logger } from 'teeny-logger';

// Create a logger with default options
const logger = new Logger();

// Log messages
logger.info('Hello, world!');
logger.warn('This is a warning.');
logger.error('This is an error.');
```

By default, `teeny-logger` will log messages with a level of `info` or higher to the console.

## Configuration

You can customize the logger by passing a configuration object to the constructor.

```typescript
import { Logger } from 'teeny-logger';

const logger = new Logger({
  level: 'debug', // Log all messages from debug level and above
  colorize: true, // Colorize console output
  json: false, // Log in plain text format
  transports: [
    { type: 'console' },
    { type: 'file', options: { path: './logs/app.log' } },
  ],
  timestampFormat: 'YYYY-MM-DD HH:mm:ss',
});
```

### Configuration Options

- `level` (`LogLevel`, default: `'info'`): The minimum log level to output. Possible values are `'debug'`, `'info'`, `'warn'`, and `'error'`.
- `colorize` (`boolean`, default: `true`): Whether to colorize the console output.
- `json` (`boolean`, default: `false`): Whether to format logs as JSON.
- `transports` (`TransportOptions[]`, default: `[{ type: 'console' }]`): An array of transports to use for logging.
- `timestampFormat` (`string`, default: `'YYYY-MM-DD HH:mm:ss'`): The format for timestamps in the log messages.

### Timestamp Format

The timestamp format supports the following placeholders:

- `YYYY`: 4-digit year
- `MM`: 2-digit month (01-12)
- `DD`: 2-digit day (01-31)
- `HH`: 2-digit hour (00-23)
- `mm`: 2-digit minute (00-59)
- `ss`: 2-digit second (00-59)
- `SSS`: 3-digit millisecond (000-999)
