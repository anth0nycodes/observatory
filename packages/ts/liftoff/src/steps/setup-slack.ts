import crypto from "node:crypto";
import * as p from "@clack/prompts";
import pc from "picocolors";
import type { Step, StepResult, WizardContext } from "../types.js";
import { getApiBase, getDashboardUrl } from "../utils/config.js";
import { startCallbackServer } from "../utils/localhost-server.js";

const SLACK_SCOPES = [
  "channels:history",
  "channels:read",
  "chat:write",
  "chat:write.public",
  "commands",
  "channels:join",
  "groups:read",
  "im:history",
  "im:read",
].join(",");

let closeServer: (() => void) | null = null;

async function fetchSlackClientId(
  accessToken: string,
): Promise<string | null> {
  try {
    const res = await fetch(`${getApiBase()}/cli/slack-client-id`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { clientId?: string };
    return data.clientId ?? null;
  } catch {
    return null;
  }
}

// The exchange runs server-side because the CLI cannot hold the client
// secret.
async function exchangeSlackCode(
  accessToken: string,
  code: string,
  redirectUri: string,
): Promise<{ ok: true; teamName: string } | { ok: false; error: string }> {
  try {
    const res = await fetch(`${getApiBase()}/cli/slack-callback`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ code, redirectUri }),
    });
    const data = (await res.json()) as {
      ok: boolean;
      teamName?: string;
      error?: string;
    };
    if (data.ok && data.teamName) {
      return { ok: true, teamName: data.teamName };
    }
    return { ok: false, error: data.error ?? "Unknown error" };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export const setupSlackStep: Step = {
  name: "setup-slack",

  async shouldRun(ctx: WizardContext): Promise<boolean> {
    return !ctx.completedSteps.includes("setup-slack");
  },

  async run(ctx: WizardContext): Promise<StepResult> {
    // Extra gap above the heading signals "new chapter".
    p.log.message("");
    p.log.step(pc.bold("Slack bot"));
    p.log.info(
      "Delivers reports and alerts to your workspace about regressions and patterns you'd miss.",
    );

    // The OAuth exchange binds the workspace to the TCC org and needs
    // a signed-in user, so don't ask the question we can't fulfill.
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

    p.log.info(pc.dim("We'll open your browser to connect a Slack workspace."));

    const clientId = await fetchSlackClientId(ctx.accessToken!);
    if (!clientId) {
      p.log.warn(
        "Could not retrieve Slack configuration. Skipping Slack setup.",
      );
      return {
        status: "skipped",
        message: "Failed to fetch Slack client ID",
      };
    }

    const state = crypto.randomBytes(16).toString("hex");
    const { port, waitForCallback, close } =
      await startCallbackServer(state, 300_000); // 5 min, covers first-time Slack install + workspace pick
    closeServer = close;

    const redirectUri = `http://127.0.0.1:${port}/callback`;
    const slackOAuthUrl =
      `https://slack.com/oauth/v2/authorize` +
      `?client_id=${clientId}` +
      `&scope=${encodeURIComponent(SLACK_SCOPES)}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&state=${state}`;

    const openModule = await import("open");
    await openModule.default(slackOAuthUrl);

    const s = p.spinner();
    s.start("Waiting for Slack authorization...");
    const result = await waitForCallback();
    s.stop();

    if (!result) {
      close();
      closeServer = null;
      p.log.warn(
        "Slack authorization timed out or was cancelled.",
      );
      return {
        status: "skipped",
        message: "Slack auth timed out",
      };
    }

    const exchange = await exchangeSlackCode(
      ctx.accessToken!,
      result.code,
      redirectUri,
    );
    close();
    closeServer = null;

    if (!exchange.ok) {
      p.log.warn(
        `Could not complete Slack setup: ${exchange.error}`,
      );
      return {
        status: "skipped",
        message: "Slack token exchange failed",
      };
    }

    p.log.success(
      `Connected to Slack workspace: ${exchange.teamName}`,
    );
    ctx.slackConnected = true;

    p.log.info(
      pc.cyan("Next steps for Slack alerts:\n") +
        "1. Add the Context Company bot to a channel\n" +
        "2. Type /subscribe in that channel to start receiving alerts",
    );

    return { status: "completed" };
  },

  async cleanup(_ctx: WizardContext): Promise<void> {
    if (closeServer) {
      closeServer();
      closeServer = null;
    }
  },
};
