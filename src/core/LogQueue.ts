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
  // Parallel arrays (no per-enqueue wrapper object); head is the oldest pending index.
  private logs: LogData[] = [];
  private formatters: Formatter[] = [];
  private transportLists: Transport[][] = [];
  private head = 0;
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
    if (this.size() >= this.maxQueueSize) {
      if (this.overflowStrategy === 'drop-newest') {
        return;
      } else if (this.overflowStrategy === 'sync') {
        this.dispatchSync(log, formatter, transports);
        return;
      }
      // drop-oldest advances the head cursor in O(1) instead of shift().
      if (this.head < this.logs.length) {
        this.head++;
        this.compactIfNeeded();
      }
    }

    this.logs.push(log);
    this.formatters.push(formatter);
    this.transportLists.push(transports);

    if (this.size() >= this.batchSize) {
      this.flush().catch((err) => {
        console.error('Error during async logging:', err);
      });
    } else {
      this.scheduleDeferredFlush();
    }
  }

  private size(): number {
    return this.logs.length - this.head;
  }

  // Reclaim the dead prefix left by dropped entries.
  private compactIfNeeded(): void {
    if (this.head >= 1024) {
      this.logs = this.logs.slice(this.head);
      this.formatters = this.formatters.slice(this.head);
      this.transportLists = this.transportLists.slice(this.head);
      this.head = 0;
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
        if (this.size() > 0) {
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
    while (this.size() > 0) {
      // Snapshot the pending range; later enqueues append after `end`.
      const logs = this.logs;
      const formatters = this.formatters;
      const transportLists = this.transportLists;
      const start = this.head;
      const end = logs.length;
      this.logs = [];
      this.formatters = [];
      this.transportLists = [];
      this.head = 0;
      // Group only adjacent entries with the same destination and formatting.
      for (let runStart = start; runStart < end;) {
        const formatter = formatters[runStart]!;
        const transports = transportLists[runStart]!;
        let runEnd = runStart + 1;
        if (transports.length === 1) {
          const first = transports[0];
          while (runEnd < end && formatters[runEnd] === formatter &&
            transportLists[runEnd]!.length === 1 &&
            transportLists[runEnd]![0] === first) runEnd++;
        } else {
          while (runEnd < end && formatters[runEnd] === formatter &&
            sameTransports(transportLists[runEnd]!, transports)) runEnd++;
        }
        // Batch array is built at most once per run, only for writeBatch transports.
        let batch: LogData[] | undefined;
        const results = await Promise.allSettled(transports.map(async (transport) => {
          if (transport.writeBatch) {
            batch ??= logs.slice(runStart, runEnd);
            await transport.writeBatch(batch, formatter);
          } else {
            for (let i = runStart; i < runEnd; i++) {
              const log = logs[i]!;
              if (transport.writeAsync) await transport.writeAsync(log, formatter);
              else transport.write(log, formatter);
            }
          }
        }));
        for (const result of results) {
          if (result.status === "rejected") failures.push(result.reason);
        }
        runStart = runEnd;
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

function sameTransports(a: Transport[], b: Transport[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}
