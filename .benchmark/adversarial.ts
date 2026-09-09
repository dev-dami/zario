import { Formatter } from "../src/core/Formatter.js";
import { Logger } from "../src/core/Logger.js";
import type { LogData } from "../src/types/index.js";
import { Writable as NodeWritable } from "node:stream";
import pino from "pino";
import winston from "winston";
import bunyan from "bunyan";
import log4js from "log4js";
import loglevel from "loglevel";

type LogMethod = (message: string, metadata?: Record<string, unknown>) => void;

interface Sink {
  stream: NodeWritable;
  writes: number;
  bytes: number;
  last: string;
  reset(): void;
}

interface Candidate {
  name: string;
  sink: Sink;
  simple: LogMethod;
  metadata: LogMethod;
  child?: LogMethod;
  filtered: LogMethod;
  error: LogMethod;
  circular: LogMethod;
}

interface TimedResult {
  opsPerSec: number;
  nsPerOp: number;
  errors: number;
}

interface Summary {
  name: string;
  medianOpsPerSec: number;
  minOpsPerSec: number;
  maxOpsPerSec: number;
  medianNsPerOp: number;
  errors: number;
}

const durationMs = Number(process.env.ZARIO_ADVERSARIAL_DURATION_MS ?? 250);
const samples = Number(process.env.ZARIO_ADVERSARIAL_SAMPLES ?? 5);
const burstCount = Number(process.env.ZARIO_ADVERSARIAL_BURST ?? 100_000);

function createSink(): Sink {
  const sink: Sink = {
    stream: undefined as unknown as NodeWritable,
    writes: 0,
    bytes: 0,
    last: "",
    reset() {
      sink.writes = 0;
      sink.bytes = 0;
      sink.last = "";
    },
  };

  sink.stream = new NodeWritable({
    decodeStrings: false,
    write(chunk, _encoding, callback) {
      const text = typeof chunk === "string" ? chunk : chunk.toString();
      sink.writes++;
      sink.bytes += Buffer.byteLength(text);
      sink.last = text;
      callback();
    },
  });

  return sink;
}

class ZarioStreamTransport {
  constructor(private readonly stream: NodeWritable) {}

  write(data: LogData, formatter: Formatter): void {
    this.stream.write(`${formatter.format(data)}\n`);
  }
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)]!;
}

function shuffle<T>(items: T[], seed: number): T[] {
  const copy = [...items];
  let state = seed >>> 0;
  for (let i = copy.length - 1; i > 0; i--) {
    state = (state * 1_664_525 + 1_013_904_223) >>> 0;
    const j = state % (i + 1);
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy;
}

function timeForDuration(fn: () => void): TimedResult {
  const deadline = process.hrtime.bigint() + BigInt(Math.max(1, durationMs)) * 1_000_000n;
  let operations = 0;
  let errors = 0;
  const start = process.hrtime.bigint();

  while (process.hrtime.bigint() < deadline) {
    try {
      fn();
      operations++;
    } catch {
      errors++;
    }
  }

  const elapsedNs = Number(process.hrtime.bigint() - start);
  return {
    opsPerSec: operations * 1_000_000_000 / elapsedNs,
    nsPerOp: operations === 0 ? Number.POSITIVE_INFINITY : elapsedNs / operations,
    errors,
  };
}

function benchmark(name: string, fn: () => void): Summary {
  for (let i = 0; i < Math.max(10_000, Math.floor(durationMs * 20)); i++) {
    fn();
  }

  const results: TimedResult[] = [];
  for (let sample = 0; sample < samples; sample++) {
    if (typeof globalThis.gc === "function") globalThis.gc();
    results.push(timeForDuration(fn));
  }

  return {
    name,
    medianOpsPerSec: median(results.map((result) => result.opsPerSec)),
    minOpsPerSec: Math.min(...results.map((result) => result.opsPerSec)),
    maxOpsPerSec: Math.max(...results.map((result) => result.opsPerSec)),
    medianNsPerOp: median(results.map((result) => result.nsPerOp)),
    errors: results.reduce((sum, result) => sum + result.errors, 0),
  };
}

function formatNumber(value: number): string {
  return Math.round(value).toLocaleString();
}

function printSummaries(title: string, summaries: Summary[]): void {
  const fastest = Math.max(...summaries.map((summary) => summary.medianOpsPerSec));
  console.log(`\n${"=".repeat(100)}\n${title}\n${"=".repeat(100)}`);
  console.log("Library".padEnd(14) + "median ops/sec".padStart(18) + "range".padStart(28) + "ns/op".padStart(12) + "relative".padStart(12) + "errors".padStart(10));
  console.log("-".repeat(94));
  for (const summary of [...summaries].sort((a, b) => b.medianOpsPerSec - a.medianOpsPerSec)) {
    const relative = `${(summary.medianOpsPerSec / fastest * 100).toFixed(1)}%`;
    const range = `${formatNumber(summary.minOpsPerSec)}–${formatNumber(summary.maxOpsPerSec)}`;
    console.log(
      summary.name.padEnd(14) +
      formatNumber(summary.medianOpsPerSec).padStart(18) +
      range.padStart(28) +
      formatNumber(summary.medianNsPerOp).padStart(12) +
      relative.padStart(12) +
      formatNumber(summary.errors).padStart(10),
    );
  }
}

function createCandidates(): Candidate[] {
  const zarioSink = createSink();
  const zario = new Logger({
    level: "info",
    json: true,
    timestamp: false,
    colorize: false,
    transports: [new ZarioStreamTransport(zarioSink.stream)],
  });
  const zarioChild = zario.createChild({ context: { service: "benchmark" } });

  const pinoSink = createSink();
  const pinoLogger = pino({ level: "info", base: null, timestamp: false }, pinoSink.stream);
  const pinoChild = pinoLogger.child({ service: "benchmark" });

  const winstonSink = createSink();
  const winstonLogger = winston.createLogger({
    level: "info",
    format: winston.format.json(),
    transports: [new winston.transports.Stream({ stream: winstonSink.stream })],
  });
  const winstonChild = winstonLogger.child({ service: "benchmark" });

  const bunyanSink = createSink();
  const bunyanLogger = bunyan.createLogger({
    name: "benchmark",
    level: "info",
    src: false,
    streams: [{ stream: bunyanSink.stream }],
  });
  const bunyanChild = bunyanLogger.child({ service: "benchmark" });

  const log4jsSink = createSink();
  log4js.configure({
    appenders: {
      benchmark: {
        type: {
          configure: () => (event: { level: { levelStr: string }; data: unknown[] }) => {
            log4jsSink.stream.write(`${JSON.stringify({ level: event.level.levelStr, data: event.data })}\n`);
          },
        },
      },
    },
    categories: { default: { appenders: ["benchmark"], level: "info" } },
  });
  const log4jsLogger = log4js.getLogger("benchmark");

  const loglevelSink = createSink();
  const loglevelLogger = loglevel.getLogger("adversarial");
  loglevelLogger.setLevel("info");
  loglevelLogger.methodFactory = (methodName) => (...args: unknown[]) => {
    loglevelSink.stream.write(`${JSON.stringify({ level: methodName, args })}\n`);
  };
  loglevelLogger.setLevel(loglevelLogger.getLevel());

  return [
    {
      name: "Zario",
      sink: zarioSink,
      simple: (message, metadata) => zario.info(message, metadata),
      metadata: (message, metadata) => zario.info(message, metadata),
      child: (message, metadata) => zarioChild.info(message, metadata),
      filtered: (message, metadata) => zario.debug(message, metadata),
      error: (message, metadata) => zario.error(message, metadata),
      circular: (message, metadata) => zario.info(message, metadata),
    },
    {
      name: "Pino",
      sink: pinoSink,
      simple: (message) => pinoLogger.info(message),
      metadata: (message, metadata) => pinoLogger.info(metadata, message),
      child: (message, metadata) => pinoChild.info(metadata, message),
      filtered: (message) => pinoLogger.debug(message),
      error: (message, metadata) => pinoLogger.error(metadata, message),
      circular: (message, metadata) => pinoLogger.info(metadata, message),
    },
    {
      name: "Winston",
      sink: winstonSink,
      simple: (message) => winstonLogger.info(message),
      metadata: (message, metadata) => winstonLogger.info(message, metadata),
      child: (message, metadata) => winstonChild.info(message, metadata),
      filtered: (message) => winstonLogger.debug(message),
      error: (message, metadata) => winstonLogger.error(message, metadata),
      circular: (message, metadata) => winstonLogger.info(message, metadata),
    },
    {
      name: "Bunyan",
      sink: bunyanSink,
      simple: (message) => bunyanLogger.info(message),
      metadata: (message, metadata) => bunyanLogger.info(metadata, message),
      child: (message, metadata) => bunyanChild.info(metadata, message),
      filtered: (message) => bunyanLogger.debug(message),
      error: (message, metadata) => bunyanLogger.error(metadata, message),
      circular: (message, metadata) => bunyanLogger.info(metadata, message),
    },
    {
      name: "Log4js",
      sink: log4jsSink,
      simple: (message) => log4jsLogger.info(message),
      metadata: (message, metadata) => log4jsLogger.info(message, metadata),
      filtered: (message) => log4jsLogger.debug(message),
      error: (message, metadata) => log4jsLogger.error(message, metadata),
      circular: (message, metadata) => log4jsLogger.info(message, metadata),
    },
    {
      name: "Loglevel",
      sink: loglevelSink,
      simple: (message) => loglevelLogger.info(message),
      metadata: (message, metadata) => loglevelLogger.info(message, metadata),
      filtered: (message) => loglevelLogger.debug(message),
      error: (message, metadata) => loglevelLogger.error(message, metadata),
      circular: (message, metadata) => loglevelLogger.info(message, metadata),
    },
  ];
}

const deepMetadata: Record<string, unknown> = {
  request: {
    method: "POST",
    path: "/api/users",
    headers: { "content-type": "application/json", authorization: "Bearer xxx" },
  },
  response: { status: 200, time: 45 },
  user: { id: 12345, name: "John Doe", roles: ["admin", "user"] },
};
const error = new Error("Something went wrong");
const errorMetadata = { error, code: "E_FAILURE" };
const circularMetadata: Record<string, unknown> = { name: "cycle" };
circularMetadata.self = circularMetadata;
const largeMessage = "x".repeat(16 * 1024);
let dynamicId = 0;

const cases: Array<{ title: string; method: keyof Candidate; args: () => [string, Record<string, unknown>?] }> = [
  { title: "Simple constant", method: "simple", args: () => ["Hello world"] },
  { title: "Dynamic message", method: "simple", args: () => [`request-${dynamicId++}`] },
  { title: "Flat metadata", method: "metadata", args: () => ["User logged in", { user: "john", action: "login", ip: "192.168.1.1" }] },
  { title: "Deep metadata", method: "metadata", args: () => ["API request", deepMetadata] },
  { title: "16 KiB message", method: "simple", args: () => [largeMessage] },
  { title: "Child context", method: "child", args: () => ["Request handled", { route: "/users" }] },
  { title: "Error object", method: "error", args: () => ["Operation failed", errorMetadata] },
  { title: "Filtered debug", method: "filtered", args: () => ["This must not be emitted"] },
];

const candidates = createCandidates();

console.log(`Adversarial logger comparison: ${candidates.map((candidate) => candidate.name).join(", ")}`);
console.log(`duration=${durationMs}ms samples=${samples} burst=${burstCount}`);
console.log("All enabled cases write formatted output to a shared synchronous in-process sink.");
console.log("Loglevel is included as a real output case; no-op method replacement is intentionally not used.");

for (const [caseIndex, testCase] of cases.entries()) {
  const summaries: Summary[] = [];
  const eligible = candidates.filter((candidate) => typeof candidate[testCase.method] === "function");
  for (const candidate of shuffle(eligible, 0x9e3779b9 + caseIndex)) {
    const method = candidate[testCase.method] as LogMethod;
    summaries.push(benchmark(candidate.name, () => method(...testCase.args())));
  }
  printSummaries(testCase.title, summaries);
}

console.log(`\n${"=".repeat(100)}\nBurst and output accounting\n${"=".repeat(100)}`);
console.log("Library".padEnd(14) + "burst ms".padStart(14) + "logs/sec".padStart(16) + "writes".padStart(12) + "bytes".padStart(14) + "heap delta".padStart(16));
console.log("-".repeat(86));

for (const candidate of shuffle(candidates, 0x243f6a88)) {
  candidate.sink.reset();
  const sinkBefore = process.memoryUsage().heapUsed;
  const start = performance.now();
  for (let i = 0; i < burstCount; i++) {
    candidate.simple("burst-message");
  }
  const elapsedMs = performance.now() - start;
  const sinkAfter = process.memoryUsage().heapUsed;
  console.log(
    candidate.name.padEnd(14) +
    elapsedMs.toFixed(2).padStart(14) +
    formatNumber(burstCount / elapsedMs * 1000).padStart(16) +
    formatNumber(candidate.sink.writes).padStart(12) +
    formatNumber(candidate.sink.bytes).padStart(14) +
    `${((sinkAfter - sinkBefore) / 1024 / 1024).toFixed(2)} MiB`.padStart(16),
  );
}

console.log(`\n${"=".repeat(100)}\nCorrectness probes\n${"=".repeat(100)}`);
console.log("Each probe invokes one call. Circular metadata records whether the logger throws; filtered writes must remain zero; nested Error checks whether a stack is emitted.");
console.log("Library".padEnd(14) + "circular metadata".padStart(22) + "filtered writes".padStart(18) + "nested Error stack".padStart(22));
console.log("-".repeat(76));
for (const candidate of candidates) {
  let circular = "ok";
  let filtered = "0";
  let errorResult = "ok";
  try {
    candidate.circular("cycle", circularMetadata);
  } catch (caught) {
    circular = caught instanceof Error ? caught.name : "throws";
  }
  candidate.sink.reset();
  try {
    candidate.filtered("filtered");
    filtered = String(candidate.sink.writes);
  } catch {
    filtered = "throws";
  }
  try {
    candidate.sink.reset();
    candidate.error("failure", errorMetadata);
    if (!candidate.sink.last.includes("Something went wrong") && !candidate.sink.last.includes("stack")) {
      errorResult = "stack absent";
    }
  } catch (caught) {
    errorResult = caught instanceof Error ? caught.name : "throws";
  }
  console.log(candidate.name.padEnd(14) + circular.padStart(22) + filtered.padStart(18) + errorResult.padStart(22));
}
