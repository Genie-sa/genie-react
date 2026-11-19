---
"genie-react": patch
"@genie-react/cli": patch
---

State exactly when `verify` refuses with `no_activity`: only when the window holds no React commit from any component. On an app whose own timer sets state, a window with no interaction passes, so the docs and the bundled skill now point to a `min 1` claim to catch an action that never reached the app.
