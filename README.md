# Genie React

[![npm version](https://img.shields.io/npm/v/genie-react.svg)](https://www.npmjs.com/package/genie-react)
[![npm downloads](https://img.shields.io/npm/dm/genie-react.svg)](https://www.npmjs.com/package/genie-react)
[![CLI](https://img.shields.io/npm/v/@genie-react/cli.svg?label=%40genie-react%2Fcli)](https://www.npmjs.com/package/@genie-react/cli)
[![CI](https://github.com/Genie-sa/genie-react/actions/workflows/ci.yml/badge.svg)](https://github.com/Genie-sa/genie-react/actions/workflows/ci.yml)
[![license](https://img.shields.io/npm/l/genie-react.svg)](./LICENSE)

> Live React and TanStack tools for coding agents.

Genie lets an agent inspect the app that is running now. It can explain renders, inspect effects, read Query and Router state, test hard-to-reach UI, and measure a fix.

Genie is for development only. The hub listens on localhost.

[Read the full docs](https://genie-react.com/docs).

## Quick start

```bash
pnpm add -D genie-react @genie-react/cli
npx @genie-react/cli init
pnpm dev
```

Open the app in a browser. Then check the connection:

```bash
npx @genie-react/cli status --sessions-only
```

When the session says `ready=true`, try a read:

```bash
npx @genie-react/cli call react_get_tree '{"depth":3,"maxNodes":50}'
```

Run commands from the app folder. If several running apps match, Genie stops and asks you to choose instead of guessing.

## Common tasks

### Explain why a component rendered

Clear old data, perform one action, then read the result:

```bash
npx @genie-react/cli call react_clear_renders '{}'
# Click, type, or navigate in the app.
npx @genie-react/cli call react_get_renders '{"component":"Checkout","sort":"selfTime","limit":10}'
npx @genie-react/cli call react_render_causes '{"component":"Checkout","limit":20}'
```

The result can point to a state hook, Context, Query, Router, children, a parent render, or a mount.

### Find a slow flow

```bash
npx @genie-react/cli call react_profile_start '{}'
# Perform the flow once.
npx @genie-react/cli call react_profile_report '{"limit":10}'
npx @genie-react/cli call react_profile_stop '{}'
```

The report separates the slowest single render from total time across the whole flow.

### Check effects

```bash
npx @genie-react/cli call react_clear_renders '{}'
# Perform one action.
npx @genie-react/cli call react_effect_events '{"component":"Checkout"}'
npx @genie-react/cli call react_effect_audit '{"component":"Checkout"}'
```

`react_effect_events` shows what React scheduled. It does not claim that an effect or cleanup ran.

To inspect one package:

```bash
npx @genie-react/cli call react_effect_audit \
  '{"packageName":"@tanstack/react-query","appOnly":false}'
```

### Inspect a Query

```bash
npx @genie-react/cli call query_list '{"limit":20}'
npx @genie-react/cli call query_get '{"queryKey":["cart"]}'
```

Wait for one exact key instead of sleeping:

```bash
npx @genie-react/cli call devtools_wait \
  '{"condition":"query-settled","queryKey":["cart"],"timeoutMs":10000}'
```

### Inspect or change a route

```bash
npx @genie-react/cli call router_get_state '{}'
npx @genie-react/cli call router_build_location '{"to":"/products/$productId","params":{"productId":"42"}}'
npx @genie-react/cli call router_navigate '{"to":"/products/$productId","params":{"productId":"42"}}'
```

`router_get_state` returns the Router URL and browser URL together. Check `locationSync` before trusting them.

### Inspect one component

```bash
npx @genie-react/cli call react_find_components '{"query":"Checkout","exact":true}'
npx @genie-react/cli call react_inspect_component '{"id":42,"path":["user","address"],"depth":3}'
```

For a large tree, read only one subtree:

```bash
npx @genie-react/cli call react_get_tree '{"rootId":42,"depth":3,"maxNodes":100}'
```

### Check repeated list items

```bash
npx @genie-react/cli call react_clear_renders '{}'
# Perform one action.
npx @genie-react/cli call react_component_cohort '{"component":"Row","exact":true}'
```

The result separates updated, mounted-but-idle, unmounted, and missing rows. It also reports rows omitted by the limit.

### Use the app's own dev tools

An app can register its own tools with `useGenieTool`. They appear under the `app` group:

```tsx
import { useGenieTool } from 'genie-react'
import { z } from 'zod'

useGenieTool({
  name: 'login_as',
  kind: 'action', // or 'query' — tells the agent read vs mutate
  description: 'Switches the session role and re-gates the UI.',
  input: z.object({ role: z.enum(['guest', 'member', 'admin']) }),
  handler: ({ role }) => switchRole(role),
})
```

```bash
npx @genie-react/cli tools app
npx @genie-react/cli call app_login_as '{"role":"admin"}'
```

Register several tools with one hook call — handlers still see the latest render's state:

```tsx
import { defineGenieTool, useGenieTools } from 'genie-react'

useGenieTools([
  defineGenieTool({ name: 'session', kind: 'query', description: '…', handler: () => ({ role }) }),
  defineGenieTool({ name: 'login_as', kind: 'action', description: '…', input, handler }),
])
```

Outside components — a store, an API client, any module:

```ts
import { defineGenieTool, registerGenieTools } from 'genie-react/client'

const unregister = registerGenieTools(
  defineGenieTool({
    name: 'cart_state',
    kind: 'query',
    description: 'Current cart line items and totals from the zustand store.',
    handler: () => useCartStore.getState().summary(),
  }),
  defineGenieTool({
    name: 'cart_clear',
    kind: 'action',
    destructive: true,
    description: 'Empties the cart store. No undo.',
    handler: () => useCartStore.getState().clear(),
  }),
)
```

Registration waits for the genie client if it has not started yet; `unregister()` tombstones the
tools. Args are validated by the schema in the app. A tool whose component unmounted stays listed
as unavailable with the place it was registered. Use this for what only the app can do: switch
roles, seed fixtures, inject API failures, jump wizard steps. See the
[App tools reference](https://genie-react.com/docs/tools/app-tools).

## Prove a fix

For React commit quiescence, use the dedicated wait tool instead of a fixed sleep:

```sh
npx @genie-react/cli call react_clear_renders '{}'
# Drive the UI.
npx @genie-react/cli call react_quiesce '{"idleMs":500,"timeoutMs":10000}' --json
npx @genie-react/cli call react_get_renders '{}' --json
```

`outcome` is `idle`, `timed-out`, or `unavailable`. Results include `elapsedMs`, the number of
commits observed between samples, and collection status. An idle React tree can coexist with a
canvas/native animation; the tool waits for React commits, not animation frames or future timers.
A document replacement invalidates the wait, while a tool-catalog refresh in the same document does
not. Use `--fail-on-result-error` to exit nonzero when quiescence was not established.

For a labelled interaction, use the existing bridge-owned handle:

```bash
npx @genie-react/cli call devtools_interaction_begin '{"name":"open checkout","components":["CheckoutRow"]}' --json
# Save interactionId from the result, then perform the UI action.
# If its asynchronous work belongs in the measurement, wait for it before stopping:
npx @genie-react/cli call devtools_wait '{"condition":"react-quiet","quietMs":500,"timeoutMs":10000}' --json
# Check ok:true, then replace the example ID with the returned interactionId.
npx @genie-react/cli call devtools_interaction_stop '{"interactionId":"int_RETURNED_ID"}' --json
```

The result retains the name, physical session, observation ID, and start/stop document commit boundaries. Inspect `coverage.comparable`, `notComparableReasons`, and warnings before comparing runs. Stop freezes the profile **before** its own settle wait; later commits are counted as `postInteractionCommits` and excluded. A timeout means the requested settle condition was not observed; do not treat the result as a completed measurement.

Only one interaction can start or record per physical document. A competing begin is rejected before it can clear the first window; stop the existing handle before opening the next one. Avoid `react_clear_renders` or another profile start during a recording, and start a new handle after relaunch. Handles are retained in the hub's bounded memory, so export results for a durable audit.

This is a labelled observation window, not proof that the action caused every render inside it: background query updates can still occur in the same window. Inspect the recorded render causes and exact notification evidence. Concurrent time windows alone cannot yield disjoint causal commit sets.

`react_get_renders` and `react_profile_report` include `bundle` (`development`, `production`,
`mixed`, or `unknown`), `timingsBundleDependent: true`, and `countsScope: "observed-run"`.
Bundle metadata comes from the app document's registered React renderers. Quote render/update
counts as observations of that run, subject to collection coverage; development behavior and
Strict Mode can differ from production. Quote timings with the bundle and measurement conditions;
development timings are not release estimates. Compare equivalent environments, and do not treat
`unknown` or `mixed` as a verified production measurement. A production bundle label identifies the
renderer; it does not establish that profiling or collection is available.

For a quick same-session check:

```bash
npx @genie-react/cli call react_profile_start '{}'
# Run the flow before the code change.
npx @genie-react/cli call devtools_wait '{"condition":"react-quiet","quietMs":500,"timeoutMs":10000}' --json
npx @genie-react/cli call react_profile_snapshot '{"label":"before"}'

# Make the change, start a clean window, then run the same flow again.
npx @genie-react/cli call react_profile_start '{}'
# Run the same flow again.
npx @genie-react/cli call devtools_wait '{"condition":"react-quiet","quietMs":500,"timeoutMs":10000}' --json
npx @genie-react/cli call react_renders_diff '{"baseline":"before","thresholdMs":0.5}'
```

`devtools_wait` reports `ok`, `waitedMs`, and the last observed document commit ID. Check `ok: true` before trusting the measurement; a timeout or unavailable commit collection returns `ok: false`. The quiet window restarts after each observed commit, failed sample, or app session change. A degraded late hook can establish quiet during this window, but cannot recover earlier commits. React quiet does not prove pending queries, native animations, or future scheduled work are idle, or guarantee identical counts across runs; use `condition: "settled"` with supported domains for additional checks.

For a stronger result, capture the same flow at least three times before and after the change:

```bash
npx @genie-react/cli call react_clear_renders '{}'
# Run the flow.
npx @genie-react/cli call devtools_wait '{"condition":"react-quiet","quietMs":500,"timeoutMs":10000}' --json
npx @genie-react/cli call devtools_capture_create '{"name":"before-1"}' --json

# After the change, clear, run the same flow, and capture again.
npx @genie-react/cli call react_clear_renders '{}'
# Run the same flow.
npx @genie-react/cli call devtools_wait '{"condition":"react-quiet","quietMs":500,"timeoutMs":10000}' --json
npx @genie-react/cli call devtools_capture_create '{"name":"after-1"}' --json
```

Use the returned capture IDs to compare both groups:

```bash
npx @genie-react/cli call devtools_capture_compare \
  '{"baselineCaptureIds":["<before-1>","<before-2>","<before-3>"],"candidateCaptureIds":["<after-1>","<after-2>","<after-3>"],"metrics":["react.renders","react.selfTimeMs"],"budgets":[{"metric":"react.renders","maxRegressionPct":0}]}'
```

Use the same build, route, device, and action for every run. `insufficient-data` is not a pass.

## Read results safely

| Field | Meaning |
| --- | --- |
| `exact` | Genie observed the direct runtime link. |
| `inferred` | Useful lead, but not proof. |
| `unknown` | Genie could not prove the cause. |
| `not-proven-safe` | Test the page before removing the render. |
| `coverage.complete` | The tool's main measurement is complete. |
| `coverage.inputAttributionComplete` | Every captured render has complete input evidence. |
| `attribution.status: stale` | Wait for React to settle, then retry. |
| `propsNotEnumerated` | Props were not read because a Proxy could run app code. Inspect a named path instead. |

A timing report can be complete while render-cause data is partial. Never use incomplete data to prove that a change worked.

Effect hotness needs at least three updates by default. One sample returns `insufficient-data`. Only effect hotness gets a 95% range; other results stay `exact`, `inferred`, or `unknown`.

## Target one tab

Name the tab in its URL:

```text
http://localhost:3000/?_genie=my-agent
```

Pin later calls to it:

```bash
export GENIE_SESSION=my-agent
```

The name survives navigation, reloads, and reconnects. You can also pass `--session my-agent` to one command.

## JSON and scripts

```bash
npx @genie-react/cli status --json
npx @genie-react/cli call react_get_renders '{}' --json | jq '.coverage'
npx @genie-react/cli batch \
  '[{"tool":"react_get_tree","args":{"depth":2}},{"tool":"react_get_renders","args":{"limit":5}}]' --ndjson
```

- `--json` writes one JSON value.
- `batch` writes JSONL by default. `--ndjson` makes that explicit.
- `batch --json` writes one JSON array.
- CLI status, batch, and error objects include `schemaVersion`.

Use `--verbose` when startup hangs. It prints the CLI version, chosen connection, session, and time limits to stderr, so JSON stdout stays clean.

## Setup by platform

`init` handles Vite and Next.js. Use the examples below when you need manual control.

### Vite and TanStack Start

`init` adds the `genie()` Vite plugin. For Query and Router tools, render `<Genie />` near the app root:

```tsx
import { Genie } from 'genie-react'

{import.meta.env.DEV && <Genie />}
```

It normally finds the Router and Query client. You can also pass them:

```tsx
{import.meta.env.DEV && <Genie queryClient={queryClient} router={router} />}
```

The `genie()` plugin removes this dedicated component import during production builds, so the guard
adds no Genie browser modules or protocol code to production assets.

### Next.js

`init` adds `<GenieScript />` to the root layout and creates `instrumentation.ts`. This setup uses
the Next.js App Router. It does not use TanStack Router.

To add Query tools, register the same client used by `QueryClientProvider`:

```tsx
'use client'

import { queryCollector } from 'genie-react/collectors/query'
import { registerGenieCollector } from 'genie-react/protocol'
import { useEffect } from 'react'
import { queryClient } from './query-client'

export function GenieQueryTools() {
  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return

    return registerGenieCollector(queryCollector(queryClient))
  }, [])

  return null
}
```

Render `<GenieQueryTools />` after `<GenieScript />` in the root layout.

### Other web bundlers

Start the hub:

```bash
npx @genie-react/cli hub
```

Load the client first in `<head>`:

```html
<script src="http://localhost:4390/__genie/client.js"></script>
```

This adds React and memory tools. To add Query tools, start the client from your bundle with your own Query client:

```ts
import 'genie-react/hook'
import { createGenieClient, reactCollector, sessionCollector } from 'genie-react/client'
import { memoryCollector, queryCollector } from 'genie-react/collectors'
import { queryClient } from './query-client'

createGenieClient({
  url: 'ws://localhost:4390/__genie/ws',
  collectors: [sessionCollector(), reactCollector(), memoryCollector(), queryCollector(queryClient)],
}).start()
```

Import `genie-react/hook` before React.

### React Native and Expo

Start the hub on your development machine:

```bash
npx @genie-react/cli hub
```

Import the hook in your entry file (`index.js`) before anything that loads React, then render Genie in development:

```tsx
import 'genie-react/hook'
```

```tsx
import { Genie } from 'genie-react/native'

{__DEV__ && <Genie url="ws://127.0.0.1:4390/__genie/ws" />}
```

The early hook import is what makes render collection work; without it, tree and inspect tools still function but render reports stay empty (`react_get_renders` reports `renderCollection` so you can tell the difference). Use `127.0.0.1` for the iOS simulator or `10.0.2.2` for the Android emulator. Desktop targets such as react-native-macos and react-native-windows run on the same machine as the hub, so `127.0.0.1` works with no port forward. A physical device needs a port forward to the local hub. Pass `queryClient` or `router` to add those tools.

React Native has no DOM selectors. `react_dom_for_component` returns native view details instead. Browser-only tools stay unavailable.

## Find more tools

```bash
npx @genie-react/cli tools
npx @genie-react/cli tools react.render
npx @genie-react/cli tools react_render_causes
```

Group listings show parameter names, enum values, bounds, and defaults in human output and compact
JSON. Use `tools <tool>` for nested options and a runnable example. For named render/effect reports,
use `component`; `react_component_cohort` uses that same key with exact matching by default. Tools
that inspect or mutate one live instance use its returned `id`, which is distinct from a name filter.
`react_get_renders` accepts `sort:"updates"` to rank update counts before applying the result limit.
Pass `appOnly` only where advertised: cohort queries retain mounted and unmounted lifecycle evidence
and do not currently support ownership filtering.

Tool areas include React, effects, Query, Router, memory, frame rate, plugins, and runtime captures. Read tools inspect the app. Action tools can change live Query, Router, component, Suspense, and error state.

After testing an action, restore temporary state:

```bash
npx @genie-react/cli call query_restore_state '{"all":true}'
npx @genie-react/cli call react_reset_overrides '{}'
```

## Give Genie to your agent

Install the agent skill:

```bash
npx skills add y0u-0/genie-react
```

Pair Genie with a UI driver:

- [agent-browser](https://github.com/vercel-labs/agent-browser) for web apps.
- [agent-device](https://github.com/callstack/agent-device) for React Native.

The UI driver performs the action. Genie explains what happened inside the app.

## Check setup

```bash
npx @genie-react/cli doctor
npx @genie-react/cli doctor --live
```

`doctor` checks files. `doctor --live` also checks the running hub, client script, and browser session.

## Test a pull request build

Each pull request publishes packages through [pkg.pr.new](https://pkg.pr.new):

```bash
pnpm add -D https://pkg.pr.new/genie-react@<sha>
npx https://pkg.pr.new/@genie-react/cli@<sha> status
```

## How it works

The browser collectors read React and TanStack state. They send tool results to a local WebSocket hub. The CLI sends requests to that hub and prints the result.

Vite runs the hub inside its development server. Next.js and other setups run a small standalone hub. More than one app or tab can connect safely when you target the right session.

## Packages

| Package or export | Purpose |
| --- | --- |
| `genie-react` | `<Genie />` component |
| `genie-react/vite` | Vite plugin |
| `genie-react/next` | Next.js setup |
| `genie-react/native` | React Native and Expo |
| `genie-react/client` | Browser client |
| `genie-react/collectors` | Individual collectors |
| `genie-react/collectors/query` | Query collector without Router types |
| `genie-react/collectors/router` | Router collector |
| `genie-react/hub` | Local hub |
| `genie-react/protocol` | Tool and wire types |
| `@genie-react/cli` | Terminal commands |

MIT © Genie React Agent contributors
