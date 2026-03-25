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

const STANDARD_LEVELS = ["debug", "info", "warn", "error", "boring", "silent"] as const;

const NODE_MAJOR = parseInt(process.versions.node.split('.')[0] ?? '0', 10);

function fastStringEscape(str: string): string {
  const len = str.length;
  if (len > 100) {
    return JSON.stringify(str);
  }
  
  let result = '';
  let last = 0;
  let found = false;
  
  for (let i = 0; i < len; i++) {
    const code = str.charCodeAt(i);
    if (code === 34) {
      result += str.slice(last, i) + '\\"';
      last = i + 1;
      found = true;
    } else if (code === 92) {
      result += str.slice(last, i) + '\\\\';
      last = i + 1;
      found = true;
    } else if (code < 32) {
      return JSON.stringify(str);
    }
  }
  
  if (!found) {
    return '"' + str + '"';
  }
  
  return '"' + result + str.slice(last) + '"';
}

const asString = NODE_MAJOR >= 25 
  ? (str: string) => JSON.stringify(str)
  : fastStringEscape;

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
    const hasMetadata = data.metadata !== undefined;
    const hasPrefix = data.prefix !== undefined && data.prefix !== '';
    const level = data.level;
    const message = asString(data.message);
    
    const levelPrefix = this.levelJsonCache[level] || `{"level":"${level}"`;
    
    if (!hasMetadata && !hasPrefix && !this.timestamp) {
      return `${levelPrefix},"message":${message}}`;
    }
    
    if (!hasMetadata && !hasPrefix && this.timestamp) {
      return `${levelPrefix},"message":${message},"timestamp":"${data.timestamp.toISOString()}"}`;
    }
    
    let result = levelPrefix;
    result += `,"message":${message}`;
    
    if (this.timestamp) {
      result += `,"timestamp":"${data.timestamp.toISOString()}"`;
    }
    
    if (hasPrefix) {
      result += `,"prefix":${asString(data.prefix!)}`;
    }
    
    if (hasMetadata) {
      const metaStr = JSON.stringify(data.metadata);
      result += `,${metaStr.slice(1, -1)}`;
    }
    
    return result + "}";
  }

  private formatAsText(data: LogData): string {
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

    if (data.metadata) {
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
