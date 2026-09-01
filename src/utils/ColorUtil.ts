export class ColorUtil {
  private static readonly ANSI_CODES: { [key: string]: number } = {
    black: 30,
    red: 31,
    green: 32,
    yellow: 33,
    blue: 34,
    magenta: 35,
    cyan: 36,
    white: 37,
    brightRed: 91,
    brightGreen: 92,
    brightYellow: 93,
    brightBlue: 94,
    brightMagenta: 95,
    brightCyan: 96,
    brightWhite: 97,
    info: 32,
    warn: 33,
    error: 31,
    debug: 36,
  };

  static colorize(text: string, color: string): string {
    const forceColor = process.env.FORCE_COLOR;
    if (forceColor === "0" || (!process.stdout.isTTY && forceColor !== "1")) {
      return text;
    }

    if (color === "boring") {
      return text;
    }

    const colorCode = ColorUtil.ANSI_CODES[color] ?? 0;
    return `\x1b[${colorCode}m${text}\x1b[0m`;
  }
}
