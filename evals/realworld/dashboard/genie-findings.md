# Genie findings from the dashboard app

Found while building `apps/realworld-dashboard` and its probes with Genie 0.19.0 (CLI and runtime
from this checkout), React 19.3.1 in development, TanStack Router 1.170 and Query 5.101, headless
Chromium. Every command used `--json`. Repros assume the app is open and signed in as admin
(`app_login_as {"role":"admin"}`).

| ID  | Severity | Area                     | Summary                                                                  |
| --- | -------- | ------------------------ | ------------------------------------------------------------------------ |
| F3  | High     | `react_render_causes`    | A wasted context render is labelled `necessary` with 8 host mutations   |
| F10 | High     | `react_effect_timeline`  | `appOnly:true` reports TanStack Query's internal effect as app code     |
| F2  | Medium   | `react_render_causes`    | Context causes are per-consumer indices, not the context                 |
| F6  | Medium   | `react_effect_timeline`  | Effect events cannot be tied to the hook that owns them without counting |
| F8  | Medium   | `react_suspense`         | A Suspense query blocker is `unknown` ("waiting on unknown unknown")     |
| F11 | Medium   | `query_get`              | Lists are cut at 100 items with no way to select one entity             |
| F12 | Medium   | Query domain             | No evidence of which keys an invalidation matched                        |
| F13 | Medium   | CLI during reload        | `unknown_tool` while the tab reloads                                     |
| F14 | Medium   | `react_get_tree`, docs   | The documented tree check never reaches app pages behind TanStack Router |
| F1  | Low      | `react_error_state`      | Stack frames are not source-mapped                                       |
| F5  | Low      | `react_render_causes`    | `parent` names the tree parent, not the component that re-rendered      |
| F9  | Low      | `react_render_causes`    | zustand subscriptions appear as `anonymous-external-store`              |
| F15 | Low      | `react_component_cohort` | About 1.8 KB per instance, mostly `logicalPath`                         |

## F3 · High · Wasted context render reported as `necessary`

- Command: `react_clear_renders '{"budget":{"adaptive":true}}'`, click Collapse sidebar on `/`, then
  `react_render_causes '{"component":"StatCard","limit":1,"view":"full"}'`.
- Expected: the render is unnecessary, or at least not labelled necessary. The context value changed
  only in the identity of two functions (`setTheme`, `setLocale`), and the DOM did not change.
- Got: `necessity: "necessary"`,
  `behaviorEvidence.subtreeHostMutations: {"status":"incomplete","count":8}`. A `MutationObserver`
  on `<main>` recorded 0 mutations during the same click. The context `deepDiff` lists only
  `identity-changed-uninspected` on `/setTheme` and `/setLocale`, and still reports
  `truncated: true` after visiting 13 nodes of a 12-key object.
- Cause in Genie: `hasOwnHostMutation` counts host fibers carrying React's `Update` flag. React 19
  sets that flag whenever a host element's props object changes identity, whether or not the DOM
  changes. The context cause also counts as a value change because the diff is truncated.
- Repro: `dashboard-sidebar-rerenders-cards`. An agent asked "are these renders wasted?" gets a
  confident no. The probe avoids the field and counts updates instead.

## F10 · High · Library effect reported as app-owned

- Command: on `/customers/c-0042`, `react_clear_renders '{}'`, click Edit account, then
  `react_effect_timeline '{"component":"CustomerDetailPage","appOnly":true}'`.
- Expected: no app-owned re-runs. The page's only app effect (`pushRecent`) has unchanged
  dependencies.
- Got: one `phase: "update"` execution (effect ordinal 4) with `ownershipCoverage`
  `{"complete":true,"app":1}`. `react_inspect_component` shows that hook's `customHooks` as
  `["useSuspenseQuery","useBaseQuery"]`: TanStack Query's `setOptions` effect, which runs after
  every render by design.
- Repro: decoy `query-observer-effects-rerun`, recorded as a known false positive until effects were attributed to their declaring hook; it is now judged `not-flagged`. An agent hunting
  "an effect runs on every render" is pointed at library code labelled as app code.

## F2 · Medium · Context causes do not name the context

- `react_render_causes` reports `{"kind":"context","name":"Context[0]"}` for `StatCard` and
  `Context[1]` for `UserMenu`, and both are the same `PreferencesContext`. The index is the
  consumer's own hook order, so the same provider has different names in different components. No
  display name, provider component or source is given, and nothing says the two causes share one
  provider. Finding the culprit provider takes a full-view value diff and guesswork.

## F6 · Medium · Effect events cannot be tied to their hook

- `react_effect_timeline` `effectIndex` is the ordinal among effect hooks, while
  `react_inspect_component` `hooks[].index` is the flat hook index. On `OrderDetailPage`, effect 11
  is hook 33 (`usePageView`), and effects 6 and 9 come from `useSuspenseQuery`. The timeline carries
  no `customHooks`, and every event's `source` is the component's returned JSX
  (`order-detail-page.tsx:43`), not the hook call. `react_effect_timeline` also rejects `view`,
  which the render tools accept.
- Repro: `order-page-view-repeats`. Its probe recomputes the ordinal from the inspection, which an
  agent would have to do by hand.

## F8 · Medium · Suspense blocker for a Query is unknown

- Command: `app_set_latency` with
  `{"rules":[{"path":"/api/customers/c-0042/orders","ms":3000}]}`, click Recent orders on
  `/customers/c-0042`, then `react_suspense '{}'`.
- Got: the boundary is correctly identified, but its blocker is
  `{"kind":"unknown","status":"unknown"}` and `waitingHint` reads
  `<Suspense name="Suspense"> #166 shows its fallback, waiting on unknown unknown`, even though
  `capability.asyncDebugInfo` is `available` and the Query domain sees
  `['customers','detail','c-0042','orders']` fetching for that subtree.
- Repro: `customer-orders-tab-blanks-page`.

## F11 · Medium · Large cached lists cannot be inspected by entity

- `query_get '{"queryKey":["orders","list",{"status":"processing"}]}'` returns 100 of 1,051 items
  followed by an explicit `+951 more items` marker. That is honest, but neither `query_get` nor
  `query_get_data` (path and depth only) can select an item by id or page past 100. Checking one
  order's cached status means knowing its array index. The probe for
  `order-hold-failure-not-rolled-back` sorts the table ascending so that its target falls within the
  first 100.

## F12 · Medium · No invalidation evidence

- For `customer-edit-not-reflected`, the decisive fact is "invalidated `['customers','c-0042']`,
  matched 0 queries". Genie records no invalidation calls. `query_notifications` events carry an
  `observerId` but no `queryKey` or `queryHash`, so joining them to a query takes another lookup.
  `query_list_mutations` returned `{"mutations":[]}` right after the save succeeded and its
  component unmounted. The agent has to infer the mismatch from a refetch that never happened.

## F13 · Medium · `unknown_tool` while the tab reloads

- During a Vite full reload, `call query_list_mutations '{}'` failed with `reason: "unknown_tool"`
  and the message "The selected app advertises no tool named query_list_mutations". An immediate
  `tools query` failed with `unknown_session`. The tool exists once the page has loaded. The first
  message reads as "this tool does not exist" rather than "the session is reconnecting; run
  `status --wait`". In the same window,
  `devtools_wait '{"condition":"settled","domains":["react","query"]}'` returned `ok:false` within
  about 5 s with "Domain query requires unavailable tool query_is_fetching" (`documentCommitId` 2),
  instead of waiting for the Query domain to register. A rebuild of the `genie-react` dist made the
  Vite dev server reload the tab mid-probe, which reproduced this once.

## F14 · Medium · Documented tree check misses app pages

- The README's check `react_get_tree '{"depth":3,"maxNodes":50}'` returns only
  `AuthProvider > App > RouterProvider`. With TanStack Router the pages sit about 30 fibers deep,
  behind `Matches > MatchesInner > CatchBoundary > MatchImpl > MatchView > … > Lazy`, and hidden
  library fibers still consume depth. With `appOnly:true` the tree lists `OutletImpl` from
  `@tanstack/react-router`, lucide-react icons (`LayoutDashboard`, `Package`) and TanStack `Link`
  instances (as `sidebar-nav.tsx:47`) as app-owned.

## F1 · Low · Stack frames are not source-mapped

- `react_error_state` maps `boundarySource` (`dashboard-page.tsx:45`), but `caughtErrors[].stack`
  keeps transformed dev-module positions (`carrier-performance-card.tsx:112:37`; the throwing
  source line is 41). Repro: `carrier-card-missing`. The rest of that evidence, including
  `blankTreeHint`, was exactly what the bug needed.

## F5 · Low · `parent` cause names the tree parent

- After collapsing the sidebar, `SidebarNav` and `TopBar` report
  `{"kind":"parent","evidence":"inferred","name":"PreferencesProvider"}`. The component whose state
  changed, and which created their elements, is `AppShell`. Similarly, `ProductPicker` names
  `CardBody` rather than `CreateOrderPage`, whose `form.watch()` drives the renders.

## F9 · Low · zustand subscriptions are anonymous

- `SidebarNav`'s cause is `{"kind":"external-store","evidence":"inferred","name":"anonymous-external-store"}`.
  It gives no store identity or selector, and nothing shows that the component subscribes to the
  whole store. Repro: `order-selection-rerenders-sidebar`.

## F15 · Low · Cohort output is heavy

- `react_component_cohort '{"component":"OrderRow"}'` returns about 31 KB for 17 rows. Each
  instance carries a 930-character `logicalPath`, and the tool has no summary view. At the default
  `limit` of 50, a list page approaches the 100 KB output cap. Probes only need the top-level
  counts.

## Not attributed to Genie

- Once in about 45 variant starts, a fresh fixed variant's tab never reported a ready session within
  20 s ("No app sessions are connected"). The rerun passed. The runner now seeds each variant's
  Vite dependency cache and saves the page errors and server log with any probe error, so a repeat
  can be diagnosed.
- Once, right after a reload, `react_component_cohort` reported `commits: 0` and every row as
  `mountedUnknown` although the UI had committed. It did not reproduce.

## What worked

- `react_error_state` named the swallowed error, the throwing component, the boundary and its
  source in one call.
- `react_component_cohort` made row-level memo bugs and the selection decoy unambiguous.
- The timeline request lane showed the loader waterfall at sub-millisecond precision.
- The effect timeline's `no-cleanup-returned` pinpointed the subscription leak, and
  `strict-mode-replay` labels kept the StrictMode decoy from being flagged.
- `react_suspense` identified the exact boundary showing its fallback.
- Genie was right where the seed was wrong: the first version of `order-hold-rerenders-all-rows`
  rebuilt every row object in an optimistic update. Genie reported one updated row because Query's
  structural sharing restored the unchanged references, so the bug was reseeded with a cause that
  survives structural sharing.
- Calls took about 120 to 260 ms each. Error envelopes (`invalid_args` with `validKeys`,
  `didYouMean` and `correctedExample`) fixed every wrong argument in one retry.
