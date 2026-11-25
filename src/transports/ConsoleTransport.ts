import { Transport } from "./Transport.js";
import { LogData } from "../types/index.js";
import { Formatter } from "../core/Formatter.js";

export interface ConsoleTransportOptions {
  colorize?: boolean;
}

export class ConsoleTransport implements Transport {
  // The Formatter decides about color. The option stays for compatibility.
  constructor(_options: ConsoleTransportOptions = {}) {}

  write(data: LogData, formatter: Formatter): void {
    const method = data.level === "error" || data.level === "warn" ? data.level : "log";
    console[method as "log"](formatter.format(data));
  }

  async writeAsync(data: LogData, formatter: Formatter): Promise<void> {
    this.write(data, formatter);
  }
}
