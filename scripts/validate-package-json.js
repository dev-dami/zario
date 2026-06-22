import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const packageSchema = {
  strings: [
    ["name"],
    ["version"],
    ["description"],
    ["main"],
    ["module"],
    ["types"],
    ["author"],
    ["license"],
    ["type"],
    ["homepage"],
    ["repository", "type"],
    ["repository", "url"],
    ["funding", "type"],
    ["funding", "url"],
    ["bugs", "url"],
    ["scripts","build"],
    ["scripts","dev"],
    ["scripts","test"],
    ["scripts","lint"],
    ["scripts","check-benchmark-schema"],
    ["scripts","check-bundle-size"],
    ["scripts","prepublishOnly"],
    ["scripts","check-package-schema"]
    
  ],

  arrays: [
    ["keywords"],
    ["files"],
  ],

  booleans: [
    ["sideEffects"],
  ],

  exports: [
    ".",
    "./logger",
    "./core/*",
    "./transports/*",
  ],
};

function validateExportEntry(exportName, entry, errors) {
  const label = `exports["${exportName}"]`;

  if (
    entry === null ||
    typeof entry !== "object" ||
    Array.isArray(entry)
  ) {
    errors.push(`${label} must be an object`);
    return;
  }

  validateExportPath(entry.types, "types", ".d.ts", label, errors);
  validateExportPath(entry.import, "import", ".js", label, errors);
  validateExportPath(entry.require, "require", ".cjs", label, errors);

  if (exportName.includes("*")) {
    for (const condition of ["types", "import", "require"]) {
      const value = entry[condition];

      if (typeof value === "string" && !value.includes("*")) {
        errors.push(
          `${label}.${condition} must contain "*" for a wildcard export`
        );
      }
    }
  }
}

function validateExportPath(value, condition, extension, label, errors) {
  const fieldLabel = `${label}.${condition}`;

  if (typeof value !== "string") {
    errors.push(`${fieldLabel} must be a string`);
    return;
  }

  if (!value.startsWith("./")) {
    errors.push(`${fieldLabel} must start with "./"`);
  }

  if (!value.endsWith(extension)) {
    errors.push(`${fieldLabel} must end with "${extension}"`);
  }
}

function getNestedValue(data, path) {
  let current = data;

  for (const key of path) {
    if (
      current === null ||
      typeof current !== "object" ||
      !(key in current)
    ) {
      return undefined;
    }

    current = current[key];
  }

  return current;
}

function validate(data, schema) {
  const errors = [];

  for (const path of schema.strings) {
    const value = getNestedValue(data, path);
    const label = path.join(".");

    if (value === undefined) {
      errors.push(`Missing required field: ${label}`);
    } else if (typeof value !== "string") {
      errors.push(`${label} must be a string`);
    }
  }

  for (const path of schema.arrays) {
    const value = getNestedValue(data, path);
    const label = path.join(".");

    if (value === undefined) {
      errors.push(`Missing required field: ${label}`);
    } else if (!Array.isArray(value)) {
      errors.push(`${label} must be an array`);
    }
  }

  for (const path of schema.booleans) {
    const value = getNestedValue(data, path);
    const label = path.join(".");

    if (value === undefined) {
      errors.push(`Missing required field: ${label}`);
    } else if (typeof value !== "boolean") {
      errors.push(`${label} must be a boolean`);
    }
  }

  if (
    data.exports === null ||
    typeof data.exports !== "object" ||
    Array.isArray(data.exports)
  ) {
    errors.push("exports must be an object");
  } else {
    for (const exportName of schema.exports) {
      validateExportEntry(
        exportName,
        data.exports[exportName],
        errors
      );
    }
  }

  return errors;
}


function checkFile(filePath, schema ) {
    
     try {
const contents = fs.readFileSync(filePath, "utf8");
        const data = JSON.parse(contents);

        const errors = validate(data, schema);

        if (errors.length > 0) {
        console.error(`Invalid file structure: package.json`);

        for (const error of errors) {
            console.error(`- ${error}`);
        }

        process.exit(1);
        }

        console.log(`Valid file structure: package.json`);
    } catch (error) {
        const message =
        error instanceof Error ? error.message : String(error);

        console.error(`Could not validate package.json: ${message}`);
        process.exit(1);
  }
}


const packagePath = path.resolve(__dirname, "../package.json");
checkFile(packagePath, packageSchema);