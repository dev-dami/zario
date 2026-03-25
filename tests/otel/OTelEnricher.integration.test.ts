import {
  Logger,
  MetadataEnricher,
  LogEnrichmentPipeline,
  RequestContext,
  setOTelProvider,
  resetOTelProvider,
} from '../../src/index';
import type { OTelContext, OTelContextProvider } from '../../src/types/OpenTelemetryTypes';
import type { LogData } from '../../src/types/index';

class MockTransport {
  public logs: LogData[] = [];

  write(data: LogData): void {
    this.logs.push(data);
  }

  clear(): void {
    this.logs = [];
  }
}

describe('OpenTelemetry Enricher Integration', () => {
  let mockTransport: MockTransport;
  let mockOTelContext: OTelContext;
  let mockProvider: OTelContextProvider;

  beforeEach(() => {
    mockTransport = new MockTransport();
    mockOTelContext = {
      traceId: 'abc123def456789012345678901234567890',
      spanId: '1234567890abcdef',
      traceFlags: 1,
      parentSpanId: 'parent1234567890',
      baggage: {
        userId: 'user-123',
        environment: 'test',
      },
    };
    mockProvider = {
      isAvailable: () => true,
      getContext: () => mockOTelContext,
    };
    setOTelProvider(mockProvider);
  });

  afterEach(() => {
    resetOTelProvider();
  });

  describe('MetadataEnricher.addOpenTelemetryContext', () => {
    it('should inject trace_id and span_id with default field names', () => {
      const logger = new Logger({
        transports: [mockTransport as any],
        enrichers: new LogEnrichmentPipeline([
          MetadataEnricher.addOpenTelemetryContext(),
        ]),
      });

      logger.info('Test message');

      expect(mockTransport.logs).toHaveLength(1);
      const metadata = mockTransport.logs[0].metadata;
      expect(metadata?.trace_id).toBe('abc123def456789012345678901234567890');
      expect(metadata?.span_id).toBe('1234567890abcdef');
    });

    it('should use custom field names', () => {
      const logger = new Logger({
        transports: [mockTransport as any],
        enrichers: new LogEnrichmentPipeline([
          MetadataEnricher.addOpenTelemetryContext({
            traceIdField: 'traceID',
            spanIdField: 'spanID',
          }),
        ]),
      });

      logger.info('Test message');

      const metadata = mockTransport.logs[0].metadata;
      expect(metadata?.traceID).toBe('abc123def456789012345678901234567890');
      expect(metadata?.spanID).toBe('1234567890abcdef');
      expect(metadata?.trace_id).toBeUndefined();
    });

    it('should include trace flags when enabled', () => {
      const logger = new Logger({
        transports: [mockTransport as any],
        enrichers: new LogEnrichmentPipeline([
          MetadataEnricher.addOpenTelemetryContext({
            includeTraceFlags: true,
          }),
        ]),
      });

      logger.info('Test message');

      const metadata = mockTransport.logs[0].metadata;
      expect(metadata?.trace_flags).toBe(1);
    });

    it('should not include trace flags by default', () => {
      const logger = new Logger({
        transports: [mockTransport as any],
        enrichers: new LogEnrichmentPipeline([
          MetadataEnricher.addOpenTelemetryContext(),
        ]),
      });

      logger.info('Test message');

      const metadata = mockTransport.logs[0].metadata;
      expect(metadata?.trace_flags).toBeUndefined();
    });

    it('should include parent span ID when enabled', () => {
      const logger = new Logger({
        transports: [mockTransport as any],
        enrichers: new LogEnrichmentPipeline([
          MetadataEnricher.addOpenTelemetryContext({
            includeParentSpan: true,
          }),
        ]),
      });

      logger.info('Test message');

      const metadata = mockTransport.logs[0].metadata;
      expect(metadata?.parent_span_id).toBe('parent1234567890');
    });

    it('should include baggage when enabled', () => {
      const logger = new Logger({
        transports: [mockTransport as any],
        enrichers: new LogEnrichmentPipeline([
          MetadataEnricher.addOpenTelemetryContext({
            includeBaggage: true,
          }),
        ]),
      });

      logger.info('Test message');

      const metadata = mockTransport.logs[0].metadata;
      expect(metadata?.baggage).toEqual({
        userId: 'user-123',
        environment: 'test',
      });
    });

    it('should not modify logs when no OTel context available', () => {
      setOTelProvider({
        isAvailable: () => false,
        getContext: () => null,
      });

      const logger = new Logger({
        transports: [mockTransport as any],
        enrichers: new LogEnrichmentPipeline([
          MetadataEnricher.addOpenTelemetryContext(),
        ]),
      });

      logger.info('Test message', { existingField: 'value' });

      const metadata = mockTransport.logs[0].metadata;
      expect(metadata?.trace_id).toBeUndefined();
      expect(metadata?.span_id).toBeUndefined();
      expect(metadata?.existingField).toBe('value');
    });

    it('should preserve existing metadata', () => {
      const logger = new Logger({
        transports: [mockTransport as any],
        enrichers: new LogEnrichmentPipeline([
          MetadataEnricher.addOpenTelemetryContext(),
        ]),
      });

      logger.info('Test message', { customField: 'customValue', count: 42 });

      const metadata = mockTransport.logs[0].metadata;
      expect(metadata?.trace_id).toBe('abc123def456789012345678901234567890');
      expect(metadata?.customField).toBe('customValue');
      expect(metadata?.count).toBe(42);
    });
  });

  describe('MetadataEnricher.addRequestContext', () => {
    it('should inject request context fields', () => {
      const logger = new Logger({
        transports: [mockTransport as any],
        enrichers: new LogEnrichmentPipeline([
          MetadataEnricher.addRequestContext(),
        ]),
      });

      RequestContext.run(
        { requestId: 'req-123', userId: 'user-456' },
        () => {
          logger.info('Test message');
        }
      );

      const metadata = mockTransport.logs[0].metadata;
      expect(metadata?.requestId).toBe('req-123');
      expect(metadata?.userId).toBe('user-456');
    });

    it('should filter specific fields when specified', () => {
      const logger = new Logger({
        transports: [mockTransport as any],
        enrichers: new LogEnrichmentPipeline([
          MetadataEnricher.addRequestContext(['requestId']),
        ]),
      });

      RequestContext.run(
        { requestId: 'req-123', userId: 'user-456', tenantId: 'tenant-789' },
        () => {
          logger.info('Test message');
        }
      );

      const metadata = mockTransport.logs[0].metadata;
      expect(metadata?.requestId).toBe('req-123');
      expect(metadata?.userId).toBeUndefined();
      expect(metadata?.tenantId).toBeUndefined();
    });

    it('should not modify logs when no request context', () => {
      const logger = new Logger({
        transports: [mockTransport as any],
        enrichers: new LogEnrichmentPipeline([
          MetadataEnricher.addRequestContext(),
        ]),
      });

      logger.info('Test message', { existingField: 'value' });

      const metadata = mockTransport.logs[0].metadata;
      expect(metadata?.requestId).toBeUndefined();
      expect(metadata?.existingField).toBe('value');
    });
  });

  describe('Combined OTel and RequestContext', () => {
    it('should include both OTel and request context', () => {
      const logger = new Logger({
        transports: [mockTransport as any],
        enrichers: new LogEnrichmentPipeline([
          MetadataEnricher.addOpenTelemetryContext(),
          MetadataEnricher.addRequestContext(),
        ]),
      });

      RequestContext.run({ requestId: 'req-123' }, () => {
        logger.info('Test message');
      });

      const metadata = mockTransport.logs[0].metadata;
      expect(metadata?.trace_id).toBe('abc123def456789012345678901234567890');
      expect(metadata?.span_id).toBe('1234567890abcdef');
      expect(metadata?.requestId).toBe('req-123');
    });

    it('should work with child loggers', () => {
      const parentLogger = new Logger({
        transports: [mockTransport as any],
        enrichers: new LogEnrichmentPipeline([
          MetadataEnricher.addOpenTelemetryContext(),
        ]),
      });

      const childLogger = parentLogger.createChild({
        context: { service: 'child-service' },
      });

      childLogger.info('Child log');

      const metadata = mockTransport.logs[0].metadata;
      expect(metadata?.trace_id).toBe('abc123def456789012345678901234567890');
      expect(metadata?.service).toBe('child-service');
    });
  });

  describe('Real-world usage patterns', () => {
    it('should work with Express-style middleware pattern', () => {
      const logger = new Logger({
        transports: [mockTransport as any],
        enrichers: new LogEnrichmentPipeline([
          MetadataEnricher.addOpenTelemetryContext(),
          MetadataEnricher.addRequestContext(),
        ]),
      });

      const simulateRequest = (
        requestId: string,
        userId: string,
        handler: () => void
      ) => {
        RequestContext.run({ requestId, userId }, handler);
      };

      simulateRequest('req-001', 'user-alice', () => {
        logger.info('Processing request');
        logger.warn('Slow database query');
      });

      simulateRequest('req-002', 'user-bob', () => {
        logger.info('Another request');
      });

      expect(mockTransport.logs).toHaveLength(3);
      expect(mockTransport.logs[0].metadata?.requestId).toBe('req-001');
      expect(mockTransport.logs[0].metadata?.userId).toBe('user-alice');
      expect(mockTransport.logs[1].metadata?.requestId).toBe('req-001');
      expect(mockTransport.logs[2].metadata?.requestId).toBe('req-002');
      expect(mockTransport.logs[2].metadata?.userId).toBe('user-bob');

      mockTransport.logs.forEach((log) => {
        expect(log.metadata?.trace_id).toBe(
          'abc123def456789012345678901234567890'
        );
      });
    });
  });
});
