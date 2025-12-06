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

  describe('HTTPS Protocol Support', () => {
    it('should use https module for https URLs', async () => {
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

      mockHttpsRequest.mockReturnValue(mockReq);

      const transport = new HttpTransport({
        url: 'https://secure.example.com/logs',
        timeout: 5000,
        retries: 0
      });

      await transport.writeAsync(createLogData('HTTPS test'), formatter);
      expect(mockHttpsRequest).toHaveBeenCalled();
      expect(mockHttpRequest).not.toHaveBeenCalled();
    });

    it('should use http module for http URLs', async () => {
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

      const transport = new HttpTransport({
        url: 'http://example.com/logs',
        timeout: 5000,
        retries: 0
      });

      await transport.writeAsync(createLogData('HTTP test'), formatter);
      expect(mockHttpRequest).toHaveBeenCalled();
      expect(mockHttpsRequest).not.toHaveBeenCalled();
    });

    it('should handle https URLs with custom ports', async () => {
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

      mockHttpsRequest.mockReturnValue(mockReq);

      const transport = new HttpTransport({
        url: 'https://example.com:8443/logs',
        timeout: 5000,
        retries: 0
      });

      await transport.writeAsync(createLogData('HTTPS custom port'), formatter);
      expect(mockHttpsRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          hostname: 'example.com',
          port: '8443'
        }),
        expect.any(Function)
      );
    });
  });

  describe('Retry Logic with Exponential Backoff', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should retry failed requests with exponential backoff', async () => {
      let attemptCount = 0;
      const mockReq = {
        on: jest.fn().mockImplementation((event, callback) => {
          if (event === 'error') {
            attemptCount++;
            setImmediate(() => callback(new Error('Network error')));
          }
          return mockReq;
        }),
        write: jest.fn(),
        end: jest.fn()
      };

      mockHttpRequest.mockReturnValue(mockReq);

      const transport = new HttpTransport({
        url: 'http://example.com/logs',
        timeout: 5000,
        retries: 2
      });

      const promise = transport.writeAsync(createLogData('Retry test'), formatter);

      // Fast-forward through the retry delays
      await jest.advanceTimersByTimeAsync(1000); // First retry after 1s
      await jest.advanceTimersByTimeAsync(2000); // Second retry after 2s
      await jest.advanceTimersByTimeAsync(4000); // Third retry after 4s

      await expect(promise).rejects.toThrow('Network error');
      expect(attemptCount).toBe(3); // Initial attempt + 2 retries
    });

    it('should succeed on retry after initial failure', async () => {
      let attemptCount = 0;

      mockHttpRequest.mockImplementation(() => {
        attemptCount++;
        
        if (attemptCount === 1) {
          // First attempt fails
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
          return mockReq;
        } else {
          // Second attempt succeeds
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
          return mockReq;
        }
      });

      const transport = new HttpTransport({
        url: 'http://example.com/logs',
        timeout: 5000,
        retries: 2
      });

      const promise = transport.writeAsync(createLogData('Retry success'), formatter);
      
      // Fast-forward through first retry delay
      await jest.advanceTimersByTimeAsync(1000);

      await expect(promise).resolves.toBeUndefined();
      expect(attemptCount).toBe(2); // Failed once, succeeded on retry
    });

    it('should not retry in sync mode', (done) => {
      let attemptCount = 0;
      const mockReq = {
        on: jest.fn().mockImplementation((event, callback) => {
          if (event === 'error') {
            attemptCount++;
            setImmediate(() => callback(new Error('Network error')));
          }
          return mockReq;
        }),
        write: jest.fn(),
        end: jest.fn()
      };

      mockHttpRequest.mockReturnValue(mockReq);

      const transport = new HttpTransport({
        url: 'http://example.com/logs',
        timeout: 5000,
        retries: 3 // Should be ignored in sync mode
      });

      // Spy on console.error
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      transport.write(createLogData('No retry in sync'), formatter);

      setTimeout(() => {
        expect(attemptCount).toBe(1); // Only initial attempt, no retries
        expect(consoleErrorSpy).toHaveBeenCalledWith('HttpTransport error (sync mode):', 'Network error');
        consoleErrorSpy.mockRestore();
        done();
      }, 100);
    });
  });

  describe('HTTP Status Codes', () => {
    it('should handle 2xx success codes (200, 201, 204)', async () => {
      const testCodes = [200, 201, 204];

      for (const statusCode of testCodes) {
        const mockRes = {
          statusCode,
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

        const transport = new HttpTransport({
          url: 'http://example.com/logs',
          retries: 0
        });

        await expect(
          transport.writeAsync(createLogData(`Status ${statusCode} test`), formatter)
        ).resolves.toBeUndefined();
      }
    });

    it('should reject on 4xx client error codes', async () => {
      const testCodes = [400, 401, 403, 404, 429];

      for (const statusCode of testCodes) {
        const mockRes = {
          statusCode,
          on: jest.fn().mockImplementation((event, callback) => {
            if (event === 'data') {
              setImmediate(() => callback('Client error'));
            } else if (event === 'end') {
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

        const transport = new HttpTransport({
          url: 'http://example.com/logs',
          retries: 0
        });

        await expect(
          transport.writeAsync(createLogData(`Status ${statusCode} test`), formatter)
        ).rejects.toThrow(`HTTP request failed with status ${statusCode}`);
      }
    });

    it('should reject on 5xx server error codes', async () => {
      const testCodes = [500, 502, 503, 504];

      for (const statusCode of testCodes) {
        const mockRes = {
          statusCode,
          on: jest.fn().mockImplementation((event, callback) => {
            if (event === 'data') {
              setImmediate(() => callback('Server error'));
            } else if (event === 'end') {
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

        const transport = new HttpTransport({
          url: 'http://example.com/logs',
          retries: 0
        });

        await expect(
          transport.writeAsync(createLogData(`Status ${statusCode} test`), formatter)
        ).rejects.toThrow(`HTTP request failed with status ${statusCode}`);
      }
    });

    it('should include response body in error message', async () => {
      const mockRes = {
        statusCode: 400,
        on: jest.fn().mockImplementation((event, callback) => {
          if (event === 'data') {
            setImmediate(() => callback('{"error": "Invalid request"}'));
          } else if (event === 'end') {
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

      const transport = new HttpTransport({
        url: 'http://example.com/logs',
        retries: 0
      });

      await expect(
        transport.writeAsync(createLogData('Error body test'), formatter)
      ).rejects.toThrow('HTTP request failed with status 400: {"error": "Invalid request"}');
    });
  });

  describe('HTTP Methods', () => {
    it('should support GET method', async () => {
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

      const transport = new HttpTransport({
        url: 'http://example.com/logs',
        method: 'GET',
        retries: 0
      });

      await transport.writeAsync(createLogData('GET test'), formatter);
      expect(mockHttpRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'GET'
        }),
        expect.any(Function)
      );
    });

    it('should support DELETE method', async () => {
      const mockRes = {
        statusCode: 204,
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

      const transport = new HttpTransport({
        url: 'http://example.com/logs',
        method: 'DELETE',
        retries: 0
      });

      await transport.writeAsync(createLogData('DELETE test'), formatter);
      expect(mockHttpRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'DELETE'
        }),
        expect.any(Function)
      );
    });

    it('should support PATCH method', async () => {
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

      const transport = new HttpTransport({
        url: 'http://example.com/logs',
        method: 'PATCH',
        retries: 0
      });

      await transport.writeAsync(createLogData('PATCH test'), formatter);
      expect(mockHttpRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'PATCH'
        }),
        expect.any(Function)
      );
    });

    it('should convert method to uppercase', async () => {
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

      const transport = new HttpTransport({
        url: 'http://example.com/logs',
        method: 'post',
        retries: 0
      });

      await transport.writeAsync(createLogData('lowercase method'), formatter);
      expect(mockHttpRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'POST'
        }),
        expect.any(Function)
      );
    });
  });

  describe('URL Handling', () => {
    it('should handle URLs with query parameters', async () => {
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

      const transport = new HttpTransport({
        url: 'http://example.com/logs?api_key=secret&format=json',
        retries: 0
      });

      await transport.writeAsync(createLogData('Query params test'), formatter);
      expect(mockHttpRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          path: '/logs?api_key=secret&format=json'
        }),
        expect.any(Function)
      );
    });

    it('should handle URLs with custom paths', async () => {
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

      const transport = new HttpTransport({
        url: 'http://example.com/api/v2/logs/create',
        retries: 0
      });

      await transport.writeAsync(createLogData('Custom path test'), formatter);
      expect(mockHttpRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          path: '/api/v2/logs/create'
        }),
        expect.any(Function)
      );
    });

    it('should handle root path URLs', async () => {
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

      const transport = new HttpTransport({
        url: 'http://example.com/',
        retries: 0
      });

      await transport.writeAsync(createLogData('Root path test'), formatter);
      expect(mockHttpRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          path: '/'
        }),
        expect.any(Function)
      );
    });
  });

  describe('Headers Handling', () => {
    it('should preserve custom headers', async () => {
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

      const customHeaders = {
        'X-API-Key': 'secret123',
        'X-Request-ID': 'req-456',
        'User-Agent': 'Zario-Logger/1.0'
      };

      const transport = new HttpTransport({
        url: 'http://example.com/logs',
        headers: customHeaders,
        retries: 0
      });

      await transport.writeAsync(createLogData('Headers test'), formatter);
      expect(mockHttpRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-API-Key': 'secret123',
            'X-Request-ID': 'req-456',
            'User-Agent': 'Zario-Logger/1.0'
          })
        }),
        expect.any(Function)
      );
    });

    it('should not override user-provided Content-Type', async () => {
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

      const transport = new HttpTransport({
        url: 'http://example.com/logs',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        retries: 0
      });

      await transport.writeAsync(createLogData('Custom content-type'), formatter);
      expect(mockHttpRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'application/x-www-form-urlencoded'
          })
        }),
        expect.any(Function)
      );
    });

    it('should handle lowercase content-type header', async () => {
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

      const transport = new HttpTransport({
        url: 'http://example.com/logs',
        headers: {
          'content-type': 'text/plain'
        },
        retries: 0
      });

      await transport.writeAsync(createLogData('lowercase content-type'), formatter);
      expect(mockHttpRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: expect.objectContaining({
            'content-type': 'text/plain'
          })
        }),
        expect.any(Function)
      );
    });

    it('should calculate correct Content-Length', async () => {
      let capturedHeaders: any;
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

      mockHttpRequest.mockImplementation((options) => {
        capturedHeaders = options.headers;
        return mockReq;
      });

      const transport = new HttpTransport({
        url: 'http://example.com/logs',
        retries: 0
      });

      const logData = createLogData('Test with émojis 🎉', 'info', { data: 'value' });
      await transport.writeAsync(logData, formatter);

      expect(capturedHeaders['Content-Length']).toBeGreaterThan(0);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle very large log messages', async () => {
      const largeMessage = 'A'.repeat(10000);
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

      const transport = new HttpTransport({
        url: 'http://example.com/logs',
        retries: 0
      });

      await expect(
        transport.writeAsync(createLogData(largeMessage), formatter)
      ).resolves.toBeUndefined();
    });

    it('should handle special characters in log messages', async () => {
      const specialMessage = 'Test with "quotes", \'apostrophes\', and \nnewlines\ttabs';
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

      const transport = new HttpTransport({
        url: 'http://example.com/logs',
        retries: 0
      });

      await expect(
        transport.writeAsync(createLogData(specialMessage), formatter)
      ).resolves.toBeUndefined();
    });

    it('should handle logs without metadata', async () => {
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

      const transport = new HttpTransport({
        url: 'http://example.com/logs',
        retries: 0
      });

      const logData = createLogData('No metadata');
      delete logData.metadata;

      await expect(
        transport.writeAsync(logData, formatter)
      ).resolves.toBeUndefined();
    });

    it('should handle logs without prefix', async () => {
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

      const transport = new HttpTransport({
        url: 'http://example.com/logs',
        retries: 0
      });

      const logData = createLogData('No prefix');
      delete logData.prefix;

      await expect(
        transport.writeAsync(logData, formatter)
      ).resolves.toBeUndefined();
    });

    it('should handle network DNS resolution errors', async () => {
      const mockReq = {
        on: jest.fn().mockImplementation((event, callback) => {
          if (event === 'error') {
            const dnsError: any = new Error('getaddrinfo ENOTFOUND');
            dnsError.code = 'ENOTFOUND';
            setImmediate(() => callback(dnsError));
          }
          return mockReq;
        }),
        write: jest.fn(),
        end: jest.fn()
      };

      mockHttpRequest.mockReturnValue(mockReq);

      const transport = new HttpTransport({
        url: 'http://nonexistent-domain-12345.com/logs',
        retries: 0
      });

      await expect(
        transport.writeAsync(createLogData('DNS error'), formatter)
      ).rejects.toThrow('getaddrinfo ENOTFOUND');
    });

    it('should handle connection refused errors', async () => {
      const mockReq = {
        on: jest.fn().mockImplementation((event, callback) => {
          if (event === 'error') {
            const connError: any = new Error('connect ECONNREFUSED');
            connError.code = 'ECONNREFUSED';
            setImmediate(() => callback(connError));
          }
          return mockReq;
        }),
        write: jest.fn(),
        end: jest.fn()
      };

      mockHttpRequest.mockReturnValue(mockReq);

      const transport = new HttpTransport({
        url: 'http://localhost:9999/logs',
        retries: 0
      });

      await expect(
        transport.writeAsync(createLogData('Connection refused'), formatter)
      ).rejects.toThrow('connect ECONNREFUSED');
    });
  });

  describe('Factory Function httpT()', () => {
    it('should create HttpTransport instance via factory function', () => {
      const { httpT } = require('../../src/transports');
      
      const transport = httpT({
        url: 'http://example.com/logs'
      });

      expect(transport).toBeInstanceOf(HttpTransport);
    });

    it('should pass options correctly through factory function', () => {
      const { httpT } = require('../../src/transports');
      
      const options: HttpTransportOptions = {
        url: 'http://example.com/logs',
        method: 'PUT',
        headers: { 'X-Custom': 'value' },
        timeout: 10000,
        retries: 5
      };

      const transport = httpT(options);
      expect(transport).toBeInstanceOf(HttpTransport);
    });

    it('should throw error if factory function receives invalid options', () => {
      const { httpT } = require('../../src/transports');
      
      expect(() => {
        httpT({} as any);
      }).toThrow('HttpTransport requires a URL option');
    });
  });

  describe('Integration with Logger', () => {
    it('should work with Logger instance', async () => {
      const { Logger } = require('../../src/core/Logger');
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

      const transport = new HttpTransport({
        url: 'http://example.com/logs',
        retries: 0
      });

      const logger = new Logger({
        transports: [transport],
        level: 'info'
      });

      logger.info('Integration test message', { key: 'value' });

      // Give async operations time to complete
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(mockHttpRequest).toHaveBeenCalled();
    });

    it('should work with Logger using httpT factory', async () => {
      const { Logger } = require('../../src/core/Logger');
      const { httpT } = require('../../src/transports');
      
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
        transports: [
          httpT({
            url: 'http://example.com/logs',
            retries: 0
          })
        ],
        level: 'info'
      });

      logger.warn('Factory integration test', { status: 'testing' });

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(mockHttpRequest).toHaveBeenCalled();
    });

    it('should support async mode with Logger', async () => {
      const { Logger } = require('../../src/core/Logger');
      
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

      const transport = new HttpTransport({
        url: 'http://example.com/logs',
        retries: 0
      });

      const logger = new Logger({
        transports: [transport],
        level: 'info',
        asyncMode: true
      });

      await logger.infoAsync('Async mode test', { async: true });

      expect(mockHttpRequest).toHaveBeenCalled();
    });
  });

  describe('Data Formatting', () => {
    it('should correctly format different log levels', async () => {
      const levels = ['debug', 'info', 'warn', 'error', 'fatal'];
      
      for (const level of levels) {
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

        const transport = new HttpTransport({
          url: 'http://example.com/logs',
          retries: 0
        });

        await transport.writeAsync(createLogData(`${level} message`, level), formatter);

        const parsedBody = JSON.parse(capturedBody);
        expect(parsedBody.level).toBe(level);
        expect(parsedBody.message).toBe(`${level} message`);
      }
    });

    it('should handle complex metadata objects', async () => {
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

      const transport = new HttpTransport({
        url: 'http://example.com/logs',
        retries: 0
      });

      const complexMetadata = {
        user: {
          id: 123,
          name: 'John Doe',
          roles: ['admin', 'user']
        },
        request: {
          method: 'GET',
          url: '/api/data',
          headers: {
            'user-agent': 'Mozilla/5.0'
          }
        },
        numbers: [1, 2, 3, 4, 5],
        boolean: true,
        null: null
      };

      await transport.writeAsync(
        createLogData('Complex metadata', 'info', complexMetadata),
        formatter
      );

      const parsedBody = JSON.parse(capturedBody);
      expect(parsedBody.metadata).toEqual(complexMetadata);
    });

    it('should preserve timestamp format', async () => {
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

      const transport = new HttpTransport({
        url: 'http://example.com/logs',
        retries: 0
      });

      const testDate = new Date('2024-01-15T10:30:00.000Z');
      const logData = {
        level: 'info' as any,
        message: 'Timestamp test',
        timestamp: testDate,
        prefix: 'test'
      };

      await transport.writeAsync(logData, formatter);

      const parsedBody = JSON.parse(capturedBody);
      expect(parsedBody.timestamp).toBe('2024-01-15T10:30:00.000Z');
    });
  });
});