# Genie findings from the storefront

Observed while building `apps/realworld-storefront` and its probes with Genie 0.19.0 (workspace build), Next.js 16.2.10 and the React 19.3 canary that Next bundles for the App Router. Each finding names the command, what an agent needs, what Genie returned, a repro in this app, and a severity. "Both bundlers" means `next dev` (Turbopack) and `next dev --webpack`.

Severity: **high** means wrong or hidden evidence presented as certain, or a default that sends an agent the wrong way. **Medium** means evidence an agent needs is missing or overstated. **Low** means friction.

## High

### 1. `react_suspense` reports `asyncDebugInfo: "unavailable"` while returning that debug info

- Command: `call react_suspense '{}' --json` on any page, both bundlers.
- Expected: a capability that says async debug info is available in a development server.
- Got: `"capability": {"bundle": "production", "asyncDebugInfo": "unavailable", "reason": "production-build"}`, and in the same response, boundaries with `server-io` blockers that carry durations, `awaitedBy` server component names and await stacks.
- Impact: the skill says "check its `capability` first", so an agent following it discards correct evidence about streaming.
- Repro: open `/` and call `react_suspense`.

### 2. Client components rendered by server components lose app ownership (Turbopack), and library components are labelled app (both bundlers)

- Commands: `react_get_tree`, `react_get_renders`, `react_effect_audit`, `react_find_components`.
- Expected: `ShopProviders`, `CatalogResults` and `DealCountdown` are app components. `QueryClientProvider` and `next/link`'s `LinkComponent` are library components.
- Got on Turbopack: source is the JSX call site, which for a client component rendered by a server component is an unmapped `.next/dev/server/chunks/ssr/*.js` file. Ownership is therefore `unknown`, and the `appOnly` defaults hide those components:
  - `react_get_tree '{"depth":60}'` lists only `QueryClientProvider`, `WishlistProvider` and `LinkComponent` as app (3 of 156).
  - `react_get_renders '{"nameFilter":"CatalogResults"}'` returns `components: []` after a sort that re-rendered it, while `react_component_cohort` reports `mounted-updated`. Only a `filteredNote` warning hints at the gap.
  - `react_effect_audit '{"component":"DealCountdown"}'` returns no effects until `appOnly:false`.
- On both bundlers, `QueryClientProvider` and `LinkComponent` come back with `ownership: "app"` and `isLibrary: false`, because they are created in app files.
- Under webpack the server-rendered call site maps to `./app/layout.tsx`, so the hidden-component part is Turbopack-only.
- Impact: in an App Router app, most top-level client components are children of server components, so the default views omit exactly the components an agent is asked about.

### 3. `react_suspense` summary omits the blocker that held the boundary

- Command: `call react_suspense '{}' --json` (summary view, `blockerLimit` 10).
- Expected: the 1600 ms `EditorsPicks` server await that kept the "Featured this week" boundary in fallback.
- Got: the shared boundary lists `FeaturedCollection` (150 ms) and nine 5–8 ms `lazy` "script" blockers (client reference chunk loads for `LinkComponent`), with `blockersOmitted: 15`. The 1600 ms blocker is the 19th entry in `view:"full"`. `serverComponents` is `[]` although every server-io blocker names its server component.
- Impact: an agent reading the default output concludes the boundary waited 150 ms.
- Repro: shipped `/` (bug `home-featured-wait`).

### 4. Effect dependency changes reported as `[]` with `evidence: "exact"`

- Command: `call react_effect_timeline '{"component":"ShippingOptions"}' --json` after typing nine characters on the checkout Delivery step.
- Expected: every run lists dependency slot 0, since the only dependency is a new object on each render.
- Got: nine executed runs, each with a cleanup. `changedDependencySlots` alternates `[0]` and `[]`, and `react_effect_audit` reports `lastChangedDep: null`.
- Repro: bug `checkout-quote-effect`.

### 5. Hydration failures are invisible

- Commands: `react_error_state`, `react_suspense`, `timeline_*`.
- Expected: some record that React threw "Hydration failed because the server rendered text didn't match the client" and regenerated a subtree on the client.
- Got: `caughtErrors: []`, and no tool or timeline lane reports recoverable or hydration errors. `react_suspense` shows every boundary as `content` afterwards.
- Related: a provider that set state in a mount effect (an earlier version of `ThemeProvider` and `WishlistProvider` in this app) made React discard the server HTML of every dehydrated boundary below it and client-render it with no error at all, which also hid the text mismatch. Genie has no hydrated-versus-client-rendered signal for either case.
- Repro: bug `delivery-date-hydration` with a `de-DE` browser. Its probe is blocked; the control probe captures `reportError`.

## Medium

### 6. Parallel server awaits are dropped from `react_suspense`

- After `Promise.all([getInventory(id), getRatingSummary(id)])`, only `getRatingSummary` is listed (147→497 ms). `getInventory` disappears, and coverage doesn't mark the list partial.
- An agent verifying a waterfall fix can read this as "inventory is no longer loaded". The probe for `product-await-overlap` measures the critical path instead.

### 7. `react_error_state` cannot tell a swallowed error from a handled one

- A boundary whose fallback is `null` (related products on `/product/harbor-weekender-1`) and one rendering "Reviews are unavailable" (`app_set_fault reviews.list fail`) produce identical entries, including `blankTreeHint: "… the subtree below it did not render"`.
- "Does the user see anything?" is the question for an error that disappears silently, and nothing in the output says what the boundary rendered instead.

### 8. `subtreeHostMutations` reports DOM changes that did not happen

- `react_get_renders '{"component":"Price","view":"full","sort":"updates"}'` after opening the bag preview reports `behaviorEvidence.subtreeHostMutations: {status: "observed", count: 2}` for each re-rendered `Price`.
- A MutationObserver on the product grid recorded zero mutations, so a purely wasted render looks like it had visible effects.
- Repro: bug `drawer-price-renders`.

### 9. Effect hotness misses an effect that runs on every keystroke

- `react_effect_audit` labels the checkout quote effect `not-hot` (`reason: below-fire-rate`): it fired on 9 of 10 updates against a default `minFireRate` of 1.

### 10. Render coverage is never complete on this app

- Every capture reports `coverage.complete: false` and `inputAttributionComplete: false` because `analysisFailedFibers` is between 5 and 33, with no list or reason.
- An agent can never claim complete coverage, and cannot tell whether the failed fibers matter.

### 11. A production build ships the Genie client

- With `instrumentation.ts` exactly as the setup guide shows, `next build` (Turbopack) bundles `genie-react/hub` and `ws` into the server output.
- The hub's `new URL('./client.global.iife.js', import.meta.url)` makes Next emit the 488 KB client as a public `/_next/static/media/client.global.iife.*.js`. Nothing loads it, but every deployment serves it.

### 12. A stale global CLI shadows the workspace CLI and misdiagnoses the failure

- When `packages/cli/dist` does not exist at `pnpm install` time, pnpm creates no `genie-react` bin for workspace apps, so `pnpm exec genie-react` runs a globally installed 0.12.2.
- It reports "Genie bridge not reachable" while the 0.19 hub is up. The CLI's own `next.argv` suggestions use `pnpm exec genie-react`.

## Low

- `react_get_tree '{"depth":8}'` on a Next.js page returns zero nodes (`truncatedBy: "depth"`): Next's router and boundary wrappers take about 20 levels before the first app component.
- `react_inspect_component` labels `useOptimistic` as `kind: "reducer"` and `useTransition` as `kind: "other"`, whose value is a thenable rather than `isPending`.
- Context causes are named `Context[0]`. A provider component or variable name would identify `LocaleContext`.
- Server-side frames and boundary sources point into unmapped `.next/dev/server/chunks/ssr/*.js` files (the function names are correct).
- `.genie/bridge.json` is left behind when `next dev` stops on SIGTERM. Anything checking for a running hub must also check that the recorded pid is alive.
- In this workspace, `queryCollector(queryClient)` fails `tsc` for `apps/next-demo` and this app: genie-react's types resolve its own `@tanstack/query-core` 5.101.2 devDependency, so the 5.104.1 `QueryClient` fails on `#private`. Nothing typechecks `apps/next-demo`, so this went unnoticed.

## What worked well

- Server timing is visible: `react_suspense` server-io blockers carry start and end times and await stacks with app function names (`getInventory < ProductPage`), which is enough to prove a request waterfall and its fix.
- An error thrown in a server component and caught by a client boundary is attributed to the server `throwingComponent`, with an accurate `blankTreeHint`.
- Render causes for context changes and memo-defeating props are exact, with before/after values and `reference-only` diffs. `react_component_cohort` makes remounts unambiguous.
- Query tools reflect `keepPreviousData` and inactive keys correctly.
- The app-tools API was easy to wire, and its errors carry codes and hints.
- An invalid argument returns `didYouMean`-style `details` and a `correctedExample`.
- The effect timeline lists `event-listener` under `unobservedDomains` instead of guessing.
