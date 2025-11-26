const { build } = require("esbuild");

// Build CommonJS version
build({
  entryPoints: ["src/index.ts"],
  bundle: true,
  platform: "node",
  target: "node20",
  outfile: "dist/index.js",
  format: "cjs",
  sourcemap: false,
  minify: true,
}).catch(() => process.exit(1));

// Build ES module version
build({
  entryPoints: ["src/index.ts"],
  bundle: true,
  platform: "node",
  target: "node20",
  outfile: "dist/index.mjs",
  format: "esm",
  sourcemap: false,
  minify: true,
}).catch(() => process.exit(1));
