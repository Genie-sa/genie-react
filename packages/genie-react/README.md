# Genie React

Give your coding agent live access to your React app.

Genie helps an agent:

- find slow and wasted renders
- inspect props, state, hooks, effects, queries, and routes
- test loading, error, and Suspense states
- verify a fix in the running app from end to end

Source code shows what *should* happen. Genie shows what *did* happen.

## Install

```bash
pnpm add -D genie-react
npx @genie-react/cli init
pnpm dev
```

Open the app. The agent can now use the live DevTools:

```bash
npx @genie-react/cli status
npx @genie-react/cli tools
```

Genie is active in development only. It does not ship in your production build.

## What the agent can do

### Find performance problems

```bash
npx @genie-react/cli call react_profile_start '{}'
# Drive the flow you want to measure.
npx @genie-react/cli call react_profile_report '{"limit":3}'
```

Example output:

```text
4 commits
slowest: ProductGrid 18.4ms×4, Cart 5.2ms×2
re-rendered: ProductGrid 4×, ProductCard 12×
unnecessary: ProductCard 8/12
```

The agent knows where time was spent and what to optimize.

### Prove the fix

Measure the same flow before and after the change:

```bash
npx @genie-react/cli call react_profile_snapshot '{"label":"before"}'
# Apply the fix, then clear the profile.
npx @genie-react/cli call react_profile_start '{}'
# Drive the same flow.
npx @genie-react/cli call react_renders_diff '{"baseline":"before"}'
```

Example output:

```text
18.4ms → 7.1ms (-61.4%) · commits 4→3 · 0 regressed · 2 improved
  ProductGrid -9.8ms
  ProductCard -1.5ms
```

The result is measured, not guessed.

### Test states without changing app code

```bash
npx @genie-react/cli call query_simulate_state \
  '{"queryKey":["products"],"state":"error","errorMessage":"Request failed"}'

# Inspect the real error UI, then restore the exact query state.
npx @genie-react/cli call query_restore_state '{"queryKey":["products"]}'
```

The agent can also hold a Suspense fallback open, force an error boundary, navigate routes, inspect the query cache, and map DOM elements back to React components.

## Close the loop

Pair Genie with a browser or device tool:

1. Make a change.
2. Drive the real app.
3. Read React and TanStack state.
4. Fix or optimize the issue.
5. Repeat the same flow and verify the result.

The agent can extract the runtime details it needs instead of asking you for screenshots, logs, or guesses.

## Works with

- React 18 and 19
- Vite and TanStack Start
- Next.js
- React Native and Expo
- TanStack Query and TanStack Router

See the [full setup and tool list](https://github.com/Genie-sa/genie-react#readme).
