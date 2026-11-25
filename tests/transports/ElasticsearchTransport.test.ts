import * as http from 'http';
import { ElasticsearchTransport } from '../../src/transports/ElasticsearchTransport';
import { Logger } from '../../src/core/Logger';
import { Formatter } from '../../src/core/Formatter';
import type { LogData } from '../../src/types';

interface BulkRequest { url: string; headers: http.IncomingHttpHeaders; lines: unknown[] }
type Reply = (request: BulkRequest) => { status: number; body: unknown };

const formatter = new Formatter();
const record = (message: string, level = 'info'): LogData =>
  ({ level, message, timestamp: new Date('2026-05-06T07:08:09.000Z') });
const ok: Reply = (request) => ({ status: 200, body: { errors: false, items: request.lines.filter((_, i) => i % 2 === 0).map(() => ({ index: { status: 201 } })) } });

async function startCluster(reply: Reply = ok) {
  const requests: BulkRequest[] = [];
  let respond = reply;
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      const request = { url: req.url ?? '', headers: req.headers, lines: body.trim().split('\n').map((line) => JSON.parse(line)) };
      requests.push(request);
      const { status, body: payload } = respond(request);
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(payload));
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  return {
    node: `http://127.0.0.1:${(server.address() as { port: number }).port}`,
    requests,
    setReply: (next: Reply) => { respond = next; },
    // fetch keeps connections alive, and server.close() waits for them otherwise.
    close: () => new Promise<void>((resolve) => { server.close(() => resolve()); server.closeAllConnections(); }),
  };
}

async function until(check: () => boolean, ms = 2000): Promise<void> {
  const deadline = Date.now() + ms;
  while (!check()) {
    if (Date.now() > deadline) throw new Error('condition not met in time');
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
}

describe('ElasticsearchTransport', () => {
  let cluster: Awaited<ReturnType<typeof startCluster>>;
  let error: jest.SpyInstance;
  beforeEach(async () => {
    cluster = await startCluster();
    error = jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(async () => {
    error.mockRestore();
    await cluster.close();
  });

  test('sends NDJSON bulk requests with an index action and an @timestamp document', async () => {
    const transport = new ElasticsearchTransport({ node: cluster.node, index: 'app-logs' });
    transport.write({ ...record('saved'), prefix: '[db]', metadata: { id: 1 } }, formatter);
    await transport.flush();

    expect(cluster.requests).toHaveLength(1);
    expect(cluster.requests[0]!.url).toBe('/_bulk');
    expect(cluster.requests[0]!.headers['content-type']).toBe('application/x-ndjson');
    expect(cluster.requests[0]!.lines).toEqual([
      { index: { _index: 'app-logs' } },
      { '@timestamp': '2026-05-06T07:08:09.000Z', level: 'info', message: 'saved', prefix: '[db]', metadata: { id: 1 } },
    ]);
  });

  test('data streams use create, an index function picks the index, and a pipeline is passed', async () => {
    const transport = new ElasticsearchTransport({
      node: `${cluster.node}/`, dataStream: true, pipeline: 'geoip', index: (data) => `logs-${data.level}`,
    });
    transport.write(record('a', 'error'), formatter);
    await transport.flush();
    expect(cluster.requests[0]!.url).toBe('/_bulk?pipeline=geoip');
    expect(cluster.requests[0]!.lines[0]).toEqual({ create: { _index: 'logs-error' } });
  });

  test('API key and basic auth headers', async () => {
    const withKey = new ElasticsearchTransport({ node: cluster.node, apiKey: 'abc' });
    withKey.write(record('a'), formatter);
    await withKey.flush();
    const withBasic = new ElasticsearchTransport({ node: cluster.node, username: 'elastic', password: 'pw' });
    withBasic.write(record('b'), formatter);
    await withBasic.flush();

    expect(cluster.requests[0]!.headers.authorization).toBe('ApiKey abc');
    expect(cluster.requests[1]!.headers.authorization).toBe(`Basic ${Buffer.from('elastic:pw').toString('base64')}`);
  });

  test('sends a request when batchSize records wait, and after flushInterval otherwise', async () => {
    const transport = new ElasticsearchTransport({ node: cluster.node, batchSize: 2, flushInterval: 300 });
    const start = Date.now();
    transport.write(record('1'), formatter);
    transport.write(record('2'), formatter);
    transport.write(record('3'), formatter);
    await until(() => cluster.requests.length === 1);
    expect(cluster.requests[0]!.lines).toHaveLength(4); // the full batch went at once
    await until(() => cluster.requests.length === 2);
    expect(Date.now() - start).toBeGreaterThanOrEqual(290); // the last record waited for flushInterval
    expect(cluster.requests[1]!.lines).toHaveLength(2);
    await transport.close();
  });

  test('works as a logger transport, and close() delivers everything', async () => {
    const log = new Logger({ transports: [new ElasticsearchTransport({ node: cluster.node })], async: false });
    log.info('one');
    log.error('two', { code: 'E1' });
    await log.close();
    const docs = cluster.requests.flatMap((r) => r.lines.filter((_, i) => i % 2 === 1)) as Array<Record<string, unknown>>;
    expect(docs.map((d) => d.message)).toEqual(['one', 'two']);
  });

  test('retries a 503 response', async () => {
    let calls = 0;
    cluster.setReply((request) => (++calls === 1 ? { status: 503, body: {} } : ok(request)));
    const transport = new ElasticsearchTransport({ node: cluster.node, retryDelay: 5 });
    transport.write(record('a'), formatter);
    await transport.flush();
    expect(cluster.requests).toHaveLength(2);
  });

  test('retries only the items rejected with 429', async () => {
    let calls = 0;
    cluster.setReply((request) => {
      if (++calls > 1) return ok(request);
      return { status: 200, body: { errors: true, items: [{ index: { status: 201 } }, { index: { status: 429 } }] } };
    });
    const transport = new ElasticsearchTransport({ node: cluster.node, retryDelay: 5 });
    transport.write(record('kept'), formatter);
    transport.write(record('throttled'), formatter);
    await transport.flush();
    expect((cluster.requests[1]!.lines[1] as Record<string, unknown>).message).toBe('throttled');
    expect(cluster.requests[1]!.lines).toHaveLength(2);
  });

  test('a mapping error is reported by flush() and not retried', async () => {
    cluster.setReply(() => ({ status: 200, body: { errors: true, items: [
      { index: { status: 400, error: { type: 'mapper_parsing_exception', reason: 'failed to parse field [id]' } } },
    ] } }));
    const transport = new ElasticsearchTransport({ node: cluster.node, retryDelay: 5 });
    transport.write(record('bad'), formatter);
    await expect(transport.flush()).rejects.toThrow('mapper_parsing_exception: failed to parse field [id]');
    expect(cluster.requests).toHaveLength(1);
  });

  test('a 401 response is reported without retries', async () => {
    cluster.setReply(() => ({ status: 401, body: { error: 'unauthorized' } }));
    const transport = new ElasticsearchTransport({ node: cluster.node, retryDelay: 5 });
    transport.write(record('a'), formatter);
    await expect(transport.flush()).rejects.toThrow('status 401');
    expect(cluster.requests).toHaveLength(1);
  });

  test('keeps at most maxQueueSize records, and drops the oldest', async () => {
    const transport = new ElasticsearchTransport({ node: cluster.node, maxQueueSize: 2, batchSize: 100 });
    for (const message of ['a', 'b', 'c', 'd']) transport.write(record(message), formatter);
    expect(transport.getDroppedCount()).toBe(2);
    await transport.flush();
    const docs = cluster.requests[0]!.lines.filter((_, i) => i % 2 === 1) as Array<Record<string, unknown>>;
    expect(docs.map((d) => d.message)).toEqual(['c', 'd']);
  });

  test('an unreachable cluster fails flush() after the retries', async () => {
    const node = cluster.node;
    await cluster.close();
    const transport = new ElasticsearchTransport({ node, maxRetries: 1, retryDelay: 5, timeout: 500 });
    transport.write(record('a'), formatter);
    await expect(transport.flush()).rejects.toThrow();
    cluster = await startCluster(); // afterEach closes this one
  });
});
