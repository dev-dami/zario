# API Reference

This page provides a detailed reference for the core classes and methods in Zario.

## `Logger` Class

The primary class for creating loggers.

### Constructor
`new Logger(options?: LoggerOptions)`

### Logging Methods
All logging methods accept a `message` string and an optional `metadata` object.

- `debug(message, metadata?)`
- `info(message, metadata?)`
- `warn(message, metadata?)`
- `error(message, metadata?)`
- `fatal(message, metadata?)`
- `boring(message, metadata?)`
- `silent(message, metadata?)`
- `logWithLevel(level: string, message: string, metadata?: object)`: Log using a custom level name.

### Instance Methods

#### `createChild(options: LoggerOptions): Logger`
Creates a new logger instance that inherits the configuration of the current logger. The new options are merged with the parent's.
- **Prefixes** are appended (e.g., `[Parent][Child]`).
- **Context** is merged.
- **Transports**, **Filters**, and **Enrichers** are inherited.

#### `startTimer(name: string): Timer`
Starts a performance timer. Returns a `Timer` object.
- `timer.end()`: Ends the timer and logs the duration (e.g., `Database query took 150ms`).

#### `addFilter(filter: Filter)` / `removeFilter(filter: Filter)`
Dynamically adds or removes a filter from the logger.

#### `addAggregator(aggregator: LogAggregator)` / `removeAggregator(aggregator: LogAggregator)`
Dynamically adds or removes an aggregator.

#### `addEnricher(enricher: LogEnricher)`
Adds an enrichment function or object to the structured logging pipeline.

#### `setAsyncMode(enabled: boolean)`
Toggles asynchronous logging mode at runtime.

#### `flushAggregators(): Promise<void>`
Manually flushes all registered aggregators. Useful before application shutdown.

---

## `Timer` Object

Returned by `logger.startTimer()`.

- `end()`: Calculates elapsed time since `startTimer` was called and logs it using `logger.info()`. It is idempotent; subsequent calls do nothing.

---

## Constants & Types

### `LogLevel`
An union type of built-in levels: `'silent' | 'boring' | 'debug' | 'info' | 'warn' | 'error' | 'fatal'`.

### `Transport`
Interface for log transports. See [Transports](./transports.md) for implementations.

### `Filter`
Interface for log filters. See [Advanced Usage](./advanced-usage.md) for details.

---

[← Configuration](./configuration.md) | [Transports →](./transports.md)
