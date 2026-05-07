import * as p from "@clack/prompts";
import pc from "picocolors";
import type { Step, StepResult, WizardContext } from "../types.js";
import { getDashboardUrl } from "../utils/config.js";

export const setupSlackStep: Step = {
  name: "setup-slack",

  async shouldRun(ctx: WizardContext): Promise<boolean> {
    return !ctx.completedSteps.includes("setup-slack");
  },

  async run(ctx: WizardContext): Promise<StepResult> {
    p.log.message("");
    p.log.step(pc.bold("Slack bot"));
    p.log.info(
      "Delivers reports and alerts to your workspace about regressions and patterns you'd miss.",
    );

    // The OAuth exchange binds the workspace to a TCC org and needs a
    // signed-in dashboard session, so don't ask if we can't fulfill it.
    if (!ctx.accessToken) {
      p.log.info(
        `Sign in to set this up. You can also wire it up later from the dashboard:\n  ${pc.underline(`${getDashboardUrl()}/prod/settings`)}`,
      );
      return {
        status: "skipped",
        message: "Slack requires sign-in",
      };
    }

    const wantsSlack = await p.confirm({
      message: "Set up our Slack bot?",
      initialValue: true,
    });

    if (p.isCancel(wantsSlack) || !wantsSlack) {
      return { status: "skipped", message: "Slack setup skipped" };
    }

    // Slack pins redirect_uri to an exact match, so the install runs
    // through the dashboard route (already registered with Slack) rather
    // than a localhost callback on a random port.
    const installUrl = `${getDashboardUrl()}/api/integrations/slack/authorize`;

    p.log.info(pc.dim("Opening your browser to connect a Slack workspace."));

    const openModule = await import("open");
    await openModule.default(installUrl);

    p.log.info(
      `If your browser didn't open, visit:\n  ${pc.underline(installUrl)}`,
    );

    ctx.slackOpened = true;

    p.log.info(
      pc.cyan("Once the workspace is connected:\n") +
        "1. Add the Context Company bot to a channel\n" +
        "2. Type /subscribe in that channel to start receiving alerts",
    );

    return { status: "completed" };
  },
};
