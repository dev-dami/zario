import * as crypto from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { HashChain, unchainLine, verifyChain, verifyChainFiles } from '../../src/utils/HashChain';
import type { Checkpoint } from '../../src/utils/HashChain';
import { LineEncryptor, decryptLine } from '../../src/utils/FieldEncryptor';
import { FileTransport } from '../../src/transports/FileTransport';
import { MemoryQueueProvider } from '../../src/core/LogQueue';
import { Logger } from '../../src/core/Logger';

const json = (i: number) => JSON.stringify({ level: 'info', message: `line ${i}`, n: i });
function chain(count: number, options: ConstructorParameters<typeof HashChain>[0] = {}, make = json) {
  const hashChain = new HashChain({ checkpointInterval: 0, ...options });
  return { lines: Array.from({ length: count }, (_, i) => hashChain.chainLine(make(i))), hashChain };
}
const kinds = (report: ReturnType<typeof verifyChain>) => report.problems.map((p) => `${p.kind}@${p.seq}`);

describe('chained lines', () => {
  test('a JSON line stays valid JSON, with a _chain member', () => {
    const { lines } = chain(2);
    const record = JSON.parse(lines[1]!);
    expect(record).toMatchObject({ message: 'line 1', _chain: { seq: 1 } });
    expect(record._chain.hash).toHaveLength(43);
  });

  test('a text line or an empty object can be chained', () => {
    const hashChain = new HashChain({ checkpointInterval: 0 });
    const text = hashChain.chainLine('[INFO] hello {"a":1}');
    expect(text).toMatch(/^\[INFO\] hello \{"a":1\} _chain=[\w-]+:0:[\w-]{43}$/);
    const empty = hashChain.chainLine('{}');
    expect(JSON.parse(empty)._chain.seq).toBe(1);
    expect(verifyChain([text, empty]).problems).toEqual([]);
  });

  test('unchainLine gives back the original line', () => {
    for (const original of [json(1), '{}', '[INFO] text', 'eyJhbGciOi.x.y.z.w']) {
      const chained = new HashChain({ checkpointInterval: 0 }).chainLine(original);
      expect(unchainLine(chained)?.line).toBe(original);
    }
  });

  test('a user field that looks like a chain does not confuse it', () => {
    const hashChain = new HashChain({ checkpointInterval: 0 });
    const lines = [hashChain.chainLine(JSON.stringify({ _chain: 'fake', m: 'x _chain=a:1:b' })), hashChain.chainLine('text _chain=a:0:' + 'x'.repeat(43))];
    expect(verifyChain(lines).ok).toBe(true);
  });
});

describe('verifyChain finds', () => {
  test('nothing in an intact chain', () => {
    const report = verifyChain(chain(50).lines);
    expect(report).toMatchObject({ ok: true, lines: 50, problems: [] });
    expect(report.chains).toEqual([expect.objectContaining({ first: 0, last: 49, lines: 50 })]);
  });

  test('a changed line, and only that line', () => {
    const { lines } = chain(10);
    lines[4] = lines[4]!.replace('line 4', 'line X');
    expect(kinds(verifyChain(lines))).toEqual(['modified@4']);
  });

  test('a removed line', () => {
    const { lines } = chain(10);
    lines.splice(6, 1);
    const report = verifyChain(lines);
    expect(report.ok).toBe(false);
    expect(kinds(report)).toEqual(['gap@6']);
  });

  test('an added line without chain fields', () => {
    const { lines } = chain(5);
    lines.splice(2, 0, json(99));
    expect(kinds(verifyChain(lines))).toEqual(['unchained@undefined']);
  });

  test('a forged line that copies the fields of another line', () => {
    const { lines } = chain(5);
    lines.splice(3, 0, lines[2]!.replace('line 2', 'forged'));
    expect(kinds(verifyChain(lines))).toEqual(expect.arrayContaining(['duplicate@2']));
  });

  test('lines in another order are fine: the chain follows seq', () => {
    const { lines } = chain(10);
    expect(verifyChain([...lines].reverse()).ok).toBe(true);
  });

  test('lines cut from the end, with a checkpoint', () => {
    const checkpoints: Checkpoint[] = [];
    const { lines, hashChain } = chain(20, { onCheckpoint: (c) => checkpoints.push(c), checkpointEvery: 10 });
    hashChain.close();
    expect(checkpoints.map((c) => c.seq)).toEqual([9, 19]);
    expect(verifyChain(lines.slice(0, 15)).ok).toBe(true);
    expect(kinds(verifyChain(lines.slice(0, 15), { checkpoints }))).toEqual(['truncated@19']);
  });

  test('a rewritten chain: the checkpoint catches it without a key, the key catches it alone', () => {
    const checkpoints: Checkpoint[] = [];
    const key = crypto.randomBytes(32);
    const original = chain(5, { key, onCheckpoint: (c) => checkpoints.push(c) });
    original.hashChain.close();
    // The attacker builds a new chain with the same id, and has no key.
    const forged = new HashChain({ checkpointInterval: 0 });
    Object.defineProperty(forged, 'chainId', { value: original.hashChain.chainId });
    const rewritten = Array.from({ length: 5 }, (_, i) => forged.chainLine(json(i).replace('line', 'fake')));
    expect(verifyChain(rewritten).ok).toBe(true);
    expect(kinds(verifyChain(rewritten, { checkpoints }))).toEqual(['checkpoint mismatch@4']);
    expect(verifyChain(rewritten, { key }).problems.filter((p) => p.kind === 'modified')).toHaveLength(5);
    expect(verifyChain(original.lines, { key, checkpoints }).ok).toBe(true);
  });

  test('a chain that starts after the first line is reported, but is not a failure', () => {
    const report = verifyChain(chain(10).lines.slice(4));
    expect(report.ok).toBe(true);
    expect(kinds(report)).toEqual(['late start@4']);
  });

  test('a short key is refused', () => {
    expect(() => new HashChain({ key: 'short' })).toThrow('16 bytes');
  });
});

describe('FileTransport with integrity', () => {
  let dir: string;
  beforeEach(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), 'zario-chain-')); });
  afterEach(() => { fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5 }); });
  const files = () => fs.readdirSync(dir).map((name) => path.join(dir, name))
    .sort((a, b) => (a.endsWith('app.log') ? 1 : 0) - (b.endsWith('app.log') ? 1 : 0) || a.localeCompare(b));

  test('a chain survives rotation and gzip, async writes and two loggers on one file', async () => {
    const checkpoints: Checkpoint[] = [];
    const file = path.join(dir, 'app.log');
    const make = () => new FileTransport({ path: file, maxSize: 2000, maxFiles: 100, compression: 'gzip', integrity: new HashChain({ onCheckpoint: (c) => checkpoints.push(c) }) });
    const a = new Logger({ json: true, async: false, transports: [make()] });
    const b = new Logger({ json: true, async: true, queueProvider: new MemoryQueueProvider(), transports: [make()] });
    for (let i = 0; i < 150; i++) { a.info(`a ${i}`); b.info(`b ${i}`); }
    await a.close();
    await b.close();
    expect(files().some((name) => name.endsWith('.gz'))).toBe(true);
    const report = await verifyChainFiles(files(), { checkpoints });
    expect(report.problems).toEqual([]);
    expect(report.chains).toHaveLength(2);
    expect(report.lines).toBe(300);
  });

  test('encrypted lines are verified without the decryption key, and still decrypt', async () => {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('x25519');
    const file = path.join(dir, 'app.log');
    const logger = new Logger({ json: true, async: false, transports: [new FileTransport({ path: file, encryptor: new LineEncryptor({ key: publicKey }), integrity: new HashChain() })] });
    logger.info('secret');
    await logger.close();
    expect((await verifyChainFiles([file])).ok).toBe(true);
    const [line] = fs.readFileSync(file, 'utf8').trim().split('\n');
    expect(JSON.parse(decryptLine(line!, privateKey)).message).toBe('secret');
  });

  test('a change to a file on disk is found', async () => {
    const file = path.join(dir, 'app.log');
    const logger = new Logger({ json: true, async: false, transports: [new FileTransport({ path: file, integrity: new HashChain() })] });
    for (let i = 0; i < 5; i++) logger.info(`entry ${i}`, { amount: 10 });
    await logger.close();
    const lines = fs.readFileSync(file, 'utf8').split('\n');
    lines[2] = lines[2]!.replace('"amount":10', '"amount":99');
    fs.writeFileSync(file, lines.join('\n'));
    const report = await verifyChainFiles([file]);
    expect(report.ok).toBe(false);
    expect(report.problems[0]).toMatchObject({ kind: 'modified', seq: 2, where: `${file}:3` });
  });
});
