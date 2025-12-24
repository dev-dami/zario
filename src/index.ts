import { Logger } from './core/Logger.js';
import { LogLevel } from './core/LogLevel.js';
import { ConsoleTransport, FileTransport, HttpTransport, Transport, FilterableTransport } from './transports/index.js';
import { TransportConfig, LoggerConfig } from './types/index.js';
import { CustomLogLevelConfig } from './core/CustomLogLevel.js';
import {
  Filter,
  CompositeFilter,
  OrFilter,
  NotFilter,
  PredicateFilter,
  LevelFilter,
  PrefixFilter,
  MetadataFilter,
  FieldFilter
} from './filters/index.js';
import {
  LogAggregator,
  BatchAggregator,
  TimeBasedAggregator,
  CompositeAggregator
} from './aggregation/index.js';
import {
  LogEnricher,
  MetadataEnricher,
  LogEnrichmentPipeline
} from './structured/index.js';

// Configure default transports to maintain backward compatibility
Logger.defaultTransportsFactory = (isProd: boolean) => {
  if (isProd) {
    return [new ConsoleTransport(), new FileTransport({ path: "./logs/app.log" })];
  } else {
    return [new ConsoleTransport()];
  }
};

export {
  Logger,
  ConsoleTransport,
  FileTransport,
  HttpTransport,
  FilterableTransport,
  // Filters
  CompositeFilter,
  OrFilter,
  NotFilter,
  PredicateFilter,
  LevelFilter,
  PrefixFilter,
  MetadataFilter,
  FieldFilter,
  // Aggregators
  BatchAggregator,
  TimeBasedAggregator,
  CompositeAggregator,
  // Structured logging extensions
  MetadataEnricher,
  LogEnrichmentPipeline
};
export type {
  LogLevel,
  Transport,
  TransportConfig,
  LoggerConfig,
  CustomLogLevelConfig,
  Filter,
  LogAggregator,
  LogEnricher
};
export default Logger;
