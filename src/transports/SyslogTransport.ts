import { Transport } from "./Transport.js";
import { LogData } from "../types/index.js";
import { Formatter } from "../core/Formatter.js";
import * as dgram from "dgram";
import * as net from "net";
import * as os from "os";
import * as tls from "tls";
import { serialize, toPlain } from "../utils/serialize.js";

export type SyslogProtocol = "udp" | "tcp" | "tls";
export type SyslogFraming = "octet-counting" | "newline";
export type SyslogFormat = "rfc5424" | "rfc3164";
export type SyslogFacility =
  | "kern" | "user" | "mail" | "daemon" | "auth" | "syslog" | "lpr" | "news"
  | "uucp" | "cron" | "authpriv" | "ftp"
  | "local0" | "local1" | "local2" | "local3" | "local4" | "local5" | "local6" | "local7";

export interface SyslogTransportOptions {
  /** Syslog server host. Default: `"127.0.0.1"` */
  host?: string;
  /** Syslog server port. Default: `514`, or `6514` for TLS */
  port?: number;
  /** `"udp"` (RFC 5426, default), `"tcp"` (RFC 6587) or `"tls"` (RFC 5425). */
  protocol?: SyslogProtocol;
  /** How TCP separates messages (RFC 6587). Default: `"octet-counting"`. TLS always uses it. */
  framing?: SyslogFraming;
  /** TLS options, for example `ca`, or `cert` and `key` for a client certificate. The server certificate is checked. */
  tls?: tls.ConnectionOptions;
  /**
   * Send metadata as RFC 5424 structured data under this SD-ID, and the plain message as MSG.
   * The SD-ID is `name@number`, where the number is your IANA private enterprise number.
   */
  structuredData?: string;
  /** RFC 5424 MSGID, the type of the message. Default: none */
  msgId?: string | ((data: LogData) => string);
  /** Start MSG with the UTF-8 byte order mark, as RFC 5424 asks for UTF-8. Many receivers do not expect it. Default: `false` */
  bom?: boolean;
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
  /** Messages longer than this many bytes are cut. Default: `8192`, or `1024` for RFC 3164 */
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

// SD-ID and PARAM-NAME allow printable US-ASCII without "=", "]", the quote and space.
const SD_ID = /^[^\s="\]@\x7f-\uffff]+@\d+(\.\d+)*$/;

function structuredElement(id: string, metadata: unknown): string {
  const plain = toPlain(metadata);
  if (plain === null || typeof plain !== "object") return "-";
  let params = "";
  for (const [key, value] of Object.entries(plain)) {
    const name = key.replace(/[^\x21-\x7e]|[="\]]/g, "_").slice(0, 32);
    const text = typeof value === "string" ? value : serialize(value);
    if (name) params += ` ${name}="${escapeControls(text).replace(/["\\\]]/g, "\\$&")}"`;
  }
  return params ? `[${id}${params}]` : "-";
}

// A message is one line: some receivers split at a newline, and a terminal runs an escape sequence.
function escapeControls(text: string): string {
  // eslint-disable-next-line no-control-regex
  return text.replace(/[\x00-\x08\n-\x1f\x7f]/g, (char) =>
    char === "\n" ? "\\n" : char === "\r" ? "\\r" : "\\x" + char.charCodeAt(0).toString(16).padStart(2, "0"));
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
  private readonly framing: SyslogFraming;
  private readonly tlsOptions: tls.ConnectionOptions;
  private readonly structuredData: string | undefined;
  private readonly msgId: SyslogTransportOptions["msgId"];
  private readonly bom: boolean;
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
      protocol = "udp",
      port = protocol === "tls" ? 6514 : 514,
      framing = "octet-counting",
      structuredData,
      facility = "user",
      appName = "zario",
      hostname = os.hostname(),
      format = "rfc5424",
      severities = {},
      maxMessageSize = format === "rfc3164" ? 1024 : 8192,
      maxPendingWrites = 1000,
    } = options;

    if (!(facility in FACILITIES)) {
      throw new Error(`SyslogTransport: unknown facility "${facility}"`);
    }
    if (protocol === "tls" && framing !== "octet-counting") {
      throw new Error("SyslogTransport: TLS requires octet-counting framing (RFC 5425)");
    }
    if (structuredData !== undefined && (!SD_ID.test(structuredData) || structuredData.length > 32)) {
      throw new Error('SyslogTransport: structuredData must be an SD-ID such as "myapp@12345", up to 32 characters');
    }
    if (structuredData !== undefined && format === "rfc3164") {
      throw new Error("SyslogTransport: RFC 3164 has no structuredData");
    }
    for (const [level, severity] of Object.entries(severities)) {
      if (!Number.isInteger(severity) || severity < 0 || severity > 7) {
        throw new Error(`SyslogTransport: the severity of "${level}" must be an integer from 0 to 7`);
      }
    }
    this.framing = framing;
    this.tlsOptions = options.tls ?? {};
    this.structuredData = structuredData;
    this.msgId = options.msgId;
    this.bom = options.bom ?? false;
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

  /** Build the syslog message for one record. The formatter makes the MSG part, unless structuredData is set. */
  formatMessage(data: LogData, formatter: Formatter): string {
    return this.build(data, formatter, this.structuredData);
  }

  private build(data: LogData, formatter: Formatter, sdId: string | undefined): string {
    const pri = this.facility * 8 + this.severityOf(data.level);
    if (this.format === "rfc3164") {
      const t = data.timestamp;
      const day = String(t.getDate()).padStart(2, " ");
      const time = [t.getHours(), t.getMinutes(), t.getSeconds()]
        .map((part) => String(part).padStart(2, "0")).join(":");
      const tag = headerField(this.appName, 32).replace(/[[\]:]/g, "_");
      return `<${pri}>${MONTHS[t.getMonth()]} ${day} ${time} ${headerField(this.hostname, 255)} ${tag}[${process.pid}]: ${this.msg(data, formatter)}`;
    }
    const sd = sdId === undefined || !data.metadata ? "-" : structuredElement(sdId, data.metadata);
    return `<${pri}>1 ${data.timestamp.toISOString()} ${headerField(this.hostname, 255)} ` +
      `${headerField(this.appName, 48)} ${process.pid} ${this.messageId(data)} ${sd} ${this.bom ? "\ufeff" : ""}${this.msg(data, formatter)}`;
  }

  private msg(data: LogData, formatter: Formatter): string {
    const text = this.structuredData === undefined
      ? formatter.format(data).replace(ANSI_COLOR_PATTERN, "")
      : (data.prefix ? data.prefix + " " : "") + data.message;
    return escapeControls(text);
  }

  private messageId(data: LogData): string {
    try {
      const id = typeof this.msgId === "function" ? this.msgId(data) : this.msgId;
      return id ? headerField(String(id), 32) : "-";
    } catch {
      return "-";
    }
  }

  /** The bytes of one message, at most maxMessageSize. */
  encode(data: LogData, formatter: Formatter): Buffer {
    const max = this.maxMessageSize;
    let bytes = Buffer.from(this.formatMessage(data, formatter), "utf8");
    if (bytes.length <= max) return bytes;
    // A cut inside structured data would make the whole message invalid, so leave the data out.
    if (this.structuredData !== undefined) bytes = Buffer.from(this.build(data, formatter, undefined), "utf8");
    let end = Math.min(max, bytes.length);
    // Do not cut a UTF-8 character: step back over its continuation bytes.
    while (end > 0 && end < bytes.length && (bytes[end]! & 0xc0) === 0x80) end--;
    return bytes.subarray(0, end);
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

    const payload = this.encode(data, formatter);

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
    const payload = this.encode(data, formatter);
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
    return this.protocol === "udp" ? this.sendUdp(payload) : this.sendStream(payload);
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

  private sendStream(payload: Buffer): Promise<void> {
    if (!this.tcpSocket || this.tcpSocket.destroyed) {
      const target = { host: this.host, port: this.port };
      const socket = this.protocol === "tls"
        ? tls.connect({ ...(net.isIP(this.host) ? {} : { servername: this.host }), minVersion: "TLSv1.2", ...this.tlsOptions, ...target })
        : net.createConnection(target);
      // Each waiting write listens for an error. maxPendingWrites limits them.
      socket.setMaxListeners(0);
      // A dead connection is replaced on the next write.
      socket.on("error", () => socket.destroy());
      this.tcpSocket = socket;
    }
    const socket = this.tcpSocket;
    socket.ref();
    // Octet counting is "<length> <message>". Newline framing ends with LF, and the payload holds none.
    const frame = this.framing === "newline"
      ? Buffer.concat([payload, Buffer.from("\n")])
      : Buffer.concat([Buffer.from(`${payload.length} `), payload]);
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
