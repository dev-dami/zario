/**
 * Serialize log values without mutating them. Only ancestor references are
 * circular; shared objects in separate branches retain their full contents.
 * BigInts become decimal strings and Errors retain their diagnostic fields.
 * Plain data skips the replacer via native stringify; the slow path covers
 * BigInt, Error diagnostics and circular references.
 */
export function serialize(value: unknown): string {
  if (value === null || typeof value !== "object") {
    if (typeof value === "bigint") return JSON.stringify(value.toString());
    return JSON.stringify(value) ?? "null";
  }
  if (value instanceof Error) return serializeSlow(value);
  // 0 = plain (native stringify), anything else needs the slow path.
  if (scanValue(value) === 0) return JSON.stringify(value) ?? "null";
  return serializeSlow(value);
}

// Deep scan: 1 = BigInt/Error present, 2 = circular, 0 = plain. The ancestor
// set tells cycles apart from shared references; finished subtrees are
// skipped so diamonds are not re-walked.
function scanValue(root: object): number {
  interface Frame { node: object; children: readonly unknown[]; index: number }
  const ancestors = new Set<object>();
  const done = new Set<object>();
  const frameFor = (node: object): Frame => ({
    node,
    children: Array.isArray(node) ? node : Object.values(node),
    index: 0,
  });
  ancestors.add(root);
  const stack: Frame[] = [frameFor(root)];
  while (stack.length > 0) {
    const frame = stack[stack.length - 1]!;
    if (frame.index >= frame.children.length) {
      ancestors.delete(frame.node);
      done.add(frame.node);
      stack.pop();
      continue;
    }
    const child = frame.children[frame.index++]!;
    if (typeof child === "bigint" || child instanceof Error) return 1;
    if (child === null || typeof child !== "object" || done.has(child)) continue;
    if (ancestors.has(child)) return 2;
    ancestors.add(child);
    stack.push(frameFor(child));
  }
  return 0;
}

function serializeSlow(value: unknown): string {
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
