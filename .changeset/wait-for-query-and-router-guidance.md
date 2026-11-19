---
'genie-react': patch
'@genie-react/cli': patch
---

The bundled agent skill told agents to read renders after `react_quiesce`, which waits for React only, so a TanStack Query refetch could commit after the read. The skill, EVIDENCE.md and the renders guide now wait with `devtools_wait` condition `settled` and `"domains":["react","query","router"]`, and say that `settled` without `domains` also waits for React only.
