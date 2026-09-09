import { LogData } from '../types/index.js';
import { Formatter } from '../core/Formatter.js';

export interface Transport {
  write(data: LogData, formatter: Formatter): void;
  writeAsync?(data: LogData, formatter: Formatter): Promise<void>;
  writeBatch?(batch: LogData[], formatter: Formatter): void | Promise<void>;
  /** Drain work started by write(), including background network requests. */
  flush?(): void | Promise<void>;
  /** Release owned resources after flushing. */
  close?(): void | Promise<void>;
  /** Legacy cleanup hook, used when close is absent. */
  destroy?(): void | Promise<void>;
  isAsyncSupported?(): boolean;
}