# Storefront answer key

Seeded defects and decoys for [`apps/realworld-storefront`](../../../apps/realworld-storefront), kept out of the app so an agent working on the app cannot read them.

```bash
pnpm build                                                     # the runner calls packages/cli/dist/cli.js
node evals/realworld/run-probes.mjs storefront --dry-run       # validate entries; no browser, no server
node evals/realworld/run-probes.mjs storefront                 # Turbopack
node evals/realworld/run-probes.mjs storefront --bundler webpack
node evals/realworld/run-probes.mjs storefront --only orders-filter-race --url http://localhost:3210
```

Without `--url` the runner starts `next dev` on free ports with a private `XDG_RUNTIME_DIR` for the hub token, and refuses to start while another live process owns the app's hub. For each bug it runs the probe on the shipped app (it must fail), applies `referenceFix` in place, waits for the recompile, runs the probe again (it must pass) and restores the files, also on interrupt. Each decoy probe must pass on the shipped app. `--output <file>` writes every check as JSON. No model or paid API is called.

## Entries

`bugs/<id>.json` and `decoys/<id>.json` hold one entry each.

- `prompt`: the symptom as a user would report it (bugs only).
- `category`: `fix`, `optimise` or `verify`.
- `truth`: accepted `components`, project-relative `files`, the `cause`, and a `summary`.
- `referenceFix`: exact `{ file, find, replace }` edits, relative to the app folder. Each `find` must match the shipped source once.
- `probe.module`: a script in `probes/` exporting `probe(ctx)` and optional browser `options` (`locale`, `timezoneId`). It drives Chromium with Playwright through `ctx.page`, reads Genie through the built CLI with `--json` (`ctx.call`), and records `ctx.check(name, pass, detail)`.
- `probe.status: "blocked"` marks a defect Genie cannot observe. `missingEvidence` names what is missing, and `control` points to a probe that proves the defect without Genie, so the runner still shows fail-before and pass-after.
- Decoys add `looksLike` and `whyCorrect`.

## Catalogue

| Id | Category | Where | Genie evidence the probe asserts on |
| --- | --- | --- | --- |
| `home-featured-wait` | optimise | One Suspense boundary holds the fast featured row and the slow personalised row | `react_suspense` server-io blockers of the featured boundary |
| `product-await-overlap` | optimise | Product page awaits two independent reads in sequence | `react_suspense` server-io start/end times on `ProductPage` |
| `product-static-sections` | optimise | A `'use client'` parent imports the static product sections | `react_find_components` finds client fibers for server-only sections |
| `delivery-date-hydration` | fix | Date formatted with the visitor's locale during SSR and hydration | Blocked: no hydration or recoverable-error evidence; a `reportError` control proves it |
| `drawer-price-renders` | optimise | Locale context value recreated when the bag preview opens | `react_get_renders` context-caused `Price` updates |
| `cart-quantity-rollback` | fix | Rejected quantity change is committed to base state behind `useOptimistic` | `react_inspect_component` hook state vs `app_store_state` |
| `bag-count-after-add` | fix | Add-to-bag server action does not revalidate the layout | `react_find_components` props of `CartButton` vs `app_store_state` |
| `checkout-quote-effect` | optimise | Quote effect depends on an inline object prop | `react_effect_timeline` executions while typing |
| `search-typing-renders` | optimise | Deferred results list is not memoised | `react_get_renders` `noObservedInputChange` |
| `wishlist-card-renders` | optimise | Inline callback defeats `memo` on product cards | `react_get_renders` updated instances and function-identity renders |
| `sort-pending-state` | fix | Sort navigates outside the shared transition, so no pending state | `react_get_renders` cause counts of `CatalogResults` |
| `orders-filter-race` | fix | Stale order response overwrites the selected filter's results | `react_inspect_component` hook state of `OrderHistory` |
| `related-section-error` | fix | Recommendations throw on retired products; the boundary renders nothing | `react_error_state` caught errors |
| `quick-view-filter-state` | fix | Layout keyed on the pathname remounts the grid under the modal route | `react_component_cohort` and hook state of `FilterPanel` |
| `gallery-arrow-step` | fix | Keydown listener removed without its capture flag | `react_inspect_component` gallery index after one key press |

Decoys: `decoy-theme-value`, `decoy-deal-countdown`, `decoy-wishlist-storage`, `decoy-review-sort`, `decoy-recently-viewed`. Each asserts that Genie reports no render without an input change, no reference-only render, no `unnecessary` verdict and no hot effect for correct code that looks suspicious, and that the interaction did real work.
