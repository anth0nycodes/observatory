import { createRequire } from "node:module";
import * as p from "@clack/prompts";
import pc from "picocolors";
import { runPipeline } from "./pipeline.js";
import { authStep } from "./steps/auth.js";
import { gitCheckStep } from "./steps/git-check.js";
import { installPackagesStep } from "./steps/install-packages.js";
import { instrumentStep } from "./steps/instrument.js";
import { placeholderSteps } from "./steps/placeholder.js";
import { provisionKeysStep } from "./steps/provision-keys.js";
import type { Step, WizardContext } from "./types.js";
import { setApiBase } from "./utils/config.js";

const require = createRequire(import.meta.url);
const pkg = require("../package.json") as { version: string };

/**
 * Print the liftoff banner: the three Context Company chevrons
 * (blue / yellow-split / red) next to TCC in ANSI-shadow block letters,
 * with the company name as a subtitle. Rendered before the wizard so
 * the terminal has a distinct brand frame on launch.
 */
function printBanner(): void {
  const solid = ["██    ", "  ██  ", "    ██", "  ██  ", "██    ", "      "];
  const split = ["██    ", "  ██  ", "      ", "  ██  ", "██    ", "      "];
  const gap = "  ";

  const tcc = [
    "████████╗ ██████╗ ██████╗",
    "╚══██╔══╝██╔════╝██╔════╝",
    "   ██║   ██║     ██║     ",
    "   ██║   ██║     ██║     ",
    "   ██║   ╚██████╗╚██████╗",
    "   ╚═╝    ╚═════╝ ╚═════╝",
  ];

  console.log();
  for (let i = 0; i < tcc.length; i++) {
    const chev =
      pc.blue(solid[i]) + gap + pc.yellow(split[i]) + gap + pc.red(solid[i]);
    console.log("  " + chev + "   " + pc.bold(tcc[i]));
  }
  console.log();
  console.log("  " + pc.bold("The Context Company"));
  console.log("  " + pc.dim("liftoff · Monitoring for AI Agents"));
  console.log();
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.includes("--help") || args.includes("-h")) {
    console.log(`
${pc.bold("@contextcompany/liftoff")} — Monitoring for AI Agents

${pc.dim("Usage:")}
  npx @contextcompany/liftoff [options]

${pc.dim("Options:")}
  --api-base <url>  TCC API base URL (default: https://api.thecontext.company)
  --help, -h        Show this help message
  --version         Show version number
`);
    process.exit(0);
  }

  if (args.includes("--version")) {
    console.log(pkg.version);
    process.exit(0);
  }

  // Parse --api-base (both `--api-base <url>` and `--api-base=<url>` forms).
  // One flag drives every TCC endpoint the wizard touches, plus the MCP URL
  // baked into editor configs. See src/utils/config.ts for the resolver.
  const apiBaseIdx = args.indexOf("--api-base");
  const apiBaseFromEqual = args
    .find((a) => a.startsWith("--api-base="))
    ?.slice("--api-base=".length);
  const apiBaseArg =
    apiBaseFromEqual ?? (apiBaseIdx !== -1 ? args[apiBaseIdx + 1] : undefined);
  setApiBase(apiBaseArg);

  printBanner();

  const ctx: WizardContext = {
    installDir: process.cwd(),
    completedSteps: [],
  };

  // Pipeline: sign in → provision prod key → pick framework → hand off
  // the agent prompt → optionally wire MCP (mints readonly key only if
  // the user opts in) → optionally wire Slack → summary.
  const steps: Step[] = [
    authStep,
    provisionKeysStep,
    detectFrameworkStep,
    instrumentStep,
    setupMcpStep,
    setupSlackStep,
    successSummaryStep,
  ];

  const success = await runPipeline(steps, ctx);
  if (!success) {
    process.exit(1);
  }

  // Outro
  p.outro(
    `${pc.green("You're all set!")} ${pc.dim("Happy building!")}`,
  );
}

/**
 * Assemble the ordered list of pipeline steps.
 * Each phase adds its steps here as they are implemented.
 */
async function getSteps(): Promise<Step[]> {
  return [gitCheckStep, authStep, provisionKeysStep, ...placeholderSteps];
}

main().catch((err) => {
  console.error("[TCC] Unexpected error:", err);
  process.exit(1);
});
