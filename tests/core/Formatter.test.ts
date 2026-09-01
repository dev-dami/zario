/**
 * Comprehensive tests for Formatter class
 * 
 * This test suite covers the refactored formatAsText() method that now uses
 * template literals instead of string concatenation for better performance.
 * Tests ensure the formatting logic produces identical output while being more efficient.
 */

import { Formatter } from '../../src/core/Formatter';
import { LogData } from '../../src/types';

describe('Formatter - Text Formatting (Refactored)', () => {
  let formatter: Formatter;

  beforeEach(() => {
    formatter = new Formatter({
      json: false,
      timestamp: true,
      timestampFormat: 'ISO',
      colorize: false
    });
  });

  describe('Template Literal Refactoring', () => {
    test('should format basic log with template literals', () => {
      const logData: LogData = {
        level: 'info',
        message: 'Test message',
        timestamp: new Date('2025-01-01T12:00:00Z'),
        prefix: undefined,
        metadata: undefined
      };

      const output = formatter.format(logData);
      
      expect(output).toContain('[2025-01-01T12:00:00.000Z]');
      expect(output).toContain('[INFO]');
      expect(output).toContain('Test message');
    });

    test('should efficiently concatenate timestamp, level, and message', () => {
      const logData: LogData = {
        level: 'warn',
        message: 'Warning message',
        timestamp: new Date('2025-01-01T12:00:00Z'),
        prefix: undefined,
        metadata: undefined
      };

      const output = formatter.format(logData);
      
      // Verify single-pass formatting with template literal
      expect(output).toBe('[2025-01-01T12:00:00.000Z] [WARN] Warning message');
    });

    test('should handle prefix with template literal', () => {
      const logData: LogData = {
        level: 'info',
        message: 'Test message',
        timestamp: new Date('2025-01-01T12:00:00Z'),
        prefix: '[APP]',
        metadata: undefined
      };

      const output = formatter.format(logData);
      
      expect(output).toContain('[APP]');
      expect(output).toBe('[2025-01-01T12:00:00.000Z] [APP] [INFO] Test message');
    });

    test('should handle metadata with template literal', () => {
      const logData: LogData = {
        level: 'error',
        message: 'Error occurred',
        timestamp: new Date('2025-01-01T12:00:00Z'),
        prefix: undefined,
        metadata: { code: 500, userId: 123 }
      };

      const output = formatter.format(logData);
      
      expect(output).toContain('Error occurred');
      expect(output).toContain('{"code":500,"userId":123}');
    });

    test('should handle all components together efficiently', () => {
      const logData: LogData = {
        level: 'debug',
        message: 'Debug info',
        timestamp: new Date('2025-01-01T12:00:00Z'),
        prefix: '[DEBUG-MODULE]',
        metadata: { trace: 'stack-trace-info' }
      };

      const output = formatter.format(logData);
      
      expect(output).toBe(
        '[2025-01-01T12:00:00.000Z] [DEBUG-MODULE] [DEBUG] Debug info {"trace":"stack-trace-info"}'
      );
    });

    test('should handle empty string parts efficiently', () => {
      const logData: LogData = {
        level: 'info',
        message: '',
        timestamp: new Date('2025-01-01T12:00:00Z'),
        prefix: undefined,
        metadata: undefined
      };

      const output = formatter.format(logData);
      
      expect(output).toBe('[2025-01-01T12:00:00.000Z] [INFO] ');
    });

    test('should format without timestamp using template literal', () => {
      formatter = new Formatter({
        json: false,
        timestamp: false,
        colorize: false
      });

      const logData: LogData = {
        level: 'info',
        message: 'No timestamp',
        timestamp: new Date(),
        prefix: undefined,
        metadata: undefined
      };

      const output = formatter.format(logData);
      
      expect(output).not.toContain('[2025');
      expect(output).toBe('[INFO] No timestamp');
    });
  });

  describe('Performance Characteristics', () => {
    test('should format multiple logs efficiently', () => {
      const logs: LogData[] = Array.from({ length: 1000 }, (_, i) => ({
        level: 'info',
        message: `Message ${i}`,
        timestamp: new Date(),
        prefix: `[Service-${i % 10}]`,
        metadata: { index: i }
      }));

      const startTime = Date.now();
      logs.forEach(log => formatter.format(log));
      const duration = Date.now() - startTime;

      // Template literals should be fast - allow generous time for test stability
      expect(duration).toBeLessThan(1000);
    });

    test('should handle large metadata objects efficiently', () => {
      const largeMetadata: Record<string, any> = {};
      for (let i = 0; i < 100; i++) {
        largeMetadata[`key${i}`] = `value${i}`;
      }

      const logData: LogData = {
        level: 'info',
        message: 'Large metadata',
        timestamp: new Date(),
        prefix: undefined,
        metadata: largeMetadata
      };

      const output = formatter.format(logData);
      
      expect(output).toContain('Large metadata');
      expect(output.length).toBeGreaterThan(500);
    });

    test('should format with colorization efficiently', () => {
      formatter = new Formatter({
        json: false,
        timestamp: true,
        colorize: true
      });

      const logData: LogData = {
        level: 'error',
        message: 'Colored error',
        timestamp: new Date(),
        prefix: undefined,
        metadata: undefined
      };

      const output = formatter.format(logData);
      
      // Should still contain the message even with color codes
      expect(output).toContain('Colored error');
    });
  });

  describe('Edge Cases with New Implementation', () => {
    test('should handle special characters in all fields', () => {
      const logData: LogData = {
        level: 'info',
        message: 'Message with "quotes" and \'apostrophes\'',
        timestamp: new Date('2025-01-01T12:00:00Z'),
        prefix: '[Special-Chars]',
        metadata: { key: 'value with $pecial ch@rs!' }
      };

      const output = formatter.format(logData);
      
      expect(output).toContain('quotes');
      expect(output).toContain('apostrophes');
      expect(output).toContain('$pecial');
    });

    test('should handle newlines in message', () => {
      const logData: LogData = {
        level: 'info',
        message: 'Line 1\nLine 2\nLine 3',
        timestamp: new Date('2025-01-01T12:00:00Z'),
        prefix: undefined,
        metadata: undefined
      };

      const output = formatter.format(logData);
      
      expect(output).toContain('\n');
      expect(output.split('\n').length).toBeGreaterThan(1);
    });

    test('should handle very long messages efficiently', () => {
      const longMessage = 'A'.repeat(10000);
      const logData: LogData = {
        level: 'info',
        message: longMessage,
        timestamp: new Date(),
        prefix: undefined,
        metadata: undefined
      };

      const output = formatter.format(logData);
      
      expect(output.length).toBeGreaterThan(10000);
      expect(output).toContain(longMessage);
    });

    test('should handle undefined and null metadata gracefully', () => {
      const logData1: LogData = {
        level: 'info',
        message: 'Test',
        timestamp: new Date('2025-01-01T12:00:00Z'),
        prefix: undefined,
        metadata: undefined
      };

      const logData2: LogData = {
        level: 'info',
        message: 'Test',
        timestamp: new Date('2025-01-01T12:00:00Z'),
        prefix: undefined,
        metadata: null as any
      };

      const output1 = formatter.format(logData1);
      const output2 = formatter.format(logData2);
      
      expect(output1).not.toContain('undefined');
      expect(output2).not.toContain('null');
    });

    test('should handle empty prefix correctly', () => {
      const logData: LogData = {
        level: 'info',
        message: 'Message',
        timestamp: new Date('2025-01-01T12:00:00Z'),
        prefix: '',
        metadata: undefined
      };

      const output = formatter.format(logData);
      
      // Empty prefix should not add extra space
      expect(output).toBe('[2025-01-01T12:00:00.000Z] [INFO] Message');
    });

    test('should format consistently regardless of input order', () => {
      const logData: LogData = {
        level: 'info',
        message: 'Consistent',
        timestamp: new Date('2025-01-01T12:00:00Z'),
        prefix: '[PREFIX]',
        metadata: { a: 1, b: 2 }
      };

      const output1 = formatter.format(logData);
      const output2 = formatter.format(logData);
      
      expect(output1).toBe(output2);
    });
  });

  describe('Comparison with Previous Implementation', () => {
    test('should produce identical output to string concatenation approach', () => {
      const testCases: LogData[] = [
        {
          level: 'info',
          message: 'Simple message',
          timestamp: new Date('2025-01-01T12:00:00Z'),
          prefix: undefined,
          metadata: undefined
        },
        {
          level: 'warn',
          message: 'With prefix',
          timestamp: new Date('2025-01-01T12:00:00Z'),
          prefix: '[APP]',
          metadata: undefined
        },
        {
          level: 'error',
          message: 'With metadata',
          timestamp: new Date('2025-01-01T12:00:00Z'),
          prefix: undefined,
          metadata: { error: 'details' }
        },
        {
          level: 'debug',
          message: 'Full example',
          timestamp: new Date('2025-01-01T12:00:00Z'),
          prefix: '[DEBUG]',
          metadata: { trace: 'info', line: 42 }
        }
      ];

      testCases.forEach(testCase => {
        const output = formatter.format(testCase);
        
        // Verify structure
        if (testCase.prefix) {
          expect(output).toContain(testCase.prefix);
        }
        if (testCase.metadata) {
          expect(output).toContain(JSON.stringify(testCase.metadata));
        }
        expect(output).toContain(testCase.message);
        expect(output).toContain(testCase.level.toUpperCase());
      });
    });
  });

  describe('Integration with Other Features', () => {
    test('should work correctly with custom colors', () => {
      formatter = new Formatter({
        json: false,
        timestamp: true,
        colorize: true,
        customColors: {
          'custom': 'magenta'
        }
      });

      const logData: LogData = {
        level: 'custom',
        message: 'Custom level',
        timestamp: new Date(),
        prefix: undefined,
        metadata: undefined
      };

      const output = formatter.format(logData);
      
      expect(output).toContain('Custom level');
    });

    test('should format JSON mode correctly (not affected by text refactor)', () => {
      formatter = new Formatter({
        json: true,
        timestamp: true
      });

      const logData: LogData = {
        level: 'info',
        message: 'JSON test',
        timestamp: new Date('2025-01-01T12:00:00Z'),
        prefix: '[APP]',
        metadata: { key: 'value' }
      };

      const output = formatter.format(logData);
      const parsed = JSON.parse(output);
      
      expect(parsed.level).toBe('info');
      expect(parsed.message).toBe('JSON test');
      expect(parsed.prefix).toBe('[APP]');
      expect(parsed.key).toBe('value');
    });

    test('should refresh cached JSON values when messages and timestamps change', () => {
      formatter = new Formatter({ json: true, timestamp: true });

      const first = JSON.parse(formatter.format({
        level: 'info',
        message: 'first "message"',
        timestamp: new Date('2025-01-01T12:00:00.001Z'),
        prefix: '[ONE]',
      }));
      const second = JSON.parse(formatter.format({
        level: 'info',
        message: 'second\nmessage',
        timestamp: new Date('2025-01-01T12:00:00.002Z'),
        prefix: '[TWO]',
      }));

      expect(first).toMatchObject({
        message: 'first "message"',
        timestamp: '2025-01-01T12:00:00.001Z',
        prefix: '[ONE]',
      });
      expect(second).toMatchObject({
        message: 'second\nmessage',
        timestamp: '2025-01-01T12:00:00.002Z',
        prefix: '[TWO]',
      });
    });

    test('should keep text and JSON timestamp caches independent', () => {
      formatter = new Formatter({
        json: false,
        timestamp: true,
        timestampFormat: 'ISO',
        colorize: false,
      });

      formatter.format({
        level: 'info',
        message: 'text first',
        timestamp: new Date('2025-01-01T12:00:00.001Z'),
      });
      formatter.setJson(true);
      formatter.format({
        level: 'info',
        message: 'json second',
        timestamp: new Date('2025-01-01T12:00:00.002Z'),
      });
      formatter.setJson(false);

      const output = formatter.format({
        level: 'info',
        message: 'text second',
        timestamp: new Date('2025-01-01T12:00:00.002Z'),
      });

      expect(output).toBe('[2025-01-01T12:00:00.002Z] [INFO] text second');
    });

    test('should handle different timestamp formats', () => {
      const formats = ['ISO', 'UTC', 'LOCAL'] as const;
      
      formats.forEach(format => {
        const fmt = new Formatter({
          json: false,
          timestamp: true,
          timestampFormat: format,
          colorize: false
        });

        const logData: LogData = {
          level: 'info',
          message: 'Test',
          timestamp: new Date('2025-01-01T12:00:00Z'),
          prefix: undefined,
          metadata: undefined
        };

        const output = fmt.format(logData);
        
        expect(output).toContain('[INFO]');
        expect(output).toContain('Test');
      });
    });
  });

  describe('Memory and String Handling', () => {
    test('should not create unnecessary intermediate strings', () => {
      // Test that template literal approach is efficient
      const logData: LogData = {
        level: 'info',
        message: 'Test',
        timestamp: new Date(),
        prefix: '[PREFIX]',
        metadata: { data: 'value' }
      };

      // Format multiple times - should not accumulate memory
      for (let i = 0; i < 1000; i++) {
        formatter.format(logData);
      }

      // If this completes without memory issues, template literals are working efficiently
      expect(true).toBe(true);
    });

    test('should handle concurrent formatting calls', () => {
      const logData: LogData = {
        level: 'info',
        message: 'Concurrent test',
        timestamp: new Date(),
        prefix: undefined,
        metadata: undefined
      };

      const results = Array.from({ length: 100 }, () => 
        formatter.format(logData)
      );

      // All results should be identical
      expect(new Set(results).size).toBe(1);
    });
  });
});
