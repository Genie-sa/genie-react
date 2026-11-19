---
'genie-react': patch
'@genie-react/cli': patch
---

Hook and effect sources from a Vite app lost their `/src` prefix when the file sat in a short directory such as `src/lib`, `src/api` or `src/ui`: a `useEffect` in `src/lib/telemetry.ts` was reported in `/lib/telemetry.ts`. Genie now keeps the path the dev server serves, so the reported file exists.
