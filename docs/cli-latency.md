# CLI latency

A coding agent runs `genie-react` dozens of times in one debugging session. Each run is a new Node process that finds the hub, reads its token, opens a WebSocket, makes its calls, prints, and exits, so the cost of every step lands on every call.

## Measure it

```sh
pnpm build
pnpm exec playwright install chromium
node scripts/benchmark-cli.mjs --json cli-latency.json
```

The benchmark starts a Vite app with the `genie()` plugin in headless Chromium, on free ports, and times the commands an agent runs: `--version`, `--help`, `status`, `status --session`, `tools`, `tools <name>`, two `call`s, a five-call `batch`, and a failing call. It makes no model calls. Warm runs follow three warmups. Cold runs start each process with an empty compile cache, as the first run after an install or upgrade does. Each command reports the median and p95 wall time and a per-phase median breakdown:

| phase | from | to |
| --- | --- | --- |
| spawn | the parent's `spawn()` | Node's process start |
| boot | Node's process start | the first user code |
| load | first user code | `main()` runs, plus the command module's dynamic import |
| args | `main()` | arguments validated |
| discovery | connection start | hub URL chosen, without the token read |
| token | token read start | token read end |
| connect | URL chosen | WebSocket open, which includes TCP and the authenticated upgrade |
| greeting | WebSocket open | the hub's first status frame decoded and accepted |
| calls | greeting accepted | the last call answered |
| render | last answer | last stdout write |
| exit | last stdout write | Node's `exit` event |
| teardown | `exit` event | the parent sees the process close |

The phases come from `scripts/cli-probe.mjs`, preloaded with `--import`. It subscribes to the `genie-react:cli-phase` diagnostics channel the CLI publishes on, which costs nothing while no one subscribes. Pass `--node <path>` more than once to compare Node versions, `--cli <path>` more than once to compare builds, and `--wrappers` to time `npx`, `pnpm exec`, `yarn` and `bunx` against the installed binary in a single app and an app inside a workspace.

## What CI checks

`node scripts/check-cli-startup.mjs` runs in CI after the build. Shared runners are too noisy for millisecond budgets, so it checks values that do not move with load:

- files and source bytes each command loads, and that `status`, `tools`, `call` and `batch` load nothing outside the CLI's own bundle;
- the number of hub round trips each command makes;
- the time from the last stdout byte to exit, which catches a timer or socket that keeps the process alive;
- that the compile cache is enabled, private to the user, off under `NODE_DISABLE_COMPILE_CACHE`, and never fails a command when its directory is unusable.

Wall time is checked only against loose ceilings expressed in multiples of `node -e 0` on the same runner, which catch a fixed sleep or a hang without failing on a slow runner. When a budget trips, measure with the benchmark, then fix the regression or change the budget with the reason.

## Results

A local run on November 15, 2026, on an Apple Silicon Mac shared with other heavy work, so the p95s are wide; medians of 30 warm runs per command, in milliseconds. Before is the CLI of 0.19.0 on `main`, after is this build, both against the same hub.

| command | Node 22.23.4 before | after | Node 26.13.1 before | after |
| --- | ---: | ---: | ---: | ---: |
| `node -e 0` | 28.4 | | 24.2 | |
| `--version` | 32.2 | 29.7 | 31.0 | 31.8 |
| `status --session` | 97.7 | 64.6 | 87.9 | 68.3 |
| `tools <name>` | 95.5 | 77.6 | 93.7 | 76.9 |
| `call react_get_tree` | 106.6 | 81.3 | 93.4 | 66.1 |
| `call react_render_causes` | 142.6 | 79.8 | 103.1 | 71.4 |
| `batch` (5 calls) | 125.9 | 81.1 | 103.8 | 84.3 |

For `call react_get_tree` on Node 26, module loading fell from 37.8 to 23.0 ms and the greeting from 10.9 to 2.0 ms. The remaining time above `node -e 0` is mostly loading: building the protocol's Zod schemas and the superjson codec takes about 20 ms of CPU, and `ws` with the HTTP and TLS modules it requires about 5 ms. Connecting, the round trips and printing add about 10 ms.

Package-manager wrappers cost more than the CLI itself. Median `status` from the app folder, after this change:

| package manager | installed binary | wrapper |
| --- | ---: | ---: |
| npm | 76–83 | `npx` 266–290 |
| pnpm | 75–83 | `pnpm exec` 156–163 |
| Yarn 1 | 67–98 | `yarn --silent` 386–446 |
| Yarn 4, Plug'n'Play | no binary | `yarn` 224–227 |
| Bun | 62–79 | `bunx` 75–78 |

So `init` writes skill commands that call the binary, and keeps the wrapper only where no runnable binary path exists.
