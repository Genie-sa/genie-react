---
'genie-react': minor
'@genie-react/cli': patch
---

Suspense, hydration, error, request and Query evidence now matches what realistic Next.js, Vite and React 18 apps actually do.

`react_suspense`:

- Under `next dev` (Turbopack and webpack), `capability` reported `asyncDebugInfo: "unavailable"` with reason `production-build` beside blockers that carried names, timings and stacks. Next.js renders its dev overlay with its own production copy of React, and capability took the weakest of every root. It now describes the roots that hold Suspense boundaries. Development and production roots that both hold boundaries make it `partial` with the new reason `some-roots-without-debug-info`, and boundaries of the production root report `blockerStatus: "unavailable"`.
- Blockers are ordered by what held the boundary longest: pending ones by how long they have waited, then settled ones by duration. The RSC stream entry, which spans the whole request, comes after the awaits it carried. On the storefront the summary used to show a 150 ms await and nine script loads while the 1,600 ms await that held the boundary came 19th.
- `durationMs` is reported whenever React recorded a start and an end. It used to be `null` for server I/O whose promise had no readable status.
- `serverComponents` lists the server components React recorded for the boundary and the content inside it, and now appears in the summary view, with `serverComponentsOmitted`. It used to read only the boundary element and was nearly always empty.
- `coverage.serverAwaits` is `last-settled-per-await` when server I/O is listed: React records one I/O per `await`, so for `Promise.all` only the read that settled last appears.
- A promise thrown by TanStack Query's `useSuspenseQuery` is named by its query when the Query collector runs: `kind: "data-library"`, `kindEvidence: "inferred"`, `status: "pending"` with `pendingForMs`, the component that started it as `awaitedBy`, and a new `query` field with `queryHash` and `queryKey`. It used to read "waiting on unknown unknown". The join is made only one to one, for queries still fetching that a render under that boundary started.
- Each boundary reports `hydration`: `hydrated`, or `client-rendered` when React discarded its server HTML.

New `react_hydration` tool. It reports whether server-rendered HTML hydrated or React threw it away and rendered on the client, read from the fibers: a boundary whose server HTML React deleted, or a root React flagged to render on the client. Each entry lists the reports React raised for it; none means React discarded the HTML silently, as it does when an update reaches a boundary before it hydrates. Reports include the hydration errors React passed to `onRecoverableError` and its attribute-mismatch warnings, with the client and server values from React's development diff, the component and element React named, the nearest boundary and the digest. Hydration mismatches used to appear nowhere.

`react_error_state`: each caught error reports `rendered`, what its boundary renders in place of its children: `nothing` (no DOM, so the failure is invisible: a swallowed error), `empty`, `visible` with the text it shows, or `unknown` without a DOM. `blankTreeHint` says the same. A boundary rendering `null` and one showing "Reviews are unavailable" used to look identical.

Timeline request lane:

- Each request reports its `method`, and `query` with parameter names kept and each value replaced by a salted hash (`~` and 10 hex digits), so `?q=` and `?q=webhook`, or `range=7d` and `range=90d`, are told apart without exposing values. The salt never leaves the page. Start a recording with `"queryValues":"plain"` to see values; parameters named like credentials stay hashed. Query strings used to be dropped.
- `outcome` distinguishes `response`, `aborted`, `aborted-after-response`, `failed` and `in-flight`. Requests still unanswered at `timeline_stop` are recorded as `in-flight` events, and an abort after the response headers no longer looks like a normal response. `bodyReadMs` says when the app finished reading the body.
- For overlapping requests to the same method and path, `overlappingSameEndpoint`, `finishedAfterNewer` and `bodyReadLast` show a response race: which request started first, which answered last, and whose body the app read last.
- The new coverage code `resource-timing-and-fetch` describes the request lane when the app's `fetch` and `XMLHttpRequest` calls are observed during a recording. Requests sent through a `fetch` reference saved before recording have `method: null`.

Query tools:

- New `query_invalidations` lists the app's `invalidateQueries`, `refetchQueries`, `resetQueries` and `removeQueries` calls with the filter each passed, the queries it matched at that moment (including none), whether each was active, cached keys that share the filter's first segment, and the call stack. Calls made by Genie tools are marked `byGenie`.
- `query_get` and `query_get_data` accept `where` (`{"field":"id","equals":"o-1042"}`) to select entries of a list by a field value instead of by index, past the first 100 items. Matches come back under `selection` with their paths.
- `query_notifications` events carry `queryHash` and `queryKey`, and the tool accepts a `queryHash` filter.
- `query_restore_state` could restore older data over a real refetch that landed in the same millisecond as the original fetch, and the fetch counters in `query_get` and `query_list` could miss such a fetch. Both now compare TanStack Query's update counts instead of millisecond timestamps.

`router_get_state` stays unsettled while a stale-while-revalidate loader keeps running after a second load cleared `isFetching` on every match, as TanStack Router releases before the load-lane rewrite do. `devtools_wait` on `settled` used to finish while that loader was still running.

The skill names `react_hydration` and `query_invalidations`, and explains swallowed errors, `Promise.all` server awaits and hashed query values.
