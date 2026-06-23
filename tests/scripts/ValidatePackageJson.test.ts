import {
    getNestedValue,
    packageSchema,
    validate,
    validateExportEntry,
    validateExportPath,
} from "../../scripts/validate-package-json.cjs";

function createValidPackage() {
    return {
        name: "zario",
        version: "0.8.0",
        description:
            "Fast and simple logging library for TypeScript.",
        main: "./dist/index.cjs",
        module: "./dist/index.js",
        types: "./dist/index.d.ts",
        author: "Dev-Dami",
        license: "MIT",
        type: "module",
        homepage:
            "https://github.com/Dev-Dami/zario#readme",

        repository: {
            type: "git",
            url: "git+https://github.com/Dev-Dami/zario.git",
        },

        funding: {
            type: "github",
            url: "https://github.com/sponsors/Dev-Dami",
        },

        bugs: {
            url: "https://github.com/Dev-Dami/zario/issues",
        },

        scripts: {
            build: "tsup",
            dev: "tsup --watch",
            test: "jest",
            lint: "eslint src benchmarks --ext .ts --max-warnings=0",
            "check-benchmark-schema":
                "node scripts/check-benchmark-schema.js",
            "check-bundle-size":
                "bun run scripts/check-bundle-size.js",
            prepublishOnly: "npm run build",
            "check-package-schema":
                "node scripts/validate-package-json.cjs",
        },

        keywords: [
            "logging",
            "logger",
            "typescript",
        ],

        files: [
            "dist/**/*",
            "README.md",
        ],

        sideEffects: false,

        exports: {
            ".": {
                types: "./dist/index.d.ts",
                import: "./dist/index.js",
                require: "./dist/index.cjs",
            },

            "./logger": {
                types: "./dist/logger.d.ts",
                import: "./dist/logger.js",
                require: "./dist/logger.cjs",
            },

            "./core/*": {
                types: "./dist/core/*.d.ts",
                import: "./dist/core/*.js",
                require: "./dist/core/*.cjs",
            },

            "./transports/*": {
                types: "./dist/transports/*.d.ts",
                import: "./dist/transports/*.js",
                require: "./dist/transports/*.cjs",
            },
        },
    };
}

describe("getNestedValue", () => {
    test("returns a top-level value", () => {
        const data = {
            name: "zario",
        };

        expect(
            getNestedValue(data, ["name"])
        ).toBe("zario");
    });

    test("returns a nested value", () => {
        const data = {
            repository: {
                type: "git",
            },
        };

        expect(
            getNestedValue(
                data,
                ["repository", "type"]
            )
        ).toBe("git");
    });

    test("returns undefined when a field is missing", () => {
        const data = {
            repository: {},
        };

        expect(
            getNestedValue(
                data,
                ["repository", "url"]
            )
        ).toBeUndefined();
    });

    test("returns undefined when an intermediate value is null", () => {
        const data = {
            repository: null,
        };

        expect(
            getNestedValue(
                data,
                ["repository", "url"]
            )
        ).toBeUndefined();
    });

    test("returns undefined when an intermediate value is not an object", () => {
        const data = {
            repository: "git",
        };

        expect(
            getNestedValue(
                data,
                ["repository", "url"]
            )
        ).toBeUndefined();
    });
});

describe("validateExportPath", () => {
    test("accepts a valid export path", () => {
        const errors: string[] = [];

        validateExportPath(
            "./dist/index.js",
            "import",
            ".js",
            'exports["."]',
            errors
        );

        expect(errors).toEqual([]);
    });

    test("rejects a non-string export path", () => {
        const errors: string[] = [];

        validateExportPath(
            null,
            "import",
            ".js",
            'exports["."]',
            errors
        );

        expect(errors).toEqual([
            'exports["."].import must be a string',
        ]);
    });

    test('requires a path to start with "./"', () => {
        const errors: string[] = [];

        validateExportPath(
            "dist/index.js",
            "import",
            ".js",
            'exports["."]',
            errors
        );

        expect(errors).toContain(
            'exports["."].import must start with "./"'
        );
    });

    test("requires the correct extension", () => {
        const errors: string[] = [];

        validateExportPath(
            "./dist/index.cjs",
            "import",
            ".js",
            'exports["."]',
            errors
        );

        expect(errors).toContain(
            'exports["."].import must end with ".js"'
        );
    });

    test("reports multiple problems for one path", () => {
        const errors: string[] = [];

        validateExportPath(
            "dist/index.cjs",
            "import",
            ".js",
            'exports["."]',
            errors
        );

        expect(errors).toEqual([
            'exports["."].import must start with "./"',
            'exports["."].import must end with ".js"',
        ]);
    });
});

describe("validateExportEntry", () => {
    test("accepts a valid export entry", () => {
        const errors: string[] = [];

        validateExportEntry(
            ".",
            {
                types: "./dist/index.d.ts",
                import: "./dist/index.js",
                require: "./dist/index.cjs",
            },
            errors
        );

        expect(errors).toEqual([]);
    });

    test("rejects a missing export entry", () => {
        const errors: string[] = [];

        validateExportEntry(
            ".",
            undefined,
            errors
        );

        expect(errors).toEqual([
            'exports["."] must be an object',
        ]);
    });

    test("rejects null as an export entry", () => {
        const errors: string[] = [];

        validateExportEntry(
            ".",
            null,
            errors
        );

        expect(errors).toEqual([
            'exports["."] must be an object',
        ]);
    });

    test("rejects an array as an export entry", () => {
        const errors: string[] = [];

        validateExportEntry(
            ".",
            [],
            errors
        );

        expect(errors).toEqual([
            'exports["."] must be an object',
        ]);
    });

    test("requires types, import, and require", () => {
        const errors: string[] = [];

        validateExportEntry(
            ".",
            {
                types: "./dist/index.d.ts",
            },
            errors
        );

        expect(errors).toContain(
            'exports["."].import must be a string'
        );

        expect(errors).toContain(
            'exports["."].require must be a string'
        );
    });

    test("accepts a valid wildcard export", () => {
        const errors: string[] = [];

        validateExportEntry(
            "./core/*",
            {
                types: "./dist/core/*.d.ts",
                import: "./dist/core/*.js",
                require: "./dist/core/*.cjs",
            },
            errors
        );

        expect(errors).toEqual([]);
    });

    test("requires wildcard export paths to contain an asterisk", () => {
        const errors: string[] = [];

        validateExportEntry(
            "./core/*",
            {
                types: "./dist/core/index.d.ts",
                import: "./dist/core/index.js",
                require: "./dist/core/index.cjs",
            },
            errors
        );

        expect(errors).toEqual([
            'exports["./core/*"].types must contain "*" for a wildcard export',
            'exports["./core/*"].import must contain "*" for a wildcard export',
            'exports["./core/*"].require must contain "*" for a wildcard export',
        ]);
    });
});

describe("validate", () => {
    test("accepts a valid package", () => {
        const data = createValidPackage();

        expect(
            validate(data, packageSchema)
        ).toEqual([]);
    });

    test("rejects null package data", () => {
        expect(
            validate(null, packageSchema)
        ).toEqual([
            "package.json must contain a JSON object",
        ]);
    });

    test("rejects array package data", () => {
        expect(
            validate([], packageSchema)
        ).toEqual([
            "package.json must contain a JSON object",
        ]);
    });

    test("reports a missing top-level string", () => {
        const data = createValidPackage();

        delete data.name;

        const errors = validate(
            data,
            packageSchema
        );

        expect(errors).toContain(
            "Missing required field: name"
        );
    });

    test("reports a missing nested string", () => {
        const data = createValidPackage();

        delete data.repository.url;

        const errors = validate(
            data,
            packageSchema
        );

        expect(errors).toContain(
            "Missing required field: repository.url"
        );
    });

    test("reports a string with the wrong type", () => {
        const data = createValidPackage();

        data.version = 8;

        const errors = validate(
            data,
            packageSchema
        );

        expect(errors).toContain(
            "version must be a string"
        );
    });

    test("reports a missing array", () => {
        const data = createValidPackage();

        delete data.files;

        const errors = validate(
            data,
            packageSchema
        );

        expect(errors).toContain(
            "Missing required field: files"
        );
    });

    test("reports an array with the wrong type", () => {
        const data = createValidPackage();

        data.keywords = "logging";

        const errors = validate(
            data,
            packageSchema
        );

        expect(errors).toContain(
            "keywords must be an array"
        );
    });

    test("reports a missing boolean", () => {
        const data = createValidPackage();

        delete data.sideEffects;

        const errors = validate(
            data,
            packageSchema
        );

        expect(errors).toContain(
            "Missing required field: sideEffects"
        );
    });

    test("reports a boolean with the wrong type", () => {
        const data = createValidPackage();

        data.sideEffects = "false";

        const errors = validate(
            data,
            packageSchema
        );

        expect(errors).toContain(
            "sideEffects must be a boolean"
        );
    });

    test.each([
        null,
        [],
        "exports",
        false,
    ])(
        "rejects invalid exports value: %p",
        (exportsValue) => {
            const data = createValidPackage();

            data.exports = exportsValue;

            const errors = validate(
                data,
                packageSchema
            );

            expect(errors).toContain(
                "exports must be an object"
            );
        }
    );

    test("reports a missing required export", () => {
        const data = createValidPackage();

        delete data.exports["./logger"];

        const errors = validate(
            data,
            packageSchema
        );

        expect(errors).toContain(
            'exports["./logger"] must be an object'
        );
    });

    test("reports incorrect export extensions", () => {
        const data = createValidPackage();

        data.exports["."].types =
            "./dist/index.js";

        data.exports["."].import =
            "./dist/index.cjs";

        data.exports["."].require =
            "./dist/index.js";

        const errors = validate(
            data,
            packageSchema
        );

        expect(errors).toContain(
            'exports["."].types must end with ".d.ts"'
        );

        expect(errors).toContain(
            'exports["."].import must end with ".js"'
        );

        expect(errors).toContain(
            'exports["."].require must end with ".cjs"'
        );
    });

    test("reports multiple independent errors", () => {
        const data = createValidPackage();

        delete data.name;
        delete data.repository.url;

        data.keywords = "logging";
        data.sideEffects = "false";

        delete data.exports["./logger"];

        const errors = validate(
            data,
            packageSchema
        );

        expect(errors).toEqual(
            expect.arrayContaining([
                "Missing required field: name",
                "Missing required field: repository.url",
                "keywords must be an array",
                "sideEffects must be a boolean",
                'exports["./logger"] must be an object',
            ])
        );
    });
});