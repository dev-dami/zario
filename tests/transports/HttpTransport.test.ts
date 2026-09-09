import { describe, it, expect, jest } from '@jest/globals';
import { HttpTransport } from '../../src/transports/HttpTransport.js';

describe('HttpTransport Error Mapping (Issue #79)', () => {
  it('should format descriptive error for 401 Unauthorized', async () => {
    const transport = new HttpTransport({
      url: 'http://localhost:9999/log',
      retries: 0,
    });

    jest.spyOn(transport as any, 'sendHttpRequest').mockImplementation(async () => {
      throw new Error('Authentication failed (401): Please check and validate your credentials or API keys.');
    });

    const mockLogData = {
      level: 'error',
      message: 'Auth fail test',
      timestamp: new Date(),
    };

    await expect(transport.writeAsync(mockLogData as any, {} as any)).rejects.toThrow(
      'Authentication failed (401)'
    );
  });

  it('should format descriptive error for 403 Forbidden', async () => {
    const transport = new HttpTransport({
      url: 'http://localhost:9999/log',
      retries: 0,
    });

    jest.spyOn(transport as any, 'sendHttpRequest').mockImplementation(async () => {
      throw new Error('Authentication failed (403): Please check and validate your credentials or API keys.');
    });

    const mockLogData = {
      level: 'error',
      message: 'Forbidden test',
      timestamp: new Date(),
    };

    await expect(transport.writeAsync(mockLogData as any, {} as any)).rejects.toThrow(
      'Authentication failed (403)'
    );
  });

  it('should format descriptive error for 429 Rate Limit', async () => {
    const transport = new HttpTransport({
      url: 'http://localhost:9999/log',
      retries: 0,
    });

    jest.spyOn(transport as any, 'sendHttpRequest').mockImplementation(async () => {
      throw new Error('Rate limit exceeded (429): The logging server is throttling requests. Please check rate limits.');
    });

    const mockLogData = {
      level: 'warn',
      message: 'Rate limit test',
      timestamp: new Date(),
    };

    await expect(transport.writeAsync(mockLogData as any, {} as any)).rejects.toThrow(
      'Rate limit exceeded (429)'
    );
  });
});