---
"@genie-react/cli": patch
---

Tighten the bundled agent skill. Step 1 opens the app with agent-browser or agent-device before checking status, every command passes `--session <name>` instead of exporting `GENIE_SESSION`, and evidence, comparison, and output semantics move to an on-demand `EVIDENCE.md` reference. The repository's `skills/genie` copy is now generated from the bundled skill, and lint fails when they differ.
