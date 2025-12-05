import { LogLevel } from "./LogLevel";
import { Formatter } from "./Formatter";
import {
  Transport,
  ConsoleTransport,
  FileTransport,
  FileTransportOptions,
} from "../transports";
import { TransportOptions, LogData } from "../types";

export interface LoggerOptions {
  level?: LogLevel;
  colorize?: boolean;
  json?: boolean;
  transports?: TransportOptions[];
  timestampFormat?: string;
  prefix?: string;
  timestamp?: boolean;
  context?: Record<string, any>;
  parent?: Logger;
  async?: boolean;
  customLevels?: { [level: string]: number }; // level name and priority
  customColors?: { [level: string]: string }; // level name and color
}

export class Logger {
  private level: LogLevel;
  private transports: Transport[] = [];
  private formatter: Formatter;
  private context: Record<string, any>;
  private parent: Logger | undefined;
  private asyncMode: boolean;
  private customLevels: { [level: string]: number };
  private static _global: Logger;

  prefix: string;
  timestamp: boolean;

  constructor(options: LoggerOptions = {}) {
    const {
      level,
      colorize = true,
      json = false,
      transports = [],
      timestampFormat = "YYYY-MM-DD HH:mm:ss",
      prefix,
      timestamp,
      context = {},
      parent,
      async,
      customLevels = {},
      customColors = {},
    } = options;

    this.parent = parent; // Set parent
    this.context = { ...context }; // Init context
    this.customLevels = customLevels; // Store custom log levels
    this.asyncMode = false;

    if (this.parent) {
      this.level = level ?? this.parent.level;
      this.prefix = prefix ?? this.parent.prefix;
      this.timestamp = timestamp ?? this.parent.timestamp;
      this.asyncMode = async ?? this.parent.asyncMode;
      this.transports =
        transports.length > 0
          ? this.initTransports(transports, colorize)
          : this.parent.transports;
      // Merge colors; child overrides parent
      const mergedCColors = {
        ...this.parent.formatter.getCustomColors(),
        ...customColors,
      };
      this.formatter = new Formatter({
        colorize: colorize ?? this.parent.formatter.isColorized(),
        json: json ?? this.parent.formatter.isJson(),
        timestampFormat:
          timestampFormat ?? this.parent.formatter.getTimestampFormat(),
        timestamp: timestamp ?? this.parent.formatter.hasTimestamp(),
        customColors: mergedCColors,
      });
      this.context = { ...this.parent.context, ...this.context };
      // Merge custom levels with parent's custom levels
      this.customLevels = { ...this.parent.customLevels, ...customLevels };
    } else {
      this.level = level ?? "info";
      this.prefix = prefix ?? "";
      this.timestamp = timestamp ?? false;
      this.asyncMode = async ?? false;
      this.transports = this.initTransports(
        transports.length > 0 ? transports : [{ type: "console" }],
        colorize,
      );
      this.formatter = new Formatter({
        colorize,
        json,
        timestampFormat,
        timestamp: this.timestamp,
        customColors,
      });
    }

    if (!Logger._global) {
      Logger._global = this;
    }
  }

  private initTransports(
    transportOptions: TransportOptions[],
    defaultColorize: boolean,
  ): Transport[] {
    const initializedTransports: Transport[] = [];
    for (const transportOption of transportOptions) {
      if (transportOption.type === "console") {
        const consoleTransport = new ConsoleTransport({
          colorize: transportOption.options?.colorize ?? defaultColorize,
        });
        initializedTransports.push(consoleTransport);
      } else if (transportOption.type === "file") {
        if (transportOption.options?.path) {
          const fileOptions: FileTransportOptions = {
            path: transportOption.options.path,
          };
          if (transportOption.options.maxSize !== undefined) {
            fileOptions.maxSize = transportOption.options.maxSize;
          }
          if (transportOption.options.maxFiles !== undefined) {
            fileOptions.maxFiles = transportOption.options.maxFiles;
          }
          const fileTransport = new FileTransport(fileOptions);
          initializedTransports.push(fileTransport);
        }
      } else if (transportOption.type === "custom") {
        if (transportOption.instance) {
          initializedTransports.push(transportOption.instance);
        }
      }
    }
    return initializedTransports;
  }

  private shouldLog(level: LogLevel): boolean {
    // Get the priority of the current logger level
    const currentLevelPriority = this.getLevelPriority(this.level);
    // Get the priority of the message level
    const messageLevelPriority = this.getLevelPriority(level);

    return messageLevelPriority >= currentLevelPriority;
  }

  private getLevelPriority(level: LogLevel): number {
    // Default log level priorities
    const defaultPriorities: { [key: string]: number } = {
      silent: 0,
      boring: 1,
      debug: 2,
      info: 3,
      warn: 4,
      error: 5,
    };

    // Check if it's a custom level
    if (this.customLevels && this.customLevels.hasOwnProperty(level)) {
      const customPriority = this.customLevels[level];
      return customPriority !== undefined ? customPriority : 999;
    }

    // Use default priority if available
    return defaultPriorities[level] ?? 999;
  }

  private log(
    level: LogLevel,
    message: string,
    metadata?: Record<string, any>,
  ): void {
    if (!this.shouldLog(level)) {
      return;
    }
    // Don't log silent level logs at all
    if (level === "silent") {
      return;
    }

    if (this.asyncMode) {
      // For async mode, we need to call the direct method
      this.logAsyncDirect(level, message, metadata);
    } else {
      // Only create timestamp after confirming log should be written
      const timestamp = new Date();
      const mergedMetadata = { ...this.context, ...metadata };

      const logData: LogData = {
        level,
        message,
        timestamp,
        metadata:
          Object.keys(mergedMetadata).length > 0 ? mergedMetadata : undefined,
        prefix: this.prefix,
      };

      for (const transport of this.transports) {
        transport.write(logData, this.formatter);
      }
    }
  }

  private logAsyncDirect(
    level: LogLevel,
    message: string,
    metadata?: Record<string, any>,
  ): void {
    if (!this.shouldLog(level)) {
      return;
    }
    // Donot log silent level logs at all
    if (level === "silent") {
      return;
    }

    // Timestamp only on confirmed log
    const timestamp = new Date();
    const mergedMetadata = { ...this.context, ...metadata };

    const logData: LogData = {
      level,
      message,
      timestamp,
      metadata:
        Object.keys(mergedMetadata).length > 0 ? mergedMetadata : undefined,
      prefix: this.prefix,
    };

    for (const transport of this.transports) {
      if (transport.writeAsync) {
        transport.writeAsync(logData, this.formatter).catch((error) => {
          console.error("Error during async logging:", error);
        });
      } else {
        setImmediate(() => {
          transport.write(logData, this.formatter);
        });
      }
    }
  }

  debug(message: string, metadata?: Record<string, any>): void {
    this.log("debug", message, metadata);
  }

  info(message: string, metadata?: Record<string, any>): void {
    this.log("info", message, metadata);
  }

  warn(message: string, metadata?: Record<string, any>): void {
    this.log("warn", message, metadata);
  }

  error(message: string, metadata?: Record<string, any>): void {
    this.log("error", message, metadata);
  }

  silent(message: string, metadata?: Record<string, any>): void {
    this.log("silent", message, metadata);
  }

  boring(message: string, metadata?: Record<string, any>): void {
    this.log("boring", message, metadata);
  }

  /**
   * Generic log method that allows logging with custom levels
   */
  logWithLevel(
    level: LogLevel,
    message: string,
    metadata?: Record<string, any>,
  ): void {
    this.log(level, message, metadata);
  }

  setLevel(level: LogLevel): void {
    this.level = level;
  }

  setFormat(format: "text" | "json"): void {
    this.formatter.setJson(format === "json");
  }

  setAsync(async: boolean): void {
    this.asyncMode = async;
  }

  addTransport(transport: Transport): void {
    this.transports.push(transport);
  }

  getTimestampSetting(): boolean {
    return this.timestamp;
  }

  static get global(): Logger {
    if (!Logger._global) {
      Logger._global = new Logger();
    }
    return Logger._global;
  }

  createChild(options: LoggerOptions = {}): Logger {
    return new Logger({ ...options, parent: this });
  }
}
