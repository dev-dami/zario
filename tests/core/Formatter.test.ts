import { Formatter } from "../../src/core/Formatter";
import { LogData } from "../../src/types";
import { LogLevel } from "../../src/core/LogLevel";

describe("Formatter", () => {
  let formatter: Formatter;
  let testLogData: LogData;

  beforeEach(() => {
    testLogData = {
      level: "info",
      message: "Test message",
      timestamp: new Date("2024-01-15T10:30:45.123Z"),
      metadata: { key: "value" },
      prefix: "TEST",
    };
  });

  describe("Text formatting with template literals", () => {
    test("should format complete log entry with all components using template literal", () => {
      formatter = new Formatter({
        colorize: false,
        json: false,
        timestamp: true,
        timestampFormat: "YYYY-MM-DD HH:mm:ss",
      });

      const result = formatter.format(testLogData);

      // Verify all components are present in correct order
      expect(result).toContain("[2024-01-15 10:30:45]");
      expect(result).toContain("INFO -");
      expect(result).toContain("TEST");
      expect(result).toContain("Test message");
      expect(result).toContain('{"key":"value"}');
    });

    test("should handle empty prefix correctly in template literal", () => {
      formatter = new Formatter({
        colorize: false,
        json: false,
        timestamp: false,
      });

      const logDataWithoutPrefix: LogData = {
        ...testLogData,
        prefix: undefined,
      };

      const result = formatter.format(logDataWithoutPrefix);

      // Should not have double spaces where prefix would be
      expect(result).not.toContain("INFO -  Test");
      expect(result).toBe("INFO - Test message {\"key\":\"value\"}");
    });

    test("should handle empty metadata correctly in template literal", () => {
      formatter = new Formatter({
        colorize: false,
        json: false,
        timestamp: false,
      });

      const logDataWithoutMetadata: LogData = {
        ...testLogData,
        metadata: undefined,
      };

      const result = formatter.format(logDataWithoutMetadata);

      // Should not have trailing space or metadata
      expect(result).toBe("INFO - TEST Test message");
      expect(result).not.toContain("{}");
    });

    test("should handle empty timestamp correctly in template literal", () => {
      formatter = new Formatter({
        colorize: false,
        json: false,
        timestamp: false,
      });

      const result = formatter.format(testLogData);

      // Should not start with timestamp brackets
      expect(result).not.toMatch(/^\[/);
      expect(result).toMatch(/^INFO - /);
    });

    test("should construct output with only level and message when minimal data", () => {
      formatter = new Formatter({
        colorize: false,
        json: false,
        timestamp: false,
      });

      const minimalLogData: LogData = {
        level: "error",
        message: "Error occurred",
        timestamp: new Date(),
      };

      const result = formatter.format(minimalLogData);

      expect(result).toBe("ERROR - Error occurred");
    });

    test("should handle all optional components being present", () => {
      formatter = new Formatter({
        colorize: false,
        json: false,
        timestamp: true,
        timestampFormat: "YYYY-MM-DD HH:mm:ss.SSS",
      });

      const result = formatter.format(testLogData);

      // All components should be concatenated correctly
      const parts = [
        "[2024-01-15 10:30:45.123]",
        "INFO -",
        "TEST",
        "Test message",
        '{"key":"value"}',
      ];

      for (const part of parts) {
        expect(result).toContain(part);
      }

      // Verify order is maintained
      const timestampIndex = result.indexOf("[2024-01-15");
      const levelIndex = result.indexOf("INFO -");
      const prefixIndex = result.indexOf("TEST");
      const messageIndex = result.indexOf("Test message");
      const metadataIndex = result.indexOf('{"key":"value"}');

      expect(timestampIndex).toBeLessThan(levelIndex);
      expect(levelIndex).toBeLessThan(prefixIndex);
      expect(prefixIndex).toBeLessThan(messageIndex);
      expect(messageIndex).toBeLessThan(metadataIndex);
    });

    test("should format with custom timestamp format", () => {
      formatter = new Formatter({
        colorize: false,
        json: false,
        timestamp: true,
        timestampFormat: "DD/MM/YYYY HH:mm",
      });

      const result = formatter.format(testLogData);

      expect(result).toContain("[15/01/2024 10:30]");
    });

    test("should handle different log levels correctly", () => {
      formatter = new Formatter({
        colorize: false,
        json: false,
        timestamp: false,
      });

      const levels: LogLevel[] = ["debug", "info", "warn", "error", "silent", "boring"];

      for (const level of levels) {
        const logData: LogData = {
          ...testLogData,
          level,
        };

        const result = formatter.format(logData);
        expect(result).toContain(`${level.toUpperCase()} -`);
      }
    });

    test("should handle metadata with nested objects", () => {
      formatter = new Formatter({
        colorize: false,
        json: false,
        timestamp: false,
      });

      const logDataWithNestedMetadata: LogData = {
        ...testLogData,
        metadata: {
          user: { id: 123, name: "John" },
          timestamp: 1234567890,
          tags: ["error", "critical"],
        },
      };

      const result = formatter.format(logDataWithNestedMetadata);

      expect(result).toContain('"user":{"id":123,"name":"John"}');
      expect(result).toContain('"tags":["error","critical"]');
    });

    test("should handle metadata with special characters", () => {
      formatter = new Formatter({
        colorize: false,
        json: false,
        timestamp: false,
      });

      const logDataWithSpecialChars: LogData = {
        ...testLogData,
        metadata: {
          message: 'Contains "quotes" and \\ backslashes',
          path: "/path/to/file",
        },
      };

      const result = formatter.format(logDataWithSpecialChars);

      // JSON.stringify should properly escape special characters
      expect(result).toContain('\\"quotes\\"');
      expect(result).toContain("/path/to/file");
    });

    test("should handle empty string message", () => {
      formatter = new Formatter({
        colorize: false,
        json: false,
        timestamp: false,
      });

      const logDataWithEmptyMessage: LogData = {
        ...testLogData,
        message: "",
      };

      const result = formatter.format(logDataWithEmptyMessage);

      expect(result).toBe('INFO - TEST  {"key":"value"}');
    });

    test("should handle very long messages", () => {
      formatter = new Formatter({
        colorize: false,
        json: false,
        timestamp: false,
      });

      const longMessage = "A".repeat(1000);
      const logDataWithLongMessage: LogData = {
        ...testLogData,
        message: longMessage,
      };

      const result = formatter.format(logDataWithLongMessage);

      expect(result).toContain(longMessage);
      expect(result.length).toBeGreaterThan(1000);
    });

    test("should handle prefix with special characters", () => {
      formatter = new Formatter({
        colorize: false,
        json: false,
        timestamp: false,
      });

      const logDataWithSpecialPrefix: LogData = {
        ...testLogData,
        prefix: "[API:v2]",
      };

      const result = formatter.format(logDataWithSpecialPrefix);

      expect(result).toContain("[API:v2]");
    });

    test("should maintain consistent spacing between components", () => {
      formatter = new Formatter({
        colorize: false,
        json: false,
        timestamp: true,
        timestampFormat: "YYYY-MM-DD HH:mm:ss",
      });

      const result = formatter.format(testLogData);

      // Check for proper spacing: timestamp space, level dash space, prefix space, metadata space
      expect(result).toMatch(/\[.*\] \w+ - \w+ .* \{.*\}/);
    });
  });

  describe("Template literal optimization verification", () => {
    test("should not have multiple concatenation operations (performance check)", () => {
      formatter = new Formatter({
        colorize: false,
        json: false,
        timestamp: true,
        timestampFormat: "YYYY-MM-DD HH:mm:ss",
      });

      // Multiple calls should be consistent and fast
      const results: string[] = [];
      const startTime = Date.now();

      for (let i = 0; i < 1000; i++) {
        results.push(formatter.format(testLogData));
      }

      const endTime = Date.now();

      // All results should be identical
      expect(new Set(results).size).toBe(1);

      // Should complete in reasonable time (less than 100ms for 1000 iterations)
      expect(endTime - startTime).toBeLessThan(100);
    });

    test("should handle rapid formatting with varying components", () => {
      formatter = new Formatter({
        colorize: false,
        json: false,
        timestamp: false,
      });

      const testCases = [
        { level: "info", message: "msg1", timestamp: new Date(), prefix: "P1" },
        { level: "error", message: "msg2", timestamp: new Date() },
        {
          level: "debug",
          message: "msg3",
          timestamp: new Date(),
          metadata: { x: 1 },
        },
        {
          level: "warn",
          message: "msg4",
          timestamp: new Date(),
          prefix: "P2",
          metadata: { y: 2 },
        },
      ] as LogData[];

      const results = testCases.map((tc) => formatter.format(tc));

      expect(results.length).toBe(4);
      expect(results[0]).toContain("P1");
      expect(results[1]).not.toContain("P1");
      expect(results[2]).toContain('"x":1');
      expect(results[3]).toContain("P2");
      expect(results[3]).toContain('"y":2');
    });
  });

  describe("Colorized formatting", () => {
    test("should apply colors when colorize is enabled", () => {
      formatter = new Formatter({
        colorize: true,
        json: false,
        timestamp: false,
      });

      const result = formatter.format(testLogData);

      // Should contain ANSI color codes
      expect(result).toMatch(/\x1b\[\d+m/);
      expect(result).toContain("\x1b[0m"); // Reset code
    });

    test("should use custom colors when provided", () => {
      formatter = new Formatter({
        colorize: true,
        json: false,
        timestamp: false,
        customColors: {
          info: "blue",
        },
      });

      const result = formatter.format(testLogData);

      // Should contain blue color code
      expect(result).toContain("\x1b[34m");
    });

    test("should not apply colors when colorize is disabled", () => {
      formatter = new Formatter({
        colorize: false,
        json: false,
        timestamp: false,
      });

      const result = formatter.format(testLogData);

      // Should not contain ANSI color codes
      expect(result).not.toMatch(/\x1b\[\d+m/);
    });
  });

  describe("JSON formatting", () => {
    test("should format as JSON when json is true", () => {
      formatter = new Formatter({
        colorize: false,
        json: true,
        timestamp: true,
      });

      const result = formatter.format(testLogData);

      const parsed = JSON.parse(result);
      expect(parsed.level).toBe("info");
      expect(parsed.message).toBe("Test message");
      expect(parsed.key).toBe("value");
      expect(parsed.prefix).toBe("TEST");
      expect(parsed.timestamp).toBe("2024-01-15T10:30:45.123Z");
    });

    test("should flatten metadata in JSON format", () => {
      formatter = new Formatter({
        colorize: false,
        json: true,
        timestamp: false,
      });

      const result = formatter.format(testLogData);

      const parsed = JSON.parse(result);
      expect(parsed.level).toBe("info");
      expect(parsed.message).toBe("Test message");
      expect(parsed.key).toBe("value");
      expect(parsed.prefix).toBe("TEST");
      expect(parsed.timestamp).toBeUndefined();
    });

    test("should omit timestamp in JSON when timestamp is false", () => {
      formatter = new Formatter({
        colorize: false,
        json: true,
        timestamp: false,
      });

      const result = formatter.format(testLogData);

      const parsed = JSON.parse(result);
      expect(parsed).not.toHaveProperty("timestamp");
    });

    test("should omit prefix in JSON when prefix is undefined", () => {
      formatter = new Formatter({
        colorize: false,
        json: true,
        timestamp: false,
      });

      const logDataWithoutPrefix: LogData = {
        ...testLogData,
        prefix: undefined,
      };

      const result = formatter.format(logDataWithoutPrefix);

      const parsed = JSON.parse(result);
      expect(parsed).not.toHaveProperty("prefix");
    });
  });

  describe("Formatter configuration", () => {
    test("should use default values when no options provided", () => {
      formatter = new Formatter();

      expect(formatter.isColorized()).toBe(true);
      expect(formatter.isJson()).toBe(false);
      expect(formatter.hasTimestamp()).toBe(false);
      expect(formatter.getTimestampFormat()).toBe("YYYY-MM-DD HH:mm:ss");
    });

    test("should allow changing format to JSON", () => {
      formatter = new Formatter({ json: false });

      expect(formatter.isJson()).toBe(false);

      formatter.setJson(true);

      expect(formatter.isJson()).toBe(true);
    });

    test("should return copy of custom colors", () => {
      const customColors = { info: "blue", error: "red" };
      formatter = new Formatter({ customColors });

      const retrieved = formatter.getCustomColors();

      expect(retrieved).toEqual(customColors);
      expect(retrieved).not.toBe(customColors); // Should be a copy
    });

    test("should not mutate custom colors when retrieved copy is modified", () => {
      const customColors = { info: "blue" };
      formatter = new Formatter({ customColors });

      const retrieved = formatter.getCustomColors();
      retrieved.error = "red";

      const retrievedAgain = formatter.getCustomColors();
      expect(retrievedAgain).toEqual({ info: "blue" });
      expect(retrievedAgain).not.toHaveProperty("error");
    });
  });

  describe("Edge cases and error handling", () => {
    test("should handle undefined metadata gracefully", () => {
      formatter = new Formatter({
        colorize: false,
        json: false,
        timestamp: false,
      });

      const logDataWithUndefinedMetadata: LogData = {
        level: "info",
        message: "Test",
        timestamp: new Date(),
        metadata: undefined,
      };

      const result = formatter.format(logDataWithUndefinedMetadata);

      expect(result).toBe("INFO - Test");
    });

    test("should handle empty metadata object", () => {
      formatter = new Formatter({
        colorize: false,
        json: false,
        timestamp: false,
      });

      const logDataWithEmptyMetadata: LogData = {
        level: "info",
        message: "Test",
        timestamp: new Date(),
        metadata: {},
      };

      const result = formatter.format(logDataWithEmptyMetadata);

      expect(result).toBe("INFO - Test {}");
    });

    test("should handle null values in metadata", () => {
      formatter = new Formatter({
        colorize: false,
        json: false,
        timestamp: false,
      });

      const logDataWithNullMetadata: LogData = {
        level: "info",
        message: "Test",
        timestamp: new Date(),
        metadata: { value: null },
      };

      const result = formatter.format(logDataWithNullMetadata);

      expect(result).toContain('"value":null');
    });

    test("should handle undefined values in metadata", () => {
      formatter = new Formatter({
        colorize: false,
        json: false,
        timestamp: false,
      });

      const logDataWithUndefinedValue: LogData = {
        level: "info",
        message: "Test",
        timestamp: new Date(),
        metadata: { value: undefined },
      };

      const result = formatter.format(logDataWithUndefinedValue);

      // JSON.stringify omits undefined values
      expect(result).toBe("INFO - Test {}");
    });

    test("should handle date objects in metadata", () => {
      formatter = new Formatter({
        colorize: false,
        json: false,
        timestamp: false,
      });

      const dateValue = new Date("2024-01-01T00:00:00.000Z");
      const logDataWithDateMetadata: LogData = {
        level: "info",
        message: "Test",
        timestamp: new Date(),
        metadata: { date: dateValue },
      };

      const result = formatter.format(logDataWithDateMetadata);

      expect(result).toContain('"date":"2024-01-01T00:00:00.000Z"');
    });

    test("should handle arrays in metadata", () => {
      formatter = new Formatter({
        colorize: false,
        json: false,
        timestamp: false,
      });

      const logDataWithArrayMetadata: LogData = {
        level: "info",
        message: "Test",
        timestamp: new Date(),
        metadata: { items: [1, 2, 3] },
      };

      const result = formatter.format(logDataWithArrayMetadata);

      expect(result).toContain('"items":[1,2,3]');
    });

    test("should handle circular references in metadata gracefully", () => {
      formatter = new Formatter({
        colorize: false,
        json: false,
        timestamp: false,
      });

      const circular: any = { name: "test" };
      circular.self = circular;

      const logDataWithCircular: LogData = {
        level: "info",
        message: "Test",
        timestamp: new Date(),
        metadata: circular,
      };

      // JSON.stringify throws on circular references
      expect(() => formatter.format(logDataWithCircular)).toThrow();
    });
  });
});