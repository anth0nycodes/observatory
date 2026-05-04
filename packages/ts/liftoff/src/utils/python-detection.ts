import fs from "node:fs";
import path from "node:path";

function normalizePyPkg(raw: string): string {
  // Strip version specifiers, then drop any extras bracket
  // ("langchain[all]>=0.2" -> "langchain"). Without the bracket strip,
  // crewai[tools] / langchain[openai] never match hasPythonDep().
  return raw
    .trim()
    .toLowerCase()
    .replace(/_/g, "-")
    .split(/[>=<!~;]/)[0]
    .split("[")[0]
    .trim();
}

// Reads `[project]` dependencies and `[project.optional-dependencies]`
// using regex (no TOML library).
export function parsePyprojectDeps(installDir: string): string[] {
  const filePath = path.join(installDir, "pyproject.toml");

  if (!fs.existsSync(filePath)) {
    return [];
  }

  let content: string;
  try {
    content = fs.readFileSync(filePath, "utf-8");
  } catch {
    return [];
  }

  const deps: string[] = [];

  // Isolate the [project] section body before matching `dependencies`.
  // Without isolation, a [project] without dependencies followed by
  // e.g. [tool.poetry.dev-dependencies] would match the latter's deps.
  const projSection = content.match(
    /\[project\]\s*\n([\s\S]*?)(?=\n\[|$)/,
  );
  if (projSection) {
    const projMatch = projSection[1].match(
      /(?:^|\n)dependencies\s*=\s*\[([\s\S]*?)\]/,
    );
    if (projMatch) {
      const items = projMatch[1].match(/"([^"]+)"|'([^']+)'/g);
      if (items) {
        for (const item of items) {
          const cleaned = item.replace(/["']/g, "");
          const name = normalizePyPkg(cleaned);
          if (name) {
            deps.push(name);
          }
        }
      }
    }
  }

  // PEP 621 puts optional deps under a single
  // `[project.optional-dependencies]` table as key-value pairs.
  const inlineOptMatch = content.match(
    /\[project\.optional-dependencies\]\s*\n([\s\S]*?)(?=\n\[|$)/,
  );
  if (inlineOptMatch) {
    const arrays = inlineOptMatch[1].matchAll(
      /\w+\s*=\s*\[([\s\S]*?)\]/g,
    );
    for (const arr of arrays) {
      const items = arr[1].match(/"([^"]+)"|'([^']+)'/g);
      if (items) {
        for (const item of items) {
          const cleaned = item.replace(/["']/g, "");
          const name = normalizePyPkg(cleaned);
          if (name) {
            deps.push(name);
          }
        }
      }
    }
  }

  return deps;
}

export function parseRequirementsTxt(
  installDir: string,
): string[] {
  const filePath = path.join(installDir, "requirements.txt");

  if (!fs.existsSync(filePath)) {
    return [];
  }

  let content: string;
  try {
    content = fs.readFileSync(filePath, "utf-8");
  } catch {
    return [];
  }

  const deps: string[] = [];
  const lines = content.split("\n");

  for (const line of lines) {
    const trimmed = line.trim();

    if (
      !trimmed ||
      trimmed.startsWith("#") ||
      trimmed.startsWith("-r") ||
      trimmed.startsWith("-e") ||
      trimmed.startsWith("-i") ||
      trimmed.startsWith("-f") ||
      trimmed.startsWith("--")
    ) {
      continue;
    }

    const name = normalizePyPkg(trimmed);
    if (name) {
      deps.push(name);
    }
  }

  return deps;
}
