---
"genie-react": patch
"@genie-react/cli": patch
---

Report hook call sites at their source lines. On Vite, and on webpack with an `eval` source-map devtool, `react_effect_audit`, `react_effect_timeline` and the external-store reports gave a hook's position in the transformed module, such as line 15 of a file whose `useEffect` is on line 13, or line 21 of a 17-line file, with `sourceMapConfidence: "served"`. They now read the module's source map, including the inline map webpack's eval devtools put in each module, and report the original line and column with `sourceMapConfidence: "mapped"`. Stack frames from webpack eval modules are source-mapped the same way.
