// JWE compact serialization (RFC 7516) with the algorithms of RFC 7518 and RFC 8037.
import {
  KeyObject, constants, createCipheriv, createDecipheriv, createHash, createPrivateKey, createPublicKey,
  createSecretKey, diffieHellman, generateKeyPairSync, getCiphers, privateDecrypt, publicEncrypt, randomBytes, timingSafeEqual,
} from "crypto";

export interface EncryptionJwk {
  kty: string;
  [member: string]: unknown;
}

/**
 * A symmetric key: 32 bytes, as a Buffer, a base64 string or a 64-character hex string.
 * Or a public or private key (RSA, P-256, P-384, P-521, X25519): PEM, JWK or KeyObject.
 */
export type EncryptionKey = Uint8Array | string | KeyObject | EncryptionJwk;

export type KeyAlgorithm = "A256KW" | "dir" | "RSA-OAEP-256" | "ECDH-ES";

export interface Encrypter {
  (plaintext: string): string;
}

const ENC = "A256GCM";
const IV_BYTES = 12;
const TAG_BYTES = 16;
const MIN_RSA_BITS = 2048;
const EC_CURVES: Record<string, string> = { prime256v1: "P-256", secp384r1: "P-384", secp521r1: "P-521" };
const OAEP = { padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: "sha256" };

const encode = (value: string | Uint8Array): string => Buffer.from(value as Uint8Array).toString("base64url");
const decode = (value: string): Buffer => {
  const bytes = Buffer.from(value, "base64url");
  // Node ignores characters that are not base64url. Refuse them, so that one value has one spelling.
  if (bytes.toString("base64url") !== value) throw new Error("JWE: a part is not base64url");
  return bytes;
};

/** Read a key. A private key is only accepted to decrypt: a server that writes logs must not hold it. */
export function toKeyObject(key: EncryptionKey, use: "encrypt" | "decrypt"): KeyObject {
  let result: KeyObject;
  if (key instanceof KeyObject) {
    result = key;
  } else if (typeof key === "string" && key.includes("-----BEGIN")) {
    const isPrivate = key.includes("PRIVATE KEY-----");
    result = isPrivate ? createPrivateKey(key) : createPublicKey(key);
  } else if (typeof key === "object" && !(key instanceof Uint8Array)) {
    if (key.kty === "oct") result = secret(decode(String(key.k)));
    else result = "d" in key
      ? createPrivateKey({ key: key as never, format: "jwk" })
      : createPublicKey({ key: key as never, format: "jwk" });
  } else {
    result = secret(typeof key !== "string"
      ? Buffer.from(key)
      : /^[0-9a-f]{64}$/i.test(key) ? Buffer.from(key, "hex") : Buffer.from(key, "base64"));
  }
  if (result.type === "secret" && result.symmetricKeySize !== 32) {
    throw new Error(`A symmetric key must be 32 bytes, but this key has ${result.symmetricKeySize} bytes`);
  }
  if (use === "encrypt" && result.type === "private") {
    throw new Error("Encrypt with the public key. Keep the private key away from the servers that write logs");
  }
  if (use === "decrypt" && result.type === "public") throw new Error("Decrypt with the private key, not the public key");
  return result;
}

function secret(bytes: Buffer): KeyObject {
  if (bytes.length !== 32) throw new Error(`A symmetric key must be 32 bytes, but this key has ${bytes.length} bytes`);
  return createSecretKey(bytes);
}

// The key decides the algorithm, so a header cannot select a weaker use of a key.
function algorithmsFor(key: KeyObject): KeyAlgorithm[] {
  if (key.type === "secret") return ["A256KW", "dir"];
  if (key.asymmetricKeyType === "rsa") {
    const bits = key.asymmetricKeyDetails?.modulusLength;
    if (bits !== undefined && bits < MIN_RSA_BITS) throw new Error(`An RSA key must have ${MIN_RSA_BITS} bits or more`);
    return ["RSA-OAEP-256"];
  }
  if (key.asymmetricKeyType === "x25519") return ["ECDH-ES"];
  if (key.asymmetricKeyType === "ec") {
    if (!EC_CURVES[String(key.asymmetricKeyDetails?.namedCurve)]) throw new Error("An EC key must be P-256, P-384 or P-521");
    return ["ECDH-ES"];
  }
  throw new Error(`Unsupported key type "${key.asymmetricKeyType}". Use a 32-byte secret, RSA, P-256, P-384, P-521 or X25519`);
}

/** Make a function that writes JWE compact strings with one key. */
export function createEncrypter(key: EncryptionKey, options: { keyId: string; typ: string; algorithm?: KeyAlgorithm | undefined }): Encrypter {
  const keyObject = toKeyObject(key, "encrypt");
  const allowed = algorithmsFor(keyObject);
  const alg = options.algorithm ?? allowed[0]!;
  if (!allowed.includes(alg)) throw new Error(`The algorithm "${alg}" does not fit this key. Use ${allowed.join(" or ")}`);

  const base = { alg, enc: ENC, typ: options.typ, kid: options.keyId };
  const fixedHeader = encode(JSON.stringify(base));
  // A KeyObject, because Node sets up a cipher from it much faster than from a Buffer.
  const kek = keyObject.type === "secret" ? keyObject : undefined;

  return (plaintext) => {
    let header = fixedHeader;
    let contentKey: Uint8Array | KeyObject;
    let encryptedKey = "";
    if (alg === "dir") {
      contentKey = kek!;
    } else if (alg === "ECDH-ES") {
      const ephemeral = generateEphemeral(keyObject);
      header = encode(JSON.stringify({ ...base, epk: publicJwk(ephemeral.publicKey) }));
      contentKey = concatKdf(diffieHellman({ privateKey: ephemeral.privateKey, publicKey: keyObject }), ENC, 256);
    } else {
      contentKey = randomBytes(32);
      encryptedKey = encode(alg === "A256KW" ? wrapKey(kek!, contentKey) : publicEncrypt({ key: keyObject, ...OAEP }, contentKey));
    }
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv("aes-256-gcm", contentKey, iv, { authTagLength: TAG_BYTES });
    cipher.setAAD(Buffer.from(header, "ascii"));
    const data = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
    return `${header}.${encryptedKey}.${encode(iv)}.${encode(data)}.${encode(cipher.getAuthTag())}`;
  };
}

/** Read the protected header of a JWE compact string, or undefined if the value is not one. */
export function readHeader(value: unknown): Record<string, unknown> | undefined {
  if (typeof value !== "string" || !/^[\w-]+(\.[\w-]*){4}$/.test(value)) return undefined;
  try {
    const header: unknown = JSON.parse(decode(value.slice(0, value.indexOf("."))).toString("utf8"));
    return header !== null && typeof header === "object" && !Array.isArray(header) ? header as Record<string, unknown> : undefined;
  } catch {
    return undefined;
  }
}

/** Decrypt a JWE compact string. It throws if the value or its header was changed. */
export function decryptJwe(value: string, keys: EncryptionKey | Record<string, EncryptionKey>): string {
  const header = readHeader(value);
  if (!header) throw new Error("JWE: the value is not a JWE compact string");
  // A header that we do not understand must not be ignored (RFC 7516, section 5.2).
  if ("crit" in header || "zip" in header) throw new Error("JWE: crit and zip are not supported");
  if (header.enc !== ENC) throw new Error(`JWE: unsupported enc "${String(header.enc)}"`);

  const key = toKeyObject(pickKey(keys, header.kid), "decrypt");
  const alg = header.alg as KeyAlgorithm;
  if (!algorithmsFor(key).includes(alg)) throw new Error(`JWE: the algorithm "${String(header.alg)}" does not fit this key`);

  const [protectedHeader, ...parts] = value.split(".") as [string, string, string, string, string];
  const [encryptedKey, iv, data, tag] = parts.map(decode) as [Buffer, Buffer, Buffer, Buffer];
  if (iv.length !== IV_BYTES || tag.length !== TAG_BYTES) throw new Error("JWE: wrong IV or tag length");
  if ((alg === "dir" || alg === "ECDH-ES") && encryptedKey.length) throw new Error(`JWE: "${alg}" must not have an encrypted key`);

  let contentKey: Uint8Array;
  if (alg === "dir") contentKey = key.export();
  else if (alg === "A256KW") contentKey = unwrapKey(key.export(), encryptedKey);
  else if (alg === "RSA-OAEP-256") contentKey = privateDecrypt({ key, ...OAEP }, encryptedKey);
  else {
    // createPublicKey() refuses a point that is not on the curve.
    const epk = createPublicKey({ key: header.epk as never, format: "jwk" });
    contentKey = concatKdf(diffieHellman({ privateKey: key, publicKey: epk }), ENC, 256, partyInfo(header.apu), partyInfo(header.apv));
  }
  if (contentKey.length !== 32) throw new Error("JWE: wrong content key length");

  // Without authTagLength, Node accepts a tag of 4 bytes, which is far easier to forge.
  const decipher = createDecipheriv("aes-256-gcm", contentKey, iv, { authTagLength: TAG_BYTES });
  decipher.setAAD(Buffer.from(protectedHeader, "ascii"));
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}

function pickKey(keys: EncryptionKey | Record<string, EncryptionKey>, kid: unknown): EncryptionKey {
  if (typeof keys === "string" || keys instanceof Uint8Array || keys instanceof KeyObject) return keys;
  if (typeof keys.kty === "string") return keys as EncryptionJwk;
  if (typeof kid !== "string" || !Object.hasOwn(keys, kid)) throw new Error(`No key for keyId "${String(kid)}"`);
  return (keys as Record<string, EncryptionKey>)[kid]!;
}

function partyInfo(value: unknown): Buffer {
  return typeof value === "string" ? decode(value) : Buffer.alloc(0);
}

function generateEphemeral(recipient: KeyObject): { publicKey: KeyObject; privateKey: KeyObject } {
  return recipient.asymmetricKeyType === "x25519"
    ? generateKeyPairSync("x25519")
    : generateKeyPairSync("ec", { namedCurve: EC_CURVES[String(recipient.asymmetricKeyDetails?.namedCurve)]! });
}

function publicJwk(key: KeyObject): Record<string, unknown> {
  const { kty, crv, x, y } = key.export({ format: "jwk" });
  return y === undefined ? { kty, crv, x } : { kty, crv, x, y };
}

/** Concat KDF of NIST SP 800-56A, as RFC 7518 section 4.6.2 uses it. One SHA-256 round is enough for 256 bits. */
export function concatKdf(shared: Uint8Array, algorithm: string, bits: 128 | 256, apu: Uint8Array = Buffer.alloc(0), apv: Uint8Array = Buffer.alloc(0)): Buffer {
  const uint32 = (value: number): Buffer => { const b = Buffer.alloc(4); b.writeUInt32BE(value); return b; };
  const id = Buffer.from(algorithm, "ascii");
  return createHash("sha256")
    .update(Buffer.concat([uint32(1), shared, uint32(id.length), id, uint32(apu.length), apu, uint32(apv.length), apv, uint32(bits)]))
    .digest().subarray(0, bits / 8);
}

const WRAP_IV = Buffer.alloc(8, 0xa6);
const NATIVE_WRAP = "id-aes256-wrap";
const hasNativeWrap = /* @__PURE__ */ getCiphers().includes(NATIVE_WRAP);

/** AES key wrap (RFC 3394). Node has it. Bun does not, so there it is built from AES-ECB blocks. */
export function wrapKey(kek: Uint8Array | KeyObject, key: Uint8Array): Buffer {
  if (!hasNativeWrap) return wrapBlocks(kek instanceof KeyObject ? kek.export() : kek, key);
  const cipher = createCipheriv(NATIVE_WRAP, kek, WRAP_IV);
  return Buffer.concat([cipher.update(key), cipher.final()]);
}

export function wrapBlocks(kek: Uint8Array, key: Uint8Array): Buffer {
  const aes = createCipheriv("aes-256-ecb", kek, null).setAutoPadding(false);
  const n = key.length / 8;
  const out = Buffer.concat([WRAP_IV, key]);
  const block = Buffer.alloc(16);
  for (let j = 0; j < 6; j++) {
    for (let i = 1; i <= n; i++) {
      out.copy(block, 0, 0, 8);
      out.copy(block, 8, i * 8, i * 8 + 8);
      const result = aes.update(block);
      xorCounter(result, n * j + i);
      result.copy(out, 0, 0, 8);
      result.copy(out, i * 8, 8, 16);
    }
  }
  return out;
}

export function unwrapKey(kek: Uint8Array, wrapped: Uint8Array): Buffer {
  if (wrapped.length < 24 || wrapped.length % 8) throw new Error("JWE: the encrypted key has a wrong length");
  const aes = createDecipheriv("aes-256-ecb", kek, null).setAutoPadding(false);
  const n = wrapped.length / 8 - 1;
  const out = Buffer.from(wrapped);
  const block = Buffer.alloc(16);
  for (let j = 5; j >= 0; j--) {
    for (let i = n; i >= 1; i--) {
      out.copy(block, 0, 0, 8);
      xorCounter(block, n * j + i);
      out.copy(block, 8, i * 8, i * 8 + 8);
      const result = aes.update(block);
      result.copy(out, 0, 0, 8);
      result.copy(out, i * 8, 8, 16);
    }
  }
  if (!timingSafeEqual(out.subarray(0, 8), WRAP_IV)) throw new Error("JWE: the key is wrong, or the encrypted key was changed");
  return out.subarray(8);
}

// The counter is 64 bits, but it is at most 6 * n here, so the last 4 bytes hold it.
function xorCounter(block: Buffer, counter: number): void {
  block.writeUInt32BE((block.readUInt32BE(4) ^ counter) >>> 0, 4);
}
