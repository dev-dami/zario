# Tamper-evident logs

A hash chain links each line of a log file to the line before it. If someone
changes, removes or adds a line, the chain breaks, and `verifyChainFiles()` says
where. Use it for audit logs, security events and anything you may have to show
someone later.

```ts
import { zario } from "zario";
import { FileTransport } from "zario/transports";
import { HashChain } from "zario/integrity";

const log = zario({
  json: true,
  transports: [
    new FileTransport({
      path: "./logs/audit.log",
      integrity: new HashChain({
        key: process.env.LOG_CHAIN_KEY,              // optional, see below
        onCheckpoint: (checkpoint) => anchors.info("log checkpoint", checkpoint),
      }),
    }),
  ],
});

log.info("refund approved", { orderId: 42, amount: 90 });
// {"level":"info","message":"refund approved",...,"_chain":{"id":"k2Jx9","seq":0,"hash":"Qm7..."}}
```

JSON lines stay valid JSON, with a `_chain` member at the end. Text lines and
encrypted lines get a ` _chain=<id>:<seq>:<hash>` suffix.

## Verify

```ts
import { verifyChainFiles } from "zario/integrity";

const report = await verifyChainFiles(
  ["logs/audit.log.1795600000000.gz", "logs/audit.log"],   // oldest first
  { key: process.env.LOG_CHAIN_KEY, checkpoints },
);

if (!report.ok) console.error(report.problems);
// [{ kind: "modified", seq: 2, where: "logs/audit.log:3", detail: "the line or its hash was changed" }]
```

Rotated `.gz` and `.deflate` files are read too, and the files are streamed.
`verifyChain(lines)` checks lines that you already have.

| Problem | Meaning |
|---|---|
| `modified` | The line or its hash was changed, or the key is wrong |
| `gap` | Lines were removed |
| `duplicate` | Two lines have the same position |
| `unchained` | A line has no chain fields, so it was added or changed |
| `truncated` | A checkpoint names a line that is not there: lines were cut from the end |
| `checkpoint mismatch` | The chain does not match a checkpoint: it was rewritten |
| `late start` | The chain starts after its first line. Normal when old files were rotated away. `ok` stays true |

## What it can prove

A chain alone catches changes **inside** the file. Two things need more:

1. **Lines cut from the end.** A shorter chain is still a valid chain. A
   checkpoint stored elsewhere names the last line, so the cut shows.
2. **The whole file rewritten.** Without a key, anyone can build a new valid chain.
   With a `key` (HMAC-SHA256), a rewrite needs the key. With checkpoints, a
   rewrite does not match them.

| Attacker can | Chain | + key | + checkpoints elsewhere |
|---|---|---|---|
| Edit the log files only (backup, log store, shipper) | change, remove, add | + rewrite | + cut |
| Run code as your app on the server | change, remove, add | — | + rewrite, cut, up to the last checkpoint |

Someone who controls the server can read the key, and can change lines written
after the last checkpoint. So send checkpoints often, to a place that the server
can write to but not change: another logging service, a syslog server, or storage
with object lock.

## Checkpoints

`onCheckpoint` gets `{ chainId, seq, hash, time }` every `checkpointEvery` lines
(default 1,000), every `checkpointInterval` ms (default 60,000), and when the
logger closes. Keep them, and pass them to the verifier.

## With encryption

Encryption runs first, then the chain. So you can verify a file without the
decryption key, and `decryptLine()` still reads each line.

```ts
new FileTransport({
  path: "./logs/audit.log",
  encryptor: new LineEncryptor({ key: process.env.LOG_PUBLIC_KEY! }),
  integrity: new HashChain({ key: process.env.LOG_CHAIN_KEY }),
});
```

## Details

- Each line: `hash = SHA-256(chainId \n seq \n previousHash \n line)`, or HMAC-SHA256 with the key. The first previous hash is 32 zero bytes.
- Each process starts a new chain with a random id, so restarts and several processes on one file are fine.
- Async writes can reach the file out of order. The verifier follows `seq`, not the line order.
- A key must have at least 16 bytes. Use 32 random bytes: `openssl rand -base64 32`.
- Cost on a laptop: about 140,000 to 330,000 lines/s, and 92 more characters for each line.

## Limits

- `integrity` covers `FileTransport`. Syslog, HTTP and other transports are not chained.
- This is not a digital signature. It does not prove who wrote a line, and it is not RFC 5848 (signed syslog).
- A chain shows that the file changed. It does not stop the change, and it does not restore the lost lines.

[Encryption](./encryption.md) | [Safety](./safety.md) | [Transports](./transports.md)
