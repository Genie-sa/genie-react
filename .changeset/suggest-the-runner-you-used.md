---
"genie-react": patch
"@genie-react/cli": patch
---

Suggested commands (`next`, `fix` and `evidence` lines, and `next.command`/`next.argv` in JSON) now start with the runner you used. Before, a project with a pnpm lockfile always got `pnpm exec genie-react …`, even when you ran `npx genie-react`. Genie reads the runner from `npm_config_user_agent` and falls back to the project's lockfile when it is not set. The installed skill still uses the project's package manager.
