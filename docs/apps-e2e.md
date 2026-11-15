# Apps end-to-end matrix

`scripts/check-apps-e2e.mjs` runs Genie against every web demo in `apps/` the way a user runs it: the app's own dev server and hub, a Playwright Chromium tab with a named `_genie` session, and the built CLI called from the app directory with `--json`. CI runs one job per app.

```sh
pnpm check:apps-e2e                                  # build, then every app
node scripts/check-apps-e2e.mjs --app next-demo      # one app, after pnpm build
node scripts/check-apps-e2e.mjs --skip-production    # skip production builds
```

It needs `pnpm build` and `pnpm exec playwright install chromium`. Every server listens on a free port, so runs do not collide with other dev servers on the machine.

## What each app run checks

1. The dev server and its hub start on free ports, and the discovery file names that hub.
2. `status --session <name> --wait` reports the opened tab ready, the app advertises its expected domains, and once the app has rendered its status carries no warnings (a page that failed before React mounted is flagged).
3. Contract sweep: every advertised tool's `tools <name>` contract is well formed. Every read-only tool is called with its required arguments (live values where the schema has none) and each schema example. A result must match the tool's output outline. A failure must be a typed CLI envelope; `tool_unavailable` passes only with a stated reason. A hang, malformed JSON or an untyped error fails the run.
4. Ground truth: Playwright drives interactions whose outcome the app source fixes, and the evidence must match an independent oracle (the DOM, `document.title`, the source file's line). Mutating tools run in round trips that restore state and assert the restore.
5. Coverage: every advertised tool, including tools that appear after navigation, has been called successfully or has a recorded reason for exclusion.
6. No unexpected page error or console error, with Genie-initiated failed requests attributed through each request's initiator stack.
7. Stopping the dev server with SIGTERM leaves neither the discovery file nor its agent-token file.
8. Production (vite-demo, router-demo, next-demo): next-demo type-checks and builds as shipped; the build output (for Next.js, both `.next/static` and `.next/server`) carries no Genie runtime marker, and the production page requests nothing from a hub, opens no WebSocket and installs no Genie global or DevTools hook.

| App | Hub | Ground truths |
| --- | --- | --- |
| `vite-demo` | `genie()` Vite plugin | render causes for state, memo props, context; hot effect audit; JSX callsites; Query data and mutation; app tools (roles, flags, fixtures, fault injection, tombstones); StyleX rules; every override kind; error boundary |
| `router-demo` | `genie()` Vite plugin | render causes; effect dependency slots; JSX callsites; Query refetch counters; simulated states; Router navigation against the URL; route-scoped app tools; every override kind; error boundary; plugin bus |
| `demo` | `genie()` under TanStack Start SSR | app name; Query and keyed mutation; render causes by value and by reference; effect runs; cohort of 50 rows filtered to 5; DevTools plugin events; Suspense and error state; every override kind |
| `plain-demo` | standalone `genie-react hub`, `<script>` tag and manual `createGenieClient` | render causes; both effects; unmount tombstone; esbuild source maps; Suspense lifecycle; every override kind; two tabs with separate sessions |
| `next-demo` | `registerGenie()` in `instrumentation.ts` | render causes; memo reference-only props; effect cleanup order; a server component's JSX callsite mapped through the Next.js source-map endpoint; Query against the DOM; Suspense and error state; every override kind |

## Known defects

`scripts/apps-e2e/known-defects.mjs` lists product defects the matrix reproduces on every run, each with severity, expected and actual behaviour, and a repro command. The run prints them loudly and passes only because they are listed. When a fix lands, the probe starts passing and the run fails until the entry, or the app in it, is removed. A defect listed but not reproduced also fails the run, so the list stays accurate and can be driven to empty.

## Not covered

- **React Native.** CI has no simulator, so CI only type-checks `examples/expo-demo`. On 2026-11-15, examples/expo-demo was validated once by hand on a throwaway iOS 26.5 simulator (iPhone 17 Pro, Expo Go 57.0.9, standalone hub and Metro on free ports). The session became ready with `session, react, memory, perf, plugin, timeline, router, query` and 80 tools. After one tap on Increment probe, `react_get_renders` reported `VisibilityProbe` updating once with an exact `state[0]` cause, and the `View`, `Text` and `Pressable` callsites at `visibility-testbed.tsx` lines 8, 9 and 10. `react_quiesce` reported render collection as degraded because the hook installed after React initialised under Expo Go, and said so. Android, physical devices and every other tool on React Native remain unverified.
- **Other browsers.** Only Chromium runs. Firefox and WebKit are not exercised.
- **Packed installs.** The apps use workspace links. `pnpm test:e2e` covers a packed Vite consumer, and `pnpm test:compatibility` covers dependency ranges.
- **Production for `demo` and `plain-demo`.** The TanStack Start server build and the esbuild demo have no production check.
- **Excluded tools.** `query_clear`, `query_reset`, `query_cancel` and `router_clear_cache` are advertised but not called, for the reasons recorded in `scripts/apps-e2e/run-app.mjs`.
