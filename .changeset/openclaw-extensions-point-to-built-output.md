---
"@contextcompany/openclaw": patch
---

Fix `openclaw plugins install @contextcompany/openclaw` failing with `Also not a valid hook pack: package.json missing openclaw.hooks`.

The `openclaw.extensions` field in `package.json` pointed at `src/index.ts`, which Node can't load directly. openclaw fell back to its hook-pack loader, which then surfaced the misleading error. Repointed to the compiled output `dist/index.cjs` so the extension loads cleanly.
