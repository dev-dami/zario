import { LogData } from './Logger';
import { TimeUtil } from '../utils/TimeUtil';
import { ColorUtil } from '../utils/ColorUtil';

export interface FormatterOptions {
  colorize?: boolean;
  json?: boolean;
  timestampFormat?: string;
}

export class Formatter {
  private colorize: boolean;
  private json: boolean;
  private timestampFormat: string;

  constructor(options: FormatterOptions = {}) {
    const { colorize = true, json = false, timestampFormat = 'YYYY-MM-DD HH:mm:ss' } = options;
    this.colorize = colorize;
    this.json = json;
    this.timestampFormat = timestampFormat;
  }

  format(data: LogData): string {
    if (this.json) {
      return this.formatAsJson(data);
    } else {
      return this.formatAsText(data);
    }
  }

  private formatAsJson(data: LogData): string {
    const formattedData = {
      timestamp: data.timestamp.toISOString(),
      level: data.level,
      message: data.message,
      ...data.metadata,
    };
    return JSON.stringify(formattedData);
  }

  private formatAsText(data: LogData): string {
    const timestamp = TimeUtil.format(data.timestamp, this.timestampFormat);
    let level = data.level.toUpperCase();
    
    if (this.colorize) {
      level = ColorUtil.colorize(level, data.level);
    }
    
    let output = `[${timestamp}] ${level} - ${data.message}`;
    
    if (data.metadata) {
      output += ` ${JSON.stringify(data.metadata)}`;
    }
    
    return output;
  }

  setJson(json: boolean): void {
    this.json = json;
  }
}