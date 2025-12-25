export class ColorUtil {
  private static readonly ANSI_COLORS: { [key: string]: string } = {
    black: "\x1b[30m",
    red: "\x1b[31m",
    green: "\x1b[32m",
    yellow: "\x1b[33m",
    blue: "\x1b[34m",
    magenta: "\x1b[35m",
    cyan: "\x1b[36m",
    white: "\x1b[37m",
    brightRed: "\x1b[91m",
    brightGreen: "\x1b[92m",
    brightYellow: "\x1b[93m",
    brightBlue: "\x1b[94m",
    brightMagenta: "\x1b[95m",
    brightCyan: "\x1b[96m",
    brightWhite: "\x1b[97m",
    info: "\x1b[32m",
    warn: "\x1b[33m",
    error: "\x1b[31m",
    debug: "\x1b[36m",
    boring: "\x1b[37m",
    reset: "\x1b[0m",
  };

  static colorize(text: string, color: string): string {
    const supportsColor =
      process.env.FORCE_COLOR !== "0" &&
      (process.stdout.isTTY || process.env.FORCE_COLOR === "1");

    if (!supportsColor) {
      return text;
    }

    const colorCode = ColorUtil.ANSI_COLORS[color] || ColorUtil.ANSI_COLORS.reset;
    return `${colorCode}${text}${ColorUtil.ANSI_COLORS.reset}`;
  }
}

export class TimeUtil {
  static format(date: Date, format: string): string {
    if (format === "ISO") return date.toISOString();
    if (format === "UTC") return date.toUTCString();
    if (format === "LOCAL") return date.toLocaleString();

    const pad = (n: number, width = 2) => n.toString().padStart(width, "0");

    const tokens: Record<string, string> = {
      YYYY: pad(date.getFullYear(), 4),
      MM: pad(date.getMonth() + 1),
      DD: pad(date.getDate()),
      HH: pad(date.getHours()),
      mm: pad(date.getMinutes()),
      ss: pad(date.getSeconds()),
      SSS: pad(date.getMilliseconds(), 3),
    };

    return format.replace(/YYYY|MM|DD|HH|mm|ss|SSS/g, (match) => tokens[match] || match);
  }
}

export class Timer {
  private startTime: number;
  private name: string;
  private logFn: (message: string) => void;
  private hasEnded: boolean = false;

  constructor(name: string, logFn: (message: string) => void) {
    this.name = name;
    this.logFn = logFn;
    this.startTime = Date.now();
  }

  end(): void {
    if (this.hasEnded) {
      return;
    }

    const endTime = Date.now();
    const duration = endTime - this.startTime;
    this.logFn(`${this.name} took ${duration}ms`);
    this.hasEnded = true;
  }
}
