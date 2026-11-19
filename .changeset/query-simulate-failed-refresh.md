---
"genie-react": patch
"@genie-react/cli": patch
---

`query_simulate_state` takes a new `keepData` option for `"state":"error"`. The default, `false`, still simulates a failed first load with no data. `true` simulates a failed background refresh: the cached data and `dataUpdatedAt` stay and TanStack reports `isRefetchError: true`, so you can check how a screen shows a refresh error over data it already has.
