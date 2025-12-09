import { Transport } from "./Transport.js";
import { LogData } from "../types/index.js";
import { Formatter } from "../core/Formatter.js";

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
    // Toggle colorize temporarily, then restore it
    const originalColorizeSetting = formatter["colorize"];

    if (this.colorize !== originalColorizeSetting) {
      formatter["colorize"] = this.colorize;
    }

    const output = formatter.format(data);
    // Restore
    if (this.colorize !== originalColorizeSetting) {
      formatter["colorize"] = originalColorizeSetting;
    }

    switch (data.level) {
      case "error":
        console.error(output);
        break;
      case "warn":
        console.warn(output);
        break;
      default:
        console.log(output);
        break;
    }
  }

  async writeAsync(data: LogData, formatter: Formatter): Promise<void> {
    setImmediate(() => {
      this.write(data, formatter);
    });
    return Promise.resolve();
  }
}
