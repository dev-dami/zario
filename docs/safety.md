# Safety

What Zario guarantees, and what it does not. The tests are in
[`tests/safety.test.ts`](../tests/safety.test.ts), and run on Bun and Node.

## Secrets

- Redaction and encryption run after enrichers, and before any transport, queue or aggregator.
- They work on a copy of what the output would show. A `toJSON()`, a getter or a cycle cannot bring a value back.
- Letter case does not matter. `**.password` matches at any depth, also in error causes.
- A child logger can add protection, but not remove it.
- If redaction or encryption fails, the metadata is dropped, and the record stays.

```ts
const log = zario({ redact: ["**.password", "**.authorization", "**.token"] });
```

Encryption and its own limits are in [Encryption](./encryption.md), and changes to files in [Tamper-evident logs](./integrity.md).

## Log calls

- A log call does not throw because of its data, a filter, an enricher, an aggregator, a transport or an error listener.
- A value that cannot be read becomes `"[Unserializable]"`, a cycle becomes `"[Circular]"`, and the rest of the record stays.
- A value that needs a copy is cut to 200 levels and 100,000 objects, with `"[Truncated]"`.

## Forged records

- JSON output escapes everything, and metadata cannot replace `level`, `message`, `timestamp` or `prefix`.
- Text output indents the lines after a newline, and escapes terminal control sequences. Color codes stay when color is on.

## Limits

- **Message text is not redacted.** Put data in metadata.
- `err.message` is also in `err.stack` and, with `log.error(error)`, in the message. If an error message can hold a secret, log your own text.
- A path covers only the places that it names. The same object under another key stays readable. Use `**.` paths for secrets that can be anywhere.
- A secret inside a string, for example a JSON body, is not found.
- Filters and enrichers see plain values.
- There is no limit on the length of a string.
- Records in a queue can be lost if the process is killed. Await `log.close()` before exit.
- `FileTransport` sees a file that another program renamed or deleted after at most one second.
