# Transports

Transports are the output destinations for log messages. Zario provides several built-in transports that can be used individually or combined for flexible logging strategies.

## Overview

Each transport implements the `Transport` interface and can be configured independently. Transports handle:

- **Synchronous vs Asynchronous**: Some transports support both `write()` and `writeAsync()` methods
- **Error Handling**: Built-in retry mechanisms and failure recovery
- **Performance**: Optimized for high-throughput scenarios
- **Resource Management**: Proper cleanup and memory management

## Available Transports

### Console Transport

Outputs log messages to the console with optional colorization and formatting.

#### Basic Usage

```typescript
import { Logger, ConsoleTransport } from "zario";

const logger = new Logger({
  level: "info",
  transports: [new ConsoleTransport()],
  colorize: true
});
```

#### Configuration Options

| Option | Type | Default | Description |
|--------|--------|----------|-------------|
| `colorize` | `boolean` | `true` | Enable colored output |
| `json` | `boolean` | `false` | Output JSON instead of formatted text |

---

### File Transport

Writes log messages to files with automatic rotation and compression support.

#### Basic Usage

```typescript
import { Logger, FileTransport } from "zario";

const logger = new Logger({
  transports: [new FileTransport({
    path: "./logs/app.log",
    maxSize: 10485760, // 10MB
    maxFiles: 5,
    compression: "gzip"
  })]
});
```

#### Configuration Options

| Option | Type | Default | Description |
|--------|--------|----------|-------------|
| `path` | `string` | `"./logs/app.log"` | Log file path |
| `maxSize` | `number` | `10485760` | Max file size before rotation (bytes) |
| `maxFiles` | `number` | `5` | Number of rotated files to keep |
| `compression` | `string` | `undefined` | Compression type (`"gzip"`, `"deflate"`) |
| `batchInterval` | `number` | `1000` | Batch write interval for performance |

---

### HTTP Transport

Sends log messages to remote HTTP endpoints with retry logic and timeout support.

#### Basic Usage

```typescript
import { Logger, HttpTransport } from "zario";

const logger = new Logger({
  transports: [new HttpTransport({
    url: "https://api.example.com/logs",
    method: "POST",
    headers: {
      "Authorization": "Bearer your-token",
      "Content-Type": "application/json"
    },
    timeout: 5000,
    retries: 3
  })]
});
```

#### Configuration Options

| Option | Type | Default | Description |
|--------|--------|----------|-------------|
| `url` | `string` | Required | HTTP endpoint URL |
| `method` | `string` | `"POST"` | HTTP method |
| `headers` | `object` | `{}` | Request headers |
| `timeout` | `number` | `5000` | Request timeout (ms) |
| `retries` | `number` | `3` | Number of retry attempts |

---

### Retry Transport

Adds automatic retry logic with exponential backoff to any transport. Useful for unreliable networks or external services.

#### Basic Usage

```typescript
import { Logger, RetryTransport, HttpTransport } from "zario";

const httpTransport = new HttpTransport({
  url: "https://api.example.com/logs"
});

const retryTransport = new RetryTransport({
  wrappedTransport: httpTransport,
  maxAttempts: 3,
  baseDelay: 1000,
  backoffMultiplier: 2,
  jitter: true,
  onRetryAttempt: (attempt, error, delay) => {
    console.log(`Retry ${attempt}: ${error.message}`);
  }
});
```

#### Configuration Options

| Option | Type | Default | Description |
|--------|--------|----------|-------------|
| `wrappedTransport` | `Transport` | Required | Transport to wrap with retry logic |
| `maxAttempts` | `number` | `3` | Maximum retry attempts |
| `baseDelay` | `number` | `1000` | Initial delay between retries (ms) |
| `backoffMultiplier` | `number` | `2` | Multiplier for exponential backoff |
| `jitter` | `boolean` | `true` | Add random jitter to retry delays |
| `retryableErrorCodes` | `string[]` | `['ECONNREFUSED', 'ETIMEDOUT']` | Error codes to retry |

---

### Circuit Breaker Transport

Prevents cascade failures by automatically tripping when a wrapped transport fails repeatedly. Implements standard circuit breaker pattern with three states.

#### Circuit Breaker States

- **CLOSED**: Normal operation, requests pass through to wrapped transport
- **OPEN**: Circuit breaker tripped, all requests fail fast
- **HALF_OPEN**: Transitional/testing state where the circuit allows limited requests to probe recovery

#### Basic Usage

```typescript
import { Logger, CircuitBreakerTransport, HttpTransport } from "zario";

const httpTransport = new HttpTransport({
  url: "https://api.example.com/logs"
});

const circuitBreakerTransport = new CircuitBreakerTransport(httpTransport, {
  threshold: 5,           // Trip after 5 failures
  timeout: 60000,         // Wait 1 minute before retry
  resetTimeout: 300000,    // Auto-reset after 5 minutes
  onStateChange: (from, to) => {
    console.warn(`Circuit breaker: ${from} → ${to}`);
  },
  onTrip: (failureCount) => {
    console.error(`Circuit tripped after ${failureCount} failures`);
  },
  onReset: () => {
    console.info('Circuit breaker reset - service recovered');
  }
});
```

#### Configuration Options

| Option | Type | Default | Description |
|--------|--------|----------|-------------|
| `threshold` | `number` | `5` | Failure count before tripping |
| `timeout` | `number` | `60000` | MS to wait in half-open state |
| `resetTimeout` | `number` | `undefined` | Auto-reset timer (ms) |
| `onStateChange` | `function` | `undefined` | State change callback |
| `onTrip` | `function` | `undefined` | Trip callback |
| `onReset` | `function` | `undefined` | Reset callback |

---

### Dead Letter Queue

Captures failed log writes when all retry attempts are exhausted. Supports writing failed logs to files for later analysis.

#### Basic Usage

```typescript
import { Logger, DeadLetterQueue, HttpTransport } from "zario";

const failingTransport = new HttpTransport({
  url: "https://unreliable-api.example.com/logs"
});

const deadLetterQueue = new DeadLetterQueue({
  transport: failingTransport,
  maxRetries: 3,
  retryableErrorCodes: ['ECONNREFUSED', 'ETIMEDOUT', 'ECONNRESET'],
  deadLetterFile: './logs/dead-letters.jsonl',
  onDeadLetter: (deadLetter) => {
    console.error('Log lost to dead letter queue:', deadLetter);
  }
});

const logger = new Logger({
  transports: [deadLetterQueue]
});
```

#### Configuration Options

| Option | Type | Default | Description |
|--------|--------|----------|-------------|
| `transport` | `Transport` | Required | Transport to wrap with DLQ logic |
| `maxRetries` | `number` | `3` | Maximum retry attempts |
| `retryableErrorCodes` | `string[]` | Common network error codes |  
| `deadLetterFile` | `string` | `undefined` | File path for dead letters |
| `onDeadLetter` | `function` | `undefined` | Dead letter callback |

---

## Transport Composition

You can combine multiple transports for resilient logging strategies:

```typescript
import { Logger, HttpTransport, DeadLetterQueue, CircuitBreakerTransport, FileTransport } from "zario";

const primaryTransport = new CircuitBreakerTransport(
  new HttpTransport({
    url: "https://logs.example.com",
    timeout: 5000,
    retries: 2
  }),
  {
    threshold: 3,
    timeout: 30000
  }
);

const fallbackTransport = new DeadLetterQueue(
  new FileTransport({
    path: "./logs/fallback.log"
  }),
  {
    maxRetries: 2,
    deadLetterFile: "./logs/dead-letters.jsonl"
  }
);

const logger = new Logger({
  level: "info",
  transports: [primaryTransport, fallbackTransport]
});
```

## Performance Considerations

- **Async Mode**: Enable `async: true` in logger options for non-blocking writes
- **Batching**: File and HTTP transports support batching for high throughput
- **Memory Management**: All transports implement bounded queues to prevent memory leaks
- **Error Recovery**: Built-in retry and dead letter queue mechanisms

## Best Practices

1. **Use Circuit Breakers** with external services to prevent cascade failures
2. **Implement Dead Letter Queues** for critical logs that shouldn't be lost
3. **Enable File Rotation** in production to manage disk space
4. **Monitor Transport Health** using the built-in metrics and callbacks
5. **Use Appropriate Transports** for your deployment environment

## Related Documentation

- [API Reference](./api-reference.md)
- [Configuration Guide](./configuration.md)
- [Advanced Usage](./advanced-usage.md)