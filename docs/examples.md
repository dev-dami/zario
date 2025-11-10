# Examples

This section provides more advanced usage examples for `teeny-logger`.

## JSON Structured Logging

You can configure the logger to output logs in JSON format. This is useful for integrating with log management systems.

```typescript
import { Logger } from 'teeny-logger';

const logger = new Logger({
  json: true,
});

logger.info('User logged in', { userId: 123, username: 'test' });
```

**Output:**

```json
{"level":"info","message":"User logged in","timestamp":"...","metadata":{"userId":123,"username":"test"}}
```

You can also switch to JSON format at runtime:

```typescript
logger.setFormat('json');
```

## Using the Global Logger

`teeny-logger` provides a global logger instance that can be accessed from anywhere in your application.

```typescript
import { Logger } from 'teeny-logger';

// Configure the global logger
Logger.global.setLevel('debug');

// Use the global logger
function doSomething() {
  Logger.global.info('Doing something...');
}
```

## File Transport with Rotation

The `FileTransport` can be configured to automatically rotate log files when they reach a certain size.

```typescript
import { Logger } from 'teeny-logger';

const logger = new Logger({
  transports: [
    {
      type: 'file',
      options: {
        path: './logs/app.log',
        maxSize: 1024, // 1KB
        maxFiles: 3,
      },
    },
  ],
});

for (let i = 0; i < 100; i++) {
  logger.info(`Log message ${i}`);
}
```

This will create up to 3 log files (`app.log`, `app.log.1`, `app.log.2`) and rotate them as they reach 1KB in size.
