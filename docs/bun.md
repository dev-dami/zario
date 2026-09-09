# Structured logging on Bun

Zario uses Bun for dependency installation, native runtime tests, and scripts.
Node compatibility remains covered by a separate test suite. The core has no
runtime npm dependencies, including no Chalk dependency.

```bash
bun add zario
```

```ts
import { zario } from 'zario';

const log = zario();
log.info('server started', { port: 3000 });
log.error(new Error('connection failed'));
```

The factory is available starting in Zario 0.9.0. This checkout stages that
release; do not assume the currently published npm package includes it yet.
Factory defaults are synchronous console output, `info`, and environment-based
formatting. Set `json: true` for JSON in every environment.

## Bun.serve

```ts
import { zario } from 'zario';

const log = zario({ json: true });
const server = Bun.serve({
  port: 3000,
  fetch(request) {
    const requestLog = log.child({ requestId: crypto.randomUUID() });
    requestLog.info('request received', {
      method: request.method,
      path: new URL(request.url).pathname,
    });
    return new Response('ok');
  },
});

// On shutdown, stop intake, drain requests, then await log.close().
// Do not call process.exit() before pending logs have drained.
```

## Elysia

The `elysia-zario` adapter gives handlers typed `log` and `requestId` fields.
It records response status, duration and errors automatically. See the
[adapter README](https://github.com/dev-dami/elysia-zario) for configuration.

```ts
import { Elysia } from 'elysia';
import { elysiaLogger } from 'elysia-zario';

new Elysia()
  .use(elysiaLogger({ excludePaths: ['/health'] }))
  .get('/', ({ log, requestId }) => {
    log.info({ event: 'hello' });
    return { requestId };
  })
  .listen(3000);
```

## Development checks

```bash
bun install --frozen-lockfile
bun test                  # Bun-native behavior and dependency regression tests
bun run test:compat       # Existing Node/Jest compatibility suite
bun run typecheck
bun run lint
bun run build
```

The full import configures async queue defaults. With the lean `zario/logger`
entrypoint, supply a `MemoryQueueProvider` when enabling async mode; plain
`zario()` works without it. Benchmarks should state whether they run on Bun or
Node; results are not interchangeable.
