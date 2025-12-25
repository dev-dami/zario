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
logger.fatal('System shutdown imminent');
logger.debug('This is a debug message for internal use');
logger.silent('This message will not be logged as it\'s below the configured level');
logger.boring('This message will be logged without color');
```

## Custom Log Levels

Define custom log levels with specific priorities and colors for more granular logging:

```typescript
import { Logger, ConsoleTransport } from 'zario';

const logger = new Logger({
  level: 'info',
  customLevels: {
    'success': 6,      // Higher priority than error (5)
    'verbose': 1,      // Lower priority than debug (2)
    'critical': 7,     // Highest priority
  },
  customColors: {
    'success': 'green',
    'verbose': 'cyan',
    'critical': 'brightRed',
  },
  transports: [new ConsoleTransport()]
});

// Using custom levels
logger.logWithLevel('success', 'This is a success message in green!');
logger.logWithLevel('verbose', 'This is a verbose message in cyan');
logger.logWithLevel('critical', 'This is a critical message in bright red');
```

You can also filter based on custom log levels:

```typescript
const highLevelLogger = new Logger({
  level: 'critical',
  customLevels: {
    'success': 6,
    'verbose': 1,
    'critical': 7,
  },
  transports: [new ConsoleTransport()]
});

// This will NOT be shown (verbose has priority 1 < critical threshold 7)
highLevelLogger.logWithLevel('verbose', 'This will not appear');

// This WILL be shown (critical has priority 7 >= threshold 7)
highLevelLogger.logWithLevel('critical', 'This critical message appears');
```

Child loggers inherit custom levels and colors from their parent, and can also have their own:

```typescript
const parentLogger = new Logger({
  level: 'info',
  customLevels: {
    'parent_custom': 6,
  },
  customColors: {
    'parent_custom': 'blue',
  },
  transports: [new ConsoleTransport()]
});

const childLogger = parentLogger.createChild({
  customLevels: {
    'child_custom': 7,
  },
  customColors: {
    'child_custom': 'red',
  }
});

childLogger.logWithLevel('parent_custom', 'Inherited from parent');
childLogger.logWithLevel('child_custom', 'Defined in child');
```

## Log Aggregation

Aggregate logs in batches or based on time intervals for efficient processing:

```typescript
import { Logger, ConsoleTransport, BatchAggregator, TimeBasedAggregator, CompositeAggregator } from 'zario';

// Batch aggregator - flushes when batch size is reached
const batchAggregator = new BatchAggregator(10, (logs) => {
  console.log(`Processing ${logs.length} logs in batch`);
  // Send to external service or process logs
});

// Time-based aggregator - flushes after time interval (ms)
const timeAggregator = new TimeBasedAggregator(5000, (logs) => {
  console.log(`Processing ${logs.length} logs after 5 seconds`);
  // Send to external service or process logs
});

// Async batch aggregator
const asyncBatchAggregator = new BatchAggregator(5, async (logs) => {
  await fetch('https://api.example.com/logs', {
    method: 'POST',
    body: JSON.stringify({ logs })
  });
  console.log(`Sent ${logs.length} logs to API`);
});

// Composite aggregator - combine multiple aggregators
const compositeAggregator = new CompositeAggregator([
  batchAggregator,
  timeAggregator
]);

// Create logger with aggregators
const aggregatedLogger = new Logger({
  level: 'info',
  transports: [new ConsoleTransport()],
  aggregators: [asyncBatchAggregator]
});

// Add aggregators dynamically
aggregatedLogger.addAggregator(timeAggregator);

// Log messages
for (let i = 0; i < 15; i++) {
  aggregatedLogger.info(`Log message ${i}`);
}

// Manually flush aggregators (e.g., before shutdown)
await aggregatedLogger.flushAggregators();
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
