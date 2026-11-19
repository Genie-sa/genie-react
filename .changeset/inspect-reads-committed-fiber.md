---
"genie-react": patch
"@genie-react/cli": patch
---

`react_inspect_component` and the other tools that take a component `id` now always read the committed fiber. Before, after a component skipped a commit that re-rendered a sibling, they could read React's stale alternate buffer and return old props and state. For example, they returned `{"range":"7d"}` while the page showed `90d`.
