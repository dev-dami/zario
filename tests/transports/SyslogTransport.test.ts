import * as dgram from 'dgram';
import * as net from 'net';
import { SyslogTransport } from '../../src/transports/SyslogTransport';
import { Logger } from '../../src/core/Logger';
import { Formatter } from '../../src/core/Formatter';
import type { LogData } from '../../src/types';

const plain = new Formatter({ colorize: false, timestamp: false });
const at = new Date('2026-03-04T05:06:07.890Z');
const record = (level: string, message = 'hello'): LogData => ({ level, message, timestamp: at });

describe('SyslogTransport', () => {
  describe('level mapping', () => {
    const transport = new SyslogTransport();

    test.each([
      ['fatal', 2], ['error', 3], ['warn', 4], ['info', 6], ['debug', 7], ['boring', 7], ['custom', 6],
    ])('%s maps to severity %i', (level, severity) => {
      expect(transport.severityOf(level)).toBe(severity);
    });

    test('custom severities override and extend the map', () => {
      const custom = new SyslogTransport({ severities: { audit: 5, info: 5 } });
      expect(custom.severityOf('audit')).toBe(5);
      expect(custom.severityOf('info')).toBe(5);
      expect(custom.severityOf('error')).toBe(3);
    });

    test('an unknown facility throws', () => {
      expect(() => new SyslogTransport({ facility: 'nope' as never })).toThrow('unknown facility');
    });
  });

  describe('payload formatting', () => {
    test('RFC 5424 header with facility, severity and fields', () => {
      const transport = new SyslogTransport({ facility: 'local0', appName: 'api', hostname: 'web-1' });
      expect(transport.formatMessage(record('error'), plain))
        .toBe(`<131>1 2026-03-04T05:06:07.890Z web-1 api ${process.pid} - - [ERROR] hello`);
    });

    test('RFC 3164 header uses local time and a TAG[PID]', () => {
      const transport = new SyslogTransport({ format: 'rfc3164', appName: 'api', hostname: 'web-1' });
      const t = at;
      const time = [t.getHours(), t.getMinutes(), t.getSeconds()].map((n) => String(n).padStart(2, '0')).join(':');
      const month = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][t.getMonth()];
      expect(transport.formatMessage(record('info'), plain))
        .toBe(`<14>${month} ${String(t.getDate()).padStart(2, ' ')} ${time} web-1 api[${process.pid}]: [INFO] hello`);
    });

    test('header fields drop spaces and control characters', () => {
      const transport = new SyslogTransport({ appName: 'my app', hostname: '' });
      expect(transport.formatMessage(record('info'), plain)).toContain(' - my_app ');
    });

    test('JSON formatter output becomes the MSG part, without ANSI colors', () => {
      const transport = new SyslogTransport({ hostname: 'h' });
      const json = new Formatter({ json: true, timestamp: false });
      const colored = { format: () => '\x1b[31mred\x1b[0m' } as unknown as Formatter;
      expect(transport.formatMessage({ ...record('info'), metadata: { a: 1 } }, json))
        .toMatch(/ - - \{"level":"info","message":"hello","a":1\}$/);
      expect(transport.formatMessage(record('info'), colored)).toMatch(/ - - red$/);
    });
  });

  describe('UDP delivery', () => {
    let server: dgram.Socket;
    let port: number;
    let received: string[];

    beforeEach(async () => {
      received = [];
      server = dgram.createSocket('udp4');
      server.on('message', (msg) => received.push(msg.toString('utf8')));
      await new Promise<void>((resolve) => server.bind(0, '127.0.0.1', () => resolve()));
      port = server.address().port;
    });
    afterEach(() => new Promise<void>((resolve) => server.close(() => resolve())));

    const until = async (check: () => boolean) => {
      for (let i = 0; i < 100 && !check(); i++) await new Promise((r) => setTimeout(r, 10));
    };

    test('a logger delivers records to a local UDP socket', async () => {
      const transport = new SyslogTransport({ port, appName: 'api', hostname: 'h' });
      const log = new Logger({ transports: [transport], async: false, colorize: false, timestamp: false });
      log.warn('disk low', { free: 3 });
      await log.flush();
      await until(() => received.length === 1);
      expect(received[0]).toMatch(/^<12>1 \S+ h api \d+ - - \[WARN\] disk low \{"free":3\}$/);
      await log.close();
    });

    test('long messages are cut to maxMessageSize bytes', async () => {
      const transport = new SyslogTransport({ port, maxMessageSize: 40 });
      transport.write(record('info', 'x'.repeat(500)), plain);
      await transport.flush();
      await until(() => received.length === 1);
      expect(Buffer.byteLength(received[0]!)).toBe(40);
      await transport.close();
    });

    test('write() after close() is ignored', async () => {
      const transport = new SyslogTransport({ port });
      await transport.close();
      expect(() => transport.write(record('info'), plain)).not.toThrow();
      await expect(transport.flush()).resolves.toBeUndefined();
    });
  });

  describe('TCP delivery', () => {
    test('uses octet-counting framing', async () => {
      const chunks: Buffer[] = [];
      const server = net.createServer((socket) => socket.on('data', (chunk) => chunks.push(chunk)));
      await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
      const port = (server.address() as net.AddressInfo).port;

      const transport = new SyslogTransport({ port, protocol: 'tcp', hostname: 'h' });
      transport.write(record('info', 'one'), plain);
      transport.write(record('info', 'two'), plain);
      await transport.flush();
      await transport.close();
      for (let i = 0; i < 100 && Buffer.concat(chunks).length === 0; i++) await new Promise((r) => setTimeout(r, 10));
      await new Promise<void>((resolve) => server.close(() => resolve()));

      const stream = Buffer.concat(chunks).toString('utf8');
      const frames: string[] = [];
      for (let rest = stream; rest.length;) {
        const space = rest.indexOf(' ');
        const length = Number(rest.slice(0, space));
        frames.push(rest.slice(space + 1, space + 1 + length));
        rest = rest.slice(space + 1 + length);
      }
      expect(frames).toHaveLength(2);
      expect(frames[0]).toMatch(/\[INFO\] one$/);
      expect(frames[1]).toMatch(/\[INFO\] two$/);
    });

    test('flush() rejects when the server is unreachable', async () => {
      const probe = net.createServer();
      await new Promise<void>((resolve) => probe.listen(0, '127.0.0.1', () => resolve()));
      const port = (probe.address() as net.AddressInfo).port;
      await new Promise<void>((resolve) => probe.close(() => resolve()));

      const error = jest.spyOn(console, 'error').mockImplementation(() => {});
      try {
        const transport = new SyslogTransport({ port, protocol: 'tcp' });
        transport.write(record('info'), plain);
        await expect(transport.flush()).rejects.toThrow();
        await transport.close().catch(() => undefined);
      } finally {
        error.mockRestore();
      }
    });
  });
});
