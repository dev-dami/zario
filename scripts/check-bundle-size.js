import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const tempDir = path.join(__dirname, 'temp-fixtures');
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

const rootFixturePath = path.join(tempDir, 'root-fixture.ts');
const loggerFixturePath = path.join(tempDir, 'logger-fixture.ts');

const rootFixtureCode = `
import { Logger } from '../../src/index.ts';
const logger = new Logger();
logger.info('hello');
`;

const loggerFixtureCode = `
import { Logger } from '../../src/logger.ts';
const logger = new Logger();
logger.info('hello');
`;

fs.writeFileSync(rootFixturePath, rootFixtureCode);
fs.writeFileSync(loggerFixturePath, loggerFixtureCode);

const outRootPath = path.join(tempDir, 'out-root.js');
const outLoggerPath = path.join(tempDir, 'out-logger.js');

try {
  // Bundle root-fixture
  const rootBuild = spawnSync('bun', [
    'build',
    rootFixturePath,
    '--target=node',
    '--minify',
    `--outfile=${outRootPath}`
  ], { encoding: 'utf8' });

  if (rootBuild.status !== 0) {
    console.error('Failed to bundle root fixture:', rootBuild.stderr);
    process.exit(1);
  }

  // Bundle logger-fixture
  const loggerBuild = spawnSync('bun', [
    'build',
    loggerFixturePath,
    '--target=node',
    '--minify',
    `--outfile=${outLoggerPath}`
  ], { encoding: 'utf8' });

  if (loggerBuild.status !== 0) {
    console.error('Failed to bundle logger fixture:', loggerBuild.stderr);
    process.exit(1);
  }

  const rootSize = fs.statSync(outRootPath).size;
  const loggerSize = fs.statSync(outLoggerPath).size;

  console.log(`Root bundle size: ${(rootSize / 1024).toFixed(2)} KB`);
  console.log(`Logger bundle size: ${(loggerSize / 1024).toFixed(2)} KB`);

  if (loggerSize >= rootSize) {
    console.error('Error: Logger bundle is not smaller than root bundle!');
    process.exit(1);
  }

  console.log('Bundle size smoke check passed successfully!');
  process.exit(0);
} finally {
  // Clean up
  try {
    if (fs.existsSync(rootFixturePath)) fs.unlinkSync(rootFixturePath);
    if (fs.existsSync(loggerFixturePath)) fs.unlinkSync(loggerFixturePath);
    if (fs.existsSync(outRootPath)) fs.unlinkSync(outRootPath);
    if (fs.existsSync(outLoggerPath)) fs.unlinkSync(outLoggerPath);
    if (fs.existsSync(tempDir)) fs.rmdirSync(tempDir);
  } catch (err) {
    console.error('Cleanup error:', err);
  }
}
