import { describe, expect, test } from 'bun:test';
import { createRequire } from 'node:module';
import { MemoryQueueProvider, zario } from '../../src/index';
import { zario as lean } from '../../src/logger';

describe('Bun runtime', () => {
  test('full and lean entrypoints support structured fields, errors and cycles', async () => {
    for (const create of [zario, lean]) {
      const output: Record<string, unknown>[] = [];
      const log = create({ json: true, timestamp: false, transports: [{
        write(data, formatter) { output.push(JSON.parse(formatter.format(data))); },
      }] });
      const metadata: Record<string, unknown> = { count: 42n };
      metadata.self = metadata;
      log.info(metadata, 'saved');
      log.child({ requestId: 'abc' }).error(new Error('failed'));
      await log.close();
      expect(output[0]).toEqual({ level: 'info', message: 'saved', count: '42', self: '[Circular]' });
      expect(output[1]).toMatchObject({ requestId: 'abc', err: { message: 'failed', name: 'Error' } });
    }
  });

  test('closing drains an active batch before releasing the transport', async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const events: string[] = [];
    const log = zario({ async: true, queueProvider: new MemoryQueueProvider({ batchSize: 1 }), transports: [{
      write() {},
      async writeBatch(batch) { await gate; events.push(...batch.map((entry) => entry.message)); },
      close() { events.push('closed'); },
    }] });
    log.info('first');
    log.info('second');
    const closing = log.close();
    expect(events).toEqual([]);
    release();
    await closing;
    expect(events).toEqual(['first', 'second', 'closed']);
  });

  test('redaction and disabled levels work on Bun', async () => {
    const output: string[] = [];
    const log = zario({ json: true, redact: { paths: ['password'] }, transports: [{
      write(data, formatter) { output.push(formatter.format(data)); },
    }] });
    log.info('login', { password: 'secret' });
    expect(output[0]).toContain('[REDACTED]');
    expect(output[0]).not.toContain('secret');
    log.setLevel('silent');
    expect(log.getLevel()).toBe('silent');
    log.error('ignored');
    expect(output).toHaveLength(1);
    await log.close();
  });

  test('Bun install keeps Chalk and ANSI packages compatible', () => {
    const rootRequire = createRequire(import.meta.url);
    const eslintRequire = createRequire(rootRequire.resolve('eslint/package.json'));
    const chalkRequire = createRequire(eslintRequire.resolve('chalk'));
    const ansiManifest = chalkRequire('ansi-styles/package.json');
    expect(ansiManifest.version).toMatch(/^4\./);
    expect(ansiManifest.type).not.toBe('module');
    const chalk = eslintRequire('chalk');
    const colored = new chalk.Instance({ level: 3 }).rgb(10, 20, 30)('working');
    expect(colored).toContain('\u001b[');
    expect(colored).toContain('working');
  });
});
