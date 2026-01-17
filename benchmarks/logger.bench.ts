import { Logger } from '../src/core/Logger.js';
import { ConsoleTransport } from '../src/transports/ConsoleTransport.js';
import { Formatter } from '../src/core/Formatter.js';
import { LogData } from '../src/types/index.js';

class NullTransport {
  write(data: LogData, formatter: Formatter): void {}
  async writeAsync(data: LogData, formatter: Formatter): Promise<void> {}
}

const ITERATIONS = 10000;

function benchmark(name: string, fn: () => void, iterations: number = ITERATIONS): void {
  const start = process.hrtime.bigint();
  for (let i = 0; i < iterations; i++) {
    fn();
  }
  const end = process.hrtime.bigint();
  const totalMs = Number(end - start) / 1_000_000;
  const perOpNs = Number(end - start) / iterations;
  const opsPerSec = Math.round(iterations / (totalMs / 1000));
  
  console.log(`${name}:`);
  console.log(`  Total: ${totalMs.toFixed(2)}ms for ${iterations} ops`);
  console.log(`  Per op: ${perOpNs.toFixed(0)}ns`);
  console.log(`  Throughput: ${opsPerSec.toLocaleString()} ops/sec`);
  console.log();
}

async function benchmarkAsync(name: string, fn: () => Promise<void>, iterations: number = ITERATIONS): Promise<void> {
  const start = process.hrtime.bigint();
  for (let i = 0; i < iterations; i++) {
    await fn();
  }
  const end = process.hrtime.bigint();
  const totalMs = Number(end - start) / 1_000_000;
  const perOpNs = Number(end - start) / iterations;
  const opsPerSec = Math.round(iterations / (totalMs / 1000));
  
  console.log(`${name}:`);
  console.log(`  Total: ${totalMs.toFixed(2)}ms for ${iterations} ops`);
  console.log(`  Per op: ${perOpNs.toFixed(0)}ns`);
  console.log(`  Throughput: ${opsPerSec.toLocaleString()} ops/sec`);
  console.log();
}

async function runBenchmarks() {
  console.log('='.repeat(60));
  console.log('Zario Performance Benchmarks');
  console.log('='.repeat(60));
  console.log();

  const nullTransport = new NullTransport();
  
  const syncLogger = new Logger({
    level: 'debug',
    asyncMode: false,
    transports: [nullTransport],
    timestamp: true,
  });

  const asyncLogger = new Logger({
    level: 'debug',
    asyncMode: true,
    transports: [nullTransport],
    timestamp: true,
  });

  const filteredLogger = new Logger({
    level: 'error',
    asyncMode: false,
    transports: [nullTransport],
  });

  const jsonLogger = new Logger({
    level: 'debug',
    asyncMode: false,
    transports: [nullTransport],
    json: true,
    timestamp: true,
  });

  console.log('--- Sync Logging ---');
  console.log();

  benchmark('Simple message (sync)', () => {
    syncLogger.info('Hello world');
  });

  benchmark('Message with metadata (sync)', () => {
    syncLogger.info('Request received', { userId: 123, path: '/api/users' });
  });

  benchmark('Message with deep metadata (sync)', () => {
    syncLogger.info('Complex log', {
      user: { id: 123, name: 'John', email: 'john@example.com' },
      request: { method: 'GET', path: '/api', headers: { 'content-type': 'application/json' } },
      timestamp: Date.now(),
    });
  });

  console.log('--- Filtered Logs (Early Exit) ---');
  console.log();

  benchmark('Filtered debug log (level=error)', () => {
    filteredLogger.debug('This should be filtered');
  }, 100000);

  benchmark('Filtered info log (level=error)', () => {
    filteredLogger.info('This should be filtered');
  }, 100000);

  console.log('--- JSON Formatting ---');
  console.log();

  benchmark('Simple JSON log', () => {
    jsonLogger.info('Hello world');
  });

  benchmark('JSON log with metadata', () => {
    jsonLogger.info('Request', { userId: 123, path: '/api' });
  });

  console.log('--- Async Logging ---');
  console.log();

  await benchmarkAsync('Simple message (async)', async () => {
    asyncLogger.info('Hello world');
  });

  await benchmarkAsync('Message with metadata (async)', async () => {
    asyncLogger.info('Request received', { userId: 123, path: '/api/users' });
  });

  console.log('--- Formatter Direct ---');
  console.log();

  const formatter = new Formatter({ json: false, timestamp: true, colorize: false });
  const jsonFormatter = new Formatter({ json: true, timestamp: true });
  
  const sampleData: LogData = {
    level: 'info',
    message: 'Test message',
    timestamp: new Date(),
    prefix: '[App]',
    metadata: { key: 'value' },
  };

  const simpleData: LogData = {
    level: 'info',
    message: 'Test message',
    timestamp: new Date(),
  };

  benchmark('Format text (with metadata)', () => {
    formatter.format(sampleData);
  });

  benchmark('Format text (simple)', () => {
    formatter.format(simpleData);
  });

  benchmark('Format JSON (with metadata)', () => {
    jsonFormatter.format(sampleData);
  });

  benchmark('Format JSON (simple - fast path)', () => {
    jsonFormatter.format(simpleData);
  });

  console.log('--- Child Logger ---');
  console.log();

  const childLogger = syncLogger.createChild({ prefix: '[Child]' });

  benchmark('Child logger simple message', () => {
    childLogger.info('Child log');
  });

  benchmark('Child logger with metadata', () => {
    childLogger.info('Child log', { extra: 'data' });
  });

  console.log('='.repeat(60));
  console.log('Benchmarks complete!');
  console.log('='.repeat(60));
}

runBenchmarks().catch(console.error);
