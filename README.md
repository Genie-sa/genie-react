# Genie React

[![npm version](https://img.shields.io/npm/v/genie-react.svg)](https://www.npmjs.com/package/genie-react)
[![npm downloads](https://img.shields.io/npm/dm/genie-react.svg)](https://www.npmjs.com/package/genie-react)
[![CLI](https://img.shields.io/npm/v/@genie-react/cli.svg?label=%40genie-react%2Fcli)](https://www.npmjs.com/package/@genie-react/cli)
[![CI](https://github.com/Genie-sa/genie-react/actions/workflows/ci.yml/badge.svg)](https://github.com/Genie-sa/genie-react/actions/workflows/ci.yml)
[![license](https://img.shields.io/npm/l/genie-react.svg)](./LICENSE)

Genie lets your coding agent see inside a running React or React Native app and prove that a fix worked.

Your agent already drives the app with [agent-browser](https://github.com/vercel-labs/agent-browser) or [agent-device](https://github.com/callstack/agent-device) and sees the screen. Genie tells it what happened underneath: which components rendered and why, which effects ran, what TanStack Query and Router did, and which error boundary caught what. When the agent says "fixed", `genie-react verify` checks the claim and exits with the verdict.

[Docs](https://genie-react.com/docs) · [Setup guides](https://genie-react.com/docs/setup) · [Tool reference](https://genie-react.com/docs/tools)

## Prove a fix

Declare what the fix must make true, drive the interaction, and let Genie decide:

```bash
genie-react verify begin --session my-agent --name "put one order on hold" \
  --claim 'render OrderRow only props.order' --claim 'render OrderRow min 1' --claim 'boundaries clean'
# Put one order on hold with agent-browser.
genie-react verify end <id> --session my-agent
```

This is a real run on the [dashboard demo](apps/realworld-dashboard), trimmed to the first claim. Before the fix, putting one order on hold re-rendered every row because each row received a new `onStatusChange` callback:

```
fail "put one order on hold"  10 commits, quiet after 771 ms (react, query, router)
  1 fail render OrderRow only props.order  {renders:30,violatingEvents:30,causes:[props.onStatusChange,props.order]}
```

After the agent removed `rows` from the callback's dependencies:

```
pass "put one order on hold"  11 commits, quiet after 907 ms (react, query, router)
  1 pass render OrderRow only props.order  {renders:2,violatingEvents:0,causes:[props.order]}
```

The exit code is the verdict: `0` pass, `1` fail, `4` refused, `5` inconclusive. Genie passes a claim only on exact, complete evidence. When it cannot prove a claim, for example because the page reloaded mid-check, it refuses and prints the command that fixes the gap. Claims cover render counts, the causes a render may have, effect runs, effects that stop re-running, and error boundaries. See [Verify a fix](https://genie-react.com/docs/workflows/verify-a-fix).

## What your agent can ask

| Question | Tool |
| --- | --- |
| Why did this component render, and was it necessary? | `react_render_causes` |
| Which rows of a list updated? | `react_component_cohort` |
| Why does this effect keep running? | `react_effect_timeline`, `react_effect_audit` |
| Did the Query data reach the UI? Did my invalidation reach it? | `query_get`, `query_invalidations` |
| Did navigation finish? | `router_get_state` |
| What is this screen waiting on? Did hydration fail? | `react_suspense`, `react_hydration` |
| Which error boundary caught, and did the user see it? | `react_error_state` |
| Is the delay in a request or in rendering? | `timeline_start`, `timeline_read` |
| Which Redux action caused this render? | `react_render_causes`, `redux_actions` |
| Is it faster after the change? | `devtools_capture_compare` |

Agents can also force a screen into its loading, empty or error state, and call tools your app registers for login, fixtures and fault injection. `genie-react tools` lists every tool with its exact inputs.

## Get started

You need a development build of React 18 or newer and Node.js 22.12 or newer. From your app folder:

```bash
pnpm add -D genie-react @genie-react/cli
pnpm exec genie-react init
```

`init` configures Vite or Next.js and installs the Genie skill for your agent. In a Vite app, also render `<Genie />` near the root to add the Query, Router, memory and timeline tools:

```tsx
import { Genie } from 'genie-react'

{import.meta.env.DEV && <Genie />}
```

Start the dev server, open the app, and check the connection:

```bash
agent-browser --session my-agent open http://localhost:5173/
pnpm exec genie-react status --session my-agent --wait 15000
```

You are connected when `status` reports `ready: true` for your app's URL. If it doesn't, run `pnpm exec genie-react doctor --live` and follow its remediation. For [React Native and Expo](https://genie-react.com/docs/setup/react-native), [Next.js](https://genie-react.com/docs/setup/nextjs), [Redux](https://genie-react.com/docs/setup/redux) or [another bundler](https://genie-react.com/docs/setup/other-web), follow its setup guide.

## Use it with your agent

`init` puts the skill in `.agents/skills/genie` for Codex, Cursor and other Agent Skills clients, and links it into `.claude/skills/genie` for Claude Code. Without the CLI, `npx skills add Genie-sa/genie-react` installs the same skill. Then ask for the outcome you want:

> Find out why Checkout re-renders when I type in search. Fix it and verify the fix.

> Open the product page and tell me whether the delay comes from a request or from rendering.

> Show me the cart in its loading, empty and error states, then put it back.

The skill runs the CLI from `node_modules/.bin/genie-react`. A wrapper such as `pnpm exec` or `npx` adds up to 350 ms to every call, and an agent makes many. Several agents can work on one app at once, each in its own tab with its own session name. Genie refuses to reset another agent's overrides or recording, and a read from a window another agent restarted fails instead of returning their evidence. See [Sessions](https://genie-react.com/docs/getting-started/sessions).

## Use it from the terminal

```bash
pnpm exec genie-react tools                     # every tool and what it answers
pnpm exec genie-react call react_clear_renders '{}'
# Perform one action in the app.
pnpm exec genie-react call react_render_causes '{"component":"Checkout","limit":10}'
```

Results print as compact text that keeps every field. Add `--json` when a script parses the result, or set `GENIE_OUTPUT=json` to keep the JSON output of CLI 0.14 to 0.19. See [CLI output](https://genie-react.com/docs/getting-started/cli-output).

## Learn more

- [Trace requests, Query updates, renders and navigation together](https://genie-react.com/docs/workflows/interaction-timeline)
- [Compare repeated runs before and after a change](https://genie-react.com/docs/workflows/performance-proof)
- [Add app tools for login, fixtures and hard-to-reach states](https://genie-react.com/docs/tools/app-tools)

Found a bug in Genie? `genie-react feedback` drafts a GitHub issue and shows it to you first; it sends nothing until you add `--submit`.

## Contributing

`pnpm check` runs lint, type checks, the build, release checks, tests and the docs checks. [CONTRIBUTING.md](CONTRIBUTING.md) covers type checking with tsrs and editor setup.

MIT © Genie React Agent contributors
