---
'genie-react': minor
'@genie-react/cli': minor
---

Consolidate the app-side packages into one `genie-react` package.

`@genie-react/core`, `client`, `react-collector`, `tanstack-collector`, `devtools-plugin`, `memory`, `react`, `bridge`, and `vite` are replaced by the single `genie-react` package with subpath exports: `genie-react` (the `<Genie />` component), `genie-react/vite` (the plugin), `genie-react/client` + `genie-react/hook` (the injected client), `genie-react/hub` (the standalone bridge), and `genie-react/protocol` (wire protocol + tool contracts).

Migration: `pnpm add -D genie-react`, then `import { Genie } from 'genie-react'` and `import { genie } from 'genie-react/vite'`. The CLI (`@genie-react/cli`) is unchanged in usage; `genie init`, `doctor`, and `link` now wire the single package.
