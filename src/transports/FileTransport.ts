import { Transport } from "./Transport";
import { LogData } from "../types";
import { Formatter } from "../core/Formatter";
import * as fs from "fs";
import * as path from "path";

export interface FileTransportOptions {
  path: string;
  maxSize?: number;
  maxFiles?: number;
}

export class FileTransport implements Transport {
  private filePath: string;
  private maxSize: number;
  private maxFiles: number;

  constructor(options: FileTransportOptions) {
    const {
      path: filePath,
      maxSize = 10 * 1024 * 1024,
      maxFiles = 5,
    } = options;
    this.filePath = filePath;
    this.maxSize = maxSize;
    this.maxFiles = maxFiles;

    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  write(data: LogData, formatter: Formatter): void {
    const output = formatter.format(data);
    const formattedOutput = output + "\n";
    fs.appendFileSync(this.filePath, formattedOutput);
    this.rotateIfNeeded();
  }

  async writeAsync(data: LogData, formatter: Formatter): Promise<void> {
    const output = formatter.format(data);
    const formattedOutput = output + "\n";

    return new Promise((resolve, reject) => {
      fs.appendFile(this.filePath, formattedOutput, (err) => {
        if (err) {
          reject(err);
          return;
        }
        setImmediate(() => {
          // perform rotation checks async i.e no blocking may need debugging
          this.rotateIfNeededAsync()
            .then(() => resolve())
            .catch(reject);
        });
      });
    });
  }

  private rotateIfNeeded(): void {
    if (!fs.existsSync(this.filePath)) {
      return;
    }

    const stats = fs.statSync(this.filePath);
    if (stats.size > this.maxSize) {
      this.rotateFiles();
    }
  }

  private async rotateIfNeededAsync(): Promise<void> {
    if (!fs.existsSync(this.filePath)) {
      return;
    }

    try {
      const stats = fs.statSync(this.filePath);
      if (stats.size > this.maxSize) {
        await this.rotateFilesAsync();
      }
    } catch (error) {
      console.error("Error during rotation check:", error);
    }
  }

  private rotateFiles(): void {
    const rotatedFilePath = `${this.filePath}.${Date.now()}`;
    fs.renameSync(this.filePath, rotatedFilePath);
    this.cleanupOldFiles();
  }

  private async rotateFilesAsync(): Promise<void> {
    const rotatedFilePath = `${this.filePath}.${Date.now()}`;
    return new Promise((resolve, reject) => {
      fs.rename(this.filePath, rotatedFilePath, (err) => {
        if (err) {
          reject(err);
          return;
        }
        this.cleanupOldFilesAsync().then(resolve).catch(reject);
      });
    });
  }

  private cleanupOldFiles(): void {
    const dir = path.dirname(this.filePath);
    const basename = path.basename(this.filePath);

    const files: string[] = fs
      .readdirSync(dir)
      .filter((file) => file && file.startsWith(basename) && file !== basename)
      .sort()
      .reverse();

    for (let i = this.maxFiles - 1; i < files.length; i++) {
      const file = files[i];
      if (file) {
        // Validate filename
        if (file.includes('../') || file.includes('..\\') || file.startsWith('..')) {
          continue;
        }
        const fileToDelete = path.join(dir, file);
        fs.unlinkSync(fileToDelete);
      }
    }
  }

  private async cleanupOldFilesAsync(): Promise<void> {
    return new Promise((resolve, reject) => {
      const dir = path.dirname(this.filePath);
      const basename = path.basename(this.filePath);

      fs.readdir(dir, (err, allFiles) => {
        if (err) {
          reject(err);
          return;
        }

        const files = allFiles
          .filter(
            (file) => file && file.startsWith(basename) && file !== basename,
          )
          .sort()
          .reverse();

        let completed = 0;
        const toDelete = files.slice(this.maxFiles - 1);

        if (toDelete.length === 0) {
          resolve();
          return;
        }

        for (const file of toDelete) {
          // Validate Filename
          if (file.includes('../') || file.includes('..\\') || file.startsWith('..')) {
            completed++;
            if (completed === toDelete.length) {
              resolve();
            }
            continue;
          }
          const fileToDelete = path.join(dir, file);
          fs.unlink(fileToDelete, (unlinkErr) => {
            completed++;
            if (unlinkErr && completed === toDelete.length) {
              reject(unlinkErr);
              return;
            }
            if (completed === toDelete.length) {
              resolve();
            }
          });
        }

        if (toDelete.length === 0) {
          resolve();
        }
      });
    });
  }
}
