---
"genie-react": patch
"@genie-react/cli": patch
---

`query_simulate_state` now makes a simulated `pending` or `error` query look like one that never loaded. Before, it dropped the data but kept the old `dataUpdatedAt` and `dataUpdateCount`, so a page could show "Updated 12 seconds ago" next to its loading spinner. Both are now 0 during the simulation, and `query_restore_state` puts them back.
