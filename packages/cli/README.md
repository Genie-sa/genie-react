# Genie CLI

Give your coding agent DevTools for the running React app.

The CLI lets an agent inspect, test, optimize, and verify the app from the terminal. Results are short for humans and structured for agents.

## Start

```bash
pnpm add -D genie-react
npx @genie-react/cli init
pnpm dev
```

Check the connection:

```bash
npx @genie-react/cli status
```

```text
connected · shop · react 19.2.0 · 64 tools
```

## Useful tools

### See why components rendered

```bash
npx @genie-react/cli call react_get_renders '{"sort":"selfTime","limit":3}'
```

```text
3 commits · 2 components · 8 renders · 7 updates · 1 unstable · 3 unnecessary
unstable props: filters×3
  ProductGrid #18 4× (1m 3u) · 3 unnec · 3 unstable · self 18.4ms · ↻ props: filters(unstable) (ProductGrid.tsx:24)
```

The agent gets the component, source line, cost, and render cause.

### Inspect live queries

```bash
npx @genie-react/cli call query_list '{}'
```

```text
3 queries · 1 stale · ! 1 orphaned (churn)
  ["products"] · success · fresh · 2 obs
  ["cart"] · success · stale · 1 obs · ! 6 fetches/10s
```

The agent can spot stale data, refetch storms, and cache churn.

### Find a blank or stuck screen

```bash
npx @genie-react/cli call react_error_state '{}'
```

```text
1 caught · 0 suspended
  RouteErrorBoundary #42 caught "Cannot read properties of undefined" from Checkout (checkout.tsx:51)
```

The agent sees errors caught by React even when the console or page does not explain them.

### Test loading and error UI

```bash
npx @genie-react/cli call query_simulate_state \
  '{"queryKey":["products"],"state":"pending"}'
```

```text
ok=true · queryHash="[\"products\"]" · simulatedState="pending" · originalStatus="success"
```

Drive and inspect the loading UI, then restore it:

```bash
npx @genie-react/cli call query_restore_state '{"queryKey":["products"]}'
```

## Agent output

Use `--json` for one JSON value or `--fields` for JSONL:

```bash
npx @genie-react/cli call query_list '{}' --json
npx @genie-react/cli call react_find_components '{"name":"Product"}' \
  --fields id,name,path
```

Errors are structured too:

```json
{"status":"error","reason":"not_connected","message":"No app session is connected.","userActionRequired":true}
```

This gives the agent a stable interface it can call, filter, and verify without scraping terminal text.

## Discover more

```bash
npx @genie-react/cli tools
npx @genie-react/cli tools react
npx @genie-react/cli tools react_get_renders
```

Each tool includes its input schema and a runnable example. See the [full setup and tool list](https://github.com/Genie-sa/genie-react#readme).
