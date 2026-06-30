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

class FormattingTransport implements Transport {
  public outputs: string[] = [];
  write(data: LogData, formatter: Formatter): void {
    this.outputs.push(formatter.format(data));
  }
}

describe("Logger - Boring Log Level", () => {
  let mockTransport: MockTransport;

  beforeEach(() => {
    mockTransport = new MockTransport();
  });

  test("logger.boring() should emit boring logs at the boring threshold", () => {
    const logger = new Logger({
      level: "boring",
      transports: [mockTransport],
    });

    logger.boring("Boring message");

    expect(mockTransport.logs).toHaveLength(1);
    expect(mockTransport.logs[0]).toMatchObject({
      level: "boring",
      message: "Boring message",
    });
  });

  test("logger.boring() should not emit when the threshold is debug", () => {
    const logger = new Logger({
      level: "debug",
      transports: [mockTransport],
    });

    logger.boring("Hidden boring message");
    logger.debug("Visible debug message");

    expect(mockTransport.logs).toHaveLength(1);
    expect(mockTransport.logs[0]).toMatchObject({
      level: "debug",
      message: "Visible debug message",
    });
  });

  test("boring logs should format without ANSI color codes by default", () => {
    const previousForceColor = process.env.FORCE_COLOR;
    process.env.FORCE_COLOR = "1";

    try {
      const formattingTransport = new FormattingTransport();
      const logger = new Logger({
        level: "boring",
        colorize: true,
        timestamp: false,
        transports: [formattingTransport],
      });

      logger.boring("Plain boring message");

      expect(formattingTransport.outputs).toHaveLength(1);
      expect(formattingTransport.outputs[0]).toContain("[BORING]");
      expect(formattingTransport.outputs[0]).toContain("Plain boring message");
      expect(formattingTransport.outputs[0]).not.toMatch(/\x1b\[[0-9;]*m/);
    } finally {
      if (previousForceColor === undefined) {
        delete process.env.FORCE_COLOR;
      } else {
        process.env.FORCE_COLOR = previousForceColor;
      }
    }
  });
});

describe("Logger - Child Loggers", () => {
  let parentLogger: Logger;
  let mockTransport: MockTransport;

  beforeEach(() => {
    mockTransport = new MockTransport();
    parentLogger = new Logger({
      level: "info",
      prefix: "PARENT",
      timestamp: true,
      transports: [mockTransport], // Pass mock transport directly
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
      transports: [mockTransport]
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
      transports: [mockTransport]
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
      transports: [mockTransport]
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
      transports: [mockTransport]
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
      transports: [mockTransport]
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
      transports: [mockTransport]
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
      transports: [mockTransport]
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
      transports: [mockTransport]
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
