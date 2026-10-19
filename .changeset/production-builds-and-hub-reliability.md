---
"genie-react": minor
"@genie-react/cli": minor
---

Production builds and hub reliability.

- **Production bundles stay clean.** `genie-react` and `genie-react/tools` resolve to a no-op module under the `production` export condition (Vite, webpack, Turbopack), the Vite plugin strips `genie-react/tools` like the root entry, and app-tool registration and the `genie-react/hook` instrumentation stay inert when `NODE_ENV` is `production`. The React Native and Next.js Query setup docs now load Genie only in development.
- **`next dev --webpack` connects again.** The hub loads `ws` after opting out of its native addons, so webpack's `bufferutil` stub no longer crashes every socket.
- **The hub no longer crashes** when a hub-side tool handler throws; the agent gets a `tool-error` reply instead.
- **`devtools_wait` keeps its timeout** for every condition, fails at once when its probe tool errors (for example `navigation` without a router), and reports `unknown-session` with the connected targets for a mistyped `--session`.
- **Clearer interaction and capture errors.** `INTERACTION_ACTIVE` names the recording interaction in `errorDetails.interactionId`; disconnects and busy apps during an interaction or capture keep their `not-connected`/`busy` codes and retry hints.
- **Safer multi-tab routing.** While the default tab reloads, only read-only calls run on another open tab; mutations ask for a retry. Two agents that reuse a request id no longer receive each other's results.
- **Captures default to the domains the app advertises**, so apps without a router or Query no longer get incomplete captures with warnings.
- **`devtools_capture_compare` is faster and says more.** The permutation test no longer blocks the dev server (755 ms → 27 ms at 10+10 captures), metrics without budgets get a headline reason (`regressed 14% (median …, p=…)`), and thin or incomparable cohorts are flagged even without budgets.
- **`devtools_status` defaults `includeTools` to `false`**, so a bare call returns a compact status instead of the full catalog; use `genie-react tools` for discovery.
- **Vite standalone hubs survive restarts.** With `@cloudflare/vite-plugin`, a config change no longer shuts down the hub the restarted server just adopted, and Vite `middlewareMode` (custom Express/SSR servers) now starts a standalone hub instead of injecting a client with no bridge.
