---
"@genie-react/cli": patch
---

`init` and `link` now install the agent skill where each agent looks for it. `.agents/skills/genie` stays the canonical copy for Codex, Cursor, and other Agent Skills clients, and `.claude/skills/genie` links to it for Claude Code, falling back to a copy where symlinks are unavailable. Existing paths that are not Genie's skill are left untouched and reported as manual steps. `doctor` checks both locations, reports drift for each in `skill.locations`, and fails until `init` refreshes them.

The installed skill's commands now use the package manager detected from the lockfile (`npx`, `pnpm exec`, `yarn`, or `bunx`), so they run verbatim in npm, Yarn, and Bun projects.
