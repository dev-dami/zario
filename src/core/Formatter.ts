import { LogData } from "../types/index.js";
import { TimeUtil } from "../utils/TimeUtil.js";
import { ColorUtil } from "../utils/ColorUtil.js";
import { LogLevel as DefaultLogLevel } from "./LogLevel.js";

export interface FormatterOptions {
  colorize?: boolean;
  json?: boolean;
  timestampFormat?: string;
  timestamp?: boolean;
  customColors?: { [level: string]: string };
}

export class Formatter {
  private colorize: boolean;
  private json: boolean;
  private timestampFormat: string;
  private timestamp: boolean;
  private customColors: { [level: string]: string };

  constructor(options: FormatterOptions = {}) {
    const {
      colorize = true,
      json = false,
      timestampFormat = "YYYY-MM-DD HH:mm:ss",
      timestamp = false,
      customColors = {},
    } = options;
    this.colorize = colorize;
    this.json = json;
    this.timestampFormat = timestampFormat;
    this.timestamp = timestamp;
    this.customColors = customColors;
  }

  format(data: LogData): string {
    if (this.json) {
      return this.formatAsJson(data);
    } else {
      return this.formatAsText(data);
    }
  }

  private formatAsJson(data: LogData): string {
    const formattedData: any = {
      ...data.metadata, // Spread first so core fields can override
      level: data.level,
      message: data.message,
    };

    if (this.timestamp) {
      formattedData.timestamp = data.timestamp.toISOString();
    }

    if (data.prefix) {
      formattedData.prefix = data.prefix;
    }

    return JSON.stringify(formattedData);
  }

  private formatAsText(data: LogData): string {
    let output = "";

    if (this.timestamp) {
      output += `[${TimeUtil.format(data.timestamp, this.timestampFormat)}] `;
    }

    if (data.prefix) {
      output += `${data.prefix} `;
    }

    let level = data.level.toUpperCase();
    if (this.colorize) {
      const color = this.customColors[data.level] || data.level;
      level = ColorUtil.colorize(level, color);
    }
    output += `[${level}] ${data.message}`;

    if (data.metadata) {
      output += ` ${JSON.stringify(data.metadata)}`;
    }

    return output;
  }

  setJson(json: boolean): void {
    this.json = json;
  }

  isColorized(): boolean {
    return this.colorize;
  }

  isJson(): boolean {
    return this.json;
  }

  getTimestampFormat(): string {
    return this.timestampFormat;
  }

  hasTimestamp(): boolean {
    return this.timestamp;
  }

  getCustomColors(): { [level: string]: string } {
    return { ...this.customColors };
  }
}
