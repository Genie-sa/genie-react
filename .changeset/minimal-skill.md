---
'@genie-react/cli': patch
---

The Genie skill is a third of its size (11 KB, from 32 KB) and keeps only what an agent needs to act: connect, open a window before the action, pick the tool for the question, force hard states, verify, and work beside other agents. `APP_TOOLS.md` drops the hand-written Redux recorder now that `reduxCollector(store)` covers Redux, and `SKILL.md` now links it.
