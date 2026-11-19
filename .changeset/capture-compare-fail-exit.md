---
'genie-react': patch
'@genie-react/cli': patch
---

`call devtools_capture_compare` exited 0 when a budget failed, so a CI script could not gate on the comparison. `--fail-on-result-error` now also covers it: the call exits 1 when `overall` is `fail`. Other verdicts, such as `inconclusive` or `insufficient-data`, still exit 0.
