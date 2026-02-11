import { Logger } from "./core/Logger.js";
import { ConsoleTransport } from "./transports/ConsoleTransport.js";
import { FileTransport } from "./transports/FileTransport.js";
import { RetryTransport } from "./transports/RetryTransport.js";

// Configure default transports to maintain backward compatibility
Logger.defaultTransportsFactory = (isProd: boolean) => {
  if (isProd) {
    return [new ConsoleTransport(), new FileTransport({ path: "./logs/app.log" })];
  } else {
    return [new ConsoleTransport()];
  }
};
Logger.retryTransportFactory = (options) => new RetryTransport(options);

export { Logger } from "./core/Logger.js";
export { ConsoleTransport } from "./transports/ConsoleTransport.js";
export { FileTransport } from "./transports/FileTransport.js";
export { HttpTransport } from "./transports/HttpTransport.js";
export { FilterableTransport } from "./transports/FilterableTransport.js";
export { RetryTransport } from "./transports/RetryTransport.js";
export { CircuitBreakerTransport } from "./transports/CircuitBreakerTransport.js";
export { DeadLetterQueue } from "./transports/DeadLetterQueue.js";
export {
  CompositeFilter,
  OrFilter,
  NotFilter,
  PredicateFilter,
  LevelFilter,
  PrefixFilter,
  MetadataFilter,
  FieldFilter,
} from "./filters/Filter.js";
export {
  BatchAggregator,
  TimeBasedAggregator,
  CompositeAggregator,
} from "./aggregation/LogAggregator.js";
export {
  MetadataEnricher,
  LogEnrichmentPipeline,
} from "./structured/StructuredExtensions.js";
export { Timer } from "./utils/Timer.js";

export type { LogLevel } from "./core/LogLevel.js";
export type { LoggerOptions, LoggerRetryOptions, RetryTransportFactory } from "./core/Logger.js";
export type { Transport } from "./transports/Transport.js";
export type { TransportConfig, LoggerConfig } from "./types/index.js";
export type { CustomLogLevelConfig } from "./core/CustomLogLevel.js";
export type { Filter } from "./filters/Filter.js";
export type { LogAggregator } from "./aggregation/LogAggregator.js";
export type { LogEnricher } from "./structured/StructuredExtensions.js";
export default Logger;
