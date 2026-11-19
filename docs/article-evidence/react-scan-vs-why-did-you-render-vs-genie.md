# Evidence: react-scan-vs-why-did-you-render-vs-genie

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
- Genie stayed wired in every scratch copy (its Vite plugin and app tools), so `app_reset_backend` and
  `app_login_as` worked there too. The other tools were added beside it.
- The react-scan overlay image in the article is `/tmp/art-m1/react-scan-after-click.png`, the
  `agent-browser screenshot` taken in the logged react-scan run with the bug present, copied to
  `apps/docs/public/articles/react-scan-order-hold.png` unchanged.
- Tool versions: react-scan 0.5.7, @welldone-software/why-did-you-render 10.0.1.

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
