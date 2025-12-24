import { Logger } from '../../src/core/Logger';
import { LogLevel } from '../../src/core/LogLevel';
import { Transport } from '../../src/transports/Transport';
import { Formatter } from '../../src/core/Formatter';
import { LogData } from '../../src/types';
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
} from '../../src/filters';
import { MockTransport } from '../testUtils';

describe('Advanced Filtering', () => {
  let logger: Logger;
  let mockTransport: MockTransport;

  beforeEach(() => {
    mockTransport = new MockTransport();
    logger = new Logger({
      level: 'debug',
      transports: [mockTransport],
      filters: []
    });
  });

  describe('PredicateFilter', () => {
    it('should filter logs based on a predicate function', () => {
      const predicateFilter = new PredicateFilter(logData => logData.level === 'info');
      logger.addFilter(predicateFilter);

      logger.info('This should be logged');
      logger.error('This should not be logged');

      expect(mockTransport.logs.length).toBe(1);
      expect(mockTransport.logs[0]!.message).toBe('This should be logged');
      expect(mockTransport.logs[0]!.level).toBe('info');
    });
  });

  describe('LevelFilter', () => {
    it('should filter logs based on allowed log levels', () => {
      const levelFilter = new LevelFilter(['info', 'warn']);
      logger.addFilter(levelFilter);

      logger.info('Info message');
      logger.warn('Warning message');
      logger.error('Error message');
      logger.debug('Debug message');

      expect(mockTransport.logs.length).toBe(2);
      expect(mockTransport.logs[0]!.message).toBe('Info message');
      expect(mockTransport.logs[1]!.message).toBe('Warning message');
    });
  });

  describe('PrefixFilter', () => {
    it('should filter logs based on prefix', () => {
      logger = new Logger({
        level: 'debug',
        prefix: '[TEST]',
        transports: [mockTransport],
        filters: [new PrefixFilter(['[TEST]'])]
      });

      logger.info('This should be logged');
      logger.warn('Another test message');

      expect(mockTransport.logs.length).toBe(2);
      expect(mockTransport.logs[0]!.prefix).toBe('[TEST]');
    });

    it('should not log messages without matching prefix', () => {
      const otherLogger = new Logger({
        level: 'debug',
        prefix: '[OTHER]',
        transports: [mockTransport],
        filters: [new PrefixFilter(['[TEST]'])]
      });

      otherLogger.info('This should not be logged');

      expect(mockTransport.logs.length).toBe(0);
    });
  });

  describe('MetadataFilter', () => {
    it('should filter logs based on metadata fields', () => {
      const metadataFilter = new MetadataFilter({ userId: 123 });
      logger.addFilter(metadataFilter);

      logger.info('Message with correct metadata', { userId: 123, action: 'login' });
      logger.info('Message with wrong metadata', { userId: 456, action: 'logout' });
      logger.info('Message without metadata');

      expect(mockTransport.logs.length).toBe(1);
      expect(mockTransport.logs[0]!.message).toBe('Message with correct metadata');
      expect(mockTransport.logs[0]!.metadata).toEqual({ userId: 123, action: 'login' });
    });
  });

  describe('FieldFilter', () => {
    it('should filter logs based on a specific field in metadata', () => {
      const fieldFilter = new FieldFilter('category', 'important');
      logger.addFilter(fieldFilter);

      logger.info('Important message', { category: 'important', priority: 'high' });
      logger.info('Regular message', { category: 'regular', priority: 'low' });

      expect(mockTransport.logs.length).toBe(1);
      expect(mockTransport.logs[0]!.message).toBe('Important message');
    });
  });

  describe('CompositeFilter', () => {
    it('should apply multiple filters with AND logic', () => {
      const levelFilter = new LevelFilter(['info']);
      const metadataFilter = new MetadataFilter({ userId: 123 });
      const compositeFilter = new CompositeFilter([levelFilter, metadataFilter]);

      logger.addFilter(compositeFilter);

      logger.info('Info with correct metadata', { userId: 123 });
      logger.warn('Warn with correct metadata', { userId: 123 });
      logger.info('Info with wrong metadata', { userId: 456 });
      logger.warn('Warn with wrong metadata', { userId: 456 });

      expect(mockTransport.logs.length).toBe(1);
      expect(mockTransport.logs[0]!.message).toBe('Info with correct metadata');
      expect(mockTransport.logs[0]!.level).toBe('info');
      expect(mockTransport.logs[0]!.metadata).toEqual({ userId: 123 });
    });
  });

  describe('OrFilter', () => {
    it('should apply multiple filters with OR logic', () => {
      const levelFilter = new LevelFilter(['info']);
      const metadataFilter = new MetadataFilter({ category: 'urgent' });
      const orFilter = new OrFilter([levelFilter, metadataFilter]);

      logger.addFilter(orFilter);

      logger.info('Info message', { some: 'data' });
      logger.warn('Warning with urgent category', { category: 'urgent' });
      logger.error('Error with urgent category', { category: 'urgent' });
      logger.warn('Regular warning', { some: 'data' });

      expect(mockTransport.logs.length).toBe(3);
      expect(mockTransport.logs[0]!.message).toBe('Info message');
      expect(mockTransport.logs[1]!.message).toBe('Warning with urgent category');
      expect(mockTransport.logs[2]!.message).toBe('Error with urgent category');
    });
  });

  describe('NotFilter', () => {
    it('should negate another filter', () => {
      const levelFilter = new LevelFilter(['error']);
      const notFilter = new NotFilter(levelFilter);

      logger.addFilter(notFilter);

      logger.info('Info message');
      logger.warn('Warning message');
      logger.error('Error message');

      expect(mockTransport.logs.length).toBe(2);
      expect(mockTransport.logs[0]!.level).not.toBe('error');
      expect(mockTransport.logs[1]!.level).not.toBe('error');
    });
  });

  describe('Multiple filters', () => {
    it('should apply all filters in sequence', () => {
      logger.addFilter(new LevelFilter(['info', 'warn']));
      logger.addFilter(new MetadataFilter({ userId: 123 }));

      logger.info('Info with correct metadata', { userId: 123 });
      logger.warn('Warn with correct metadata', { userId: 123 });
      logger.info('Info with wrong metadata', { userId: 456 });
      logger.error('Error with correct metadata', { userId: 123 });

      expect(mockTransport.logs.length).toBe(2);
      expect(mockTransport.logs[0]!.message).toBe('Info with correct metadata');
      expect(mockTransport.logs[1]!.message).toBe('Warn with correct metadata');
    });
  });
});