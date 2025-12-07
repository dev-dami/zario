import { FileTransport } from '../../src/transports/FileTransport';
import { Formatter } from '../../src/core/Formatter'; import { LogData } from '../../src/types';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('FileTransport Timestamp Extraction Reproduction', () => {
    let testDir: string;
    let testFilePath: string;
    let formatter: Formatter;

    beforeEach(() => {
        testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'repro-test-'));
        // Use a filename with dots to trigger the bug
        testFilePath = path.join(testDir, 'app.log');
        formatter = new Formatter({ colorize: false, json: false, timestamp: true });
    });

    afterEach(() => {
        if (fs.existsSync(testDir)) {
            try {
                fs.rmSync(testDir, { recursive: true });
            } catch (error) {
                // Ignore cleanup errors
            }
        }
    });
    const createLogData = (message: string): LogData => ({
        level: 'info' as any,
        message,
        timestamp: new Date(),
        metadata: {},
    });

    it('should correctly sort and delete old files when base filename contains dots', () => {
        const transport = new FileTransport({
            path: testFilePath,
            maxFiles: 1, // Keep only 1 rotated file
            maxSize: 1024,
        });

        // Manually create rotated files with known timestamps to simulate history
        // Filenames: app.log.TIMESTAMP

        // Oldest file
        const time1 = 1000000000000;
        fs.writeFileSync(`${testFilePath}.${time1}`, 'oldest content');

        // Middle file
        const time2 = 2000000000000;
        fs.writeFileSync(`${testFilePath}.${time2}`, 'middle content');

        // Newest file
        const time3 = 3000000000000;
        fs.writeFileSync(`${testFilePath}.${time3}`, 'newest content');

        // We have 3 rotated files. maxFiles is 1.
        // Should keep the NEWEST (time3).
        // Should delete time1 and time2.

        // Trigger cleanup by calling the private method or forcing a write/rotate
        // Since we can't easily access private method, we'll force a dummy write that triggers cleanup check
        // But cleanup is only called after rotation.
        // We can cast to any to call cleanupOldFiles directly for precise testing
        (transport as any).cleanupOldFiles();

        const files = fs.readdirSync(testDir);
        const rotatedFiles = files.filter(f => f !== 'app.log').sort();

        console.log('Remaining files:', rotatedFiles);

        // Expectation: Only the file with time3 should remain
        expect(rotatedFiles.length).toBe(1);
        expect(rotatedFiles[0]).toContain(time3.toString());
        expect(rotatedFiles[0]).not.toContain(time1.toString());
    });
});
