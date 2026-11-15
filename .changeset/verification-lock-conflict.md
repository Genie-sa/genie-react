---
'genie-react': patch
'@genie-react/cli': patch
---

A call refused because a `verify` window is recording on the tab now fails with reason `conflict` and `hubCode: "VERIFICATION_ACTIVE"` instead of `invalid_args`, because the arguments were fine. This covers `react_clear_renders`, `react_profile_start`, `react_profile_stop`, `devtools_interaction_begin`, the override tools, and a second `verify begin` on the same tab. `next` still ends the blocking verification, and the exit code is now 1 (`failure`) instead of 2 (`usage`). The CLI still reads the old `invalid_args` form from a hub on an earlier 1.0 patch.
