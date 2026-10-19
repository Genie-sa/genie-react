---
'genie-react': minor
'@genie-react/cli': minor
---

`react_inspect_component` attributes each hook to the custom hooks that called it. Hooks gain `customHooks` (outermost first, e.g. `["useCart","useQuery"]`), and the result gains `customHookGrouping` (`exact`, `partial`, or `unavailable`), so agents can go from a misbehaving hook to the custom hook that owns it.
