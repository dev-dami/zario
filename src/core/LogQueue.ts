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
   * Default: 250
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
  private queue: LogData[] = [];
  private formatter!: Formatter;
  private transports: Transport[] = [];
  private timer: NodeJS.Timeout | null = null;
  private deferredFlushScheduled = false;
  private deferredTimer: any = null;
  
  private readonly maxQueueSize: number;
  private readonly flushInterval: number;
  private readonly batchSize: number;
  private readonly overflowStrategy: OverflowStrategy;
  private isFlushing = false;

  constructor(options: MemoryQueueOptions = {}) {
    this.maxQueueSize = options.maxQueueSize ?? 10000;
    this.flushInterval = options.flushInterval ?? 0;
    this.batchSize = options.batchSize ?? 100;
    this.overflowStrategy = options.overflowStrategy ?? 'drop-oldest';
    this.startTimer();
  }

  enqueue(log: LogData, formatter: Formatter, transports: Transport[]): void {
    this.formatter = formatter;
    this.transports = transports;

    if (this.queue.length >= this.maxQueueSize) {
      if (this.overflowStrategy === 'drop-oldest') {
        this.queue.shift();
      } else if (this.overflowStrategy === 'drop-newest') {
        return;
      } else if (this.overflowStrategy === 'sync') {
        this.dispatchSync([log]);
        return;
      }
    }

    this.queue.push(log);

    if (this.queue.length >= this.batchSize) {
      this.flush().catch((err) => {
        console.error('Error during auto-flush:', err);
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
          console.error('Error during deferred flush:', err);
        });
      });
    }
  }

  private startTimer(): void {
    if (this.flushInterval > 0 && !this.timer) {
      this.timer = setInterval(() => {
        if (this.queue.length > 0) {
          this.flush().catch((err) => {
            console.error('Error during interval flush:', err);
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

  async flush(): Promise<void> {
    if (this.isFlushing || this.queue.length === 0 || this.transports.length === 0) {
      return;
    }

    this.isFlushing = true;
    const batch = this.queue;
    this.queue = [];

    try {
      const promises: Promise<void>[] = [];
      const transports = this.transports;
      const formatter = this.formatter;

      for (let i = 0; i < transports.length; i++) {
        const t = transports[i];
        if (!t) continue;

        if (t.writeBatch) {
          const res = t.writeBatch(batch, formatter);
          if (res instanceof Promise) {
            promises.push(res);
          }
        } else if (t.writeAsync) {
          for (let j = 0; j < batch.length; j++) {
            const item = batch[j];
            if (item) {
              const res = t.writeAsync(item, formatter);
              if (res instanceof Promise) {
                promises.push(res);
              }
            }
          }
        } else {
          for (let j = 0; j < batch.length; j++) {
            const item = batch[j];
            if (item) {
              t.write(item, formatter);
            }
          }
        }
      }

      if (promises.length > 0) {
        await Promise.all(promises);
      }
    } catch (err) {
      console.error('Error during async logging:', err);
    } finally {
      this.isFlushing = false;
    }
  }

  private dispatchSync(batch: LogData[]): void {
    const transports = this.transports;
    const formatter = this.formatter;

    for (let i = 0; i < transports.length; i++) {
      const t = transports[i];
      if (!t) continue;

      if (t.writeBatch) {
        t.writeBatch(batch, formatter);
      } else {
        for (let j = 0; j < batch.length; j++) {
          const item = batch[j];
          if (item) {
            t.write(item, formatter);
          }
        }
      }
    }
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
