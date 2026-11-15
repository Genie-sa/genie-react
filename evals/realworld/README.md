# Realistic-app bug catalogues

Each directory here is the answer key for one realistic app under `apps/`. The app ships with the
seeded bugs; the key stays out of the app so an agent working in the app cannot read it.

| App                                                 | Catalogue    | Bugs | Decoys |
| --------------------------------------------------- | ------------ | ---- | ------ |
| [`apps/realworld-dashboard`](../../apps/realworld-dashboard) | `dashboard/` | 15   | 6      |

## Run the probes

```bash
pnpm install && pnpm build
node evals/realworld/run-probes.mjs dashboard --dry-run --typecheck   # specs valid, fixes apply and compile
node evals/realworld/run-probes.mjs dashboard                        # prove the catalogue in Chromium
node evals/realworld/run-probes.mjs dashboard --only carrier-card-missing,search-palette-stale-results
```

The runner copies the app into `apps/<app>/.variants/<run>/`: one shipped copy, and one copy per bug
with its reference fix applied. Each copy runs its own Vite dev server and Genie hub on a free port,
with a private `XDG_RUNTIME_DIR` for the hub token. Probes drive headless Chromium with Playwright
and read evidence through the built CLI with `--json`. A probe signs in and resets the seeded
backend through the app's own Genie tools, so every run starts from the same data.

For every bug the runner requires the probe to fail on the shipped app and pass with the reference
fix. For every decoy it requires the probe to match the declared expectation: `not-flagged` means
Genie's evidence must show the code is fine; `known-false-positive` records a decoy Genie currently
misreads, and the runner fails once Genie stops misreading it so the expectation gets updated. A
summary prints to stdout and a JSON report is written to `evals/results/`. The exit code is nonzero
when any spec does not behave as declared. No model or paid API is called.

## Spec format

One JSON file per bug or decoy; the file name is the `id`.

| Field                | Meaning                                                                                   |
| -------------------- | ----------------------------------------------------------------------------------------- |
| `kind`               | `bug` or `decoy`                                                                          |
| `category`           | `verify`, `fix` or `optimise`: the kind of work a user would ask for                     |
| `symptom`            | The report as a user would phrase it                                                      |
| `truth`              | Accepted `components`, app-relative `files`, and the `cause`                              |
| `referenceFix`       | Bugs only: exact `{ file, find, replace }` edits; each `find` must occur exactly once     |
| `probe.script`       | Module whose default export drives the app and records checks                             |
| `probe.genie`        | `observable`, or `blocked` with `blockedReason` when Genie cannot see the bug             |
| `probe.evidence`     | Genie tools the probe relies on                                                           |
| `expectation`        | Decoys only: `not-flagged` or `known-false-positive` (with `finding`)                    |

A probe receives a context with `page` (Playwright), `genie.call(tool, args)`, `open(path)`,
`signIn(role)`, `settle()`, `quiesce()`, `clearRenders(components)`, `inspect(component)` and
`check(name, pass, detail)`. It passes when it records at least one check and every check passes.

## Dashboard catalogue

| Spec                                    | Category | Genie evidence the probe reads                        |
| --------------------------------------- | -------- | ----------------------------------------------------- |
| `carrier-card-missing`                  | verify   | `react_error_state`, `react_find_components`          |
| `customer-edit-not-reflected`           | fix      | `query_get`                                           |
| `customer-orders-tab-blanks-page`       | fix      | `react_suspense`                                      |
| `customers-refresh-rerenders-rows`      | optimise | `react_component_cohort`                              |
| `dashboard-sidebar-rerenders-cards`     | optimise | `react_get_renders`                                   |
| `dashboard-stock-summary-stale`         | verify   | `query_get`                                           |
| `new-order-notes-typing-lag`            | optimise | `react_get_renders` self time                         |
| `order-activity-listener-leak`          | fix      | `react_effect_timeline` cleanup, `app_live_updates`   |
| `order-detail-request-waterfall`        | optimise | `timeline_read` request lane                          |
| `order-hold-failure-not-rolled-back`    | verify   | `app_inject_fault`, `query_get`                       |
| `order-hold-rerenders-all-rows`         | optimise | `react_component_cohort`                              |
| `order-page-view-repeats`               | optimise | `react_inspect_component`, `react_effect_timeline`    |
| `order-selection-rerenders-sidebar`     | optimise | `react_get_renders`                                   |
| `related-account-shows-previous-notes`  | fix      | `react_inspect_component`, `query_get`                |
| `search-palette-stale-results`          | fix      | `react_inspect_component`                             |

| Decoy                                   | Expectation                | What looks suspicious                                   |
| --------------------------------------- | -------------------------- | ------------------------------------------------------- |
| `notification-subscription-strict-mode` | not flagged                | Subscribes twice on load under StrictMode               |
| `order-selection-memo-works`            | not flagged                | The table re-renders on every checkbox                  |
| `orders-sync-clock-ticks`               | not flagged                | A label re-renders every second                         |
| `permissions-context-stable`            | not flagged                | A provider wraps the whole authenticated app            |
| `stat-card-memo-partial`                | not flagged                | Two of four memoised cards re-render on a range change |
| `query-observer-effects-rerun`          | not flagged                | An effect re-runs on every render of a page            |

[`dashboard/genie-findings.md`](dashboard/genie-findings.md) lists the Genie defects and friction found
while building the app and its probes.
