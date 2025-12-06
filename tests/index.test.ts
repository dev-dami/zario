import * as zario from '../src/index';
import { Logger, ConsoleTransport, FileTransport, HttpTransport, consoleT, fileT, httpT } from '../src/index';

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

    it('should export consoleT factory function', () => {
      expect(consoleT).toBeDefined();
      expect(typeof consoleT).toBe('function');
    });

    it('should export fileT factory function', () => {
      expect(fileT).toBeDefined();
      expect(typeof fileT).toBe('function');
    });

    it('should export httpT factory function', () => {
      expect(httpT).toBeDefined();
      expect(typeof httpT).toBe('function');
    });
  });

  describe('Namespace Exports', () => {
    it('should export all classes via namespace', () => {
      expect(zario.Logger).toBeDefined();
      expect(zario.ConsoleTransport).toBeDefined();
      expect(zario.FileTransport).toBeDefined();
      expect(zario.HttpTransport).toBeDefined();
    });

    it('should export all factory functions via namespace', () => {
      expect(zario.consoleT).toBeDefined();
      expect(zario.fileT).toBeDefined();
      expect(zario.httpT).toBeDefined();
    });
  });

  describe('Transport Instantiation', () => {
    it('should create HttpTransport via export', () => {
      const transport = new HttpTransport({ url: 'http://example.com/logs' });
      expect(transport).toBeInstanceOf(HttpTransport);
    });

    it('should create HttpTransport via factory export', () => {
      const transport = httpT({ url: 'http://example.com/logs' });
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

    it('should work with Logger using factory functions', () => {
      const logger = new Logger({
        level: 'info',
        transports: [
          httpT({ url: 'http://example.com/logs', retries: 0 })
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
  });
});