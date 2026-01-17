import * as fs from 'fs';

export interface BufferedWriteStreamOptions {
  bufferSize?: number;
  flushInterval?: number;
}

export class BufferedWriteStream {
  private fd: number | null = null;
  private buffer: string[] = [];
  private bufferLength = 0;
  private readonly bufferSize: number;
  private readonly flushInterval: number;
  private flushTimer: NodeJS.Timeout | null = null;
  private writePromise: Promise<void> | null = null;
  private closed = false;
  private readonly filePath: string;

  constructor(filePath: string, options: BufferedWriteStreamOptions = {}) {
    this.filePath = filePath;
    this.bufferSize = options.bufferSize ?? 16384;
    this.flushInterval = options.flushInterval ?? 100;
    this.fd = fs.openSync(filePath, 'a');
    this.startFlushTimer();
  }

  write(data: string): void {
    if (this.closed) {
      return;
    }

    this.buffer.push(data);
    this.bufferLength += Buffer.byteLength(data, 'utf8');

    if (this.bufferLength >= this.bufferSize) {
      this.flush();
    }
  }

  async writeAsync(data: string): Promise<void> {
    if (this.closed) {
      return;
    }

    this.buffer.push(data);
    this.bufferLength += Buffer.byteLength(data, 'utf8');

    if (this.bufferLength >= this.bufferSize) {
      await this.flushAsync();
    }
  }

  flush(): void {
    if (this.buffer.length === 0 || this.fd === null) {
      return;
    }

    const content = this.buffer.join('');
    this.buffer = [];
    this.bufferLength = 0;

    try {
      fs.writeSync(this.fd, content);
    } catch (error) {
      console.error('BufferedWriteStream flush error:', error);
    }
  }

  async flushAsync(): Promise<void> {
    if (this.fd === null) {
      return;
    }

    if (this.writePromise) {
      await this.writePromise;
    }

    if (this.buffer.length === 0) {
      return;
    }

    const content = this.buffer.join('');
    this.buffer = [];
    this.bufferLength = 0;

    this.writePromise = new Promise<void>((resolve, reject) => {
      fs.write(this.fd!, content, (err) => {
        this.writePromise = null;
        if (err) {
          console.error('BufferedWriteStream async flush error:', err);
          reject(err);
        } else {
          resolve();
        }
      });
    });

    return this.writePromise;
  }

  private startFlushTimer(): void {
    if (this.flushInterval > 0 && !this.flushTimer) {
      this.flushTimer = setInterval(() => {
        if (this.buffer.length > 0) {
          this.flushAsync().catch(err => {
            console.error('BufferedWriteStream timer flush error:', err);
          });
        }
      }, this.flushInterval);
    }
  }

  getCurrentSize(): number {
    if (this.fd === null) {
      return 0;
    }
    try {
      return fs.fstatSync(this.fd).size + this.bufferLength;
    } catch {
      return this.bufferLength;
    }
  }

  reopen(): void {
    if (this.fd !== null) {
      try {
        fs.closeSync(this.fd);
      } catch { }
    }
    this.fd = fs.openSync(this.filePath, 'a');
  }

  async close(): Promise<void> {
    this.closed = true;

    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }

    await this.flushAsync();

    if (this.fd !== null) {
      fs.closeSync(this.fd);
      this.fd = null;
    }
  }

  get path(): string {
    return this.filePath;
  }
}
