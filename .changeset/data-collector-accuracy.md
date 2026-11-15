---
'genie-react': minor
---

Query, Router, timeline, and memory tools report what actually happened instead of an optimistic or stale answer.

**Breaking:** `router_navigate` now waits for the router to settle and returns `ok: true` only when it settled on the requested location. A new `outcome` field reports `arrived`, `elsewhere` (a redirect or a newer navigation), `not-found`, `error`, `not-started` (a blocker refused it or is still asking), or `pending`, with `href`, `requestedHref`, `statusCode`, `settled`, and `pendingWork`. A blocked navigation used to leave the call hanging; Router 1.0 returned `ok: true` with the old pathname. Both `router_navigate` and `router_history` accept `timeoutMs` (default 5000).

**Breaking:** `router_history` waits for the browser's asynchronous history event and reports the entry it settled on, with an `outcome` of `moved`, `unchanged`, `no-entry`, or `pending`. It used to return the pathname from before the move. Going back from the first app entry is refused as `no-entry` instead of leaving the app. `canGoBack` and `length` are `null` when the Router release cannot report them; Router 1.0 used to throw.

- `router_get_state` adds `settled`, `pendingWork`, and `resolvedPathname`. It stays unsettled while a stale-while-revalidate loader or the render transition is still running, even after `isLoading` turns false. `pendingMatchCount` now counts pending matches on Router releases that keep them on `router.state`, where it always read 0. `locationSync` compares through the history's `createHref`, so hash-history apps no longer read as `mismatched`.
- `router_clear_cache` is listed as unavailable, with a reason, on Router releases without `clearCache()`.
- TanStack Query 5.0 through about 5.90 no longer breaks the Query tools. Collector start, `query_list`, and `query_get` threw because those releases lack `Query.isFetched()` and, before about 5.40, a public `observers` list. On those releases, observers that attached before Genie started are counted in `observersOmitted`.
- `query_get_data`, `query_set_data`, `query_fetch`, and `query_ensure` use the cached entry for a key, including one hashed by a custom `queryKeyHashFn`. `query_get_data` used to report `found: false`, and the writes and fetches went to a duplicate entry that no component read. `query_set_data` returns `queryHash` and `created`.
- `query_fetch` and `query_ensure` on an infinite query refetch every page and keep its `{ pages, pageParams }` shape. They used to fail with `getNextPageParam is not a function`.
- `query_restore_state` no longer overwrites newer data. When a real refetch lands during a simulation, its data is kept (`superseded`). A real error, invalidation, or in-flight fetch is merged into the captured data (`merged`). A fetch the simulation cancelled or suppressed, such as an app invalidation, is re-run for active queries (`refetched: true`). Each restore reports these in `outcomes`.
- `mutation_rerun` rejects a pending mutation. Re-running one executed it twice, bypassed its scope, and left the app's own `mutate` promise unresolved.
- `query_list_mutations` reports `isPaused` and `scopeId`, so a mutation queued behind another in its scope no longer looks in flight.
- `query_get` and `mutation_get` report an infinite `gcTime` or `staleTime` as `"Infinity"`, and `staleTime` as `"static"` or `"dynamic"` when it is not a number. These values used to break the output contract and print as `null`.
- The Query and Router notification logs keep their evidence without holding unmounted observers, query results, or old router states in memory.
- Timeline request events add `responseReceived`. It is `false` for a same-origin request that got no response (aborted or failed), which used to look like an ordinary completed request. Router releases whose lifecycle events lack `pathChanged` or `hrefChanged`, such as 1.0, record `null` instead of making `timeline_read` fail.
- `browser_fps` marks a sample `hidden` and not comparable when the tab hid and came back between two frames. That stall used to count as real jank.
- `browser_get_memory` reports `precision: "possibly-quantized"` in browsers: by default Chromium buckets and caches these values, so a 40 MB allocation can read as no change. `browser_measure_memory` returns `supported: false` with the browser's reason when Chromium refuses the call, instead of failing.
