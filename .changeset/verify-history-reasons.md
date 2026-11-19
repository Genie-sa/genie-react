---
'genie-react': patch
'@genie-react/cli': patch
---

The verify history line names only the reasons behind an earlier run's verdict. Before, a run that failed on one claim was listed as `previous fail vfy_… (target_not_found)` when another claim had been refused with `target_not_found`; it is now `previous fail vfy_…`.
