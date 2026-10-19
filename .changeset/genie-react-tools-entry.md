---
"genie-react": minor
---

Add `genie-react/tools`, which exports `defineGenieTool`, `GenieToolError`, `registerGenieTools`, `useGenieTool`, and `useGenieTools` without importing TanStack, so Next.js, React Native, and other apps without both TanStack peers can use the app tool hooks. The root `genie-react` entry still exports them alongside `<Genie />`.
