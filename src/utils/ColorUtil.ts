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

  private static supportsColorCache: boolean | null = null;
  private static supportCacheKey = "";

  private static supportsColor(): boolean {
    const forceColor = process.env.FORCE_COLOR ?? "";
    const ttyFlag = process.stdout.isTTY ? "1" : "0";
    const cacheKey = `${forceColor}:${ttyFlag}`;

    if (ColorUtil.supportCacheKey !== cacheKey || ColorUtil.supportsColorCache === null) {
      ColorUtil.supportCacheKey = cacheKey;
      ColorUtil.supportsColorCache =
        forceColor !== "0" && (process.stdout.isTTY || forceColor === "1");
    }

    return ColorUtil.supportsColorCache;
  }

  static colorize(text: string, color: string): string {
    if (!ColorUtil.supportsColor()) {
      return text;
    }

    const colorCode = ColorUtil.ANSI_COLORS[color] || ColorUtil.ANSI_COLORS.reset;
    return `${colorCode}${text}${ColorUtil.ANSI_COLORS.reset}`;
  }
}
