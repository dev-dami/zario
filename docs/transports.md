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
Writes logs to the local filesystem with support for rotation and compression.

```typescript
import { FileTransport } from 'zario';

const transport = new FileTransport({
  path: './logs/app.log',     // Target file path
  maxSize: 10 * 1024 * 1024,  // 10MB before rotation
  maxFiles: 5,                // Keep 5 rotated files
  compression: 'gzip',        // 'gzip', 'deflate', or 'none'
  compressOldFiles: true,     // Compress files during rotation
  batchInterval: 1000         // Buffer writes every 1s (0 to disable)
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
  timeout: 5000, // 5s timeout
  retries: 3     // Exponential backoff retries
});
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
