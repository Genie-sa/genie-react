---
'genie-react': minor
---

Effect and error evidence now matches what React actually ran and what is on screen.

`react_effect_timeline` and `react_effect_events`:

- `resulting-commit` no longer attaches the next commit to every effect that ran. It appears only after a new `react-update` consequence, which records that React work was scheduled synchronously while the effect or its cleanup ran, and it names the commit that retired that work (`reason: "commit-retired-update-lanes"` or `"committed-during-run"`). When work on the same lanes was already pending, the update is reported as `status: "undetermined"` with `evidence: "unknown"`. Breaking: `observedDomains` now includes `react-update`, and `unobservedDomains` lists `asynchronous-react-update` instead of `state-update`.
- Each observed execution carries a `trigger`: `commit`, `strict-mode-replay` for StrictMode's development re-run of a fresh mount, or `reconnect` when a hidden `Activity` or offscreen subtree is shown again. Previously a StrictMode mount showed the replay's cleanup as the effect's cleanup, so a live subscription looked torn down. `cleanupExecution` now always describes the latest execution.
- Effects that React re-runs when an `Activity` boundary is shown again are reported. A reconnect without a new schedule is its own event with `event: "reconnected"`; a schedule made while hidden is settled by its run on reveal.
- Layout and insertion effect cleanups report `unsupported-effect-kind` instead of a `not-yet-observed` that never resolves. An effect that threw reports `no-cleanup-returned`.
- `coverage.complete` is false when the event history evicted events or a Fast Refresh commit was excluded during the observation. The new `refreshCommitsExcluded` field counts those commits.
- An effect that throws a value without a readable message, such as `Object.create(null)`, now reaches the app's error boundary unchanged. Previously Genie's bookkeeping threw a `TypeError` that replaced the app's error.

`react_effect_audit` and the timeline identify effects by their hook slot. `index` and `effectIndex` count effect hooks in call order and stay stable across renders. Previously `useActionState` (and `useSyncExternalStore` on React 18) shifted positions between renders. That mixed one effect's counts with another's, and reported changed dependency slots against the wrong effect. React-internal effects pushed without a hook, such as `useSyncExternalStore`'s snapshot check, are no longer reported as app effects with no dependency array. `cleanupFunctionObserved` is now true for a mount-only effect that returned a cleanup, and the hot-effect note names `useInsertionEffect` correctly.

`react_error_state`:

- A boundary still showing its fallback stays reported after it re-renders. Previously any re-render without React's capture flag counted as recovery.
- `react_clear_renders` no longer clears caught errors or showing fallbacks; it starts a new observation, but the screen is still blocked.
- Each call re-checks recorded catches against the live tree. A boundary that recovered drops out. One that re-rendered with different state since its catch is reported with `status: "unknown"`, and the hint says it may have recovered. New fields: `status`, `statusReason`, and `boundaryKind`.
- A boundary that catches a second error reports the second message instead of the first.
- An uncaught error that unmounts the whole root is reported as `boundaryKind: "root"`, with a hint that no error boundary caught it, instead of `error boundary <Anonymous>`.
- On React 18, `message` and `stack` are recovered from the error React reports through the window; they were always null before.
- Suspense fallbacks are read from the live tree, so a fallback stays reported across `react_clear_renders` and drops out once resolved.

`react_refresh_events` reports a component whose ancestor remounted during a Fast Refresh under `remounted` and `remountedComponents`. Previously it was listed as having preserved state even though React reset it.
