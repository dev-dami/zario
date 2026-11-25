# Encrypt logs in Node.js and Bun

Use redaction when nobody needs the value again. Use encryption when an
authorized person must read it later. Zario can encrypt **selected fields**, or
**whole lines** of a log file. Both write standard
[JWE](https://www.rfc-editor.org/rfc/rfc7516) strings, so any JOSE library in
any language can read them. No Zario code is needed to get your data back.

## Encrypt fields

```ts
import { zario } from "zario";
import { FieldEncryptor } from "zario/encryption";

const log = zario({
  redact: ["**.password"],
  encryptor: new FieldEncryptor({
    paths: ["user.email", "items.*.ssn"],
    key: process.env.LOG_PUBLIC_KEY!,
    keyId: "2026-11",
  }),
});

log.info("signup", { user: { id: 7, email: "ada@example.com" } });
// "user":{"id":7,"email":"eyJhbGciOiJFQ0RILUVTIi..."}
```

Encryption runs after enrichers and redaction, and before any transport or queue
gets the record. Child loggers inherit it, and cannot turn it off. Your own
objects are not changed. If encryption fails, the metadata is dropped.

## Encrypt whole lines of a file

```ts
import { zario } from "zario";
import { FileTransport } from "zario/transports";
import { LineEncryptor } from "zario/encryption";

const log = zario({
  json: true,
  transports: [
    new FileTransport({
      path: "./logs/app.log",
      encryptor: new LineEncryptor({ key: process.env.LOG_PUBLIC_KEY! }),
    }),
  ],
});
```

Each line is one JWE, so rotation works, and one damaged line does not affect the
others. `maxSize` counts the encrypted bytes.

## Choose a key

Prefer a **public key**. The server that writes the logs then cannot read them
back, and a stolen server does not expose old logs.

```bash
# X25519 key pair: give the servers log.pub, and keep log.key offline
openssl genpkey -algorithm X25519 -out log.key
openssl pkey -in log.key -pubout -out log.pub

# or a symmetric key
openssl rand -base64 32
```

A key is a PEM string, a JWK, a `KeyObject`, or 32 bytes as a Buffer, base64 or
hex. Zario refuses a private key for encryption, RSA below 2048 bits, and
symmetric keys that are not 256 bits.

| Key | JWE `alg` | Standard | Notes |
|---|---|---|---|
| X25519 | `ECDH-ES` | [RFC 8037](https://www.rfc-editor.org/rfc/rfc8037), [RFC 7518](https://www.rfc-editor.org/rfc/rfc7518) | Recommended |
| P-256, P-384, P-521 | `ECDH-ES` | RFC 7518 | P-384 and P-521 are slow |
| RSA 2048 or more | `RSA-OAEP-256` | RFC 7518 | Longest output |
| 32 bytes | `A256KW` (default) | RFC 7518, [RFC 3394](https://www.rfc-editor.org/rfc/rfc3394) | A new content key for each value |
| 32 bytes | `dir` (opt in) | RFC 7518 | Fastest and shortest. Read the limit below |

The content is always encrypted with `A256GCM`
([NIST SP 800-38D](https://csrc.nist.gov/pubs/sp/800/38/d/final)), with a new
random 96-bit IV and a 128-bit tag.

**The limit of `dir`.** One AES-GCM key with random IVs must not encrypt more than
2³² values. At 5,000 encrypted values each second, that is 10 days, for all your
servers together. Use another algorithm, or rotate the key before then.

Encryption costs time on each log call. Measured on a busy 4-core VPS, so use the
numbers only to compare the rows:

| `alg` | Bun, values/s | Node, values/s | Length of a short value |
|---|---:|---:|---:|
| `dir` | 79,000 | 31,000 | 157 |
| `A256KW` | 25,000 | 8,000 | 215 |
| `RSA-OAEP-256` | 18,000 | 11,000 | 511 |
| `ECDH-ES` X25519 | 8,600 | 4,700 | 276 |
| `ECDH-ES` P-256 | 9,000 | 2,500 | 340 |
| `ECDH-ES` P-384 | 560 | 260 | 396 |

## Read the values back

```ts
import { decryptField, decryptLine } from "zario/encryption";

decryptField(value, privateKey);

// After a key rotation, pass each key by its keyId:
decryptField(value, { "2026-11": newPrivateKey, "2025-11": oldPrivateKey });
```

Decrypt a whole file:

```ts
import { createReadStream, readFileSync } from "node:fs";
import { createInterface } from "node:readline";
import { decryptLine } from "zario/encryption";

const key = readFileSync("log.key", "utf8");
for await (const line of createInterface({ input: createReadStream("app.log") })) {
  console.log(decryptLine(line, key));
}
```

Without Zario, for example with [`jose`](https://www.npmjs.com/package/jose):

```ts
import { compactDecrypt, importPKCS8 } from "jose";

const { plaintext } = await compactDecrypt(value, await importPKCS8(pem, "ECDH-ES"));
JSON.parse(new TextDecoder().decode(plaintext));
```

Both functions throw if the value, its tag or its header was changed, or if no key
matches. The type of the key decides which algorithms are accepted, so a changed
header cannot select another one. `crit` and `zip` headers are refused.

## The format

```
BASE64URL(header) . BASE64URL(encrypted key) . BASE64URL(iv) . BASE64URL(ciphertext) . BASE64URL(tag)

header: {"alg":"ECDH-ES","enc":"A256GCM","typ":"zario-field+jwe","kid":"2026-11","epk":{...}}
```

The header is readable, and authenticated. `typ` is `zario-field+jwe` for a field,
where the plaintext is JSON, and `zario-line+jwe` for a line, where the plaintext is
the line.

## Limits

- Field encryption covers metadata only. A secret in the message text stays readable:
  write `log.info("signup", { email })`, not `` log.info(`signup ${email}`) ``.
- You choose the paths. A field that no path matches stays readable.
- Filters and enrichers see the plain value, because they run first.
- The length of a value, the key id and the time of the record are visible.
- A value is not tied to its record. Someone who can write to your logs can copy an
  encrypted value to another place, or delete lines. Encryption does not detect that.
- A public key does not prove who wrote a value. Anyone with the public key can make one.
- `LineEncryptor` covers `FileTransport` only. A dead-letter file and other transports are not encrypted.
- A syslog message that is cut to `maxMessageSize` can cut an encrypted value, which then cannot be read.
- Zario does not store or rotate keys. This is not a FIPS 140 validated module, and using it does not make a system compliant.

## Path syntax

Redaction and encryption use the same paths.

| Path | Matches |
|---|---|
| `password` | A top-level field |
| `user.email` | A nested field |
| `headers.*` | Every field in `headers` |
| `items.*.ssn` | `ssn` in each item of the `items` array |
| `**.password` | `password` at any depth |

Letter case does not matter. `user.email` also matches a key that is literally `"user.email"`.

[Safety](./safety.md) | [Syslog](./syslog.md) | [Transports](./transports.md)
