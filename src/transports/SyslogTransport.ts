import { Transport } from "./Transport.js";
import { LogData } from "../types/index.js";
import { Formatter } from "../core/Formatter.js";
import * as dgram from "dgram";
import * as net from "net";
import * as os from "os";

export type SyslogProtocol = "udp" | "tcp";
export type SyslogFormat = "rfc5424" | "rfc3164";
export type SyslogFacility =
  | "kern" | "user" | "mail" | "daemon" | "auth" | "syslog" | "lpr" | "news"
  | "uucp" | "cron" | "authpriv" | "ftp"
  | "local0" | "local1" | "local2" | "local3" | "local4" | "local5" | "local6" | "local7";

export interface SyslogTransportOptions {
  /** Syslog server host. Default: `"127.0.0.1"` */
  host?: string;
  /** Syslog server port. Default: `514` */
  port?: number;
  /** `"udp"` (default) or `"tcp"`. TCP uses octet-counting framing (RFC 6587). */
  protocol?: SyslogProtocol;
  /** Default: `"user"` */
  facility?: SyslogFacility;
  /** APP-NAME (RFC 5424) or TAG (RFC 3164). Default: `"zario"` */
  appName?: string;
  /** HOSTNAME field. Default: `os.hostname()` */
  hostname?: string;
  /** Message format. Default: `"rfc5424"` */
  format?: SyslogFormat;
  /** Override or extend the level-to-severity map, for example `{ audit: 5 }`. */
  severities?: Record<string, number>;
  /** Messages longer than this many bytes are cut. Default: `8192` */
  maxMessageSize?: number;
  /** Maximum sends from write() that can wait at one time. Later logs are dropped. Default: `1000` */
  maxPendingWrites?: number;
}

const FACILITIES: Record<SyslogFacility, number> = {
  kern: 0, user: 1, mail: 2, daemon: 3, auth: 4, syslog: 5, lpr: 6, news: 7,
  uucp: 8, cron: 9, authpriv: 10, ftp: 11,
  local0: 16, local1: 17, local2: 18, local3: 19, local4: 20, local5: 21, local6: 22, local7: 23,
};

/** Syslog severities: 0 emerg, 1 alert, 2 crit, 3 err, 4 warning, 5 notice, 6 info, 7 debug. */
export const SYSLOG_SEVERITIES: Readonly<Record<string, number>> = {
  fatal: 2,
  error: 3,
  warn: 4,
  info: 6,
  debug: 7,
  boring: 7,
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// eslint-disable-next-line no-control-regex
const ANSI_COLOR_PATTERN = /\x1b\[[0-9;]*m/g;

// RFC 5424 header fields are printable US-ASCII without spaces, with a length limit.
function headerField(value: string, maxLength: number): string {
  const clean = value.replace(/[^\x21-\x7e]/g, "_").slice(0, maxLength);
  return clean || "-";
}

export class SyslogTransport implements Transport {
  private readonly host: string;
  private readonly port: number;
  private readonly protocol: SyslogProtocol;
  private readonly facility: number;
  private readonly appName: string;
  private readonly hostname: string;
  private readonly format: SyslogFormat;
  private readonly severities: Record<string, number>;
  private readonly maxMessageSize: number;
  private readonly maxPendingWrites: number;
  private readonly pending = new Set<Promise<void>>();
  private failure: { error: unknown } | undefined;
  private udpSocket: dgram.Socket | undefined;
  private tcpSocket: net.Socket | undefined;
  private closed = false;

  constructor(options: SyslogTransportOptions = {}) {
    const {
      host = "127.0.0.1",
      port = 514,
      protocol = "udp",
      facility = "user",
      appName = "zario",
      hostname = os.hostname(),
      format = "rfc5424",
      severities = {},
      maxMessageSize = 8192,
      maxPendingWrites = 1000,
    } = options;

    if (!(facility in FACILITIES)) {
      throw new Error(`SyslogTransport: unknown facility "${facility}"`);
    }
    this.host = host;
    this.port = port;
    this.protocol = protocol;
    this.facility = FACILITIES[facility];
    this.appName = appName;
    this.hostname = hostname;
    this.format = format;
    this.severities = { ...SYSLOG_SEVERITIES, ...severities };
    this.maxMessageSize = maxMessageSize;
    this.maxPendingWrites = maxPendingWrites;
  }

  /** The syslog severity for a Zario level. Unknown levels map to info (6). */
  severityOf(level: string): number {
    return this.severities[level] ?? 6;
  }

  /** Build the syslog message for one record. The formatter makes the MSG part. */
  formatMessage(data: LogData, formatter: Formatter): string {
    const pri = this.facility * 8 + this.severityOf(data.level);
    const msg = formatter.format(data).replace(ANSI_COLOR_PATTERN, "");
    if (this.format === "rfc3164") {
      const t = data.timestamp;
      const day = String(t.getDate()).padStart(2, " ");
      const time = [t.getHours(), t.getMinutes(), t.getSeconds()]
        .map((part) => String(part).padStart(2, "0")).join(":");
      const tag = headerField(this.appName, 32);
      return `<${pri}>${MONTHS[t.getMonth()]} ${day} ${time} ${headerField(this.hostname, 255)} ${tag}[${process.pid}]: ${msg}`;
    }
    return `<${pri}>1 ${data.timestamp.toISOString()} ${headerField(this.hostname, 255)} ` +
      `${headerField(this.appName, 48)} ${process.pid} - - ${msg}`;
  }

  write(data: LogData, formatter: Formatter): void {
    if (this.closed) return;
    // A slow or unreachable server must not make memory grow without a limit.
    if (this.pending.size >= this.maxPendingWrites) {
      if (this.failure === undefined) {
        const error = new Error(`SyslogTransport dropped a log: ${this.pending.size} sends are pending`);
        this.failure = { error };
        console.error(error.message);
      }
      return;
    }

    let payload = Buffer.from(this.formatMessage(data, formatter), "utf8");
    if (payload.length > this.maxMessageSize) payload = payload.subarray(0, this.maxMessageSize);

    const task = this.send(payload)
      .catch((error: unknown) => {
        this.failure ??= { error };
        console.error("SyslogTransport error:", error instanceof Error ? error.message : String(error));
      })
      .finally(() => {
        this.pending.delete(task);
        // Keep the process alive only while sends are in flight.
        if (this.pending.size === 0) this.udpSocket?.unref();
        if (this.pending.size === 0) this.tcpSocket?.unref();
      });
    this.pending.add(task);
  }

  async writeAsync(data: LogData, formatter: Formatter): Promise<void> {
    let payload = Buffer.from(this.formatMessage(data, formatter), "utf8");
    if (payload.length > this.maxMessageSize) payload = payload.subarray(0, this.maxMessageSize);
    await this.send(payload);
  }

  /** Await pending sends and surface delivery failures to the caller. */
  async flush(): Promise<void> {
    while (this.pending.size) await Promise.all(this.pending);
    if (this.failure) {
      const { error } = this.failure;
      this.failure = undefined;
      throw error;
    }
  }

  async close(): Promise<void> {
    if (this.closed) return;
    try {
      await this.flush();
    } finally {
      this.closed = true;
      const udp = this.udpSocket;
      const tcp = this.tcpSocket;
      this.udpSocket = undefined;
      this.tcpSocket = undefined;
      if (udp) await new Promise<void>((resolve) => udp.close(() => resolve()));
      if (tcp) await new Promise<void>((resolve) => tcp.end(() => resolve()));
    }
  }

  private send(payload: Buffer): Promise<void> {
    return this.protocol === "tcp" ? this.sendTcp(payload) : this.sendUdp(payload);
  }

  private sendUdp(payload: Buffer): Promise<void> {
    if (!this.udpSocket) {
      this.udpSocket = dgram.createSocket(net.isIPv6(this.host) ? "udp6" : "udp4");
      // A send error is reported through the send callback. Without a listener the
      // socket would throw it as an uncaught "error" event.
      this.udpSocket.on("error", () => undefined);
    }
    const socket = this.udpSocket;
    socket.ref();
    return new Promise((resolve, reject) => {
      socket.send(payload, this.port, this.host, (error) => (error ? reject(error) : resolve()));
    });
  }

  private sendTcp(payload: Buffer): Promise<void> {
    if (!this.tcpSocket || this.tcpSocket.destroyed) {
      const socket = net.createConnection({ host: this.host, port: this.port });
      // A dead connection is replaced on the next write.
      socket.on("error", () => socket.destroy());
      this.tcpSocket = socket;
    }
    const socket = this.tcpSocket;
    socket.ref();
    // Octet counting (RFC 6587): "<length> <message>".
    const frame = Buffer.concat([Buffer.from(`${payload.length} `), payload]);
    return new Promise((resolve, reject) => {
      const onError = (error: Error) => reject(error);
      socket.once("error", onError);
      socket.write(frame, (error) => {
        socket.off("error", onError);
        if (error) reject(error);
        else resolve();
      });
    });
  }
}
