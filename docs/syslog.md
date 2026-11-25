# Syslog for Node.js and Bun

`SyslogTransport` sends logs to rsyslog, syslog-ng, a SIEM or any other syslog
receiver, over UDP, TCP or TLS. It has no dependencies.

```ts
import { zario } from "zario";
import { SyslogTransport } from "zario/transports";

const log = zario({
  json: true,
  transports: [new SyslogTransport({ host: "logs.internal", facility: "local0", appName: "checkout-api" })],
});

log.error("payment failed", { orderId: 42 });
await log.close(); // waits for pending sends, and closes the socket
```

## Standards

| Standard | What it covers | How to use it |
|---|---|---|
| [RFC 5424](https://www.rfc-editor.org/rfc/rfc5424) | Message format | Default |
| [RFC 5424, section 6.3](https://www.rfc-editor.org/rfc/rfc5424#section-6.3) | Structured data | `structuredData: "myapp@12345"` |
| [RFC 3164](https://www.rfc-editor.org/rfc/rfc3164) | Old BSD message format | `format: "rfc3164"` |
| [RFC 5426](https://www.rfc-editor.org/rfc/rfc5426) | UDP, one message in each datagram | `protocol: "udp"`, default |
| [RFC 6587](https://www.rfc-editor.org/rfc/rfc6587) | TCP, octet counting | `protocol: "tcp"` |
| [RFC 6587](https://www.rfc-editor.org/rfc/rfc6587) | TCP, newline framing | `protocol: "tcp", framing: "newline"` |
| [RFC 5425](https://www.rfc-editor.org/rfc/rfc5425) | TLS, port 6514 | `protocol: "tls"` |

Not supported: signed syslog (RFC 5848), DTLS (RFC 6012), and the local `/dev/log`
socket, because Node and Bun have no Unix datagram sockets.

## Which one do I need?

| Receiver | Options |
|---|---|
| Local rsyslog or syslog-ng | The defaults |
| A receiver on another network | `protocol: "tls"` |
| A receiver that must not lose messages when it is busy | `protocol: "tcp"` or `"tls"` |
| An old device | `format: "rfc3164"` |
| A receiver that reads one message per line | `protocol: "tcp", framing: "newline"` |
| A SIEM that indexes structured data | `structuredData` |

## Send over TLS

```ts
new SyslogTransport({
  host: "logs.example.com",
  protocol: "tls",
  tls: {
    ca: readFileSync("ca.pem"),        // for a private CA
    cert: readFileSync("client.pem"),  // for a client certificate
    key: readFileSync("client.key"),
  },
});
```

The certificate and the host name are checked, and nothing is sent if the check
fails. The minimum is TLS 1.2. `tls` takes the options of
[`tls.connect`](https://nodejs.org/api/tls.html#tlsconnectoptions-callback). Do not set
`rejectUnauthorized: false`: your logs would go to anyone who answers.

## Structured data

```ts
const log = zario({
  transports: [new SyslogTransport({ structuredData: "myapp@12345", msgId: (data) => data.metadata?.event ?? "" })],
});

log.info("user signed in", { event: "LOGIN", user: "ada" });
// <14>1 2026-11-25T18:00:00.000Z web-1 zario 4242 LOGIN [myapp@12345 event="LOGIN" user="ada"] user signed in
```

Metadata becomes parameters, and the message becomes MSG. Objects become JSON text.
The number is your
[IANA private enterprise number](https://www.iana.org/assignments/enterprise-numbers/).
`32473` is reserved for documentation. If the data does not fit in
`maxMessageSize`, it is left out, and the message stays.

## Level to severity

| Zario level | Syslog severity |
|---|---|
| `fatal` | 2 (crit) |
| `error` | 3 (err) |
| `warn` | 4 (warning) |
| `info` | 6 (info) |
| `debug`, `boring` | 7 (debug) |
| other levels | 6 (info), unless set in `severities` |

## Options

| Option | Default | Description |
|---|---|---|
| `host` | `"127.0.0.1"` | Server host |
| `port` | `514`, or `6514` for TLS | Server port |
| `protocol` | `"udp"` | `"udp"`, `"tcp"` or `"tls"` |
| `framing` | `"octet-counting"` | `"newline"` is for TCP only |
| `tls` | `{}` | TLS options |
| `format` | `"rfc5424"` | `"rfc5424"` or `"rfc3164"` |
| `facility` | `"user"` | `kern`, `user`, `daemon`, `auth`, `local0` … `local7`, and the other RFC 5424 names |
| `appName` | `"zario"` | APP-NAME (RFC 5424) or TAG (RFC 3164) |
| `hostname` | `os.hostname()` | HOSTNAME |
| `structuredData` | none | SD-ID for metadata |
| `msgId` | none | MSGID, as text or a function of the record |
| `severities` | `{}` | Severities from 0 to 7, for example `{ audit: 5 }` |
| `bom` | `false` | Start MSG with the UTF-8 byte order mark |
| `maxMessageSize` | `8192`, or `1024` for RFC 3164 | Longer messages are cut, never inside a character |
| `maxPendingWrites` | `1000` | Sends that can wait. Later logs are dropped, and `flush()` reports it |

## Safety

- Newlines and control characters in a message are escaped, so user text cannot make a second message.
- Structured data values are escaped, so a value cannot close its element and add another one.
- Redaction and [field encryption](./encryption.md) run before the transport.
- A send failure does not throw from a log call. `flush()` and `close()` reject with the first failure.

## Limits

- UDP can lose, reorder and cut messages. Nobody is told. Many networks drop datagrams above about 1,400 bytes.
- TCP and TLS have no acknowledgement in syslog. Messages that were sent just before a connection broke can be lost.
- RFC 3164 has no year, no time zone and no encoding. Use RFC 5424 when you can.
- The receiver can have its own size limit. Raise both if you send large JSON.

[Transports](./transports.md) | [Encryption](./encryption.md) | [Safety](./safety.md)
