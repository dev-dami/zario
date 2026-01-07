import { CircuitBreakerTransport, CircuitBreakerOptions } from '../src/transports/CircuitBreakerTransport';
import { MockTransport } from './testUtils';
import { LogData } from '../src/types';
import { Formatter } from '../src/core/Formatter';

describe('CircuitBreakerTransport', () => {
  let mockTransport: MockTransport;
  let circuitBreakerTransport: CircuitBreakerTransport;
  let mockFormatter: Formatter;

  beforeEach(() => {
    mockTransport = new MockTransport();
    mockFormatter = {
      format: (data: LogData) => JSON.stringify(data)
    } as Formatter;
  });

  describe('constructor', () => {
    it('should create with default options', () => {
      circuitBreakerTransport = new CircuitBreakerTransport(mockTransport);
      
      expect(circuitBreakerTransport).toBeDefined();
    });

    it('should accept custom options', () => {
      const options: CircuitBreakerOptions = {
        threshold: 3,
        timeout: 30000,
        resetTimeout: 5000
      };
      
      circuitBreakerTransport = new CircuitBreakerTransport(mockTransport, options);
      
      expect(circuitBreakerTransport).toBeDefined();
    });
  });

  describe('write method', () => {
    it('should write successfully when circuit is open', () => {
      circuitBreakerTransport = new CircuitBreakerTransport(mockTransport);
      
      const logData: LogData = {
        level: 'info',
        message: 'test message',
        timestamp: new Date()
      };

      expect(() => {
        circuitBreakerTransport.write(logData, mockFormatter);
      }).not.toThrow();
      
      expect(mockTransport.logs).toHaveLength(1);
    });

    it('should track successful writes in metrics', () => {
      circuitBreakerTransport = new CircuitBreakerTransport(mockTransport);
      
      const logData: LogData = {
        level: 'info',
        message: 'test message',
        timestamp: new Date()
      };

      circuitBreakerTransport.write(logData, mockFormatter);
      
      const metrics = circuitBreakerTransport.getMetrics();
      expect(metrics.successfulRequests).toBe(1);
      expect(metrics.totalRequests).toBe(1);
      expect(metrics.failedRequests).toBe(0);
    });
  });

  describe('writeAsync method', () => {
    it('should write successfully when circuit is open', async () => {
      circuitBreakerTransport = new CircuitBreakerTransport(mockTransport);
      
      const logData: LogData = {
        level: 'info',
        message: 'test message',
        timestamp: new Date()
      };

      await expect(
        circuitBreakerTransport.writeAsync(logData, mockFormatter)
      ).resolves.not.toThrow();
    });

    it('should handle transport without writeAsync', async () => {
      const syncOnlyTransport = {
        write: jest.fn(),
        isAsyncSupported: () => false
      };
      
      circuitBreakerTransport = new CircuitBreakerTransport(syncOnlyTransport as any);
      
      const logData: LogData = {
        level: 'info',
        message: 'test message',
        timestamp: new Date()
      };

      await expect(
        circuitBreakerTransport.writeAsync(logData, mockFormatter)
      ).resolves.not.toThrow();
    });
  });

  describe('circuit breaker behavior', () => {
    it('should trip after threshold failures', () => {
      const options: CircuitBreakerOptions = { threshold: 2 };
      circuitBreakerTransport = new CircuitBreakerTransport(mockTransport, options);
      
      const failingTransport = new MockTransport();
      failingTransport.write = jest.fn().mockImplementation(() => {
        throw new Error('Transport failed');
      });
      
      circuitBreakerTransport = new CircuitBreakerTransport(failingTransport, options);
      
      const logData: LogData = {
        level: 'info',
        message: 'test message',
        timestamp: new Date()
      };

      // First failure should throw the transport error and be recorded; circuit remains closed until threshold is reached
      expect(() => {
        circuitBreakerTransport.write(logData, mockFormatter);
      }).toThrow('Transport failed');

      // Second failure should trip circuit breaker
      expect(() => {
        circuitBreakerTransport.write(logData, mockFormatter);
      }).toThrow('Transport failed');

      // Third write should fail immediately due to closed circuit
      expect(() => {
        circuitBreakerTransport.write(logData, mockFormatter);
      }).toThrow('Circuit breaker is open');
    });

    it('should reset after timeout', (done) => {
      const options: CircuitBreakerOptions = { 
        threshold: 1,
        timeout: 100,
        resetTimeout: 200
      };
      
      const failingTransport = new MockTransport();
      failingTransport.write = jest.fn().mockImplementation(() => {
        throw new Error('Transport failed');
      });
      
      circuitBreakerTransport = new CircuitBreakerTransport(failingTransport, options);
      
      const logData: LogData = {
        level: 'info',
        message: 'test message',
        timestamp: new Date()
      };

      // Trip the circuit
      expect(() => {
        circuitBreakerTransport.write(logData, mockFormatter);
      }).toThrow();

      // Should be closed
      expect(() => {
        circuitBreakerTransport.write(logData, mockFormatter);
      }).toThrow('Circuit breaker is open');

      // Wait for timeout and reset
      setTimeout(() => {
        expect(() => {
          circuitBreakerTransport.write(logData, mockFormatter);
        }).not.toThrow('Circuit breaker is open');
        done();
      }, 150);
    });
  });

  describe('metrics', () => {
    it('should track metrics correctly', () => {
      circuitBreakerTransport = new CircuitBreakerTransport(mockTransport);
      
      const logData: LogData = {
        level: 'info',
        message: 'test message',
        timestamp: new Date()
      };

      const failingTransport = new MockTransport();
      let callCount = 0;
      failingTransport.write = jest.fn().mockImplementation(() => {
        callCount++;
        if (callCount <= 2) {
          throw new Error('Transport failed');
        }
      });
      
      circuitBreakerTransport = new CircuitBreakerTransport(failingTransport);
      
      // Successful write
      circuitBreakerTransport.write(logData, mockFormatter);
      
      // Failed write
      try {
        circuitBreakerTransport.write(logData, mockFormatter);
      } catch (e) {
        // Expected
      }
      
      const metrics = circuitBreakerTransport.getMetrics();
      expect(metrics.totalRequests).toBe(2);
      expect(metrics.successfulRequests).toBe(1);
      expect(metrics.failedRequests).toBe(1);
      expect(metrics.currentState).toBe('half-open');
    });
  });

  describe('reset method', () => {
    it('should reset circuit breaker state', () => {
      circuitBreakerTransport = new CircuitBreakerTransport(mockTransport);
      
      const failingTransport = new MockTransport();
      failingTransport.write = jest.fn().mockImplementation(() => {
        throw new Error('Transport failed');
      });
      
      circuitBreakerTransport = new CircuitBreakerTransport(failingTransport, { threshold: 1 });
      
      const logData: LogData = {
        level: 'info',
        message: 'test message',
        timestamp: new Date()
      };

      // Trip the circuit
      try {
        circuitBreakerTransport.write(logData, mockFormatter);
      } catch (e) {
        // Expected
      }

      let metrics = circuitBreakerTransport.getMetrics();
      expect(metrics.currentState).toBe('half-open');
      expect(metrics.totalRequests).toBe(1);

      // Reset the circuit
      circuitBreakerTransport.reset();

      metrics = circuitBreakerTransport.getMetrics();
      expect(metrics.currentState).toBe('open');
      expect(metrics.totalRequests).toBe(0);
      expect(metrics.successfulRequests).toBe(0);
      expect(metrics.failedRequests).toBe(0);
    });
  });

  describe('destroy method', () => {
    it('should clean up resources', () => {
      circuitBreakerTransport = new CircuitBreakerTransport(mockTransport, { resetTimeout: 1000 });
      
      expect(() => {
        circuitBreakerTransport.destroy();
      }).not.toThrow();
    });
  });

  describe('isAsyncSupported method', () => {
    it('should return true when wrapped transport supports async', () => {
      const asyncTransport = {
        write: jest.fn(),
        writeAsync: jest.fn(),
        isAsyncSupported: () => true
      };
      
      circuitBreakerTransport = new CircuitBreakerTransport(asyncTransport as any);
      
      expect(circuitBreakerTransport.isAsyncSupported()).toBe(true);
    });

    it('should return false when wrapped transport does not support async', () => {
      circuitBreakerTransport = new CircuitBreakerTransport(mockTransport);
      
      expect(circuitBreakerTransport.isAsyncSupported()).toBe(false);
    });
  });
});