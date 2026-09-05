# genie-react

## 0.13.0

### Minor Changes

- e33e61a: Add an opt-in development Babel plugin at genie-react/babel to name anonymous React.memo components from their lexical bindings. Preserve explicit display names and named inner functions, and omit metadata in production builds.
- 1026cf1: Add labelled render measurement handles with explicit exclusive commit ownership, independent retained counts, bounded capture and coverage. Global clears preserve spans; reads return their labels and disjoint document commit sets.
- 9335523: Add react_quiesce to wait for an observed React commit idle interval with elapsed time, commit count and explicit timeout/unavailable outcomes. Honor deadlines across transport and preserve same-document catalog refreshes.
- ee4172d: Identify retained react-freeze primary subtrees through an optional component-identity adapter. Component cohorts now distinguish current render eligibility, proven freezing, generic React hiding, and actual unmounting independently of observed update counts.
- c998f34: Add opt-in native navigation tools that await navigator transition completion and return the resulting route and stack depth, with serialized actions, bounded deadlines, explicit unsettled outcomes, and an Expo Router integration fixture.

### Patch Changes

- d2d401d: Report React Offscreen visibility separately from component lifecycle in cohorts, preserving hidden mounted instances and distinguishing unmounted tombstones. Add native freeze/hide/thaw controls for live verification.
- 0234ee1: Pin Bippy to the validated 0.7.2 release. Fresh installs previously selected 0.7.3, which removed the `didFiberCommit` export used by Genie and prevented the app from loading.
- 085fd76: Reserve an interaction's document before awaiting its initial clear, so concurrent begin calls cannot invalidate each other's observation boundaries. Release reservations after failed starts and reject responses invalidated by a bridge clear or document change. Document labelled interaction handles and their temporal attribution limits.
- 125f9c7: Preserve verified late-hook collection readiness across render/profile clears. Hook replacement still requires a new observed commit. Add an Expo late-import fixture for persistent-hub relaunch validation.
- b4c90ee: Filter render reports by name globs, exclusions, and minimum updates before source classification and limits. Add bounded, expiring cursors over frozen reports so subsequent pages retain the same counters and ownership coverage while new commits arrive, and show a safe CLI continuation command.
- b2338b8: Exclude inferred Query render causes incompatible with a complete current notification policy. Report matching subscribed fields or why compatibility could not be checked, including implicit error subscriptions and incomplete policies, while preserving exact delivered notifications.
- 0c9a05b: Reject React quiet waits when commit collection is unavailable, and restart the quiet window after failed samples or document changes. Document the existing wait tool in measurement examples.
- 81c60b9: Complete React selector and ownership-filter coverage, retain unmounted cohort source evidence, disclose incomplete profile populations, and advertise valid schema-derived calls and argument bounds.
- aa3741c: Report renderer bundle metadata and timing/count interpretation in render and profiling reports, including human CLI output.
- 31bca4a: Support sorting render reports by updates and expose parameter bounds and defaults in compact tool catalogs. Clarify name filters versus instance IDs.
- 632c1ec: Expose app, library, and unknown ownership coverage in render reports. Warm source classifications beyond the cold-read budget, and reject app-only comparisons while unknown ownership makes the filtered sample incomplete.

## 0.12.6

### Patch Changes

- 5a13ea8: Update bippy to 0.7.2 and adopt its new APIs.

  Fiber work tags are now resolved per renderer instead of being compile-time constants, so
  component classification stays correct if React renumbers its work tags again. Bippy dropped
  its `bippy/react-refresh` entrypoint and a few helpers (`getNearestHostFibers`, `getTimings`,
  `toUnsubscribe`); these are vendored locally with identical behavior.

  Live overrides now drive the renderer that owns the target fiber (`getRenderer`) instead of
  the first capable renderer, so apps with more than one injected renderer edit the right tree.

  Source-map resolution now goes through bippy, which decodes inline data-URI maps directly.
  This drops the `@jridgewell/sourcemap-codec` dependency and fixes source content being
  mangled for non-ASCII characters, which the previous `atob`-based decoder corrupted.

  Also fixes live hook overrides passing the hook index as a string rather than a number —
  previously masked by JavaScript coercion inside React's `overrideHookState`.

## 0.12.5

### Patch Changes

- 1b9106e: Fix React Native (Hermes) support and misleading zero-render reports (#69): fall back to a Map/Set/Date-aware clone where `structuredClone` is missing so importing `genie-react/native` no longer throws on Hermes; add `default` export conditions so Metro can resolve `genie-react/hook` and every other subpath; report `renderCollection` availability in `react_get_renders` so a hook installed after React is distinguishable from "nothing re-rendered"; schedule an explicit re-render after `react_override_hook_state` and report `commitObserved` with a warning when no commit followed; make `.genie/` self-gitignoring; and echo the required keys plus a minimal valid invocation in `invalid-args` tool errors.

## 0.12.4

## 0.12.3

### Patch Changes

- c8f74c7: Bundle Zod privately in the browser runtime so host Zod versions cannot affect Genie initialization.
- f07d02e: Classify disabled and never-fetched Query cache entries explicitly, and require measured turnover or unobserved fetching before reporting churn.
- 57b600f: Upgrade Bippy to 0.6.1 so Fiber ID zero remains stable and custom-renderer host instances can be resolved from tracked roots.
- 48ccdc9: Remove Genie runtime imports and custom-tool registration code from Vite production builds.

## 0.12.2

### Patch Changes

- b192452: Answer `react_component_cohort` per instance instead of collapsing the whole result to `unknown`. Fibers the commit walk reached but the analysis budget declined are now recorded by identity, so a skipped fiber costs that one instance its verdict rather than every instance in the cohort. Instances the walk reached and did not record report `mounted-idle`, and an instance whose render was actually recorded keeps its `mounted-updated` verdict even when an unrelated coverage gap is open. Deferred lifecycle work remains unknown until it is processed, while a failed traversal keeps the rest of the observation window incomplete. Skipped-render identity detail is bounded and fails closed on overflow. `coverage.complete` keeps its existing meaning.
- c74cef9: Attribute React Native components to their real source files, including Expo/Hermes bundle URLs and framework-wrapped app roots. Metro frames are symbolicated through the dev server's `/symbolicate` endpoint with shared in-flight lookups and retryable failures. An unsymbolicated bundle remains visible as diagnostic source data but has unknown ownership, so `appOnly` never guesses that it belongs to the app. Folded library trees preserve valid parent links, and filtered reads warn only when no app-owned result survived the ownership filter.
- 6b5bb60: Allow callers to request render observation budgets large enough for large React Native screens. Defaults remain 250 fibers / 20,000 operations / 8ms, and adaptive growth applies only to later commits after exhaustion, so discard an incomplete one-action observation and rerun it with an explicit larger budget. The target deadline now extends one normalized reserve duration beyond the normalized general deadline, explicitly requested budgets are not clamped down to adaptive ceilings, and the opt-in ceilings rise to 20,000 fibers / 2,000,000 operations / 500ms (250ms target reserve).

## 0.12.1

### Patch Changes

- d6d12c3: Restore Genie profiling and WebSocket reconnection after React Native reloads without requiring an app relaunch.

## 0.12.0

### Minor Changes

- cb8fc5b: Apps can expose their own agent tools. `useGenieTool` / `defineGenieTool` / `registerGenieTools` register custom actions and queries under the `app` group (optional `group` subgroups as `app.<name>`), with zod-validated args, read-only/action/destructive badges, a `tool-unavailable` error code with recovery hints when the registering component is unmounted, and a per-tool result-size cap. The CLI renders badges and availability in `tools` listings, and a group-family selector (`tools app`, `tools react`) covers subgroups.

## 0.11.0

### Minor Changes

- 0a697d7: Add separate Query and Router collector exports plus safe late collector registration for script-based setups.

## 0.10.1

### Patch Changes

- 276d8ec: Fix React Native source provenance for lazy Hermes error stacks and preserve mapped confidence after Metro symbolication. Describe `browser_get_memory` results accurately across browser and Hermes runtimes.

## 0.10.0

### Minor Changes

- 6f4f7ed: Make agent diagnostics decision-safe with explicit provenance and coverage, noise-aware comparisons, effect and store notification attribution, atomic interaction captures, bounded output, collision-safe sessions, live health checks, and a versioned bundled skill.

## 0.9.0

### Minor Changes

- a6ddbd3: Add stable React observation and instance IDs, lifecycle cohorts, exact Query and external-store evidence, bounded array and known-store paths, effect schedule events, source provenance, and conservative agent-first CLI guidance. Arbitrary props and object fields stay opaque.

## 0.8.0

### Minor Changes

- a26309e: Make CLI and session targeting agent-safe with workspace bridge discovery, persistent tab aliases, bounded startup diagnostics, versioned machine envelopes, exact Query waits, targeted React subtrees, atomic Router/browser snapshots, and explicit package-filter accounting.

## 0.7.0

### Minor Changes

- 00a8dae: Add durable session targeting, effect ownership and hotness, causal render events, named runtime captures, and repeated capture comparisons with typed budgets.

## 0.6.1

### Patch Changes

- 156b50c: Add concise package READMEs, clearer npm descriptions, and focused search keywords.

## 0.6.0

### Minor Changes

- 006dc90: Upgrade to Bippy 0.6 and add `react_refresh_events` with state-preservation/remount details, source-cache invalidation, HMR-safe instrumentation teardown, and refresh-aware profiling.
- 006dc90: Add reversible `query_simulate_state` and `query_restore_state` tools for inspecting TanStack Query pending and error UI without editing application code.

## 0.5.2

### Patch Changes

- f205bb8: Pack releases with pnpm before publishing through npm so internal workspace dependencies resolve to installable versions.

## 0.5.1

### Patch Changes

- 32edfea: Pack releases with pnpm before publishing through npm so internal workspace dependencies resolve to installable versions.

## 0.5.0

### Minor Changes

- 3413d52: Make render causes actionable: `react_get_renders` now identifies each changed `useState`/`useReducer` slot, its flat and stateful hook positions, and bounded before/after values. Class state is reported separately, non-state hook internals are excluded, and the CLI prints compact value diffs while remaining compatible with older generic state markers.

### Patch Changes

- 922b635: Faster tools on large React trees: tree reads cached between commits, O(depth) fiber lookups instead of full-tree scans, LRU id registry (no more clear-all overflow), and source classification that skips cached fibers and warms in the background.

## 0.4.0

### Minor Changes

- 8d4d7bf: Better agent experience: typed errors with retry hints, fast busy detection, hook kinds and overrides by stateful index, override list/reset, render snapshot/diff, CLI `batch` / `--fields` / `--timeout`, and one bin name: `genie-react`.
- 5314fbf: Add React Native / Expo support.

  - New `genie-react/native` entry (`startGenie()` + `<Genie />`) that composes the DOM-free collectors and takes TanStack instances by value, so it bundles under Metro whether or not TanStack is installed (RN 0.79+ / Expo SDK 53+). Instances are duck-validated with a loud skip on mismatch, and a `queryClient`/`router` passed on a later call or render registers onto the running client instead of being dropped.
  - `findRootFiber()` now falls back to the live roots captured from bippy's commit hook when there is no DOM, so every React tool works in React Native. Roots are tracked per `FiberRoot` and dropped on unmount: the first-mounted root wins (a dev-overlay root like LogBox can't hijack the tools), an unmounted tree is never reported, and nothing is retained after teardown. Web still seeds from the DOM first.
  - `react_dom_for_component` describes native host views (fiber type + `testID` / accessibility props) instead of returning empty on non-DOM hosts, including text from string, number, and interpolation-array children.
  - The web and native entries now compose their default collectors from one shared list, so future collectors ship to both platforms.

### Patch Changes

- 8c945ed: `react_error_state` now includes boundaries held open by `react_force_error_boundary` / `react_toggle_suspense_fallback`, flagged `forced: true` (real errors/suspends are `forced: false`), so a forced state is visible without cross-checking `react_list_overrides`.

## 0.3.0

### Minor Changes

- fc7eb33: New `browser_fps` tool (perf collector): sample the page frame rate on demand via requestAnimationFrame — avg fps, frames dropped against the estimated display refresh rate (fair on 120Hz panels), long frames (>50ms), the single worst stall, and a smooth/degraded/janky verdict using react-scan's thresholds as refresh-rate ratios plus its 150ms hard-stall rule. Registered by `<Genie />` and the script-tag client; the CLI prints a one-line summary. Also bumps bippy to ^0.5.43 (a republish of 0.5.42 — no API changes).

## 0.2.2

### Patch Changes

- 9379751: Fixes from a blind agent field run:

  - Component names resolve through `memo()`/`forwardRef` wrappers: react-refresh's `_c`/`_c2` placeholder names no longer mask a wrapper's `displayName` or the inner function's real name, so renders/errors/find report the component you named — previously, memoizing an arrow component made it drop out of `react_find_components` and show as `_c` in reports, exactly when verifying the memoization fix mattered most.
  - The react tools accept `component`/`query`/`name` interchangeably for their component-name argument (remapped before validation only when unambiguous, so unknown-key rejection still guards everything else).

## 0.2.1

### Patch Changes

- c0c0025: Coexist with `@cloudflare/vite-plugin` (Start-on-Cloudflare apps like tanstack.com): its workerd dev proxy owns the dev port's WebSocket upgrades and drops genie's socket within milliseconds (close 1006, permanent reconnect flap). The `genie()` plugin now detects the Cloudflare plugin in the resolved config and reroutes transport automatically — it starts a standalone hub on its own port, points the injected client's WebSocket at it, writes discovery for the CLI accordingly, and shuts the hub down with the dev server (a killed server heals via the existing stale-pid cleanup). No wiring changes: `genie()` + `<Genie />` stay as-is, and existing setups fix themselves on upgrade. `init` prints a note when it sees the Cloudflare plugin in dependencies.
- c0c0025: Harden the attach paths against real-world hosts, from OSS-app field testing (Excalidraw, tanstack.com, Cal.com/react.dev):

  - Vite plugin excludes `genie-react` from dependency pre-bundling so the optional-peer stubs actually apply — importing `<Genie />` no longer black-screens apps without TanStack installed — and pre-lists its nested deps so the first post-install boot connects instead of 504ing on stale optimized-dep hashes.
  - Opt out of ws's optional native addons before ws loads: a host bundler or stale prebuild that half-resolves `bufferutil` crashed the hub with `bufferUtil.unmask is not a function` on Node 22 and 500'd the host app.
  - Tool dispatch rejects unrecognized argument keys (a `maxDepth` typo for `depth` used to no-op silently), formats validation errors readably, and unknown-tool errors now list the advertised domains and explain that query/router tools are gated on a discovered QueryClient/Router.
  - CLI: when no `.genie/bridge.json` exists, say so and call the localhost default a guess instead of presenting it as fact; `doctor --live` reports "no app session connected yet" instead of a warning-glyphed success sentence; hub timeouts hint at busy main threads and `devtools_wait`.
  - `init` adds `.genie/` to `.gitignore` and prints next-steps with the repo's actual package manager instead of hardcoded pnpm.

## 0.2.0

### Minor Changes

- d4f511c: New `react_component_for_dom` tool: a CSS selector resolves to the owning React component(s) with id, props, and source file:line — the reverse of `react_dom_for_component`. `genie doctor --live` probes the running stack end to end (hub HTTP + identity, served client bundle, WS session round-trip). Stale `.genie/bridge.json` files whose pid is gone are announced and removed by both discovery and doctor. Piped `--json` output is no longer truncated at 64KB (natural exit instead of `process.exit`).
- a11e8bf: Consolidate the app-side packages into one `genie-react` package.

  `@genie-react/core`, `client`, `react-collector`, `tanstack-collector`, `devtools-plugin`, `memory`, `react`, `bridge`, and `vite` are replaced by the single `genie-react` package with subpath exports: `genie-react` (the `<Genie />` component), `genie-react/vite` (the plugin), `genie-react/client` + `genie-react/hook` (the injected client), `genie-react/hub` (the standalone bridge), and `genie-react/protocol` (wire protocol + tool contracts).

  Migration: `pnpm add -D genie-react`, then `import { Genie } from 'genie-react'` and `import { genie } from 'genie-react/vite'`. The CLI (`@genie-react/cli`) is unchanged in usage; `genie init`, `doctor`, and `link` now wire the single package.

- 5e60814: Framework-agnostic attach: Next.js support and a standalone hub for any non-Vite React app.

  The hub now serves a self-contained browser client at `GET /__genie/client.js`, so any React setup attaches with one classic script tag — no bundler integration required. New surface: `genie hub` (CLI command, default port 4390), `<GenieScript />` from `genie-react/script` (dev-only script tag for any SSR root layout, RSC-safe), and `genie-react/next` with `registerGenie()` for Next.js `instrumentation.ts`. `genie init` and `doctor` now detect Next.js apps and wire the layout + instrumentation automatically.

### Patch Changes

- ac61385: Context economy for agents: `genie tools` becomes progressive discovery (group index → `tools <group>` → `tools <tool>` with the full description and a runnable example; `--all` for the flat catalog, `--json` slim by default with full schemas per tool); ten new compact summarizers (status, find_components, component_for_dom, inspect_component, error_state, profile_report, query_list, query_get, router_get_state, router_list_matches) so hot reads stop dumping pretty JSON; `--json` output is now compact machine JSON; per-command `--help` for every subcommand.
- 0f2f2e4: Discovery polish from the three-model economy tests: read-group listings point at their domain's mutation tools in the `action` group; small flat action results render as one line (`ok=true · pathname="/error"`) instead of pretty JSON; `router_list_routes` gets a summary; generic basenames keep a parent segment (`routes/index.tsx:106`); array-valued query data previews as `[N items]` instead of dumping; the caught-error message is recovered from the console text when React 19.2 passes no Error instance.
- 8d99b93: Five-host E2E fleet fixes: `<GenieScript />` keeps a walked hub port across Next.js recompiles (global-symbol handoff); `<Genie />` discovers the QueryClient from a plain `QueryClientProvider` and accepts explicit `queryClient`/`router` props; `plugin_emit` auto-prefixes bare event types; React 19 error-boundary console text is parsed (message + thrower no longer dropped); consumed contexts are deduped (StrictMode double-reads); `react_get_tree` defaults to `appOnly` like its siblings; meta tools appear in the advertised catalog so counts agree; `genie tools` honors `--json` and `--session`; `init`/`doctor` treat the universal hub + script-tag path as a valid setup (exit 0); hub-down CLI errors no longer assume Vite; clearer `query_fetch` and effect-audit messages.
