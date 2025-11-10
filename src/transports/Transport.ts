import { LogData } from '../core/Logger';
import { Formatter } from '../core/Formatter';

export interface Transport {
  write(data: LogData, formatter: Formatter): void;
}