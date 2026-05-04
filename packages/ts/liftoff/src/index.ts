import { createRequire } from "node:module";
import * as p from "@clack/prompts";
import pc from "picocolors";
import { runPipeline } from "./pipeline.js";
import { authStep } from "./steps/auth.js";
import { detectFrameworkStep } from "./steps/detect-framework.js";
import { instrumentStep } from "./steps/instrument.js";
import { provisionKeysStep } from "./steps/provision-keys.js";
import { setupMcpStep } from "./steps/setup-mcp.js";
import { setupSlackStep } from "./steps/setup-slack.js";
import { successSummaryStep } from "./steps/success-summary.js";
import type { Step, WizardContext } from "./types.js";
import { setApiBase } from "./utils/config.js";

const require = createRequire(import.meta.url);
const pkg = require("../package.json") as { version: string };

// Truecolor (24-bit) ANSI wrapper. Emits exact brand hex instead of
// the terminal-theme-dependent picocolors ANSI-8 variant.
function rgb(r: number, g: number, b: number, text: string): string {
  return `\x1b[38;2;${r};${g};${b}m${text}\x1b[39m`;
}

const CHEV_BLUE = (t: string) => rgb(30, 143, 230, t); //  #1E8FE6
const CHEV_YELLOW = (t: string) => rgb(255, 197, 39, t); // #FFC527
const CHEV_RED = (t: string) => rgb(241, 57, 92, t); //   #F1395C

function printBanner(): void {
  // Middle chevron has a hollow apex to mirror the split chevron in
  // the actual logo.
  const solid = [
    "████    ",
    "  ████  ",
    "    ████",
    "  ████  ",
    "████    ",
    "        ",
  ];
  const split = [
    "████    ",
    "  ████  ",
    "        ",
    "  ████  ",
    "████    ",
    "        ",
  ];
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
      CHEV_BLUE(solid[i]) +
      gap +
      CHEV_YELLOW(split[i]) +
      gap +
      CHEV_RED(solid[i]);
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

  // Accept both `--api-base <url>` and `--api-base=<url>` forms.
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

  p.outro(`${pc.green("You're all set!")} ${pc.dim("Happy building!")}`);
}

main().catch((err) => {
  console.error("[TCC] Unexpected error:", err);
  process.exit(1);
});
