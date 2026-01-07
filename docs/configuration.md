# Configuration Reference

Zario is highly configurable. You can pass a `LoggerOptions` object to the `Logger` constructor to customize its behavior.

## Logger Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `level` | `LogLevel` | `'info'` | The minimum log level to output. |
| `colorize` | `boolean` | `true` | Whether to colorize the console output. |
| `json` | `boolean` | `false` | Whether to format logs as JSON. |
| `transports` | `Transport[]` | `[Console]` | An array of transports to use for logging. |
| `timestamp` | `boolean` | `false` | Whether to include a timestamp in the log output. |
| `timestampFormat`| `string` | `'YYYY-MM-DD HH:mm:ss'` | The format for timestamps. |
| `prefix` | `string` | `''` | A prefix to add to all log messages. |
| `context` | `object` | `{}` | Default metadata to attach to every log. |
| `asyncMode` | `boolean` | `false` | Enable non-blocking asynchronous logging. |
| `customLevels` | `object` | `undefined` | Map of custom log level names to priorities. |
| `customColors` | `object` | `undefined` | Map of custom log level names to colors. |
| `filters` | `Filter[]` | `[]` | Array of filters to apply before logging. |
| `aggregators` | `Aggregator[]`| `[]` | Array of log aggregators. |
| `enrichers` | `Enricher[]` | `[]` | Pipeline for structured logging metadata. |

## Log Levels

Zario comes with several built-in log levels, ordered by priority:

1. `silent` (0) - Suppresses all logging.
2. `boring` (1) - Low priority, uncolored info.
3. `debug` (2) - Detailed debugging information.
4. `info` (3) - General informational messages.
5. `warn` (4) - Warning messages for non-critical issues.
6. `error` (5) - Error messages for failed operations.
7. `fatal` (6) - Critical failures that may lead to shutdown.

Logs with a priority **equal to or higher** than the configured `level` will be processed.

## Custom Levels & Colors

You can define your own log levels with specific priorities and colors.

```typescript
const logger = new Logger({
  customLevels: {
    'success': 4,  // Same priority as warn
    'trace': 1     // Lower priority than debug
  },
  customColors: {
    'success': 'green',
    'trace': 'gray'
  }
});

logger.logWithLevel('success', 'Operation completed!');
```

### Supported Colors
Zario supports standard ANSI colors: `black`, `red`, `green`, `yellow`, `blue`, `magenta`, `cyan`, `white`, `gray`, and their "bright" variants (e.g., `brightRed`).

## Timestamp Customization

The `timestampFormat` supports the following placeholders:

- `YYYY`: 4-digit year
- `MM`: 2-digit month (01-12)
- `DD`: 2-digit day (01-31)
- `HH`: 2-digit hour (00-23)
- `mm`: 2-digit minute (00-59)
- `ss`: 2-digit second (00-59)
- `SSS`: 3-digit millisecond (000-999)

Example: `YYYY/MM/DD HH:mm:ss.SSS` -> `2025/01/23 10:22:20.500`

---

[← Getting Started](./getting-started.md) | [API Reference →](./api-reference.md)
