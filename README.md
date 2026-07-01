# Genie React

> Give your AI coding agent live DevTools for your running React + TanStack app — from the terminal, through one CLI.

Genie connects your AI coding agent (Claude Code, or you in a shell) to your app's real DevTools while it runs. The agent gets the **information** — component tree, props/state/hooks, why a component re-rendered, the TanStack Query cache, the Router — and the **actions** — navigate, invalidate/refetch queries, re-run a mutation, override props, profile. So instead of guessing from source, it works against the live app: more autonomous, and its fixes are much better because it can verify them against what's actually running.

One command drives everything: `genie call <tool> '<json>'`.

## Install

Dev-only. Never ships to production.

```bash
# 1. add the two packages you import — the collectors, client, and bridge come along transitively
pnpm add -D @genie-react/react @genie-react/vite

# 2. add the Vite plugin (use the scoped name — a bare `npx genie` is a different package)
npx @genie-react/cli init

# 3. start your app as usual
pnpm dev
```

Then add one line near your app root:

```tsx
import { Genie } from '@genie-react/react'

// in your root layout:
{import.meta.env.DEV && <Genie />}
```

Now drive it from the terminal — or let your agent shell out to the same CLI:

```bash
npx @genie-react/cli status                          # "connected": true once a browser opens the app
npx @genie-react/cli tools                           # what the live app exposes, by domain
npx @genie-react/cli call react_get_renders '{"sort":"renders"}'
npx @genie-react/cli call query_list '{}'
npx @genie-react/cli call router_navigate '{"to":"/dashboard"}'
```

The bridge rides Vite's dev server (no extra port) and only listens on loopback. `init` only edits your Vite config. Run `npx @genie-react/cli doctor` to check the wiring.

## Teach your agent to drive it

Genie ships an [agent skill](https://github.com/vercel-labs/skills) — a `SKILL.md` that tells Claude Code (or any skills-aware agent) when to reach for Genie and how the tools map to symptoms. Install it into your project:

```bash
npx skills add y0u-0/genie-react
```

## What you get

The agent can **see**:

- the live component tree, and find components by name
- a component's props, state, and hooks
- the **contexts a component consumes** and their current values — invisible from source and the DOM
- the **DOM element(s) a component renders**, each with a ready-to-use selector — the link from the React tree to the live page, so a browser tool can act on exactly what a component controls
- which components re-rendered, how often, and why — including renders caused by **unstable props** (a parent passing a new object/function each render that defeats `memo`), plus a summary of the top offenders
- an **effect audit**: which `useEffect`s actually fired, how often, and why — to catch re-run / refetch loops render counts alone miss
- **caught errors and suspended boundaries** — why a screen is blank or stuck
- a profiler: slowest components, most re-rendered, most wasted on unstable props
- the TanStack Query cache (status, staleness, observers), with **cache-churn** flags for orphaned / near-duplicate keys, and per-query **fetch counts and recent refetches** to catch refetch storms
- the Router: current state, active matches, params, loader status
- the browser JS heap

The agent can **do**:

- navigate the app, preload / load routes, invalidate the router cache
- invalidate / refetch / reset / remove / clear / setData on queries
- cancel an in-flight query, or fetch / ensure one
- re-run a mutation
- override a component's props to test a UI state

46 tools in total. The payoff: less back-and-forth, fewer wrong guesses, and the agent verifies its own fixes against the live app instead of hoping.

## Examples

- **Why is this list janky?** `react_clear_renders`, interact, then `react_get_renders` — it flags components re-rendering from unstable props and names the props.
- **Diagnose a refetch storm.** `query_get` returns `recentFetches` — a query refetching on its own shows up in one call.
- **Spot cache churn.** `query_list` flags orphaned, near-duplicate key families (e.g. a key built from a value that changes every keystroke).
- **Test a UI state.** `react_override_props` to flip a component into loading / error / empty without editing code.
- **Re-run a failed mutation.** `mutation_rerun` replays it with the same variables.
- **Move the app.** `router_navigate` to drive client-side navigation, then read `router_list_matches`.
- **Act on the right element.** `react_dom_for_component` maps a component to its live DOM node and a selector, so a browser tool can click / screenshot exactly what that component renders — no guessing.
- **Read a context value.** `react_inspect_context` shows which contexts a component consumes and their current values — for stale-context / wrong-provider bugs source can't reveal.

## Tools

46 tools, grouped by domain. `read` is safe to call freely; `action` mutates the running app.

**React** — `react_get_tree`, `react_find_components` (tree); `react_inspect_component` (props / state / hooks), `react_inspect_context` (consumed contexts + values), `react_dom_for_component` (the DOM element(s) a component renders, with selectors); `react_get_renders`, `react_clear_renders` (why-did-render + unstable-prop summary), `react_effect_audit` (which effects fired & why), `react_error_state` (caught errors / suspended boundaries); `react_profile_start`, `react_profile_report` (profiler) — all read. `react_override_props` — action.

**Query** — read: `query_list` (+ churn flags), `query_get` (+ fetch counts), `query_get_data`, `query_is_fetching`, `query_list_mutations`, `mutation_get`. action: `query_invalidate`, `query_refetch`, `query_cancel`, `query_reset`, `query_remove`, `query_clear`, `query_set_data`, `query_fetch`, `query_ensure`, `mutation_rerun`.

**Router** — read: `router_get_state`, `router_list_matches`, `router_list_routes`, `router_build_location`, `router_match_route`. action: `router_navigate`, `router_preload`, `router_load`, `router_invalidate`, `router_clear_cache`, `router_history`.

**Plugin passthrough** — surfaces third-party `@tanstack/devtools` plugins. read: `plugin_list`, `plugin_get_events`. action: `plugin_emit`.

**Memory** — read: `browser_get_memory`, `browser_measure_memory` (browser JS heap; Chromium only).

**Meta** — read: `devtools_status`, `devtools_wait` (block until connected / a component mounts / a query settles / navigation).

## How it works

Collectors in the browser each own a domain (React, Query, Router, plugins, memory) and run tool calls against the real fibers and caches. They connect over a WebSocket to a small hub mounted on your Vite dev server. The `genie` CLI connects to that same hub as the agent, runs tool calls, and prints JSON.

Dev-only and local: the Vite plugin uses `apply: 'serve'` (inert in production builds), the in-browser client only starts under `import.meta.env.DEV`, and the hub listens on `127.0.0.1` / `localhost` only — no extra port, no LAN exposure.

## Packages

- `@genie-react/core` — types, tool contracts, wire protocol, bounded serializer
- `@genie-react/react-collector` — React tree, inspect, render tracking, profiling (bippy + react-scan)
- `@genie-react/tanstack-collector` — Query + Router reads and actions
- `@genie-react/devtools-plugin` — TanStack DevTools event-bus passthrough
- `@genie-react/memory` — browser JS heap readings
- `@genie-react/react` — the one-line `<Genie />` component
- `@genie-react/client` — orchestrates collectors, WS to the hub, runs tool calls
- `@genie-react/bridge` — the hub: WS server, request router
- `@genie-react/vite` — mounts the hub on Vite, injects the client
- `@genie-react/cli` — the agent interface: `init` / `doctor` / `link` + `status` / `tools` / `call`

MIT © Genie React Agent contributors
