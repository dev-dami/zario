// The small core. Nothing here runs at import time, so bundlers keep only what an app uses.
// Transports, filters and the rest are separate entry points, and "zario/full" has everything.
import { Logger } from "./core/Logger.js";

export { Logger, zario } from "./core/Logger.js";
export { ConsoleTransport } from "./transports/ConsoleTransport.js";

export type { LogLevel } from "./core/LogLevel.js";
export type { LoggerOptions, LogInput, LogDetails, LogMethod, LoggerRetryOptions, RetryTransportFactory } from "./core/Logger.js";
export type { Transport } from "./transports/Transport.js";
export type { LogData, TransportConfig, LoggerConfig } from "./types/index.js";
export type { Filter } from "./filters/Filter.js";
export type { LogAggregator } from "./aggregation/LogAggregator.js";
export type { LogEnricher } from "./structured/StructuredExtensions.js";
export type { RedactOptions } from "./utils/Redactor.js";
export type { QueueProvider, MemoryQueueOptions, OverflowStrategy } from "./core/LogQueue.js";
export default Logger;
