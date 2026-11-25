# Roadmap

We are continuously working on enhancing Zario to provide robust and flexible logging capabilities for the Node.js ecosystem.

## Completed Features
- **Console & File Transports**: Reliable local logging with rotation and compression.
- **HTTP Transport**: Remote log ingestion with retry logic.
- **Child Loggers**: Hierarchical context and configuration inheritance.
- **Asynchronous Mode**: Non-blocking I/O for high-performance apps.
- **Advanced Filtering**: Sophisticated logic for granular log control.
- **Structured Logging**: Powerful enrichment pipeline for metadata.
- **Log Aggregation**: Batch and time-based processing.
- **Syslog, WebSocket and Elasticsearch transports**: Ship logs to existing systems, and stream them live.
- **Field encryption**: AES-256-GCM for selected metadata fields.
- **Small core**: The root import holds only the logger. Everything else is a separate entry point.

## Future Plans

### Native Integrations
- **Database Transports**: Built-in transports for MongoDB, Redis, and PostgreSQL.

### Features
- **Performance Metrics**: Built-in dashboard for throughput and latency statistics.
- **React Native Support**: Bringing Zario to mobile development.

### Optimizations
- **Zero-Allocation Logging**: Exploring techniques to further reduce GC pressure.
- **Enhanced Querying**: Utilities for parsing and searching local log files.

---

## Community Feedback
Have a feature request or found a bug? We'd love to hear from you!
- [Open an Issue](https://github.com/Dev-Dami/zario/issues)
- [Join the Discussion](https://github.com/Dev-Dami/zario/discussions)

---

[← Log Formats](./log-formats.md) | [Benchmarks →](./benchmarks.md)
