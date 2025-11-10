import { LogLevel } from "./LogLevel";
import { Formatter } from "./Formatter";
import { Transport } from "../transports/Transport";
import { ConsoleTransport } from "../transports/ConsoleTransport";
import { TransportOptions } from "../types";

export interface LoggerOptions {
  level?: LogLevel;
  colorize?: boolean;
  json?: boolean;
  transports?: TransportOptions[];
  timestampFormat?: string;
}

export interface LogData {
  level: LogLevel;
  message: string;
  timestamp: Date;
  metadata?: Record<string, any> | undefined;
}

export class Logger {
  private level: LogLevel;
  private transports: Transport[] = [];
  private formatter: Formatter;
  private static _global: Logger;

  constructor(options: LoggerOptions = {}) {
    const {
      level = "info",
      colorize = true,
      json = false,
      transports = [{ type: "console" }],
      timestampFormat = "YYYY-MM-DD HH:mm:ss",
    } = options;

    this.level = level;
    this.formatter = new Formatter({ colorize, json, timestampFormat });

    // Init transports
    for (const transportOption of transports) {
      if (transportOption.type === "console") {
        const consoleTransport = new ConsoleTransport({
          colorize: transportOption.options?.colorize ?? colorize,
        });
        this.transports.push(consoleTransport);
      }
      // Additional transport types would be added here
    }
    if (!Logger._global) {
      Logger._global = this;
    }
  }

  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ["debug", "info", "warn", "error"];
    const currentLevelIndex = levels.indexOf(this.level);
    const messageLevelIndex = levels.indexOf(level);

    return messageLevelIndex >= currentLevelIndex;
  }

  private log(
    level: LogLevel,
    message: string,
    metadata?: Record<string, any>,
  ): void {
    if (!this.shouldLog(level)) {
      return;
    }

    const logData: LogData = {
      level,
      message,
      timestamp: new Date(),
      metadata,
    };

    for (const transport of this.transports) {
      transport.write(logData, this.formatter);
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

  setLevel(level: LogLevel): void {
    this.level = level;
  }

  setFormat(format: "text" | "json"): void {
    this.formatter.setJson(format === "json");
  }

  addTransport(transport: Transport): void {
    this.transports.push(transport);
  }

  static get global(): Logger {
    if (!Logger._global) {
      Logger._global = new Logger();
    }
    return Logger._global;
  }
}
