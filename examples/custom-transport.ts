import { Logger } from "../src";
/**
 * Example: Custom Transport
 *
 * Demonstrates how to plug in a custom transport
 * for sending logs to external systems.
 */

/**
 * Custom transport that sends logs somewhere else
 * (file, DB, external service, etc.)
 */
const customTransport = {
  log(level: string, message: string, meta?: Record<string, unknown>) {
    // Example: send to external service
    console.log("[CUSTOM TRANSPORT]", {
      level,
      message,
      meta,
      timestamp: new Date().toISOString(),
    });
  },
};

const prefixedLogger = new Logger({
  level: "info",
  prefix: "[WebApp]",
  timestamp: true,
});

prefixedLogger.info("Application started");
prefixedLogger.warn("Low memory warning");
prefixedLogger.error("Something went wrong");