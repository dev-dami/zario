import { Redactor } from "../../src/utils/Redactor";
import { Logger } from "../../src/core/Logger";
import { Formatter } from "../../src/core/Formatter";
import { LogData } from "../../src/types";
import { Transport } from "../../src/transports/Transport";

describe("Redactor", () => {
  describe("basic field redaction", () => {
    test("redacts a top-level field", () => {
      const redactor = new Redactor({ paths: ["password"] });
      const result = redactor.redact({ user: "alice", password: "hunter2" });
      expect(result).toEqual({ user: "alice", password: "[REDACTED]" });
    });

    test("leaves fields not in paths unchanged", () => {
      const redactor = new Redactor({ paths: ["secret"] });
      const result = redactor.redact({ name: "bob", age: 30 });
      expect(result).toEqual({ name: "bob", age: 30 });
    });

    test("redacts multiple top-level fields", () => {
      const redactor = new Redactor({ paths: ["password", "token"] });
      const result = redactor.redact({
        user: "alice",
        password: "hunter2",
        token: "abc123",
      });
      expect(result).toEqual({
        user: "alice",
        password: "[REDACTED]",
        token: "[REDACTED]",
      });
    });
  });

  describe("nested field redaction", () => {
    test("redacts a nested field", () => {
      const redactor = new Redactor({ paths: ["user.token"] });
      const result = redactor.redact({
        user: { name: "alice", token: "secret-token" },
        other: "data",
      });
      expect(result).toEqual({
        user: { name: "alice", token: "[REDACTED]" },
        other: "data",
      });
    });

    test("redacts a deeply nested field", () => {
      const redactor = new Redactor({ paths: ["auth.credentials.apiKey"] });
      const result = redactor.redact({
        auth: { credentials: { apiKey: "my-api-key", algo: "HS256" } },
      });
      expect(result).toEqual({
        auth: { credentials: { apiKey: "[REDACTED]", algo: "HS256" } },
      });
    });

    test("ignores path when intermediate key does not exist", () => {
      const redactor = new Redactor({ paths: ["nonexistent.field"] });
      const result = redactor.redact({ name: "alice" });
      expect(result).toEqual({ name: "alice" });
    });

    test("ignores path when intermediate key is not an object", () => {
      const redactor = new Redactor({ paths: ["user.secret"] });
      const result = redactor.redact({ user: "alice" });
      expect(result).toEqual({ user: "alice" });
    });
  });

  describe("wildcard redaction", () => {
    test("redacts all keys with wildcard leaf (*)", () => {
      const redactor = new Redactor({ paths: ["headers.*"] });
      const result = redactor.redact({
        headers: { authorization: "Bearer token", "x-api-key": "key123" },
        body: "hello",
      });
      expect(result).toEqual({
        headers: { authorization: "[REDACTED]", "x-api-key": "[REDACTED]" },
        body: "hello",
      });
    });

    test("wildcard at top level redacts everything", () => {
      const redactor = new Redactor({ paths: ["*"] });
      const result = redactor.redact({ a: 1, b: 2, c: 3 });
      expect(result).toEqual({
        a: "[REDACTED]",
        b: "[REDACTED]",
        c: "[REDACTED]",
      });
    });

    test("wildcard node applies to all matching children", () => {
      const redactor = new Redactor({ paths: ["*.secret"] });
      const result = redactor.redact({
        serviceA: { secret: "abc", name: "A" },
        serviceB: { secret: "xyz", name: "B" },
      });
      expect(result).toEqual({
        serviceA: { secret: "[REDACTED]", name: "A" },
        serviceB: { secret: "[REDACTED]", name: "B" },
      });
    });
  });

  describe("custom censor value", () => {
    test("uses the provided censor string", () => {
      const redactor = new Redactor({ paths: ["password"], censor: "***" });
      const result = redactor.redact({ password: "secret" });
      expect(result).toEqual({ password: "***" });
    });

    test("defaults to [REDACTED] when censor is not provided", () => {
      const redactor = new Redactor({ paths: ["token"] });
      const result = redactor.redact({ token: "abc" });
      expect(result.token).toBe("[REDACTED]");
    });
  });

  describe("immutability", () => {
    test("does not mutate the original top-level object", () => {
      const redactor = new Redactor({ paths: ["password"] });
      const original = { user: "alice", password: "secret" };
      redactor.redact(original);
      expect(original.password).toBe("secret");
    });

    test("does not mutate nested objects", () => {
      const redactor = new Redactor({ paths: ["user.token"] });
      const nested = { token: "secret-token", name: "alice" };
      const original = { user: nested };
      redactor.redact(original);
      expect(nested.token).toBe("secret-token");
    });
  });

  describe("edge cases", () => {
    test("handles empty paths array", () => {
      const redactor = new Redactor({ paths: [] });
      const result = redactor.redact({ a: 1, b: 2 });
      expect(result).toEqual({ a: 1, b: 2 });
    });

    test("handles empty object", () => {
      const redactor = new Redactor({ paths: ["password"] });
      const result = redactor.redact({});
      expect(result).toEqual({});
    });
  });
});

describe("Logger redact option", () => {
  class MockTransport implements Transport {
    public logs: LogData[] = [];
    write(data: LogData, _formatter: Formatter): void {
      this.logs.push(data);
    }
  }

  test("redacts configured fields in log metadata", () => {
    const transport = new MockTransport();
    const logger = new Logger({
      level: "debug",
      transports: [transport],
      redact: { paths: ["password", "token"] },
    });

    logger.info("Login attempt", { user: "alice", password: "hunter2", token: "abc" });

    expect(transport.logs).toHaveLength(1);
    const meta = transport.logs[0].metadata;
    expect(meta.user).toBe("alice");
    expect(meta.password).toBe("[REDACTED]");
    expect(meta.token).toBe("[REDACTED]");
  });

  test("redacts nested fields", () => {
    const transport = new MockTransport();
    const logger = new Logger({
      level: "debug",
      transports: [transport],
      redact: { paths: ["auth.credentials.apiKey"] },
    });

    logger.info("API call", { auth: { credentials: { apiKey: "my-key", algo: "HS256" } } });

    const meta = transport.logs[0].metadata;
    expect(meta.auth.credentials.apiKey).toBe("[REDACTED]");
    expect(meta.auth.credentials.algo).toBe("HS256");
  });

  test("child logger inherits parent redactor", () => {
    const transport = new MockTransport();
    const parent = new Logger({
      level: "debug",
      transports: [transport],
      redact: { paths: ["password"] },
    });
    const child = parent.createChild({ prefix: "child" });

    child.info("User action", { user: "bob", password: "secret" });

    const meta = transport.logs[0].metadata;
    expect(meta.password).toBe("[REDACTED]");
    expect(meta.user).toBe("bob");
  });

  test("child logger can override parent redactor with its own config", () => {
    const transport = new MockTransport();
    const parent = new Logger({
      level: "debug",
      transports: [transport],
      redact: { paths: ["password"] },
    });
    const child = parent.createChild({
      redact: { paths: ["token"] },
    });

    child.info("Request", { password: "p", token: "t" });

    const meta = transport.logs[0].metadata;
    // Child's redact replaces parent's — only 'token' is redacted
    expect(meta.token).toBe("[REDACTED]");
    expect(meta.password).toBe("p");
  });

  test("context fields are also redacted", () => {
    const transport = new MockTransport();
    const logger = new Logger({
      level: "debug",
      transports: [transport],
      context: { requestId: "req-1", apiKey: "key-value" },
      redact: { paths: ["apiKey"] },
    });

    logger.info("Processing request");

    const meta = transport.logs[0].metadata;
    expect(meta.apiKey).toBe("[REDACTED]");
    expect(meta.requestId).toBe("req-1");
  });
});
