// Limits for values that are too large or too deep to copy. Plain data of any size that
// JSON.stringify can write on its own does not reach them.
const MAX_DEPTH = 200;
const MAX_NODES = 100_000;

let scanBudget = 0;

/**
 * Serialize log values without mutating them, and without throwing. Plain data goes to native
 * stringify. A value with an Error, BigInt, cycle or a member that throws is copied first.
 */
export function serialize(value: unknown): string {
  try {
    scanBudget = 1000;
    if (value === null || typeof value !== "object" || !needsCopy(value)) return JSON.stringify(value) ?? "null";
  } catch {
    // A cycle, a BigInt, a member that throws, or too many levels.
  }
  return JSON.stringify(toPlain(value)) ?? "null";
}

// Native stringify writes an Error as {}, without throwing, so look for one first. The budget
// bounds cycles and shared objects without a Set, which would cost more than the stringify.
function needsCopy(value: any): boolean {
  if (value instanceof Error || --scanBudget < 0) return true;
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      const child = value[i];
      if (child !== null && typeof child === "object" && needsCopy(child)) return true;
    }
    return false;
  }
  // for...in with no key array is the fastest walk of an object. It is slow on arrays in Node.
  for (const key in value) {
    const child = value[key];
    if (child !== null && typeof child === "object" && needsCopy(child)) return true;
  }
  return false;
}

/**
 * Copy a value to the data that JSON would show: toJSON() and getters are resolved, cycles and
 * members that throw become markers. Only ancestor references are circular, so shared objects
 * keep their contents. With keepErrors, an Error stays an Error with copied fields.
 */
export function toPlain(value: unknown, keepErrors = false): any {
  const ancestors: object[] = [];
  let nodes = 0;

  const visit = (parent: any, key: string): unknown => {
    const depth = ancestors.length;
    try {
      let current = parent[key];
      if (current !== null && typeof current === "object" && typeof current.toJSON === "function") {
        current = current.toJSON(key);
      }
      if (typeof current === "bigint") return current.toString();
      if (typeof current === "function" || typeof current === "symbol") return undefined;
      if (current === null || typeof current !== "object") return current;
      if (ancestors.includes(current)) return "[Circular]";
      if (depth >= MAX_DEPTH || ++nodes > MAX_NODES) return "[Truncated]";

      ancestors.push(current);
      if (Array.isArray(current)) return current.map((_, index) => visit(current, String(index)));

      const isError = current instanceof Error;
      const copy: any = isError && keepErrors ? Object.create(Object.getPrototypeOf(current)) : {};
      const isErrorCopy = isError && keepErrors;
      const set = (name: string, child: unknown, enumerable: boolean): void => {
        if (child === undefined) return;
        // An assignment to "__proto__" would set the prototype, and an Error class can have setters.
        if (isErrorCopy || name === "__proto__") {
          Object.defineProperty(copy, name, { value: child, enumerable, writable: true, configurable: true });
        } else {
          copy[name] = child;
        }
      };
      for (const name of Object.keys(current)) set(name, visit(current, name), true);
      if (isError) {
        for (const name of ["name", "message", "stack", "cause", "errors"]) {
          if (name in current) set(name, visit(current, name), !keepErrors);
        }
      }
      return copy;
    } catch {
      return "[Unserializable]";
    } finally {
      ancestors.length = depth;
    }
  };

  return visit({ "": value }, "");
}
