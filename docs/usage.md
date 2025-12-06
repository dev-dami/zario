# Usage Guide

This guide provides instructions on how to install and use `dd-tinylog` in your Node.js applications.

## Installation

To get started, install `dd-tinylog` using npm:

```bash
npm install dd-tinylog
```

## Basic Usage

Initialize the logger and start logging messages.

```typescript
// ESM
import { Logger, consoleT, fileT, httpT } from 'zario';
// CommonJS
const { Logger, consoleT, fileT, httpT } = require("zario");

// Create a logger instance with desired configurations
const logger = new Logger({
  level: 'info',         // Set the minimum log level
  colorize: true,        // Enable colored output for console transport
  asyncMode: true,           // Enable asynchronous logging
  transports: [
    consoleT(),                               // Log to console
    fileT({ path: './logs/app.log' }),       // Log to a file
    httpT({                                   // Send logs over HTTP
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

For a comprehensive list of features, refer to the [Features of dd-tinylog](./features.md) document.