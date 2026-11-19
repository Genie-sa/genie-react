---
"genie-react": patch
"@genie-react/cli": patch
---

`verify` can now prove that a Suspense fallback did not hide a component. A fallback above the layout could blank the top bar while a lazy route loaded, and `render TopBar max 0` still passed, because hiding is not a render. Claim `suspense TopBar hidden max 0` instead: it fails when any Suspense boundary above `TopBar` replaced it with its fallback during the window, even if the fallback resolved before `verify end`, and refuses when the evidence is incomplete. `react_error_state` with `afterDocumentCommitId` also returns this `hideLog`.
