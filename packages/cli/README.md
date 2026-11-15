# Genie CLI

Give your coding agent DevTools for the running React app.

The CLI lets the agent inspect, optimize, test, and verify the app from the terminal.

## Start

```bash
pnpm add -D genie-react
npx @genie-react/cli init
pnpm dev
npx @genie-react/cli status --sessions-only
```

If more than one tab is open, open yours with `agent-browser --session my-agent open <url>` (or add `?_genie=my-agent` to the URL in another browser). Then pass `--session my-agent` to each command.

The alias survives navigation, reloads, and reconnects. From a workspace root, the CLI selects one live app or stops with an explicit list when several are live.

## Find wasted renders

```bash
npx @genie-react/cli call react_clear_renders '{}'
# Drive one flow in the app.
npx @genie-react/cli call react_get_renders '{"sort":"selfTime","limit":3}'
npx @genie-react/cli call react_render_causes '{"component":"Button","limit":3}'
```

Use the observation only when its coverage is complete and `budgetExhaustedCommits` is zero. The
default adaptive budget grows to fit the tree mounted when you clear. When a limit still skips work,
`coverage.budgetAdvice` names it and suggests a budget: clear with that budget and repeat the step,
because growth on later commits cannot restore evidence skipped by the commit that ran out.

Excerpt of real `react_render_causes` output from the Vite demo:

```text
events[5] (componentName #componentId {fields}, then ← kind evidence name {fields} per cause):
  each: {mountId:mount:9,source:{location:App.tsx:234:6,ownership:app}}
  TaskPanel #57 {renderEventId:render:13:184,documentCommitId:13,inputEvidence:changed}
    ← query exact "[\"tasks\"]" {reason:query-notification-delivered,changedResultFields:[data,dataUpdatedAt]}
    ← external-store inferred tanstack-mutation-observer
  TaskPanel #57 {renderEventId:render:10:149,documentCommitId:10,inputEvidence:none-observed}
    ← parent inferred App
coverage:
  complete: true
  inputAttributionComplete: true
  semantics: exact
```

The agent gets the component, source location, and each cause with its evidence grade: `exact`, `inferred`, or `unknown`. Causes include props, state, context, Query, Router, parent renders, and mounts.

## Audit an effect

```bash
npx @genie-react/cli call react_effect_audit '{"appOnly":true,"onlyHot":true}'
```

Each effect reports its own source and whether ownership evidence is `exact`, `inferred`, or `unknown`. Hotness uses a minimum sample count and a 95% interval, so a short run is marked `insufficient-data`.

## Inspect live hooks

```bash
npx @genie-react/cli call react_find_components '{"query":"App","exact":true}'
# Use the id returned above. The Vite demo returned TaskPanel #57.
npx @genie-react/cli call react_inspect_component '{"id":57}'
```

Excerpt from the Vite demo:

```text
id: 57
name: TaskPanel
kind: function
props: {}
hooks[29]:
  - {index:0,kind:state,stateful:true,stateIndex:0,value:admin}
  - {index:1,kind:state,stateful:true,stateIndex:1,value:""}
  - {index:6,kind:effect,stateful:false,customHooks:[useQuery,useBaseQuery],deps:["ƒ anonymous()"]}
```

The agent can read the mounted component's real props, state, and hooks instead of guessing from source.

## Test a TanStack state

```bash
npx @genie-react/cli call query_simulate_state \
  '{"queryKey":["demo","greeting"],"state":"pending"}'
```

```text
ok: true
queryHash: "[\"demo\",\"greeting\"]"
simulatedState: pending
originalStatus: success
```

The agent can drive and verify the real loading UI, then restore the exact query state:

```bash
npx @genie-react/cli call query_restore_state '{"queryKey":["demo","greeting"]}'
```

```text
ok: true
restored: 1
```

## Output for agents

Every command prints compact text by default. It keeps every field of the result, quotes app strings so they cannot fake a line, and costs fewer tokens than the same JSON: about 72% of the tokens across the recorded results, 42–60% for a component tree. Add `--json` for the JSON document:

```bash
npx @genie-react/cli call react_inspect_component '{"id":57}' --json
```

Use `--fields` when the agent only needs a few fields:

```bash
npx @genie-react/cli call query_list '{}' --fields queryHash,status,fetchStatus
```

```text
[1]:
  - {queryHash:"[\"demo\",\"greeting\"]",status:success,fetchStatus:idle}
```

Every tool includes its input schema and a runnable example:

```bash
npx @genie-react/cli tools
npx @genie-react/cli tools react_inspect_component
```

A failure starts with `error <reason>: <message>`, then `next: $ <command>` when a recovery command is known. `--json` prints one compact JSON value instead, with the same fields. `batch` prints one block per result under a `[n/total] tool ok|error` header; `batch --json` prints one JSON array and `batch --ndjson` prints JSONL.

Scripts that parse output add `--json`, or set `GENIE_OUTPUT=json` once to keep the 0.19 output, JSONL included. CLI-owned status, batch, and error objects include `schemaVersion` in JSON. Successful calls keep the output schema shown by `tools <tool>`. The [output contract](https://github.com/Genie-sa/genie-react/blob/main/docs/json-cli.md) specifies the text format.

Use `--verbose` when startup is unclear. It prints the CLI version, bridge target, session, and time budgets to stderr. `--connect-timeout <ms>` bounds only the bridge connection.

Wait on an exact Query key instead of sleeping:

```bash
npx @genie-react/cli call devtools_wait \
  '{"condition":"query-settled","queryKey":["demo","greeting"]}'
```

For a large component tree, call `react_find_components`, then pass its id as `rootId` to `react_get_tree`.

## Compare repeated runs

Clear the render data, drive one exact flow, and create a named capture:

```bash
npx @genie-react/cli call react_clear_renders '{}'
# Drive the flow.
npx @genie-react/cli call devtools_capture_create '{"name":"before-1"}' --json
```

Discard a capture whose React coverage is incomplete or budget-exhausted rather than comparing a
lower-bound observation.

Run the same flow at least three times before and after the change. Then compare the returned IDs:

```bash
npx @genie-react/cli call devtools_capture_compare \
  '{"baselineCaptureIds":["<before-1>","<before-2>","<before-3>"],"candidateCaptureIds":["<after-1>","<after-2>","<after-3>"],"metrics":["react.renders"],"budgets":[{"metric":"react.renders","maxRegressionPct":0}]}'
```

The verdict is `pass`, `fail`, or `insufficient-data`. It also reports sample counts, median, p95, and spread. The hub keeps the latest 20 captures.

See the [full setup and tool list](https://github.com/Genie-sa/genie-react#readme).
