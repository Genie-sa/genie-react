---
'genie-react': patch
'@genie-react/cli': patch
---

`react.selfTimeMs` in `devtools_capture_compare` added up one render per component, so typing 27 characters into a field compared about one keystroke, not the whole interaction. The metric now totals the self time of every render in the capture's window, the sum of each listed component's `cumulativeSelfTime`. Comparisons recompute from stored captures, so expect larger values for the same interaction.
