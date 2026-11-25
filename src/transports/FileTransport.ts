import { Transport } from "./Transport.js";
import { LogData } from "../types/index.js";
import { Formatter } from "../core/Formatter.js";
import * as fs from "fs";
import * as path from "path";
import * as zlib from "zlib";
import { promisify } from "util";

const compressGzip = promisify(zlib.gzip);
const compressDeflate = promisify(zlib.deflate);

export type CompressionType = "gzip" | "deflate" | "none";

export interface FileTransportOptions {
  path: string;
  maxSize?: number;
  maxFiles?: number;
  compression?: CompressionType; // type of compression
  compressOldFiles?: boolean; // compress old files
  /** Permissions of new log files on POSIX systems. Default: `0o640`, so other users cannot read them. */
  mode?: number;
  /** Encrypt each line before it is written, for example with a LineEncryptor from `zario/encryption`. */
  encryptor?: { encryptLine(line: string): string };
}

// A colorized formatter is shared with the console transport. Keep ANSI color codes out of the file.
// eslint-disable-next-line no-control-regex
const ANSI_COLOR_PATTERN = /\x1b\[[0-9;]*m/g;
// The file stays open this long, because an open for each line is slow. The limit lets a file that
// another program renamed or deleted, for example logrotate, be created again.
const KEEP_OPEN_MS = 1000;

const stripColor = (output: string): string =>
  output.includes("\x1b[") ? output.replace(ANSI_COLOR_PATTERN, "") : output;

export interface BatchLogEntry {
  data: string;
  timestamp: Date;
}

export class FileTransport implements Transport {
  private filePath: string;
  private maxSize: number;
  private maxFiles: number;
  private compression: CompressionType;
  private compressOldFiles: boolean;
  private encryptor: FileTransportOptions["encryptor"];
  private mode: number;
  private fd: number | undefined;
  private currentSize: number = 0;
  private rotationSequence: number = 0;
  private rotating: Promise<void> | null = null;
  private readonly compressions = new Set<Promise<void>>();

  constructor(options: FileTransportOptions) {
    const {
      path: filePath,
      maxSize = 10 * 1024 * 1024,
      maxFiles = 5,
      compression = "none",
      compressOldFiles = true,
      mode = 0o640,
    } = options;
    this.filePath = filePath;
    this.maxSize = maxSize;
    this.maxFiles = maxFiles;
    this.compression = compression;
    this.compressOldFiles = compressOldFiles;
    this.mode = mode;
    this.encryptor = options.encryptor;

    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    if (!fs.existsSync(this.filePath)) {
      fs.appendFileSync(this.filePath, "", { mode });
      this.currentSize = 0;
    } else {
      try {
        this.currentSize = fs.statSync(this.filePath).size;
      } catch {
        this.currentSize = 0;
      }
    }
  }

  write(data: LogData, formatter: Formatter): void {
    const formattedOutput = this.toLine(data, formatter);
    const bytes = Buffer.byteLength(formattedOutput, 'utf8');

    this.appendSync(formattedOutput, bytes);
    this.currentSize += bytes;
    if (this.shouldRotate()) {
      this.rotateFiles();
    }
  }

  private toLine(data: LogData, formatter: Formatter): string {
    const line = stripColor(formatter.format(data));
    return (this.encryptor ? this.encryptor.encryptLine(line) : line) + "\n";
  }

  private appendSync(output: string, bytes: number): void {
    if (this.fd === undefined) {
      this.fd = fs.openSync(this.filePath, "a", this.mode);
      const { fd } = this;
      setTimeout(() => { if (this.fd === fd) this.closeFile(); }, KEEP_OPEN_MS).unref();
    }
    try {
      let written = fs.writeSync(this.fd, output);
      if (written < bytes) {
        // A full pipe or disk can take only a part of the line.
        const rest = Buffer.from(output);
        while (written < bytes) written += fs.writeSync(this.fd, rest, written);
      }
    } catch (error) {
      this.closeFile();
      throw error;
    }
  }

  private closeFile(): void {
    const { fd } = this;
    if (fd === undefined) return;
    this.fd = undefined;
    try {
      fs.closeSync(fd);
    } catch (error) {
      console.error("Error closing log file:", error);
    }
  }

  async writeAsync(data: LogData, formatter: Formatter): Promise<void> {
    const formattedOutput = this.toLine(data, formatter);
    const bytes = Buffer.byteLength(formattedOutput, 'utf8');

    await fs.promises.appendFile(this.filePath, formattedOutput, { mode: this.mode });
    this.currentSize += bytes;
    if (this.shouldRotate()) {
      await this.rotateOnceAsync();
    }
  }

  async writeBatch(batch: LogData[], formatter: Formatter): Promise<void> {
    if (batch.length === 0) return;
    const formattedOutput = batch.map((data) => this.toLine(data, formatter)).join("");
    const bytes = Buffer.byteLength(formattedOutput, 'utf8');

    await fs.promises.appendFile(this.filePath, formattedOutput, { mode: this.mode });
    this.currentSize += bytes;
    if (this.shouldRotate()) {
      await this.rotateOnceAsync();
    }
  }

  /** Wait for background compression of rotated files. */
  async flush(): Promise<void> {
    while (this.compressions.size) await Promise.all(this.compressions);
  }

  // Concurrent writes share one rotation, so a second rename cannot move the new, empty file.
  private rotateOnceAsync(): Promise<void> {
    this.rotating ??= this.rotateFilesAsync().finally(() => { this.rotating = null; });
    return this.rotating;
  }

  private shouldRotate(): boolean {
    return this.currentSize >= this.maxSize;
  }

  // Rotation renames the file. A rename is atomic, so a write after it goes to the new file and no
  // line is lost. The old copy-then-truncate read the whole file and lost writes made between the two steps.
  private rotateFiles(): void {
    try {
      if (!fs.existsSync(this.filePath)) return;
      const rotatedFilePath = this.getRotatedFilePath();
      this.closeFile();
      fs.renameSync(this.filePath, rotatedFilePath);
      this.currentSize = 0;
      fs.appendFileSync(this.filePath, "", { mode: this.mode });
      if (this.shouldCompress()) {
        this.compressInBackground(rotatedFilePath);
      } else {
        this.cleanupOldFiles();
      }
    } catch (error) {
      console.error("Error during file rotation:", error);
    }
  }

  private async rotateFilesAsync(): Promise<void> {
    try {
      if (!fs.existsSync(this.filePath)) return;
      const rotatedFilePath = this.getRotatedFilePath();
      await fs.promises.rename(this.filePath, rotatedFilePath);
      // A write() during the rename can have the rotated file open.
      this.closeFile();
      this.currentSize = 0;
      await fs.promises.appendFile(this.filePath, "", { mode: this.mode });
      if (this.shouldCompress()) {
        await this.compressRotatedFile(rotatedFilePath);
      } else {
        await this.cleanupOldFilesAsync();
      }
    } catch (error) {
      console.error("Error during async file rotation:", error);
    }
  }

  private shouldCompress(): boolean {
    return this.compression !== "none" && this.compressOldFiles;
  }

  // Compression of a rotated file must not block the event loop in the sync write path.
  private compressInBackground(rotatedFilePath: string): void {
    const task = this.compressRotatedFile(rotatedFilePath)
      .catch((error: unknown) => { console.error("Error during file compression:", error); })
      .finally(() => { this.compressions.delete(task); });
    this.compressions.add(task);
  }

  private async compressRotatedFile(rotatedFilePath: string): Promise<void> {
    const content = await fs.promises.readFile(rotatedFilePath);
    const compressed = this.compression === "gzip" ? await compressGzip(content) : await compressDeflate(content);
    await fs.promises.writeFile(`${rotatedFilePath}.${this.compression === "gzip" ? "gz" : "deflate"}`, compressed, { mode: this.mode });
    await fs.promises.unlink(rotatedFilePath);
    await this.cleanupOldFilesAsync();
  }

  private getRotatedFilePath(): string {
    const dir = path.dirname(this.filePath);
    const uniqueTimestamp = Date.now() * 1000 + (this.rotationSequence++ % 1000);
    return path.join(dir, `${path.basename(this.filePath)}.${uniqueTimestamp}`);
  }

  private filterRotatedFiles(files: string[], baseName: string): string[] {
    return files
      .filter(f => f !== baseName && f.startsWith(baseName + "."))
      .sort((a, b) => {
        const getTs = (s: string) => parseInt(s.slice(baseName.length + 1).split(".")[0] ?? "0");
        return getTs(b) - getTs(a);
      });
  }

  private cleanupOldFiles(): void {
    const dir = path.dirname(this.filePath);
    const baseName = path.basename(this.filePath);
    try {
      const files = fs.readdirSync(dir);
      const rotated = this.filterRotatedFiles(files, baseName);
      for (let i = this.maxFiles; i < rotated.length; i++) {
        const file = rotated[i];
        if (file) {
          try {
            fs.unlinkSync(path.join(dir, file));
          } catch {
            continue;
          }
        }
      }
    } catch {
      return;
    }
  }

  private async cleanupOldFilesAsync(): Promise<void> {
    const dir = path.dirname(this.filePath);
    const baseName = path.basename(this.filePath);
    try {
      const files = await fs.promises.readdir(dir);
      const rotated = this.filterRotatedFiles(files, baseName);
      await Promise.all(rotated.slice(this.maxFiles).map(f =>
        fs.promises.unlink(path.join(dir, f)).catch(() => undefined)
      ));
    } catch {
      return;
    }
  }

  public async destroy(): Promise<void> {
    this.closeFile();
    await this.flush();
  }
}
