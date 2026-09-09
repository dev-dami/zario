import { Logger } from '../../src/core/Logger';
import { Formatter } from '../../src/core/Formatter';
import { serialize } from '../../src/utils/serialize';

describe('safe metadata and ergonomic calls', () => {
  const outputs: string[] = [];
  const makeLogger = (json = true) => new Logger({
    async: false, json, colorize: false, timestamp: false,
    transports: [{ write: (data, formatter) => { outputs.push(formatter.format(data)); } }],
  });
  beforeEach(() => { outputs.length = 0; });

  test.each([true, false])('formats circular metadata in json=%s', (json) => {
    const metadata: Record<string, unknown> = { id: 1 };
    metadata.self = metadata;
    makeLogger(json).info('cycle', metadata);
    expect(outputs[0]).toContain('"self":"[Circular]"');
    expect(metadata.self).toBe(metadata);
  });

  test('preserves shared references and handles arrays, BigInt and Error causes', () => {
    const shared = { id: 1 };
    const array: unknown[] = [shared];
    array.push(array);
    const error = new Error('failed') as Error & { cause: unknown };
    error.cause = error;
    const result = JSON.parse(serialize({ a: shared, b: shared, array, count: 42n, error }));
    expect(result.a).toEqual(result.b);
    expect(result.array).toEqual([{ id: 1 }, '[Circular]']);
    expect(result.count).toBe('42');
    expect(result.error).toMatchObject({ name: 'Error', message: 'failed', cause: '[Circular]' });
    expect(result.error.stack).toContain('failed');
  });

  test('supports both argument orders, objects and direct errors', () => {
    const logger = makeLogger();
    logger.info('saved', { id: 1 });
    logger.info({ id: 1 }, 'saved');
    expect(outputs[0]).toBe(outputs[1]);
    logger.info({ id: 2 });
    logger.error(new Error('failed'));
    logger.error('save failed', new Error('database'));
    expect(JSON.parse(outputs[2]!)).toMatchObject({ message: '', id: 2 });
    expect(JSON.parse(outputs[3]!)).toMatchObject({ message: 'failed', err: { message: 'failed' } });
    expect(JSON.parse(outputs[4]!)).toMatchObject({ message: 'save failed', err: { message: 'database' } });
  });

  test('child bindings inherit formatting and allow per-call overrides', () => {
    const parent = makeLogger();
    const child = parent.child({ requestId: 'abc', id: 1 });
    child.info({ id: 2 }, 'saved');
    expect(JSON.parse(outputs[0]!)).toEqual({ level: 'info', message: 'saved', requestId: 'abc', id: 2 });
    parent.info('parent');
    expect(JSON.parse(outputs[1]!)).toEqual({ level: 'info', message: 'parent' });
  });

  test('disabled methods skip input serialization and custom levels accept objects', () => {
    const logger = makeLogger();
    logger.setLevel('error');
    expect(logger.isLevelEnabled('info')).toBe(false);
    expect(logger.isLevelEnabled('silent')).toBe(false);
    logger.info({ toJSON() { throw new Error('must not run'); } });
    expect(outputs).toHaveLength(0);
    logger.logWithLevel('fatal', { id: 3 }, 'failed');
    expect(JSON.parse(outputs[0]!)).toMatchObject({ level: 'fatal', message: 'failed', id: 3 });
  });

  test('prefixed JSON uses safe serialization too', () => {
    const metadata: Record<string, unknown> = {};
    metadata.self = metadata;
    const formatter = new Formatter({ json: true });
    expect(JSON.parse(formatter.format({ level: 'info', message: 'test', timestamp: new Date(), prefix: 'app', metadata }))).toMatchObject({ prefix: 'app', self: '[Circular]' });
  });
});
