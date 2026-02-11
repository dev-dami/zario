import { LogLevel } from "../core/LogLevel";
import { CustomLogLevelConfig } from "../core/CustomLogLevel";
import type { LoggerRetryOptions } from "../core/Logger";
import { Transport } from "../transports/Transport";
import { CompressionType } from "../transports";
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

// Legacy transport options (backward compat)
export interface LegacyTransportOptions {
  type: "console" | "file" | "http" | "custom";
  options?: {
    path?: string;
    colorize?: boolean;
    maxSize?: number;
    maxFiles?: number;
    compression?: CompressionType;
    batchInterval?: number;
    compressOldFiles?: boolean;
    url?: string;
    method?: string;
    headers?: Record<string, string>;
    timeout?: number;
    retries?: number;
  };
  instance?: Transport;
}

// Union type supporting legacy configs and direct transport instances
export type TransportConfig = LegacyTransportOptions | Transport;

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
