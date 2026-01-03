# Features of Zario

`zario` is a minimal, fast, and feature-rich logging library for Node.js.  
It offers a strong set of features to meet various logging needs efficiently.

## Core Features

- **Lightweight and Fast**: Built for minimal overhead to ensure high performance.
- **Multiple Transports**: Log to the console, files, HTTP endpoints, or custom destinations.
- **Customizable Formatting**: Choose between simple text or structured JSON logging.
- **Dynamic Log Levels**: Change log verbosity in real-time with 7 built-in levels: `silent`, `boring`, `debug`, `info`, `warn`, `error`, and `fatal`.
- **Customizable Prefix**: Add a unique prefix to log messages.
- **Optional Timestamps**: Include or exclude timestamps as needed.

## Advanced Features

- **File Rotation**: Automatically manage log file sizes with `maxSize` and `maxFiles` configuration.
- **Compression Support**: Compress rotated log files using `gzip` (`.gz`) or `deflate` (`.zz`).
- **Log Batching**: Efficiently batch log writes to reduce I/O operations with configurable intervals.
- **TypeScript Support**: Developed with TypeScript for type safety and a better developer experience.
- **Advanced Filtering**: Filter logs using powerful filter classes such as `LevelFilter`, `PrefixFilter`, and more.
- **Structured Logging**: Enhance logs with metadata enrichers that add static fields, dynamic fields, process information, and environment details.
- **Child Logger Inheritance**: Child loggers inherit settings, filters, and enrichers from parent loggers while allowing overrides.

## Extended Features

- **Custom Log Levels**: Define custom log levels with specific priorities and colors for granular logging control.
- **HTTP Transport**: Send logs to remote HTTP or HTTPS endpoints with retry logic, timeout handling, and custom headers.
- **Log Aggregation**: Aggregate logs using `BatchAggregator`, `TimeBasedAggregator`, or `CompositeAggregator` for efficient batch processing.
- **Performance Timer**: Built-in timer utility for measuring execution time with automatic logging.

For detailed usage examples, refer to the [Usage Guide](./usage.md).
