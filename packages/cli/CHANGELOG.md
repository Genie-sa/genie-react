# @genie-react/cli

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
