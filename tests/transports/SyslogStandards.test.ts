import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as net from 'net';
import * as os from 'os';
import * as path from 'path';
import * as tls from 'tls';
import { SyslogTransport } from '../../src/transports/SyslogTransport';
import type { SyslogTransportOptions } from '../../src/transports/SyslogTransport';
import { Formatter } from '../../src/core/Formatter';
import type { LogData } from '../../src/types';

const plain = new Formatter({ colorize: false, timestamp: false });
const record = (message: string, metadata?: Record<string, unknown>): LogData =>
  ({ level: 'info', message, timestamp: new Date('2026-03-04T05:06:07.890Z'), metadata });
const format = (options: SyslogTransportOptions, data: LogData) =>
  new SyslogTransport({ hostname: 'h', appName: 'api', ...options }).formatMessage(data, plain);

describe('RFC 5424: structured data', () => {
  const sd = (metadata?: Record<string, unknown>) => {
    const text = format({ structuredData: 'app@32473' }, record('msg', metadata));
    return text.slice(text.indexOf(` ${process.pid} - `) + ` ${process.pid} - `.length);
  };

  test('metadata becomes SD-PARAMs, and MSG is the plain message', () => {
    expect(sd({ user: 'ada', count: 3, ok: true })).toBe('[app@32473 user="ada" count="3" ok="true"] msg');
  });

  test('no metadata is the NILVALUE', () => {
    expect(sd()).toBe('- msg');
  });

  test('quote, backslash and bracket are escaped in values', () => {
    expect(sd({ v: 'a"b\\c]d' })).toBe('[app@32473 v="a\\"b\\\\c\\]d"] msg');
  });

  test('a value cannot close the element and add another one', () => {
    expect(sd({ v: '"][evil@1 admin="1' })).toBe('[app@32473 v="\\"\\][evil@1 admin=\\"1"] msg');
  });

  test('names keep only the allowed characters, up to 32', () => {
    expect(sd({ 'a b="]': 1, ['n'.repeat(40)]: 2 })).toBe(`[app@32473 a_b___="1" ${'n'.repeat(32)}="2"] msg`);
  });

  test('objects and errors become JSON', () => {
    expect(sd({ o: { a: 1 } })).toBe('[app@32473 o="{\\"a\\":1}"] msg');
    expect(sd({ err: new Error('boom') })).toContain('boom');
  });

  test.each(['app', 'app@', 'a b@1', 'a=b@1', 'timeQuality', `${'x'.repeat(40)}@1`])('SD-ID %p is refused', (id) => {
    expect(() => new SyslogTransport({ structuredData: id })).toThrow('structuredData');
  });

  test('a hostile message cannot hold control characters', () => {
    // eslint-disable-next-line no-control-regex
    expect(format({ structuredData: 'app@1' }, record('a\x1b[2Jb\nc'))).not.toMatch(/[\x00-\x1f]/);
  });
});

describe('RFC 5424: header', () => {
  test('MSGID is fixed or comes from the record', () => {
    expect(format({ msgId: 'LOGIN' }, record('m'))).toMatch(/ \d+ LOGIN - /);
    expect(format({ msgId: (data) => String(data.metadata?.event) }, record('m', { event: 'PAID' }))).toMatch(/ \d+ PAID - /);
    expect(format({ msgId: 'a b' }, record('m'))).toMatch(/ \d+ a_b - /);
  });

  test('a msgId function that throws gives the NILVALUE', () => {
    expect(format({ msgId: () => { throw new Error('boom'); } }, record('m'))).toMatch(/ \d+ - - /);
  });

  test('the BOM marks UTF-8 when it is on', () => {
    expect(format({ bom: true }, record('é'))).toMatch(/ - - ﻿\[INFO\] é$/);
  });

  test.each([-1, 8, 1.5, NaN])('severity %p is refused', (severity) => {
    expect(() => new SyslogTransport({ severities: { audit: severity } })).toThrow('severity');
  });
});

describe('RFC 3164', () => {
  test('TAG holds no bracket, colon or space, and stays in 32 characters', () => {
    expect(format({ format: 'rfc3164', appName: 'a b:[c]' }, record('m'))).toContain(` a_b__c_[${process.pid}]: `);
  });

  test('a newline does not split the message', () => {
    expect(format({ format: 'rfc3164' }, record('a\nb'))).not.toContain('\n');
  });

  test('the default limit is 1024 bytes', () => {
    expect(new SyslogTransport({ format: 'rfc3164' }).encode(record('x'.repeat(5000)), plain)).toHaveLength(1024);
  });
});

describe('truncation', () => {
  test('does not cut a UTF-8 character in half', () => {
    for (let size = 80; size < 90; size++) {
      const bytes = new SyslogTransport({ hostname: 'h', maxMessageSize: size }).encode(record('é😀'.repeat(50)), plain);
      expect(bytes.length).toBeLessThanOrEqual(size);
      expect(bytes.toString('utf8')).not.toContain('�');
    }
  });

  test('structured data that does not fit is left out, and not cut open', () => {
    const transport = new SyslogTransport({ hostname: 'h', structuredData: 'a@1', maxMessageSize: 100 });
    expect(transport.encode(record('kept', { v: 'x'.repeat(500) }), plain).toString()).toMatch(/ - - kept$/);
  });
});

async function collect(server: net.Server, use: (port: number) => Promise<void>): Promise<string> {
  const chunks: Buffer[] = [];
  const onSocket = (socket: net.Socket) => socket.on('data', (chunk) => chunks.push(chunk)).on('error', () => undefined);
  server.on(server instanceof tls.Server ? 'secureConnection' : 'connection', onSocket);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    await use((server.address() as net.AddressInfo).port);
    for (let i = 0; i < 100 && !chunks.length; i++) await new Promise((r) => setTimeout(r, 10));
    await new Promise((r) => setTimeout(r, 50));
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
  return Buffer.concat(chunks).toString('utf8');
}

describe('RFC 6587: framing over TCP', () => {
  test('octet counting counts bytes, not characters', async () => {
    const text = await collect(net.createServer(), async (port) => {
      const transport = new SyslogTransport({ port, protocol: 'tcp', hostname: 'h' });
      transport.write(record('é'), plain);
      await transport.close();
    });
    const [length, ...rest] = text.split(' ');
    expect(Buffer.byteLength(rest.join(' '))).toBe(Number(length));
  });

  test('newline framing ends each message with LF, and a newline inside is escaped', async () => {
    const text = await collect(net.createServer(), async (port) => {
      const transport = new SyslogTransport({ port, protocol: 'tcp', framing: 'newline', hostname: 'h' });
      transport.write(record('one\n<0>1 forged'), plain);
      transport.write(record('two'), plain);
      await transport.close();
    });
    expect(text.endsWith('\n')).toBe(true);
    const lines = text.trimEnd().split('\n');
    expect(lines).toHaveLength(2);
    for (const line of lines) expect(line).toMatch(/^<14>1 /);
  });
});

let openssl = true;
try { execFileSync('openssl', ['version'], { stdio: 'ignore' }); } catch { openssl = false; }

(openssl ? describe : describe.skip)('RFC 5425: TLS', () => {
  let dir: string;
  let cert: string;
  let key: string;

  beforeAll(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'zario-tls-'));
    execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '2', '-keyout', 'k.pem', '-out', 'c.pem',
      '-subj', '//CN=localhost'.slice(process.platform === 'win32' ? 0 : 1), '-addext', 'subjectAltName=DNS:localhost'],
    { cwd: dir, stdio: 'ignore' });
    cert = fs.readFileSync(path.join(dir, 'c.pem'), 'utf8');
    key = fs.readFileSync(path.join(dir, 'k.pem'), 'utf8');
  });
  afterAll(() => { fs.rmSync(dir, { recursive: true, force: true }); });

  const deliver = async (options: tls.TlsOptions, client: tls.ConnectionOptions) => {
    let failure: unknown;
    const text = await collect(tls.createServer({ cert, key, ...options }).on('tlsClientError', () => undefined), async (port) => {
      const transport = new SyslogTransport({ host: 'localhost', port, protocol: 'tls', hostname: 'h', tls: client });
      transport.write(record('S3CRET'), plain);
      await transport.close().catch((error: unknown) => { failure = error; });
    });
    return { text, failure };
  };

  beforeEach(() => { jest.spyOn(console, 'error').mockImplementation(() => undefined); });
  afterEach(() => { jest.restoreAllMocks(); });

  test('delivers with octet counting to a server it trusts', async () => {
    const { text, failure } = await deliver({}, { ca: cert, family: 4 } as tls.ConnectionOptions);
    expect(failure).toBeUndefined();
    expect(text).toMatch(/^\d+ <14>1 .*S3CRET$/);
  });

  test('sends nothing to a server with an unknown certificate', async () => {
    const { text, failure } = await deliver({}, { family: 4 } as tls.ConnectionOptions);
    expect(failure).toBeDefined();
    expect(text).toBe('');
  });

  test('sends nothing when the certificate is for another name', async () => {
    const { text, failure } = await deliver({}, { ca: cert, servername: 'other.example', family: 4 } as tls.ConnectionOptions);
    expect(failure).toBeDefined();
    expect(text).toBe('');
  });

  test('can send a client certificate', async () => {
    const { text, failure } = await deliver({ requestCert: true, rejectUnauthorized: true, ca: cert }, { ca: cert, cert, key, family: 4 } as tls.ConnectionOptions);
    expect(failure).toBeUndefined();
    expect(text).toContain('S3CRET');
  });

  test('newline framing is refused, because RFC 5425 requires octet counting', () => {
    expect(() => new SyslogTransport({ protocol: 'tls', framing: 'newline' })).toThrow('octet');
  });

  test('the default port is 6514', () => {
    expect(new SyslogTransport({ protocol: 'tls' })['port']).toBe(6514);
    expect(new SyslogTransport()['port']).toBe(514);
  });
});
