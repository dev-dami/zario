import { Redactor } from "./Redactor.js";
import { serialize } from "./serialize.js";
import { createEncrypter, decryptJwe, readHeader } from "./jwe.js";
import type { Encrypter, EncryptionKey, KeyAlgorithm } from "./jwe.js";

export interface EncryptorOptions {
  /**
   * A 32-byte symmetric key, or a public key (RSA, P-256, P-384, P-521, X25519) as PEM, JWK or KeyObject.
   * With a public key, the server that writes the logs cannot read the values back.
   */
  key: EncryptionKey;
  /** Stored in the JWE header as `kid`, so that the reader can pick the key after a rotation. Default: `"default"` */
  keyId?: string;
  /** The JWE `alg`. Default: `A256KW` for a symmetric key, `RSA-OAEP-256` for RSA, `ECDH-ES` for the curves. */
  algorithm?: KeyAlgorithm;
}

export interface FieldEncryptorOptions extends EncryptorOptions {
  /** Field paths to encrypt, with the same syntax as `redact`, e.g. `['user.email', '**.ssn']`. */
  paths: string[];
}

const FIELD_TYP = "zario-field+jwe";
const LINE_TYP = "zario-line+jwe";

/**
 * Encrypts selected metadata fields before any transport sees them. Each value becomes a JWE
 * compact string (RFC 7516) with A256GCM content encryption, so any JOSE library can read it.
 *
 * @example
 * ```ts
 * const log = zario({
 *   encryptor: new FieldEncryptor({ paths: ['user.email'], key: process.env.LOG_KEY! }),
 * });
 * ```
 */
export class FieldEncryptor extends Redactor {
  private readonly encrypter: Encrypter;
  // Values that this call encrypted, so that two paths to one field do not encrypt it twice.
  private readonly done = new Set<unknown>();

  constructor(options: FieldEncryptorOptions) {
    super({ paths: options.paths });
    this.encrypter = createEncrypter(options.key, {
      keyId: options.keyId ?? "default", typ: FIELD_TYP, algorithm: options.algorithm,
    });
  }

  /** Return a copy of the metadata with the configured fields encrypted. */
  encrypt(metadata: Record<string, unknown>): Record<string, unknown> {
    this.done.clear();
    return this.redact(metadata);
  }

  protected override replace(value: unknown): string {
    if (this.done.has(value)) return value as string;
    const result = this.encrypter(serialize(value));
    this.done.add(result);
    return result;
  }
}

/** Whether a value is a field that FieldEncryptor encrypted. */
export function isEncryptedField(value: unknown): value is string {
  return readHeader(value)?.typ === FIELD_TYP;
}

/**
 * Decrypt a value that FieldEncryptor wrote. Pass one key, or a map from keyId to key
 * to read values written with old keys. It throws if the value was changed.
 */
export function decryptField(value: string, keys: EncryptionKey | Record<string, EncryptionKey>): unknown {
  if (!isEncryptedField(value)) throw new Error("decryptField: the value is not an encrypted field");
  return JSON.parse(decryptJwe(value, keys));
}

/** Encrypts whole log lines, for the `encryptor` option of FileTransport. Each line is one JWE. */
export class LineEncryptor {
  private readonly encrypter: Encrypter;

  constructor(options: EncryptorOptions) {
    this.encrypter = createEncrypter(options.key, {
      keyId: options.keyId ?? "default", typ: LINE_TYP, algorithm: options.algorithm,
    });
  }

  encryptLine(line: string): string {
    return this.encrypter(line);
  }
}

/** Decrypt one line of a file that LineEncryptor wrote. It throws if the line was changed. */
export function decryptLine(line: string, keys: EncryptionKey | Record<string, EncryptionKey>): string {
  if (readHeader(line)?.typ !== LINE_TYP) throw new Error("decryptLine: the line is not an encrypted line");
  return decryptJwe(line, keys);
}
