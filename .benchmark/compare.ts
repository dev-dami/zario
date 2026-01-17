import { Writable } from 'stream';
import { devNull } from 'os';

const nullStream = new Writable({
  write(_chunk, _encoding, callback) {
    callback();
  }
});

const nullFile = devNull;

import { Logger } from '../src/core/Logger.js';
import { Transport } from '../src/transports/Transport.js';
import { Formatter } from '../src/core/Formatter.js';
import { LogData } from '../src/types/index.js';

class NullTransport implements Transport {
  write(_data: LogData, _formatter: Formatter): void {}
  async writeAsync(_data: LogData, _formatter: Formatter): Promise<void> {}
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

const pinoLogger = pino({ level: 'info' }, pino.destination(nullFile));
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
  appenders: { null: { type: 'file', filename: nullFile } },
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

function benchmark(name: string, fn: () => void, iterations: number = 10000): BenchResult {
  for (let i = 0; i < 1000; i++) fn();
  
  const start = performance.now();
  for (let i = 0; i < iterations; i++) {
    fn();
  }
  const end = performance.now();
  
  const totalMs = end - start;
  const opsPerSec = Math.round((iterations / totalMs) * 1000);
  const nsPerOp = Math.round((totalMs / iterations) * 1_000_000);
  
  return { name, ops: iterations, totalMs, opsPerSec, nsPerOp };
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

console.log(`
╔════════════════════════════════════════════════════════════════════╗
║        ZARIO vs POPULAR LOGGING LIBRARIES - BENCHMARK              ║
╠════════════════════════════════════════════════════════════════════╣
║  Libraries: Zario, Pino, Winston, Bunyan, Log4js, Loglevel         ║
║  Output: /dev/null (pure CPU benchmark, no I/O)                    ║
╚════════════════════════════════════════════════════════════════════╝
`);

{
  const results: BenchResult[] = [
    benchmark('Zario', () => zarioLogger.info('Hello world')),
    benchmark('Pino', () => pinoLogger.info('Hello world')),
    benchmark('Winston', () => winstonLogger.info('Hello world')),
    benchmark('Bunyan', () => bunyanLogger.info('Hello world')),
    benchmark('Log4js', () => log4jsLogger.info('Hello world')),
    benchmark('Loglevel', () => loglevelLogger.info('Hello world')),
  ];
  printResults('Simple Message: logger.info("Hello world")', results);
}

{
  const meta = { user: 'john', action: 'login', ip: '192.168.1.1' };
  const results: BenchResult[] = [
    benchmark('Zario', () => zarioLogger.info('User logged in', meta)),
    benchmark('Pino', () => pinoLogger.info(meta, 'User logged in')),
    benchmark('Winston', () => winstonLogger.info('User logged in', meta)),
    benchmark('Bunyan', () => bunyanLogger.info(meta, 'User logged in')),
    benchmark('Log4js', () => log4jsLogger.info('User logged in', meta)),
    benchmark('Loglevel', () => loglevelLogger.info('User logged in', meta)),
  ];
  printResults('With Metadata: logger.info("msg", { user, action, ip })', results);
}

{
  const results: BenchResult[] = [
    benchmark('Zario', () => zarioChild.info('Request handled')),
    benchmark('Pino', () => pinoChild.info('Request handled')),
    benchmark('Winston', () => winstonChild.info('Request handled')),
    benchmark('Bunyan', () => bunyanChild.info('Request handled')),
  ];
  printResults('Child Logger: child.info("Request handled")', results);
}

{
  const results: BenchResult[] = [
    benchmark('Zario', () => zarioLogger.debug('Debug message'), 100000),
    benchmark('Pino', () => pinoLogger.debug('Debug message'), 100000),
    benchmark('Winston', () => winstonLogger.debug('Debug message'), 100000),
    benchmark('Bunyan', () => bunyanLogger.debug('Debug message'), 100000),
    benchmark('Log4js', () => log4jsLogger.debug('Debug message'), 100000),
    benchmark('Loglevel', () => loglevelLogger.debug('Debug message'), 100000),
  ];
  printResults('Filtered Logs: logger.debug() when level=info (early exit)', results);
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
  
  const results: BenchResult[] = [
    benchmark('Zario', () => zarioLogger.info('API request', deepMeta)),
    benchmark('Pino', () => pinoLogger.info(deepMeta, 'API request')),
    benchmark('Winston', () => winstonLogger.info('API request', deepMeta)),
    benchmark('Bunyan', () => bunyanLogger.info(deepMeta, 'API request')),
    benchmark('Log4js', () => log4jsLogger.info('API request', deepMeta)),
    benchmark('Loglevel', () => loglevelLogger.info('API request', deepMeta)),
  ];
  printResults('Deep Metadata: logger.info("msg", { nested object })', results);
}

{
  const error = new Error('Something went wrong');
  
  const results: BenchResult[] = [
    benchmark('Zario', () => zarioLogger.error('Operation failed', { error: error.message, stack: error.stack })),
    benchmark('Pino', () => pinoLogger.error({ err: error }, 'Operation failed')),
    benchmark('Winston', () => winstonLogger.error('Operation failed', { error })),
    benchmark('Bunyan', () => bunyanLogger.error({ err: error }, 'Operation failed')),
    benchmark('Log4js', () => log4jsLogger.error('Operation failed', error)),
    benchmark('Loglevel', () => loglevelLogger.error('Operation failed', error)),
  ];
  printResults('Error Logging: logger.error("msg", { error })', results);
}

{
  console.log(`\n${'='.repeat(70)}`);
  console.log('HIGH-FREQUENCY BURST: 100,000 logs as fast as possible');
  console.log('='.repeat(70));
  
  const burstCount = 100000;
  
  const libs = [
    { name: 'Zario', fn: () => zarioLogger.info('Burst log') },
    { name: 'Pino', fn: () => pinoLogger.info('Burst log') },
    { name: 'Winston', fn: () => winstonLogger.info('Burst log') },
    { name: 'Bunyan', fn: () => bunyanLogger.info('Burst log') },
    { name: 'Log4js', fn: () => log4jsLogger.info('Burst log') },
    { name: 'Loglevel', fn: () => loglevelLogger.info('Burst log') },
  ];
  
  const burstResults: { name: string; ms: number }[] = [];
  
  for (const lib of libs) {
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
