const SUITES = ["hot", "compare", "adversarial", "all"] as const;
type Suite = (typeof SUITES)[number];

function printHelp(): void {
  console.log("Usage: bun benchmarks/run.ts --suite <hot|compare|adversarial|all>");
  console.log("");
  console.log("  hot          Zario hot-path suite (no extra dependencies)");
  console.log("  compare      Cross-library comparison (needs .benchmark/node_modules)");
  console.log("  adversarial  Adversarial cross-library cases + probes (needs .benchmark/node_modules)");
  console.log("  all          Runs hot, compare, then adversarial");
}

async function runSuite(suite: Suite): Promise<void> {
  switch (suite) {
    case "hot": {
      const { runHotSuite } = await import("./logger.bench.js");
      await runHotSuite();
      break;
    }
    case "compare": {
      const { runCompareSuite } = await import("../.benchmark/compare.js");
      runCompareSuite();
      break;
    }
    case "adversarial": {
      const { runAdversarialSuite } = await import("../.benchmark/adversarial.js");
      runAdversarialSuite();
      break;
    }
    case "all":
      await runSuite("hot");
      await runSuite("compare");
      await runSuite("adversarial");
      break;
  }
}

function parseSuiteArg(argv: string[]): string | undefined {
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg.startsWith("--suite=")) return arg.slice("--suite=".length);
    if (arg === "--suite") return argv[i + 1];
  }
  return undefined;
}

const suiteArg = parseSuiteArg(process.argv.slice(2));
if (suiteArg === undefined || suiteArg === "help" || process.argv.includes("--help")) {
  printHelp();
  process.exit(suiteArg === undefined ? 1 : 0);
}
if (!(SUITES as readonly string[]).includes(suiteArg)) {
  console.error(`Unknown suite: ${suiteArg}`);
  printHelp();
  process.exit(1);
}

await runSuite(suiteArg as Suite);
