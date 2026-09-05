# Genie React

[![npm version](https://img.shields.io/npm/v/genie-react.svg)](https://www.npmjs.com/package/genie-react)
[![npm downloads](https://img.shields.io/npm/dm/genie-react.svg)](https://www.npmjs.com/package/genie-react)
[![CLI](https://img.shields.io/npm/v/@genie-react/cli.svg?label=%40genie-react%2Fcli)](https://www.npmjs.com/package/@genie-react/cli)
[![CI](https://github.com/Genie-sa/genie-react/actions/workflows/ci.yml/badge.svg)](https://github.com/Genie-sa/genie-react/actions/workflows/ci.yml)
[![license](https://img.shields.io/npm/l/genie-react.svg)](./LICENSE)

Give your coding agent a view inside your running React app.

Find out why a component rendered, whether a Query update reached the UI, or where an interaction spent its time. Then run the same flow after a fix and compare the evidence.

Works with React web and React Native. Query and routing tools support TanStack Query and TanStack Router. Use Genie in development.

[Docs](https://genie-react.com/docs) · [Setup guides](https://genie-react.com/docs/setup) · [Tool reference](https://genie-react.com/docs/tools)

## Get started

For Vite or Next.js, run these from your app folder. The CLI requires Node.js 22.12 or newer.

```bash
pnpm add -D genie-react @genie-react/cli
pnpm exec genie-react init
```

Follow the setup result, then run `pnpm dev` and open the app. In Vite, render `<Genie />` near the app root to add Query, Router, memory, and timeline tools:

```tsx
import { Genie } from 'genie-react'

// Inside your root component:
{import.meta.env.DEV && <Genie />}
```

Check that your app is connected:

```bash
pnpm exec genie-react status --sessions-only --json
pnpm exec genie-react call react_get_tree '{"depth":3,"maxNodes":50}' --json
```

Continue when the intended session has `ready: true` and the tree shows your components. If setup needs attention, run `pnpm exec genie-react doctor --live`.

Using [React Native or Expo](https://genie-react.com/docs/setup/react-native), [Next.js](https://genie-react.com/docs/setup/nextjs), or [another web bundler](https://genie-react.com/docs/setup/other-web)? Follow its setup guide.

## Give your agent a useful task

`init` installs the Genie skill in `.agents/skills/genie`. Pair your agent with a browser or device driver so it can use the UI and check what changed.

Try a prompt like:

> Use Genie to find why Checkout renders when I type in search. Fix it, then repeat the interaction and check that checkout still works.

> Record the interaction timeline when I open the product page. Check whether the delay comes from a request or React rendering.

> Put the cart into loading and error states, check both screens, then restore it.

Genie can read runtime state and call tools your app registers. The UI driver clicks, types, and checks the screen. See the [agent workflow](https://genie-react.com/docs/getting-started/agent-workflow).

## Try it from the terminal

Find a render cause. Replace `Checkout` with a component in your app:

```bash
pnpm exec genie-react call react_clear_renders '{}'
# Perform one action in the app.
pnpm exec genie-react call react_render_causes '{"component":"Checkout","limit":10}' --json
```

Read a Query:

```bash
pnpm exec genie-react call query_list '{"limit":10}' --json
# Use a key returned above.
pnpm exec genie-react call query_get '{"queryKey":["cart"]}' --json
```

Discover tools and their exact inputs:

```bash
pnpm exec genie-react tools
pnpm exec genie-react tools timeline_start --json
```

For scripts, use JSON and check the result's coverage before claiming a fix worked. CLI 0.14 and newer return JSON by default. Older releases need `--json` for structured reads. See [CLI output](https://genie-react.com/docs/getting-started/cli-output) for framing, limits, and migration details.

## Go further

- [Trace requests, Query updates, renders, and navigation together](https://genie-react.com/docs/workflows/interaction-timeline).
- [Compare repeated runs before and after a change](https://genie-react.com/docs/workflows/performance-proof).
- [Add app tools for login, fixtures, or hard-to-reach states](https://genie-react.com/docs/tools/app-tools).
- [Target the right tab when several agents are working](https://genie-react.com/docs/getting-started/sessions).
- [Understand runtime overhead and the measured limits](docs/runtime-overhead.md).

MIT © Genie React Agent contributors
