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

## Advanced Filtering

Zario provides powerful filtering capabilities to control which logs are emitted based on various criteria.

```typescript
import { Logger, ConsoleTransport, LevelFilter, PrefixFilter, MetadataFilter, CompositeFilter, OrFilter, PredicateFilter } from 'zario';

// Level filter - only allow specific log levels
const levelFilter = new LevelFilter(['info', 'error']);

// Prefix filter - only allow logs with specific prefixes
const prefixFilter = new PrefixFilter(['[API]', '[DB]']);

// Metadata filter - only allow logs with specific metadata
const metadataFilter = new MetadataFilter({ userId: 123 });

// Composite filter - combines multiple filters with AND logic
// Note: With an empty array, CompositeFilter allows all logs (vacuous truth)
const compositeFilter = new CompositeFilter([levelFilter, prefixFilter]);

// Or filter - combines multiple filters with OR logic
// Note: With an empty array, OrFilter blocks all logs (no matching conditions)
const orFilter = new OrFilter([levelFilter, metadataFilter]);

// Predicate filter - custom filtering function
const predicateFilter = new PredicateFilter((logData) => {
  return logData.level !== 'debug'; // Filter out debug messages
});

// Create logger with filters
const filteredLogger = new Logger({
  level: 'debug',
  transports: [new ConsoleTransport()],
  filters: [compositeFilter, predicateFilter] // Apply multiple filters
});

filteredLogger.info('This will be logged'); // Passes all filters
filteredLogger.debug('This might be filtered'); // Could be filtered by predicate
filteredLogger.error('This should be logged'); // Passes level filter
```

## Structured Logging Extensions

Enhance your logs with additional metadata using structured logging extensions.

```typescript
import { Logger, ConsoleTransport, LogEnrichmentPipeline, MetadataEnricher } from 'zario';

// Create enrichers to add metadata to logs
const staticEnricher = MetadataEnricher.addStaticFields({
  service: 'user-service',
  version: '1.0.0'
});

const dynamicEnricher = MetadataEnricher.addDynamicFields(() => ({
  processId: process.pid,
  memoryUsage: process.memoryUsage().heapUsed
}));

const processEnricher = MetadataEnricher.addProcessInfo();
const envEnricher = MetadataEnricher.addEnvironmentInfo();

// Create a pipeline with multiple enrichers
const enricherPipeline = new LogEnrichmentPipeline([
  staticEnricher,
  dynamicEnricher,
  processEnricher,
  envEnricher
]);

// Create logger with enrichers
const enrichedLogger = new Logger({
  level: 'info',
  transports: [new ConsoleTransport()],
  enrichers: enricherPipeline
});

enrichedLogger.info('User login', { userId: 123 });
// Output will include additional metadata fields

// Add enrichers dynamically
enrichedLogger.addEnricher((logData) => {
  return {
    ...logData,
    timestamp: new Date().toISOString(),
    additionalField: 'some-value'
  };
});
```

For a comprehensive list of features, refer to the [Features](./features.md) document.
