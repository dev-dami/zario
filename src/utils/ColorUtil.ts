// Each name is at its offset from ANSI 30. The bright variants are 60 higher.
const COLORS = ["black", "red", "green", "yellow", "blue", "magenta", "cyan", "white"];
const LEVEL_COLORS: { [level: string]: string } = { info: "green", warn: "yellow", error: "red", fatal: "magenta", debug: "cyan" };

function ansiCode(color: string): number {
  const bright = color.startsWith("bright");
  const name = bright ? color.slice(6).toLowerCase() : LEVEL_COLORS[color] ?? color;
  const index = COLORS.indexOf(name);
  return index < 0 ? 0 : index + (bright ? 90 : 30);
}

export class ColorUtil {
  static colorize(text: string, color: string): string {
    const forceColor = process.env.FORCE_COLOR;
    if (forceColor === "0" || (!process.stdout.isTTY && forceColor !== "1")) {
      return text;
    }

    if (color === "boring") {
      return text;
    }

    return `\x1b[${ansiCode(color)}m${text}\x1b[0m`;
  }
}
