import { Logger } from '../../src/core/Logger';
import { HttpTransport, httpT } from '../../src/transports';
import * as http from 'http';
import * as https from 'https';

// Mock http/https modules
jest.mock('http', () => ({
  request: jest.fn()
}));

jest.mock('https', () => ({
  request: jest.fn()
}));

describe('Logger + HttpTransport Integration', () => {
  let mockHttpRequest: jest.Mock;

  beforeEach(() => {
    mockHttpRequest = jest.fn();
    (http.request as jest.Mock).mockImplementation(mockHttpRequest);
    (https.request as jest.Mock).mockImplementation(mockHttpRequest);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Basic Integration', () => {
    it('should send logs via HttpTransport when using Logger', async () => {
      const mockRes = {
        statusCode: 200,
        on: jest.fn().mockImplementation((event, callback) => {
          if (event === 'data' || event === 'end') {
            setImmediate(() => callback());
          }
          return mockRes;
        })
      };

      const mockReq = {
        on: jest.fn().mockImplementation((event, callback) => {
          if (event === 'response') {
            setImmediate(() => callback(mockRes));
          }
          return mockReq;
        }),
        write: jest.fn(),
        end: jest.fn()
      };

      mockHttpRequest.mockReturnValue(mockReq);

      const logger = new Logger({
        level: 'info',
        transports: [
          new HttpTransport({
            url: 'http://example.com/logs',
            retries: 0
          })
        ]
      });

      logger.info('Test message');

      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(mockHttpRequest).toHaveBeenCalled();
    });

    it('should work with httpT factory function', async () => {
      const mockRes = {
        statusCode: 200,
        on: jest.fn().mockImplementation((event, callback) => {
          if (event === 'data' || event === 'end') {
            setImmediate(() => callback());
          }
          return mockRes;
        })
      };

      const mockReq = {
        on: jest.fn().mockImplementation((event, callback) => {
          if (event === 'response') {
            setImmediate(() => callback(mockRes));
          }
          return mockReq;
        }),
        write: jest.fn(),
        end: jest.fn()
      };

      mockHttpRequest.mockReturnValue(mockReq);

      const logger = new Logger({
        level: 'debug',
        transports: [
          httpT({
            url: 'http://example.com/logs',
            method: 'POST',
            headers: {
              'Authorization': 'Bearer test-token'
            },
            retries: 0
          })
        ]
      });

      logger.debug('Debug message', { context: 'test' });

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(mockHttpRequest).toHaveBeenCalled();
    });
  });

  describe('Multiple Transports', () => {
    it('should work alongside ConsoleTransport', async () => {
      const mockRes = {
        statusCode: 200,
        on: jest.fn().mockImplementation((event, callback) => {
          if (event === 'data' || event === 'end') {
            setImmediate(() => callback());
          }
          return mockRes;
        })
      };

      const mockReq = {
        on: jest.fn().mockImplementation((event, callback) => {
          if (event === 'response') {
            setImmediate(() => callback(mockRes));
          }
          return mockReq;
        }),
        write: jest.fn(),
        end: jest.fn()
      };

      mockHttpRequest.mockReturnValue(mockReq);

      const { ConsoleTransport } = require('../../src/transports');
      const consoleWriteSpy = jest.spyOn(ConsoleTransport.prototype, 'write');

      const logger = new Logger({
        level: 'info',
        transports: [
          new ConsoleTransport(),
          new HttpTransport({
            url: 'http://example.com/logs',
            retries: 0
          })
        ]
      });

      logger.info('Multi-transport test');

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(consoleWriteSpy).toHaveBeenCalled();
      expect(mockHttpRequest).toHaveBeenCalled();

      consoleWriteSpy.mockRestore();
    });
  });

  describe('Async Mode', () => {
    it('should support async logging with HttpTransport', async () => {
      const mockRes = {
        statusCode: 200,
        on: jest.fn().mockImplementation((event, callback) => {
          if (event === 'data' || event === 'end') {
            setImmediate(() => callback());
          }
          return mockRes;
        })
      };

      const mockReq = {
        on: jest.fn().mockImplementation((event, callback) => {
          if (event === 'response') {
            setImmediate(() => callback(mockRes));
          }
          return mockReq;
        }),
        write: jest.fn(),
        end: jest.fn()
      };

      mockHttpRequest.mockReturnValue(mockReq);

      const logger = new Logger({
        level: 'info',
        asyncMode: true,
        transports: [
          new HttpTransport({
            url: 'http://example.com/logs',
            retries: 0
          })
        ]
      });

      await logger.infoAsync('Async test message', { async: true });

      expect(mockHttpRequest).toHaveBeenCalled();
    });

    it('should handle async errors gracefully', async () => {
      const mockReq = {
        on: jest.fn().mockImplementation((event, callback) => {
          if (event === 'error') {
            setImmediate(() => callback(new Error('Network failure')));
          }
          return mockReq;
        }),
        write: jest.fn(),
        end: jest.fn()
      };

      mockHttpRequest.mockReturnValue(mockReq);

      const logger = new Logger({
        level: 'info',
        asyncMode: true,
        transports: [
          new HttpTransport({
            url: 'http://example.com/logs',
            retries: 0
          })
        ]
      });

      await expect(
        logger.errorAsync('Async error test')
      ).rejects.toThrow('Network failure');
    });
  });

  describe('Child Loggers', () => {
    it('should inherit HttpTransport from parent logger', async () => {
      const mockRes = {
        statusCode: 200,
        on: jest.fn().mockImplementation((event, callback) => {
          if (event === 'data' || event === 'end') {
            setImmediate(() => callback());
          }
          return mockRes;
        })
      };

      const mockReq = {
        on: jest.fn().mockImplementation((event, callback) => {
          if (event === 'response') {
            setImmediate(() => callback(mockRes));
          }
          return mockReq;
        }),
        write: jest.fn(),
        end: jest.fn()
      };

      mockHttpRequest.mockReturnValue(mockReq);

      const parentLogger = new Logger({
        level: 'info',
        prefix: '[PARENT]',
        transports: [
          new HttpTransport({
            url: 'http://example.com/logs',
            retries: 0
          })
        ]
      });

      const childLogger = parentLogger.createChild({
        prefix: '[CHILD]'
      });

      childLogger.info('Child logger message');

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(mockHttpRequest).toHaveBeenCalled();
    });
  });

  describe('Log Levels', () => {
    it('should respect log level filtering with HttpTransport', async () => {
      const mockRes = {
        statusCode: 200,
        on: jest.fn().mockImplementation((event, callback) => {
          if (event === 'data' || event === 'end') {
            setImmediate(() => callback());
          }
          return mockRes;
        })
      };

      const mockReq = {
        on: jest.fn().mockImplementation((event, callback) => {
          if (event === 'response') {
            setImmediate(() => callback(mockRes));
          }
          return mockReq;
        }),
        write: jest.fn(),
        end: jest.fn()
      };

      mockHttpRequest.mockReturnValue(mockReq);

      const logger = new Logger({
        level: 'warn', // Only warn and above
        transports: [
          new HttpTransport({
            url: 'http://example.com/logs',
            retries: 0
          })
        ]
      });

      logger.debug('Should not send'); // Below threshold
      logger.info('Should not send');  // Below threshold
      logger.warn('Should send');      // At threshold
      logger.error('Should send');     // Above threshold

      await new Promise(resolve => setTimeout(resolve, 100));

      // Should only be called for warn and error
      expect(mockHttpRequest).toHaveBeenCalledTimes(2);
    });
  });

  describe('Metadata and Prefixes', () => {
    it('should send metadata through HttpTransport', async () => {
      let capturedBody = '';
      const mockRes = {
        statusCode: 200,
        on: jest.fn().mockImplementation((event, callback) => {
          if (event === 'data' || event === 'end') {
            setImmediate(() => callback());
          }
          return mockRes;
        })
      };

      const mockReq = {
        on: jest.fn().mockImplementation((event, callback) => {
          if (event === 'response') {
            setImmediate(() => callback(mockRes));
          }
          return mockReq;
        }),
        write: jest.fn().mockImplementation((data) => {
          capturedBody = data;
        }),
        end: jest.fn()
      };

      mockHttpRequest.mockReturnValue(mockReq);

      const logger = new Logger({
        level: 'info',
        transports: [
          new HttpTransport({
            url: 'http://example.com/logs',
            retries: 0
          })
        ]
      });

      logger.info('Test with metadata', { userId: 123, action: 'login' });

      await new Promise(resolve => setTimeout(resolve, 100));

      const parsedBody = JSON.parse(capturedBody);
      expect(parsedBody.metadata).toEqual({ userId: 123, action: 'login' });
    });

    it('should include prefix in HTTP payload', async () => {
      let capturedBody = '';
      const mockRes = {
        statusCode: 200,
        on: jest.fn().mockImplementation((event, callback) => {
          if (event === 'data' || event === 'end') {
            setImmediate(() => callback());
          }
          return mockRes;
        })
      };

      const mockReq = {
        on: jest.fn().mockImplementation((event, callback) => {
          if (event === 'response') {
            setImmediate(() => callback(mockRes));
          }
          return mockReq;
        }),
        write: jest.fn().mockImplementation((data) => {
          capturedBody = data;
        }),
        end: jest.fn()
      };

      mockHttpRequest.mockReturnValue(mockReq);

      const logger = new Logger({
        level: 'info',
        prefix: '[API]',
        transports: [
          new HttpTransport({
            url: 'http://example.com/logs',
            retries: 0
          })
        ]
      });

      logger.info('Prefixed message');

      await new Promise(resolve => setTimeout(resolve, 100));

      const parsedBody = JSON.parse(capturedBody);
      expect(parsedBody.prefix).toBe('[API]');
    });
  });

  describe('Error Scenarios', () => {
    it('should not crash Logger when HttpTransport fails in sync mode', (done) => {
      const mockReq = {
        on: jest.fn().mockImplementation((event, callback) => {
          if (event === 'error') {
            setImmediate(() => callback(new Error('Network error')));
          }
          return mockReq;
        }),
        write: jest.fn(),
        end: jest.fn()
      };

      mockHttpRequest.mockReturnValue(mockReq);

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      const logger = new Logger({
        level: 'info',
        transports: [
          new HttpTransport({
            url: 'http://example.com/logs',
            retries: 0
          })
        ]
      });

      // Should not throw
      expect(() => {
        logger.info('This should not crash');
      }).not.toThrow();

      setTimeout(() => {
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          'HttpTransport error (sync mode):',
          'Network error'
        );
        consoleErrorSpy.mockRestore();
        done();
      }, 100);
    });
  });

  describe('High-Volume Logging', () => {
    it('should handle rapid sequential logs', async () => {
      const mockRes = {
        statusCode: 200,
        on: jest.fn().mockImplementation((event, callback) => {
          if (event === 'data' || event === 'end') {
            setImmediate(() => callback());
          }
          return mockRes;
        })
      };

      const mockReq = {
        on: jest.fn().mockImplementation((event, callback) => {
          if (event === 'response') {
            setImmediate(() => callback(mockRes));
          }
          return mockReq;
        }),
        write: jest.fn(),
        end: jest.fn()
      };

      mockHttpRequest.mockReturnValue(mockReq);

      const logger = new Logger({
        level: 'info',
        transports: [
          new HttpTransport({
            url: 'http://example.com/logs',
            retries: 0
          })
        ]
      });

      // Send 10 rapid logs
      for (let i = 0; i < 10; i++) {
        logger.info(`Rapid log ${i}`);
      }

      await new Promise(resolve => setTimeout(resolve, 200));

      expect(mockHttpRequest).toHaveBeenCalledTimes(10);
    });
  });

  describe('JSON and Formatting', () => {
    it('should send JSON formatted logs', async () => {
      let capturedBody = '';
      const mockRes = {
        statusCode: 200,
        on: jest.fn().mockImplementation((event, callback) => {
          if (event === 'data' || event === 'end') {
            setImmediate(() => callback());
          }
          return mockRes;
        })
      };

      const mockReq = {
        on: jest.fn().mockImplementation((event, callback) => {
          if (event === 'response') {
            setImmediate(() => callback(mockRes));
          }
          return mockReq;
        }),
        write: jest.fn().mockImplementation((data) => {
          capturedBody = data;
        }),
        end: jest.fn()
      };

      mockHttpRequest.mockReturnValue(mockReq);

      const logger = new Logger({
        level: 'info',
        json: true,
        transports: [
          new HttpTransport({
            url: 'http://example.com/logs',
            retries: 0
          })
        ]
      });

      logger.info('JSON test', { key: 'value' });

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(() => JSON.parse(capturedBody)).not.toThrow();
      const parsedBody = JSON.parse(capturedBody);
      expect(parsedBody.message).toBe('JSON test');
      expect(parsedBody.metadata).toEqual({ key: 'value' });
    });
  });
});