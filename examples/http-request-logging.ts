import http from "http";
import { Logger, ConsoleTransport } from "../src";

const logger = new Logger({
  level: "info",
  transports: [new ConsoleTransport()],
  prefix: "[HTTP]",
});

const server = http.createServer((req, res) => {
  const requestId = Math.random().toString(36).slice(2);

  const requestLogger = logger.createChild({
    prefix: `[${req.method} ${req.url}]`,
    context: { requestId },
  });

  requestLogger.info("Incoming request");

  try {
    // Simulate work
    if (req.url === "/error") {
      throw new Error("Simulated failure");
    }

    res.writeHead(200);
    res.end("OK");

    requestLogger.info("Request completed successfully");
  } catch (error) {
    requestLogger.error("Request failed", error);
    res.writeHead(500);
    res.end("Internal Server Error");
  }
});

server.listen(3000, () => {
  logger.info("Server listening on port 3000");
});
