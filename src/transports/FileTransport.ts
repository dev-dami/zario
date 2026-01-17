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
  private batchInterval: number;
  private compressOldFiles: boolean;
  private maxQueueSize: number;
  private currentSize: number = 0;

  private batchQueue: BatchLogEntry[] = [];
  private batchTimer: NodeJS.Timeout | null = null;

  constructor(options: FileTransportOptions) {
    const {
      path: filePath,
      maxSize = 10 * 1024 * 1024,
      maxFiles = 5,
      compression = "none",
      batchInterval = 0, // no batching
      compressOldFiles = true,
      maxQueueSize = 10000, // default maximum queue size
    } = options;
    this.filePath = filePath;
    this.maxSize = maxSize;
    this.maxFiles = maxFiles;
    this.compression = compression;
    this.batchInterval = batchInterval;
    this.compressOldFiles = compressOldFiles;
    this.maxQueueSize = maxQueueSize;

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

    if (batchInterval > 0) {
      this.startBatching();
    }
  }

  write(data: LogData, formatter: Formatter): void {
    const output = formatter.format(data);
    const formattedOutput = output + "\n";
    const bytes = Buffer.byteLength(formattedOutput, 'utf8');

    if (this.batchInterval > 0) {
      if (this.batchQueue.length >= this.maxQueueSize) {
        this.batchQueue.shift();
      }
      this.batchQueue.push({
        data: formattedOutput,
        timestamp: new Date(),
      });
      this.currentSize += bytes;
    } else {
      fs.appendFileSync(this.filePath, formattedOutput);
      this.currentSize += bytes;
      if (this.shouldRotate()) {
        this.rotateFiles();
      }
    }
  }

  async writeAsync(data: LogData, formatter: Formatter): Promise<void> {
    const formattedOutput = formatter.format(data) + "\n";
    const bytes = Buffer.byteLength(formattedOutput, 'utf8');

    if (this.batchInterval > 0) {
      if (this.batchQueue.length >= this.maxQueueSize) {
        this.batchQueue.shift();
      }
      this.batchQueue.push({
        data: formattedOutput,
        timestamp: new Date(),
      });
      this.currentSize += bytes;
    } else {
      await fs.promises.appendFile(this.filePath, formattedOutput);
      this.currentSize += bytes;
      if (this.shouldRotate()) {
        await this.rotateFilesAsync();
      }
    }
  }

  private shouldRotate(): boolean {
    return this.currentSize >= this.maxSize;
  }

  private rotateFiles(): void {
    try {
      if (!fs.existsSync(this.filePath)) return;
      this.performRotationWithStreams();
      this.currentSize = 0;
      this.cleanupOldFiles();
    } catch (error) {
      console.error("Error during file rotation:", error);
    }
  }

  private async rotateFilesAsync(): Promise<void> {
    try {
      if (!fs.existsSync(this.filePath)) return;
      await this.performRotationWithStreamsAsync();
      this.currentSize = 0;
      await this.cleanupOldFilesAsync();
    } catch (error) {
      console.error("Error during async file rotation:", error);
    }
  }

  private performRotation(content: string, writeFn: (path: string, data: any, enc?: any) => void): void {
    let rotatedFilePath = this.getRotatedFilePath();
    if (this.compression !== "none" && this.compressOldFiles) {
      rotatedFilePath += `.${this.compression === "gzip" ? "gz" : "zz"}`;
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
      rotatedFilePath += `.${this.compression === "gzip" ? "gz" : "zz"}`;
      const compressed = this.compression === "gzip" ? await compressGzip(content) : await compressDeflate(content);
      await fs.promises.writeFile(rotatedFilePath, compressed);
    } else {
      await fs.promises.writeFile(rotatedFilePath, content, "utf8");
    }
    await fs.promises.writeFile(this.filePath, "", "utf8");
  }

  private performRotationWithStreams(): void {
    const rotatedFilePath = this.getRotatedFilePath();
    const readStream = fs.createReadStream(this.filePath);
    
    if (this.compression !== "none" && this.compressOldFiles) {
      const compressedFilePath = `${rotatedFilePath}.${this.compression === "gzip" ? "gz" : "zz"}`;
      const writeStream = fs.createWriteStream(compressedFilePath);
      const compressStream = this.compression === "gzip" ? zlib.createGzip() : zlib.createDeflate();
      
      readStream.pipe(compressStream).pipe(writeStream);
      
      writeStream.on('finish', () => {
        fs.writeFileSync(this.filePath, "", "utf8");
      });
      
      writeStream.on('error', (error) => {
        console.error("Error during stream compression:", error);
      });
    } else {
      const writeStream = fs.createWriteStream(rotatedFilePath);
      readStream.pipe(writeStream);
      
      writeStream.on('finish', () => {
        fs.writeFileSync(this.filePath, "", "utf8");
      });
      
      writeStream.on('error', (error) => {
        console.error("Error during stream rotation:", error);
      });
    }
  }

  private async performRotationWithStreamsAsync(): Promise<void> {
    return new Promise((resolve, reject) => {
      const rotatedFilePath = this.getRotatedFilePath();
      const readStream = fs.createReadStream(this.filePath);
      
      if (this.compression !== "none" && this.compressOldFiles) {
        const compressedFilePath = `${rotatedFilePath}.${this.compression === "gzip" ? "gz" : "zz"}`;
        const writeStream = fs.createWriteStream(compressedFilePath);
        const compressStream = this.compression === "gzip" ? zlib.createGzip() : zlib.createDeflate();
        
        readStream.pipe(compressStream).pipe(writeStream);
        
        writeStream.on('finish', async () => {
          try {
            await fs.promises.writeFile(this.filePath, "", "utf8");
            resolve();
          } catch (error) {
            reject(error);
          }
        });
        
        writeStream.on('error', reject);
        readStream.on('error', reject);
        compressStream.on('error', reject);
      } else {
        const writeStream = fs.createWriteStream(rotatedFilePath);
        readStream.pipe(writeStream);
        
        writeStream.on('finish', async () => {
          try {
            await fs.promises.writeFile(this.filePath, "", "utf8");
            resolve();
          } catch (error) {
            reject(error);
          }
        });
        
        writeStream.on('error', reject);
        readStream.on('error', reject);
      }
    });
  }

  private getRotatedFilePath(): string {
    const dir = path.dirname(this.filePath);
    return path.join(dir, `${path.basename(this.filePath)}.${Date.now()}`);
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
          try { fs.unlinkSync(path.join(dir, file)); } catch { }
        }
      }
    } catch { }
  }

  private async cleanupOldFilesAsync(): Promise<void> {
    const dir = path.dirname(this.filePath);
    const baseName = path.basename(this.filePath);
    try {
      const files = await fs.promises.readdir(dir);
      const rotated = this.filterRotatedFiles(files, baseName);
      await Promise.all(rotated.slice(this.maxFiles).map(f =>
        fs.promises.unlink(path.join(dir, f)).catch(() => { })
      ));
    } catch { }
  }

  private startBatching(): void {
    if (this.batchInterval > 0) {
      this.batchTimer = setInterval(() => {
        this.processBatch().catch((error) => {
          console.error("Error in batch processing timer:", error);
        });
      }, this.batchInterval);
    }
  }

  private async processBatch(): Promise<void> {
    if (this.batchQueue.length === 0) {
      return;
    }

    // Atomically capture and clear queue
    const currentBatch = this.batchQueue;
    this.batchQueue = [];

    // Combine queued entries into one batch
    const batchContent = currentBatch.map((entry) => entry.data).join("");

    try {
      await new Promise<void>((resolve, reject) => {
        fs.appendFile(this.filePath, batchContent, (err) => {
          if (err) {
            reject(err);
            return;
          }
          resolve();
        });
      });

      // Rotate if needed after writing
      if (this.shouldRotate()) {
        await this.rotateFilesAsync();
      }
    } catch (error) {
      console.error("Error processing log batch:", error);
      // On error, restore entries for retry (prepend to preserve order)
      this.batchQueue = [...currentBatch, ...this.batchQueue];
    }
  }

  // Clean up resources when the transport is disposed
  public async destroy(): Promise<void> {
    if (this.batchTimer) {
      clearInterval(this.batchTimer);
      this.batchTimer = null;
    }

    // Flush remaining queued entries
    if (this.batchQueue.length > 0) {
      try {
        await this.processBatch();
      } catch (error) {
        console.error("Error processing final batch:", error);
      }
    }
  }
}
