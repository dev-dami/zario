import { LogData } from '../types/index.js';
import * as os from 'os';
import type { OTelEnricherOptions, RequestContextData } from '../types/OpenTelemetryTypes.js';
import { getOTelProvider } from '../otel/OTelContextProvider.js';
import { RequestContext } from '../context/RequestContext.js';

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

  static addContext = MetadataEnricher.addStaticFields;

  static addProcessInfo(): LogEnricher {
    return (logData: LogData) => {
      return {
        ...logData,
        metadata: {
          ...logData.metadata,
          pid: process.pid,
          hostname: os.hostname(),
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

  static addOpenTelemetryContext(options: OTelEnricherOptions = {}): LogEnricher {
    const {
      traceIdField = 'trace_id',
      spanIdField = 'span_id',
      traceFlagsField = 'trace_flags',
      parentSpanIdField = 'parent_span_id',
      baggageField = 'baggage',
      includeBaggage = false,
      includeParentSpan = false,
      includeTraceFlags = false,
    } = options;

    const provider = getOTelProvider();

    return (logData: LogData) => {
      const ctx = provider.getContext();
      if (!ctx || !ctx.traceId) return logData;

      const fields: Record<string, unknown> = {
        [traceIdField]: ctx.traceId,
        [spanIdField]: ctx.spanId,
      };

      if (includeTraceFlags && ctx.traceFlags !== undefined) {
        fields[traceFlagsField] = ctx.traceFlags;
      }

      if (includeParentSpan && ctx.parentSpanId) {
        fields[parentSpanIdField] = ctx.parentSpanId;
      }

      if (includeBaggage && ctx.baggage && Object.keys(ctx.baggage).length > 0) {
        fields[baggageField] = ctx.baggage;
      }

      return {
        ...logData,
        metadata: { ...logData.metadata, ...fields }
      };
    };
  }

  static addRequestContext(fields?: (keyof RequestContextData)[]): LogEnricher {
    return (logData: LogData) => {
      const ctx = RequestContext.getAll();
      if (Object.keys(ctx).length === 0) return logData;

      const filtered = fields
        ? Object.fromEntries(
            Object.entries(ctx).filter(([k]) => fields.includes(k as keyof RequestContextData))
          )
        : ctx;

      if (Object.keys(filtered).length === 0) return logData;

      return {
        ...logData,
        metadata: { ...logData.metadata, ...filtered }
      };
    };
  }
}

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
    const enrichers = this.enrichers;
    const len = enrichers.length;
    let data = logData;
    for (let i = 0; i < len; i++) {
      const enricher = enrichers[i];
      if (enricher) {
        data = enricher(data);
      }
    }
    return data;
  }

  getEnrichers(): LogEnricher[] {
    return [...this.enrichers];
  }
}