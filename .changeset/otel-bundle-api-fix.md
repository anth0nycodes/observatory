---
"@contextcompany/otel": patch
---

Fix endpoint resolution by bundling `@contextcompany/api` at build time. Prior npm releases (1.0.14, 1.0.15) were compiled against the old 3-arg `getTCCUrl(apiKey, prodUrl, devUrl)` signature but resolved `@contextcompany/api` as an external runtime dependency, which drifted to the new 2-arg `getTCCUrl(path, apiKey)` signature in `@contextcompany/api@1.0.2`. The mismatch produced malformed endpoint URLs (e.g. the API key concatenated onto the base host). This release locks the API code in the dist bundle so the signatures can no longer drift.
