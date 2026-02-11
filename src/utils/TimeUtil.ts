const DEFAULT_TIME_FORMAT = "YYYY-MM-DD HH:mm:ss";
const TOKEN_PATTERN = /YYYY|MM|DD|HH|mm|ss|SSS/g;

export class TimeUtil {
  private static pad(n: number, width = 2): string {
    return n.toString().padStart(width, "0");
  }

  static format(date: Date, format: string): string {
    if (format === "ISO") return date.toISOString();
    if (format === "UTC") return date.toUTCString();
    if (format === "LOCAL") return date.toLocaleString();

    if (format === DEFAULT_TIME_FORMAT) {
      const year = TimeUtil.pad(date.getFullYear(), 4);
      const month = TimeUtil.pad(date.getMonth() + 1);
      const day = TimeUtil.pad(date.getDate());
      const hours = TimeUtil.pad(date.getHours());
      const minutes = TimeUtil.pad(date.getMinutes());
      const seconds = TimeUtil.pad(date.getSeconds());
      return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    }

    const tokens: Record<string, string> = {
      YYYY: TimeUtil.pad(date.getFullYear(), 4),
      MM: TimeUtil.pad(date.getMonth() + 1),
      DD: TimeUtil.pad(date.getDate()),
      HH: TimeUtil.pad(date.getHours()),
      mm: TimeUtil.pad(date.getMinutes()),
      ss: TimeUtil.pad(date.getSeconds()),
      SSS: TimeUtil.pad(date.getMilliseconds(), 3),
    };

    return format.replace(TOKEN_PATTERN, (match) => tokens[match] || match);
  }
}
