import { Logger } from "../src/core/Logger.js";
import { MemoryQueueProvider } from "../src/core/LogQueue.js";
import { ConsoleTransport } from "../src/transports/ConsoleTransport.js";
import { RetryTransport } from "../src/transports/RetryTransport.js";

Logger.defaultQueueProviderFactory = (options) => new MemoryQueueProvider(options);
Logger.defaultTransportsFactory = (isProd: boolean) => {
  if (isProd) {
    return [new ConsoleTransport()];
  } else {
    return [new ConsoleTransport()];
  }
};
Logger.retryTransportFactory = (options) => new RetryTransport(options);
