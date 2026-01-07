import { RetryTransport } from '../../src/transports/RetryTransport';
import { ConsoleTransport } from '../../src/transports/ConsoleTransport';
import { Formatter } from '../../src/core/Formatter';
import { LogData } from '../../src/types/index';
import { Transport } from '../../src/transports/Transport';

describe('RetryTransport', () => {
  let mockTransport: jest.Mocked<Transport>;
  let retryTransport: RetryTransport;
  let formatter: Formatter;

  beforeEach(() => {
    mockTransport = {
      write: jest.fn(),
      writeAsync: jest.fn().mockResolvedValue(undefined)
    } as any;
    formatter = new Formatter();
  });

  describe('constructor', () => {
    it('should throw error without wrappedTransport', () => {
      expect(() => new RetryTransport({} as any)).toThrow('RetryTransport requires a wrappedTransport');
    });

    it('should initialize with default values', () => {
      const transport = new ConsoleTransport();
      const retry = new RetryTransport({ wrappedTransport: transport });

      expect(retry.getWrappedTransport()).toBe(transport);
      expect(retry.getCircuitBreakerState()).toBe('closed');
      expect(retry.getFailureCount()).toBe(0);
    });
  });

  describe('success path', () => {
    it('should succeed on first attempt for sync transport', async () => {
      mockTransport.write.mockImplementation(() => {});
      retryTransport = new RetryTransport({ wrappedTransport: mockTransport });

      const logData: LogData = {
        level: 'info',
        message: 'test',
        timestamp: new Date()
      };

      await retryTransport.writeAsync(logData, formatter);

      expect(mockTransport.write).toHaveBeenCalledWith(logData, formatter);
      expect(mockTransport.write).toHaveBeenCalledTimes(1);
    });

    it('should succeed on first attempt for async transport', async () => {
      mockTransport.writeAsync.mockResolvedValue(undefined);
      retryTransport = new RetryTransport({ wrappedTransport: mockTransport });

      const logData: LogData = {
        level: 'info',
        message: 'test',
        timestamp: new Date()
      };

      await retryTransport.writeAsync(logData, formatter);

      expect(mockTransport.writeAsync).toHaveBeenCalledWith(logData, formatter);
    });
  });

  describe('retry logic', () => {
    it('should retry on retryable errors', async () => {
      const retryableError = new Error('Network timeout');
      (retryableError as any).code = 'ETIMEDOUT';

      mockTransport.writeAsync
        .mockRejectedValueOnce(retryableError)
        .mockResolvedValueOnce(undefined);

      retryTransport = new RetryTransport({
        wrappedTransport: mockTransport,
        maxAttempts: 3,
        baseDelay: 10
      });

      const logData: LogData = {
        level: 'info',
        message: 'test',
        timestamp: new Date()
      };

      const startTime = Date.now();
      await retryTransport.writeAsync(logData, formatter);
      const endTime = Date.now();

      expect(mockTransport.writeAsync).toHaveBeenCalledTimes(2);
      expect(endTime - startTime).toBeGreaterThanOrEqual(10);
    });

    it('should not retry on non-retryable errors', async () => {
      const nonRetryableError = new Error('Authentication failed');
      (nonRetryableError as any).code = 'EAUTH';

      mockTransport.writeAsync.mockRejectedValue(nonRetryableError);

      retryTransport = new RetryTransport({
        wrappedTransport: mockTransport,
        maxAttempts: 3,
        baseDelay: 10
      });

      const logData: LogData = {
        level: 'info',
        message: 'test',
        timestamp: new Date()
      };

      await expect(retryTransport.writeAsync(logData, formatter)).rejects.toThrow('Authentication failed');
      expect(mockTransport.writeAsync).toHaveBeenCalledTimes(1);
    });

    it('should retry based on error patterns', async () => {
      const retryableError = new Error('Service temporarily unavailable');

      mockTransport.writeAsync
        .mockRejectedValueOnce(retryableError)
        .mockResolvedValueOnce(undefined);

      retryTransport = new RetryTransport({
        wrappedTransport: mockTransport,
        maxAttempts: 3,
        baseDelay: 10
      });

      const logData: LogData = {
        level: 'info',
        message: 'test',
        timestamp: new Date()
      };

      await retryTransport.writeAsync(logData, formatter);

      expect(mockTransport.writeAsync).toHaveBeenCalledTimes(2);
    });

    it('should exhaust retries after maxAttempts', async () => {
      const retryableError = new Error('Network timeout');
      (retryableError as any).code = 'ETIMEDOUT';

      mockTransport.writeAsync.mockRejectedValue(retryableError);

      retryTransport = new RetryTransport({
        wrappedTransport: mockTransport,
        maxAttempts: 3,
        baseDelay: 10
      });

      const logData: LogData = {
        level: 'info',
        message: 'test',
        timestamp: new Date()
      };

      await expect(retryTransport.writeAsync(logData, formatter)).rejects.toThrow('Network timeout');
      expect(mockTransport.writeAsync).toHaveBeenCalledTimes(3);
    });
  });

  describe('circuit breaker', () => {
    it('should open circuit breaker after threshold failures', async () => {
      const retryableError = new Error('Network timeout');
      (retryableError as any).code = 'ETIMEDOUT';

      mockTransport.writeAsync.mockRejectedValue(retryableError);

      retryTransport = new RetryTransport({
        wrappedTransport: mockTransport,
        maxAttempts: 2,
        circuitBreakerThreshold: 3,
        circuitBreakerTimeout: 100
      });

      const logData: LogData = {
        level: 'info',
        message: 'test',
        timestamp: new Date()
      };

      await expect(retryTransport.writeAsync(logData, formatter)).rejects.toThrow();
      await expect(retryTransport.writeAsync(logData, formatter)).rejects.toThrow();
      await expect(retryTransport.writeAsync(logData, formatter)).rejects.toThrow();

      expect(retryTransport.getCircuitBreakerState()).toBe('open');
    });

    it('should reject immediately when circuit is open', async () => {
      const retryableError = new Error('Network timeout');
      (retryableError as any).code = 'ETIMEDOUT';

      mockTransport.writeAsync.mockRejectedValue(retryableError);

      retryTransport = new RetryTransport({
        wrappedTransport: mockTransport,
        maxAttempts: 2,
        circuitBreakerThreshold: 2,
        circuitBreakerTimeout: 100
      });

      const logData: LogData = {
        level: 'info',
        message: 'test',
        timestamp: new Date()
      };

      await expect(retryTransport.writeAsync(logData, formatter)).rejects.toThrow();
      await expect(retryTransport.writeAsync(logData, formatter)).rejects.toThrow();

      expect(retryTransport.getCircuitBreakerState()).toBe('open');

      await expect(retryTransport.writeAsync(logData, formatter)).rejects.toThrow('Circuit breaker is open');
      expect(mockTransport.writeAsync).toHaveBeenCalledTimes(4);
    });

    it('should close circuit after timeout', async () => {
      const retryableError = new Error('Network timeout');
      (retryableError as any).code = 'ETIMEDOUT';

      mockTransport.writeAsync
        .mockRejectedValue(retryableError)
        .mockResolvedValueOnce(undefined);

      retryTransport = new RetryTransport({
        wrappedTransport: mockTransport,
        maxAttempts: 2,
        circuitBreakerThreshold: 2,
        circuitBreakerTimeout: 50
      });

      const logData: LogData = {
        level: 'info',
        message: 'test',
        timestamp: new Date()
      };

      await expect(retryTransport.writeAsync(logData, formatter)).rejects.toThrow();
      await expect(retryTransport.writeAsync(logData, formatter)).rejects.toThrow();

      expect(retryTransport.getCircuitBreakerState()).toBe('open');

      await new Promise(resolve => setTimeout(resolve, 60));

      await retryTransport.writeAsync(logData, formatter);
      expect(retryTransport.getCircuitBreakerState()).toBe('closed');
    });
  });

  describe('exponential backoff', () => {
    it('should implement exponential backoff with jitter', async () => {
      const retryableError = new Error('Network timeout');
      (retryableError as any).code = 'ETIMEDOUT';

      mockTransport.writeAsync
        .mockRejectedValueOnce(retryableError)
        .mockRejectedValueOnce(retryableError)
        .mockResolvedValueOnce(undefined);

      retryTransport = new RetryTransport({
        wrappedTransport: mockTransport,
        maxAttempts: 4,
        baseDelay: 100,
        backoffMultiplier: 2,
        jitter: false
      });

      const logData: LogData = {
        level: 'info',
        message: 'test',
        timestamp: new Date()
      };

      const startTime = Date.now();
      await retryTransport.writeAsync(logData, formatter);
      const endTime = Date.now();

      expect(endTime - startTime).toBeGreaterThanOrEqual(290);
      expect(mockTransport.writeAsync).toHaveBeenCalledTimes(3);
    });

    it('should respect maxDelay', async () => {
      const retryableError = new Error('Network timeout');
      (retryableError as any).code = 'ETIMEDOUT';

      mockTransport.writeAsync
        .mockRejectedValueOnce(retryableError)
        .mockResolvedValueOnce(undefined);

      retryTransport = new RetryTransport({
        wrappedTransport: mockTransport,
        maxAttempts: 3,
        baseDelay: 1000,
        maxDelay: 100,
        jitter: false
      });

      const logData: LogData = {
        level: 'info',
        message: 'test',
        timestamp: new Date()
      };

      const startTime = Date.now();
      await retryTransport.writeAsync(logData, formatter);
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(200);
      expect(mockTransport.writeAsync).toHaveBeenCalledTimes(2);
    });
  });

  describe('events', () => {
    it('should emit retryAttempt events', async () => {
      const retryableError = new Error('Network timeout');
      (retryableError as any).code = 'ETIMEDOUT';

      mockTransport.writeAsync
        .mockRejectedValueOnce(retryableError)
        .mockResolvedValueOnce(undefined);

      retryTransport = new RetryTransport({
        wrappedTransport: mockTransport,
        maxAttempts: 3,
        baseDelay: 10
      });

      const retryAttemptSpy = jest.fn();
      retryTransport.on('retryAttempt', retryAttemptSpy);

      const logData: LogData = {
        level: 'info',
        message: 'test',
        timestamp: new Date()
      };

      await retryTransport.writeAsync(logData, formatter);

      expect(retryAttemptSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          attempt: 1,
          totalAttempts: 3,
          originalError: retryableError,
          delay: expect.any(Number)
        })
      );
    });

    it('should emit retryExhausted events', async () => {
      const retryableError = new Error('Network timeout');
      (retryableError as any).code = 'ETIMEDOUT';

      mockTransport.writeAsync.mockRejectedValue(retryableError);

      retryTransport = new RetryTransport({
        wrappedTransport: mockTransport,
        maxAttempts: 2,
        baseDelay: 10
      });

      const retryExhaustedSpy = jest.fn();
      retryTransport.on('retryExhausted', retryExhaustedSpy);

      const logData: LogData = {
        level: 'info',
        message: 'test',
        timestamp: new Date()
      };

      await expect(retryTransport.writeAsync(logData, formatter)).rejects.toThrow();

      expect(retryExhaustedSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          lastError: retryableError,
          attempts: 2,
          totalTime: expect.any(Number),
          data: expect.objectContaining({
            level: 'info',
            message: 'test'
          })
        })
      );
    });
  });

  describe('utility methods', () => {
    it('should reset circuit breaker', async () => {
      const retryableError = new Error('Network timeout');
      (retryableError as any).code = 'ETIMEDOUT';

      mockTransport.writeAsync.mockRejectedValue(retryableError);

      retryTransport = new RetryTransport({
        wrappedTransport: mockTransport,
        maxAttempts: 2,
        circuitBreakerThreshold: 2
      });

      const logData: LogData = {
        level: 'info',
        message: 'test',
        timestamp: new Date()
      };

      await expect(retryTransport.writeAsync(logData, formatter)).rejects.toThrow();
      await expect(retryTransport.writeAsync(logData, formatter)).rejects.toThrow();

      expect(retryTransport.getCircuitBreakerState()).toBe('open');

      retryTransport.resetCircuitBreaker();
      expect(retryTransport.getCircuitBreakerState()).toBe('closed');
      expect(retryTransport.getFailureCount()).toBe(0);
    });
  });
});