/**
 * Tests for Environment Detection & Auto-Config functionality
 * 
 * This test suite verifies the auto-configuration based on NODE_ENV:
 * - Development: colorized, debug level
 * - Production: JSON, warn level, file transport
 */

import { Logger } from '../../src/core/Logger';
import { Transport } from '../../src/transports/Transport';
import { ConsoleTransport } from '../../src/transports/ConsoleTransport';
import { FileTransport } from '../../src/transports/FileTransport';

// Setup default transport factory for tests
beforeAll(() => {
  Logger.defaultTransportsFactory = (isProd: boolean) => {
    if (isProd) {
      return [new ConsoleTransport(), new FileTransport({ path: "./logs/app.log" })];
    } else {
      return [new ConsoleTransport()];
    }
  };
});

afterAll(() => {
  Logger.defaultTransportsFactory = null;
});

// Mock transport to inspect configuration
class MockTransport implements Transport {
  public logs: any[] = [];
  public writeCallCount = 0;
  public writeAsyncCallCount = 0;
  public lastWriteData: any = null;

  write(data: any): void {
    this.writeCallCount++;
    this.logs.push(data);
    this.lastWriteData = data;
  }

  async writeAsync(data: any): Promise<void> {
    this.writeAsyncCallCount++;
    this.logs.push(data);
    this.lastWriteData = data;
    return Promise.resolve();
  }
}

describe('Environment Detection & Auto-Config', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = Object.assign({}, process.env);
  });

  afterEach(() => {
    // Clear all current environment variables
    Object.keys(process.env).forEach(key => {
      delete process.env[key];
    });
    // Restore original environment variables
    Object.assign(process.env, originalEnv);
  });

  describe('Development Environment (NODE_ENV=development)', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'development';
    });

    test('should default to debug level', () => {
      const logger = new Logger();
      expect(logger['level']).toBe('debug');
    });

    test('should default to colorized output', () => {
      const logger = new Logger();
      expect(logger['formatter'].isColorized()).toBe(true);
    });

    test('should default to text format (not JSON)', () => {
      const logger = new Logger();
      expect(logger['formatter'].isJson()).toBe(false);
    });

    test('should default to async mode as false in development', () => {
      const logger = new Logger();
      expect(logger['asyncMode']).toBe(false);
    });

    test('should default to console transport only in development', () => {
      const logger = new Logger();
      // Should have console transport
      expect(logger['transports']).toHaveLength(1);
      // We can't easily check transport types without more complex mocking,
      // but we can verify that it's not using file transport by default in dev
    });

    test('should include timestamp by default', () => {
      const logger = new Logger();
      expect(logger['formatter'].hasTimestamp()).toBe(true);
    });

    test('should allow override of auto-configured values', () => {
      const logger = new Logger({
        level: 'error',
        colorize: false,
        json: true,
        asyncMode: true
      });

      expect(logger['level']).toBe('error');
      expect(logger['formatter'].isColorized()).toBe(false);
      expect(logger['formatter'].isJson()).toBe(true);
      expect(logger['asyncMode']).toBe(true);
    });
  });

  describe('Production Environment (NODE_ENV=production)', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'production';
    });

    test('should default to warn level', () => {
      const logger = new Logger();
      expect(logger['level']).toBe('warn');
    });

    test('should default to non-colorized output', () => {
      const logger = new Logger();
      expect(logger['formatter'].isColorized()).toBe(false);
    });

    test('should default to JSON format', () => {
      const logger = new Logger();
      expect(logger['formatter'].isJson()).toBe(true);
    });

    test('should default to async mode as true in production', () => {
      const logger = new Logger();
      expect(logger['asyncMode']).toBe(true);
    });

    test('should default to both console and file transports in production', () => {
      const logger = new Logger();
      // Should have at least console transport, potentially file too
      expect(logger['transports']).toHaveLength(2); // console + file
    });

    test('should include timestamp by default', () => {
      const logger = new Logger();
      expect(logger['formatter'].hasTimestamp()).toBe(true);
    });

    test('should allow override of auto-configured values', () => {
      const logger = new Logger({
        level: 'debug',
        colorize: true,
        json: false,
        asyncMode: false
      });

      expect(logger['level']).toBe('debug');
      expect(logger['formatter'].isColorized()).toBe(true);
      expect(logger['formatter'].isJson()).toBe(false);
      expect(logger['asyncMode']).toBe(false);
    });
  });

  describe('Production Environment (NODE_ENV=prod)', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'prod';
    });

    test('should treat NODE_ENV=prod as production', () => {
      const logger = new Logger();
      expect(logger['level']).toBe('warn');
      expect(logger['formatter'].isJson()).toBe(true);
      expect(logger['formatter'].isColorized()).toBe(false);
      expect(logger['asyncMode']).toBe(true);
    });
  });

  describe('Development Environment (NODE_ENV=test)', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'test';
    });

    test('should treat NODE_ENV=test as development', () => {
      const logger = new Logger();
      expect(logger['level']).toBe('debug');
      expect(logger['formatter'].isJson()).toBe(false);
      expect(logger['formatter'].isColorized()).toBe(true);
      expect(logger['asyncMode']).toBe(false);
    });
  });

  describe('Development Environment (NODE_ENV=staging)', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'staging';
    });

    test('should treat NODE_ENV=staging as development (not production)', () => {
      const logger = new Logger();
      expect(logger['level']).toBe('debug'); // staging is not production
      expect(logger['formatter'].isJson()).toBe(false);
      expect(logger['formatter'].isColorized()).toBe(true);
      expect(logger['asyncMode']).toBe(false);
    });
  });

  describe('No Environment Set', () => {
    beforeEach(() => {
      delete process.env.NODE_ENV;
    });

    test('should default to development settings when no NODE_ENV is set', () => {
      const logger = new Logger();
      expect(logger['level']).toBe('debug');
      expect(logger['formatter'].isJson()).toBe(false);
      expect(logger['formatter'].isColorized()).toBe(true);
      expect(logger['asyncMode']).toBe(false);
    });
  });

  describe('Case Insensitive Environment', () => {
    test('should handle production in uppercase', () => {
      process.env.NODE_ENV = 'PRODUCTION';
      const logger = new Logger();
      expect(logger['level']).toBe('warn');
      expect(logger['formatter'].isJson()).toBe(true);
      expect(logger['formatter'].isColorized()).toBe(false);
    });

    test('should handle production in mixed case', () => {
      process.env.NODE_ENV = 'Production';
      const logger = new Logger();
      expect(logger['level']).toBe('warn');
      expect(logger['formatter'].isJson()).toBe(true);
      expect(logger['formatter'].isColorized()).toBe(false);
    });

    test('should handle prod in mixed case', () => {
      process.env.NODE_ENV = 'Prod';
      const logger = new Logger();
      expect(logger['level']).toBe('warn');
      expect(logger['formatter'].isJson()).toBe(true);
      expect(logger['formatter'].isColorized()).toBe(false);
    });
  });

  describe('Integration with Logging', () => {
    test('development config should produce expected output format', () => {
      process.env.NODE_ENV = 'development';
      const mockTransport = new MockTransport();

      const logger = new Logger({
        transports: [mockTransport]
      });

      logger.info('Test message');

      expect(mockTransport.logs).toHaveLength(1);
      const logData = mockTransport.logs[0];
      expect(logData.message).toBe('Test message');
      expect(logData.level).toBe('info');
      expect(logData.timestamp).toBeInstanceOf(Date);
    });

    test('production config should produce expected output format', () => {
      process.env.NODE_ENV = 'production';
      const mockTransport = new MockTransport();

      const logger = new Logger({
        level: 'info', // Override default 'warn' level to test info logging
        transports: [mockTransport]
      });

      logger.info('Test message');

      expect(mockTransport.logs).toHaveLength(1);
      const logData = mockTransport.logs[0];
      expect(logData.message).toBe('Test message');
      expect(logData.level).toBe('info');
      expect(logData.timestamp).toBeInstanceOf(Date);
    });

    test('production config should have higher default level (warn vs debug)', () => {
      process.env.NODE_ENV = 'production';
      const mockTransport = new MockTransport();

      const logger = new Logger({
        transports: [mockTransport]
      });

      logger.debug('Debug message');  // Should be filtered out
      logger.info('Info message');    // Should be filtered out
      logger.warn('Warning message'); // Should be logged
      logger.error('Error message');  // Should be logged

      // Only warn and error should be logged in production (default level is warn)
      expect(mockTransport.logs).toHaveLength(2);
      expect(mockTransport.logs[0].message).toBe('Warning message');
      expect(mockTransport.logs[1].message).toBe('Error message');
    });
  });

  describe('Child Logger Inheritance', () => {
    test('child logger should inherit parent environment-based settings', () => {
      process.env.NODE_ENV = 'production';
      const parentLogger = new Logger();

      const childLogger = parentLogger.createChild();

      // Child should inherit parent's configured values
      expect(childLogger['level']).toBe(parentLogger['level']);
      expect(childLogger['formatter'].isJson()).toBe(parentLogger['formatter'].isJson());
      expect(childLogger['formatter'].isColorized()).toBe(parentLogger['formatter'].isColorized());
      expect(childLogger['asyncMode']).toBe(parentLogger['asyncMode']);
    });

    test('child logger can override inherited environment-based settings', () => {
      process.env.NODE_ENV = 'production';
      const parentLogger = new Logger();

      const childLogger = parentLogger.createChild({
        level: 'debug',
        json: false,
        colorize: true
      });

      // Child should override parent's configured values
      expect(childLogger['level']).toBe('debug');
      expect(childLogger['formatter'].isJson()).toBe(false);
      expect(childLogger['formatter'].isColorized()).toBe(true);
    });
  });
});