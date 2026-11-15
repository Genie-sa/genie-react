---
'genie-react': patch
---

`verify` no longer counts a component mounted at both the start and the end of the window twice. A render claim on one `App` reported `instances:1, activeInstances:2`; it now reports `activeInstances:1`, the instances listed in `deciding`.
