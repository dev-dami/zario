/**
 * Serialize log values without mutating them. Only ancestor references are
 * circular; shared objects in separate branches retain their full contents.
 * BigInts become decimal strings and Errors retain their diagnostic fields.
 */
export function serialize(value: unknown): string {
  const ancestors: object[] = [];
  const errors = new WeakMap<Error, Record<string, unknown>>();
  return JSON.stringify(value, function (_key, current: unknown): unknown {
    if (typeof current === "bigint") return current.toString();
    if (current === null || typeof current !== "object") return current;

    if (current instanceof Error) {
      let diagnostic = errors.get(current);
      if (!diagnostic) {
        diagnostic = {
          ...current,
          name: current.name,
          message: current.message,
          stack: current.stack,
          ...("cause" in current ? { cause: current.cause } : {}),
          ...("errors" in current ? { errors: current.errors } : {}),
        };
        errors.set(current, diagnostic);
      }
      current = diagnostic;
    }
    while (ancestors.length && ancestors[ancestors.length - 1] !== this) {
      ancestors.pop();
    }
    if (ancestors.includes(current as object)) return "[Circular]";
    ancestors.push(current as object);
    return current;
  }) ?? "null";
}
