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

## OpenTelemetry Integration

Zario provides native OpenTelemetry support for automatic trace ID and span ID injection into logs. This enables distributed tracing correlation without any configuration overhead.

### Basic Usage

```typescript
import { Logger, LogEnrichmentPipeline, MetadataEnricher } from 'zario';

const logger = new Logger({
  json: true,
  enrichers: new LogEnrichmentPipeline([
    MetadataEnricher.addOpenTelemetryContext()
  ])
});

// When called inside an OpenTelemetry-instrumented handler:
logger.info('Processing request');
// Output: { "trace_id": "abc123...", "span_id": "xyz789...", "message": "Processing request" }
```

### Configuration Options

```typescript
MetadataEnricher.addOpenTelemetryContext({
  traceIdField: 'trace_id',      // Field name for trace ID (default: 'trace_id')
  spanIdField: 'span_id',        // Field name for span ID (default: 'span_id')
  traceFlagsField: 'trace_flags', // Field name for trace flags
  parentSpanIdField: 'parent_span_id', // Field name for parent span ID
  baggageField: 'baggage',       // Field name for baggage
  includeBaggage: false,         // Include OTel baggage (default: false)
  includeParentSpan: false,      // Include parent span ID (default: false)
  includeTraceFlags: false,      // Include trace flags (default: false)
})
```

### Zero-Dependency Design

The OpenTelemetry enricher works without adding any dependencies to your project. If `@opentelemetry/api` is installed, Zario automatically extracts trace context. If not, the enricher gracefully skips trace injection.

## Request Context (AsyncLocalStorage)

For request-scoped logging without manual child logger creation, use `RequestContext`:

```typescript
import { Logger, RequestContext, LogEnrichmentPipeline, MetadataEnricher } from 'zario';

const logger = new Logger({
  enrichers: new LogEnrichmentPipeline([
    MetadataEnricher.addRequestContext()
  ])
});

// Express middleware example
app.use((req, res, next) => {
  RequestContext.run({
    requestId: req.headers['x-request-id'],
    userId: req.user?.id,
    tenantId: req.headers['x-tenant-id']
  }, () => {
    next();
  });
});

// In any handler - context automatically included
logger.info('User action completed');
// Output includes requestId, userId, tenantId automatically
```

### RequestContext API

```typescript
// Run code with context
RequestContext.run({ requestId: 'req-123' }, () => {
  // All logs inside this callback include requestId
});

// Async version
await RequestContext.runAsync({ requestId: 'req-123' }, async () => {
  await someAsyncOperation();
  logger.info('Done'); // Still has requestId
});

// Get specific value
const reqId = RequestContext.get('requestId');

// Get all context values
const ctx = RequestContext.getAll();

// Add values dynamically
RequestContext.set('operationId', 'op-456');

// Check if context is active
if (RequestContext.isActive()) {
  // Inside a RequestContext.run() block
}
```

### Combining OTel and RequestContext

```typescript
const logger = new Logger({
  enrichers: new LogEnrichmentPipeline([
    MetadataEnricher.addOpenTelemetryContext(),
    MetadataEnricher.addRequestContext(['requestId', 'userId']),
    MetadataEnricher.addProcessInfo()
  ])
});

// Logs now include trace_id, span_id, requestId, userId, pid, hostname
```

---

[← Transports](./transports.md) | [Log Formats →](./log-formats.md)
