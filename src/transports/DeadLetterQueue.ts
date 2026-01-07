import { Transport } from "../transports/Transport.js";
import { TransportConfig } from "../types/index.js";
import { LogData } from "../types/index.js";
import { Formatter } from "../core/Formatter.js";

export interface DeadLetterQueueOptions {
  transport: TransportConfig;
  maxRetries?: number;
  retryableErrorCodes?: string[];
  deadLetterFile?: string;
  onDeadLetter?: (deadLetter: DeadLetterLog) => void;
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

  constructor(options: DeadLetterQueueOptions) {
    const {
      transport,
      maxRetries = 3,
      retryableErrorCodes = ['ECONNREFUSED', 'ETIMEDOUT', 'ECONNRESET', 'ENOTFOUND'],
      deadLetterFile,
      onDeadLetter,
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
  }

  async write(data: LogData, formatter: Formatter): Promise<void> {
    return this.writeWithRetry(data, formatter, 0);
  }

  async writeAsync(data: LogData, formatter: Formatter): Promise<void> {
    return this.writeWithRetry(data, formatter, 0);
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
      
      // This is a permanent failure - create dead letter
      const deadLetter: DeadLetterLog = {
        ...data,
        deadLetterReason: error instanceof Error ? error.message : String(error),
        originalError: errorCode,
        retryCount: attempt,
        failedAt: new Date(),
      };

      this.deadLetters.push(deadLetter);
      
      if (this.deadLetterFile) {
        await this.writeDeadLetterToFile(deadLetter);
      }

      if (this.onDeadLetter) {
        this.onDeadLetter(deadLetter);
      }

      // Re-throw the error for upstream handling
      throw error;
    }
  }

  private async writeDeadLetterToFile(deadLetter: DeadLetterLog): Promise<void> {
    if (!this.deadLetterFile) return;

    try {
      const fs = await import('fs');
      const deadLetterLine = JSON.stringify(deadLetter) + '\n';
      await fs.promises.appendFile(this.deadLetterFile, deadLetterLine);
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