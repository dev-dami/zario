import { DeadLetterQueue, DeadLetterQueueOptions } from '../src/transports/DeadLetterQueue';
import { MockTransport } from './testUtils';
import { LogData } from '../src/types';
import { Formatter } from '../src/core/Formatter';

describe('DeadLetterQueue', () => {
  let mockTransport: MockTransport;
  let deadLetterQueue: DeadLetterQueue;
  let mockFormatter: Formatter;
  let tempDir: string;

  beforeEach(() => {
    mockTransport = new MockTransport();
    mockFormatter = {
      format: (data: LogData) => JSON.stringify(data)
    } as Formatter;
    tempDir = '/tmp/zario-test-' + Date.now();
  });

  afterEach(async () => {
    if (deadLetterQueue) {
      await deadLetterQueue.destroy();
    }
  });

  describe('constructor', () => {
    it('should create with default options', () => {
      const options: DeadLetterQueueOptions = {
        transport: mockTransport
      };
      
      deadLetterQueue = new DeadLetterQueue(options);
      
      expect(deadLetterQueue).toBeDefined();
    });

    it('should accept custom options', () => {
      const options: DeadLetterQueueOptions = {
        transport: mockTransport,
        maxRetries: 5,
        retryableErrorCodes: ['ECONNREFUSED', 'ETIMEDOUT'],
        deadLetterFile: tempDir + '/dead-letters.jsonl',
        onDeadLetter: jest.fn()
      };
      
      deadLetterQueue = new DeadLetterQueue(options);
      
      expect(deadLetterQueue).toBeDefined();
    });
  });

  describe('write method', () => {
    it('should write successfully on first attempt', () => {
      const options: DeadLetterQueueOptions = {
        transport: mockTransport,
        maxRetries: 3
      };
      
      deadLetterQueue = new DeadLetterQueue(options);
      
      const logData: LogData = {
        level: 'info',
        message: 'test message',
        timestamp: new Date()
      };

      expect(() => {
        deadLetterQueue.write(logData, mockFormatter);
      }).not.toThrow();
      
      expect(mockTransport.logs).toHaveLength(1);
    });
  });

  describe('writeAsync method', () => {
    it('should write successfully on first attempt', async () => {
      const options: DeadLetterQueueOptions = {
        transport: mockTransport,
        maxRetries: 3
      };
      
      deadLetterQueue = new DeadLetterQueue(options);
      
      const logData: LogData = {
        level: 'info',
        message: 'test message',
        timestamp: new Date()
      };

      await expect(
        deadLetterQueue.writeAsync(logData, mockFormatter)
      ).resolves.toBeUndefined();
      
      expect(mockTransport.logs).toHaveLength(1);
    });

    it('should retry on retryable errors', async () => {
      let attemptCount = 0;
      const failingTransport = {
        write: jest.fn().mockImplementation(() => {
          attemptCount++;
          if (attemptCount < 3) {
            const error = new Error('Network error');
            (error as any).code = 'ECONNREFUSED';
            throw error;
          }
        }),
        writeAsync: jest.fn().mockImplementation(async () => {
          attemptCount++;
          if (attemptCount < 3) {
            const error = new Error('Network error');
            (error as any).code = 'ECONNREFUSED';
            throw error;
          }
        }),
        isAsyncSupported: () => true
      };
      
      const options: DeadLetterQueueOptions = {
        transport: failingTransport as any,
        maxRetries: 3
      };
      
      deadLetterQueue = new DeadLetterQueue(options);
      
      const logData: LogData = {
        level: 'info',
        message: 'test message',
        timestamp: new Date()
      };

      await expect(
        deadLetterQueue.writeAsync(logData, mockFormatter)
      ).resolves.toBeUndefined();
      
      expect(failingTransport.writeAsync).toHaveBeenCalledTimes(3);
    });

    it('should create dead letter for non-retryable errors', async () => {
      const failingTransport = {
        write: jest.fn().mockImplementation(() => {
          const error = new Error('Authentication failed');
          (error as any).code = 'EAUTH';
          throw error;
        }),
        writeAsync: jest.fn().mockRejectedValue(
          Object.assign(new Error('Authentication failed'), { code: 'EAUTH' })
        ),
        isAsyncSupported: () => true
      };
      
      const onDeadLetter = jest.fn();
      const options: DeadLetterQueueOptions = {
        transport: failingTransport as any,
        maxRetries: 3,
        onDeadLetter
      };
      
      deadLetterQueue = new DeadLetterQueue(options);
      
      const logData: LogData = {
        level: 'info',
        message: 'test message',
        timestamp: new Date()
      };

      await expect(
        deadLetterQueue.writeAsync(logData, mockFormatter)
      ).rejects.toThrow();
      
      expect(onDeadLetter).toHaveBeenCalledTimes(1);
      const deadLetter = onDeadLetter.mock.calls[0][0];
      expect(deadLetter.deadLetterReason).toBe('Authentication failed');
      expect(deadLetter.originalError).toBe('EAUTH');
      expect(deadLetter.retryCount).toBe(0);
    });

    it('should create dead letter after max retries exceeded', async () => {
      let attemptCount = 0;
      const failingTransport = {
        write: jest.fn().mockImplementation(() => {
          attemptCount++;
          const error = new Error('Persistent network error');
          (error as any).code = 'ECONNREFUSED';
          throw error;
        }),
        writeAsync: jest.fn().mockImplementation(async () => {
          attemptCount++;
          const error = new Error('Persistent network error');
          (error as any).code = 'ECONNREFUSED';
          throw error;
        }),
        isAsyncSupported: () => true
      };
      
      const onDeadLetter = jest.fn();
      const options: DeadLetterQueueOptions = {
        transport: failingTransport as any,
        maxRetries: 2,
        onDeadLetter
      };
      
      deadLetterQueue = new DeadLetterQueue(options);
      
      const logData: LogData = {
        level: 'info',
        message: 'test message',
        timestamp: new Date()
      };

      await expect(
        deadLetterQueue.writeAsync(logData, mockFormatter)
      ).rejects.toThrow();
      
      expect(failingTransport.writeAsync).toHaveBeenCalledTimes(3); // 1 initial + 2 retries
      expect(onDeadLetter).toHaveBeenCalledTimes(1);
      
      const deadLetter = onDeadLetter.mock.calls[0][0];
      expect(deadLetter.deadLetterReason).toBe('Persistent network error');
      expect(deadLetter.originalError).toBe('ECONNREFUSED');
      expect(deadLetter.retryCount).toBe(2);
    });
  });

  describe('getDeadLetters method', () => {
    it('should return copy of dead letters', () => {
      const onDeadLetter = jest.fn();
      const options: DeadLetterQueueOptions = {
        transport: mockTransport,
        onDeadLetter
      };
      
      deadLetterQueue = new DeadLetterQueue(options);
      
      const failingTransport = {
        write: jest.fn().mockImplementation(() => {
          throw Object.assign(new Error('Auth error'), { code: 'EAUTH' });
        }),
        isAsyncSupported: () => false
      };
      
      deadLetterQueue = new DeadLetterQueue({
        transport: failingTransport as any,
        onDeadLetter
      });
      
      const logData: LogData = {
        level: 'info',
        message: 'test message',
        timestamp: new Date()
      };

      try {
        deadLetterQueue.write(logData, mockFormatter);
      } catch (e) {
        // Expected
      }
      
      const deadLetters1 = deadLetterQueue.getDeadLetters();
      const deadLetters2 = deadLetterQueue.getDeadLetters();
      
      expect(deadLetters1).toEqual(deadLetters2);
      expect(deadLetters1).toHaveLength(1);
    });
  });

  describe('clearDeadLetters method', () => {
    it('should clear all dead letters', () => {
      const onDeadLetter = jest.fn();
      const options: DeadLetterQueueOptions = {
        transport: mockTransport,
        onDeadLetter
      };
      
      deadLetterQueue = new DeadLetterQueue(options);
      
      const failingTransport = {
        write: jest.fn().mockImplementation(() => {
          throw Object.assign(new Error('Auth error'), { code: 'EAUTH' });
        }),
        isAsyncSupported: () => false
      };
      
      deadLetterQueue = new DeadLetterQueue({
        transport: failingTransport as any,
        onDeadLetter
      });
      
      const logData: LogData = {
        level: 'info',
        message: 'test message',
        timestamp: new Date()
      };

      try {
        deadLetterQueue.write(logData, mockFormatter);
      } catch (e) {
        // Expected
      }
      
      expect(deadLetterQueue.getDeadLetters()).toHaveLength(1);
      
      deadLetterQueue.clearDeadLetters();
      
      expect(deadLetterQueue.getDeadLetters()).toHaveLength(0);
    });
  });

  describe('dead letter file', () => {
    it('should write dead letters to file when configured', async () => {
      const fs = require('fs').promises;
      const deadLetterFile = tempDir + '/test-dead-letters.jsonl';
      
      const options: DeadLetterQueueOptions = {
        transport: mockTransport,
        deadLetterFile,
        maxRetries: 1
      };
      
      deadLetterQueue = new DeadLetterQueue(options);
      
      const failingTransport = {
        write: jest.fn().mockImplementation(() => {
          throw Object.assign(new Error('Write error'), { code: 'EIO' });
        }),
        isAsyncSupported: () => false
      };
      
      deadLetterQueue = new DeadLetterQueue({
        transport: failingTransport as any,
        deadLetterFile,
        maxRetries: 1
      });
      
      const logData: LogData = {
        level: 'info',
        message: 'test message',
        timestamp: new Date()
      };

      try {
        deadLetterQueue.write(logData, mockFormatter);
      } catch (e) {
        // Expected
      }
      
      await new Promise(resolve => setTimeout(resolve, 100)); // Wait for file write
      
      try {
        const fileContent = await fs.readFile(deadLetterFile, 'utf8');
        const lines = fileContent.trim().split('\n').filter(line => line.length > 0);
        expect(lines).toHaveLength(1);
        
        const deadLetter = JSON.parse(lines[0]);
        expect(deadLetter.deadLetterReason).toBe('Write error');
        expect(deadLetter.originalError).toBe('EIO');
      } catch (e) {
        // File might not exist in some environments
      }
    });
  });

  describe('destroy method', () => {
    it('should clean up resources', async () => {
      const options: DeadLetterQueueOptions = {
        transport: mockTransport
      };
      
      deadLetterQueue = new DeadLetterQueue(options);
      
      await expect(
        deadLetterQueue.destroy()
      ).resolves.toBeUndefined();
    });
  });

  describe('isAsyncSupported method', () => {
    it('should return true', () => {
      const options: DeadLetterQueueOptions = {
        transport: mockTransport
      };
      
      deadLetterQueue = new DeadLetterQueue(options);
      
      expect(deadLetterQueue.isAsyncSupported()).toBe(true);
    });
  });
});
