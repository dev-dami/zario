import { randomBytes } from 'crypto';
import * as fs from 'fs';
import * as http from 'http';
import type { AddressInfo } from 'net';
import * as os from 'os';
import * as path from 'path';
import { Logger, LoggerOptions } from '../src/core/Logger';
import { Redactor } from '../src/utils/Redactor';
import { FieldEncryptor, decryptField } from '../src/utils/FieldEncryptor';
import { serialize } from '../src/utils/serialize';
import { FileTransport } from '../src/transports/FileTransport';
import { HttpTransport } from '../src/transports/HttpTransport';
import { LogEnrichmentPipeline } from '../src/structured/StructuredExtensions';

const SECRET = 'S3CRET';

function capture(options: LoggerOptions = {}) {
  const lines: string[] = [];
  const logger = new Logger({
    async: false, json: true, timestamp: false, colorize: false,
    transports: [{ write(data, formatter) { lines.push(formatter.format(data)); } }],
    ...options,
  });
  return { logger, lines, last: () => JSON.parse(lines[lines.length - 1]!) };
}

beforeEach(() => { jest.spyOn(console, 'error').mockImplementation(() => undefined); });
afterEach(() => { jest.restoreAllMocks(); });

describe('redaction finds a secret wherever the output would show it', () => {
  const redact = { paths: ['password', 'user.token'] };

  test.each<[string, () => Record<string, unknown>]>([
    ['nested toJSON', () => ({ user: { toJSON: () => ({ token: SECRET }) } })],
    ['toJSON of the metadata', () => ({ toJSON: () => ({ password: SECRET }) })],
    ['cycle to the root', () => { const m: Record<string, unknown> = { password: SECRET }; m.self = m; return m; }],
    ['cycle through a parent', () => {
      const user: Record<string, unknown> = { token: SECRET };
      const m = { user };
      user.parent = m;
      return m;
    }],
    ['different letter case', () => ({ Password: SECRET, USER: { Token: SECRET } })],
    ['key with a literal dot', () => ({ 'user.token': SECRET })],
    ['null prototype', () => Object.assign(Object.create(null), { password: SECRET })],
  ])('%s', (_name, metadata) => {
    const { logger, lines } = capture({ redact });
    logger.info('m', metadata());
    expect(lines).toHaveLength(1);
    expect(lines[0]).not.toContain(SECRET);
  });

  test('a ** segment matches at any depth, in arrays and in error causes', () => {
    const { logger, lines } = capture({ redact: { paths: ['**.password'] } });
    const cause = Object.assign(new Error('c'), { password: SECRET });
    logger.error('m', { password: SECRET, a: [{ b: { password: SECRET } }], err: new Error('e', { cause }) });
    expect(lines[0]).not.toContain(SECRET);
    expect(lines[0]!.match(/\[REDACTED\]/g)).toHaveLength(3);
  });

  test('a child adds its paths to the paths of the parent', () => {
    const { logger, lines } = capture({ redact: { paths: ['password'] } });
    logger.child({}, { redact: { paths: ['token'] } }).info('m', { password: SECRET, token: SECRET });
    expect(lines[0]).not.toContain(SECRET);
  });

  test('a child encryptor does not turn off the encryptor of the parent', () => {
    const key = randomBytes(32);
    const { logger, lines } = capture({ encryptor: new FieldEncryptor({ paths: ['email'], key }) });
    logger.child({}, { encryptor: new FieldEncryptor({ paths: ['phone'], key }) }).info('m', { email: SECRET, phone: SECRET });
    expect(lines[0]).not.toContain(SECRET);
  });

  test('two paths that match one field encrypt it once', () => {
    const key = randomBytes(32);
    const value = new FieldEncryptor({ paths: ['**.email', 'user.email'], key }).encrypt({ user: { email: 'e' } });
    expect(decryptField((value.user as { email: string }).email, key)).toBe('e');
  });

  test('a path through __proto__ does not change Object.prototype', () => {
    const result = new Redactor({ paths: ['__proto__.x', 'constructor.prototype.x'] })
      .redact(JSON.parse('{"__proto__":{"x":1}}'));
    expect(JSON.stringify(result)).toBe('{"__proto__":{"x":"[REDACTED]"}}');
    expect(({} as { x?: unknown }).x).toBeUndefined();
  });

  test('a failed redaction drops the metadata instead of the protection', () => {
    const encryptor = new FieldEncryptor({ paths: ['x'], key: randomBytes(32) });
    encryptor.encrypt = () => { throw new Error('broken'); };
    const { logger, lines } = capture({ encryptor });
    expect(() => logger.info('m', { x: SECRET })).not.toThrow();
    expect(lines).toHaveLength(1);
    expect(lines[0]).not.toContain(SECRET);
  });
});

describe('a log call never throws and never loses the record', () => {
  const boom = () => { throw new Error('boom'); };
  const revoked = () => { const p = Proxy.revocable({}, {}); p.revoke(); return p.proxy; };
  const deep = (n: number) => { let o: Record<string, unknown> = { end: 1 }; for (let i = 0; i < n; i++) o = { o }; return o; };

  test.each<[string, () => unknown]>([
    ['throwing getter', () => ({ ok: 1, get x() { return boom(); } })],
    ['nested throwing getter', () => ({ a: { get x() { return boom(); } } })],
    ['throwing toJSON', () => ({ x: { toJSON: boom } })],
    ['hostile proxy', () => new Proxy({}, { ownKeys: boom })],
    ['nested hostile proxy', () => ({ x: new Proxy({}, { ownKeys: boom }) })],
    ['hostile getPrototypeOf', () => ({ x: new Proxy({}, { getPrototypeOf: boom }) })],
    ['revoked proxy', revoked],
    ['nested revoked proxy', () => ({ x: revoked() })],
    ['100,000 levels', () => deep(1e5)],
    ['error with a throwing message', () => Object.defineProperty(new Error('x'), 'message', { get: boom })],
    ['error with a throwing stack', () => Object.defineProperty(new Error('x'), 'stack', { get: boom })],
    ['symbol value', () => ({ x: Symbol('s') })],
  ])('%s', (_name, make) => {
    for (const options of [{}, { json: false }, { redact: { paths: ['a.x', 'x.y'] } }, { context: { id: 1 } }]) {
      const { logger, lines } = capture(options);
      expect(() => logger.info('kept', make() as Record<string, unknown>)).not.toThrow();
      expect(() => logger.error(make() as Record<string, unknown>)).not.toThrow();
      expect(lines).toHaveLength(2);
      expect(lines[0]).toContain('kept');
    }
  });

  test('a value that cannot be read does not hide its siblings', () => {
    const { logger, last } = capture();
    logger.info('m', { ok: 1, get x() { return boom(); } });
    expect(last()).toEqual({ level: 'info', message: 'm', ok: 1, x: '[Unserializable]' });
  });

  test('a hostile value does not move a secret out of its redaction path', () => {
    const { logger, lines } = capture({ redact: { paths: ['password', 'err.token'] }, context: { id: 1 } });
    logger.info('m', { password: SECRET, get x() { return boom(); } });
    logger.error(Object.defineProperty(Object.assign(new Error('e'), { token: SECRET }), 'message', { get: boom }));
    expect(lines).toHaveLength(2);
    expect(lines.join()).not.toContain(SECRET);
  });

  test('a filter that throws lets the record through', () => {
    const { logger, lines } = capture({ filters: [{ shouldEmit: boom }] });
    expect(() => logger.info('m')).not.toThrow();
    expect(lines).toHaveLength(1);
  });

  test('an error listener that throws does not stop the other transports', () => {
    const { logger, lines } = capture();
    const bad = { write: boom };
    logger.getTransports().unshift(bad);
    logger.on('error', boom);
    expect(() => logger.info('m')).not.toThrow();
    expect(lines).toHaveLength(1);
  });

  test('an enricher that returns nothing keeps the record', () => {
    const { logger, lines } = capture({ enrichers: new LogEnrichmentPipeline([() => undefined as never]) });
    expect(() => logger.info('m')).not.toThrow();
    expect(lines).toHaveLength(1);
  });

  test('a dense cyclic graph is cut off in bounded time', () => {
    const nodes = Array.from({ length: 14 }, (_, i): Record<string, unknown> => ({ i }));
    for (const node of nodes) node.all = nodes;
    const start = Date.now();
    expect(() => JSON.parse(serialize({ nodes }))).not.toThrow();
    expect(Date.now() - start).toBeLessThan(5000);
  });
});

describe('a record cannot forge another record or field', () => {
  test('text: a newline does not start a new line at the first column', () => {
    const { logger, lines } = capture({ json: false, prefix: 'a\nb' });
    logger.info('x\n[ERROR] forged\r[ERROR] forged');
    const [first, ...rest] = lines[0]!.split(/[\r\n]/);
    expect(first).toBeDefined();
    for (const line of rest) expect(line).toMatch(/^ /);
  });

  test('text: terminal control sequences are escaped', () => {
    const { logger, lines } = capture({ json: false });
    logger.info('\x1b[2J\x1b]0;pwn\x07', { a: '\x9b2J' });
    // eslint-disable-next-line no-control-regex
    expect(lines[0]).not.toMatch(/[\x00-\x08\x0b-\x1f\x7f-\x9f]/);
  });

  test('text: color codes stay when color is on', () => {
    const { logger, lines } = capture({ json: false, colorize: true });
    logger.info('\x1b[32mgreen\x1b[0m');
    expect(lines[0]).toContain('\x1b[32mgreen\x1b[0m');
  });

  test('json: a custom level name cannot add a field', () => {
    const level = 'a","admin":"1';
    const { logger, last } = capture({ customLevels: { [level]: 9 } });
    logger.logWithLevel(level as never, 'm');
    expect(last()).toEqual({ level, message: 'm' });
  });

  test.each<[string, unknown, unknown]>([
    ['array', [1, 2], [1, 2]],
    ['toJSON that returns a string', { a: 1, toJSON: () => 'str' }, 'str'],
    ['toJSON that returns a level', { a: 1, toJSON: () => ({ level: 'fatal' }) }, { level: 'fatal' }],
  ])('json: metadata as %s stays valid and under "metadata"', (_name, metadata, expected) => {
    const { logger, last } = capture();
    logger.info('m', metadata as Record<string, unknown>);
    expect(last()).toEqual({ level: 'info', message: 'm', metadata: expected });
  });
});

describe('FileTransport', () => {
  let dir: string;
  let file: string;
  beforeEach(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), 'zario-safety-')); file = path.join(dir, 'app.log'); });
  afterEach(() => { fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5 }); });

  test('sync writes and async batches through rotation lose no line', async () => {
    const transport = new FileTransport({ path: file, maxSize: 400, maxFiles: 1000, compression: 'gzip', compressOldFiles: false });
    const logger = new Logger({ async: false, json: true, timestamp: false, transports: [transport] });
    const formatter = logger['formatter'];
    const record = (n: number) => ({ level: 'info' as const, message: `é${n}`, timestamp: new Date() });
    const pending: Promise<void>[] = [];
    for (let n = 0; n < 200; n += 2) {
      pending.push(transport.writeBatch([record(n)], formatter));
      transport.write(record(n + 1), formatter);
      if (n % 20 === 0) await new Promise((resolve) => setImmediate(resolve));
    }
    await Promise.all(pending);
    await logger.close();
    const messages = fs.readdirSync(dir)
      .flatMap((name) => fs.readFileSync(path.join(dir, name), 'utf8').split('\n').filter(Boolean))
      .map((line) => JSON.parse(line).message);
    expect(new Set(messages).size).toBe(200);
    expect(messages).toHaveLength(200);
  });

  test('a file that another program renamed is created again', async () => {
    const transport = new FileTransport({ path: file });
    const logger = new Logger({ async: false, json: true, transports: [transport] });
    logger.info('first');
    fs.renameSync(file, file + '.1');
    await new Promise((resolve) => setTimeout(resolve, 1200));
    logger.info('second');
    expect(fs.readFileSync(file, 'utf8')).toContain('second');
    await logger.close();
  });

  test('close releases the file', async () => {
    const transport = new FileTransport({ path: file });
    const logger = new Logger({ async: false, transports: [transport] });
    logger.info('x');
    await logger.close();
    expect(transport['fd']).toBeUndefined();
  });

  (process.platform === 'win32' ? test.skip : test)('other users cannot read a new log file', () => {
    new FileTransport({ path: file });
    expect(fs.statSync(file).mode & 0o007).toBe(0);
  });
});

describe('HttpTransport', () => {
  test('a server that sends its reply forever does not hold the request past the timeout', async () => {
    const server = http.createServer((_req, res) => {
      res.writeHead(200);
      const drip = setInterval(() => res.write('.'), 20);
      res.on('close', () => clearInterval(drip));
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const url = 'http://127.0.0.1:' + (server.address() as AddressInfo).port;
    const transport = new HttpTransport({ url, timeout: 200, retries: 0 });
    const start = Date.now();
    // Without the deadline the server ends the request, so that a failure does not hang the run.
    const cleanup = setTimeout(() => server.closeAllConnections(), 2500);
    try {
      await expect(transport.writeAsync({ level: 'info', message: 'm', timestamp: new Date() }, capture().logger['formatter']))
        .rejects.toThrow('Request timeout');
      expect(Date.now() - start).toBeLessThan(2000);
    } finally {
      clearTimeout(cleanup);
      server.closeAllConnections();
      await new Promise((resolve) => server.close(resolve));
    }
  }, 4000);
});
