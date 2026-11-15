# Design: `genie-react verify`

Status: proposal for review. Workstream WS9. No code changes accompany this document.

Path conventions: runtime paths are relative to `packages/genie-react/src/`. CLI paths start with `cli/` and are relative to `packages/cli/src/`. Eval paths start with `evals/`. Each statement about current behavior names the file and symbol it comes from.

## Summary

`verify` turns "I think my fix worked" into a command with a typed answer. The agent declares claims before it acts, such as "`StatusBadge` renders 0 times while I type in the filter". It then drives the UI with its own driver and ends the window. Genie settles the app, freezes the evidence, checks every evidence rule that `skills/genie/EVIDENCE.md` asks the agent to apply by hand, and returns one of four verdicts: `pass`, `fail`, `refused` or `inconclusive`. A refusal names one reason from a closed list and the exact command that fixes it. The exit code carries the verdict, so a script or an agent cannot read a refusal as a pass.

The verdict engine runs in the hub, next to `InteractionManager` and `CaptureManager`, because the window spans two CLI processes and only the hub sees document changes. The CLI parses claims and renders the result. The design reuses the existing observation window, settle checks and comparison statistics. It changes one thing about the window: it settles before it freezes, so asynchronous consequences of the interaction count.

The most important property is in section 8: for every way `verify` could say `pass` when the claim is false, a named mechanism turns that case into `fail`, `refused` or `inconclusive`. A pass requires positive evidence, never the absence of evidence.

## 1. The user job and worked examples

### The job

An agent changed code to fix a runtime bug. Before it tells the user "fixed", it has to show that the interaction now behaves as intended in the running app, and it has to be right. The success signal is the agent reporting a fix exactly when a strict independent check (the eval probe, or the user) agrees.

### Current friction

Today the agent assembles the proof from about five calls. `skills/genie/SKILL.md` section 3 lists them: `react_clear_renders` with a budget, the UI action, `react_quiesce` with `--fail-on-result-error`, `react_render_causes`, and for performance `devtools_capture_create` six times per cohort and `devtools_capture_compare`. Then it applies the rules in `EVIDENCE.md` itself: check coverage before trusting an empty result, treat `lower-bound` counts as possibly missing work, treat `inferred` causes as leads, require notification IDs for Query causes, do not count repeated snapshots of one run as samples, and others. Section 5 maps all of them.

Every rule an agent skips leads to the same failure: a confident "fixed" that is false. The eval harness shows the same risk in its own grader. `evals/lib/probe.mjs` `runProbe` passes the `probe.renders` check when `renders.tracking === true && updates <= maxUpdates`. It never reads `coverage.complete` or `summary.semantics`, so a budget that skipped the target would grade a broken fix as fixed.

### Non-goals

- Genie does not drive the UI. The agent drives it with agent-browser or agent-device.
- Genie does not check what the user sees. Every verdict carries a caveat saying so.
- `verify` is not a test runner and does not replace the app's tests.
- There is no MCP server. `verify` is a CLI command and a section of the skill.

### Output formats

WS1 is changing the CLI default to compact text with `--json` opt-in. The text below follows the rules in `packages/cli/AGENTS.md`: no decorative symbols, `!` for warnings, results on stdout, diagnostics on stderr. The exact text layout belongs to WS1's renderer; the JSON fields are the contract.

### Example A: a memo fix, failing and then passing

The fixture's Search screen re-renders a memoized badge on every keystroke (`evals/tasks/memo-object-prop-fix.json`). The agent declares three claims: the badge does not render, the screen does render (a positive control that proves the interaction reached React), and no error boundary trips.

```bash
npx genie-react verify begin --session my-agent --name "type cert in filter" \
  --claim 'render StatusBadge max 0' \
  --claim 'render SearchScreen min 1' \
  --claim 'boundaries clean'
```

```text
recording vfy_2m7d "type cert in filter" on my-agent, document 1
  url http://localhost:5173/?screen=search&_genie=my-agent
  1 render StatusBadge max 0     1 instance, src/screens/search/StatusBadge.tsx
  2 render SearchScreen min 1    1 instance, src/screens/search/SearchScreen.tsx
  3 boundaries clean
next: drive the UI, then run npx genie-react verify end vfy_2m7d --session my-agent
```

Exit 0. The agent drives the UI and ends the window:

```bash
agent-browser type 'input[aria-label="Filter incidents"]' cert
npx genie-react verify end vfy_2m7d --session my-agent
```

```text
fail vfy_2m7d "type cert in filter"  4 commits, quiet after 640 ms (react, query)
  1 fail  render StatusBadge max 0    4 renders, exact; latest cause props.appearance, new reference with equal contents
  2 pass  render SearchScreen min 1   4 renders, exact
  3 pass  boundaries clean            no boundary caught an error
! Genie does not check what the user sees; confirm the visible result with the UI driver
attempt 1 for these claims on this tab
evidence: npx genie-react verify show vfy_2m7d --claim 1 --session my-agent
```

Exit 1. The agent fixes the code. Fast Refresh applies the edit, and the agent runs `begin`, the same `type` command, and `end` again:

```text
pass vfy_9c1p "type cert in filter"  4 commits, quiet after 610 ms (react, query)
  1 pass  render StatusBadge max 0    0 renders, exact over 4 commits; 1 instance mounted and rendering throughout
  2 pass  render SearchScreen min 1   4 renders, exact
  3 pass  boundaries clean            no boundary caught an error
! Genie does not check what the user sees; confirm the visible result with the UI driver
attempt 2; previous fail vfy_2m7d; code changed since (Fast Refresh: src/screens/search/SearchScreen.tsx)
evidence: npx genie-react verify show vfy_9c1p --session my-agent
```

Exit 0. The same result with `--json`:

```json
{
  "schemaVersion": "1.0",
  "kind": "verification",
  "verificationId": "vfy_9c1p",
  "name": "type cert in filter",
  "state": "completed",
  "verdict": "pass",
  "exitCode": 0,
  "session": {
    "sessionId": "s_41f0",
    "logicalSessionId": "l_9a2c",
    "documentGeneration": 1,
    "sessionName": "my-agent",
    "url": "http://localhost:5173/?screen=search&_genie=my-agent"
  },
  "window": {
    "observationId": "observation:4",
    "startDocumentCommitId": 57,
    "settledDocumentCommitId": 61,
    "commits": 4,
    "settle": { "outcome": "met", "quietMs": 500, "waitedMs": 610, "domains": { "react": "met", "query": "met" } },
    "tail": { "ms": 500, "commits": 0 },
    "environment": { "bundle": "development", "strictMode": "on", "renderCollection": "available" }
  },
  "claims": [
    {
      "index": 1,
      "text": "render StatusBadge max 0",
      "claim": { "kind": "renders", "target": { "component": "StatusBadge" }, "max": 0, "counting": "renders" },
      "verdict": "pass",
      "observed": { "renders": 0, "mounts": 0, "updates": 0, "remounts": 0, "semantics": "exact", "instances": 1, "activeInstances": 1 },
      "deciding": [
        { "kind": "coverage", "complete": true, "targetedComplete": true, "semantics": "exact" },
        { "kind": "instance", "mountId": "mount:12", "renderingState": "mounted-rendering", "source": "src/screens/search/StatusBadge.tsx:14:8" }
      ],
      "caveats": []
    },
    {
      "index": 2,
      "text": "render SearchScreen min 1",
      "claim": { "kind": "renders", "target": { "component": "SearchScreen" }, "min": 1, "counting": "renders" },
      "verdict": "pass",
      "observed": { "renders": 4, "mounts": 0, "updates": 4, "remounts": 0, "semantics": "exact", "instances": 1, "activeInstances": 1 },
      "deciding": [{ "kind": "render-event", "renderEventId": "render:58:301", "cause": "state.query", "evidence": "exact" }],
      "caveats": []
    },
    {
      "index": 3,
      "text": "boundaries clean",
      "claim": { "kind": "boundaries-clean" },
      "verdict": "pass",
      "observed": { "caughtDuringWindow": 0, "caughtAtEnd": 0 },
      "deciding": [{ "kind": "boundary-log", "complete": true, "afterDocumentCommitId": 57 }],
      "caveats": ["uncaught-errors-outside-boundaries-unobserved"]
    }
  ],
  "caveats": ["ui-outcome-not-observed"],
  "ledger": {
    "fingerprint": "cf_6d1e09",
    "scope": "logical-session",
    "attempt": 2,
    "history": [{ "verificationId": "vfy_2m7d", "verdict": "fail", "endedAt": "2026-11-15T10:02:11.402Z" }],
    "codeChangedSincePrevious": "fast-refresh",
    "failsOnSameCode": 0
  },
  "next": {
    "command": "npx genie-react verify show vfy_9c1p --session my-agent",
    "argv": ["npx", "genie-react", "verify", "show", "vfy_9c1p", "--session", "my-agent"]
  }
}
```

### Example B: a refusal for a skipped budget, then a pass

A 500-row orders table should re-render only the edited row. The default budget (`protocol/react-observation-schema.ts` `DEFAULT_RENDER_OBSERVATION_BUDGET`, 250 Fibers per commit) cannot analyze every row in one commit.

```bash
npx genie-react verify begin --session my-agent --name "edit order 412 quantity" \
  --claim 'render OrderRow max 1' --claim 'render OrdersTable min 1'
agent-browser type 'input[aria-label="Quantity for order 412"]' 3
npx genie-react verify end vfy_q4tn --session my-agent
```

```text
refused vfy_q4tn "edit order 412 quantity"  1 commit, quiet after 520 ms (react)
  1 refused render OrderRow max 1     budget_exhausted: fiberLimit ran out in 1 commit; 1 render seen, a lower bound
  2 pass    render OrdersTable min 1  1 render, exact
fix: npx genie-react verify begin --session my-agent --name "edit order 412 quantity" --claim 'render OrderRow max 1' --claim 'render OrdersTable min 1' --budget '{"fiberLimit":1200,"operationLimit":90000}'
```

Exit 4. The suggested budget comes from `coverage.budgetAdvice.suggestedBudget` (`collectors/react/render-contract.ts` `renderCoverageSchema`). A lower bound of 1 cannot prove "at most 1", so the claim is refused. Had the lower bound been 3, the claim would fail, because work Genie saw is work that happened. The agent runs the `fix` command and the interaction again, and the rerun passes:

```text
pass vfy_m81z "edit order 412 quantity"  1 commit, quiet after 540 ms (react)
  1 pass  render OrderRow max 1      1 render, exact; key "412"
  2 pass  render OrdersTable min 1   1 render, exact
attempt 2; previous refused vfy_q4tn (budget_exhausted); no code change observed
```

The `--json` refusal for claim 1:

```json
{
  "index": 1,
  "text": "render OrderRow max 1",
  "verdict": "refused",
  "observed": { "renders": 1, "semantics": "lower-bound", "instances": 500 },
  "refusal": {
    "reason": "budget_exhausted",
    "message": "fiberLimit ran out in 1 commit, so render counts are a lower bound.",
    "evidence": { "exhaustedLimits": ["fiberLimit"], "budgetExhaustedCommits": 1, "suggestedBudget": { "fiberLimit": 1200, "operationLimit": 90000 } },
    "next": {
      "command": "npx genie-react verify begin --session my-agent --name 'edit order 412 quantity' --claim 'render OrderRow max 1' --claim 'render OrdersTable min 1' --budget '{\"fiberLimit\":1200,\"operationLimit\":90000}'",
      "argv": ["npx", "genie-react", "verify", "begin", "--session", "my-agent", "--name", "edit order 412 quantity", "--claim", "render OrderRow max 1", "--claim", "render OrdersTable min 1", "--budget", "{\"fiberLimit\":1200,\"operationLimit\":90000}"]
    }
  }
}
```

### Example C: a Query update that never reaches the UI

On the fixture's Tasks screen, `useAddTask` invalidates `['task', 'list']` while the list reads `['tasks', 'list']` (`evals/fixture-app/src/screens/tasks/taskQueries.ts`).

```bash
npx genie-react verify begin --session my-agent --name "add task" \
  --claim 'query ["tasks","list"] refetched delivered-to TaskList' \
  --claim 'boundaries clean'
agent-browser type 'input[aria-label="New task title"]' 'Ship it'
agent-browser click 'button[type="submit"]'
npx genie-react verify end vfy_h3x0 --session my-agent
```

```text
fail vfy_h3x0 "add task"  3 commits, quiet after 830 ms (react, query)
  1 fail  query ["tasks","list"] refetched delivered-to TaskList   not refetched: dataUpdateCount 1 before and after, no fetch settled in the window
  2 pass  boundaries clean                                         no boundary caught an error
evidence: npx genie-react verify show vfy_h3x0 --claim 1 --session my-agent
```

Exit 1. The counters come from `query_get` (`collectors/tanstack/query.ts` `queryGetContract`: `dataUpdateCount`, `fetchCount`, `fetchStatus`), read at `begin` and at settle. After the fix, the claim passes only when a notification in this observation window reached an observer of `TaskList` and a `TaskList` render event carries an exact `query` cause with that notification ID (section 2.4).

### Example D: a refusal because nothing happened

The agent typed into a different browser session than the one Genie observes. Without a guard, "`StatusBadge` renders 0 times" would pass.

```text
refused vfy_7wq2 "type cert in filter"  0 commits, quiet after 500 ms (react, query)
  window  no_activity: no React commit happened in the window; the interaction did not reach this tab or did not change React state
  1 refused render StatusBadge max 0
  2 fail    render SearchScreen min 1   0 renders, exact
  3 pass    boundaries clean
fix: drive the tab at http://localhost:5173/?screen=search&_genie=my-agent, then run npx genie-react verify begin --session my-agent --name "type cert in filter" --claim 'render StatusBadge max 0' --claim 'render SearchScreen min 1' --claim 'boundaries clean'
```

Exit 1, because claim 2 failed and a failure decides the conjunction (section 4.2). Without the positive control, the verdict would be `refused` with exit 4. Either way the run cannot pass.

## 2. The claim model

### 2.1 Principles

1. A claim is a statement about one observation window on one document. Cross-document flows (full page loads, OAuth redirects) are out of scope for 1.0.
2. Claims are declared at `begin`. Pre-registration lets Genie resolve targets and reserve analysis budget for them (`react_clear_renders` `components` input, `collectors/react/render-contract.ts` `renderObservationInputSchema`), and it stops the agent from choosing a claim after seeing which one passes.
3. Each claim kind has a decision table: what proves it true, what proves it false, and what leaves it open. An open claim is `refused` when a stated fix can close it, and `inconclusive` when complete evidence still cannot decide.
4. Upper-bound claims ("at most N", "only these causes", "settles") pass only on `exact` evidence. Lower-bound evidence can make them fail, never pass. Lower-bound claims ("at least N") pass on lower-bound evidence.
5. A target that Genie cannot see is never treated as a target that did nothing.

### 2.2 Targets

A component target is an exact display name, optionally narrowed by source file and key:

```text
StatusBadge
StatusBadge@src/screens/search/StatusBadge.tsx
OrderRow[key=412]
```

The render tools match names by substring: `react_get_renders`, `react_render_causes` and `react_effect_audit` describe `component` as "Only components whose name contains this string" (`collectors/react/render-contract.ts` `reactGetRendersContract`, `reactRenderCausesContract`; `collectors/react/effect-contract.ts` `reactEffectAuditContract`). `verify` uses those filters only to narrow reads, then filters by exact name in the hub. `react_component_cohort` already matches exactly by default (`reactComponentCohortContract`, `exact: true`), and `verify` resolves instances with it.

Resolution at `begin`:

- Genie lists matching instances with `react_component_cohort` and groups them by `source.file`. More than one source file for the same name refuses with `target_ambiguous` and lists the candidates, so the agent can add `@file`.
- No mounted instance is allowed at `begin`, because a modal may mount during the interaction. The target is then marked pending, and `end` requires that a matching instance mounted inside the window.
- Genie never accepts a numeric component ID as a target. Fiber IDs are per document (`collectors/react/instance-identity.ts` `InstanceDescriptor.fiberId`), and SKILL.md says to reacquire them after reloads.

### 2.3 Claims supported in 1.0

| Kind | DSL | Phase |
| --- | --- | --- |
| `renders` | `render <target> max <N>` or `min <N>`, optional `counting updates` | 1 |
| `render-causes` | `render <target> only <cause>[,<cause>...]` | 1 |
| `effect-runs` | `effect <target>[#<index>] max <N>` | 1 |
| `effect-settles` | `effect <target>[#<index>] settles` | 1 |
| `boundaries-clean` | `boundaries clean` | 1 |
| `query` | `query <key> <success\|error\|refetched> [delivered-to <target>]` | 2 |
| `route` | `route <pathname>` | 2 |
| `suspense-resolved` | `suspense <target> resolved` | 2 |
| `budget` | `verify compare ... --budget '<metric> <rule>'` | 2 |

Every claim also depends on the window guards in section 3.4. A failed guard refuses every claim it affects.

### 2.4 Semantics, evidence and refusals per claim

#### `renders`

Semantics: the number of commits inside the window (after `startDocumentCommitId`, up to and including `settledDocumentCommitId`) in which any matched instance rendered. By default this counts mounts and updates. `counting updates` counts updates only, but a remount of a matched instance (an unmount followed by a mount at the same `logicalPath` with a higher `mountGeneration`, `collectors/react/instance-identity.ts` `InstanceDescriptor`) still fails a `max` claim unless `allow-remount` is given. Without that rule, a "fix" that changes a `key` on every render would drop updates to zero and pass.

Evidence: `react_get_renders` with `view:"full"` and `appOnly:false` for counts and `coverage`; `react_component_cohort` for instances, `renderingState`, mounts and unmounts; `react_render_causes` for the deciding events.

| Result | Condition |
| --- | --- |
| pass, `max N` | count is at most N, `coverage.complete`, `coverage.semantics` and `summary.semantics` are `exact`, `coverage.targeted.complete`, no `budgetAdvice`, and at least one matched instance was `mounted-rendering` during the window |
| pass, `min N` | count is at least N, at any semantics |
| fail, `max N` | count is greater than N, at any semantics |
| fail, `min N` | count is less than N with exact semantics |
| refused | `budget_exhausted` when `budgetAdvice` is present; `coverage_incomplete` for other incomplete coverage; `target_not_found`; `target_ambiguous`; `target_inactive` when every matched instance was `mounted-frozen` or `mounted-hidden` (`reactComponentCohortContract` `renderingState`) or inside a Suspense boundary showing its fallback; `not_quiescent` when a matched instance rendered during the tail |

#### `render-causes`

Semantics: every render event of the target in the window has a cause set contained in the allowed set. Causes are `mount`, `props[.name]`, `state[.name]`, `context[.Name]`, `children`, `query[.hash]` and `router`. A render with causes `props.items` and `state.open` fails `only props.items`.

The cause schema fixes which kinds can ever be exact. In `collectors/react/render-contract.ts` `renderCauseSchema`, `parent` and `external-store` causes are always `inferred`, and `query` and `router` are exact only with the `query-notification-delivered` or `router-notification-delivered` reasons. `begin` refuses an allowed set that names `parent` or `external-store` with `evidence_inferred`, because no run could pass it.

| Result | Condition |
| --- | --- |
| pass | every event's causes are exact and allowed, every event has `inputCoverage.complete`, and the number of events equals the `renders` count for the target (a cross-check that no event was evicted) |
| fail | any event carries an exact cause outside the allowed set |
| refused | `evidence_inferred` when an event's deciding cause is `inferred` or `unknown`; `evidence_truncated` when `coverage.droppedRenderEvents`, `omittedByLimit` or `renderEventRetention.earliestDocumentCommitId` show missing events (`reactRenderCausesContract` output), or the counts disagree; plus every `renders` refusal |

#### `effect-runs`

Semantics: the number of observed executions of the effect in the window. Scheduling does not count. `collectors/react/effect-contract.ts` says React commit flags "do not prove passive execution or cleanup timing" (`reactEffectAuditContract`), so `verify` counts events from `react_effect_timeline` whose `execution.status` is `observed`. Without `#index`, the claim applies to each effect of the component separately.

| Result | Condition |
| --- | --- |
| pass | executions at most N, effect coverage complete, and no event in the window has `execution.status: "unobserved"` with reason `instrumentation-unavailable` or `unsupported-effect-kind` |
| fail | executions greater than N, and the excess is not explained by StrictMode mount replays |
| inconclusive | `strict_mode_replay` when the raw count exceeds N only by mount-phase replays under StrictMode |
| refused | `evidence_unavailable` when execution was not instrumented; `evidence_truncated` when `evictedEvents` or `omittedByLimit` is nonzero; `not_quiescent` when an execution is still `not-yet-observed` after settle |

#### `effect-settles`

Semantics, stated as narrowly as the evidence allows: after the agent ends the window, the effect stops executing. Genie does not prove "the effect does not loop", because a loop slower than the observation horizon looks like a stopped effect. The verdict prints the horizon.

| Result | Condition |
| --- | --- |
| pass | settle met, zero executions of the effect during the tail, and coverage complete; caveat `horizon` with the tail length |
| fail | two or more exact executions during the tail, when the agent was no longer driving the UI; `deciding` lists them with their `resulting-commit` edges (an inferred edge, shown as such) |
| refused | `not_quiescent` when settle timed out while this effect was not executing (other work kept React busy) |

The tail for this claim defaults to the larger of twice `quietMs` and 2,000 ms.

#### `boundaries-clean`

Semantics: no React error boundary caught a real error during the window, and none is in an error state at the end. Forced boundaries (`react_force_error_boundary`) are excluded from the count and reported through the `override_active` guard.

Current evidence covers only the end state. `collectors/react/error-tracker.ts` `getErrorState` returns boundaries currently in an error state and evicts boundaries that have unmounted, so a boundary that caught and reset during the window is invisible. Phase 0 adds a catch log with document commit IDs (section 10). Until it lands, the claim is named `boundaries clean-at-end` and the stronger name is rejected.

Uncaught errors outside boundaries and unhandled rejections are not observed. The error tracker patches `console.error` only to pair React's boundary logs with boundaries (`captureConsoleError` in `error-tracker.ts`), and no collector listens for `window` `error` or `unhandledrejection` events. Every `boundaries` result carries the caveat `uncaught-errors-outside-boundaries-unobserved`. A claim named "no errors" is deliberately not offered.

#### `query` (phase 2)

Semantics: the TanStack Query entry with this exact key or hash reaches a state by settle. `success` and `error` test `status` with `fetchStatus: "idle"`. `refetched` requires that `fetchCount` increased between `begin` and settle and that `fetchStatus` is `idle`. `delivered-to <target>` adds three conditions: a `query_notifications` event in this observation window (`observationId` equal to the window's) for an observer owned by the target, with `data` in `changedResultFields`, and a target render event whose cause is `query` with evidence `exact`, joined by `notificationId` (`collectors/tanstack/query.ts` `queryNotificationsContract`, `renderEventIds`).

| Result | Condition |
| --- | --- |
| pass | state matches, and for `delivered-to` the notification and the exact render join exist |
| fail | exact counters show no fetch (`refetched`), or the final state differs after the query domain settled |
| fail, `delivered-to` | the cache changed but no notification reached the target's observer, and notification history is complete for the window |
| refused | `override_active` when `query_get` reports `simulatedState`; `target_not_found` when no cache entry has the key; `target_ambiguous` for a legacy name that matches several entries; `evidence_truncated` when notifications were omitted or evicted; `capability_unavailable` when the app does not advertise the Query tools |

`query_notifications` reports `omittedByLimit` but no eviction count, so absence of a notification cannot be proven today. Until phase 0 adds that count, a `delivered-to` claim can pass by presence but refuses instead of failing by absence. Structural sharing can also keep the old data reference when a refetch returns equal data, in which case nothing is delivered and the claim correctly fails; the skill tells agents to use `refetched` alone for idempotent data.

#### `route` (phase 2)

Semantics: TanStack Router settles on this exact pathname. `router_get_state` (`collectors/tanstack/router.ts` `routerGetStateContract`) must report `pathname` equal to the claim, `isLoading: false`, `isTransitioning: false`, `pendingMatchCount: 0`, and `locationSync: "matched"`. `devtools_wait` with `condition: "navigation"` checks only `pathname` and `isLoading` (`hub/bridge.ts` `checkAppCondition`), so `verify` does not reuse that condition as its decision rule.

| Result | Condition |
| --- | --- |
| pass | all fields above hold at settle |
| fail | the router settled with all loading fields false on a different pathname |
| refused | `not_quiescent` when loading fields never cleared; `capability_unavailable` without Router tools; `session_changed` for a full document navigation |

When `locationSync` is `unavailable`, as with memory history, the claim can still pass on router state and carries the caveat `browser-location-unavailable`.

#### `suspense-resolved` (phase 2)

Semantics: at settle, no Suspense boundary at or above the target shows its fallback for a real pending resource, and the target is mounted and rendering. `react_error_state` lists suspended boundaries with `isFallbackShowing` and `forced` (`collectors/react/contracts.ts` `reactErrorStateContract`). This is an end-state claim; the Suspense-blockers tool from another workstream will supply the "why" for the deciding evidence. Refusals: `override_active` for a forced fallback, `target_not_found`, `not_quiescent`.

#### `budget` (phase 2)

A cohort-level claim, evaluated by `verify compare` over completed runs. Section 6 defines it.

### 2.5 Syntax

The CLI accepts repeated `--claim '<dsl>'` or one `--claims <path|->` JSON document. They are mutually exclusive. Grammar:

```text
claim      = render | causes | effect | query | route | boundaries | suspense
render     = "render" target ("max" | "min") N [ "counting" ("renders" | "updates") ] [ "allow-remount" ]
causes     = "render" target "only" cause { "," cause }
effect     = "effect" target [ "#" index ] ( "max" N | "settles" )
query      = "query" key ( "success" | "error" | "refetched" ) [ "delivered-to" target ]
route      = "route" pathname
boundaries = "boundaries" ( "clean" | "clean-at-end" )
suspense   = "suspense" target "resolved"
target     = Name [ "@" sourcePath ] [ "[key=" key "]" ]
cause      = "mount" | "children" | "router" | ("props" | "state" | "context" | "query") [ "." name ]
key        = JSON array | queryHash string
```

The parser rejects unknown words, names the position, and suggests the nearest keyword, following `cli/failure.ts` `didYouMean`. It never echoes untrusted text into suggested commands (`packages/cli/AGENTS.md`).

JSON input has one object per claim:

```json
{
  "name": "type cert in filter",
  "claims": [
    { "kind": "renders", "target": { "component": "StatusBadge", "source": "src/screens/search/StatusBadge.tsx" }, "max": 0 },
    { "kind": "renders", "target": { "component": "SearchScreen" }, "min": 1 },
    { "kind": "render-causes", "target": { "component": "ResultCount" }, "allow": [{ "kind": "state", "name": "query" }] },
    { "kind": "effect-runs", "target": { "component": "ReportsScreen", "effectIndex": 0 }, "max": 1 },
    { "kind": "effect-settles", "target": { "component": "ReportsScreen" } },
    { "kind": "query", "queryKey": ["tasks", "list"], "state": "refetched", "deliveredTo": { "component": "TaskList" } },
    { "kind": "route", "pathname": "/orders/42" },
    { "kind": "boundaries-clean" }
  ],
  "budget": { "fiberLimit": 1200 },
  "settle": { "quietMs": 500, "timeoutMs": 10000, "domains": ["react", "query"] }
}
```

The zod schema lives in `protocol/verify.ts`, and `genie-react verify begin --help` prints it with the same JSON-schema derivation the meta tools use (`protocol/tools.ts` `metaToolDescriptors`). A run accepts at most 20 claims and 10 distinct targets.

### 2.6 Combining claims

Claims in one verification are a conjunction. The overall verdict is:

1. `fail` if any claim failed. A claim proven false makes the conjunction false whatever the others say.
2. Otherwise `refused` if any claim or window guard refused.
3. Otherwise `inconclusive` if any claim is inconclusive.
4. Otherwise `pass`.

Disjunction and negation are not offered. A negated upper-bound claim is a lower-bound claim, which the DSL already expresses with `min`.

## 3. The interaction protocol

### 3.1 Commands

| Command | Hub tool | Effect |
| --- | --- | --- |
| `verify begin` | `devtools_verify_begin` | Resolves targets, checks guards, starts the observation window, returns `verificationId` |
| `verify end <id>` | `devtools_verify_end` | Settles, records the tail, freezes, reads evidence, returns the verdict. Idempotent: a repeat returns the stored verdict |
| `verify show <id>` | `devtools_verify_read` | Returns the stored verdict, one claim's evidence, or a raw section |
| `verify abort <id>` | `devtools_verify_abort` | Ends a window without a verdict and releases the document lock |
| `verify compare` | `devtools_verify_compare` | Evaluates budget claims over two cohorts of completed runs |

The hub answers these tools itself, like the capture and interaction tools that `hub/bridge.ts` `handleInvoke` routes before `forwardToApp`. An app cannot register a tool that shadows them, and the CLI trusts `hubCode` values only from hub-answered tools, as `docs/json-cli.md` describes for the existing meta tools.

### 3.2 Lifecycle

`begin`:

1. Resolve the session as `CaptureManager` and `InteractionManager` do (`resolveSession`, `sessionUnavailable`). Bind the verification to `sessionId`, `logicalSessionId` and `documentGeneration`.
2. Read the environment and guards: render collection status, bundle, StrictMode, visibility, active overrides, the latest Fast Refresh sequence (`react_refresh_events`), and for Query claims the starting counters from `query_get`.
3. Resolve targets (section 2.2). An ambiguous target, a missing capability or an unsupported environment refuses here, before the agent drives anything, with exit 4.
4. Start the window through the shared begin path that `InteractionManager.beginReserved` uses: `react_clear_renders` with the target names in `components` and the requested `budget`. Record `observation.id` and `documentCommitId`.
5. Take the document lock (section 3.5) and return.

The agent then drives the UI with agent-browser or agent-device, as many steps as the interaction needs.

`end`:

1. Check that the document is current (`isCurrentSession`, which compares sockets in `hub/bridge.ts` `isCurrent`).
2. Settle with recording still on. Settle uses the existing poll from `hub/bridge.ts` `pollCondition` with condition `settled`. React quiet means `documentCommitId` stayed unchanged for `quietMs` (`checkSettleDomain`, polled every `POLL_INTERVAL_MS` = 150 ms). The default domains are every domain the app advertises among `react`, `query` and `router`, the same rule `hub/capture-manager.ts` `defaultCaptureDomains` uses; `--domains` narrows them explicitly. Record the settled commit ID `S`.
3. Record the tail: keep recording for `tailMs` (default `quietMs`, at least 500 ms). Record commits after `S`.
4. Freeze with `react_profile_stop`, then read every evidence section once, with `appOnly:false` and the full view where advertised (`hub/full-view.ts` `withFullView`). Paginate `react_render_causes` and `react_effect_timeline` with `afterCommit` and `afterDocumentCommitId` from the window start until exhausted.
5. Re-check document identity and observation ID after reading. Evaluate guards and claims, write the ledger entry, retain the evidence, release the lock, and return.

### 3.3 Why settle before freeze

`InteractionManager.stopActive` freezes first and settles afterwards. It calls `react_profile_stop`, probes the stop commit, then calls `settle`, and labels later commits `excluded-by-profile-freeze` (`boundary.postInteractionPolicy`). That order measures "what happened before I said stop". `EVIDENCE.md` section 1 therefore tells the agent to wait for the requested work before `devtools_interaction_stop`.

For a verdict, that order is a false-pass source. If the agent ends the window right after a click, a Query result that arrives 300 ms later and re-renders the target falls outside the window, and "renders max 0" passes. `verify` therefore settles first and freezes after the tail. Work that happens after quiet and inside the tail is visible, and a target render in the tail refuses with `not_quiescent`.

`devtools_interaction_stop` keeps its current order and contract. The shared window code takes the order as a parameter.

One interaction with the collector needs a fix before this works without false refusals. While paused, the commit handler in `collectors/react/render-tracker.ts` increments `analysisFailedFibers` for every commit. Commits that arrive after the freeze would then mark coverage incomplete for a window that was complete. `verify` reads the evidence immediately after freezing and compares the coverage counters against a snapshot taken at the freeze, and phase 0 separates "paused" commits from failed analysis in the collector.

### 3.4 Window guards

Every guard is evaluated at `end` and stored with its raw value.

| Guard | Source | Refusal |
| --- | --- | --- |
| Same document throughout | `isCurrentSession`; `documentGeneration`; no `logicalSessionCollision` (`protocol/protocol.ts` `sessionSummarySchema`) | `session_changed` |
| Window not reset or paused | `observation.id` on every read equals the window's; `tracking` true until the freeze | `window_interrupted` |
| Development bundle | `bundle` from `collectors/react/measurement-environment.ts` `getMeasurementEnvironment` is `development`, or `mixed` with every target's `react_component_cohort` `rendererBundle` `development` or `null` at `begin` and `end` | `unsupported_environment` |
| Render collection works | `renderCollection` accepted by the same rule as `checkSettleDomain` | `unsupported_environment` |
| No code change | `react_refresh_events` sequence unchanged since `begin` | `code_changed` |
| Document visible | new visibility record, phase 0 | `document_hidden` |
| No overrides | `react_list_overrides` empty and no simulated Query state, at `begin` and `end` | `override_active` |
| Something happened | at least one React commit in the window | `no_activity` |
| App settled | settle outcome `met` | `not_quiescent` (claim-specific, section 2.4) |
| Window alive | verification found and not expired | `window_lost` |

Observation IDs are not unique across documents. `collectors/react/observation.ts` `beginObservation` builds them as `observation:${observationEpoch}` from a module counter that restarts with each page load. `verify` always compares the pair of document identity and observation ID.

`--allow-overrides` turns `override_active` into a caveat for runs that deliberately simulate a state, such as checking an error screen. The verdict then states that overrides were active.

### 3.5 Disruptions in the middle of a window

| Event | What `verify` does |
| --- | --- |
| Full reload, hard navigation, closed tab | The document is no longer current. `end` refuses every claim with `session_changed`. The fix is `verify begin` on the new document and the interaction again. |
| Client-side navigation | Same document; the window continues. A `route` claim covers it. |
| Tab switch or minimized window | The visibility record shows a hidden interval. Refuse with `document_hidden`. On React Native, `AppState` `background` counts as hidden. |
| Fast Refresh / HMR | Refresh commits never advance `documentCommitId`: the commit handler in `render-tracker.ts` returns early when `isRefreshCommit()` is true, after `invalidateLiveInstancesForRefresh`. Renders in those commits are invisible, so any refresh in the window refuses with `code_changed`. |
| A second agent or a stray command resets the window | While a verification is active, the hub rejects `react_clear_renders`, `react_profile_start`, `react_profile_stop` and `devtools_interaction_begin` for that document with a new hub code, `VERIFICATION_ACTIVE`, whose details name the `verificationId` and the `verify abort` command. The hub cannot tell agents apart (each CLI call is a new connection), so the lock applies to everyone. If a reset still happens, for example from an older hub, the observation ID changes and `window_interrupted` refuses. |
| A second `verify begin` on the same document | Rejected with `VERIFICATION_ACTIVE`, the same one-recording-per-document rule `InteractionManager.begin` enforces with `INTERACTION_ACTIVE`. |
| Settle timeout | Claims are decided by their tables: upper-bound claims refuse with `not_quiescent`, `effect-settles` can fail, lower-bound claims can still pass. |
| CLI timeout while `end` runs | Exit 124. The hub finishes the evaluation; a repeated `verify end <id>` returns the stored verdict. |
| No `end` within `--max-duration` (default 5 minutes) | The hub expires the window and releases the lock. `end` then refuses with `window_lost`. |
| Hub restart | Verification state is lost. `end` gets `VERIFICATION_UNKNOWN` and the CLI reports `refused` with `window_lost`, never `pass`. |

### 3.6 Relationship to existing tools

| Existing piece | Use in `verify` |
| --- | --- |
| `devtools_interaction_begin/stop` (`hub/interaction-manager.ts`) | Shares the begin path and the evidence reads. The stop order becomes a parameter. The public tools keep their contracts. |
| Observation IDs (`collectors/react/observation.ts`) | Bound to the document; checked on every read. |
| `react_quiesce`, `devtools_wait` (`hub/bridge.ts` `handleQuiesce`, `handleWait`) | Their poll logic (`pollCondition`, `checkSettleDomain`) provides settle. The agent no longer calls them for a verification. |
| `devtools_capture_create/compare` (`hub/capture-manager.ts`, `hub/capture-comparison.ts`) | `verify compare` reuses the statistics; see section 6. The capture tools stay for ad hoc snapshots. |

## 4. The verdict model

### 4.1 Verdicts

| Verdict | Meaning | Exit |
| --- | --- | --- |
| `pass` | The evidence proves every claim under the stated window and guards | 0 |
| `fail` | The evidence proves at least one claim false | 1 |
| `refused` | Genie will not answer because the evidence is not good enough; each refusal names a reason and a fix | 4 |
| `inconclusive` | The evidence is complete and valid but does not decide the claim | 5 |

A refusal is a result, not a CLI failure envelope. It carries the partial evidence that was gathered, so the agent can see what it would have needed. CLI failures (unreachable hub, invalid arguments) keep the existing envelope from `cli/failure.ts`.

### 4.2 Refusal reasons

Closed list. Each reason has a fixed message template and a fix. The CLI builds `next.command` and `next.argv` from the original invocation, keeping `--session`, in the same way `cli/output-recovery.ts` builds suggestions today.

| Reason | When | Fix in `next` |
| --- | --- | --- |
| `coverage_incomplete` | Render or effect coverage is incomplete for a reason other than a budget (skipped commit Fibers, failed analysis, dropped unmounts) | Begin again; if it repeats, narrow the window to fewer components or roots |
| `budget_exhausted` | `coverage.budgetAdvice` present | `verify begin` with `--budget` set to `suggestedBudget` |
| `evidence_truncated` | Events evicted, dropped or omitted by limits; event counts disagree with render counts | Begin again with a shorter interaction or larger `lifecycle.bufferLimit` |
| `evidence_inferred` | The deciding evidence is `inferred` or `unknown` | Change the claim to one that exact evidence can decide, or investigate with the named tool |
| `evidence_unavailable` | The collector cannot observe the needed stage, such as effect execution | Setup fix named by the collector reason |
| `not_quiescent` | Settle did not finish, or the target was active in the tail | Raise `--quiet-ms` or `--timeout-ms`, or narrow `--domains` (the message warns that a narrowed domain is no longer waited for) |
| `no_activity` | No React commit in the window | Drive the tab Genie observes (the URL is printed), then begin again |
| `target_not_found` | No matching instance at `begin` or in the window; no cache entry for the query key | Check the name with `react_find_components` or `query_list` |
| `target_ambiguous` | One name, several source files; a legacy query name with several entries | `verify begin` with `@<file>` or a `queryHash`, listing the candidates |
| `target_inactive` | Every matched instance was frozen, hidden or suspended | Make the target visible, or claim on a visible instance |
| `session_changed` | The document changed: reload, hard navigation, closed tab, logical session collision | `verify begin` on the current document |
| `window_interrupted` | The observation was reset or profiling paused during the window | `verify begin` and avoid other render-window commands until `end` |
| `code_changed` | Fast Refresh applied during the window | `verify begin` after the edit, then the interaction again |
| `document_hidden` | The document was hidden at any point in the window | Bring the tab to the front, then begin again |
| `override_active` | Overrides or simulated Query state were active | `react_reset_overrides` and `query_restore_state`, or pass `--allow-overrides` deliberately |
| `unsupported_environment` | Production bundle, a target hosted by a production renderer, render collection unavailable | Run the development build; follow `doctor --live` |
| `capability_unavailable` | The app does not advertise a tool the claim needs | Set up the collector, such as `<Genie />` for Query and Router |
| `too_few_samples` | A cohort lacks usable runs (section 6) | Run N more `verify` runs in the named cohort |
| `not_comparable` | Cohorts differ in environment, coverage policy, claims or warmth | Rerun both cohorts under the same conditions |
| `window_lost` | The verification expired, was evicted, or the hub restarted | `verify begin` |

Inconclusive reasons, also closed: `not_significant` (comparison confidence below the level), `below_minimum_effect`, `strict_mode_replay`, and `mixed_instance_evidence` (some matched instances exact, others not, and the exact ones do not decide).

### 4.3 One exit-code taxonomy for the CLI

Today every command exits 0 or 1 (`cli/cli.ts` `main`; `docs/json-cli.md`: "Exit codes remain 0 for command success and 1 for failure"). `--fail-on-result-error` makes a failed wait or quiesce exit 1 (`cli/agent.ts` `runCall`). The proposed taxonomy:

| Code | Class | Current reasons that map to it |
| --- | --- | --- |
| 0 | success, `pass` | success |
| 1 | failure, `fail` | `tool_error`, `tool_unavailable`, `operational_failure`, a failed wait under `--fail-on-result-error` |
| 2 | usage | `invalid_input`, `invalid_args`, `unknown_tool`, `unknown_session`, unknown flags |
| 3 | needs a human | `bridge_rejected` (the hub refused the connection; `cli/failure.ts` sends it to `doctor --live`), and setup steps that `init` or `doctor` marks manual |
| 4 | refused | `verify` refusals |
| 5 | inconclusive | `verify` inconclusive verdicts |
| 69 | unreachable | `bridge_unreachable`, `not_connected` |
| 124 | timeout | `timeout`, `busy` |
| 130 | interrupted | SIGINT |

69 is `EX_UNAVAILABLE` from `sysexits.h`; 124 matches GNU `timeout`; 130 is the shell convention for SIGINT. All codes stay below 126 except 130, so they do not collide with the shell's "not executable" and "not found" codes.

Migration without silently breaking scripts:

1. `verify` uses the taxonomy from its first release. No script depends on it yet.
2. Every CLI failure envelope gains an additive `exit: { code, class }` field now, carrying the code the command will use after the switch. Scripts can migrate to it ahead of time.
3. The other commands switch at 1.0, declared in the 1.0 changeset and in `docs/json-cli.md`. Every new code is nonzero, so scripts that test `if genie-react ...` or `|| exit` keep working. Only scripts that compare `$? -eq 1` change behavior, and the changeset says so.
4. `GENIE_EXIT_CODES=legacy` restores 0 and 1 for one minor release after 1.0, then goes away.

## 5. Rule migration

Every rule in `skills/genie/EVIDENCE.md`, and the evidence rules in `SKILL.md` section 3, with the check that replaces it.

| # | Rule today | Enforced by `verify` | Prose that remains |
| --- | --- | --- | --- |
| 1 | Keep `observation.id` to join render, cause, notification and effect evidence | The window binds document identity and observation ID; every read is checked (`window_interrupted`) | None for `verify` users |
| 2 | React quiet covers commits only; wait for Query or Router work separately with `devtools_wait`, listing only advertised domains | Settle domains default to every advertised domain; `--domains` narrows explicitly | None |
| 3 | Timeline: start with a name, keep the ID, stop, read every page, check lane coverage, `stopReason` and truncation; order is temporal, not causal; native request timing is unavailable | Not covered; timeline claims are outside 1.0 | Stays as written |
| 4 | Interaction: begin with a name, keep `interactionId`, wait before stop, stop freezes before settle, one recording per document, another clear can invalidate it | `verify` owns the window, settles before freezing, and locks the document | Stays for direct use of `devtools_interaction_*` |
| 5 | `exact` supports only its link; `inferred` is a lead; `unknown` leaves the question open | Decision tables; `evidence_inferred` | One sentence: `verify` will not pass on inferred evidence |
| 6 | `lower-bound` counts can omit work; check coverage before reading an empty or smaller result | Upper-bound claims pass only on exact evidence; lower bounds can only fail them | None |
| 7 | Require complete input attribution before calling a render unnecessary; timing can be complete while causes are partial | `render-causes` requires `inputCoverage.complete` per event; no "unnecessary" claim in 1.0 | Stays for manual investigation |
| 8 | `appOnly:true` excludes unresolved ownership; use `react_provenance` or `appOnly:false` | `verify` reads with `appOnly:false` and filters by exact name and source | Stays for manual reads |
| 9 | Exact Query and Router causes need the matching notification; nearby timestamps do not establish a cause | `query ... delivered-to` requires the notification ID join | None |
| 10 | Effect scheduling does not prove execution or cleanup | `effect-runs` counts observed executions only; `evidence_unavailable` otherwise | None |
| 11 | Quote timings with bundle, device, visibility and collection conditions; development timings do not estimate release | The `environment` block is always in the verdict; production bundles refuse; budget results carry the development caveat | The sentence about release estimates |
| 12 | Repeat the same action under equivalent conditions | Cohorts require one claim fingerprint and one environment and coverage signature | None |
| 13 | Compare defaults to five usable samples after one warm-up; collect six | `verify compare` counts usable runs and names how many more are needed | None |
| 14 | Clear or restart the window before each run, check the UI, wait, then capture | Each run is its own verification; UI checking stays with the agent | "Check the visible result with the UI driver" |
| 15 | Repeated snapshots of one run are not separate samples | One verification is one sample, unique by document and observation | None |
| 16 | Inspect `comparable`, `notComparableReasons`, confidence and budget verdicts | Mapped into the verdict (section 6.3) | None |
| 17 | `pass` means the budget passed; an improvement also needs direction and effect | Budget rules state direction; an `improves` rule requires significance and the minimum effect | None |
| 18 | `informational`, `inconclusive`, `not-comparable`, `insufficient-data` are not passing | Mapped to `inconclusive` or `refused`; never `pass` | None |
| 19 | Pin captures while collecting, export, unpin; retention is bounded | The ledger stores compact samples, so no pinning; ledger bounds are reported | Stays for raw captures |
| 20 | Require `outcome: "idle"` from quiescence (SKILL.md section 3) | Settle outcome is a guard | None |
| 21 | When `budgetAdvice` is present, clear with `suggestedBudget` and repeat (SKILL.md section 3) | `budget_exhausted` with the built command | None |
| 22 | A timeout or unavailable collector means the measurement is incomplete (SKILL.md section 3) | `not_quiescent`, `unsupported_environment`, `capability_unavailable` | None |
| 23 | Inspect both the exit code and the result status (EVIDENCE.md section 4) | For `verify`, the exit code maps one to one to the verdict | Stays for other commands |
| 24 | Output framing, truncation, `outputPath`, failure `details`, `correctedExample`, `mayHaveCompleted` (EVIDENCE.md section 4) | Not affected; the verdict is bounded by construction (section 7) | Stays |

After migration, `EVIDENCE.md` section 2 shrinks to the manual-investigation rules (rows 7 and 8) and a pointer to `verify`. Section 3 becomes "use `verify compare`" plus the raw-capture rules for people who compare by hand.

## 6. Before and after

### 6.1 Run-level and cohort-level evidence

Behavioral claims (render counts, causes, effects, Query, Router, boundaries) are decided per run. Counts in a development build can still vary between runs, for example when a request finishes before or after a debounce, so an agent that wants stability passes `--require-consecutive K` on `verify begin`. The verdict is then `pass` only when the last K runs with this claim fingerprint passed on the same code, and `inconclusive` until there are K.

Performance claims are decided over cohorts. Each `verify begin --cohort <label>` run records a compact sample when it completes: the metric values from its frozen window, the coverage signature, the environment signature, the document generation and whether the run was the first in its document.

### 6.2 `verify compare`

```bash
npx genie-react verify compare --session my-agent \
  --baseline before --candidate after \
  --budget 'react.renders max-regression 0%' --budget 'react.updates max-value 10'
```

Rules:

- Both cohorts must share one claim fingerprint (section 6.4), one environment signature and one coverage signature. Today environment differences only produce a warning (`hub/capture-comparison.ts` `environmentWarnings`); `verify` refuses with `not_comparable`. Coverage signatures reuse `renderCoverageSignature` and `crossCohortReasons`.
- Only runs whose run-level claims passed are usable. A run whose behavior failed is a measurement of broken behavior and is listed as excluded with reason `behavior-failed`.
- Each run is one sample by construction. `compareCaptureCohorts` accepts any list of capture IDs; nothing stops two captures of one window from counting twice. `verify` cannot produce two samples from one window.
- Warmth must match. If every run reloads first, every run is cold; if no run reloads, only the first run in each document is cold. A cohort that mixes the two refuses with `not_comparable` and reason `warmth-mismatch`. The warm-up discard from `devtools_capture_compare` (`warmupRuns`, default 1) still applies.
- The defaults stay as `devtoolsCaptureCompareContract` defines them: `minimumRuns` 5, `warmupRuns` 1, `confidenceLevel` 0.95, `minimumEffectPct` 5. When a cohort is short, the refusal says how many more runs it needs and gives the `verify begin` command that adds one.
- Budget metrics in 1.0 are `react.commits`, `react.renders`, `react.updates`, `react.selfTimeMs` and `effects.hot`, read from the frozen window. Memory and frame metrics need sampling during the interaction, not a snapshot afterwards, and are left out. `react.selfTimeMs` results carry the development-timing caveat.

### 6.3 Mapping comparison results to verdicts

| `compareCaptureCohorts` `overall` | `verify` verdict |
| --- | --- |
| `pass` | `pass` |
| `fail` | `fail` |
| `not-comparable` | `refused`, `not_comparable` |
| `insufficient-data` | `refused`, `too_few_samples` |
| `inconclusive` | `inconclusive`, `not_significant` or `below_minimum_effect` |
| `informational` | usage error (exit 2): `verify compare` requires at least one budget |

The statistics stay in one place. Phase 2 moves `compareMetric`, `rejectOutliers`, `summarizeSamples`, `permutationPValue` and `quantile` from `hub/capture-comparison.ts` into `hub/sample-statistics.ts`, which works on numeric samples. `compareCaptureCohorts` keeps its contract and calls it after extracting values from captures; `verify compare` calls it with ledger samples. Ledger samples are small, so cohorts no longer depend on the 20-capture retention limit (`hub/capture-manager.ts` `MAX_RETAINED_CAPTURES`) or on pinning.

### 6.4 The rerun ledger

Every completed, refused or expired verification writes one ledger entry. The claim fingerprint is a hash of the canonical claim JSON, the target sources, and the app origin and pathname. The free-text `name` is excluded, so renaming a run does not reset its history.

Each verdict shows the attempt number and the history for its fingerprint on the same logical session:

- `attempt`: this run's position.
- `history`: earlier verdicts with their reasons.
- `codeChangedSincePrevious`: `fast-refresh` when `react_refresh_events` shows a refresh between the runs, `document-reloaded` when the document generation changed (a reload may or may not carry new code), `none-observed` otherwise.
- `failsOnSameCode`: the number of earlier `fail` verdicts since the last observed code change.

When a run passes with `failsOnSameCode` above zero, the verdict stays `pass`, because the claim held in that run. It gains the caveat `passed-after-failures-on-same-code`, and the compact text puts it on the first line:

```text
pass vfy_x81c "add task"  attempt 4: 2 earlier runs failed on the same code
```

Refusals appear in `history` but do not count toward `failsOnSameCode`, since they decided nothing. The skill tells the agent to quote the attempt line when it reports a result, and the eval grader checks it (section 9).

Where the ledger lives is open question 4. The recommendation is a file in the private per-user directory the CLI already uses for output spills (`genie-react-<uid>` under `$XDG_RUNTIME_DIR` or the temp directory, `docs/json-cli.md`), keyed by project root and logical session, bounded to 500 entries. An in-memory ledger would reset when the dev server restarts, which would hide retries.

## 7. Evidence behind the verdict

The verdict is small by design. Per claim, the default output shows:

- the verdict and the claim text;
- the observed value with its semantics (`exact` or `lower-bound`) and instance count;
- the deciding evidence, at most three items: for a fail, the first violating events; for a pass, the coverage facts that made the count exact and the instance that was active; for a refusal, the failed guard with its raw values;
- caveats;
- the refusal reason and fix.

The run adds the window line (commits, settle time, domains), the attempt line and the evidence command. With at most 20 claims and three deciding items each, the JSON verdict stays far below the CLI's 102,400-byte default ceiling (`docs/json-cli.md`). The `verdict` and `exitCode` fields come first, so a truncated document still says what happened, and the exit code never depends on parsing.

Everything else stays behind the handle:

```bash
npx genie-react verify show vfy_2m7d --session my-agent
npx genie-react verify show vfy_2m7d --claim 1 --session my-agent
npx genie-react verify show vfy_2m7d --section guards --session my-agent
npx genie-react verify show vfy_2m7d --section raw:react_render_causes --session my-agent
```

`--claim N` returns every deciding item for that claim: render event IDs with full causes, effect executions, notification IDs and joins. `--section guards` returns each guard with its raw input and source tool. `--section raw:<tool>` returns the retained tool result, as `devtools_interaction_stop` does with `view:"full"` and `sections`. Retention follows the interaction manager: the 20 most recent verifications (`MAX_COMPLETED_INTERACTIONS` in `hub/interaction-manager.ts`), each at most 2,000,000 bytes like a capture (`MAX_CAPTURE_BYTES` in `hub/capture-manager.ts`). The ledger keeps verdicts after the evidence is evicted. `verify show` for evicted evidence says so and returns the ledger entry.

## 8. False-pass analysis

A false pass is `pass` when the claim is false. Each row names the failure and the mechanism that prevents it. Section 10 turns every row into a test that would pass wrongly if its mechanism were removed.

| # | How `verify` could pass a false claim | Prevention |
| --- | --- | --- |
| 1 | **Stale identity.** A target resolved by Fiber ID before a reload now names a different component, or nothing | Targets are names, never IDs. Instances resolve per document, and a document change refuses with `session_changed`. |
| 2 | **Remount with a new ID.** The fix changes a `key`, so each render becomes an unmount and a mount; `updates` drops to zero | The default count includes mounts. `counting updates` still fails `max` claims on remounts, detected through `logicalPath` and `mountGeneration`, unless `allow-remount` is given. |
| 3 | **Renamed component.** The agent renamed `StatusBadge` during the fix, so the claim matches nothing and "renders 0" holds trivially | A target must be observed (mounted at `begin` or mounted in the window). Otherwise `target_not_found`. |
| 4 | **Name collision or substring match.** `Checkout` matches `CheckoutRow`; two `Row` components in different files are merged | Exact name matching in the hub; grouping by source file; `target_ambiguous` for more than one source. |
| 5 | **Work skipped by a budget.** The target's Fibers were not analyzed, so its renders were not counted | Upper-bound claims require `coverage.complete`, `semantics: "exact"`, `targeted.complete` and no `budgetAdvice`. Otherwise `budget_exhausted` or `coverage_incomplete`. |
| 6 | **Evicted events.** Render or effect events fell out of bounded retention, so a count built from events is low | Counts come from aggregates, and event lists are cross-checked against them. Retention gaps (`droppedRenderEvents`, `evictedEvents`, `omittedByLimit`, `renderEventRetention`) refuse with `evidence_truncated`. |
| 7 | **Reading before the app settled.** The target re-renders when a request resolves after `end` | Settle runs before the freeze, across every advertised domain, and the tail watches for late renders of the target (`not_quiescent`). The residual risk is work scheduled beyond quiet plus tail; the verdict prints the horizon, and `--quiet-ms` raises it. |
| 8 | **The interaction never happened.** The driver failed, or acted on another tab, and "renders 0" holds because nothing ran | `no_activity` refuses a window without React commits. The skill recommends a positive control claim (`min 1` on a component that must change), which turns this case into a `fail`. Every verdict prints the session URL. |
| 9 | **The wrong session.** Genie observed a different tab or a cloned document | The verification binds `sessionId`, `logicalSessionId` and `documentGeneration`. `end` must reach the same document. Untargeted calls with several tabs already fail with `SESSION_AMBIGUOUS` (`hub/bridge.ts`), and a logical session collision refuses with `session_changed`. The positive control and `no_activity` catch a quiet wrong tab. |
| 10 | **A hidden tab.** Background timers are throttled, so deferred work waits until the tab is visible, after the quiet window | The visibility record refuses any window with a hidden interval (`document_hidden`). Today only `browser_fps` reports hidden samples (`collectors/perf.ts`); phase 0 adds the record. |
| 11 | **A production React copy, or two copies.** Production builds strip development data, and a second React copy can render a subtree Genie's hook does not see | `production` and `unknown` page bundles refuse. A `mixed` page refuses only when a production or unidentified renderer hosts a target, because frameworks run their own UI on production React (the `next dev` overlay) and Genie analyzes none of its commits: one in the window makes coverage incomplete, so upper bounds and `boundaries clean` refuse. A component rendered by an unregistered renderer is never found, so `target_not_found` refuses instead of passing. |
| 12 | **StrictMode.** Development StrictMode replays effects on mount | Replays inflate counts, so StrictMode cannot cause a false pass. It can cause a false fail; `strict_mode_replay` makes that case `inconclusive`. Phase 0 adds StrictMode detection; nothing in the collectors reports it today. |
| 13 | **Fast Refresh during the window.** Refresh commits are excluded from profiling, so renders in them are invisible | Any refresh in the window refuses with `code_changed` (the `isRefreshCommit` branch in `render-tracker.ts`). |
| 14 | **The window was reset or paused.** Another agent called `react_clear_renders`, losing earlier renders, or `react_profile_stop` paused counting | The document lock rejects those calls. If one still happens, the observation ID check or the paused-commit coverage gap refuses with `window_interrupted` or `coverage_incomplete`. |
| 15 | **Overrides or simulations.** The state came from `react_override_*`, a forced boundary, a forced fallback or `query_simulate_state`, not from the code | `override_active` at `begin` and `end`, unless `--allow-overrides`, which the verdict then states. |
| 16 | **An inactive target.** The target did not render because it was frozen, hidden in an Offscreen tree or suspended, not because the fix worked | `target_inactive` unless an instance was `mounted-rendering` during the window. |
| 17 | **Hidden ownership.** `appOnly:true` excluded the target because its source ownership was unknown | `verify` reads with `appOnly:false`. |
| 18 | **Inferred causes read as proof.** A parent or external-store cause, or a Query cause matched by timing | `render-causes` passes only on exact causes; `begin` rejects claims that need `parent` or `external-store`; `query delivered-to` needs the notification ID join. |
| 19 | **Effect scheduling read as execution.** | Counts use `execution.status: "observed"`; `evidence_unavailable` when execution is not instrumented. |
| 20 | **A slow effect loop.** An effect re-runs every 3 seconds; quiet and tail pass | The claim is named `settles` and the verdict prints its horizon. The residual risk is stated, not hidden. `--tail-ms` extends the horizon. |
| 21 | **Boundary reset during the window.** A boundary caught an error and recovered before `end` | The phase 0 catch log; until then the claim is `boundaries clean-at-end` and says so. |
| 22 | **Uncaught errors.** The app threw outside any boundary | Not observed; every `boundaries` result carries a caveat, and no "no errors" claim exists. |
| 23 | **Rerunning until it passes.** A flaky interaction passes on the fourth try | The ledger records every attempt, and a pass after failures on the same code says so on the first line. `--require-consecutive K` demands stability. |
| 24 | **Claim shopping.** The agent reads the evidence, then picks a claim that passes | Claims are fixed at `begin`. `verify show` cannot change a verdict. |
| 25 | **Mixed-up samples in a comparison.** Snapshots of one run counted twice; cohorts from different environments | One run is one sample; environment, coverage, claim and warmth mismatches refuse with `not_comparable`. |
| 26 | **Reading during commits.** Evidence read while React still commits mixes two states | Reads happen after the freeze; `attribution.status: "stale"` on any report refuses with `coverage_incomplete`. |
| 27 | **Hub restart or expiry.** The verification state is gone | `window_lost`; the CLI never fills in a verdict. |
| 28 | **Truncated output.** A cut-off JSON document is read as a pass | The verdict is bounded, its fields come first, and the exit code carries the verdict. |
| 29 | **A forged verdict from the app.** App code registers a tool named like a hub tool | The hub answers `devtools_verify_*` before forwarding (as `handleInvoke` does for capture and interaction tools), and the CLI trusts hub codes only from hub-answered tools. |

What `verify` still cannot see, and says so in every verdict: the visible UI (caveat `ui-outcome-not-observed`), work beyond the horizon, uncaught errors outside boundaries, and network requests without Query.

## 9. Evaluation

### 9.1 What to measure

The question is whether agents are right more often when they report a fix. The current harness grades fix tasks by diff scope, typecheck and a runtime probe, and records but does not grade the agent's JSON answer (`evals/run.mjs` `executeTrial`, `answerChecks`). It does not ask whether the agent claimed the fix was confirmed. Add to the answer shape in `evals/lib/agents.mjs` `buildPrompt`:

```json
{"component": "...", "cause": "...", "file": "...", "verified": "pass|fail|not-verified", "verification": "<vfy id or null>"}
```

New metrics in `evals/lib/report.mjs` `summarizeTasks`:

- **False-pass rate**: trials where the agent reports `verified: "pass"` and the probe fails, divided by trials that report `pass`. This is the headline number.
- **Calibration**: the share of trials where the reported `verified` matches the probe.
- **Unbacked confirmations**: trials that report `pass` without a passing `verify` in the transcript, measured in the `verify` arm.
- **Refusal recovery**: the share of refused verifications followed by a rerun that applies the suggested fix.
- **Cost**: Genie calls, tokens and wall time per trial, as reported today.

### 9.2 Arms

- `control`: the current skill, and the command allowlist denies `genie-react verify`. The allowlist already decides which Genie subcommands an agent may run (`evals/README.md`, threat model).
- `verify`: the skill with the `verify` section, and the allowlist permits `verify begin|end|show|abort|compare`.

A run takes `--arm control|verify`. Results compare arms task by task with counts, not only rates, because trial counts are small. The run report gives the Fisher exact test p-value for the false-pass difference.

### 9.3 New tasks

Each new fix task has a seeded bug and also a `decoyFixes` list: edits that look like fixes and are not. `pnpm eval --dry-run --runtime` already proves each probe fails on the bug and passes on the reference fix (`evals/run.mjs` `validateProbe`); it gains a third check that the probe fails on every decoy.

| Task | Bug | Decoy that fools a naive check |
| --- | --- | --- |
| `async-rerender-fix` | A badge re-renders when a debounced search request resolves about 300 ms after typing | None needed: reading immediately after typing shows 0 renders |
| `wide-list-budget-fix` | Editing one row of 500 re-renders every row | A naive read under the default budget shows a lower bound |
| `remount-key-fix` | A memoized row re-renders on every keystroke | Adding a `key` that changes every render: updates drop to 0, mounts climb |
| `effect-slow-loop-fix` | An effect sets state from a timer every 700 ms | A read after 500 ms of quiet sees nothing |
| `query-delivery-fix` | A mutation invalidates the wrong key (the existing Tasks bug, as a fix task) | Calling `refetch()` on a different query |

### 9.4 Fix the probe first

`evals/lib/probe.mjs` `runProbe` reads `react_get_renders` and checks `tracking` and `updates` without coverage, and it waits a fixed `settleMs` before quiescing. A probe that can pass a broken fix makes every metric above unreliable. Phase 1 changes the probe to run `verify` with the task's claims and to grade on the exit code, keeping the existing checks as a cross-check. The `--dry-run --runtime` decoy check then shows the probe cannot be fooled by the decoys.

### 9.5 A tool-level false-pass suite with no model

Agent evals cost money and are noisy. The property `verify` must hold is deterministic, so a separate suite tests it without a model. `scripts/check-verify-e2e.mjs` starts the fixture app in Chromium with Playwright, as `scripts/check-timeline-e2e.mjs` does, and scripts one scenario per row of section 8: the claim is false, the disruption is applied, and the suite asserts the verdict is not `pass`. A matching clean scenario asserts the verdict is `pass`, so the suite also measures false refusals. The gate is zero false passes and zero false refusals on clean scenarios. It runs in CI.

### 9.6 Cost control

Live agent runs bill a model account. They run only with the owner's approval of the account, model, trial count and a per-trial cap through the existing `--max-budget-usd` flag. A first comparison needs at least the 6 dev fix tasks (the current fix task plus the five above) times 2 arms times 3 trials, which is 36 trials. CI runs only `pnpm eval --dry-run` and the tool-level suite.

## 10. Implementation plan

### Phase 0: prerequisites in collectors and hub

Each item is small and lives in its own file, so they can be built in parallel.

| Item | Files | Why |
| --- | --- | --- |
| Visibility record: hidden intervals since the window start, `AppState` on React Native | new `collectors/visibility.ts`; adapter in `native/` | Guard `document_hidden` (section 8, row 10) |
| StrictMode detection from root Fiber mode bits | `collectors/react/measurement-environment.ts` | `strict_mode_replay` (row 12) |
| Boundary catch log with `documentCommitId`; `afterDocumentCommitId` input on `react_error_state` | `collectors/react/error-tracker.ts`, `collectors/react/contracts.ts` | `boundaries clean` (row 21) |
| Eviction count on `query_notifications` | `collectors/tanstack/query.ts`, `collectors/causal/external-store-registry.ts` | `delivered-to` can fail by absence |
| Simulated-query listing | `collectors/tanstack/query.ts` | `override_active` without reading every query |
| Separate paused commits from failed analysis | `collectors/react/render-tracker.ts` commit handler | No false `coverage_incomplete` after the freeze (section 3.3) |
| `VERIFICATION_ACTIVE`, `VERIFICATION_UNKNOWN` hub codes | `protocol/protocol.ts` `HUB_ERROR_CODES`; `cli/failure.ts` guidance | Lock and lost windows |

### Phase 1: renders, causes, effects, boundaries

Three engineers can build this without editing the same files.

**Engineer A: protocol and hub lifecycle.**

- `protocol/verify.ts` (new): claim schemas, verdict schema, `REFUSAL_REASONS`, `INCONCLUSIVE_REASONS`, and the `devtools_verify_*` contracts. Registered in `protocol/tools.ts` `metaTools` and exported from `protocol/index.ts`. This lands first, on day one, with the `ClaimEvaluator` interface: `(claim, evidence: VerificationEvidence) => ClaimResult`. Engineers B and C build against it.
- `hub/verification-manager.ts` (new): begin, end, abort, expiry, retention, guard collection, settle-then-freeze and the tail.
- `hub/interaction-manager.ts`: extract the begin sequence and the evidence reads into `hub/observation-window.ts` (new), with the stop order as a parameter. `devtools_interaction_*` keep their behavior and tests.
- `hub/bridge.ts`: route `devtools_verify_*` in `handleInvoke`; reject window-resetting tools on locked documents before `forwardToApp`.
- `hub/verification-ledger.ts` (new): in memory in phase 1, behind an interface the phase 2 file store implements.

**Engineer B: evaluators, pure functions over retained evidence.**

- `hub/verify/evidence.ts`: typed readers over retained tool results, replacing ad hoc `recordOf` chains.
- `hub/verify/guards.ts`, `hub/verify/claims/renders.ts`, `hub/verify/claims/render-causes.ts`, `hub/verify/claims/effects.ts`, `hub/verify/claims/boundaries.ts`.
- `hub/verify/verdict.ts`: combination (section 2.6), refusal messages and the structured fix data the CLI turns into commands.

**Engineer C: CLI, skill, evals.**

- `cli/verify-command.ts`, `cli/verify-claims.ts` (DSL parser), `cli/verify-output.ts` (compact text through WS1's renderer, and JSON), `cli/exit-codes.ts` (the taxonomy and the mapping from `FailureReason`).
- `cli/cli-help.ts` (`COMMANDS`, `COMMAND_OPTIONS`, option details) and the `cli/cli.ts` `main` switch.
- `skills/genie/SKILL.md` and `EVIDENCE.md`, synced by `scripts/sync-skill.mjs`; `docs/json-cli.md`; a docs page `apps/docs/content/docs/workflows/verify-a-fix.mdx`.
- `evals/lib/probe.mjs`, `evals/lib/agents.mjs`, `evals/lib/grade.mjs`, `evals/lib/report.mjs`, the new tasks and fixture screens, and `scripts/check-verify-e2e.mjs`.

Ownership boundaries: A owns `protocol/verify.ts`, `hub/bridge.ts` and the window extraction; B owns `hub/verify/**`; C owns `packages/cli/**`, `skills/`, `docs/` and `evals/`. Phase 0 items go to whoever has capacity, one collector file each.

### Phase 2: Query, Router, Suspense, cohorts

- `hub/verify/claims/query.ts`, `route.ts`, `suspense.ts` (Engineer B).
- `hub/sample-statistics.ts`, extracted from `hub/capture-comparison.ts` with no change to `devtools_capture_compare` output; `devtools_verify_compare` (Engineers A and B).
- The file-backed ledger and `--require-consecutive` (Engineer A).

### Phase 3: 1.0

- The exit-code switch for every command, with the changeset and `GENIE_EXIT_CODES=legacy` (Engineer C).
- `EVIDENCE.md` reduced to the remaining prose (section 5).
- The paid A/B eval run, after the owner approves its budget.

### Test strategy

- **Evaluator unit tests**, table-driven over recorded evidence fixtures. Every refusal reason, every inconclusive reason and every decision-table row has a case. Every row of section 8 has a test that removes the protecting mechanism and shows the verdict would become `pass`, so the test fails if someone deletes the guard.
- **A degradation property** over generated evidence: degrading any input (setting `coverage.complete` false, switching semantics to `lower-bound`, adding evictions, changing the observation ID) never turns a non-pass into `pass`, and never yields `pass` for an upper-bound claim.
- **Hub integration tests** on `hub/bridge-test-harness.ts` with fake app sessions: reload in the middle, logical session collision, a lock rejection, a reset that slips past the lock, expiry, idempotent `end`, hub restart.
- **Browser end-to-end**: `scripts/check-verify-e2e.mjs` (section 9.5).
- **CLI transcripts**: extend `scripts/check-cli-json.mjs` for `verify` exit codes, text and JSON parity, refusal `next.argv`, and the `exit` field on failure envelopes. Run the `packages/cli/AGENTS.md` checklist.

### Left out of 1.0

- Timeline claims, such as "the request finished before the render".
- Uncaught error and unhandled rejection claims; they need a new collector.
- Memory and frame budgets.
- Claims across documents, such as full page navigation or OAuth redirects.
- Several runs inside one window.
- A `--during '<command>'` mode in which Genie runs the agent's driver command. It conflicts with the decision that Genie does not drive the UI, and it would put shell execution inside the CLI.
- DOM, accessibility or visual assertions; the UI driver owns them.
- A "render was unnecessary" claim; input attribution would have to be complete for every render, and the evidence model calls it `not-proven-safe` (`renderAssessmentSchema.optimizationSafety`).

## 11. Open questions

1. **Declare claims at `begin` or at `end`?** Recommend `begin`. Pre-registration prevents choosing a claim after seeing results, lets Genie reserve budget for the targets, and refuses ambiguous targets before the agent spends effort driving the UI.
2. **Hub or CLI for the verdict engine?** Recommend the hub. The window spans two CLI processes, the hub already owns session identity and document changes, and hub-answered tools cannot be forged by the app.
3. **Should the document lock block every caller?** Recommend yes, with `verify abort` as the escape and a five-minute expiry. The hub cannot tell agents apart, and a silent reset loses evidence. The lock affects only documents with an active verification, so existing workflows are unchanged.
4. **Where does the ledger live?** Recommend a file in the private per-user runtime directory, keyed by project root and logical session, bounded to 500 entries. An in-memory ledger resets with the dev server and hides retries.
5. **When does the whole CLI switch exit codes?** Recommend 1.0, with the additive `exit` field shipped now and `GENIE_EXIT_CODES=legacy` for one release. The JSON-default migration in `docs/json-cli.md` set the precedent of an explicit, documented migration.
6. **Does `fail` outrank `refused` in a conjunction?** Recommend yes. One claim proven false makes the conjunction false, and reporting `refused` would hide a real failure behind a fixable evidence problem.
7. **Should a positive control be mandatory?** Recommend no, but keep the `no_activity` guard and make the skill's examples always include one. A mandatory control would block valid claims on screens where the only expected change is outside React.
8. **Count mounts by default?** Recommend yes. A remount is a render and usually worse than an update; counting only updates opens the remount false pass.
9. **Default settle domains?** Recommend every advertised domain among React, Query and Router. A polling query then refuses with `not_quiescent`, and the fix narrows domains explicitly. The other default, React only, would pass claims that ignore pending Query work.
10. **Should the agent attest the visible outcome?** Recommend no. Genie cannot check an attestation, and accepting one would make the verdict look like it covers the UI. The caveat stays.
11. **A pass after failures on the same code: `pass` or `inconclusive`?** Recommend `pass` with a first-line caveat, plus `--require-consecutive K` for stability. The claim did hold in that run; hiding that is also wrong.
12. **Should `verify` absorb `devtools_interaction_*`?** Recommend not in 1.0. The interaction tools serve investigation, where freezing first is the right order. Revisit after `verify` ships and usage shows whether people still need both.
