---
'genie-react': patch
'@genie-react/cli': patch
---

A `coverage_incomplete` refusal caused by the interaction unmounting more components than Genie keeps (`droppedUnmountFibers`) no longer suggests beginning again, which lost the same unmounts every time. It now says to start from a page that mounts fewer components or to claim a lower bound, and its fix is `change-claim`.
