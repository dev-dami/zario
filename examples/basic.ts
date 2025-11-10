import { Logger } from "../src";

// Create a logger instance
const logger = new Logger({
  level: "info",
  colorize: true,
  json: false,
  transports: [
    { type: "console" },
    { type: "file", options: { path: "./logs/app.log" } },
  ],
  timestampFormat: "YYYY-MM-DD HH:mm:ss",
});

// Basic logs
logger.info("Server started");
logger.warn("Low disk space");
logger.error("Unhandled exception", { code: 500, route: "/api/user" });
logger.debug("Cache miss", { key: "user:1234" });

// JSON structured logging (switching mode dynamically)
logger.setFormat("json");
logger.info("User login", { userId: 42, ip: "127.0.0.1" });

// Optional static shortcut
Logger.global.info("Something global happened");
