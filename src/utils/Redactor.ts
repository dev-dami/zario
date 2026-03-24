export interface RedactOptions {
  /** Dot-notation field paths to redact, e.g. `['password', 'user.token', 'headers.*']` */
  paths: string[];
  /** Replacement value for redacted fields. Defaults to `'[REDACTED]'` */
  censor?: string;
}

/**
 * Redactor removes sensitive data from log metadata before it reaches any transport.
 *
 * Configure it once on the logger and every log call is automatically sanitised —
 * passwords, tokens, API keys and other PII will never appear in your log output.
 *
 * Supported path syntax
 * ─────────────────────
 * - Simple key       `'password'`
 * - Nested path      `'user.credentials.token'`
 * - Wildcard leaf    `'headers.*'`   – redacts every key inside `headers`
 * - Wildcard node    `'*.secret'`    – redacts `secret` inside every top-level object
 *
 * @example
 * ```ts
 * const logger = new Logger({
 *   redact: { paths: ['password', 'user.token', 'headers.authorization'] },
 * });
 *
 * logger.info('Login attempt', { user: 'alice', password: 'hunter2' });
 * // → { user: 'alice', password: '[REDACTED]' }
 * ```
 */
export class Redactor {
  private readonly pathParts: ReadonlyArray<ReadonlyArray<string>>;
  private readonly censor: string;

  constructor(options: RedactOptions) {
    this.pathParts = options.paths.map((p) => p.split("."));
    this.censor = options.censor ?? "[REDACTED]";
  }

  /**
   * Returns a new object with the configured paths replaced by the censor value.
   * The original object and its nested objects are never mutated.
   */
  redact(obj: Record<string, unknown>): Record<string, unknown> {
    if (obj === null || typeof obj !== "object") {
      return obj;
    }
    const clone: Record<string, unknown> = { ...obj };
    for (const parts of this.pathParts) {
      this.applyRedaction(clone, parts as string[], 0);
    }
    return clone;
  }

  private applyRedaction(
    obj: Record<string, unknown>,
    parts: string[],
    index: number,
  ): void {
    if (index >= parts.length || obj === null || typeof obj !== "object") {
      return;
    }

    const key = parts[index]!;
    const isLast = index === parts.length - 1;

    if (key === "*") {
      for (const k of Object.keys(obj)) {
        if (isLast) {
          obj[k] = this.censor;
        } else if (obj[k] !== null && typeof obj[k] === "object") {
          obj[k] = { ...(obj[k] as Record<string, unknown>) };
          this.applyRedaction(obj[k] as Record<string, unknown>, parts, index + 1);
        }
      }
    } else if (Object.prototype.hasOwnProperty.call(obj, key)) {
      if (isLast) {
        obj[key] = this.censor;
      } else if (obj[key] !== null && typeof obj[key] === "object") {
        obj[key] = { ...(obj[key] as Record<string, unknown>) };
        this.applyRedaction(obj[key] as Record<string, unknown>, parts, index + 1);
      }
    }
  }
}
