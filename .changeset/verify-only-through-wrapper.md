---
'genie-react': patch
'@genie-react/cli': patch
---

A `render <Name> only <cause>` claim could not pass on a class component wrapped in `connect()`. Every render also carried an inferred `parent` cause, so the claim was refused with `evidence_inferred` and no claim to write instead. When that parent is the component's own wrapper and the wrapper rendered only for exact causes the claim allows, `verify` now counts the parent cause as settled and the claim can pass. The deciding event names the wrapper and its causes.
