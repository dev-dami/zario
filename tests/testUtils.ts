import { Transport } from '../src/transports/Transport';
import { LogData } from '../src/types';
import { Formatter } from '../src/core/Formatter';

// Mock Transport for testing
export class MockTransport implements Transport {
  public logs: LogData[] = [];
  write(data: LogData, formatter: Formatter): void {
    this.logs.push(data);
  }
}