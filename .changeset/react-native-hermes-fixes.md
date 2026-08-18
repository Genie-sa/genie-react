---
'genie-react': patch
'@genie-react/cli': patch
---

Fix React Native (Hermes) support and misleading zero-render reports (#69): fall back to a Map/Set/Date-aware clone where `structuredClone` is missing so importing `genie-react/native` no longer throws on Hermes; add `default` export conditions so Metro can resolve `genie-react/hook` and every other subpath; report `renderCollection` availability in `react_get_renders` so a hook installed after React is distinguishable from "nothing re-rendered"; schedule an explicit re-render after `react_override_hook_state` and report `commitObserved` with a warning when no commit followed; make `.genie/` self-gitignoring; and echo the required keys plus a minimal valid invocation in `invalid-args` tool errors.
