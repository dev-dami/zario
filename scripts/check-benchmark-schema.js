import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ALLOWED_SCHEMAS_EN = [
  ['Library', 'ops/sec', 'ns/op'],
  ['Library', 'Time (ms)', 'logs/sec']
];

const ALLOWED_SCHEMAS_JP = [
  ['ライブラリ', 'ops/sec', 'ns/op'],
  ['ライブラリ', 'Time (ms)', 'logs/sec']
];

function checkFile(filePath, allowedSchemas) {
  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    return false;
  }

  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  let hasErrors = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith('|') && line.endsWith('|')) {
      const nextLine = lines[i + 1]?.trim() || '';
      if (nextLine.startsWith('|') && nextLine.endsWith('|') && nextLine.replace(/[\s|:\-]/g, '') === '') {
        const columns = line
          .split('|')
          .slice(1, -1)
          .map(col => col.trim());

        const matches = allowedSchemas.some(schema => 
          schema.length === columns.length && schema.every((val, index) => val.toLowerCase() === columns[index].toLowerCase())
        );

        if (!matches) {
          console.error(`Error in ${filePath} (line ${i + 1}): Invalid table header schema: ${JSON.stringify(columns)}`);
          console.error(`Expected one of: ${JSON.stringify(allowedSchemas)}`);
          hasErrors = true;
        }
        
        i++;
      }
    }
  }

  return !hasErrors;
}

const docsDir = path.join(__dirname, '../docs');
const enOk = checkFile(path.join(docsDir, 'benchmarks.md'), ALLOWED_SCHEMAS_EN);
const jpOk = checkFile(path.join(docsDir, 'benchmarks-JP.md'), ALLOWED_SCHEMAS_JP);

if (!enOk || !jpOk) {
  process.exit(1);
} else {
  console.log('Benchmark table-schema consistency check passed successfully!');
  process.exit(0);
}
