---
"genie-react": patch
---

`genie-react/babel` supports Babel 8 as well as Babel 7, and `npm install genie-react` no longer fails with `ERESOLVE` in a project on `@babel/core` 8. The plugin's declared types now hold under either major: Babel 8 bundles its own types and renamed `PluginObj` to `PluginObject`.
