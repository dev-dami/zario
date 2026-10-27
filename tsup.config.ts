import { defineConfig } from "tsup";

export default defineConfig({
  entry: [
    "src/index.ts",
    "src/logger.ts",
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
  splitting: false,
  clean: true,
  sourcemap: false,
  minify: false,
  target: "node20",
  outDir: "dist",
  treeshake: false,
  cjsInterop: true,
  // ESM output needs __filename for createRequire() in the OTel provider.
  shims: true,
});
