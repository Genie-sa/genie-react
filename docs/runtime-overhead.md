# Runtime overhead

Genie runs inside the app it measures. Whatever it adds to a commit or a tool call also shows up in the timings an agent reads, so this page states what Genie costs and the conditions under which each number was measured.

## What Genie does in the page

- `genie-react/hook` installs the DevTools hook before React loads. From then on, every development commit is analysed: which components rendered and why, their effects, instance identity, and error and Suspense state. This starts at page load, not when an agent connects, because `react_get_renders`, `react_effect_audit` and `react_error_state` report what happened since load when no window is open.
- The analysis budget adapts to the tree. `react_clear_renders` sizes it to the mounted tree, and a commit that runs out grows it, up to 20,000 components and 500 ms per commit. The budget limits how much evidence is lost on a large tree; it does not keep Genie cheap.
- `react_profile_start` takes the same path as `react_clear_renders`. Effect events are recorded by the same commit analysis, so there is no separate effect-timeline recording. `timeline_start` adds a light listener that runs only while a timeline records.
- `react_profile_stop` pauses the analysis. The hook stays installed, so React still reports each commit and each deleted fiber to it.

Genie has no state where it is loaded and records nothing until an agent asks. Its idle cost is the cost of recording since load. Making that cost near zero would mean not recording until the first tool call, and the evidence from before that call (renders since load, errors caught before the agent looked, effect statistics) would be lost. That is a product decision, not an optimisation, so this change does not make it. The paused rows below show what such a mode would cost.

## How it was measured

```sh
pnpm install --frozen-lockfile
pnpm exec playwright install chromium
pnpm --filter genie-react build
node scripts/benchmark-runtime-overhead.mjs --output overhead.json
```

`--variant name=path/to/dist` (repeatable) measures several builds interleaved in one run, so a before/after comparison shares machine load. `--rows 400,1600` measures several tree sizes. `--skip memory,tools` and `--modes absent,idle` narrow a run.

The fixture (`scripts/runtime-overhead/`) is an app-shaped tree, not a synthetic list. It has a header with a clock, a search box and a user menu reading context, 40 memoized navigation items, a dashboard of 12 TanStack Query widgets plus 4 observers sharing one query (each widget renders a 16-bar sparkline), a Suspense boundary, and a 1,000-row table. Each row is a memoized component with an object prop and 5 to 7 child components, a third of the rows have a passive effect, and a tenth have a layout effect. At 1,000 rows it mounts 8,747 components (18,221 fibers) with 347 passive and 100 layout effect hooks. `main.js` loads Genie the way the Vite plugin does (hook, then client, then `<Genie queryClient>`) and replaces the hub's WebSocket with an in-page stand-in. A tool call therefore runs the client's real decode, validate, handle, output check and encode path, and none of the time is network.

Each state is a fresh page, reached only through hub calls an agent would make:

| State | How it is reached |
| --- | --- |
| absent | the same app without Genie |
| idle | Genie loaded and connected, no tool call |
| paused | `react_profile_stop` |
| window | `react_clear_renders` |
| profile | `react_profile_start` |
| timeline | `timeline_start` |

Commit operations are timed around `flushSync`, which covers render, commit, Genie's commit analysis, layout effects and the passive effects React flushes for a synchronous update:

- tick: the clock updates and about 250 components re-render.
- select: the selection changes and two rows re-render.
- refresh: every row gets a new item object with mostly equal contents, so 8,700 components re-render and Genie deep-compares the object prop of each one.
- unmount: the filter narrows the list from 1,000 rows to 111, unmounting about 7,500 components.
- mount: clearing the filter mounts those rows again.

Interactions dispatch a real DOM event and time it to the next frame (requestAnimationFrame, then a task). Long tasks come from the Long Tasks API. Memory is V8's used heap after two forced garbage collections (CDP `HeapProfiler.collectGarbage`), first after the page settles and again after a 1,200-step session that mixes every commit kind with Query updates.

The fixture counts its own commits (`Profiler` `onRender`), render-function calls, and effect and cleanup runs. Every run compares those counts with the no-Genie page for startup, the workload and the session.

Conditions: Apple M4 Pro (14 cores, 48 GB), macOS 26.6.1, Node 22.23.4, Chromium 156.0.8078.4 headless (Playwright), React and React DOM 19.3.1 development builds, TanStack Query 5.101.2, Genie built with `pnpm --filter genie-react build` and served by the Vite dev server. "main" is the runtime at commit 4028416 and "this change" is this branch rebased on it. The commits that later landed on main, up to c5d7186, change the hub, protocol, CLI and evals but not the collectors or client code these numbers cover. Both were measured interleaved on November 15, 2026: 3 rounds, each state starting first in a different round, with 20 samples per commit operation and 8 per interaction after 3 warm-ups. Other agents were running builds and tests on the machine at the same time. Each cell is the median of the three rounds' medians, the range across rounds in parentheses, then the p95.

## Commit cost at 8,747 components

Milliseconds: median (range across rounds) / p95.

| State | tick | select | refresh | unmount | mount |
| --- | --- | --- | --- | --- | --- |
| absent | 1.8 (1.8–2.0) / 2.6 | 1.7 (1.7–1.9) / 2.5 | 35.1 (33.3–35.4) / 39.1 | 4.1 (3.9–4.2) / 5.2 | 21.5 (21.1–22.3) / 27.4 |
| idle, main | 3.4 (3.2–3.7) / 4.7 | 3.5 (3.2–3.5) / 4.5 | 105 (102–106) / 166 | 56.6 (54.5–56.6) / 68.9 | 87.0 (86.0–92.0) / 151 |
| idle, this change | 3.0 (2.9–3.0) / 4.6 | 3.0 (3.0–3.2) / 4.3 | 85.9 (85.6–88.6) / 147 | 24.5 (24.5–24.7) / 31.2 | 66.7 (62.0–69.1) / 129 |
| paused, main | 2.0 (1.9–2.0) / 2.2 | 2.0 (1.9–2.0) / 2.4 | 36.3 (35.7–36.6) / 38.2 | 55.3 (52.9–58.7) / 69.8 | 39.3 (37.0–39.6) / 97.4 |
| paused, this change | 1.8 (1.8–2.1) / 2.0 | 1.8 (1.7–2.1) / 2.3 | 34.3 (34.1–35.7) / 36.2 | 17.4 (17.4–19.9) / 24.9 | 23.7 (22.8–24.5) / 25.4 |
| window, main | 3.4 (3.4–3.4) / 4.9 | 3.5 (3.4–3.5) / 4.5 | 108 (106–114) / 171 | 56.8 (52.5–58.6) / 69.5 | 88.2 (88.2–92.0) / 160 |
| window, this change | 3.2 (3.2–3.5) / 4.6 | 3.2 (3.1–3.4) / 4.7 | 88.3 (87.7–94.7) / 148 | 25.7 (25.5–27.0) / 31.4 | 67.7 (67.3–73.2) / 136 |
| profile, main | 3.4 (3.2–3.4) / 5.1 | 3.4 (3.2–3.6) / 4.5 | 105 (102–108) / 168 | 56.7 (56.0–61.2) / 70.1 | 88.0 (87.7–92.3) / 155 |
| profile, this change | 3.2 (2.9–3.3) / 4.7 | 3.1 (2.9–3.3) / 4.4 | 86.7 (85.9–91.6) / 146 | 24.9 (24.8–25.8) / 36.5 | 66.5 (66.1–67.0) / 127 |
| timeline, main | 3.3 (3.2–3.5) / 4.7 | 3.4 (3.2–3.7) / 4.6 | 106 (105–107) / 166 | 55.3 (53.9–55.5) / 74.2 | 84.7 (84.3–91.4) / 153 |
| timeline, this change | 3.0 (2.9–3.2) / 4.5 | 3.1 (3.1–3.1) / 4.4 | 88.4 (86.6–89.0) / 146 | 26.2 (24.6–26.7) / 36.4 | 67.2 (63.3–68.3) / 172 |

Genie still costs time on every analysed commit: 1.7 times the no-Genie time for a small update and 2.4 times for a full-list refresh. That cost is the per-component analysis, about 6 µs per component that rendered. Paused, Genie is within 10% of no Genie for every commit kind except unmount. That cost is in Bippy, the instrumentation library: its unmount dispatcher copies its listener list, wraps each listener in a closure and releases the fiber's id for every deleted fiber. That work is outside Genie's code, so this change does not touch it.

## Interactions

Milliseconds from dispatching the event to the next frame: median (range) / p95. Frames are 16.7 ms apart, so an interaction under one frame reads as about 16.6 ms.

| State | click a row | toggle a row menu | type in search | click refresh | click a nav item | Query update |
| --- | --- | --- | --- | --- | --- | --- |
| absent | 16.7 (16.6–16.9) / 16.8 | 16.7 (16.3–16.7) / 17.5 | 17.9 (17.8–18.4) / 106 | 16.6 (16.3–16.7) / 17.6 | 16.6 (16.6–16.7) / 16.8 | 16.6 (16.6–16.7) / 17.1 |
| idle, main | 16.6 (16.6–16.7) / 17.3 | 16.6 (16.6–16.7) / 17.7 | 72.0 (67.9–95.7) / 265 | 18.7 (16.8–19.3) / 19.2 | 16.5 (16.5–16.6) / 17.2 | 16.6 (16.5–16.6) / 17.3 |
| idle, this change | 16.6 (16.5–16.7) / 17.2 | 16.6 (16.4–16.6) / 17.4 | 35.1 (31.8–36.8) / 157 | 16.6 (16.5–16.7) / 17.6 | 16.6 (16.4–16.7) / 17.3 | 16.6 (16.4–16.7) / 17.6 |
| paused, main | 16.6 (16.4–16.6) / 17.6 | 16.6 (16.4–16.6) / 17.5 | 52.7 (52.5–64.8) / 482 | 16.6 (16.5–17.1) / 22.6 | 16.6 (16.5–16.8) / 17.4 | 16.5 (16.4–16.5) / 17.5 |
| paused, this change | 16.7 (16.5–16.7) / 17.1 | 16.6 (16.5–16.9) / 17.5 | 33.1 (30.6–33.9) / 109 | 16.5 (16.5–16.6) / 17.3 | 16.6 (16.4–16.7) / 17.1 | 16.6 (16.5–16.7) / 17.1 |
| window, main | 16.6 (16.5–16.7) / 17.2 | 16.8 (16.7–16.8) / 17.2 | 101 (72.0–110) / 303 | 19.4 (18.1–19.7) / 33.6 | 16.6 (16.5–16.6) / 17.6 | 16.5 (16.4–16.5) / 17.3 |
| window, this change | 16.7 (16.6–16.7) / 17.2 | 16.5 (16.5–16.9) / 17.4 | 35.7 (34.0–36.0) / 96.8 | 18.3 (16.3–22.5) / 36.6 | 16.6 (16.4–16.7) / 17.3 | 16.6 (16.5–16.8) / 17.3 |

Typing in the search box mounts or unmounts most of the table, so it shows the unmount cost. The other interactions stay within about one frame in every state.

## Long tasks and startup

Startup is measured from navigation. Startup blocking is the total blocking time (time over 50 ms per long task) until the page settles. The workload columns cover all of the commit operations and interactions above: 23 commits of each kind and 11 of each interaction. Medians with ranges.

| State | Genie modules ms | Mount commit ms | Settled at ms | Startup blocking ms | Workload long tasks | Workload blocking ms | Longest task ms |
| --- | --- | --- | --- | --- | --- | --- | --- |
| absent | – | 92.8 (87.9–93.6) | 190 (181–195) | 63 (58–64) | 4 (3–4) | 2,005 (1,918–2,036) | 878 (842–883) |
| idle, main | 97.6 (92.5–102) | 140 (136–146) | 364 (343–366) | 110 (103–116) | 17 (17–18) | 10,272 (10,145–10,457) | 3,783 (3,701–3,853) |
| idle, this change | 95.9 (94.7–97.8) | 139 (138–144) | 356 (346–363) | 108 (107–114) | 11 (11–12) | 6,988 (6,850–7,191) | 2,503 (2,410–2,718) |
| paused, main | 92.9 (91.5–95.5) | 140 (136–146) | 349 (347–363) | 110 (104–117) | 12 (9–13) | 5,809 (5,566–6,096) | 2,416 (2,307–2,433) |
| paused, this change | 87.7 (87.0–90.4) | 137 (135–138) | 336 (335–341) | 106 (103–107) | 4 (4–6) | 2,839 (2,823–3,013) | 1,078 (1,074–1,137) |

The longest-task column measures one synchronous loop of 23 refresh commits, not a single commit. Startup did not change. Loading Genie's modules takes about 95 ms on the Vite dev server, and analysing the first mount of 8,747 components adds about 47 ms to the mount commit.

## Memory

Used heap after garbage collection, at 8,747 components, one page per state (a single round, so no ranges). "Retained" is the change since the page settled.

| State | Heap after load MB | Retained by the workload MB | Retained after a further 1,200-step session MB |
| --- | --- | --- | --- |
| absent | 19.1 | 6.9 | -3.0 |
| idle, main | 40.8 | 29.7 | 29.4 |
| idle, this change | 40.8 | 28.7 | 26.1 |
| paused, main | 40.8 | 13.5 | 20.7 |
| paused, this change | 40.8 | -0.6 | 1.2 |
| window, main | 40.7 | 29.3 | 35.9 |
| window, this change | 40.7 | 28.1 | 25.7 |
| profile, main | 40.7 | 30.6 | 29.5 |
| profile, this change | 40.7 | 25.2 | 26.8 |
| timeline, main | 40.9 | 34.3 | 31.5 |
| timeline, this change | 40.9 | 25.9 | 26.0 |

This is a bounded footprint, not a leak. A separate run on the final build measured the heap after each of five 1,200-step chunks from load. Every state levelled off after the first chunk: absent at 15.8 MB, idle between 67.9 and 69.2 MB, paused between 43.9 and 44.4 MB. Every Genie buffer has a fixed limit, for example 1,000 cause events, 1,000 effect events, 1,000 retained unmounted components and 10,000 mount-generation paths. At steady state, recording adds about 53 MB at this size, and about 28 MB of that is already present when paused. A heap snapshot comparison against the no-Genie page, taken on an earlier build of this branch, puts about 11 MB of it in script source (the development bundle, including TanStack Router, which the `<Genie />` entry imports) and about 6 MB in closures and compiled code. Bippy's per-fiber id bookkeeping (`WeakRef`s and finalization cells) adds about 1.5 MB. Strings and objects for render records and instance identity make up most of the rest. Paused now retains almost nothing, because paused commits no longer give every newly mounted fiber a Bippy id.

## Tool calls

Time to answer is from the moment the request reaches the page to the moment the response frame is sent; it covers validation, the handler, the development output-schema check and encoding. Longest block is the longest gap between two `MessageChannel` ticks queued while the call ran, which is how long the page could not respond to input. Medians of 5 calls on a page with a recording window, a running timeline and a short workload behind it. Milliseconds, answer / longest block.

| Tool | 2,423 components, main | 2,423, this change | 8,748, main | 8,748, this change | 34,048, main | 34,048, this change | Growth exponent, main / this change |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `react_get_tree` | 5.1 / 9.2 | 4.9 / 9.0 | 5.6 / 10.7 | 5.6 / 13.4 | 11.4 / 16.1 | 10.8 / 14.3 | 0.31 / 0.30 |
| `react_find_components` | 2.1 / 2.2 | 1.8 / 2.3 | 3.9 / 6.5 | 5.6 / 6.2 | 19.8 / 28.6 | 11.4 / 11.8 | 0.86 / 0.71 |
| `react_inspect_component` | 0.1 / 0.5 | 0.1 / 0.5 | 0.1 / 0.5 | 0.1 / 0.5 | 0.1 / 0.5 | 0.1 / 0.5 | 0 / 0 |
| `react_get_renders` (`includeCursor: false`) | 22.6 / 25.8 | 4.4 / 7.7 | 62.6 / 64.6 | 9.6 / 13.8 | 230 / 243 | 34.2 / 41.4 | 0.89 / 0.78 |
| `react_render_causes` | 22.6 / 23.1 | 1.1 / 2.4 | 55.9 / 89.0 | 1.0 / 2.6 | 188 / 189 | 1.1 / 3.0 | 0.81 / 0 |
| `react_effect_timeline` | 5.7 / 8.2 | 5.9 / 8.1 | 5.4 / 7.5 | 5.5 / 7.8 | 5.7 / 10.2 | 5.4 / 7.3 | 0 / -0.03 |
| `react_suspense` | 1.9 / 4.1 | 2.0 / 4.4 | 5.1 / 7.9 | 5.0 / 8.0 | 8.0 / 10.3 | 6.4 / 9.1 | 0.55 / 0.44 |
| `react_pending_work` | 0.3 / 0.7 | 0.3 / 0.7 | 1.2 / 1.3 | 1.1 / 1.5 | 4.5 / 5.4 | 2.8 / 3.9 | 1.03 / 0.85 |
| `query_list` | 0.2 / 0.7 | 0.2 / 0.8 | 0.2 / 0.7 | 0.2 / 0.6 | 0.2 / 0.8 | 0.2 / 0.7 | 0 / 0 |
| `timeline_read` | 0.4 / 1.0 | 0.5 / 1.0 | 0.4 / 0.9 | 0.4 / 1.0 | 0.4 / 1.1 | 0.5 / 0.9 | 0 / 0 |

The trees have 5,147, 18,222 and 70,522 fibers. The growth exponent is log(time ratio) / log(fiber ratio) between the smallest and largest tree: 1 is linear and 2 quadratic. No tool grows faster than linearly. `react_get_tree`, `react_find_components`, `react_suspense` and `react_pending_work` each walk the whole tree, about 3 to 11 ms at 70,000 fibers; `react_pending_work` stops at 50,000 fibers. `react_get_renders` is linear in the number of render records: it snapshots each candidate's counters so the report stays consistent while it resolves, then classifies sources. `react_render_causes` now reads only the at most 1,000 retained events and the records they name, so it no longer depends on tree size. During a quiescence wait, `react_pending_work` costs about 3 ms per poll at 34,000 components.

## React's own work is unchanged

Every page run counted the same React work with and without Genie: 14 commits, 8,759 renders, 359 effect runs and 100 layout effect runs at startup, then 240 commits, 637,687 renders and 23,351 effect runs and cleanups during the workload. This held in all 33 runs of the timing measurement and in all 11 memory runs, whose sessions added 1,776 commits and 4.1 million renders each. An earlier fixture let one render depend on when a promise settled, so its startup render count varied by one under heavy load in both builds; the fixture now uses a fulfilled thenable.

Evidence is unchanged too. `node scripts/check-runtime-evidence-parity.mjs --baseline <main dist>` replays one scenario in two builds: renders since load, a recording window, a paused stretch with commits, then a restarted profile. It compares the tree, component search, render causes, the effect timeline and audit, Suspense, pending work, error state, the cohort, per-component renders in the full view, and inspection, with an unlimited analysis budget so neither build runs out of time. Timing fields are dropped and fiber ids are renumbered by first appearance. Source attribution is excluded because it is resolved under its own time budget, and on a slower build fewer components finish. An earlier run before the rebase, on a lightly loaded machine and with source attribution included, also found no differences. Result for this change against main at 20 and 60 rows: 0 differences across 55 reports. Every existing accuracy test passes unmodified.

## What changed

- Genie's id-to-fiber cache (5,000 entries) and its mount-generation history (10,000 logical paths) evicted their oldest entry with `Map.keys().next()`. V8 keeps deleted Map entries as holes until it rehashes, and that call walks every hole, so once a tree outgrew either bound each registration scanned thousands of slots. A small LRU (`collectors/react/lru-map.ts`) keeps the same eviction order in O(1). In isolation, 300,000 registrations took 22 ms below the bound and 2 s above it.
- Instance identity rebuilt the full logical path (up to 50 ancestors, each with a sibling position and key-uniqueness lookup) for every rendered component. Within one commit, an ancestor's prefix is now resolved once and reused. The reused prefix is charged the same budget operations a fresh walk would charge, so budget behaviour and evidence are unchanged; a randomized test compares both across trees, keys and budgets.
- `react_render_causes` deep-cloned every render record on every call; it now copies only the records its retained events name. `react_get_renders` deep-cloned every candidate record; each render publishes new evidence objects and never mutates them, so a snapshot now copies only the fields an unmount or later render rewrites in place.
- The pending-unmount buffer re-scanned all 1,000 entries on every overflow to find which targeted entries to protect. A count of targeted entries gives the same choice directly. An evicted unmount no longer restores its Bippy id just to discard it.
- While paused, a commit on a root Bippy has already traversed no longer walks the rendered tree. Bippy reads its per-root baseline only until the root's first commit sets an alternate, so the next traversal reports the same renders. Components mounted while paused therefore get their ids when a tool first reads them, so their id numbers differ; ids remain stable handles.
- The unmount callback checks the renderer once per commit instead of once per deleted fiber.
- Two limits found by this fixture were fixed later. `react_pending_work` scans 50,000 fibers per call and resumes the walk on the next call while no commit lands; the hub never reports React idle while that scan is partial. `react_get_renders` with default arguments answers a match of more than 5,000 components with one bounded page and `pagination.cursorOmitted`, instead of an error.

## Still open

- Per-component analysis is the remaining idle cost, about 6 µs per rendered component on this machine. The largest parts are deep-comparing props and building the bounded before/after values they report (about a third), instance identity (about a quarter), and render assessment. Changing what is recorded, or when, would change evidence.
- Bippy's per-fiber unmount dispatch dominates unmount-heavy commits in every state, including paused.

## The CI guard

`pnpm check:runtime-overhead`, and the `Runtime overhead guard` CI job, run `scripts/benchmark-runtime-overhead.mjs --guard`. It measures absent, idle and paused at 400 and 1,600 rows (3 rounds, 15 samples), and the tool calls at both sizes, then fails when any check exceeds its ceiling.

Shared runners differ in speed and are noisy, so no check compares absolute milliseconds. Each check is either an exact count or a ratio between two measurements from the same run on the same machine:

| Check | Ceiling | This change | main | Why this ceiling |
| --- | --- | --- | --- | --- |
| Fixture commit, render and effect counts, with Genie vs without | identical | identical | identical | Genie must not change what React does |
| Idle commit / absent commit, per kind, 1,600 rows | 5, unmount 9 | 1.6–3.4, unmount 5.8 | 1.6–3.9, unmount 11.4 | the unmount ceiling fails the cache eviction cost this change removed |
| Paused commit / absent commit, per kind | 2, unmount 8 | 1.0–1.1, unmount 4.4 | 1.1–1.9, unmount 12.3 | paused must stay close to no Genie |
| Per-component idle overhead, 1,600 rows vs 400 | 2 | 0.8–1.1 | 0.8–1.3 | 1 is linear in tree size and 4 would be quadratic |
| Tool answer-time growth exponent, 400 → 1,600 rows | 1.4 | ≤ 0.85 | ≤ 1.0 | log(time ratio) / log(fiber ratio): 1 is linear, 2 quadratic |
| Bounded tools (`react_inspect_component`, `react_render_causes`, `react_effect_timeline`, `query_list`, `timeline_read`): answer / absent tick commit, 1,600 rows | 8 | ≤ 3.4 | 34.6 for `react_render_causes` | an answer from a bounded buffer must not cost more than a few small commits |

The values come from one local guard run that measured both builds interleaved. Answers under 2 ms count as 2 ms in the exponent check, so sub-millisecond jitter cannot read as growth. Most ceilings sit well above this change's values, so noise alone should not fail the job. The unmount ceilings have the least room: they sit just under the old eviction cost, so they catch that regression coming back.

Superseded: an earlier version of this page reported a 500-row single-list benchmark from September 2026, before and after a fix for repeated sibling scans. That fixture no longer exists and its timings were not reproduced here. The fix itself is still covered by its deterministic sibling-read unit tests.
