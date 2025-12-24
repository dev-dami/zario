import { Transport } from '../transports/Transport.js';
import { LogData } from '../types/index.js';
import { Formatter } from '../core/Formatter.js';
import { Filter } from '../filters/Filter.js';

/**
 * A transport wrapper that applies filters before writing logs
 */
export class FilterableTransport implements Transport {
  private transport: Transport;
  private filters: Filter[];

  constructor(transport: Transport, filters: Filter[]) {
    this.transport = transport;
    this.filters = filters;
  }

  write(data: LogData, formatter: Formatter): void {
    // Check if the log should be emitted based on all filters
    if (this.filters.every(filter => filter.shouldEmit(data))) {
      this.transport.write(data, formatter);
    }
  }

  writeAsync(data: LogData, formatter: Formatter): Promise<void> {
    // Check if the log should be emitted based on all filters
    if (this.filters.every(filter => filter.shouldEmit(data))) {
      if (this.transport.writeAsync) {
        return this.transport.writeAsync(data, formatter);
      } else {
        return new Promise((resolve, reject) => {
          try {
            this.transport.write(data, formatter);
            resolve();
          } catch (error) {
            reject(error);
          }
        });
      }
    }
    return Promise.resolve();
  }
}