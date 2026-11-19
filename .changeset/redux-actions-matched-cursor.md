---
"genie-react": patch
"@genie-react/cli": patch
---

`redux_actions` now counts `matched` from `afterSequence` when you pass it. It counted every retained match, so a forward page could show 4 records, `more: false` and `omittedBefore: 0` beside `matched: 8`.
