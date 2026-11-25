import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { gzipSync } from 'zlib';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Budget of the root entry point, measured on the built package. Run "bun run build" first.
const MAX_MINIFIED = 12_600;
const MAX_GZIP = 5_100;

const tempDir = path.join(__dirname, 'temp-fixtures');
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

const fullFixturePath = path.join(tempDir, 'full-fixture.ts');
const coreFixturePath = path.join(tempDir, 'core-fixture.ts');

const fullFixtureCode = `
import { Logger } from '../../dist/full.js';
const logger = new Logger();
logger.info('hello');
`;

const coreFixtureCode = `
import { Logger } from '../../dist/index.js';
const logger = new Logger();
logger.info('hello');
`;

fs.writeFileSync(fullFixturePath, fullFixtureCode);
fs.writeFileSync(coreFixturePath, coreFixtureCode);

const outFullPath = path.join(tempDir, 'out-full.js');
const outCorePath = path.join(tempDir, 'out-core.js');

// process.exit() inside try skips the finally cleanup, so leave the block with break instead.
try {
check: {
  // Bundle full-fixture
  const fullBuild = spawnSync('bun', [
    'build',
    fullFixturePath,
    '--target=node',
    '--minify',
    `--outfile=${outFullPath}`
  ], { encoding: 'utf8' });

  if (fullBuild.status !== 0) {
    console.error('Failed to bundle full fixture:', fullBuild.stderr);
    process.exitCode = 1;
    break check;
  }

  // Bundle core-fixture
  const coreBuild = spawnSync('bun', [
    'build',
    coreFixturePath,
    '--target=node',
    '--minify',
    `--outfile=${outCorePath}`
  ], { encoding: 'utf8' });

  if (coreBuild.status !== 0) {
    console.error('Failed to bundle core fixture:', coreBuild.stderr);
    process.exitCode = 1;
    break check;
  }

  const full = fs.readFileSync(outFullPath);
  const core = fs.readFileSync(outCorePath);
  const gzip = gzipSync(core, { level: 9 }).length;

  console.log(`zario/full: ${full.length} B minified`);
  console.log(`zario: ${core.length} B minified, ${gzip} B gzip`);

  if (core.length > MAX_MINIFIED || gzip > MAX_GZIP) {
    console.error(`Error: the core is over its budget of ${MAX_MINIFIED} B minified or ${MAX_GZIP} B gzip.`);
    process.exitCode = 1;
    break check;
  }

  console.log('Bundle size check passed.');
}
} finally {
  // Clean up
  try {
    if (fs.existsSync(fullFixturePath)) fs.unlinkSync(fullFixturePath);
    if (fs.existsSync(coreFixturePath)) fs.unlinkSync(coreFixturePath);
    if (fs.existsSync(outFullPath)) fs.unlinkSync(outFullPath);
    if (fs.existsSync(outCorePath)) fs.unlinkSync(outCorePath);
    if (fs.existsSync(tempDir)) fs.rmdirSync(tempDir);
  } catch (err) {
    console.error('Cleanup error:', err);
  }
}
