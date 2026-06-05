import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { getMcpServerUrl } from "./config.js";

export type EditorId =
  | "cursor"
  | "claude-code"
  | "windsurf"
  | "vscode"
  | "opencode";

interface EditorConfig {
  name: string;
  configType: "file" | "cli";
  configPath?: (projectDir: string) => string;
  detectPaths: (projectDir: string) => string[];
}

export const EDITOR_CONFIGS: Record<EditorId, EditorConfig> = {
  cursor: {
    name: "Cursor",
    configType: "file",
    configPath: (projectDir) =>
      path.join(projectDir, ".cursor", "mcp.json"),
    detectPaths: (projectDir) => [
      path.join(projectDir, ".cursor"),
      path.join(os.homedir(), ".cursor"),
    ],
  },
  "claude-code": {
    name: "Claude Code",
    configType: "cli",
    detectPaths: () => [],
  },
  windsurf: {
    name: "Windsurf",
    configType: "file",
    configPath: () =>
      path.join(
        os.homedir(),
        ".codeium",
        "windsurf",
        "mcp_config.json",
      ),
    detectPaths: () => [
      path.join(os.homedir(), ".codeium", "windsurf"),
    ],
  },
  vscode: {
    name: "VS Code",
    configType: "file",
    configPath: (projectDir) =>
      path.join(projectDir, ".vscode", "mcp.json"),
    detectPaths: (projectDir) => [
      path.join(projectDir, ".vscode"),
    ],
  },
  opencode: {
    name: "OpenCode",
    configType: "file",
    configPath: (projectDir) =>
      path.join(projectDir, ".opencode", "mcp.json"),
    detectPaths: (projectDir) => [
      path.join(projectDir, ".opencode"),
    ],
  },
};

export function detectEditors(projectDir: string): EditorId[] {
  const detected: EditorId[] = [];

  for (const [id, config] of Object.entries(EDITOR_CONFIGS)) {
    const editorId = id as EditorId;

    if (editorId === "claude-code") {
      // `which` is Unix-only, Windows uses `where`.
      const lookup = process.platform === "win32" ? "where" : "which";
      try {
        execFileSync(lookup, ["claude"], {
          stdio: ["pipe", "pipe", "pipe"],
        });
        detected.push(editorId);
      } catch {
        // Not installed.
      }
      continue;
    }

    const paths = config.detectPaths(projectDir);
    if (paths.some((p) => fs.existsSync(p))) {
      detected.push(editorId);
    }
  }

  return detected;
}

// MCP uses OAuth, so we don't bake any API key into the editor config.
export function buildMcpServerEntry(): {
  type: string;
  url: string;
} {
  return {
    type: "http",
    url: getMcpServerUrl(),
  };
}

// Reads the existing config (if any) and merges in the context-company
// entry, preserving any other configured servers.
export function writeMcpConfig(
  editorId: EditorId,
  projectDir: string,
): void {
  const config = EDITOR_CONFIGS[editorId];
  if (config.configType !== "file" || !config.configPath) {
    throw new Error(
      `Editor ${editorId} does not use file-based config`,
    );
  }

  const configPath = config.configPath(projectDir);
  const dir = path.dirname(configPath);

  fs.mkdirSync(dir, { recursive: true });

  let parsed: Record<string, unknown> = {};
  if (fs.existsSync(configPath)) {
    try {
      const content = fs.readFileSync(configPath, "utf-8");
      parsed = JSON.parse(content) as Record<string, unknown>;
    } catch {
      console.error(
        `[TCC] Could not parse ${configPath}, creating new config`,
      );
      parsed = {};
    }
  }

  if (
    !parsed.mcpServers ||
    typeof parsed.mcpServers !== "object"
  ) {
    parsed.mcpServers = {};
  }

  (parsed.mcpServers as Record<string, unknown>)[
    "context-company"
  ] = buildMcpServerEntry();

  fs.writeFileSync(
    configPath,
    JSON.stringify(parsed, null, 2) + "\n",
    "utf-8",
  );
}

export function runClaudeMcpAdd(): {
  success: boolean;
  error?: string;
} {
  try {
    // execFileSync + arg array so shell metacharacters in the MCP URL
    // (from the user-controlled --api-base flag) can't break out.
    execFileSync(
      "claude",
      [
        "mcp",
        "add",
        "--transport",
        "http",
        "context-company",
        getMcpServerUrl(),
      ],
      {
        stdio: ["pipe", "pipe", "pipe"],
        timeout: 10_000,
      },
    );
    return { success: true };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}
