import fs from "node:fs";
import path from "node:path";
import { fileExists, readFile, writeFile } from "./file-utils.js";

// Next.js uses .env.local, other frameworks use .env.
export function getEnvFilename(isNextJs: boolean): string {
  return isNextJs ? ".env.local" : ".env";
}

export function ensureEnvFile(
  installDir: string,
  isNextJs: boolean,
): string {
  const filename = getEnvFilename(isNextJs);
  const envPath = path.join(installDir, filename);

  if (!fileExists(envPath)) {
    writeFile(envPath, "");
  }

  return envPath;
}

export function hasEnvVariable(envPath: string, key: string): boolean {
  const content = readFile(envPath);
  if (!content) return false;

  const regex = new RegExp(`^${escapeRegex(key)}=`, "m");
  return regex.test(content);
}

export function setEnvVariable(
  envPath: string,
  key: string,
  value: string,
): void {
  let content = readFile(envPath) || "";

  const regex = new RegExp(`^${escapeRegex(key)}=.*$`, "m");

  if (regex.test(content)) {
    // Replacer function so $&, $', etc. inside `value` aren't
    // interpreted as special patterns by String.replace.
    content = content.replace(regex, () => `${key}=${value}`);
  } else {
    if (content.length > 0 && !content.endsWith("\n")) {
      content += "\n";
    }
    content += `${key}=${value}\n`;
  }

  writeFile(envPath, content);
}

export function ensureGitignore(
  installDir: string,
  envFilename: string,
): void {
  const gitignorePath = path.join(installDir, ".gitignore");

  let content = "";
  if (fs.existsSync(gitignorePath)) {
    content = fs.readFileSync(gitignorePath, "utf-8");
  }

  const lines = content.split("\n").map((l) => l.trim());
  if (lines.includes(envFilename)) {
    return;
  }

  if (content.length > 0 && !content.endsWith("\n")) {
    content += "\n";
  }
  content += `\n# Environment variables\n${envFilename}\n`;

  fs.writeFileSync(gitignorePath, content, "utf-8");
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
