---
"genie-react": patch
"@genie-react/cli": patch
---

`redux_actions` no longer loses the app's own actions in apps that use RTK Query. The history kept a fixed 500 records, and RTK Query's own actions and thunks could fill it within one keystroke, so an action such as `issues/filtersChanged` was gone before you could read it. RTK Query's actions, the anonymous thunks that dispatch only those, and unrecorded changes that touch only RTK Query slices are now counted by type in `coverage.libraryActions` instead of filling the history; render causes still name them. Pass `recordLibraryActions: true` to `reduxCollector` to keep them as records, and `historyLimit` (1 to 5000, default 500) to keep more records.
