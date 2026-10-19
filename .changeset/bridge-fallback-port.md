---
"@genie-react/cli": patch
---

When no discovery file exists, fall back to the standalone hub's port 4390 unless the app has a Vite config, instead of always guessing Vite's 5173. `doctor --live` and every command now probe the right port for Next.js and React Native apps.
