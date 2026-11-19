---
'genie-react': patch
'@genie-react/cli': patch
---

`react_suspense` stack frames and blocker locations from a Vite app lost their `/src` prefix when the file sat in a short directory such as `src/lib` or `src/api`: a fetch awaited in `src/lib/orders.ts` was reported at `/lib/orders.ts:4`. Genie now keeps the path the dev server serves, as it already did for hook and effect sources.
