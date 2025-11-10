# API Reference

This section provides a detailed reference for the `teeny-logger` API.

## Logger Class

The `Logger` class is the main entry point for all logging functionality.

### `new Logger(options?: LoggerOptions)`

Creates a new logger instance.

**Parameters:**

- `options` (`LoggerOptions`, optional): Configuration options for the logger.

  - `level` (`LogLevel`, default: `'info'`): The minimum log level to output.
  - `colorize` (`boolean`, default: `true`): Whether to colorize the console output.
  - `json` (`boolean`, default: `false`): Whether to format logs as JSON.
  - `transports` (`TransportOptions[]`, default: `[{ type: 'console' }]`): An array of transports to use.
  - `timestampFormat` (`string`, default: `'YYYY-MM-DD HH:mm:ss'`): The format for timestamps.

### `Logger.global`

A static property that provides a global logger instance. This is useful for quick setups or for logging from different parts of your application without passing the logger instance around.

```typescript
import { Logger } from 'teeny-logger';

Logger.global.info('This is a global log message.');
```

### Methods

#### `debug(message: string, metadata?: Record<string, any>)`

Logs a message with the `debug` level.

#### `info(message: string, metadata?: Record<string, any>)`

Logs a message with the `info` level.

#### `warn(message: string, metadata?: Record<string, any>)`

Logs a message with the `warn` level.

#### `error(message: string, metadata?: Record<string, any>)`

Logs a message with the `error` level.

#### `setLevel(level: LogLevel)`

Changes the minimum log level at runtime.

```typescript
logger.setLevel('debug');
```

#### `setFormat(format: 'text' | 'json')`

Switches between `'text'` and `'json'` formatting at runtime.

```typescript
logger.setFormat('json');
```

#### `addTransport(transport: Transport)`

Adds an additional transport to the logger at runtime.

```typescript
import { FileTransport } from 'teeny-logger';

logger.addTransport(new FileTransport({ path: './logs/another.log' }));
```

## LogLevel Type

The `LogLevel` type defines the different levels of logging available in `teeny-logger`.

- `'debug'`
- `'info'`
- `'warn'`
- `'error'`
