# Meridian Ops

An internal operations console for a fictional fulfilment company: orders, customers, inventory,
reports and team settings behind a sign-in. It is a realistic Vite and React 19 target for Genie,
with deep provider trees, a 6,000-row virtualised table, code-split routes, loaders, forms and a
seeded backend.

## Run it

```bash
pnpm install
pnpm build
DASHBOARD_PORT=5481 pnpm --filter @genie-react/realworld-dashboard dev
```

The dev server binds `127.0.0.1` on `DASHBOARD_PORT` (default `5480`) and fails instead of picking
another port when that one is taken. Open `/login` and sign in with any demo account; the password
is `meridian` for all of them.

| Email                  | Role    |
| ---------------------- | ------- |
| `morgan@meridian.test` | admin   |
| `priya@meridian.test`  | manager |
| `sami@meridian.test`   | agent   |
| `lina@meridian.test`   | viewer  |

## Stack

- Vite 8, React 19 in StrictMode, TypeScript, Tailwind CSS 4
- TanStack Router with file-based routes, automatic code splitting, loaders and validated search params
- TanStack Query for server state, including optimistic updates and Suspense queries
- zustand for workspace state (selection, density, recently viewed), persisted to `localStorage`
- react-hook-form with zod schemas for every form
- `@tanstack/react-virtual` for the orders table
- Genie, wired as the [Vite setup guide](../docs/content/docs/setup/vite.mdx) describes and only in development

## Mock backend

`mock-api/` is a Vite middleware that serves `/api/*` from an in-memory database generated from a
fixed seed: 6,000 orders, 1,200 customers, 2,400 products across six warehouses, plus shipments,
activity, notifications and an audit log. Every request is a real HTTP request, so the browser's
Resource Timing and Genie's timeline see it. Each route has a fixed latency; search latency grows
as the term gets shorter. Data lives as long as the dev server and nothing reaches the network.

Development endpoints under `/api/__dev/` reset the data, inject failures and change latency. The
app exposes them to agents as Genie app tools:

| Tool                 | Kind   | Purpose                                                         |
| -------------------- | ------ | --------------------------------------------------------------- |
| `app_session`        | query  | Signed-in user, role and permissions                            |
| `app_login_as`       | action | Sign in as the demo user for a role                             |
| `app_sign_out`       | action | Sign out                                                        |
| `app_backend_state`  | query  | Seed, fault and latency rules, request and record counts        |
| `app_reset_backend`  | action | Regenerate data from a seed and reset the Query cache           |
| `app_inject_fault`   | action | Fail matching requests with an HTTP status                      |
| `app_clear_faults`   | action | Remove every injected fault                                     |
| `app_set_latency`    | action | Override per-route latency or scale all latency                 |
| `app_live_updates`   | query  | Live-update listener counts per topic                           |

```bash
pnpm exec genie-react tools app --session my-agent --json
pnpm exec genie-react call app_login_as '{"role":"manager"}' --session my-agent --json
pnpm exec genie-react call app_inject_fault '{"path":"/api/orders/*","method":"PATCH","status":503}' --session my-agent --json
```

## Layout

```text
mock-api/            seeded data, routes, latency and fault injection (Vite middleware)
src/api/             typed client and shared request/response types
src/app/             auth, preferences (theme, locale), permissions, toasts, Query client
src/components/      UI kit, charts, error and route feedback
src/dev/             Genie app tools
src/features/        dashboard, orders, customers, inventory, reports, settings, auth
src/layout/          shell, sidebar, top bar, search palette, notifications
src/routes/          TanStack Router file routes
src/stores/          zustand workspace store
```
