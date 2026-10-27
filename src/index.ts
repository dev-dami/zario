import { Logger } from "./core/Logger.js";
import { ConsoleTransport } from "./transports/ConsoleTransport.js";
import { FileTransport } from "./transports/FileTransport.js";
import { RetryTransport } from "./transports/RetryTransport.js";
import { MemoryQueueProvider } from "./core/LogQueue.js";

// Configure default transports to maintain backward compatibility
Logger.defaultTransportsFactory = (isProd: boolean) => {
  if (isProd) {
    // A read-only filesystem (for example a locked-down container) must not crash the app at startup.
    try {
      return [new ConsoleTransport(), new FileTransport({ path: "./logs/app.log" })];
    } catch (error) {
      console.error("zario: cannot create ./logs/app.log, so logs go to the console only:", error);
      return [new ConsoleTransport()];
    }
  } else {
    return [new ConsoleTransport()];
  }
};
Logger.retryTransportFactory = (options) => new RetryTransport(options);
Logger.defaultQueueProviderFactory = (options) => new MemoryQueueProvider(options);

export { Logger, zario } from "./core/Logger.js";
export { ConsoleTransport } from "./transports/ConsoleTransport.js";
export { FileTransport } from "./transports/FileTransport.js";
export { HttpTransport } from "./transports/HttpTransport.js";
export { FilterableTransport } from "./transports/FilterableTransport.js";
export { RetryTransport } from "./transports/RetryTransport.js";
export { CircuitBreakerTransport } from "./transports/CircuitBreakerTransport.js";
export { DeadLetterQueue } from "./transports/DeadLetterQueue.js";
export { SyslogTransport, SYSLOG_SEVERITIES } from "./transports/SyslogTransport.js";
export { WebSocketTransport } from "./transports/WebSocketTransport.js";
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
export { Redactor } from "./utils/Redactor.js";
export { RequestContext } from "./context/RequestContext.js";
export { MemoryQueueProvider } from "./core/LogQueue.js";
export type { QueueProvider, MemoryQueueOptions, OverflowStrategy } from "./core/LogQueue.js";
export {
  getOTelProvider,
  setOTelProvider,
  resetOTelProvider,
  NoOpProvider,
  DefaultOTelProvider,
} from "./otel/OTelContextProvider.js";

export type { LogLevel } from "./core/LogLevel.js";
export type { LoggerOptions, LogInput, LogDetails, LoggerRetryOptions, RetryTransportFactory } from "./core/Logger.js";
export type { Transport } from "./transports/Transport.js";
export type { SyslogTransportOptions, SyslogProtocol, SyslogFormat, SyslogFacility } from "./transports/SyslogTransport.js";
export type { WebSocketTransportOptions, WebSocketLike } from "./transports/WebSocketTransport.js";
export type { TransportConfig, LoggerConfig } from "./types/index.js";
export type { CustomLogLevelConfig } from "./core/CustomLogLevel.js";
export type { Filter } from "./filters/Filter.js";
export type { LogAggregator } from "./aggregation/LogAggregator.js";
export type { LogEnricher } from "./structured/StructuredExtensions.js";
export type { RedactOptions } from "./utils/Redactor.js";
export type {
  OTelContext,
  OTelEnricherOptions,
  OTelContextProvider,
  RequestContextData,
} from "./types/OpenTelemetryTypes.js";
export default Logger;
