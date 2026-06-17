import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { createPiTelemetryListener } from "./instrument";
import { setDebug } from "./logger";
import type { TCCPiConfig } from "./types";

type PiExtensionApi = {
  on: (
    event: string,
    handler: (event: unknown, ctx: PiExtensionContext) => unknown
  ) => void;
  registerCommand?: (
    name: string,
    options: {
      description?: string;
      handler: (args: unknown, ctx: PiExtensionContext) => unknown;
    }
  ) => void;
};

type PiExtensionContext = {
  cwd?: string;
  sessionManager?: {
    getSessionFile?: () => string | undefined;
  };
};

function envFlag(value: string | undefined): boolean {
  return value === "1" || value === "true" || value === "yes";
}

type ExtensionConfigFile = {
  metadata?: Record<string, unknown>;
};

function readConfigFile(path: string): ExtensionConfigFile {
  if (!existsSync(path)) return {};

  try {
    const parsed = JSON.parse(readFileSync(path, "utf8"));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      console.warn(`[TCC Pi] Ignoring ${path}: expected a JSON object.`);
      return {};
    }

    const metadata = (parsed as ExtensionConfigFile).metadata;
    if (
      metadata !== undefined &&
      (!metadata || typeof metadata !== "object" || Array.isArray(metadata))
    ) {
      console.warn(
        `[TCC Pi] Ignoring metadata in ${path}: expected an object.`
      );
      return {};
    }

    return parsed as ExtensionConfigFile;
  } catch (err) {
    console.warn(`[TCC Pi] Ignoring invalid JSON in ${path}:`, err);
    return {};
  }
}

function loadMetadata(): Record<string, unknown> {
  const globalConfig = readConfigFile(
    join(homedir(), ".pi", "agent", "tcc.json")
  );
  const projectConfig = readConfigFile(join(process.cwd(), ".pi", "tcc.json"));

  return {
    ...(globalConfig.metadata ?? {}),
    ...(projectConfig.metadata ?? {}),
  };
}

function loadConfig(): TCCPiConfig {
  const metadata = loadMetadata();

  return {
    metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
    debug: envFlag(process.env.TCC_DEBUG),
  };
}

function mergeEvent(
  type: string,
  event: unknown
): { type: string; [key: string]: unknown } {
  if (event && typeof event === "object") {
    return { type, ...(event as Record<string, unknown>) };
  }
  return { type };
}

export default function tccPiExtension(pi: PiExtensionApi): void {
  const config = loadConfig();
  if (config.debug) setDebug(true);

  const telemetry = createPiTelemetryListener(config);
  const forward = (type: string) => (event: unknown) => {
    telemetry.listener(mergeEvent(type, event));
  };

  pi.on("agent_start", forward("agent_start"));
  pi.on("message_end", forward("message_end"));
  pi.on("tool_execution_start", forward("tool_execution_start"));
  pi.on("tool_execution_update", forward("tool_execution_update"));
  pi.on("tool_execution_end", forward("tool_execution_end"));
  pi.on("agent_end", forward("agent_end"));
  pi.on("session_shutdown", async () => {
    await telemetry.flush();
  });

  pi.registerCommand?.("tcc-status", {
    description: "Show The Context Company telemetry status",
    handler: async () => {
      await telemetry.flush();
      const lastRunId = telemetry.getLastRunId();
      return lastRunId
        ? `TCC telemetry is active. Last run ID: ${lastRunId}`
        : "TCC telemetry is active. No Pi agent run has completed yet.";
    },
  });
}
