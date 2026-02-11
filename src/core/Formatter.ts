import { LogData } from "../types/index.js";
import { TimeUtil } from "../utils/TimeUtil.js";
import { ColorUtil } from "../utils/ColorUtil.js";

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
    const hasMetadata = data.metadata !== undefined;
    const hasPrefix = data.prefix !== undefined && data.prefix !== '';
    
    if (!hasMetadata && !hasPrefix && !this.timestamp) {
      return `{"level":"${data.level}","message":${JSON.stringify(data.message)}}`;
    }
    
    if (!hasMetadata && !hasPrefix && this.timestamp) {
      return `{"level":"${data.level}","message":${JSON.stringify(data.message)},"timestamp":"${data.timestamp.toISOString()}"}`;
    }
    
    const formattedData: Record<string, unknown> = {};
    
    if (hasMetadata) {
      Object.assign(formattedData, data.metadata);
    }
    
    formattedData.level = data.level;
    formattedData.message = data.message;

    if (this.timestamp) {
      formattedData.timestamp = data.timestamp.toISOString();
    }

    if (hasPrefix) {
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
