import { LogData } from "../types/index.js";
import { Formatter } from "../core/Formatter.js";

//Interface for log aggregation targets
export interface LogAggregator {
  //Process a log record for aggregation
  aggregate(logData: LogData, formatter: Formatter): void;

  //Flush any pending aggregated logs
  flush(): Promise<void> | void;
}

//Aggregates logs in memory and flushes them in batches
export class BatchAggregator implements LogAggregator {
  private logs: { logData: LogData; formatter: Formatter }[] = [];
  private maxSize: number;
  private flushCallback: (
    logs: { logData: LogData; formatter: Formatter }[]
  ) => Promise<void> | void;
  private pendingFlush: Promise<void> | null = null;

  constructor(
    maxSize: number = 100,
    flushCallback: (
      logs: { logData: LogData; formatter: Formatter }[]
    ) => Promise<void> | void
  ) {
    this.maxSize = maxSize;
    this.flushCallback = flushCallback;
  }

  aggregate(logData: LogData, formatter: Formatter): void {
    this.logs.push({ logData, formatter });

    if (this.logs.length >= this.maxSize && !this.pendingFlush) {
      const result = this.flush();
      if (result instanceof Promise) {
        this.pendingFlush = result.finally(() => {
          this.pendingFlush = null;
        });
      }
    }
  }

  flush(): Promise<void> | void {
    if (this.pendingFlush) {
      return this.pendingFlush;
    }

    if (this.logs.length === 0) {
      return;
    }

    const logsToFlush = [...this.logs];
    const originalLogs = [...this.logs];
    this.logs = [];

    try {
      const callbackResult = this.flushCallback(logsToFlush);

      if (callbackResult instanceof Promise) {
        return callbackResult.catch((error) => {
          this.logs = originalLogs;
          throw error;
        });
      }
    } catch (error) {
      this.logs = originalLogs;
      throw error;
    }
  }
}

//Aggregates logs based on a time interval
export class TimeBasedAggregator implements LogAggregator {
  private logs: { logData: LogData; formatter: Formatter }[] = [];
  private flushInterval: number;
  private flushCallback: (
    logs: { logData: LogData; formatter: Formatter }[]
  ) => Promise<void> | void;
  private timer: NodeJS.Timeout | null = null;

  constructor(
    flushInterval: number,
    flushCallback: (
      logs: { logData: LogData; formatter: Formatter }[]
    ) => Promise<void> | void
  ) {
    this.flushInterval = flushInterval;
    this.flushCallback = flushCallback;
  }

  aggregate(logData: LogData, formatter: Formatter): void {
    this.logs.push({ logData, formatter });

    // Start the timer if it's not already running
    if (!this.timer) {
      this.timer = setTimeout(() => {
        const result = this.flush();
        // Handle the case where flush returns a Promise (async flushCallback)
        if (result instanceof Promise) {
          result.catch((error) => {
            console.error(
              "Error in TimeBasedAggregator flush callback:",
              error
            );
          });
        }
      }, this.flushInterval);
    }
  }

  flush(): Promise<void> | void {
    if (this.logs.length > 0) {
      // Clear the timer if it exists
      if (this.timer) {
        clearTimeout(this.timer);
        this.timer = null;
      }

      const logsToFlush = [...this.logs];
      const originalLogs = [...this.logs];
      this.logs = [];

      try {
        const callbackResult = this.flushCallback(logsToFlush);

        if (callbackResult instanceof Promise) {
          return callbackResult.catch((error) => {
            this.logs = originalLogs;
            throw error;
          });
        }
      } catch (error) {
        this.logs = originalLogs;
        throw error;
      }
    }
  }

  //Stop the aggregator and cancel any pending timer without flushing
  stop(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}

//Combines multiple aggregators
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
    if (results.some((r) => r instanceof Promise)) {
      const promiseResults = results.filter(
        (r) => r instanceof Promise
      ) as Promise<void>[];
      return Promise.all(promiseResults).then(() => {});
    }
  }
}
