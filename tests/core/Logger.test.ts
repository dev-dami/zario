import { Logger } from "../../src/core/Logger";
import { LogLevel } from "../../src/core/LogLevel";
import { Transport } from "../../src/transports/Transport";
import { Formatter } from "../../src/core/Formatter";
import { LogData } from "../../src/types";

// Mock Transport for testing
class MockTransport implements Transport {
  public logs: LogData[] = [];
  write(data: LogData, formatter: Formatter): void {
    this.logs.push(data);
  }
}

describe("Logger - Child Loggers", () => {
  let parentLogger: Logger;
  let mockTransport: MockTransport;

  beforeEach(() => {
    mockTransport = new MockTransport();
    parentLogger = new Logger({
      level: "info",
      prefix: "PARENT",
      timestamp: true,
      transports: [{ type: "custom", instance: mockTransport }], // Pass mock transport directly
      context: { parentId: 123 },
    });
  });

  test("child logger should inherit settings from parent", () => {
    const childLogger = parentLogger.createChild();

    expect((childLogger as any).level).toBe("info");
    expect((childLogger as any).prefix).toBe("PARENT");
    expect((childLogger as any).timestamp).toBe(true);
    expect((childLogger as any).transports[0]).toBe(mockTransport); // Should inherit transports
  });

  test("child logger should override parent settings if provided", () => {
    const childLogger = parentLogger.createChild({
      level: "debug",
      prefix: "CHILD",
      timestamp: false,
    });

    expect((childLogger as any).level).toBe("debug");
    expect((childLogger as any).prefix).toBe("CHILD");
    expect(childLogger.getTimestampSetting()).toBe(false);
    expect((childLogger as any).transports[0]).toBe(mockTransport); // Still inherits transports
  });

  test("child logger should merge context from parent and its own", () => {
    const childLogger = parentLogger.createChild({
      context: { childId: 456, commonKey: "childValue" },
    });

    childLogger.info("Test message", { logSpecific: "data" });

    expect(mockTransport.logs.length).toBe(1);
    const logData = mockTransport.logs[0]!;

    expect(logData.metadata).toEqual({
      parentId: 123,
      childId: 456,
      commonKey: "childValue",
      logSpecific: "data",
    });
  });

  test("child logger should log messages through parent transports", () => {
    const childLogger = parentLogger.createChild({
      prefix: "CHILD",
    });

    childLogger.info("Child message");

    expect(mockTransport.logs.length).toBe(1);
    expect(mockTransport.logs[0]!.message).toBe("Child message");
    expect(mockTransport.logs[0]!.prefix).toBe("CHILD"); // Child's prefix should be used
  });

  test("grandchild logger should inherit and merge correctly", () => {
    const childLogger = parentLogger.createChild({
      context: { childId: 456 },
      prefix: "CHILD",
    });
    const grandchildLogger = childLogger.createChild({
      context: { grandChildId: 789, commonKey: "grandchildValue" },
      prefix: "GRANDCHILD",
    });

    grandchildLogger.warn("Grandchild message", { specific: "value" });

    expect(mockTransport.logs.length).toBe(1);
    const logData = mockTransport.logs[0]!;

    expect(logData.level).toBe("warn");
    expect(logData.message).toBe("Grandchild message");
    expect(logData.prefix).toBe("GRANDCHILD");
    expect(logData.metadata).toEqual({
      parentId: 123,
      childId: 456,
      grandChildId: 789,
      commonKey: "grandchildValue",
      specific: "value",
    });
  });

  test("child logger with no context should still inherit parent context", () => {
    const childLogger = parentLogger.createChild();
    childLogger.info("Message from child without own context");

    expect(mockTransport.logs.length).toBe(1);
    const logData = mockTransport.logs[0]!;
    expect(logData.metadata).toEqual({ parentId: 123 });
  });

  test("child logger with empty context should still inherit parent context", () => {
    const childLogger = parentLogger.createChild({ context: {} });
    childLogger.info("Message from child with empty context");

    expect(mockTransport.logs.length).toBe(1);
    const logData = mockTransport.logs[0]!;
    expect(logData.metadata).toEqual({ parentId: 123 });
  });

  test("child logger should inherit parent custom colors", () => {
    const parentWithColors = new Logger({
      level: "info",
      customColors: {
        'info': 'blue',
        'warn': 'yellow',
        'custom1': 'magenta',
      },
      transports: [{ type: 'custom', instance: mockTransport }]
    });

    const childLogger = parentWithColors.createChild();
    
    // Verify child inherits parent's custom colors via formatter
    const parentFormatter = (parentWithColors as any).formatter;
    const childFormatter = (childLogger as any).formatter;
    
    expect(childFormatter.getCustomColors()).toEqual({
      'info': 'blue',
      'warn': 'yellow',
      'custom1': 'magenta',
    });
  });

  test("child logger should override parent custom colors", () => {
    const parentWithColors = new Logger({
      level: "info",
      customColors: {
        'info': 'blue',
        'warn': 'yellow',
        'custom1': 'magenta',
      },
      transports: [{ type: 'custom', instance: mockTransport }]
    });

    const childLogger = parentWithColors.createChild({
      customColors: {
        'warn': 'red',        // Override parent's yellow
        'custom2': 'cyan',    // Add new color
      }
    });
    
    const childFormatter = (childLogger as any).formatter;
    
    // Child should have merged colors with child overriding parent
    expect(childFormatter.getCustomColors()).toEqual({
      'info': 'blue',       // Inherited from parent
      'warn': 'red',        // Overridden by child
      'custom1': 'magenta', // Inherited from parent
      'custom2': 'cyan',    // Added by child
    });
  });

  test("child logger with empty customColors should still inherit parent colors", () => {
    const parentWithColors = new Logger({
      level: "info",
      customColors: {
        'error': 'red',
        'success': 'green',
      },
      transports: [{ type: 'custom', instance: mockTransport }]
    });

    const childLogger = parentWithColors.createChild({
      customColors: {}
    });
    
    const childFormatter = (childLogger as any).formatter;
    
    expect(childFormatter.getCustomColors()).toEqual({
      'error': 'red',
      'success': 'green',
    });
  });

  test("grandchild logger should inherit and merge colors from parent and child", () => {
    const parentLogger = new Logger({
      level: "info",
      customColors: {
        'parent': 'blue',
        'shared': 'yellow',
      },
      transports: [{ type: 'custom', instance: mockTransport }]
    });

    const childLogger = parentLogger.createChild({
      customColors: {
        'child': 'green',
        'shared': 'orange',  // Override parent
      }
    });

    const grandchildLogger = childLogger.createChild({
      customColors: {
        'grandchild': 'purple',
        'shared': 'red',     // Override both parent and child
      }
    });
    
    const grandchildFormatter = (grandchildLogger as any).formatter;
    
    expect(grandchildFormatter.getCustomColors()).toEqual({
      'parent': 'blue',       // From parent
      'child': 'green',       // From child
      'grandchild': 'purple', // From grandchild
      'shared': 'red',        // Overridden by grandchild
    });
  });

  test("child logger without customColors param should inherit all parent colors", () => {
    const parentWithColors = new Logger({
      level: "info",
      customColors: {
        'critical': 'brightRed',
        'verbose': 'cyan',
      },
      transports: [{ type: 'custom', instance: mockTransport }]
    });

    // Child created without customColors option at all
    const childLogger = parentWithColors.createChild({
      prefix: "CHILD"
    });
    
    const childFormatter = (childLogger as any).formatter;
    
    expect(childFormatter.getCustomColors()).toEqual({
      'critical': 'brightRed',
      'verbose': 'cyan',
    });
  });

  test("multiple children should independently inherit and override colors", () => {
    const parentLogger = new Logger({
      level: "info",
      customColors: {
        'base': 'white',
      },
      transports: [{ type: 'custom', instance: mockTransport }]
    });

    const child1 = parentLogger.createChild({
      customColors: { 'child1': 'red' }
    });

    const child2 = parentLogger.createChild({
      customColors: { 'child2': 'blue' }
    });
    
    const child1Formatter = (child1 as any).formatter;
    const child2Formatter = (child2 as any).formatter;
    
    // Each child should have parent's colors plus their own
    expect(child1Formatter.getCustomColors()).toEqual({
      'base': 'white',
      'child1': 'red',
    });
    
    expect(child2Formatter.getCustomColors()).toEqual({
      'base': 'white',
      'child2': 'blue',
    });
    
    // Changes to one child shouldn't affect the other
    expect(child1Formatter.getCustomColors()).not.toHaveProperty('child2');
    expect(child2Formatter.getCustomColors()).not.toHaveProperty('child1');
  });

  test("child logger should not mutate parent's custom colors", () => {
    const parentLogger = new Logger({
      level: "info",
      customColors: {
        'original': 'green',
      },
      transports: [{ type: 'custom', instance: mockTransport }]
    });

    const parentFormatterBefore = (parentLogger as any).formatter.getCustomColors();
    
    parentLogger.createChild({
      customColors: {
        'original': 'red',
        'new': 'blue',
      }
    });
    
    const parentFormatterAfter = (parentLogger as any).formatter.getCustomColors();
    
    // Parent's colors should remain unchanged
    expect(parentFormatterAfter).toEqual({ 'original': 'green' });
    expect(parentFormatterBefore).toEqual(parentFormatterAfter);
  });

  test("child logger with complex color overrides in deep hierarchy", () => {
    const root = new Logger({
      level: "info",
      customColors: {
        'level1': 'red',
        'level2': 'green',
        'level3': 'blue',
        'shared': 'white',
      },
      transports: [{ type: 'custom', instance: mockTransport }]
    });

    const child = root.createChild({
      customColors: {
        'level2': 'yellow',  // Override
        'shared': 'gray',    // Override
      }
    });

    const grandchild = child.createChild({
      customColors: {
        'level3': 'cyan',    // Override
      }
    });

    const greatGrandchild = grandchild.createChild({
      customColors: {
        'shared': 'black',   // Override again
        'level4': 'magenta', // Add new
      }
    });
    
    const formatter = (greatGrandchild as any).formatter;
    
    expect(formatter.getCustomColors()).toEqual({
      'level1': 'red',       // From root, never overridden
      'level2': 'yellow',    // Overridden by child
      'level3': 'cyan',      // Overridden by grandchild
      'level4': 'magenta',   // Added by great-grandchild
      'shared': 'black',     // Overridden by great-grandchild
    });
  });
});

describe("Logger - Async Mode Refactoring", () => {
  let mockTransport: MockTransport;
  let logger: Logger;

  beforeEach(() => {
    mockTransport = new MockTransport();
  });

  describe("Async mode delegation", () => {
    test("should delegate to logAsyncDirect when async mode is enabled", async () => {
      logger = new Logger({
        level: "info",
        async: true,
        transports: [{ type: "custom", instance: mockTransport }],
      });

      logger.info("Async message");

      // Wait for async operation
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockTransport.logs.length).toBe(1);
      expect(mockTransport.logs[0].message).toBe("Async message");
      expect(mockTransport.logs[0].level).toBe("info");
    });

    test("should use synchronous logging when async mode is disabled", () => {
      logger = new Logger({
        level: "info",
        async: false,
        transports: [{ type: "custom", instance: mockTransport }],
      });

      logger.info("Sync message");

      // Should be immediate, no waiting needed
      expect(mockTransport.logs.length).toBe(1);
      expect(mockTransport.logs[0].message).toBe("Sync message");
    });

    test("should handle level filtering in async mode", async () => {
      logger = new Logger({
        level: "warn",
        async: true,
        transports: [{ type: "custom", instance: mockTransport }],
      });

      logger.debug("Debug message"); // Should not log
      logger.info("Info message"); // Should not log
      logger.warn("Warn message"); // Should log
      logger.error("Error message"); // Should log

      await new Promise((resolve) => setTimeout(resolve, 20));

      expect(mockTransport.logs.length).toBe(2);
      expect(mockTransport.logs[0].level).toBe("warn");
      expect(mockTransport.logs[1].level).toBe("error");
    });

    test("should not log silent level in async mode", async () => {
      logger = new Logger({
        level: "silent",
        async: true,
        transports: [{ type: "custom", instance: mockTransport }],
      });

      logger.silent("Silent message");
      logger.info("Info message");
      logger.error("Error message");

      await new Promise((resolve) => setTimeout(resolve, 20));

      expect(mockTransport.logs.length).toBe(0);
    });

    test("should handle metadata in async mode", async () => {
      logger = new Logger({
        level: "info",
        async: true,
        transports: [{ type: "custom", instance: mockTransport }],
      });

      logger.info("Message with metadata", { userId: 123, action: "login" });

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockTransport.logs.length).toBe(1);
      expect(mockTransport.logs[0].metadata).toEqual({
        userId: 123,
        action: "login",
      });
    });

    test("should merge context with metadata in async mode", async () => {
      logger = new Logger({
        level: "info",
        async: true,
        context: { appId: "app1", env: "test" },
        transports: [{ type: "custom", instance: mockTransport }],
      });

      logger.info("Message", { requestId: "req-123" });

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockTransport.logs.length).toBe(1);
      expect(mockTransport.logs[0].metadata).toEqual({
        appId: "app1",
        env: "test",
        requestId: "req-123",
      });
    });

    test("should create timestamps at log time in async mode", async () => {
      logger = new Logger({
        level: "info",
        async: true,
        transports: [{ type: "custom", instance: mockTransport }],
      });

      const beforeLog = Date.now();
      logger.info("Timestamp test");
      const afterLog = Date.now();

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockTransport.logs.length).toBe(1);
      const logTimestamp = mockTransport.logs[0].timestamp.getTime();
      expect(logTimestamp).toBeGreaterThanOrEqual(beforeLog);
      expect(logTimestamp).toBeLessThanOrEqual(afterLog);
    });
  });

  describe("Transport async support", () => {
    test("should use transport.writeAsync when available in async mode", async () => {
      const asyncTransport = {
        write: jest.fn(),
        writeAsync: jest.fn().mockResolvedValue(undefined),
      };

      logger = new Logger({
        level: "info",
        async: true,
        transports: [{ type: "custom", instance: asyncTransport }],
      });

      logger.info("Async transport message");

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(asyncTransport.writeAsync).toHaveBeenCalledTimes(1);
      expect(asyncTransport.write).not.toHaveBeenCalled();
    });

    test("should fall back to setImmediate with write when writeAsync is not available", async () => {
      const syncOnlyTransport = {
        write: jest.fn(),
      };

      logger = new Logger({
        level: "info",
        async: true,
        transports: [{ type: "custom", instance: syncOnlyTransport }],
      });

      logger.info("Fallback message");

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(syncOnlyTransport.write).toHaveBeenCalledTimes(1);
    });

    test("should handle writeAsync errors gracefully", async () => {
      const errorSpy = jest.spyOn(console, "error").mockImplementation();
      const failingTransport = {
        write: jest.fn(),
        writeAsync: jest.fn().mockRejectedValue(new Error("Write failed")),
      };

      logger = new Logger({
        level: "info",
        async: true,
        transports: [{ type: "custom", instance: failingTransport }],
      });

      logger.info("This will fail");

      await new Promise((resolve) => setTimeout(resolve, 20));

      expect(errorSpy).toHaveBeenCalledWith(
        "Error during async logging:",
        expect.any(Error)
      );

      errorSpy.mockRestore();
    });

    test("should continue logging to other transports when one fails in async mode", async () => {
      const errorSpy = jest.spyOn(console, "error").mockImplementation();
      const failingTransport = {
        writeAsync: jest.fn().mockRejectedValue(new Error("Failed")),
      };
      const successTransport = new MockTransport();

      logger = new Logger({
        level: "info",
        async: true,
        transports: [
          { type: "custom", instance: failingTransport },
          { type: "custom", instance: successTransport },
        ],
      });

      logger.info("Test message");

      await new Promise((resolve) => setTimeout(resolve, 20));

      expect(successTransport.logs.length).toBe(1);
      expect(errorSpy).toHaveBeenCalled();

      errorSpy.mockRestore();
    });
  });

  describe("Async mode with different log levels", () => {
    test("should handle debug level in async mode", async () => {
      logger = new Logger({
        level: "debug",
        async: true,
        transports: [{ type: "custom", instance: mockTransport }],
      });

      logger.debug("Debug in async");

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockTransport.logs.length).toBe(1);
      expect(mockTransport.logs[0].level).toBe("debug");
    });

    test("should handle warn level in async mode", async () => {
      logger = new Logger({
        level: "warn",
        async: true,
        transports: [{ type: "custom", instance: mockTransport }],
      });

      logger.warn("Warning in async");

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockTransport.logs.length).toBe(1);
      expect(mockTransport.logs[0].level).toBe("warn");
    });

    test("should handle error level in async mode", async () => {
      logger = new Logger({
        level: "error",
        async: true,
        transports: [{ type: "custom", instance: mockTransport }],
      });

      logger.error("Error in async");

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockTransport.logs.length).toBe(1);
      expect(mockTransport.logs[0].level).toBe("error");
    });

    test("should handle boring level in async mode", async () => {
      logger = new Logger({
        level: "boring",
        async: true,
        transports: [{ type: "custom", instance: mockTransport }],
      });

      logger.boring("Boring in async");

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockTransport.logs.length).toBe(1);
      expect(mockTransport.logs[0].level).toBe("boring");
    });
  });

  describe("Async mode with custom levels", () => {
    test("should support custom levels in async mode", async () => {
      logger = new Logger({
        level: "info",
        async: true,
        customLevels: {
          critical: 10,
          trace: 1,
        },
        transports: [{ type: "custom", instance: mockTransport }],
      });

      logger.logWithLevel("critical", "Critical async message");
      logger.logWithLevel("trace", "Trace message"); // Should not log

      await new Promise((resolve) => setTimeout(resolve, 20));

      expect(mockTransport.logs.length).toBe(1);
      expect(mockTransport.logs[0].level).toBe("critical");
    });

    test("should filter custom levels correctly in async mode", async () => {
      logger = new Logger({
        level: "custom_threshold",
        async: true,
        customLevels: {
          custom_threshold: 5,
          above: 6,
          below: 4,
        },
        transports: [{ type: "custom", instance: mockTransport }],
      });

      logger.logWithLevel("below", "Below");
      logger.logWithLevel("custom_threshold", "At threshold");
      logger.logWithLevel("above", "Above");

      await new Promise((resolve) => setTimeout(resolve, 20));

      expect(mockTransport.logs.length).toBe(2);
      expect(mockTransport.logs[0].level).toBe("custom_threshold");
      expect(mockTransport.logs[1].level).toBe("above");
    });
  });

  describe("Async mode toggle", () => {
    test("should switch between sync and async mode", async () => {
      logger = new Logger({
        level: "info",
        async: false,
        transports: [{ type: "custom", instance: mockTransport }],
      });

      // Log in sync mode
      logger.info("Sync message");
      expect(mockTransport.logs.length).toBe(1);

      mockTransport.logs = []; // Clear logs

      // Switch to async mode
      logger.setAsync(true);
      logger.info("Async message");

      // Should not be immediate
      expect(mockTransport.logs.length).toBe(0);

      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(mockTransport.logs.length).toBe(1);
    });

    test("should handle multiple rapid async logs", async () => {
      logger = new Logger({
        level: "info",
        async: true,
        transports: [{ type: "custom", instance: mockTransport }],
      });

      for (let i = 0; i < 10; i++) {
        logger.info(`Message ${i}`);
      }

      await new Promise((resolve) => setTimeout(resolve, 30));

      expect(mockTransport.logs.length).toBe(10);
      for (let i = 0; i < 10; i++) {
        expect(mockTransport.logs[i].message).toBe(`Message ${i}`);
      }
    });
  });

  describe("Async mode with child loggers", () => {
    test("should inherit async mode from parent", async () => {
      const parentLogger = new Logger({
        level: "info",
        async: true,
        transports: [{ type: "custom", instance: mockTransport }],
      });

      const childLogger = parentLogger.createChild({
        prefix: "CHILD",
      });

      childLogger.info("Child async message");

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockTransport.logs.length).toBe(1);
      expect(mockTransport.logs[0].prefix).toBe("CHILD");
    });

    test("should override parent async mode", async () => {
      const parentLogger = new Logger({
        level: "info",
        async: false,
        transports: [{ type: "custom", instance: mockTransport }],
      });

      const childLogger = parentLogger.createChild({
        async: true,
        prefix: "CHILD",
      });

      childLogger.info("Child async override");

      // Should not be immediate
      expect(mockTransport.logs.length).toBe(0);

      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(mockTransport.logs.length).toBe(1);
    });

    test("should merge context in async mode with child logger", async () => {
      const parentLogger = new Logger({
        level: "info",
        async: true,
        context: { parent: "value" },
        transports: [{ type: "custom", instance: mockTransport }],
      });

      const childLogger = parentLogger.createChild({
        context: { child: "value" },
      });

      childLogger.info("Message", { local: "value" });

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockTransport.logs.length).toBe(1);
      expect(mockTransport.logs[0].metadata).toEqual({
        parent: "value",
        child: "value",
        local: "value",
      });
    });
  });

  describe("Prefix handling in async mode", () => {
    test("should include prefix in async logs", async () => {
      logger = new Logger({
        level: "info",
        async: true,
        prefix: "API",
        transports: [{ type: "custom", instance: mockTransport }],
      });

      logger.info("Request received");

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockTransport.logs.length).toBe(1);
      expect(mockTransport.logs[0].prefix).toBe("API");
    });

    test("should handle empty prefix in async mode", async () => {
      logger = new Logger({
        level: "info",
        async: true,
        transports: [{ type: "custom", instance: mockTransport }],
      });

      logger.info("No prefix");

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockTransport.logs.length).toBe(1);
      expect(mockTransport.logs[0].prefix).toBe("");
    });
  });

  describe("Edge cases in async mode", () => {
    test("should handle logging with no metadata in async mode", async () => {
      logger = new Logger({
        level: "info",
        async: true,
        transports: [{ type: "custom", instance: mockTransport }],
      });

      logger.info("Message without metadata");

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockTransport.logs.length).toBe(1);
      expect(mockTransport.logs[0].metadata).toBeUndefined();
    });

    test("should handle logging with empty context in async mode", async () => {
      logger = new Logger({
        level: "info",
        async: true,
        context: {},
        transports: [{ type: "custom", instance: mockTransport }],
      });

      logger.info("Message");

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockTransport.logs.length).toBe(1);
      expect(mockTransport.logs[0].metadata).toBeUndefined();
    });

    test("should not create timestamp until log passes filter in async mode", async () => {
      logger = new Logger({
        level: "error",
        async: true,
        transports: [{ type: "custom", instance: mockTransport }],
      });

      // This should be filtered out before timestamp creation
      logger.debug("Filtered message");

      await new Promise((resolve) => setTimeout(resolve, 10));

      // No logs should be created, thus no timestamp created
      expect(mockTransport.logs.length).toBe(0);
    });

    test("should handle simultaneous sync and async loggers", async () => {
      const syncTransport = new MockTransport();
      const asyncTransport = new MockTransport();

      const syncLogger = new Logger({
        level: "info",
        async: false,
        transports: [{ type: "custom", instance: syncTransport }],
      });

      const asyncLogger = new Logger({
        level: "info",
        async: true,
        transports: [{ type: "custom", instance: asyncTransport }],
      });

      syncLogger.info("Sync");
      asyncLogger.info("Async");

      expect(syncTransport.logs.length).toBe(1);
      expect(asyncTransport.logs.length).toBe(0);

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(syncTransport.logs.length).toBe(1);
      expect(asyncTransport.logs.length).toBe(1);
    });
  });

  describe("Multiple transports in async mode", () => {
    test("should write to multiple transports in async mode", async () => {
      const transport1 = new MockTransport();
      const transport2 = new MockTransport();

      logger = new Logger({
        level: "info",
        async: true,
        transports: [
          { type: "custom", instance: transport1 },
          { type: "custom", instance: transport2 },
        ],
      });

      logger.info("Multi-transport message");

      await new Promise((resolve) => setTimeout(resolve, 20));

      expect(transport1.logs.length).toBe(1);
      expect(transport2.logs.length).toBe(1);
      expect(transport1.logs[0].message).toBe("Multi-transport message");
      expect(transport2.logs[0].message).toBe("Multi-transport message");
    });

    test("should handle mix of sync and async transports", async () => {
      const syncTransport = new MockTransport();
      const asyncTransport = {
        writeAsync: jest.fn().mockResolvedValue(undefined),
      };

      logger = new Logger({
        level: "info",
        async: true,
        transports: [
          { type: "custom", instance: syncTransport },
          { type: "custom", instance: asyncTransport },
        ],
      });

      logger.info("Mixed transport message");

      await new Promise((resolve) => setTimeout(resolve, 20));

      expect(syncTransport.logs.length).toBe(1);
      expect(asyncTransport.writeAsync).toHaveBeenCalledTimes(1);
    });
  });

  describe("Performance characteristics of async mode", () => {
    test("should not block on async logs", async () => {
      const slowTransport = {
        writeAsync: jest.fn().mockImplementation(
          () =>
            new Promise((resolve) => setTimeout(resolve, 50))
        ),
      };

      logger = new Logger({
        level: "info",
        async: true,
        transports: [{ type: "custom", instance: slowTransport }],
      });

      const startTime = Date.now();
      logger.info("Slow message");
      const endTime = Date.now();

      // Should return immediately, not wait for 50ms
      expect(endTime - startTime).toBeLessThan(10);

      await new Promise((resolve) => setTimeout(resolve, 60));
      expect(slowTransport.writeAsync).toHaveBeenCalled();
    });

    test("should handle high volume of async logs", async () => {
      logger = new Logger({
        level: "info",
        async: true,
        transports: [{ type: "custom", instance: mockTransport }],
      });

      const messageCount = 100;
      for (let i = 0; i < messageCount; i++) {
        logger.info(`Message ${i}`);
      }

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(mockTransport.logs.length).toBe(messageCount);
    });
  });
});
