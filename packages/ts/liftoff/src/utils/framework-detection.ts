import fs from "node:fs";
import path from "node:path";
import type { Framework, ProjectLanguage } from "../types.js";
import {
  parsePyprojectDeps,
  parseRequirementsTxt,
} from "./python-detection.js";

interface PackageJson {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}
function hasDep(pkg: PackageJson, name: string): boolean {
  return !!(
    pkg.dependencies?.[name] || pkg.devDependencies?.[name]
  );
}

function hasDepPrefix(pkg: PackageJson, prefix: string): boolean {
  const allDeps = {
    ...pkg.dependencies,
    ...pkg.devDependencies,
  };
  return Object.keys(allDeps).some((dep) =>
    dep.startsWith(prefix),
  );
}

// Normalizes hyphens/underscores for comparison.
function hasPythonDep(deps: string[], name: string): boolean {
  const normalized = name.toLowerCase().replace(/_/g, "-");
  return deps.some(
    (dep) => dep.toLowerCase().replace(/_/g, "-") === normalized,
  );
}

export function detectLanguage(
  installDir: string,
): ProjectLanguage {
  if (fs.existsSync(path.join(installDir, "package.json"))) {
    return "typescript";
  }
  if (
    fs.existsSync(path.join(installDir, "pyproject.toml")) ||
    fs.existsSync(path.join(installDir, "requirements.txt"))
  ) {
    return "python";
  }
  return "unknown";
}

// Detection order matters: more specific frameworks come first. Only
// checks the install dir (no traversal into subdirs or node_modules).
export function detectFramework(
  installDir: string,
): Framework | null {
  const pkgPath = path.join(installDir, "package.json");

  if (fs.existsSync(pkgPath)) {
    let pkg: PackageJson;
    try {
      pkg = JSON.parse(
        fs.readFileSync(pkgPath, "utf-8"),
      ) as PackageJson;
    } catch {
      return null;
    }

    if (
      hasDep(pkg, "next") &&
      (hasDep(pkg, "ai") || hasDepPrefix(pkg, "@ai-sdk/"))
    ) {
      return "nextjs-aisdk";
    }

    if (hasDep(pkg, "@mariozechner/pi-coding-agent")) {
      return "pi-mono";
    }

    if (
      fs.existsSync(path.join(installDir, "openclaw.json")) ||
      hasDep(pkg, "openclaw")
    ) {
      return "openclaw";
    }

    if (hasDep(pkg, "@mastra/core")) {
      return "mastra";
    }

    if (hasDep(pkg, "@anthropic-ai/claude-agent-sdk")) {
      return "claude-agent-sdk";
    }

    if (
      hasDep(pkg, "@langchain/core") ||
      hasDep(pkg, "langchain")
    ) {
      return "langchain-ts";
    }

    // Polyglot repos are common in AI/ML (package.json for frontend
    // tooling alongside pyproject.toml for the actual agent). Fall
    // through to Python checks instead of returning null here.
  }

  const hasPyproject = fs.existsSync(
    path.join(installDir, "pyproject.toml"),
  );
  const hasRequirements = fs.existsSync(
    path.join(installDir, "requirements.txt"),
  );

  if (hasPyproject || hasRequirements) {
    const deps = [
      ...parsePyprojectDeps(installDir),
      ...parseRequirementsTxt(installDir),
    ];

    if (
      hasPythonDep(deps, "langchain") ||
      hasPythonDep(deps, "langchain-core")
    ) {
      return "langchain-python";
    }

    if (hasPythonDep(deps, "claude-agent-sdk")) {
      return "claude-agent-sdk-python";
    }

    if (hasPythonDep(deps, "crewai")) {
      return "crewai";
    }

    if (hasPythonDep(deps, "agno")) {
      return "agno";
    }

    return null;
  }

  return null;
}
