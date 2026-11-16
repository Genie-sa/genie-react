---
'genie-react': patch
'@genie-react/cli': patch
---

A `devtools_interaction_begin` or `verify begin` refused because an interaction is already starting or recording on the tab now fails with reason `conflict` and `hubCode: "INTERACTION_ACTIVE"` instead of `invalid_args`, because the arguments were fine, matching the `VERIFICATION_ACTIVE` lock. `details.interactionId` names the recording, now also when a `verify begin` is refused, and `next` stops it. The exit code is 1 (`failure`) instead of 2 (`usage`). The CLI still reads the old `invalid_args` form from a hub on an earlier 1.0 patch.
