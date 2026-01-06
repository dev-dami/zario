# Log Formats

`zario` supports two primary log formats: **Plain Text** (default) and **JSON**. You can switch between these formats using the `json` configuration option.

## Plain Text Format

The plain text format is designed for human readability, making it ideal for development and CLI tools.

### Structure

The default structure of a text log entry is:
```text
[Timestamp] [Prefix] [LEVEL] Message {metadata}
```

- **Timestamp**: Included if `timestamp` is set to `true`. Formatted according to `timestampFormat`.
- **Prefix**: Included if a `prefix` is configured for the logger.
- **LEVEL**: The log level (e.g., INFO, ERROR), optionally colorized.
- **Message**: The main log message.
- **Metadata**: Any additional data objects passed to the log method, serialized as JSON.

### Examples

**Standard Log:**
```text
[2025-01-23 10:22:20] [INFO] Server started on port 3000
```

**With Prefix and Metadata:**
```text
[2025-01-23 10:22:20] [API] [ERROR] Database connection failed {"host":"localhost","port":5432}
```

---

## JSON Format

The JSON format is structured and machine-readable, making it perfect for production environments, log aggregators (like ELK, Datadog), and cloud logging services.

### Structure

Each log entry is a single JSON object on a new line. Unlike some other loggers that nest metadata in a `data` field, `zario` **spreads metadata fields into the root of the JSON object** for easier querying.

### Fields

- `level`: The log level (string).
- `message`: The log message (string).
- `timestamp`: The ISO 8601 timestamp (included if `timestamp: true`).
- `prefix`: The logger prefix (included if configured).
- `...metadata`: Any key-value pairs from the metadata object are included at the root level.

### Examples

**Basic JSON Log:**
```json
{"level":"info","message":"User logged in","timestamp":"2025-01-23T10:22:20.000Z"}
```

**JSON Log with Metadata:**
```json
{"level":"error","message":"Request failed","timestamp":"2025-01-23T10:22:25.000Z","path":"/api/users","status":500,"userId":"12345"}
```

---

## Timestamp Formatting

You can customize the timestamp format using the `timestampFormat` option.

### Supported Tokens

- `YYYY`: 4-digit year (e.g., 2025)
- `MM`: 2-digit month (01-12)
- `DD`: 2-digit day (01-31)
- `HH`: 2-digit hour (00-23)
- `mm`: 2-digit minute (00-59)
- `ss`: 2-digit second (00-59)
- `SSS`: 3-digit millisecond (000-999)

### Presets

In addition to custom strings, you can use these special presets:
- `ISO`: `2025-01-23T10:22:20.000Z`
- `UTC`: `Thu, 23 Jan 2025 10:22:20 GMT`
- `LOCAL`: Uses the system's local date/time string.

---

## Color Support

When `colorize` is enabled (default in development), `zario` uses ANSI color codes for console output.

### Supported Colors

You can use these colors in `customColors`:

| Basic Colors | Bright Colors | Level Colors |
| :--- | :--- | :--- |
| `black` | `brightRed` | `info` (Green) |
| `red` | `brightGreen` | `warn` (Yellow) |
| `green` | `brightYellow` | `error` (Red) |
| `yellow` | `brightBlue` | `debug` (Cyan) |
| `blue` | `brightMagenta` | `boring` (White) |
| `magenta` | `brightCyan` | |
| `cyan` | `brightWhite` | |
| `white` | | |

### Environment Detection

`zario` automatically detects if the terminal supports colors. You can force colors on or off using environment variables:
- `FORCE_COLOR=1`: Force color support.
- `FORCE_COLOR=0`: Disable color support.
