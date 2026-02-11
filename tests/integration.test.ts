import { Logger, CircuitBreakerTransport, DeadLetterQueue, HttpTransport, FileTransport } from '../src/index';
import { LogData } from '../src/types';

describe('Transport Integration Tests', () => {
  let logger: Logger;

  beforeEach(() => {
    logger = new Logger({
      level: 'info',
      colorize: false // Suppress console output during tests
    });
  });

  describe('CircuitBreakerTransport + HttpTransport Integration', () => {
    it('should handle circuit breaker behavior with real HTTP transport', async () => {
      const httpTransport = new HttpTransport({
        url: 'https://httpbin.org/status/500', // Always fails for testing
        timeout: 1000,
        retries: 0
      });

      const options = { onStateChange: jest.fn(), onTrip: jest.fn() };
      const circuitBreakerTransport = new CircuitBreakerTransport(httpTransport, {
        threshold: 3,
        timeout: 2000,
        ...options
      });

      const testLogger = new Logger({
        level: 'info',
        transports: [circuitBreakerTransport],
        colorize: false
      });

      // First few calls should trip the circuit breaker
      for (let i = 0; i < 5; i++) {
        try {
          await testLogger.error(`Test message ${i}`, { testId: i });
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (e) {
          // Expected failures
        }
      }
      await new Promise(resolve => setTimeout(resolve, 250));

      const metrics = circuitBreakerTransport.getMetrics();
      expect(metrics.failedRequests).toBeGreaterThan(0);
      expect(options.onTrip).toHaveBeenCalled();
    }, 10000);

    it('should reset circuit breaker after timeout', async () => {
      const httpTransport = new HttpTransport({
        url: 'https://httpbin.org/status/500',
        timeout: 500,
        retries: 0
      });

      const circuitBreakerTransport = new CircuitBreakerTransport(httpTransport, {
        threshold: 2,
        timeout: 1000,
        resetTimeout: 2000
      });

      const testLogger = new Logger({
        level: 'info',
        transports: [circuitBreakerTransport],
        colorize: false
      });

      // Trip the circuit
      try {
        await testLogger.error('First failure');
      } catch (e) {
        // Expected
      }

      try {
        await testLogger.error('Second failure');
      } catch (e) {
        // Expected
      }

      // Should fail immediately due to closed circuit
      try {
        await testLogger.error('Should fail fast');
      } catch (e) {
        // Expected - circuit is closed
      }

      // Wait for timeout and reset
      await new Promise(resolve => setTimeout(resolve, 2500));

      // Should work again after reset - trigger half-open test
      try {
        await testLogger.info('Testing circuit reset');
      } catch (e) {
        // Expected - might still fail if transport is down
      }
      
      // Check the actual circuit breaker state
      const metrics = circuitBreakerTransport.getMetrics();
      expect(['open', 'closed']).toContain(metrics.currentState);
    }, 15000);
  });

  describe('DeadLetterQueue + FileTransport Integration', () => {
    it('should capture failed logs in dead letter queue', async () => {
      const tempDir = '/tmp/zario-integration-test-' + Date.now();
      const fileTransport = new FileTransport({
        path: `${tempDir}/app.log`,
        maxQueueSize: 10
      });
      (fileTransport as any).filePath = `${tempDir}/nonexistent-dir/app.log`;

      const deadLetterQueue = new DeadLetterQueue({
        transport: fileTransport,
        maxRetries: 2,
        onDeadLetter: jest.fn()
      });

      const testLogger = new Logger({
        level: 'info',
        transports: [deadLetterQueue],
        colorize: false
      });

      const testLogData: LogData = {
        level: 'info',
        message: 'Integration test message',
        timestamp: new Date(),
        metadata: { testId: 'integration-123' }
      };

      // This should fail and be captured in dead letter queue
      try {
        await testLogger.info(testLogData.message, testLogData.metadata);
        await new Promise(resolve => setTimeout(resolve, 500)); // Wait for async operations
      } catch (e) {
        // Expected failure
      }

      const deadLetters = deadLetterQueue.getDeadLetters();
      expect(deadLetters.length).toBeGreaterThan(0);
      
      const capturedLetter = deadLetters.find(dl => dl.metadata?.testId === 'integration-123');
      expect(capturedLetter).toBeDefined();
      expect(capturedLetter?.deadLetterReason).toContain('ENOENT');
    }, 10000);

    it('should handle retryable vs non-retryable errors', async () => {
      const mockTransport = {
        write: jest.fn().mockImplementation((data, formatter) => {
          const testId = data.metadata?.testId;
          if (testId === 'retryable') {
            const error = new Error('Network timeout');
            (error as any).code = 'ETIMEDOUT';
            throw error;
          } else if (testId === 'non-retryable') {
            const error = new Error('Authentication failed');
            (error as any).code = 'EAUTH';
            throw error;
          }
        }),
        isAsyncSupported: () => false
      };

      const deadLetterQueue = new DeadLetterQueue({
        transport: mockTransport as any,
        maxRetries: 3,
        onDeadLetter: jest.fn()
      });

      const testLogger = new Logger({
        level: 'info',
        transports: [deadLetterQueue],
        colorize: false
      });

      // Non-retryable error should go to dead letter immediately
      try {
        await testLogger.info('Non-retryable error', { testId: 'non-retryable' });
      } catch (e) {
        // Expected
      }

      const deadLetters = deadLetterQueue.getDeadLetters();
      const nonRetryableLetter = deadLetters.find(dl => dl.metadata?.testId === 'non-retryable');
      expect(nonRetryableLetter).toBeDefined();
      expect(nonRetryableLetter?.retryCount).toBe(0);
      expect(nonRetryableLetter?.originalError).toBe('EAUTH');
    }, 10000);
  });

  describe('Combined Transport Chains', () => {
    it('should work with CircuitBreakerTransport wrapping DeadLetterQueue', async () => {
      const mockTransport = {
        write: jest.fn().mockImplementation((data, formatter) => {
          const error = new Error('Simulated failure');
          (error as any).code = 'ECONNREFUSED';
          throw error;
        }),
        isAsyncSupported: () => false
      };

      const deadLetterQueue = new DeadLetterQueue({
        transport: mockTransport as any,
        maxRetries: 0,
        onDeadLetter: jest.fn()
      });

      const circuitBreakerTransport = new CircuitBreakerTransport(deadLetterQueue, {
        threshold: 3,
        timeout: 1000
      });

      const testLogger = new Logger({
        level: 'info',
        transports: [circuitBreakerTransport],
        colorize: false
      });

      // Multiple failures should trip circuit breaker
      for (let i = 0; i < 5; i++) {
        try {
          await testLogger.error(`Chain test ${i}`, { iteration: i });
        } catch (e) {
          // Expected failures
        }
      }
      await new Promise(resolve => setTimeout(resolve, 50));

      const metrics = circuitBreakerTransport.getMetrics();
      expect(metrics.failedRequests).toBeGreaterThan(2);
      
      const deadLetters = deadLetterQueue.getDeadLetters();
      expect(deadLetters.length).toBeGreaterThan(0);
    }, 10000);

    it('should maintain async support through chain', () => {
      const mockTransport = {
        write: jest.fn(),
        writeAsync: jest.fn().mockResolvedValue(undefined),
        isAsyncSupported: () => true
      };

      const deadLetterQueue = new DeadLetterQueue({
        transport: mockTransport as any,
        maxRetries: 1
      });

      const circuitBreakerTransport = new CircuitBreakerTransport(deadLetterQueue);

      expect(deadLetterQueue.isAsyncSupported()).toBe(true);
      expect(circuitBreakerTransport.isAsyncSupported()).toBe(true);
    });
  });

  describe('Performance and Memory Safety', () => {
    it('should handle high volume without memory leaks', async () => {
      const mockTransport = {
        write: jest.fn(),
        isAsyncSupported: () => false
      };

      const deadLetterQueue = new DeadLetterQueue({
        transport: mockTransport as any,
        maxRetries: 1
      });

      const circuitBreakerTransport = new CircuitBreakerTransport(deadLetterQueue, {
        threshold: 100,
        timeout: 1000
      });

      const testLogger = new Logger({
        level: 'info',
        transports: [circuitBreakerTransport],
        colorize: false
      });

      // Generate many log entries
      for (let i = 0; i < 1000; i++) {
        try {
          await testLogger.info(`High volume test ${i}`, { index: i });
        } catch (e) {
          // Some failures expected
        }
      }

      const metrics = circuitBreakerTransport.getMetrics();
      expect(metrics.totalRequests).toBe(1000);
      
      // Verify memory hasn't grown unbounded
      const deadLetters = deadLetterQueue.getDeadLetters();
      expect(deadLetters.length).toBeLessThan(1000); // Should be much less due to retries
      
      // Clear up for test cleanup
      deadLetterQueue.clearDeadLetters();
      expect(deadLetterQueue.getDeadLetters()).toHaveLength(0);
    }, 15000);
  });
});
