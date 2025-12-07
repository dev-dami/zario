import { Transport } from "./Transport";
import { LogData } from "../types";
import { Formatter } from "../core/Formatter";
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

  // batching funct
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
    } = options;
    this.filePath = filePath;
    this.maxSize = maxSize;
    this.maxFiles = maxFiles;
    this.compression = compression;
    this.batchInterval = batchInterval;
    this.compressOldFiles = compressOldFiles;

    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    if (!fs.existsSync(this.filePath)) {
      fs.writeFileSync(this.filePath, "", "utf8");
    }

    // Start batching if an interval is set
    if (batchInterval > 0) {
      this.startBatching();
    }
  }

  write(data: LogData, formatter: Formatter): void {
    const output = formatter.format(data);
    const formattedOutput = output + "\n";

    if (this.batchInterval > 0) {
      // Queue entry if batching is enabled
      this.batchQueue.push({
        data: formattedOutput,
        timestamp: new Date(),
      });
    } else {
      // Write immediately when batching is disabled
      fs.appendFileSync(this.filePath, formattedOutput);
      this.rotateIfNeeded();
    }
  }

  async writeAsync(data: LogData, formatter: Formatter): Promise<void> {
    const output = formatter.format(data);
    const formattedOutput = output + "\n";

    if (this.batchInterval > 0) {
      // Queue entry if batching is enabled
      this.batchQueue.push({
        data: formattedOutput,
        timestamp: new Date(),
      });
    } else {
      // Write immediately if batching is disabled
      await new Promise<void>((resolve, reject) => {
        fs.appendFile(this.filePath, formattedOutput, (err) => {
          if (err) {
            reject(err);
            return;
          }
          resolve();
        });
      });
      await this.rotateIfNeededAsync();
    }
  }

  private rotateIfNeeded(): void {
    if (!fs.existsSync(this.filePath)) {
      return;
    }

    try {
      const stats = fs.statSync(this.filePath);
      if (stats.size >= this.maxSize) {
        this.rotateFiles();
      }
    } catch (error) {
      console.error("Error checking file size for rotation:", error);
    }
  }

  private async rotateIfNeededAsync(): Promise<void> {
    if (!fs.existsSync(this.filePath)) {
      return;
    }

    try {
      const stats = fs.statSync(this.filePath);
      if (stats.size >= this.maxSize) {
        await this.rotateFilesAsync();
      }
    } catch (error) {
      console.error("Error during rotation check:", error);
    }
  }

  private rotateFiles(): void {
    try {
      let currentContent = "";
      if (fs.existsSync(this.filePath)) {
        currentContent = fs.readFileSync(this.filePath, "utf8");
      }

      // Generate rotated file path
      let rotatedFilePath = this.getRotatedFilePath();

      // Write compressed content if enabled
      if (this.compression !== "none" && this.compressOldFiles) {
        rotatedFilePath = `${rotatedFilePath}.${this.compression === "gzip" ? "gz" : "zz"}`;
        const compressedData =
          this.compression === "gzip"
            ? zlib.gzipSync(currentContent)
            : zlib.deflateSync(currentContent);
        fs.writeFileSync(rotatedFilePath, compressedData);
      } else {
        fs.writeFileSync(rotatedFilePath, currentContent, "utf8");
      }

      fs.writeFileSync(this.filePath, "", "utf8");
      this.cleanupOldFiles();
    } catch (error) {
      console.error("Error during file rotation:", error);
    }
  }

  private async rotateFilesAsync(): Promise<void> {
    try {
      // Read current file content asynchronously
      let currentContent = "";
      if (fs.existsSync(this.filePath)) {
        currentContent = await fs.promises.readFile(this.filePath, "utf8");
      }

      // Generate rotated file path
      let rotatedFilePath = this.getRotatedFilePath();

      // Write compressed content if enabled
      if (this.compression !== "none" && this.compressOldFiles) {
        rotatedFilePath = `${rotatedFilePath}.${this.compression === "gzip" ? "gz" : "zz"}`;
        const compressedData =
          this.compression === "gzip"
            ? await compressGzip(currentContent)
            : await compressDeflate(currentContent);
        await fs.promises.writeFile(rotatedFilePath, compressedData);
      } else {
        await fs.promises.writeFile(rotatedFilePath, currentContent, "utf8");
      }

      // create new empty current file
      await fs.promises.writeFile(this.filePath, "", "utf8");

      // cleanup old files
      await this.cleanupOldFilesAsync();
    } catch (error) {
      console.error("Error during async file rotation:", error);
    }
  }

  private getRotatedFilePath(): string {
    const dir = path.dirname(this.filePath);
    const baseName = path.basename(this.filePath);
    const timestamp = Date.now();

    return path.join(dir, `${baseName}.${timestamp}`);
  }

  private cleanupOldFiles(): void {
    try {
      const dir = path.dirname(this.filePath);
      const baseName = path.basename(this.filePath);

      try {
        fs.accessSync(dir, fs.constants.F_OK);
      } catch {
        return; // if dir does not exist there nothing to clean up
      }

      // fetch all files in directory
      const allFiles = fs.readdirSync(dir);

      // Filter rotated files: basename.timestamp[.compression]
      const rotatedFiles = allFiles
        .filter((file) => {
          if (!file || file === baseName) {
            return false;
          }

          // Check if file matches basename.timestamp[.compression]
          const pattern = new RegExp(
            `^${baseName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\.\\d+(\\.gz|\\.zz)?$`,
          );
          return pattern.test(file);
        })
        .sort((a, b) => {
          // Extract timestamps and sort newest first
          const timestampA = parseInt(
            a.slice(baseName.length + 1).split(".")[0] || "0",
          );
          const timestampB = parseInt(
            b.slice(baseName.length + 1).split(".")[0] || "0",
          );
          return timestampB - timestampA;
        });

      // Keep only maxFiles rotated files (remove older ones)
      for (let i = this.maxFiles; i < rotatedFiles.length; i++) {
        const file = rotatedFiles[i];
        if (file) {
          // Validate filename for security
          if (
            file.includes("../") ||
            file.includes("..\\") ||
            file.startsWith("..")
          ) {
            continue;
          }

          const fileToDelete = path.join(dir, file);
          const resolvedPath = path.resolve(fileToDelete);
          const resolvedDir = path.resolve(dir);

          if (
            !resolvedPath.startsWith(resolvedDir + path.sep) &&
            resolvedPath !== resolvedDir
          ) {
            continue;
          }

          try {
            fs.unlinkSync(fileToDelete);
          } catch (error) {
            console.error(
              `Failed to delete old log file ${fileToDelete}:`,
              error,
            );
          }
        }
      }
    } catch (error) {
      console.error("Error during cleanup of old files:", error);
    }
  }

  private async cleanupOldFilesAsync(): Promise<void> {
    try {
      const dir = path.dirname(this.filePath);
      const baseName = path.basename(this.filePath);

      // Check if directory exists before attempting to read it
      try {
        await fs.promises.access(dir, fs.constants.F_OK);
      } catch {
        return;
      }

      // Get all files in directory
      const allFiles = await fs.promises.readdir(dir);

      // Filter rotated files: basename.timestamp[.compression]
      const rotatedFiles = allFiles
        .filter((file) => {
          if (!file || file === baseName) {
            return false; // Skip current file
          }

          // Check if file matches basename.timestamp[.compression]
          const pattern = new RegExp(
            `^${baseName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\.\\d+(\\.gz|\\.zz)?$`,
          );
          return pattern.test(file);
        })
        .sort((a, b) => {
          // Extract timestamps and sort newest first
          const timestampA = parseInt(
            a.slice(baseName.length + 1).split(".")[0] || "0",
          );
          const timestampB = parseInt(
            b.slice(baseName.length + 1).split(".")[0] || "0",
          );
          return timestampB - timestampA;
        });

      // Keep only maxFiles rotated files (remove older ones)
      const deletePromises = [];

      for (let i = this.maxFiles; i < rotatedFiles.length; i++) {
        const file = rotatedFiles[i];
        if (file) {
          // Validate filename for security
          if (
            file.includes("../") ||
            file.includes("..\\") ||
            file.startsWith("..")
          ) {
            continue;
          }

          const fileToDelete = path.join(dir, file);
          const resolvedPath = path.resolve(fileToDelete);
          const resolvedDir = path.resolve(dir);

          if (
            !resolvedPath.startsWith(resolvedDir + path.sep) &&
            resolvedPath !== resolvedDir
          ) {
            continue;
          }

          // Check if file exists before attempting to delete
          deletePromises.push(
            fs.promises
              .access(fileToDelete, fs.constants.F_OK)
              .then(() => fs.promises.unlink(fileToDelete))
              .catch((error) => {
                if (error.code !== "ENOENT") {
                  console.error(
                    `Failed to delete old log file ${fileToDelete}:`,
                    error,
                  );
                }
              }),
          );
        }
      }

      await Promise.all(deletePromises);
    } catch (error) {
      console.error("Error during async cleanup of old files:", error);
    }
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
      await this.rotateIfNeededAsync();
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
