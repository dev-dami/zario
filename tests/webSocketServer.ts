// A minimal in-process WebSocket server (RFC 6455) for tests. It accepts text and close
// frames from clients, so the tests need no WebSocket package and no external service.
import * as crypto from 'crypto';
import * as http from 'http';
import type { Socket } from 'net';

export interface TestWebSocketServer {
  url: string;
  messages: string[];
  handshakes: http.IncomingHttpHeaders[];
  /** Cut every open connection without a close frame. */
  dropAll(): void;
  close(): Promise<void>;
}

const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

export async function startWebSocketServer(): Promise<TestWebSocketServer> {
  const sockets = new Set<Socket>();
  const messages: string[] = [];
  const handshakes: http.IncomingHttpHeaders[] = [];
  const server = http.createServer((_req, res) => { res.writeHead(426); res.end(); });

  server.on('upgrade', (req: http.IncomingMessage, socket: Socket) => {
    const accept = crypto.createHash('sha1').update(`${req.headers['sec-websocket-key']}${GUID}`).digest('base64');
    const lines = ['HTTP/1.1 101 Switching Protocols', 'Upgrade: websocket', 'Connection: Upgrade', `Sec-WebSocket-Accept: ${accept}`];
    const protocol = req.headers['sec-websocket-protocol'];
    if (protocol) lines.push(`Sec-WebSocket-Protocol: ${protocol.split(',')[0]!.trim()}`);
    socket.write(`${lines.join('\r\n')}\r\n\r\n`);
    handshakes.push(req.headers);
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
    socket.on('error', () => undefined);

    let buffer = Buffer.alloc(0);
    socket.on('data', (chunk: Buffer) => {
      buffer = Buffer.concat([buffer, chunk]);
      while (buffer.length >= 2) {
        const opcode = buffer[0]! & 0x0f;
        const masked = (buffer[1]! & 0x80) !== 0;
        let length = buffer[1]! & 0x7f;
        let offset = 2;
        if (length === 126) {
          if (buffer.length < 4) return;
          length = buffer.readUInt16BE(2);
          offset = 4;
        } else if (length === 127) {
          if (buffer.length < 10) return;
          length = Number(buffer.readBigUInt64BE(2));
          offset = 10;
        }
        const maskStart = offset;
        if (masked) offset += 4;
        if (buffer.length < offset + length) return;
        const payload = Buffer.from(buffer.subarray(offset, offset + length));
        if (masked) for (let i = 0; i < payload.length; i++) payload[i]! ^= buffer[maskStart + (i % 4)]!;
        buffer = buffer.subarray(offset + length);
        if (opcode === 0x1) messages.push(payload.toString('utf8'));
        if (opcode === 0x8) {
          socket.write(Buffer.from([0x88, 0x00]));
          socket.end();
        }
      }
    });
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const { port } = server.address() as { port: number };
  return {
    url: `ws://127.0.0.1:${port}`,
    messages,
    handshakes,
    dropAll: () => { for (const socket of sockets) socket.destroy(); },
    close: () => new Promise<void>((resolve) => {
      for (const socket of sockets) socket.destroy();
      server.close(() => resolve());
    }),
  };
}
