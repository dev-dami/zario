# zario

This guide will help you understand how to use `zario` in your Node.js application.

## Installation

First, install the library using npm:

```bash
npm install zario
```

## Basic Usage

To start logging, create an instance of the `Logger` class.

```typescript
import { Logger } from 'zario';

// Create a logger with default options
const logger = new Logger();

// Log messages
  logger.info('Hello, world!');
  logger.warn('This is a warning.');
  logger.error('This is an error.');
  logger.fatal('This is a critical error');
  logger.silent('This message will not be logged');
  logger.boring('This message will be logged but not colored');
```

By default, `zario` logs messages with a level of `info` or higher to the console.

## Configuration

You can customize the logger by passing a configuration object to the constructor.

```typescript
import { Logger } from 'zario';

const logger = new Logger({
  level: 'debug', // Log all messages from debug level and above
  colorize: true, // Colorize console output
  json: false, // Log in plain text format
  transports: [
    { type: 'console' },
    { type: 'file', options: { path: './logs/app.log' } },
  ],
  timestampFormat: 'YYYY-MM-DD HH:mm:ss',
  prefix: '[My-App]', // Add a custom prefix
  timestamp: true, // Enable timestamp
});
```

### Configuration Options

- `level` (`LogLevel`, default: `'info'`): The minimum log level to output. Possible values are `'silent'`, `'boring'`, `'debug'`, `'info'`, `'warn'`, `'error'`, and `'fatal'`.
- `colorize` (`boolean`, default: `true`): Whether to colorize the console output.
- `json` (`boolean`, default: `false`): Whether to format logs as JSON.
- `transports` (`TransportOptions[]`, default: `[]`): An array of transports to use for logging.
- `timestampFormat` (`string`, default: `'YYYY-MM-DD HH:mm:ss'`): The format for timestamps in the log messages.
- `prefix` (`string`, default: `''`): A prefix to add to all log messages.
- `timestamp` (`boolean`, default: `false`): Whether to include a timestamp in the log output.
- `asyncMode` (`boolean`, default: `false`): Whether to enable asynchronous logging mode for better performance under heavy logging.
- `customLevels` (`{ [level: string]: number }`, optional): Define custom log levels with their priorities. Higher priority values indicate more critical levels.
- `customColors` (`{ [level: string]: string }`, optional): Assign colors to custom log levels. Colors can be named colors or ANSI codes.
- `filters` (`Filter[]`, default: `[]`): An array of filters to apply before logging. Available filters include `LevelFilter`, `PrefixFilter`, `MetadataFilter`, `CompositeFilter`, `OrFilter`, `NotFilter`, `PredicateFilter`, and `FieldFilter`.
- `aggregators` (`LogAggregator[]`, default: `[]`): An array of log aggregators. Available aggregators include `BatchAggregator`, `TimeBasedAggregator`, and `CompositeAggregator`.
- `enrichers` (`LogEnrichmentPipeline`, optional): A pipeline for structured logging extensions that add metadata to log entries.

### Timestamp Format

The timestamp format supports the following placeholders:

- `YYYY`: 4-digit year
- `MM`: 2-digit month (01-12)
- `DD`: 2-digit day (01-31)
- `HH`: 2-digit hour (00-23)
- `mm`: 2-digit minute (00-59)
- `ss`: 2-digit second (00-59)
- `SSS`: 3-digit millisecond (000-999)
