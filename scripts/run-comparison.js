import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');
const tempDir = path.join(rootDir, 'temp-comparison');

console.log('Starting fair, fact-based comparison between Zario, Winston, and Pino...');

// 1. Pack the current workspace Zario version
console.log('\nStep 1: Packaging Zario...');
const packResult = spawnSync('npm', ['pack'], { cwd: rootDir, encoding: 'utf8' });
if (packResult.status !== 0) {
  console.error('Failed to run npm pack:', packResult.stderr);
  process.exit(1);
}
const tarballName = packResult.stdout.trim();
const tarballPath = path.join(rootDir, tarballName);
console.log(`Created tarball: ${tarballName}`);

// 2. Setup temporary comparison directory
console.log('\nStep 2: Setting up temp-comparison directory...');
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

fs.writeFileSync(
  path.join(tempDir, 'package.json'),
  JSON.stringify(
    {
      name: 'temp-comparison',
      version: '1.0.0',
      type: 'module',
      dependencies: {},
    },
    null,
    2
  )
);

// 3. Install packages
console.log('\nStep 3: Installing Winston, Pino, Esbuild, and Zario...');
const installResult = spawnSync(
  'npm',
  ['install', '--no-audit', '--no-fund', tarballPath, 'pino', 'winston', 'esbuild'],
  { cwd: tempDir, encoding: 'utf8' }
);
if (installResult.status !== 0) {
  console.error('Failed to install comparison packages:', installResult.stderr);
  // Cleanup tarball
  fs.unlinkSync(tarballPath);
  process.exit(1);
}
console.log('Installation successful.');

// 4. Create Bundle Size Fixtures
console.log('\nStep 4: Writing bundle size fixtures...');
const fixtures = {
  'zario-full.js': `
    import { Logger, ConsoleTransport } from 'zario';
    const logger = new Logger({ transports: [new ConsoleTransport()] });
    logger.info('hello');
  `,
  'zario-lean.js': `
    import { Logger } from 'zario/logger';
    const logger = new Logger();
    logger.info('hello');
  `,
  'pino.js': `
    import pino from 'pino';
    const logger = pino();
    logger.info('hello');
  `,
  'winston.js': `
    import winston from 'winston';
    const logger = winston.createLogger({
      transports: [new winston.transports.Console()]
    });
    logger.info('hello');
  `,
};

for (const [name, code] of Object.entries(fixtures)) {
  fs.writeFileSync(path.join(tempDir, name), code.trim());
}

// 5. Run Esbuild to Measure Bundle Size
console.log('\nStep 5: Bundling and measuring sizes with Esbuild...');
const bundleSizes = {};

for (const name of Object.keys(fixtures)) {
  const baseName = name.replace('.js', '');
  const outPath = path.join(tempDir, `bundle-${baseName}.js`);
  
  const buildResult = spawnSync(
    'npx',
    [
      'esbuild',
      path.join(tempDir, name),
      '--bundle',
      '--minify',
      '--platform=node',
      `--outfile=${outPath}`,
    ],
    { cwd: tempDir, encoding: 'utf8' }
  );

  if (buildResult.status !== 0) {
    console.warn(`Warning: Esbuild bundle failed for ${name}:`, buildResult.stderr);
  }

  if (fs.existsSync(outPath)) {
    const size = fs.statSync(outPath).size;
    bundleSizes[baseName] = size;
    console.log(`Bundle Size of ${baseName}: ${(size / 1024).toFixed(2)} KB`);
  } else {
    bundleSizes[baseName] = 'Failed';
  }
}

// 6. Create & Run Speed Test Benchmark
console.log('\nStep 6: Running performance speed test benchmark...');
const benchmarkCode = `
import { Logger } from 'zario';
import pino from 'pino';
import winston from 'winston';
import { Writable } from 'stream';

// 1. Create a Writable Null Stream to ensure identical I/O cost
const nullStream = new Writable({
  write(chunk, encoding, callback) {
    callback();
  }
});

// Zario custom transport writing to the shared stream
class StreamTransport {
  constructor(stream) {
    this.stream = stream;
  }
  write(data, formatter) {
    this.stream.write(formatter.format(data) + '\\n');
  }
}

// 2. Initialize loggers with JSON formatting writing to the null stream
const zarioLogger = new Logger({
  json: true,
  timestamp: true,
  transports: [new StreamTransport(nullStream)]
});

const pinoLogger = pino(nullStream);

const winstonLogger = winston.createLogger({
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [new winston.transports.Stream({ stream: nullStream })]
});

const ITERATIONS = 100000;

function runSyncBenchmark(name, logFn) {
  // Warmup
  for (let i = 0; i < 10000; i++) {
    logFn();
  }
  
  // GC check
  if (global.gc) global.gc();

  const start = process.hrtime.bigint();
  for (let i = 0; i < ITERATIONS; i++) {
    logFn();
  }
  const end = process.hrtime.bigint();
  const elapsedNs = Number(end - start);
  const opsPerSec = (ITERATIONS * 1000000000) / elapsedNs;
  
  console.log(\`\${name.padEnd(45)}: \${Math.round(opsPerSec).toLocaleString().padStart(12)} ops/sec (\${(elapsedNs / ITERATIONS).toFixed(1)} ns/op)\`);
  return { opsPerSec, nsPerOp: elapsedNs / ITERATIONS };
}

console.log('='.repeat(70));
console.log(\`Benchmarking with \${ITERATIONS.toLocaleString()} iterations:\`);
console.log('='.repeat(70));

console.log('\\n--- Test A: Simple JSON Log message ---');
runSyncBenchmark('Zario (Simple)', () => zarioLogger.info('hello'));
runSyncBenchmark('Pino (Simple)', () => pinoLogger.info('hello'));
runSyncBenchmark('Winston (Simple)', () => winstonLogger.info('hello'));

console.log('\\n--- Test B: JSON Log with Metadata (Structured) ---');
const meta = { userId: 123, path: '/api/users', query: 'filter=active' };
runSyncBenchmark('Zario (With Metadata)', () => zarioLogger.info('Request received', meta));
runSyncBenchmark('Pino (With Metadata)', () => pinoLogger.info('Request received', meta));
runSyncBenchmark('Winston (With Metadata)', () => winstonLogger.info('Request received', meta));

console.log('='.repeat(70));
`;

const benchmarkScriptPath = path.join(tempDir, 'benchmark.js');
fs.writeFileSync(benchmarkScriptPath, benchmarkCode);

const benchmarkResult = spawnSync('node', ['--expose-gc', benchmarkScriptPath], { cwd: tempDir, encoding: 'utf8' });
if (benchmarkResult.status !== 0) {
  console.error('Failed to run benchmark script:', benchmarkResult.stderr);
} else {
  console.log(benchmarkResult.stdout);
}

// 7. Cleanup
console.log('\nCleaning up packaging and temp files...');
try {
  if (fs.existsSync(tarballPath)) fs.unlinkSync(tarballPath);
  // Clean files inside tempDir
  const tempFiles = fs.readdirSync(tempDir);
  for (const file of tempFiles) {
    fs.rmSync(path.join(tempDir, file), { recursive: true, force: true });
  }
  fs.rmdirSync(tempDir);
  console.log('Cleanup complete.');
} catch (err) {
  console.error('Error during cleanup:', err);
}
