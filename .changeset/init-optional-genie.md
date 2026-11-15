---
"@genie-react/cli": patch
---

`init` on a plain React + Vite app no longer reports `<Genie />` as required. `genie()` connects the app on its own, so the receipt sets `userActionRequired: false` and lists `<Genie />` under the new `data.optionalSteps`, for the Query, Router, memory and timeline tools it adds. When the entry `index.html` loads, or `src/App.tsx`/`src/App.jsx`, already renders `<Genie />`, the `root_route` artifact is `already` and the step is left out.
