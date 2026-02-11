import { Logger } from "../../src/core/Logger";
import { RetryTransport } from "../../src/transports/RetryTransport";
import { Transport } from "../../src/transports/Transport";
import { Formatter } from "../../src/core/Formatter";
import { LogData } from "../../src/types";

class MockTransport implements Transport {
  write(_data: LogData, _formatter: Formatter): void {}
}

describe("Logger Retry Factory Injection", () => {
  const originalFactory = Logger.retryTransportFactory;

  afterEach(() => {
    Logger.retryTransportFactory = originalFactory;
  });

  test("does not wrap transports when retry factory is not configured", () => {
    Logger.retryTransportFactory = null;
    const mockTransport = new MockTransport();

    const logger = new Logger({
      transports: [mockTransport],
      retryOptions: {
        maxAttempts: 2,
      },
    });

    expect(logger.getTransports()[0]).toBe(mockTransport);
  });

  test("wraps transports when retry factory is configured", () => {
    Logger.retryTransportFactory = (options) => new RetryTransport(options);
    const mockTransport = new MockTransport();

    const logger = new Logger({
      transports: [mockTransport],
      retryOptions: {
        maxAttempts: 2,
        baseDelay: 1,
        maxDelay: 2,
        jitter: false,
      },
    });

    expect(logger.getTransports()[0]).toBeInstanceOf(RetryTransport);
  });
});
