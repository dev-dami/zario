import { LogData } from '../types/index.js';

/**
 * Interface for log enrichment functions
 */
export interface LogEnricher {
  (logData: LogData): LogData;
}

/**
 * Enriches logs with additional metadata
 */
export class MetadataEnricher {
  static addStaticFields(staticFields: { [key: string]: any }): LogEnricher {
    return (logData: LogData) => {
      return {
        ...logData,
        metadata: {
          ...logData.metadata,
          ...staticFields
        }
      };
    };
  }

  static addDynamicFields(dynamicFields: () => { [key: string]: any }): LogEnricher {
    return (logData: LogData) => {
      const fields = dynamicFields();
      return {
        ...logData,
        metadata: {
          ...logData.metadata,
          ...fields
        }
      };
    };
  }

  static addContext(context: { [key: string]: any }): LogEnricher {
    return (logData: LogData) => {
      return {
        ...logData,
        metadata: {
          ...logData.metadata,
          ...context
        }
      };
    };
  }

  static addProcessInfo(): LogEnricher {
    return (logData: LogData) => {
      return {
        ...logData,
        metadata: {
          ...logData.metadata,
          pid: process.pid,
          hostname: typeof process.env.HOSTNAME !== 'undefined' ? process.env.HOSTNAME : 'unknown',
          nodeVersion: process.version
        }
      };
    };
  }

  static addEnvironmentInfo(): LogEnricher {
    return (logData: LogData) => {
      return {
        ...logData,
        metadata: {
          ...logData.metadata,
          environment: process.env.NODE_ENV || 'development',
          platform: process.platform,
          arch: process.arch
        }
      };
    };
  }
}

/**
 * Applies a series of enrichers to a log record
 */
export class LogEnrichmentPipeline {
  private enrichers: LogEnricher[];

  constructor(enrichers: LogEnricher[] = []) {
    this.enrichers = enrichers;
  }

  add(enricher: LogEnricher): LogEnrichmentPipeline {
    this.enrichers.push(enricher);
    return this;
  }

  process(logData: LogData): LogData {
    return this.enrichers.reduce((data, enricher) => enricher(data), logData);
  }

  getEnrichers(): LogEnricher[] {
    return [...this.enrichers]; // Return a copy to prevent external modification
  }
}