# Evidence: prove-your-agents-react-fix

- Date: 2026-11-19 (runs between 03:52 and 03:54 UTC)
- Commit: `6867352ba46ec3998fe8cda0ba915536fddfa666` (`git rev-parse HEAD`)
- App: `apps/realworld-dashboard` (Meridian Ops), dev server started from the app folder with
  `DASHBOARD_PORT=5215 pnpm exec vite --port 5215 --strictPort`
- URL: `http://127.0.0.1:5215/orders` (redirects to `/orders?sort=placedAt&dir=desc`)
- Genie: CLI and runtime 1.0.2 from this checkout (`pnpm install && pnpm build`), React 19.3.1
  development build in StrictMode, headless Chromium through agent-browser 0.39.1
- Session: `art-l5`

Every command below ran from `apps/realworld-dashboard`, in this order. Output is untrimmed. Steps
that are not shell commands are noted in prose: short waits between commands, and the temporary
source edit, which was applied with a script and is shown by the `git diff` run that follows it.
The edit was reverted with `git checkout` at the end and never committed.

## Runs

The first `verify` run is on unchanged code. The fix is the reference fix from
`evals/realworld/dashboard/order-hold-rerenders-all-rows.json`, applied after the first run and
typechecked with `npx tsc --noEmit -p .` (passed). The backend was reset before the second run so
SO-105999 was in Processing again.

```console
$ npx genie-react status --session art-l5 --wait 15000
selectedBridgeUrl: ws://127.0.0.1:5215/__genie/ws
sessionSelector:
  requested: art-l5
  source: flag
  resolvedSessionId: 647b7bd6-893f-4f04-8930-12a4ef7e5cdf
  implicit: false
  agentBrowser: {session:art-l5,via:selector,logicalSessionId:91e3ff5f-eb6d-450b-9f23-9632c736dd69}
connected: true
ready: true
sessionId: 647b7bd6-893f-4f04-8930-12a4ef7e5cdf
app: {name:"Meridian Ops",url:http://127.0.0.1:5215/login,reactVersion:19.3.1,reactMounted:true}
domains: [session,react,app,memory,perf,plugin,timeline,router,query]
toolCount: 98
sessions[1] (sessionId {fields}):
  647b7bd6-893f-4f04-8930-12a4ef7e5cdf {logicalSessionId:91e3ff5f-eb6d-450b-9f23-9632c736dd69,documentGeneration:2,logicalSessionCollision:false,collisionWithSessionIds:[],app:{name:"Meridian Ops",url:http://127.0.0.1:5215/login,reactVersion:19.3.1,reactMounted:true},domains:[session,react,app,memory,perf,plugin,timeline,router,query],toolCount:98,connectedAt:1795060305259,ready:true,readyAt:1795060305262,current:true,origin:http://127.0.0.1:5215,runtimeVersion:1.0.2}
warnings: []
hub: {version:1.0.2,protocol:1}
# exit code: 0
```

```console
$ npx genie-react call app_login_as '{"role":"manager"}' --session art-l5
changed: true
role: manager
userId: u-manager
# exit code: 0
```

```console
$ agent-browser --session art-l5 open 'http://127.0.0.1:5215/orders?status=processing'
✓ Meridian Ops
  http://127.0.0.1:5215/orders?status=processing&sort=placedAt&dir=desc
# exit code: 0
```

```console
$ agent-browser --session art-l5 snapshot -i | head -60
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
    - checkbox "Select SO-105999" [checked=false, ref=e166]
  - gridcell "SO-105999" [ref=e47]
    - link "SO-105999" [ref=e167]
  - gridcell "Delta Health 5" [ref=e48]
  - gridcell "Processing" [ref=e49]
  - gridcell "standard" [ref=e50]
  - gridcell "EMEA" [ref=e51]
  - gridcell "40" [ref=e52]
  - gridcell "Mar 2, 2026" [ref=e53]
  - gridcell "$8,624.19" [ref=e54]
  - gridcell "Actions for SO-105999" [ref=e55]
    - button "Actions for SO-105999" [expanded=false, ref=e190]
  - gridcell "Select SO-105998" [ref=e56]
    - checkbox "Select SO-105998" [checked=false, ref=e168]
# exit code: 0
```

```console
$ agent-browser --session art-l5 open 'http://127.0.0.1:5215/orders'
✓ Meridian Ops
  http://127.0.0.1:5215/orders?sort=placedAt&dir=desc
# exit code: 0
```

```console
$ agent-browser --session art-l5 snapshot -i | grep -m3 'Actions for'
  - gridcell "Actions for SO-106000" [ref=e256]
    - button "Actions for SO-106000" [expanded=false, ref=e391]
  - gridcell "Actions for SO-105999" [ref=e266]
# exit code: 0
```

```console
$ npx genie-react verify begin --session art-l5 --name 'put one order on hold' --claim 'render OrderRow only props.order' --claim 'render OrderRow min 1' --claim 'boundaries clean'
recording vfy_2dbfa57a-44c7-4efc-b956-475e5f2b3eab "put one order on hold"
  url "http://127.0.0.1:5215/orders?sort=placedAt&dir=desc"
  1 null render OrderRow only props.order  {}
  2 null render OrderRow min 1  {}
  3 null boundaries clean  {}
window: {observationId:observation:1,startDocumentCommitId:26,domains:[react,query,router],quietMs:500,timeoutMs:10000,tailMs:500}
next: $ pnpm exec genie-react verify end vfy_2dbfa57a-44c7-4efc-b956-475e5f2b3eab --session art-l5
session: {sessionId:fa43e1de-47f3-4a49-a397-bec94fad9ecc,logicalSessionId:91e3ff5f-eb6d-450b-9f23-9632c736dd69,documentGeneration:4}
schemaVersion: "1.0"
targets: [{target:{component:OrderRow},status:resolved,instances:12,source:/src/features/orders/orders-table.tsx}]
startedAt: 2026-11-19T03:52:43.689Z
expiresAt: 2026-11-19T03:57:43.714Z
request: {budget:{fiberLimit:250,operationLimit:20000,timeLimitMs:8,targetOperationReserve:4000,targetTimeReserveMs:4,adaptive:true},settle:{quietMs:500,timeoutMs:10000},maxDurationMs:300000,allowOverrides:false}
# exit code: 0
```

```console
$ agent-browser --session art-l5 click 'button[aria-label="Actions for SO-105999"]'
✓ Done
# exit code: 0
```

```console
$ agent-browser --session art-l5 find role menuitem click --name 'Put on hold'
✓ Done
# exit code: 0
```

```console
$ agent-browser --session art-l5 wait 1500
✓ Done
# exit code: 0
```

```console
$ npx genie-react verify end vfy_2dbfa57a-44c7-4efc-b956-475e5f2b3eab --session art-l5
fail vfy_2dbfa57a-44c7-4efc-b956-475e5f2b3eab "put one order on hold"  15 commits, quiet after 942 ms (react, query, router)
  url "http://127.0.0.1:5215/orders?sort=placedAt&dir=desc"
  1 fail render OrderRow only props.order  {renders:24,events:24,violatingEvents:24,causes:[props.onStatusChange,props.order]}
      claim: {kind:render-causes,target:{component:OrderRow},allow:[{kind:props,name:order}]}
      deciding: [{kind:render-event,renderEventId:render:38:190,documentCommitId:38,mountId:mount:12,causes:[{cause:props.onStatusChange,evidence:exact}]},{kind:render-event,renderEventId:render:38:189,documentCommitId:38,mountId:mount:11,causes:[{cause:props.onStatusChange,evidence:exact}]},{kind:render-event,renderEventId:render:38:188,documentCommitId:38,mountId:mount:10,causes:[{cause:props.onStatusChange,evidence:exact}]}]
  2 pass render OrderRow min 1  {renders:24,mounts:0,updates:24,remounts:0,semantics:exact,instances:12,activeInstances:12}
      claim: {kind:renders,target:{component:OrderRow},min:1,counting:renders,allowRemount:false}
      deciding: [{kind:instance,mountId:mount:1,key:o-106000,renders:2,mounts:0,updates:2,mountGeneration:1,latestDocumentCommitId:38,source:/src/features/orders/orders-table.tsx:121:17},{kind:instance,mountId:mount:2,key:o-105999,renders:2,mounts:0,updates:2,mountGeneration:1,latestDocumentCommitId:38,source:/src/features/orders/orders-table.tsx:121:17},{kind:instance,mountId:mount:3,key:o-105998,renders:2,mounts:0,updates:2,mountGeneration:1,latestDocumentCommitId:38,source:/src/features/orders/orders-table.tsx:121:17}]
  3 pass boundaries clean  {caughtDuringWindow:0,caughtAtEnd:0}
      claim: {kind:boundaries-clean,scope:window}
      deciding: [{kind:boundary-log,scope:window,complete:true,afterDocumentCommitId:26}]
      caveats: [uncaught-errors-outside-boundaries-unobserved]
window: {observationId:observation:1,startDocumentCommitId:26,settledDocumentCommitId:40,frozenDocumentCommitId:41,commits:15,settle:{outcome:met,quietMs:500,timeoutMs:10000,waitedMs:942,domains:{react:met,query:met,router:met}},tail:{ms:500,commits:1},environment:{bundle:development,strictMode:on,renderCollection:available,visibility:document}}
! ui-outcome-not-observed: Genie does not check the screen; confirm it with the UI driver
attempt 1 for these claims on this tab
evidence: $ pnpm exec genie-react verify show vfy_2dbfa57a-44c7-4efc-b956-475e5f2b3eab --claim 1 --session art-l5
session: {sessionId:fa43e1de-47f3-4a49-a397-bec94fad9ecc,logicalSessionId:91e3ff5f-eb6d-450b-9f23-9632c736dd69,documentGeneration:4}
schemaVersion: "1.0"
exitCode: 1
stage: end
ledger: {fingerprint:cf_75872ee88939,scope:logical-session,storage:memory,attempt:1,history:[],codeChangedSincePrevious:null,failsOnSameCode:0}
evidence: {retained:true,tools:[react_get_renders,react_component_cohort,react_list_overrides,query_is_fetching,react_refresh_events,browser_visibility,react_profile_stop,react_render_causes,react_error_state]}
startedAt: 2026-11-19T03:52:43.689Z
endedAt: 2026-11-19T03:52:52.215Z
request: {budget:{fiberLimit:250,operationLimit:20000,timeLimitMs:8,targetOperationReserve:4000,targetTimeReserveMs:4,adaptive:true},settle:{quietMs:500,timeoutMs:10000},maxDurationMs:300000,allowOverrides:false}
# exit code: 1
```

```console
$ agent-browser --session art-l5 get text '[data-order-id="o-105999"]'
SO-105999
Delta Health 5
On hold
standard
EMEA
40
Mar 2, 2026
$8,624.19
# exit code: 0
```

```console
$ agent-browser --session art-l5 get text '[role=status]'
✗ Element not found: [role=status]. Verify the selector, role, or name is correct and the element exists in the DOM.
# exit code: 1
```

```console
$ npx genie-react verify show vfy_2dbfa57a-44c7-4efc-b956-475e5f2b3eab --claim 1 --session art-l5
verificationId: vfy_2dbfa57a-44c7-4efc-b956-475e5f2b3eab
verdict: fail
claim:
  index: 1
  text: "render OrderRow only props.order"
  claim: {kind:render-causes,target:{component:OrderRow},allow:[{kind:props,name:order}]}
  verdict: fail
  observed: {renders:24,events:24,violatingEvents:24,causes:[props.onStatusChange,props.order]}
  deciding[3]:
    each: {kind:render-event,documentCommitId:38,causes:[{cause:props.onStatusChange,evidence:exact}]}
    - {renderEventId:render:38:190,mountId:mount:12}
    - {renderEventId:render:38:189,mountId:mount:11}
    - {renderEventId:render:38:188,mountId:mount:10}
  caveats: []
evidence:
  records[12]:
    each: {mountGeneration:1,mountGenerationEvidence:exact,renders:2,mounts:0,updates:2,unmounted:false,latestDocumentCommitId:38,sourceFile:/src/features/orders/orders-table.tsx,sourceLocation:/src/features/orders/orders-table.tsx:121:17}
    - {mountId:mount:1,key:o-106000,logicalPath:"QueryClientProvider[index=0] > AuthProvider[index=0] > App[index=0] > RouterProvider[index=0] > RouterContextProvider[index=0] > Matches[index=0] > MatchesInner[index=0] > CatchBoundary[index=0] > MatchImpl[index=0] > MatchView[index=0] > CatchBoundary[index=0] > CatchNotFound[index=0] > CatchBoundary[index=0] > MatchInnerImpl[index=0] > RootLayout[index=0] > OutletImpl[index=0] > MatchImpl[index=0] > MatchView[index=0] > CatchBoundary[index=0] > MatchInnerImpl[index=0] > Lazy[index=0] > AuthenticatedLayout[index=0] > PermissionsProvider[index=0] > AppShell[index=0] > PreferencesProvider[index=0] > <div>[index=0] > <div>[index=1] > <main>[index=1] > OutletImpl[index=0] > MatchImpl[index=0] > MatchView[index=0] > CatchBoundary[index=0] > MatchInnerImpl[index=0] > Lazy[index=0] > OrdersPage[index=0] > <div>[index=0] > OrdersTable[index=3] > <div>[index=0] > <div>[index=1] > <div>[index=0] > OrderRow[key=\"o-106000\"]"}
    - {mountId:mount:2,key:o-105999,logicalPath:"QueryClientProvider[index=0] > AuthProvider[index=0] > App[index=0] > RouterProvider[index=0] > RouterContextProvider[index=0] > Matches[index=0] > MatchesInner[index=0] > CatchBoundary[index=0] > MatchImpl[index=0] > MatchView[index=0] > CatchBoundary[index=0] > CatchNotFound[index=0] > CatchBoundary[index=0] > MatchInnerImpl[index=0] > RootLayout[index=0] > OutletImpl[index=0] > MatchImpl[index=0] > MatchView[index=0] > CatchBoundary[index=0] > MatchInnerImpl[index=0] > Lazy[index=0] > AuthenticatedLayout[index=0] > PermissionsProvider[index=0] > AppShell[index=0] > PreferencesProvider[index=0] > <div>[index=0] > <div>[index=1] > <main>[index=1] > OutletImpl[index=0] > MatchImpl[index=0] > MatchView[index=0] > CatchBoundary[index=0] > MatchInnerImpl[index=0] > Lazy[index=0] > OrdersPage[index=0] > <div>[index=0] > OrdersTable[index=3] > <div>[index=0] > <div>[index=1] > <div>[index=0] > OrderRow[key=\"o-105999\"]"}
    - {mountId:mount:3,key:o-105998,logicalPath:"QueryClientProvider[index=0] > AuthProvider[index=0] > App[index=0] > RouterProvider[index=0] > RouterContextProvider[index=0] > Matches[index=0] > MatchesInner[index=0] > CatchBoundary[index=0] > MatchImpl[index=0] > MatchView[index=0] > CatchBoundary[index=0] > CatchNotFound[index=0] > CatchBoundary[index=0] > MatchInnerImpl[index=0] > RootLayout[index=0] > OutletImpl[index=0] > MatchImpl[index=0] > MatchView[index=0] > CatchBoundary[index=0] > MatchInnerImpl[index=0] > Lazy[index=0] > AuthenticatedLayout[index=0] > PermissionsProvider[index=0] > AppShell[index=0] > PreferencesProvider[index=0] > <div>[index=0] > <div>[index=1] > <main>[index=1] > OutletImpl[index=0] > MatchImpl[index=0] > MatchView[index=0] > CatchBoundary[index=0] > MatchInnerImpl[index=0] > Lazy[index=0] > OrdersPage[index=0] > <div>[index=0] > OrdersTable[index=3] > <div>[index=0] > <div>[index=1] > <div>[index=0] > OrderRow[key=\"o-105998\"]"}
    - {mountId:mount:4,key:o-105997,logicalPath:"QueryClientProvider[index=0] > AuthProvider[index=0] > App[index=0] > RouterProvider[index=0] > RouterContextProvider[index=0] > Matches[index=0] > MatchesInner[index=0] > CatchBoundary[index=0] > MatchImpl[index=0] > MatchView[index=0] > CatchBoundary[index=0] > CatchNotFound[index=0] > CatchBoundary[index=0] > MatchInnerImpl[index=0] > RootLayout[index=0] > OutletImpl[index=0] > MatchImpl[index=0] > MatchView[index=0] > CatchBoundary[index=0] > MatchInnerImpl[index=0] > Lazy[index=0] > AuthenticatedLayout[index=0] > PermissionsProvider[index=0] > AppShell[index=0] > PreferencesProvider[index=0] > <div>[index=0] > <div>[index=1] > <main>[index=1] > OutletImpl[index=0] > MatchImpl[index=0] > MatchView[index=0] > CatchBoundary[index=0] > MatchInnerImpl[index=0] > Lazy[index=0] > OrdersPage[index=0] > <div>[index=0] > OrdersTable[index=3] > <div>[index=0] > <div>[index=1] > <div>[index=0] > OrderRow[key=\"o-105997\"]"}
    - {mountId:mount:5,key:o-105996,logicalPath:"QueryClientProvider[index=0] > AuthProvider[index=0] > App[index=0] > RouterProvider[index=0] > RouterContextProvider[index=0] > Matches[index=0] > MatchesInner[index=0] > CatchBoundary[index=0] > MatchImpl[index=0] > MatchView[index=0] > CatchBoundary[index=0] > CatchNotFound[index=0] > CatchBoundary[index=0] > MatchInnerImpl[index=0] > RootLayout[index=0] > OutletImpl[index=0] > MatchImpl[index=0] > MatchView[index=0] > CatchBoundary[index=0] > MatchInnerImpl[index=0] > Lazy[index=0] > AuthenticatedLayout[index=0] > PermissionsProvider[index=0] > AppShell[index=0] > PreferencesProvider[index=0] > <div>[index=0] > <div>[index=1] > <main>[index=1] > OutletImpl[index=0] > MatchImpl[index=0] > MatchView[index=0] > CatchBoundary[index=0] > MatchInnerImpl[index=0] > Lazy[index=0] > OrdersPage[index=0] > <div>[index=0] > OrdersTable[index=3] > <div>[index=0] > <div>[index=1] > <div>[index=0] > OrderRow[key=\"o-105996\"]"}
    - {mountId:mount:6,key:o-105995,logicalPath:"QueryClientProvider[index=0] > AuthProvider[index=0] > App[index=0] > RouterProvider[index=0] > RouterContextProvider[index=0] > Matches[index=0] > MatchesInner[index=0] > CatchBoundary[index=0] > MatchImpl[index=0] > MatchView[index=0] > CatchBoundary[index=0] > CatchNotFound[index=0] > CatchBoundary[index=0] > MatchInnerImpl[index=0] > RootLayout[index=0] > OutletImpl[index=0] > MatchImpl[index=0] > MatchView[index=0] > CatchBoundary[index=0] > MatchInnerImpl[index=0] > Lazy[index=0] > AuthenticatedLayout[index=0] > PermissionsProvider[index=0] > AppShell[index=0] > PreferencesProvider[index=0] > <div>[index=0] > <div>[index=1] > <main>[index=1] > OutletImpl[index=0] > MatchImpl[index=0] > MatchView[index=0] > CatchBoundary[index=0] > MatchInnerImpl[index=0] > Lazy[index=0] > OrdersPage[index=0] > <div>[index=0] > OrdersTable[index=3] > <div>[index=0] > <div>[index=1] > <div>[index=0] > OrderRow[key=\"o-105995\"]"}
    - {mountId:mount:7,key:o-105994,logicalPath:"QueryClientProvider[index=0] > AuthProvider[index=0] > App[index=0] > RouterProvider[index=0] > RouterContextProvider[index=0] > Matches[index=0] > MatchesInner[index=0] > CatchBoundary[index=0] > MatchImpl[index=0] > MatchView[index=0] > CatchBoundary[index=0] > CatchNotFound[index=0] > CatchBoundary[index=0] > MatchInnerImpl[index=0] > RootLayout[index=0] > OutletImpl[index=0] > MatchImpl[index=0] > MatchView[index=0] > CatchBoundary[index=0] > MatchInnerImpl[index=0] > Lazy[index=0] > AuthenticatedLayout[index=0] > PermissionsProvider[index=0] > AppShell[index=0] > PreferencesProvider[index=0] > <div>[index=0] > <div>[index=1] > <main>[index=1] > OutletImpl[index=0] > MatchImpl[index=0] > MatchView[index=0] > CatchBoundary[index=0] > MatchInnerImpl[index=0] > Lazy[index=0] > OrdersPage[index=0] > <div>[index=0] > OrdersTable[index=3] > <div>[index=0] > <div>[index=1] > <div>[index=0] > OrderRow[key=\"o-105994\"]"}
    - {mountId:mount:8,key:o-105993,logicalPath:"QueryClientProvider[index=0] > AuthProvider[index=0] > App[index=0] > RouterProvider[index=0] > RouterContextProvider[index=0] > Matches[index=0] > MatchesInner[index=0] > CatchBoundary[index=0] > MatchImpl[index=0] > MatchView[index=0] > CatchBoundary[index=0] > CatchNotFound[index=0] > CatchBoundary[index=0] > MatchInnerImpl[index=0] > RootLayout[index=0] > OutletImpl[index=0] > MatchImpl[index=0] > MatchView[index=0] > CatchBoundary[index=0] > MatchInnerImpl[index=0] > Lazy[index=0] > AuthenticatedLayout[index=0] > PermissionsProvider[index=0] > AppShell[index=0] > PreferencesProvider[index=0] > <div>[index=0] > <div>[index=1] > <main>[index=1] > OutletImpl[index=0] > MatchImpl[index=0] > MatchView[index=0] > CatchBoundary[index=0] > MatchInnerImpl[index=0] > Lazy[index=0] > OrdersPage[index=0] > <div>[index=0] > OrdersTable[index=3] > <div>[index=0] > <div>[index=1] > <div>[index=0] > OrderRow[key=\"o-105993\"]"}
    - {mountId:mount:9,key:o-105992,logicalPath:"QueryClientProvider[index=0] > AuthProvider[index=0] > App[index=0] > RouterProvider[index=0] > RouterContextProvider[index=0] > Matches[index=0] > MatchesInner[index=0] > CatchBoundary[index=0] > MatchImpl[index=0] > MatchView[index=0] > CatchBoundary[index=0] > CatchNotFound[index=0] > CatchBoundary[index=0] > MatchInnerImpl[index=0] > RootLayout[index=0] > OutletImpl[index=0] > MatchImpl[index=0] > MatchView[index=0] > CatchBoundary[index=0] > MatchInnerImpl[index=0] > Lazy[index=0] > AuthenticatedLayout[index=0] > PermissionsProvider[index=0] > AppShell[index=0] > PreferencesProvider[index=0] > <div>[index=0] > <div>[index=1] > <main>[index=1] > OutletImpl[index=0] > MatchImpl[index=0] > MatchView[index=0] > CatchBoundary[index=0] > MatchInnerImpl[index=0] > Lazy[index=0] > OrdersPage[index=0] > <div>[index=0] > OrdersTable[index=3] > <div>[index=0] > <div>[index=1] > <div>[index=0] > OrderRow[key=\"o-105992\"]"}
    - {mountId:mount:10,key:o-105991,logicalPath:"QueryClientProvider[index=0] > AuthProvider[index=0] > App[index=0] > RouterProvider[index=0] > RouterContextProvider[index=0] > Matches[index=0] > MatchesInner[index=0] > CatchBoundary[index=0] > MatchImpl[index=0] > MatchView[index=0] > CatchBoundary[index=0] > CatchNotFound[index=0] > CatchBoundary[index=0] > MatchInnerImpl[index=0] > RootLayout[index=0] > OutletImpl[index=0] > MatchImpl[index=0] > MatchView[index=0] > CatchBoundary[index=0] > MatchInnerImpl[index=0] > Lazy[index=0] > AuthenticatedLayout[index=0] > PermissionsProvider[index=0] > AppShell[index=0] > PreferencesProvider[index=0] > <div>[index=0] > <div>[index=1] > <main>[index=1] > OutletImpl[index=0] > MatchImpl[index=0] > MatchView[index=0] > CatchBoundary[index=0] > MatchInnerImpl[index=0] > Lazy[index=0] > OrdersPage[index=0] > <div>[index=0] > OrdersTable[index=3] > <div>[index=0] > <div>[index=1] > <div>[index=0] > OrderRow[key=\"o-105991\"]"}
    - {mountId:mount:11,key:o-105990,logicalPath:"QueryClientProvider[index=0] > AuthProvider[index=0] > App[index=0] > RouterProvider[index=0] > RouterContextProvider[index=0] > Matches[index=0] > MatchesInner[index=0] > CatchBoundary[index=0] > MatchImpl[index=0] > MatchView[index=0] > CatchBoundary[index=0] > CatchNotFound[index=0] > CatchBoundary[index=0] > MatchInnerImpl[index=0] > RootLayout[index=0] > OutletImpl[index=0] > MatchImpl[index=0] > MatchView[index=0] > CatchBoundary[index=0] > MatchInnerImpl[index=0] > Lazy[index=0] > AuthenticatedLayout[index=0] > PermissionsProvider[index=0] > AppShell[index=0] > PreferencesProvider[index=0] > <div>[index=0] > <div>[index=1] > <main>[index=1] > OutletImpl[index=0] > MatchImpl[index=0] > MatchView[index=0] > CatchBoundary[index=0] > MatchInnerImpl[index=0] > Lazy[index=0] > OrdersPage[index=0] > <div>[index=0] > OrdersTable[index=3] > <div>[index=0] > <div>[index=1] > <div>[index=0] > OrderRow[key=\"o-105990\"]"}
    - {mountId:mount:12,key:o-105989,logicalPath:"QueryClientProvider[index=0] > AuthProvider[index=0] > App[index=0] > RouterProvider[index=0] > RouterContextProvider[index=0] > Matches[index=0] > MatchesInner[index=0] > CatchBoundary[index=0] > MatchImpl[index=0] > MatchView[index=0] > CatchBoundary[index=0] > CatchNotFound[index=0] > CatchBoundary[index=0] > MatchInnerImpl[index=0] > RootLayout[index=0] > OutletImpl[index=0] > MatchImpl[index=0] > MatchView[index=0] > CatchBoundary[index=0] > MatchInnerImpl[index=0] > Lazy[index=0] > AuthenticatedLayout[index=0] > PermissionsProvider[index=0] > AppShell[index=0] > PreferencesProvider[index=0] > <div>[index=0] > <div>[index=1] > <main>[index=1] > OutletImpl[index=0] > MatchImpl[index=0] > MatchView[index=0] > CatchBoundary[index=0] > MatchInnerImpl[index=0] > Lazy[index=0] > OrdersPage[index=0] > <div>[index=0] > OrdersTable[index=3] > <div>[index=0] > <div>[index=1] > <div>[index=0] > OrderRow[key=\"o-105989\"]"}
  events[24]:
    each: {inputCoverageComplete:true}
    - {renderEventId:render:38:190,documentCommitId:38,mountId:mount:12,causes:[{kind:props,evidence:exact,name:onStatusChange,reason:null}]}
    - {renderEventId:render:38:189,documentCommitId:38,mountId:mount:11,causes:[{kind:props,evidence:exact,name:onStatusChange,reason:null}]}
    - {renderEventId:render:38:188,documentCommitId:38,mountId:mount:10,causes:[{kind:props,evidence:exact,name:onStatusChange,reason:null}]}
    - {renderEventId:render:38:187,documentCommitId:38,mountId:mount:9,causes:[{kind:props,evidence:exact,name:onStatusChange,reason:null}]}
    - {renderEventId:render:38:186,documentCommitId:38,mountId:mount:8,causes:[{kind:props,evidence:exact,name:onStatusChange,reason:null}]}
    - {renderEventId:render:38:185,documentCommitId:38,mountId:mount:7,causes:[{kind:props,evidence:exact,name:onStatusChange,reason:null}]}
    - {renderEventId:render:38:184,documentCommitId:38,mountId:mount:6,causes:[{kind:props,evidence:exact,name:onStatusChange,reason:null}]}
    - {renderEventId:render:38:183,documentCommitId:38,mountId:mount:5,causes:[{kind:props,evidence:exact,name:onStatusChange,reason:null}]}
    - {renderEventId:render:38:182,documentCommitId:38,mountId:mount:4,causes:[{kind:props,evidence:exact,name:onStatusChange,reason:null}]}
    - {renderEventId:render:38:181,documentCommitId:38,mountId:mount:3,causes:[{kind:props,evidence:exact,name:onStatusChange,reason:null}]}
    - {renderEventId:render:38:180,documentCommitId:38,mountId:mount:2,causes:[{kind:props,evidence:exact,name:order,reason:null},{kind:props,evidence:exact,name:onStatusChange,reason:null}]}
    - {renderEventId:render:38:179,documentCommitId:38,mountId:mount:1,causes:[{kind:props,evidence:exact,name:onStatusChange,reason:null}]}
    - {renderEventId:render:36:45,documentCommitId:36,mountId:mount:12,causes:[{kind:props,evidence:exact,name:onStatusChange,reason:null}]}
    - {renderEventId:render:36:44,documentCommitId:36,mountId:mount:11,causes:[{kind:props,evidence:exact,name:onStatusChange,reason:null}]}
    - {renderEventId:render:36:43,documentCommitId:36,mountId:mount:10,causes:[{kind:props,evidence:exact,name:onStatusChange,reason:null}]}
    - {renderEventId:render:36:42,documentCommitId:36,mountId:mount:9,causes:[{kind:props,evidence:exact,name:onStatusChange,reason:null}]}
    - {renderEventId:render:36:41,documentCommitId:36,mountId:mount:8,causes:[{kind:props,evidence:exact,name:onStatusChange,reason:null}]}
    - {renderEventId:render:36:40,documentCommitId:36,mountId:mount:7,causes:[{kind:props,evidence:exact,name:onStatusChange,reason:null}]}
    - {renderEventId:render:36:39,documentCommitId:36,mountId:mount:6,causes:[{kind:props,evidence:exact,name:onStatusChange,reason:null}]}
    - {renderEventId:render:36:38,documentCommitId:36,mountId:mount:5,causes:[{kind:props,evidence:exact,name:onStatusChange,reason:null}]}
    - {renderEventId:render:36:37,documentCommitId:36,mountId:mount:4,causes:[{kind:props,evidence:exact,name:onStatusChange,reason:null}]}
    - {renderEventId:render:36:36,documentCommitId:36,mountId:mount:3,causes:[{kind:props,evidence:exact,name:onStatusChange,reason:null}]}
    - {renderEventId:render:36:35,documentCommitId:36,mountId:mount:2,causes:[{kind:props,evidence:exact,name:order,reason:null},{kind:props,evidence:exact,name:onStatusChange,reason:null}]}
    - {renderEventId:render:36:34,documentCommitId:36,mountId:mount:1,causes:[{kind:props,evidence:exact,name:onStatusChange,reason:null}]}
  effects: null
  beginInstances[12]:
    each: {renderingState:mounted-rendering,sourceFile:/src/features/orders/orders-table.tsx,sourceLocation:/src/features/orders/orders-table.tsx:121:17}
    - {mountId:mount:1,key:o-106000}
    - {mountId:mount:2,key:o-105999}
    - {mountId:mount:3,key:o-105998}
    - {mountId:mount:4,key:o-105997}
    - {mountId:mount:5,key:o-105996}
    - {mountId:mount:6,key:o-105995}
    - {mountId:mount:7,key:o-105994}
    - {mountId:mount:8,key:o-105993}
    - {mountId:mount:9,key:o-105992}
    - {mountId:mount:10,key:o-105991}
    - {mountId:mount:11,key:o-105990}
    - {mountId:mount:12,key:o-105989}
  endInstances[12]:
    each: {renderingState:mounted-rendering,sourceFile:/src/features/orders/orders-table.tsx,sourceLocation:/src/features/orders/orders-table.tsx:121:17}
    - {mountId:mount:1,key:o-106000}
    - {mountId:mount:2,key:o-105999}
    - {mountId:mount:3,key:o-105998}
    - {mountId:mount:4,key:o-105997}
    - {mountId:mount:5,key:o-105996}
    - {mountId:mount:6,key:o-105995}
    - {mountId:mount:7,key:o-105994}
    - {mountId:mount:8,key:o-105993}
    - {mountId:mount:9,key:o-105992}
    - {mountId:mount:10,key:o-105991}
    - {mountId:mount:11,key:o-105990}
    - {mountId:mount:12,key:o-105989}
evidenceRetained: true
# exit code: 0
```

```console
$ git diff -- src/features/orders
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
index 90c16f4..288cd5b 100644
--- a/apps/realworld-dashboard/src/features/orders/orders-table.tsx
+++ b/apps/realworld-dashboard/src/features/orders/orders-table.tsx
@@ -40,11 +40,9 @@ export function OrdersTable({
     [hiddenColumns],
   )
   const onStatusChange = useCallback(
-    (id: string, status: OrderSummary['status']) => {
-      const order = rows.find((row) => row.id === id)
-      if (order) changeStatus({ id, number: order.number, status })
-    },
-    [rows, changeStatus],
+    (order: OrderSummary, status: OrderSummary['status']) =>
+      changeStatus({ id: order.id, number: order.number, status }),
+    [changeStatus],
   )
 
   const virtualizer = useVirtualizer({
# exit code: 0
```

```console
$ npx genie-react call app_reset_backend '{}' --session art-l5
seed: 20260302
faults: []
latency: []
latencyScale: 1
requestCount: 0
counts: {orders:6000,customers:1200,products:2400}
# exit code: 0
```

```console
$ agent-browser --session art-l5 open 'http://127.0.0.1:5215/orders'
✓ Meridian Ops
  http://127.0.0.1:5215/orders?sort=placedAt&dir=desc
# exit code: 0
```

```console
$ agent-browser --session art-l5 get text '[data-order-id="o-105999"]'
SO-105999
Delta Health 5
Processing
standard
EMEA
40
Mar 2, 2026
$8,624.19
# exit code: 0
```

```console
$ npx genie-react verify begin --session art-l5 --name 'put one order on hold' --claim 'render OrderRow only props.order' --claim 'render OrderRow min 1' --claim 'boundaries clean'
recording vfy_3bbabc5d-9307-4502-943e-97ee8f8849d7 "put one order on hold"
  url "http://127.0.0.1:5215/orders?sort=placedAt&dir=desc"
  1 null render OrderRow only props.order  {}
  2 null render OrderRow min 1  {}
  3 null boundaries clean  {}
window: {observationId:observation:1,startDocumentCommitId:12,domains:[react,query,router],quietMs:500,timeoutMs:10000,tailMs:500}
next: $ pnpm exec genie-react verify end vfy_3bbabc5d-9307-4502-943e-97ee8f8849d7 --session art-l5
session: {sessionId:9bd9a93b-8991-46b2-b75b-e7acae612ec1,logicalSessionId:91e3ff5f-eb6d-450b-9f23-9632c736dd69,documentGeneration:6}
schemaVersion: "1.0"
targets: [{target:{component:OrderRow},status:resolved,instances:12,source:/src/features/orders/orders-table.tsx}]
startedAt: 2026-11-19T03:53:22.142Z
expiresAt: 2026-11-19T03:58:22.155Z
request: {budget:{fiberLimit:250,operationLimit:20000,timeLimitMs:8,targetOperationReserve:4000,targetTimeReserveMs:4,adaptive:true},settle:{quietMs:500,timeoutMs:10000},maxDurationMs:300000,allowOverrides:false}
# exit code: 0
```

```console
$ agent-browser --session art-l5 click 'button[aria-label="Actions for SO-105999"]'
✓ Done
# exit code: 0
```

```console
$ agent-browser --session art-l5 find role menuitem click --name 'Put on hold'
✓ Done
# exit code: 0
```

```console
$ agent-browser --session art-l5 wait 1500
✓ Done
# exit code: 0
```

```console
$ npx genie-react verify end vfy_3bbabc5d-9307-4502-943e-97ee8f8849d7 --session art-l5
pass vfy_3bbabc5d-9307-4502-943e-97ee8f8849d7 "put one order on hold"  10 commits, quiet after 924 ms (react, query, router)
  url "http://127.0.0.1:5215/orders?sort=placedAt&dir=desc"
  1 pass render OrderRow only props.order  {renders:2,events:2,violatingEvents:0,causes:[props.order]}
      claim: {kind:render-causes,target:{component:OrderRow},allow:[{kind:props,name:order}]}
      deciding: [{kind:render-event,renderEventId:render:19:65,documentCommitId:19,mountId:mount:2,causes:[{cause:props.order,evidence:exact}]},{kind:render-event,renderEventId:render:16:16,documentCommitId:16,mountId:mount:2,causes:[{cause:props.order,evidence:exact}]}]
  2 pass render OrderRow min 1  {renders:2,mounts:0,updates:2,remounts:0,semantics:exact,instances:12,activeInstances:12}
      claim: {kind:renders,target:{component:OrderRow},min:1,counting:renders,allowRemount:false}
      deciding: [{kind:instance,mountId:mount:2,key:o-105999,renders:2,mounts:0,updates:2,mountGeneration:1,latestDocumentCommitId:19,source:/src/features/orders/orders-table.tsx:119:17}]
  3 pass boundaries clean  {caughtDuringWindow:0,caughtAtEnd:0}
      claim: {kind:boundaries-clean,scope:window}
      deciding: [{kind:boundary-log,scope:window,complete:true,afterDocumentCommitId:12}]
      caveats: [uncaught-errors-outside-boundaries-unobserved]
window: {observationId:observation:1,startDocumentCommitId:12,settledDocumentCommitId:21,frozenDocumentCommitId:22,commits:10,settle:{outcome:met,quietMs:500,timeoutMs:10000,waitedMs:924,domains:{react:met,query:met,router:met}},tail:{ms:500,commits:1},environment:{bundle:development,strictMode:on,renderCollection:available,visibility:document}}
! ui-outcome-not-observed: Genie does not check the screen; confirm it with the UI driver
attempt 2 for these claims on this tab; previous fail vfy_2dbfa57a-44c7-4efc-b956-475e5f2b3eab; document reloaded since
evidence: $ pnpm exec genie-react verify show vfy_3bbabc5d-9307-4502-943e-97ee8f8849d7 --session art-l5
session: {sessionId:9bd9a93b-8991-46b2-b75b-e7acae612ec1,logicalSessionId:91e3ff5f-eb6d-450b-9f23-9632c736dd69,documentGeneration:6}
schemaVersion: "1.0"
exitCode: 0
stage: end
ledger: {fingerprint:cf_75872ee88939,scope:logical-session,storage:memory,attempt:2,history:[{verificationId:vfy_2dbfa57a-44c7-4efc-b956-475e5f2b3eab,verdict:fail,reasons:[],endedAt:2026-11-19T03:52:52.215Z}],codeChangedSincePrevious:document-reloaded,failsOnSameCode:0}
evidence: {retained:true,tools:[react_get_renders,react_component_cohort,react_list_overrides,query_is_fetching,react_refresh_events,browser_visibility,react_profile_stop,react_render_causes,react_error_state]}
startedAt: 2026-11-19T03:53:22.142Z
endedAt: 2026-11-19T03:53:25.436Z
request: {budget:{fiberLimit:250,operationLimit:20000,timeLimitMs:8,targetOperationReserve:4000,targetTimeReserveMs:4,adaptive:true},settle:{quietMs:500,timeoutMs:10000},maxDurationMs:300000,allowOverrides:false}
# exit code: 0
```

```console
$ agent-browser --session art-l5 get text '[data-order-id="o-105999"]'
SO-105999
Delta Health 5
On hold
standard
EMEA
40
Mar 2, 2026
$8,624.19
# exit code: 0
```

```console
$ git checkout -- src/features/orders/order-row.tsx src/features/orders/orders-table.tsx && git status --short
## t3/articles-verify-proof
# exit code: 0
```

## Re-run on Genie 1.1.0

- Date: 2026-11-19 (runs between 08:55 and 08:57 UTC)
- Commit: `ce408cb205c0e798cb04c35512772b7454283141` (`git rev-parse HEAD`, first command below)
- App: `apps/realworld-dashboard` (Meridian Ops), dev server started from the app folder with
  `DASHBOARD_PORT=5232 pnpm exec vite --port 5232 --strictPort`
- URL: `http://127.0.0.1:5232/orders` (redirects to `/orders?sort=placedAt&dir=desc`)
- Genie: CLI, hub and runtime 1.1.0 from this checkout (`pnpm install && pnpm build`), React 19.3.1
  development build in StrictMode, headless Chromium through agent-browser 0.39.1
- Session: `upd-b`

Every command below ran from `apps/realworld-dashboard`, in this order. Output is untrimmed. Steps
that are not shell commands are noted here: waits of 1 to 3 seconds after each `open` and after
the source edit, and the temporary source edit itself, which was applied with a script and is
shown by the `git diff` run that follows it. The edit is the reference fix from
`evals/realworld/dashboard/order-hold-rerenders-all-rows.json`. It was reverted with
`git checkout` (first command of the re-run in the evidence for
`the-fix-that-passed-and-changed-nothing`, which ran right after these commands on the same tab)
and never committed.

The first `verify begin` below uses the claim `render OrderRow only props.order` from the 1.0.2
run. It was ended without an interaction, and the run started again with
`render OrderRow only props.order,mount`, the form the 1.1.0 skill and the Verify a fix guide use.
That first window is kept here because it is part of the session's history. Its `min 1` claim
failed with 0 renders, as a window with no interaction should.

What differs from the 1.0.2 run:

- `verify begin` prints each undecided claim as `recording`, not `null`, with no `{}` after it.
- Suggested `next` and `evidence` commands start with `npx`, the runner used, not `pnpm exec`.
- Settle also waits on the `network` domain, so the verdict line ends with
  `(react, query, router, network)`.
- After the code edit and the reload, the passing run is `attempt 2` with the failing run in its
  history, under the same ledger fingerprint `cf_75576ea0e0d8`.
- Fail: 24 renders, all 24 violating, exit 1, as in 1.0.2. Pass: 2 renders, both
  `props.order`, exit 0, as in 1.0.2.

```console
$ git rev-parse HEAD
ce408cb205c0e798cb04c35512772b7454283141
# exit code: 0
```

```console
$ node_modules/.bin/genie-react --version
1.1.0
# exit code: 0
```

```console
$ agent-browser --session upd-b open 'http://127.0.0.1:5232/login'
[agent-browser] launched browser
✓ Meridian Ops
  http://127.0.0.1:5232/login
# exit code: 0
```

```console
$ npx genie-react status --session upd-b --wait 15000
selectedBridgeUrl: ws://127.0.0.1:5232/__genie/ws
sessionSelector:
  requested: upd-b
  source: flag
  resolvedSessionId: bd1c12b4-9dc5-417e-af64-a443e2527bba
  implicit: false
  agentBrowser: {session:upd-b,via:selector,logicalSessionId:87a7df47-883d-40a5-82f6-5a2af5d0d6e9}
connected: true
ready: true
sessionId: bd1c12b4-9dc5-417e-af64-a443e2527bba
app: {name:"Meridian Ops",url:http://127.0.0.1:5232/login,reactVersion:19.3.1,reactMounted:true}
domains: [session,react,app,memory,perf,plugin,timeline,network,router,query]
toolCount: 101
sessions[1] (sessionId {fields}):
  bd1c12b4-9dc5-417e-af64-a443e2527bba {logicalSessionId:87a7df47-883d-40a5-82f6-5a2af5d0d6e9,documentGeneration:2,logicalSessionCollision:false,collisionWithSessionIds:[],app:{name:"Meridian Ops",url:http://127.0.0.1:5232/login,reactVersion:19.3.1,reactMounted:true},domains:[session,react,app,memory,perf,plugin,timeline,network,router,query],toolCount:101,connectedAt:1795078543066,ready:true,readyAt:1795078543066,current:true,origin:http://127.0.0.1:5232,runtimeVersion:1.1.0}
warnings: []
hub: {version:1.1.0,protocol:1}
# exit code: 0
```

```console
$ npx genie-react call app_reset_backend '{}' --session upd-b
seed: 20260302
faults: []
latency: []
latencyScale: 1
requestCount: 0
counts: {orders:6000,customers:1200,products:2400}
# exit code: 0
```

```console
$ npx genie-react call app_login_as '{"role":"manager"}' --session upd-b
changed: true
role: manager
userId: u-manager
# exit code: 0
```

```console
$ agent-browser --session upd-b open 'http://127.0.0.1:5232/orders'
✓ Meridian Ops
  http://127.0.0.1:5232/orders?sort=placedAt&dir=desc
# exit code: 0
```

```console
$ agent-browser --session upd-b get text '[data-order-id="o-105999"]'
SO-105999
Delta Health 5
Processing
standard
EMEA
40
Mar 2, 2026
$8,624.19
# exit code: 0
```

```console
$ npx genie-react verify begin --session upd-b --name 'put one order on hold' --claim 'render OrderRow only props.order' --claim 'render OrderRow min 1' --claim 'boundaries clean'
recording vfy_205b3518-b318-45ac-adf6-f16999957be9 "put one order on hold"
  url "http://127.0.0.1:5232/orders?sort=placedAt&dir=desc"
  1 recording render OrderRow only props.order
  2 recording render OrderRow min 1
  3 recording boundaries clean
window: {observationId:observation:1,startDocumentCommitId:9,domains:[react,query,router,network],quietMs:500,timeoutMs:10000,tailMs:500}
next: $ npx genie-react verify end vfy_205b3518-b318-45ac-adf6-f16999957be9 --session upd-b
session: {sessionId:21f42563-1025-4b55-a3f1-a11b6735a7df,logicalSessionId:87a7df47-883d-40a5-82f6-5a2af5d0d6e9,documentGeneration:3}
schemaVersion: "1.0"
targets: [{target:{component:OrderRow},status:resolved,instances:12,source:/src/features/orders/orders-table.tsx}]
startedAt: 2026-11-19T08:55:55.482Z
expiresAt: 2026-11-19T09:00:55.513Z
request: {budget:{fiberLimit:250,operationLimit:20000,timeLimitMs:8,targetOperationReserve:4000,targetTimeReserveMs:4,adaptive:true},settle:{quietMs:500,timeoutMs:10000},maxDurationMs:300000,allowOverrides:false}
# exit code: 0
```

```console
$ npx genie-react verify end vfy_205b3518-b318-45ac-adf6-f16999957be9 --session upd-b
fail vfy_205b3518-b318-45ac-adf6-f16999957be9 "put one order on hold"  12 commits, quiet after 735 ms (react, query, router, network)
  url "http://127.0.0.1:5232/orders?sort=placedAt&dir=desc"
  1 pass render OrderRow only props.order  {renders:0,events:0,violatingEvents:0,causes:[]}
      claim: {kind:render-causes,target:{component:OrderRow},allow:[{kind:props,name:order}]}
      deciding: []
  2 fail render OrderRow min 1  {renders:0,mounts:0,updates:0,remounts:0,semantics:exact,instances:12,activeInstances:12}
      claim: {kind:renders,target:{component:OrderRow},min:1,counting:renders,allowRemount:false}
      deciding: []
  3 pass boundaries clean  {caughtDuringWindow:0,caughtAtEnd:0}
      claim: {kind:boundaries-clean,scope:window}
      deciding: [{kind:boundary-log,scope:window,complete:true,afterDocumentCommitId:9}]
      caveats: [uncaught-errors-outside-boundaries-unobserved]
window: {observationId:observation:1,startDocumentCommitId:9,settledDocumentCommitId:20,frozenDocumentCommitId:21,commits:12,settle:{outcome:met,quietMs:500,timeoutMs:10000,waitedMs:735,domains:{react:met,query:met,router:met,network:met}},tail:{ms:500,commits:1},environment:{bundle:development,strictMode:on,renderCollection:available,visibility:document}}
! ui-outcome-not-observed: Genie does not check the screen; confirm it with the UI driver
attempt 1 for these claims on this tab
evidence: $ npx genie-react verify show vfy_205b3518-b318-45ac-adf6-f16999957be9 --claim 2 --session upd-b
session: {sessionId:21f42563-1025-4b55-a3f1-a11b6735a7df,logicalSessionId:87a7df47-883d-40a5-82f6-5a2af5d0d6e9,documentGeneration:3}
schemaVersion: "1.0"
exitCode: 1
stage: end
ledger: {fingerprint:cf_fb4a813530c4,scope:logical-session,storage:memory,attempt:1,history:[],codeChangedSincePrevious:null,failsOnSameCode:0}
evidence: {retained:true,tools:[react_get_renders,react_component_cohort,react_list_overrides,query_is_fetching,react_refresh_events,browser_visibility,request_watch_start,request_watch_stop,react_profile_stop,react_render_causes,react_error_state]}
startedAt: 2026-11-19T08:55:55.482Z
endedAt: 2026-11-19T08:56:07.811Z
request: {budget:{fiberLimit:250,operationLimit:20000,timeLimitMs:8,targetOperationReserve:4000,targetTimeReserveMs:4,adaptive:true},settle:{quietMs:500,timeoutMs:10000},maxDurationMs:300000,allowOverrides:false}
# exit code: 1
```

```console
$ npx genie-react verify begin --session upd-b --name 'put one order on hold' --claim 'render OrderRow only props.order,mount' --claim 'render OrderRow min 1' --claim 'boundaries clean'
recording vfy_6079298e-51e7-4e78-ab1b-d81729b841bc "put one order on hold"
  url "http://127.0.0.1:5232/orders?sort=placedAt&dir=desc"
  1 recording render OrderRow only props.order,mount
  2 recording render OrderRow min 1
  3 recording boundaries clean
window: {observationId:observation:2,startDocumentCommitId:22,domains:[react,query,router,network],quietMs:500,timeoutMs:10000,tailMs:500}
next: $ npx genie-react verify end vfy_6079298e-51e7-4e78-ab1b-d81729b841bc --session upd-b
session: {sessionId:21f42563-1025-4b55-a3f1-a11b6735a7df,logicalSessionId:87a7df47-883d-40a5-82f6-5a2af5d0d6e9,documentGeneration:3}
schemaVersion: "1.0"
targets: [{target:{component:OrderRow},status:resolved,instances:12,source:/src/features/orders/orders-table.tsx}]
startedAt: 2026-11-19T08:56:09.079Z
expiresAt: 2026-11-19T09:01:09.083Z
request: {budget:{fiberLimit:250,operationLimit:20000,timeLimitMs:8,targetOperationReserve:4000,targetTimeReserveMs:4,adaptive:true},settle:{quietMs:500,timeoutMs:10000},maxDurationMs:300000,allowOverrides:false}
# exit code: 0
```

```console
$ agent-browser --session upd-b click 'button[aria-label="Actions for SO-105999"]'
✓ Done
# exit code: 0
```

```console
$ agent-browser --session upd-b find role menuitem click --name 'Put on hold'
✓ Done
# exit code: 0
```

```console
$ agent-browser --session upd-b wait 1500
✓ Done
# exit code: 0
```

```console
$ npx genie-react verify end vfy_6079298e-51e7-4e78-ab1b-d81729b841bc --session upd-b
fail vfy_6079298e-51e7-4e78-ab1b-d81729b841bc "put one order on hold"  15 commits, quiet after 2042 ms (react, query, router, network)
  url "http://127.0.0.1:5232/orders?sort=placedAt&dir=desc"
  1 fail render OrderRow only props.order,mount  {renders:24,events:24,violatingEvents:24,causes:[props.onStatusChange,props.order]}
      claim: {kind:render-causes,target:{component:OrderRow},allow:[{kind:props,name:order},{kind:mount}]}
      deciding: [{kind:render-event,renderEventId:render:34:226,documentCommitId:34,mountId:mount:12,causes:[{cause:props.onStatusChange,evidence:exact}]},{kind:render-event,renderEventId:render:34:225,documentCommitId:34,mountId:mount:11,causes:[{cause:props.onStatusChange,evidence:exact}]},{kind:render-event,renderEventId:render:34:224,documentCommitId:34,mountId:mount:10,causes:[{cause:props.onStatusChange,evidence:exact}]}]
  2 pass render OrderRow min 1  {renders:24,mounts:0,updates:24,remounts:0,semantics:exact,instances:12,activeInstances:12}
      claim: {kind:renders,target:{component:OrderRow},min:1,counting:renders,allowRemount:false}
      deciding: [{kind:instance,mountId:mount:1,key:o-106000,renders:2,mounts:0,updates:2,mountGeneration:1,latestDocumentCommitId:34,source:/src/features/orders/orders-table.tsx:121:17},{kind:instance,mountId:mount:2,key:o-105999,renders:2,mounts:0,updates:2,mountGeneration:1,latestDocumentCommitId:34,source:/src/features/orders/orders-table.tsx:121:17},{kind:instance,mountId:mount:3,key:o-105998,renders:2,mounts:0,updates:2,mountGeneration:1,latestDocumentCommitId:34,source:/src/features/orders/orders-table.tsx:121:17}]
  3 pass boundaries clean  {caughtDuringWindow:0,caughtAtEnd:0}
      claim: {kind:boundaries-clean,scope:window}
      deciding: [{kind:boundary-log,scope:window,complete:true,afterDocumentCommitId:22}]
      caveats: [uncaught-errors-outside-boundaries-unobserved]
window: {observationId:observation:2,startDocumentCommitId:22,settledDocumentCommitId:36,frozenDocumentCommitId:37,commits:15,settle:{outcome:met,quietMs:500,timeoutMs:10000,waitedMs:2042,domains:{react:met,query:met,router:met,network:met}},tail:{ms:500,commits:1},environment:{bundle:development,strictMode:on,renderCollection:available,visibility:document}}
! ui-outcome-not-observed: Genie does not check the screen; confirm it with the UI driver
attempt 1 for these claims on this tab
evidence: $ npx genie-react verify show vfy_6079298e-51e7-4e78-ab1b-d81729b841bc --claim 1 --session upd-b
session: {sessionId:21f42563-1025-4b55-a3f1-a11b6735a7df,logicalSessionId:87a7df47-883d-40a5-82f6-5a2af5d0d6e9,documentGeneration:3}
schemaVersion: "1.0"
exitCode: 1
stage: end
ledger: {fingerprint:cf_75576ea0e0d8,scope:logical-session,storage:memory,attempt:1,history:[],codeChangedSincePrevious:null,failsOnSameCode:0}
evidence: {retained:true,tools:[react_get_renders,react_component_cohort,react_list_overrides,query_is_fetching,react_refresh_events,browser_visibility,request_watch_start,request_watch_stop,react_profile_stop,react_render_causes,react_error_state]}
startedAt: 2026-11-19T08:56:09.079Z
endedAt: 2026-11-19T08:56:18.297Z
request: {budget:{fiberLimit:250,operationLimit:20000,timeLimitMs:8,targetOperationReserve:4000,targetTimeReserveMs:4,adaptive:true},settle:{quietMs:500,timeoutMs:10000},maxDurationMs:300000,allowOverrides:false}
# exit code: 1
```

```console
$ agent-browser --session upd-b get text '[data-order-id="o-105999"]'
SO-105999
Delta Health 5
On hold
standard
EMEA
40
Mar 2, 2026
$8,624.19
# exit code: 0
```

```console
$ npx genie-react verify show vfy_6079298e-51e7-4e78-ab1b-d81729b841bc --claim 1 --session upd-b
verificationId: vfy_6079298e-51e7-4e78-ab1b-d81729b841bc
verdict: fail
claim:
  index: 1
  text: "render OrderRow only props.order,mount"
  claim:
    kind: render-causes
    target: {component:OrderRow}
    allow: [{kind:props,name:order},{kind:mount}]
  verdict: fail
  observed: {renders:24,events:24,violatingEvents:24,causes:[props.onStatusChange,props.order]}
  deciding[3]:
    each: {kind:render-event,documentCommitId:34,causes:[{cause:props.onStatusChange,evidence:exact}]}
    - {renderEventId:render:34:226,mountId:mount:12}
    - {renderEventId:render:34:225,mountId:mount:11}
    - {renderEventId:render:34:224,mountId:mount:10}
  caveats: []
evidence:
  records[12]:
    each: {mountGeneration:1,mountGenerationEvidence:exact,renders:2,mounts:0,updates:2,unmounted:false,latestDocumentCommitId:34,sourceFile:/src/features/orders/orders-table.tsx,sourceLocation:/src/features/orders/orders-table.tsx:121:17}
    - {mountId:mount:1,key:o-106000,logicalPath:"QueryClientProvider[index=0] > AuthProvider[index=0] > App[index=0] > RouterProvider[index=0] > RouterContextProvider[index=0] > Matches[index=0] > MatchesInner[index=0] > CatchBoundary[index=0] > MatchImpl[index=0] > MatchView[index=0] > CatchBoundary[index=0] > CatchNotFound[index=0] > CatchBoundary[index=0] > MatchInnerImpl[index=0] > RootLayout[index=0] > OutletImpl[index=0] > MatchImpl[index=0] > MatchView[index=0] > CatchBoundary[index=0] > MatchInnerImpl[index=0] > Lazy[index=0] > AuthenticatedLayout[index=0] > PermissionsProvider[index=0] > AppShell[index=0] > PreferencesProvider[index=0] > <div>[index=0] > <div>[index=1] > <main>[index=1] > OutletImpl[index=0] > MatchImpl[index=0] > MatchView[index=0] > CatchBoundary[index=0] > MatchInnerImpl[index=0] > Lazy[index=0] > OrdersPage[index=0] > <div>[index=0] > OrdersTable[index=3] > <div>[index=0] > <div>[index=1] > <div>[index=0] > OrderRow[key=\"o-106000\"]"}
    - {mountId:mount:2,key:o-105999,logicalPath:"QueryClientProvider[index=0] > AuthProvider[index=0] > App[index=0] > RouterProvider[index=0] > RouterContextProvider[index=0] > Matches[index=0] > MatchesInner[index=0] > CatchBoundary[index=0] > MatchImpl[index=0] > MatchView[index=0] > CatchBoundary[index=0] > CatchNotFound[index=0] > CatchBoundary[index=0] > MatchInnerImpl[index=0] > RootLayout[index=0] > OutletImpl[index=0] > MatchImpl[index=0] > MatchView[index=0] > CatchBoundary[index=0] > MatchInnerImpl[index=0] > Lazy[index=0] > AuthenticatedLayout[index=0] > PermissionsProvider[index=0] > AppShell[index=0] > PreferencesProvider[index=0] > <div>[index=0] > <div>[index=1] > <main>[index=1] > OutletImpl[index=0] > MatchImpl[index=0] > MatchView[index=0] > CatchBoundary[index=0] > MatchInnerImpl[index=0] > Lazy[index=0] > OrdersPage[index=0] > <div>[index=0] > OrdersTable[index=3] > <div>[index=0] > <div>[index=1] > <div>[index=0] > OrderRow[key=\"o-105999\"]"}
    - {mountId:mount:3,key:o-105998,logicalPath:"QueryClientProvider[index=0] > AuthProvider[index=0] > App[index=0] > RouterProvider[index=0] > RouterContextProvider[index=0] > Matches[index=0] > MatchesInner[index=0] > CatchBoundary[index=0] > MatchImpl[index=0] > MatchView[index=0] > CatchBoundary[index=0] > CatchNotFound[index=0] > CatchBoundary[index=0] > MatchInnerImpl[index=0] > RootLayout[index=0] > OutletImpl[index=0] > MatchImpl[index=0] > MatchView[index=0] > CatchBoundary[index=0] > MatchInnerImpl[index=0] > Lazy[index=0] > AuthenticatedLayout[index=0] > PermissionsProvider[index=0] > AppShell[index=0] > PreferencesProvider[index=0] > <div>[index=0] > <div>[index=1] > <main>[index=1] > OutletImpl[index=0] > MatchImpl[index=0] > MatchView[index=0] > CatchBoundary[index=0] > MatchInnerImpl[index=0] > Lazy[index=0] > OrdersPage[index=0] > <div>[index=0] > OrdersTable[index=3] > <div>[index=0] > <div>[index=1] > <div>[index=0] > OrderRow[key=\"o-105998\"]"}
    - {mountId:mount:4,key:o-105997,logicalPath:"QueryClientProvider[index=0] > AuthProvider[index=0] > App[index=0] > RouterProvider[index=0] > RouterContextProvider[index=0] > Matches[index=0] > MatchesInner[index=0] > CatchBoundary[index=0] > MatchImpl[index=0] > MatchView[index=0] > CatchBoundary[index=0] > CatchNotFound[index=0] > CatchBoundary[index=0] > MatchInnerImpl[index=0] > RootLayout[index=0] > OutletImpl[index=0] > MatchImpl[index=0] > MatchView[index=0] > CatchBoundary[index=0] > MatchInnerImpl[index=0] > Lazy[index=0] > AuthenticatedLayout[index=0] > PermissionsProvider[index=0] > AppShell[index=0] > PreferencesProvider[index=0] > <div>[index=0] > <div>[index=1] > <main>[index=1] > OutletImpl[index=0] > MatchImpl[index=0] > MatchView[index=0] > CatchBoundary[index=0] > MatchInnerImpl[index=0] > Lazy[index=0] > OrdersPage[index=0] > <div>[index=0] > OrdersTable[index=3] > <div>[index=0] > <div>[index=1] > <div>[index=0] > OrderRow[key=\"o-105997\"]"}
    - {mountId:mount:5,key:o-105996,logicalPath:"QueryClientProvider[index=0] > AuthProvider[index=0] > App[index=0] > RouterProvider[index=0] > RouterContextProvider[index=0] > Matches[index=0] > MatchesInner[index=0] > CatchBoundary[index=0] > MatchImpl[index=0] > MatchView[index=0] > CatchBoundary[index=0] > CatchNotFound[index=0] > CatchBoundary[index=0] > MatchInnerImpl[index=0] > RootLayout[index=0] > OutletImpl[index=0] > MatchImpl[index=0] > MatchView[index=0] > CatchBoundary[index=0] > MatchInnerImpl[index=0] > Lazy[index=0] > AuthenticatedLayout[index=0] > PermissionsProvider[index=0] > AppShell[index=0] > PreferencesProvider[index=0] > <div>[index=0] > <div>[index=1] > <main>[index=1] > OutletImpl[index=0] > MatchImpl[index=0] > MatchView[index=0] > CatchBoundary[index=0] > MatchInnerImpl[index=0] > Lazy[index=0] > OrdersPage[index=0] > <div>[index=0] > OrdersTable[index=3] > <div>[index=0] > <div>[index=1] > <div>[index=0] > OrderRow[key=\"o-105996\"]"}
    - {mountId:mount:6,key:o-105995,logicalPath:"QueryClientProvider[index=0] > AuthProvider[index=0] > App[index=0] > RouterProvider[index=0] > RouterContextProvider[index=0] > Matches[index=0] > MatchesInner[index=0] > CatchBoundary[index=0] > MatchImpl[index=0] > MatchView[index=0] > CatchBoundary[index=0] > CatchNotFound[index=0] > CatchBoundary[index=0] > MatchInnerImpl[index=0] > RootLayout[index=0] > OutletImpl[index=0] > MatchImpl[index=0] > MatchView[index=0] > CatchBoundary[index=0] > MatchInnerImpl[index=0] > Lazy[index=0] > AuthenticatedLayout[index=0] > PermissionsProvider[index=0] > AppShell[index=0] > PreferencesProvider[index=0] > <div>[index=0] > <div>[index=1] > <main>[index=1] > OutletImpl[index=0] > MatchImpl[index=0] > MatchView[index=0] > CatchBoundary[index=0] > MatchInnerImpl[index=0] > Lazy[index=0] > OrdersPage[index=0] > <div>[index=0] > OrdersTable[index=3] > <div>[index=0] > <div>[index=1] > <div>[index=0] > OrderRow[key=\"o-105995\"]"}
    - {mountId:mount:7,key:o-105994,logicalPath:"QueryClientProvider[index=0] > AuthProvider[index=0] > App[index=0] > RouterProvider[index=0] > RouterContextProvider[index=0] > Matches[index=0] > MatchesInner[index=0] > CatchBoundary[index=0] > MatchImpl[index=0] > MatchView[index=0] > CatchBoundary[index=0] > CatchNotFound[index=0] > CatchBoundary[index=0] > MatchInnerImpl[index=0] > RootLayout[index=0] > OutletImpl[index=0] > MatchImpl[index=0] > MatchView[index=0] > CatchBoundary[index=0] > MatchInnerImpl[index=0] > Lazy[index=0] > AuthenticatedLayout[index=0] > PermissionsProvider[index=0] > AppShell[index=0] > PreferencesProvider[index=0] > <div>[index=0] > <div>[index=1] > <main>[index=1] > OutletImpl[index=0] > MatchImpl[index=0] > MatchView[index=0] > CatchBoundary[index=0] > MatchInnerImpl[index=0] > Lazy[index=0] > OrdersPage[index=0] > <div>[index=0] > OrdersTable[index=3] > <div>[index=0] > <div>[index=1] > <div>[index=0] > OrderRow[key=\"o-105994\"]"}
    - {mountId:mount:8,key:o-105993,logicalPath:"QueryClientProvider[index=0] > AuthProvider[index=0] > App[index=0] > RouterProvider[index=0] > RouterContextProvider[index=0] > Matches[index=0] > MatchesInner[index=0] > CatchBoundary[index=0] > MatchImpl[index=0] > MatchView[index=0] > CatchBoundary[index=0] > CatchNotFound[index=0] > CatchBoundary[index=0] > MatchInnerImpl[index=0] > RootLayout[index=0] > OutletImpl[index=0] > MatchImpl[index=0] > MatchView[index=0] > CatchBoundary[index=0] > MatchInnerImpl[index=0] > Lazy[index=0] > AuthenticatedLayout[index=0] > PermissionsProvider[index=0] > AppShell[index=0] > PreferencesProvider[index=0] > <div>[index=0] > <div>[index=1] > <main>[index=1] > OutletImpl[index=0] > MatchImpl[index=0] > MatchView[index=0] > CatchBoundary[index=0] > MatchInnerImpl[index=0] > Lazy[index=0] > OrdersPage[index=0] > <div>[index=0] > OrdersTable[index=3] > <div>[index=0] > <div>[index=1] > <div>[index=0] > OrderRow[key=\"o-105993\"]"}
    - {mountId:mount:9,key:o-105992,logicalPath:"QueryClientProvider[index=0] > AuthProvider[index=0] > App[index=0] > RouterProvider[index=0] > RouterContextProvider[index=0] > Matches[index=0] > MatchesInner[index=0] > CatchBoundary[index=0] > MatchImpl[index=0] > MatchView[index=0] > CatchBoundary[index=0] > CatchNotFound[index=0] > CatchBoundary[index=0] > MatchInnerImpl[index=0] > RootLayout[index=0] > OutletImpl[index=0] > MatchImpl[index=0] > MatchView[index=0] > CatchBoundary[index=0] > MatchInnerImpl[index=0] > Lazy[index=0] > AuthenticatedLayout[index=0] > PermissionsProvider[index=0] > AppShell[index=0] > PreferencesProvider[index=0] > <div>[index=0] > <div>[index=1] > <main>[index=1] > OutletImpl[index=0] > MatchImpl[index=0] > MatchView[index=0] > CatchBoundary[index=0] > MatchInnerImpl[index=0] > Lazy[index=0] > OrdersPage[index=0] > <div>[index=0] > OrdersTable[index=3] > <div>[index=0] > <div>[index=1] > <div>[index=0] > OrderRow[key=\"o-105992\"]"}
    - {mountId:mount:10,key:o-105991,logicalPath:"QueryClientProvider[index=0] > AuthProvider[index=0] > App[index=0] > RouterProvider[index=0] > RouterContextProvider[index=0] > Matches[index=0] > MatchesInner[index=0] > CatchBoundary[index=0] > MatchImpl[index=0] > MatchView[index=0] > CatchBoundary[index=0] > CatchNotFound[index=0] > CatchBoundary[index=0] > MatchInnerImpl[index=0] > RootLayout[index=0] > OutletImpl[index=0] > MatchImpl[index=0] > MatchView[index=0] > CatchBoundary[index=0] > MatchInnerImpl[index=0] > Lazy[index=0] > AuthenticatedLayout[index=0] > PermissionsProvider[index=0] > AppShell[index=0] > PreferencesProvider[index=0] > <div>[index=0] > <div>[index=1] > <main>[index=1] > OutletImpl[index=0] > MatchImpl[index=0] > MatchView[index=0] > CatchBoundary[index=0] > MatchInnerImpl[index=0] > Lazy[index=0] > OrdersPage[index=0] > <div>[index=0] > OrdersTable[index=3] > <div>[index=0] > <div>[index=1] > <div>[index=0] > OrderRow[key=\"o-105991\"]"}
    - {mountId:mount:11,key:o-105990,logicalPath:"QueryClientProvider[index=0] > AuthProvider[index=0] > App[index=0] > RouterProvider[index=0] > RouterContextProvider[index=0] > Matches[index=0] > MatchesInner[index=0] > CatchBoundary[index=0] > MatchImpl[index=0] > MatchView[index=0] > CatchBoundary[index=0] > CatchNotFound[index=0] > CatchBoundary[index=0] > MatchInnerImpl[index=0] > RootLayout[index=0] > OutletImpl[index=0] > MatchImpl[index=0] > MatchView[index=0] > CatchBoundary[index=0] > MatchInnerImpl[index=0] > Lazy[index=0] > AuthenticatedLayout[index=0] > PermissionsProvider[index=0] > AppShell[index=0] > PreferencesProvider[index=0] > <div>[index=0] > <div>[index=1] > <main>[index=1] > OutletImpl[index=0] > MatchImpl[index=0] > MatchView[index=0] > CatchBoundary[index=0] > MatchInnerImpl[index=0] > Lazy[index=0] > OrdersPage[index=0] > <div>[index=0] > OrdersTable[index=3] > <div>[index=0] > <div>[index=1] > <div>[index=0] > OrderRow[key=\"o-105990\"]"}
    - {mountId:mount:12,key:o-105989,logicalPath:"QueryClientProvider[index=0] > AuthProvider[index=0] > App[index=0] > RouterProvider[index=0] > RouterContextProvider[index=0] > Matches[index=0] > MatchesInner[index=0] > CatchBoundary[index=0] > MatchImpl[index=0] > MatchView[index=0] > CatchBoundary[index=0] > CatchNotFound[index=0] > CatchBoundary[index=0] > MatchInnerImpl[index=0] > RootLayout[index=0] > OutletImpl[index=0] > MatchImpl[index=0] > MatchView[index=0] > CatchBoundary[index=0] > MatchInnerImpl[index=0] > Lazy[index=0] > AuthenticatedLayout[index=0] > PermissionsProvider[index=0] > AppShell[index=0] > PreferencesProvider[index=0] > <div>[index=0] > <div>[index=1] > <main>[index=1] > OutletImpl[index=0] > MatchImpl[index=0] > MatchView[index=0] > CatchBoundary[index=0] > MatchInnerImpl[index=0] > Lazy[index=0] > OrdersPage[index=0] > <div>[index=0] > OrdersTable[index=3] > <div>[index=0] > <div>[index=1] > <div>[index=0] > OrderRow[key=\"o-105989\"]"}
  events[24]:
    each: {inputCoverageComplete:true}
    - {renderEventId:render:34:226,documentCommitId:34,mountId:mount:12,causes:[{kind:props,evidence:exact,name:onStatusChange,reason:null}]}
    - {renderEventId:render:34:225,documentCommitId:34,mountId:mount:11,causes:[{kind:props,evidence:exact,name:onStatusChange,reason:null}]}
    - {renderEventId:render:34:224,documentCommitId:34,mountId:mount:10,causes:[{kind:props,evidence:exact,name:onStatusChange,reason:null}]}
    - {renderEventId:render:34:223,documentCommitId:34,mountId:mount:9,causes:[{kind:props,evidence:exact,name:onStatusChange,reason:null}]}
    - {renderEventId:render:34:222,documentCommitId:34,mountId:mount:8,causes:[{kind:props,evidence:exact,name:onStatusChange,reason:null}]}
    - {renderEventId:render:34:221,documentCommitId:34,mountId:mount:7,causes:[{kind:props,evidence:exact,name:onStatusChange,reason:null}]}
    - {renderEventId:render:34:220,documentCommitId:34,mountId:mount:6,causes:[{kind:props,evidence:exact,name:onStatusChange,reason:null}]}
    - {renderEventId:render:34:219,documentCommitId:34,mountId:mount:5,causes:[{kind:props,evidence:exact,name:onStatusChange,reason:null}]}
    - {renderEventId:render:34:218,documentCommitId:34,mountId:mount:4,causes:[{kind:props,evidence:exact,name:onStatusChange,reason:null}]}
    - {renderEventId:render:34:217,documentCommitId:34,mountId:mount:3,causes:[{kind:props,evidence:exact,name:onStatusChange,reason:null}]}
    - {renderEventId:render:34:216,documentCommitId:34,mountId:mount:2,causes:[{kind:props,evidence:exact,name:order,reason:null},{kind:props,evidence:exact,name:onStatusChange,reason:null}]}
    - {renderEventId:render:34:215,documentCommitId:34,mountId:mount:1,causes:[{kind:props,evidence:exact,name:onStatusChange,reason:null}]}
    - {renderEventId:render:31:78,documentCommitId:31,mountId:mount:12,causes:[{kind:props,evidence:exact,name:onStatusChange,reason:null}]}
    - {renderEventId:render:31:77,documentCommitId:31,mountId:mount:11,causes:[{kind:props,evidence:exact,name:onStatusChange,reason:null}]}
    - {renderEventId:render:31:76,documentCommitId:31,mountId:mount:10,causes:[{kind:props,evidence:exact,name:onStatusChange,reason:null}]}
    - {renderEventId:render:31:75,documentCommitId:31,mountId:mount:9,causes:[{kind:props,evidence:exact,name:onStatusChange,reason:null}]}
    - {renderEventId:render:31:74,documentCommitId:31,mountId:mount:8,causes:[{kind:props,evidence:exact,name:onStatusChange,reason:null}]}
    - {renderEventId:render:31:73,documentCommitId:31,mountId:mount:7,causes:[{kind:props,evidence:exact,name:onStatusChange,reason:null}]}
    - {renderEventId:render:31:72,documentCommitId:31,mountId:mount:6,causes:[{kind:props,evidence:exact,name:onStatusChange,reason:null}]}
    - {renderEventId:render:31:71,documentCommitId:31,mountId:mount:5,causes:[{kind:props,evidence:exact,name:onStatusChange,reason:null}]}
    - {renderEventId:render:31:70,documentCommitId:31,mountId:mount:4,causes:[{kind:props,evidence:exact,name:onStatusChange,reason:null}]}
    - {renderEventId:render:31:69,documentCommitId:31,mountId:mount:3,causes:[{kind:props,evidence:exact,name:onStatusChange,reason:null}]}
    - {renderEventId:render:31:68,documentCommitId:31,mountId:mount:2,causes:[{kind:props,evidence:exact,name:order,reason:null},{kind:props,evidence:exact,name:onStatusChange,reason:null}]}
    - {renderEventId:render:31:67,documentCommitId:31,mountId:mount:1,causes:[{kind:props,evidence:exact,name:onStatusChange,reason:null}]}
  effects: null
  beginInstances[12]:
    each: {renderingState:mounted-rendering,sourceFile:/src/features/orders/orders-table.tsx,sourceLocation:/src/features/orders/orders-table.tsx:121:17}
    - {mountId:mount:1,key:o-106000}
    - {mountId:mount:2,key:o-105999}
    - {mountId:mount:3,key:o-105998}
    - {mountId:mount:4,key:o-105997}
    - {mountId:mount:5,key:o-105996}
    - {mountId:mount:6,key:o-105995}
    - {mountId:mount:7,key:o-105994}
    - {mountId:mount:8,key:o-105993}
    - {mountId:mount:9,key:o-105992}
    - {mountId:mount:10,key:o-105991}
    - {mountId:mount:11,key:o-105990}
    - {mountId:mount:12,key:o-105989}
  endInstances[12]:
    each: {renderingState:mounted-rendering,sourceFile:/src/features/orders/orders-table.tsx,sourceLocation:/src/features/orders/orders-table.tsx:121:17}
    - {mountId:mount:1,key:o-106000}
    - {mountId:mount:2,key:o-105999}
    - {mountId:mount:3,key:o-105998}
    - {mountId:mount:4,key:o-105997}
    - {mountId:mount:5,key:o-105996}
    - {mountId:mount:6,key:o-105995}
    - {mountId:mount:7,key:o-105994}
    - {mountId:mount:8,key:o-105993}
    - {mountId:mount:9,key:o-105992}
    - {mountId:mount:10,key:o-105991}
    - {mountId:mount:11,key:o-105990}
    - {mountId:mount:12,key:o-105989}
evidenceRetained: true
# exit code: 0
```

```console
$ git diff -- src/features/orders
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
index 90c16f4..288cd5b 100644
--- a/apps/realworld-dashboard/src/features/orders/orders-table.tsx
+++ b/apps/realworld-dashboard/src/features/orders/orders-table.tsx
@@ -40,11 +40,9 @@ export function OrdersTable({
     [hiddenColumns],
   )
   const onStatusChange = useCallback(
-    (id: string, status: OrderSummary['status']) => {
-      const order = rows.find((row) => row.id === id)
-      if (order) changeStatus({ id, number: order.number, status })
-    },
-    [rows, changeStatus],
+    (order: OrderSummary, status: OrderSummary['status']) =>
+      changeStatus({ id: order.id, number: order.number, status }),
+    [changeStatus],
   )
 
   const virtualizer = useVirtualizer({
# exit code: 0
```

```console
$ npx tsc --noEmit -p . && echo typecheck ok
typecheck ok
# exit code: 0
```

```console
$ npx genie-react call app_reset_backend '{}' --session upd-b
seed: 20260302
faults: []
latency: []
latencyScale: 1
requestCount: 0
counts: {orders:6000,customers:1200,products:2400}
# exit code: 0
```

```console
$ agent-browser --session upd-b open 'http://127.0.0.1:5232/orders'
✓ Meridian Ops
  http://127.0.0.1:5232/orders?sort=placedAt&dir=desc
# exit code: 0
```

```console
$ agent-browser --session upd-b get text '[data-order-id="o-105999"]'
SO-105999
Delta Health 5
Processing
standard
EMEA
40
Mar 2, 2026
$8,624.19
# exit code: 0
```

```console
$ npx genie-react verify begin --session upd-b --name 'put one order on hold' --claim 'render OrderRow only props.order,mount' --claim 'render OrderRow min 1' --claim 'boundaries clean'
recording vfy_963e66b2-808f-4181-9a6b-33829f737e69 "put one order on hold"
  url "http://127.0.0.1:5232/orders?sort=placedAt&dir=desc"
  1 recording render OrderRow only props.order,mount
  2 recording render OrderRow min 1
  3 recording boundaries clean
window: {observationId:observation:1,startDocumentCommitId:9,domains:[react,query,router,network],quietMs:500,timeoutMs:10000,tailMs:500}
next: $ npx genie-react verify end vfy_963e66b2-808f-4181-9a6b-33829f737e69 --session upd-b
session: {sessionId:f2dfbcad-44f0-43a4-a31e-d0f627a5789c,logicalSessionId:87a7df47-883d-40a5-82f6-5a2af5d0d6e9,documentGeneration:5}
schemaVersion: "1.0"
targets: [{target:{component:OrderRow},status:resolved,instances:12,source:/src/features/orders/orders-table.tsx}]
startedAt: 2026-11-19T08:56:51.014Z
expiresAt: 2026-11-19T09:01:51.027Z
request: {budget:{fiberLimit:250,operationLimit:20000,timeLimitMs:8,targetOperationReserve:4000,targetTimeReserveMs:4,adaptive:true},settle:{quietMs:500,timeoutMs:10000},maxDurationMs:300000,allowOverrides:false}
# exit code: 0
```

```console
$ agent-browser --session upd-b click 'button[aria-label="Actions for SO-105999"]'
✓ Done
# exit code: 0
```

```console
$ agent-browser --session upd-b find role menuitem click --name 'Put on hold'
✓ Done
# exit code: 0
```

```console
$ agent-browser --session upd-b wait 1500
✓ Done
# exit code: 0
```

```console
$ npx genie-react verify end vfy_963e66b2-808f-4181-9a6b-33829f737e69 --session upd-b
pass vfy_963e66b2-808f-4181-9a6b-33829f737e69 "put one order on hold"  14 commits, quiet after 1055 ms (react, query, router, network)
  url "http://127.0.0.1:5232/orders?sort=placedAt&dir=desc"
  1 pass render OrderRow only props.order,mount  {renders:2,events:2,violatingEvents:0,causes:[props.order]}
      claim: {kind:render-causes,target:{component:OrderRow},allow:[{kind:props,name:order},{kind:mount}]}
      deciding: [{kind:render-event,renderEventId:render:20:77,documentCommitId:20,mountId:mount:2,causes:[{cause:props.order,evidence:exact}]},{kind:render-event,renderEventId:render:17:28,documentCommitId:17,mountId:mount:2,causes:[{cause:props.order,evidence:exact}]}]
  2 pass render OrderRow min 1  {renders:2,mounts:0,updates:2,remounts:0,semantics:exact,instances:12,activeInstances:12}
      claim: {kind:renders,target:{component:OrderRow},min:1,counting:renders,allowRemount:false}
      deciding: [{kind:instance,mountId:mount:2,key:o-105999,renders:2,mounts:0,updates:2,mountGeneration:1,latestDocumentCommitId:20,source:/src/features/orders/orders-table.tsx:119:17}]
  3 pass boundaries clean  {caughtDuringWindow:0,caughtAtEnd:0}
      claim: {kind:boundaries-clean,scope:window}
      deciding: [{kind:boundary-log,scope:window,complete:true,afterDocumentCommitId:9}]
      caveats: [uncaught-errors-outside-boundaries-unobserved]
window: {observationId:observation:1,startDocumentCommitId:9,settledDocumentCommitId:22,frozenDocumentCommitId:23,commits:14,settle:{outcome:met,quietMs:500,timeoutMs:10000,waitedMs:1055,domains:{react:met,query:met,router:met,network:met}},tail:{ms:500,commits:1},environment:{bundle:development,strictMode:on,renderCollection:available,visibility:document}}
! ui-outcome-not-observed: Genie does not check the screen; confirm it with the UI driver
attempt 2 for these claims on this tab; previous fail vfy_6079298e-51e7-4e78-ab1b-d81729b841bc; document reloaded since
evidence: $ npx genie-react verify show vfy_963e66b2-808f-4181-9a6b-33829f737e69 --session upd-b
session: {sessionId:f2dfbcad-44f0-43a4-a31e-d0f627a5789c,logicalSessionId:87a7df47-883d-40a5-82f6-5a2af5d0d6e9,documentGeneration:5}
schemaVersion: "1.0"
exitCode: 0
stage: end
ledger: {fingerprint:cf_75576ea0e0d8,scope:logical-session,storage:memory,attempt:2,history:[{verificationId:vfy_6079298e-51e7-4e78-ab1b-d81729b841bc,verdict:fail,reasons:[],endedAt:2026-11-19T08:56:18.297Z}],codeChangedSincePrevious:document-reloaded,failsOnSameCode:0}
evidence: {retained:true,tools:[react_get_renders,react_component_cohort,react_list_overrides,query_is_fetching,react_refresh_events,browser_visibility,request_watch_start,request_watch_stop,react_profile_stop,react_render_causes,react_error_state]}
startedAt: 2026-11-19T08:56:51.014Z
endedAt: 2026-11-19T08:56:59.168Z
request: {budget:{fiberLimit:250,operationLimit:20000,timeLimitMs:8,targetOperationReserve:4000,targetTimeReserveMs:4,adaptive:true},settle:{quietMs:500,timeoutMs:10000},maxDurationMs:300000,allowOverrides:false}
# exit code: 0
```

```console
$ agent-browser --session upd-b get text '[data-order-id="o-105999"]'
SO-105999
Delta Health 5
On hold
standard
EMEA
40
Mar 2, 2026
$8,624.19
# exit code: 0
```
