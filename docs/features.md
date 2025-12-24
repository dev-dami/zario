# Features of zario

`zario` is a minimal, fast, and feature-rich logging library for Node.js. It offers a strong set of features to meet various logging needs efficiently.

## Core Features

- **Lightweight and Fast**: Built for minimal overhead to ensure high performance.
- **Multiple Transports**: Log to the console, files, or custom destinations.
- **Customizable Formatting**: Choose between simple text or structured JSON logging.
- **Dynamic Log Levels**: Change log verbosity in real-time.
- **Customizable Prefix**: Add a unique prefix to log messages.
- **Optional Timestamps**: Include or exclude timestamps as needed.

## Advanced Features

- **File Rotation**: Automatically manage log file sizes with maxSize and maxFiles configuration.
- **Compression Support**: Compress rotated log files using gzip or deflate algorithms (.gz for gzip, .zz for deflate).
- **Log Batching**: Efficiently batch log writes to reduce I/O operations with configurable intervals.
- **TypeScript Support**: Developed with TypeScript for type safety and a better developer experience.
- **Advanced Filtering**: Filter logs using LevelFilter, PrefixFilter, MetadataFilter, CompositeFilter, OrFilter, and custom PredicateFilter with sophisticated logic.
- **Structured Logging**: Enhance logs with metadata enrichers that add static fields, dynamic fields, process information, and environment details.
- **Child Logger Inheritance**: Child loggers inherit settings, filters, and enrichers from parent loggers while allowing overrides.

For detailed usage examples, refer to the [Usage Guide](./usage.md).
