import { KeyObject, createHash, createHmac, createSecretKey, randomBytes } from "crypto";
import { createReadStream } from "fs";
import { createInterface } from "readline";
import { createGunzip, createInflate } from "zlib";

/** The newest point of a chain, to store where the server cannot change it. */
export interface Checkpoint {
  chainId: string;
  seq: number;
  hash: string;
  time: string;
}

export interface HashChainOptions {
  /** A secret for HMAC-SHA256. Without it, anyone can compute the hashes, and only checkpoints catch a rewrite. */
  key?: Uint8Array | string;
  /** Called with a checkpoint every `checkpointEvery` lines, every `checkpointInterval` ms, and on close. */
  onCheckpoint?: (checkpoint: Checkpoint) => void;
  /** Default: `1000` lines */
  checkpointEvery?: number;
  /** Default: `60000` ms. `0` turns the timer off. */
  checkpointInterval?: number;
}

export type ChainProblemKind = "modified" | "gap" | "duplicate" | "unchained" | "truncated" | "checkpoint mismatch" | "late start";

export interface ChainProblem {
  kind: ChainProblemKind;
  /** File and line number, for a problem at a line. */
  where?: string;
  chainId?: string;
  seq?: number;
  detail: string;
}

export interface ChainReport {
  /** True when no line was changed, removed or added. A "late start" alone keeps it true. */
  ok: boolean;
  lines: number;
  chains: Array<{ chainId: string; first: number; last: number; lines: number }>;
  problems: ChainProblem[];
}

const ZERO = Buffer.alloc(32).toString("base64url");
const JSON_SUFFIX = /(,?)"_chain":\{"id":"([\w-]+)","seq":(\d+),"hash":"([\w-]{43})"\}\}$/;
const TEXT_SUFFIX = / _chain=([\w-]+):(\d+):([\w-]{43})$/;
const MAX_PROBLEMS = 1000;

function digest(key: KeyObject | undefined, chainId: string, seq: number, previous: string, payload: string): string {
  const input = `${chainId}\n${seq}\n${previous}\n${payload}`;
  return (key ? createHmac("sha256", key) : createHash("sha256")).update(input, "utf8").digest("base64url");
}

// Node sets up an HMAC from a KeyObject about ten times faster than from a Buffer.
function toKey(key: Uint8Array | string | undefined): KeyObject | undefined {
  if (key === undefined) return undefined;
  const bytes = Buffer.from(key as Uint8Array);
  if (bytes.length < 16) throw new Error("HashChain: the key must have at least 16 bytes");
  return createSecretKey(bytes);
}

/**
 * Links each line to the line before it with SHA-256, or HMAC-SHA256 with a key. A change, a
 * removal or an insertion breaks the chain. Each process starts a new chain with a random id.
 */
export class HashChain {
  readonly chainId = randomBytes(9).toString("base64url");
  private readonly key: KeyObject | undefined;
  private readonly onCheckpoint: ((checkpoint: Checkpoint) => void) | undefined;
  private readonly every: number;
  private readonly timer: ReturnType<typeof setInterval> | undefined;
  private seq = 0;
  private previous = ZERO;
  private checkpointed = -1;

  constructor(options: HashChainOptions = {}) {
    this.key = toKey(options.key);
    this.onCheckpoint = options.onCheckpoint;
    this.every = options.checkpointEvery ?? 1000;
    const interval = options.checkpointInterval ?? 60_000;
    if (this.onCheckpoint && interval > 0) {
      this.timer = setInterval(() => this.checkpoint(), interval);
      this.timer.unref?.();
    }
  }

  /** Add the chain fields to one line. JSON lines get a `_chain` member, other lines a ` _chain=` suffix. */
  chainLine(line: string): string {
    const seq = this.seq++;
    const hash = digest(this.key, this.chainId, seq, this.previous, line);
    this.previous = hash;
    const chained = line.endsWith("}") && line.startsWith("{")
      ? `${line.slice(0, -1)}${line === "{}" ? "" : ","}"_chain":{"id":"${this.chainId}","seq":${seq},"hash":"${hash}"}}`
      : `${line} _chain=${this.chainId}:${seq}:${hash}`;
    if (this.onCheckpoint && (seq + 1) % this.every === 0) this.checkpoint();
    return chained;
  }

  /** The newest point of the chain. It also goes to onCheckpoint, if it is new. */
  checkpoint(): Checkpoint | undefined {
    if (this.seq === 0) return undefined;
    const checkpoint = { chainId: this.chainId, seq: this.seq - 1, hash: this.previous, time: new Date().toISOString() };
    if (this.onCheckpoint && checkpoint.seq !== this.checkpointed) {
      this.checkpointed = checkpoint.seq;
      try {
        this.onCheckpoint(checkpoint);
      } catch (error) {
        console.error("HashChain: onCheckpoint failed:", error);
      }
    }
    return checkpoint;
  }

  /** Send the last checkpoint and stop the timer. */
  close(): void {
    if (this.timer) clearInterval(this.timer);
    this.checkpoint();
  }
}

/** Split a chained line into the original line and its chain fields. */
export function unchainLine(line: string): { line: string; chainId: string; seq: number; hash: string } | undefined {
  const json = JSON_SUFFIX.exec(line);
  if (json && line.startsWith("{")) {
    return { line: line.slice(0, json.index) + "}", chainId: json[2]!, seq: Number(json[3]), hash: json[4]! };
  }
  const text = TEXT_SUFFIX.exec(line);
  return text ? { line: line.slice(0, text.index), chainId: text[1]!, seq: Number(text[2]), hash: text[3]! } : undefined;
}

export interface VerifyOptions {
  /** The HMAC key, if the chain used one. */
  key?: Uint8Array | string;
  /** Checkpoints from a store that the log server cannot change. They also catch lines cut from the end. */
  checkpoints?: Checkpoint[];
}

/** Check chained lines. Lines of several chains can be mixed, and in any order. */
export function verifyChain(lines: Iterable<string | { line: string; where: string }>, options: VerifyOptions = {}): ChainReport {
  const verifier = new Verifier(options);
  for (const entry of lines) {
    if (typeof entry === "string") verifier.add(entry, "");
    else verifier.add(entry.line, entry.where);
  }
  return verifier.report();
}

/**
 * Check chained log files, in the order given (oldest first). Rotated `.gz` and `.deflate` files are read too.
 * The files are streamed, so a large file does not need to fit in memory.
 */
export async function verifyChainFiles(paths: string[], options: VerifyOptions = {}): Promise<ChainReport> {
  const verifier = new Verifier(options);
  for (const path of paths) {
    const raw = createReadStream(path);
    const input = path.endsWith(".gz") ? raw.pipe(createGunzip()) : path.endsWith(".deflate") ? raw.pipe(createInflate()) : raw;
    let number = 0;
    for await (const line of createInterface({ input, crlfDelay: Infinity })) {
      number++;
      if (line) verifier.add(line, `${path}:${number}`);
    }
  }
  return verifier.report();
}

interface Entry { seq: number; hash: string; payload: string; where: string }

class Verifier {
  private readonly key: KeyObject | undefined;
  private readonly checkpoints: Checkpoint[];
  private readonly chains = new Map<string, Entry[]>();
  private readonly problems: ChainProblem[] = [];
  private lines = 0;

  constructor(options: VerifyOptions) {
    this.key = toKey(options.key);
    this.checkpoints = options.checkpoints ?? [];
  }

  add(line: string, where: string): void {
    this.lines++;
    const parts = unchainLine(line);
    if (!parts) return this.problem({ kind: "unchained", where, detail: "the line has no chain fields, so it was added or changed" });
    let entries = this.chains.get(parts.chainId);
    if (!entries) this.chains.set(parts.chainId, entries = []);
    entries.push({ seq: parts.seq, hash: parts.hash, payload: parts.line, where });
  }

  report(): ChainReport {
    const chains: ChainReport["chains"] = [];
    for (const [chainId, entries] of this.chains) {
      // Async writes can reach the file out of order. The order of seq is the order of the chain.
      entries.sort((a, b) => a.seq - b.seq);
      const first = entries[0]!;
      if (first.seq !== 0) {
        this.problem({ kind: "late start", chainId, seq: first.seq, where: first.where, detail: `the chain starts at line ${first.seq}: older lines were rotated away or removed` });
      }
      let previous: Entry | undefined;
      for (const entry of entries) {
        if (previous && entry.seq === previous.seq) {
          this.problem({ kind: "duplicate", chainId, seq: entry.seq, where: entry.where, detail: "two lines have the same seq" });
          continue;
        }
        if (previous && entry.seq !== previous.seq + 1) {
          this.problem({ kind: "gap", chainId, seq: previous.seq + 1, where: entry.where, detail: `${entry.seq - previous.seq - 1} line(s) before this line were removed` });
        }
        const before = previous && entry.seq === previous.seq + 1 ? previous.hash : entry.seq === 0 ? ZERO : undefined;
        // After a gap, the previous hash is unknown, so this line cannot be checked.
        if (before !== undefined && digest(this.key, chainId, entry.seq, before, entry.payload) !== entry.hash) {
          this.problem({ kind: "modified", chainId, seq: entry.seq, where: entry.where, detail: this.key ? "the line or its hash was changed, or the key is wrong" : "the line or its hash was changed" });
        }
        previous = entry;
      }
      chains.push({ chainId, first: first.seq, last: previous!.seq, lines: entries.length });
    }
    for (const checkpoint of this.checkpoints) this.check(checkpoint);
    return { ok: this.problems.every((problem) => problem.kind === "late start"), lines: this.lines, chains, problems: this.problems };
  }

  private check(checkpoint: Checkpoint): void {
    const entries = this.chains.get(checkpoint.chainId);
    const entry = entries?.find((candidate) => candidate.seq === checkpoint.seq);
    if (!entries || !entry) {
      const last = entries?.[entries.length - 1]?.seq ?? -1;
      if (last < checkpoint.seq) {
        this.problem({ kind: "truncated", chainId: checkpoint.chainId, seq: checkpoint.seq, detail: `a checkpoint names line ${checkpoint.seq}, but the chain ends at ${last}: lines were cut from the end` });
      }
      return;
    }
    if (entry.hash !== checkpoint.hash) {
      this.problem({ kind: "checkpoint mismatch", chainId: checkpoint.chainId, seq: checkpoint.seq, where: entry.where, detail: "the line does not match its checkpoint: the chain was rewritten" });
    }
  }

  private problem(problem: ChainProblem): void {
    if (this.problems.length < MAX_PROBLEMS) this.problems.push(problem);
  }
}
