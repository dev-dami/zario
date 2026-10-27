import { serialize } from "../utils/serialize.js";
import { Transport } from "./Transport.js";
import { LogData } from "../types/index.js";
import { Formatter } from "../core/Formatter.js";

/** The part of the WHATWG WebSocket API that the transport uses. Bun, Node 22+ and `ws` provide it. */
export interface WebSocketLike {
  readonly readyState: number;
  readonly bufferedAmount: number;
  send(data: string): void;
  close(code?: number, reason?: string): void;
  onopen: ((event: unknown) => void) | null;
  onclose: ((event: unknown) => void) | null;
  onerror: ((event: unknown) => void) | null;
}

export interface WebSocketTransportOptions {
  url: string;
  /** Subprotocols for the handshake. */
  protocols?: string | string[];
  /** Handshake headers. Bun and Node 22+ support them. For `ws`, use `createSocket`. */
  headers?: Record<string, string>;
  /** Make the socket. Default: the global `WebSocket`. On Node 20, pass `(url) => new WebSocket(url)` from the `ws` package. */
  createSocket?: (url: string) => WebSocketLike;
  /** Records kept while disconnected. The oldest is dropped first. Default: `1000` */
  maxQueueSize?: number;
  /** First reconnect delay (ms). It doubles after each failed attempt. Default: `500` */
  reconnectDelay?: number;
  /** Maximum reconnect delay (ms). Default: `30000` */
  maxReconnectDelay?: number;
  /** Maximum time (ms) that flush() waits for delivery. Default: `5000` */
  flushTimeout?: number;
}

const OPEN = 1;

export class WebSocketTransport implements Transport {
  private readonly url: string;
  private readonly createSocket: (url: string) => WebSocketLike;
  private readonly maxQueueSize: number;
  private readonly reconnectDelay: number;
  private readonly maxReconnectDelay: number;
  private readonly flushTimeout: number;
  private socket: WebSocketLike | undefined;
  private queue: string[] = [];
  private attempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | undefined;
  private closed = false;
  private dropped = 0;

  constructor(options: WebSocketTransportOptions) {
    const {
      url,
      protocols,
      headers,
      createSocket,
      maxQueueSize = 1000,
      reconnectDelay = 500,
      maxReconnectDelay = 30000,
      flushTimeout = 5000,
    } = options;
    if (!url) throw new Error("WebSocketTransport requires a url option");

    this.url = url;
    this.maxQueueSize = maxQueueSize;
    this.reconnectDelay = reconnectDelay;
    this.maxReconnectDelay = maxReconnectDelay;
    this.flushTimeout = flushTimeout;
    this.createSocket = createSocket ?? ((target) => {
      const NativeWebSocket = (globalThis as { WebSocket?: new (url: string, init?: unknown) => WebSocketLike }).WebSocket;
      if (!NativeWebSocket) {
        throw new Error(
          "WebSocketTransport: this runtime has no global WebSocket (Node 20). " +
          "Pass createSocket, for example with the ws package: createSocket: (url) => new WebSocket(url).",
        );
      }
      // Bun and Node (undici) accept an init object with headers and protocols.
      return headers ? new NativeWebSocket(target, { headers, protocols }) : new NativeWebSocket(target, protocols);
    });
  }

  write(data: LogData, _formatter: Formatter): void {
    if (this.closed) return;
    const record: Record<string, unknown> = {
      level: data.level,
      message: data.message,
      timestamp: data.timestamp.toISOString(),
    };
    if (data.prefix) record.prefix = data.prefix;
    if (data.metadata) record.metadata = data.metadata;
    this.enqueue(serialize(record));
  }

  async writeAsync(data: LogData, formatter: Formatter): Promise<void> {
    this.write(data, formatter);
  }

  /** Records dropped because the queue was full while disconnected. */
  getDroppedCount(): number {
    return this.dropped;
  }

  /** Wait until queued records are sent, or reject after flushTimeout. */
  async flush(): Promise<void> {
    const deadline = Date.now() + this.flushTimeout;
    while (this.queue.length > 0 || (this.socket?.readyState === OPEN && this.socket.bufferedAmount > 0)) {
      if (this.closed && this.socket?.readyState !== OPEN) break;
      if (Date.now() >= deadline) {
        throw new Error(`WebSocketTransport: ${this.queue.length} records were not delivered within ${this.flushTimeout}ms`);
      }
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    if (this.queue.length > 0) {
      throw new Error(`WebSocketTransport: ${this.queue.length} records were not delivered before close`);
    }
  }

  /** Send what can be sent, stop reconnecting, and close the socket. */
  async close(): Promise<void> {
    if (this.closed) return;
    try {
      await this.flush();
    } finally {
      this.closed = true;
      if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
      const socket = this.socket;
      this.socket = undefined;
      if (socket && socket.readyState <= OPEN) {
        await new Promise<void>((resolve) => {
          const done = setTimeout(resolve, 1000);
          socket.onclose = () => { clearTimeout(done); resolve(); };
          socket.close(1000, "logger closed");
        });
      }
    }
  }

  private enqueue(payload: string): void {
    this.queue.push(payload);
    if (this.queue.length > this.maxQueueSize) {
      this.queue.shift();
      this.dropped++;
    }
    if (this.socket?.readyState === OPEN) this.drain();
    else if (!this.socket && !this.reconnectTimer) this.connect();
  }

  private connect(): void {
    if (this.closed) return;
    let socket: WebSocketLike;
    try {
      socket = this.createSocket(this.url);
    } catch (error) {
      if (this.attempts === 0) console.error("WebSocketTransport:", error instanceof Error ? error.message : error);
      this.scheduleReconnect();
      return;
    }
    this.socket = socket;
    socket.onopen = () => {
      this.attempts = 0;
      this.drain();
    };
    // A close follows an error, so reconnect only on close.
    socket.onerror = () => undefined;
    socket.onclose = () => {
      if (this.socket !== socket) return;
      this.socket = undefined;
      this.scheduleReconnect();
    };
  }

  private drain(): void {
    const socket = this.socket;
    while (socket?.readyState === OPEN && this.queue.length > 0) {
      try {
        socket.send(this.queue[0]!);
      } catch {
        // The socket is closing. Keep the record for the next connection.
        return;
      }
      this.queue.shift();
    }
  }

  private scheduleReconnect(): void {
    if (this.closed || this.reconnectTimer) return;
    // Capped exponential backoff: 500, 1000, 2000 ... maxReconnectDelay.
    const delay = Math.min(this.maxReconnectDelay, this.reconnectDelay * 2 ** this.attempts);
    this.attempts++;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = undefined;
      // Reconnect only when there is something to send. The next write connects otherwise.
      if (this.queue.length > 0) this.connect();
    }, delay);
    // Waiting to reconnect must not keep the process alive.
    this.reconnectTimer.unref?.();
  }
}
