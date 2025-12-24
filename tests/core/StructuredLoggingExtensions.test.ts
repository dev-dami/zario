import { Logger } from '../../src/core/Logger';
import { LogLevel } from '../../src/core/LogLevel';
import { Transport } from '../../src/transports/Transport';
import { Formatter } from '../../src/core/Formatter';
import { LogData } from '../../src/types';
import { 
  LogEnricher,
  MetadataEnricher,
  LogEnrichmentPipeline
} from '../../src/structured';
import { MockTransport } from '../testUtils';

describe('Structured Logging Extensions', () => {
  let logger: Logger;
  let mockTransport: MockTransport;

  beforeEach(() => {
    mockTransport = new MockTransport();
    logger = new Logger({
      level: 'debug',
      transports: [mockTransport],
      enrichers: new LogEnrichmentPipeline()
    });
  });

  describe('MetadataEnricher', () => {
    it('should add static fields to log metadata', () => {
      const enricher = MetadataEnricher.addStaticFields({ 
        environment: 'test', 
        version: '1.0.0' 
      });
      
      logger.addEnricher(enricher);
      
      logger.info('Test message', { userId: 123 });
      
      expect(mockTransport.logs.length).toBe(1);
      expect(mockTransport.logs[0]!.metadata).toEqual({
        userId: 123,
        environment: 'test',
        version: '1.0.0'
      });
    });

    it('should add dynamic fields to log metadata', () => {
      const counter = { value: 0 };
      const enricher = MetadataEnricher.addDynamicFields(() => {
        counter.value++;
        return { sequence: counter.value, timestamp: Date.now() };
      });
      
      logger.addEnricher(enricher);
      
      logger.info('First message');
      logger.info('Second message');
      
      expect(mockTransport.logs.length).toBe(2);
      expect(mockTransport.logs[0]!.metadata!.sequence).toBe(1);
      expect(mockTransport.logs[1]!.metadata!.sequence).toBe(2);
    });

    it('should add context to log metadata', () => {
      const enricher = MetadataEnricher.addContext({ 
        service: 'user-service',
        team: 'auth-team'
      });
      
      logger.addEnricher(enricher);
      
      logger.info('Test message', { action: 'login' });
      
      expect(mockTransport.logs.length).toBe(1);
      expect(mockTransport.logs[0]!.metadata).toEqual({
        action: 'login',
        service: 'user-service',
        team: 'auth-team'
      });
    });

    it('should add process info to log metadata', () => {
      const enricher = MetadataEnricher.addProcessInfo();
      logger.addEnricher(enricher);
      
      logger.info('Test message');
      
      expect(mockTransport.logs.length).toBe(1);
      const metadata = mockTransport.logs[0]!.metadata!;
      expect(metadata.pid).toBeDefined();
      expect(metadata.hostname).toBeDefined();
      expect(metadata.nodeVersion).toBeDefined();
    });

    it('should add environment info to log metadata', () => {
      const enricher = MetadataEnricher.addEnvironmentInfo();
      logger.addEnricher(enricher);
      
      logger.info('Test message');
      
      expect(mockTransport.logs.length).toBe(1);
      const metadata = mockTransport.logs[0]!.metadata!;
      expect(metadata.environment).toBeDefined();
      expect(metadata.platform).toBeDefined();
      expect(metadata.arch).toBeDefined();
    });
  });

  describe('LogEnrichmentPipeline', () => {
    it('should apply multiple enrichers in sequence', () => {
      const pipeline = new LogEnrichmentPipeline();
      
      pipeline.add(MetadataEnricher.addStaticFields({ step: 1 }));
      pipeline.add(MetadataEnricher.addStaticFields({ step: 2 })); // This should override step: 1
      
      logger = new Logger({
        level: 'debug',
        transports: [mockTransport],
        enrichers: pipeline
      });
      
      logger.info('Test message', { original: 'data' });
      
      expect(mockTransport.logs.length).toBe(1);
      expect(mockTransport.logs[0]!.metadata).toEqual({
        original: 'data',
        step: 2
      });
    });

    it('should allow adding enrichers after creation', () => {
      const pipeline = new LogEnrichmentPipeline();
      pipeline.add(MetadataEnricher.addStaticFields({ first: 'enrichment' }));
      
      logger = new Logger({
        level: 'debug',
        transports: [mockTransport],
        enrichers: pipeline
      });
      
      // Add another enricher after logger creation
      logger.addEnricher(MetadataEnricher.addStaticFields({ second: 'enrichment' }));
      
      logger.info('Test message');
      
      expect(mockTransport.logs.length).toBe(1);
      expect(mockTransport.logs[0]!.metadata).toEqual({
        first: 'enrichment',
        second: 'enrichment'
      });
    });
  });

  describe('Logger integration', () => {
    it('should apply enrichers to all log levels', () => {
      logger.addEnricher(MetadataEnricher.addStaticFields({ service: 'test-service' }));
      
      logger.debug('Debug message');
      logger.info('Info message');
      logger.warn('Warning message');
      logger.error('Error message');
      
      expect(mockTransport.logs.length).toBe(4);
      for (const log of mockTransport.logs) {
        expect(log!.metadata).toEqual({ service: 'test-service' });
      }
    });

    it('should merge enricher metadata with log metadata', () => {
      logger.addEnricher(MetadataEnricher.addStaticFields({ 
        environment: 'test',
        service: 'user-service'
      }));
      
      logger.info('Test message', { 
        userId: 123,
        action: 'login'
      });
      
      expect(mockTransport.logs.length).toBe(1);
      expect(mockTransport.logs[0]!.metadata).toEqual({
        userId: 123,
        action: 'login',
        environment: 'test',
        service: 'user-service'
      });
    });

    it('should work with child loggers', () => {
      logger.addEnricher(MetadataEnricher.addStaticFields({
        parentField: 'parentValue'
      }));

      const childLogger = logger.createChild({
        enrichers: new LogEnrichmentPipeline().add(
          MetadataEnricher.addStaticFields({ childField: 'childValue' })
        )
      });

      childLogger.info('Child message', { original: 'data' });

      expect(mockTransport.logs.length).toBe(1);
      const metadata = mockTransport.logs[0]!.metadata;
      expect(metadata).toHaveProperty('original', 'data');
      expect(metadata).toHaveProperty('parentField', 'parentValue'); // Inherited from parent
      expect(metadata).toHaveProperty('childField', 'childValue');   // Added by child
    });
  });

  describe('Custom enrichers', () => {
    it('should support custom enricher functions', () => {
      const customEnricher: LogEnricher = (logData) => {
        return {
          ...logData,
          metadata: {
            ...logData.metadata,
            customField: 'customValue',
            processedAt: new Date().toISOString()
          }
        };
      };
      
      logger.addEnricher(customEnricher);
      
      logger.info('Test message');
      
      expect(mockTransport.logs.length).toBe(1);
      const metadata = mockTransport.logs[0]!.metadata!;
      expect(metadata.customField).toBe('customValue');
      expect(metadata.processedAt).toBeDefined();
    });

    it('should allow enrichers to modify other log properties', () => {
      const prefixEnricher: LogEnricher = (logData) => {
        return {
          ...logData,
          prefix: `[ENRICHED]${logData.prefix || ''}`
        };
      };
      
      logger = new Logger({
        level: 'debug',
        prefix: '[ORIGINAL]',
        transports: [mockTransport],
        enrichers: new LogEnrichmentPipeline().add(prefixEnricher)
      });
      
      logger.info('Test message');
      
      expect(mockTransport.logs.length).toBe(1);
      expect(mockTransport.logs[0]!.prefix).toBe('[ENRICHED][ORIGINAL]');
    });
  });
});