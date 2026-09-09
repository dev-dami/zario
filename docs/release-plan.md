# Zario 1.0 preparation

This checkout stages Zario 0.9.0 and remains pre-release. Nothing has been
published or tagged. The factory and lifecycle API below need a release
containing this work before they can be used from npm.

## Implemented in this checkout

- Named `zario()` factory in full and lean entrypoints; existing class exports stay.
- Console-only factory defaults, `info` enabled, synchronous output.
- Message-first/object-first logging, direct and nested Error serialization.
- Circular reference and BigInt handling across formatter, HTTP and dead letters.
- `child()`, `isLevelEnabled()`, and strict logging overloads.
- Awaitable `flush()`/`close()`, shared queue routing and child resource ownership.
- Background HTTP/retry/circuit-breaker draining and transport lifecycle hooks.
- README positioning, migration guidance and reproducible comparison evidence.

## Verification completed

- Full Jest suite: 436 passed, 2 skipped; lifecycle tests rerun after final cleanup.
- Bun-native suite: 4 passed, including Chalk RGB behavior after a clean-cache install.
- Source typecheck and compile-only public API contract tests.
- ESLint over `src`, production JS/declaration build, and diff whitespace check.
- Root/lean bundle-size smoke check.
- Packed artifact installed in a clean temporary project; full and lean exports,
  circular metadata, Error logging, and shutdown exercised with Bun/Node ESM;
  factory exports and shutdown exercised with Node CommonJS.
- All four framework adapters pass Bun integration/type/lint/build checks; five packed packages pass clean-consumer smoke checks.
- Complete adversarial benchmark run archived with environment and caveats.

## Remaining release gates

- Review the public API and default changes, including `silent` disabling output.
- Audit redaction with cyclic/aliased objects, arrays, errors and custom `toJSON`.
  Circular serialization alone does not prove sensitive fields are removed from
  every reachable alias. Keep this as a security gate before calling 1.0 ready.
- Expand adversarial serialization coverage: throwing getters, proxies,
  custom `toJSON`, deep graphs, reserved field collisions and output-size limits.
  These inputs are not covered by a blanket “logging never throws” guarantee.
- Stress file rotation, sustained queue pressure, destination outages and memory
  over time. In-process throughput and one heap delta are not substitutes.
- Verify all framework adapters against a packed release artifact on supported
  Node/Bun versions. Cloudflare Workers compatibility has not been established.
- Review ownership of resources shared between independent logger roots and
  transport wrappers; callers currently coordinate that sharing themselves.
- Approve version/changelog, then publish and tag. Recheck the versioned artifact
  and verify npm's README after publication.

## Launch drafts — publish after the release gates pass

### Short post

I simplified Zario's logging API:

```ts
import { zario } from 'zario';
const log = zario();
log.info('server started', { port: 3000 });
```

The same update handles circular metadata, preserves Error diagnostics, and
adds awaitable shutdown. The comparison includes raw benchmark output and
limitations: https://github.com/Dev-Dami/zario/blob/main/docs/comparison.md

### Technical post outline

Title: “Why JSON.stringify was crashing my logger”

1. Show a self-referencing metadata object and the old failure.
2. Explain ancestor tracking versus incorrectly treating all shared objects as cycles.
3. Show Error.cause and BigInt behavior, with regression tests.
4. Explain the cost of serialization and publish all benchmark rows, including losses.
5. Show the queue flush race and why enqueue speed is not delivery throughput.
6. Link the implementation and ask for real workload reports.

Do not claim a 100k-object fuzz campaign or production adoption without evidence.
Use the latest report's actual results when turning this outline into a post.

### Show HN title

Show HN: Zario — a zero-dependency structured logger for TypeScript

Lead with the factory example, then error handling and shutdown. Link the
comparison and known limitations. Collect reports from production trials before
claiming production readiness.
