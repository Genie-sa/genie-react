# Fernhill Supply storefront

A realistic Next.js App Router storefront used to test Genie on server components, streaming, server actions and hydration. It is a private workspace app and is never published.

Stack: Next.js 16 (App Router), React 19, TypeScript, TanStack Query on the search, reviews, recently viewed and wishlist views. Genie is wired in exactly as the [Next.js setup guide](../docs/content/docs/setup/nextjs.mdx) describes, in development only.

## Run it

```bash
pnpm install
pnpm build                     # builds genie-react and the CLI from packages/
cd apps/realworld-storefront
PORT=3210 GENIE_HUB_PORT=4410 pnpm dev          # Turbopack
PORT=3210 GENIE_HUB_PORT=4410 pnpm dev:webpack  # webpack
```

`PORT` defaults to 3210. Pick free ports when other dev servers are running; the Genie hub walks upward from `GENIE_HUB_PORT` when that port is busy.

Then connect from the same folder:

```bash
node ../../packages/cli/dist/cli.js status --session me --wait 15000 --json
```

after opening `http://localhost:3210/?_genie=me` in a browser.

## What is in it

| Area | Route | Notes |
| --- | --- | --- |
| Home | `/` | Hero plus independently streamed product rails, a deal countdown, recently viewed and a newsletter form (`useActionState`). |
| Category | `/category/[category]` | Filters, sorting and pagination in search params, a transition-driven pending state, and a quick-view modal from an intercepted `@modal` route. |
| Product | `/product/[slug]` | Gallery with keyboard navigation and a lazily loaded zoom, variants, stock, delivery estimate, streamed recommendations and lazily loaded reviews (Query). |
| Search | `/search` | `useDeferredValue` with a Query-backed result list. |
| Bag | `/cart` | `useOptimistic` quantity changes, server actions and a promo code form. |
| Checkout | `/checkout` | Four validated steps (Zod on client and server) and a server action that places the order. |
| Account | `/account`, `/account/orders` | Behind a mock login (`/login`, `ava@example.test` / `storefront`). |
| Wishlist | `/wishlist` | Client state persisted to `localStorage`. |

Route groups separate the shop, checkout and sign-in layouts. Every route has `loading`, `error` or `not-found` handling where a real shop would.

## Data

All data comes from a seeded, deterministic data layer in `lib/data`. There is no network access. Each data operation has a fixed latency (`lib/dev-contract.ts`), scaled by `STOREFRONT_LATENCY_SCALE` (default `1`, `0` for instant). Server state (carts, sessions, placed orders, faults) lives in memory and resets when the dev server restarts.

## Genie app tools

In development the app registers these tools (`components/devtools/store-devtools.tsx`):

| Tool | Kind | Purpose |
| --- | --- | --- |
| `app_store_state` | query | Signed-in user, cart lines with stock, active faults, demo accounts. |
| `app_login`, `app_logout` | action | Sign in or out without the form. |
| `app_seed_cart` | action | Replace the cart with a preset (`starter`, `low-stock`) or explicit lines. |
| `app_set_fault` | action | Make a data operation fail or slow down, for a number of calls or until cleared. |
| `app_reset` | action | Restore the seeded store, including this browser's wishlist. |

The tools call `/api/dev/state`, which answers 404 outside development.
