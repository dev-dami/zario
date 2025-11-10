# Transports

Transports are responsible for sending log messages to a specific destination, such as the console or a file. `teeny-logger` comes with two built-in transports: `ConsoleTransport` and `FileTransport`.

## Console Transport

The `ConsoleTransport` logs messages to the console. This transport is used by default if no other transports are specified.

### Options

The `ConsoleTransport` has one option:

- `colorize` (`boolean`, default: `true`): Whether to colorize the console output.

### Usage

```typescript
import { Logger } from 'teeny-logger';

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
import { Logger } from 'teeny-logger';

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
import { Transport } from 'teeny-logger';
import { LogData } from 'teeny-logger/dist/core/Logger';
import { Formatter } from 'teeny-logger/dist/core/Formatter';

class MyCustomTransport implements Transport {
  write(data: LogData, formatter: Formatter): void {
    const output = formatter.format(data);
    // Send the output to your desired destination
    console.log(`My custom transport: ${output}`);
  }
}
```
