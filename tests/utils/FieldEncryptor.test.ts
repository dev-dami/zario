import * as crypto from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { FieldEncryptor, LineEncryptor, decryptField, decryptLine, isEncryptedField } from '../../src/utils/FieldEncryptor';
import { concatKdf, unwrapKey, wrapBlocks, wrapKey } from '../../src/utils/jwe';
import type { EncryptionKey, KeyAlgorithm } from '../../src/utils/jwe';
import { FileTransport } from '../../src/transports/FileTransport';
import { Logger } from '../../src/core/Logger';
import { MemoryQueueProvider } from '../../src/core/LogQueue';
import { Formatter } from '../../src/core/Formatter';
import { LogData } from '../../src/types';
import { Transport } from '../../src/transports/Transport';

const key = crypto.randomBytes(32);
const pem = (k: crypto.KeyObject, type: 'spki' | 'pkcs8') => k.export({ type: type as never, format: 'pem' }) as string;

class CaptureTransport implements Transport {
  lines: string[] = [];
  write(data: LogData, formatter: Formatter): void { this.lines.push(formatter.format(data)); }
}

function setup(paths: string[]) {
  const transport = new CaptureTransport();
  const logger = new Logger({
    json: true, async: false, transports: [transport], encryptor: new FieldEncryptor({ paths, key }),
  });
  return { logger, last: () => JSON.parse(transport.lines[transport.lines.length - 1]!) };
}

function encryptOne(value: unknown, options: { key?: EncryptionKey; keyId?: string; algorithm?: KeyAlgorithm } = {}): string {
  return new FieldEncryptor({ paths: ['x'], key, ...options }).encrypt({ x: value }).x as string;
}

const header = (jwe: string) => JSON.parse(Buffer.from(jwe.split('.')[0]!, 'base64url').toString());
const withHeader = (jwe: string, change: Record<string, unknown>) =>
  [Buffer.from(JSON.stringify({ ...header(jwe), ...change })).toString('base64url'), ...jwe.split('.').slice(1)].join('.');
const withPart = (jwe: string, index: number, change: (bytes: Buffer) => Buffer) =>
  jwe.split('.').map((part, i) => i === index ? change(Buffer.from(part, 'base64url')).toString('base64url') : part).join('.');

describe('FieldEncryptor', () => {
  test('hides a nested field from transports and leaves its siblings readable', () => {
    const { logger, last } = setup(['user.email']);
    logger.info('signup', { user: { email: 'q@example.com', id: 7 } });
    const { user } = last();
    expect(user.id).toBe(7);
    expect(isEncryptedField(user.email)).toBe(true);
    expect(decryptField(user.email, key)).toBe('q@example.com');
  });

  test('encrypts a field in each array item', () => {
    const { logger, last } = setup(['items.*.ssn']);
    logger.info('batch', { items: [{ ssn: '1' }, { ssn: '2' }] });
    expect(last().items.map((item: { ssn: string }) => decryptField(item.ssn, key))).toEqual(['1', '2']);
  });

  test('encrypts the context of a child logger', () => {
    const { logger, last } = setup(['token']);
    logger.child({ token: 'secret' }).info('hello');
    expect(decryptField(last().token, key)).toBe('secret');
  });

  test('does not change the object that the caller passed', () => {
    const { logger } = setup(['user.email']);
    const metadata = { user: { email: 'q@example.com' } };
    logger.info('signup', metadata);
    expect(metadata.user.email).toBe('q@example.com');
  });

  test('keeps the type of a value', () => {
    for (const value of ['text', 7, true, null, { a: [1] }]) expect(decryptField(encryptOne(value), key)).toEqual(value);
  });

  test('gives a different ciphertext each time for the same value', () => {
    expect(encryptOne('same')).not.toBe(encryptOne('same'));
  });

  test('does not throw into the caller when a value cannot be serialized', () => {
    const { logger, last } = setup(['x']);
    const bad = { secret: 'plain', toJSON() { throw new Error('boom'); } };
    expect(() => logger.info('hello', { x: bad })).not.toThrow();
    expect(JSON.stringify(last())).not.toContain('plain');
    expect(decryptField(last().x, key)).toBe('[Unserializable]');
  });

  test('decrypts with the key that the keyId names', () => {
    const old = encryptOne('value', { keyId: '2025' });
    expect(decryptField(old, { '2025': key, '2026': crypto.randomBytes(32) })).toBe('value');
    expect(() => decryptField(old, { '2026': key })).toThrow('No key for keyId "2025"');
    expect(() => decryptField(encryptOne('v', { keyId: 'constructor' }), { '2026': key })).toThrow('No key');
  });

  test('a user value that looks encrypted is encrypted again', () => {
    const fake = encryptOne('fake', { key: crypto.randomBytes(32) });
    expect(decryptField(encryptOne(fake), key)).toBe(fake);
  });
});

describe('published vectors', () => {
  const hex = (text: string) => Buffer.from(text.replace(/\s/g, ''), 'hex');

  test('RFC 3394, section 4.6: wrap 256 bits with a 256-bit key', () => {
    const kek = hex('000102030405060708090A0B0C0D0E0F101112131415161718191A1B1C1D1E1F');
    const data = hex('00112233445566778899AABBCCDDEEFF000102030405060708090A0B0C0D0E0F');
    const wrapped = hex('28C9F404C4B810F4CBCCB35CFB87F8263F5786E2D80ED326CBC7F0E71A99F43BFB988B9B7A02DD21');
    expect(wrapKey(kek, data)).toEqual(wrapped);
    expect(wrapBlocks(kek, data)).toEqual(wrapped);
    expect(Buffer.from(unwrapKey(kek, wrapped))).toEqual(data);
  });

  test('RFC 7518, appendix C: ECDH-ES key agreement', () => {
    const alice = crypto.createPrivateKey({ format: 'jwk', key: {
      kty: 'EC', crv: 'P-256', x: 'gI0GAILBdu7T53akrFmMyGcsF3n5dO7MmwNBHKW5SV0', y: 'SLW_xSffzlPWrHEVI30DHM_4egVwt3NQqeUD7nMFpps',
      d: '0_NxaRPUMQoAJt50Gz8YiTr8gRTwyEaCumd-MToTmIo',
    } });
    const bob = crypto.createPublicKey({ format: 'jwk', key: {
      kty: 'EC', crv: 'P-256', x: 'weNJy2HscCSM6AEDTDg04biOvhFhyyWvOHQfeF_PxMQ', y: 'e8lnCO-AlStT-NJVX-crhB7QRYhiix03illJOVAOyck',
    } });
    const shared = crypto.diffieHellman({ privateKey: alice, publicKey: bob });
    expect(concatKdf(shared, 'A128GCM', 128, Buffer.from('Alice'), Buffer.from('Bob')).toString('base64url')).toBe('VqqN6vgjbSBcIijNcacQGg');
  });
});

describe('algorithms', () => {
  const rsa = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const p256 = crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' });
  const p384 = crypto.generateKeyPairSync('ec', { namedCurve: 'P-384' });
  const p521 = crypto.generateKeyPairSync('ec', { namedCurve: 'P-521' });
  const x25519 = crypto.generateKeyPairSync('x25519');

  test.each<[string, EncryptionKey, EncryptionKey, KeyAlgorithm | undefined, string]>([
    ['symmetric', key, key, undefined, 'A256KW'],
    ['symmetric, direct', key, key, 'dir', 'dir'],
    ['symmetric hex', key.toString('hex'), key.toString('base64'), undefined, 'A256KW'],
    ['symmetric JWK', { kty: 'oct', k: key.toString('base64url') }, key, undefined, 'A256KW'],
    ['RSA PEM', pem(rsa.publicKey, 'spki'), pem(rsa.privateKey, 'pkcs8'), undefined, 'RSA-OAEP-256'],
    ['P-256 PEM', pem(p256.publicKey, 'spki'), pem(p256.privateKey, 'pkcs8'), undefined, 'ECDH-ES'],
    ['P-384 KeyObject', p384.publicKey, p384.privateKey, undefined, 'ECDH-ES'],
    ['P-521 KeyObject', p521.publicKey, p521.privateKey, undefined, 'ECDH-ES'],
    ['X25519 JWK', x25519.publicKey.export({ format: 'jwk' }) as never, x25519.privateKey.export({ format: 'jwk' }) as never, undefined, 'ECDH-ES'],
  ])('%s', (_name, publicKey, privateKey, algorithm, alg) => {
    const value = encryptOne({ a: 'é' }, { key: publicKey, keyId: 'k1', ...(algorithm ? { algorithm } : {}) });
    expect(header(value)).toMatchObject({ alg, enc: 'A256GCM', kid: 'k1' });
    expect(decryptField(value, { k1: privateKey })).toEqual({ a: 'é' });
  });

  test('the server that encrypts with a public key cannot decrypt', () => {
    const value = encryptOne('secret', { key: p256.publicKey });
    expect(() => decryptField(value, p256.publicKey)).toThrow('private key');
  });

  test('a private key is refused for encryption', () => {
    for (const bad of [p256.privateKey, pem(rsa.privateKey, 'pkcs8'), x25519.privateKey.export({ format: 'jwk' }) as never]) {
      expect(() => encryptOne('x', { key: bad })).toThrow('public key');
    }
  });

  test('weak or wrong keys are refused', () => {
    expect(() => encryptOne('x', { key: 'short' })).toThrow('must be 32 bytes');
    expect(() => encryptOne('x', { key: crypto.generateKeyPairSync('rsa', { modulusLength: 1024 }).publicKey })).toThrow('2048');
    expect(() => encryptOne('x', { key: crypto.generateKeyPairSync('ed25519').publicKey })).toThrow('Unsupported key type');
    expect(() => encryptOne('x', { key: p256.publicKey, algorithm: 'dir' })).toThrow('does not fit');
  });

  test('another key of the same type does not decrypt', () => {
    expect(() => decryptField(encryptOne('x'), crypto.randomBytes(32))).toThrow();
    const other = crypto.generateKeyPairSync('x25519');
    expect(() => decryptField(encryptOne('x', { key: x25519.publicKey }), other.privateKey)).toThrow();
  });
});

describe('a changed value is refused', () => {
  const rsa = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const flip = (bytes: Buffer) => { bytes[0]! ^= 1; return bytes; };

  test.each([['encrypted key', 1], ['IV', 2], ['ciphertext', 3], ['tag', 4]])('%s', (_name, index) => {
    expect(() => decryptField(withPart(encryptOne('value'), index, flip), key)).toThrow();
  });

  test('truncated tag', () => {
    expect(() => decryptField(withPart(encryptOne('value', { algorithm: 'dir' }), 4, (b) => b.subarray(0, 4)), key)).toThrow('length');
  });

  test.each<[string, Record<string, unknown>]>([
    ['kid', { kid: 'other' }],
    ['alg to dir', { alg: 'dir' }],
    ['alg to none', { alg: 'none' }],
    ['weaker enc', { enc: 'A128GCM' }],
    ['crit', { crit: ['x'], x: 1 }],
    ['zip', { zip: 'DEF' }],
  ])('header: %s', (_name, change) => {
    expect(() => decryptField(withHeader(encryptOne('value'), change), key)).toThrow();
  });

  test('a symmetric value cannot be passed off to a private key', () => {
    expect(() => decryptField(encryptOne('value'), rsa.privateKey)).toThrow('does not fit');
  });

  test.each(['', 'a.b.c.d.e', 'eyJ.x', 'not a jwe', `${'a'.repeat(50)}....`])('malformed: %p', (value) => {
    expect(isEncryptedField(value)).toBe(false);
    expect(() => decryptField(value, key)).toThrow();
  });

  test('characters outside base64url', () => {
    const value = encryptOne('value');
    expect(() => decryptField(value + '=', key)).toThrow();
  });
});

describe('LineEncryptor', () => {
  let dir: string;
  beforeEach(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), 'zario-enc-')); });
  afterEach(() => { fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5 }); });

  test.each([['sync', false], ['queued', true]])('FileTransport writes only encrypted lines, %s', async (_name, queued) => {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('x25519');
    const file = path.join(dir, 'app.log');
    const logger = new Logger({
      json: true, async: queued, level: 'info', queueProvider: new MemoryQueueProvider(),
      transports: [new FileTransport({ path: file, encryptor: new LineEncryptor({ key: publicKey }) })],
    });
    logger.info('first', { secret: 'S3CRET' });
    logger.error('second\nline');
    await logger.close();
    const text = fs.readFileSync(file, 'utf8');
    expect(text).not.toMatch(/S3CRET|first|second/);
    const lines = text.trim().split('\n').map((line) => JSON.parse(decryptLine(line, privateKey)));
    expect(lines.map((line) => line.message)).toEqual(['first', 'second\nline']);
    expect(lines[0].secret).toBe('S3CRET');
  });

  test('a field is not accepted as a line, or a line as a field', () => {
    expect(() => decryptLine(encryptOne('x'), key)).toThrow('not an encrypted line');
    expect(() => decryptField(new LineEncryptor({ key }).encryptLine('"x"'), key)).toThrow('not an encrypted field');
  });
});
