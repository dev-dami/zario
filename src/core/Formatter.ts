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

const STANDARD_LEVELS = ["debug", "info", "warn", "error", "boring", "silent", "fatal"] as const;

const asString = (str: string) => JSON.stringify(str);

export class Formatter {
  private colorize: boolean;
  private json: boolean;
  private timestampFormat: string;
  private timestamp: boolean;
  private customColors: { [level: string]: string };
  
  private readonly levelJsonCache: { [level: string]: string };
  private readonly levelUpperCache: { [level: string]: string };
  private readonly levelColorizedCache: { [level: string]: string };

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
    
    this.levelJsonCache = {};
    this.levelUpperCache = {};
    this.levelColorizedCache = {};
    
    for (const level of STANDARD_LEVELS) {
      const upper = level.toUpperCase();
      this.levelUpperCache[level] = upper;
      this.levelJsonCache[level] = `{"level":"${level}"`;
      
      const color = customColors[level] || level;
      this.levelColorizedCache[level] = ColorUtil.colorize(upper, color);
    }
  }

  format(data: LogData): string {
    if (this.json) {
      return this.formatAsJson(data);
    } else {
      return this.formatAsText(data);
    }
  }

  private formatAsJson(data: LogData): string {
    const level = data.level;
    const levelPrefix = this.levelJsonCache[level] || `{"level":"${level}"`;

    if (data.metadata == null && !data.prefix && !this.timestamp) {
      return `${levelPrefix},"message":${asString(data.message)}}`;
    }

    const parts: string[] = [];
    parts.push(levelPrefix);
    parts.push(`,"message":${asString(data.message)}`);

    if (this.timestamp) {
      parts.push(`,"timestamp":"${data.timestamp.toISOString()}"`);
    }
    if (data.prefix) {
      parts.push(`,"prefix":${asString(data.prefix)}`);
    }
    if (data.metadata != null) {
      const metaStr = JSON.stringify(data.metadata);
      if (metaStr.length > 2) {
        parts.push(',' + metaStr.slice(1, -1));
      }
    }

    return parts.join('') + '}';
  }

  private formatAsText(data: LogData): string {
    // Ultra-fast path: no formatting, no metadata
    if (!this.timestamp && !data.prefix && !this.colorize && data.metadata === undefined) {
      const levelStr = this.levelUpperCache[data.level] || data.level.toUpperCase();
      return `[${levelStr}] ${data.message}`;
    }

    const parts: string[] = [];

    if (this.timestamp) {
      parts.push(`[${TimeUtil.format(data.timestamp, this.timestampFormat)}]`);
    }

    if (data.prefix) {
      parts.push(data.prefix);
    }

    const level = data.level;
    let levelStr: string;

    if (this.colorize) {
      const cached = this.levelColorizedCache[level];
      if (cached !== undefined) {
        levelStr = cached;
      } else {
        const upper = level.toUpperCase();
        const color = this.customColors[level] || level;
        levelStr = ColorUtil.colorize(upper, color);
      }
    } else {
      levelStr = this.levelUpperCache[level] || level.toUpperCase();
    }

    parts.push(`[${levelStr}]`);
    parts.push(data.message);

    if (data.metadata != null) {
      parts.push(JSON.stringify(data.metadata));
    }

    return parts.join(" ");
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
