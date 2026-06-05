import * as p from "@clack/prompts";
import pc from "picocolors";
import type { Step, WizardContext } from "./types.js";

// Tracks the step currently inside .run() so signal handlers can clean
// up its live resources in addition to already-completed steps.
let runningStep: Step | null = null;

function setupSignalHandlers(ctx: WizardContext, steps: Step[]): void {
  let handled = false;
  const handler = async () => {
    if (handled) return;
    handled = true;
    p.cancel("Setup cancelled.");

    // Clean up the running step first (it may own live resources like
    // the localhost OAuth server), then walk completedSteps in reverse.
    const seen = new Set<string>();
    const queue: Step[] = [];
    if (runningStep) {
      queue.push(runningStep);
      seen.add(runningStep.name);
    }
    for (const name of [...ctx.completedSteps].reverse()) {
      if (seen.has(name)) continue;
      const s = steps.find((x) => x.name === name);
      if (s) {
        queue.push(s);
        seen.add(name);
      }
    }

    for (const step of queue) {
      if (!step.cleanup) continue;
      try {
        await step.cleanup(ctx);
      } catch {
        // Best-effort: don't let one cleanup failure block the rest.
      }
    }
    // Unix convention for SIGINT termination is 128 + signal number.
    process.exit(130);
  };

  process.on("SIGINT", handler);
  process.on("SIGTERM", handler);
}

export async function runPipeline(
  steps: Step[],
  ctx: WizardContext,
): Promise<boolean> {
  setupSignalHandlers(ctx, steps);

  for (const step of steps) {
    const shouldRun = await step.shouldRun(ctx);
    if (!shouldRun) {
      // Only log "already done" for genuine re-entrancy. Steps that
      // opt out for other reasons should stay silent or explain
      // themselves from inside run().
      if (ctx.completedSteps.includes(step.name)) {
        p.log.info(pc.dim(`Skipping ${step.name} (already done)`));
      }
      continue;
    }

    runningStep = step;
    let result;
    try {
      result = await step.run(ctx);
    } finally {
      runningStep = null;
    }

    switch (result.status) {
      case "completed":
        ctx.completedSteps.push(step.name);
        break;
      case "skipped":
        p.log.info(
          pc.dim(`${step.name}: ${result.message ?? "skipped"}`),
        );
        break;
      case "failed":
        p.log.error(
          `${step.name} failed${result.message ? `: ${result.message}` : ""}`,
        );
        return false;
    }
  }

  return true;
}
