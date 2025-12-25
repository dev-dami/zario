import { LogData } from '../types/index.js';
import { LogLevel } from '../core/LogLevel.js';

export interface Filter {
  shouldEmit(logData: LogData): boolean;
}

export type FilterPredicate = (logData: LogData) => boolean;

export class CompositeFilter implements Filter {
  private filters: Filter[];

  constructor(filters: Filter[]) {
    this.filters = filters;
  }

  shouldEmit(logData: LogData): boolean {
    return this.filters.every(filter => filter.shouldEmit(logData));
  }
}

export class OrFilter implements Filter {
  private filters: Filter[];

  constructor(filters: Filter[]) {
    this.filters = filters;
  }

  shouldEmit(logData: LogData): boolean {
    return this.filters.some(filter => filter.shouldEmit(logData));
  }
}

export class NotFilter implements Filter {
  private filter: Filter;

  constructor(filter: Filter) {
    this.filter = filter;
  }

  shouldEmit(logData: LogData): boolean {
    return !this.filter.shouldEmit(logData);
  }
}

export class PredicateFilter implements Filter {
  private predicate: FilterPredicate;

  constructor(predicate: FilterPredicate) {
    this.predicate = predicate;
  }

  shouldEmit(logData: LogData): boolean {
    return this.predicate(logData);
  }
}

export class LevelFilter implements Filter {
  private allowedLevels: Set<LogLevel>;

  constructor(allowedLevels: LogLevel[]) {
    this.allowedLevels = new Set(allowedLevels);
  }

  shouldEmit(logData: LogData): boolean {
    return this.allowedLevels.has(logData.level);
  }
}

export class PrefixFilter implements Filter {
  private allowedPrefixes: Set<string>;

  constructor(allowedPrefixes: string[]) {
    this.allowedPrefixes = new Set(allowedPrefixes);
  }

  shouldEmit(logData: LogData): boolean {
    if (!logData.prefix) {
      return this.allowedPrefixes.has('');
    }
    return this.allowedPrefixes.has(logData.prefix);
  }
}

export class MetadataFilter implements Filter {
  private requiredMetadata: { [key: string]: any };

  constructor(requiredMetadata: { [key: string]: any }) {
    this.requiredMetadata = requiredMetadata;
  }

  shouldEmit(logData: LogData): boolean {
    if (!logData.metadata) {
      return Object.keys(this.requiredMetadata).length === 0;
    }

    for (const [key, value] of Object.entries(this.requiredMetadata)) {
      if (logData.metadata[key] !== value) {
        return false;
      }
    }
    return true;
  }
}

export class FieldFilter implements Filter {
  private fieldName: string;
  private expectedValue: any;

  constructor(fieldName: string, expectedValue: any) {
    this.fieldName = fieldName;
    this.expectedValue = expectedValue;
  }

  shouldEmit(logData: LogData): boolean {
    if (!logData.metadata) {
      return false;
    }

    return logData.metadata[this.fieldName] === this.expectedValue;
  }
}
