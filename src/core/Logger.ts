import { LogLevel } from "./LogLevel.js";
import { Formatter } from "./Formatter.js";
import { Transport } from "../transports/Transport.js";
import { ConsoleTransport } from "../transports/ConsoleTransport.js";
import { TransportConfig, LogData } from "../types/index.js";

export interface LoggerOptions {
  level?: LogLevel;
  colorize?: boolean;
  json?: boolean;
  transports?: TransportConfig[];
  timestampFormat?: string;
  prefix?: string;
  timestamp?: boolean;
  context?: Record<string, any>;
  parent?: Logger;
  asyncMode?: boolean;
  customLevels?: { [level: string]: number }; // level name & priority
  customColors?: { [level: string]: string }; // level name & color
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
  public static defaultTransportsFactory: ((isProd: boolean) => TransportConfig[]) | null = null;
  private static readonly LEVEL_PRIORITIES: { [level: string]: number } = {
    silent: 0,
    boring: 1,
    debug: 2,
    info: 3,
    warn: 4,
    error: 5,
  };

  prefix: string;
  timestamp: boolean;

  constructor(options: LoggerOptions = {}) {
    const {
      level,
      colorize,
      json,
      transports = [],
      timestampFormat = "YYYY-MM-DD HH:mm:ss",
      prefix,
      timestamp,
      context = {},
      parent,
      asyncMode,
      customLevels = {},
      customColors = {},
    } = options;

    this.parent = parent; // Set parent
    this.context = { ...context }; // Init context
    this.customLevels = customLevels; // custom log store
    this.asyncMode = false;

    if (this.parent) {
      this.level = level ?? this.parent.level;
      this.prefix = prefix ?? this.parent.prefix;
      this.timestamp = timestamp ?? this.parent.timestamp;
      this.asyncMode = asyncMode ?? this.parent.asyncMode;
      this.transports =
        transports && transports.length > 0
          ? this.initTransports(
            transports,
          )
          : this.parent.transports;
      // Merge colors; child overrides parent
      const mergedCColors = {
        ...this.parent.formatter.getCustomColors(),
        ...customColors,
      };
      this.formatter = new Formatter({
        colorize:
          this.getDefaultColorizeValue(colorize) ??
          this.parent.formatter.isColorized(),
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
      // Auto-configure based on environment
      const isProd = this.isProductionEnvironment();

      this.level = level ?? this.getDefaultLevel(isProd);
      this.prefix = prefix ?? "";
      this.timestamp = timestamp ?? this.getDefaultTimestamp(isProd);

      const defaultTransports =
        transports && transports.length > 0
          ? transports
          : this.getDefaultTransports(isProd);

      this.asyncMode = asyncMode ?? this.getDefaultAsyncMode(isProd);

      this.transports = this.initTransports(
        defaultTransports,
      );

      this.formatter = new Formatter({
        colorize: this.getDefaultColorizeValue(colorize),
        json: json ?? this.getDefaultJson(isProd),
        timestampFormat,
        timestamp: this.getDefaultTimestamp(isProd),
        customColors,
      });
    }

    if (!Logger._global) {
      Logger._global = this;
    }
  }

  private isProductionEnvironment(): boolean {
    const env = process.env.NODE_ENV?.toLowerCase();
    return env === "production" || env === "prod";
  }

  private getDefaultLevel(isProd: boolean): LogLevel {
    return isProd ? "warn" : "debug";
  }

  private getDefaultColorizeValue(colorize: boolean | undefined): boolean {
    if (colorize !== undefined) {
      return colorize;
    }
    const isProd = this.isProductionEnvironment();
    return !isProd;
  }

  private getDefaultJson(isProd: boolean): boolean {
    return isProd;
  }

  private getDefaultTimestamp(isProd: boolean): boolean {
    return true;
  }

  private getDefaultTransports(isProd: boolean): TransportConfig[] {
    if (Logger.defaultTransportsFactory) {
      return Logger.defaultTransportsFactory(isProd);
    }
    return [new ConsoleTransport()];
  }

  private getDefaultAsyncMode(isProd: boolean): boolean {
    return isProd;
  }

  private initTransports(
    transportConfigs: TransportConfig[],
  ): Transport[] {
    const initializedTransports: Transport[] = [];
    for (const transportConfig of transportConfigs) {
      if (this.isTransport(transportConfig)) {
        initializedTransports.push(transportConfig as Transport);
      }
    }
    return initializedTransports;
  }

  private isTransport(transport: any): transport is Transport {
    return (
      typeof transport === "object" &&
      transport !== null &&
      typeof (transport as any).write === "function"
    );
  }



  private shouldLog(level: LogLevel): boolean {
    // Get the priority of the current logger level
    const currentLevelPriority = this.getLevelPriority(this.level);
    // Get the priority of the message level
    const messageLevelPriority = this.getLevelPriority(level);

    return messageLevelPriority >= currentLevelPriority;
  }

  private getLevelPriority(level: LogLevel): number {
    // use a static map to avoid repeated allocations
    if (Logger.LEVEL_PRIORITIES.hasOwnProperty(level)) {
      return Logger.LEVEL_PRIORITIES[level]!;
    }
    // Check if it's a custom level
    if (this.customLevels && level in this.customLevels) {
      const customPriority = this.customLevels[level];
      return customPriority !== undefined ? customPriority : 999;
    }
    return 999;
  }

  private log(
    level: LogLevel,
    message: string,
    metadata?: Record<string, any>,
  ): void {
    if (!this.shouldLog(level) || level === "silent") {
      return;
    }

    const timestamp = new Date();

    // Optimize metadata merging
    let finalMetadata: Record<string, any> | undefined;
    const hasContext = this.context && Object.keys(this.context).length > 0;

    if (hasContext && metadata) {
      finalMetadata = { ...this.context, ...metadata };
    } else if (hasContext) {
      finalMetadata = this.context;
    } else if (metadata) {
      finalMetadata = metadata;
    }

    // Only add metadata if it's not empty after merging
    const logData: LogData = {
      level,
      message,
      timestamp,
      metadata:
        finalMetadata && Object.keys(finalMetadata).length > 0
          ? finalMetadata
          : undefined,
      prefix: this.prefix,
    };

    if (this.asyncMode) {
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
    } else {
      for (const transport of this.transports) {
        transport.write(logData, this.formatter);
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

  setAsyncMode(asyncMode: boolean): void {
    this.asyncMode = asyncMode;
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

  startTimer(name: string): any {
    const { Timer } = require("../utils/Timerutil");
    return new Timer(name, (message: string) => this.info(message));
  }
}
