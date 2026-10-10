---
"@genie-react/cli": patch
---

`init` and `link` now install the agent skill where each agent looks for it. `.agents/skills/genie` stays the canonical copy for Codex, Cursor, and other Agent Skills clients, and `.claude/skills/genie` links to it for Claude Code, falling back to a copy where symlinks are unavailable. `init` writes only into an empty directory or one holding Genie's skill, never follows a symlink out of the project, and replaces files through a temporary file and rename. Any other file, directory, or symlink, including a dangling one, is left untouched and reported as a manual step with `reason: "skill_path_conflict"` and its `path`. `doctor` checks both locations, reports drift or a path conflict for each in `skill.locations`, and tells you to remove a conflicting path instead of rerunning `init`.

The installed skill's commands, doctor remediation, the init receipt's `next`, and CLI error hints now share one prefix from the detected package manager: `npx`, `pnpm exec`, `yarn` for Yarn 2+, `yarn --silent` for Yarn 1 so stdout stays pure JSON, or `bunx`. Projects without a lockfile now get npm commands, including install and dev hints that previously defaulted to pnpm.
