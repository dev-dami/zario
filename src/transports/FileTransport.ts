import { Transport } from "./Transport";
import { LogData } from "../core/Logger";
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
    } = options; // 10MB default
    this.filePath = filePath;
    this.maxSize = maxSize;
    this.maxFiles = maxFiles;

    // Ensure the directory exists
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

  private rotateIfNeeded(): void {
    if (!fs.existsSync(this.filePath)) {
      return;
    }

    const stats = fs.statSync(this.filePath);
    if (stats.size > this.maxSize) {
      this.rotateFiles();
    }
  }

  private rotateFiles(): void {
    const rotatedFilePath = `${this.filePath}.${Date.now()}`;
    fs.renameSync(this.filePath, rotatedFilePath);
    this.cleanupOldFiles();
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
        const fileToDelete = path.join(dir, file);
        fs.unlinkSync(fileToDelete);
      }
    }
  }
}
