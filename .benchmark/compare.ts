import { Writable } from 'stream';
import { BenchCase, resolveWarmupMs, runForDuration, shuffleCases } from '../benchmarks/benchmarkUtils.js';

const nullStream = new Writable({
  write(_chunk, _encoding, callback) {
    callback();
  }
});

import { Logger } from '../src/core/Logger.js';
import { Transport } from '../src/transports/Transport.js';
import { Formatter } from '../src/core/Formatter.js';
import { LogData } from '../src/types/index.js';

class NullTransport implements Transport {
  write(data: LogData, formatter: Formatter): void {
    formatter.format(data);
  }
  async writeAsync(data: LogData, formatter: Formatter): Promise<void> {
    formatter.format(data);
  }
}

const zarioLogger = new Logger({
  level: 'info',
  transports: [new NullTransport()]
});

const zarioChild = new Logger({
  level: 'info',
  transports: [new NullTransport()],
  parent: zarioLogger,
  context: { service: 'benchmark' }
});

import pino from 'pino';

const pinoLogger = pino({ level: 'info' }, nullStream);
const pinoChild = pinoLogger.child({ service: 'benchmark' });

import winston from 'winston';

const winstonLogger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [new winston.transports.Stream({ stream: nullStream })]
});
const winstonChild = winstonLogger.child({ service: 'benchmark' });

import bunyan from 'bunyan';

const bunyanLogger = bunyan.createLogger({
  name: 'benchmark',
  level: 'info',
  streams: [{ stream: nullStream }]
});
const bunyanChild = bunyanLogger.child({ service: 'benchmark' });

import log4js from 'log4js';

log4js.configure({
  appenders: {
    null: {
      type: {
        configure: () => () => {}
      }
    }
  },
  categories: { default: { appenders: ['null'], level: 'info' } }
});
const log4jsLogger = log4js.getLogger();

import loglevel from 'loglevel';

const loglevelLogger = loglevel.getLogger('benchmark');
loglevelLogger.setLevel('info');
const originalFactory = loglevelLogger.methodFactory;
loglevelLogger.methodFactory = function(_methodName, _logLevel, _loggerName) {
  return function() {};
};
loglevelLogger.setLevel(loglevelLogger.getLevel());

interface BenchResult {
  name: string;
  ops: number;
  totalMs: number;
  opsPerSec: number;
  nsPerOp: number;
}

const DEFAULT_BENCH_DURATION_MS = Number(process.env.ZARIO_BENCH_DURATION_MS ?? 2500);
const DEFAULT_MIN_ITERATIONS = Number(process.env.ZARIO_BENCH_MIN_ITERATIONS ?? 500000);

function benchmark(
  name: string,
  fn: () => void,
  minIterations: number = DEFAULT_MIN_ITERATIONS,
  durationMs: number = DEFAULT_BENCH_DURATION_MS,
): BenchResult {
  runForDuration(fn, resolveWarmupMs(durationMs));

  let totalIterations = 0;
  let totalMs = 0;
  while (totalIterations < minIterations || totalMs < durationMs) {
    const result = runForDuration(fn, durationMs);
    totalIterations += result.iterations;
    totalMs += result.totalMs;
  }

  const opsPerSec = Math.round((totalIterations / totalMs) * 1000);
  const nsPerOp = Math.round((totalMs / totalIterations) * 1_000_000);
  
  return { name, ops: totalIterations, totalMs, opsPerSec, nsPerOp };
}

function formatNumber(n: number): string {
  return n.toLocaleString();
}

function printResults(title: string, results: BenchResult[]) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(title);
  console.log('='.repeat(70));
  
  const sorted = [...results].sort((a, b) => b.opsPerSec - a.opsPerSec);
  const fastest = sorted[0].opsPerSec;
  
  console.log(
    'Library'.padEnd(15) +
    'ops/sec'.padStart(15) +
    'ns/op'.padStart(12) +
    'relative'.padStart(12)
  );
  console.log('-'.repeat(54));
  
  for (const r of sorted) {
    const relative = (r.opsPerSec / fastest * 100).toFixed(1) + '%';
    const medal = r === sorted[0] ? ' 🏆' : '';
    console.log(
      r.name.padEnd(15) +
      formatNumber(r.opsPerSec).padStart(15) +
      formatNumber(r.nsPerOp).padStart(12) +
      relative.padStart(12) +
      medal
    );
  }
}

function runSuite(title: string, cases: BenchCase[], minIterations?: number) {
  const randomized = shuffleCases(cases);
  const results: BenchResult[] = [];
  for (const lib of randomized) {
    results.push(benchmark(lib.name, lib.fn, minIterations));
  }
  printResults(title, results);
}

console.log(`
╔════════════════════════════════════════════════════════════════════╗
║        ZARIO vs POPULAR LOGGING LIBRARIES - BENCHMARK              ║
╠════════════════════════════════════════════════════════════════════╣
║  Libraries: Zario, Pino, Winston, Bunyan, Log4js, Loglevel         ║
║  Output: in-process null stream/no-op sink (no I/O)                ║
╚════════════════════════════════════════════════════════════════════╝
`);

{
  runSuite('Simple Message: logger.info("Hello world")', [
    { name: 'Zario', fn: () => zarioLogger.info('Hello world') },
    { name: 'Pino', fn: () => pinoLogger.info('Hello world') },
    { name: 'Winston', fn: () => winstonLogger.info('Hello world') },
    { name: 'Bunyan', fn: () => bunyanLogger.info('Hello world') },
    { name: 'Log4js', fn: () => log4jsLogger.info('Hello world') },
    { name: 'Loglevel', fn: () => loglevelLogger.info('Hello world') },
  ]);
}

{
  const meta = { user: 'john', action: 'login', ip: '192.168.1.1' };
  runSuite('With Metadata: logger.info("msg", { user, action, ip })', [
    { name: 'Zario', fn: () => zarioLogger.info('User logged in', meta) },
    { name: 'Pino', fn: () => pinoLogger.info(meta, 'User logged in') },
    { name: 'Winston', fn: () => winstonLogger.info('User logged in', meta) },
    { name: 'Bunyan', fn: () => bunyanLogger.info(meta, 'User logged in') },
    { name: 'Log4js', fn: () => log4jsLogger.info('User logged in', meta) },
    { name: 'Loglevel', fn: () => loglevelLogger.info('User logged in', meta) },
  ]);
}

{
  runSuite('Child Logger: child.info("Request handled")', [
    { name: 'Zario', fn: () => zarioChild.info('Request handled') },
    { name: 'Pino', fn: () => pinoChild.info('Request handled') },
    { name: 'Winston', fn: () => winstonChild.info('Request handled') },
    { name: 'Bunyan', fn: () => bunyanChild.info('Request handled') },
  ]);
}

{
  runSuite('Filtered Logs: logger.debug() when level=info (early exit)', [
    { name: 'Zario', fn: () => zarioLogger.debug('Debug message') },
    { name: 'Pino', fn: () => pinoLogger.debug('Debug message') },
    { name: 'Winston', fn: () => winstonLogger.debug('Debug message') },
    { name: 'Bunyan', fn: () => bunyanLogger.debug('Debug message') },
    { name: 'Log4js', fn: () => log4jsLogger.debug('Debug message') },
    { name: 'Loglevel', fn: () => loglevelLogger.debug('Debug message') },
  ]);
}

{
  const deepMeta = {
    request: {
      method: 'POST',
      path: '/api/users',
      headers: { 'content-type': 'application/json', 'authorization': 'Bearer xxx' }
    },
    response: { status: 200, time: 45 },
    user: { id: 12345, name: 'John Doe', roles: ['admin', 'user'] }
  };
  
  runSuite('Deep Metadata: logger.info("msg", { nested object })', [
    { name: 'Zario', fn: () => zarioLogger.info('API request', deepMeta) },
    { name: 'Pino', fn: () => pinoLogger.info(deepMeta, 'API request') },
    { name: 'Winston', fn: () => winstonLogger.info('API request', deepMeta) },
    { name: 'Bunyan', fn: () => bunyanLogger.info(deepMeta, 'API request') },
    { name: 'Log4js', fn: () => log4jsLogger.info('API request', deepMeta) },
    { name: 'Loglevel', fn: () => loglevelLogger.info('API request', deepMeta) },
  ]);
}

{
  const error = new Error('Something went wrong');
  const errorMeta = { error: error.message, stack: error.stack };

  runSuite('Error Logging: logger.error("msg", { error })', [
    { name: 'Zario', fn: () => zarioLogger.error('Operation failed', errorMeta) },
    { name: 'Pino', fn: () => pinoLogger.error(errorMeta, 'Operation failed') },
    { name: 'Winston', fn: () => winstonLogger.error('Operation failed', errorMeta) },
    { name: 'Bunyan', fn: () => bunyanLogger.error(errorMeta, 'Operation failed') },
    { name: 'Log4js', fn: () => log4jsLogger.error('Operation failed', errorMeta) },
    { name: 'Loglevel', fn: () => loglevelLogger.error('Operation failed', errorMeta) },
  ]);
}

{
  console.log(`\n${'='.repeat(70)}`);
  console.log('HIGH-FREQUENCY BURST: 100,000 logs as fast as possible');
  console.log('='.repeat(70));
  
  const burstCount = 100000;
  
  const libs: BenchCase[] = [
    { name: 'Zario', fn: () => zarioLogger.info('Burst log') },
    { name: 'Pino', fn: () => pinoLogger.info('Burst log') },
    { name: 'Winston', fn: () => winstonLogger.info('Burst log') },
    { name: 'Bunyan', fn: () => bunyanLogger.info('Burst log') },
    { name: 'Log4js', fn: () => log4jsLogger.info('Burst log') },
    { name: 'Loglevel', fn: () => loglevelLogger.info('Burst log') },
  ];
  
  const burstResults: { name: string; ms: number }[] = [];
  
  for (const lib of shuffleCases(libs)) {
    runForDuration(lib.fn, 500);
    const start = performance.now();
    for (let i = 0; i < burstCount; i++) {
      lib.fn();
    }
    const ms = performance.now() - start;
    burstResults.push({ name: lib.name, ms });
  }
  
  burstResults.sort((a, b) => a.ms - b.ms);
  const fastestMs = burstResults[0].ms;
  
  console.log(
    'Library'.padEnd(15) +
    'Time (ms)'.padStart(12) +
    'logs/sec'.padStart(15) +
    'relative'.padStart(12)
  );
  console.log('-'.repeat(54));
  
  for (const r of burstResults) {
    const logsPerSec = Math.round(burstCount / r.ms * 1000);
    const relative = (fastestMs / r.ms * 100).toFixed(1) + '%';
    const medal = r === burstResults[0] ? ' 🏆' : '';
    console.log(
      r.name.padEnd(15) +
      r.ms.toFixed(2).padStart(12) +
      formatNumber(logsPerSec).padStart(15) +
      relative.padStart(12) +
      medal
    );
  }
}

console.log(`
╔════════════════════════════════════════════════════════════════════╗
║                         BENCHMARK COMPLETE                          ║
╚════════════════════════════════════════════════════════════════════╝
`);
