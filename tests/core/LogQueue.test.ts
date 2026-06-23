import { Logger } from '../../src/core/Logger';
import { MemoryQueueProvider, QueueProvider } from '../../src/core/LogQueue';
import { Transport } from '../../src/transports/Transport';
import { LogData } from '../../src/types';
import { Formatter } from '../../src/core/Formatter';

class MockTransport implements Transport {
  public logs: LogData[] = [];
  public batchedLogs: LogData[][] = [];
  public writeCallCount = 0;
  public writeBatchCallCount = 0;

  write(data: LogData): void {
    this.writeCallCount++;
    this.logs.push(data);
  }

  writeBatch(batch: LogData[]): void {
    this.writeBatchCallCount++;
    this.batchedLogs.push([...batch]);
    this.logs.push(...batch);
  }

  reset(): void {
    this.logs = [];
    this.batchedLogs = [];
    this.writeCallCount = 0;
    this.writeBatchCallCount = 0;
  }
}

describe('LogQueue & QueueProvider', () => {
  let mockTransport: MockTransport;
  let formatter: Formatter;

  beforeEach(() => {
    mockTransport = new MockTransport();
    formatter = new Formatter();
  });

  describe('MemoryQueueProvider Defaults', () => {
    it('should default to next-tick flushing (flushInterval = 0)', async () => {
      const queue = new MemoryQueueProvider();
      
      const log1: LogData = { level: 'info', message: 'msg1', timestamp: new Date() };
      queue.enqueue(log1, formatter, [mockTransport]);

      // Should not be written immediately
      expect(mockTransport.logs).toHaveLength(0);

      // Wait for next tick/immediate
      await new Promise(resolve => setImmediate(resolve));

      expect(mockTransport.logs).toHaveLength(1);
      expect(mockTransport.logs[0].message).toBe('msg1');
      
      await queue.destroy();
    });

    it('should flush immediately when batchSize is reached', async () => {
      const queue = new MemoryQueueProvider({ batchSize: 2, flushInterval: 10000 });
      
      const log1: LogData = { level: 'info', message: 'msg1', timestamp: new Date() };
      const log2: LogData = { level: 'info', message: 'msg2', timestamp: new Date() };
      
      queue.enqueue(log1, formatter, [mockTransport]);
      expect(mockTransport.logs).toHaveLength(0);

      queue.enqueue(log2, formatter, [mockTransport]);
      
      // Should flush synchronously during enqueue since batchSize is reached
      expect(mockTransport.logs).toHaveLength(2);
      expect(mockTransport.logs[0].message).toBe('msg1');
      expect(mockTransport.logs[1].message).toBe('msg2');

      await queue.destroy();
    });
  });

  describe('Overflow Strategies', () => {
    it('should drop-oldest when queue size limit is exceeded', async () => {
      const queue = new MemoryQueueProvider({
        maxQueueSize: 2,
        overflowStrategy: 'drop-oldest',
        flushInterval: 5000 // avoid auto-flush during test
      });

      const log1: LogData = { level: 'info', message: 'msg1', timestamp: new Date() };
      const log2: LogData = { level: 'info', message: 'msg2', timestamp: new Date() };
      const log3: LogData = { level: 'info', message: 'msg3', timestamp: new Date() };

      queue.enqueue(log1, formatter, [mockTransport]);
      queue.enqueue(log2, formatter, [mockTransport]);
      queue.enqueue(log3, formatter, [mockTransport]); // log1 should be dropped

      await queue.flush();

      expect(mockTransport.logs).toHaveLength(2);
      expect(mockTransport.logs[0].message).toBe('msg2');
      expect(mockTransport.logs[1].message).toBe('msg3');

      await queue.destroy();
    });

    it('should drop-newest when queue size limit is exceeded', async () => {
      const queue = new MemoryQueueProvider({
        maxQueueSize: 2,
        overflowStrategy: 'drop-newest',
        flushInterval: 5000
      });

      const log1: LogData = { level: 'info', message: 'msg1', timestamp: new Date() };
      const log2: LogData = { level: 'info', message: 'msg2', timestamp: new Date() };
      const log3: LogData = { level: 'info', message: 'msg3', timestamp: new Date() };

      queue.enqueue(log1, formatter, [mockTransport]);
      queue.enqueue(log2, formatter, [mockTransport]);
      queue.enqueue(log3, formatter, [mockTransport]); // log3 should be ignored

      await queue.flush();

      expect(mockTransport.logs).toHaveLength(2);
      expect(mockTransport.logs[0].message).toBe('msg1');
      expect(mockTransport.logs[1].message).toBe('msg2');

      await queue.destroy();
    });

    it('should write synchronously in sync mode when queue size limit is exceeded', async () => {
      const queue = new MemoryQueueProvider({
        maxQueueSize: 2,
        overflowStrategy: 'sync',
        flushInterval: 5000
      });

      const log1: LogData = { level: 'info', message: 'msg1', timestamp: new Date() };
      const log2: LogData = { level: 'info', message: 'msg2', timestamp: new Date() };
      const log3: LogData = { level: 'info', message: 'msg3', timestamp: new Date() };

      queue.enqueue(log1, formatter, [mockTransport]);
      queue.enqueue(log2, formatter, [mockTransport]);
      
      // log3 should be written synchronously directly to transport (via writeBatch if available)
      queue.enqueue(log3, formatter, [mockTransport]); 
      expect(mockTransport.logs).toHaveLength(1);
      expect(mockTransport.logs[0].message).toBe('msg3');

      // The first two logs should still be in the queue
      await queue.flush();
      expect(mockTransport.logs).toHaveLength(3);
      expect(mockTransport.logs[1].message).toBe('msg1');
      expect(mockTransport.logs[2].message).toBe('msg2');

      await queue.destroy();
    });
  });

  describe('Custom QueueProvider Pluggability', () => {
    it('should accept and route through a custom QueueProvider', async () => {
      const customEnqueuedLogs: LogData[] = [];
      const customQueue: QueueProvider = {
        enqueue(log: LogData, fmt: Formatter, transports: Transport[]): void {
          customEnqueuedLogs.push(log);
          for (const t of transports) {
            t.write(log, fmt);
          }
        },
        async flush(): Promise<void> {},
        async destroy(): Promise<void> {}
      };

      const logger = new Logger({
        level: 'info',
        asyncMode: true,
        queueProvider: customQueue,
        transports: [mockTransport]
      });

      logger.info('Custom provider msg');

      expect(customEnqueuedLogs).toHaveLength(1);
      expect(customEnqueuedLogs[0].message).toBe('Custom provider msg');
      expect(mockTransport.logs).toHaveLength(1);
      expect(mockTransport.logs[0].message).toBe('Custom provider msg');
    });
  });
});
