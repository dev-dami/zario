# Introduction to Zario

Zario is a minimal, blazing-fast, and feature-rich logging library for Node.js. Built from the ground up with TypeScript, it provides a powerful yet intuitive API for both simple applications and complex distributed systems.

## Philosophy

The goal of Zario is to provide a logging solution that is:
1. **Lightweight**: Zero dependencies and a tiny footprint.
2. **Performant**: Optimized for high-throughput applications with non-blocking asynchronous mode.
3. **Flexible**: Highly customizable through transports, filters, and enrichers.
4. **Developer-Friendly**: Intuitive API with first-class TypeScript support.

## Core Features

- **⚡ High Performance**: Minimal overhead with optimized serialization and optional asynchronous logging.
- **🎨 Beautiful Formatting**: Colorized console output for development and structured JSON for production.
- **📁 Pluggable Transports**: Log to Console, Files (with rotation and compression), HTTP endpoints, or build your own.
- **🧩 Contextual Logging**: Create child loggers to maintain execution context across modules or requests.
- **🔍 Advanced Filtering**: Sophisticated logic to filter logs based on levels, prefixes, metadata, or custom predicates.
- **🏗️ Structured Logging**: Enrich logs with static or dynamic metadata using a pluggable pipeline.
- **📊 Log Aggregation**: Batch or time-based aggregation for efficient log processing.

## Use Cases

Zario is designed to excel in various environments:

### 🌐 Web Servers & APIs
Record incoming requests, server-side errors, and performance metrics. Perfect for Express, Fastify, and Koa. Use request-scoped child loggers to trace execution flow.

### ⚡ Serverless Functions
Log invocation details and execution steps in short-lived environments like AWS Lambda or Vercel with minimal cold-start impact.

### 🏗️ Microservices
Collect and centralize logs from multiple services. Use structured JSON output for easy ingestion into ELK, Datadog, or New Relic.

### 🔧 CLI Applications
Provide clear, colorized output to users while maintaining detailed debug logs in the background.

### ⚙️ Background Jobs
Track progress and status of long-running tasks or scheduled cron jobs with automatic execution time measurement.

---

[← Home](../README.md) | [Getting Started →](./getting-started.md)
