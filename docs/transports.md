# Transports

Transports are responsible for sending log messages to a specific destination, such as the console or a file. `dd-tinylog` comes with two built-in transports: `ConsoleTransport` and `FileTransport`.

## Console Transport

The `ConsoleTransport` logs messages to the console. This transport is used by default if no other transports are specified.

### Options

The `ConsoleTransport` has one option:

- `colorize` (`boolean`, default: `true`): Whether to colorize the console output.

### Usage

```typescript
import { Logger } from 'dd-tinylog';
// CommonJS
const { Logger } = require('dd-tinylog');

const logger = new Logger({
  transports: [
    {
      type: 'console',
      options: {
        colorize: false, // Disable colorization
      },
    },
  ],
});
```

## File Transport

The `FileTransport` logs messages to a file. It also supports automatic file rotation based on size.

### Options

- `path` (`string`, required): The path to the log file.
- `maxSize` (`number`, default: `10 * 1024 * 1024` bytes): The maximum size of a log file in bytes before it is rotated.
- `maxFiles` (`number`, default: `5`): The maximum number of rotated log files to keep.

### Usage

```typescript
import { Logger } from 'dd-tinylog';
// CommonJS
const { Logger } = require('dd-tinylog');

const logger = new Logger({
  transports: [
    {
      type: 'file',
      options: {
        path: './logs/app.log',
        maxSize: 5 * 1024 * 1024, // 5MB
        maxFiles: 3,
      },
    },
  ],
});
```

## Custom Transports

You can create your own custom transports by implementing the `Transport` interface.

```typescript
import { Transport, LogData, Formatter } from 'dd-tinylog';
// CommonJS
const { FileTransport, } = require('dd-tinylog');

class MyCustomTransport implements Transport {
  write(data: LogData, formatter: Formatter): void {
    const output = formatter.format(data);
    // Send the output to your desired destination
    console.log(`My custom transport: ${output}`);
  }
  
  // Optional: implement async logging method for better performance
  async writeAsync(data: LogData, formatter: Formatter): Promise<void> {
    const output = formatter.format(data);
    // Asynchronously send the output to your desired destination
    setImmediate(() => {
      console.log(`My custom async transport: ${output}`);
    });
    return Promise.resolve();
  }
}
```

## Asynchronous Logging

`dd-tinylog` supports asynchronous logging to prevent blocking the main application thread during heavy logging operations. When async mode is enabled, log messages are written in the background without blocking your application.

### Enabling Async Mode

To enable asynchronous logging, set the `async` option to `true` when creating a logger:

```typescript
import { Logger } from 'dd-tinylog';

const logger = new Logger({
  async: true, // Enable asynchronous logging
  transports: [
    { type: 'console' },
    { type: 'file', options: { path: './logs/app.log' } },
  ],
});

// Log messages are now processed asynchronously in the background
logger.info('This message will be logged asynchronously');
logger.error('Error occurred', { code: 500 });
```

### Benefits of Async Logging

- Prevents blocking the main application thread during heavy logging
- Improves application performance under high logging loads
- Especially beneficial when writing logs to files with disk I/O
- Maintains the same logging API as synchronous mode
```
