# genie-react

## 0.2.0

### Minor Changes

- d4f511c: New `react_component_for_dom` tool: a CSS selector resolves to the owning React component(s) with id, props, and source file:line — the reverse of `react_dom_for_component`. `genie doctor --live` probes the running stack end to end (hub HTTP + identity, served client bundle, WS session round-trip). Stale `.genie/bridge.json` files whose pid is gone are announced and removed by both discovery and doctor. Piped `--json` output is no longer truncated at 64KB (natural exit instead of `process.exit`).
- a11e8bf: Consolidate the app-side packages into one `genie-react` package.

  `@genie-react/core`, `client`, `react-collector`, `tanstack-collector`, `devtools-plugin`, `memory`, `react`, `bridge`, and `vite` are replaced by the single `genie-react` package with subpath exports: `genie-react` (the `<Genie />` component), `genie-react/vite` (the plugin), `genie-react/client` + `genie-react/hook` (the injected client), `genie-react/hub` (the standalone bridge), and `genie-react/protocol` (wire protocol + tool contracts).

  Migration: `pnpm add -D genie-react`, then `import { Genie } from 'genie-react'` and `import { genie } from 'genie-react/vite'`. The CLI (`@genie-react/cli`) is unchanged in usage; `genie init`, `doctor`, and `link` now wire the single package.

- 5e60814: Framework-agnostic attach: Next.js support and a standalone hub for any non-Vite React app.

  The hub now serves a self-contained browser client at `GET /__genie/client.js`, so any React setup attaches with one classic script tag — no bundler integration required. New surface: `genie hub` (CLI command, default port 4390), `<GenieScript />` from `genie-react/script` (dev-only script tag for any SSR root layout, RSC-safe), and `genie-react/next` with `registerGenie()` for Next.js `instrumentation.ts`. `genie init` and `doctor` now detect Next.js apps and wire the layout + instrumentation automatically.

### Patch Changes

- ac61385: Context economy for agents: `genie tools` becomes progressive discovery (group index → `tools <group>` → `tools <tool>` with the full description and a runnable example; `--all` for the flat catalog, `--json` slim by default with full schemas per tool); ten new compact summarizers (status, find_components, component_for_dom, inspect_component, error_state, profile_report, query_list, query_get, router_get_state, router_list_matches) so hot reads stop dumping pretty JSON; `--json` output is now compact machine JSON; per-command `--help` for every subcommand.
- 0f2f2e4: Discovery polish from the three-model economy tests: read-group listings point at their domain's mutation tools in the `action` group; small flat action results render as one line (`ok=true · pathname="/error"`) instead of pretty JSON; `router_list_routes` gets a summary; generic basenames keep a parent segment (`routes/index.tsx:106`); array-valued query data previews as `[N items]` instead of dumping; the caught-error message is recovered from the console text when React 19.2 passes no Error instance.
- 8d99b93: Five-host E2E fleet fixes: `<GenieScript />` keeps a walked hub port across Next.js recompiles (global-symbol handoff); `<Genie />` discovers the QueryClient from a plain `QueryClientProvider` and accepts explicit `queryClient`/`router` props; `plugin_emit` auto-prefixes bare event types; React 19 error-boundary console text is parsed (message + thrower no longer dropped); consumed contexts are deduped (StrictMode double-reads); `react_get_tree` defaults to `appOnly` like its siblings; meta tools appear in the advertised catalog so counts agree; `genie tools` honors `--json` and `--session`; `init`/`doctor` treat the universal hub + script-tag path as a valid setup (exit 0); hub-down CLI errors no longer assume Vite; clearer `query_fetch` and effect-audit messages.
