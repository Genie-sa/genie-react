---
'genie-react': patch
---

Upgrade Bippy to 0.7.3. Genie now carries its own copy of `didFiberCommit`, which 0.7.3 removed, so commit detection and render counts are unchanged. Bippy 0.7.3 also forgets a fiber's id as soon as React reports its unmount, so Genie keeps the ids it needs across that release: an unmounted instance in `react_component_cohort` still carries the mount id it had while mounted, components inside an unmounted `react_profile_start` root stay targeted, and `react_refresh_events` reports the fiber ids captured when the refresh happened. Renderers whose `bundleType` is above 0 now report a development bundle, matching Bippy's build detection.
