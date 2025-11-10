# teeny-logger

[![npm version](https://badge.fury.io/js/teeny-logger.svg)](https://badge.fury.io/js/teeny-logger)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A minimal, fast, and feature-rich logging library for Node.js.

`teeny-logger` is designed to be a lightweight and easy-to-use logger with support for multiple transports, customizable formatting, and dynamic log levels.

## Features

- **Lightweight and Fast**: Minimal overhead for high-performance applications.
- **Multiple Transports**: Log to the console, files, or create your own custom transports.
- **Customizable Formatting**: Choose between simple text or structured JSON logging.
- **Dynamic Log Levels**: Change the log level at runtime.
- **File Rotation**: Automatically rotate log files based on size.
- **TypeScript Support**: Written in TypeScript with type definitions included.

## Installation

```bash
npm install teeny-logger
```

## Usage

```typescript
import { Logger } from 'teeny-logger';

// Create a logger instance
const logger = new Logger({
  level: 'info',
  colorize: true,
  transports: [
    { type: 'console' },
    { type: 'file', options: { path: './logs/app.log' } },
  ],
});

// Log messages
logger.info('Server started on port 3000');
logger.warn('Low disk space');
logger.error('Failed to connect to database', { code: 500 });
logger.debug('This is a debug message');
```

## Documentation

- [Getting Started](./docs/getting-started.md)
- [API Reference](./docs/api-reference.md)
- [Transports](./docs/transports.md)
- [Examples](./docs/examples.md)

## Contributing

Contributions are welcome! Please see the [Contributing Guidelines](./CONTRIBUTING.md) for more information.

## License

This project is licensed under the MIT License. See the [LICENSE](./LICENSE) file for details.