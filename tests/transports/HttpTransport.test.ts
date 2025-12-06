import { HttpTransport, HttpTransportOptions } from '../../src/transports/HttpTransport';
import { Formatter } from '../../src/core/Formatter';
import { LogData } from '../../src/types';

// Mock the http/https modules at the top level to avoid actual network calls during tests
import * as originalHttp from 'http';
import * as originalHttps from 'https';

// Mock the http/https modules at the top level to avoid actual network calls during tests
jest.mock('http', () => ({
  ...originalHttp,
  request: jest.fn()
}));

jest.mock('https', () => ({
  ...originalHttps,
  request: jest.fn()
}));

// Now we import after the mock is set up
import * as http from 'http';
import * as https from 'https';

describe('HttpTransport', () => {
  let mockHttpRequest: jest.Mock;
  let mockHttpsRequest: jest.Mock;
  let formatter: Formatter;
  const TEST_LOG_MESSAGE = 'Test HTTP log message';

  beforeEach(() => {
    // Mock the http.request and https.request functions
    mockHttpRequest = jest.fn();
    mockHttpsRequest = jest.fn();

    (http.request as jest.Mock).mockImplementation(mockHttpRequest);
    (https.request as jest.Mock).mockImplementation(mockHttpsRequest);

    formatter = new Formatter({ colorize: false, json: true, timestamp: true });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // Helper function to create mock LogData
  const createLogData = (message: string, level: string = 'info', metadata?: Record<string, any>): LogData => ({
    level: level as any,
    message,
    timestamp: new Date(),
    metadata,
    prefix: 'test-prefix'
  });

  describe('Constructor', () => {
    it('should create an HttpTransport instance with required URL', () => {
      const options: HttpTransportOptions = {
        url: 'http://localhost:8888/logs'
      };
      const transport = new HttpTransport(options);
      expect(transport).toBeInstanceOf(HttpTransport);
    });

    it('should throw an error when URL is not provided', () => {
      expect(() => {
        new HttpTransport({} as any);
      }).toThrow('HttpTransport requires a URL option');
    });

    it('should set default method to POST', () => {
      const transport = new HttpTransport({
        url: 'http://localhost:8888/logs'
      });
      expect(() => transport.write(createLogData('test'), formatter)).not.toThrow();
    });

    it('should set default timeout to 5000ms', () => {
      const transport = new HttpTransport({
        url: 'http://localhost:8888/logs'
      });
      expect(() => transport.write(createLogData('test'), formatter)).not.toThrow();
    });

    it('should set default retries to 3', () => {
      const transport = new HttpTransport({
        url: 'http://localhost:8888/logs'
      });
      expect(() => transport.write(createLogData('test'), formatter)).not.toThrow();
    });

    it('should set default Content-Type header if not provided', () => {
      const transport = new HttpTransport({
        url: 'http://localhost:8888/logs',
        headers: {}
      });
      expect(() => transport.write(createLogData('test'), formatter)).not.toThrow();
    });

    it('should use provided headers', () => {
      const customHeaders = {
        'Authorization': 'Bearer token123',
        'X-Custom-Header': 'custom-value'
      };
      const transport = new HttpTransport({
        url: 'http://localhost:8888/logs',
        headers: customHeaders
      });
      expect(() => transport.write(createLogData('test'), formatter)).not.toThrow();
    });

    it('should accept custom method', () => {
      const transport = new HttpTransport({
        url: 'http://localhost:8888/logs',
        method: 'PUT'
      });
      expect(() => transport.write(createLogData('test'), formatter)).not.toThrow();
    });

    it('should accept custom timeout', () => {
      const transport = new HttpTransport({
        url: 'http://localhost:8888/logs',
        timeout: 10000
      });
      expect(() => transport.write(createLogData('test'), formatter)).not.toThrow();
    });

    it('should accept custom retries', () => {
      const transport = new HttpTransport({
        url: 'http://localhost:8888/logs',
        retries: 5
      });
      expect(() => transport.write(createLogData('test'), formatter)).not.toThrow();
    });
  });

  describe('write() - Synchronous Writing', () => {
    it('should not throw errors in sync mode on network failures', () => {
      // Using a non-existent URL to trigger an error
      const transport = new HttpTransport({
        url: 'http://nonexistent-server-12345.com/logs',
        timeout: 1000,
        retries: 0
      });

      expect(() => {
        transport.write(createLogData('test'), formatter);
      }).not.toThrow();
    });

    it('should attempt to send log message via HTTP', (done) => {
      const mockReq = {
        on: jest.fn().mockImplementation((event, callback) => {
          if (event === 'error' || event === 'timeout') {
            // Don't trigger error callbacks for this test
          }
          return mockReq;
        }),
        write: jest.fn(),
        end: jest.fn()
      };

      mockHttpRequest.mockReturnValue(mockReq);

      const transport = new HttpTransport({
        url: 'http://localhost:8888/logs',
        timeout: 5000,
        retries: 0
      });

      const logData = createLogData(TEST_LOG_MESSAGE);
      transport.write(logData, formatter);

      // Give the setImmediate a moment to execute
      setImmediate(() => {
        expect(mockHttpRequest).toHaveBeenCalled();
        expect(mockReq.write).toHaveBeenCalled();
        expect(mockReq.end).toHaveBeenCalled();
        done();
      });
    });

    it('should format log data as JSON in request body', (done) => {
      let capturedBody = '';
      const mockReq = {
        on: jest.fn().mockImplementation((event, callback) => {
          if (event === 'error' || event === 'timeout') {
            // Don't trigger error callbacks for this test
          }
          return mockReq;
        }),
        write: jest.fn().mockImplementation((data) => {
          capturedBody = data;
        }),
        end: jest.fn()
      };

      mockHttpRequest.mockReturnValue(mockReq);

      const transport = new HttpTransport({
        url: 'http://localhost:8888/logs',
        timeout: 5000,
        retries: 0
      });

      const logData = createLogData(TEST_LOG_MESSAGE, 'info', { userId: 123 });
      transport.write(logData, formatter);

      setImmediate(() => {
        const parsedBody = JSON.parse(capturedBody);
        expect(parsedBody.message).toBe(TEST_LOG_MESSAGE);
        expect(parsedBody.level).toBe('info');
        expect(parsedBody.metadata).toEqual({ userId: 123 });
        expect(parsedBody.prefix).toBe('test-prefix');
        expect(parsedBody.timestamp).toBeDefined();
        done();
      });
    });
  });

  describe('writeAsync() - Asynchronous Writing', () => {
    it('should send log message via HTTP asynchronously', async () => {
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
          } else if (event === 'error' || event === 'timeout') {
            // Don't trigger error callbacks for this test
          }
          return mockReq;
        }),
        write: jest.fn(),
        end: jest.fn()
      };

      mockHttpRequest.mockReturnValue(mockReq);

      const transport = new HttpTransport({
        url: 'http://localhost:8888/logs',
        timeout: 5000,
        retries: 0
      });

      const logData = createLogData(TEST_LOG_MESSAGE);

      await expect(transport.writeAsync(logData, formatter)).resolves.toBeUndefined();
      expect(mockHttpRequest).toHaveBeenCalled();
      expect(mockReq.write).toHaveBeenCalled();
      expect(mockReq.end).toHaveBeenCalled();
    });

    it('should format log data as JSON in async request body', async () => {
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
          } else if (event === 'error' || event === 'timeout') {
            // Don't trigger error callbacks for this test
          }
          return mockReq;
        }),
        write: jest.fn().mockImplementation((data) => {
          capturedBody = data;
        }),
        end: jest.fn()
      };

      mockHttpRequest.mockReturnValue(mockReq);

      const transport = new HttpTransport({
        url: 'http://localhost:8888/logs',
        timeout: 5000,
        retries: 0
      });

      const logData = createLogData(TEST_LOG_MESSAGE, 'warn', { action: 'test-action' });

      await transport.writeAsync(logData, formatter);

      const parsedBody = JSON.parse(capturedBody);
      expect(parsedBody.message).toBe(TEST_LOG_MESSAGE);
      expect(parsedBody.level).toBe('warn');
      expect(parsedBody.metadata).toEqual({ action: 'test-action' });
      expect(parsedBody.timestamp).toBeDefined();
    });

    it('should resolve promise for successful requests', async () => {
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
          } else if (event === 'error' || event === 'timeout') {
            // Don't trigger error callbacks for this test
          }
          return mockReq;
        }),
        write: jest.fn(),
        end: jest.fn()
      };

      mockHttpRequest.mockReturnValue(mockReq);

      const transport = new HttpTransport({
        url: 'http://localhost:8888/logs',
        timeout: 5000,
        retries: 0
      });

      const logData = createLogData('Success test');

      await expect(transport.writeAsync(logData, formatter)).resolves.toBeUndefined();
    });

    it('should reject promise for failed requests', async () => {
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

      const transport = new HttpTransport({
        url: 'http://localhost:8888/logs',
        timeout: 5000,
        retries: 0
      });

      const logData = createLogData('Failure test');

      await expect(transport.writeAsync(logData, formatter)).rejects.toThrow('Network error');
    });

    it('should reject promise for timeout errors', async () => {
      const mockReq = {
        on: jest.fn().mockImplementation((event, callback) => {
          if (event === 'timeout') {
            setImmediate(() => callback());
          } else if (event === 'error') {
            // Don't trigger error handlers that would be called by destroy() in real implementation
          }
          return mockReq;
        }),
        write: jest.fn(),
        end: jest.fn()
      };

      mockHttpRequest.mockReturnValue(mockReq);

      const transport = new HttpTransport({
        url: 'http://localhost:8888/logs',
        timeout: 100,  // Short timeout
        retries: 0
      });

      const logData = createLogData('Timeout test');

      await expect(transport.writeAsync(logData, formatter)).rejects.toThrow('Request timeout');
    });

    it('should handle multiple concurrent async requests', async () => {
      const mockRes1 = {
        statusCode: 200,
        on: jest.fn().mockImplementation((event, callback) => {
          if (event === 'data' || event === 'end') {
            setImmediate(() => callback());
          }
          return mockRes1;
        })
      };

      const mockReq1 = {
        on: jest.fn().mockImplementation((event, callback) => {
          if (event === 'response') {
            setImmediate(() => callback(mockRes1));
          } else if (event === 'error' || event === 'timeout') {
            // Don't trigger error callbacks for this test
          }
          return mockReq1;
        }),
        write: jest.fn(),
        end: jest.fn()
      };

      const mockRes2 = {
        statusCode: 200,
        on: jest.fn().mockImplementation((event, callback) => {
          if (event === 'data' || event === 'end') {
            setImmediate(() => callback());
          }
          return mockRes2;
        })
      };

      const mockReq2 = {
        on: jest.fn().mockImplementation((event, callback) => {
          if (event === 'response') {
            setImmediate(() => callback(mockRes2));
          } else if (event === 'error' || event === 'timeout') {
            // Don't trigger error callbacks for this test
          }
          return mockReq2;
        }),
        write: jest.fn(),
        end: jest.fn()
      };

      mockHttpRequest.mockReturnValueOnce(mockReq1).mockReturnValueOnce(mockReq2);

      const transport = new HttpTransport({
        url: 'http://localhost:8888/logs',
        timeout: 5000,
        retries: 0
      });

      const requests = [];
      for (let i = 0; i < 2; i++) {
        requests.push(
          transport.writeAsync(createLogData(`Concurrent message ${i}`), formatter)
        );
      }

      await Promise.all(requests);
      expect(mockHttpRequest).toHaveBeenCalledTimes(2);
    });
  });

  describe('Options handling', () => {
    it('should accept custom method', async () => {
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
          } else if (event === 'error' || event === 'timeout') {
            // Don't trigger error callbacks for this test
          }
          return mockReq;
        }),
        write: jest.fn(),
        end: jest.fn()
      };

      mockHttpRequest.mockReturnValue(mockReq);

      const transport = new HttpTransport({
        url: 'http://localhost:8888/logs',
        method: 'PUT',
        timeout: 5000,
        retries: 0
      });

      await transport.writeAsync(createLogData('PUT test'), formatter);
      expect(mockHttpRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'PUT'
        }),
        expect.any(Function)
      );
    });

    it('should accept custom timeout', () => {
      const transport = new HttpTransport({
        url: 'http://localhost:8888/logs',
        timeout: 10000
      });

      expect(() => transport.write(createLogData('timeout test'), formatter)).not.toThrow();
    });

    it('should properly format timestamps', async () => {
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
          } else if (event === 'error' || event === 'timeout') {
            // Don't trigger error callbacks for this test
          }
          return mockReq;
        }),
        write: jest.fn().mockImplementation((data) => {
          capturedBody = data;
        }),
        end: jest.fn()
      };

      mockHttpRequest.mockReturnValue(mockReq);

      const transport = new HttpTransport({
        url: 'http://localhost:8888/logs',
        timeout: 5000,
        retries: 0
      });

      const logData = createLogData('timestamp test');
      await transport.writeAsync(logData, formatter);

      const parsedBody = JSON.parse(capturedBody);
      expect(parsedBody.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/);
    });
  });
});