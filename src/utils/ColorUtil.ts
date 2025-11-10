export class ColorUtil {
  // ANSI color codes
  private static readonly COLORS = {
    info: "\x1b[32m",
    warn: "\x1b[33m",
    error: "\x1b[31m",
    reset: "\x1b[0m",
  };

  static colorize(text: string, level: string): string {
    const supportsColor =
      process.env.FORCE_COLOR !== "0" &&
      (process.stdout.isTTY || process.env.FORCE_COLOR === "1");

    if (!supportsColor) {
      return text;
    }

    const colorCode =
      (ColorUtil.COLORS as any)[level] || ColorUtil.COLORS.reset;
    return `${colorCode}${text}${ColorUtil.COLORS.reset}`;
  }
}
