/**
 * OpenTelemetry context data extracted from active span
 */
export interface OTelContext {
  traceId?: string;
  spanId?: string;
  traceFlags?: number;
  parentSpanId?: string;
  baggage?: Record<string, string>;
}

/**
 * Configuration options for the OpenTelemetry enricher
 */
export interface OTelEnricherOptions {
  /** Field name for trace ID in log metadata. Default: 'trace_id' */
  traceIdField?: string;
  /** Field name for span ID in log metadata. Default: 'span_id' */
  spanIdField?: string;
  /** Field name for trace flags in log metadata. Default: 'trace_flags' */
  traceFlagsField?: string;
  /** Field name for parent span ID in log metadata. Default: 'parent_span_id' */
  parentSpanIdField?: string;
  /** Field name for baggage in log metadata. Default: 'baggage' */
  baggageField?: string;
  /** Whether to include OTel baggage in logs. Default: false */
  includeBaggage?: boolean;
  /** Whether to include parent span ID in logs. Default: false */
  includeParentSpan?: boolean;
  /** Whether to include trace flags in logs. Default: false */
  includeTraceFlags?: boolean;
}

/**
 * Interface for OpenTelemetry context providers
 * Allows custom implementations or mocking for tests
 */
export interface OTelContextProvider {
  /** Get current trace context from active span */
  getContext(): OTelContext | null;
  /** Check if OpenTelemetry API is available */
  isAvailable(): boolean;
}

/**
 * Request-scoped context data for AsyncLocalStorage
 */
export interface RequestContextData {
  /** Unique identifier for the request */
  requestId?: string;
  /** User ID from authentication */
  userId?: string;
  /** Tenant ID for multi-tenant applications */
  tenantId?: string;
  /** Correlation ID for distributed tracing */
  correlationId?: string;
  /** Session ID */
  sessionId?: string;
  /** Additional custom context fields */
  [key: string]: unknown;
}
