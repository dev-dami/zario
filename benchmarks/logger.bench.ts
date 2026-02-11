import { Logger } from "../src/core/Logger.js";
import { Formatter } from "../src/core/Formatter.js";
import type { LogData } from "../src/types/index.js";

class NullTransport {
  write(_data: LogData, _formatter: Formatter): void {}
  async writeAsync(_data: LogData, _formatter: Formatter): Promise<void> {}
}

interface BenchmarkConfig {
  iterations: number;
  warmupIterations: number;
  samples: number;
}

interface SampleMetrics {
  totalMs: number;
  perOpNs: number;
  opsPerSec: number;
}

interface BenchmarkSummary {
  name: string;
  iterations: number;
  warmupIterations: number;
  medianOpsPerSec: number;
  meanOpsPerSec: number;
  p95OpsPerSec: number;
  medianPerOpNs: number;
  medianTotalMs: number;
}

const DEFAULT_SYNC_CONFIG: BenchmarkConfig = {
  iterations: 50_000,
  warmupIterations: 10_000,
  samples: 6,
};

const FILTERED_CONFIG: BenchmarkConfig = {
  iterations: 200_000,
  warmupIterations: 40_000,
  samples: 6,
};

const DEFAULT_ASYNC_CONFIG: BenchmarkConfig = {
  iterations: 20_000,
  warmupIterations: 4_000,
  samples: 6,
};

const FORMATTER_CONFIG: BenchmarkConfig = {
  iterations: 80_000,
  warmupIterations: 12_000,
  samples: 6,
};

function maybeGC(): void {
  const gcFn = (globalThis as { gc?: () => void }).gc;
  if (typeof gcFn === "function") {
    gcFn();
  }
}

function runSyncSample(fn: () => void, iterations: number): SampleMetrics {
  const start = process.hrtime.bigint();
  for (let i = 0; i < iterations; i++) {
    fn();
  }
  const end = process.hrtime.bigint();
  const elapsedNs = Number(end - start);
  return {
    totalMs: elapsedNs / 1_000_000,
    perOpNs: elapsedNs / iterations,
    opsPerSec: (iterations * 1_000_000_000) / elapsedNs,
  };
}

async function runAsyncSample(fn: () => Promise<void>, iterations: number): Promise<SampleMetrics> {
  const start = process.hrtime.bigint();
  for (let i = 0; i < iterations; i++) {
    await fn();
  }
  const end = process.hrtime.bigint();
  const elapsedNs = Number(end - start);
  return {
    totalMs: elapsedNs / 1_000_000,
    perOpNs: elapsedNs / iterations,
    opsPerSec: (iterations * 1_000_000_000) / elapsedNs,
  };
}

function warmupSync(fn: () => void, iterations: number): void {
  for (let i = 0; i < iterations; i++) {
    fn();
  }
}

async function warmupAsync(fn: () => Promise<void>, iterations: number): Promise<void> {
  for (let i = 0; i < iterations; i++) {
    await fn();
  }
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1]! + sorted[mid]!) / 2;
  }
  return sorted[mid]!;
}

function mean(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function percentile(values: number[], p: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil(p * sorted.length) - 1));
  return sorted[idx]!;
}

function summarize(name: string, config: BenchmarkConfig, samples: SampleMetrics[]): BenchmarkSummary {
  const ops = samples.map((s) => s.opsPerSec);
  const perOp = samples.map((s) => s.perOpNs);
  const total = samples.map((s) => s.totalMs);
  return {
    name,
    iterations: config.iterations,
    warmupIterations: config.warmupIterations,
    medianOpsPerSec: median(ops),
    meanOpsPerSec: mean(ops),
    p95OpsPerSec: percentile(ops, 0.95),
    medianPerOpNs: median(perOp),
    medianTotalMs: median(total),
  };
}

function toTableInt(value: number): string {
  return Math.round(value).toLocaleString();
}

function printSectionTable(title: string, rows: BenchmarkSummary[]): void {
  console.log(title);
  console.log();
  console.log("| Benchmark | Iter/sample | Warmup | Median ops/sec | Mean ops/sec | P95 ops/sec | Median ns/op | Median total (ms) |");
  console.log("|---|---:|---:|---:|---:|---:|---:|---:|");
  for (const row of rows) {
    console.log(
      `| ${row.name} | ${row.iterations.toLocaleString()} | ${row.warmupIterations.toLocaleString()} | ${toTableInt(row.medianOpsPerSec)} | ${toTableInt(row.meanOpsPerSec)} | ${toTableInt(row.p95OpsPerSec)} | ${toTableInt(row.medianPerOpNs)} | ${row.medianTotalMs.toFixed(2)} |`
    );
  }
  console.log();
}

function benchmark(name: string, fn: () => void, config: BenchmarkConfig): BenchmarkSummary {
  warmupSync(fn, config.warmupIterations);
  const samples: SampleMetrics[] = [];
  for (let i = 0; i < config.samples; i++) {
    maybeGC();
    samples.push(runSyncSample(fn, config.iterations));
  }
  return summarize(name, config, samples);
}

async function benchmarkAsync(name: string, fn: () => Promise<void>, config: BenchmarkConfig): Promise<BenchmarkSummary> {
  await warmupAsync(fn, config.warmupIterations);
  const samples: SampleMetrics[] = [];
  for (let i = 0; i < config.samples; i++) {
    maybeGC();
    samples.push(await runAsyncSample(fn, config.iterations));
  }
  return summarize(name, config, samples);
}

async function runBenchmarks(): Promise<void> {
  console.log("=".repeat(60));
  console.log("Zario Performance Benchmarks");
  console.log("=".repeat(60));
  console.log("All sections use the same table schema for comparability.");
  console.log("Async rows measure enqueue/dispatch overhead in asyncMode.");
  console.log();

  const nullTransport = new NullTransport();

  const syncLogger = new Logger({
    level: "debug",
    asyncMode: false,
    transports: [nullTransport],
    timestamp: true,
  });

  const asyncLogger = new Logger({
    level: "debug",
    asyncMode: true,
    transports: [nullTransport],
    timestamp: true,
  });

  const filteredLogger = new Logger({
    level: "error",
    asyncMode: false,
    transports: [nullTransport],
  });

  const jsonLogger = new Logger({
    level: "debug",
    asyncMode: false,
    transports: [nullTransport],
    json: true,
    timestamp: true,
  });

  const syncRows: BenchmarkSummary[] = [
    benchmark("Simple message (sync)", () => {
      syncLogger.info("Hello world");
    }, DEFAULT_SYNC_CONFIG),
    benchmark("Message with metadata (sync)", () => {
      syncLogger.info("Request received", { userId: 123, path: "/api/users" });
    }, DEFAULT_SYNC_CONFIG),
    benchmark("Message with deep metadata (sync)", () => {
      syncLogger.info("Complex log", {
        user: { id: 123, name: "John", email: "john@example.com" },
        request: { method: "GET", path: "/api", headers: { "content-type": "application/json" } },
        requestTs: Date.now(),
      });
    }, DEFAULT_SYNC_CONFIG),
  ];
  printSectionTable("--- Sync Logging ---", syncRows);

  const filteredRows: BenchmarkSummary[] = [
    benchmark("Filtered debug log (level=error)", () => {
      filteredLogger.debug("This should be filtered");
    }, FILTERED_CONFIG),
    benchmark("Filtered info log (level=error)", () => {
      filteredLogger.info("This should be filtered");
    }, FILTERED_CONFIG),
  ];
  printSectionTable("--- Filtered Logs (Early Exit) ---", filteredRows);

  const jsonRows: BenchmarkSummary[] = [
    benchmark("Simple JSON log", () => {
      jsonLogger.info("Hello world");
    }, DEFAULT_SYNC_CONFIG),
    benchmark("JSON log with metadata", () => {
      jsonLogger.info("Request", { userId: 123, path: "/api" });
    }, DEFAULT_SYNC_CONFIG),
  ];
  printSectionTable("--- JSON Formatting ---", jsonRows);

  const asyncRows: BenchmarkSummary[] = [
    await benchmarkAsync("Simple message (async enqueue)", async () => {
      asyncLogger.info("Hello world");
    }, DEFAULT_ASYNC_CONFIG),
    await benchmarkAsync("Message with metadata (async enqueue)", async () => {
      asyncLogger.info("Request received", { userId: 123, path: "/api/users" });
    }, DEFAULT_ASYNC_CONFIG),
  ];
  printSectionTable("--- Async Logging ---", asyncRows);

  const formatter = new Formatter({ json: false, timestamp: true, colorize: false });
  const jsonFormatter = new Formatter({ json: true, timestamp: true });
  const sampleData: LogData = {
    level: "info",
    message: "Test message",
    timestamp: new Date(),
    prefix: "[App]",
    metadata: { key: "value" },
  };
  const simpleData: LogData = {
    level: "info",
    message: "Test message",
    timestamp: new Date(),
  };

  const formatterRows: BenchmarkSummary[] = [
    benchmark("Format text (with metadata)", () => {
      formatter.format(sampleData);
    }, FORMATTER_CONFIG),
    benchmark("Format text (simple)", () => {
      formatter.format(simpleData);
    }, FORMATTER_CONFIG),
    benchmark("Format JSON (with metadata)", () => {
      jsonFormatter.format(sampleData);
    }, FORMATTER_CONFIG),
    benchmark("Format JSON (simple fast path)", () => {
      jsonFormatter.format(simpleData);
    }, FORMATTER_CONFIG),
  ];
  printSectionTable("--- Formatter Direct ---", formatterRows);

  const childLogger = syncLogger.createChild({ prefix: "[Child]" });
  const childRows: BenchmarkSummary[] = [
    benchmark("Child logger simple message", () => {
      childLogger.info("Child log");
    }, DEFAULT_SYNC_CONFIG),
    benchmark("Child logger with metadata", () => {
      childLogger.info("Child log", { extra: "data" });
    }, DEFAULT_SYNC_CONFIG),
  ];
  printSectionTable("--- Child Logger ---", childRows);

  console.log("=".repeat(60));
  console.log("Benchmarks complete!");
  console.log("=".repeat(60));
}

runBenchmarks().catch(console.error);
