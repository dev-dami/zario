# zario

A minimal, fast logging library for Node.js with TypeScript support.

## What's New in 0.3.5

- Added advanced filtering capabilities with LevelFilter, PrefixFilter, MetadataFilter, CompositeFilter, OrFilter, and PredicateFilter
- Added structured logging extensions with LogEnrichmentPipeline and MetadataEnricher
- Added TimeBasedAggregator.stop() method for proper timer cleanup
- Improved error handling for aggregators and filters with try-catch protection
- Enhanced thread safety with defensive copying of filters during iteration
- Fixed enricher inheritance in child loggers
- Added documentation for empty array behavior in CompositeFilter (allows all) and OrFilter (blocks all)
- Added note about strict equality in MetadataFilter for complex objects

## What's New in 0.2.11

- Added HTTP transport support with new HttpTransport class
- Added log batching functionality for efficient writes
- Added compression support (.gz for gzip, .zz for deflate) for rotated files
- Enhanced rotation with maxSize, maxFiles, and configurable compression

## Installation

```bash
npm install zario
```

## Quick Start

```js
import { Logger, ConsoleTransport } from "zario";

const logger = new Logger({
  level: "info",
  colorize: true,
  transports: [new ConsoleTransport()],
  prefix: "[MyApp]",
});

// Start logging
logger.info("🚀 Server started on port 3000");
logger.warn("⚠️ High memory usage detected");
logger.error("❌ Database connection failed", { code: 500 });
```

## API Documentation

### Logger Constructor Options

| Option         | Type     | Description             |
| -------------- | -------- | ----------------------- |
| **level**      | `string` | Log level threshold     |
| **json**       | `boolean`| Output in JSON format   |
| **timestamp**  | `boolean`| Include timestamps      |
| **prefix**     | `string` | Prepended label         |
| **transports** | `array`  | Where logs are written (with transport-specific options like `path`, `maxSize`, `maxFiles`, `compression`, `batchInterval`, `compressOldFiles` for file transport) |
| **customLevels** | `object` | Define custom log levels and their priorities |
| **customColors** | `object` | Assign colors to custom log levels |
| **filters** | `Filter[]` | Array of filters to apply before logging (LevelFilter, PrefixFilter, MetadataFilter, CompositeFilter, OrFilter, PredicateFilter) |
| **aggregators** | `LogAggregator[]` | Array of log aggregators (BatchAggregator, TimeBasedAggregator, CompositeAggregator) |
| **enrichers** | `LogEnrichmentPipeline` | Pipeline for structured logging extensions |

### Log Levels

| Level    | Method        | Use Case                   |
|----------|---------------|----------------------------|
| 🔍 DEBUG  | `logger.debug()` | Detailed debugging info    |
| ✨ INFO   | `logger.info()`  | General information       |
| ⚠️ WARN   | `logger.warn()`  | Warning messages          |
| ❌ ERROR  | `logger.error()` | Error messages            |
| 🤫 SILENT | `logger.silent()`| Not output to console     |
| 📝 BORING | `logger.boring()`| Lowest priority messages  |

### Transports

#### Console Transport

```js
import { Logger, ConsoleTransport } from "zario";

const logger = new Logger({
  transports: [
    new ConsoleTransport({ colorize: true })
  ]
});
```

#### File Transport

```js
import { Logger, FileTransport } from "zario";

const logger = new Logger({
  transports: [
    new FileTransport({
      path: './logs/app.log',
      maxSize: 10485760, // 10MB in bytes
      maxFiles: 5,
      compression: 'gzip', // 'gzip', 'deflate', or 'none' (default: 'none')
      batchInterval: 1000, // Batch interval in ms (0 to disable, default: 0)
      compressOldFiles: true // Whether to compress old files during rotation (default: true)
    })
  ]
});
```

#### HTTP Transport

```js
import { Logger, HttpTransport } from "zario";

const logger = new Logger({
  transports: [
    new HttpTransport({
      url: 'https://api.example.com/logs',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer your-token-here'
      },
      timeout: 10000,  // Request timeout in ms
      retries: 3       // Number of retry attempts
    })
  ]
});
```

### Advanced Filtering

Filter logs based on various criteria using built-in filter classes:

```js
import {
  Logger,
  ConsoleTransport,
  LevelFilter,
  PrefixFilter,
  MetadataFilter,
  CompositeFilter,
  OrFilter,
  PredicateFilter
} from "zario";

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
```

### Structured Logging Extensions

Enhance your logs with additional metadata using structured logging extensions:

```js
import {
  Logger,
  ConsoleTransport,
  LogEnrichmentPipeline,
  MetadataEnricher
} from "zario";

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

### Log Aggregation

Aggregate logs in batches or based on time intervals:

```js
import {
  Logger,
  ConsoleTransport,
  BatchAggregator,
  TimeBasedAggregator,
  CompositeAggregator
} from "zario";

// Batch aggregator - flushes when batch size is reached
const batchAggregator = new BatchAggregator(10, (logs) => {
  // Process batch of 10 logs
  console.log(`Processing ${logs.length} logs`);
});

// Time-based aggregator - flushes after time interval
const timeAggregator = new TimeBasedAggregator(5000, (logs) => {
  // Process logs every 5 seconds
  console.log(`Processing ${logs.length} logs`);
});

// Create logger with aggregators
const aggregatedLogger = new Logger({
  level: 'info',
  transports: [new ConsoleTransport()],
  aggregators: [batchAggregator]
});

// Manually flush aggregators
aggregatedLogger.flushAggregators();

// Stop time-based aggregator timer
// timeAggregator.stop(); // Available for TimeBasedAggregator
```

### Methods

- `logger.debug(message, metadata?)` - Debug level logging
- `logger.info(message, metadata?)` - Info level logging
- `logger.warn(message, metadata?)` - Warning level logging
- `logger.error(message, metadata?)` - Error level logging
- `logger.logWithLevel(level, message, metadata?)` - Log a message at an arbitrary/custom level
- `logger.createChild(options)` - Creates a child logger with inherited settings
- `logger.setLevel(level)` - Change the logger level at runtime
- `logger.setFormat(format)` - Set the output format to text or json
- `logger.addFilter(filter)` - Add a filter to the logger (LevelFilter, PrefixFilter, MetadataFilter, etc.)
- `logger.removeFilter(filter)` - Remove a filter from the logger
- `logger.addAggregator(aggregator)` - Add an aggregator to the logger (BatchAggregator, TimeBasedAggregator, etc.)
- `logger.removeAggregator(aggregator)` - Remove an aggregator from the logger
- `logger.flushAggregators()` - Manually flush all aggregators
- `logger.addEnricher(enricher)` - Add an enricher to the logger for structured logging
- `logger.startTimer(name)` - Create a performance timer

## Usage Examples

### Basic Usage

```js
import { Logger, ConsoleTransport } from "zario";

const logger = new Logger({
  level: "info",
  colorize: true,
  transports: [new ConsoleTransport()]
});

logger.info("Application started");
logger.error("Something went wrong", { userId: 123 });
```

### JSON Format

```js
const logger = new Logger({ json: true });
```

### Custom Levels & Colors

```js
import { Logger, ConsoleTransport } from "zario";

const logger = new Logger({
  level: 'info',
  customLevels: {
    'success': 6,      // Higher priority than error (5).
    'verbose': 1,      // Lower priority than debug (2).
    'critical': 7,     // Highest priority.
  },
  customColors: {
    'success': 'green',
    'verbose': 'cyan',
    'critical': 'brightRed',
  },
  transports: [
    new ConsoleTransport()
  ]
});

// Using custom levels.
logger.logWithLevel('success', 'This is a success message in green!');
logger.logWithLevel('verbose', 'This is a verbose message in cyan');
logger.logWithLevel('critical', 'This is a critical message in bright red');
```

### Child Loggers

```js
const main = new Logger({ prefix: "[APP]" });
const db = main.createChild({ prefix: "[DB]" });

main.info("App initialized");
db.error("Connection timeout");
```

### Multiple Transports

```js
import { Logger, ConsoleTransport, FileTransport } from "zario";

const logger = new Logger({
  level: 'info',
  transports: [
    new ConsoleTransport(),
    new FileTransport({ path: './logs/app.log' })
  ]
});
```
