# Evidence: best-tools-for-ai-agents-debugging-react-2026

- Date: 2026-11-19 (runs between 03:55 and 04:11 UTC)
- Commit: `6867352ba46ec3998fe8cda0ba915536fddfa666` (`git rev-parse HEAD` when the runs started). The
  article branch was later fast-forwarded to `c46150076cdc8ecf927d31abbd78104804fd7ad7`; that range
  changes only docs files, not `apps/realworld-dashboard`, `packages`, `evals` or `skills`.
- App: `apps/realworld-dashboard` (Meridian Ops), React 19.3.1 development build in StrictMode.
  Dev server: `DASHBOARD_PORT=5221 pnpm exec vite --port 5221 --strictPort` from the app folder.
  Scratch copies (for the tools that install into the app) ran from
  `apps/realworld-dashboard/.variants/art-m1-<tool>` (gitignored) with
  `DASHBOARD_PORT=5221 ../../node_modules/.bin/vite --port 5221 --strictPort`, one at a time.
- URL: `http://127.0.0.1:5221/orders?status=processing` (redirects to
  `/orders?status=processing&sort=placedAt&dir=desc`)
- Genie CLI and runtime 1.0.2 from this checkout (`pnpm install && pnpm build`), agent-browser 0.43.0,
  headless Chrome 158 at the default 1280x577 viewport. Session name `art-m1` for every command.
- Bug: `order-hold-rerenders-all-rows` from `evals/realworld/dashboard/`. Its reference fix was applied
  with a small script (below) only for the "after" runs and reverted with `git checkout`; in the
  scratch copies it was applied in place and the copies were deleted afterwards. Nothing was committed.

The interaction in every run is `/tmp/art-m1/hold.sh`:

```bash
agent-browser --session art-m1 find role button click --name 'Actions for SO-105979'
agent-browser --session art-m1 find role menuitem click --name 'Put on hold'
agent-browser --session art-m1 wait --text 'SO-105979 updated'
```

The fix script `/tmp/art-m1/applyfix.mjs` reads `referenceFix` from the spec and replaces each `find`
string once in the target app folder. Before each run the backend was reset with
`app_reset_backend` so SO-105979 is in Processing again.

Commands ran in the order shown. Lines starting `## ` inside the log are my notes, `$ ` lines are the
commands, and `[exit N]` is the exit code. Output is untrimmed. A few short `sleep` pauses between
commands are not shown. Debug steps that did not go through the logger are described in prose.


## Notes on steps outside the log

- react-scan, first load: with the default toolbar, `#react-scan-root` sat over the **Actions** button
  of SO-105979 at 1280x577 and agent-browser refused the click (logged). I then checked with
  `agent-browser eval` that `document.elementFromPoint` at the button's centre returned
  `react-scan-root`, and that `localStorage['react-scan-options']` held `showToolbar:true`.
  Setting `showToolbar: false` did not take effect at first because the dashboard's
  `vite.config.ts` has `watch: { ignored: ['**/.variants/**'] }`, so my edit to the scratch copy was
  not served. I changed `ignored` to `[]` in each scratch copy and restarted the server. That was my
  setup error, not a react-scan bug.
- react-scan 0.5.7 source check: `node_modules/react-scan/dist/index.mjs` creates its instrumentation
  with `trackChanges: false` (line 8434), and the console logger only prints change lines from
  `render.changes`, which stays empty unless an instrumentation instance has `trackChanges`. That
  explains the empty `OrderRow` groups. `collectInspectorData` (defined near line 7110) collects
  props, state and context changes for the toolbar's inspector.
- why-did-you-render: in the first run the scratch dev server served `src/main.tsx` with
  `import "/src/wdyr.ts"` as its first import (checked with `curl`), so the setup matched the README.
- agent-react-devtools: the first start failed in the browser with
  `Could not resolve "react-devtools-core" imported by "agent-react-devtools"` (an optional peer that
  `npm i --legacy-peer-deps` skipped) and a Genie app-tool error caused by the zod 3 copy that
  agent-react-devtools depends on shadowing the app's zod 4 in the scratch `node_modules`. I installed
  `react-devtools-core` and moved zod 3 under `agent-react-devtools/node_modules`. Neither error is
  a bug in either tool; both came from my scratch install.
- Genie stayed wired in every scratch copy (its Vite plugin and app tools), so `app_reset_backend` and
  `app_login_as` worked there too. The other tools were added beside it.
- The react-scan overlay image in the article is `/tmp/art-m1/react-scan-after-click.png`, the
  `agent-browser screenshot` taken in the logged react-scan run with the bug present, copied to
  `apps/docs/public/articles/react-scan-order-hold.png` unchanged.
- Tool versions: react-scan 0.5.7, @welldone-software/why-did-you-render 10.0.1,
  agent-react-devtools 0.5.0 (plus react-devtools-core 6), chrome-devtools-mcp 1.13.0.

## Scratch copy changes

````diff
### Scratch copy art-m1-scan: config and entry changes (the reference-fix edits applied later are shown in the fix diff)
diff --git a/src/main.tsx b/.variants/art-m1-scan/src/main.tsx
index 08fd988..38ee764 100644
--- a/src/main.tsx
+++ b/.variants/art-m1-scan/src/main.tsx
@@ -1,3 +1,7 @@
+import { scan } from 'react-scan'
+
+scan({ enabled: true, log: true, showToolbar: false })
+
 import { QueryClientProvider } from '@tanstack/react-query'
 import { createRouter, RouterProvider } from '@tanstack/react-router'
 import { StrictMode, useEffect } from 'react'
diff --git a/vite.config.ts b/.variants/art-m1-scan/vite.config.ts
index bdd4bfd..5485468 100644
--- a/vite.config.ts
+++ b/.variants/art-m1-scan/vite.config.ts
@@ -14,7 +14,7 @@ export default defineConfig({
     host: '127.0.0.1',
     port: Number(process.env.DASHBOARD_PORT ?? DEFAULT_PORT),
     strictPort: true,
-    watch: { ignored: ['**/.variants/**'] },
+    watch: { ignored: [] },
   },
   preview: {
     host: '127.0.0.1',
### Scratch copy art-m1-wdyr: config and entry changes (the reference-fix edits applied later are shown in the fix diff)
diff --git a/src/main.tsx b/.variants/art-m1-wdyr/src/main.tsx
index 08fd988..f87fbc9 100644
--- a/src/main.tsx
+++ b/.variants/art-m1-wdyr/src/main.tsx
@@ -1,3 +1,4 @@
+import './wdyr'
 import { QueryClientProvider } from '@tanstack/react-query'
 import { createRouter, RouterProvider } from '@tanstack/react-router'
 import { StrictMode, useEffect } from 'react'
diff --git a/vite.config.ts b/.variants/art-m1-wdyr/vite.config.ts
index bdd4bfd..01fcb56 100644
--- a/vite.config.ts
+++ b/.variants/art-m1-wdyr/vite.config.ts
@@ -14,7 +14,7 @@ export default defineConfig({
     host: '127.0.0.1',
     port: Number(process.env.DASHBOARD_PORT ?? DEFAULT_PORT),
     strictPort: true,
-    watch: { ignored: ['**/.variants/**'] },
+    watch: { ignored: [] },
   },
   preview: {
     host: '127.0.0.1',
@@ -25,7 +25,7 @@ export default defineConfig({
     genie({ appName: 'Meridian Ops' }),
     mockApi(),
     tanstackRouter({ target: 'react', autoCodeSplitting: true }),
-    react(),
+    react({ jsxImportSource: '@welldone-software/why-did-you-render' }),
     tailwindcss(),
   ],
 })
+++ new file src/wdyr.ts
import React from 'react'
import whyDidYouRender from '@welldone-software/why-did-you-render'

if (import.meta.env.DEV) {
  whyDidYouRender(React, { trackAllPureComponents: true, logOnDifferentValues: true })
}
### Scratch copy art-m1-ard: config and entry changes (the reference-fix edits applied later are shown in the fix diff)
diff --git a/vite.config.ts b/.variants/art-m1-ard/vite.config.ts
index bdd4bfd..8a7e8ef 100644
--- a/vite.config.ts
+++ b/.variants/art-m1-ard/vite.config.ts
@@ -4,6 +4,7 @@ import { tanstackRouter } from '@tanstack/router-plugin/vite'
 import react from '@vitejs/plugin-react'
 import { genie } from 'genie-react/vite'
 import { defineConfig } from 'vite'
+import { reactDevtools } from 'agent-react-devtools/vite'
 import { mockApi } from './mock-api/plugin.ts'
 
 const DEFAULT_PORT = 5480
@@ -14,7 +15,7 @@ export default defineConfig({
     host: '127.0.0.1',
     port: Number(process.env.DASHBOARD_PORT ?? DEFAULT_PORT),
     strictPort: true,
-    watch: { ignored: ['**/.variants/**'] },
+    watch: { ignored: [] },
   },
   preview: {
     host: '127.0.0.1',
@@ -25,6 +26,7 @@ export default defineConfig({
     genie({ appName: 'Meridian Ops' }),
     mockApi(),
     tanstackRouter({ target: 'react', autoCodeSplitting: true }),
+    reactDevtools({ port: 8221 }),
     react(),
     tailwindcss(),
   ],
````

## Genie: connect, diagnose, verify before and after

````console
## Genie: connect to apps/realworld-dashboard on port 5221 (shipped code, bug present)

$ agent-browser --session art-m1 open http://127.0.0.1:5221/login
[agent-browser] launched browser
✓ Meridian Ops
  http://127.0.0.1:5221/login
[exit 0]

$ npx genie-react status --session art-m1 --wait 15000
selectedBridgeUrl: ws://127.0.0.1:5221/__genie/ws
sessionSelector:
  requested: art-m1
  source: flag
  resolvedSessionId: be9da1f7-abec-409c-b2b4-b87a69478c01
  implicit: false
  agentBrowser: {session:art-m1,via:selector,logicalSessionId:7ec0ff54-7211-4370-856f-bbf2a071c8ce}
connected: true
ready: true
sessionId: be9da1f7-abec-409c-b2b4-b87a69478c01
app: {name:"Meridian Ops",url:http://127.0.0.1:5221/login,reactVersion:19.3.1,reactMounted:true}
domains: [session,react,app,memory,perf,plugin,timeline,router,query]
toolCount: 98
sessions[1] (sessionId {fields}):
  be9da1f7-abec-409c-b2b4-b87a69478c01 {logicalSessionId:7ec0ff54-7211-4370-856f-bbf2a071c8ce,documentGeneration:2,logicalSessionCollision:false,collisionWithSessionIds:[],app:{name:"Meridian Ops",url:http://127.0.0.1:5221/login,reactVersion:19.3.1,reactMounted:true},domains:[session,react,app,memory,perf,plugin,timeline,router,query],toolCount:98,connectedAt:1795060518003,ready:true,readyAt:1795060518003,current:true,origin:http://127.0.0.1:5221,runtimeVersion:1.0.2}
warnings: []
hub: {version:1.0.2,protocol:1}
[exit 0]

$ npx genie-react call app_login_as '{"role":"manager"}' --session art-m1
changed: true
role: manager
userId: u-manager
[exit 0]

$ agent-browser --session art-m1 open 'http://127.0.0.1:5221/orders?status=processing'
✓ Meridian Ops
  http://127.0.0.1:5221/orders?status=processing&sort=placedAt&dir=desc
[exit 0]

$ agent-browser --session art-m1 snapshot -i
(no interactive elements)
[exit 0]

$ agent-browser --session art-m1 snapshot -i
- generic "MMeridian OpsDashboardOrdersCustomersInventoryReportsSettingsSearch orders, customers, products…⌘K4P" [ref=e1] clickable [onclick]
  - link "Dashboard" [ref=e8]
  - link "Orders" [ref=e9]
  - link "Customers" [ref=e10]
  - link "Inventory" [ref=e11]
  - link "Reports" [ref=e12]
  - link "Settings" [ref=e13]
  - button "Collapse sidebar" [ref=e2]
  - button "Search orders, customers, products… ⌘K" [ref=e3]
  - button "Notifications, 4 unread" [ref=e4]
  - button "Account menu" [expanded=false, ref=e14]
  - heading "Orders" [level=1, ref=e15]
  - button "Refresh orders" [ref=e16]
  - link "New order" [ref=e17]
  - textbox "Filter orders" [ref=e18]
  - combobox "Status" [expanded=false, ref=e5]: Processing
    - option "All statuses" [ref=e20]
    - option "Pending" [ref=e21]
    - option "Processing" [selected, ref=e22]
    - option "On hold" [ref=e23]
    - option "Shipped" [ref=e24]
    - option "Delivered" [ref=e25]
    - option "Cancelled" [ref=e26]
  - combobox "Region" [expanded=false, ref=e6]: All regions
    - option "All regions" [selected, ref=e27]
    - option "NA" [ref=e28]
    - option "EMEA" [ref=e29]
    - option "APAC" [ref=e30]
    - option "LATAM" [ref=e31]
  - button "Toggle density" [ref=e7]
  - button "Columns" [expanded=false, ref=e19]
  - checkbox "Select all orders" [checked=false, ref=e40]
  - columnheader "Order" [ref=e32]
    - button "Order" [ref=e41]
  - columnheader "Customer" [ref=e33]
    - button "Customer" [ref=e42]
  - columnheader "Status" [ref=e34]
    - button "Status" [ref=e43]
  - columnheader "Priority" [ref=e35]
  - columnheader "Region" [ref=e36]
  - columnheader "Units" [ref=e37]
  - columnheader "Placed" [ref=e38]
    - button "Placed" [ref=e44]
  - columnheader "Total" [ref=e39]
    - button "Total" [ref=e45]
  - gridcell "Select SO-105999" [ref=e46]
    - checkbox "Select SO-105999" [checked=false, ref=e146]
  - gridcell "SO-105999" [ref=e47]
    - link "SO-105999" [ref=e147]
  - gridcell "Delta Health 5" [ref=e48]
  - gridcell "Processing" [ref=e49]
  - gridcell "standard" [ref=e50]
  - gridcell "EMEA" [ref=e51]
  - gridcell "40" [ref=e52]
  - gridcell "Mar 2, 2026" [ref=e53]
  - gridcell "$8,624.19" [ref=e54]
  - gridcell "Actions for SO-105999" [ref=e55]
    - button "Actions for SO-105999" [expanded=false, ref=e166]
  - gridcell "Select SO-105998" [ref=e56]
    - checkbox "Select SO-105998" [checked=false, ref=e148]
  - gridcell "SO-105998" [ref=e57]
    - link "SO-105998" [ref=e149]
  - gridcell "Willow Mercantile 3" [ref=e58]
  - gridcell "Processing" [ref=e59]
  - gridcell "standard" [ref=e60]
  - gridcell "EMEA" [ref=e61]
  - gridcell "27" [ref=e62]
  - gridcell "Mar 2, 2026" [ref=e63]
  - gridcell "$4,806.28" [ref=e64]
  - gridcell "Actions for SO-105998" [ref=e65]
    - button "Actions for SO-105998" [expanded=false, ref=e167]
  - gridcell "Select SO-105990" [ref=e66]
    - checkbox "Select SO-105990" [checked=false, ref=e150]
  - gridcell "SO-105990" [ref=e67]
    - link "SO-105990" [ref=e151]
  - gridcell "Orchid Health" [ref=e68]
  - gridcell "Processing" [ref=e69]
  - gridcell "standard" [ref=e70]
  - gridcell "APAC" [ref=e71]
  - gridcell "42" [ref=e72]
  - gridcell "Mar 2, 2026" [ref=e73]
  - gridcell "$8,555.16" [ref=e74]
  - gridcell "Actions for SO-105990" [ref=e75]
    - button "Actions for SO-105990" [expanded=false, ref=e168]
  - gridcell "Select SO-105979" [ref=e76]
    - checkbox "Select SO-105979" [checked=false, ref=e152]
  - gridcell "SO-105979" [ref=e77]
    - link "SO-105979" [ref=e153]
  - gridcell "Lumen Retail" [ref=e78]
  - gridcell "Processing" [ref=e79]
  - gridcell "standard" [ref=e80]
  - gridcell "NA" [ref=e81]
  - gridcell "46" [ref=e82]
  - gridcell "Mar 2, 2026" [ref=e83]
  - gridcell "$2,341.78" [ref=e84]
  - gridcell "Actions for SO-105979" [ref=e85]
    - button "Actions for SO-105979" [expanded=false, ref=e169]
  - gridcell "Select SO-105973" [ref=e86]
    - checkbox "Select SO-105973" [checked=false, ref=e154]
  - gridcell "SO-105973" [ref=e87]
    - link "SO-105973" [ref=e155]
  - gridcell "Summit Health 4" [ref=e88]
  - gridcell "Processing" [ref=e89]
  - gridcell "standard" [ref=e90]
  - gridcell "EMEA" [ref=e91]
  - gridcell "34" [ref=e92]
  - gridcell "Mar 1, 2026" [ref=e93]
  - gridcell "$6,658.64" [ref=e94]
  - gridcell "Actions for SO-105973" [ref=e95]
    - button "Actions for SO-105973" [expanded=false, ref=e170]
  - gridcell "Select SO-105968" [ref=e96]
    - checkbox "Select SO-105968" [checked=false, ref=e156]
  - gridcell "SO-105968" [ref=e97]
    - link "SO-105968" [ref=e157]
  - gridcell "Willow Retail 2" [ref=e98]
  - gridcell "Processing" [ref=e99]
  - gridcell "standard" [ref=e100]
  - gridcell "APAC" [ref=e101]
  - gridcell "29" [ref=e102]
  - gridcell "Mar 1, 2026" [ref=e103]
  - gridcell "$5,684.20" [ref=e104]
  - gridcell "Actions for SO-105968" [ref=e105]
    - button "Actions for SO-105968" [expanded=false, ref=e171]
  - gridcell "Select SO-105958" [ref=e106]
    - checkbox "Select SO-105958" [checked=false, ref=e158]
  - gridcell "SO-105958" [ref=e107]
    - link "SO-105958" [ref=e159]
  - gridcell "Summit Outfitters 3" [ref=e108]
  - gridcell "Processing" [ref=e109]
  - gridcell "standard" [ref=e110]
  - gridcell "LATAM" [ref=e111]
  - gridcell "30" [ref=e112]
  - gridcell "Mar 1, 2026" [ref=e113]
  - gridcell "$6,251.30" [ref=e114]
  - gridcell "Actions for SO-105958" [ref=e115]
    - button "Actions for SO-105958" [expanded=false, ref=e172]
  - gridcell "Select SO-105957" [ref=e116]
    - checkbox "Select SO-105957" [checked=false, ref=e160]
  - gridcell "SO-105957" [ref=e117]
    - link "SO-105957" [ref=e161]
  - gridcell "Acme Systems" [ref=e118]
  - gridcell "Processing" [ref=e119]
  - gridcell "standard" [ref=e120]
  - gridcell "APAC" [ref=e121]
  - gridcell "28" [ref=e122]
  - gridcell "Mar 1, 2026" [ref=e123]
  - gridcell "$5,888.22" [ref=e124]
  - gridcell "Actions for SO-105957" [ref=e125]
    - button "Actions for SO-105957" [expanded=false, ref=e173]
  - gridcell "Select SO-105956" [ref=e126]
    - checkbox "Select SO-105956" [checked=false, ref=e162]
  - gridcell "SO-105956" [ref=e127]
    - link "SO-105956" [ref=e163]
  - gridcell "Vertex Health 3" [ref=e128]
  - gridcell "Processing" [ref=e129]
  - gridcell "standard" [ref=e130]
  - gridcell "LATAM" [ref=e131]
  - gridcell "54" [ref=e132]
  - gridcell "Mar 1, 2026" [ref=e133]
  - gridcell "$15,769.16" [ref=e134]
  - gridcell "Actions for SO-105956" [ref=e135]
    - button "Actions for SO-105956" [expanded=false, ref=e174]
  - gridcell "Select SO-105944" [ref=e136]
    - checkbox "Select SO-105944" [checked=false, ref=e164]
  - gridcell "SO-105944" [ref=e137]
    - link "SO-105944" [ref=e165]
  - gridcell "Union Systems 4" [ref=e138]
  - gridcell "Processing" [ref=e139]
  - gridcell "standard" [ref=e140]
  - gridcell "NA" [ref=e141]
  - gridcell "30" [ref=e142]
  - gridcell "Mar 1, 2026" [ref=e143]
  - gridcell "$4,416.09" [ref=e144]
  - gridcell "Actions for SO-105944" [ref=e145]
    - button "Actions for SO-105944" [expanded=false, ref=e175]
[exit 0]

## Genie: diagnose. Put SO-105979 on hold

$ npx genie-react call react_clear_renders '{"component":"OrderRow"}' --session art-m1
ok: true
tracking: true
documentCommitId: 22
observation: {id:observation:1,epoch:1,startedAfterDocumentCommitId:22}
observationConfig:
  adaptive: true
  adaptiveScale: 1
  fiberLimit: 250
  operationLimit: 30000
  timeLimitMs: 12
  targetOperationReserve: 4000
  targetTimeReserveMs: 4
  lifecycleBufferLimit: 1000
  lifecycleTargetReserve: 100
strictMode: on
[exit 0]

$ agent-browser --session art-m1 find role button click --name 'Actions for SO-105979'
✓ Done
[exit 0]

$ agent-browser --session art-m1 find role menuitem click --name 'Put on hold'
✓ Done
[exit 0]

$ agent-browser --session art-m1 wait --text 'SO-105979 updated'
SO-105979 updated
[exit 0]

$ npx genie-react call react_quiesce '{"idleMs":500,"timeoutMs":10000}' --fail-on-result-error --session art-m1
ok: true
outcome: idle
elapsedMs: 1375
observedCommits: 1
documentCommitId: 32
sessionId: 3eb7fbbd-7bac-438c-af13-650c2b52857d
renderCollection: available
pendingWork:
  documentCommitId: 32
  scheduledRoots: 0
  suspendedBoundaries: 0
  dehydratedBoundaries: 0
  boundaries: []
  scanTruncated: false
  scannedFibers: 736
[exit 0]

$ npx genie-react call react_component_cohort '{"component":"OrderRow"}' --session art-m1
attribution:
  status: current
  startedAtDocumentCommitId: 32
  completedAtDocumentCommitId: 32
  startedAtAnalysisGeneration: 33
  completedAtAnalysisGeneration: 33
documentCommitId: 32
ownershipCoverage:
  complete: true
  totalCandidates: 13
  app: 13
  library: 0
  unknown: 0
  affects: ownership-labels
observation: {id:observation:1,epoch:1,startedAfterDocumentCommitId:22}
query: {component:OrderRow,exact:true}
componentMatch:
  component: OrderRow
  exact: true
  status: matched
  matchedNames: [OrderRow]
  matchedNameCount: 1
  similarNames: []
status: updated
matched: 13
mountedUpdated: 13
mountedIdle: 0
mountedUnknown: 0
unmounted: 0
returned: 13
omittedByLimit: 0
rendererBundle: development
coverage:
  complete: true
  freezeDetection: disabled
  scannedFibers: 736
  scanLimit: 20000
  scanTruncated: false
  rootAvailable: true
  rootCount: 1
  scannedRootCount: 1
  rootLimit: 100
  rootScope: committed
  rootScopeComplete: true
  rootScopeTruncated: false
  inputAttributionComplete: true
  skippedCommitFibers: 0
  droppedUnmountFibers: 0
  analysisFailedFibers: 0
  pausedCommits: 0
  unobservedCommits: 0
  refreshCommitsExcluded: 0
  truncatedInputFibers: 0
  propsNotEnumeratedFibers: 0
  budgetExhaustedCommits: 0
  budgetExhaustedSubsystems: []
  generationHistoryEvictions: 0
view: summary
shared:
  logicalPathPrefix: "QueryClientProvider[index=0] > AuthProvider[index=0] > App[index=0] > RouterProvider[index=0] > RouterContextProvider[index=0] > Matches[index=0] > MatchesInner[index=0] > CatchBoundary[index=0] > MatchImpl[index=0] > MatchView[index=0] > CatchBoundary[index=0] > CatchNotFound[index=0] > CatchBoundary[index=0] > MatchInnerImpl[index=0] > RootLayout[index=0] > OutletImpl[index=0] > MatchImpl[index=0] > MatchView[index=0] > CatchBoundary[index=0] > MatchInnerImpl[index=0] > Lazy[index=0] > AuthenticatedLayout[index=0] > PermissionsProvider[index=0] > AppShell[index=0] > PreferencesProvider[index=0] > <div>[index=0] > <div>[index=1] > <main>[index=1] > OutletImpl[index=0] > MatchImpl[index=0] > MatchView[index=0] > CatchBoundary[index=0] > MatchInnerImpl[index=0] > Lazy[index=0] > OrdersPage[index=0] > <div>[index=0] > OrdersTable[index=3] > <div>[index=0] > <div>[index=1] > <div>[index=0]"
  componentName: OrderRow
  sourceOwnership: app
  source: /src/features/orders/orders-table.tsx:121:17
  parent: {fiberId:15349961457722,name:OrdersTable,key:null}
  keyedParent: null
  logicalIdentityEvidence: keyed
  mountGenerationEvidence: exact
  renderingState: mounted-rendering
  reactVisibility: not-hidden
instances[13]:
  each: {status:mounted-updated,mountGeneration:1,hostSelector:div.absolute.inset-x-0.flex}
  - {mountId:mount:38,fiberId:15349961457727,key:o-105999,siblingIndex:0,logicalPath:"OrderRow[key=\"o-105999\"]"}
  - {mountId:mount:39,fiberId:15349961457728,key:o-105998,siblingIndex:1,logicalPath:"OrderRow[key=\"o-105998\"]"}
  - {mountId:mount:40,fiberId:15349961457729,key:o-105990,siblingIndex:2,logicalPath:"OrderRow[key=\"o-105990\"]"}
  - {mountId:mount:41,fiberId:15349961457730,key:o-105979,siblingIndex:3,logicalPath:"OrderRow[key=\"o-105979\"]"}
  - {mountId:mount:42,fiberId:15349961457748,key:o-105973,siblingIndex:4,logicalPath:"OrderRow[key=\"o-105973\"]"}
  - {mountId:mount:43,fiberId:15349961457749,key:o-105968,siblingIndex:5,logicalPath:"OrderRow[key=\"o-105968\"]"}
  - {mountId:mount:44,fiberId:15349961457750,key:o-105958,siblingIndex:6,logicalPath:"OrderRow[key=\"o-105958\"]"}
  - {mountId:mount:45,fiberId:15349961457751,key:o-105957,siblingIndex:7,logicalPath:"OrderRow[key=\"o-105957\"]"}
  - {mountId:mount:46,fiberId:15349961457752,key:o-105956,siblingIndex:8,logicalPath:"OrderRow[key=\"o-105956\"]"}
  - {mountId:mount:47,fiberId:15349961457753,key:o-105944,siblingIndex:9,logicalPath:"OrderRow[key=\"o-105944\"]"}
  - {mountId:mount:4,fiberId:15349961457785,key:o-105918,siblingIndex:10,logicalPath:"OrderRow[key=\"o-105918\"]"}
  - {mountId:mount:5,fiberId:15349961457819,key:o-105917,siblingIndex:11,logicalPath:"OrderRow[key=\"o-105917\"]"}
  - {mountId:mount:6,fiberId:15349961457853,key:o-105915,siblingIndex:12,logicalPath:"OrderRow[key=\"o-105915\"]"}
[exit 0]

$ npx genie-react call react_render_causes '{"component":"OrderRow","limit":3}' --session art-m1
componentMatch:
  component: OrderRow
  exact: true
  status: matched
  matchedNames: [OrderRow]
  matchedNameCount: 1
  similarNames: []
tracking: true
commits: 15
documentCommitId: 37
observation: {id:observation:1,epoch:1,startedAfterDocumentCommitId:22}
attribution:
  status: current
  startedAtDocumentCommitId: 37
  completedAtDocumentCommitId: 37
  startedAtAnalysisGeneration: 38
  completedAtAnalysisGeneration: 38
view: summary
events[3] (componentName #componentId {fields}, then ← kind evidence name {fields} per cause):
  each: {documentCommitId:30,necessity:unknown,necessityReason:callbacks-changed,inputEvidence:changed,source:{location:/src/features/orders/orders-table.tsx:121:17,role:element-callsite,ownership:app}}
  OrderRow #15349961457853 {renderEventId:render:30:241,mountId:mount:6,key:o-105915}
    ← props exact onStatusChange
  OrderRow #15349961457819 {renderEventId:render:30:240,mountId:mount:5,key:o-105917}
    ← props exact onStatusChange
  OrderRow #15349961457785 {renderEventId:render:30:239,mountId:mount:4,key:o-105918}
    ← props exact onStatusChange
omittedByLimit: 26
sourceClassification:
  complete: true
  affects: result
  totalCandidates: 29
  evaluated: 29
  app: 29
  library: 0
  unknown: 0
  unknownComponents: []
  unknownComponentsOmitted: 0
renderEventRetention: {evictedEvents:0,earliestDocumentCommitId:23,latestDocumentCommitId:37}
coverage:
  skippedCommitFibers: 0
  droppedUnmountFibers: 0
  analysisFailedFibers: 0
  pausedCommits: 0
  unobservedCommits: 0
  refreshCommitsExcluded: 0
  truncatedInputFibers: 0
  propsNotEnumeratedFibers: 0
  budgetExhaustedCommits: 0
  budgetExhaustedSubsystems: []
  complete: true
  inputAttributionComplete: true
  semantics: exact
  coverageDomain: render-causality
  droppedRenderEvents: 0
[exit 0]

## Genie: verify BEFORE the fix (shipped code)

$ npx genie-react call app_reset_backend '{}' --session art-m1 --fields seed
[1]:
  - {seed:20260302}
[exit 0]

$ agent-browser --session art-m1 open 'http://127.0.0.1:5221/orders?status=processing'
✓ Meridian Ops
  http://127.0.0.1:5221/orders?status=processing&sort=placedAt&dir=desc
[exit 0]

$ agent-browser --session art-m1 wait --text 'SO-105979'
SO-105979
[exit 0]

$ npx genie-react verify begin --session art-m1 --name 'put one order on hold' --claim 'render OrderRow only props.order' --claim 'render OrderRow min 1' --claim 'boundaries clean'
recording vfy_f76bff92-a789-4840-8cc0-ee6e345c1f82 "put one order on hold"
  url "http://127.0.0.1:5221/orders?status=processing&sort=placedAt&dir=desc"
  1 null render OrderRow only props.order  {}
  2 null render OrderRow min 1  {}
  3 null boundaries clean  {}
window: {observationId:observation:1,startDocumentCommitId:7,domains:[react,query,router],quietMs:500,timeoutMs:10000,tailMs:500}
next: $ pnpm exec genie-react verify end vfy_f76bff92-a789-4840-8cc0-ee6e345c1f82 --session art-m1
session: {sessionId:b8c78f08-50fb-4cca-abcb-53d3ed5c2aa6,logicalSessionId:7ec0ff54-7211-4370-856f-bbf2a071c8ce,documentGeneration:4}
schemaVersion: "1.0"
targets: [{target:{component:OrderRow},status:resolved,instances:10,source:/src/features/orders/orders-table.tsx}]
startedAt: 2026-11-19T03:55:58.346Z
expiresAt: 2026-11-19T04:00:58.357Z
request: {budget:{fiberLimit:250,operationLimit:20000,timeLimitMs:8,targetOperationReserve:4000,targetTimeReserveMs:4,adaptive:true},settle:{quietMs:500,timeoutMs:10000},maxDurationMs:300000,allowOverrides:false}
[exit 0]

$ bash /tmp/art-m1/hold.sh
✓ Done
✓ Done
SO-105979 updated
[exit 0]

$ npx genie-react verify end vfy_f76bff92-a789-4840-8cc0-ee6e345c1f82 --session art-m1
fail vfy_f76bff92-a789-4840-8cc0-ee6e345c1f82 "put one order on hold"  13 commits, quiet after 897 ms (react, query, router)
  url "http://127.0.0.1:5221/orders?status=processing&sort=placedAt&dir=desc"
  1 fail render OrderRow only props.order  {renders:29,events:29,violatingEvents:29,causes:[mount,props.onStatusChange,props.order]}
      claim: {kind:render-causes,target:{component:OrderRow},allow:[{kind:props,name:order}]}
      deciding: [{kind:render-event,renderEventId:render:18:250,documentCommitId:18,mountId:mount:19,causes:[{cause:props.onStatusChange,evidence:exact}]},{kind:render-event,renderEventId:render:18:249,documentCommitId:18,mountId:mount:18,causes:[{cause:props.onStatusChange,evidence:exact}]},{kind:render-event,renderEventId:render:18:248,documentCommitId:18,mountId:mount:17,causes:[{cause:props.onStatusChange,evidence:exact}]}]
  2 pass render OrderRow min 1  {renders:29,mounts:3,updates:26,remounts:0,semantics:exact,instances:13,activeInstances:13}
      claim: {kind:renders,target:{component:OrderRow},min:1,counting:renders,allowRemount:false}
      deciding: [{kind:instance,mountId:mount:17,key:o-105918,renders:3,mounts:1,updates:2,mountGeneration:1,latestDocumentCommitId:18,source:/src/features/orders/orders-table.tsx:121:17},{kind:instance,mountId:mount:18,key:o-105917,renders:3,mounts:1,updates:2,mountGeneration:1,latestDocumentCommitId:18,source:/src/features/orders/orders-table.tsx:121:17},{kind:instance,mountId:mount:19,key:o-105915,renders:3,mounts:1,updates:2,mountGeneration:1,latestDocumentCommitId:18,source:/src/features/orders/orders-table.tsx:121:17}]
  3 pass boundaries clean  {caughtDuringWindow:0,caughtAtEnd:0}
      claim: {kind:boundaries-clean,scope:window}
      deciding: [{kind:boundary-log,scope:window,complete:true,afterDocumentCommitId:7}]
      caveats: [uncaught-errors-outside-boundaries-unobserved]
window: {observationId:observation:1,startDocumentCommitId:7,settledDocumentCommitId:19,frozenDocumentCommitId:20,commits:13,settle:{outcome:met,quietMs:500,timeoutMs:10000,waitedMs:897,domains:{react:met,query:met,router:met}},tail:{ms:500,commits:1},environment:{bundle:development,strictMode:on,renderCollection:available,visibility:document}}
! ui-outcome-not-observed: Genie does not check the screen; confirm it with the UI driver
attempt 1 for these claims on this tab
evidence: $ pnpm exec genie-react verify show vfy_f76bff92-a789-4840-8cc0-ee6e345c1f82 --claim 1 --session art-m1
session: {sessionId:b8c78f08-50fb-4cca-abcb-53d3ed5c2aa6,logicalSessionId:7ec0ff54-7211-4370-856f-bbf2a071c8ce,documentGeneration:4}
schemaVersion: "1.0"
exitCode: 1
stage: end
ledger: {fingerprint:cf_4c41f04148a1,scope:logical-session,storage:memory,attempt:1,history:[],codeChangedSincePrevious:null,failsOnSameCode:0}
evidence: {retained:true,tools:[react_get_renders,react_component_cohort,react_list_overrides,query_is_fetching,react_refresh_events,browser_visibility,react_profile_stop,react_render_causes,react_error_state]}
startedAt: 2026-11-19T03:55:58.346Z
endedAt: 2026-11-19T03:56:03.256Z
request: {budget:{fiberLimit:250,operationLimit:20000,timeLimitMs:8,targetOperationReserve:4000,targetTimeReserveMs:4,adaptive:true},settle:{quietMs:500,timeoutMs:10000},maxDurationMs:300000,allowOverrides:false}
[exit 1]

## Reference fix applied temporarily (git diff in /tmp/art-m1/fix.diff, reproduced below)
diff --git a/apps/realworld-dashboard/src/features/orders/order-row.tsx b/apps/realworld-dashboard/src/features/orders/order-row.tsx
index d8f7df3..4113273 100644
--- a/apps/realworld-dashboard/src/features/orders/order-row.tsx
+++ b/apps/realworld-dashboard/src/features/orders/order-row.tsx
@@ -17,7 +17,7 @@ export interface OrderRowProps {
   start: number
   canEdit: boolean
   onToggleSelect: (id: string) => void
-  onStatusChange: (id: string, status: OrderStatus) => void
+  onStatusChange: (order: OrderSummary, status: OrderStatus) => void
 }
 
 export const OrderRow = memo(function OrderRow({
@@ -37,20 +37,20 @@ export const OrderRow = memo(function OrderRow({
       id: 'hold',
       label: 'Put on hold',
       disabled: !canEdit || closed || order.status === 'on_hold',
-      onSelect: () => onStatusChange(order.id, 'on_hold'),
+      onSelect: () => onStatusChange(order, 'on_hold'),
     },
     {
       id: 'ship',
       label: 'Mark shipped',
       disabled: !canEdit || closed || order.status === 'shipped',
-      onSelect: () => onStatusChange(order.id, 'shipped'),
+      onSelect: () => onStatusChange(order, 'shipped'),
     },
     {
       id: 'cancel',
       label: 'Cancel order',
       tone: 'danger',
       disabled: !canEdit || closed,
-      onSelect: () => onStatusChange(order.id, 'cancelled'),
+      onSelect: () => onStatusChange(order, 'cancelled'),
     },
   ]
 
diff --git a/apps/realworld-dashboard/src/features/orders/orders-table.tsx b/apps/realworld-dashboard/src/features/orders/orders-table.tsx
index 90c16f4..2cf09ac 100644
--- a/apps/realworld-dashboard/src/features/orders/orders-table.tsx
+++ b/apps/realworld-dashboard/src/features/orders/orders-table.tsx
@@ -40,11 +40,8 @@ export function OrdersTable({
     [hiddenColumns],
   )
   const onStatusChange = useCallback(
-    (id: string, status: OrderSummary['status']) => {
-      const order = rows.find((row) => row.id === id)
-      if (order) changeStatus({ id, number: order.number, status })
-    },
-    [rows, changeStatus],
+    (order: OrderSummary, status: OrderSummary['status']) => changeStatus({ id: order.id, number: order.number, status }),
+    [changeStatus],
   )
 
   const virtualizer = useVirtualizer({

## Genie: verify AFTER the fix

$ npx genie-react call app_reset_backend '{}' --session art-m1 --fields seed
[1]:
  - {seed:20260302}
[exit 0]

$ agent-browser --session art-m1 open 'http://127.0.0.1:5221/orders?status=processing'
✓ Meridian Ops
  http://127.0.0.1:5221/orders?status=processing&sort=placedAt&dir=desc
[exit 0]

$ agent-browser --session art-m1 wait --text 'SO-105979'
SO-105979
[exit 0]

$ npx genie-react verify begin --session art-m1 --name 'put one order on hold' --claim 'render OrderRow only props.order' --claim 'render OrderRow min 1' --claim 'boundaries clean'
recording vfy_a895a22c-f933-4561-b0b6-19ce9f7f97b3 "put one order on hold"
  url "http://127.0.0.1:5221/orders?status=processing&sort=placedAt&dir=desc"
  1 null render OrderRow only props.order  {}
  2 null render OrderRow min 1  {}
  3 null boundaries clean  {}
window: {observationId:observation:1,startDocumentCommitId:7,domains:[react,query,router],quietMs:500,timeoutMs:10000,tailMs:500}
next: $ pnpm exec genie-react verify end vfy_a895a22c-f933-4561-b0b6-19ce9f7f97b3 --session art-m1
session: {sessionId:9e17d0bc-32f6-421a-a60b-2ed6966154d7,logicalSessionId:7ec0ff54-7211-4370-856f-bbf2a071c8ce,documentGeneration:6}
schemaVersion: "1.0"
targets: [{target:{component:OrderRow},status:resolved,instances:10,source:/src/features/orders/orders-table.tsx}]
startedAt: 2026-11-19T03:56:20.952Z
expiresAt: 2026-11-19T04:01:20.960Z
request: {budget:{fiberLimit:250,operationLimit:20000,timeLimitMs:8,targetOperationReserve:4000,targetTimeReserveMs:4,adaptive:true},settle:{quietMs:500,timeoutMs:10000},maxDurationMs:300000,allowOverrides:false}
[exit 0]

$ bash /tmp/art-m1/hold.sh
✓ Done
✓ Done
SO-105979 updated
[exit 0]

$ npx genie-react verify end vfy_a895a22c-f933-4561-b0b6-19ce9f7f97b3 --session art-m1
fail vfy_a895a22c-f933-4561-b0b6-19ce9f7f97b3 "put one order on hold"  13 commits, quiet after 1196 ms (react, query, router)
  url "http://127.0.0.1:5221/orders?status=processing&sort=placedAt&dir=desc"
  1 fail render OrderRow only props.order  {renders:5,events:5,violatingEvents:3,causes:[mount,props.order]}
      claim: {kind:render-causes,target:{component:OrderRow},allow:[{kind:props,name:order}]}
      deciding: [{kind:render-event,renderEventId:render:11:13,documentCommitId:11,mountId:mount:19,causes:[{cause:mount,evidence:exact}]},{kind:render-event,renderEventId:render:11:12,documentCommitId:11,mountId:mount:18,causes:[{cause:mount,evidence:exact}]},{kind:render-event,renderEventId:render:11:11,documentCommitId:11,mountId:mount:17,causes:[{cause:mount,evidence:exact}]}]
  2 pass render OrderRow min 1  {renders:5,mounts:3,updates:2,remounts:0,semantics:exact,instances:13,activeInstances:13}
      claim: {kind:renders,target:{component:OrderRow},min:1,counting:renders,allowRemount:false}
      deciding: [{kind:instance,mountId:mount:4,key:o-105979,renders:2,mounts:0,updates:2,mountGeneration:1,latestDocumentCommitId:18,source:/src/features/orders/orders-table.tsx:118:17},{kind:instance,mountId:mount:17,key:o-105918,renders:1,mounts:1,updates:0,mountGeneration:1,latestDocumentCommitId:11,source:/src/features/orders/orders-table.tsx:118:17},{kind:instance,mountId:mount:18,key:o-105917,renders:1,mounts:1,updates:0,mountGeneration:1,latestDocumentCommitId:11,source:/src/features/orders/orders-table.tsx:118:17}]
  3 pass boundaries clean  {caughtDuringWindow:0,caughtAtEnd:0}
      claim: {kind:boundaries-clean,scope:window}
      deciding: [{kind:boundary-log,scope:window,complete:true,afterDocumentCommitId:7}]
      caveats: [uncaught-errors-outside-boundaries-unobserved]
window: {observationId:observation:1,startDocumentCommitId:7,settledDocumentCommitId:19,frozenDocumentCommitId:20,commits:13,settle:{outcome:met,quietMs:500,timeoutMs:10000,waitedMs:1196,domains:{react:met,query:met,router:met}},tail:{ms:500,commits:1},environment:{bundle:development,strictMode:on,renderCollection:available,visibility:document}}
! ui-outcome-not-observed: Genie does not check the screen; confirm it with the UI driver
attempt 2 for these claims on this tab; previous fail vfy_f76bff92-a789-4840-8cc0-ee6e345c1f82; document reloaded since
evidence: $ pnpm exec genie-react verify show vfy_a895a22c-f933-4561-b0b6-19ce9f7f97b3 --claim 1 --session art-m1
session: {sessionId:9e17d0bc-32f6-421a-a60b-2ed6966154d7,logicalSessionId:7ec0ff54-7211-4370-856f-bbf2a071c8ce,documentGeneration:6}
schemaVersion: "1.0"
exitCode: 1
stage: end
ledger: {fingerprint:cf_4c41f04148a1,scope:logical-session,storage:memory,attempt:2,history:[{verificationId:vfy_f76bff92-a789-4840-8cc0-ee6e345c1f82,verdict:fail,reasons:[],endedAt:2026-11-19T03:56:03.256Z}],codeChangedSincePrevious:document-reloaded,failsOnSameCode:0}
evidence: {retained:true,tools:[react_get_renders,react_component_cohort,react_list_overrides,query_is_fetching,react_refresh_events,browser_visibility,react_profile_stop,react_render_causes,react_error_state]}
startedAt: 2026-11-19T03:56:20.952Z
endedAt: 2026-11-19T03:56:25.869Z
request: {budget:{fiberLimit:250,operationLimit:20000,timeLimitMs:8,targetOperationReserve:4000,targetTimeReserveMs:4,adaptive:true},settle:{quietMs:500,timeoutMs:10000},maxDurationMs:300000,allowOverrides:false}
[exit 1]

## Genie: verify AFTER the fix, run 2: wait for the page to settle before opening the window (run 1 above opened it while the virtualizer was still mounting rows)

$ npx genie-react call app_reset_backend '{}' --session art-m1 --fields seed
[1]:
  - {seed:20260302}
[exit 0]

$ agent-browser --session art-m1 open 'http://127.0.0.1:5221/orders?status=processing'
✓ Meridian Ops
  http://127.0.0.1:5221/orders?status=processing&sort=placedAt&dir=desc
[exit 0]

$ agent-browser --session art-m1 wait --text 'SO-105979'
SO-105979
[exit 0]

$ npx genie-react call devtools_wait '{"condition":"settled","timeoutMs":10000}' --session art-m1
ok: true
condition: settled
waitedMs: 612
validConditions: [connected,ready,component,query-settled,navigation,react-quiet,settled]
lastObserved:
  react:
    documentCommitId: 7
    renderCollection: available
    quietForMs: 609
    requiredQuietMs: 500
    pendingWork: {documentCommitId:7,scheduledRoots:0,suspendedBoundaries:0,dehydratedBoundaries:0,boundaries:[],scanTruncated:false,scannedFibers:620}
domains:
  react:
    status: met
    lastObserved: {documentCommitId:7,renderCollection:available,quietForMs:609,requiredQuietMs:500,pendingWork:{documentCommitId:7,scheduledRoots:0,suspendedBoundaries:0,dehydratedBoundaries:0,boundaries:[],scanTruncated:false,scannedFibers:620}}
[exit 0]

$ npx genie-react verify begin --session art-m1 --name 'put one order on hold' --claim 'render OrderRow only props.order' --claim 'render OrderRow min 1' --claim 'boundaries clean'
recording vfy_70511055-a631-4c7b-8646-f8cce2ff9cf5 "put one order on hold"
  url "http://127.0.0.1:5221/orders?status=processing&sort=placedAt&dir=desc"
  1 null render OrderRow only props.order  {}
  2 null render OrderRow min 1  {}
  3 null boundaries clean  {}
window: {observationId:observation:1,startDocumentCommitId:8,domains:[react,query,router],quietMs:500,timeoutMs:10000,tailMs:500}
next: $ pnpm exec genie-react verify end vfy_70511055-a631-4c7b-8646-f8cce2ff9cf5 --session art-m1
session: {sessionId:3dfdbd32-a8db-45fc-b6c4-1a8397ac7c32,logicalSessionId:7ec0ff54-7211-4370-856f-bbf2a071c8ce,documentGeneration:7}
schemaVersion: "1.0"
targets: [{target:{component:OrderRow},status:resolved,instances:10,source:/src/features/orders/orders-table.tsx}]
startedAt: 2026-11-19T03:56:38.411Z
expiresAt: 2026-11-19T04:01:38.419Z
request: {budget:{fiberLimit:250,operationLimit:20000,timeLimitMs:8,targetOperationReserve:4000,targetTimeReserveMs:4,adaptive:true},settle:{quietMs:500,timeoutMs:10000},maxDurationMs:300000,allowOverrides:false}
[exit 0]

$ bash /tmp/art-m1/hold.sh
✓ Done
✓ Done
SO-105979 updated
[exit 0]

$ npx genie-react verify end vfy_70511055-a631-4c7b-8646-f8cce2ff9cf5 --session art-m1
fail vfy_70511055-a631-4c7b-8646-f8cce2ff9cf5 "put one order on hold"  15 commits, quiet after 901 ms (react, query, router)
  url "http://127.0.0.1:5221/orders?status=processing&sort=placedAt&dir=desc"
  1 fail render OrderRow only props.order  {renders:5,events:5,violatingEvents:3,causes:[mount,props.order]}
      claim: {kind:render-causes,target:{component:OrderRow},allow:[{kind:props,name:order}]}
      deciding: [{kind:render-event,renderEventId:render:15:22,documentCommitId:15,mountId:mount:19,causes:[{cause:mount,evidence:exact}]},{kind:render-event,renderEventId:render:15:21,documentCommitId:15,mountId:mount:18,causes:[{cause:mount,evidence:exact}]},{kind:render-event,renderEventId:render:15:20,documentCommitId:15,mountId:mount:17,causes:[{cause:mount,evidence:exact}]}]
  2 pass render OrderRow min 1  {renders:5,mounts:3,updates:2,remounts:0,semantics:exact,instances:13,activeInstances:13}
      claim: {kind:renders,target:{component:OrderRow},min:1,counting:renders,allowRemount:false}
      deciding: [{kind:instance,mountId:mount:4,key:o-105979,renders:2,mounts:0,updates:2,mountGeneration:1,latestDocumentCommitId:21,source:/src/features/orders/orders-table.tsx:118:17},{kind:instance,mountId:mount:17,key:o-105918,renders:1,mounts:1,updates:0,mountGeneration:1,latestDocumentCommitId:15,source:/src/features/orders/orders-table.tsx:118:17},{kind:instance,mountId:mount:18,key:o-105917,renders:1,mounts:1,updates:0,mountGeneration:1,latestDocumentCommitId:15,source:/src/features/orders/orders-table.tsx:118:17}]
  3 pass boundaries clean  {caughtDuringWindow:0,caughtAtEnd:0}
      claim: {kind:boundaries-clean,scope:window}
      deciding: [{kind:boundary-log,scope:window,complete:true,afterDocumentCommitId:8}]
      caveats: [uncaught-errors-outside-boundaries-unobserved]
window: {observationId:observation:1,startDocumentCommitId:8,settledDocumentCommitId:22,frozenDocumentCommitId:23,commits:15,settle:{outcome:met,quietMs:500,timeoutMs:10000,waitedMs:901,domains:{react:met,query:met,router:met}},tail:{ms:500,commits:1},environment:{bundle:development,strictMode:on,renderCollection:available,visibility:document}}
! ui-outcome-not-observed: Genie does not check the screen; confirm it with the UI driver
attempt 3 for these claims on this tab; previous fail vfy_a895a22c-f933-4561-b0b6-19ce9f7f97b3; document reloaded since
evidence: $ pnpm exec genie-react verify show vfy_70511055-a631-4c7b-8646-f8cce2ff9cf5 --claim 1 --session art-m1
session: {sessionId:3dfdbd32-a8db-45fc-b6c4-1a8397ac7c32,logicalSessionId:7ec0ff54-7211-4370-856f-bbf2a071c8ce,documentGeneration:7}
schemaVersion: "1.0"
exitCode: 1
stage: end
ledger: {fingerprint:cf_4c41f04148a1,scope:logical-session,storage:memory,attempt:3,history:[{verificationId:vfy_f76bff92-a789-4840-8cc0-ee6e345c1f82,verdict:fail,reasons:[],endedAt:2026-11-19T03:56:03.256Z},{verificationId:vfy_a895a22c-f933-4561-b0b6-19ce9f7f97b3,verdict:fail,reasons:[],endedAt:2026-11-19T03:56:25.869Z}],codeChangedSincePrevious:document-reloaded,failsOnSameCode:0}
evidence: {retained:true,tools:[react_get_renders,react_component_cohort,react_list_overrides,query_is_fetching,react_refresh_events,browser_visibility,react_profile_stop,react_render_causes,react_error_state]}
startedAt: 2026-11-19T03:56:38.411Z
endedAt: 2026-11-19T03:56:45.320Z
request: {budget:{fiberLimit:250,operationLimit:20000,timeLimitMs:8,targetOperationReserve:4000,targetTimeReserveMs:4,adaptive:true},settle:{quietMs:500,timeoutMs:10000},maxDurationMs:300000,allowOverrides:false}
[exit 1]

## Investigate the 3 OrderRow mounts: does opening the row menu alone mount rows?

$ npx genie-react call app_reset_backend '{}' --session art-m1 --fields seed
[1]:
  - {seed:20260302}
[exit 0]

$ agent-browser --session art-m1 open 'http://127.0.0.1:5221/orders?status=processing'
✓ Meridian Ops
  http://127.0.0.1:5221/orders?status=processing&sort=placedAt&dir=desc
[exit 0]

$ agent-browser --session art-m1 wait --text 'SO-105979'
SO-105979
[exit 0]

$ npx genie-react call devtools_wait '{"condition":"settled","timeoutMs":10000}' --session art-m1 --select /ok
status: ok
selection: {expression:/ok,matchedPathCount:1,matchedPaths:[/ok],omittedPathCount:32}
result: true
[exit 0]

$ npx genie-react call react_clear_renders '{"component":"OrderRow"}' --session art-m1 --select /ok
status: ok
selection: {expression:/ok,matchedPathCount:1,matchedPaths:[/ok],omittedPathCount:15}
result: true
[exit 0]

$ agent-browser --session art-m1 find role button click --name 'Actions for SO-105979'
✓ Done
[exit 0]

$ npx genie-react call react_quiesce '{"idleMs":500,"timeoutMs":10000}' --session art-m1 --select /outcome
status: ok
selection: {expression:/outcome,matchedPathCount:1,matchedPaths:[/outcome],omittedPathCount:13}
result: idle
[exit 0]

$ npx genie-react call react_component_cohort '{"component":"OrderRow"}' --session art-m1 --fields key,status
error invalid_input: Tool call failed. Unknown --fields value key. details.fields.available lists the fields the result has. Correct --fields and retry.
next: $ pnpm exec genie-react tools react_component_cohort --session art-m1
userActionRequired: true
errorCode: invalid-input
details:
  fields:
    unknown: [key]
    available: [attribution,componentMatch,coverage,documentCommitId,instances,matched,mountedIdle,mountedUnknown,mountedUpdated,observation,omittedByLimit,ownershipCoverage,query,rendererBundle,returned,shared,status,unmounted,view]
exit: {code:2,class:usage}
[exit 1]

$ agent-browser --session art-m1 get viewport
Unknown subcommand: viewport
Valid options: text, html, value, attr, url, title, count, box, styles, cdp-url
[exit 1]

$ agent-browser --session art-m1 eval 'JSON.stringify([innerWidth, innerHeight, document.querySelector("[role=grid]")?.scrollTop ?? null, document.scrollingElement.scrollTop])'
"[1280,577,0,0]"
[exit 0]

$ npx genie-react call react_component_cohort '{"component":"OrderRow"}' --session art-m1 --json | jq -c '{matched,mountedUpdated,mountedIdle,instances:[.instances[]|{key,status}]}'
{"matched":10,"mountedUpdated":0,"mountedIdle":10,"instances":[{"key":"o-105999","status":"mounted-idle"},{"key":"o-105998","status":"mounted-idle"},{"key":"o-105990","status":"mounted-idle"},{"key":"o-105979","status":"mounted-idle"},{"key":"o-105973","status":"mounted-idle"},{"key":"o-105968","status":"mounted-idle"},{"key":"o-105958","status":"mounted-idle"},{"key":"o-105957","status":"mounted-idle"},{"key":"o-105956","status":"mounted-idle"},{"key":"o-105944","status":"mounted-idle"}]}
[exit 0]

$ npx genie-react call react_get_renders '{"component":"OrderRow"}' --session art-m1 --json | jq -c '.components // . | tostring | .[0:600]'
"[]"
[exit 0]

$ agent-browser --session art-m1 find role menuitem click --name 'Put on hold'
✓ Done
[exit 0]

$ agent-browser --session art-m1 wait --text 'SO-105979 updated'
SO-105979 updated
[exit 0]

$ npx genie-react call devtools_wait '{"condition":"settled","timeoutMs":10000}' --session art-m1 --select /ok
status: ok
selection: {expression:/ok,matchedPathCount:1,matchedPaths:[/ok],omittedPathCount:32}
result: true
[exit 0]

$ npx genie-react call react_render_causes '{"component":"OrderRow","limit":10}' --session art-m1 --json | jq -c '.events[] | {documentCommitId, key, causes:[.causes[]|.kind+":"+(.name//"")]}'
{"documentCommitId":31,"key":"o-105979","causes":["props:order"]}
{"documentCommitId":27,"key":"o-105979","causes":["props:order"]}
{"documentCommitId":24,"key":"o-105915","causes":["mount:"]}
{"documentCommitId":24,"key":"o-105917","causes":["mount:"]}
{"documentCommitId":24,"key":"o-105918","causes":["mount:"]}
[exit 0]

$ npx genie-react call react_get_renders '{"sort":"renders","limit":8}' --session art-m1 --fields name,renders
[8]:
  - {name:SyncStatus,renders:19}
  - {name:OrdersTable,renders:5}
  - {name:Checkbox,renders:5}
  - {name:ActionMenu,renders:4}
  - {name:OrderRow,renders:2}
  - {name:OrdersPage,renders:2}
  - {name:PermissionGate,renders:2}
  - {name:orders-page.tsx,renders:2}
[exit 0]

## Genie: verify AFTER the fix, final claim set (allows mount, since 3 rows below the fold mount during the click)

$ npx genie-react call app_reset_backend '{}' --session art-m1 --fields seed
[1]:
  - {seed:20260302}
[exit 0]

$ agent-browser --session art-m1 open 'http://127.0.0.1:5221/orders?status=processing'
✓ Meridian Ops
  http://127.0.0.1:5221/orders?status=processing&sort=placedAt&dir=desc
[exit 0]

$ agent-browser --session art-m1 wait --text 'SO-105979'
SO-105979
[exit 0]

$ npx genie-react call devtools_wait '{"condition":"settled","timeoutMs":10000}' --session art-m1 --select /ok
status: ok
selection: {expression:/ok,matchedPathCount:1,matchedPaths:[/ok],omittedPathCount:32}
result: true
[exit 0]

$ npx genie-react verify begin --session art-m1 --name 'put one order on hold' --claim 'render OrderRow only props.order,mount' --claim 'render OrderRow min 1' --claim 'boundaries clean'
recording vfy_c3e39be0-5592-464c-9331-778ab36dba6d "put one order on hold"
  url "http://127.0.0.1:5221/orders?status=processing&sort=placedAt&dir=desc"
  1 null render OrderRow only props.order,mount  {}
  2 null render OrderRow min 1  {}
  3 null boundaries clean  {}
window: {observationId:observation:1,startDocumentCommitId:8,domains:[react,query,router],quietMs:500,timeoutMs:10000,tailMs:500}
next: $ pnpm exec genie-react verify end vfy_c3e39be0-5592-464c-9331-778ab36dba6d --session art-m1
session: {sessionId:bbb86565-0d27-4190-94ee-fbb2796c229e,logicalSessionId:7ec0ff54-7211-4370-856f-bbf2a071c8ce,documentGeneration:9}
schemaVersion: "1.0"
targets: [{target:{component:OrderRow},status:resolved,instances:10,source:/src/features/orders/orders-table.tsx}]
startedAt: 2026-11-19T03:57:29.670Z
expiresAt: 2026-11-19T04:02:29.676Z
request: {budget:{fiberLimit:250,operationLimit:20000,timeLimitMs:8,targetOperationReserve:4000,targetTimeReserveMs:4,adaptive:true},settle:{quietMs:500,timeoutMs:10000},maxDurationMs:300000,allowOverrides:false}
[exit 0]

$ bash /tmp/art-m1/hold.sh
✓ Done
✓ Done
SO-105979 updated
[exit 0]

$ npx genie-react verify end vfy_c3e39be0-5592-464c-9331-778ab36dba6d --session art-m1
pass vfy_c3e39be0-5592-464c-9331-778ab36dba6d "put one order on hold"  10 commits, quiet after 1045 ms (react, query, router)
  url "http://127.0.0.1:5221/orders?status=processing&sort=placedAt&dir=desc"
  1 pass render OrderRow only props.order,mount  {renders:5,events:5,violatingEvents:0,causes:[mount,props.order]}
      claim: {kind:render-causes,target:{component:OrderRow},allow:[{kind:props,name:order},{kind:mount}]}
      deciding: [{kind:render-event,renderEventId:render:16:124,documentCommitId:16,mountId:mount:4,causes:[{cause:props.order,evidence:exact}]},{kind:render-event,renderEventId:render:13:71,documentCommitId:13,mountId:mount:4,causes:[{cause:props.order,evidence:exact}]},{kind:render-event,renderEventId:render:10:7,documentCommitId:10,mountId:mount:16,causes:[{cause:mount,evidence:exact}]}]
  2 pass render OrderRow min 1  {renders:5,mounts:3,updates:2,remounts:0,semantics:exact,instances:13,activeInstances:13}
      claim: {kind:renders,target:{component:OrderRow},min:1,counting:renders,allowRemount:false}
      deciding: [{kind:instance,mountId:mount:4,key:o-105979,renders:2,mounts:0,updates:2,mountGeneration:1,latestDocumentCommitId:16,source:/src/features/orders/orders-table.tsx:118:17},{kind:instance,mountId:mount:14,key:o-105918,renders:1,mounts:1,updates:0,mountGeneration:1,latestDocumentCommitId:10,source:/src/features/orders/orders-table.tsx:118:17},{kind:instance,mountId:mount:15,key:o-105917,renders:1,mounts:1,updates:0,mountGeneration:1,latestDocumentCommitId:10,source:/src/features/orders/orders-table.tsx:118:17}]
  3 pass boundaries clean  {caughtDuringWindow:0,caughtAtEnd:0}
      claim: {kind:boundaries-clean,scope:window}
      deciding: [{kind:boundary-log,scope:window,complete:true,afterDocumentCommitId:8}]
      caveats: [uncaught-errors-outside-boundaries-unobserved]
window: {observationId:observation:1,startDocumentCommitId:8,settledDocumentCommitId:17,frozenDocumentCommitId:18,commits:10,settle:{outcome:met,quietMs:500,timeoutMs:10000,waitedMs:1045,domains:{react:met,query:met,router:met}},tail:{ms:500,commits:1},environment:{bundle:development,strictMode:on,renderCollection:available,visibility:document}}
! ui-outcome-not-observed: Genie does not check the screen; confirm it with the UI driver
attempt 1 for these claims on this tab
evidence: $ pnpm exec genie-react verify show vfy_c3e39be0-5592-464c-9331-778ab36dba6d --session art-m1
session: {sessionId:bbb86565-0d27-4190-94ee-fbb2796c229e,logicalSessionId:7ec0ff54-7211-4370-856f-bbf2a071c8ce,documentGeneration:9}
schemaVersion: "1.0"
exitCode: 0
stage: end
ledger: {fingerprint:cf_ab8a77faf69d,scope:logical-session,storage:memory,attempt:1,history:[],codeChangedSincePrevious:null,failsOnSameCode:0}
evidence: {retained:true,tools:[react_get_renders,react_component_cohort,react_list_overrides,query_is_fetching,react_refresh_events,browser_visibility,react_profile_stop,react_render_causes,react_error_state]}
startedAt: 2026-11-19T03:57:29.670Z
endedAt: 2026-11-19T03:57:31.990Z
request: {budget:{fiberLimit:250,operationLimit:20000,timeLimitMs:8,targetOperationReserve:4000,targetTimeReserveMs:4,adaptive:true},settle:{quietMs:500,timeoutMs:10000},maxDurationMs:300000,allowOverrides:false}
[exit 0]

## Driver confirms the screen after the fixed run

$ agent-browser --session art-m1 get text '[data-order-id=o-105979]'
SO-105979
Lumen Retail
On hold
standard
NA
46
Mar 2, 2026
$2,341.78
[exit 0]

## Revert the reference fix

$ git checkout -- apps/realworld-dashboard/src
[exit 0]

$ git status --short
[exit 0]

## Genie: verify BEFORE the fix, final claim set (shipped code)

$ npx genie-react call app_reset_backend '{}' --session art-m1 --fields seed
[1]:
  - {seed:20260302}
[exit 0]

$ agent-browser --session art-m1 open 'http://127.0.0.1:5221/orders?status=processing'
✓ Meridian Ops
  http://127.0.0.1:5221/orders?status=processing&sort=placedAt&dir=desc
[exit 0]

$ agent-browser --session art-m1 wait --text 'SO-105979'
SO-105979
[exit 0]

$ npx genie-react call devtools_wait '{"condition":"settled","timeoutMs":10000}' --session art-m1 --select /ok
status: ok
selection: {expression:/ok,matchedPathCount:1,matchedPaths:[/ok],omittedPathCount:32}
result: true
[exit 0]

$ npx genie-react verify begin --session art-m1 --name 'put one order on hold' --claim 'render OrderRow only props.order,mount' --claim 'render OrderRow min 1' --claim 'boundaries clean'
recording vfy_0a79aa28-a975-4339-8957-83e3514b70b1 "put one order on hold"
  url "http://127.0.0.1:5221/orders?status=processing&sort=placedAt&dir=desc"
  1 null render OrderRow only props.order,mount  {}
  2 null render OrderRow min 1  {}
  3 null boundaries clean  {}
window: {observationId:observation:1,startDocumentCommitId:9,domains:[react,query,router],quietMs:500,timeoutMs:10000,tailMs:500}
next: $ pnpm exec genie-react verify end vfy_0a79aa28-a975-4339-8957-83e3514b70b1 --session art-m1
session: {sessionId:d425d839-1f0c-46d3-a9e7-4e4e361bb22d,logicalSessionId:7ec0ff54-7211-4370-856f-bbf2a071c8ce,documentGeneration:11}
schemaVersion: "1.0"
targets: [{target:{component:OrderRow},status:resolved,instances:10,source:/src/features/orders/orders-table.tsx}]
startedAt: 2026-11-19T03:57:43.301Z
expiresAt: 2026-11-19T04:02:43.311Z
request: {budget:{fiberLimit:250,operationLimit:20000,timeLimitMs:8,targetOperationReserve:4000,targetTimeReserveMs:4,adaptive:true},settle:{quietMs:500,timeoutMs:10000},maxDurationMs:300000,allowOverrides:false}
[exit 0]

$ bash /tmp/art-m1/hold.sh
✓ Done
✓ Done
SO-105979 updated
[exit 0]

$ npx genie-react verify end vfy_0a79aa28-a975-4339-8957-83e3514b70b1 --session art-m1
fail vfy_0a79aa28-a975-4339-8957-83e3514b70b1 "put one order on hold"  10 commits, quiet after 900 ms (react, query, router)
  url "http://127.0.0.1:5221/orders?status=processing&sort=placedAt&dir=desc"
  1 fail render OrderRow only props.order,mount  {renders:29,events:29,violatingEvents:26,causes:[mount,props.onStatusChange,props.order]}
      claim: {kind:render-causes,target:{component:OrderRow},allow:[{kind:props,name:order},{kind:mount}]}
      deciding: [{kind:render-event,renderEventId:render:17:241,documentCommitId:17,mountId:mount:16,causes:[{cause:props.onStatusChange,evidence:exact}]},{kind:render-event,renderEventId:render:17:240,documentCommitId:17,mountId:mount:15,causes:[{cause:props.onStatusChange,evidence:exact}]},{kind:render-event,renderEventId:render:17:239,documentCommitId:17,mountId:mount:14,causes:[{cause:props.onStatusChange,evidence:exact}]}]
  2 pass render OrderRow min 1  {renders:29,mounts:3,updates:26,remounts:0,semantics:exact,instances:13,activeInstances:13}
      claim: {kind:renders,target:{component:OrderRow},min:1,counting:renders,allowRemount:false}
      deciding: [{kind:instance,mountId:mount:14,key:o-105918,renders:3,mounts:1,updates:2,mountGeneration:1,latestDocumentCommitId:17,source:/src/features/orders/orders-table.tsx:121:17},{kind:instance,mountId:mount:15,key:o-105917,renders:3,mounts:1,updates:2,mountGeneration:1,latestDocumentCommitId:17,source:/src/features/orders/orders-table.tsx:121:17},{kind:instance,mountId:mount:16,key:o-105915,renders:3,mounts:1,updates:2,mountGeneration:1,latestDocumentCommitId:17,source:/src/features/orders/orders-table.tsx:121:17}]
  3 pass boundaries clean  {caughtDuringWindow:0,caughtAtEnd:0}
      claim: {kind:boundaries-clean,scope:window}
      deciding: [{kind:boundary-log,scope:window,complete:true,afterDocumentCommitId:9}]
      caveats: [uncaught-errors-outside-boundaries-unobserved]
window: {observationId:observation:1,startDocumentCommitId:9,settledDocumentCommitId:18,frozenDocumentCommitId:19,commits:10,settle:{outcome:met,quietMs:500,timeoutMs:10000,waitedMs:900,domains:{react:met,query:met,router:met}},tail:{ms:500,commits:1},environment:{bundle:development,strictMode:on,renderCollection:available,visibility:document}}
! ui-outcome-not-observed: Genie does not check the screen; confirm it with the UI driver
attempt 2 for these claims on this tab; previous pass vfy_c3e39be0-5592-464c-9331-778ab36dba6d; document reloaded since
evidence: $ pnpm exec genie-react verify show vfy_0a79aa28-a975-4339-8957-83e3514b70b1 --claim 1 --session art-m1
session: {sessionId:d425d839-1f0c-46d3-a9e7-4e4e361bb22d,logicalSessionId:7ec0ff54-7211-4370-856f-bbf2a071c8ce,documentGeneration:11}
schemaVersion: "1.0"
exitCode: 1
stage: end
ledger: {fingerprint:cf_ab8a77faf69d,scope:logical-session,storage:memory,attempt:2,history:[{verificationId:vfy_c3e39be0-5592-464c-9331-778ab36dba6d,verdict:pass,reasons:[],endedAt:2026-11-19T03:57:31.990Z}],codeChangedSincePrevious:document-reloaded,failsOnSameCode:0}
evidence: {retained:true,tools:[react_get_renders,react_component_cohort,react_list_overrides,query_is_fetching,react_refresh_events,browser_visibility,react_profile_stop,react_render_causes,react_error_state]}
startedAt: 2026-11-19T03:57:43.301Z
endedAt: 2026-11-19T03:57:45.485Z
request: {budget:{fiberLimit:250,operationLimit:20000,timeLimitMs:8,targetOperationReserve:4000,targetTimeReserveMs:4,adaptive:true},settle:{quietMs:500,timeoutMs:10000},maxDurationMs:300000,allowOverrides:false}
[exit 1]
````

## agent-browser react renders

````console
## agent-browser react: relaunch session art-m1 with the React DevTools hook (shipped code)

$ agent-browser --session art-m1 close
✓ Browser closed
[exit 0]

$ agent-browser --session art-m1 open --enable react-devtools http://127.0.0.1:5221/login
[agent-browser] launched browser
✓ Meridian Ops
  http://127.0.0.1:5221/login
[exit 0]

$ npx genie-react status --session art-m1 --wait 15000 --select /ready
status: ok
selection: {expression:/ready,matchedPathCount:1,matchedPaths:[/ready],omittedPathCount:53}
result: true
[exit 0]

$ npx genie-react call app_login_as '{"role":"manager"}' --session art-m1
changed: true
role: manager
userId: u-manager
[exit 0]

$ npx genie-react call app_reset_backend '{}' --session art-m1 --fields seed
[1]:
  - {seed:20260302}
[exit 0]

$ agent-browser --session art-m1 open 'http://127.0.0.1:5221/orders?status=processing'
✓ Meridian Ops
  http://127.0.0.1:5221/orders?status=processing&sort=placedAt&dir=desc
[exit 0]

$ agent-browser --session art-m1 wait --text 'SO-105979'
SO-105979
[exit 0]

$ agent-browser --session art-m1 react tree
# React component tree
# Columns: depth id parent name [key=...]
# Use `react inspect <id>` for props/hooks/state. IDs valid until next navigation.
0 1 - Root
1 2 1 QueryClientProvider
2 3 2 Context.Provider
3 4 3 AuthProvider
4 5 4 Context.Provider
5 6 5 App
6 7 6 RouterProvider
7 8 7 RouterContextProvider
8 9 8 Context.Provider
9 10 9 Matches
10 11 10 Transitioner
10 12 10 Suspense
11 13 12 MatchesInner
12 14 13 CatchBoundary
13 15 14 Memo(MatchImpl)
14 16 15 MatchView
15 17 16 Context.Provider
16 18 17 CatchBoundary
17 19 18 CatchNotFound
18 20 19 CatchBoundary
19 21 20 Memo(MatchInnerImpl)
20 22 21 RootLayout
21 23 22 Memo(OutletImpl)
22 24 23 Suspense
23 25 24 Memo(MatchImpl)
24 26 25 MatchView
25 27 26 Context.Provider
26 28 27 CatchBoundary
27 29 28 Memo(MatchInnerImpl)
28 30 29 Lazy
29 31 30 AuthenticatedLayout
30 32 31 PermissionsProvider
31 33 32 Context.Provider
32 34 33 Suspense
33 35 34 AppShell
34 36 35 PreferencesProvider
35 37 36 Context.Provider
36 38 37 div
37 39 38 SidebarNav
38 40 39 aside
39 41 40 div
40 42 41 span
40 43 41 span
39 44 40 nav
40 45 44 Memo(Anonymous) key="/"
41 46 45 ForwardRef(Anonymous)
42 47 46 a
43 48 47 LayoutDashboard
44 49 48 ForwardRef(Anonymous)
45 50 49 svg
46 51 50 rect key="10lvy0"
46 52 50 rect key="16une8"
46 53 50 rect key="1hutg5"
46 54 50 rect key="ldoo1y"
40 55 44 Memo(Anonymous) key="/orders"
41 56 55 ForwardRef(Anonymous)
42 57 56 a
43 58 57 Package
44 59 58 ForwardRef(Anonymous)
45 60 59 svg
46 61 60 path key="1a0edw"
46 62 60 path key="d0xqtd"
46 63 60 polyline key="ousv84"
46 64 60 path key="1c824w"
40 65 44 Memo(Anonymous) key="/customers"
41 66 65 ForwardRef(Anonymous)
42 67 66 a
43 68 67 Users
44 69 68 ForwardRef(Anonymous)
45 70 69 svg
46 71 70 path key="1yyitq"
46 72 70 path key="16gr8j"
46 73 70 path key="kshegd"
46 74 70 circle key="nufk8"
40 75 44 Memo(Anonymous) key="/inventory"
41 76 75 ForwardRef(Anonymous)
42 77 76 a
43 78 77 Boxes
44 79 78 ForwardRef(Anonymous)
45 80 79 svg
46 81 80 path key="lc1i9w"
46 82 80 path key="1o9zyk"
46 83 80 path key="va8pkn"
46 84 80 path key="jnp8gn"
46 85 80 path key="8zsnat"
46 86 80 path key="8arw3v"
46 87 80 path key="8rfmw"
46 88 80 path key="k6z78m"
46 89 80 path key="1xygjf"
46 90 80 path key="1vbdud"
46 91 80 path key="3rx089"
46 92 80 path key="1io7kd"
40 93 44 Memo(Anonymous) key="/reports"
41 94 93 ForwardRef(Anonymous)
42 95 94 a
43 96 95 ChartColumn
44 97 96 ForwardRef(Anonymous)
45 98 97 svg
46 99 98 path key="c24i48"
46 100 98 path key="2bz60n"
46 101 98 path key="1frdt8"
46 102 98 path key="17ska0"
40 103 44 Memo(Anonymous) key="/settings"
41 104 103 ForwardRef(Anonymous)
42 105 104 a
43 106 105 Settings
44 107 106 ForwardRef(Anonymous)
45 108 107 svg
46 109 108 path key="1i5ecw"
46 110 108 circle key="1v7zrd"
39 111 40 button
40 112 111 ChevronsLeft
41 113 112 ForwardRef(Anonymous)
42 114 113 svg
43 115 114 path key="13zhaf"
43 116 114 path key="h8a8et"
37 117 38 div
38 118 117 TopBar
39 119 118 header
40 120 119 button
41 121 120 Search
42 122 121 ForwardRef(Anonymous)
43 123 122 svg
44 124 123 path key="14j7rj"
44 125 123 circle key="4ej97u"
41 126 120 span
41 127 120 kbd
40 128 119 div
41 129 128 NotificationBell
42 130 129 button
43 131 130 Bell
44 132 131 ForwardRef(Anonymous)
45 133 132 svg
46 134 133 path key="vwvbt9"
46 135 133 path key="11g9vi"
42 136 129 NotificationsDrawer
43 137 136 Drawer
44 138 137 OverlayFrame
41 139 128 UserMenu
42 140 139 div
43 141 140 button
44 142 141 Avatar
45 143 142 span
38 144 117 main
39 145 144 Memo(OutletImpl)
40 146 145 Memo(MatchImpl)
41 147 146 MatchView
42 148 147 Context.Provider
43 149 148 CatchBoundary
44 150 149 Memo(MatchInnerImpl)
45 151 150 Lazy
46 152 151 OrdersPage
47 153 152 div
48 154 153 header
49 155 154 div
50 156 155 h1
50 157 155 p
49 158 154 div
50 159 158 SyncStatus
51 160 159 div
52 161 160 span
52 162 160 button
53 163 162 RefreshCw
54 164 163 ForwardRef(Anonymous)
55 165 164 svg
56 166 165 path key="v9h5vc"
56 167 165 path key="1q7to0"
56 168 165 path key="3uifl3"
56 169 165 path key="1cv678"
50 170 158 PermissionGate
51 171 170 Memo(Anonymous)
52 172 171 ForwardRef(Anonymous)
53 173 172 a
54 174 173 Plus
55 175 174 ForwardRef(Anonymous)
56 176 175 svg
57 177 176 path key="1ays0h"
57 178 176 path key="s699le"
48 179 153 OrdersToolbar
49 180 179 div
50 181 180 div
51 182 181 Search
52 183 182 ForwardRef(Anonymous)
53 184 183 svg
54 185 184 path key="14j7rj"
54 186 184 circle key="4ej97u"
51 187 181 Input
52 188 187 input
50 189 180 Select
51 190 189 select
52 191 190 option
52 192 190 option key="pending"
52 193 190 option key="processing"
52 194 190 option key="on_hold"
52 195 190 option key="shipped"
52 196 190 option key="delivered"
52 197 190 option key="cancelled"
50 198 180 Select
51 199 198 select
52 200 199 option
52 201 199 option key="NA"
52 202 199 option key="EMEA"
52 203 199 option key="APAC"
52 204 199 option key="LATAM"
50 205 180 div
51 206 205 Button
52 207 206 button
53 208 207 Rows3
54 209 208 ForwardRef(Anonymous)
55 210 209 svg
56 211 210 rect key="afitv7"
56 212 210 path key="1338ky"
56 213 210 path key="9uk58r"
51 214 205 div
52 215 214 Button
53 216 215 button
54 217 216 Columns3
55 218 217 ForwardRef(Anonymous)
56 219 218 svg
57 220 219 rect key="afitv7"
57 221 219 path key="fh3hqa"
57 222 219 path key="14nvp0"
48 223 153 PermissionGate
49 224 223 BulkActionBar
48 225 153 OrdersTable
49 226 225 div
50 227 226 div
51 228 227 div
52 229 228 Checkbox
53 230 229 input
51 231 227 div key="number"
52 232 231 button
51 233 227 div key="customerName"
52 234 233 button
51 235 227 div key="status"
52 236 235 button
51 237 227 div key="priority"
51 238 227 div key="region"
51 239 227 div key="itemCount"
51 240 227 div key="placedAt"
52 241 240 button
53 242 241 ArrowDown
54 243 242 ForwardRef(Anonymous)
55 244 243 svg
56 245 244 path key="s699le"
56 246 244 path key="1idqje"
51 247 227 div key="total"
52 248 247 button
51 249 227 div
50 250 226 div
51 251 250 div
52 256 251 Memo(OrderRow) key="o-105999"
53 257 256 div
54 258 257 div
55 259 258 Checkbox
56 260 259 input
54 261 257 div key="number"
55 262 261 Memo(Anonymous)
56 263 262 ForwardRef(Anonymous)
57 264 263 a
54 265 257 div key="customerName"
55 266 265 span
54 267 257 div key="status"
55 268 267 OrderStatusBadge
56 269 268 Badge
57 270 269 span
54 271 257 div key="priority"
55 272 271 PriorityBadge
56 273 272 Badge
57 274 273 span
54 275 257 div key="region"
54 276 257 div key="itemCount"
54 277 257 div key="placedAt"
54 278 257 div key="total"
54 279 257 div
55 280 279 ActionMenu
56 281 280 div
57 282 281 button
58 283 282 Ellipsis
59 284 283 ForwardRef(Anonymous)
60 285 284 svg
61 286 285 circle key="41hilf"
61 287 285 circle key="1wjl8i"
61 288 285 circle key="1pcz8c"
52 289 251 Memo(OrderRow) key="o-105998"
53 290 289 div
54 291 290 div
55 292 291 Checkbox
56 293 292 input
54 294 290 div key="number"
55 295 294 Memo(Anonymous)
56 296 295 ForwardRef(Anonymous)
57 297 296 a
54 298 290 div key="customerName"
55 299 298 span
54 300 290 div key="status"
55 301 300 OrderStatusBadge
56 302 301 Badge
57 303 302 span
54 304 290 div key="priority"
55 305 304 PriorityBadge
56 306 305 Badge
57 307 306 span
54 308 290 div key="region"
54 309 290 div key="itemCount"
54 310 290 div key="placedAt"
54 311 290 div key="total"
54 312 290 div
55 313 312 ActionMenu
56 314 313 div
57 315 314 button
58 316 315 Ellipsis
59 317 316 ForwardRef(Anonymous)
60 318 317 svg
61 319 318 circle key="41hilf"
61 320 318 circle key="1wjl8i"
61 321 318 circle key="1pcz8c"
52 322 251 Memo(OrderRow) key="o-105990"
53 323 322 div
54 324 323 div
55 325 324 Checkbox
56 326 325 input
54 327 323 div key="number"
55 328 327 Memo(Anonymous)
56 329 328 ForwardRef(Anonymous)
57 330 329 a
54 331 323 div key="customerName"
55 332 331 span
54 333 323 div key="status"
55 334 333 OrderStatusBadge
56 335 334 Badge
57 336 335 span
54 337 323 div key="priority"
55 338 337 PriorityBadge
56 339 338 Badge
57 340 339 span
54 341 323 div key="region"
54 342 323 div key="itemCount"
54 343 323 div key="placedAt"
54 344 323 div key="total"
54 345 323 div
55 346 345 ActionMenu
56 347 346 div
57 348 347 button
58 349 348 Ellipsis
59 350 349 ForwardRef(Anonymous)
60 351 350 svg
61 352 351 circle key="41hilf"
61 353 351 circle key="1wjl8i"
61 354 351 circle key="1pcz8c"
52 355 251 Memo(OrderRow) key="o-105979"
53 356 355 div
54 357 356 div
55 358 357 Checkbox
56 359 358 input
54 360 356 div key="number"
55 361 360 Memo(Anonymous)
56 362 361 ForwardRef(Anonymous)
57 363 362 a
54 364 356 div key="customerName"
55 365 364 span
54 366 356 div key="status"
55 367 366 OrderStatusBadge
56 368 367 Badge
57 369 368 span
54 370 356 div key="priority"
55 371 370 PriorityBadge
56 372 371 Badge
57 373 372 span
54 374 356 div key="region"
54 375 356 div key="itemCount"
54 376 356 div key="placedAt"
54 377 356 div key="total"
54 378 356 div
55 379 378 ActionMenu
56 380 379 div
57 381 380 button
58 382 381 Ellipsis
59 383 382 ForwardRef(Anonymous)
60 384 383 svg
61 385 384 circle key="41hilf"
61 386 384 circle key="1wjl8i"
61 387 384 circle key="1pcz8c"
52 388 251 Memo(OrderRow) key="o-105973"
53 389 388 div
54 390 389 div
55 391 390 Checkbox
56 392 391 input
54 393 389 div key="number"
55 394 393 Memo(Anonymous)
56 395 394 ForwardRef(Anonymous)
57 396 395 a
54 397 389 div key="customerName"
55 398 397 span
54 399 389 div key="status"
55 400 399 OrderStatusBadge
56 401 400 Badge
57 402 401 span
54 403 389 div key="priority"
55 404 403 PriorityBadge
56 405 404 Badge
57 406 405 span
54 407 389 div key="region"
54 408 389 div key="itemCount"
54 409 389 div key="placedAt"
54 410 389 div key="total"
54 411 389 div
55 412 411 ActionMenu
56 413 412 div
57 414 413 button
58 415 414 Ellipsis
59 416 415 ForwardRef(Anonymous)
60 417 416 svg
61 418 417 circle key="41hilf"
61 419 417 circle key="1wjl8i"
61 420 417 circle key="1pcz8c"
52 421 251 Memo(OrderRow) key="o-105968"
53 422 421 div
54 423 422 div
55 424 423 Checkbox
56 425 424 input
54 426 422 div key="number"
55 427 426 Memo(Anonymous)
56 428 427 ForwardRef(Anonymous)
57 429 428 a
54 430 422 div key="customerName"
55 431 430 span
54 432 422 div key="status"
55 433 432 OrderStatusBadge
56 434 433 Badge
57 435 434 span
54 436 422 div key="priority"
55 437 436 PriorityBadge
56 438 437 Badge
57 439 438 span
54 440 422 div key="region"
54 441 422 div key="itemCount"
54 442 422 div key="placedAt"
54 443 422 div key="total"
54 444 422 div
55 445 444 ActionMenu
56 446 445 div
57 447 446 button
58 448 447 Ellipsis
59 449 448 ForwardRef(Anonymous)
60 450 449 svg
61 451 450 circle key="41hilf"
61 452 450 circle key="1wjl8i"
61 453 450 circle key="1pcz8c"
52 454 251 Memo(OrderRow) key="o-105958"
53 455 454 div
54 456 455 div
55 457 456 Checkbox
56 458 457 input
54 459 455 div key="number"
55 460 459 Memo(Anonymous)
56 461 460 ForwardRef(Anonymous)
57 462 461 a
54 463 455 div key="customerName"
55 464 463 span
54 465 455 div key="status"
55 466 465 OrderStatusBadge
56 467 466 Badge
57 468 467 span
54 469 455 div key="priority"
55 470 469 PriorityBadge
56 471 470 Badge
57 472 471 span
54 473 455 div key="region"
54 474 455 div key="itemCount"
54 475 455 div key="placedAt"
54 476 455 div key="total"
54 477 455 div
55 478 477 ActionMenu
56 479 478 div
57 480 479 button
58 481 480 Ellipsis
59 482 481 ForwardRef(Anonymous)
60 483 482 svg
61 484 483 circle key="41hilf"
61 485 483 circle key="1wjl8i"
61 486 483 circle key="1pcz8c"
52 487 251 Memo(OrderRow) key="o-105957"
53 488 487 div
54 489 488 div
55 490 489 Checkbox
56 491 490 input
54 492 488 div key="number"
55 493 492 Memo(Anonymous)
56 494 493 ForwardRef(Anonymous)
57 495 494 a
54 496 488 div key="customerName"
55 497 496 span
54 498 488 div key="status"
55 499 498 OrderStatusBadge
56 500 499 Badge
57 501 500 span
54 502 488 div key="priority"
55 503 502 PriorityBadge
56 504 503 Badge
57 505 504 span
54 506 488 div key="region"
54 507 488 div key="itemCount"
54 508 488 div key="placedAt"
54 509 488 div key="total"
54 510 488 div
55 511 510 ActionMenu
56 512 511 div
57 513 512 button
58 514 513 Ellipsis
59 515 514 ForwardRef(Anonymous)
60 516 515 svg
61 517 516 circle key="41hilf"
61 518 516 circle key="1wjl8i"
61 519 516 circle key="1pcz8c"
52 520 251 Memo(OrderRow) key="o-105956"
53 521 520 div
54 522 521 div
55 523 522 Checkbox
56 524 523 input
54 525 521 div key="number"
55 526 525 Memo(Anonymous)
56 527 526 ForwardRef(Anonymous)
57 528 527 a
54 529 521 div key="customerName"
55 530 529 span
54 531 521 div key="status"
55 532 531 OrderStatusBadge
56 533 532 Badge
57 534 533 span
54 535 521 div key="priority"
55 536 535 PriorityBadge
56 537 536 Badge
57 538 537 span
54 539 521 div key="region"
54 540 521 div key="itemCount"
54 541 521 div key="placedAt"
54 542 521 div key="total"
54 543 521 div
55 544 543 ActionMenu
56 545 544 div
57 546 545 button
58 547 546 Ellipsis
59 548 547 ForwardRef(Anonymous)
60 549 548 svg
61 550 549 circle key="41hilf"
61 551 549 circle key="1wjl8i"
61 552 549 circle key="1pcz8c"
52 553 251 Memo(OrderRow) key="o-105944"
53 554 553 div
54 555 554 div
55 556 555 Checkbox
56 557 556 input
54 558 554 div key="number"
55 559 558 Memo(Anonymous)
56 560 559 ForwardRef(Anonymous)
57 561 560 a
54 562 554 div key="customerName"
55 563 562 span
54 564 554 div key="status"
55 565 564 OrderStatusBadge
56 566 565 Badge
57 567 566 span
54 568 554 div key="priority"
55 569 568 PriorityBadge
56 570 569 Badge
57 571 570 span
54 572 554 div key="region"
54 573 554 div key="itemCount"
54 574 554 div key="placedAt"
54 575 554 div key="total"
54 576 554 div
55 577 576 ActionMenu
56 578 577 div
57 579 578 button
58 580 579 Ellipsis
59 581 580 ForwardRef(Anonymous)
60 582 581 svg
61 583 582 circle key="41hilf"
61 584 582 circle key="1wjl8i"
61 585 582 circle key="1pcz8c"
21 252 22 Toaster
22 253 252 ol
21 254 22 Genie
21 255 22 DashboardDevTools
[exit 0]

$ agent-browser --session art-m1 react renders start
✓ Done
[exit 0]

$ bash /tmp/art-m1/hold.sh
✓ Done
✓ Done
SO-105979 updated
[exit 0]

$ agent-browser --session art-m1 react renders stop
# Render Profile - 2.53s recording
# 1572 renders (436 mounts + 1136 re-renders) across 54 components
# FPS: avg 60, min 10, max 61, drops (<30fps): 1

## Components by total render time
| Component           | Insts | Mounts | Re-renders | Total    | Self     | DOM   | Top change reason          |
| ------------------- | ----- | ------ | ---------- | -------- | -------- | ----- | -------------------------- |
| MatchImpl           |     6 |      0 |         30 |   97.6ms |        - |  0/30 | parent (OutletImpl)        |
| CatchBoundary       |     6 |      0 |         30 |   97.6ms |        - |  0/30 | parent (MatchView)         |
| OutletImpl          |     4 |      0 |         20 |   64.3ms |        - |  0/20 | parent (PreferencesProvider) |
| AppShell            |     2 |      0 |         10 |   32.8ms |        - |  0/10 | parent (PermissionsProvider) |
| PreferencesProvider |     2 |      0 |         10 |   32.8ms |        - |  0/10 | parent (AppShell)          |
| OrdersPage          |     2 |      0 |         10 |   32.5ms |    1.3ms |  2/10 | parent (Lazy)              |
| QueryClientProvider |     2 |      0 |         10 |   32.3ms |        - |  0/10 | parent (unknown)           |
| AuthProvider        |     2 |      0 |         10 |   32.3ms |        - |  0/10 | parent (QueryClientProvider) |
| App                 |     2 |      0 |         10 |   32.3ms |        - |  0/10 | parent (AuthProvider)      |
| MatchesInner        |     2 |      0 |         10 |   32.3ms |        - |  0/10 | parent (Matches)           |
| CatchNotFound       |     2 |      0 |         10 |   32.3ms |        - |  0/10 | parent (CatchBoundary)     |
| OrderRow            |    26 |      3 |        122 |   29.7ms |   16.9ms | 81/125 | parent (OrdersTable)       |
| OrdersTable         |     2 |      0 |         10 |   26.7ms |    5.9ms |  8/10 | state (hook #10)           |
| ActionMenu          |    26 |     45 |         82 |   24.8ms |    7.3ms | 127/127 | mount                      |
| Ellipsis            |    26 |     45 |         82 |     17ms |    4.7ms | 45/127 | mount                      |
| NotificationBell    |     2 |      0 |         10 |     10ms |      2ms | 10/10 | state (hook #6)            |
| NotificationsDrawer |     2 |      0 |         10 |      7ms |      7ms |  0/10 | props.notifications        |
| Boxes               |     1 |     10 |          0 |      5ms |        - | 10/10 | mount                      |
| PriorityBadge       |    26 |     49 |         78 |    4.7ms |    2.8ms | 49/127 | mount                      |
| Button              |     4 |      0 |         20 |    4.1ms |        - | 20/20 | props.onClick              |
| LayoutDashboard     |     1 |     10 |          0 |      4ms |        - | 10/10 | mount                      |
| Badge               |    52 |     98 |        156 |    3.8ms |    3.5ms | 254/254 | mount                      |
| Search              |     3 |     10 |         10 |    3.7ms |        - | 10/20 | parent (OrdersToolbar)     |
| SyncStatus          |     2 |      0 |         10 |    3.6ms |    1.2ms | 10/10 | state (hook #1)            |
| OrderStatusBadge    |    26 |     49 |         78 |    2.7ms |    0.8ms | 49/127 | mount                      |
| OrdersToolbar       |     2 |      0 |         10 |    2.2ms |      1ms | 10/10 | parent (OrdersPage)        |
| Checkbox            |    28 |     49 |         88 |    2.1ms |    2.1ms | 137/137 | mount                      |
| Package             |     1 |     10 |          0 |      2ms |        - | 10/10 | mount                      |
| Users               |     1 |     10 |          0 |      2ms |        - | 10/10 | mount                      |
| ChartColumn         |     1 |     10 |          0 |      2ms |        - | 10/10 | mount                      |
| RefreshCw           |     2 |      0 |         10 |    1.9ms |    0.1ms |  0/10 | parent (SyncStatus)        |
| Rows3               |     2 |      0 |         10 |    1.8ms |        - |  0/10 | parent (Button)            |
| Plus                |     2 |      0 |         10 |    1.7ms |    0.3ms |  0/10 | parent (PermissionGate)    |
| Columns3            |     2 |      0 |         10 |    1.7ms |        - |  0/10 | parent (Button)            |
| PermissionGate      |     4 |      0 |         20 |    1.1ms |        - |  0/20 | parent (OrdersPage)        |
| ArrowDown           |     2 |      0 |         10 |    1.1ms |    0.2ms |  0/10 | parent (OrdersTable)       |
| Settings            |     1 |     10 |          0 |      1ms |        - | 10/10 | mount                      |
| ChevronsLeft        |     1 |     10 |          0 |      1ms |        - | 10/10 | mount                      |
| Bell                |     2 |      0 |         10 |      1ms |        - |  0/10 | parent (NotificationBell)  |
| Select              |     4 |      0 |         20 |    0.7ms |    0.3ms | 20/20 | props.onChange             |
| Toaster             |     2 |      0 |         10 |    0.5ms |    0.2ms |  4/10 | parent (RootLayout)        |
| CircleCheck         |     1 |      4 |          0 |    0.4ms |        - |   4/4 | mount                      |
| X                   |     1 |      4 |          0 |    0.4ms |        - |   4/4 | mount                      |
| Input               |     2 |      0 |         10 |    0.3ms |    0.3ms | 10/10 | props.onChange             |
| TopBar              |     2 |      0 |         10 |    0.2ms |        - |  0/10 | parent (PreferencesProvider) |
| Transitioner        |     2 |      0 |         10 |        - |        - |  0/10 | parent (Matches)           |
| SidebarNav          |     2 |      0 |         10 |        - |        - |  0/10 | parent (PreferencesProvider) |
| Drawer              |     2 |      0 |         10 |        - |        - |  0/10 | props.onClose              |
| OverlayFrame        |     2 |      0 |         10 |        - |        - |  0/10 | props.onClose              |
| UserMenu            |     2 |      0 |         10 |        - |        - |  0/10 | parent (TopBar)            |
... and 4 more

## Change details (prev -> next)
  OrdersPage
    state (hook #4): Array(2) -> Array(2)
    state (hook #6): {tag, create, deps, ...} -> {tag, create, deps, ...}
    state (hook #7): {tag, create, deps, ...} -> {tag, create, deps, ...}
    state (hook #11): {tag, create, deps, ...} -> {tag, create, deps, ...}
    state (hook #14): {status, fetchStatus, isPending, ...} -> {status, fetchStatus, isPending, ...}
    state (hook #15): {tag, create, deps, ...} -> {tag, create, deps, ...}
    state (hook #16): {tag, create, deps, ...} -> {tag, create, deps, ...}
    state (hook #17): Array(2) -> Array(2)
  OrderRow
    props.onStatusChange: fn() -> fn()
  OrdersTable
    state (hook #1): Array(2) -> Array(2)
    state (hook #3): {tag, create, deps, ...} -> {tag, create, deps, ...}
    state (hook #4): Array(2) -> Array(2)
    state (hook #6): {tag, create, deps, ...} -> {tag, create, deps, ...}
    state (hook #7): Array(2) -> Array(2)
    state (hook #9): {tag, create, deps, ...} -> {tag, create, deps, ...}
    state (hook #10): Array(2) -> Array(2)
    state (hook #12): {tag, create, deps, ...} -> {tag, create, deps, ...}
    state (hook #13): Array(2) -> Array(2)
    state (hook #15): {tag, create, deps, ...} -> {tag, create, deps, ...}
    state (hook #17): {tag, create, deps, ...} -> {tag, create, deps, ...}
    state (hook #20): {tag, create, deps, ...} -> {tag, create, deps, ...}
    state (hook #24): 1 -> 2
    state (hook #28): {tag, create, deps, ...} -> {tag, create, deps, ...}
    state (hook #29): {tag, create, deps, ...} -> {tag, create, deps, ...}
    state (hook #30): {tag, create, deps, ...} -> {tag, create, deps, ...}
    state (hook #19): {context, data, error, ...} -> {context, data, error, ...}
    props.rows: Array(1054) -> Array(1054)
    props.onSortChange: fn() -> fn()
    state (hook #23): Array(2) -> Array(2)
  ActionMenu
    state (hook #0): false -> true
    state (hook #2): {tag, create, deps, ...} -> {tag, create, deps, ...}
  NotificationBell
    state (hook #1): {tag, create, deps, ...} -> {tag, create, deps, ...}
    state (hook #4): {status, fetchStatus, isPending, ...} -> {status, fetchStatus, isPending, ...}
    state (hook #5): {tag, create, deps, ...} -> {tag, create, deps, ...}
    state (hook #6): {tag, create, deps, ...} -> {tag, create, deps, ...}
    state (hook #7): {tag, create, deps, ...} -> {tag, create, deps, ...}
  NotificationsDrawer
    props.onClose: fn() -> fn()
    props.notifications: Array(0) -> Array(12)
    state (hook #1): {tag, create, deps, ...} -> {tag, create, deps, ...}
    state (hook #4): {tag, create, deps, ...} -> {tag, create, deps, ...}
  Button
    props.onClick: fn() -> fn()
  SyncStatus
    state (hook #0): 1795060682675 -> 1795060683674
    state (hook #1): {tag, create, deps, ...} -> {tag, create, deps, ...}
    props.updatedAt: 1795060679968 -> 1795060684105
    props.onRefresh: fn() -> fn()
  OrdersToolbar
    props.onFilterChange: fn() -> fn()
    state (hook #0): Array(2) -> Array(2)
    state (hook #2): {tag, create, deps, ...} -> {tag, create, deps, ...}
    state (hook #3): Array(2) -> Array(2)
    state (hook #5): {tag, create, deps, ...} -> {tag, create, deps, ...}
    state (hook #6): Array(2) -> Array(2)
    state (hook #8): {tag, create, deps, ...} -> {tag, create, deps, ...}
    state (hook #9): Array(2) -> Array(2)
    state (hook #11): {tag, create, deps, ...} -> {tag, create, deps, ...}
  Checkbox
    props.onChange: fn() -> fn()
  Select
    props.onChange: fn() -> fn()
  Toaster
    state (hook #0): Array(2) -> Array(2)
    state (hook #1): Array(0) -> Array(1)
    state (hook #2): {tag, create, deps, ...} -> {tag, create, deps, ...}
    state (hook #3): Array(2) -> Array(2)
    state (hook #5): {tag, create, deps, ...} -> {tag, create, deps, ...}
  Input
    props.onChange: fn() -> fn()
  Drawer
    props.onClose: fn() -> fn()
    props.footer: {$$typeof, type, key, ...} -> {$$typeof, type, key, ...}
  OverlayFrame
    props.onClose: fn() -> fn()
    props.footer: {$$typeof, type, key, ...} -> {$$typeof, type, key, ...}
    state (hook #1): {tag, create, deps, ...} -> {tag, create, deps, ...}
[exit 0]
````

## react-scan

````console
## react-scan 0.5.7: scratch copy apps/realworld-dashboard/.variants/art-m1-scan (gitignored). Change: src/main.tsx starts with: import { scan } from 'react-scan'; scan({ enabled: true, log: true })

$ agent-browser --session art-m1 close
✓ Browser closed
[exit 0]

$ agent-browser --session art-m1 open http://127.0.0.1:5221/login
[agent-browser] launched browser
✓ Meridian Ops
  http://127.0.0.1:5221/login
[exit 0]

$ ../../node_modules/.bin/genie-react status --session art-m1 --wait 15000 --select /ready
status: ok
selection: {expression:/ready,matchedPathCount:1,matchedPaths:[/ready],omittedPathCount:53}
result: true
[exit 0]

$ ../../node_modules/.bin/genie-react call app_login_as '{"role":"manager"}' --session art-m1
changed: true
role: manager
userId: u-manager
[exit 0]

$ agent-browser --session art-m1 open 'http://127.0.0.1:5221/orders?status=processing'
✓ Meridian Ops
  http://127.0.0.1:5221/orders?status=processing&sort=placedAt&dir=desc
[exit 0]

$ agent-browser --session art-m1 wait --text 'SO-105979'
SO-105979
[exit 0]

## react-scan: clear console, put SO-105979 on hold, read console

$ agent-browser --session art-m1 console --clear
✓ Console log cleared
[exit 0]

$ bash /tmp/art-m1/hold.sh
✗ Element '@e1' is covered by <div#react-scan-root> at its click point, so the input would land on that element instead. Dismiss or interact with the covering element first (it is often a dialog, banner, or sticky header).
✗ No element found: getByRole('menuitem', { name: 'Put on hold' }). Verify the selector, role, or name is correct and the element exists in the DOM.
✗ Wait timed out after 25000ms
[exit 1]

$ agent-browser --session art-m1 screenshot /tmp/art-m1/react-scan-overlay.png
✓ Screenshot saved to /tmp/art-m1/react-scan-overlay.png
[exit 0]

## react-scan: the toolbar (#react-scan-root) covered 'Actions for SO-105979' at 1280x577 and agent-browser refused the click (output above). Rerun with showToolbar: false

$ agent-browser --session art-m1 open 'http://127.0.0.1:5221/orders?status=processing'
✓ Meridian Ops
  http://127.0.0.1:5221/orders?status=processing&sort=placedAt&dir=desc
[exit 0]

$ agent-browser --session art-m1 wait --text 'SO-105979'
SO-105979
[exit 0]

$ agent-browser --session art-m1 console --clear
✓ Console log cleared
[exit 0]

$ bash /tmp/art-m1/hold.sh
✗ Element '@e2' is covered by <div#react-scan-root> at its click point, so the input would land on that element instead. Dismiss or interact with the covering element first (it is often a dialog, banner, or sticky header).
✗ No element found: getByRole('menuitem', { name: 'Put on hold' }). Verify the selector, role, or name is correct and the element exists in the DOM.
✗ Wait timed out after 25000ms
[exit 1]

$ agent-browser --session art-m1 screenshot /tmp/art-m1/react-scan-overlay-2.png
✓ Screenshot saved to /tmp/art-m1/react-scan-overlay-2.png
[exit 0]

## react-scan: localStorage 'react-scan-options' kept showToolbar:true from the first load. Remove it and reload.

$ agent-browser --session art-m1 eval 'localStorage.removeItem("react-scan-options"); localStorage.removeItem("react-scan-widget-settings-v2"); "removed"'
"removed"
[exit 0]

$ agent-browser --session art-m1 open 'http://127.0.0.1:5221/orders?status=processing'
✓ Meridian Ops
  http://127.0.0.1:5221/orders?status=processing&sort=placedAt&dir=desc
[exit 0]

$ agent-browser --session art-m1 wait --text 'SO-105979'
SO-105979
[exit 0]

## react-scan: dev server restarted (the dashboard's vite.config ignores .variants/** for watching, so the scratch edit had not been served). Now scan({ enabled: true, log: true, showToolbar: false })

$ agent-browser --session art-m1 eval 'localStorage.removeItem("react-scan-options"); "removed"'
"removed"
[exit 0]

$ ../../node_modules/.bin/genie-react call app_reset_backend '{}' --session art-m1 --wait 15000 --fields seed
[1]:
  - {seed:20260302}
[exit 0]

$ agent-browser --session art-m1 open 'http://127.0.0.1:5221/orders?status=processing'
✓ Meridian Ops
  http://127.0.0.1:5221/orders?status=processing&sort=placedAt&dir=desc
[exit 0]

$ agent-browser --session art-m1 wait --text 'SO-105979'
SO-105979
[exit 0]

$ agent-browser --session art-m1 console --clear
✓ Console log cleared
[exit 0]

$ bash /tmp/art-m1/hold.sh
✓ Done
✓ Done
SO-105979 updated
[exit 0]

$ agent-browser --session art-m1 screenshot /tmp/art-m1/react-scan-after-click.png
✓ Screenshot saved to /tmp/art-m1/react-scan-after-click.png
[exit 0]

## react-scan: plain console output after the hold (bug present)

$ agent-browser --session art-m1 console
[startGroup] %cActionMenu (0.2ms) background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cEllipsis (0.1ms) background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cOrdersTable (0.7ms) background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cCheckbox background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cArrowDown background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cOrderRow (0.4ms) background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cCheckbox (0.1ms) background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cOrderStatusBadge (0.1ms) background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cBadge background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cPriorityBadge background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cBadge background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cActionMenu background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cEllipsis background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cOrderRow (0.3ms) background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cCheckbox background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cOrderStatusBadge background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cBadge background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cPriorityBadge background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cBadge background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cActionMenu background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cEllipsis (0.1ms) background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cOrderRow (0.3ms) background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cCheckbox (0.1ms) background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cOrderStatusBadge background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cBadge background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cPriorityBadge background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cBadge background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cActionMenu (0.1ms) background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cEllipsis background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cActionMenu background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cEllipsis (0.1ms) background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cOrdersTable (0.7ms) background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cCheckbox background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cArrowDown background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cOrdersPage (0.4ms) background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cSyncStatus (0.1ms) background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cRefreshCw (0.1ms) background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cPermissionGate background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cPlus background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cOrdersToolbar (0.5ms) background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cSearch (0.1ms) background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cInput background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cSelect background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cSelect background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cButton background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cRows3 background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cButton background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cColumns3 background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cPermissionGate background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cBulkActionBar (0.1ms) background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cOrdersTable (0.6ms) background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cCheckbox background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cArrowDown background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cOrderRow (0.3ms) background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cCheckbox background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cOrderStatusBadge background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cBadge background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cPriorityBadge background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cBadge background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cActionMenu (0.1ms) background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cEllipsis background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cOrderRow (0.3ms) background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cCheckbox background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cOrderStatusBadge background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cBadge background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cPriorityBadge background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cBadge background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cActionMenu (0.1ms) background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cEllipsis background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cOrderRow (0.2ms) background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cCheckbox (0.1ms) background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cOrderStatusBadge background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cBadge background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cPriorityBadge background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cBadge background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cActionMenu (0.1ms) background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cEllipsis background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cOrderRow (0.4ms) background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cCheckbox background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cOrderStatusBadge background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cBadge background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cPriorityBadge background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cBadge background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cActionMenu background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cEllipsis background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cOrderRow (0.4ms) background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cCheckbox background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cOrderStatusBadge background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cBadge background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cPriorityBadge background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cBadge background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cActionMenu (0.1ms) background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cEllipsis background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cOrderRow (0.3ms) background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cCheckbox background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cOrderStatusBadge background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cBadge (0.1ms) background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cPriorityBadge background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cBadge background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cActionMenu background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cEllipsis background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cOrderRow (0.3ms) background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cCheckbox background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cOrderStatusBadge background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cBadge background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cPriorityBadge (0.1ms) background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cBadge background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cActionMenu background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cEllipsis background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cOrderRow (0.3ms) background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cCheckbox (0.1ms) background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cOrderStatusBadge background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cBadge background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cPriorityBadge background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cBadge background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cActionMenu background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cEllipsis background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cOrderRow (0.2ms) background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cCheckbox background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cOrderStatusBadge background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cBadge background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cPriorityBadge background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cBadge background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cActionMenu (0.1ms) background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cEllipsis background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cOrderRow (0.2ms) background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cCheckbox background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cOrderStatusBadge background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cBadge (0.1ms) background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cPriorityBadge background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cBadge background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cActionMenu background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cEllipsis (0.1ms) background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cOrderRow (0.3ms) background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cCheckbox background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cOrderStatusBadge background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cBadge background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cPriorityBadge background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cBadge background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cActionMenu background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cEllipsis background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cOrderRow (0.2ms) background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cCheckbox background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cOrderStatusBadge background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cBadge background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cPriorityBadge (0.1ms) background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cBadge background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cActionMenu background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cEllipsis (0.1ms) background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cOrderRow (0.2ms) background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cCheckbox background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cOrderStatusBadge background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cBadge background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cPriorityBadge background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cBadge (0.1ms) background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cActionMenu background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cEllipsis background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cOrdersTable (0.8ms) background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cCheckbox background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cArrowDown background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cToaster (0.4ms) background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cCircleCheck background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cX background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cOrdersPage (0.5ms) background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cSyncStatus background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cRefreshCw (0.1ms) background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cPermissionGate background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cPlus background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cOrdersToolbar (0.3ms) background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cSearch (0.1ms) background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cInput background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cSelect background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cSelect background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cButton background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cRows3 (0.1ms) background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cButton background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cColumns3 background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cPermissionGate background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cBulkActionBar background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cOrdersTable (0.7ms) background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cCheckbox background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cArrowDown background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cOrderRow (0.4ms) background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cCheckbox background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cOrderStatusBadge background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cBadge background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cPriorityBadge background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cBadge (0.1ms) background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cActionMenu background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cEllipsis background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cOrderRow (0.5ms) background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cCheckbox background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cOrderStatusBadge background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cBadge background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cPriorityBadge background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cBadge (0.1ms) background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cActionMenu (0.1ms) background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cEllipsis background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cOrderRow (0.4ms) background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cCheckbox background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cOrderStatusBadge background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cBadge background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cPriorityBadge background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cBadge background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cActionMenu background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cEllipsis background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cOrderRow (0.4ms) background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cCheckbox background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cOrderStatusBadge background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cBadge background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cPriorityBadge background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cBadge background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cActionMenu (0.1ms) background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cEllipsis background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cOrderRow (0.4ms) background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cCheckbox background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cOrderStatusBadge background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cBadge background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cPriorityBadge (0.1ms) background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cBadge background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cActionMenu background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cEllipsis background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cOrderRow (0.4ms) background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cCheckbox background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cOrderStatusBadge background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cBadge (0.1ms) background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cPriorityBadge background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cBadge background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cActionMenu background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cEllipsis background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cOrderRow (0.3ms) background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cCheckbox background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cOrderStatusBadge background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cBadge background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cPriorityBadge background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cBadge background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cActionMenu background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cEllipsis (0.1ms) background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cOrderRow (0.3ms) background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cCheckbox background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cOrderStatusBadge background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cBadge (0.1ms) background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cPriorityBadge background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cBadge background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cActionMenu (0.1ms) background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cEllipsis background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cOrderRow (0.3ms) background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cCheckbox background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cOrderStatusBadge (0.1ms) background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cBadge background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cPriorityBadge background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cBadge background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cActionMenu (0.1ms) background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cEllipsis background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cOrderRow (0.3ms) background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cCheckbox (0.1ms) background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cOrderStatusBadge background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cBadge background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cPriorityBadge background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cBadge (0.1ms) background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cActionMenu background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cEllipsis background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cOrderRow (0.4ms) background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cCheckbox background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cOrderStatusBadge (0.1ms) background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cBadge background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cPriorityBadge background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cBadge background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cActionMenu (0.1ms) background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cEllipsis background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cOrderRow (0.4ms) background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cCheckbox background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cOrderStatusBadge background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cBadge background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cPriorityBadge background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cBadge background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cActionMenu background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cEllipsis background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cOrderRow (0.3ms) background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cCheckbox background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cOrderStatusBadge background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cBadge background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cPriorityBadge background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cBadge background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cActionMenu background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cEllipsis background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cSyncStatus (0.2ms) background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cRefreshCw (0.1ms) background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cSyncStatus (0.2ms) background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cRefreshCw (0.1ms) background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cSyncStatus (0.2ms) background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cRefreshCw background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cSyncStatus (0.1ms) background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cRefreshCw background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cSyncStatus (0.1ms) background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cRefreshCw background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cToaster (0.1ms) background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cSyncStatus (0.1ms) background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cRefreshCw background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cSyncStatus (0.3ms) background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cRefreshCw (0.2ms) background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cSyncStatus (0.4ms) background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cRefreshCw background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cSyncStatus (0.1ms) background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cRefreshCw (0.1ms) background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cSyncStatus (0.8ms) background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cRefreshCw (0.3ms) background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cSyncStatus (0.2ms) background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cRefreshCw background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cSyncStatus (0.3ms) background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cRefreshCw background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cSyncStatus (0.4ms) background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cRefreshCw (0.1ms) background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cSyncStatus (0.2ms) background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cRefreshCw background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cSyncStatus (0.2ms) background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cRefreshCw (0.1ms) background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cSyncStatus (0.1ms) background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cRefreshCw (0.1ms) background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cSyncStatus (0.1ms) background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cRefreshCw background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cSyncStatus (0.3ms) background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cRefreshCw (0.1ms) background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cSyncStatus (0.1ms) background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cRefreshCw (0.1ms) background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cSyncStatus (0.1ms) background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cRefreshCw background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cSyncStatus (0.2ms) background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cRefreshCw background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cSyncStatus (0.1ms) background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cRefreshCw (0.1ms) background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cSyncStatus (0.1ms) background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cRefreshCw (0.1ms) background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cSyncStatus (0.2ms) background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cRefreshCw background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cSyncStatus (0.5ms) background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cRefreshCw (0.1ms) background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cSyncStatus (0.1ms) background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cRefreshCw (0.1ms) background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cSyncStatus (0.4ms) background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cRefreshCw (0.1ms) background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cSyncStatus (0.2ms) background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cRefreshCw background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cSyncStatus (0.4ms) background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cRefreshCw (0.2ms) background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cSyncStatus (0.4ms) background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cRefreshCw (0.2ms) background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cSyncStatus (0.3ms) background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cRefreshCw (0.3ms) background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cSyncStatus (0.3ms) background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cRefreshCw (0.1ms) background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cSyncStatus (0.1ms) background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cRefreshCw (0.1ms) background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cSyncStatus (0.2ms) background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cRefreshCw background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cSyncStatus (0.1ms) background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cRefreshCw background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cSyncStatus (0.1ms) background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cRefreshCw (0.1ms) background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cSyncStatus (0.1ms) background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cRefreshCw background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cSyncStatus (0.1ms) background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cRefreshCw (0.1ms) background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cSyncStatus (0.1ms) background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cRefreshCw background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cSyncStatus (0.2ms) background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cRefreshCw background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cSyncStatus (0.2ms) background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cRefreshCw background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cSyncStatus (0.4ms) background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cRefreshCw (0.1ms) background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cSyncStatus (0.4ms) background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cRefreshCw (0.1ms) background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cSyncStatus (0.5ms) background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cRefreshCw background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cSyncStatus (0.4ms) background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cRefreshCw (0.1ms) background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cSyncStatus (0.5ms) background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cRefreshCw (0.1ms) background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cSyncStatus background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cRefreshCw background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cSyncStatus (0.1ms) background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cRefreshCw background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cSyncStatus (0.2ms) background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cRefreshCw background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cSyncStatus (0.1ms) background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cRefreshCw background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cSyncStatus (0.4ms) background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cRefreshCw (0.2ms) background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cSyncStatus (0.2ms) background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cRefreshCw (0.2ms) background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cSyncStatus (0.2ms) background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cRefreshCw background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cSyncStatus (0.2ms) background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cRefreshCw background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cSyncStatus (0.1ms) background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cRefreshCw background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cSyncStatus (0.1ms) background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cRefreshCw background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cSyncStatus (0.2ms) background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cRefreshCw background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cSyncStatus (0.2ms) background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cRefreshCw background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cSyncStatus (0.1ms) background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cRefreshCw background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[exit 0]

## react-scan: AFTER the reference fix applied to the scratch copy

$ ../../node_modules/.bin/genie-react call app_reset_backend '{}' --session art-m1 --fields seed
[1]:
  - {seed:20260302}
[exit 0]

$ agent-browser --session art-m1 open 'http://127.0.0.1:5221/orders?status=processing'
✓ Meridian Ops
  http://127.0.0.1:5221/orders?status=processing&sort=placedAt&dir=desc
[exit 0]

$ agent-browser --session art-m1 wait --text 'SO-105979'
SO-105979
[exit 0]

$ agent-browser --session art-m1 console --clear
✓ Console log cleared
[exit 0]

$ bash /tmp/art-m1/hold.sh
✓ Done
✓ Done
SO-105979 updated
[exit 0]

$ agent-browser --session art-m1 screenshot /tmp/art-m1/react-scan-after-fix.png
✓ Screenshot saved to /tmp/art-m1/react-scan-after-fix.png
[exit 0]

$ agent-browser --session art-m1 console
[startGroup] %cActionMenu (0.2ms) background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cEllipsis background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cOrdersTable (0.6ms) background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cCheckbox background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cArrowDown background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cOrderRow (0.4ms) background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cCheckbox background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cOrderStatusBadge background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cBadge (0.1ms) background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cPriorityBadge background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cBadge background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cActionMenu (0.1ms) background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cEllipsis background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cOrderRow (0.3ms) background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cCheckbox background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cOrderStatusBadge background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cBadge (0.1ms) background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cPriorityBadge background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cBadge background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cActionMenu (0.1ms) background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cEllipsis background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cOrderRow (0.4ms) background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cCheckbox background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cOrderStatusBadge (0.1ms) background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cBadge background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cPriorityBadge background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cBadge background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cActionMenu background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cEllipsis (0.1ms) background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cActionMenu (0.1ms) background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cEllipsis background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cOrdersTable (0.5ms) background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cCheckbox (0.1ms) background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cArrowDown background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cOrdersPage (0.4ms) background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cSyncStatus background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cRefreshCw background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cPermissionGate background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cPlus background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cOrdersToolbar (0.3ms) background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cSearch (0.1ms) background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cInput background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cSelect background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cSelect background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cButton background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cRows3 (0.1ms) background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cButton background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cColumns3 background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cPermissionGate background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cBulkActionBar background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cOrdersTable (0.4ms) background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cCheckbox background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cArrowDown background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cOrderRow (0.3ms) background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cCheckbox background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cOrderStatusBadge background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cBadge background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cPriorityBadge background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cBadge background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cActionMenu (0.1ms) background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cEllipsis background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cOrdersTable (0.4ms) background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cCheckbox (0.1ms) background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cArrowDown background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cToaster (0.4ms) background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cCircleCheck background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cX (0.1ms) background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cOrdersPage (0.8ms) background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cSyncStatus (0.2ms) background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cRefreshCw background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cPermissionGate (0.1ms) background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cPlus background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cOrdersToolbar (0.7ms) background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cSearch (0.1ms) background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cInput background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cSelect background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cSelect background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cButton (0.1ms) background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cRows3 (0.1ms) background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cButton background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cColumns3 (0.1ms) background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cPermissionGate background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cBulkActionBar background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cOrdersTable (1.1ms) background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cCheckbox (0.1ms) background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cArrowDown background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cOrderRow (0.6ms) background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cCheckbox (0.1ms) background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cOrderStatusBadge (0.1ms) background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cBadge background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cPriorityBadge background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cBadge background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cActionMenu (0.1ms) background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cEllipsis (0.1ms) background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cSyncStatus (0.1ms) background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cRefreshCw background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cSyncStatus (0.2ms) background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[startGroup] %cRefreshCw background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;
[endGroup] console.groupEnd
[exit 0]
````

## why-did-you-render

````console
## why-did-you-render 10.0.1: scratch copy .variants/art-m1-wdyr. src/wdyr.ts calls whyDidYouRender(React, { trackAllPureComponents: true }) in DEV, imported first in src/main.tsx; vite.config react({ jsxImportSource: '@welldone-software/why-did-you-render' }). Bug present.

$ agent-browser --session art-m1 open 'http://127.0.0.1:5221/orders?status=processing'
✓ Meridian Ops
  http://127.0.0.1:5221/orders?status=processing&sort=placedAt&dir=desc
[exit 0]

$ ../../node_modules/.bin/genie-react status --session art-m1 --wait 15000 --select /ready
status: ok
selection: {expression:/ready,matchedPathCount:1,matchedPaths:[/ready],omittedPathCount:40}
result: true
[exit 0]

$ ../../node_modules/.bin/genie-react call app_reset_backend '{}' --session art-m1 --fields seed
[1]:
  - {seed:20260302}
[exit 0]

$ agent-browser --session art-m1 open 'http://127.0.0.1:5221/orders?status=processing'
✓ Meridian Ops
  http://127.0.0.1:5221/orders?status=processing&sort=placedAt&dir=desc
[exit 0]

$ agent-browser --session art-m1 wait --text 'SO-105979'
SO-105979
[exit 0]

$ agent-browser --session art-m1 console --clear
✓ Console log cleared
[exit 0]

$ bash /tmp/art-m1/hold.sh
✓ Done
✓ Done
SO-105979 updated
[exit 0]

$ agent-browser --session art-m1 console
[startGroup] %cUnknown background-color: white;color: #058;
[log] {Unknown: } Re-rendered because of props changes:
[startGroup] %cprops.%cchildren%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects that are equal by value. (more info at http://bit.ly/wdyr02)
[log] {prev children: Array(2)} !== {next children: Array(2)}
[log] {For detailed diff, right click the following fn, save as global, and run: : }
[endGroup] console.groupEnd
[startGroup] Rendered by OrdersPage
[endGroup] console.groupEnd
[endGroup] console.groupEnd
[log] whyDidYouRender error in getOwnerDifferences. Please file a bug at https://github.com/welldone-software/why-did-you-render/issues. {errorInfo: Object}
[startGroup] %cUnknown background-color: white;color: #058;
[log] {Unknown: } Re-rendered because of props changes:
[startGroup] %cprops.%cchildren%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects that are equal by value. (more info at http://bit.ly/wdyr02)
[log] {prev children: Array(2)} !== {next children: Array(2)}
[log] {For detailed diff, right click the following fn, save as global, and run: : }
[endGroup] console.groupEnd
[startGroup] Rendered by OrdersPage
[endGroup] console.groupEnd
[endGroup] console.groupEnd
[log] whyDidYouRender error in getOwnerDifferences. Please file a bug at https://github.com/welldone-software/why-did-you-render/issues. {errorInfo: Object}
[exit 0]

## why-did-you-render run 2: logOnDifferentValues: true (log every re-render of a tracked component, not only avoidable ones)

$ ../../node_modules/.bin/genie-react call app_reset_backend '{}' --session art-m1 --fields seed
[1]:
  - {seed:20260302}
[exit 0]

$ agent-browser --session art-m1 open 'http://127.0.0.1:5221/orders?status=processing'
✓ Meridian Ops
  http://127.0.0.1:5221/orders?status=processing&sort=placedAt&dir=desc
[exit 0]

$ agent-browser --session art-m1 wait --text 'SO-105979'
SO-105979
[exit 0]

$ agent-browser --session art-m1 console --clear
✓ Console log cleared
[exit 0]

$ bash /tmp/art-m1/hold.sh
✓ Done
✓ Done
SO-105979 updated
[exit 0]

$ agent-browser --session art-m1 console
[log] {prev order.warehouseId: "wh-singapore"} !== {next order.warehouseId: "wh-rotterdam"}
[endGroup] console.groupEnd
[startGroup] %cprops.%corder.region%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev order.region: "APAC"} !== {next order.region: "EMEA"}
[endGroup] console.groupEnd
[startGroup] %cprops.%corder.customerName%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev order.customerName: "Orchid Health"} !== {next order.customerName: "Willow Mercantile 3"}
[endGroup] console.groupEnd
[startGroup] %cprops.%corder.customerId%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev order.customerId: "c-0160"} !== {next order.customerId: "c-0720"}
[endGroup] console.groupEnd
[startGroup] %cprops.%corder.number%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev order.number: "SO-105990"} !== {next order.number: "SO-105998"}
[endGroup] console.groupEnd
[startGroup] %cprops.%corder.id%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev order.id: "o-105990"} !== {next order.id: "o-105998"}
[endGroup] console.groupEnd
[startGroup] %cprops.%corder%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev order: Object} !== {next order: Object}
[endGroup] console.groupEnd
[startGroup] %cprops.%cstart%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev start: 96} !== {next start: 48}
[endGroup] console.groupEnd
[startGroup] %cprops.%conStatusChange:parent-hook-useCallback-deps[0][3].updatedAt%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev onStatusChange:parent-hook-useCallback-deps[0][3].updatedAt: "2026-03-02T20:26:24.000Z"} !== {next onStatusChange:parent-hook-useCallback-deps[0][3].updatedAt: "2026-11-19T04:05:13.412Z"}
[endGroup] console.groupEnd
[startGroup] %cprops.%conStatusChange:parent-hook-useCallback-deps[0][3]%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev onStatusChange:parent-hook-useCallback-deps[0][3]: Object} !== {next onStatusChange:parent-hook-useCallback-deps[0][3]: Object}
[endGroup] console.groupEnd
[startGroup] %cprops.%conStatusChange:parent-hook-useCallback-deps[0]%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev onStatusChange:parent-hook-useCallback-deps[0]: Array(1054)} !== {next onStatusChange:parent-hook-useCallback-deps[0]: Array(1054)}
[endGroup] console.groupEnd
[startGroup] %cprops.%conStatusChange:parent-hook-useCallback-deps%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev onStatusChange:parent-hook-useCallback-deps: Array(2)} !== {next onStatusChange:parent-hook-useCallback-deps: Array(2)}
[endGroup] console.groupEnd
[startGroup] %cprops.%conStatusChange%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev onStatusChange: } !== {next onStatusChange: }
[endGroup] console.groupEnd
[endGroup] console.groupEnd
[endGroup] console.groupEnd
[startGroup] %cOrderRow background-color: white;color: #058;
[log] {OrderRow: } Re-rendered because of props changes:
[startGroup] %cprops.%corder.updatedAt%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev order.updatedAt: "2026-03-02T20:26:24.000Z"} !== {next order.updatedAt: "2026-11-19T04:05:13.412Z"}
[endGroup] console.groupEnd
[startGroup] %cprops.%corder%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev order: Object} !== {next order: Object}
[endGroup] console.groupEnd
[startGroup] %cprops.%conStatusChange:parent-hook-useCallback-deps[0][3].updatedAt%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev onStatusChange:parent-hook-useCallback-deps[0][3].updatedAt: "2026-03-02T20:26:24.000Z"} !== {next onStatusChange:parent-hook-useCallback-deps[0][3].updatedAt: "2026-11-19T04:05:13.412Z"}
[endGroup] console.groupEnd
[startGroup] %cprops.%conStatusChange:parent-hook-useCallback-deps[0][3]%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev onStatusChange:parent-hook-useCallback-deps[0][3]: Object} !== {next onStatusChange:parent-hook-useCallback-deps[0][3]: Object}
[endGroup] console.groupEnd
[startGroup] %cprops.%conStatusChange:parent-hook-useCallback-deps[0]%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev onStatusChange:parent-hook-useCallback-deps[0]: Array(1054)} !== {next onStatusChange:parent-hook-useCallback-deps[0]: Array(1054)}
[endGroup] console.groupEnd
[startGroup] %cprops.%conStatusChange:parent-hook-useCallback-deps%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev onStatusChange:parent-hook-useCallback-deps: Array(2)} !== {next onStatusChange:parent-hook-useCallback-deps: Array(2)}
[endGroup] console.groupEnd
[startGroup] %cprops.%conStatusChange%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev onStatusChange: } !== {next onStatusChange: }
[endGroup] console.groupEnd
[startGroup] Rendered by OrderRow
[log] {OrderRow: Object} Re-rendered because of props changes:
[startGroup] %cprops.%corder.updatedAt%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev order.updatedAt: "2026-03-02T20:26:24.000Z"} !== {next order.updatedAt: "2026-03-04T02:43:12.000Z"}
[endGroup] console.groupEnd
[startGroup] %cprops.%corder.placedAt%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev order.placedAt: "2026-03-01T22:26:24.000Z"} !== {next order.placedAt: "2026-03-02T03:43:12.000Z"}
[endGroup] console.groupEnd
[startGroup] %cprops.%corder.total%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev order.total: 2341.78} !== {next order.total: 8555.16}
[endGroup] console.groupEnd
[startGroup] %cprops.%corder.itemCount%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev order.itemCount: 46} !== {next order.itemCount: 42}
[endGroup] console.groupEnd
[startGroup] %cprops.%corder.warehouseId%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev order.warehouseId: "wh-columbus"} !== {next order.warehouseId: "wh-singapore"}
[endGroup] console.groupEnd
[startGroup] %cprops.%corder.region%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev order.region: "NA"} !== {next order.region: "APAC"}
[endGroup] console.groupEnd
[startGroup] %cprops.%corder.status%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev order.status: "on_hold"} !== {next order.status: "processing"}
[endGroup] console.groupEnd
[startGroup] %cprops.%corder.customerName%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev order.customerName: "Lumen Retail"} !== {next order.customerName: "Orchid Health"}
[endGroup] console.groupEnd
[startGroup] %cprops.%corder.customerId%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev order.customerId: "c-0037"} !== {next order.customerId: "c-0160"}
[endGroup] console.groupEnd
[startGroup] %cprops.%corder.number%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev order.number: "SO-105979"} !== {next order.number: "SO-105990"}
[endGroup] console.groupEnd
[startGroup] %cprops.%corder.id%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev order.id: "o-105979"} !== {next order.id: "o-105990"}
[endGroup] console.groupEnd
[startGroup] %cprops.%corder%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev order: Object} !== {next order: Object}
[endGroup] console.groupEnd
[startGroup] %cprops.%cstart%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev start: 144} !== {next start: 96}
[endGroup] console.groupEnd
[startGroup] %cprops.%conStatusChange:parent-hook-useCallback-deps[0][3].updatedAt%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev onStatusChange:parent-hook-useCallback-deps[0][3].updatedAt: "2026-03-02T20:26:24.000Z"} !== {next onStatusChange:parent-hook-useCallback-deps[0][3].updatedAt: "2026-11-19T04:05:13.412Z"}
[endGroup] console.groupEnd
[startGroup] %cprops.%conStatusChange:parent-hook-useCallback-deps[0][3]%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev onStatusChange:parent-hook-useCallback-deps[0][3]: Object} !== {next onStatusChange:parent-hook-useCallback-deps[0][3]: Object}
[endGroup] console.groupEnd
[startGroup] %cprops.%conStatusChange:parent-hook-useCallback-deps[0]%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev onStatusChange:parent-hook-useCallback-deps[0]: Array(1054)} !== {next onStatusChange:parent-hook-useCallback-deps[0]: Array(1054)}
[endGroup] console.groupEnd
[startGroup] %cprops.%conStatusChange:parent-hook-useCallback-deps%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev onStatusChange:parent-hook-useCallback-deps: Array(2)} !== {next onStatusChange:parent-hook-useCallback-deps: Array(2)}
[endGroup] console.groupEnd
[startGroup] %cprops.%conStatusChange%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev onStatusChange: } !== {next onStatusChange: }
[endGroup] console.groupEnd
[endGroup] console.groupEnd
[endGroup] console.groupEnd
[startGroup] %cOrderRow background-color: white;color: #058;
[log] {OrderRow: } Re-rendered because of props changes:
[startGroup] %cprops.%conStatusChange:parent-hook-useCallback-deps[0][3].updatedAt%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev onStatusChange:parent-hook-useCallback-deps[0][3].updatedAt: "2026-03-02T20:26:24.000Z"} !== {next onStatusChange:parent-hook-useCallback-deps[0][3].updatedAt: "2026-11-19T04:05:13.412Z"}
[endGroup] console.groupEnd
[startGroup] %cprops.%conStatusChange:parent-hook-useCallback-deps[0][3]%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev onStatusChange:parent-hook-useCallback-deps[0][3]: Object} !== {next onStatusChange:parent-hook-useCallback-deps[0][3]: Object}
[endGroup] console.groupEnd
[startGroup] %cprops.%conStatusChange:parent-hook-useCallback-deps[0]%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev onStatusChange:parent-hook-useCallback-deps[0]: Array(1054)} !== {next onStatusChange:parent-hook-useCallback-deps[0]: Array(1054)}
[endGroup] console.groupEnd
[startGroup] %cprops.%conStatusChange:parent-hook-useCallback-deps%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev onStatusChange:parent-hook-useCallback-deps: Array(2)} !== {next onStatusChange:parent-hook-useCallback-deps: Array(2)}
[endGroup] console.groupEnd
[startGroup] %cprops.%conStatusChange%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev onStatusChange: } !== {next onStatusChange: }
[endGroup] console.groupEnd
[startGroup] Rendered by OrderRow
[log] {OrderRow: Object} Re-rendered because of props changes:
[startGroup] %cprops.%corder.updatedAt%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev order.updatedAt: "2026-03-04T10:33:36.000Z"} !== {next order.updatedAt: "2026-11-19T04:05:13.412Z"}
[endGroup] console.groupEnd
[startGroup] %cprops.%corder.placedAt%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev order.placedAt: "2026-03-01T19:33:36.000Z"} !== {next order.placedAt: "2026-03-01T22:26:24.000Z"}
[endGroup] console.groupEnd
[startGroup] %cprops.%corder.total%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev order.total: 6658.64} !== {next order.total: 2341.78}
[endGroup] console.groupEnd
[startGroup] %cprops.%corder.itemCount%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev order.itemCount: 34} !== {next order.itemCount: 46}
[endGroup] console.groupEnd
[startGroup] %cprops.%corder.warehouseId%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev order.warehouseId: "wh-leipzig"} !== {next order.warehouseId: "wh-columbus"}
[endGroup] console.groupEnd
[startGroup] %cprops.%corder.region%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev order.region: "EMEA"} !== {next order.region: "NA"}
[endGroup] console.groupEnd
[startGroup] %cprops.%corder.status%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev order.status: "processing"} !== {next order.status: "on_hold"}
[endGroup] console.groupEnd
[startGroup] %cprops.%corder.customerName%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev order.customerName: "Summit Health 4"} !== {next order.customerName: "Lumen Retail"}
[endGroup] console.groupEnd
[startGroup] %cprops.%corder.customerId%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev order.customerId: "c-0884"} !== {next order.customerId: "c-0037"}
[endGroup] console.groupEnd
[startGroup] %cprops.%corder.number%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev order.number: "SO-105973"} !== {next order.number: "SO-105979"}
[endGroup] console.groupEnd
[startGroup] %cprops.%corder.id%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev order.id: "o-105973"} !== {next order.id: "o-105979"}
[endGroup] console.groupEnd
[startGroup] %cprops.%corder%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev order: Object} !== {next order: Object}
[endGroup] console.groupEnd
[startGroup] %cprops.%cstart%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev start: 192} !== {next start: 144}
[endGroup] console.groupEnd
[startGroup] %cprops.%conStatusChange:parent-hook-useCallback-deps[0][3].updatedAt%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev onStatusChange:parent-hook-useCallback-deps[0][3].updatedAt: "2026-03-02T20:26:24.000Z"} !== {next onStatusChange:parent-hook-useCallback-deps[0][3].updatedAt: "2026-11-19T04:05:13.412Z"}
[endGroup] console.groupEnd
[startGroup] %cprops.%conStatusChange:parent-hook-useCallback-deps[0][3]%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev onStatusChange:parent-hook-useCallback-deps[0][3]: Object} !== {next onStatusChange:parent-hook-useCallback-deps[0][3]: Object}
[endGroup] console.groupEnd
[startGroup] %cprops.%conStatusChange:parent-hook-useCallback-deps[0]%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev onStatusChange:parent-hook-useCallback-deps[0]: Array(1054)} !== {next onStatusChange:parent-hook-useCallback-deps[0]: Array(1054)}
[endGroup] console.groupEnd
[startGroup] %cprops.%conStatusChange:parent-hook-useCallback-deps%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev onStatusChange:parent-hook-useCallback-deps: Array(2)} !== {next onStatusChange:parent-hook-useCallback-deps: Array(2)}
[endGroup] console.groupEnd
[startGroup] %cprops.%conStatusChange%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev onStatusChange: } !== {next onStatusChange: }
[endGroup] console.groupEnd
[endGroup] console.groupEnd
[endGroup] console.groupEnd
[startGroup] %cOrderRow background-color: white;color: #058;
[log] {OrderRow: } Re-rendered because of props changes:
[startGroup] %cprops.%conStatusChange:parent-hook-useCallback-deps[0][3].updatedAt%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev onStatusChange:parent-hook-useCallback-deps[0][3].updatedAt: "2026-03-02T20:26:24.000Z"} !== {next onStatusChange:parent-hook-useCallback-deps[0][3].updatedAt: "2026-11-19T04:05:13.412Z"}
[endGroup] console.groupEnd
[startGroup] %cprops.%conStatusChange:parent-hook-useCallback-deps[0][3]%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev onStatusChange:parent-hook-useCallback-deps[0][3]: Object} !== {next onStatusChange:parent-hook-useCallback-deps[0][3]: Object}
[endGroup] console.groupEnd
[startGroup] %cprops.%conStatusChange:parent-hook-useCallback-deps[0]%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev onStatusChange:parent-hook-useCallback-deps[0]: Array(1054)} !== {next onStatusChange:parent-hook-useCallback-deps[0]: Array(1054)}
[endGroup] console.groupEnd
[startGroup] %cprops.%conStatusChange:parent-hook-useCallback-deps%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev onStatusChange:parent-hook-useCallback-deps: Array(2)} !== {next onStatusChange:parent-hook-useCallback-deps: Array(2)}
[endGroup] console.groupEnd
[startGroup] %cprops.%conStatusChange%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev onStatusChange: } !== {next onStatusChange: }
[endGroup] console.groupEnd
[startGroup] Rendered by OrderRow
[log] {OrderRow: Object} Re-rendered because of props changes:
[startGroup] %cprops.%corder.updatedAt%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev order.updatedAt: "2026-03-01T18:09:36.001Z"} !== {next order.updatedAt: "2026-03-04T10:33:36.000Z"}
[endGroup] console.groupEnd
[startGroup] %cprops.%corder.placedAt%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev order.placedAt: "2026-03-01T17:09:36.001Z"} !== {next order.placedAt: "2026-03-01T19:33:36.000Z"}
[endGroup] console.groupEnd
[startGroup] %cprops.%corder.total%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev order.total: 5684.2} !== {next order.total: 6658.64}
[endGroup] console.groupEnd
[startGroup] %cprops.%corder.itemCount%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev order.itemCount: 29} !== {next order.itemCount: 34}
[endGroup] console.groupEnd
[startGroup] %cprops.%corder.warehouseId%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev order.warehouseId: "wh-singapore"} !== {next order.warehouseId: "wh-leipzig"}
[endGroup] console.groupEnd
[startGroup] %cprops.%corder.region%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev order.region: "APAC"} !== {next order.region: "EMEA"}
[endGroup] console.groupEnd
[startGroup] %cprops.%corder.customerName%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev order.customerName: "Willow Retail 2"} !== {next order.customerName: "Summit Health 4"}
[endGroup] console.groupEnd
[startGroup] %cprops.%corder.customerId%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev order.customerId: "c-0288"} !== {next order.customerId: "c-0884"}
[endGroup] console.groupEnd
[startGroup] %cprops.%corder.number%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev order.number: "SO-105968"} !== {next order.number: "SO-105973"}
[endGroup] console.groupEnd
[startGroup] %cprops.%corder.id%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev order.id: "o-105968"} !== {next order.id: "o-105973"}
[endGroup] console.groupEnd
[startGroup] %cprops.%corder%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev order: Object} !== {next order: Object}
[endGroup] console.groupEnd
[startGroup] %cprops.%cstart%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev start: 240} !== {next start: 192}
[endGroup] console.groupEnd
[startGroup] %cprops.%conStatusChange:parent-hook-useCallback-deps[0][3].updatedAt%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev onStatusChange:parent-hook-useCallback-deps[0][3].updatedAt: "2026-03-02T20:26:24.000Z"} !== {next onStatusChange:parent-hook-useCallback-deps[0][3].updatedAt: "2026-11-19T04:05:13.412Z"}
[endGroup] console.groupEnd
[startGroup] %cprops.%conStatusChange:parent-hook-useCallback-deps[0][3]%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev onStatusChange:parent-hook-useCallback-deps[0][3]: Object} !== {next onStatusChange:parent-hook-useCallback-deps[0][3]: Object}
[endGroup] console.groupEnd
[startGroup] %cprops.%conStatusChange:parent-hook-useCallback-deps[0]%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev onStatusChange:parent-hook-useCallback-deps[0]: Array(1054)} !== {next onStatusChange:parent-hook-useCallback-deps[0]: Array(1054)}
[endGroup] console.groupEnd
[startGroup] %cprops.%conStatusChange:parent-hook-useCallback-deps%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev onStatusChange:parent-hook-useCallback-deps: Array(2)} !== {next onStatusChange:parent-hook-useCallback-deps: Array(2)}
[endGroup] console.groupEnd
[startGroup] %cprops.%conStatusChange%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev onStatusChange: } !== {next onStatusChange: }
[endGroup] console.groupEnd
[endGroup] console.groupEnd
[endGroup] console.groupEnd
[startGroup] %cOrderRow background-color: white;color: #058;
[log] {OrderRow: } Re-rendered because of props changes:
[startGroup] %cprops.%conStatusChange:parent-hook-useCallback-deps[0][3].updatedAt%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev onStatusChange:parent-hook-useCallback-deps[0][3].updatedAt: "2026-03-02T20:26:24.000Z"} !== {next onStatusChange:parent-hook-useCallback-deps[0][3].updatedAt: "2026-11-19T04:05:13.412Z"}
[endGroup] console.groupEnd
[startGroup] %cprops.%conStatusChange:parent-hook-useCallback-deps[0][3]%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev onStatusChange:parent-hook-useCallback-deps[0][3]: Object} !== {next onStatusChange:parent-hook-useCallback-deps[0][3]: Object}
[endGroup] console.groupEnd
[startGroup] %cprops.%conStatusChange:parent-hook-useCallback-deps[0]%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev onStatusChange:parent-hook-useCallback-deps[0]: Array(1054)} !== {next onStatusChange:parent-hook-useCallback-deps[0]: Array(1054)}
[endGroup] console.groupEnd
[startGroup] %cprops.%conStatusChange:parent-hook-useCallback-deps%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev onStatusChange:parent-hook-useCallback-deps: Array(2)} !== {next onStatusChange:parent-hook-useCallback-deps: Array(2)}
[endGroup] console.groupEnd
[startGroup] %cprops.%conStatusChange%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev onStatusChange: } !== {next onStatusChange: }
[endGroup] console.groupEnd
[startGroup] Rendered by OrderRow
[log] {OrderRow: Object} Re-rendered because of props changes:
[startGroup] %cprops.%corder.updatedAt%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev order.updatedAt: "2026-03-03T05:21:36.000Z"} !== {next order.updatedAt: "2026-03-01T18:09:36.001Z"}
[endGroup] console.groupEnd
[startGroup] %cprops.%corder.placedAt%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev order.placedAt: "2026-03-01T12:21:36.000Z"} !== {next order.placedAt: "2026-03-01T17:09:36.001Z"}
[endGroup] console.groupEnd
[startGroup] %cprops.%corder.total%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev order.total: 6251.3} !== {next order.total: 5684.2}
[endGroup] console.groupEnd
[startGroup] %cprops.%corder.itemCount%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev order.itemCount: 30} !== {next order.itemCount: 29}
[endGroup] console.groupEnd
[startGroup] %cprops.%corder.warehouseId%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev order.warehouseId: "wh-saopaulo"} !== {next order.warehouseId: "wh-singapore"}
[endGroup] console.groupEnd
[startGroup] %cprops.%corder.region%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev order.region: "LATAM"} !== {next order.region: "APAC"}
[endGroup] console.groupEnd
[startGroup] %cprops.%corder.customerName%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev order.customerName: "Summit Outfitters 3"} !== {next order.customerName: "Willow Retail 2"}
[endGroup] console.groupEnd
[startGroup] %cprops.%corder.customerId%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev order.customerId: "c-0596"} !== {next order.customerId: "c-0288"}
[endGroup] console.groupEnd
[startGroup] %cprops.%corder.number%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev order.number: "SO-105958"} !== {next order.number: "SO-105968"}
[endGroup] console.groupEnd
[startGroup] %cprops.%corder.id%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev order.id: "o-105958"} !== {next order.id: "o-105968"}
[endGroup] console.groupEnd
[startGroup] %cprops.%corder%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev order: Object} !== {next order: Object}
[endGroup] console.groupEnd
[startGroup] %cprops.%cstart%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev start: 288} !== {next start: 240}
[endGroup] console.groupEnd
[startGroup] %cprops.%conStatusChange:parent-hook-useCallback-deps[0][3].updatedAt%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev onStatusChange:parent-hook-useCallback-deps[0][3].updatedAt: "2026-03-02T20:26:24.000Z"} !== {next onStatusChange:parent-hook-useCallback-deps[0][3].updatedAt: "2026-11-19T04:05:13.412Z"}
[endGroup] console.groupEnd
[startGroup] %cprops.%conStatusChange:parent-hook-useCallback-deps[0][3]%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev onStatusChange:parent-hook-useCallback-deps[0][3]: Object} !== {next onStatusChange:parent-hook-useCallback-deps[0][3]: Object}
[endGroup] console.groupEnd
[startGroup] %cprops.%conStatusChange:parent-hook-useCallback-deps[0]%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev onStatusChange:parent-hook-useCallback-deps[0]: Array(1054)} !== {next onStatusChange:parent-hook-useCallback-deps[0]: Array(1054)}
[endGroup] console.groupEnd
[startGroup] %cprops.%conStatusChange:parent-hook-useCallback-deps%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev onStatusChange:parent-hook-useCallback-deps: Array(2)} !== {next onStatusChange:parent-hook-useCallback-deps: Array(2)}
[endGroup] console.groupEnd
[startGroup] %cprops.%conStatusChange%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev onStatusChange: } !== {next onStatusChange: }
[endGroup] console.groupEnd
[endGroup] console.groupEnd
[endGroup] console.groupEnd
[startGroup] %cOrderRow background-color: white;color: #058;
[log] {OrderRow: } Re-rendered because of props changes:
[startGroup] %cprops.%conStatusChange:parent-hook-useCallback-deps[0][3].updatedAt%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev onStatusChange:parent-hook-useCallback-deps[0][3].updatedAt: "2026-03-02T20:26:24.000Z"} !== {next onStatusChange:parent-hook-useCallback-deps[0][3].updatedAt: "2026-11-19T04:05:13.412Z"}
[endGroup] console.groupEnd
[startGroup] %cprops.%conStatusChange:parent-hook-useCallback-deps[0][3]%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev onStatusChange:parent-hook-useCallback-deps[0][3]: Object} !== {next onStatusChange:parent-hook-useCallback-deps[0][3]: Object}
[endGroup] console.groupEnd
[startGroup] %cprops.%conStatusChange:parent-hook-useCallback-deps[0]%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev onStatusChange:parent-hook-useCallback-deps[0]: Array(1054)} !== {next onStatusChange:parent-hook-useCallback-deps[0]: Array(1054)}
[endGroup] console.groupEnd
[startGroup] %cprops.%conStatusChange:parent-hook-useCallback-deps%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev onStatusChange:parent-hook-useCallback-deps: Array(2)} !== {next onStatusChange:parent-hook-useCallback-deps: Array(2)}
[endGroup] console.groupEnd
[startGroup] %cprops.%conStatusChange%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev onStatusChange: } !== {next onStatusChange: }
[endGroup] console.groupEnd
[startGroup] Rendered by OrderRow
[log] {OrderRow: Object} Re-rendered because of props changes:
[startGroup] %cprops.%corder.updatedAt%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev order.updatedAt: "2026-03-01T22:52:48.000Z"} !== {next order.updatedAt: "2026-03-03T05:21:36.000Z"}
[endGroup] console.groupEnd
[startGroup] %cprops.%corder.placedAt%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev order.placedAt: "2026-03-01T11:52:48.000Z"} !== {next order.placedAt: "2026-03-01T12:21:36.000Z"}
[endGroup] console.groupEnd
[startGroup] %cprops.%corder.total%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev order.total: 5888.22} !== {next order.total: 6251.3}
[endGroup] console.groupEnd
[startGroup] %cprops.%corder.itemCount%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev order.itemCount: 28} !== {next order.itemCount: 30}
[endGroup] console.groupEnd
[startGroup] %cprops.%corder.warehouseId%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev order.warehouseId: "wh-singapore"} !== {next order.warehouseId: "wh-saopaulo"}
[endGroup] console.groupEnd
[startGroup] %cprops.%corder.region%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev order.region: "APAC"} !== {next order.region: "LATAM"}
[endGroup] console.groupEnd
[startGroup] %cprops.%corder.customerName%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev order.customerName: "Acme Systems"} !== {next order.customerName: "Summit Outfitters 3"}
[endGroup] console.groupEnd
[startGroup] %cprops.%corder.customerId%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev order.customerId: "c-0193"} !== {next order.customerId: "c-0596"}
[endGroup] console.groupEnd
[startGroup] %cprops.%corder.number%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev order.number: "SO-105957"} !== {next order.number: "SO-105958"}
[endGroup] console.groupEnd
[startGroup] %cprops.%corder.id%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev order.id: "o-105957"} !== {next order.id: "o-105958"}
[endGroup] console.groupEnd
[startGroup] %cprops.%corder%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev order: Object} !== {next order: Object}
[endGroup] console.groupEnd
[startGroup] %cprops.%cstart%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev start: 336} !== {next start: 288}
[endGroup] console.groupEnd
[startGroup] %cprops.%conStatusChange:parent-hook-useCallback-deps[0][3].updatedAt%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev onStatusChange:parent-hook-useCallback-deps[0][3].updatedAt: "2026-03-02T20:26:24.000Z"} !== {next onStatusChange:parent-hook-useCallback-deps[0][3].updatedAt: "2026-11-19T04:05:13.412Z"}
[endGroup] console.groupEnd
[startGroup] %cprops.%conStatusChange:parent-hook-useCallback-deps[0][3]%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev onStatusChange:parent-hook-useCallback-deps[0][3]: Object} !== {next onStatusChange:parent-hook-useCallback-deps[0][3]: Object}
[endGroup] console.groupEnd
[startGroup] %cprops.%conStatusChange:parent-hook-useCallback-deps[0]%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev onStatusChange:parent-hook-useCallback-deps[0]: Array(1054)} !== {next onStatusChange:parent-hook-useCallback-deps[0]: Array(1054)}
[endGroup] console.groupEnd
[startGroup] %cprops.%conStatusChange:parent-hook-useCallback-deps%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev onStatusChange:parent-hook-useCallback-deps: Array(2)} !== {next onStatusChange:parent-hook-useCallback-deps: Array(2)}
[endGroup] console.groupEnd
[startGroup] %cprops.%conStatusChange%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev onStatusChange: } !== {next onStatusChange: }
[endGroup] console.groupEnd
[endGroup] console.groupEnd
[endGroup] console.groupEnd
[startGroup] %cOrderRow background-color: white;color: #058;
[log] {OrderRow: } Re-rendered because of props changes:
[startGroup] %cprops.%conStatusChange:parent-hook-useCallback-deps[0][3].updatedAt%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev onStatusChange:parent-hook-useCallback-deps[0][3].updatedAt: "2026-03-02T20:26:24.000Z"} !== {next onStatusChange:parent-hook-useCallback-deps[0][3].updatedAt: "2026-11-19T04:05:13.412Z"}
[endGroup] console.groupEnd
[startGroup] %cprops.%conStatusChange:parent-hook-useCallback-deps[0][3]%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev onStatusChange:parent-hook-useCallback-deps[0][3]: Object} !== {next onStatusChange:parent-hook-useCallback-deps[0][3]: Object}
[endGroup] console.groupEnd
[startGroup] %cprops.%conStatusChange:parent-hook-useCallback-deps[0]%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev onStatusChange:parent-hook-useCallback-deps[0]: Array(1054)} !== {next onStatusChange:parent-hook-useCallback-deps[0]: Array(1054)}
[endGroup] console.groupEnd
[startGroup] %cprops.%conStatusChange:parent-hook-useCallback-deps%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev onStatusChange:parent-hook-useCallback-deps: Array(2)} !== {next onStatusChange:parent-hook-useCallback-deps: Array(2)}
[endGroup] console.groupEnd
[startGroup] %cprops.%conStatusChange%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev onStatusChange: } !== {next onStatusChange: }
[endGroup] console.groupEnd
[startGroup] Rendered by OrderRow
[log] {OrderRow: Object} Re-rendered because of props changes:
[startGroup] %cprops.%corder.updatedAt%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev order.updatedAt: "2026-03-03T19:24:00.001Z"} !== {next order.updatedAt: "2026-03-01T22:52:48.000Z"}
[endGroup] console.groupEnd
[startGroup] %cprops.%corder.placedAt%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev order.placedAt: "2026-03-01T11:24:00.001Z"} !== {next order.placedAt: "2026-03-01T11:52:48.000Z"}
[endGroup] console.groupEnd
[startGroup] %cprops.%corder.total%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev order.total: 15769.16} !== {next order.total: 5888.22}
[endGroup] console.groupEnd
[startGroup] %cprops.%corder.itemCount%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev order.itemCount: 54} !== {next order.itemCount: 28}
[endGroup] console.groupEnd
[startGroup] %cprops.%corder.warehouseId%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev order.warehouseId: "wh-saopaulo"} !== {next order.warehouseId: "wh-singapore"}
[endGroup] console.groupEnd
[startGroup] %cprops.%corder.region%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev order.region: "LATAM"} !== {next order.region: "APAC"}
[endGroup] console.groupEnd
[startGroup] %cprops.%corder.customerName%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev order.customerName: "Vertex Health 3"} !== {next order.customerName: "Acme Systems"}
[endGroup] console.groupEnd
[startGroup] %cprops.%corder.customerId%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev order.customerId: "c-0647"} !== {next order.customerId: "c-0193"}
[endGroup] console.groupEnd
[startGroup] %cprops.%corder.number%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev order.number: "SO-105956"} !== {next order.number: "SO-105957"}
[endGroup] console.groupEnd
[startGroup] %cprops.%corder.id%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev order.id: "o-105956"} !== {next order.id: "o-105957"}
[endGroup] console.groupEnd
[startGroup] %cprops.%corder%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev order: Object} !== {next order: Object}
[endGroup] console.groupEnd
[startGroup] %cprops.%cstart%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev start: 384} !== {next start: 336}
[endGroup] console.groupEnd
[startGroup] %cprops.%conStatusChange:parent-hook-useCallback-deps[0][3].updatedAt%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev onStatusChange:parent-hook-useCallback-deps[0][3].updatedAt: "2026-03-02T20:26:24.000Z"} !== {next onStatusChange:parent-hook-useCallback-deps[0][3].updatedAt: "2026-11-19T04:05:13.412Z"}
[endGroup] console.groupEnd
[startGroup] %cprops.%conStatusChange:parent-hook-useCallback-deps[0][3]%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev onStatusChange:parent-hook-useCallback-deps[0][3]: Object} !== {next onStatusChange:parent-hook-useCallback-deps[0][3]: Object}
[endGroup] console.groupEnd
[startGroup] %cprops.%conStatusChange:parent-hook-useCallback-deps[0]%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev onStatusChange:parent-hook-useCallback-deps[0]: Array(1054)} !== {next onStatusChange:parent-hook-useCallback-deps[0]: Array(1054)}
[endGroup] console.groupEnd
[startGroup] %cprops.%conStatusChange:parent-hook-useCallback-deps%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev onStatusChange:parent-hook-useCallback-deps: Array(2)} !== {next onStatusChange:parent-hook-useCallback-deps: Array(2)}
[endGroup] console.groupEnd
[startGroup] %cprops.%conStatusChange%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev onStatusChange: } !== {next onStatusChange: }
[endGroup] console.groupEnd
[endGroup] console.groupEnd
[endGroup] console.groupEnd
[startGroup] %cOrderRow background-color: white;color: #058;
[log] {OrderRow: } Re-rendered because of props changes:
[startGroup] %cprops.%conStatusChange:parent-hook-useCallback-deps[0][3].updatedAt%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev onStatusChange:parent-hook-useCallback-deps[0][3].updatedAt: "2026-03-02T20:26:24.000Z"} !== {next onStatusChange:parent-hook-useCallback-deps[0][3].updatedAt: "2026-11-19T04:05:13.412Z"}
[endGroup] console.groupEnd
[startGroup] %cprops.%conStatusChange:parent-hook-useCallback-deps[0][3]%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev onStatusChange:parent-hook-useCallback-deps[0][3]: Object} !== {next onStatusChange:parent-hook-useCallback-deps[0][3]: Object}
[endGroup] console.groupEnd
[startGroup] %cprops.%conStatusChange:parent-hook-useCallback-deps[0]%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev onStatusChange:parent-hook-useCallback-deps[0]: Array(1054)} !== {next onStatusChange:parent-hook-useCallback-deps[0]: Array(1054)}
[endGroup] console.groupEnd
[startGroup] %cprops.%conStatusChange:parent-hook-useCallback-deps%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev onStatusChange:parent-hook-useCallback-deps: Array(2)} !== {next onStatusChange:parent-hook-useCallback-deps: Array(2)}
[endGroup] console.groupEnd
[startGroup] %cprops.%conStatusChange%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev onStatusChange: } !== {next onStatusChange: }
[endGroup] console.groupEnd
[startGroup] Rendered by OrderRow
[log] {OrderRow: Object} Re-rendered because of props changes:
[startGroup] %cprops.%corder.updatedAt%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev order.updatedAt: "2026-03-03T20:38:24.001Z"} !== {next order.updatedAt: "2026-03-03T19:24:00.001Z"}
[endGroup] console.groupEnd
[startGroup] %cprops.%corder.placedAt%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev order.placedAt: "2026-03-01T05:38:24.001Z"} !== {next order.placedAt: "2026-03-01T11:24:00.001Z"}
[endGroup] console.groupEnd
[startGroup] %cprops.%corder.total%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev order.total: 4416.09} !== {next order.total: 15769.16}
[endGroup] console.groupEnd
[startGroup] %cprops.%corder.itemCount%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev order.itemCount: 30} !== {next order.itemCount: 54}
[endGroup] console.groupEnd
[startGroup] %cprops.%corder.warehouseId%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev order.warehouseId: "wh-columbus"} !== {next order.warehouseId: "wh-saopaulo"}
[endGroup] console.groupEnd
[startGroup] %cprops.%corder.region%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev order.region: "NA"} !== {next order.region: "LATAM"}
[endGroup] console.groupEnd
[startGroup] %cprops.%corder.customerName%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev order.customerName: "Union Systems 4"} !== {next order.customerName: "Vertex Health 3"}
[endGroup] console.groupEnd
[startGroup] %cprops.%corder.customerId%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev order.customerId: "c-0934"} !== {next order.customerId: "c-0647"}
[endGroup] console.groupEnd
[startGroup] %cprops.%corder.number%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev order.number: "SO-105944"} !== {next order.number: "SO-105956"}
[endGroup] console.groupEnd
[startGroup] %cprops.%corder.id%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev order.id: "o-105944"} !== {next order.id: "o-105956"}
[endGroup] console.groupEnd
[startGroup] %cprops.%corder%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev order: Object} !== {next order: Object}
[endGroup] console.groupEnd
[startGroup] %cprops.%cstart%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev start: 432} !== {next start: 384}
[endGroup] console.groupEnd
[startGroup] %cprops.%conStatusChange:parent-hook-useCallback-deps[0][3].updatedAt%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev onStatusChange:parent-hook-useCallback-deps[0][3].updatedAt: "2026-03-02T20:26:24.000Z"} !== {next onStatusChange:parent-hook-useCallback-deps[0][3].updatedAt: "2026-11-19T04:05:13.412Z"}
[endGroup] console.groupEnd
[startGroup] %cprops.%conStatusChange:parent-hook-useCallback-deps[0][3]%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev onStatusChange:parent-hook-useCallback-deps[0][3]: Object} !== {next onStatusChange:parent-hook-useCallback-deps[0][3]: Object}
[endGroup] console.groupEnd
[startGroup] %cprops.%conStatusChange:parent-hook-useCallback-deps[0]%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev onStatusChange:parent-hook-useCallback-deps[0]: Array(1054)} !== {next onStatusChange:parent-hook-useCallback-deps[0]: Array(1054)}
[endGroup] console.groupEnd
[startGroup] %cprops.%conStatusChange:parent-hook-useCallback-deps%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev onStatusChange:parent-hook-useCallback-deps: Array(2)} !== {next onStatusChange:parent-hook-useCallback-deps: Array(2)}
[endGroup] console.groupEnd
[startGroup] %cprops.%conStatusChange%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev onStatusChange: } !== {next onStatusChange: }
[endGroup] console.groupEnd
[endGroup] console.groupEnd
[endGroup] console.groupEnd
[startGroup] %cOrderRow background-color: white;color: #058;
[log] {OrderRow: } Re-rendered because of props changes:
[startGroup] %cprops.%conStatusChange:parent-hook-useCallback-deps[0][3].updatedAt%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev onStatusChange:parent-hook-useCallback-deps[0][3].updatedAt: "2026-03-02T20:26:24.000Z"} !== {next onStatusChange:parent-hook-useCallback-deps[0][3].updatedAt: "2026-11-19T04:05:13.412Z"}
[endGroup] console.groupEnd
[startGroup] %cprops.%conStatusChange:parent-hook-useCallback-deps[0][3]%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev onStatusChange:parent-hook-useCallback-deps[0][3]: Object} !== {next onStatusChange:parent-hook-useCallback-deps[0][3]: Object}
[endGroup] console.groupEnd
[startGroup] %cprops.%conStatusChange:parent-hook-useCallback-deps[0]%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev onStatusChange:parent-hook-useCallback-deps[0]: Array(1054)} !== {next onStatusChange:parent-hook-useCallback-deps[0]: Array(1054)}
[endGroup] console.groupEnd
[startGroup] %cprops.%conStatusChange:parent-hook-useCallback-deps%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev onStatusChange:parent-hook-useCallback-deps: Array(2)} !== {next onStatusChange:parent-hook-useCallback-deps: Array(2)}
[endGroup] console.groupEnd
[startGroup] %cprops.%conStatusChange%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev onStatusChange: } !== {next onStatusChange: }
[endGroup] console.groupEnd
[startGroup] Rendered by OrderRow
[log] {OrderRow: Object} Re-rendered because of props changes:
[startGroup] %cprops.%corder.updatedAt%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev order.updatedAt: "2026-03-03T15:09:36.000Z"} !== {next order.updatedAt: "2026-03-03T20:38:24.001Z"}
[endGroup] console.groupEnd
[startGroup] %cprops.%corder.placedAt%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev order.placedAt: "2026-02-28T17:09:36.000Z"} !== {next order.placedAt: "2026-03-01T05:38:24.001Z"}
[endGroup] console.groupEnd
[startGroup] %cprops.%corder.total%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev order.total: 9477.84} !== {next order.total: 4416.09}
[endGroup] console.groupEnd
[startGroup] %cprops.%corder.itemCount%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev order.itemCount: 24} !== {next order.itemCount: 30}
[endGroup] console.groupEnd
[startGroup] %cprops.%corder.warehouseId%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev order.warehouseId: "wh-singapore"} !== {next order.warehouseId: "wh-columbus"}
[endGroup] console.groupEnd
[startGroup] %cprops.%corder.region%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev order.region: "APAC"} !== {next order.region: "NA"}
[endGroup] console.groupEnd
[startGroup] %cprops.%corder.customerName%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev order.customerName: "Juniper Systems 5"} !== {next order.customerName: "Union Systems 4"}
[endGroup] console.groupEnd
[startGroup] %cprops.%corder.customerId%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev order.customerId: "c-1163"} !== {next order.customerId: "c-0934"}
[endGroup] console.groupEnd
[startGroup] %cprops.%corder.number%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev order.number: "SO-105918"} !== {next order.number: "SO-105944"}
[endGroup] console.groupEnd
[startGroup] %cprops.%corder.id%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev order.id: "o-105918"} !== {next order.id: "o-105944"}
[endGroup] console.groupEnd
[startGroup] %cprops.%corder%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev order: Object} !== {next order: Object}
[endGroup] console.groupEnd
[startGroup] %cprops.%cstart%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev start: 480} !== {next start: 432}
[endGroup] console.groupEnd
[startGroup] %cprops.%conStatusChange:parent-hook-useCallback-deps[0][3].updatedAt%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev onStatusChange:parent-hook-useCallback-deps[0][3].updatedAt: "2026-03-02T20:26:24.000Z"} !== {next onStatusChange:parent-hook-useCallback-deps[0][3].updatedAt: "2026-11-19T04:05:13.412Z"}
[endGroup] console.groupEnd
[startGroup] %cprops.%conStatusChange:parent-hook-useCallback-deps[0][3]%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev onStatusChange:parent-hook-useCallback-deps[0][3]: Object} !== {next onStatusChange:parent-hook-useCallback-deps[0][3]: Object}
[endGroup] console.groupEnd
[startGroup] %cprops.%conStatusChange:parent-hook-useCallback-deps[0]%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev onStatusChange:parent-hook-useCallback-deps[0]: Array(1054)} !== {next onStatusChange:parent-hook-useCallback-deps[0]: Array(1054)}
[endGroup] console.groupEnd
[startGroup] %cprops.%conStatusChange:parent-hook-useCallback-deps%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev onStatusChange:parent-hook-useCallback-deps: Array(2)} !== {next onStatusChange:parent-hook-useCallback-deps: Array(2)}
[endGroup] console.groupEnd
[startGroup] %cprops.%conStatusChange%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev onStatusChange: } !== {next onStatusChange: }
[endGroup] console.groupEnd
[endGroup] console.groupEnd
[endGroup] console.groupEnd
[startGroup] %cOrderRow background-color: white;color: #058;
[log] {OrderRow: } Re-rendered because of props changes:
[startGroup] %cprops.%conStatusChange:parent-hook-useCallback-deps[0][3].updatedAt%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev onStatusChange:parent-hook-useCallback-deps[0][3].updatedAt: "2026-03-02T20:26:24.000Z"} !== {next onStatusChange:parent-hook-useCallback-deps[0][3].updatedAt: "2026-11-19T04:05:13.412Z"}
[endGroup] console.groupEnd
[startGroup] %cprops.%conStatusChange:parent-hook-useCallback-deps[0][3]%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev onStatusChange:parent-hook-useCallback-deps[0][3]: Object} !== {next onStatusChange:parent-hook-useCallback-deps[0][3]: Object}
[endGroup] console.groupEnd
[startGroup] %cprops.%conStatusChange:parent-hook-useCallback-deps[0]%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev onStatusChange:parent-hook-useCallback-deps[0]: Array(1054)} !== {next onStatusChange:parent-hook-useCallback-deps[0]: Array(1054)}
[endGroup] console.groupEnd
[startGroup] %cprops.%conStatusChange:parent-hook-useCallback-deps%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev onStatusChange:parent-hook-useCallback-deps: Array(2)} !== {next onStatusChange:parent-hook-useCallback-deps: Array(2)}
[endGroup] console.groupEnd
[startGroup] %cprops.%conStatusChange%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev onStatusChange: } !== {next onStatusChange: }
[endGroup] console.groupEnd
[startGroup] Rendered by OrderRow
[log] {OrderRow: Object} Re-rendered because of props changes:
[startGroup] %cprops.%corder.updatedAt%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev order.updatedAt: "2026-03-03T03:40:48.000Z"} !== {next order.updatedAt: "2026-03-03T15:09:36.000Z"}
[endGroup] console.groupEnd
[startGroup] %cprops.%corder.placedAt%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev order.placedAt: "2026-02-28T16:40:48.000Z"} !== {next order.placedAt: "2026-02-28T17:09:36.000Z"}
[endGroup] console.groupEnd
[startGroup] %cprops.%corder.total%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev order.total: 6770.17} !== {next order.total: 9477.84}
[endGroup] console.groupEnd
[startGroup] %cprops.%corder.itemCount%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev order.itemCount: 33} !== {next order.itemCount: 24}
[endGroup] console.groupEnd
[startGroup] %cprops.%corder.customerName%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev order.customerName: "Apex Mercantile"} !== {next order.customerName: "Juniper Systems 5"}
[endGroup] console.groupEnd
[startGroup] %cprops.%corder.customerId%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev order.customerId: "c-0218"} !== {next order.customerId: "c-1163"}
[endGroup] console.groupEnd
[startGroup] %cprops.%corder.number%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev order.number: "SO-105917"} !== {next order.number: "SO-105918"}
[endGroup] console.groupEnd
[startGroup] %cprops.%corder.id%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev order.id: "o-105917"} !== {next order.id: "o-105918"}
[endGroup] console.groupEnd
[startGroup] %cprops.%corder%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev order: Object} !== {next order: Object}
[endGroup] console.groupEnd
[startGroup] %cprops.%cstart%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev start: 528} !== {next start: 480}
[endGroup] console.groupEnd
[startGroup] %cprops.%conStatusChange:parent-hook-useCallback-deps[0][3].updatedAt%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev onStatusChange:parent-hook-useCallback-deps[0][3].updatedAt: "2026-03-02T20:26:24.000Z"} !== {next onStatusChange:parent-hook-useCallback-deps[0][3].updatedAt: "2026-11-19T04:05:13.412Z"}
[endGroup] console.groupEnd
[startGroup] %cprops.%conStatusChange:parent-hook-useCallback-deps[0][3]%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev onStatusChange:parent-hook-useCallback-deps[0][3]: Object} !== {next onStatusChange:parent-hook-useCallback-deps[0][3]: Object}
[endGroup] console.groupEnd
[startGroup] %cprops.%conStatusChange:parent-hook-useCallback-deps[0]%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev onStatusChange:parent-hook-useCallback-deps[0]: Array(1054)} !== {next onStatusChange:parent-hook-useCallback-deps[0]: Array(1054)}
[endGroup] console.groupEnd
[startGroup] %cprops.%conStatusChange:parent-hook-useCallback-deps%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev onStatusChange:parent-hook-useCallback-deps: Array(2)} !== {next onStatusChange:parent-hook-useCallback-deps: Array(2)}
[endGroup] console.groupEnd
[startGroup] %cprops.%conStatusChange%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev onStatusChange: } !== {next onStatusChange: }
[endGroup] console.groupEnd
[endGroup] console.groupEnd
[endGroup] console.groupEnd
[startGroup] %cOrderRow background-color: white;color: #058;
[log] {OrderRow: } Re-rendered because of props changes:
[startGroup] %cprops.%conStatusChange:parent-hook-useCallback-deps[0][3].updatedAt%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev onStatusChange:parent-hook-useCallback-deps[0][3].updatedAt: "2026-03-02T20:26:24.000Z"} !== {next onStatusChange:parent-hook-useCallback-deps[0][3].updatedAt: "2026-11-19T04:05:13.412Z"}
[endGroup] console.groupEnd
[startGroup] %cprops.%conStatusChange:parent-hook-useCallback-deps[0][3]%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev onStatusChange:parent-hook-useCallback-deps[0][3]: Object} !== {next onStatusChange:parent-hook-useCallback-deps[0][3]: Object}
[endGroup] console.groupEnd
[startGroup] %cprops.%conStatusChange:parent-hook-useCallback-deps[0]%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev onStatusChange:parent-hook-useCallback-deps[0]: Array(1054)} !== {next onStatusChange:parent-hook-useCallback-deps[0]: Array(1054)}
[endGroup] console.groupEnd
[startGroup] %cprops.%conStatusChange:parent-hook-useCallback-deps%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev onStatusChange:parent-hook-useCallback-deps: Array(2)} !== {next onStatusChange:parent-hook-useCallback-deps: Array(2)}
[endGroup] console.groupEnd
[startGroup] %cprops.%conStatusChange%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev onStatusChange: } !== {next onStatusChange: }
[endGroup] console.groupEnd
[startGroup] Rendered by OrderRow
[log] {OrderRow: Object} Re-rendered because of props changes:
[startGroup] %cprops.%corder.updatedAt%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev order.updatedAt: "2026-03-02T12:43:12.000Z"} !== {next order.updatedAt: "2026-03-03T03:40:48.000Z"}
[endGroup] console.groupEnd
[startGroup] %cprops.%corder.placedAt%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev order.placedAt: "2026-02-28T15:43:12.000Z"} !== {next order.placedAt: "2026-02-28T16:40:48.000Z"}
[endGroup] console.groupEnd
[startGroup] %cprops.%corder.total%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev order.total: 3073.17} !== {next order.total: 6770.17}
[endGroup] console.groupEnd
[startGroup] %cprops.%corder.itemCount%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev order.itemCount: 38} !== {next order.itemCount: 33}
[endGroup] console.groupEnd
[startGroup] %cprops.%corder.warehouseId%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev order.warehouseId: "wh-saopaulo"} !== {next order.warehouseId: "wh-singapore"}
[endGroup] console.groupEnd
[startGroup] %cprops.%corder.region%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev order.region: "LATAM"} !== {next order.region: "APAC"}
[endGroup] console.groupEnd
[startGroup] %cprops.%corder.customerName%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev order.customerName: "Juniper Outfitters 4"} !== {next order.customerName: "Apex Mercantile"}
[endGroup] console.groupEnd
[startGroup] %cprops.%corder.customerId%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev order.customerId: "c-0827"} !== {next order.customerId: "c-0218"}
[endGroup] console.groupEnd
[startGroup] %cprops.%corder.number%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev order.number: "SO-105915"} !== {next order.number: "SO-105917"}
[endGroup] console.groupEnd
[startGroup] %cprops.%corder.id%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev order.id: "o-105915"} !== {next order.id: "o-105917"}
[endGroup] console.groupEnd
[startGroup] %cprops.%corder%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev order: Object} !== {next order: Object}
[endGroup] console.groupEnd
[startGroup] %cprops.%cstart%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev start: 576} !== {next start: 528}
[endGroup] console.groupEnd
[startGroup] %cprops.%conStatusChange:parent-hook-useCallback-deps[0][3].updatedAt%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev onStatusChange:parent-hook-useCallback-deps[0][3].updatedAt: "2026-03-02T20:26:24.000Z"} !== {next onStatusChange:parent-hook-useCallback-deps[0][3].updatedAt: "2026-11-19T04:05:13.412Z"}
[endGroup] console.groupEnd
[startGroup] %cprops.%conStatusChange:parent-hook-useCallback-deps[0][3]%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev onStatusChange:parent-hook-useCallback-deps[0][3]: Object} !== {next onStatusChange:parent-hook-useCallback-deps[0][3]: Object}
[endGroup] console.groupEnd
[startGroup] %cprops.%conStatusChange:parent-hook-useCallback-deps[0]%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev onStatusChange:parent-hook-useCallback-deps[0]: Array(1054)} !== {next onStatusChange:parent-hook-useCallback-deps[0]: Array(1054)}
[endGroup] console.groupEnd
[startGroup] %cprops.%conStatusChange:parent-hook-useCallback-deps%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev onStatusChange:parent-hook-useCallback-deps: Array(2)} !== {next onStatusChange:parent-hook-useCallback-deps: Array(2)}
[endGroup] console.groupEnd
[startGroup] %cprops.%conStatusChange%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev onStatusChange: } !== {next onStatusChange: }
[endGroup] console.groupEnd
[endGroup] console.groupEnd
[endGroup] console.groupEnd
[exit 0]

## why-did-you-render run 3: logOnDifferentValues: true, reference fix applied to the scratch copy

$ ../../node_modules/.bin/genie-react call app_reset_backend '{}' --session art-m1 --fields seed
[1]:
  - {seed:20260302}
[exit 0]

$ agent-browser --session art-m1 open 'http://127.0.0.1:5221/orders?status=processing'
✓ Meridian Ops
  http://127.0.0.1:5221/orders?status=processing&sort=placedAt&dir=desc
[exit 0]

$ agent-browser --session art-m1 wait --text 'SO-105979'
SO-105979
[exit 0]

$ agent-browser --session art-m1 console --clear
✓ Console log cleared
[exit 0]

$ bash /tmp/art-m1/hold.sh
✓ Done
✓ Done
SO-105979 updated
[exit 0]

$ agent-browser --session art-m1 console
[startGroup] %cUnknown background-color: white;color: #058;
[log] {Unknown: } Re-rendered because of props changes:
[startGroup] %cprops.%cchildren%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects that are equal by value. (more info at http://bit.ly/wdyr02)
[log] {prev children: Array(2)} !== {next children: Array(2)}
[log] {For detailed diff, right click the following fn, save as global, and run: : }
[endGroup] console.groupEnd
[startGroup] Rendered by OrdersPage
[log] {OrdersPage: } Re-rendered because of hook changes:
[startGroup] %c[hook useSyncExternalStore result]%c.dataUpdatedAt%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr3)
[log] {prev .dataUpdatedAt: 1795061142238} !== {next .dataUpdatedAt: 1795061144103}
[endGroup] console.groupEnd
[startGroup] %c[hook useSyncExternalStore result]%c.data.items[1050].status%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr3)
[log] {prev .data.items[1050].status: "processing"} !== {next .data.items[1050].status: "on_hold"}
[endGroup] console.groupEnd
[startGroup] %c[hook useSyncExternalStore result]%c.data.items[1050]%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr3)
[log] {prev .data.items[1050]: Object} !== {next .data.items[1050]: Object}
[endGroup] console.groupEnd
[startGroup] %c[hook useSyncExternalStore result]%c.data.items%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr3)
[log] {prev .data.items: Array(1054)} !== {next .data.items: Array(1054)}
[endGroup] console.groupEnd
[startGroup] %c[hook useSyncExternalStore result]%c.data%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr3)
[log] {prev .data: Object} !== {next .data: Object}
[endGroup] console.groupEnd
[startGroup] %c[hook useSyncExternalStore result]%c%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr3)
[log] {prev : Object} !== {next : Object}
[endGroup] console.groupEnd
[endGroup] console.groupEnd
[endGroup] console.groupEnd
[log] whyDidYouRender error in getOwnerDifferences. Please file a bug at https://github.com/welldone-software/why-did-you-render/issues. {errorInfo: Object}
[startGroup] %cOrderRow background-color: white;color: #058;
[log] {OrderRow: } Re-rendered because of props changes:
[startGroup] %cprops.%corder.status%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev order.status: "processing"} !== {next order.status: "on_hold"}
[endGroup] console.groupEnd
[startGroup] %cprops.%corder%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev order: Object} !== {next order: Object}
[endGroup] console.groupEnd
[endGroup] console.groupEnd
[startGroup] %cUnknown background-color: white;color: #058;
[log] {Unknown: } Re-rendered because of props changes:
[startGroup] %cprops.%cchildren%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects that are equal by value. (more info at http://bit.ly/wdyr02)
[log] {prev children: Array(2)} !== {next children: Array(2)}
[log] {For detailed diff, right click the following fn, save as global, and run: : }
[endGroup] console.groupEnd
[startGroup] Rendered by OrdersPage
[endGroup] console.groupEnd
[endGroup] console.groupEnd
[log] whyDidYouRender error in getOwnerDifferences. Please file a bug at https://github.com/welldone-software/why-did-you-render/issues. {errorInfo: Object}
[startGroup] %cOrderRow background-color: white;color: #058;
[log] {OrderRow: } Re-rendered because of props changes:
[startGroup] %cprops.%corder.updatedAt%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev order.updatedAt: "2026-03-02T20:26:24.000Z"} !== {next order.updatedAt: "2026-11-19T04:05:44.425Z"}
[endGroup] console.groupEnd
[startGroup] %cprops.%corder%c background-color: white;color:blue; background-color: white;color:red; background-color: ${wdyrStore.options.textBackgroundColor};color:default;
[log] different objects. (more info at http://bit.ly/wdyr02)
[log] {prev order: Object} !== {next order: Object}
[endGroup] console.groupEnd
[endGroup] console.groupEnd
[exit 0]
````

## agent-react-devtools

````console
## agent-react-devtools 0.5.0: scratch copy .variants/art-m1-ard, vite.config adds reactDevtools({ port: 8221 }) before react(). Daemon state isolated with HOME=/tmp/art-m1/ardhome (shown below as $ARD). Bug present.

$ agent-browser --session art-m1 open 'http://127.0.0.1:5221/orders?status=processing'
✓ Meridian Ops
  http://127.0.0.1:5221/orders?status=processing
[exit 0]

$ env HOME=/tmp/art-m1/ardhome ./node_modules/.bin/agent-react-devtools wait --connected --timeout 20
Timed out waiting for: connected
[exit 1]

$ ../../node_modules/.bin/genie-react call app_reset_backend '{}' --session art-m1 --wait 15000 --fields seed
error unknown_tool: Tool call failed. The selected app advertises no tool named app_reset_backend. Run next to inspect available tools.
next: $ pnpm exec genie-react tools --session art-m1
userActionRequired: true
errorCode: unknown-tool
exit: {code:2,class:usage}
[exit 1]

$ agent-browser --session art-m1 open 'http://127.0.0.1:5221/orders?status=processing'
✓ Meridian Ops
  http://127.0.0.1:5221/orders?status=processing
[exit 0]

$ agent-browser --session art-m1 wait --text 'SO-105979'
✗ Wait timed out after 25000ms
[exit 1]

$ env HOME=/tmp/art-m1/ardhome ./node_modules/.bin/agent-react-devtools status
Daemon: running (port 8221)
Apps: 0 connected, 0 components
Uptime: 56s
[exit 0]

$ env HOME=/tmp/art-m1/ardhome ./node_modules/.bin/agent-react-devtools find OrderRow
No components found
[exit 0]

## agent-react-devtools: restarted after installing react-devtools-core (optional peer) and moving zod 3 out of the app's resolution path

$ agent-browser --session art-m1 open 'http://127.0.0.1:5221/orders?status=processing'
✓ Meridian Ops
  http://127.0.0.1:5221/orders?status=processing&sort=placedAt&dir=desc
[exit 0]

$ env HOME=/tmp/art-m1/ardhome ./node_modules/.bin/agent-react-devtools wait --connected --timeout 20
Condition met: connected
[exit 0]

$ ../../node_modules/.bin/genie-react call app_reset_backend '{}' --session art-m1 --wait 15000 --fields seed
[1]:
  - {seed:20260302}
[exit 0]

$ agent-browser --session art-m1 open 'http://127.0.0.1:5221/orders?status=processing'
✓ Meridian Ops
  http://127.0.0.1:5221/orders?status=processing&sort=placedAt&dir=desc
[exit 0]

$ agent-browser --session art-m1 wait --text 'SO-105979'
SO-105979
[exit 0]

$ env HOME=/tmp/art-m1/ardhome ./node_modules/.bin/agent-react-devtools status
Daemon: running (port 8221)
Apps: 3 connected, 336 components
Uptime: 115s
Last event: app connected 3s ago
[exit 0]

$ env HOME=/tmp/art-m1/ardhome ./node_modules/.bin/agent-react-devtools find OrderRow
@c?(id:229) [memo] Memo(OrderRow) key=o-105999
@c?(id:240) [memo] Memo(OrderRow) key=o-105998
@c?(id:251) [memo] Memo(OrderRow) key=o-105990
@c?(id:262) [memo] Memo(OrderRow) key=o-105979
@c?(id:273) [memo] Memo(OrderRow) key=o-105973
@c?(id:284) [memo] Memo(OrderRow) key=o-105968
@c?(id:295) [memo] Memo(OrderRow) key=o-105958
@c?(id:306) [memo] Memo(OrderRow) key=o-105957
@c?(id:317) [memo] Memo(OrderRow) key=o-105956
@c?(id:328) [memo] Memo(OrderRow) key=o-105944
@c?(id:113) [memo] Memo(OrderRow) key=o-105999
@c?(id:124) [memo] Memo(OrderRow) key=o-105998
@c?(id:135) [memo] Memo(OrderRow) key=o-105990
@c?(id:146) [memo] Memo(OrderRow) key=o-105979
@c?(id:157) [memo] Memo(OrderRow) key=o-105973
@c?(id:168) [memo] Memo(OrderRow) key=o-105968
@c?(id:179) [memo] Memo(OrderRow) key=o-105958
@c?(id:190) [memo] Memo(OrderRow) key=o-105957
@c?(id:201) [memo] Memo(OrderRow) key=o-105956
@c?(id:212) [memo] Memo(OrderRow) key=o-105944
[exit 0]

$ env HOME=/tmp/art-m1/ardhome ./node_modules/.bin/agent-react-devtools profile start hold
Profiling started
[exit 0]

$ bash /tmp/art-m1/hold.sh
✓ Done
✓ Done
SO-105979 updated
[exit 0]

$ env HOME=/tmp/art-m1/ardhome ./node_modules/.bin/agent-react-devtools profile stop
Profile "hold" (2.6s, 10 commits)

Top renders:
  ? [fn] SyncStatus  9 renders
  ? [fn] Checkbox  7 renders
  ? [fRef] ArrowDown  7 renders
  ? [fRef] ForwardRef(Anonymous)  5 renders
  ? [fn] OrdersTable  5 renders
  ? [fn] Checkbox  4 renders
  ? [fn] OrderStatusBadge  4 renders
  ? [fn] PriorityBadge  4 renders
  ? [fRef] ForwardRef(Anonymous)  4 renders
  ? [fRef] Ellipsis  4 renders
[exit 0]

$ env HOME=/tmp/art-m1/ardhome ./node_modules/.bin/agent-react-devtools profile rerenders --limit 10
Most re-renders:
  ? [fn] SyncStatus  9 renders  causes:parent-rendered, props-changed, hooks-changed  changed: props: updatedAt, onRefresh  hooks: #0
  ? [fn] Checkbox  7 renders  causes:parent-rendered, props-changed  changed: props: onChange
  ? [fRef] ArrowDown  7 renders  causes:parent-rendered
  ? [fRef] ForwardRef(Anonymous)  5 renders  causes:parent-rendered
  ? [fn] OrdersTable  5 renders  causes:hooks-changed, props-changed  changed: props: rows, onSortChange  hooks: #24, #19
  ? [fn] Checkbox  4 renders  causes:parent-rendered, props-changed  changed: props: onChange
  ? [fn] OrderStatusBadge  4 renders  causes:parent-rendered, props-changed  changed: props: status
  ? [fn] PriorityBadge  4 renders  causes:parent-rendered
  ? [fRef] ForwardRef(Anonymous)  4 renders  causes:parent-rendered
  ? [fRef] Ellipsis  4 renders  causes:parent-rendered
[exit 0]

$ env HOME=/tmp/art-m1/ardhome ./node_modules/.bin/agent-react-devtools profile rerenders --limit 200
Most re-renders:
  ? [fn] SyncStatus  9 renders  causes:parent-rendered, props-changed, hooks-changed  changed: props: updatedAt, onRefresh  hooks: #0
  ? [fn] Checkbox  7 renders  causes:parent-rendered, props-changed  changed: props: onChange
  ? [fRef] ArrowDown  7 renders  causes:parent-rendered
  ? [fRef] ForwardRef(Anonymous)  5 renders  causes:parent-rendered
  ? [fn] OrdersTable  5 renders  causes:hooks-changed, props-changed  changed: props: rows, onSortChange  hooks: #24, #19
  ? [fn] Checkbox  4 renders  causes:parent-rendered, props-changed  changed: props: onChange
  ? [fn] OrderStatusBadge  4 renders  causes:parent-rendered, props-changed  changed: props: status
  ? [fn] PriorityBadge  4 renders  causes:parent-rendered
  ? [fRef] ForwardRef(Anonymous)  4 renders  causes:parent-rendered
  ? [fRef] Ellipsis  4 renders  causes:parent-rendered
  ? [fn] ActionMenu  4 renders  causes:hooks-changed, props-changed  changed: props: items  hooks: #0
  ? [fRef] ForwardRef(Anonymous)  4 renders  causes:parent-rendered
  ? [fRef] RefreshCw  4 renders  causes:parent-rendered
  ? [memo] Memo(OrderRow)  3 renders  causes:first-mount, props-changed  changed: props: onStatusChange
  ? [fn] Checkbox  3 renders  causes:first-mount, props-changed  changed: props: onChange
  ? [fn] OrderStatusBadge  3 renders  causes:first-mount, parent-rendered
  ? [fn] Badge  3 renders  causes:first-mount, parent-rendered
  ? [fn] PriorityBadge  3 renders  causes:first-mount, parent-rendered
  ? [fn] Badge  3 renders  causes:first-mount, parent-rendered
  ? [fn] ActionMenu  3 renders  causes:first-mount, props-changed  changed: props: items
  ? [fRef] Ellipsis  3 renders  causes:first-mount, parent-rendered
  ? [fRef] ForwardRef(Anonymous)  3 renders  causes:first-mount, parent-rendered
  ? [memo] Memo(OrderRow)  3 renders  causes:first-mount, props-changed  changed: props: onStatusChange
  ? [fn] Checkbox  3 renders  causes:first-mount, props-changed  changed: props: onChange
  ? [fn] OrderStatusBadge  3 renders  causes:first-mount, parent-rendered
  ? [fn] Badge  3 renders  causes:first-mount, parent-rendered
  ? [fn] PriorityBadge  3 renders  causes:first-mount, parent-rendered
  ? [fn] Badge  3 renders  causes:first-mount, parent-rendered
  ? [fn] ActionMenu  3 renders  causes:first-mount, props-changed  changed: props: items
  ? [fRef] Ellipsis  3 renders  causes:first-mount, parent-rendered
  ? [fRef] ForwardRef(Anonymous)  3 renders  causes:first-mount, parent-rendered
  ? [memo] Memo(OrderRow)  3 renders  causes:first-mount, props-changed  changed: props: onStatusChange
  ? [fn] Checkbox  3 renders  causes:first-mount, props-changed  changed: props: onChange
  ? [fn] OrderStatusBadge  3 renders  causes:first-mount, parent-rendered
  ? [fn] Badge  3 renders  causes:first-mount, parent-rendered
  ? [fn] PriorityBadge  3 renders  causes:first-mount, parent-rendered
  ? [fn] Badge  3 renders  causes:first-mount, parent-rendered
  ? [fn] ActionMenu  3 renders  causes:first-mount, props-changed  changed: props: items
  ? [fRef] Ellipsis  3 renders  causes:first-mount, parent-rendered
  ? [fRef] ForwardRef(Anonymous)  3 renders  causes:first-mount, parent-rendered
  ? [fn] PermissionGate  3 renders  causes:props-changed, parent-rendered  changed: props: children
  ? [fRef] ForwardRef(Anonymous)  2 renders  causes:parent-rendered
  ? [fRef] Plus  2 renders  causes:parent-rendered
  ? [fRef] ForwardRef(Anonymous)  2 renders  causes:props-changed  changed: props: children
  ? [memo] Memo(Anonymous)  2 renders  causes:props-changed  changed: props: children
  ? [fRef] ForwardRef(Anonymous)  2 renders  causes:parent-rendered
  ? [fRef] Search  2 renders  causes:parent-rendered
  ? [fn] Input  2 renders  causes:props-changed  changed: props: onChange
  ? [fn] Select  2 renders  causes:props-changed  changed: props: onChange, children
  ? [fn] Select  2 renders  causes:props-changed  changed: props: onChange, children
  ? [fRef] ForwardRef(Anonymous)  2 renders  causes:parent-rendered
  ? [fRef] Rows3  2 renders  causes:parent-rendered
  ? [fn] Button  2 renders  causes:props-changed  changed: props: onClick, children
  ? [fRef] ForwardRef(Anonymous)  2 renders  causes:parent-rendered
  ? [fRef] Columns3  2 renders  causes:parent-rendered
  ? [fn] Button  2 renders  causes:props-changed  changed: props: onClick, children
  ? [fn] OrdersToolbar  2 renders  causes:props-changed  changed: props: onFilterChange
  ? [fn] BulkActionBar  2 renders  causes:parent-rendered
  ? [fn] PermissionGate  2 renders  causes:props-changed  changed: props: children
  ? [fn] Checkbox  2 renders  causes:props-changed  changed: props: onChange
  ? [fn] Badge  2 renders  causes:parent-rendered
  ? [fn] OrderStatusBadge  2 renders  causes:parent-rendered
  ? [fn] Badge  2 renders  causes:parent-rendered
  ? [fn] PriorityBadge  2 renders  causes:parent-rendered
  ? [fRef] ForwardRef(Anonymous)  2 renders  causes:parent-rendered
  ? [fRef] Ellipsis  2 renders  causes:parent-rendered
  ? [fn] ActionMenu  2 renders  causes:props-changed  changed: props: items
  ? [memo] Memo(OrderRow)  2 renders  causes:props-changed  changed: props: onStatusChange
  ? [fn] Checkbox  2 renders  causes:props-changed  changed: props: onChange
  ? [fn] Badge  2 renders  causes:parent-rendered
  ? [fn] OrderStatusBadge  2 renders  causes:parent-rendered
  ? [fn] Badge  2 renders  causes:parent-rendered
  ? [fn] PriorityBadge  2 renders  causes:parent-rendered
  ? [fRef] ForwardRef(Anonymous)  2 renders  causes:parent-rendered
  ? [fRef] Ellipsis  2 renders  causes:parent-rendered
  ? [fn] ActionMenu  2 renders  causes:props-changed  changed: props: items
  ? [memo] Memo(OrderRow)  2 renders  causes:props-changed  changed: props: onStatusChange
  ? [fn] Checkbox  2 renders  causes:props-changed  changed: props: onChange
  ? [fn] Badge  2 renders  causes:parent-rendered
  ? [fn] OrderStatusBadge  2 renders  causes:parent-rendered
  ? [fn] Badge  2 renders  causes:parent-rendered
  ? [fn] PriorityBadge  2 renders  causes:parent-rendered
  ? [fRef] ForwardRef(Anonymous)  2 renders  causes:parent-rendered
  ? [fRef] Ellipsis  2 renders  causes:parent-rendered
  ? [fn] ActionMenu  2 renders  causes:props-changed  changed: props: items
  ? [memo] Memo(OrderRow)  2 renders  causes:props-changed  changed: props: onStatusChange
  ? [fn] Badge  2 renders  causes:props-changed, parent-rendered  changed: props: tone, children
  ? [fn] Badge  2 renders  causes:parent-rendered
  ? [memo] Memo(OrderRow)  2 renders  causes:props-changed  changed: props: order, onStatusChange
  ? [fn] Checkbox  2 renders  causes:props-changed  changed: props: onChange
  ? [fn] Badge  2 renders  causes:parent-rendered
  ? [fn] OrderStatusBadge  2 renders  causes:parent-rendered
  ? [fn] Badge  2 renders  causes:parent-rendered
  ? [fn] PriorityBadge  2 renders  causes:parent-rendered
  ? [fRef] ForwardRef(Anonymous)  2 renders  causes:parent-rendered
  ? [fRef] Ellipsis  2 renders  causes:parent-rendered
  ? [fn] ActionMenu  2 renders  causes:props-changed  changed: props: items
  ? [memo] Memo(OrderRow)  2 renders  causes:props-changed  changed: props: onStatusChange
  ? [fn] Checkbox  2 renders  causes:props-changed  changed: props: onChange
  ? [fn] Badge  2 renders  causes:parent-rendered
  ? [fn] OrderStatusBadge  2 renders  causes:parent-rendered
  ? [fn] Badge  2 renders  causes:parent-rendered
  ? [fn] PriorityBadge  2 renders  causes:parent-rendered
  ? [fRef] ForwardRef(Anonymous)  2 renders  causes:parent-rendered
  ? [fRef] Ellipsis  2 renders  causes:parent-rendered
  ? [fn] ActionMenu  2 renders  causes:props-changed  changed: props: items
  ? [memo] Memo(OrderRow)  2 renders  causes:props-changed  changed: props: onStatusChange
  ? [fn] Checkbox  2 renders  causes:props-changed  changed: props: onChange
  ? [fn] Badge  2 renders  causes:parent-rendered
  ? [fn] OrderStatusBadge  2 renders  causes:parent-rendered
  ? [fn] Badge  2 renders  causes:parent-rendered
  ? [fn] PriorityBadge  2 renders  causes:parent-rendered
  ? [fRef] ForwardRef(Anonymous)  2 renders  causes:parent-rendered
  ? [fRef] Ellipsis  2 renders  causes:parent-rendered
  ? [fn] ActionMenu  2 renders  causes:props-changed  changed: props: items
  ? [memo] Memo(OrderRow)  2 renders  causes:props-changed  changed: props: onStatusChange
  ? [fn] Checkbox  2 renders  causes:props-changed  changed: props: onChange
  ? [fn] Badge  2 renders  causes:parent-rendered
  ? [fn] OrderStatusBadge  2 renders  causes:parent-rendered
  ? [fn] Badge  2 renders  causes:parent-rendered
  ? [fn] PriorityBadge  2 renders  causes:parent-rendered
  ? [fRef] ForwardRef(Anonymous)  2 renders  causes:parent-rendered
  ? [fRef] Ellipsis  2 renders  causes:parent-rendered
  ? [fn] ActionMenu  2 renders  causes:props-changed  changed: props: items
  ? [memo] Memo(OrderRow)  2 renders  causes:props-changed  changed: props: onStatusChange
  ? [fn] Checkbox  2 renders  causes:props-changed  changed: props: onChange
  ? [fn] Badge  2 renders  causes:parent-rendered
  ? [fn] OrderStatusBadge  2 renders  causes:parent-rendered
  ? [fn] Badge  2 renders  causes:parent-rendered
  ? [fn] PriorityBadge  2 renders  causes:parent-rendered
  ? [fRef] ForwardRef(Anonymous)  2 renders  causes:parent-rendered
  ? [fRef] Ellipsis  2 renders  causes:parent-rendered
  ? [fn] ActionMenu  2 renders  causes:props-changed  changed: props: items
  ? [memo] Memo(OrderRow)  2 renders  causes:props-changed  changed: props: onStatusChange
  ? [fn] Checkbox  2 renders  causes:props-changed  changed: props: onChange
  ? [fn] Badge  2 renders  causes:parent-rendered
  ? [fn] OrderStatusBadge  2 renders  causes:parent-rendered
  ? [fn] Badge  2 renders  causes:parent-rendered
  ? [fn] PriorityBadge  2 renders  causes:parent-rendered
  ? [fRef] ForwardRef(Anonymous)  2 renders  causes:parent-rendered
  ? [fRef] Ellipsis  2 renders  causes:parent-rendered
  ? [fn] ActionMenu  2 renders  causes:props-changed  changed: props: items
  ? [memo] Memo(OrderRow)  2 renders  causes:props-changed  changed: props: onStatusChange
  ? [fn] OrdersPage  2 renders  causes:hooks-changed  changed: hooks: #14
  ? [memo] Memo(Anonymous)  1 renders  causes:first-mount
  ? [fRef] ForwardRef(Anonymous)  1 renders  causes:first-mount
  ? [memo] Memo(Anonymous)  1 renders  causes:first-mount
  ? [fRef] ForwardRef(Anonymous)  1 renders  causes:first-mount
  ? [memo] Memo(Anonymous)  1 renders  causes:first-mount
  ? [fRef] ForwardRef(Anonymous)  1 renders  causes:first-mount
  ? [?] CircleCheck  1 renders  causes:first-mount
  ? [?] ForwardRef(Anonymous)  1 renders  causes:first-mount
  ? [?] X  1 renders  causes:first-mount
  ? [?] ForwardRef(Anonymous)  1 renders  causes:first-mount
  ? [fn] Toaster  1 renders  causes:hooks-changed  changed: hooks: #1
[exit 0]

$ env HOME=/tmp/art-m1/ardhome ./node_modules/.bin/agent-react-devtools profile export /tmp/art-m1/ard-before.json
Exported to /tmp/art-m1/ard-before.json
[exit 0]

## agent-react-devtools: AFTER the reference fix applied to the scratch copy

$ ../../node_modules/.bin/genie-react call app_reset_backend '{}' --session art-m1 --wait 15000 --fields seed
[1]:
  - {seed:20260302}
[exit 0]

$ agent-browser --session art-m1 open 'http://127.0.0.1:5221/orders?status=processing'
✓ Meridian Ops
  http://127.0.0.1:5221/orders?status=processing&sort=placedAt&dir=desc
[exit 0]

$ agent-browser --session art-m1 wait --text 'SO-105979'
SO-105979
[exit 0]

$ env HOME=/tmp/art-m1/ardhome ./node_modules/.bin/agent-react-devtools profile start hold-fixed
Profiling started
[exit 0]

$ bash /tmp/art-m1/hold.sh
✓ Done
✓ Done
SO-105979 updated
[exit 0]

$ env HOME=/tmp/art-m1/ardhome ./node_modules/.bin/agent-react-devtools profile stop
Profile "hold-fixed" (2.6s, 10 commits)

Top renders:
  ? [fn] SyncStatus  9 renders
  ? [fn] Checkbox  7 renders
  ? [fRef] ArrowDown  7 renders
  ? [fRef] ForwardRef(Anonymous)  5 renders
  ? [fn] OrdersTable  5 renders
  ? [fn] Checkbox  4 renders
  ? [fn] OrderStatusBadge  4 renders
  ? [fn] PriorityBadge  4 renders
  ? [fRef] ForwardRef(Anonymous)  4 renders
  ? [fRef] Ellipsis  4 renders
[exit 0]

$ env HOME=/tmp/art-m1/ardhome ./node_modules/.bin/agent-react-devtools profile rerenders --limit 200
Most re-renders:
  ? [fn] SyncStatus  9 renders  causes:parent-rendered, props-changed, hooks-changed  changed: props: updatedAt, onRefresh  hooks: #0
  ? [fn] Checkbox  7 renders  causes:parent-rendered, props-changed  changed: props: onChange
  ? [fRef] ArrowDown  7 renders  causes:parent-rendered
  ? [fRef] ForwardRef(Anonymous)  5 renders  causes:parent-rendered
  ? [fn] OrdersTable  5 renders  causes:hooks-changed, props-changed  changed: props: rows, onSortChange  hooks: #24, #19
  ? [fn] Checkbox  4 renders  causes:parent-rendered, props-changed  changed: props: onChange
  ? [fn] OrderStatusBadge  4 renders  causes:parent-rendered, props-changed  changed: props: status
  ? [fn] PriorityBadge  4 renders  causes:parent-rendered
  ? [fRef] ForwardRef(Anonymous)  4 renders  causes:parent-rendered
  ? [fRef] Ellipsis  4 renders  causes:parent-rendered
  ? [fn] ActionMenu  4 renders  causes:hooks-changed, props-changed  changed: props: items  hooks: #0
  ? [fRef] ForwardRef(Anonymous)  4 renders  causes:parent-rendered
  ? [fRef] RefreshCw  4 renders  causes:parent-rendered
  ? [fn] PermissionGate  3 renders  causes:props-changed, parent-rendered  changed: props: children
  ? [fRef] ForwardRef(Anonymous)  2 renders  causes:parent-rendered
  ? [fRef] Plus  2 renders  causes:parent-rendered
  ? [fRef] ForwardRef(Anonymous)  2 renders  causes:props-changed  changed: props: children
  ? [memo] Memo(Anonymous)  2 renders  causes:props-changed  changed: props: children
  ? [fRef] ForwardRef(Anonymous)  2 renders  causes:parent-rendered
  ? [fRef] Search  2 renders  causes:parent-rendered
  ? [fn] Input  2 renders  causes:props-changed  changed: props: onChange
  ? [fn] Select  2 renders  causes:props-changed  changed: props: onChange, children
  ? [fn] Select  2 renders  causes:props-changed  changed: props: onChange, children
  ? [fRef] ForwardRef(Anonymous)  2 renders  causes:parent-rendered
  ? [fRef] Rows3  2 renders  causes:parent-rendered
  ? [fn] Button  2 renders  causes:props-changed  changed: props: onClick, children
  ? [fRef] ForwardRef(Anonymous)  2 renders  causes:parent-rendered
  ? [fRef] Columns3  2 renders  causes:parent-rendered
  ? [fn] Button  2 renders  causes:props-changed  changed: props: onClick, children
  ? [fn] OrdersToolbar  2 renders  causes:props-changed  changed: props: onFilterChange
  ? [fn] BulkActionBar  2 renders  causes:parent-rendered
  ? [fn] PermissionGate  2 renders  causes:props-changed  changed: props: children
  ? [fn] Badge  2 renders  causes:props-changed, parent-rendered  changed: props: tone, children
  ? [fn] Badge  2 renders  causes:parent-rendered
  ? [memo] Memo(OrderRow)  2 renders  causes:props-changed  changed: props: order
  ? [fn] OrdersPage  2 renders  causes:hooks-changed  changed: hooks: #14
  ? [memo] Memo(OrderRow)  1 renders  causes:first-mount
  ? [fn] Checkbox  1 renders  causes:first-mount
  ? [memo] Memo(Anonymous)  1 renders  causes:first-mount
  ? [fRef] ForwardRef(Anonymous)  1 renders  causes:first-mount
  ? [fn] OrderStatusBadge  1 renders  causes:first-mount
  ? [fn] Badge  1 renders  causes:first-mount
  ? [fn] PriorityBadge  1 renders  causes:first-mount
  ? [fn] Badge  1 renders  causes:first-mount
  ? [fn] ActionMenu  1 renders  causes:first-mount
  ? [fRef] Ellipsis  1 renders  causes:first-mount
  ? [fRef] ForwardRef(Anonymous)  1 renders  causes:first-mount
  ? [memo] Memo(OrderRow)  1 renders  causes:first-mount
  ? [fn] Checkbox  1 renders  causes:first-mount
  ? [memo] Memo(Anonymous)  1 renders  causes:first-mount
  ? [fRef] ForwardRef(Anonymous)  1 renders  causes:first-mount
  ? [fn] OrderStatusBadge  1 renders  causes:first-mount
  ? [fn] Badge  1 renders  causes:first-mount
  ? [fn] PriorityBadge  1 renders  causes:first-mount
  ? [fn] Badge  1 renders  causes:first-mount
  ? [fn] ActionMenu  1 renders  causes:first-mount
  ? [fRef] Ellipsis  1 renders  causes:first-mount
  ? [fRef] ForwardRef(Anonymous)  1 renders  causes:first-mount
  ? [memo] Memo(OrderRow)  1 renders  causes:first-mount
  ? [fn] Checkbox  1 renders  causes:first-mount
  ? [memo] Memo(Anonymous)  1 renders  causes:first-mount
  ? [fRef] ForwardRef(Anonymous)  1 renders  causes:first-mount
  ? [fn] OrderStatusBadge  1 renders  causes:first-mount
  ? [fn] Badge  1 renders  causes:first-mount
  ? [fn] PriorityBadge  1 renders  causes:first-mount
  ? [fn] Badge  1 renders  causes:first-mount
  ? [fn] ActionMenu  1 renders  causes:first-mount
  ? [fRef] Ellipsis  1 renders  causes:first-mount
  ? [fRef] ForwardRef(Anonymous)  1 renders  causes:first-mount
  ? [fRef] CircleCheck  1 renders  causes:first-mount
  ? [fRef] ForwardRef(Anonymous)  1 renders  causes:first-mount
  ? [fRef] X  1 renders  causes:first-mount
  ? [fRef] ForwardRef(Anonymous)  1 renders  causes:first-mount
  ? [fn] Toaster  1 renders  causes:hooks-changed  changed: hooks: #1
[exit 0]

$ env HOME=/tmp/art-m1/ardhome ./node_modules/.bin/agent-react-devtools profile export /tmp/art-m1/ard-after.json
Exported to /tmp/art-m1/ard-after.json
[exit 0]

$ env HOME=/tmp/art-m1/ardhome ./node_modules/.bin/agent-react-devtools profile diff /tmp/art-m1/ard-before.json /tmp/art-m1/ard-after.json --limit 15
Before: 10 commits, 40.9ms total
After:  10 commits, 18.8ms total
Delta:  -22.1ms (-54%)

Regressed (11):
  PriorityBadge                  avg:    0.0ms ->    0.1ms   +101%  renders: 31 -> 7
  Checkbox                       avg:    0.0ms ->    0.0ms    +94%  renders: 38 -> 14
  Search                         avg:    0.2ms ->    0.3ms    +67%  renders: 2 -> 2
  Columns3                       avg:    0.2ms ->    0.3ms    +67%  renders: 2 -> 2
  ForwardRef(Anonymous)          avg:    0.1ms ->    0.2ms    +26%  renders: 53 -> 31
  Plus                           avg:    0.2ms ->    0.3ms    +25%  renders: 2 -> 2
  ArrowDown                      avg:    0.1ms ->    0.1ms    +25%  renders: 7 -> 7
  Memo(Anonymous)                avg:    0.1ms ->    0.1ms    +17%  renders: 5 -> 5
  Button                         avg:    0.2ms ->    0.3ms    +11%  renders: 4 -> 4
  Ellipsis                       avg:    0.1ms ->    0.1ms    +11%  renders: 31 -> 7
  Badge                          avg:    0.0ms ->    0.0ms     +5%  renders: 58 -> 10

Improved (10):
  OrderStatusBadge               avg:    0.1ms ->    0.0ms   -100%  renders: 31 -> 7
  Input                          avg:    0.1ms ->    0.0ms   -100%  renders: 2 -> 2
  BulkActionBar                  avg:    0.1ms ->    0.0ms   -100%  renders: 2 -> 2
  OrdersTable                    avg:    5.3ms ->    1.7ms    -68%  renders: 5 -> 5
  OrdersPage                     avg:   14.2ms ->    5.2ms    -63%  renders: 2 -> 2
  SyncStatus                     avg:    1.0ms ->    0.5ms    -54%  renders: 9 -> 9
  RefreshCw                      avg:    0.5ms ->    0.3ms    -47%  renders: 4 -> 4
  PermissionGate                 avg:    0.2ms ->    0.1ms    -12%  renders: 5 -> 5
  ActionMenu                     avg:    0.2ms ->    0.2ms    -10%  renders: 31 -> 7
  Toaster                        avg:    2.2ms ->    2.0ms     -9%  renders: 1 -> 1

New (2):
  CircleCheck                    avg:        - ->    0.8ms          renders: - -> 1
  X                              avg:        - ->    0.5ms          renders: - -> 1
[exit 0]

$ env HOME=/tmp/art-m1/ardhome ./node_modules/.bin/agent-react-devtools profile diff /tmp/art-m1/ard-before.json /tmp/art-m1/ard-after.json --limit 100 --threshold 0
Before: 10 commits, 40.9ms total
After:  10 commits, 18.8ms total
Delta:  -22.1ms (-54%)

Regressed (12):
  PriorityBadge                  avg:    0.0ms ->    0.1ms   +101%  renders: 31 -> 7
  Checkbox                       avg:    0.0ms ->    0.0ms    +94%  renders: 38 -> 14
  Search                         avg:    0.2ms ->    0.3ms    +67%  renders: 2 -> 2
  Columns3                       avg:    0.2ms ->    0.3ms    +67%  renders: 2 -> 2
  ForwardRef(Anonymous)          avg:    0.1ms ->    0.2ms    +26%  renders: 53 -> 31
  Plus                           avg:    0.2ms ->    0.3ms    +25%  renders: 2 -> 2
  ArrowDown                      avg:    0.1ms ->    0.1ms    +25%  renders: 7 -> 7
  Memo(Anonymous)                avg:    0.1ms ->    0.1ms    +17%  renders: 5 -> 5
  Button                         avg:    0.2ms ->    0.3ms    +11%  renders: 4 -> 4
  Ellipsis                       avg:    0.1ms ->    0.1ms    +11%  renders: 31 -> 7
  Badge                          avg:    0.0ms ->    0.0ms     +5%  renders: 58 -> 10
  OrdersToolbar                  avg:    1.4ms ->    1.5ms     +3%  renders: 2 -> 2

Improved (11):
  OrderStatusBadge               avg:    0.1ms ->    0.0ms   -100%  renders: 31 -> 7
  Input                          avg:    0.1ms ->    0.0ms   -100%  renders: 2 -> 2
  BulkActionBar                  avg:    0.1ms ->    0.0ms   -100%  renders: 2 -> 2
  OrdersTable                    avg:    5.3ms ->    1.7ms    -68%  renders: 5 -> 5
  OrdersPage                     avg:   14.2ms ->    5.2ms    -63%  renders: 2 -> 2
  SyncStatus                     avg:    1.0ms ->    0.5ms    -54%  renders: 9 -> 9
  RefreshCw                      avg:    0.5ms ->    0.3ms    -47%  renders: 4 -> 4
  PermissionGate                 avg:    0.2ms ->    0.1ms    -12%  renders: 5 -> 5
  ActionMenu                     avg:    0.2ms ->    0.2ms    -10%  renders: 31 -> 7
  Toaster                        avg:    2.2ms ->    2.0ms     -9%  renders: 1 -> 1
  Memo(OrderRow)                 avg:    0.8ms ->    0.7ms     -4%  renders: 29 -> 5

New (2):
  CircleCheck                    avg:        - ->    0.8ms          renders: - -> 1
  X                              avg:        - ->    0.5ms          renders: - -> 1
[exit 0]
````

## Chrome DevTools MCP

````console
## Chrome DevTools MCP (chrome-devtools CLI from chrome-devtools-mcp@latest), attached to the art-m1 agent-browser Chrome over CDP. Main dashboard dev server (shipped code) on 5221. State isolated with HOME=/tmp/art-m1/cdmhome (shown as $CDM).

$ /tmp/art-m1/cdm/node_modules/.bin/chrome-devtools --version
1.13.0
[exit 0]

$ agent-browser --session art-m1 open 'http://127.0.0.1:5221/orders?status=processing'
✓ Meridian Ops
  http://127.0.0.1:5221/orders?status=processing&sort=placedAt&dir=desc
[exit 0]

$ npx genie-react status --session art-m1 --wait 15000 --select /ready
status: ok
selection: {expression:/ready,matchedPathCount:1,matchedPaths:[/ready],omittedPathCount:54}
result: true
[exit 0]

$ npx genie-react call app_reset_backend '{}' --session art-m1 --fields seed
[1]:
  - {seed:20260302}
[exit 0]

$ agent-browser --session art-m1 open 'http://127.0.0.1:5221/orders?status=processing'
✓ Meridian Ops
  http://127.0.0.1:5221/orders?status=processing&sort=placedAt&dir=desc
[exit 0]

$ agent-browser --session art-m1 wait --text 'SO-105979'
SO-105979
[exit 0]

$ env HOME=/tmp/art-m1/cdmhome /tmp/art-m1/cdm/node_modules/.bin/chrome-devtools start --wsEndpoint ws://127.0.0.1:54183/devtools/browser/94f26190-60c6-445d-8a62-52b5567626f4 --no-usage-statistics --no-performance-crux
chrome-devtools-mcp exposes content of the browser instance to the MCP clients allowing them to inspect,
debug, and modify any data in the browser or DevTools.
Avoid sharing sensitive or personal information that you do not want to share with MCP clients.
[exit 0]

$ env HOME=/tmp/art-m1/cdmhome /tmp/art-m1/cdm/node_modules/.bin/chrome-devtools list_pages
## Pages
1: Meridian Ops (http://127.0.0.1:5221/orders?status=processing&sort=placedAt&dir=desc) [selected]
2: New Tab (chrome://newtab/)
[exit 0]

$ env HOME=/tmp/art-m1/cdmhome /tmp/art-m1/cdm/node_modules/.bin/chrome-devtools performance_start_trace 1 --reload=false --autoStop=false
The performance trace is being recorded. Use performance_stop_trace to stop it.
[exit 0]

$ bash /tmp/art-m1/hold.sh
✓ Done
✓ Done
SO-105979 updated
[exit 0]

$ env HOME=/tmp/art-m1/cdmhome /tmp/art-m1/cdm/node_modules/.bin/chrome-devtools performance_stop_trace 1 --filePath /tmp/art-m1/cdm-trace.json.gz
The raw trace data was saved to /private/tmp/art-m1/cdm-trace.json.gz.
The performance trace has been stopped.
## Summary of Performance trace findings:
URL: http://127.0.0.1:5221/orders?status=processing&sort=placedAt&dir=desc
Trace bounds: {min: 319164846773µs, max: 319167462760µs}
CPU throttling: 1x
Network throttling: none

# Available insight sets

The following is a list of insight sets. An insight set covers a specific part of the trace, split by navigations. The insights within each insight set are specific to that part of the trace. Be sure to consider the insight set id and bounds when calling functions. If no specific insight set or navigation is mentioned, assume the user is referring to the first one.

## insight set id: NO_NAVIGATION

URL: http://127.0.0.1:5221/orders?status=processing&sort=placedAt&dir=desc
Bounds: {min: 319164846773µs, max: 319167462760µs}
Metrics (lab / observed):
  - INP: 28 ms, event: (eventKey: s-47461, ts: 319165916862)
  - CLS: 0.00
Metrics (field / real users): n/a – no data for this page in CrUX
Available insights:
  - insight name: INPBreakdown
    description: Start investigating [how to improve INP](https://developer.chrome.com/docs/performance/insights/inp-breakdown) by looking at the longest subpart
    relevant trace bounds: {min: 319165916862µs, max: 319165945147µs}
    example question: Suggest fixes for my longest interaction
    example question: Why is a large INP score problematic?
    example question: What's the biggest contributor to my longest interaction?

# Custom tracks

The following is a list of custom tracks or track groups from the extensibility API.

## Group: Scheduler ⚛

  - Track: Blocking
  - Track: Transition
  - Track: Suspense
  - Track: Idle

## Track: Components ⚛


## Details on call tree & network request formats:
Information on performance traces may contain main thread activity represented as call frames and network requests.

Each call frame is presented in the following format:

'id;eventKey;name;duration;selfTime;urlIndex;childRange;[line];[column];[S]'

Key definitions:

* id: A unique numerical identifier for the call frame. Never mention this id in the output to the user.
* eventKey: String that uniquely identifies this event in the flame chart.
* name: A concise string describing the call frame (e.g., 'Evaluate Script', 'render', 'fetchData').
* duration: The total execution time of the call frame, including its children.
* selfTime: The time spent directly within the call frame, excluding its children's execution.
* urlIndex: Index referencing the "All URLs" list. Empty if no specific script URL is associated.
* childRange: Specifies the direct children of this node using their IDs. If empty ('' or 'S' at the end), the node has no children. If a single number (e.g., '4'), the node has one child with that ID. If in the format 'firstId-lastId' (e.g., '4-5'), it indicates a consecutive range of child IDs from 'firstId' to 'lastId', inclusive.
* line: An optional field for a call frame's line number. This is where the function is defined.
* column: An optional field for a call frame's column number. This is where the function is defined.
* S: _Optional_. The letter 'S' terminates the line if that call frame was selected by the user.

Example Call Tree:

1;r-123;main;500;100;0;1;;
2;r-124;update;200;50;;3;0;1;
3;p-49575-15428179-2834-374;animate;150;20;0;4-5;0;1;S
4;p-49575-15428179-3505-1162;calculatePosition;80;80;0;1;;
5;p-49575-15428179-5391-2767;applyStyles;50;50;0;1;;


Network requests are formatted like this:
`urlIndex;eventKey;queuedTime;requestSentTime;downloadCompleteTime;processingCompleteTime;totalDuration;downloadDuration;mainThreadProcessingDuration;statusCode;mimeType;priority;initialPriority;finalPriority;renderBlocking;protocol;fromServiceWorker;initiators;redirects:[[redirectUrlIndex|startTime|duration]];responseHeaders:[header1Value|header2Value|...]`

- `urlIndex`: Numerical index for the request's URL, referencing the "All URLs" list.
- `eventKey`: String that uniquely identifies this request's trace event.
Timings (all in milliseconds, relative to navigation start):
- `queuedTime`: When the request was queued.
- `requestSentTime`: When the request was sent.
- `downloadCompleteTime`: When the download completed.
- `processingCompleteTime`: When main thread processing finished.
Durations (all in milliseconds):
- `totalDuration`: Total time from the request being queued until its main thread processing completed.
- `downloadDuration`: Time spent actively downloading the resource.
- `mainThreadProcessingDuration`: Time spent on the main thread after the download completed.
- `statusCode`: The HTTP status code of the response (e.g., 200, 404).
- `mimeType`: The MIME type of the resource (e.g., "text/html", "application/javascript").
- `priority`: The final network request priority (e.g., "VeryHigh", "Low").
- `initialPriority`: The initial network request priority.
- `finalPriority`: The final network request priority (redundant if `priority` is always final, but kept for clarity if `initialPriority` and `priority` differ).
- `renderBlocking`: 't' if the request was render-blocking, 'f' otherwise.
- `protocol`: The network protocol used (e.g., "h2", "http/1.1").
- `fromServiceWorker`: 't' if the request was served from a service worker, 'f' otherwise.
- `initiators`: A list (separated by ,) of URL indices for the initiator chain of this request. Listed in order starting from the root request to the request that directly loaded this one. This represents the network dependencies necessary to load this request. If there is no initiator, this is empty.
- `redirects`: A comma-separated list of redirects, enclosed in square brackets. Each redirect is formatted as
`[redirectUrlIndex|startTime|duration]`, where: `redirectUrlIndex`: Numerical index for the redirect's URL. `startTime`: The start time of the redirect in milliseconds, relative to navigation start. `duration`: The duration of the redirect in milliseconds.
- `responseHeaders`: A list (separated by '|') of values for specific, pre-defined response headers, enclosed in square brackets.
The order of headers corresponds to an internal fixed list. If a header is not present, its value will be empty.

[exit 0]

$ env HOME=/tmp/art-m1/cdmhome /tmp/art-m1/cdm/node_modules/.bin/chrome-devtools performance_analyze_insight 1 NO_NAVIGATION INPBreakdown
## Insight Title: INP breakdown

## Insight Summary:
Interaction to Next Paint (INP) is a metric that tracks the responsiveness of the page when the user interacts with it. INP is a Core Web Vital and the thresholds for how we categorize a score are:
- Good: 200 milliseconds or less.
- Needs improvement: more than 200 milliseconds and 500 milliseconds or less.
- Bad: over 500 milliseconds.

For a given slow interaction, we can break it down into 3 subparts:
1. Input delay: starts when the user initiates an interaction with the page, and ends when the event callbacks for the interaction begin to run.
2. Processing duration: the time it takes for the event callbacks to run to completion.
3. Presentation delay: the time it takes for the browser to present the next frame which contains the visual result of the interaction.

The sum of these three subparts is the total latency. It is important to optimize each of these subparts to ensure interactions take as little time as possible. Focusing on the subpart that has the largest score is a good way to start optimizing.

## Detailed analysis:
The longest interaction on the page was a `pointerdown` which had a total duration of `28 ms`. The timings of each of the three subparts were:

1. Input delay: 9 ms
2. Processing duration: 4 ms
3. Presentation delay: 15 ms.

## Estimated savings: none

## External resources:
- https://developer.chrome.com/docs/performance/insights/inp-breakdown
- https://web.dev/articles/inp
- https://web.dev/explore/how-to-optimize-inp
- https://web.dev/articles/optimize-long-tasks
- https://web.dev/articles/avoid-large-complex-layouts-and-layout-thrashing
[exit 0]

$ env HOME=/tmp/art-m1/cdmhome /tmp/art-m1/cdm/node_modules/.bin/chrome-devtools stop
[exit 0]
````

## Re-run on Genie 1.1.0

- Date: 2026-11-19 (log timestamps are local time, UTC+3)
- Commit: `ce408cb205c0e798cb04c35512772b7454283141`
- App: `apps/realworld-dashboard` (Meridian Ops, React 19.3.1 in StrictMode), dev server `DASHBOARD_PORT=5243 pnpm exec vite --port 5243 --strictPort`, URL `http://127.0.0.1:5243/orders?status=processing`
- Genie: workspace build of `genie-react` and `@genie-react/cli` 1.1.0 at that commit (`pnpm install && pnpm build`). `node_modules/.bin/genie-react --version` in the app printed `1.1.0`.
- Browser driver: agent-browser 0.43.0, session `upd-g`, headless. The Genie session is the same name.
- Only Genie was re-run. The other tools' sections above are unchanged.

Every command ran through a wrapper that appended the command, its combined stdout and stderr, and its exit code to the log. A `| head` inside a command line is part of the command that ran. Lines starting with `=====` or `##` are notes written at the time. The home directory is shown as `~`. Nothing else is edited.

The interaction is `/tmp/upd-g/hold.sh`, the same three agent-browser commands as above with session `upd-g` (printed in the log). Reads after the interaction wait with `devtools_wait` condition `settled` and `"domains":["react","query","router"]`, as the 1.1.0 skill says, instead of `react_quiesce`. The reference fix from `evals/realworld/dashboard/order-hold-rerenders-all-rows.json` was applied with `/tmp/upd-g/applyfix.mjs` (it replaces each `referenceFix` `find` string once) and reverted with `git checkout`.

````text
# HEAD: ce408cb205c0e798cb04c35512772b7454283141
## Genie: diagnose. Put SO-105979 on hold (shipped code)

[12:00:52] $ npx genie-react --version
1.1.0
[exit 0]

[12:00:53] $ cat /tmp/upd-g/hold.sh
agent-browser --session upd-g find role button click --name 'Actions for SO-105979'
agent-browser --session upd-g find role menuitem click --name 'Put on hold'
agent-browser --session upd-g wait --text 'SO-105979 updated'
[exit 0]

[12:00:53] $ npx genie-react call app_reset_backend '{}' --session upd-g --fields seed
[1]:
  - {seed:20260302}
[exit 0]

[12:00:54] $ agent-browser --session upd-g open 'http://127.0.0.1:5243/orders?status=processing'
✓ Meridian Ops
  http://127.0.0.1:5243/orders?status=processing&sort=placedAt&dir=desc
[exit 0]

[12:00:54] $ agent-browser --session upd-g wait --text 'SO-105979'
SO-105979
[exit 0]

[12:00:54] $ npx genie-react call devtools_wait '{"condition":"settled","domains":["react","query","router"],"timeoutMs":10000}' --fail-on-result-error --session upd-g | head -3
ok: true
condition: settled
waitedMs: 1081
[exit 0]

[12:00:56] $ npx genie-react call react_clear_renders '{"component":"OrderRow"}' --session upd-g
ok: true
tracking: true
documentCommitId: 9
observation: {id:observation:1,epoch:1,startedAfterDocumentCommitId:9}
observationConfig:
  adaptive: true
  adaptiveScale: 1
  fiberLimit: 250
  operationLimit: 30000
  timeLimitMs: 12
  targetOperationReserve: 4000
  targetTimeReserveMs: 4
  lifecycleBufferLimit: 1000
  lifecycleTargetReserve: 100
strictMode: on
[exit 0]

[12:00:56] $ bash /tmp/upd-g/hold.sh
✓ Done
✓ Done
SO-105979 updated
[exit 0]

[12:00:57] $ npx genie-react call devtools_wait '{"condition":"settled","domains":["react","query","router"],"timeoutMs":10000}' --fail-on-result-error --session upd-g
ok: true
condition: settled
waitedMs: 796
validConditions: [connected,ready,component,query-settled,navigation,react-quiet,settled]
lastObserved:
  react:
    documentCommitId: 18
    renderCollection: available
    quietForMs: 616
    requiredQuietMs: 500
    pendingWork: {documentCommitId:18,scheduledRoots:0,suspendedBoundaries:0,dehydratedBoundaries:0,boundaries:[],scanTruncated:false,scannedFibers:729}
  query: {fetching:0,mutating:0}
  router: {pathname:/orders,isLoading:false,settled:true,pendingWork:[],settlement:router-settled}
domains:
  react:
    status: met
    lastObserved: {documentCommitId:18,renderCollection:available,quietForMs:616,requiredQuietMs:500,pendingWork:{documentCommitId:18,scheduledRoots:0,suspendedBoundaries:0,dehydratedBoundaries:0,boundaries:[],scanTruncated:false,scannedFibers:729}}
  query: {status:met,lastObserved:{fetching:0,mutating:0}}
  router:
    status: met
    lastObserved: {pathname:/orders,isLoading:false,settled:true,pendingWork:[],settlement:router-settled}
[exit 0]

[12:01:04] $ npx genie-react call react_component_cohort '{"component":"OrderRow"}' --session upd-g
attribution:
  status: current
  startedAtDocumentCommitId: 25
  completedAtDocumentCommitId: 25
  startedAtAnalysisGeneration: 26
  completedAtAnalysisGeneration: 26
documentCommitId: 25
ownershipCoverage:
  complete: true
  totalCandidates: 13
  app: 13
  library: 0
  unknown: 0
  affects: ownership-labels
observation: {id:observation:1,epoch:1,startedAfterDocumentCommitId:9}
query: {component:OrderRow,exact:true}
componentMatch:
  component: OrderRow
  exact: true
  status: matched
  matchedNames: [OrderRow]
  matchedNameCount: 1
  similarNames: []
status: updated
matched: 13
mountedUpdated: 13
mountedIdle: 0
mountedUnknown: 0
unmounted: 0
returned: 13
omittedByLimit: 0
rendererBundle: development
coverage:
  complete: true
  freezeDetection: disabled
  scannedFibers: 715
  scanLimit: 20000
  scanTruncated: false
  rootAvailable: true
  rootCount: 1
  scannedRootCount: 1
  rootLimit: 100
  rootScope: committed
  rootScopeComplete: true
  rootScopeTruncated: false
  inputAttributionComplete: true
  skippedCommitFibers: 0
  droppedUnmountFibers: 0
  analysisFailedFibers: 0
  pausedCommits: 0
  unobservedCommits: 0
  refreshCommitsExcluded: 0
  truncatedInputFibers: 0
  propsNotEnumeratedFibers: 0
  budgetExhaustedCommits: 0
  budgetExhaustedSubsystems: []
  generationHistoryEvictions: 0
view: summary
shared:
  logicalPathPrefix: "QueryClientProvider[index=0] > AuthProvider[index=0] > App[index=0] > RouterProvider[index=0] > RouterContextProvider[index=0] > Matches[index=0] > MatchesInner[index=0] > CatchBoundary[index=0] > MatchImpl[index=0] > MatchView[index=0] > CatchBoundary[index=0] > CatchNotFound[index=0] > CatchBoundary[index=0] > MatchInnerImpl[index=0] > RootLayout[index=0] > OutletImpl[index=0] > MatchImpl[index=0] > MatchView[index=0] > CatchBoundary[index=0] > MatchInnerImpl[index=0] > Lazy[index=0] > AuthenticatedLayout[index=0] > PermissionsProvider[index=0] > AppShell[index=0] > PreferencesProvider[index=0] > <div>[index=0] > <div>[index=1] > <main>[index=1] > OutletImpl[index=0] > MatchImpl[index=0] > MatchView[index=0] > CatchBoundary[index=0] > MatchInnerImpl[index=0] > Lazy[index=0] > OrdersPage[index=0] > <div>[index=0] > OrdersTable[index=3] > <div>[index=0] > <div>[index=1] > <div>[index=0]"
  componentName: OrderRow
  sourceOwnership: app
  source: /src/features/orders/orders-table.tsx:121:17
  parent: {fiberId:13713092378682,name:OrdersTable,key:null}
  keyedParent: null
  logicalIdentityEvidence: keyed
  mountGenerationEvidence: exact
  renderingState: mounted-rendering
  reactVisibility: not-hidden
instances[13]:
  each: {status:mounted-updated,mountGeneration:1,hostSelector:div.absolute.inset-x-0.flex}
  - {mountId:mount:38,fiberId:13713092378687,key:o-105999,siblingIndex:0,logicalPath:"OrderRow[key=\"o-105999\"]"}
  - {mountId:mount:39,fiberId:13713092378688,key:o-105998,siblingIndex:1,logicalPath:"OrderRow[key=\"o-105998\"]"}
  - {mountId:mount:40,fiberId:13713092378689,key:o-105990,siblingIndex:2,logicalPath:"OrderRow[key=\"o-105990\"]"}
  - {mountId:mount:41,fiberId:13713092378690,key:o-105979,siblingIndex:3,logicalPath:"OrderRow[key=\"o-105979\"]"}
  - {mountId:mount:42,fiberId:13713092378708,key:o-105973,siblingIndex:4,logicalPath:"OrderRow[key=\"o-105973\"]"}
  - {mountId:mount:43,fiberId:13713092378709,key:o-105968,siblingIndex:5,logicalPath:"OrderRow[key=\"o-105968\"]"}
  - {mountId:mount:44,fiberId:13713092378710,key:o-105958,siblingIndex:6,logicalPath:"OrderRow[key=\"o-105958\"]"}
  - {mountId:mount:45,fiberId:13713092378711,key:o-105957,siblingIndex:7,logicalPath:"OrderRow[key=\"o-105957\"]"}
  - {mountId:mount:46,fiberId:13713092378712,key:o-105956,siblingIndex:8,logicalPath:"OrderRow[key=\"o-105956\"]"}
  - {mountId:mount:47,fiberId:13713092378713,key:o-105944,siblingIndex:9,logicalPath:"OrderRow[key=\"o-105944\"]"}
  - {mountId:mount:4,fiberId:13713092378745,key:o-105918,siblingIndex:10,logicalPath:"OrderRow[key=\"o-105918\"]"}
  - {mountId:mount:5,fiberId:13713092378779,key:o-105917,siblingIndex:11,logicalPath:"OrderRow[key=\"o-105917\"]"}
  - {mountId:mount:6,fiberId:13713092378813,key:o-105915,siblingIndex:12,logicalPath:"OrderRow[key=\"o-105915\"]"}
[exit 0]

[12:01:04] $ npx genie-react call react_render_causes '{"component":"OrderRow","limit":3}' --session upd-g
componentMatch:
  component: OrderRow
  exact: true
  status: matched
  matchedNames: [OrderRow]
  matchedNameCount: 1
  similarNames: []
tracking: true
commits: 17
documentCommitId: 26
observation: {id:observation:1,epoch:1,startedAfterDocumentCommitId:9}
attribution:
  status: current
  startedAtDocumentCommitId: 26
  completedAtDocumentCommitId: 26
  startedAtAnalysisGeneration: 27
  completedAtAnalysisGeneration: 27
view: summary
events[3] (componentName #componentId {fields}, then ← kind evidence name {fields} per cause):
  each: {documentCommitId:17,necessity:unknown,necessityReason:callbacks-changed,inputEvidence:changed,source:{location:/src/features/orders/orders-table.tsx:121:17,role:element-callsite,ownership:app}}
  OrderRow #13713092378813 {renderEventId:render:17:241,mountId:mount:6,key:o-105915}
    ← props exact onStatusChange
  OrderRow #13713092378779 {renderEventId:render:17:240,mountId:mount:5,key:o-105917}
    ← props exact onStatusChange
  OrderRow #13713092378745 {renderEventId:render:17:239,mountId:mount:4,key:o-105918}
    ← props exact onStatusChange
omittedByLimit: 26
sourceClassification:
  complete: true
  affects: result
  totalCandidates: 29
  evaluated: 29
  app: 29
  library: 0
  unknown: 0
  unknownComponents: []
  unknownComponentsOmitted: 0
renderEventRetention: {evictedEvents:0,earliestDocumentCommitId:10,latestDocumentCommitId:26}
coverage:
  skippedCommitFibers: 0
  droppedUnmountFibers: 0
  analysisFailedFibers: 0
  pausedCommits: 0
  unobservedCommits: 0
  refreshCommitsExcluded: 0
  truncatedInputFibers: 0
  propsNotEnumeratedFibers: 0
  budgetExhaustedCommits: 0
  budgetExhaustedSubsystems: []
  complete: true
  inputAttributionComplete: true
  semantics: exact
  coverageDomain: render-causality
  droppedRenderEvents: 0
[exit 0]

## Genie: verify BEFORE the fix (shipped code)

[12:01:11] $ npx genie-react call app_reset_backend '{}' --session upd-g --fields seed
[1]:
  - {seed:20260302}
[exit 0]

[12:01:12] $ agent-browser --session upd-g open 'http://127.0.0.1:5243/orders?status=processing'
✓ Meridian Ops
  http://127.0.0.1:5243/orders?status=processing&sort=placedAt&dir=desc
[exit 0]

[12:01:12] $ agent-browser --session upd-g wait --text 'SO-105979'
SO-105979
[exit 0]

[12:01:12] $ npx genie-react call devtools_wait '{"condition":"settled","domains":["react","query","router"],"timeoutMs":10000}' --fail-on-result-error --session upd-g | head -3
ok: true
condition: settled
waitedMs: 1231
[exit 0]

[12:01:14] $ npx genie-react verify begin --session upd-g --name 'put one order on hold' --claim 'render OrderRow only props.order,mount' --claim 'render OrderRow min 1' --claim 'boundaries clean'
recording vfy_673952a4-e627-4f4c-b938-f894742abd3a "put one order on hold"
  url "http://127.0.0.1:5243/orders?status=processing&sort=placedAt&dir=desc"
  1 recording render OrderRow only props.order,mount
  2 recording render OrderRow min 1
  3 recording boundaries clean
window: {observationId:observation:1,startDocumentCommitId:9,domains:[react,query,router,network],quietMs:500,timeoutMs:10000,tailMs:500}
next: $ npx genie-react verify end vfy_673952a4-e627-4f4c-b938-f894742abd3a --session upd-g
session: {sessionId:56f33efa-4985-4b3e-b184-300f345f2786,logicalSessionId:6afe88d7-ca8f-4853-b709-88daca657184,documentGeneration:13}
schemaVersion: "1.0"
targets: [{target:{component:OrderRow},status:resolved,instances:10,source:/src/features/orders/orders-table.tsx}]
startedAt: 2026-11-19T09:01:14.924Z
expiresAt: 2026-11-19T09:06:14.934Z
request: {budget:{fiberLimit:250,operationLimit:20000,timeLimitMs:8,targetOperationReserve:4000,targetTimeReserveMs:4,adaptive:true},settle:{quietMs:500,timeoutMs:10000},maxDurationMs:300000,allowOverrides:false}
[exit 0]

[12:01:14] $ bash /tmp/upd-g/hold.sh
✓ Done
✓ Done
SO-105979 updated
[exit 0]

[12:01:15] $ npx genie-react verify end vfy_673952a4-e627-4f4c-b938-f894742abd3a --session upd-g
fail vfy_673952a4-e627-4f4c-b938-f894742abd3a "put one order on hold"  10 commits, quiet after 830 ms (react, query, router, network)
  url "http://127.0.0.1:5243/orders?status=processing&sort=placedAt&dir=desc"
  1 fail render OrderRow only props.order,mount  {renders:29,events:29,violatingEvents:26,causes:[mount,props.onStatusChange,props.order]}
      claim: {kind:render-causes,target:{component:OrderRow},allow:[{kind:props,name:order},{kind:mount}]}
      deciding: [{kind:render-event,renderEventId:render:17:241,documentCommitId:17,mountId:mount:16,causes:[{cause:props.onStatusChange,evidence:exact}]},{kind:render-event,renderEventId:render:17:240,documentCommitId:17,mountId:mount:15,causes:[{cause:props.onStatusChange,evidence:exact}]},{kind:render-event,renderEventId:render:17:239,documentCommitId:17,mountId:mount:14,causes:[{cause:props.onStatusChange,evidence:exact}]}]
  2 pass render OrderRow min 1  {renders:29,mounts:3,updates:26,remounts:0,semantics:exact,instances:13,activeInstances:13}
      claim: {kind:renders,target:{component:OrderRow},min:1,counting:renders,allowRemount:false}
      deciding: [{kind:instance,mountId:mount:14,key:o-105918,renders:3,mounts:1,updates:2,mountGeneration:1,latestDocumentCommitId:17,source:/src/features/orders/orders-table.tsx:121:17},{kind:instance,mountId:mount:15,key:o-105917,renders:3,mounts:1,updates:2,mountGeneration:1,latestDocumentCommitId:17,source:/src/features/orders/orders-table.tsx:121:17},{kind:instance,mountId:mount:16,key:o-105915,renders:3,mounts:1,updates:2,mountGeneration:1,latestDocumentCommitId:17,source:/src/features/orders/orders-table.tsx:121:17}]
  3 pass boundaries clean  {caughtDuringWindow:0,caughtAtEnd:0}
      claim: {kind:boundaries-clean,scope:window}
      deciding: [{kind:boundary-log,scope:window,complete:true,afterDocumentCommitId:9}]
      caveats: [uncaught-errors-outside-boundaries-unobserved]
window: {observationId:observation:1,startDocumentCommitId:9,settledDocumentCommitId:18,frozenDocumentCommitId:19,commits:10,settle:{outcome:met,quietMs:500,timeoutMs:10000,waitedMs:830,domains:{react:met,query:met,router:met,network:met}},tail:{ms:500,commits:1},environment:{bundle:development,strictMode:on,renderCollection:available,visibility:document}}
! ui-outcome-not-observed: Genie does not check the screen; confirm it with the UI driver
attempt 1 for these claims on this tab
evidence: $ npx genie-react verify show vfy_673952a4-e627-4f4c-b938-f894742abd3a --claim 1 --session upd-g
session: {sessionId:56f33efa-4985-4b3e-b184-300f345f2786,logicalSessionId:6afe88d7-ca8f-4853-b709-88daca657184,documentGeneration:13}
schemaVersion: "1.0"
exitCode: 1
stage: end
ledger: {fingerprint:cf_8af18fcfed41,scope:logical-session,storage:memory,attempt:1,history:[],codeChangedSincePrevious:null,failsOnSameCode:0}
evidence: {retained:true,tools:[react_get_renders,react_component_cohort,react_list_overrides,query_is_fetching,react_refresh_events,browser_visibility,request_watch_start,request_watch_stop,react_profile_stop,react_render_causes,react_error_state]}
startedAt: 2026-11-19T09:01:14.924Z
endedAt: 2026-11-19T09:01:17.367Z
request: {budget:{fiberLimit:250,operationLimit:20000,timeLimitMs:8,targetOperationReserve:4000,targetTimeReserveMs:4,adaptive:true},settle:{quietMs:500,timeoutMs:10000},maxDurationMs:300000,allowOverrides:false}
[exit 1]

## Reference fix applied temporarily

[12:01:24] $ node /tmp/upd-g/applyfix.mjs ../../evals/realworld/dashboard/order-hold-rerenders-all-rows.json .
patched src/features/orders/order-row.tsx
patched src/features/orders/order-row.tsx
patched src/features/orders/order-row.tsx
patched src/features/orders/order-row.tsx
patched src/features/orders/orders-table.tsx
[exit 0]

[12:01:24] $ git diff src
diff --git a/apps/realworld-dashboard/src/features/orders/order-row.tsx b/apps/realworld-dashboard/src/features/orders/order-row.tsx
index d8f7df3..4113273 100644
--- a/apps/realworld-dashboard/src/features/orders/order-row.tsx
+++ b/apps/realworld-dashboard/src/features/orders/order-row.tsx
@@ -17,7 +17,7 @@ export interface OrderRowProps {
   start: number
   canEdit: boolean
   onToggleSelect: (id: string) => void
-  onStatusChange: (id: string, status: OrderStatus) => void
+  onStatusChange: (order: OrderSummary, status: OrderStatus) => void
 }
 
 export const OrderRow = memo(function OrderRow({
@@ -37,20 +37,20 @@ export const OrderRow = memo(function OrderRow({
       id: 'hold',
       label: 'Put on hold',
       disabled: !canEdit || closed || order.status === 'on_hold',
-      onSelect: () => onStatusChange(order.id, 'on_hold'),
+      onSelect: () => onStatusChange(order, 'on_hold'),
     },
     {
       id: 'ship',
       label: 'Mark shipped',
       disabled: !canEdit || closed || order.status === 'shipped',
-      onSelect: () => onStatusChange(order.id, 'shipped'),
+      onSelect: () => onStatusChange(order, 'shipped'),
     },
     {
       id: 'cancel',
       label: 'Cancel order',
       tone: 'danger',
       disabled: !canEdit || closed,
-      onSelect: () => onStatusChange(order.id, 'cancelled'),
+      onSelect: () => onStatusChange(order, 'cancelled'),
     },
   ]
 
diff --git a/apps/realworld-dashboard/src/features/orders/orders-table.tsx b/apps/realworld-dashboard/src/features/orders/orders-table.tsx
index 90c16f4..2cf09ac 100644
--- a/apps/realworld-dashboard/src/features/orders/orders-table.tsx
+++ b/apps/realworld-dashboard/src/features/orders/orders-table.tsx
@@ -40,11 +40,8 @@ export function OrdersTable({
     [hiddenColumns],
   )
   const onStatusChange = useCallback(
-    (id: string, status: OrderSummary['status']) => {
-      const order = rows.find((row) => row.id === id)
-      if (order) changeStatus({ id, number: order.number, status })
-    },
-    [rows, changeStatus],
+    (order: OrderSummary, status: OrderSummary['status']) => changeStatus({ id: order.id, number: order.number, status }),
+    [changeStatus],
   )
 
   const virtualizer = useVirtualizer({
[exit 0]

[12:01:26] $ npx genie-react call app_reset_backend '{}' --session upd-g --fields seed
[1]:
  - {seed:20260302}
[exit 0]

[12:01:27] $ agent-browser --session upd-g open 'http://127.0.0.1:5243/orders?status=processing'
✓ Meridian Ops
  http://127.0.0.1:5243/orders?status=processing&sort=placedAt&dir=desc
[exit 0]

[12:01:27] $ agent-browser --session upd-g wait --text 'SO-105979'
SO-105979
[exit 0]

[12:01:27] $ npx genie-react call devtools_wait '{"condition":"settled","domains":["react","query","router"],"timeoutMs":10000}' --fail-on-result-error --session upd-g | head -3
ok: true
condition: settled
waitedMs: 1225
[exit 0]

[12:01:29] $ agent-browser --session upd-g snapshot -i | grep -c -i 'could not be loaded'
0
[exit 1]

## Genie: verify AFTER the fix

[12:01:34] $ npx genie-react verify begin --session upd-g --name 'put one order on hold' --claim 'render OrderRow only props.order,mount' --claim 'render OrderRow min 1' --claim 'boundaries clean'
recording vfy_dd4ac4d4-d0e2-4ab7-aa00-2dbaf890c7fa "put one order on hold"
  url "http://127.0.0.1:5243/orders?status=processing&sort=placedAt&dir=desc"
  1 recording render OrderRow only props.order,mount
  2 recording render OrderRow min 1
  3 recording boundaries clean
window: {observationId:observation:1,startDocumentCommitId:14,domains:[react,query,router,network],quietMs:500,timeoutMs:10000,tailMs:500}
next: $ npx genie-react verify end vfy_dd4ac4d4-d0e2-4ab7-aa00-2dbaf890c7fa --session upd-g
session: {sessionId:26404e14-2460-4832-97e3-4609b70441c1,logicalSessionId:6afe88d7-ca8f-4853-b709-88daca657184,documentGeneration:15}
schemaVersion: "1.0"
targets: [{target:{component:OrderRow},status:resolved,instances:10,source:/src/features/orders/orders-table.tsx}]
startedAt: 2026-11-19T09:01:34.761Z
expiresAt: 2026-11-19T09:06:34.772Z
request: {budget:{fiberLimit:250,operationLimit:20000,timeLimitMs:8,targetOperationReserve:4000,targetTimeReserveMs:4,adaptive:true},settle:{quietMs:500,timeoutMs:10000},maxDurationMs:300000,allowOverrides:false}
[exit 0]

[12:01:34] $ bash /tmp/upd-g/hold.sh
✓ Done
✓ Done
SO-105979 updated
[exit 0]

[12:01:35] $ npx genie-react verify end vfy_dd4ac4d4-d0e2-4ab7-aa00-2dbaf890c7fa --session upd-g
pass vfy_dd4ac4d4-d0e2-4ab7-aa00-2dbaf890c7fa "put one order on hold"  10 commits, quiet after 2015 ms (react, query, router, network)
  url "http://127.0.0.1:5243/orders?status=processing&sort=placedAt&dir=desc"
  1 pass render OrderRow only props.order,mount  {renders:5,events:5,violatingEvents:0,causes:[mount,props.order]}
      claim: {kind:render-causes,target:{component:OrderRow},allow:[{kind:props,name:order},{kind:mount}]}
      deciding: [{kind:render-event,renderEventId:render:22:121,documentCommitId:22,mountId:mount:4,causes:[{cause:props.order,evidence:exact}]},{kind:render-event,renderEventId:render:19:68,documentCommitId:19,mountId:mount:4,causes:[{cause:props.order,evidence:exact}]},{kind:render-event,renderEventId:render:16:7,documentCommitId:16,mountId:mount:16,causes:[{cause:mount,evidence:exact}]}]
  2 pass render OrderRow min 1  {renders:5,mounts:3,updates:2,remounts:0,semantics:exact,instances:13,activeInstances:13}
      claim: {kind:renders,target:{component:OrderRow},min:1,counting:renders,allowRemount:false}
      deciding: [{kind:instance,mountId:mount:4,key:o-105979,renders:2,mounts:0,updates:2,mountGeneration:1,latestDocumentCommitId:22,source:/src/features/orders/orders-table.tsx:118:17},{kind:instance,mountId:mount:14,key:o-105918,renders:1,mounts:1,updates:0,mountGeneration:1,latestDocumentCommitId:16,source:/src/features/orders/orders-table.tsx:118:17},{kind:instance,mountId:mount:15,key:o-105917,renders:1,mounts:1,updates:0,mountGeneration:1,latestDocumentCommitId:16,source:/src/features/orders/orders-table.tsx:118:17}]
  3 pass boundaries clean  {caughtDuringWindow:0,caughtAtEnd:0}
      claim: {kind:boundaries-clean,scope:window}
      deciding: [{kind:boundary-log,scope:window,complete:true,afterDocumentCommitId:14}]
      caveats: [uncaught-errors-outside-boundaries-unobserved]
window: {observationId:observation:1,startDocumentCommitId:14,settledDocumentCommitId:23,frozenDocumentCommitId:24,commits:10,settle:{outcome:met,quietMs:500,timeoutMs:10000,waitedMs:2015,domains:{react:met,query:met,router:met,network:met}},tail:{ms:500,commits:1},environment:{bundle:development,strictMode:on,renderCollection:available,visibility:document}}
! ui-outcome-not-observed: Genie does not check the screen; confirm it with the UI driver
attempt 2 for these claims on this tab; previous fail vfy_673952a4-e627-4f4c-b938-f894742abd3a; document reloaded since
evidence: $ npx genie-react verify show vfy_dd4ac4d4-d0e2-4ab7-aa00-2dbaf890c7fa --session upd-g
session: {sessionId:26404e14-2460-4832-97e3-4609b70441c1,logicalSessionId:6afe88d7-ca8f-4853-b709-88daca657184,documentGeneration:15}
schemaVersion: "1.0"
exitCode: 0
stage: end
ledger: {fingerprint:cf_8af18fcfed41,scope:logical-session,storage:memory,attempt:2,history:[{verificationId:vfy_673952a4-e627-4f4c-b938-f894742abd3a,verdict:fail,reasons:[],endedAt:2026-11-19T09:01:17.367Z}],codeChangedSincePrevious:document-reloaded,failsOnSameCode:0}
evidence: {retained:true,tools:[react_get_renders,react_component_cohort,react_list_overrides,query_is_fetching,react_refresh_events,browser_visibility,request_watch_start,request_watch_stop,react_profile_stop,react_render_causes,react_error_state]}
startedAt: 2026-11-19T09:01:34.761Z
endedAt: 2026-11-19T09:01:37.554Z
request: {budget:{fiberLimit:250,operationLimit:20000,timeLimitMs:8,targetOperationReserve:4000,targetTimeReserveMs:4,adaptive:true},settle:{quietMs:500,timeoutMs:10000},maxDurationMs:300000,allowOverrides:false}
[exit 0]

[12:01:37] $ agent-browser --session upd-g get text '[data-order-id=o-105979]'
SO-105979
Lumen Retail
On hold
standard
NA
46
Mar 2, 2026
$2,341.78
[exit 0]

## Revert the reference fix

[12:01:43] $ git checkout -- src && git status --short .

[exit 0]
[teardown] stopped the dev server on 5243 and closed agent-browser session upd-g
````
