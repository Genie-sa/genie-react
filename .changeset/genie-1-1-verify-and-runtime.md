---
"genie-react": minor
"@genie-react/cli": minor
---

Verify claims hold up on more real apps, and new options cover cases that used to pass or fail for the wrong reason.

- `verify` waits for the app's in-flight fetch and XMLHttpRequest calls before it decides, and refuses with `not_quiescent` instead of passing while one is still open. Leave `network` out of `--domains` to turn the wait off.
- New claim `suspense <Component> hidden max <N>` fails when a Suspense fallback hides that component during the interaction.
- `verify` covers up to 2,000 mounted instances of a target and never grades a pass exact when some were left out.
- `reduxCollector` accepts `historyLimit` (1 to 5000) and `recordLibraryActions`. RTK Query's own actions are counted by type instead of filling the history.
- `query_simulate_state` accepts `keepData` with `state: error` to simulate a failed refresh that keeps its data.
- `call devtools_capture_compare --fail-on-result-error` exits 1 when the comparison fails, so CI can gate on it.
