const fs = require("fs");
const path = require("path");

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
        ["scripts", "build"],
        ["scripts", "dev"],
        ["scripts", "test"],
        ["scripts", "lint"],
        ["scripts", "check-benchmark-schema"],
        ["scripts", "check-bundle-size"],
        ["scripts", "prepublishOnly"],
        ["scripts", "check-package-schema"],
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

/**
 * Validate one path inside an exports entry.
 */
function validateExportPath(
    value,
    condition,
    extension,
    label,
    errors
) {
    const fieldLabel = `${label}.${condition}`;

    if (typeof value !== "string") {
        errors.push(`${fieldLabel} must be a string`);
        return;
    }

    if (!value.startsWith("./")) {
        errors.push(`${fieldLabel} must start with "./"`);
    }

    if (!value.endsWith(extension)) {
        errors.push(
            `${fieldLabel} must end with "${extension}"`
        );
    }
}

/**
 * Validate one complete entry inside package.json exports.
 */
function validateExportEntry(
    exportName,
    entry,
    errors
) {
    const label = `exports["${exportName}"]`;

    if (
        entry === null ||
        typeof entry !== "object" ||
        Array.isArray(entry)
    ) {
        errors.push(`${label} must be an object`);
        return;
    }

    validateExportPath(
        entry.types,
        "types",
        ".d.ts",
        label,
        errors
    );

    validateExportPath(
        entry.import,
        "import",
        ".js",
        label,
        errors
    );

    validateExportPath(
        entry.require,
        "require",
        ".cjs",
        label,
        errors
    );

    if (exportName.includes("*")) {
        for (const condition of [
            "types",
            "import",
            "require",
        ]) {
            const value = entry[condition];

            if (
                typeof value === "string" &&
                !value.includes("*")
            ) {
                errors.push(
                    `${label}.${condition} must contain "*" for a wildcard export`
                );
            }
        }
    }
}

/**
 * Retrieve a nested value using an array of field names.
 *
 * Example:
 * getNestedValue(data, ["repository", "url"])
 */
function getNestedValue(data, fieldPath) {
    let current = data;

    for (const key of fieldPath) {
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

/**
 * Validate a package.json object against the schema.
 *
 * Returns an array of error messages.
 * An empty array means the object is valid.
 */
function validate(data, schema) {
    const errors = [];

    if (
        data === null ||
        typeof data !== "object" ||
        Array.isArray(data)
    ) {
        return [
            "package.json must contain a JSON object",
        ];
    }

    // Validate string fields.
    for (const fieldPath of schema.strings) {
        const value = getNestedValue(
            data,
            fieldPath
        );

        const label = fieldPath.join(".");

        if (value === undefined) {
            errors.push(
                `Missing required field: ${label}`
            );
        } else if (typeof value !== "string") {
            errors.push(
                `${label} must be a string`
            );
        }
    }

    // Validate array fields.
    for (const fieldPath of schema.arrays) {
        const value = getNestedValue(
            data,
            fieldPath
        );

        const label = fieldPath.join(".");

        if (value === undefined) {
            errors.push(
                `Missing required field: ${label}`
            );
        } else if (!Array.isArray(value)) {
            errors.push(
                `${label} must be an array`
            );
        }
    }

    // Validate boolean fields.
    for (const fieldPath of schema.booleans) {
        const value = getNestedValue(
            data,
            fieldPath
        );

        const label = fieldPath.join(".");

        if (value === undefined) {
            errors.push(
                `Missing required field: ${label}`
            );
        } else if (typeof value !== "boolean") {
            errors.push(
                `${label} must be a boolean`
            );
        }
    }

    // Validate exports.
    if (
        data.exports === null ||
        typeof data.exports !== "object" ||
        Array.isArray(data.exports)
    ) {
        errors.push(
            "exports must be an object"
        );
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

/**
 * Read and validate package.json.
 *
 * Returns true when valid and false when invalid.
 */
function checkFile(filePath, schema) {
    try {
        const contents = fs.readFileSync(
            filePath,
            "utf8"
        );

        const data = JSON.parse(contents);
        const errors = validate(data, schema);

        if (errors.length > 0) {
            console.error(
                "Invalid file structure: package.json"
            );

            for (const error of errors) {
                console.error(`- ${error}`);
            }

            return false;
        }

        console.log(
            "Valid file structure: package.json"
        );

        return true;
    } catch (error) {
        const message =
            error instanceof Error
                ? error.message
                : String(error);

        console.error(
            `Could not validate package.json: ${message}`
        );

        return false;
    }
}

/**
 * Export functions so Jest can import and test them.
 */
module.exports = {
    packageSchema,
    validateExportPath,
    validateExportEntry,
    getNestedValue,
    validate,
    checkFile,
};

/**
 * Only validate the real package.json when this script
 * is executed directly.
 *
 * Importing it from Jest will not run this section.
 */
if (require.main === module) {
    const packagePath = path.resolve(
        __dirname,
        "../package.json"
    );

    const valid = checkFile(
        packagePath,
        packageSchema
    );

    process.exitCode = valid ? 0 : 1;
}