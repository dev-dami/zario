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
  private lastTimestampKey: number = Number.NaN;
  private lastTimestamp: string = "";
  private lastMessage: string | undefined;
  private lastQuotedMessage: string = "";

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

  private quoteMessage(message: string): string {
    if (message !== this.lastMessage) {
      this.lastMessage = message;
      this.lastQuotedMessage = asString(message);
    }
    return this.lastQuotedMessage;
  }

  private formatTimestamp(timestamp: Date): string {
    const timestampKey = timestamp.getTime() * 2 + (this.json ? 1 : 0);
    if (timestampKey !== this.lastTimestampKey) {
      this.lastTimestampKey = timestampKey;
      this.lastTimestamp = this.json
        ? timestamp.toISOString()
        : TimeUtil.format(timestamp, this.timestampFormat);
    }
    return this.lastTimestamp;
  }

  private formatAsJson(data: LogData): string {
    const level = data.level;
    const levelPrefix = this.levelJsonCache[level] || `{"level":"${level}"`;
    const message = this.quoteMessage(data.message);
    const metadata = data.metadata;
    const prefix = data.prefix;

    // Keep the overwhelmingly common cases allocation-light. Building an
    // array of fragments is measurably more expensive than direct string
    // concatenation in the logging hot path.
    if (!prefix) {
      if (metadata == null) {
        if (this.timestamp) {
          return `${levelPrefix},"message":${message},"timestamp":"${this.formatTimestamp(data.timestamp)}"}`;
        }
        return `${levelPrefix},"message":${message}}`;
      }

      const metaStr = JSON.stringify(metadata);
      const metadataSuffix = metaStr.length > 2 ? ',' + metaStr.slice(1, -1) : '';

      if (this.timestamp) {
        return `${levelPrefix},"message":${message},"timestamp":"${this.formatTimestamp(data.timestamp)}"${metadataSuffix}}`;
      }
      return `${levelPrefix},"message":${message}${metadataSuffix}}`;
    }

    let output = `${levelPrefix},"message":${message}`;
    if (this.timestamp) {
      output += `,"timestamp":"${this.formatTimestamp(data.timestamp)}"`;
    }
    output += `,"prefix":${asString(prefix)}`;
    if (metadata != null) {
      const metaStr = JSON.stringify(metadata);
      if (metaStr.length > 2) {
        output += ',' + metaStr.slice(1, -1);
      }
    }
    return output + '}';
  }

  private formatAsText(data: LogData): string {
    // Ultra-fast path: no formatting, no metadata
    if (!this.timestamp && !data.prefix && !this.colorize && data.metadata === undefined) {
      const levelStr = this.levelUpperCache[data.level] || data.level.toUpperCase();
      return `[${levelStr}] ${data.message}`;
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

    let output = `[${levelStr}] ${data.message}`;
    if (data.prefix) {
      output = `${data.prefix} ${output}`;
    }
    if (this.timestamp) {
      output = `[${this.formatTimestamp(data.timestamp)}] ${output}`;
    }
    if (data.metadata != null) {
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
