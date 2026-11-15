# Runtime overhead

Genie runs inside the app it measures. Whatever it adds to a commit or a tool call also shows up in the timings an agent reads, so this page states what Genie costs and the conditions under which each number was measured.

## What Genie does in the page

- `genie-react/hook` installs the DevTools hook before React loads, so React reports every development commit and every deleted fiber to Genie from page load.
- The per-component analysis (which components rendered and why, their input diffs and recorded values, render necessity, effect schedules and dependency comparison) runs only while something observes it: a window from `react_clear_renders`, `react_profile_start`, `devtools_interaction_begin` or `verify begin`, an open `react_measure` span, or a recording timeline. `react_profile_stop` pauses it, and a timeline started after the stop does not resume a frozen window. A window a tool opens starts after the page has loaded, so a page opened with `_genie_observe` in its URL gets a window from the hook before React's first commit; that is how an agent observes a load.
- With nothing observing, a commit costs a counter, a check of the root's flags, and Bippy's own dispatch. Genie keeps only what a read arriving later needs about the present. It counts document commits, so commit IDs stay comparable. It records error boundary catches, which `react_error_state` and `verify` read. It numbers each mount at its position, so a remount inside a later window gets the right mount generation. It walks the committed tree for that only when the root's flags say the commit caught an error or mounted something, or on a root's first commit. Suspense blocker capture and hydration evidence have their own light listeners and keep running. The tree, StrictMode, visibility and pending work are read live when a tool asks.
- A render or effect read with nothing observing has no history to return. Its coverage counts the commits Genie did not analyse as `unobservedCommits`, lists `commits-not-observed` in `incompleteBecause` with the next step (open a window and repeat the interaction), and is not complete, so an empty result never reads as "nothing rendered". `react_component_cohort` reports such instances `mounted-unknown`, not `mounted-idle`.
- The analysis budget adapts to the tree. `react_clear_renders` sizes it to the mounted tree, and a commit that runs out grows it, up to 20,000 components and 500 ms per commit. The budget limits how much evidence is lost on a large tree; it does not keep Genie cheap.

Before this change, the analysis ran on every commit from page load, so `react_get_renders`, `react_effect_audit` and the cohort could answer about everything since load. That made a loaded but idle Genie roughly double a large commit. Evidence from before the first window is no longer collected. Agents already open a window before the interaction they measure, and `verify` opens its own.

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
| idle | Genie loaded and connected, no tool call, so nothing observes |
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

Conditions: Apple M4 Pro (14 cores, 48 GB), macOS 26.6.1, Node 22.23.4, Chromium 156.0.8078.4 headless (Playwright), React and React DOM 19.3.1 development builds, TanStack Query 5.104.1, Genie built with `pnpm --filter genie-react build` and served by the Vite dev server. "main" is the runtime at commit 0a7eb57 and "this change" is this branch on it. Both were measured interleaved on November 15, 2026: 3 rounds, each state starting first in a different round, with 20 samples per commit operation and 8 per interaction after 3 warm-ups, and memory measured on every page. Other agents were running builds and tests on the machine at the same time (load average 5 to 13). Each cell is the median of the three rounds' medians, the range across rounds in parentheses, then the p95. The tables below were measured on this change before its last revision, which only skips hashing a component's path when a report reads it outside a commit; commit-time work is the same. The guard values further down come from the final build.

## Commit cost at 8,747 components

Milliseconds: median (range across rounds) / p95.

| State | tick | select | refresh | unmount | mount |
| --- | --- | --- | --- | --- | --- |
| absent | 2.0 (1.9–2.3) / 2.3 | 1.9 (1.7–2.0) / 2.4 | 35.9 (33.9–36.7) / 40.6 | 4.6 (4.0–4.9) / 5.9 | 22.6 (21.2–23.0) / 28.0 |
| idle, main | 3.6 (3.5–3.7) / 4.5 | 3.4 (3.4–3.4) / 4.3 | 100 (99.2–102) / 158 | 22.4 (21.8–23.2) / 31.9 | 70.1 (68.8–70.3) / 131 |
| idle, this change | 1.9 (1.8–2.0) / 2.4 | 1.8 (1.8–2.0) / 2.4 | 34.1 (33.3–35.8) / 44.4 | 23.1 (20.6–24.1) / 26.5 | 34.5 (32.2–36.3) / 52.8 |
| paused, main | 1.8 (1.8–1.9) / 2.2 | 1.8 (1.8–1.8) / 2.4 | 34.3 (34.0–34.5) / 44.5 | 18.4 (18.2–21.8) / 22.0 | 23.1 (23.0–24.8) / 34.7 |
| paused, this change | 1.9 (1.9–2.0) / 2.5 | 1.8 (1.8–1.8) / 2.5 | 34.1 (34.0–36.6) / 45.2 | 21.9 (20.9–22.7) / 25.7 | 33.3 (32.1–34.0) / 36.5 |
| window, main | 3.6 (3.5–3.6) / 4.2 | 3.5 (3.4–3.6) / 4.4 | 99.2 (98.0–101) / 157 | 23.1 (22.8–23.5) / 29.4 | 72.1 (70.4–73.2) / 133 |
| window, this change | 3.7 (3.5–4.4) / 4.5 | 3.5 (3.4–4.2) / 4.4 | 101 (99.3–111) / 160 | 24.3 (22.7–27.9) / 32.7 | 71.9 (71.2–77.2) / 138 |
| profile, main | 3.6 (3.4–4.1) / 4.5 | 3.7 (3.4–4.0) / 4.5 | 103 (97.6–109) / 164 | 25.8 (24.3–27.9) / 30.8 | 74.9 (73.1–77.9) / 138 |
| profile, this change | 3.9 (3.7–4.0) / 4.8 | 3.8 (3.4–3.8) / 4.6 | 99.2 (98.6–101) / 157 | 24.8 (22.4–29.3) / 34.4 | 69.5 (68.8–76.9) / 129 |
| timeline, main | 3.6 (3.5–4.2) / 4.3 | 3.4 (3.3–4.2) / 4.5 | 98.9 (96.3–108) / 158 | 23.8 (23.5–25.2) / 32.7 | 72.8 (70.7–79.0) / 132 |
| timeline, this change | 3.8 (3.7–4.4) / 4.6 | 3.9 (3.4–4.5) / 5.0 | 109 (101–112) / 167 | 27.2 (23.3–27.3) / 32.5 | 78.1 (70.0–84.0) / 147 |

With nothing observing, the tick, select and refresh commits now cost the same as without Genie (0.95 times, within noise), where main's idle state cost 1.8 to 2.8 times. A mount commit costs 1.5 times, against 3.1 on main: numbering the new components takes about 1.5 µs per mounted component, and paused on main, which kept no mount generations, cost 1.0. Unmount is Bippy's per-fiber dispatch in every state, about 5 times. Window, profile and timeline run the same analysis as main and cost the same, within the spread across rounds: about 1.8 to 2 times for a small update and 2.8 to 3 times for a full-list refresh.

## Interactions

Milliseconds from dispatching the event to the next frame: median (range) / p95. Frames are 16.7 ms apart, so an interaction under one frame reads as about 16.6 ms.

| State | click a row | toggle a row menu | type in search | click refresh | click a nav item | Query update |
| --- | --- | --- | --- | --- | --- | --- |
| absent | 16.6 (16.6–16.7) / 17.3 | 16.5 (16.4–16.6) / 17.4 | 18.0 (17.4–26.4) / 50.1 | 16.7 (16.4–16.8) / 17.6 | 16.7 (16.5–16.8) / 17.0 | 16.6 (16.5–16.6) / 17.3 |
| idle, main | 16.6 (16.2–16.6) / 17.3 | 16.6 (16.3–16.8) / 17.6 | 81.3 (33.1–81.9) / 196 | 17.4 (17.2–18.7) / 28.5 | 16.7 (16.5–16.7) / 17.3 | 16.7 (16.4–16.7) / 17.6 |
| idle, this change | 16.5 (16.5–16.6) / 17.7 | 16.5 (16.4–16.7) / 17.4 | 33.1 (32.7–33.3) / 225 | 16.6 (16.4–16.7) / 17.5 | 16.6 (16.5–16.6) / 17.4 | 16.6 (16.6–16.6) / 17.6 |
| paused, main | 16.5 (16.4–16.6) / 17.5 | 16.8 (16.5–16.9) / 17.8 | 28.2 (25.0–29.0) / 107 | 16.0 (15.8–16.4) / 20.3 | 16.8 (16.7–16.8) / 17.5 | 16.7 (15.1–16.8) / 17.5 |
| paused, this change | 16.6 (16.6–16.7) / 16.8 | 16.7 (16.7–16.7) / 16.9 | 33.2 (29.1–49.4) / 56.8 | 16.8 (16.6–16.8) / 22.5 | 16.7 (16.6–16.7) / 17.7 | 16.6 (16.4–16.6) / 18.6 |
| window, main | 16.6 (16.6–16.6) / 16.9 | 16.5 (16.4–16.6) / 17.6 | 34.0 (33.2–78.8) / 208 | 18.6 (17.5–19.0) / 31.8 | 16.6 (16.6–16.8) / 17.3 | 16.6 (16.3–16.6) / 17.3 |
| window, this change | 16.5 (16.3–16.6) / 17.2 | 16.3 (16.2–16.5) / 18.0 | 37.0 (33.0–82.6) / 153 | 18.2 (17.9–20.3) / 21.0 | 16.5 (16.3–16.6) / 17.2 | 16.6 (16.4–16.7) / 17.6 |
| profile, main | 16.6 (16.5–16.7) / 17.4 | 16.5 (16.4–16.7) / 17.5 | 83.4 (68.9–86.9) / 181 | 19.0 (18.7–21.0) / 30.1 | 16.6 (16.6–16.7) / 16.7 | 16.7 (16.6–16.7) / 17.0 |
| profile, this change | 16.7 (16.6–16.7) / 17.4 | 16.4 (16.4–16.6) / 17.8 | 77.7 (34.1–81.4) / 175 | 17.7 (17.7–17.8) / 20.7 | 16.6 (16.4–16.6) / 17.6 | 16.6 (16.5–16.7) / 17.4 |
| timeline, main | 16.6 (16.1–16.9) / 17.1 | 16.4 (16.3–16.6) / 17.6 | 80.3 (78.7–92.2) / 172 | 19.2 (16.2–20.4) / 31.4 | 16.7 (16.6–16.7) / 17.0 | 16.7 (16.6–16.7) / 17.1 |
| timeline, this change | 16.6 (16.5–16.7) / 17.2 | 16.6 (16.5–16.6) / 17.2 | 35.7 (33.5–37.8) / 150 | 17.6 (16.8–22.6) / 18.5 | 16.7 (16.6–16.7) / 17.3 | 16.5 (16.5–16.7) / 17.2 |

Typing in the search box mounts or unmounts most of the table, so it shows the unmount and mount cost; it fell from 81 ms to 33 ms idle. The other interactions stay within about one frame in every state.

## Long tasks and startup

Startup is measured from navigation. Startup blocking is the total blocking time (time over 50 ms per long task) until the page settles. The workload columns cover all of the commit operations and interactions above: 23 commits of each kind and 11 of each interaction. Medians with ranges.

| State | Genie modules ms | Mount commit ms | Settled at ms | Startup blocking ms | Workload long tasks | Workload blocking ms | Longest task ms |
| --- | --- | --- | --- | --- | --- | --- | --- |
| absent | – | 95.0 (90.9–98.1) | 205 (190–217) | 67.0 (62.0–70.0) | 4.0 (3.0–6.0) | 2,072 (1,890–2,167) | 892 (840–920) |
| idle, main | 105 (105–109) | 150 (150–150) | 389 (382–396) | 126 (126–127) | 12.0 (11.0–12.0) | 7,530 (7,485–7,568) | 2,536 (2,512–2,570) |
| idle, this change | 105 (103–108) | 159 (159–161) | 386 (385–389) | 135 (135–136) | 5.0 (4.0–7.0) | 3,729 (3,295–4,162) | 1,441 (1,297–1,584) |
| paused, main | 104 (98.8–115) | 150 (149–158) | 385 (374–416) | 126 (125–137) | 4.0 (4.0–4.0) | 2,755 (2,746–3,041) | 1,016 (1,015–1,172) |
| paused, this change | 110 (108–110) | 160 (158–168) | 397 (390–409) | 136 (134–145) | 5.0 (4.0–6.0) | 3,380 (3,362–3,758) | 1,365 (1,325–1,427) |
| window, main | 104 (102–110) | 148 (146–150) | 382 (379–394) | 124 (122–126) | 11.0 (11.0–12.0) | 7,585 (7,514–7,650) | 2,546 (2,521–2,687) |
| window, this change | 105 (104–154) | 160 (157–180) | 391 (385–483) | 135 (133–158) | 11.0 (11.0–12.0) | 7,560 (7,532–8,333) | 2,568 (2,521–2,787) |
| profile, main | 112 (107–117) | 155 (149–163) | 407 (390–431) | 133 (126–142) | 12.0 (12.0–12.0) | 7,730 (7,623–8,330) | 2,634 (2,607–2,787) |
| profile, this change | 104 (102–108) | 157 (156–166) | 387 (386–405) | 133 (132–142) | 12.0 (11.0–13.0) | 7,496 (7,475–8,111) | 2,504 (2,496–2,734) |
| timeline, main | 107 (101–120) | 150 (145–169) | 390 (374–443) | 127 (121–148) | 12.0 (12.0–12.0) | 7,599 (7,557–8,375) | 2,670 (2,614–2,830) |
| timeline, this change | 121 (103–135) | 168 (157–174) | 434 (384–440) | 146 (133–152) | 11.0 (11.0–12.0) | 8,266 (7,486–8,559) | 2,815 (2,529–2,994) |

The longest-task column measures one synchronous loop of 23 refresh commits, not a single commit. Idle workload blocking halved, from 7.5 s to 3.7 s. Startup did not change: the first commit of a root walks the tree in every state, and it now also numbers the mounted components, about 10 ms on the mount commit.

## Memory

Used heap after garbage collection, at 8,747 components, median of the three rounds. "Retained" is the change since the page settled.

| State | Heap after load MB | Retained by the workload MB | Retained after a further 1,200-step session MB |
| --- | --- | --- | --- |
| absent | 19.1 | -5.3 | -4.8 |
| idle, main | 44.8 | 25.9 | 26.8 |
| idle, this change | 45.0 | 8.8 | 9.4 |
| paused, main | 44.9 | -1.5 | -2.7 |
| paused, this change | 45.1 | 2.0 | 2.1 |
| window, main | 44.6 | 26.3 | 28.4 |
| window, this change | 45.1 | 26.3 | 26.4 |
| profile, main | 44.6 | 25.4 | 26.9 |
| profile, this change | 45.1 | 25.2 | 26.6 |
| timeline, main | 44.9 | 25.7 | 27.3 |
| timeline, this change | 45.1 | 26.4 | 27.6 |

Idle now retains about 9 MB, against 26 MB on main. Paused retains about 2 MB. A heap snapshot comparison of idle on this change against paused on main puts the difference in one table: Bippy's per-fiber work-tag cache, a `WeakMap` that its `isCompositeFiber`, `isHostFiber` and component-name helpers fill for every fiber they see. The mount numbering calls them on new fibers, and V8 does not shrink a `WeakMap` whose keys the collector cleared, so the table stays at its peak size (about 8 MB here) instead of growing. Main's idle, window, profile and timeline states carry the same table. Genie's own map of components counted outside a window is deleted explicitly at each unmount, and its generation history is keyed by a number rather than a path string, so neither grows with the session.

## Tool calls

Not remeasured for this change. Every tool call runs on a page with a window open, where the analysis is the same as on main, and no tool handler changed. The table below is from the previous change, measured on commit 4028416, so its "main" and "this change" columns are that change's before and after. The CI guard below still measures every tool call at two sizes on each run.

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

Every page run counted the same React work with and without Genie: 14 commits, 8,759 renders, 359 effect runs and 100 layout effect runs at startup, then 240 commits, 637,687 renders and 23,351 effect runs and cleanups during the workload, and 1,776 commits and 4.1 million renders in each 1,200-step session. This held in all 33 runs.

Evidence inside a window is unchanged. `node scripts/check-runtime-evidence-parity.mjs --baseline <main dist>` replays one scenario in two builds: reads before any window, a recording window, a paused stretch with commits, then a restarted profile, followed by every read. Against main at 20 and 60 rows, with fiber ids, mount ids and event sequence numbers normalized (the reads before a window no longer describe components, so every later number shifts), the differences are:

- The reads before any window: main reports renders since load, and this change reports none, with `commits-not-observed` coverage. That is the intended change.
- `mountGeneration` on instances mounted after the paused stretch: higher here in every case (by at most 3), and `mountGenerationEvidence` changes from `inferred` to `exact`, never the other way. Main skipped the mounts its paused stretch made, so it undercounted and marked the number inferred; this change counts mounts in every state.
- 23 `componentSource` values that main left unresolved and this change resolved. Source attribution runs under its own time budget, and the earlier version of this page already excluded it for that reason.

Nothing else differs: render counts, causes, necessity, effect events and audit, Suspense, pending work, error state, the cohort and inspection match. The script still fails on the first two kinds by design, since it compares against a build that analysed before the first window.

## What changed

- The commit handler has one switch, `isTracking()` in `collectors/react/render-tracker.ts`: the per-component analysis runs only while a render window is open and not paused, a `react_measure` span is open, or a recording holds the analysis (`holdCommitAnalysis` in `collectors/react/observation.ts`, which `timeline_start` takes and its stop releases). Every other commit goes through the path `react_profile_stop` already used: count it, release pending unmounts, and walk the tree only when a catch or the traversal baseline needs it.
- Commits outside every window are counted as `unobservedCommits`, kept apart from `pausedCommits` because the next step differs: before a window, open one; after a stop, read before stopping. Unmounts outside every window release their records without being counted as lost lifecycle evidence, since no window can be missing them.
- Mount generations stay exact without the analysis. A commit nothing observes checks the root's Placement and Hydrating subtree flags; when either is set, Genie walks only the subtrees this commit completed that can hold a new Fiber, and numbers each new component at its logical position. The walk does not describe instances or give fibers Bippy ids, which is what made the earlier paused state cheap. When a window later describes such an instance, it reuses that number instead of counting the mount again. Generation history is now keyed by a 53-bit hash folded over the path's segments, so it no longer keeps up to 10,000 path strings or flattens one per mount.
- `_genie_observe` in the page URL opens a window in the hook, with the largest analysis budget, so load-time evidence (a StrictMode effect replay on load, the first mount's renders) is available on request rather than on every load.
- `react_measure` opens a span without a window, and refuses while `react_profile_stop` has paused recording. The override tools detect the commit an override causes from document commit IDs, which advance with or without a window.

### Earlier changes, already in main

- Genie's id-to-fiber cache (5,000 entries) and its mount-generation history (10,000 logical paths) evicted their oldest entry with `Map.keys().next()`. V8 keeps deleted Map entries as holes until it rehashes, and that call walks every hole, so once a tree outgrew either bound each registration scanned thousands of slots. A small LRU (`collectors/react/lru-map.ts`) keeps the same eviction order in O(1). In isolation, 300,000 registrations took 22 ms below the bound and 2 s above it.
- Instance identity rebuilt the full logical path (up to 50 ancestors, each with a sibling position and key-uniqueness lookup) for every rendered component. Within one commit, an ancestor's prefix is now resolved once and reused. The reused prefix is charged the same budget operations a fresh walk would charge, so budget behaviour and evidence are unchanged; a randomized test compares both across trees, keys and budgets.
- `react_render_causes` deep-cloned every render record on every call; it now copies only the records its retained events name. `react_get_renders` deep-cloned every candidate record; each render publishes new evidence objects and never mutates them, so a snapshot now copies only the fields an unmount or later render rewrites in place.
- The pending-unmount buffer re-scanned all 1,000 entries on every overflow to find which targeted entries to protect. A count of targeted entries gives the same choice directly. An evicted unmount no longer restores its Bippy id just to discard it.
- While paused, a commit on a root Bippy has already traversed no longer walks the rendered tree. Bippy reads its per-root baseline only until the root's first commit sets an alternate, so the next traversal reports the same renders. Components mounted while paused therefore get their ids when a tool first reads them, so their id numbers differ; ids remain stable handles.
- The unmount callback checks the renderer once per commit instead of once per deleted fiber.
- Two limits found by this fixture were fixed later. `react_pending_work` scans 50,000 fibers per call and resumes the walk on the next call while no commit lands; the hub never reports React idle while that scan is partial. `react_get_renders` with default arguments answers a match of more than 5,000 components with one bounded page and `pagination.cursorOmitted`, instead of an error.

## Still open

- Inside a window, the per-component analysis still costs about 6 µs per rendered component on this machine. The largest parts are deep-comparing props and building the bounded before/after values they report (about a third), instance identity (about a quarter), and render assessment.
- Outside a window, a commit that mounts components pays for numbering them, about 1.5 µs per mounted component (the mount row). Dropping it would leave a remount in a later window unnumbered, which `verify` relies on to tell a remount from a first mount.
- Bippy's per-fiber unmount dispatch dominates unmount-heavy commits in every state, including idle and paused.
- `react_get_renders` at 13,800 components answers in about 20 ms inside a window, against 17 ms on main, in every tools run. The read path did not change: a build of this change with the analysis forced on from page load answered in 17.1 ms, main in 18.2 ms and this change in 20.1 ms in the same interleaved run. The difference comes from state the analysis used to leave behind before the window, and a CPU profile spreads it across the report code rather than one function. It is not warm-up: 40 extra calls and five times the workload before measuring left it unchanged.
- About 8 MB of the memory idle retains is Bippy's per-fiber work-tag cache table at its peak size (see Memory). Avoiding it would mean resolving work tags without Bippy's helpers in the mount walk and the lineage code.
- A window from `react_clear_renders` or `react_profile_start` stays open until `react_profile_stop` or a reload, so an agent that opens one and leaves keeps the analysis running. `devtools_interaction_stop` and `verify end` call `react_profile_stop` and so close theirs.

## The CI guard

`pnpm check:runtime-overhead`, and the `Runtime overhead guard` CI job, run `scripts/benchmark-runtime-overhead.mjs --guard`. It measures absent, idle, paused and window at 400 and 1,600 rows (3 rounds, 15 samples), and the tool calls at both sizes, then fails when any check exceeds its ceiling.

Shared runners differ in speed and are noisy, so no check compares absolute milliseconds. Each check is either an exact count or a ratio between two measurements from the same run on the same machine:

| Check | Ceiling | This change | main | Why this ceiling |
| --- | --- | --- | --- | --- |
| Fixture commit, render and effect counts, with Genie vs without | identical | identical | identical | Genie must not change what React does |
| Idle commit / absent commit, per kind, 1,600 rows | 2, refresh 1.5, unmount 8 | 1.2–1.6, refresh 1.0, unmount 4.6–4.9 | 1.8–3.2, refresh 3.0–3.1, unmount 5.0–5.3 | idle must stay close to no Genie; a refresh re-renders every row, so any per-component analysis triples it |
| Paused commit / absent commit, per kind | 2, refresh 1.5, unmount 8 | 1.2–1.5, refresh 1.0, unmount 4.9–5.0 | 1.1–1.4, refresh 1.0, unmount 4.2–4.7 | paused must stay close to no Genie |
| Window commit / absent commit, per kind | 5, unmount 9 | 2.0–3.3, unmount 5.2–5.7 | 2.0–3.3, unmount 5.0–5.2 | the old idle ceiling, now applied where the analysis runs |
| Per-component window overhead, 1,600 rows vs 400 | 2 | 0.6–1.0 | 0.6–1.0 | 1 is linear in tree size and 4 would be quadratic |
| Tool answer-time growth exponent, 400 → 1,600 rows | 1.4 | ≤ 0.99 | ≤ 0.84 | log(time ratio) / log(fiber ratio): 1 is linear, 2 quadratic |
| Bounded tools (`react_inspect_component`, `react_render_causes`, `react_effect_timeline`, `query_list`, `timeline_read`): answer / absent tick commit, 1,600 rows | 8 | ≤ 5.6 | ≤ 3.5 | an answer from a bounded buffer must not cost more than a few small commits |

The values span two local guard runs that each measured both builds interleaved, on the machine and day described above; the last ran on the final build. Answers under 2 ms count as 2 ms in the exponent check, so sub-millisecond jitter cannot read as growth. Idle and paused share ceilings, so a change that brings the analysis back into the idle path fails the job: main's idle state fails the refresh and mount checks in both runs. The tick and select ceilings stay at 2 because a 2.5 ms commit is noisy on shared runners. The per-component growth check moved from idle to window, because idle no longer runs the analysis whose growth it measures. The tool calls run inside a window in both builds and no handler changed. `react_effect_timeline` read 9.2 ms on main and 14.5 ms here in the first run, and 8.3 ms against 8.4 ms in the second, so that spread was noise. `react_get_renders` at 1,600 rows answers in about 20 ms here against 17 ms on main in every run (see "Still open").

Superseded: an earlier version of this page reported a 500-row single-list benchmark from September 2026, before and after a fix for repeated sibling scans. That fixture no longer exists and its timings were not reproduced here. The fix itself is still covered by its deterministic sibling-read unit tests.
