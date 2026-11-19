---
"genie-react": patch
"@genie-react/cli": patch
---

`react_quiesce` reported `observedCommits: 0` right after a click whose commits landed before the call, which read as "nothing happened". `observedCommits` still counts only commits during the wait, and a new `renderWindow` field reports the open render window at the last sample, with its `commits` including the interaction you waited on, or `null` when no window is open.
