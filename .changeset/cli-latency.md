---
"@genie-react/cli": patch
"genie-react": patch
---

CLI commands that talk to the hub answer about 30% sooner. On Node 26, a warm `call` against a running app went from 93 to 66 ms and `status` from 88 to 61 ms; starting Node itself takes 24 ms. Output, exit codes and failure reasons are unchanged.

- The CLI ships its call path as a few bundled files instead of loading about 80 modules on every run, and caches compiled code in the private per-user Genie directory. `NODE_COMPILE_CACHE` and `NODE_DISABLE_COMPILE_CACHE` keep their usual meaning. The first run after an install or upgrade compiles and fills the cache.
- `status`, `call`, `batch` and `capture export` ask the hub to leave the tool catalog out of its greeting; with 71 tools that greeting was 308 KB. `tools` still receives it.
- `call` and `batch` skip the readiness round trip when the hub's greeting already reports the app ready, and `tools` skips it when the greeting already carries the catalog.
- Hub discovery from a workspace root walks the tree synchronously instead of one awaited directory at a time; from this repository's root it went from 18–45 ms to 11–15 ms on a busy machine.
- `init` writes skill commands that call the installed binary directly, such as `node_modules/.bin/genie-react`, or `../../node_modules/.bin/genie-react` when a workspace hoists it, because `npx`, `pnpm exec` and `yarn` add 75 to 350 ms to every call an agent makes. Before the CLI is installed, on Windows, and with Yarn Plug'n'Play, the skill keeps the package manager's exec command. Rerun `init` after upgrading to refresh the skill. The skill also says when to group reads into one `batch`.
