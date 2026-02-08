import { Logger } from "../src";

const customTransport = {
  write(data: any, formatter: any) {
    const formatted = formatter.format(data);

    // Example: send logs to an external service
    console.log("[CUSTOM TRANSPORT]", formatted);
  },
};

const logger = new Logger({
  level: "info",
  prefix: "[WebApp]",
  timestamp: true,
  transports: [customTransport],
});

logger.info("Hello from custom transport", { userId: 42 });
logger.warn("This is a warning");
