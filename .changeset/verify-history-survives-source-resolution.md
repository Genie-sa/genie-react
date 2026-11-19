---
'genie-react': patch
'@genie-react/cli': patch
---

`verify` keeps the rerun history of the same claims on the same tab when a target's source file resolves on one run and not the other, as can happen right after a reload. Before, such a rerun got a new ledger fingerprint and started again at attempt 1 with no history.
