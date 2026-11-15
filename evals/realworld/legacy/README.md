# realworld-legacy answer key

Seeded defects and decoys for [`apps/realworld-legacy`](../../../apps/realworld-legacy), a React 18.3 project-management app built with webpack 5, Babel, React Router 6, Redux Toolkit 1.9, `connect()` class components, reselect, RTK Query and Formik. The app ships with every defect below; nothing in the app folder names them.

Each `<id>.json` holds the user-reported symptom (`prompt`), `category`, the `truth` (components, files, cause patterns), a `referenceAnswer` with near-miss `decoyAnswers`, the `referenceFix` as exact `{ file, find, replace }` edits, the probe script, and `genieEvidence`: what Genie could and could not show. `observability` is `full` when Genie's React or timeline tools prove the defect, `partial` when they show the symptom but not the cause, and `app-tools-only` when only the app's Redux tools expose it.

## Run the probes

```bash
pnpm build
node evals/realworld/run-probes.mjs legacy --dry-run
TMPDIR=$(mktemp -d) node evals/realworld/run-probes.mjs legacy
```

`--dry-run` validates every file and checks that each reference fix applies exactly once. A full run starts a private standalone hub and webpack dev server on free ports against a scratch copy of `src/`. For each bug it runs the probe on the shipped code (it must fail), applies the reference fix, waits for webpack to rebuild, and runs the probe again (it must pass). Each decoy's probe must pass on the shipped code, meaning Genie does not flag it. Probes drive Chromium with Playwright and read Genie evidence through the built CLI with `--json`. Use `--only <id>` to run one entry and `--output <file>` to save the results as JSON.

## Bugs

| Id | Category | Symptom | Cause | Genie evidence |
| --- | --- | --- | --- | --- |
| `project-nav-store-updates` | optimise | Sidebar project list re-renders on every action | `mapStateToProps` returns `Object.values(...)` | partial |
| `board-column-selector-cache` | optimise | All board columns redraw on any UI change | One `createSelector` shared by five columns with a per-column argument | partial |
| `account-menu-selector` | optimise | Avatar menu re-renders on every action | `useSelector` returns a new object | partial |
| `issue-row-inline-handler` | optimise | Selecting one row redraws all 100 rows | `PureComponent` row gets an inline arrow prop | full |
| `issue-table-selector-recompute` | optimise | Typing a saved-view name lags | reselect input selector returns a new object, so 3,240 issues are re-sorted per action | partial |
| `activity-refetch-on-typing` | optimise | Every keystroke in a comment fetches activity | Effect depends on an inline array prop | full |
| `feature-flags-provider-value` | optimise | Collapsing the sidebar freezes the board | Context provider value recreated every render | full |
| `title-draft-reset` | fix | Unsaved title edit is lost after commenting | `componentDidUpdate` resets state when the prop's reference changes | full |
| `search-stale-query` | fix | Global search ignores what you type | Debounced callback in `useMemo([])` captures the first query | full |
| `report-range-race` | fix | 7-day button selected, 90-day data shown | Hand-written thunk lets the slower response win | full |
| `report-notes-mutation` | fix | Added notes do not appear | Hand-written reducer mutates and returns the same state | app-tools-only |
| `lazy-route-blank-shell` | fix | Whole screen blanks while a lazy route loads | Only Suspense boundary sits above the shell with `fallback={null}` | full |
| `comment-edit-follows-index` | fix | Edit box jumps to another comment | List keyed by index, new comments are prepended | full |
| `poller-after-sign-out` | verify | 401s from signed-out browsers | Class poller has no `componentWillUnmount`; StrictMode doubles it | partial |
| `cycle-time-empty-range` | verify | A Reports widget is missing for one project | Widget throws on an empty dataset; the boundary renders `null` | full |

## Decoys

| Id | Looks like | Why it is correct |
| --- | --- | --- |
| `decoy-presence-strict-effect` | Effect subscribes twice | StrictMode replay; cleanup is returned |
| `decoy-sync-label-tick` | Re-render every second | It is a clock |
| `decoy-board-card-memo` | 420 cards might re-render | `memo` with stable props holds |
| `decoy-status-summary-connect` | `mapStateToProps` returns an object literal | Its only field comes from a memoised selector |
| `decoy-toolbar-shallow-equal` | `useSelector` returns an object | `shallowEqual` is passed |
| `decoy-missing-issue` | "Issue not found" might hide a crash | The 404 is handled as data |

## What Genie could not show

Genie has no Redux awareness. A store-driven render is reported as `external-store` with `inferred` evidence and no link to the dispatched action, the selector, or the field that changed. The mutating reducer (`report-notes-mutation`) is observable only through the app's `app_redux_state` and `app_redux_actions` tools. The stale search and the out-of-order report response are now proven through the timeline request lane, which reports each request's method and query (values hashed by default, plain on request) and marks an older request that finished after a newer one; which result the app applied still comes from React props. Class lifecycle timers are invisible to the effect tools, so the leaked poller shows up only as network traffic.
