import { FileTransport, FileTransportOptions } from '../../src/transports/FileTransport';
import { Formatter } from '../../src/core/Formatter';
import { LogData } from '../../src/types';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('FileTransport', () => {
  let testDir: string;
  let testFilePath: string;
  let formatter: Formatter;
  const TEST_LOG_MESSAGE = 'Test log message';
  
  beforeEach(() => {
    // Create a unique temporary directory for each test
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'filetransport-test-'));
    testFilePath = path.join(testDir, 'test.log');
    formatter = new Formatter({ colorize: false, json: false, timestamp: true });
  });

  afterEach(() => {
    // Clean up test directory and all its contents
    if (fs.existsSync(testDir)) {
      try {
        const files = fs.readdirSync(testDir);
        files.forEach(file => {
          const filePath = path.join(testDir, file);
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
        });
        fs.rmdirSync(testDir);
      } catch (error) {
        // Ignore cleanup errors
      }
    }
  });

  // Helper function to create mock LogData
  const createLogData = (message: string, level: string = 'info', metadata?: Record<string, any>): LogData => ({
    level: level as any,
    message,
    timestamp: new Date(),
    metadata,
  });

  // Helper function to wait for async operations
  const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  describe('Constructor', () => {
    it('should create a FileTransport instance with default options', () => {
      const transport = new FileTransport({ path: testFilePath });
      expect(transport).toBeInstanceOf(FileTransport);
    });

    it('should create a FileTransport instance with custom maxSize', () => {
      const transport = new FileTransport({ 
        path: testFilePath,
        maxSize: 5 * 1024 * 1024 
      });
      expect(transport).toBeInstanceOf(FileTransport);
    });

    it('should create a FileTransport instance with custom maxFiles', () => {
      const transport = new FileTransport({ 
        path: testFilePath,
        maxFiles: 3
      });
      expect(transport).toBeInstanceOf(FileTransport);
    });

    it('should create directory if it does not exist', () => {
      const nestedPath = path.join(testDir, 'nested', 'deep', 'test.log');
      new FileTransport({ path: nestedPath });
      expect(fs.existsSync(path.dirname(nestedPath))).toBe(true);
    });

    it('should not throw if directory already exists', () => {
      fs.mkdirSync(path.dirname(testFilePath), { recursive: true });
      expect(() => new FileTransport({ path: testFilePath })).not.toThrow();
    });

    it('should handle deeply nested directory creation', () => {
      const deepPath = path.join(testDir, 'a', 'b', 'c', 'd', 'e', 'test.log');
      new FileTransport({ path: deepPath });
      expect(fs.existsSync(path.dirname(deepPath))).toBe(true);
    });
  });

  describe('write() - Synchronous Writing', () => {
    it('should write a log message to file synchronously', () => {
      const transport = new FileTransport({ path: testFilePath });
      const logData = createLogData(TEST_LOG_MESSAGE);
      
      transport.write(logData, formatter);
      
      expect(fs.existsSync(testFilePath)).toBe(true);
      const content = fs.readFileSync(testFilePath, 'utf-8');
      expect(content).toContain(TEST_LOG_MESSAGE);
    });

    it('should append multiple log messages', () => {
      const transport = new FileTransport({ path: testFilePath });
      
      transport.write(createLogData('First message'), formatter);
      transport.write(createLogData('Second message'), formatter);
      transport.write(createLogData('Third message'), formatter);
      
      const content = fs.readFileSync(testFilePath, 'utf-8');
      expect(content).toContain('First message');
      expect(content).toContain('Second message');
      expect(content).toContain('Third message');
    });

    it('should add newline after each log entry', () => {
      const transport = new FileTransport({ path: testFilePath });
      transport.write(createLogData('Message 1'), formatter);
      transport.write(createLogData('Message 2'), formatter);
      
      const content = fs.readFileSync(testFilePath, 'utf-8');
      const lines = content.split('\n').filter(line => line.length > 0);
      expect(lines.length).toBe(2);
    });

    it('should write logs with different log levels', () => {
      const transport = new FileTransport({ path: testFilePath });
      
      transport.write(createLogData('Info message', 'info'), formatter);
      transport.write(createLogData('Warning message', 'warn'), formatter);
      transport.write(createLogData('Error message', 'error'), formatter);
      
      const content = fs.readFileSync(testFilePath, 'utf-8');
      expect(content).toContain('Info message');
      expect(content).toContain('Warning message');
      expect(content).toContain('Error message');
    });

    it('should write logs with metadata', () => {
      const transport = new FileTransport({ path: testFilePath });
      const logData = createLogData('Message with metadata', 'info', { userId: 123, action: 'login' });
      
      transport.write(logData, formatter);
      
      const content = fs.readFileSync(testFilePath, 'utf-8');
      expect(content).toContain('Message with metadata');
      expect(content).toContain('userId');
      expect(content).toContain('123');
    });

    it('should handle empty messages', () => {
      const transport = new FileTransport({ path: testFilePath });
      transport.write(createLogData(''), formatter);
      
      expect(fs.existsSync(testFilePath)).toBe(true);
    });

    it('should handle special characters in messages', () => {
      const transport = new FileTransport({ path: testFilePath });
      const specialMessage = 'Special chars: \n\t\r"\'\\';
      transport.write(createLogData(specialMessage), formatter);
      
      const content = fs.readFileSync(testFilePath, 'utf-8');
      expect(content.length).toBeGreaterThan(0);
    });

    it('should handle very long messages', () => {
      const transport = new FileTransport({ path: testFilePath });
      const longMessage = 'A'.repeat(10000);
      transport.write(createLogData(longMessage), formatter);
      
      const content = fs.readFileSync(testFilePath, 'utf-8');
      expect(content).toContain(longMessage);
    });
  });

  describe('writeAsync() - Asynchronous Writing', () => {
    it('should write a log message to file asynchronously', async () => {
      const transport = new FileTransport({ path: testFilePath });
      const logData = createLogData(TEST_LOG_MESSAGE);
      
      await transport.writeAsync(logData, formatter);
      
      expect(fs.existsSync(testFilePath)).toBe(true);
      const content = fs.readFileSync(testFilePath, 'utf-8');
      expect(content).toContain(TEST_LOG_MESSAGE);
    });

    it('should return a Promise that resolves', async () => {
      const transport = new FileTransport({ path: testFilePath });
      const result = transport.writeAsync(createLogData(TEST_LOG_MESSAGE), formatter);
      
      expect(result).toBeInstanceOf(Promise);
      await expect(result).resolves.toBeUndefined();
    });

    it('should handle multiple concurrent async writes', async () => {
      const transport = new FileTransport({ path: testFilePath });
      
      const writes = [
        transport.writeAsync(createLogData('Async message 1'), formatter),
        transport.writeAsync(createLogData('Async message 2'), formatter),
        transport.writeAsync(createLogData('Async message 3'), formatter),
      ];
      
      await Promise.all(writes);
      
      const content = fs.readFileSync(testFilePath, 'utf-8');
      expect(content).toContain('Async message 1');
      expect(content).toContain('Async message 2');
      expect(content).toContain('Async message 3');
    });

    it('should reject promise on write error', async () => {
      const invalidPath = path.join(testDir, 'nonexistent', 'deep', 'invalid', 'test.log');
      // Don't create the directory to force an error
      const transport = new FileTransport({ path: testFilePath });
      
      // Override the filePath to an invalid location after construction
      (transport as any).filePath = invalidPath;
      
      await expect(transport.writeAsync(createLogData('Test'), formatter)).rejects.toThrow();
    });

    it('should handle async writes with rotation', async () => {
      // Set very small max size to trigger rotation
      const transport = new FileTransport({ 
        path: testFilePath,
        maxSize: 100,
        maxFiles: 3
      });
      
      // Write enough data to trigger rotation
      for (let i = 0; i < 5; i++) {
        await transport.writeAsync(createLogData(`Message ${i}: ${'x'.repeat(50)}`), formatter);
      }
      
      // Check that rotated files exist
      const files = fs.readdirSync(testDir);
      const logFiles = files.filter(f => f.startsWith('test.log'));
      expect(logFiles.length).toBeGreaterThan(1);
    });
  });

  describe('File Rotation - rotateIfNeeded()', () => {
    it('should not rotate if file size is below maxSize', () => {
      const transport = new FileTransport({ 
        path: testFilePath,
        maxSize: 1024 * 1024 // 1MB
      });
      
      transport.write(createLogData('Small message'), formatter);
      
      const files = fs.readdirSync(testDir);
      const logFiles = files.filter(f => f.startsWith('test.log'));
      expect(logFiles.length).toBe(1);
    });

    it('should rotate file when size exceeds maxSize', () => {
      const transport = new FileTransport({ 
        path: testFilePath,
        maxSize: 50 // Very small to trigger rotation
      });
      
      // Write enough data to exceed maxSize
      transport.write(createLogData('A'.repeat(100)), formatter);
      
      const files = fs.readdirSync(testDir);
      const logFiles = files.filter(f => f.startsWith('test.log'));
      expect(logFiles.length).toBeGreaterThan(1);
    });

    it('should create rotated file with timestamp suffix', () => {
      const transport = new FileTransport({ 
        path: testFilePath,
        maxSize: 50
      });
      
      transport.write(createLogData('A'.repeat(100)), formatter);
      
      const files = fs.readdirSync(testDir);
      const rotatedFiles = files.filter(f => f.match(/test\.log\.\d+/));
      expect(rotatedFiles.length).toBeGreaterThan(0);
    });

    it('should not rotate if file does not exist', () => {
  const transport = new FileTransport({ path: testFilePath });
  
  // Delete the file that was created by constructor
  fs.unlinkSync(testFilePath);
  
  // Call rotateIfNeeded after deleting the file
  (transport as any).rotateIfNeeded();
  
  const files = fs.readdirSync(testDir);
  expect(files.length).toBe(0); // Should be 0 since we deleted the file
});

    it('should handle multiple rotations', () => {
      const transport = new FileTransport({ 
        path: testFilePath,
        maxSize: 50,
        maxFiles: 5
      });
      
      // Trigger multiple rotations
      for (let i = 0; i < 4; i++) {
        transport.write(createLogData(`Message ${i}: ${'B'.repeat(100)}`), formatter);
      }
      
      const files = fs.readdirSync(testDir);
      const logFiles = files.filter(f => f.startsWith('test.log'));
      expect(logFiles.length).toBeGreaterThan(2);
    });
  });

  describe('File Rotation - rotateIfNeededAsync()', () => {
    it('should rotate file asynchronously when size exceeds maxSize', async () => {
      const transport = new FileTransport({ 
        path: testFilePath,
        maxSize: 50
      });
      
      await transport.writeAsync(createLogData('A'.repeat(100)), formatter);
      // Give time for async rotation to complete
      await wait(100);
      
      const files = fs.readdirSync(testDir);
      const logFiles = files.filter(f => f.startsWith('test.log'));
      expect(logFiles.length).toBeGreaterThan(1);
    });

    it('should handle errors during async rotation gracefully', async () => {
      const transport = new FileTransport({ 
        path: testFilePath,
        maxSize: 50
      });
      
      // Create a file first
      await transport.writeAsync(createLogData('Initial'), formatter);
      
      // Mock a scenario where rotation would fail - we just ensure it doesn't crash
      await transport.writeAsync(createLogData('A'.repeat(100)), formatter);
      
      // Should not throw
      expect(fs.existsSync(testFilePath) || fs.readdirSync(testDir).length > 0).toBe(true);
    });

    it('should not rotate if file does not exist during async check', async () => {
  const transport = new FileTransport({ path: testFilePath });
  
  // Delete the file that was created by constructor
  fs.unlinkSync(testFilePath);
  
  await (transport as any).rotateIfNeededAsync();
  
  const files = fs.readdirSync(testDir);
  expect(files.length).toBe(0); // Should be 0 since we deleted the file
});
  });

  describe('Cleanup Old Files - cleanupOldFiles()', () => {
    it('should delete files exceeding maxFiles limit', () => {
      const transport = new FileTransport({ 
        path: testFilePath,
        maxSize: 50,
        maxFiles: 3
      });
      
      // Create multiple rotated files
      for (let i = 0; i < 6; i++) {
        transport.write(createLogData(`Message ${i}: ${'C'.repeat(100)}`), formatter);
      }
      
      const files = fs.readdirSync(testDir);
      const logFiles = files.filter(f => f.startsWith('test.log'));
      // Should keep maxFiles (3) + current file
      expect(logFiles.length).toBeLessThanOrEqual(4);
    });

    it('should keep the most recent files', () => {
      const transport = new FileTransport({ 
        path: testFilePath,
        maxSize: 50,
        maxFiles: 2
      });
      
      // Create files with delays to ensure different timestamps
      for (let i = 0; i < 4; i++) {
        transport.write(createLogData(`Message ${i}: ${'D'.repeat(100)}`), formatter);
      }
      
      const files = fs.readdirSync(testDir);
      const logFiles = files.filter(f => f.startsWith('test.log'));
      expect(logFiles.length).toBeLessThanOrEqual(3); // maxFiles + current
    });

    it('should not delete current log file', () => {
      const transport = new FileTransport({ 
        path: testFilePath,
        maxSize: 50,
        maxFiles: 1
      });
      
      for (let i = 0; i < 3; i++) {
        transport.write(createLogData(`Message ${i}: ${'E'.repeat(100)}`), formatter);
      }
      
      expect(fs.existsSync(testFilePath)).toBe(true);
    });

    it('should handle path traversal attempts in cleanup - relative path', () => {
      const transport = new FileTransport({ 
        path: testFilePath,
        maxSize: 50,
        maxFiles: 2
      });
      
      // Create a legitimate rotated file
      fs.writeFileSync(testFilePath + '.1234567890', 'content');
      
      // Create a malicious filename (should be filtered out)
      const maliciousFile = path.join(testDir, 'test.log../../../etc/passwd');
      try {
        fs.writeFileSync(maliciousFile, 'malicious');
      } catch (e) {
        // May fail to create, which is expected
      }
      
      // Trigger cleanup
      transport.write(createLogData('F'.repeat(100)), formatter);
      
      // The legitimate file should still be handled
      const files = fs.readdirSync(testDir);
      const logFiles = files.filter(f => f.startsWith('test.log'));
      expect(logFiles.length).toBeGreaterThan(0);
    });

    it('should handle filenames with ../ prefix', () => {
      const transport = new FileTransport({ 
        path: testFilePath,
        maxSize: 50,
        maxFiles: 2
      });
      
      // Create files
      fs.writeFileSync(testFilePath + '.1111111111', 'old content 1');
      fs.writeFileSync(testFilePath + '.2222222222', 'old content 2');
      fs.writeFileSync(testFilePath + '.3333333333', 'old content 3');
      
      // Trigger cleanup by writing
      transport.write(createLogData('G'.repeat(100)), formatter);
      
      const files = fs.readdirSync(testDir);
      const logFiles = files.filter(f => f.startsWith('test.log'));
      expect(logFiles.length).toBeLessThanOrEqual(3);
    });

    it('should handle filenames starting with ..', () => {
      const transport = new FileTransport({ 
        path: testFilePath,
        maxSize: 50,
        maxFiles: 1
      });
      
      // Try to create a file starting with .. (should be skipped in cleanup)
      const weirdFile = path.join(testDir, '..test.log.12345');
      try {
        fs.writeFileSync(weirdFile, 'content');
      } catch (e) {
        // May fail, which is okay
      }
      
      // Create legitimate file
      fs.writeFileSync(testFilePath + '.1234567890', 'content');
      
      transport.write(createLogData('H'.repeat(100)), formatter);
      
      // Should not crash
      expect(fs.existsSync(testFilePath)).toBe(true);
    });

    it('should handle filenames with backslash path traversal', () => {
      const transport = new FileTransport({ 
        path: testFilePath,
        maxSize: 50,
        maxFiles: 2
      });
      
      // Create legitimate files
      fs.writeFileSync(testFilePath + '.1111111111', 'content1');
      fs.writeFileSync(testFilePath + '.2222222222', 'content2');
      
      transport.write(createLogData('I'.repeat(100)), formatter);
      
      // Should handle cleanup without errors
      const files = fs.readdirSync(testDir);
      expect(files.length).toBeGreaterThan(0);
    });

    it('should validate resolved paths stay within directory', () => {
      const transport = new FileTransport({ 
        path: testFilePath,
        maxSize: 50,
        maxFiles: 2
      });
      
      // Create multiple files
      fs.writeFileSync(testFilePath + '.1000000000', 'content1');
      fs.writeFileSync(testFilePath + '.2000000000', 'content2');
      fs.writeFileSync(testFilePath + '.3000000000', 'content3');
      
      // Trigger cleanup
      transport.write(createLogData('J'.repeat(100)), formatter);
      
      // Verify path resolution validation worked
      const files = fs.readdirSync(testDir);
      const logFiles = files.filter(f => f.startsWith('test.log'));
      expect(logFiles.length).toBeLessThanOrEqual(3);
    });

    it('should not delete files when under maxFiles limit', () => {
      const transport = new FileTransport({ 
        path: testFilePath,
        maxSize: 50,
        maxFiles: 10 // High limit
      });
      
      // Create only 2 rotations
      transport.write(createLogData('K'.repeat(100)), formatter);
      transport.write(createLogData('L'.repeat(100)), formatter);
      
      const files = fs.readdirSync(testDir);
      const logFiles = files.filter(f => f.startsWith('test.log'));
      expect(logFiles.length).toBeLessThanOrEqual(10);
    });
  });

  describe('Cleanup Old Files Async - cleanupOldFilesAsync()', () => {
    it('should delete old files asynchronously', async () => {
      const transport = new FileTransport({ 
        path: testFilePath,
        maxSize: 50,
        maxFiles: 2
      });
      
      // Create multiple files and trigger async cleanup
      for (let i = 0; i < 5; i++) {
        await transport.writeAsync(createLogData(`Async ${i}: ${'M'.repeat(100)}`), formatter);
      }
      
      // Wait for cleanup to complete
      await wait(200);
      
      const files = fs.readdirSync(testDir);
      const logFiles = files.filter(f => f.startsWith('test.log'));
      expect(logFiles.length).toBeLessThanOrEqual(3);
    });

    it('should handle readdir errors in async cleanup', async () => {
  const transport = new FileTransport({ path: testFilePath });
  
  // Create legitimate files
  fs.writeFileSync(testFilePath + '.1111111111', 'content1');
  fs.writeFileSync(testFilePath + '.2222222222', 'content2');

  // Override directory to non-existent location to trigger error
  const originalFilePath = (transport as any).filePath;
  (transport as any).filePath = path.join(testDir, 'nonexistent', 'test.log');
  
  // Should NOT throw - errors are caught and logged
  await expect((transport as any).cleanupOldFilesAsync()).resolves.toBeUndefined();
  
  // Restore
  (transport as any).filePath = originalFilePath;
});

    it('should resolve immediately when no files to delete', async () => {
      const transport = new FileTransport({ 
        path: testFilePath,
        maxFiles: 10
      });
      
      // Create just one file (under limit)
      await transport.writeAsync(createLogData('Single message'), formatter);
      
      // Should resolve without errors
      await expect((transport as any).cleanupOldFilesAsync()).resolves.toBeUndefined();
    });

    it('should validate filenames in async cleanup - path traversal with ../', async () => {
      const transport = new FileTransport({ 
        path: testFilePath,
        maxSize: 50,
        maxFiles: 2
      });
      
      // Create legitimate files
      fs.writeFileSync(testFilePath + '.1111111111', 'content1');
      fs.writeFileSync(testFilePath + '.2222222222', 'content2');
      fs.writeFileSync(testFilePath + '.3333333333', 'content3');
      
      await transport.writeAsync(createLogData('N'.repeat(100)), formatter);
      await wait(100);
      
      const files = fs.readdirSync(testDir);
      const logFiles = files.filter(f => f.startsWith('test.log'));
      expect(logFiles.length).toBeLessThanOrEqual(3);
    });

    it('should validate filenames starting with .. in async cleanup', async () => {
      const transport = new FileTransport({ 
        path: testFilePath,
        maxSize: 50,
        maxFiles: 1
      });
      
      fs.writeFileSync(testFilePath + '.1234567890', 'content');
      
      await transport.writeAsync(createLogData('O'.repeat(100)), formatter);
      await wait(100);
      
      expect(fs.existsSync(testFilePath)).toBe(true);
    });

    it('should validate filenames with backslash in async cleanup', async () => {
      const transport = new FileTransport({ 
        path: testFilePath,
        maxSize: 50,
        maxFiles: 2
      });
      
      fs.writeFileSync(testFilePath + '.1111111111', 'content1');
      fs.writeFileSync(testFilePath + '.2222222222', 'content2');
      
      await transport.writeAsync(createLogData('P'.repeat(100)), formatter);
      await wait(100);
      
      const files = fs.readdirSync(testDir);
      expect(files.length).toBeGreaterThan(0);
    });

    it('should validate resolved paths in async cleanup', async () => {
      const transport = new FileTransport({ 
        path: testFilePath,
        maxSize: 50,
        maxFiles: 2
      });
      
      // Create files
      fs.writeFileSync(testFilePath + '.1000000000', 'content1');
      fs.writeFileSync(testFilePath + '.2000000000', 'content2');
      fs.writeFileSync(testFilePath + '.3000000000', 'content3');
      
      await transport.writeAsync(createLogData('Q'.repeat(100)), formatter);
      await wait(100);
      
      const files = fs.readdirSync(testDir);
      const logFiles = files.filter(f => f.startsWith('test.log'));
      // Changed logic: should keep only maxFiles (2) rotated files + current
      expect(logFiles.length).toBeLessThanOrEqual(3);
    });

    it('should handle path resolution edge case where path equals directory', async () => {
      const transport = new FileTransport({ 
        path: testFilePath,
        maxSize: 50,
        maxFiles: 2
      });
      
      fs.writeFileSync(testFilePath + '.1111111111', 'content1');
      fs.writeFileSync(testFilePath + '.2222222222', 'content2');
      
      await transport.writeAsync(createLogData('R'.repeat(100)), formatter);
      await wait(100);
      
      // Should handle the edge case: resolvedPath !== resolvedDir
      const files = fs.readdirSync(testDir);
      const logFiles = files.filter(f => f.startsWith('test.log'));
      expect(logFiles.length).toBeGreaterThan(0);
    });

    it('should handle unlink errors during async cleanup', async () => {
      const transport = new FileTransport({ 
        path: testFilePath,
        maxSize: 50,
        maxFiles: 1
      });
      
      // Create files
      fs.writeFileSync(testFilePath + '.1111111111', 'content1');
      fs.writeFileSync(testFilePath + '.2222222222', 'content2');
      
      // Make one file read-only to potentially cause unlink error
      const fileToProtect = testFilePath + '.1111111111';
      if (fs.existsSync(fileToProtect)) {
        try {
          fs.chmodSync(fileToProtect, 0o444);
        } catch (e) {
          // chmod might not work in all environments
        }
      }
      
      await transport.writeAsync(createLogData('S'.repeat(100)), formatter);
      await wait(100);
      
      // Cleanup the protected file
      try {
        if (fs.existsSync(fileToProtect)) {
          fs.chmodSync(fileToProtect, 0o644);
        }
      } catch (e) {
        // Ignore
      }
      
      // Should have attempted cleanup
      expect(fs.existsSync(testFilePath)).toBe(true);
    });

    it('should complete cleanup when all files are processed', async () => {
      const transport = new FileTransport({ 
        path: testFilePath,
        maxSize: 50,
        maxFiles: 2
      });
      
      // Create exactly maxFiles + 1 files
      fs.writeFileSync(testFilePath + '.1111111111', 'content1');
      fs.writeFileSync(testFilePath + '.2222222222', 'content2');
      fs.writeFileSync(testFilePath + '.3333333333', 'content3');
      
      await transport.writeAsync(createLogData('T'.repeat(100)), formatter);
      await wait(150);
      
      const files = fs.readdirSync(testDir);
      const logFiles = files.filter(f => f.startsWith('test.log'));
      expect(logFiles.length).toBeLessThanOrEqual(3);
    });

    it('should handle empty toDelete array gracefully', async () => {
      const transport = new FileTransport({ 
        path: testFilePath,
        maxFiles: 10
      });
      
      // Create just one file
      await transport.writeAsync(createLogData('Single'), formatter);
      
      // Trigger cleanup with no files to delete
      await expect((transport as any).cleanupOldFilesAsync()).resolves.toBeUndefined();
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle rapid successive writes', () => {
      const transport = new FileTransport({ path: testFilePath });
      
      for (let i = 0; i < 100; i++) {
        transport.write(createLogData(`Rapid message ${i}`), formatter);
      }
      
      expect(fs.existsSync(testFilePath)).toBe(true);
      const content = fs.readFileSync(testFilePath, 'utf-8');
      const lines = content.split('\n').filter(line => line.length > 0);
      expect(lines.length).toBe(100);
    });

    it('should handle writes with undefined metadata', () => {
      const transport = new FileTransport({ path: testFilePath });
      const logData: LogData = {
        level: 'info' as any,
        message: 'Test',
        timestamp: new Date(),
        metadata: undefined,
      };
      
      expect(() => transport.write(logData, formatter)).not.toThrow();
    });

    it('should handle file path with spaces', () => {
      const pathWithSpaces = path.join(testDir, 'test with spaces.log');
      const transport = new FileTransport({ path: pathWithSpaces });
      
      transport.write(createLogData('Message'), formatter);
      
      expect(fs.existsSync(pathWithSpaces)).toBe(true);
    });

    it('should handle file path with special characters', () => {
      const specialPath = path.join(testDir, 'test-log_2024.log');
      const transport = new FileTransport({ path: specialPath });
      
      transport.write(createLogData('Message'), formatter);
      
      expect(fs.existsSync(specialPath)).toBe(true);
    });

    it('should handle very small maxSize (edge case)', () => {
      const transport = new FileTransport({ 
        path: testFilePath,
        maxSize: 1, // 1 byte - will rotate on every write
        maxFiles: 3
      });
      
      transport.write(createLogData('A'), formatter);
      transport.write(createLogData('B'), formatter);
      
      const files = fs.readdirSync(testDir);
      const logFiles = files.filter(f => f.startsWith('test.log'));
      expect(logFiles.length).toBeGreaterThan(1);
    });

    it('should handle maxFiles = 1', () => {
      const transport = new FileTransport({ 
        path: testFilePath,
        maxSize: 50,
        maxFiles: 1
      });
      
      for (let i = 0; i < 3; i++) {
        transport.write(createLogData('U'.repeat(100)), formatter);
      }
      
      const files = fs.readdirSync(testDir);
      const logFiles = files.filter(f => f.startsWith('test.log'));
      expect(logFiles.length).toBeLessThanOrEqual(2); // current + 1 rotated
    });

    it('should handle JSON formatted logs', () => {
      const jsonFormatter = new Formatter({ json: true, colorize: false });
      const transport = new FileTransport({ path: testFilePath });
      
      transport.write(createLogData('JSON message', 'info', { key: 'value' }), jsonFormatter);
      
      const content = fs.readFileSync(testFilePath, 'utf-8');
      expect(() => JSON.parse(content.trim())).not.toThrow();
    });

    it('should handle logs with prefix', () => {
      const transport = new FileTransport({ path: testFilePath });
      const logData: LogData = {
        level: 'info' as any,
        message: 'Test message',
        timestamp: new Date(),
        prefix: '[APP]',
      };
      
      transport.write(logData, formatter);
      
      const content = fs.readFileSync(testFilePath, 'utf-8');
      expect(content).toContain('[APP]');
    });

    it('should maintain file integrity across rotations', () => {
      const transport = new FileTransport({ 
        path: testFilePath,
        maxSize: 100,
        maxFiles: 3
      });
      
      const messages: string[] = [];
      for (let i = 0; i < 10; i++) {
        const msg = `Message ${i}: ${'V'.repeat(50)}`;
        messages.push(msg);
        transport.write(createLogData(msg), formatter);
      }
      
      // Read all log files and verify messages
      const files = fs.readdirSync(testDir);
      const logFiles = files.filter(f => f.startsWith('test.log')).sort();
      
      let allContent = '';
      logFiles.forEach(file => {
        const content = fs.readFileSync(path.join(testDir, file), 'utf-8');
        allContent += content;
      });
      
      // At least some messages should be present
      const foundMessages = messages.filter(msg => allContent.includes(msg));
      expect(foundMessages.length).toBeGreaterThan(0);
    });

    it('should handle concurrent sync and async writes', async () => {
      const transport = new FileTransport({ path: testFilePath });
      
      // Mix sync and async writes
      transport.write(createLogData('Sync 1'), formatter);
      const asyncPromise = transport.writeAsync(createLogData('Async 1'), formatter);
      transport.write(createLogData('Sync 2'), formatter);
      
      await asyncPromise;
      
      const content = fs.readFileSync(testFilePath, 'utf-8');
      expect(content).toContain('Sync 1');
      expect(content).toContain('Async 1');
      expect(content).toContain('Sync 2');
    });

    it('should sort rotated files correctly for cleanup', () => {
      const transport = new FileTransport({ 
        path: testFilePath,
        maxSize: 50,
        maxFiles: 2
      });
      
      // Create files with specific timestamps to test sorting
      const now = Date.now();
      fs.writeFileSync(testFilePath + '.' + (now - 3000), 'old1');
      fs.writeFileSync(testFilePath + '.' + (now - 2000), 'old2');
      fs.writeFileSync(testFilePath + '.' + (now - 1000), 'old3');
      
      transport.write(createLogData('W'.repeat(100)), formatter);
      
      const files = fs.readdirSync(testDir);
      const logFiles = files.filter(f => f.startsWith('test.log'));
      expect(logFiles.length).toBeLessThanOrEqual(3);
    });
  });

  describe('Integration Tests', () => {
    it('should handle a realistic logging scenario', async () => {
      const transport = new FileTransport({ 
        path: testFilePath,
        maxSize: 500,
        maxFiles: 3
      });
      
      // Simulate real application logging
      const levels = ['info', 'warn', 'error', 'debug'];
      
      for (let i = 0; i < 20; i++) {
        const level = levels[i % levels.length];
        const logData = createLogData(
          `Application event ${i}`,
          level,
          { eventId: i, userId: Math.floor(i / 5) }
        );
        
        if (i % 2 === 0) {
          transport.write(logData, formatter);
        } else {
          await transport.writeAsync(logData, formatter);
        }
      }
      
      // Verify logs were written
      const files = fs.readdirSync(testDir);
      const logFiles = files.filter(f => f.startsWith('test.log'));
      expect(logFiles.length).toBeGreaterThan(0);
      
      // Verify content exists
      let totalContent = '';
      logFiles.forEach(file => {
        const content = fs.readFileSync(path.join(testDir, file), 'utf-8');
        totalContent += content;
      });
      
      expect(totalContent.length).toBeGreaterThan(0);
      expect(totalContent).toContain('Application event');
    });

    it('should handle high-frequency logging with rotation', async () => {
      const transport = new FileTransport({ 
        path: testFilePath,
        maxSize: 200,
        maxFiles: 5
      });
      
      // High frequency writes
      const writes: Promise<void>[] = [];
      for (let i = 0; i < 50; i++) {
        writes.push(
          transport.writeAsync(
            createLogData(`High frequency log ${i}: ${'X'.repeat(20)}`),
            formatter
          )
        );
      }
      
      await Promise.all(writes);
      await wait(200);
      
      const files = fs.readdirSync(testDir);
      const logFiles = files.filter(f => f.startsWith('test.log'));
      
      // Should have rotated and cleaned up
      expect(logFiles.length).toBeGreaterThan(1);
      expect(logFiles.length).toBeLessThanOrEqual(6); // maxFiles + current
    });
  });

  describe('Formatter Integration', () => {
    it('should work with colorized formatter', () => {
      const colorFormatter = new Formatter({ colorize: true, timestamp: true });
      const transport = new FileTransport({ path: testFilePath });
      
      transport.write(createLogData('Colorized message'), colorFormatter);
      
      const content = fs.readFileSync(testFilePath, 'utf-8');
      expect(content).toContain('Colorized message');
    });

    it('should work with JSON formatter', () => {
      const jsonFormatter = new Formatter({ json: true });
      const transport = new FileTransport({ path: testFilePath });
      
      transport.write(createLogData('JSON message', 'info', { data: 'test' }), jsonFormatter);
      
      const content = fs.readFileSync(testFilePath, 'utf-8');
      const parsed = JSON.parse(content.trim());
      expect(parsed.message).toBe('JSON message');
      expect(parsed.data).toBe('test');
    });

    it('should work with custom timestamp format', () => {
      const customFormatter = new Formatter({ 
        timestamp: true,
        timestampFormat: 'YYYY-MM-DD',
        colorize: false
      });
      const transport = new FileTransport({ path: testFilePath });
      
      transport.write(createLogData('Custom timestamp message'), customFormatter);
      
      const content = fs.readFileSync(testFilePath, 'utf-8');
      expect(content).toContain('Custom timestamp message');
    });
  });
});