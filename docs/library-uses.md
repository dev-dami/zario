# Uses for zario

`zario` is a flexible logging tool for a variety of Node.js applications. Its minimal overhead and rich features make it suitable for different environments and needs.

## Common Use Cases

* **Web Servers & APIs**: Record incoming requests, server-side errors, performance metrics, and application flow. This is essential for monitoring the health and behavior of web services.
* **Command-Line Tools (CLI)**: Provide clear output to users, showing progress, warnings, and error messages. This improves the user experience and helps with debugging CLI applications.
* **Background Jobs**: Track the execution, progress, and status of scheduled or long-running background tasks. This ensures visibility into asynchronous operations and helps identify issues.
* **Microservices**: Collect and centralize logs from multiple interconnected services. This makes debugging, tracing, and monitoring across a distributed architecture easier.
* **Development & Testing**: Change log levels to get more or less detail during development and testing. This helps developers focus on relevant information and quickly spot issues without excessive noise.
* **Request-Scoped Logging**: Attach request IDs or user context to logs using child loggers. This helps trace individual requests, debug issues faster, and follow execution flow across different modules.
* **Serverless Functions**: Log invocation details, execution steps, and errors in short-lived environments like AWS Lambda or Vercel. This improves observability and simplifies debugging in stateless deployments.
