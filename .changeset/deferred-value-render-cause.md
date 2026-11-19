---
"genie-react": patch
"@genie-react/cli": patch
---

The render in which a `useDeferredValue` catches up to its new value was graded `unknown` with `unclassified-hook-changed`, although `react_inspect_component` names the hook. With a development build of React it is now an exact `state` cause named `useDeferredValue`, with the before and after values on the hook `react_inspect_component` lists.
