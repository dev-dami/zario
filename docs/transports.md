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
import { Logger, FileTransport } from "zario/full";

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

---

### HTTP Transport

Sends log messages to remote HTTP endpoints with retry logic and timeout support.

#### Basic Usage

```typescript
import { Logger, HttpTransport } from "zario/full";

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
| `maxPendingRequests` | `number` | `1000` | Maximum requests from `write()` that can wait at one time. Later logs are dropped, and `flush()` reports the drop. |

---

### Retry Transport

Adds automatic retry logic with exponential backoff to any transport. Useful for unreliable networks or external services.

#### Basic Usage

```typescript
import { Logger, RetryTransport, HttpTransport } from "zario/full";

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
| `maxPendingWrites` | `number` | `1000` | Maximum background writes from `write()` that can wait at one time. Later logs are dropped, and `flush()` reports the drop. |

---

### Circuit Breaker Transport

Prevents cascade failures by automatically tripping when a wrapped transport fails repeatedly. Implements standard circuit breaker pattern with three states.

#### Circuit Breaker States

- **CLOSED**: Normal operation, requests pass through to wrapped transport
- **OPEN**: Circuit breaker tripped, all requests fail fast
- **HALF_OPEN**: Transitional/testing state where the circuit allows limited requests to probe recovery

#### Basic Usage

```typescript
import { Logger, CircuitBreakerTransport, HttpTransport } from "zario/full";

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
| `timeout` | `number` | `60000` | Time (ms) that the circuit stays open before it lets a half-open probe through. Failures older than this stop counting toward the threshold. |
| `resetTimeout` | `number` | `undefined` | Auto-reset timer (ms) |
| `onStateChange` | `function` | `undefined` | State change callback |
| `onTrip` | `function` | `undefined` | Trip callback |
| `onReset` | `function` | `undefined` | Reset callback |

---

### Dead Letter Queue

Captures failed log writes when all retry attempts are exhausted. Supports writing failed logs to files for later analysis.

#### Basic Usage

```typescript
import { Logger, DeadLetterQueue, HttpTransport } from "zario/full";

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
| `maxDeadLetters` | `number` | `1000` | Maximum dead letters kept in memory. The oldest is dropped first. |
| `maxPendingWrites` | `number` | `1000` | Maximum background writes that can wait at one time. Later logs become dead letters. |

---

### Syslog Transport

Sends log records to a local or remote syslog server over UDP (default) or TCP. It uses only Node built-ins.

#### Basic Usage

```typescript
import { Logger, SyslogTransport } from "zario/full";

const logger = new Logger({
  json: true,
  transports: [
    new SyslogTransport({
      host: "127.0.0.1",
      port: 514,
      facility: "local0",
      appName: "checkout-api",
    }),
  ],
});

logger.error("payment failed", { orderId: 42 });
await logger.close(); // waits for pending sends and closes the socket
```

The logger's formatter makes the MSG part, so `json: true` sends structured JSON. UDP, TCP and TLS, RFC 5424 and RFC 3164, structured data, and every option are in the [syslog guide](./syslog.md).

---

### WebSocket Transport

Streams log records to a WebSocket endpoint, for example a local dashboard or a development tool. Each record is one JSON text message: `{ level, message, timestamp, prefix?, metadata? }`.

#### Basic Usage

```typescript
import { Logger, WebSocketTransport } from "zario/full";

const logger = new Logger({
  transports: [
    new WebSocketTransport({
      url: "ws://localhost:8080/logs",
      headers: { Authorization: `Bearer ${process.env.LOG_TOKEN}` },
    }),
  ],
});

logger.info("job started", { jobId: 7 });
await logger.close(); // sends queued records, stops reconnecting, closes the socket
```

The transport connects on the first write. While it is disconnected, it keeps up to `maxQueueSize` records and drops the oldest first. It reconnects with a capped exponential backoff, and only when records wait to be sent.

Bun and Node 22+ have a global `WebSocket`. On Node 20, pass a socket from the [`ws`](https://www.npmjs.com/package/ws) package:

```typescript
import WebSocket from "ws";

new WebSocketTransport({
  url: "ws://localhost:8080/logs",
  createSocket: (url) => new WebSocket(url, { headers: { Authorization: "Bearer token" } }),
});
```

#### Configuration Options

| Option | Type | Default | Description |
|--------|--------|----------|-------------|
| `url` | `string` | Required | WebSocket endpoint |
| `protocols` | `string \| string[]` | `undefined` | Subprotocols for the handshake |
| `headers` | `Record<string, string>` | `undefined` | Handshake headers (Bun and Node 22+) |
| `createSocket` | `(url) => WebSocketLike` | global `WebSocket` | Make the socket yourself, for example with `ws` |
| `maxQueueSize` | `number` | `1000` | Records kept while disconnected. `getDroppedCount()` returns the number dropped. |
| `reconnectDelay` | `number` | `500` | First reconnect delay (ms). It doubles after each failed attempt. |
| `maxReconnectDelay` | `number` | `30000` | Maximum reconnect delay (ms) |
| `flushTimeout` | `number` | `5000` | Maximum time (ms) that `flush()` waits for delivery before it rejects |

Delivery is at most once. Records still queued when the process stops are lost. Use a `DeadLetterQueue` or a `FileTransport` next to it when you need a durable copy.

---

### Elasticsearch Transport

Indexes log records in Elasticsearch or OpenSearch through the `_bulk` API. It batches records, sends one bulk request at a time, and uses the global `fetch`.

#### Basic Usage

```typescript
import { Logger, ElasticsearchTransport } from "zario/full";

const logger = new Logger({
  transports: [
    new ElasticsearchTransport({
      node: "https://es.example.com:9200",
      apiKey: process.env.ES_API_KEY,
      index: "logs-checkout",
      dataStream: true, // use the "create" action for data streams
    }),
  ],
});

logger.info("order placed", { orderId: 42 });
await logger.close(); // sends buffered records and waits for the bulk requests
```

Each document has this shape:

```json
{ "@timestamp": "2026-05-06T07:08:09.000Z", "level": "info", "message": "order placed", "metadata": { "orderId": 42 } }
```

A request goes out when `batchSize` records wait, or after `flushInterval`. Network errors and 429, 502, 503 and 504 responses are retried with a doubling delay. Items rejected with 429 are retried alone. Other item errors, for example mapping conflicts, are not retried. `flush()` and `close()` reject with the first one.

#### Configuration Options

| Option | Type | Default | Description |
|--------|--------|----------|-------------|
| `node` | `string` | Required | Cluster URL |
| `index` | `string \| (data) => string` | `"logs-zario"` | Index or data stream, or a function that picks one per record |
| `dataStream` | `boolean` | `false` | Use the `create` action, which data streams require |
| `apiKey` | `string` | `undefined` | Sent as `Authorization: ApiKey <key>` |
| `username`, `password` | `string` | `undefined` | Basic auth |
| `headers` | `Record<string, string>` | `{}` | Extra request headers |
| `pipeline` | `string` | `undefined` | Ingest pipeline |
| `batchSize` | `number` | `500` | Records per bulk request |
| `flushInterval` | `number` | `2000` | Maximum time (ms) a record waits before a request |
| `maxQueueSize` | `number` | `10000` | Records kept in memory. The oldest is dropped first. `getDroppedCount()` returns the number dropped. |
| `maxRetries` | `number` | `3` | Retries for a request, and for items rejected with 429 |
| `retryDelay` | `number` | `500` | First retry delay (ms). It doubles after each retry. |
| `timeout` | `number` | `10000` | Request timeout (ms) |

---

## Transport Composition

You can combine multiple transports for resilient logging strategies:

```typescript
import { Logger, HttpTransport, DeadLetterQueue, CircuitBreakerTransport, FileTransport } from "zario/full";

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