import { LogData } from '../types/index.js';
import { Formatter } from '../core/Formatter.js';

export interface Transport {
  write(data: LogData, formatter: Formatter): void;
  writeAsync?(data: LogData, formatter: Formatter): Promise<void>;
}