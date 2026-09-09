import { zario } from '../../src/index';
import { zario as leanZario } from '../../src/logger';
import { MemoryQueueProvider } from '../../src/core/LogQueue';
import { Formatter } from '../../src/core/Formatter';
import { BatchAggregator } from '../../src/aggregation/LogAggregator';
import { HttpTransport } from '../../src/transports/HttpTransport';
import { RetryTransport } from '../../src/transports/RetryTransport';
import type { Transport } from '../../src/transports/Transport';

function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
}

describe('factory and shutdown', () => {
  test('silent disables standard and custom levels and can be reversed', async () => {
    const write = jest.fn();
    const log = zario({ level: 'silent', transports: [{ write }] });
    log.info('ignored');
    log.logWithLevel('custom', 'ignored');
    expect(log.isLevelEnabled('fatal')).toBe(false);
    expect(write).not.toHaveBeenCalled();
    log.setLevel('info');
    log.info('accepted');
    expect(write).toHaveBeenCalledTimes(1);
    await log.close();
  });

  test('full and lean factories enable info and only use console in production', async () => {
    const previous = process.env.NODE_ENV;
    const output = jest.spyOn(console, 'log').mockImplementation(() => {});
    process.env.NODE_ENV = 'production';
    try {
      for (const create of [zario, leanZario]) {
        const log = create({ timestamp: false });
        expect(log.getTransports()).toHaveLength(1);
        log.info('ready');
        expect(JSON.parse(output.mock.calls.at(-1)![0])).toEqual({ level: 'info', message: 'ready' });
        await log.close();
      }
    } finally {
      if (previous === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = previous;
      output.mockRestore();
    }
  });

  test('flush waits for an active batch and logs queued during it', async () => {
    const gate = deferred();
    const writes: string[] = [];
    const queue = new MemoryQueueProvider({ batchSize: 1 });
    const log = zario({ async: true, queueProvider: queue, transports: [{
      write() {},
      async writeBatch(batch) { await gate.promise; writes.push(...batch.map((item) => item.message)); },
    }] });
    log.info('first');
    log.info('second');
    let finished = false;
    const flushing = log.flush().then(() => { finished = true; });
    await Promise.resolve();
    expect(finished).toBe(false);
    gate.resolve();
    await flushing;
    expect(writes).toEqual(['first', 'second']);
    await log.close();
  });

  test('a shared queue preserves each logger formatter and transport', async () => {
    const queue = new MemoryQueueProvider({ flushInterval: 10000 });
    const parentOutput: string[] = [];
    const childOutput: string[] = [];
    const log = zario({ async: true, queueProvider: queue, json: true, timestamp: false,
      transports: [{ write(data, formatter) { parentOutput.push(formatter.format(data)); } }],
    });
    const child = log.child({ requestId: '123' }, { json: false, colorize: false,
      transports: [{ write(data, formatter) { childOutput.push(formatter.format(data)); } }],
    });
    log.info('parent');
    child.info('child');
    await log.close();
    expect(parentOutput).toEqual(['{"level":"info","message":"parent"}']);
    expect(childOutput).toEqual(['[INFO] child {"requestId":"123"}']);
  });

  test('child close leaves inherited resources usable; root close is idempotent', async () => {
    const write = jest.fn();
    const close = jest.fn();
    const log = zario({ transports: [{ write, close }] });
    const child = log.child({ scope: 'child' });
    await child.close();
    expect(close).not.toHaveBeenCalled();
    child.info('ignored');
    log.info('accepted');
    expect(write).toHaveBeenCalledTimes(1);
    const closing = log.close();
    expect(log.close()).toBe(closing);
    await closing;
    log.info('ignored');
    expect(log.isLevelEnabled('info')).toBe(false);
    expect(close).toHaveBeenCalledTimes(1);
    expect(write).toHaveBeenCalledTimes(1);
  });

  test('queue failures reject flush while other destinations still receive logs', async () => {
    const queue = new MemoryQueueProvider({ flushInterval: 10000 });
    const write = jest.fn();
    const close = jest.fn();
    const log = zario({ async: true, queueProvider: queue, transports: [
      { write() { throw new Error('disk full'); }, close }, { write },
    ] });
    log.info('must attempt both');
    await expect(log.flush()).rejects.toThrow('disk full');
    expect(write).toHaveBeenCalledTimes(1);
    await log.close();
    expect(close).toHaveBeenCalledTimes(1);
  });

  test('close releases every resource even when a flush hook rejects', async () => {
    const close = jest.fn();
    const otherClose = jest.fn();
    const log = zario({ transports: [
      { write() {}, flush() { throw new Error('delivery failed'); }, close },
      { write() {}, close: otherClose },
    ] });
    await expect(log.close()).rejects.toThrow('delivery failed');
    expect(close).toHaveBeenCalledTimes(1);
    expect(otherClose).toHaveBeenCalledTimes(1);
  });

  test('root close cleans up a resource-owning grandchild through a shared child', async () => {
    const inheritedClose = jest.fn();
    const ownedClose = jest.fn();
    const root = zario({ transports: [{ write() {}, close: inheritedClose }] });
    const child = root.child({ requestId: '123' });
    const grandchild = child.child({ scope: 'audit' }, {
      transports: [{ write() {}, close: ownedClose }],
    });
    await root.close();
    expect(ownedClose).toHaveBeenCalledTimes(1);
    expect(inheritedClose).toHaveBeenCalledTimes(1);
    expect(grandchild.isClosed()).toBe(true);
    expect(() => root.child({})).toThrow('closed logger');
  });

  test.each([false, true])('HTTP flush waits for background requests (forced async=%s)', async (forceAsync) => {
    const gate = deferred();
    const transport = new HttpTransport({ url: 'http://localhost:9999', forceAsync });
    const internals = transport as unknown as { sendHttpRequestWithRetry: () => Promise<void> };
    const request = jest.spyOn(internals, 'sendHttpRequestWithRetry').mockImplementation(() => gate.promise);
    const log = zario({ transports: [transport] });
    log.info('delivery');
    let finished = false;
    const closing = log.close().then(() => { finished = true; });
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(request).toHaveBeenCalledTimes(1);
    expect(finished).toBe(false);
    gate.resolve();
    await closing;
    expect(finished).toBe(true);
  });

  test('retry background failures do not emit an unhandled error and reject flush', async () => {
    const output = jest.spyOn(console, 'error').mockImplementation(() => {});
    const transport = new RetryTransport({ wrappedTransport: { write() { throw new Error('broken'); } }, maxAttempts: 1 });
    try {
      transport.write({ level: 'info', message: 'test', timestamp: new Date() }, new Formatter());
      await expect(transport.flush()).rejects.toThrow('broken');
    } finally { output.mockRestore(); }
  });

  test('flush drains aggregator records that arrive during an active callback', async () => {
    const gate = deferred();
    const messages: string[] = [];
    const aggregator = new BatchAggregator(1, async (batch) => {
      await gate.promise;
      messages.push(...batch.map((entry) => entry.logData.message));
    });
    const transport: Transport = { write() {} };
    const log = zario({ aggregators: [aggregator], transports: [transport] });
    log.info('first');
    log.info('second');
    const closing = log.close();
    gate.resolve();
    await closing;
    expect(messages).toEqual(['first', 'second']);
  });
});
