import { Transport } from './Transport';
import { LogData } from '../core/Logger';
import { Formatter } from '../core/Formatter';

export interface ConsoleTransportOptions {
  colorize?: boolean;
}

export class ConsoleTransport implements Transport {
  private colorize: boolean;

  constructor(options: ConsoleTransportOptions = {}) {
    const { colorize = true } = options;
    this.colorize = colorize;
  }

  write(data: LogData, formatter: Formatter): void {
    const originalJsonSetting = formatter['json'];
    const originalColorizeSetting = formatter['colorize'];
    
    // Temporarily update formatter settings if needed
    if (typeof this.colorize === 'boolean') {
      Object.assign(formatter, { colorize: this.colorize });
    }
    
    const output = formatter.format(data);
    
    // Restore original settings
    Object.assign(formatter, { json: originalJsonSetting, colorize: originalColorizeSetting });
    
    switch (data.level) {
      case 'error':
        console.error(output);
        break;
      case 'warn':
        console.warn(output);
        break;
      default:
        console.log(output);
        break;
    }
  }
}