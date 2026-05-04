// Central resolver for the TCC endpoint base URL. Resolution order:
// (1) the URL set via setApiBase() from --api-base, (2) TCC_BASE_URL
// env var (matches the SDK packages, undocumented; for CI / dev),
// (3) prod default.

const DEFAULT_API_BASE = "https://api.thecontext.company";
const DEFAULT_DASHBOARD_URL = "https://www.thecontext.company";

let overrideApiBase: string | undefined;

export function setApiBase(url: string | undefined): void {
  overrideApiBase = url?.replace(/\/+$/, "") || undefined;
}

export function getApiBase(): string {
  if (overrideApiBase) return overrideApiBase;
  const fromEnv = process.env.TCC_BASE_URL?.replace(/\/+$/, "");
  if (fromEnv) return fromEnv;
  return DEFAULT_API_BASE;
}

export function getMcpServerUrl(): string {
  return `${getApiBase()}/mcp`;
}

// The dashboard is a separate subdomain, so it isn't derived from
// --api-base. Hardcoded until self-hosted customers need an override.
export function getDashboardUrl(): string {
  return DEFAULT_DASHBOARD_URL;
}
