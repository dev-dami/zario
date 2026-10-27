import { serialize } from "../utils/serialize.js";
import { Transport } from "../transports/Transport.js";
import { TransportConfig } from "../types/index.js";
import { LogData } from "../types/index.js";
import { Formatter } from "../core/Formatter.js";
import * as fs from "fs";
import * as path from "path";

export interface DeadLetterQueueOptions {
  transport: TransportConfig;
  maxRetries?: number;
  retryableErrorCodes?: string[];
  deadLetterFile?: string;
  onDeadLetter?: (deadLetter: DeadLetterLog) => void;
  /** Maximum dead letters kept in memory. The oldest is dropped first. Default: 1000 */
  maxDeadLetters?: number;
  /** Maximum background writes from write() that can wait at one time. Later logs become dead letters. Default: 1000 */
  maxPendingWrites?: number;
}

export interface DeadLetterLog extends LogData {
  deadLetterReason: string;
  originalError?: string;
  retryCount: number;
  failedAt: Date;
}

export class DeadLetterQueue implements Transport {
  private transport: Transport;
  private maxRetries: number;
  private retryableErrorCodes: Set<string>;
  private deadLetterFile?: string;
  private onDeadLetter?: (deadLetter: DeadLetterLog) => void;
  private deadLetters: DeadLetterLog[] = [];
  private readonly maxDeadLetters: number;
  private readonly maxPendingWrites: number;
  private readonly pending = new Set<Promise<void>>();

  constructor(options: DeadLetterQueueOptions) {
    const {
      transport,
      maxRetries = 3,
      retryableErrorCodes = ['ECONNREFUSED', 'ETIMEDOUT', 'ECONNRESET', 'ENOTFOUND'],
      deadLetterFile,
      onDeadLetter,
      maxDeadLetters = 1000,
      maxPendingWrites = 1000,
    } = options;

    // Initialize the wrapped transport
    if (typeof transport === 'function') {
      this.transport = (transport as () => Transport)();
    } else {
      this.transport = transport as Transport;
    }

    this.maxRetries = maxRetries;
    this.retryableErrorCodes = new Set(retryableErrorCodes);
    if (deadLetterFile) this.deadLetterFile = deadLetterFile;
    if (onDeadLetter) this.onDeadLetter = onDeadLetter;
    this.maxDeadLetters = maxDeadLetters;
    this.maxPendingWrites = maxPendingWrites;
  }

  write(data: LogData, formatter: Formatter): void {
    if (!this.transport.writeAsync) {
      this.writeWithRetrySync(data, formatter);
      return;
    }
    // write() of an async transport (for example HttpTransport) returns before delivery and does
    // not throw on failure. Use writeAsync() in the background so that each failure becomes a dead letter.
    if (this.pending.size >= this.maxPendingWrites) {
      this.createDeadLetter(data, new Error(`${this.pending.size} writes are pending`), 0);
      return;
    }
    const task = this.writeWithRetry(data, formatter, 0)
      .catch(() => {
        // writeWithRetry() already recorded the dead letter.
      })
      .finally(() => { this.pending.delete(task); });
    this.pending.add(task);
  }

  /** Wait for background writes and the wrapped transport. */
  async flush(): Promise<void> {
    while (this.pending.size) await Promise.all(this.pending);
    await this.transport.flush?.();
  }

  async close(): Promise<void> {
    try { await this.flush(); } finally {
      if (this.transport.close) await this.transport.close();
      else await this.transport.destroy?.();
    }
  }

  async writeAsync(data: LogData, formatter: Formatter): Promise<void> {
    return this.writeWithRetry(data, formatter, 0);
  }

  private writeWithRetrySync(data: LogData, formatter: Formatter): void {
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        this.transport.write(data, formatter);
        return;
      } catch (error) {
        const errorCode = (error as any)?.code || 'UNKNOWN';
        const isRetryable = this.retryableErrorCodes.has(errorCode);
        const hasRetryLeft = attempt < this.maxRetries;

        if (isRetryable && hasRetryLeft) {
          continue;
        }

        this.createDeadLetter(data, error, attempt);
        throw error;
      }
    }
  }

  private async writeWithRetry(data: LogData, formatter: Formatter, attempt: number): Promise<void> {
    try {
      if (this.transport.writeAsync) {
        await this.transport.writeAsync(data, formatter);
      } else {
        this.transport.write(data, formatter);
      }
    } catch (error) {
      const errorCode = (error as any)?.code || 'UNKNOWN';
      
      // Check if this error is retryable
      if (this.retryableErrorCodes.has(errorCode)) {
        if (attempt < this.maxRetries) {
          // Exponential backoff with jitter
          const delay = Math.min(1000 * Math.pow(2, attempt), 30000);
          const jitter = Math.random() * 0.1 * delay;
          await new Promise(resolve => setTimeout(resolve, delay + jitter));
          
          return this.writeWithRetry(data, formatter, attempt + 1);
        }
      }
      
      this.createDeadLetter(data, error, attempt);

      // Re-throw the error for upstream handling
      throw error;
    }
  }

  private createDeadLetter(data: LogData, error: unknown, retryCount: number): void {
    const errorCode = (error as any)?.code || 'UNKNOWN';
    const deadLetter: DeadLetterLog = {
      ...data,
      deadLetterReason: error instanceof Error ? error.message : String(error),
      originalError: errorCode,
      retryCount,
      failedAt: new Date(),
    };

    this.deadLetters.push(deadLetter);
    // A long outage must not make memory grow without a limit.
    if (this.deadLetters.length > this.maxDeadLetters) this.deadLetters.shift();
    this.writeDeadLetterToFile(deadLetter);
    this.onDeadLetter?.(deadLetter);
  }

  private writeDeadLetterToFile(deadLetter: DeadLetterLog): void {
    if (!this.deadLetterFile) return;

    try {
      const directory = path.dirname(this.deadLetterFile);
      if (directory && !fs.existsSync(directory)) {
        fs.mkdirSync(directory, { recursive: true });
      }
      const deadLetterLine = serialize(deadLetter) + '\n';
      fs.appendFileSync(this.deadLetterFile, deadLetterLine, 'utf8');
    } catch (error) {
      console.error('Failed to write dead letter:', error);
    }
  }

  getDeadLetters(): DeadLetterLog[] {
    return [...this.deadLetters];
  }

  clearDeadLetters(): void {
    this.deadLetters = [];
  }

  // Clean up resources
  async destroy(): Promise<void> {
    if (this.transport && typeof (this.transport as any).destroy === 'function') {
      await (this.transport as any).destroy();
    }
  }

  isAsyncSupported(): boolean {
    return true;
  }
}
