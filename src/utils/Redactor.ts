import { toPlain } from "./serialize.js";

export interface RedactOptions {
  /** Dot-notation field paths to redact, e.g. `['password', 'user.token', 'headers.*']` */
  paths: string[];
  /** Replacement value for redacted fields. Defaults to `'[REDACTED]'` */
  censor?: string;
}

/** `redact: ["password"]` is short for `redact: { paths: ["password"] }`. */
export function toRedactOptions(options: RedactOptions | readonly string[]): RedactOptions {
  return "paths" in options ? options : { paths: [...options] };
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
 * - Any depth        `'**.password'` – redacts `password` wherever it is
 *
 * Letter case does not matter, so `authorization` also matches `Authorization`.
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
  readonly paths: readonly string[];
  readonly censor: string;
  private readonly _parts: string[][];

  constructor(options: RedactOptions | readonly string[]) {
    const { paths, censor = "[REDACTED]" } = toRedactOptions(options);
    this.paths = paths;
    this.censor = censor;
    // A key can contain a literal dot, such as "http.request.header.authorization".
    this._parts = paths.flatMap((path) => {
      const lower = path.toLowerCase();
      return lower.includes(".") ? [lower.split("."), [lower]] : [[lower]];
    });
  }

  /**
   * Returns a copy with the configured paths replaced by the censor value.
   * The copy holds what the output would show, so a toJSON(), a getter or a cycle cannot bring
   * back a value. The original object and its nested objects are never mutated.
   */
  redact(obj: Record<string, unknown>): Record<string, unknown> {
    if (obj === null || typeof obj !== "object") return obj;
    const copy = toPlain(obj, true);
    if (copy === null || typeof copy !== "object") return { metadata: copy };
    for (const parts of this._parts) this._walk(copy, parts, 0);
    return copy;
  }

  private _walk(node: Record<string, unknown>, parts: string[], index: number): void {
    const part = parts[index]!;
    const isLast = index === parts.length - 1;
    const anyDepth = part === "**" && !isLast;
    if (anyDepth) this._walk(node, parts, index + 1);
    // The message, stack and cause of an Error are not enumerable.
    for (const key of node instanceof Error ? Object.getOwnPropertyNames(node) : Object.keys(node)) {
      if (part !== "*" && part !== "**" && (key.length !== part.length || key.toLowerCase() !== part)) continue;
      const value = node[key];
      if (isLast) node[key] = this.replace(value);
      else if (value !== null && typeof value === "object") {
        this._walk(value as Record<string, unknown>, parts, anyDepth ? index : index + 1);
      }
    }
  }

  /** The value that goes in place of a matched field. FieldEncryptor overrides it. */
  protected replace(_value: unknown): unknown {
    return this.censor;
  }
}
