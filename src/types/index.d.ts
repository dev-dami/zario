import { LogLevel } from "../core/LogLevel";
import type { LoggerRetryOptions } from "../core/Logger";
import { Transport } from "../transports/Transport";
import { Filter } from "../filters/Filter";
import { LogAggregator } from "../aggregation/LogAggregator";
import { LogEnrichmentPipeline } from "../structured/StructuredExtensions";

export interface LogData {
  level: LogLevel;
  message: string;
  timestamp: Date;
  metadata?: Record<string, any> | undefined;
  prefix?: string;
}

// The Logger accepts only transport instances. The old { type, options } object configs
// were never read, so a logger configured with them wrote nowhere.
export type TransportConfig = Transport;

export interface LoggerConfig {
  level?: LogLevel;
  colorize?: boolean;
  json?: boolean;
  transports?: TransportConfig[];
  timestampFormat?: string;
  prefix?: string;
  timestamp?: boolean;
  async?: boolean;
  filters?: Filter[];
  aggregators?: LogAggregator[];
  enrichers?: LogEnrichmentPipeline;
  retryOptions?: LoggerRetryOptions;
}
