# @genie-react/cli

## 1.0.0

### Major Changes

- d6529b7: Genie React 1.0: verify fixes, not just read evidence.

  1.0 makes Genie the verification step for a coding agent working on a React or React Native app, alongside agent-browser or agent-device:

  - `genie-react verify` decides whether a fix worked from declared claims and exits with the verdict. It passes only on exact, complete evidence and refuses with a named fix otherwise.
  - The CLI prints compact text written for a model to read by default; `--json` and `GENIE_OUTPUT=json` keep JSON for scripts.
  - The app runtime analyzes renders and effects only while a window, span or recording observes them. With nothing observing, a commit costs Genie a counter and a check of the root's flags.
  - Several agents can share one app and hub: each keeps its own tab, window and overrides, and a call that would disturb another agent's evidence is refused.
  - `genie-react feedback` files a Genie bug as a GitHub issue after the user approves the preview.

  The tool contracts, CLI output format and exit codes documented at genie-react.com are stable from this release; breaking changes now need a new major version.

### Minor Changes

- 4940ab6: Genie and [agent-browser](https://github.com/vercel-labs/agent-browser) now share one session name, so an agent no longer keeps `_genie` in the URL in step with `--session`:

  ```bash
  agent-browser --session my-agent open http://localhost:5173/
  npx genie-react status --session my-agent --wait 15000
  ```

  - `--session` and `GENIE_SESSION` accept the name of an agent-browser session. When no tab in the hub carries that name or ID, the CLI reads the Genie identity of the page that session shows with `agent-browser eval` and targets that tab. A name a tab already carries in the hub still wins, so `_genie` names and session IDs work as before. `status` reports the link in `sessionSelector.agentBrowser`.
  - Without `--session` or `GENIE_SESSION`, commands follow `AGENT_BROWSER_SESSION`. When that session's page does not run Genie, they use the default tab and print an `agent-browser` diagnostic saying why.
  - With no target, several tabs and no default tab yet, a command uses the one tab that a running agent-browser session shows, when exactly one does and no other agent claimed it, and names it in an `agent-browser` diagnostic. When several sessions show tabs, the `SESSION_AMBIGUOUS` failure lists them in `details.agentBrowser.sessions`. Tabs another agent uses are never picked.
  - When a named agent-browser session runs but shows no Genie page, or is not running, the `unknown_session` or `not_connected` failure says so in its message and `details.agentBrowser`, with the `agent-browser --session <name> open <app-url>` command.
  - `react_component_for_dom` takes an agent-browser snapshot ref: `call react_component_for_dom '{"ref":"@e12"}' --session my-agent` returns the component that renders that element. The CLI reads the element's box and innerHTML with `agent-browser get box` and `get html` in the session that shows the targeted tab. The tool also accepts that `box` directly, matching the element whose `getBoundingClientRect()` equals it even when another element covers it or it is off screen, and using the innerHTML to tell it apart from a wrapper or overlay of the same size. `selector` is now optional in the output and present only for a selector lookup.
  - `devtools_status` marks a tab another agent uses with `claimedByOthers: true`, and `status --sessions-only` shows it.
  - Genie reads agent-browser only through its documented CLI (`session list`, `get url`, `eval`, `get box`, `get html`), never runs a command on a session that is not running, since agent-browser would launch a browser for it, and gives each command 2 seconds. `GENIE_AGENT_BROWSER` points it at an agent-browser executable that is not on `PATH`.
  - Opening the app with `agent-browser --enable react-devtools` works beside Genie: both hooks attach, agent-browser's `react tree`, `react inspect` and `react renders` keep working, and Genie's render causes match a page without the DevTools hook.

- d5bc284: **Breaking:** the CLI now prints compact text by default instead of JSON. Text keeps every field of every result under its JSON name and costs fewer tokens: about 72% of the JSON tokens across recorded results, 42–60% for a component tree and about 75% for render causes. App strings are quoted, so app content cannot fake a field, a failure line or a command. A failure's first line is `error <reason>: <message>`, followed by `next: $ <command>` when a recovery command is known. Exit codes and byte limits are unchanged, and an oversized text result is saved whole as a `.txt` file at `outputPath`.

  `--json` prints the same JSON documents as before, with identical schemas. Help is text; `--help --json` returns the JSON metadata. Diagnostics on stderr are text lines, or JSON Lines with `--json`. `batch` prints one block per result; `batch --json` prints one array and `batch --ndjson` prints JSON Lines.

  Migration: add `--json` to every command whose output a script parses, or set `GENIE_OUTPUT=json` once to keep the 0.19 behavior, including JSON Lines for `batch`, `call --fields` and `hub`. `GENIE_OUTPUT` accepts only `text` or `json`; any other value fails with `invalid_input`. The format is specified in docs/json-cli.md.

- 3ff8f6e: Fix evidence that could answer a different question than the one asked, or report work as finished while it was still running.

  - **Breaking: component names match exactly.** `react_get_renders`, `react_render_causes`, `react_renders_since`, `react_profile_report`, `react_provenance`, `react_effect_audit`, `react_effect_timeline` and `react_effect_events` used to match `component` as a substring, so asking about `Checkout` also returned `CheckoutRow`. They now match the exact display name. Pass `exact:false` for the old substring match. Each result now has a `componentMatch` field when `component` is set. Its `status` is `matched`, `ambiguous` (several names matched, so the evidence mixes them, all listed in `matchedNames`) or `no-match`, with `similarNames` to retry with. `react_component_cohort` already matched exactly and now reports `componentMatch` too. `devtools_wait` with `condition:"component"` waits for the exact name; it used to finish as soon as any name containing it mounted. Cohorts from `devtools_interaction_begin` `components` match exactly. `react_find_components` is a search and still matches substrings by default.
  - **Navigation waits for the router to settle.** `devtools_wait` `navigation` and the `router` domain of `settled` used to finish once `isLoading` turned false, while a stale-while-revalidate loader or the render transition was still running. They now wait for `router_get_state` to report `settled`, and `lastObserved` includes `settled` and `pendingWork`.
  - **Capture comparisons refuse mixed samples.** `devtools_capture_compare` returns `overall: "not-comparable"` with a new top-level `notComparableReasons` in these cases: captures ran on a different app, React, TanStack or React bundle (`runtime-environment-mismatch`, which used to be only a warning); a cohort mixes tabs (`cohort-spans-multiple-tabs`); another tab answered for a silent targeted tab (`capture-from-stand-in-tab`); or two captures read the same observation window and so were one run counted twice (`repeated-snapshot-of-one-run`). `warnings` name the captures. Render metrics from a capture taken with no observation window are refused as `render-observation-window-missing`, because their counts are cumulative. A capture that another tab answered is marked `session.standIn: true` and is never `complete`.
  - **Captures store tool results as the app sent them.** Captures and interaction recordings used to serialize results a second time, which turned placeholders past the depth limit into broken nested placeholders.
  - **App data can no longer pass for Genie's encoding.** An app object with a `__genie_dehydrated__`, `__type` or `…` key used to look exactly like a truncation placeholder, a Map, a Set or an Error. Such an object is now shown as `{"__type":"Object","entries":[[key, value], …]}`, so these keys always mean Genie's own encoding, in text and in `--json`. On an Error, a colliding own key is listed as omitted. Every other value keeps its shape.
  - **JSON output escapes bidirectional controls.** `--json` output, JSON Lines and stderr diagnostics now escape bidirectional overrides, zero-width characters, line separators and C1 controls inside strings as `\uXXXX`, as text output already did. An app string can no longer reorder or hide what a terminal shows. The parsed values are unchanged.
  - **Suspense tools agree.** `react_pending_work` (used by `react_quiesce` and `devtools_wait`) counted a server-rendered boundary that had not hydrated as "showing a fallback", and counted boundaries inside a hidden `Activity`. It now uses the same detection as `react_suspense` and `react_error_state`. A new `dehydratedBoundaries` count and a `state` on each listed boundary keep React from reading as idle until hydration finishes, and the quiesce reason says the boundary has not hydrated.
  - **Boundaries are in the tree.** `react_get_tree` lists Suspense boundaries as nodes with `kind: "suspense"`, and error boundaries carry `errorBoundary: true`. The ids `react_suspense` and `react_error_state` report are now tree nodes. `react_find_components` finds boundaries by the name `Suspense`, and `react_inspect_component` reports `kind: "suspense"` for one.
  - **Hook indexes agree across tools.** A render cause's `hook.stateIndex` now matches the `stateIndex` that `react_inspect_component` shows and `react_override_hook_state` accepts. It used to count the pending flag inside `useTransition` and `useActionState`, which shifted every later index by one. That flag now has `stateIndex: null` and keeps its flat `index`. `useOptimistic` stays refused by `react_override_hook_state` after its component re-renders; before, any re-render made it look like `useState` or `useReducer`.
  - **No false parent cascade.** A `PureComponent`, or a `memo` without a comparator, that renders with all props equal in the same commit as its parent used to be reported as a `parent` cause. React skips such a component whatever its parent does, so the render is now an `unknown` cause, `no-observable-fiber-input-change` (for example `forceUpdate`), with `necessity: "unknown"`. A custom comparator or `shouldComponentUpdate` still reports the parent.

- 54fc43a: Add `genie-react feedback` for reporting a Genie bug, friction, an idea, or a docs gap to the maintainers. By default it only previews: it prints the exact issue title, body, and destination, saves a private draft, and sends nothing. `feedback --submit --draft <id>` files that draft as a public issue on `Genie-sa/genie-react` through the GitHub CLI, from the account `gh` is signed in to. When `gh` is missing, signed out, offline, or rate limited, the result has the saved report and a prefilled new-issue link instead.

  The report carries only your message, the title, and fixed diagnostics (CLI and `genie-react` versions, Node, OS and architecture, package manager, framework, React version). The CLI replaces home and project paths, strips URL credentials and queries, redacts emails and secret-shaped values, and keeps `@mentions`, `#123` references, Markdown, and HTML from rendering. `--reason` and `--tool` group reports by failure, and with `--reason` the CLI returns an open issue with the same failure signature instead of filing another.

  `operational_failure` results now carry a `feedback` command with the reason and built-in tool prefilled, and their message says when to use it.

- b8291df: Make waits, before/after comparisons and routing report what really happened, and harden the local hub.

  - `react_quiesce` and `devtools_wait` (`react-quiet`, `settled`) no longer report React idle while a transition is suspended or a Suspense boundary is showing its fallback while it waits for data. Before, both returned `idle` as soon as commits stopped, even though the screen was still loading. A new read-only tool, `react_pending_work`, reports that pending work. The quiesce result now includes the last `pendingWork` sample, and a timeout names the blocking boundaries in `reason`. With an older app runtime that lacks the tool, `pendingWork` is `null` and idle covers commits only.
  - `devtools_capture_compare` no longer turns noise into a significant change. When most runs had the same value, for example render counts like `5, 5, 6, 5, 6`, outlier rejection dropped every run that differed from the median, and the comparison could report a regression or improvement the data did not support. Outliers are now judged over both cohorts together, with a mean-absolute-deviation fallback when the MAD is zero. Comparisons of the same build now report false changes at the stated confidence level instead of about twice that rate.
  - `devtools_capture_compare` now discards the earliest captures of each cohort as warm-up, by creation time. Before, it discarded the first IDs in the list, so a cohort copied from `devtools_capture_list` (newest first) dropped the steadiest run and kept the cold one.
  - The permutation test now treats near-equal mean differences as ties relative to the data's magnitude, so large values such as heap bytes no longer get p-values that are too small.
  - An exported capture now re-verifies against its own checksum when it contains dates or other non-JSON values. Before, dates were hashed as `{}`, so the checksum ignored them.
  - A call that changes app state no longer runs on another tab when the targeted tab has stopped sending heartbeats (frozen, hung or throttled in the background). It fails with `busy` and names the tab. Read-only calls still answer from the live tab and are marked `retargeted`.
  - The hub now accepts a tool response only from the tab the request was sent to. Before, any connected tab that sent a matching request ID could answer another tab's call.
  - One app connection now speaks for one document. Before, a connection that announced several session IDs left phantom sessions behind after it closed, which made untargeted calls ambiguous.
  - The CLI no longer gives up on `devtools_wait` or `devtools_interaction_stop` before the `timeoutMs` you asked for. Before, a wait longer than 20 seconds failed with a CLI timeout while the hub was still waiting.
  - The hub now reports its version in status (`hub: {version, protocol}`), and each app session reports `runtimeVersion`. The CLI refuses a hub from another `major.minor` release line, or one that does not report a version, with `reason: "bridge_rejected"`, `errorCode: "version-mismatch"` and `details.versions` naming both. Status warns when an app runtime comes from another release line. Install the same version of `genie-react` and `@genie-react/cli`.
  - The standalone hub (`genie-react hub`, Next.js) answers plain HTTP requests only when `Host` is an IP address, a loopback name or an allowed host, so a DNS-rebinding page can no longer read the project path from `/__genie/info`.
  - Frames larger than 64 MiB now close the connection instead of being buffered.
  - `startGenie()` and `<Genie />` from `genie-react/native` no longer connect to the hub in a production build, even when the app skipped the `__DEV__` guard.
  - Added `SECURITY.md` with the threat model, what is and is not a security boundary, how to treat tool output, and how to report a vulnerability.

- c20c9f8: Component inspection, source locations, and overrides now report what the app actually does, or say that they cannot tell.

  - **Source locations.** In a Vite app on React 19, a component's `source` used to name the source-map entry (`App.jsx`) instead of the served path (`/src/App.jsx`), and its column was one too low. Both are now correct. Each `source` also carries a `role`: `element-callsite` is where the element was created, and `component-body` is a line inside the component. A plugin that transforms a file without passing on a source map (the StyleX Vite plugin is one) shifts every compiled position in that file. Genie now checks a callsite against the dev server's copy of the file. When the file does not show the element on that line, Genie reports `line: null` instead of a wrong line marked `mapped`. `react_provenance` fills `allocationCallsite` when it knows the callsite.
  - **Override reset.** `react_reset_overrides` used to restore only the first of two hook overrides on one component, and it reported both as restored. It also wrote stale values back after the app had moved on: a hook the component had set again, props a parent had re-rendered, or a Provider value its parent had replaced. Each hook override now restores on its own. When the app has replaced an overridden value, reset leaves it alone and reports the new outcome `superseded`. A props reset removes any prop the parent never passed, instead of setting it to `undefined`. Overrides on a component that unmounts no longer keep it in memory.
  - **Hook overrides.** `react_override_hook_state` refuses the internal slots of `useActionState` and `useOptimistic`. Overriding the action slot used to replace the app's action function.
  - **Hooks.** `react_inspect_component` names the React hook behind each slot in a new `hook` field (`useState`, `useTransition`, `useSyncExternalStore`, `useActionState`, `useOptimistic`, `useEffectEvent`, …). `useOptimistic` and `useActionState`'s action slot are no longer labelled `reducer`.
  - **Context.** `react_inspect_context` names the Provider each value comes from in a new `provider` field, or `null` when the component reads the context default. Provider and Suspense boundaries are named `Theme.Provider` and `Suspense` instead of `Theme` and `Anonymous`.
  - **Stale ids.** Component ids now start in a random block for each page load. An id kept from before a reload fails with "not found" instead of resolving to whichever component took that number in the new page.
  - **Search.** `react_find_components` pages with `cursor` and `nextCursor`. The match order is fixed when the search starts, so pages never repeat or skip a match. A match that unmounted between pages is counted in `unmountedSinceSearch` and never returned.
  - **Tree limits.** `react_get_tree` reports how many nodes each limit left out in `omitted: { depth, maxNodes }`, so both are visible when both limits apply. Each node that `depth` cut off carries `omittedDescendants`.
  - **DOM mapping.** `react_dom_for_component` lists text nodes as `#text` entries, located by their containing element. A component that renders only text used to report no DOM at all.
  - **StyleX.** `stylex_inspect` lists inline style declarations and marks each class declaration that an inline style overrides with `overriddenByInline`.
  - **Values.** Inspected values no longer run app getters, including along a `path` and on array indices. An `Error` shows its name, message, and cause instead of `{}`. `NaN`, `Infinity`, and invalid dates are marked instead of printing as `null`. Typed arrays keep their type. Keys that cannot be carried (`constructor`, `prototype`) are reported as omitted instead of disappearing. Value previews never throw, including on revoked proxies and invalid dates.

- 93c3c13: Component ownership, the default tree, and effect evidence now describe the app's own code, and when Genie cannot tell, it says so instead of hiding the result.

  - **Ownership.** A component is `app` or `library` according to its own code, not the JSX that created it. On React 19 that is the frame of its body that React records when it creates elements; on React 18 it is the `_debugSource` of the elements it renders, which precompiled packages do not carry. A library provider, router, link or icon written in your file used to come back `app`. It is now `library`. The class inside a `connect()` wrapper and a client component rendered by a Next.js server component (Turbopack) used to come back `unknown`; they are now `app`. A component that renders only its children or `null` stays `unknown`, because nothing about its own code is visible. A Suspense boundary belongs to whoever wrote it. `react_provenance` fills `definitionSource`, and the effect audit's `componentProvenance` names its `basis`. Pre-bundled packages served from a project-local Vite cache (`cacheDir: './.vite'`) and unmapped Next.js client chunks are no longer read as app files.
  - **`appOnly`.** `appOnly: true` hides only results known to be library code. Results whose ownership is unresolved now stay, marked `ownership: "unknown"`, and `filteredNote` counts both what was hidden and what is unknown. A default call could previously return `[]` for a component that rendered, or for an effect that ran, while the real answer was "hidden". `react_effect_timeline` gains `filteredNote` and `libraryEventsHidden`. When an app-only render report includes unknown ownership, its summary semantics are `unknown`, because the totals may include library work.
  - **Default tree.** With `appOnly`, `react_get_tree` folds framework and library wrappers away, and `depth` counts only the levels it shows, so the tree starts at your own components. On a Next.js page, `depth: 8` used to return no nodes; on a TanStack Router app, the README's `depth: 3` check stopped at `RouterProvider`.
  - **Effect ownership.** Each effect is attributed to the hook call that declared it, using the hook inspector React DevTools runs when you select a component, once per component type. An effect inside `useQuery`, `useSuspenseQuery` or `useSelector` is library-owned even in your component. `react_effect_audit` and `react_effect_timeline` give the same answer. The timeline used to label TanStack Query's per-render `setOptions` effect as an app effect, and the audit used to report every effect as `unknown`. A declaration that cannot be located is `library` when library code called the custom hook around it, and otherwise `unknown`.
  - **One effect address.** Audit effects and timeline events carry `hookIndex`, the index `react_inspect_component` reports, plus `hook` and `customHooks`. Their `source` is the effect's declaration (`role: "hook-callsite"`), not the component's JSX.
  - **Hotness.** An effect with dependencies is `hot` when it keeps re-running while none of its dependencies changed value, for example when a new object literal arrives on every keystroke. It used to be hot only when it was scheduled on every single update, so an effect that refetched on 9 of 10 updates read `not-hot`. Re-runs driven by a changed value are not hot. Re-runs whose changed dependencies cannot be compared (functions) are `insufficient-data`. `hotness.basis` and `hotness.reruns` say which applies. `minScheduleRate` now applies to effects without a dependency array.
  - **Changed dependencies.** After a render that bailed out, `react_effect_timeline` compared against the wrong previous dependencies and reported `changedDependencySlots: []`, graded exact, on alternate runs. It now reads the previous dependencies React compared against. Each event adds `dependencyChanges` (`value`, `reference-only` or `undetermined` per slot) and `dependencyComparison`, which is `previous-unavailable` when an empty list would not mean "nothing changed".
  - **Hook names.** `customHooks` names a hook the way the caller wrote it: RTK Query's `useGetIssueQuery` instead of `useQuery [as useGetIssueQuery]`. A custom hook whose function has no name used to come back as `"eval"` or `"use"` with `customHookGrouping: "exact"`. It now appears as `"(anonymous)"`, and the grouping is `partial`.
  - **Locations.** Summary views label each `location` with its `role`. `react_error_state` adds `stackFrames`, the stack source-mapped where the module has a map, with each frame's `mapping`: `mapped`, `served`, or `unmapped-build-file` for build output such as Next.js server chunks. `react_suspense` await and I/O frames carry the same `mapping`.

- 86b3ea7: Make Genie safe to use from several agents at once: on one tab, one hub, or one machine with a hub per worktree.

  - Each CLI process now tells the hub which agent it belongs to. The identity is `GENIE_AGENT` when set (1–64 letters, digits, `.`, `_` or `-`; other values fail with `invalid_input`), else a hash of the Claude Code or Codex session ID, else a hash of the git worktree root. Raw session IDs and paths never leave the CLI. Without any of these, calls share one anonymous identity, as before.
  - A read from a render window another agent restarted (`react_clear_renders`, `react_profile_start`, `devtools_interaction_begin`), paused (`react_profile_stop`), or disturbed with a state-changing tool now fails with `reason: "conflict"` and `hubCode: "OBSERVATION_SUPERSEDED"`. Before, `react_get_renders`, `react_render_causes`, effect reads, `react_profile_report`, `devtools_interaction_stop` and `devtools_capture_create` returned the other agent's window as if it were yours. `details.ownership` names the resource, the cause, the tool and how long ago it happened. The same failure covers a read after the tab reloaded (`cause: "reloaded"`), which before returned the new document's empty or foreign window, and a `timeline_read` of a recording another agent's `timeline_start` replaced.
  - `react_reset_overrides`, `query_restore_state` and `query_simulate_state` no longer end overrides or Query simulations another agent applied, and `timeline_start` no longer competes with another agent's running recording. They fail with `reason: "conflict"` and `hubCode: "STATE_HELD"`. A hold lapses after 5 minutes without a call from the agent that holds it, and a reset goes ahead once the app reports no overrides left.
  - Untargeted calls keep a default tab per agent and skip tabs another agent used in the last 10 minutes. Before, the first agent to call picked the default for every agent on the hub, so an agent that never passed `--session` could land on another agent's tab. When every tab is in use, the call fails with `reason: "unknown_session"` and `hubCode: "SESSION_CLAIMED"` and lists the tabs. Passing `--session` still shares a tab deliberately.
  - A call on a tab another agent used recently writes a `session-shared` diagnostic on stderr, and a call that disturbed another agent's window writes `window-displaced`.
  - Discovery now stops at the nearest git checkout or worktree root. Before, a worktree nested in another checkout (such as `.claude/worktrees/<name>`) without a running hub of its own walked up to the enclosing checkout's `.genie/bridge.json` and talked to that hub, and a checkout root adopted or listed hubs that belonged to worktrees inside it.
  - Two dev servers or hubs that start for one project at the same time no longer interleave their writes, which could pair one server's endpoint with the other's agent token. Publication is serialized with a lock in `.genie/`.
  - Oversized outputs spilled to `outputPath`, and feedback drafts, are kept for at least an hour beyond the newest 20 (at most 200). Before, a burst of output from parallel agents could delete a file another agent had just been told to read.

- 1288785: New optional Redux collector. Register it with `reduxCollector(store)` from `genie-react/collectors/redux`, where the store is created, or pass `reduxStore` to `<Genie />` or `startGenie`. It supports Redux 4 and 5 and Redux Toolkit 1.9 and 2.x, with middleware and enhancers. In production builds it resolves to a stub that leaves the store untouched.

  - `redux_actions` lists recorded dispatches, oldest first: type, a depth-bounded copy of the action, duration, whether it returned or threw, whether the root state kept its identity, and which top-level slices changed. A thunk is recorded too, and every action it dispatches, at once or later, names it as `parentActionId`. This covers `createAsyncThunk` and RTK Query `initiate`. Filter by type, type prefix, slice, kind or detected mutation, and page forward with `afterSequence`.
  - Each action is checked for in-place mutation. `mutation.status: "detected"` lists the state paths where an object that already existed changed during the dispatch, as when a reducer pushes into `state.notes` and returns `state`. The check is bounded per action, and `scanTruncated` says when part of the state was not compared. A change made in place between dispatches is reported at the next dispatch as `mutation-outside-dispatch`.
  - `redux_state` reads the state or a path in it, depth-bounded, with the same `where` selection as `query_get`.
  - An `external-store` render cause from the collected store now carries `redux`: the actions that changed the state between the component's previous render and this one. Its `evidence` is `exact` only when React's render timing proves that ordering; otherwise it is `inferred` with a `reason`. The summary view shows the action types.
  - A state change that reached the store without going through the wrapped `dispatch`, such as an action that middleware dispatches on its own, is recorded as `unrecorded-change` with no type. It is never graded `exact`.
  - Dispatch return values, thrown errors, listener order and thunk arguments are unchanged. On a store with 3,240 entities, recording adds about 1–2.5 µs per dispatch and the mutation check about 30–40 µs more; `{ detectMutations: false }` turns the check off.

  The skill's Redux recipe is now the fallback for stores the collector cannot wrap.

- e34b498: Render evidence no longer calls a render unnecessary when Genie cannot see its trigger. These fixes come from an audit that compared Genie's reports with renders counted by the app itself, on React 18.3 and 19:

  - A `useDeferredValue` deferred pass was graded `unnecessary` and counted in `noObservedInputChange`, even though it is the render that shows the new value. It now has an `unknown` cause with reason `unclassified-hook-changed` and the hook's `hookIndex`, and `assessment.inputEvidence` is `changed`.
  - A class `forceUpdate`, or any other render with no observed trigger and no rendered parent, was graded `unnecessary`. React renders a component on its own only for an input it saw change, so these renders are now `necessity: "unknown"` and stay out of `noObservedInputChange`.
  - On React 19, the pending render of `useTransition` and `useActionState` was graded `unnecessary` because their pending state was not recognized. It is now an exact `state` cause on that hook.
  - A component that unmounted inside the window disappeared from `react_get_renders`, its summary totals, and `react_renders_diff`. Its renders now stay counted and it reports `unmounted: true`, also in `react_renders_since`. Up to `lifecycle.bufferLimit` unmounted components are kept. Older ones are evicted, counted in `coverage.droppedUnmountFibers`, and the counts become a lower bound.
  - When the render budget skipped a parent, a targeted child was graded `unnecessary` with no cause. It now names the parent that rendered.
  - When a conditional `use(Context)` changed the order of Context reads, a changed Context was missing from the causes while coverage claimed to be complete. Context reads now pair by Context identity.
  - `deepDiff` reported "same value, new identity" for arrays with extra properties, such as RegExp match arrays, and for objects whose non-enumerable properties differ. Those comparisons are now marked incomplete.

  `renders` now documents that it counts committed renders. Strict Mode's second invocation, render attempts React discarded, and renders React bailed out of are not counted.

- 6582478: Render evidence now holds up on real apps. These fixes come from three realistic apps (a Vite dashboard on React 19, a React 18 app built on `connect()` classes, and a Next.js storefront) where agents used Genie and recorded where it was wrong:

  - **Necessity follows the DOM.** A re-render that changed nothing visible was graded `necessary`. Genie counted React's internal update flag on host elements as a DOM write, and React sets that flag for a new `onClick` closure or an equal style object. Genie now diffs host props the way React DOM and React Native do: a changed attribute, style value, text, or an inserted, moved or removed node counts as a write, while a new event handler, ref or other function does not. `necessity` is now `necessary` only when the render's subtree wrote to the DOM. It is `unnecessary` when the render's inputs were provably equal, or when it wrote nothing, replaced no callback and scheduled no effect. Otherwise it is `unknown`. The new `necessityReason` says which: `mount`, `dom-changed`, `inputs-unchanged`, `output-unchanged`, `callbacks-changed`, `effects-scheduled` or `output-incomplete`. Children that rendered for their own update with unchanged props keep their writes, and a write a Context change caused is credited to the component that renders the provider. React's own `useSyncExternalStore` bookkeeping no longer counts as an effect. `subtreeHostMutations` gains `callbackOnlyUpdates`, `writes` and `callbacks`, and the assessment gains `subtreeScheduledEffects`. The summary views now include `necessity` and `necessityReason`. Without a commit to inspect, as with `recordRender` alone, a render whose inputs changed is now `unknown` rather than `necessary`.
  - **Wrappers no longer hide the cause.** A higher-order component such as `Connect(Inner)` or `withRouter(Inner)`, or the outer fiber of `memo(forwardRef())`, now carries `wraps` with the causes and necessity of the component it rendered in the same commit, and that component carries `wrappedBy`. Asking about either one gives the real cause.
  - **A store cause needs a subscription that fired.** An `external-store`, `query` or `router` cause is reported only when React scheduled an update on the subscriber. A `connect(null, mapDispatch)` wrapper that re-rendered because its props changed now reports the prop, not a store. Store causes carry `subscriptionFired`.
  - **Store snapshots are compared like state.** `changedFields` names the top-level snapshot fields that changed, by value or by reference, and `deepDiff` and `before`/`after` read two levels into plain objects. A snapshot with equal contents counts as identity-only. `storeId` now comes from the store's `subscribe` function, so every component subscribed to one zustand or Redux store reports the same id.
  - **Contexts have one name.** A Context without a `displayName` was named after each consumer's own hook index, so one Context was `Context[0]` in one component and `Context[1]` in another. It is now named `Context(<component rendering its provider>)`. Context causes add a `contextId` shared by every consumer and the `provider` component.
  - **Parent causes name the cascade origin.** A `parent` cause adds `origin`, the nearest ancestor that React scheduled an update on: the component whose state, store, Context or forceUpdate started the cascade. That component is usually where the fix goes. Compact causes show it as `origin`.
  - **Class state names its fields.** A class state change adds `changedFields`, and its cause is named after the fields, for example `this.state.draft`, rather than `class state`.
  - **The default budget covers a few hundred rows.** Analysis cost grows with tree depth, so router-heavy apps ran out of operations. The adaptive budget now sizes operations and time from the mounted tree's depth. When a commit still runs out, the next commits and `budgetAdvice` grow from what each analyzed component actually cost, so the suggested budget fits on the first retry. An operation or time limit that ran out now grows the work limits, not `fiberLimit`.
  - **Incomplete coverage says why.** `coverage.incompleteBecause` lists each reason with a count: `budget-exhausted` (with the `next` step), `unmounts-dropped`, `renderer-not-analyzed` (a production or pre-18 renderer such as a framework overlay), `observation-paused`, `traversal-failed`, `analysis-failed`, and `inputs-truncated` or `props-not-enumerated` with the components involved.
  - **`react_component_cohort` is readable at 100 rows.** It takes `view`, and the default `summary` states the value most instances share once under `shared` (component, source, parent, state and the common `logicalPath` prefix). Each row keeps its status, mount id, key, index, the rest of its path, host selector and commit. `view:"full"` returns the previous shape.
  - **One component selector across render tools.** `react_clear_renders` and `react_profile_start` accept `component` with one name or a list, matched exactly like the read tools, and `exact:false` for substrings. `components` still works with substring matching, and the response then lists a `deprecations` entry naming `component`.

- 6a6b204: Fix setup and component lookup on webpack, esbuild and other bundlers, keep app tools type-checking when the app uses another zod 4 release, and document how to expose a Redux store.

  - An exact component selector now finds a component that esbuild renamed to avoid a name collision. For `const Row = memo(function Row…)`, esbuild names the inner function `Row2`, and `react_find_components {"component":"Row","exact":true}` used to find nothing. Genie now checks the app's source map: when it records `Row` as the original name of the `Row2` function, `Row` matches it. A match marks the rename: `react_find_components` adds `sourceName` to the match, and every name-filtered report adds `componentMatch.bundlerRenames`. Components keep their runtime names in every result. A real `Heading2` never matches `Heading`, because its source map records no rename.
  - `defineGenieTool` and `useGenieTool` no longer run TypeScript out of memory when the app's `zod` is a different release than the copy inside genie-react, for example zod 4.6.5 against 4.4.3. Their schema parameters now only need a Zod 4 schema's output type, so `tsc` checks handler arguments and results as before, across zod 4 releases. A zod 3 schema fails with a type error, and at runtime `defineGenieTool` throws an error that names the tool when its `input` or `output` is not a Zod 4 schema. The new `GenieToolSchema` type names the constraint for wrappers.
  - `genie-react init` handles projects that use neither Vite nor Next.js (webpack, Rspack, esbuild, Parcel, Rollup). It no longer reports a missing `vite_config` or suggests the Next.js `GenieScript`. It reports the hub port from a running hub or a package script such as `genie-react hub --port 4712`, falling back to 4390. A new `client_setup` artifact says whether a client is already wired, and the manual steps give the script tag and the `genie-react/hook`-before-React recipe on that port. `data.integration` now carries `bundler`, `hubPort`, `hubPortSource`, `scriptUrl`, `websocketUrl`, `hookModule`, `clientModule` and `guide`, and no longer carries the incorrect `module: "genie-react/next"` and `export: "GenieScript"`. `next` starts the hub through the package script or `genie-react hub --port <port>`, or points to `doctor --live` when the hub is already running.
  - `genie-react doctor` on those projects checks that one client recipe is complete, that each file that imports `genie-react/hook` imports it before `react` and `react-dom`, and that a script tag loads the client from the port the hub uses. A hub that is not running is now a warning instead of a failed critical check. `doctor --live` adds a `genie-react/hook loaded before React` check from the running React collector on every setup. It fails when render collection is unavailable and warns when collection is degraded.
  - The app tools guide in the agent skill and in the docs has a Redux recipe. A development-only recorder middleware feeds `app_redux_actions`, which shows each action as dispatched, its arguments and the slices whose reference changed. `app_redux_state` reads the store as of the last recorded action. The recipe states what this cannot prove: an empty `changedSlices` shows that no subscriber re-rendered, not that a reducer mutated state.

- 12b5d76: Add `genie-react verify` to check a fix with a verdict instead of reading evidence by hand. Declare claims, drive the interaction with your UI driver, and end the window:

  ```bash
  npx genie-react verify begin --session my-agent --name "type in filter" \
    --claim 'render StatusBadge max 0' --claim 'render SearchScreen min 1' --claim 'boundaries clean'
  npx genie-react verify end <id> --session my-agent
  ```

  Claims cover render counts (`render <Name> max|min <N>`, with `counting updates`), renders only for named causes (`render <Name> only props.items,state[0]`), effect runs (`effect <Name>[#index] max <N>`), effects that stop running (`effect <Name> settles`), and error boundaries (`boundaries clean`, `boundaries clean-at-end`). `end` waits for React, Query and Router to settle with recording still on, keeps recording for a short tail, freezes, and decides each claim as `pass`, `fail`, `refused` or `inconclusive`. A failed claim decides the run.

  - The exit code carries the verdict: 0 pass, 1 fail, 4 refused, 5 inconclusive. Usage errors exit 2, a refused hub connection 3, an unreachable hub or app 69, a timeout 124.
  - `verify` works under `next dev`, where Next.js renders its dev overlay with its own production copy of React. Only the renderers hosting a claim's targets decide the environment: a production renderer that hosts a target still refuses with `unsupported_environment`, and one that commits during the window makes coverage incomplete, so upper bounds and `boundaries clean` refuse.
  - A run never passes on evidence that cannot prove it. An upper bound passes only on exact, complete counts. Each refusal names one reason and the command that fixes it: a budget that skipped the target, evicted events, an inferred cause, a target that was renamed, ambiguous, hidden or frozen, a window with no React commit, a reload, a Fast Refresh, a hidden tab, an active override, or work still arriving after the app settled. A key change that turns updates into mounts fails a `counting updates` claim, and a StrictMode replay alone is `inconclusive`.
  - While a window records, the hub refuses `react_clear_renders`, `react_profile_start`, `react_profile_stop`, `devtools_interaction_begin` and the override tools on that tab with `hubCode: "VERIFICATION_ACTIVE"`. `verify abort <id>` releases it, and the hub expires an unfinished window after five minutes.
  - Each verdict reports the attempt number and earlier verdicts for the same claims on the same tab, and says on its first line when a pass follows failures on the same code. The history lives in hub memory and resets when the hub restarts.
  - `verify show <id> --claim N` prints every deciding item for a claim; `--section guards` and `--section raw:<tool>` print the guards and retained tool results. The hub answers the new `devtools_verify_begin`, `devtools_verify_end`, `devtools_verify_read` and `devtools_verify_abort` tools itself, so an app cannot forge a verdict.

  Every CLI failure now carries `exit: {code, class}`: the code from this taxonomy that its command will use once all commands adopt it. Commands other than `verify` still exit 0 or 1.

  New evidence in the app runtime, used by `verify` and available directly:

  - `react_error_state` accepts `afterDocumentCommitId` and returns `catchLog`, every catch committed since, including boundaries that have already reset or unmounted. Catches are now recorded even while profiling is paused or when the analysis budget skips the boundary. Before, `react_error_state` missed a boundary that caught after `react_profile_stop`.
  - New `browser_visibility` tool reports whether the tab is visible and how many times it was hidden. On React Native, pass `AppState` to `startGenie` or `<Genie />`.
  - `react_clear_renders` and `react_profile_start` report `strictMode`.
  - `react_profile_stop` returns `documentCommitId`, `observation` and the window's coverage as of the stop. Commits after the stop are now counted as `pausedCommits` instead of as failed analysis, and still mark later reads incomplete.
  - `query_is_fetching` lists `simulatedQueries`, and `query_notifications` reports `evictedEvents`.
  - `react_component_cohort` reports `rendererBundle`, the build of the React renderers hosting the matched instances.
  - When `react_quiesce`, `devtools_wait` with `settled`, or `verify end` times out, the result names the work that held the app, such as a Suspense boundary showing its fallback, even when the deadline cut off the last probe. Before, a cut-off probe replaced it with `Tool "react_get_renders" timed out`, and `verify` said only `(timeout)`. Settle domains also name fetching queries and an unsettled router.

### Patch Changes

- 4f2dff5: A window now records `setState` and `forceUpdate` calls on a class component that rendered only before the window opened. Since analysis became observed-only, such a class was never instrumented, so its first updates in a window went unrecorded and a check for an unwanted `componentDidUpdate` reset could pass on missing evidence.
- d0ca3db: CLI commands that talk to the hub answer about 30% sooner. On Node 26, a warm `call` against a running app went from 93 to 66 ms and `status` from 88 to 61 ms; starting Node itself takes 24 ms. Output, exit codes and failure reasons are unchanged.

  - The CLI ships its call path as a few bundled files instead of loading about 80 modules on every run, and caches compiled code in the private per-user Genie directory. `NODE_COMPILE_CACHE` and `NODE_DISABLE_COMPILE_CACHE` keep their usual meaning. The first run after an install or upgrade compiles and fills the cache.
  - `status`, `call`, `batch` and `capture export` ask the hub to leave the tool catalog out of its greeting; with 71 tools that greeting was 308 KB. `tools` still receives it.
  - `call` and `batch` skip the readiness round trip when the hub's greeting already reports the app ready, and `tools` skips it when the greeting already carries the catalog.
  - Hub discovery from a workspace root walks the tree synchronously instead of one awaited directory at a time; from this repository's root it went from 18–45 ms to 11–15 ms on a busy machine.
  - `init` writes skill commands that call the installed binary directly, such as `node_modules/.bin/genie-react`, or `../../node_modules/.bin/genie-react` when a workspace hoists it, because `npx`, `pnpm exec` and `yarn` add 75 to 350 ms to every call an agent makes. Before the CLI is installed, on Windows, and with Yarn Plug'n'Play, the skill keeps the package manager's exec command. Rerun `init` after upgrading to refresh the skill. The skill also says when to group reads into one `batch`.

- 3af0ccc: `init` on a bundler other than Vite or Next.js now links to the setup section of the new install page, `https://genie-react.com/docs/getting-started/install#other-bundlers`. The old docs URLs redirect there too.
- 1430a11: `init` on a plain React + Vite app no longer reports `<Genie />` as required. `genie()` connects the app on its own, so the receipt sets `userActionRequired: false` and lists `<Genie />` under the new `data.optionalSteps`, for the Query, Router, memory and timeline tools it adds. When the entry `index.html` loads, or `src/App.tsx`/`src/App.jsx`, already renders `<Genie />`, the `root_route` artifact is `already` and the step is left out.
- c80b907: Fix the defects the cross-app test matrix found: integrations that silently lost tools or broke the page, Genie code in production output, console noise in the app, and contracts that promised fields results did not carry.

  - **Router tools work under TanStack Start.** Start serves `@tanstack/react-router` unbundled, but the Vite plugin pre-bundled a second copy for `<Genie />`, whose router context was empty, so the router tools never appeared and nothing said why. The plugin now leaves any TanStack package the environment excludes from pre-bundling alone. `<Genie />` also falls back to the router TanStack Router publishes on the page, so a second module instance from any other bundler setup still yields router tools.
  - **Apps without TanStack Router render in linked and workspace installs.** The Vite plugin decided whether the app has `@tanstack/react-router` from genie-react's own directory, which in a `genie link` checkout, a workspace or a pnpm monorepo can see a copy the app never installed. The page could then fail with `use-sync-external-store/shim/with-selector.js does not provide an export named useSyncExternalStoreWithSelector` and render nothing. Whether it happened depended on how Vite was started: pnpm's bin shims set `NODE_PATH` to pnpm's hidden hoist directory, which hid the problem under `pnpm dev` and exposed it when Vite was started directly. The plugin now asks only the app's own `node_modules`, the way Vite resolves.
  - **`status` says when React mounted nothing.** A tab whose page failed before React mounted used to report `ready: true` with no hint, and every React tool returned an empty app. `status` now carries a warning naming the session, and the app info includes `reactMounted`.
  - **No Genie code in a Next.js production build.** `next build` copied the whole browser client into `.next/static/media` as a public file, and the server output carried the hub, `ws` and Zod behind the `NODE_ENV` guard. `genie-react/next` and `genie-react/script` now resolve to empty stand-ins under the `production` export condition, and the hub no longer references its client in a form bundlers copy as an asset.
  - **Source lookups stay out of the app's console.** Under Next.js, source resolution called `fetch()` on `about://React/Server/file:///…` and `file:///…` URLs, which the browser refuses, and every refusal was a console error in the developer's app: hundreds per session. Genie now requests only URLs the page can load. A server-component frame maps to its original file through the source-map endpoint the Next.js dev server already serves; elsewhere it keeps its served position in the compiled server file, labelled `served`, without a request.
  - **`router_get_state` always reports `isTransitioning`.** Current TanStack Router no longer has the field, so it was missing from every result. It is now true while a navigation has started and not finished committing (status pending, or a location that differs from `resolvedPathname`) on every supported router version.
  - **Output contracts match results.** Required fields that could be `undefined` disappeared from JSON results. `router_match_route` `params` and `mutation_get` `mutationKey` are now `null` when there is no value. App values that can be `undefined` (render-cause `before` and `after`, props, context values, query and mutation data and variables, loader data, plugin payloads) are declared optional and omitted when undefined.
  - **Input schemas say what a tool needs.** `react_find_components`, `query_get`, `query_get_data`, `query_simulate_state`, `query_restore_state` and `stylex_inspect` need one of several arguments, and their `inputJsonSchema` now lists the alternatives with `anyOf`. `stylex_inspect` without a `selector` or `id` now fails with `invalid_args` instead of a tool error.
  - **Stopping a dev server removes its discovery and agent-token files.** Stopping `vite dev` or `next dev` with Ctrl-C or SIGTERM left `.genie/bridge.json` and the agent-token file behind. Every hub Genie starts now removes both on exit and on a terminating signal. A signal nothing else handles is raised again after cleanup, so the process still ends as before. A file left by a crash is still replaced on the next start.
  - **A call during a reload waits for the tab's tools.** A reloaded tab says hello before its app collectors register again, so a call landing right after a file edit failed with `unknown_tool`. The hub now holds a call for a tool the tab's previous document advertised until the new document registers it, within the reload grace. If it never does, the call fails with `not_connected` and says the tab reloaded.

- e5223ba: `init` keeps a one-line `<body>` on one line in a Next.js root layout. The `create-next-app` layout `<body>{children}</body>` became `<body>` followed by `<GenieScript />{children}</body>` on the next line; it is now `<body><GenieScript />{children}</body>`. A body whose content starts on the next line still gets `<GenieScript />` on its own line.
- 594b407: Fix override resets that skipped mounted components, and capture comparisons that refused a verdict on realistic apps.

  - **`react_reset_overrides` restores every override still on screen.** After any commit that re-rendered the app above an overridden component without re-rendering the component itself, Genie judged it unmounted. Reset then reported `skipped-unmounted` and left the override in place, and `react_list_overrides` showed it as `mounted: false` with no `componentId`. A component now counts as mounted until React removes it, so reset restores it and the list agrees. Only a component that really unmounted is reported as `skipped-unmounted`.
  - **Comparisons judge only what affects the compared metric.** `devtools_capture_compare` used to answer `not-comparable` for every render metric when a few components had unknown ownership (`app-source-classification-incomplete`), or when the Next.js dev overlay's own production React committed (`fiber-analysis-failed`).
    - Unknown ownership no longer blocks `react.commits`. It no longer blocks the component totals either, as long as every capture in both cohorts names the same unknown components. If they differ, the comparison refuses with `unknown-ownership-differs-between-captures`.
    - Commits by a React renderer Genie does not analyze no longer block render metrics when that renderer hosts none of the counted components. `verify` uses the same rule.
    - Any other analysis failure, or a page with no development renderer, still refuses a verdict. `warnings` name the unknown components and the captures with such commits.
  - **`react_get_renders` names unknown-ownership components.** `sourceClassification.unknownComponents` lists them as `Name (file that renders it)`, sorted and capped at 50. `unknownComponentsOmitted` counts any that did not fit.

- 5e97514: Render coverage no longer says complete while `appOnly` is still sorting app components from library ones, and a class state change now says where `setState` was called.

  - On a 500-row table (5,501 components), `react_get_renders` reported `sourceClassification.complete: false` with 120 of 5,501 components evaluated, while its `coverage` said `complete: true` and `semantics: "exact"`. `appOnly:true` keeps components whose ownership is unresolved, and any of them may be library code it would hide once resolved, so the rows and counts were not final. Coverage is now incomplete with `semantics: "unknown"` and an `incompleteBecause` entry `source-classification-incomplete` that counts the unresolved components. `react_render_causes`, `react_renders_since`, `react_profile_report`, `react_profile_snapshot` and `react_renders_diff` follow the same rule, and `react_render_causes` now reports `sourceClassification` for its events. `react_profile_report`, the snapshot and the diff used to call that case `lower-bound`, which wrongly said the counts could only grow; they also no longer mark input attribution incomplete for it. React 19 records owner stacks for only 10,000 elements a second, so on a large tree some components never get a source and their ownership stays unknown. Pass `appOnly:false` for counts that do not depend on ownership.
  - `sourceClassification.affects`, and `affects` on `react_component_cohort`'s `ownershipCoverage`, say what unresolved ownership changes: `result` under `appOnly:true`, or `ownership-labels` under `appOnly:false`, where only the `sourceOwnership` labels are unknown and coverage can still be exact. The `appOnly` descriptions of `react_get_renders` and `react_renders_since` used to say that unresolved components were excluded. They are kept, and the descriptions now say so.
  - `verify` could pass an upper-bound claim on a page it had read only partly. When more than 5,000 instances of the target rendered, `react_get_renders` returned one page without a cursor, and `verify` treated the rows past that page as absent. `render Cell max 5000` passed while 5,100 `Cell`s rendered. It now refuses with `evidence_truncated`.
  - A class state cause such as `this.state.draft`, or a `forceUpdate` render, now carries `classUpdates`: each `setState` or `forceUpdate` call that render applied, with the `fields` passed, the `caller` frame (source-mapped when the module has a map) and the `phase` it ran in. `phase: "lifecycle"` with `exact` evidence names the method, such as `componentDidUpdate`, and the class it belongs to, which can be another component that updated this one through a ref. `event` (a DOM event was being dispatched) and `react-work` (an effect or ref callback inside React's commit) are inferred. `callback` (a timer, promise or subscription callback) is unknown, so read `caller`. A call joins a render only when three things hold: it was made against the state that render started from, it was not made while that render's commit ran (as `componentDidUpdate`, a layout effect or a ref callback are), and React no longer holds its update. A call from `componentDidUpdate` is therefore credited to the next render, not the one that ran the lifecycle. An update that `shouldComponentUpdate` absorbed, or that a transition left pending, is never credited to an unrelated render. The summary view shows each call compactly with an `at` location. Recording happens only in development builds while an observation window is open. Genie wraps, once per prototype, the lifecycle methods each class defines and the `setState` and `forceUpdate` it inherits. `render` is not wrapped, so the owner stacks React records for elements are unchanged. Each wrapped method keeps its name, length and flags. Arguments, return values, thrown errors and callback order are unchanged, and `react_error_state` leaves the wrapper's frame out of `stackFrames`. A caller served from another origin, such as Genie's client on a standalone hub, keeps its served position: fetching its source map would put a CORS error in the app's console. Calls made before Genie first saw a class are not recorded.

- 1d9d087: The agent skill is rewritten around one loop: connect, reproduce and explain, fix, then `verify`. It is a third shorter, leads with `verify` and the states an agent can force directly (`query_simulate_state`, `react_toggle_suspense_fallback`, `react_force_error_boundary`, overrides), and states how Genie pairs with agent-browser and agent-device. `EVIDENCE.md`, read only when interpreting results outside `verify`, is half its former size and grouped by renders, effects and data, before-and-after comparisons, and output recovery. Run `genie-react init` to refresh an installed skill.
- c540922: Every oversized result now keeps its own file. Two results one CLI process spilled in the same millisecond, such as several oversized records in one `batch`, shared a file name, so the second lost its `outputPath`.
- 7934243: Suspense, hydration, error, request and Query evidence now matches what realistic Next.js, Vite and React 18 apps actually do.

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

- 604c76f: A call refused because a `verify` window is recording on the tab now fails with reason `conflict` and `hubCode: "VERIFICATION_ACTIVE"` instead of `invalid_args`, because the arguments were fine. This covers `react_clear_renders`, `react_profile_start`, `react_profile_stop`, `devtools_interaction_begin`, the override tools, and a second `verify begin` on the same tab. `next` still ends the blocking verification, and the exit code is now 1 (`failure`) instead of 2 (`usage`). The CLI still reads the old `invalid_args` form from a hub on an earlier 1.0 patch.
- 604c76f: `verify` prints state causes the way a claim names them. A claim such as `render App only state[0]` used to print back as `state.state[0]`, and the observed causes read `state.state[0]` or `state.this.state.count`; both now read `state[0]` and `this.state.count`. Claims also accept `hook[<n>]` and `this.state.<field>` without a `state.` prefix, so every printed claim re-parses.
- 2b8a1d8: Genie runs on zod 4.6.7, and `defineCollectorTool` keeps type-checking when your app uses a different zod 4 release.

  - genie-react now depends on `zod@^4.6.7` instead of `^4.4.3`. Your app can stay on any zod version. The browser runtime bundles its own zod, so an app on zod 3 or on another zod 4 release does not change how Genie validates or advertises tools. App tools (`defineGenieTool`, `useGenieTool`) and collector tools (`defineCollectorTool`) accept schemas from any zod 4 release from 4.0.0 on, and `tsc` types handler arguments and results from them. The Vite plugin, the hub and the type declarations use the zod your package manager installs for genie-react, so the range starts at the release Genie is tested on, and CI installs that lowest release.
  - `defineCollectorTool`, exported from `genie-react/client`, no longer runs TypeScript out of memory when a collector's schemas come from a different copy of zod than genie-react's, for example zod 4.6.5 in the app against 4.6.7 in Genie. Like `defineGenieTool`, it only requires a schema's output type (`GenieToolSchema`). It throws an error that names the tool when the contract's `input` or `output` is not a Zod 4 schema. It now returns the type-erased tool that a collector's `tools` list holds, instead of returning its argument unchanged. `AgentToolContract`, `defineAgentToolContract`, `ToolInput` and `ToolOutput` in `genie-react/protocol` accept schemas from any zod 4 copy, and `GenieToolSchema` is exported there too.
  - Advertised JSON Schemas changed in three ways. Each change describes the values Genie already accepted or returned:
    - A union of plain types is written as a list of types, so `{"anyOf":[{"type":"number"},{"type":"null"}]}` becomes `{"type":["number","null"]}`. This affects many output fields and the `path` and `where.equals` inputs of `query_get`, `query_get_data`, `react_inspect_component` and `react_override_hook_state`. The CLI's `tools` output prints both forms the same way.
    - The patterns of capture, interaction and verification timestamps (`createdAt`, `capturedAt`, `startedAt`, `stoppedAt`) require seconds. Every timestamp Genie writes includes seconds.
    - `observedDomains` and `unobservedDomains` in `react_effect_events` and `react_effect_timeline` declare their fixed length with `minItems`, `maxItems` and `items: false`.
  - When an array argument is longer than its limit, the call now fails with a single issue such as `/domains: Too big: expected array to have <=5 items`. Before, the error listed up to three problems with the array's elements and left out the limit that was broken. Every other `invalid_args` message, `requiredKeys`, `exampleArgs` and `didYouMean` hint is unchanged.
  - Checking a large result against its output schema in development builds is faster. A 178 KB `react_get_tree` result takes 0.16 ms instead of 0.37 ms.

- Updated dependencies [4940ab6]
- Updated dependencies [c063095]
- Updated dependencies [4f2dff5]
- Updated dependencies [d0ca3db]
- Updated dependencies [d49cc94]
- Updated dependencies [8142bdb]
- Updated dependencies [3ff8f6e]
- Updated dependencies [b8291df]
- Updated dependencies [c20c9f8]
- Updated dependencies [c80b907]
- Updated dependencies [4430162]
- Updated dependencies [d6529b7]
- Updated dependencies [594b407]
- Updated dependencies [93c3c13]
- Updated dependencies [86b3ea7]
- Updated dependencies [a5903cb]
- Updated dependencies [1288785]
- Updated dependencies [e34b498]
- Updated dependencies [5e97514]
- Updated dependencies [6582478]
- Updated dependencies [810fe22]
- Updated dependencies [0a7eb57]
- Updated dependencies [6a6b204]
- Updated dependencies [1b564e6]
- Updated dependencies [7934243]
- Updated dependencies [604c76f]
- Updated dependencies [604c76f]
- Updated dependencies [604c76f]
- Updated dependencies [e5223ba]
- Updated dependencies [12b5d76]
- Updated dependencies [604c76f]
- Updated dependencies [2b8a1d8]
  - genie-react@1.0.0

## 0.19.0

### Minor Changes

- 7b53af8: The adaptive render budget now fits the app's tree. `react_clear_renders` counts the components already mounted and starts the window with a `fiberLimit` that covers them, scaling `operationLimit` and `timeLimitMs` by the same factor, up to the maxima. A commit that renders more components than the limit also grows the budget, and decay never drops it below the largest tree the window has seen. On a 900-component tree the default budget went from `fiberLimit` 250 to 1000, and a full re-render is complete instead of skipping 652 components. When a limit still skips work, `react_render_causes` and `react_get_renders` report `coverage.budgetAdvice`: the `exhaustedLimits` and a `suggestedBudget` estimated to fit the largest lossy commit.
- 37544dc: `status --wait <ms>` waits for the `--session` target, or any app when none is given, to be ready before it reports. On timeout it fails with `not_connected`. `unknown_session` and that failure now carry `details.session.registeredTabs`, which is `0` when no browser tab has registered with the hub, so a client can tell "not ready yet" from "no browser". With no registered tab, `unknown_session` suggests `status --wait` as `next`.

### Patch Changes

- 17df0f1: `doctor` checks the agent skill in `GENIE_SKILL_DIR` when it is set, instead of `.agents/skills/genie` and `.claude/skills/genie`. An agent that loads the skill from outside the project, such as `/opt/skills/genie`, no longer gets a missing-skill warning. The directory matches when it holds the skill as shipped in `@genie-react/cli` or as `init` renders it, and a drifted copy names the bundled files to copy there.
- f5ec768: `invalid_args` failures now carry `details.didYouMean`, which maps each unknown key to the valid key it most likely meant: a near spelling (`compnent` → `component`), or the one missing required key when only one key was unknown (`react_inspect_component` with `component` → `id`). The rest of the failure JSON is unchanged.
- 0ecd0ec: The bundled skill now reports the CLI's version, so `doctor` shows `bundledSkill` 0.18.1 instead of 0.16.0. Releases stamp it from `@genie-react/cli`, and `check:release` fails when it drifts.
- Updated dependencies [7b53af8]
  - genie-react@0.19.0

## 0.18.1

### Patch Changes

- bf962d5: Find and read components when a widget bundles its own React (Clerk, for example). The app root stays primary even when a widget's root renders a bigger tree. `react_find_components` and `react_provenance` search every live root. `react_get_tree` lists the other roots in `otherRoots` so their trees can be read by `rootId`. Overriding a component rendered by a production React copy now fails with a clear error instead of crashing inside the app's renderer. bippy moves to `0.7.3-dev.2c148fc` for its unreleased bundler path and source map fixes, runtime hook hardening, and multi-root identity fixes. Tests now run on React 19.3.
- Updated dependencies [bf962d5]
  - genie-react@0.18.1

## 0.18.0

### Minor Changes

- 4af7250: `react_inspect_component` attributes each hook to the custom hooks that called it. Hooks gain `customHooks` (outermost first, e.g. `["useCart","useQuery"]`), and the result gains `customHookGrouping` (`exact`, `partial`, or `unavailable`), so agents can go from a misbehaving hook to the custom hook that owns it.

### Patch Changes

- Updated dependencies [4af7250]
  - genie-react@0.18.0

## 0.17.0

### Minor Changes

- 31b7d8a: Production builds and hub reliability.

  - **Production bundles stay clean.** `genie-react` and `genie-react/tools` resolve to a no-op module under the `production` export condition (Vite, webpack, Turbopack), the Vite plugin strips `genie-react/tools` like the root entry, and app-tool registration and the `genie-react/hook` instrumentation stay inert when `NODE_ENV` is `production`. The React Native and Next.js Query setup docs now load Genie only in development.
  - **`next dev --webpack` connects again.** The hub loads `ws` after opting out of its native addons, so webpack's `bufferutil` stub no longer crashes every socket.
  - **The hub no longer crashes** when a hub-side tool handler throws; the agent gets a `tool-error` reply instead.
  - **`devtools_wait` keeps its timeout** for every condition, fails at once when its probe tool is missing (for example `navigation` without a router), and reports `unknown-session` with the connected targets for a mistyped `--session`.
  - **Clearer interaction and capture errors.** `INTERACTION_ACTIVE` names the recording interaction in `errorDetails.interactionId`; disconnects and busy apps during an interaction or capture keep their `not-connected`/`busy` codes and retry hints.
  - **Safer multi-tab routing.** While the default tab reloads, only read-only calls run on another open tab; mutations ask for a retry. Two agents that reuse a request id no longer receive each other's results.
  - **Captures default to the domains the app advertises**, so apps without a router or Query no longer get incomplete captures with warnings.
  - **`devtools_capture_compare` is faster and says more.** The permutation test no longer blocks the dev server (755 ms → 27 ms at 10+10 captures), metrics without budgets get a headline reason (`regressed 14% (median …, p=…)`), and thin or incomparable cohorts are flagged even without budgets.
  - **`devtools_status` defaults `includeTools` to `false`**, so a bare call returns a compact status instead of the full catalog; use `genie-react tools` for discovery.
  - **Vite standalone hubs survive restarts.** With `@cloudflare/vite-plugin`, a config change no longer shuts down the hub the restarted server just adopted. Vite `middlewareMode` (custom Express/SSR servers) now warns that it cannot host the bridge instead of failing silently.

### Patch Changes

- 31b7d8a: CLI reliability and clearer failures.

  - **A missing or dead bridge fails fast and says so.** A new `bridge_unreachable` failure names the URL and how to start a bridge. It replaces the "No app is connected" and timeout reports. The default address fails at once when nothing listens there, and a hub that dies mid-call fails the call immediately instead of after 20 s. The process exits as soon as it prints.
  - **Configuration mistakes are reported as such.** A bad `--url`, `GENIE_BRIDGE_URL` or `GENIE_BRIDGE_PORT` (now validated as 1–65535), several live bridges below a workspace root, and a `doctor --select` that matches nothing now return `invalid_input` with the real message. Unknown options suggest the closest valid one.
  - **Agent sandboxes with another `TMPDIR` authenticate.** The hub records its token path in `.genie/bridge.json`, and a 401 from a guessed default port explains that another project's hub answered.
  - **One hub per project.** `genie-react hub` and `startGenieHub` reuse a live hub for the same root on any port. A hub or dev server never overwrites or deletes discovery and token files that another live process published.
  - **`tools` fails as `not_connected`** after a 3 s grace when no app session exists (`--wait` extends it) instead of listing only hub tools. `batch` waits for an app only when an item needs one, and no longer hangs on open stdin. Use `-` to read the array from stdin.
  - **More useful failure output.** Every failure carries `errorCode`. A built-in tool's own error text (for example "Enable render tracking") is shown in `details.app.message`. Retry commands keep `--session`. `hub` passes start errors through, with a `port_busy` reason.
  - **`doctor` searches upward** for the discovery file. It treats a missing agent skill as a warning, and accepts `--live --session`.
  - **Selections:** a wildcard `--select` returns values aligned with `matchedPaths`, without listing each path twice. A wildcard over an empty collection returns `[]`. `call` rejects non-object arguments.
  - **Faster startup:** `--help` and `--version` take about 35 ms instead of about 125 ms, because command modules and the protocol load on demand. A new `genie-react/hub/token` entry exposes the token helpers without the hub server.

- Updated dependencies [31b7d8a]
- Updated dependencies [31b7d8a]
- Updated dependencies [31b7d8a]
  - genie-react@0.17.0

## 0.16.0

### Patch Changes

- 3fe0b53: When no discovery file exists, fall back to the standalone hub's port 4390 unless the app has a Vite config, instead of always guessing Vite's 5173. `doctor --live` and every command now probe the right port for Next.js and React Native apps.
- Updated dependencies [3fe0b53]
  - genie-react@0.16.0

## 0.15.1

### Patch Changes

- aa17aec: Correct the bundled agent skill: say how each framework starts the hub and send agents to `doctor --live` when it is unreachable, make the app tools example self-contained and note when apps without both TanStack peers must register through `genie-react/client`, and align output, timeline, and interaction details with the CLI.
  - genie-react@0.15.1

## 0.15.0

### Minor Changes

- c941b78: Make every CLI failure actionable instead of collapsing it to fixed text. `app/response` and `bridge/result` frames gain optional `errorDetails` (argument issues with JSON Pointer paths, required keys and the schema's example call, unknown keys, a `GenieToolError`'s code, message and hint, an unavailable tool's reason, and a `hubCode` for failures the hub authors, such as `CAPTURE_NOT_RETAINED`; the hub strips a `hubCode` from app responses); older peers ignore the field and a malformed shape is dropped rather than rejecting the frame. `GenieToolError` exposes the thrown message as `detail`, and result-cap and serialization failures become `GenieToolError`s with `RESULT_TOO_LARGE` and `RESULT_NOT_SERIALIZABLE` codes.

  The CLI adds `details`, `errorCode` and `correctedExample` to failures. `message` is built only from what the caller typed (tool, session, the keys and JSON types of the arguments it sent) and fixed CLI text; everything the app or its schema reports stays in `details` as app data. `correctedExample` is a shape template: the caller's accepted arguments plus typed placeholders (`"<string>"`, `0`, `false`, `[]`, `{}`) for the other keys in the schema's example, never the app's values. A `hubCode` is honoured only for tools the hub answers itself and sets `userActionRequired: true`. Suggested tool names are labelled as app data. A missing tool is now `unknown_tool` with suggestions; an advertised but unmounted tool is `tool_unavailable` with its reason; an absent pinned session names itself and lists connected sessions in `details`; unknown `--fields` and an unmatched `--select` are named, with the available paths in `details`. `status` with no connected session adds a `hint` and `next`.

  Breaking: CLI-owned envelopes now report `schemaVersion: "2.0"`. To migrate:

  - Match `reason` in snake_case: `invalid-args` → `invalid_args`, `tool-error` → `tool_error`, `tool-unavailable` → `tool_unavailable` (or `unknown_tool` when the app advertises no such tool), `unknown-session` → `unknown_session`, `not-connected` → `not_connected`, and the diagnostic and record reasons `bridge-connect` → `bridge_connect`, `bridge-event` → `bridge_event`, `bridge-fallback` → `bridge_fallback`, `stale-discovery` → `stale_discovery`, `output-failure` → `output_failure` and `max-bytes` → `max_bytes`.
  - Read the bridge's wire code, previously in `reason`, from the new `errorCode` field.
  - Read a batch failure row's `message`; the duplicated `error` field is gone.

  See docs/json-cli.md.

- 3c28d60: Authenticate hub WebSocket connections. Any web page open in the developer's browser could previously connect to the hub as an agent and call every tool, or register a fake app session whose tool descriptions reached the coding agent.

  - Agents must present the hub's per-run token as `Authorization: Bearer <token>`, connect from the same machine (a loopback peer address), and send no browser `Origin`. The hub keeps the token out of the project in a private per-user file (`genie-react-<uid>/<sha256 of the app root's real path>.json` under `$XDG_RUNTIME_DIR` or the system temp directory, directory `0700`, file `0600`), so no dev server rooted at the project can serve it. `.genie/bridge.json` keeps only the URL, port and pid, and its URL is now the bound IP literal (`ws://127.0.0.1:<port>` for `genie-react hub`, Next.js and wildcard binds, the address Vite bound for a specific loopback bind) instead of `ws://localhost:<port>`. For a specific loopback bind, a process listening on the other loopback family's port can no longer capture the token. On macOS, a wildcard bind (`vite --host`, `0.0.0.0`) can still be shadowed by a more specific bind from another user's process.
  - The CLI pairs a discovered URL only with its own hub's token. For `--url` or `GENIE_BRIDGE_URL`, `GENIE_BRIDGE_TOKEN` wins, then the token of a discovered hub at that address. A `localhost` URL that matches a discovered hub connects to that hub's published address; otherwise the token goes only over `wss://` or to a loopback IP literal, and warns when a discovered hub published no token (an older, unauthenticated `genie-react`). A refused token now fails `call`, `batch` and `tools` at once with a fix, instead of waiting and reporting that no app is connected.
  - App connections: the Vite bridge accepts pages from the dev server's own origin (including its IP address with `vite --host`), Vite's `server.allowedHosts`, and the new `allowedOrigins` option. The standalone hub also accepts loopback pages: on the Next.js port under `registerGenie()`, on any port under `genie-react hub`. `status` reports each session's `origin` and marks sessions admitted only as loopback pages with `originUnverified`. Clients without an `Origin` (Node) must connect from the same machine.
  - The `genie()` Vite plugin adds `**/.genie/**` to `server.fs.deny` and answers `404` for any request into `.genie`, also when `server.fs.strict` is off.

  Breaking:

  - Upgrades without `?role=app` or `?role=agent` are refused with HTTP 400 instead of inferring the role from the first frame.
  - `@genie-react/cli` older than this release gets HTTP 401 from this hub. Its commands retry for 11 to 14 seconds and then report that no app is connected. Upgrade the CLI and `genie-react` together.
  - Custom agent clients must send the token from the private token file and run on the same machine as the hub.
  - Pages served from a custom hostname, a tunnel, or a loopback port other than the app's need `allowedOrigins` (`genie()`, `registerGenie()`, `startGenieHub()`, or `GENIE_ALLOWED_ORIGINS` for `genie-react hub`).
  - Discovery URLs, `startGenieHub()` results, the Cloudflare-mode client URL, `<GenieScript />` and the hub client's fallback use `127.0.0.1` (or the bound literal) instead of `localhost`. With `--url`/`GENIE_BRIDGE_URL` outside the app folder, use the IP address; the CLI no longer sends the token to a `localhost` name it cannot match to a discovered hub.
  - The agent token is no longer in `.genie/bridge.json`; tools that read it there must use `readAgentToken(rootDir)` from `genie-react/hub` or `GENIE_BRIDGE_TOKEN`.
  - The `genie()` plugin's `server.fs.deny` entry restates Vite's default deny list when the app sets none, and appends to the app's list otherwise.

- 7e0f57d: Return compact summaries by default from the heaviest tools and make oversized CLI output recoverable.

  **Breaking changes.** Pass `view:"full"` to restore the previous payloads.

  - `react_get_renders` and `react_render_causes` take `view` and default to `"summary"`. The hub's own capture and interaction calls request `view:"full"` only from apps that advertise it, so older apps keep working. A summary omits null, zero, and default fields and the legacy summary aliases (`unstableComponents`, `unnecessaryComponents`, `topUnstableProps`). Changed values are dropped, and the source fields are collapsed into one `source: {location, ownership}`. A summary component record is usually under 500 bytes.
  - `devtools_capture_create` returns the `devtools_capture_read` summary and warnings by default. Capture summaries add `renders` (render `comparable`, `notComparableReasons`, and coverage `complete`/`semantics`), and a capture is `complete` only when that render evidence is comparable with complete coverage.
  - `devtools_interaction_stop` returns the following by default:
    - the settle outcome and coverage
    - render `semantics` and the top components, each with input evidence, non-zero memo counters, and its most frequent cause kind (ties listed, latest-render details labelled as such)
    - the hottest effects
    - the cohort results
    - a `fullView` handle

    Pass `view:"full"` to get the previous payload, now tagged `view:"full"`. Add `sections` with it to fetch only `renders`, `causes`, `effects`, or `cohorts`.

  - Timeline coverage entries carry a stable `code`. The `detail` text is now returned only by `timeline_start`. The codes are documented at `/docs/tools/timeline#coverage-codes`.
  - The CLI's default `--max-bytes` drops from 262,144 to 102,400. When a `call` or `tools` result is too large, the complete JSON is saved to `genie-react-<uid>/out` under `$XDG_RUNTIME_DIR` or the OS temp dir, beside the hub's agent tokens: both directories must be owned by you and are forced to 0700, files are 0600, and only the newest 20 spill files are kept. Suggestions use the project's package-manager prefix and keep `--session` and an explicit `--max-bytes`. The truncation envelope reports the file in `outputPath`, along with `largestPaths` and runnable `suggestions`: the summary view, a fitting `limit`, a `--select` branch, or a raised `--max-bytes`.
  - `genie-react tools <name>` (and `tools --all`) replaces `outputJsonSchema` with `output: {kind:"outline", fields, next}`, a one-level outline whose `next` re-runs with `--output-schema` for the complete output JSON Schema; output schemas share repeated subschemas through `$defs`. Descriptors no longer print safe-integer `minimum`/`maximum` bounds.

- c10d8d5: Make tab sessions reliable across navigations and multiple tabs.

  - A new document generation of a tab supersedes the previous one: the old document stops receiving calls, its in-flight calls fail with `not_connected` instead of `busy`, it disappears from `status`, and its socket is closed unless it proves it is a live clone. An old document heard from within the last heartbeat keeps routing until it closes (a reload), stays silent (superseded), or beats again (a duplicated tab, which is forked). A prerendered page connects only when it activates. The browser client also releases its socket on `pagehide` and rejoins as a newer generation when restored from the back/forward cache. Previously, frozen documents kept their sockets open, so repeated navigations piled up stale sessions, forked identities and `busy` failures until the newest document became current.
  - **Behavior change:** untargeted calls no longer follow the most recently connected tab. They use the only connected tab, or keep the tab untargeted calls already used, including across its reloads. While that tab reloads, a tab that connects meanwhile (a React Native app after a Metro reload, a fresh tab) becomes the default at once, and a single other open tab answers until it returns. When several tabs are connected and none was targeted yet, calls fail with `unknown_session` and list the tabs in `details.session.connected`. Pass `--session <target>` or set `GENIE_SESSION` to choose one; explicit targets behave as before.
  - `bridge/result` frames carry an additive `session` field naming the document that answered. The CLI adds it to batch rows and reports the answering tab on stderr for raw `call` output when several tabs are connected.
  - Session failures carry new hub codes (`SESSION_AMBIGUOUS`, `SESSION_RELOADING`, `SESSION_SUPERSEDED`, `SESSION_DISCONNECTED`) and `mayHaveCompleted` for an interrupted call that is not read-only. The CLI honours them only on the `not-connected` and `unknown-session` wire codes the hub alone sends, and turns them into retry guidance instead of "No app is connected", reports a session name shared by several tabs as ambiguous with the matching tabs, fails `tools` at once when the default is ambiguous, and writes a `session-retargeted` stderr diagnostic when another tab answers for a gone default.
  - `devtools_interaction_stop`, `react_quiesce` and waits now poll one resolved document, report the document that answered, and say the document disconnected instead of naming a missing tool when it reloads during settle.

### Patch Changes

- e6f6bfd: Tighten the bundled agent skill. Step 1 opens the app with agent-browser or agent-device before checking status, every command passes `--session <name>` instead of exporting `GENIE_SESSION`, and evidence, comparison, and output semantics move to an on-demand `EVIDENCE.md` reference. The repository's `skills/genie` copy is now generated from the bundled skill, and lint fails when they differ.

  Tool detail guidance now matches the live contract: `tools <name>` returns `inputJsonSchema` without an example, and an absent `available`, `destructiveHint`, or `idempotentHint` is read as the default. Step 1 retries an unavailable session once right after opening the page.

- f37d8bf: Attribute render causes to individual props again. Plain-object props containers are diffed by own enumerable keys without running getters, and plain-object prop values are compared one level deep, so a `memo` child that receives a fresh but equal `{...}` literal reports a reference-only prop change. Class-instance and other exotic props containers stay unread and still report `propsNotEnumerated`. Objects with symbol keys and React elements passed as props are never called reference-only, and a prop that only appears or disappears now reports an `added` or `removed` change.

  Prop changes are the render cause only for components that can skip a render on equal props: `memo` components and classes that extend `PureComponent` or define `shouldComponentUpdate`. Other components list their own state, context, store, or `children` changes first, otherwise `parent`, followed by changed props as observed inputs, and reference-only prop changes never mark a render `necessary`. `referenceOnlyPropRenders` now counts only those components and excludes truncated diffs and partial scans. Two new per-component counts cover the rest: `functionIdentityPropRenders` (every changed prop was reference-only or a function, and at least one function changed identity, usually an inline callback) and `undeterminedReferencePropRenders` (a partial scan or truncated diff could not classify the change). A custom `shouldComponentUpdate` is never called, so such classes are counted as if they compared props shallowly.

  In development, Genie's hook now wraps the global `Proxy` constructor and `Proxy.revocable` to record every proxy created after it loads, and never reads the keys of a recorded proxy in props or prop values. The wrapper keeps the constructor's name, length, missing prototype, and errors, installs once per page, and never installs in production builds. In development, `Function.prototype.toString.call(Proxy)` returns `function () { [native code] }` without the name, so checks for `[native code]` still pass. A Proxy created before Genie's hook loaded cannot be detected and is still enumerated.

  Render-input attribution now draws on its own per-commit and per-component budget. A wide commit that exhausts it reports truncated input coverage instead of skipping render recording.

  `react.unnecessary` and the `unnecessary` counts rise after upgrading. Fresh props containers with no changed keys used to report `propsNotEnumerated`, which hid those renders; they are now computable.

  `devtools_capture_compare` no longer refuses `react.commits`, `react.renders`, `react.updates`, or `react.selfTimeMs` when only render-cause attribution is incomplete. `react.unnecessary` is still gated on it. Each metric now adds `excludedCaptureIds`, which maps every post-warm-up capture that contributed no sample to the reasons it was dropped. `missingBaselineCaptureIds` and `missingCandidateCaptureIds` keep their existing shape.

- e6f6bfd: `init` and `link` now install the agent skill where each agent looks for it. `.agents/skills/genie` stays the canonical copy for Codex, Cursor, and other Agent Skills clients, and `.claude/skills/genie` links to it for Claude Code, falling back to a copy where symlinks are unavailable. `init` writes only into an empty directory or one holding Genie's skill, never follows a symlink out of the project, and replaces files through a temporary file and rename. Any other file, directory, or symlink, including a dangling one, is left untouched and reported as a manual step with `reason: "skill_path_conflict"`. Its `path` names the blocking entry, such as a `.agents` file or a `.claude` symlink out of the project, rather than the skill directory behind it. `doctor` checks both locations, reports drift or the blocking `conflictPath` for each in `skill.locations`, and says to remove or replace that file, directory, or symlink instead of rerunning `init`.

  The installed skill's commands, doctor remediation, the init receipt's `next`, and every command a CLI failure suggests in `next` or `message` now share one prefix from the detected package manager: `npx`, `pnpm exec`, `yarn` for Yarn 2+, `yarn --silent` for Yarn 1 so stdout stays pure JSON, or `bunx`. Projects without a lockfile now get npm commands, including install and dev hints that previously defaulted to pnpm.

- fcc8f06: Refresh the bundled agent skill for JSON output, live schema discovery, bounded measurements, and verified app tool error handling.
- Updated dependencies [c941b78]
- Updated dependencies [3c28d60]
- Updated dependencies [f37d8bf]
- Updated dependencies [7e0f57d]
- Updated dependencies [c10d8d5]
- Updated dependencies [fb6f28c]
  - genie-react@0.15.0

## 0.14.0

### Minor Changes

- ef1c58a: Migrate the CLI to JSON output by default, including help, version, setup receipts and failures. Preserve existing tool JSON schemas and --json compatibility, document JSONL batch/fields/hub streams, and bound output with explicit truncation. Diagnostics are JSONL on stderr. Consumers parsing previous human output must migrate to the structured fields; see docs/json-cli.md.
- bc8665f: Add `stylex_inspect`: for apps styled with StyleX in dev mode (`debug: true`), report the applied `stylex.create()` objects by name and source file:line in override order, the CSS each atomic class resolves to (with pseudo/media conditions), `defineVars` tokens with current values, and dynamic style values — by CSS selector or component id. `react_dom_for_component` and `react_component_for_dom` gain a `styleSources` breadcrumb, and DOM selectors skip compiler-generated class names.

### Patch Changes

- Updated dependencies [62472b1]
- Updated dependencies [bc8665f]
- Updated dependencies [16411a2]
  - genie-react@0.14.0

## 0.13.0

### Minor Changes

- 9335523: Add react_quiesce to wait for an observed React commit idle interval with elapsed time, commit count and explicit timeout/unavailable outcomes. Honor deadlines across transport and preserve same-document catalog refreshes.

### Patch Changes

- d2d401d: Report React Offscreen visibility separately from component lifecycle in cohorts, preserving hidden mounted instances and distinguishing unmounted tombstones. Add native freeze/hide/thaw controls for live verification.
- b4c90ee: Filter render reports by name globs, exclusions, and minimum updates before source classification and limits. Add bounded, expiring cursors over frozen reports so subsequent pages retain the same counters and ownership coverage while new commits arrive, and show a safe CLI continuation command.
- 81c60b9: Complete React selector and ownership-filter coverage, retain unmounted cohort source evidence, disclose incomplete profile populations, and advertise valid schema-derived calls and argument bounds.
- aa3741c: Report renderer bundle metadata and timing/count interpretation in render and profiling reports, including human CLI output.
- 31bca4a: Support sorting render reports by updates and expose parameter bounds and defaults in compact tool catalogs. Clarify name filters versus instance IDs.
- Updated dependencies [e33e61a]
- Updated dependencies [d2d401d]
- Updated dependencies [0234ee1]
- Updated dependencies [085fd76]
- Updated dependencies [1026cf1]
- Updated dependencies [125f9c7]
- Updated dependencies [b4c90ee]
- Updated dependencies [b2338b8]
- Updated dependencies [0c9a05b]
- Updated dependencies [9335523]
- Updated dependencies [81c60b9]
- Updated dependencies [aa3741c]
- Updated dependencies [31bca4a]
- Updated dependencies [ee4172d]
- Updated dependencies [c998f34]
- Updated dependencies [632c1ec]
  - genie-react@0.13.0

## 0.12.6

### Patch Changes

- Updated dependencies [5a13ea8]
  - genie-react@0.12.6

## 0.12.5

### Patch Changes

- 1b9106e: Fix React Native (Hermes) support and misleading zero-render reports (#69): fall back to a Map/Set/Date-aware clone where `structuredClone` is missing so importing `genie-react/native` no longer throws on Hermes; add `default` export conditions so Metro can resolve `genie-react/hook` and every other subpath; report `renderCollection` availability in `react_get_renders` so a hook installed after React is distinguishable from "nothing re-rendered"; schedule an explicit re-render after `react_override_hook_state` and report `commitObserved` with a warning when no commit followed; make `.genie/` self-gitignoring; and echo the required keys plus a minimal valid invocation in `invalid-args` tool errors.
- Updated dependencies [1b9106e]
  - genie-react@0.12.5

## 0.12.4

### Patch Changes

- 25fd8d7: Update the bundled agent skill for Genie 0.12.3, teach agents to discover and safely call app-registered custom DevTools, and install a companion reference for defining them.
  - genie-react@0.12.4

## 0.12.3

### Patch Changes

- f07d02e: Classify disabled and never-fetched Query cache entries explicitly, and require measured turnover or unobserved fetching before reporting churn.
- Updated dependencies [c8f74c7]
- Updated dependencies [f07d02e]
- Updated dependencies [57b600f]
- Updated dependencies [48ccdc9]
  - genie-react@0.12.3

## 0.12.2

### Patch Changes

- 6b5bb60: Allow callers to request render observation budgets large enough for large React Native screens. Defaults remain 250 fibers / 20,000 operations / 8ms, and adaptive growth applies only to later commits after exhaustion, so discard an incomplete one-action observation and rerun it with an explicit larger budget. The target deadline now extends one normalized reserve duration beyond the normalized general deadline, explicitly requested budgets are not clamped down to adaptive ceilings, and the opt-in ceilings rise to 20,000 fibers / 2,000,000 operations / 500ms (250ms target reserve).
- Updated dependencies [b192452]
- Updated dependencies [c74cef9]
- Updated dependencies [6b5bb60]
  - genie-react@0.12.2

## 0.12.1

### Patch Changes

- d6d12c3: Restore Genie profiling and WebSocket reconnection after React Native reloads without requiring an app relaunch.
- Updated dependencies [d6d12c3]
  - genie-react@0.12.1

## 0.12.0

### Minor Changes

- cb8fc5b: Apps can expose their own agent tools. `useGenieTool` / `defineGenieTool` / `registerGenieTools` register custom actions and queries under the `app` group (optional `group` subgroups as `app.<name>`), with zod-validated args, read-only/action/destructive badges, a `tool-unavailable` error code with recovery hints when the registering component is unmounted, and a per-tool result-size cap. The CLI renders badges and availability in `tools` listings, and a group-family selector (`tools app`, `tools react`) covers subgroups.

### Patch Changes

- Updated dependencies [cb8fc5b]
  - genie-react@0.12.0

## 0.11.0

### Patch Changes

- Updated dependencies [0a697d7]
  - genie-react@0.11.0

## 0.10.1

### Patch Changes

- Updated dependencies [276d8ec]
  - genie-react@0.10.1

## 0.10.0

### Minor Changes

- 6f4f7ed: Make agent diagnostics decision-safe with explicit provenance and coverage, noise-aware comparisons, effect and store notification attribution, atomic interaction captures, bounded output, collision-safe sessions, live health checks, and a versioned bundled skill.

### Patch Changes

- Updated dependencies [6f4f7ed]
  - genie-react@0.10.0

## 0.9.0

### Minor Changes

- a6ddbd3: Add stable React observation and instance IDs, lifecycle cohorts, exact Query and external-store evidence, bounded array and known-store paths, effect schedule events, source provenance, and conservative agent-first CLI guidance. Arbitrary props and object fields stay opaque.

### Patch Changes

- Updated dependencies [a6ddbd3]
  - genie-react@0.9.0

## 0.8.0

### Minor Changes

- a26309e: Make CLI and session targeting agent-safe with workspace bridge discovery, persistent tab aliases, bounded startup diagnostics, versioned machine envelopes, exact Query waits, targeted React subtrees, atomic Router/browser snapshots, and explicit package-filter accounting.

### Patch Changes

- Updated dependencies [a26309e]
  - genie-react@0.8.0

## 0.7.0

### Minor Changes

- 00a8dae: Add durable session targeting, effect ownership and hotness, causal render events, named runtime captures, and repeated capture comparisons with typed budgets.

### Patch Changes

- Updated dependencies [00a8dae]
  - genie-react@0.7.0

## 0.6.1

### Patch Changes

- 156b50c: Add concise package READMEs, clearer npm descriptions, and focused search keywords.
- Updated dependencies [156b50c]
  - genie-react@0.6.1

## 0.6.0

### Minor Changes

- 006dc90: Harden agent-facing CLI contracts with stdout-clean structured failures, strict option and field validation, safe bridge URLs, bounded error copy, and consistent completion output.

### Patch Changes

- Updated dependencies [006dc90]
- Updated dependencies [006dc90]
  - genie-react@0.6.0

## 0.5.2

### Patch Changes

- f205bb8: Pack releases with pnpm before publishing through npm so internal workspace dependencies resolve to installable versions.
- Updated dependencies [f205bb8]
  - genie-react@0.5.2

## 0.5.1

### Patch Changes

- 32edfea: Pack releases with pnpm before publishing through npm so internal workspace dependencies resolve to installable versions.
- Updated dependencies [32edfea]
  - genie-react@0.5.1

## 0.5.0

### Minor Changes

- 3413d52: Make render causes actionable: `react_get_renders` now identifies each changed `useState`/`useReducer` slot, its flat and stateful hook positions, and bounded before/after values. Class state is reported separately, non-state hook internals are excluded, and the CLI prints compact value diffs while remaining compatible with older generic state markers.

### Patch Changes

- Updated dependencies [3413d52]
- Updated dependencies [922b635]
  - genie-react@0.5.0

## 0.4.0

### Minor Changes

- 8d4d7bf: Better agent experience: typed errors with retry hints, fast busy detection, hook kinds and overrides by stateful index, override list/reset, render snapshot/diff, CLI `batch` / `--fields` / `--timeout`, and one bin name: `genie-react`.

### Patch Changes

- Updated dependencies [8d4d7bf]
- Updated dependencies [8c945ed]
- Updated dependencies [5314fbf]
  - genie-react@0.4.0

## 0.3.0

### Minor Changes

- fc7eb33: New `browser_fps` tool (perf collector): sample the page frame rate on demand via requestAnimationFrame — avg fps, frames dropped against the estimated display refresh rate (fair on 120Hz panels), long frames (>50ms), the single worst stall, and a smooth/degraded/janky verdict using react-scan's thresholds as refresh-rate ratios plus its 150ms hard-stall rule. Registered by `<Genie />` and the script-tag client; the CLI prints a one-line summary. Also bumps bippy to ^0.5.43 (a republish of 0.5.42 — no API changes).

### Patch Changes

- Updated dependencies [fc7eb33]
  - genie-react@0.3.0

## 0.2.2

### Patch Changes

- Updated dependencies [9379751]
  - genie-react@0.2.2

## 0.2.1

### Patch Changes

- c0c0025: Coexist with `@cloudflare/vite-plugin` (Start-on-Cloudflare apps like tanstack.com): its workerd dev proxy owns the dev port's WebSocket upgrades and drops genie's socket within milliseconds (close 1006, permanent reconnect flap). The `genie()` plugin now detects the Cloudflare plugin in the resolved config and reroutes transport automatically — it starts a standalone hub on its own port, points the injected client's WebSocket at it, writes discovery for the CLI accordingly, and shuts the hub down with the dev server (a killed server heals via the existing stale-pid cleanup). No wiring changes: `genie()` + `<Genie />` stay as-is, and existing setups fix themselves on upgrade. `init` prints a note when it sees the Cloudflare plugin in dependencies.
- c0c0025: Harden the attach paths against real-world hosts, from OSS-app field testing (Excalidraw, tanstack.com, Cal.com/react.dev):

  - Vite plugin excludes `genie-react` from dependency pre-bundling so the optional-peer stubs actually apply — importing `<Genie />` no longer black-screens apps without TanStack installed — and pre-lists its nested deps so the first post-install boot connects instead of 504ing on stale optimized-dep hashes.
  - Opt out of ws's optional native addons before ws loads: a host bundler or stale prebuild that half-resolves `bufferutil` crashed the hub with `bufferUtil.unmask is not a function` on Node 22 and 500'd the host app.
  - Tool dispatch rejects unrecognized argument keys (a `maxDepth` typo for `depth` used to no-op silently), formats validation errors readably, and unknown-tool errors now list the advertised domains and explain that query/router tools are gated on a discovered QueryClient/Router.
  - CLI: when no `.genie/bridge.json` exists, say so and call the localhost default a guess instead of presenting it as fact; `doctor --live` reports "no app session connected yet" instead of a warning-glyphed success sentence; hub timeouts hint at busy main threads and `devtools_wait`.
  - `init` adds `.genie/` to `.gitignore` and prints next-steps with the repo's actual package manager instead of hardcoded pnpm.

- Updated dependencies [c0c0025]
- Updated dependencies [c0c0025]
  - genie-react@0.2.1

## 0.2.0

### Minor Changes

- ac61385: Context economy for agents: `genie tools` becomes progressive discovery (group index → `tools <group>` → `tools <tool>` with the full description and a runnable example; `--all` for the flat catalog, `--json` slim by default with full schemas per tool); ten new compact summarizers (status, find_components, component_for_dom, inspect_component, error_state, profile_report, query_list, query_get, router_get_state, router_list_matches) so hot reads stop dumping pretty JSON; `--json` output is now compact machine JSON; per-command `--help` for every subcommand.
- d4f511c: New `react_component_for_dom` tool: a CSS selector resolves to the owning React component(s) with id, props, and source file:line — the reverse of `react_dom_for_component`. `genie doctor --live` probes the running stack end to end (hub HTTP + identity, served client bundle, WS session round-trip). Stale `.genie/bridge.json` files whose pid is gone are announced and removed by both discovery and doctor. Piped `--json` output is no longer truncated at 64KB (natural exit instead of `process.exit`).
- a11e8bf: Consolidate the app-side packages into one `genie-react` package.

  `@genie-react/core`, `client`, `react-collector`, `tanstack-collector`, `devtools-plugin`, `memory`, `react`, `bridge`, and `vite` are replaced by the single `genie-react` package with subpath exports: `genie-react` (the `<Genie />` component), `genie-react/vite` (the plugin), `genie-react/client` + `genie-react/hook` (the injected client), `genie-react/hub` (the standalone bridge), and `genie-react/protocol` (wire protocol + tool contracts).

  Migration: `pnpm add -D genie-react`, then `import { Genie } from 'genie-react'` and `import { genie } from 'genie-react/vite'`. The CLI (`@genie-react/cli`) is unchanged in usage; `genie init`, `doctor`, and `link` now wire the single package.

- 5e60814: Framework-agnostic attach: Next.js support and a standalone hub for any non-Vite React app.

  The hub now serves a self-contained browser client at `GET /__genie/client.js`, so any React setup attaches with one classic script tag — no bundler integration required. New surface: `genie hub` (CLI command, default port 4390), `<GenieScript />` from `genie-react/script` (dev-only script tag for any SSR root layout, RSC-safe), and `genie-react/next` with `registerGenie()` for Next.js `instrumentation.ts`. `genie init` and `doctor` now detect Next.js apps and wire the layout + instrumentation automatically.

### Patch Changes

- 0f2f2e4: Discovery polish from the three-model economy tests: read-group listings point at their domain's mutation tools in the `action` group; small flat action results render as one line (`ok=true · pathname="/error"`) instead of pretty JSON; `router_list_routes` gets a summary; generic basenames keep a parent segment (`routes/index.tsx:106`); array-valued query data previews as `[N items]` instead of dumping; the caught-error message is recovered from the console text when React 19.2 passes no Error instance.
- 8d99b93: Five-host E2E fleet fixes: `<GenieScript />` keeps a walked hub port across Next.js recompiles (global-symbol handoff); `<Genie />` discovers the QueryClient from a plain `QueryClientProvider` and accepts explicit `queryClient`/`router` props; `plugin_emit` auto-prefixes bare event types; React 19 error-boundary console text is parsed (message + thrower no longer dropped); consumed contexts are deduped (StrictMode double-reads); `react_get_tree` defaults to `appOnly` like its siblings; meta tools appear in the advertised catalog so counts agree; `genie tools` honors `--json` and `--session`; `init`/`doctor` treat the universal hub + script-tag path as a valid setup (exit 0); hub-down CLI errors no longer assume Vite; clearer `query_fetch` and effect-audit messages.
- Updated dependencies [ac61385]
- Updated dependencies [0f2f2e4]
- Updated dependencies [8d99b93]
- Updated dependencies [d4f511c]
- Updated dependencies [a11e8bf]
- Updated dependencies [5e60814]
  - genie-react@0.2.0

## 0.1.0

### Minor Changes

- Initial public release of Genie — give an AI coding agent full DevTools access to your live React + TanStack app from your terminal via the `genie` CLI.
- a36626f: Make tool arguments discoverable and consistent for agents.

  - `genie tools` now prints each tool's parameters (name, type, and a `?` for optionals) from the input schema the app already advertises, so an agent can call a tool without guessing argument names.
  - `query_get` and `query_get_data` now accept **either** a `queryHash` or a `queryKey` — whichever you already have from `query_list` — instead of each demanding a different identifier.

### Patch Changes

- Updated dependencies
  - @genie-react/core@0.1.0
