import { Logger, LoggerOptions, zario } from '../src/core/Logger';

function capture(options: LoggerOptions = {}) {
  const lines: string[] = [];
  const logger = new Logger({
    async: false, json: true, timestamp: false, colorize: false,
    transports: [{ write(data, formatter) { lines.push(formatter.format(data)); } }],
    ...options,
  });
  return { logger, lines, last: () => JSON.parse(lines[lines.length - 1]!) };
}

describe('text output shows an error as a person reads it', () => {
  test('the stack has real lines, and the cause follows', () => {
    const { logger, lines } = capture({ json: false });
    const error = Object.assign(new Error('connect failed', { cause: new Error('refused') }), { code: 'E1' });
    logger.error('query failed', error);
    const text = lines[0]!;
    // Not '\\n' alone: a Windows path can contain a backslash and an n.
    expect(text).not.toContain('\\n    at');
    expect(text.split('\n')[0]).toBe('[ERROR] query failed');
    expect(text).toMatch(/\n +Error: connect failed\n +at /);
    expect(text).toContain('{"code":"E1"}');
    expect(text).toMatch(/\n +caused by: Error: refused\n +at /);
  });

  test('other fields stay on the first line', () => {
    const { logger, lines } = capture({ json: false });
    logger.error('failed', { id: 7, err: new Error('x') });
    expect(lines[0]!.split('\n')[0]).toBe('[ERROR] failed {"id":7}');
  });

  test('a cause that points back to the error ends', () => {
    const { logger, lines } = capture({ json: false });
    const error = new Error('loop');
    error.cause = error;
    logger.error(error);
    expect(lines).toHaveLength(1);
  });

  test('a redacted stack stays redacted', () => {
    const { logger, lines } = capture({ json: false, redact: ['err.stack', 'err.token'] });
    logger.error('m', Object.assign(new Error('S3CRET'), { token: 'S3CRET' }));
    expect(lines[0]).not.toContain('S3CRET');
  });
});

describe('levels', () => {
  const env = process.env.LOG_LEVEL;
  afterEach(() => { if (env === undefined) delete process.env.LOG_LEVEL; else process.env.LOG_LEVEL = env; });

  test('a misspelled level is an error, not a silent logger', () => {
    expect(() => zario({ level: 'inof' })).toThrow(/Unknown log level "inof"/);
    expect(() => zario().setLevel('inof')).toThrow(/Unknown log level "inof"/);
  });

  test('a custom level is a valid threshold', () => {
    expect(zario({ level: 'audit', customLevels: { audit: 9 } }).isLevelEnabled('audit')).toBe(true);
  });

  test('LOG_LEVEL sets the default, and an option wins over it', () => {
    process.env.LOG_LEVEL = 'DEBUG';
    expect(zario().isLevelEnabled('debug')).toBe(true);
    expect(zario({ level: 'error' }).isLevelEnabled('debug')).toBe(false);
  });

  test('a LOG_LEVEL that is not a level does not stop the app', () => {
    process.env.LOG_LEVEL = 'verbose-please';
    expect(zario().getLevel()).toBe('info');
  });
});

test('redact takes a plain list of paths', () => {
  const { logger, last } = capture({ redact: ['password'] });
  logger.child({}, { redact: ['token'] }).info('m', { password: 'p', token: 't' });
  expect(last()).toMatchObject({ password: '[REDACTED]', token: '[REDACTED]' });
});

test.each([['count', 5, 5], ['a', 'b', 'b'], ['flag', false, false]])(
  'a second argument that is not an object is kept: %p, %p', (message, details, kept) => {
    const { logger, last } = capture();
    logger.info(message, details as never);
    expect(last()).toEqual({ level: 'info', message, details: kept });
  });

describe('timers', () => {
  test('a timer writes the duration as a field', () => {
    const { logger, last } = capture();
    logger.startTimer('db').end({ rows: 3 });
    expect(last()).toMatchObject({ rows: 3, timer: 'db' });
    expect(typeof last().durationMs).toBe('number');
  });

  test('a timer can be disposed', () => {
    const { logger, lines } = capture();
    const timer = logger.startTimer('db');
    timer[Symbol.dispose]();
    timer.end();
    expect(lines).toHaveLength(1);
  });
});

test('a logger closes with "await using"', async () => {
  const { logger } = capture();
  await logger[Symbol.asyncDispose]();
  expect(logger.isClosed()).toBe(true);
});
