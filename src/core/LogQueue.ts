import { LogData } from '../types/index.js';
import { Formatter } from './Formatter.js';
import { Transport } from '../transports/Transport.js';

export type OverflowStrategy = 'drop-oldest' | 'drop-newest' | 'sync';

export interface QueueProvider {
  /**
   * Add a log entry to the queue.
   */
  enqueue(log: LogData, formatter: Formatter, transports: Transport[]): void;
  
  /**
   * Flush all buffered logs to the transports immediately.
   */
  flush(): Promise<void>;
  
  /**
   * Stop any active timers and perform a final flush.
   */
  destroy(): Promise<void>;
}

export interface MemoryQueueOptions {
  /**
   * Maximum size of the queue before invoking the overflow strategy.
   * Default: 10000
   */
  maxQueueSize?: number;

  /**
   * Interval in milliseconds to flush buffered logs.
   * Set to 0 to disable interval flushing.
   * Default: 0 (next-tick flushing)
   */
  flushInterval?: number;

  /**
   * Maximum size of the batch to write to transports.
   * Default: 100
   */
  batchSize?: number;

  /**
   * Strategy to use when the queue is full.
   * - 'drop-oldest': Drops the oldest item from the queue to make room.
   * - 'drop-newest': Ignores the new log entry.
   * - 'sync': Writes the log entry synchronously to the transports.
   * Default: 'drop-oldest'
   */
  overflowStrategy?: OverflowStrategy;
}

export class MemoryQueueProvider implements QueueProvider {
  private queue: Array<{ log: LogData; formatter: Formatter; transports: Transport[] }> = [];
  private flushPromise: Promise<void> | null = null;
  private timer: NodeJS.Timeout | null = null;
  private deferredFlushScheduled = false;
  private deferredTimer: any = null;
  
  private readonly maxQueueSize: number;
  private readonly flushInterval: number;
  private readonly batchSize: number;
  private readonly overflowStrategy: OverflowStrategy;

  constructor(options: MemoryQueueOptions = {}) {
    this.maxQueueSize = options.maxQueueSize ?? 10000;
    this.flushInterval = options.flushInterval ?? 0;
    this.batchSize = options.batchSize ?? 100;
    this.overflowStrategy = options.overflowStrategy ?? 'drop-oldest';
    this.startTimer();
  }

  enqueue(log: LogData, formatter: Formatter, transports: Transport[]): void {
    if (this.queue.length >= this.maxQueueSize) {
      if (this.overflowStrategy === 'drop-oldest') {
        this.queue.shift();
      } else if (this.overflowStrategy === 'drop-newest') {
        return;
      } else if (this.overflowStrategy === 'sync') {
        this.dispatchSync(log, formatter, transports);
        return;
      }
    }

    this.queue.push({ log, formatter, transports });

    if (this.queue.length >= this.batchSize) {
      this.flush().catch((err) => {
        console.error('Error during async logging:', err);
      });
    } else {
      this.scheduleDeferredFlush();
    }
  }

  private scheduleDeferredFlush(): void {
    if (this.flushInterval <= 0 && !this.deferredFlushScheduled) {
      this.deferredFlushScheduled = true;
      this.deferredTimer = setImmediate(() => {
        this.deferredFlushScheduled = false;
        this.deferredTimer = null;
        this.flush().catch((err) => {
          console.error('Error during async logging:', err);
        });
      });
    }
  }

  private startTimer(): void {
    if (this.flushInterval > 0 && !this.timer) {
      this.timer = setInterval(() => {
        if (this.queue.length > 0) {
          this.flush().catch((err) => {
            console.error('Error during async logging:', err);
          });
        }
      }, this.flushInterval);
    }
  }

  private stopTimer(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  flush(): Promise<void> {
    if (this.flushPromise) return this.flushPromise;
    this.flushPromise = this.drain().finally(() => { this.flushPromise = null; });
    return this.flushPromise;
  }

  private async drain(): Promise<void> {
    const failures: unknown[] = [];
    while (this.queue.length > 0) {
      const entries = this.queue;
      this.queue = [];
      // Group only adjacent entries with the same destination and formatting.
      for (let start = 0; start < entries.length;) {
        const first = entries[start]!;
        let end = start + 1;
        while (end < entries.length && entries[end]!.formatter === first.formatter &&
          entries[end]!.transports.length === first.transports.length &&
          entries[end]!.transports.every((transport, index) => transport === first.transports[index])) end++;
        const batch = entries.slice(start, end).map((entry) => entry.log);
        const results = await Promise.allSettled(first.transports.map(async (transport) => {
          if (transport.writeBatch) {
            await transport.writeBatch(batch, first.formatter);
          } else {
            for (const log of batch) {
              if (transport.writeAsync) await transport.writeAsync(log, first.formatter);
              else transport.write(log, first.formatter);
            }
          }
        }));
        for (const result of results) {
          if (result.status === "rejected") failures.push(result.reason);
        }
        start = end;
      }
    }
    if (failures.length) throw failures[0];
  }

  private dispatchSync(log: LogData, formatter: Formatter, transports: Transport[]): void {
    // The overflow policy promises a synchronous write, not a detached batch.
    for (const transport of transports) transport.write(log, formatter);
  }

  async destroy(): Promise<void> {
    this.stopTimer();
    if (this.deferredTimer) {
      clearImmediate(this.deferredTimer);
      this.deferredTimer = null;
      this.deferredFlushScheduled = false;
    }
    await this.flush();
  }
}
