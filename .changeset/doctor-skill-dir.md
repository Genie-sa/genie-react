---
'@genie-react/cli': patch
---

`doctor` checks the agent skill in `GENIE_SKILL_DIR` when it is set, instead of `.agents/skills/genie` and `.claude/skills/genie`. An agent that loads the skill from outside the project, such as `/opt/skills/genie`, no longer gets a missing-skill warning. The directory matches when it holds the skill as shipped in `@genie-react/cli` or as `init` renders it, and a drifted copy names the bundled files to copy there.
