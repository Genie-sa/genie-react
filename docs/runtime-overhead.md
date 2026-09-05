# Runtime instrumentation overhead

Genie observes React commits synchronously. Active render analysis adds work to the app's main thread, even when no agent is querying it. Pausing a profile stops detailed analysis while keeping the hook and liveness bookkeeping installed. Profiling is not a zero-overhead measurement of an uninstrumented app.

## Verified wide-list regression

The instance identity collector previously recovered sibling position and key uniqueness by scanning the same sibling chain several times for every rendered component. An updating keyed list therefore incurred quadratic sibling reads. A deterministic regression fixture of 100 rows observed 29,900 sibling reads before the fix.

Sibling positions and key counts are now indexed incrementally within each commit work budget. Position lookups stop at the requested Fiber, so updating an early unkeyed row does not scan later siblings; key-uniqueness checks finish the bounded list. The index is discarded with that budget, so later reorders and duplicate keys are re-evaluated. Incomplete scans cannot prove key uniqueness. Existing operation limits, deadlines, Fiber limits, and conservative coverage reporting still apply; reports outside a commit continue to inspect live structure.

## Reproduce in Chromium

```sh
pnpm install --frozen-lockfile
pnpm exec playwright install chromium
node scripts/benchmark-runtime-overhead.mjs > overhead.json
```

The script starts an isolated Vite fixture and closes its browser/server afterward. It uses the installed workspace React development build and the current Genie source. Five hundred keyed sibling components update synchronously, each producing one span. Every mode receives 20 warmup updates and 60 measured updates on each of three fresh pages, with mode order varied between rounds. The script verifies row count and rendered values and records raw samples, coverage omissions, collection mode, budget settings, and Chromium version.

Modes are **disabled** (no Genie hook), **active** (Genie's hook and default render analysis), and **paused** (hook installed, detailed render collection paused). This isolates the commit instrumentation; it does not include connected hub traffic, plugin collectors, source transforms, or report queries. Durations cover synchronous React rendering and commit instrumentation, not paint or end-to-end input latency. Do not treat this synthetic workload as the unidentified reporter's app or as a production/native benchmark.

A local run on September 5, 2026, using Chromium 149.0.7827.55 produced:

| Mode | Before median / p95 | Fixed median / p95 |
| --- | --- | --- |
| Genie disabled | 1.8 / 2.3 ms | 1.7 / 2.1 ms |
| Active analysis | 8.7 / 9.5 ms | 3.7 / 4.6 ms |
| Paused analysis | 2.0 / 2.2 ms | 1.9 / 2.1 ms |

Active median update time decreased about 57% in this fixture, while remaining above the uninstrumented baseline. Skipped Fiber analyses across each page's 80 updates decreased from 34,269 to 20,080. Both runs used the same default configuration. Before the fix, operation exhaustion raised the adaptive scale to 4 (a 1,000-Fiber allowance), yet only about 73 Fibers per commit could be analyzed. Afterward, scale stayed at 1 and 250 Fibers per commit were analyzed. The remaining omissions reflect that default 250-Fiber limit; these numbers measure bounded partial collection, not analysis of all 500 rows. This fix does not trade reduced evidence coverage for speed. Timing results vary by machine, browser, thermal state, and workload; the unit test enforces the linear sibling-read property rather than a flaky millisecond threshold.

## Regression risks and evidence

| Risk | Protected behavior | Validation |
| --- | --- | --- |
| Repeated sibling scans | All row positions and unique keys resolve with linear sibling reads | Deterministic 100-row test failed before fix and passes afterward |
| Sparse unkeyed updates | Early row identities remain positional without scanning later siblings or exhausting a small budget | First/fourth-row regression failed on the eager index and passes with incremental scanning |
| Stale index across commits | Reorders change position, duplicate keys remove keyed identity, physical mount stays stable | Successive-budget reorder/key-change test |
| Scan truncation | An unseen sibling cannot be assumed to have a different key | 2,001-row bound and exhausted-operation tests |
| Deadline bypass on cache hit | Cached evidence does not bypass the shared time budget | Controlled monotonic-clock test |

The reporter's exact environment remains unverified because no app, workload, or trace was supplied. This reproduction establishes a concrete Genie overhead defect and validates its improvement; it does not establish that all reported slowdowns share this cause.
