// Regression tests for the issues found in the project review.
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { Logger } from '../src/full';
import { Formatter } from '../src/core/Formatter';
import { MemoryQueueProvider } from '../src/core/LogQueue';
import { CircuitBreakerTransport } from '../src/transports/CircuitBreakerTransport';
import { DeadLetterQueue } from '../src/transports/DeadLetterQueue';
import { FileTransport } from '../src/transports/FileTransport';
import { HttpTransport } from '../src/transports/HttpTransport';
import { RetryTransport, CircuitBreakerState } from '../src/transports/RetryTransport';
import { Redactor } from '../src/utils/Redactor';
import { ColorUtil } from '../src/utils/ColorUtil';
import { serialize } from '../src/utils/serialize';
import { DefaultOTelProvider } from '../src/otel/OTelContextProvider';
import type { LogData } from '../src/types';
import type { Transport } from '../src/transports/Transport';

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const logData = (message = 'm'): LogData => ({ level: 'info', message, timestamp: new Date() });

function memoryTransport(): Transport & { messages: string[] } {
  const messages: string[] = [];
  return { messages, write(data) { messages.push(data.message); } };
}

describe('Logger child isolation', () => {
  test('child.addTransport does not add the transport to the parent', async () => {
    const parentOut = memoryTransport();
    const childOut = memoryTransport();
    const parent = new Logger({ transports: [parentOut], async: false });
    const child = parent.child({ requestId: 1 });
    child.addTransport(childOut);

    parent.info('parent-only');
    child.info('child');

    expect(childOut.messages).toEqual(['child']);
    expect(parentOut.messages).toEqual(['parent-only', 'child']);
    await parent.close();
  });

  test('parent.close closes a transport that a child added later', async () => {
    const parent = new Logger({ transports: [memoryTransport()], async: false });
    const child = parent.child({});
    const close = jest.fn();
    child.addTransport({ write() {}, close });
    await parent.close();
    expect(close).toHaveBeenCalledTimes(1);
  });

  test('child.addEnricher does not change the parent', async () => {
    const seen: Array<Record<string, unknown> | undefined> = [];
    const out: Transport = { write(data) { seen.push(data.metadata); } };
    const parent = new Logger({ transports: [out], async: false });
    parent.addEnricher((data) => ({ ...data, metadata: { ...data.metadata, fromParent: true } }));
    const child = parent.child({});
    child.addEnricher((data) => ({ ...data, metadata: { ...data.metadata, fromChild: true } }));

    parent.info('p');
    expect(seen[0]).toEqual({ fromParent: true });
    await parent.close();
  });

  test('child.setAsyncMode(false) keeps the queue that the parent shares', async () => {
    const out = memoryTransport();
    const parent = new Logger({
      transports: [out], async: true, queueOptions: { flushInterval: 20, batchSize: 1000 },
    });
    parent.child({}).setAsyncMode(false);
    parent.info('after');
    await wait(100);
    expect(out.messages).toEqual(['after']);
    await parent.close();
  });
});

describe('Logger transport errors', () => {
  test('a throwing transport does not throw into the caller or skip later transports', async () => {
    const after = memoryTransport();
    const log = new Logger({
      transports: [{ write() { throw new Error('ENOSPC'); } }, after], async: false,
    });
    const errors: unknown[] = [];
    log.on('error', (event) => errors.push(event));

    expect(() => log.info('x')).not.toThrow();
    expect(after.messages).toEqual(['x']);
    expect(errors).toEqual([{ type: 'transport', error: expect.objectContaining({ message: 'ENOSPC' }) }]);
    await log.close();
  });

  test('a transport config object that is not a transport throws', () => {
    expect(() => new Logger({ transports: [{ type: 'console' } as unknown as Transport] }))
      .toThrow(TypeError);
  });

  test('the overflow sync strategy does not throw into the caller', async () => {
    const queue = new MemoryQueueProvider({ maxQueueSize: 0, overflowStrategy: 'sync' });
    const error = jest.spyOn(console, 'error').mockImplementation(() => {});
    try {
      expect(() => queue.enqueue(logData(), new Formatter(), [{ write() { throw new Error('boom'); } }]))
        .not.toThrow();
    } finally {
      error.mockRestore();
      await queue.destroy();
    }
  });
});

describe('Logger.global', () => {
  test('a closed global logger is replaced', async () => {
    const first = Logger.global;
    await first.close();
    expect(Logger.global).not.toBe(first);
    expect(Logger.global.isClosed()).toBe(false);
  });
});

describe('Redaction', () => {
  test('a path under an Error keeps the error message, stack and type', () => {
    const err = Object.assign(new Error('boom'), { config: { auth: 'secret' } });
    const result = new Redactor({ paths: ['err.config'] }).redact({ err });
    const redacted = result.err as Error & { config: unknown };

    expect(redacted).toBeInstanceOf(Error);
    expect(redacted.message).toBe('boom');
    expect(redacted.stack).toBe(err.stack);
    expect(redacted.config).toBe('[REDACTED]');
    expect(err.config).toEqual({ auth: 'secret' });
    expect(JSON.parse(serialize(result)).err.message).toBe('boom');
  });

  test('a path through an array keeps the array', () => {
    const result = new Redactor({ paths: ['users.*.password'] })
      .redact({ users: [{ name: 'a', password: 'x' }] });
    expect(result).toEqual({ users: [{ name: 'a', password: '[REDACTED]' }] });
  });

  test('fields that enrichers add are redacted', async () => {
    const seen: Array<Record<string, unknown> | undefined> = [];
    const log = new Logger({
      transports: [{ write(data) { seen.push(data.metadata); } }],
      async: false,
      redact: { paths: ['authorization'] },
    });
    log.addEnricher((data) => ({ ...data, metadata: { ...data.metadata, authorization: 'Bearer x' } }));
    log.info('request');
    expect(seen[0]).toEqual({ authorization: '[REDACTED]' });
    await log.close();
  });
});

describe('JSON formatter', () => {
  test('metadata cannot overwrite the built-in fields', () => {
    const line = new Formatter({ json: true }).format({
      ...logData('real'),
      metadata: { level: 'fatal', message: 'fake', metadata: 1, user: 'a' },
    });
    expect(line.match(/"level":/g)).toHaveLength(2); // the built-in one, and one nested under "metadata"
    expect(JSON.parse(line)).toEqual({
      level: 'info', message: 'real', user: 'a', metadata: { level: 'fatal', message: 'fake', metadata: 1 },
    });
  });
});

describe('RetryTransport', () => {
  test('a failed half-open probe opens the breaker again', async () => {
    const failing: Transport = { write() { throw Object.assign(new Error('down'), { code: 'ECONNREFUSED' }); } };
    const retry = new RetryTransport({
      wrappedTransport: failing, maxAttempts: 1, circuitBreakerThreshold: 2, circuitBreakerTimeout: 5,
    });
    for (let i = 0; i < 2; i++) await retry.writeAsync(logData(), new Formatter()).catch(() => {});
    expect(retry.getCircuitBreakerState()).toBe(CircuitBreakerState.OPEN);
    await wait(10);
    await retry.writeAsync(logData(), new Formatter()).catch(() => {});
    expect(retry.getCircuitBreakerState()).toBe(CircuitBreakerState.OPEN);
    await expect(retry.writeAsync(logData(), new Formatter())).rejects.toThrow('Circuit breaker is open');
  });

  test('write() drops logs above maxPendingWrites', async () => {
    const retry = new RetryTransport({ wrappedTransport: memoryTransport(), maxPendingWrites: 1 });
    const error = jest.spyOn(console, 'error').mockImplementation(() => {});
    try {
      retry.write(logData('kept'), new Formatter());
      retry.write(logData('dropped'), new Formatter());
      await expect(retry.flush()).rejects.toThrow('dropped a log');
    } finally {
      error.mockRestore();
    }
  });
});

describe('CircuitBreakerTransport', () => {
  test('uses the standard states: closed, open, half-open', async () => {
    let fail = true;
    const onTrip = jest.fn();
    const onReset = jest.fn();
    const breaker = new CircuitBreakerTransport(
      { write() { if (fail) throw new Error('down'); } },
      { threshold: 2, timeout: 5, onTrip, onReset },
    );
    expect(breaker.getMetrics().currentState).toBe('closed');

    for (let i = 0; i < 2; i++) expect(() => breaker.write(logData(), new Formatter())).toThrow('down');
    expect(breaker.getMetrics().currentState).toBe('open');
    expect(onTrip).toHaveBeenCalledWith(2);
    expect(() => breaker.write(logData(), new Formatter())).toThrow('Circuit breaker is open');

    await wait(10);
    expect(() => breaker.write(logData(), new Formatter())).toThrow('down');
    expect(breaker.getMetrics().currentState).toBe('open');

    await wait(10);
    fail = false;
    breaker.write(logData(), new Formatter());
    expect(breaker.getMetrics().currentState).toBe('closed');
    expect(onReset).toHaveBeenCalledTimes(1);
  });
});

describe('HttpTransport', () => {
  test('write() drops logs above maxPendingRequests', async () => {
    const http = new HttpTransport({ url: 'http://127.0.0.1:1/', retries: 0, timeout: 500, maxPendingRequests: 1 });
    const error = jest.spyOn(console, 'error').mockImplementation(() => {});
    try {
      http.write(logData('kept'), new Formatter());
      http.write(logData('dropped'), new Formatter());
      await expect(http.flush()).rejects.toThrow('dropped a log');
    } finally {
      error.mockRestore();
    }
  });
});

describe('DeadLetterQueue', () => {
  test('write() over an async transport records delivery failures, and flush waits for them', async () => {
    const dlq = new DeadLetterQueue({
      transport: { write() {}, writeAsync: () => Promise.reject(Object.assign(new Error('401'), { code: 'EAUTH' })) },
    });
    dlq.write(logData('lost'), new Formatter());
    await dlq.flush();
    expect(dlq.getDeadLetters().map((d) => d.message)).toEqual(['lost']);
  });

  test('keeps at most maxDeadLetters, and drops the oldest', () => {
    const dlq = new DeadLetterQueue({
      transport: { write() { throw Object.assign(new Error('401'), { code: 'EAUTH' }); } },
      maxDeadLetters: 2,
    });
    for (const message of ['a', 'b', 'c']) {
      try { dlq.write(logData(message), new Formatter()); } catch { /* the sync path throws */ }
    }
    expect(dlq.getDeadLetters().map((d) => d.message)).toEqual(['b', 'c']);
  });

  test('close() closes the wrapped transport', async () => {
    const close = jest.fn();
    await new DeadLetterQueue({ transport: { write() {}, close } }).close();
    expect(close).toHaveBeenCalledTimes(1);
  });
});

describe('MemoryQueueProvider', () => {
  test('a destroyed queue with flushInterval still delivers later logs', async () => {
    const out = memoryTransport();
    const queue = new MemoryQueueProvider({ flushInterval: 10, batchSize: 1000 });
    await queue.destroy();
    queue.enqueue(logData('late'), new Formatter(), [out]);
    await wait(50);
    expect(out.messages).toEqual(['late']);
  });

  test('an idle queue with flushInterval has no active timer', async () => {
    const queue = new MemoryQueueProvider({ flushInterval: 10 });
    expect((queue as unknown as { timer: unknown }).timer).toBeNull();
    queue.enqueue(logData(), new Formatter(), [memoryTransport()]);
    await wait(50);
    expect((queue as unknown as { timer: unknown }).timer).toBeNull();
  });
});

describe('FileTransport', () => {
  let dir: string;
  beforeEach(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), 'zario-regression-')); });
  afterEach(() => { fs.rmSync(dir, { recursive: true, force: true }); });

  const allLines = () => fs.readdirSync(dir)
    .flatMap((file) => fs.readFileSync(path.join(dir, file), 'utf8').split('\n'))
    .filter(Boolean);

  test('rotation during concurrent async writes loses no line', async () => {
    const file = new FileTransport({ path: path.join(dir, 'app.log'), maxSize: 200, maxFiles: 100 });
    const formatter = new Formatter({ colorize: false });
    await Promise.all(Array.from({ length: 50 }, (_, i) => file.writeAsync(logData(`line-${i}`), formatter)));
    const lines = allLines();
    for (let i = 0; i < 50; i++) expect(lines.some((line) => line.endsWith(`line-${i}`))).toBe(true);
  });

  test('sync rotation with compression makes a .gz file in the background', async () => {
    const file = new FileTransport({ path: path.join(dir, 'app.log'), maxSize: 50, compression: 'gzip' });
    file.write(logData('x'.repeat(100)), new Formatter({ colorize: false }));
    await file.flush();
    expect(fs.readdirSync(dir).some((name) => name.endsWith('.gz'))).toBe(true);
  });

  test('ANSI color codes do not go into the file', () => {
    const target = path.join(dir, 'app.log');
    const file = new FileTransport({ path: target });
    file.write(logData('plain'), { format: () => '\x1b[32mINFO\x1b[0m plain' } as unknown as Formatter);
    expect(fs.readFileSync(target, 'utf8')).toBe('INFO plain\n');
  });
});

describe('default transports', () => {
  test('production falls back to the console when the log file cannot be created', () => {
    // "logs" is a regular file here, so ./logs/app.log cannot be created.
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'zario-readonly-'));
    fs.writeFileSync(path.join(dir, 'logs'), '');
    const cwd = process.cwd();
    const error = jest.spyOn(console, 'error').mockImplementation(() => {});
    process.chdir(dir);
    try {
      expect(Logger.defaultTransportsFactory!(true)).toHaveLength(1);
      expect(error).toHaveBeenCalled();
    } finally {
      process.chdir(cwd);
      error.mockRestore();
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('small fixes', () => {
  test('fatal has a color', () => {
    const previous = process.env.FORCE_COLOR;
    process.env.FORCE_COLOR = '1';
    try {
      expect(ColorUtil.colorize('FATAL', 'fatal')).toBe('\x1b[35mFATAL\x1b[0m');
    } finally {
      if (previous === undefined) delete process.env.FORCE_COLOR;
      else process.env.FORCE_COLOR = previous;
    }
  });

  test('the OTel provider reads the parent span id from the SDK span', () => {
    const span = {
      spanContext: () => ({ traceId: 't', spanId: 'child' }),
      parentSpanContext: { spanId: 'parent' },
    };
    const provider = new DefaultOTelProvider();
    Object.assign(provider, {
      checked: true,
      otelApi: { trace: { getActiveSpan: () => span }, context: { active: () => ({}) }, propagation: {} },
    });
    expect(provider.getContext()?.parentSpanId).toBe('parent');
  });
});
