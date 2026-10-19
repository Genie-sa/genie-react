---
'@genie-react/cli': patch
---

The bundled skill now reports the CLI's version, so `doctor` shows `bundledSkill` 0.18.1 instead of 0.16.0. Releases stamp it from `@genie-react/cli`, and `check:release` fails when it drifts.
