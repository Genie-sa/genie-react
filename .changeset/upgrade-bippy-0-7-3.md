---
'genie-react': patch
---

Upgrade Bippy to 0.7.3. Genie now carries its own copy of `didFiberCommit`, which 0.7.3 removed, so commit detection and render counts are unchanged. Bippy 0.7.3 also forgets a fiber's id as soon as React reports its unmount, so Genie keeps that id until it records the unmount and an unmounted instance in `react_component_cohort` still carries the mount id it had while mounted.
