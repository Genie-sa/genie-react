---
'genie-react': minor
---

Make React collector evidence more accurate and cheaper to collect.

- Render causes compare plain-object state and Context values field by field. A value Genie could not compare is reported as `identity-changed-uninspected` with the scan marked truncated, instead of `reference-only`. A Context or state value with a new identity and equal contents counts as an avoidable render. Each Context is reported once.
- A plain wrapper that receives new `children` keeps its parent as the cause. A child that its Suspense boundary reveals again is reported as an update, not a mount. Host-mutation counts ignore work under children that React skipped.
- `react_render_causes` filters `commit` and `afterCommit` by the `documentCommitId` shown on each event. React timeline commits now carry `documentCommitId`.
- `react_effect_audit` with `appOnly` keeps effects of app components whose hook source is unresolved.
- `react_error_state` flags forced boundaries that also committed organically, names anonymous Suspense boundaries `Suspense`, and drops `node_modules` stack frames unless `includeSource` is set.
- `react_reset_overrides` restores the screen through the committed buffer and reports `commitObserved`.
- The ownership `unknown` state and the TanStack mutation store label are reported correctly. Function values show as `ƒ name()`, and reported times are rounded to hundredths of a millisecond.
- `query_get` reports observer errors as `{ name, message }`. `query_invalidate` and `query_refetch` list the matched queries with their settled status, and give a hint with cached keys when nothing matched.
- Components mounted in a second React root resolve by ID. A router or `QueryClient` that appears after Genie starts gets its collectors registered.
- Tracking cost: fiber IDs are no longer re-registered on every commit, which fixes unbounded heap growth. Unmounts are cheaper, evicted unmount records are released, effect event lookups are indexed, and an adaptive budget that grew shrinks back after commits that fit it.
- The client sends throttled heartbeats instead of `app/snapshot` and `app/event` frames.
