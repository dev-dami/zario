import { LogData } from '../types/index.js';
import { LogLevel } from '../core/LogLevel.js';
import { Filter } from './Filter.js';

/**
 * A filter that allows logs based on their log level
 */
export class LevelFilter implements Filter {
  private allowedLevels: Set<LogLevel>;

  constructor(allowedLevels: LogLevel[]) {
    this.allowedLevels = new Set(allowedLevels);
  }

  shouldEmit(logData: LogData): boolean {
    return this.allowedLevels.has(logData.level as LogLevel);
  }
}

/**
 * A filter that allows logs based on their prefix/namespace
 */
export class PrefixFilter implements Filter {
  private allowedPrefixes: Set<string>;

  constructor(allowedPrefixes: string[]) {
    this.allowedPrefixes = new Set(allowedPrefixes);
  }

  shouldEmit(logData: LogData): boolean {
    if (!logData.prefix) {
      // If no prefix exists, only allow if empty string is in allowed prefixes
      return this.allowedPrefixes.has('');
    }
    return this.allowedPrefixes.has(logData.prefix);
  }
}

/**
 * A filter that allows logs based on specific metadata fields
 */
export class MetadataFilter implements Filter {
  private requiredMetadata: { [key: string]: any };

  constructor(requiredMetadata: { [key: string]: any }) {
    this.requiredMetadata = requiredMetadata;
  }

  shouldEmit(logData: LogData): boolean {
    if (!logData.metadata) {
      // If no metadata exists but we require some, return false
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

/**
 * A filter that allows logs based on a custom field in metadata
 */
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