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
    
    // Ensure the log file exists initially
    if (!fs.existsSync(this.filePath)) {
      fs.writeFileSync(this.filePath, '', 'utf8');
    }
  }

  write(data: LogData, formatter: Formatter): void {
    const output = formatter.format(data);
    const formattedOutput = output + "\n";
    
    // Write to the file FIRST
    fs.appendFileSync(this.filePath, formattedOutput);
    
    // Then check if rotation is needed AFTER writing
    this.rotateIfNeeded();
  }

  async writeAsync(data: LogData, formatter: Formatter): Promise<void> {
    const output = formatter.format(data);
    const formattedOutput = output + "\n";

    // Write to the file FIRST
    await new Promise<void>((resolve, reject) => {
      fs.appendFile(this.filePath, formattedOutput, (err) => {
        if (err) {
          reject(err);
          return;
        }
        resolve();
      });
    });
    
    // Then check if rotation is needed AFTER writing
    await this.rotateIfNeededAsync();
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
      // File might have been deleted or is inaccessible
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
      // Read current file content
      let currentContent = '';
      if (fs.existsSync(this.filePath)) {
        currentContent = fs.readFileSync(this.filePath, 'utf8');
      }
      
      // Create rotated file with current content
      const rotatedFilePath = this.getRotatedFilePath();
      fs.writeFileSync(rotatedFilePath, currentContent, 'utf8');
      
      // Create new empty current file
      fs.writeFileSync(this.filePath, '', 'utf8');
      
      // Cleanup old files
      this.cleanupOldFiles();
    } catch (error) {
      console.error("Error during file rotation:", error);
    }
  }

  private async rotateFilesAsync(): Promise<void> {
    try {
      // Read current file content asynchronously
      let currentContent = '';
      if (fs.existsSync(this.filePath)) {
        currentContent = await fs.promises.readFile(this.filePath, 'utf8');
      }
      
      // Create rotated file with current content
      const rotatedFilePath = this.getRotatedFilePath();
      await fs.promises.writeFile(rotatedFilePath, currentContent, 'utf8');
      
      // Create new empty current file
      await fs.promises.writeFile(this.filePath, '', 'utf8');
      
      // Cleanup old files
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

      // Get all files in directory
      const allFiles = fs.readdirSync(dir);
      
      // Filter for rotated files: basename.timestamp
      const rotatedFiles = allFiles
        .filter((file) => {
          if (!file || file === baseName) {
            return false; // Skip current file
          }
          
          // Check if file matches pattern: basename.timestamp
          const pattern = new RegExp(`^${baseName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\.\\d+$`);
          return pattern.test(file);
        })
        .sort((a, b) => {
          // Extract timestamps and sort in descending order (newest first)
          const timestampA = parseInt(a.split('.').pop() || '0');
          const timestampB = parseInt(b.split('.').pop() || '0');
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
            console.error(`Failed to delete old log file ${fileToDelete}:`, error);
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

      // Get all files in directory
      const allFiles = await fs.promises.readdir(dir);
      
      // Filter for rotated files: basename.timestamp
      const rotatedFiles = allFiles
        .filter((file) => {
          if (!file || file === baseName) {
            return false; // Skip current file
          }
          
          // Check if file matches pattern: basename.timestamp
          const pattern = new RegExp(`^${baseName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\.\\d+$`);
          return pattern.test(file);
        })
        .sort((a, b) => {
          // Extract timestamps and sort in descending order (newest first)
          const timestampA = parseInt(a.split('.').pop() || '0');
          const timestampB = parseInt(b.split('.').pop() || '0');
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
            fs.promises.access(fileToDelete, fs.constants.F_OK)
              .then(() => fs.promises.unlink(fileToDelete))
              .catch(error => {
                // Only log if it's not a "file not found" error
                if (error.code !== 'ENOENT') {
                  console.error(`Failed to delete old log file ${fileToDelete}:`, error);
                }
              })
          );
        }
      }
      
      await Promise.all(deletePromises);
    } catch (error) {
      console.error("Error during async cleanup of old files:", error);
    }
  }
}