# Advanced Usage

Zario provides comprehensive tools for filtering, enriching, and aggregating logs.

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

---

## Structured Logging & Enrichers

Enrichers allow you to automatically add metadata to every log entry.  
This is especially useful for structured JSON logging.

### MetadataEnricher Utilities
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

---

## Log Aggregation

Aggregators allow you to collect logs and process them in batches.  
Ideal for sending logs to remote services via HTTP.

### Types of Aggregators
- `BatchAggregator`
- `TimeBasedAggregator`
- `CompositeAggregator`

```typescript
import { Logger, BatchAggregator } from 'zario';

const aggregator = new BatchAggregator(
  50,
  (logs) => {
    myAnalyticsService.sendBatch(logs);
  },
  10000 // maxQueueSize
);

const logger = new Logger({
  aggregators: [aggregator]
});
```

---

## Error Handling via Events

`Logger` extends `EventEmitter`, allowing you to monitor failures in transports and aggregators.

```typescript
logger.on('error', ({ type, error }) => {
  console.error(`Error in ${type}:`, error.message);

  if (type === 'transport') {
    // Handle transport failures
  }
});
```

### Error payload
- `type`: `'transport' | 'aggregator' | 'enricher'`
- `error`: Error object

---

## Asynchronous Mode

For high-performance applications, enabling `asyncMode` ensures that logging never blocks the event loop.

```typescript
const logger = new Logger({
  asyncMode: true
});
```

Zario uses `setImmediate` or internal async transport handling.

---

[← Transports](./transports-JP.md) | [Log Formats →](./log-formats-JP.md)
