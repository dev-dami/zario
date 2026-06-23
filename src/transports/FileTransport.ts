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
  batchInterval?: number; // no batching
  compressOldFiles?: boolean; // compress old files
  maxQueueSize?: number; // maximum number of items in batch queue
}

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
  private currentSize: number = 0;
  private rotationSequence: number = 0;

  constructor(options: FileTransportOptions) {
    const {
      path: filePath,
      maxSize = 10 * 1024 * 1024,
      maxFiles = 5,
      compression = "none",
      compressOldFiles = true,
    } = options;
    this.filePath = filePath;
    this.maxSize = maxSize;
    this.maxFiles = maxFiles;
    this.compression = compression;
    this.compressOldFiles = compressOldFiles;

    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    if (!fs.existsSync(this.filePath)) {
      fs.writeFileSync(this.filePath, "", "utf8");
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
    const output = formatter.format(data);
    const formattedOutput = output + "\n";
    const bytes = Buffer.byteLength(formattedOutput, 'utf8');

    fs.appendFileSync(this.filePath, formattedOutput);
    this.currentSize += bytes;
    if (this.shouldRotate()) {
      this.rotateFiles();
    }
  }

  async writeAsync(data: LogData, formatter: Formatter): Promise<void> {
    const formattedOutput = formatter.format(data) + "\n";
    const bytes = Buffer.byteLength(formattedOutput, 'utf8');

    await fs.promises.appendFile(this.filePath, formattedOutput);
    this.currentSize += bytes;
    if (this.shouldRotate()) {
      await this.rotateFilesAsync();
    }
  }

  async writeBatch(batch: LogData[], formatter: Formatter): Promise<void> {
    if (batch.length === 0) return;
    const formattedOutput = batch.map((data) => formatter.format(data) + "\n").join("");
    const bytes = Buffer.byteLength(formattedOutput, 'utf8');

    await fs.promises.appendFile(this.filePath, formattedOutput);
    this.currentSize += bytes;
    if (this.shouldRotate()) {
      await this.rotateFilesAsync();
    }
  }

  private shouldRotate(): boolean {
    return this.currentSize >= this.maxSize;
  }

  private rotateFiles(): void {
    try {
      if (!fs.existsSync(this.filePath)) return;
      const content = fs.readFileSync(this.filePath, "utf8");
      this.performRotation(content, (targetPath: string, data: any, encoding?: BufferEncoding) => {
        if (encoding) {
          fs.writeFileSync(targetPath, data, encoding);
        } else {
          fs.writeFileSync(targetPath, data);
        }
      });
      this.currentSize = 0;
      this.cleanupOldFiles();
    } catch (error) {
      console.error("Error during file rotation:", error);
    }
  }

  private async rotateFilesAsync(): Promise<void> {
    try {
      if (!fs.existsSync(this.filePath)) return;
      const content = await fs.promises.readFile(this.filePath, "utf8");
      await this.performRotationAsync(content);
      this.currentSize = 0;
      await this.cleanupOldFilesAsync();
    } catch (error) {
      console.error("Error during async file rotation:", error);
    }
  }

  private performRotation(content: string, writeFn: (path: string, data: any, enc?: any) => void): void {
    let rotatedFilePath = this.getRotatedFilePath();
    if (this.compression !== "none" && this.compressOldFiles) {
      rotatedFilePath += `.${this.compression === "gzip" ? "gz" : "deflate"}`;
      const compressed = this.compression === "gzip" ? zlib.gzipSync(content) : zlib.deflateSync(content);
      writeFn(rotatedFilePath, compressed);
    } else {
      writeFn(rotatedFilePath, content, "utf8");
    }
    writeFn(this.filePath, "", "utf8");
  }

  private async performRotationAsync(content: string): Promise<void> {
    let rotatedFilePath = this.getRotatedFilePath();
    if (this.compression !== "none" && this.compressOldFiles) {
      rotatedFilePath += `.${this.compression === "gzip" ? "gz" : "deflate"}`;
      const compressed = this.compression === "gzip" ? await compressGzip(content) : await compressDeflate(content);
      await fs.promises.writeFile(rotatedFilePath, compressed);
    } else {
      await fs.promises.writeFile(rotatedFilePath, content, "utf8");
    }
    await fs.promises.writeFile(this.filePath, "", "utf8");
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
    // No-op since internal batch queue was removed
  }
}
