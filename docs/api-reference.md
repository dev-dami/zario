# API Reference

This page provides a detailed reference for the core classes and methods in Zario.

## `Logger` Class

The primary class for creating loggers. Extends `EventEmitter` to provide error event notification for transport, aggregator, and enricher failures.

### Constructor
`new Logger(options?: LoggerOptions)`

### Events

#### `'error'`
Emitted when an error occurs in the logging pipeline (transports, aggregators, or enrichers).
- **Payload**: `{ type: string, error: Error }`
- **Types**: `'transport'`, `'aggregator'`, `'enricher'`


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

#### `FileTransportOptions`
- `path`: string - Target file path.
- `maxSize?`: number - Maximum file size before rotation.
- `maxFiles?`: number - Maximum number of rotated files to keep.
- `compression?`: `'gzip' | 'deflate' | 'none'` - Compression type.
- `compressOldFiles?`: boolean - Whether to compress old files.
- `batchInterval?`: number - Buffer writes in milliseconds (0 to disable).
- `maxQueueSize?`: number - Maximum number of items in the batch queue for memory safety. Default: `10000`.

#### `HttpTransportOptions`
- `url`: string - Remote endpoint.
- `method?`: string - HTTP method (default: `'POST'`).
- `headers?`: object - HTTP headers.
- `timeout?`: number - Request timeout in ms.
- `retries?`: number - Number of retries on failure.
- `forceAsync?`: boolean - Force asynchronous behavior even when calling synchronous `write()` method.

#### `CircuitBreakerTransportOptions`
- `threshold?`: number - Failure count before tripping circuit breaker (default: `5`).
- `timeout?`: number - Time in ms to wait in half-open state (default: `60000`).
- `resetTimeout?`: number - Auto-reset timer in ms.
- `onStateChange?`: function - Callback for state changes: `(fromState: string, toState: string) => void`.
- `onTrip?`: function - Callback when circuit trips: `(failureCount: number) => void`.
- `onReset?`: function - Callback when circuit resets: `() => void`.

#### `DeadLetterQueueOptions`
- `transport`: Transport - **Required**. Transport to wrap.
- `maxRetries?`: number - Maximum retry attempts (default: `3`).
- `retryableErrorCodes?`: string[] - Error codes worth retrying (default: network errors).
- `deadLetterFile?`: string - File path to store failed logs.
- `onDeadLetter?`: function - Callback for captured dead letters: `(deadLetter: DeadLetterLog) => void`.

#### `DeadLetterLog`
Extends `LogData` with additional dead letter metadata:
- `deadLetterReason`: string - Human-readable error message.
- `originalError?`: string - Error code from original failure.
- `retryCount`: number - Number of retry attempts made.
- `failedAt`: Date - When the log failed permanently.

### `Aggregators`
See [Advanced Usage](./advanced-usage.md) for aggregator details.

#### `BatchAggregator(maxSize, flushCallback, maxQueueSize?)`
- `maxSize`: number - Number of logs to collect before flushing.
- `flushCallback`: function - Callback to handle the batch of logs.
- `maxQueueSize?`: number - Maximum number of logs to keep in memory queue. Default: `10000`.

#### `TimeBasedAggregator(flushInterval, flushCallback, maxQueueSize?)`
- `flushInterval`: number - Time interval in ms between flushes.
- `flushCallback`: function - Callback to handle the batch of logs.
- `maxQueueSize?`: number - Maximum number of logs to keep in memory queue. Default: `10000`.


---

[← Configuration](./configuration.md) | [Transports →](./transports.md)
