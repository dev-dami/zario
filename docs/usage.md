# Usage Guide

This guide provides instructions on how to install and use `zario` in your Node.js applications.

## Installation

To get started, install `zario` using npm:

```bash
npm install zario
```

## Basic Usage

Initialize the logger and start logging messages.

```typescript
// ESM
import { Logger, ConsoleTransport, FileTransport, HttpTransport } from 'zario';
// CommonJS
const { Logger, ConsoleTransport, FileTransport, HttpTransport } = require("zario");

// Create a logger instance with desired configurations
const logger = new Logger({
  level: 'info',         // Set the minimum log level
  colorize: true,        // Enable colored output for console transport
  asyncMode: true,           // Enable asynchronous logging
  transports: [
    new ConsoleTransport(),                               // Log to console
    new FileTransport({                                   // Log to a file with advanced options
      path: './logs/app.log',                             // Log file path
      maxSize: 10485760,                                  // 10MB max file size (optional)
      maxFiles: 5,                                        // Max number of rotated files (optional)
      compression: 'gzip',                                // 'gzip', 'deflate', or 'none' (optional)
      batchInterval: 1000,                                // Batch write interval in ms (optional, 0 to disable)
      compressOldFiles: true                              // Compress old rotated files (optional)
    }),
    new HttpTransport({                                   // Send logs over HTTP
      url: 'https://api.example.com/logs',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer your-token-here'
      },
      timeout: 10000,                         // Request timeout in ms
      retries: 3                             // Number of retry attempts
    })
  ],
  prefix: '[My-App]',    // Custom prefix for all log messages
  timestamp: true,       // Include timestamps in logs
});

// Log messages at different levels
logger.info('Server started on port 3000');
logger.warn('Low disk space warning');
logger.error('Failed to connect to database', { code: 500 });
logger.debug('This is a debug message for internal use');
logger.silent('This message will not be logged as it\'s below the configured level');
logger.boring('This message will be logged without color');
```

## Child Loggers

Child loggers allow you to create new logger instances that inherit settings from a parent logger while adding their own context.

```typescript
// Create a child logger for a specific request
const requestLogger = logger.createChild({
  prefix: '[Request-123]', // Add a specific prefix
  context: { requestId: 'req-123', userId: 'user-abc' }, // Add contextual data
});

requestLogger.info('Processing incoming request');
requestLogger.debug('Request payload', { data: { key: 'value' } });
requestLogger.error('Failed to process request', { error: 'timeout' });

// Another child logger for a database operation, overriding the log level
const dbLogger = logger.createChild({
  prefix: '[Database]',
  level: 'debug', // Child logger can override parent's level
});

dbLogger.debug('Connecting to database...');
dbLogger.info('Query executed successfully');
```

For a comprehensive list of features, refer to the [Features](./features.md) document.
