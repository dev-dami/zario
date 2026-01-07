# Transports

Transports are destinations where your logs are sent. Zario comes with several built-in transports and supports custom implementations.

## Built-in Transports

### 1. `ConsoleTransport`
Sends logs to `process.stdout` (for non-errors) and `process.stderr` (for errors/fatal).

```typescript
import { ConsoleTransport } from 'zario';

const transport = new ConsoleTransport({
  colorize: true // Override logger colorize setting if needed
});
```

### 2. `FileTransport`
Writes logs to the local filesystem with support for rotation and compression. Uses Node.js streams for memory-efficient rotation.

```typescript
import { FileTransport } from 'zario';

const transport = new FileTransport({
  path: './logs/app.log',     // Target file path
  maxSize: 10 * 1024 * 1024,  // 10MB before rotation
  maxFiles: 5,                // Keep 5 rotated files
  compression: 'gzip',        // 'gzip', 'deflate', or 'none'
  compressOldFiles: true,     // Compress files during rotation
  batchInterval: 1000,        // Buffer writes every 1s (0 to disable)
  maxQueueSize: 10000         // Max items in memory queue (memory safety)
});
```

### 3. `HttpTransport`
Sends logs to a remote HTTP/HTTPS endpoint as JSON POST requests.

```typescript
import { HttpTransport } from 'zario';

const transport = new HttpTransport({
  url: 'https://logs.example.com/ingest',
  method: 'POST',
  headers: {
    'Authorization': 'Bearer <token>'
  },
  timeout: 5000,   // 5s timeout
  retries: 3,       // Exponential backoff retries
  forceAsync: true // Ensure network I/O doesn't block (setImmediate)
});
```

### 4. `RetryTransport`
A transport wrapper that adds retry logic with exponential backoff and circuit breaker patterns to any other transport.

```typescript
import { RetryTransport, HttpTransport } from 'zario';

const httpTransport = new HttpTransport({
  url: 'https://logs.example.com/ingest'
});

const retryTransport = new RetryTransport({
  wrappedTransport: httpTransport,
  maxAttempts: 5,                    // Maximum retry attempts
  baseDelay: 1000,                    // Initial delay in ms
  maxDelay: 30000,                    // Maximum delay cap
  backoffMultiplier: 2,               // Exponential backoff factor
  jitter: true,                       // Add random jitter to prevent thundering herd
  retryableErrorCodes: [              // Node.js error codes to retry
    'ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT'
  ],
  retryableErrorPatterns: [           // Regex patterns for retryable errors
    /timeout/i, /network/i, /rate limit/i
  ],
  circuitBreakerThreshold: 5,         // Failures before opening circuit
  circuitBreakerTimeout: 60000,       // MS before trying half-open state
  onRetryAttempt: (attempt, error, delay) => {
    console.log(`Retry attempt ${attempt} after ${delay}ms:`, error.message);
  },
  onRetryExhausted: (lastError, attempts) => {
    console.error(`All ${attempts} attempts failed:`, lastError);
  }
});
```

#### Retry Configuration in Logger

You can also configure retry options globally when creating a logger:

```typescript
const logger = new Logger({
  transports: [new HttpTransport({ url: 'https://logs.example.com' })],
  retryOptions: {
    maxAttempts: 3,
    baseDelay: 1000,
    circuitBreakerThreshold: 10
  }
});
```

#### Circuit Breaker States

The retry transport includes a circuit breaker that prevents cascading failures:

- **CLOSED**: Normal operation, requests pass through
- **OPEN**: All requests fail fast, no attempts made to wrapped transport
- **HALF_OPEN**: Limited requests allowed to test if service has recovered

#### Events

RetryTransport emits events for monitoring:

```typescript
retryTransport.on('retryAttempt', (context) => {
  // Handle retry attempt
});

retryTransport.on('retryExhausted', (context) => {
  // Handle all retries failed
});

retryTransport.on('circuitBreakerOpen', () => {
  // Circuit breaker opened
});

retryTransport.on('circuitBreakerClose', () => {
  // Circuit breaker closed again
});
```

### 5. `CircuitBreakerTransport`
A standalone circuit breaker transport that wraps any other transport and prevents cascading failures by fast-failing when the wrapped transport is experiencing issues.

```typescript
import { CircuitBreakerTransport, HttpTransport } from 'zario';

const httpTransport = new HttpTransport({
  url: 'https://logs.example.com/ingest'
});

const circuitBreakerTransport = new CircuitBreakerTransport(httpTransport, {
  threshold: 5,                    // Failures before tripping
  timeout: 60000,                   // MS to wait before trying again
  resetTimeout: 120000,             // MS before automatic reset
  onStateChange: (from, to) => {
    console.log(`Circuit breaker: ${from} → ${to}`);
  },
  onTrip: (failureCount) => {
    console.warn(`Circuit breaker tripped after ${failureCount} failures`);
  },
  onReset: () => {
    console.info('Circuit breaker reset to open state');
  }
});
```

#### Circuit Breaker States

- **OPEN**: Normal operation, requests pass through to wrapped transport
- **HALF-OPEN**: Some failures detected, circuit is being cautious
- **CLOSED**: Circuit breaker tripped, all requests fail fast

#### Configuration Options

| Option | Type | Default | Description |
|---------|-------|---------|-------------|
| `threshold` | `number` | `5` | Failure count before tripping |
| `timeout` | `number` | `60000` | MS to wait in half-open state |
| `resetTimeout` | `number` | `undefined` | Auto-reset timer |
| `onStateChange` | `function` | `undefined` | State change callback |
| `onTrip` | `function` | `undefined` | Called when circuit trips |
| `onReset` | `function` | `undefined` | Called when circuit resets |

#### Methods

```typescript
// Get current metrics
const metrics = circuitBreakerTransport.getMetrics();
// Returns: { totalRequests, failedRequests, successfulRequests, currentState, averageResponseTime }

// Manually reset circuit breaker
circuitBreakerTransport.reset();

// Clean up resources
circuitBreakerTransport.destroy();

// Check if async is supported
const supportsAsync = circuitBreakerTransport.isAsyncSupported();
```

### 6. `DeadLetterQueue`
A transport wrapper that captures failed log attempts for later analysis and recovery. Perfect for critical logging systems where no log should be lost.

```typescript
import { DeadLetterQueue, FileTransport } from 'zario';

const fileTransport = new FileTransport({
  path: './logs/app.log'
});

const deadLetterQueue = new DeadLetterQueue({
  transport: fileTransport,
  maxRetries: 3,
  retryableErrorCodes: ['ECONNREFUSED', 'ETIMEDOUT', 'ECONNRESET', 'ENOTFOUND'],
  deadLetterFile: './logs/dead-letters.jsonl',
  onDeadLetter: (deadLetter) => {
    console.error('Log captured in dead letter queue:', deadLetter);
    // Could send to monitoring service, alert team, etc.
  }
});
```

#### Configuration Options

| Option | Type | Default | Description |
|---------|-------|---------|-------------|
| `transport` | `Transport` | **Required** | Transport to wrap |
| `maxRetries` | `number` | `3` | Maximum retry attempts |
| `retryableErrorCodes` | `string[]` | Network error codes | Errors worth retrying |
| `deadLetterFile` | `string` | `undefined` | File to store failed logs |
| `onDeadLetter` | `function` | `undefined` | Callback for failed logs |

#### Dead Letter Format

Failed logs are captured with additional metadata:

```typescript
interface DeadLetterLog extends LogData {
  deadLetterReason: string;    // Human-readable error message
  originalError?: string;      // Error code from original failure
  retryCount: number;          // How many retry attempts were made
  failedAt: Date;             // When the log failed permanently
}
```

#### Methods

```typescript
// Get all captured dead letters
const deadLetters = deadLetterQueue.getDeadLetters();

// Clear dead letter queue
deadLetterQueue.clearDeadLetters();

// Clean up resources
await deadLetterQueue.destroy();

// DeadLetterQueue always supports async
const supportsAsync = deadLetterQueue.isAsyncSupported(); // true
```

#### Dead Letter File Format

When `deadLetterFile` is specified, failed logs are written as JSON Lines:

```jsonl
{"level":"error","message":"Database connection failed","timestamp":"2026-01-07T17:00:00.000Z","deadLetterReason":"ECONNREFUSED","originalError":"ECONNREFUSED","retryCount":3,"failedAt":"2026-01-07T17:00:05.000Z"}
{"level":"warn","message":"API timeout","timestamp":"2026-01-07T17:01:00.000Z","deadLetterReason":"ETIMEDOUT","originalError":"ETIMEDOUT","retryCount":3,"failedAt":"2026-01-07T17:01:05.000Z"}
```

## Custom Transports

You can create a custom transport by implementing the `Transport` interface.

```typescript
import { Transport, Formatter, LogData } from 'zario';

class MyDatabaseTransport implements Transport {
  async write(log: LogData, formatter: Formatter): Promise<void> {
    const formatted = formatter.format(log);
    // Logic to save to database
    await db.logs.insert(formatted);
  }
}

const logger = new Logger({
  transports: [new MyDatabaseTransport()]
});
```

## Transport Buffering & Batching

The `FileTransport` supports `batchInterval`. When set, logs are buffered in memory and written to disk in chunks, which can significantly improve performance in high-throughput applications by reducing disk I/O operations.

---

[← API Reference](./api-reference.md) | [Advanced Usage →](./advanced-usage.md)
