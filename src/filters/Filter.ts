import { LogData } from '../types/index.js';

export interface Filter {
  /**
   * Determines if a log record should be emitted
   * @param logData The structured log record
   * @returns true if the log should be emitted, false if it should be filtered out
   */
  shouldEmit(logData: LogData): boolean;
}

export type FilterPredicate = (logData: LogData) => boolean;

/**
 * A filter that combines multiple filters with AND logic
 * Note: With an empty array of filters, this returns true (allows all logs).
 * This follows the mathematical concept of vacuous truth - "all" conditions
 * are satisfied when there are no conditions to check.
 */
export class CompositeFilter implements Filter {
  private filters: Filter[];

  constructor(filters: Filter[]) {
    this.filters = filters;
  }

  shouldEmit(logData: LogData): boolean {
    return this.filters.every(filter => filter.shouldEmit(logData));
  }
}

/**
 * A filter that combines multiple filters with OR logic
 * Note: With an empty array of filters, this returns false (blocks all logs).
 * This is because there are no matching conditions when the filter array is empty.
 */
export class OrFilter implements Filter {
  private filters: Filter[];

  constructor(filters: Filter[]) {
    this.filters = filters;
  }

  shouldEmit(logData: LogData): boolean {
    return this.filters.some(filter => filter.shouldEmit(logData));
  }
}

/**
 * A filter that negates another filter
 */
export class NotFilter implements Filter {
  private filter: Filter;

  constructor(filter: Filter) {
    this.filter = filter;
  }

  shouldEmit(logData: LogData): boolean {
    return !this.filter.shouldEmit(logData);
  }
}

/**
 * A filter based on a predicate function
 */
export class PredicateFilter implements Filter {
  private predicate: FilterPredicate;

  constructor(predicate: FilterPredicate) {
    this.predicate = predicate;
  }

  shouldEmit(logData: LogData): boolean {
    return this.predicate(logData);
  }
}