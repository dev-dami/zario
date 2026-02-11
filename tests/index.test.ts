import * as zario from '../src/index';
import { Logger, ConsoleTransport, FileTransport, HttpTransport, RetryTransport } from '../src/index';

describe('Package Exports', () => {
  describe('Main Exports', () => {
    it('should export Logger class', () => {
      expect(Logger).toBeDefined();
      expect(typeof Logger).toBe('function');
    });

    it('should export ConsoleTransport class', () => {
      expect(ConsoleTransport).toBeDefined();
      expect(typeof ConsoleTransport).toBe('function');
    });

    it('should export FileTransport class', () => {
      expect(FileTransport).toBeDefined();
      expect(typeof FileTransport).toBe('function');
    });

    it('should export HttpTransport class', () => {
      expect(HttpTransport).toBeDefined();
      expect(typeof HttpTransport).toBe('function');
    });
  });

  describe('Namespace Exports', () => {
    it('should export all classes via namespace', () => {
      expect(zario.Logger).toBeDefined();
      expect(zario.ConsoleTransport).toBeDefined();
      expect(zario.FileTransport).toBeDefined();
      expect(zario.HttpTransport).toBeDefined();
    });


  });

  describe('Transport Instantiation', () => {
    it('should create HttpTransport via export', () => {
      const transport = new HttpTransport({ url: 'http://example.com/logs' });
      expect(transport).toBeInstanceOf(HttpTransport);
    });



    it('should create HttpTransport via namespace export', () => {
      const transport = new zario.HttpTransport({ url: 'http://example.com/logs' });
      expect(transport).toBeInstanceOf(HttpTransport);
    });
  });

  describe('Usage with Logger', () => {
    it('should work with Logger using named imports', () => {
      const logger = new Logger({
        level: 'info',
        transports: [
          new HttpTransport({ url: 'http://example.com/logs', retries: 0 })
        ]
      });

      expect(logger).toBeInstanceOf(Logger);
    });



    it('should work with Logger using namespace imports', () => {
      const logger = new zario.Logger({
        level: 'info',
        transports: [
          new zario.HttpTransport({ url: 'http://example.com/logs', retries: 0 })
        ]
      });

      expect(logger).toBeInstanceOf(zario.Logger);
    });

    it('should auto-wrap transports when retryOptions are provided', () => {
      const logger = new Logger({
        level: 'info',
        transports: [new ConsoleTransport()],
        retryOptions: {
          maxAttempts: 2,
          baseDelay: 1,
          maxDelay: 2,
          jitter: false,
        }
      });

      const configuredTransport = logger.getTransports()[0];
      expect(configuredTransport).toBeInstanceOf(RetryTransport);
    });
  });
});
