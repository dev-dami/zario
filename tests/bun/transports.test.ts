import { describe, expect, test } from 'bun:test';
import { zario, WebSocketTransport, SyslogTransport } from '../../src/full';

describe('Bun network transports', () => {
  test('WebSocketTransport uses the Bun WebSocket with headers', async () => {
    const messages: string[] = [];
    let authorization: string | null = null;
    const server = Bun.serve({
      port: 0,
      fetch(req, srv) {
        authorization = req.headers.get('authorization');
        return srv.upgrade(req) ? undefined : new Response('upgrade required', { status: 426 });
      },
      websocket: { message(_ws, message) { messages.push(String(message)); } },
    });
    try {
      const log = zario({ transports: [new WebSocketTransport({
        url: `ws://127.0.0.1:${server.port}`, headers: { Authorization: 'Bearer t' },
      })] });
      log.info('live', { id: 1 });
      await log.close();
      for (let i = 0; i < 100 && messages.length === 0; i++) await Bun.sleep(10);
      expect(authorization).toBe('Bearer t');
      expect(JSON.parse(messages[0]!)).toMatchObject({ level: 'info', message: 'live', metadata: { id: 1 } });
    } finally {
      server.stop(true);
    }
  });

  test('SyslogTransport delivers over UDP', async () => {
    const received: string[] = [];
    const socket = await Bun.udpSocket({
      hostname: '127.0.0.1',
      socket: { data(_s, data) { received.push(Buffer.from(data).toString('utf8')); } },
    });
    try {
      const log = zario({ colorize: false, timestamp: false, transports: [new SyslogTransport({
        port: socket.port, hostname: 'h', appName: 'bun',
      })] });
      log.error('boom');
      await log.close();
      for (let i = 0; i < 100 && received.length === 0; i++) await Bun.sleep(10);
      expect(received[0]).toMatch(/^<11>1 \S+ h bun \d+ - - \[ERROR\] boom$/);
    } finally {
      socket.close();
    }
  });
});
