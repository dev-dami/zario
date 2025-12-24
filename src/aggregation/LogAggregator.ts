import { LogData } from '../types/index.js';
import { Formatter } from '../core/Formatter.js';

/**
 * Interface for log aggregation targets
 */
export interface LogAggregator {
  /**
   * Process a log record for aggregation
   * @param logData The structured log record
   * @param formatter The formatter used for the log
   */
  aggregate(logData: LogData, formatter: Formatter): void;
  
  /**
   * Flush any pending aggregated logs
   */
  flush(): Promise<void> | void;
}

/**
 * Aggregates logs in memory and flushes them in batches
 */
export class BatchAggregator implements LogAggregator {
  private logs: { logData: LogData, formatter: Formatter }[] = [];
  private maxSize: number;
  private flushCallback: (logs: { logData: LogData, formatter: Formatter }[]) => Promise<void> | void;

  constructor(
    maxSize: number = 100,
    flushCallback: (logs: { logData: LogData, formatter: Formatter }[]) => Promise<void> | void
  ) {
    this.maxSize = maxSize;
    this.flushCallback = flushCallback;
  }

  aggregate(logData: LogData, formatter: Formatter): void {
    this.logs.push({ logData, formatter });
    
    if (this.logs.length >= this.maxSize) {
      this.flush();
    }
  }

  flush(): Promise<void> | void {
    if (this.logs.length > 0) {
      const logsToFlush = [...this.logs];
      this.logs = [];
      
      return this.flushCallback(logsToFlush);
    }
  }
}

/**
 * Aggregates logs based on a time interval
 */
export class TimeBasedAggregator implements LogAggregator {
  private logs: { logData: LogData, formatter: Formatter }[] = [];
  private flushInterval: number;
  private flushCallback: (logs: { logData: LogData, formatter: Formatter }[]) => Promise<void> | void;
  private timer: NodeJS.Timeout | null = null;

  constructor(
    flushInterval: number, // in milliseconds
    flushCallback: (logs: { logData: LogData, formatter: Formatter }[]) => Promise<void> | void
  ) {
    this.flushInterval = flushInterval;
    this.flushCallback = flushCallback;
  }

  aggregate(logData: LogData, formatter: Formatter): void {
    this.logs.push({ logData, formatter });
    
    // Start the timer if it's not already running
    if (!this.timer) {
      this.timer = setTimeout(() => {
        this.flush();
      }, this.flushInterval);
    }
  }

  flush(): Promise<void> | void {
    if (this.logs.length > 0 && this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
      
      const logsToFlush = [...this.logs];
      this.logs = [];
      
      return this.flushCallback(logsToFlush);
    }
  }
}

/**
 * Combines multiple aggregators
 */
export class CompositeAggregator implements LogAggregator {
  private aggregators: LogAggregator[];

  constructor(aggregators: LogAggregator[]) {
    this.aggregators = aggregators;
  }

  aggregate(logData: LogData, formatter: Formatter): void {
    for (const aggregator of this.aggregators) {
      aggregator.aggregate(logData, formatter);
    }
  }

  flush(): Promise<void> | void {
    const results: (Promise<void> | void)[] = [];
    for (const aggregator of this.aggregators) {
      const result = aggregator.flush();
      if (result) {
        results.push(result);
      }
    }

    // If any aggregator returns a promise, wait for all of them
    if (results.some(r => r instanceof Promise)) {
      const promiseResults = results.filter(r => r instanceof Promise) as Promise<void>[];
      return Promise.all(promiseResults).then(() => {});
    }
  }
}