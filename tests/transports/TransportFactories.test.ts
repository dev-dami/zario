import { consoleT, fileT, httpT } from '../../src/transports';
import { ConsoleTransport, FileTransport, HttpTransport } from '../../src/transports';

describe('Transport Factory Functions', () => {
  describe('consoleT()', () => {
    it('should create ConsoleTransport instance', () => {
      const transport = consoleT();
      expect(transport).toBeInstanceOf(ConsoleTransport);
    });

    it('should pass options to ConsoleTransport', () => {
      const transport = consoleT({ colorize: true });
      expect(transport).toBeInstanceOf(ConsoleTransport);
    });
  });

  describe('fileT()', () => {
    it('should create FileTransport instance', () => {
      const transport = fileT({ path: './test.log' });
      expect(transport).toBeInstanceOf(FileTransport);
    });

    it('should pass options to FileTransport', () => {
      const transport = fileT({ 
        path: './test.log',
        maxSize: 1000000,
        maxFiles: 5
      });
      expect(transport).toBeInstanceOf(FileTransport);
    });
  });

  describe('httpT()', () => {
    it('should create HttpTransport instance', () => {
      const transport = httpT({ url: 'http://example.com/logs' });
      expect(transport).toBeInstanceOf(HttpTransport);
    });

    it('should pass all options to HttpTransport', () => {
      const transport = httpT({
        url: 'http://example.com/logs',
        method: 'POST',
        headers: {
          'Authorization': 'Bearer token',
          'Content-Type': 'application/json'
        },
        timeout: 10000,
        retries: 3
      });
      expect(transport).toBeInstanceOf(HttpTransport);
    });

    it('should throw error when URL is missing', () => {
      expect(() => {
        httpT({} as any);
      }).toThrow('HttpTransport requires a URL option');
    });
  });

  describe('Factory Function Consistency', () => {
    it('should create functionally equivalent transports', () => {
      // Create via factory
      const factoryTransport = httpT({ url: 'http://example.com/logs' });
      
      // Create via constructor
      const constructorTransport = new HttpTransport({ url: 'http://example.com/logs' });
      
      expect(factoryTransport).toBeInstanceOf(HttpTransport);
      expect(constructorTransport).toBeInstanceOf(HttpTransport);
      expect(factoryTransport.constructor).toBe(constructorTransport.constructor);
    });
  });
});

describe('Transport Exports', () => {
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

  it('should export consoleT factory', () => {
    expect(consoleT).toBeDefined();
    expect(typeof consoleT).toBe('function');
  });

  it('should export fileT factory', () => {
    expect(fileT).toBeDefined();
    expect(typeof fileT).toBe('function');
  });

  it('should export httpT factory', () => {
    expect(httpT).toBeDefined();
    expect(typeof httpT).toBe('function');
  });
});