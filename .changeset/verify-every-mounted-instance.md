---
'genie-react': patch
'@genie-react/cli': patch
---

`verify` read at most 200 mounted instances of a target and still graded the claim as if it had seen them all. On a board with 840 `FeatureGate` instances, `render FeatureGate max 0` passed as `semantics: exact` with `instances: 200`. `verify` now lists up to 2,000 instances, and `react_component_cohort` accepts a `limit` up to 2,000. When a target has more, the target and the claim report `omittedInstances`, the count is a lower bound, and a claim that would pass is refused with `evidence_truncated`. A claim that renders prove false still fails.
