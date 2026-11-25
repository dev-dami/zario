import { WebSocketTransport, type WebSocketLike } from '../../src/transports/WebSocketTransport';
import { Logger } from '../../src/core/Logger';
import { Formatter } from '../../src/core/Formatter';
import type { LogData } from '../../src/types';
import { startWebSocketServer, type TestWebSocketServer } from '../webSocketServer';

const formatter = new Formatter();
const record = (message: string, metadata?: Record<string, unknown>): LogData =>
  ({ level: 'info', message, timestamp: new Date('2026-01-02T03:04:05.000Z'), metadata });

async function until(check: () => boolean, ms = 2000): Promise<void> {
  const deadline = Date.now() + ms;
  while (!check()) {
    if (Date.now() > deadline) throw new Error('condition not met in time');
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
}

describe('WebSocketTransport', () => {
  let server: TestWebSocketServer;
  let transport: WebSocketTransport | undefined;

  beforeEach(async () => { server = await startWebSocketServer(); });
  afterEach(async () => {
    await transport?.close().catch(() => undefined);
    transport = undefined;
    await server.close();
  });

  test('sends one JSON record per message, with Zario serialization', async () => {
    transport = new WebSocketTransport({ url: server.url });
    const circular: Record<string, unknown> = { id: 7 };
    circular.self = circular;
    transport.write(record('first', circular), formatter);
    transport.write({ ...record('second'), prefix: '[api]' }, formatter);
    await transport.flush();
    await until(() => server.messages.length === 2);

    expect(JSON.parse(server.messages[0]!)).toEqual({
      level: 'info', message: 'first', timestamp: '2026-01-02T03:04:05.000Z',
      metadata: { id: 7, self: '[Circular]' },
    });
    expect(JSON.parse(server.messages[1]!)).toMatchObject({ message: 'second', prefix: '[api]' });
  });

  test('works as a logger transport and sends headers and protocols', async () => {
    transport = new WebSocketTransport({
      url: server.url, protocols: ['logs.v1'], headers: { Authorization: 'Bearer t' },
    });
    const log = new Logger({ transports: [transport], async: false });
    log.warn('disk low', { free: 3 });
    await log.close();
    transport = undefined;

    expect(server.handshakes[0]!['sec-websocket-protocol']).toBe('logs.v1');
    expect(server.handshakes[0]!.authorization).toBe('Bearer t');
    expect(JSON.parse(server.messages[0]!)).toMatchObject({ level: 'warn', message: 'disk low', metadata: { free: 3 } });
  });

  test('reconnects after the connection drops and sends records queued meanwhile', async () => {
    transport = new WebSocketTransport({ url: server.url, reconnectDelay: 10 });
    transport.write(record('before'), formatter);
    await transport.flush();
    await until(() => server.messages.length === 1);

    server.dropAll();
    await new Promise((resolve) => setTimeout(resolve, 20));
    transport.write(record('after'), formatter);
    await transport.flush();
    await until(() => server.messages.length === 2);

    expect(server.handshakes).toHaveLength(2);
    expect(JSON.parse(server.messages[1]!).message).toBe('after');
  });

  test('keeps at most maxQueueSize records while disconnected, and drops the oldest', async () => {
    const url = server.url;
    await server.close();
    transport = new WebSocketTransport({ url, maxQueueSize: 2, reconnectDelay: 10, flushTimeout: 100 });
    for (const message of ['a', 'b', 'c', 'd', 'e']) transport.write(record(message), formatter);

    expect(transport.getDroppedCount()).toBe(3);
    await expect(transport.flush()).rejects.toThrow('2 records were not delivered');

    server = await startWebSocketServer(); // afterEach closes this one
  });

  test('reconnect delays grow and stop at maxReconnectDelay', async () => {
    const delays: number[] = [];
    const realSetTimeout = global.setTimeout;
    const spy = jest.spyOn(global, 'setTimeout').mockImplementation(((fn: () => void, ms?: number) => {
      if (ms !== undefined && ms <= 40) delays.push(ms);
      return realSetTimeout(fn, ms);
    }) as typeof setTimeout);
    const failingSocket = (): WebSocketLike => {
      const socket: WebSocketLike = {
        readyState: 3, bufferedAmount: 0, send() {}, close() {}, onopen: null, onclose: null, onerror: null,
      };
      queueMicrotask(() => socket.onclose?.({}));
      return socket;
    };
    try {
      transport = new WebSocketTransport({
        url: 'ws://unused', createSocket: failingSocket, reconnectDelay: 10, maxReconnectDelay: 40, flushTimeout: 50,
      });
      transport.write(record('x'), formatter);
      await new Promise((resolve) => realSetTimeout(resolve, 200));
    } finally {
      spy.mockRestore();
    }
    expect(delays.slice(0, 5)).toEqual([10, 20, 40, 40, 40]);
  });

  test('close() stops reconnecting and ignores later writes', async () => {
    let created = 0;
    transport = new WebSocketTransport({
      url: server.url, reconnectDelay: 10,
      createSocket: (url) => { created++; return new (globalThis as unknown as { WebSocket: new (u: string) => WebSocketLike }).WebSocket(url); },
    });
    transport.write(record('one'), formatter);
    await transport.close();
    const afterClose = created;
    server.dropAll();
    transport.write(record('ignored'), formatter);
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(created).toBe(afterClose);
    expect(server.messages.map((m) => JSON.parse(m).message)).toEqual(['one']);
  });

  test('without a global WebSocket it explains how to pass createSocket', async () => {
    const native = (globalThis as { WebSocket?: unknown }).WebSocket;
    const error = jest.spyOn(console, 'error').mockImplementation(() => {});
    delete (globalThis as { WebSocket?: unknown }).WebSocket;
    try {
      transport = new WebSocketTransport({ url: server.url, flushTimeout: 20 });
      expect(() => transport!.write(record('x'), formatter)).not.toThrow();
      expect(error).toHaveBeenCalledWith('WebSocketTransport:', expect.stringContaining('createSocket'));
    } finally {
      (globalThis as { WebSocket?: unknown }).WebSocket = native;
      error.mockRestore();
    }
  });
});
