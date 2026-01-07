# Advanced Usage

Zario provides powerful tools for filtering, enriching, and aggregating logs.

## Advanced Filtering

Filters allow you to control which logs reach your transports based on complex criteria.

### Built-in Filters
- `LevelFilter`: Only allow specific log levels.
- `PrefixFilter`: Filter based on message prefixes.
- `MetadataFilter`: Filter based on specific metadata values.
- `PredicateFilter`: Use a custom function `(logData) => boolean`.
- `CompositeFilter`: Combine multiple filters with `AND` logic.
- `OrFilter`: Combine multiple filters with `OR` logic.
- `NotFilter`: Invert a filter's result.

```typescript
import { Logger, LevelFilter, PrefixFilter, CompositeFilter } from 'zario';

const filter = new CompositeFilter([
  new LevelFilter(['error', 'fatal']),
  new PrefixFilter(['[API]'])
]);

const logger = new Logger({
  filters: [filter]
});
```

## Structured Logging & Enrichers

Enrichers allow you to automatically add metadata to every log entry. This is especially useful for structured JSON logging.

### `MetadataEnricher` Utilities
- `addStaticFields(fields)`: Add constant fields like service name or version.
- `addDynamicFields(fn)`: Add fields that change, like memory usage or uptime.
- `addProcessInfo()`: Automatically add `pid`, `platform`, `nodeVersion`.
- `addEnvironmentInfo()`: Adds environment variables or `NODE_ENV`.

```typescript
import { Logger, LogEnrichmentPipeline, MetadataEnricher } from 'zario';

const pipeline = new LogEnrichmentPipeline([
  MetadataEnricher.addStaticFields({ service: 'auth-service' }),
  MetadataEnricher.addProcessInfo()
]);

const logger = new Logger({
  enrichers: pipeline
});
```

## Log Aggregation

Aggregators allow you to collect logs and process them in batches, which is ideal for sending logs to remote services via HTTP.

### Types of Aggregators
- `BatchAggregator`: Flushes when a certain number of logs are collected.
- `TimeBasedAggregator`: Flushes at regular time intervals.
- `CompositeAggregator`: Flushes when either a count or a time limit is reached.

```typescript
import { Logger, BatchAggregator } from 'zario';

const aggregator = new BatchAggregator(
  50, 
  (logs) => {
    // Process 50 logs at once
    myAnalyticsService.sendBatch(logs);
  },
  10000 // maxQueueSize: limits memory usage if flush fails
);

const logger = new Logger({
  aggregators: [aggregator]
});
```

## Error Handling via Events

The `Logger` class extends `EventEmitter`, allowing you to listen for internal errors in the logging pipeline. This is crucial for monitoring the health of your transports and aggregators.

```typescript
logger.on('error', ({ type, error }) => {
  console.error(`Error in ${type}:`, error.message);
  
  if (type === 'transport') {
    // Handle transport failures (e.g., notify DevOps)
  }
});
```

The error event payload contains:
- `type`: One of `'transport'`, `'aggregator'`, or `'enricher'`.
- `error`: The original `Error` object.

## Asynchronous Mode


For high-performance applications, enabling `asyncMode` ensures that logging operations never block the main event loop.

```typescript
const logger = new Logger({
  asyncMode: true
});
```

When enabled, Zario uses `setImmediate` or internal asynchronous transport methods to handle log processing.

---

[← Transports](./transports.md) | [Log Formats →](./log-formats.md)
