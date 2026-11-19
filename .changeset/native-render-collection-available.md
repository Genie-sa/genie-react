---
"genie-react": patch
"@genie-react/cli": patch
---

On React Native 0.86, `renderCollection` reported `degraded (hook installed after React initialised)` even when the app loaded `genie-react/hook` first. Loading the hook read the global `Node`, which React Native defines lazily, and that loaded the renderer before render tracking started; no commit was missed. Genie now reads `Node` only when it needs it, and `renderCollection` reports `available`.
