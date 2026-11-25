const TOKEN_PATTERN = /YYYY|MM|DD|HH|mm|ss|SSS/g;

export class TimeUtil {
  static format(date: Date, format: string): string {
    if (format === "ISO") return date.toISOString();
    if (format === "UTC") return date.toUTCString();
    if (format === "LOCAL") return date.toLocaleString();

    // Shift by the offset, so that the ISO text has the local time.
    const iso = new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString();
    const tokens: Record<string, string> = {
      YYYY: iso.slice(0, 4),
      MM: iso.slice(5, 7),
      DD: iso.slice(8, 10),
      HH: iso.slice(11, 13),
      mm: iso.slice(14, 16),
      ss: iso.slice(17, 19),
      SSS: iso.slice(20, 23),
    };

    return format.replace(TOKEN_PATTERN, (match) => tokens[match] || match);
  }
}
