import { defineConfig } from "tsup";

export default defineConfig({
  entry: [
    "src/index.ts",
    "src/full.ts",
    "src/logger.ts",
    "src/encryption.ts",
    "src/queue.ts",
    "src/core/*.ts",
    "src/transports/*.ts",
    "src/filters/*.ts",
    "src/aggregation/*.ts",
    "src/structured/*.ts",
    "src/context/*.ts",
    "src/otel/*.ts",
    "src/utils/*.ts",
    "src/types/*.ts",
  ],
  format: ["esm", "cjs"],
  dts: true,
  // Entry points share one copy of each module, so RequestContext and OTel state are the same in all of them.
  splitting: true,
  clean: true,
  sourcemap: false,
  minify: false,
  target: "node20",
  outDir: "dist",
  treeshake: false,
  cjsInterop: true,
  // ESM output needs __filename for createRequire() in the OTel provider.
  shims: true,
  // Private members have a "_" prefix. Short names make the published core smaller.
  esbuildOptions(options) {
    options.mangleProps = /^_[a-z]/;
  },
});
