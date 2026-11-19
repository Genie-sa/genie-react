# Acme Tracker (realworld-legacy)

A project-management app written the way a React codebase that started in 2019 and kept shipping looks: React 18.3 in `StrictMode`, webpack 5 with Babel, React Router 6, Redux Toolkit 1.9 beside hand-written reducers and thunks, `connect()`-wrapped class components, reselect, RTK Query for part of the data and plain `fetch` for the rest, Formik, and higher-order and render-prop components.

It is a realistic target for evaluating Genie on older code. It ships with seeded defects; the answer key lives outside this folder in [`evals/realworld/legacy`](../../evals/realworld/legacy).

## Run it

Start the standalone hub and the dev server in two terminals:

```bash
pnpm --filter @genie-react/realworld-legacy hub
pnpm --filter @genie-react/realworld-legacy dev
```

To run several copies side by side, give each its own `PORT` and `GENIE_HUB_PORT`, and set both in both terminals: `PORT=5212 GENIE_HUB_PORT=15212 pnpm --filter @genie-react/realworld-legacy hub`, then the same with `dev`. Pick hub ports away from the dev servers' range, such as `PORT` + 10000; `PORT` + 1 is often the next copy's dev server. The dev server refuses a `PORT` other than 4711 without `GENIE_HUB_PORT`, because that copy's page would otherwise connect to whichever app's hub owns port 4712.

Open http://127.0.0.1:4711 and sign in as `dana@acme.test` with password `password` (every seeded user has the same password).

| Variable | Default | Meaning |
| --- | --- | --- |
| `PORT` | `4711` | Dev server port |
| `GENIE_HUB_PORT` | `4712`; required when `PORT` is not 4711 | Hub port, used by `pnpm hub` and compiled into the development client |
| `MOCK_LATENCY_MS` | `60` | Latency added to every mock API response |

Genie is wired only in development, as the [other web bundler guide](../../apps/docs/content/docs/setup/other-web.mdx) describes: the development entry loads `genie-react/hook` first, then a bundled client with the session, React, memory, performance and timeline collectors. The production build (`pnpm build`) contains neither.

## Mock backend

`mock-server/` is mounted into the dev server. It generates 36 users, 8 projects and 3,240 issues, plus comments, activity and notifications, from a fixed seed, so every run sees the same data. Nothing leaves the machine.

`/api/__control/*` resets the data (optionally with a different seed or notification poll interval), injects latency or error statuses into any request (including JavaScript chunks), and adds notifications.

## Genie app tools

| Tool | What it does |
| --- | --- |
| `app_sign_in`, `app_sign_out` | Sign in or out through the real thunks |
| `app_backend_reset` | Regenerate the mock data and clear faults |
| `app_backend_faults` | Replace the latency and error injection rules |
| `app_backend_notify` | Add an unread notification |
`src/devtools/connect-genie.ts` also registers Genie's Redux collector for the store, before `index.tsx` renders, so every `connect()` binding and `useDispatch()` call goes through it. Its `redux_actions` and `redux_state` tools, and the action named on each store-driven render cause, are what the store-driven probes read.
