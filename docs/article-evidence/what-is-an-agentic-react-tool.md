# Evidence: what-is-an-agentic-react-tool

- Date: 2026-11-19 (runs between 04:15 and 04:21 UTC, times on each block)
- Commit: `c46150076cdc8ecf927d31abbd78104804fd7ad7` (`git rev-parse HEAD`, first command below)
- App: `apps/realworld-dashboard` (Meridian Ops), React 19.3.1 development build in StrictMode, dev
  server started from the app folder with `DASHBOARD_PORT=5216 pnpm exec vite --port 5216 --strictPort`
- URLs: `http://127.0.0.1:5216/` (dashboard), `/inventory`, `/orders/o-105000`
- Genie: CLI and runtime 1.0.2 from this checkout (`pnpm install && pnpm build && pnpm install`)
- Driver: agent-browser 0.39.1, headless Chromium, session `art-l6`
- Seeded bugs used (answer keys in `evals/realworld/dashboard/`): `carrier-card-missing`,
  `dashboard-stock-summary-stale`, `dashboard-sidebar-rerenders-cards`, `order-page-view-repeats`.
  No app source was changed for this article.

Every command below ran from `apps/realworld-dashboard`, in this order. Output is untrimmed except
for one substitution: the absolute checkout path is replaced with `<checkout>`. Commands that pipe
through `grep`, `head` or a helper show that in the command line.

The helper `/tmp/docs7/art-l6/fiber.py` only filters agent-browser's `react tree --json` output to
named components, so the fiber IDs for `react inspect` can be read:

```python
import json, sys
tree = json.load(sys.stdin)['data']['tree']
names = sys.argv[1:]
for line in tree.splitlines():
    parts = line.split(' ', 3)
    if len(parts) == 4 and any(parts[3] == n or parts[3] == f'Memo({n})' for n in names):
        print(line)
```

## Not reproduced here

- Exploratory calls before the logged run, to learn the app and pick interactions: the same Genie
  and agent-browser reads on the same pages. The article quotes none of their output.
- Between part 1 and part 2, I found that agent-browser 0.39.1 has its own `react` commands, which
  need the session launched with `--enable react-devtools`. I closed the session and relaunched it
  with `agent-browser --session art-l6 --enable react-devtools open http://127.0.0.1:5216/login`
  (the first attempt, with the flag after `open`, printed `✗ Invalid response: EOF while parsing a
  value`), signed in again with `app_login_as`, and tried `react tree` (text mode printed only
  `✓ Done`; `--json` returned the tree), `react renders start/stop`, `react inspect` and
  `react suspense`. Part 2 repeats every comparison the article quotes on that relaunched session.
- `react inspect` output shows `[27] State: true` for OrderDetailPage because the edit drawer is open.

## Runs

```console
$ git rev-parse HEAD
c46150076cdc8ecf927d31abbd78104804fd7ad7
# exit code: 0 (04:15:18Z UTC)
```

```console
$ npx genie-react --version
1.0.2
# exit code: 0 (04:15:18Z UTC)
```

```console
$ agent-browser --version
agent-browser 0.39.1
# exit code: 0 (04:15:18Z UTC)
```

```console
$ agent-browser --session art-l6 open http://127.0.0.1:5216/login
✓ Meridian Ops
  http://127.0.0.1:5216/
# exit code: 0 (04:15:19Z UTC)
```

```console
$ npx genie-react status --session art-l6 --wait 15000
selectedBridgeUrl: ws://127.0.0.1:5216/__genie/ws
sessionSelector:
  requested: art-l6
  source: flag
  resolvedSessionId: b152f18d-5c55-4ee3-9d9f-44717c86c401
  implicit: false
  agentBrowser: {session:art-l6,via:selector,logicalSessionId:31d53d89-8108-41a8-95b5-53ecbafef80c}
connected: true
ready: true
sessionId: b152f18d-5c55-4ee3-9d9f-44717c86c401
app: {name:"Meridian Ops",url:http://127.0.0.1:5216/,reactVersion:19.3.1,reactMounted:true}
domains: [session,react,app,memory,perf,plugin,timeline,router,query]
toolCount: 98
sessions[1] (sessionId {fields}):
  b152f18d-5c55-4ee3-9d9f-44717c86c401 {logicalSessionId:31d53d89-8108-41a8-95b5-53ecbafef80c,documentGeneration:6,predecessorSessionId:52497fd9-8171-4626-9ece-c50b7cfd2b63,logicalSessionCollision:false,collisionWithSessionIds:[],app:{name:"Meridian Ops",url:http://127.0.0.1:5216/,reactVersion:19.3.1,reactMounted:true},domains:[session,react,app,memory,perf,plugin,timeline,router,query],toolCount:98,connectedAt:1795061719079,ready:true,readyAt:1795061719079,current:true,origin:http://127.0.0.1:5216,runtimeVersion:1.0.2}
warnings: []
hub: {version:1.0.2,protocol:1}
# exit code: 0 (04:15:19Z UTC)
```

```console
$ npx genie-react call app_reset_backend '{}' --session art-l6
seed: 20260302
faults: []
latency: []
latencyScale: 1
requestCount: 0
counts: {orders:6000,customers:1200,products:2400}
# exit code: 0 (04:15:20Z UTC)
```

```console
$ npx genie-react call app_login_as '{"role":"manager"}' --session art-l6
changed: false
role: manager
userId: u-manager
# exit code: 0 (04:15:21Z UTC)
```

```console
$ agent-browser --session art-l6 open http://127.0.0.1:5216/
✓ Meridian Ops
  http://127.0.0.1:5216/
# exit code: 0 (04:15:21Z UTC)
```

```console
$ agent-browser --session art-l6 wait 2500
✓ Done
# exit code: 0 (04:15:24Z UTC)
```

```console
$ agent-browser --session art-l6 console --clear
✓ Console log cleared
# exit code: 0 (04:15:24Z UTC)
```

```console
$ agent-browser --session art-l6 reload
http://127.0.0.1:5216/
# exit code: 0 (04:15:29Z UTC)
```

```console
$ agent-browser --session art-l6 wait 2500
✓ Done
# exit code: 0 (04:15:32Z UTC)
```

```console
$ agent-browser --session art-l6 snapshot | grep heading
      - heading "Good morning, Priya" [level=1, ref=e633]
        - heading "Orders per day" [level=2, ref=e634]
        - heading "Revenue by region" [level=2, ref=e636]
        - heading "Orders by status" [level=2, ref=e637]
        - heading "Inventory health" [level=2, ref=e638]
        - heading "Recent activity" [level=2, ref=e640]
# exit code: 0 (04:15:32Z UTC)
```

```console
$ agent-browser --session art-l6 errors

# exit code: 0 (04:15:32Z UTC)
```

```console
$ agent-browser --session art-l6 console | grep -v '\[debug\]'
[error] %o

%s

%s
 {stack: "TypeError: Cannot read properties of null (reading…vite/deps/react-dom_client.js?v=c33ff69d:9082:37)", message: "Cannot read properties of null (reading 'toFixed')"} The above error occurred in the <CarrierPerformanceCard> component. React will try to recreate this component tree from scratch using the error boundary you provided, WidgetBoundary.
# exit code: 0 (04:15:32Z UTC)
```

```console
$ npx genie-react call react_error_state '{}' --session art-l6
caughtErrors[1]:
  - {boundaryId:12166132400201,boundaryName:WidgetBoundary,boundaryKind:error-boundary,boundarySource:{file:/src/features/dashboard/dashboard-page.tsx,line:71,column:9,functionName:DashboardPage,sourceMapConfidence:mapped,role:element-callsite},sourceOwnership:unknown,throwingComponent:CarrierPerformanceCard,message:"Cannot read properties of null (reading 'toFixed')",stack:"TypeError: Cannot read properties of null (reading 'toFixed')\n    at http://127.0.0.1:5216/src/features/dashboard/carrier-performance-card.tsx:112:37\n    at Array.map (<anonymous>)\n    at CarrierPerformanceCard (http://127.0.0.1:5216/src/features/dashboard/carrier-performance-card.tsx:93:24)\n    at Object.react_stack_bottom_frame (http://127.0.0.1:5216/.vite/deps/react-dom_client.js?v=c33ff69d:14180:12)\n    at renderWithHooks (http://127.0.0.1:5216/.vite/deps/react-dom_client.js?v=c33ff69d:4422:19)\n    at updateFunctionComponent (http://127.0.0.1:5216/.vite/deps/react-dom_client.js?v=c33ff69d:5813:16)\n    at beginWork (http://127.0.0.1:5216/.vite/deps/react-dom_client.js?v=c33ff69d:6429:20)\n    at runWithFiberInDEV (http://127.0.0.1:5216/.vite/deps/react-dom_client.js?v=c33ff69d:945:66)\n    at performUnitOfWork (http://127.0.0.1:5216/.vite/deps/react-dom_client.js?v=c33ff69d:9186:92)\n    at workLoopSync (http://127.0.0.1:5216/.vite/deps/react-dom_client.js?v=c33ff69d:9082:37)",stackFrames:[{functionName:null,file:/src/features/dashboard/carrier-performance-card.tsx,line:42,column:42,isLibrary:false,mapping:mapped},{functionName:CarrierPerformanceCard,file:/src/features/dashboard/carrier-performance-card.tsx,line:32,column:25,isLibrary:false,mapping:mapped},{functionName:Object.react_stack_bottom_frame,file:/node_modules/.pnpm/react-dom@19.3.1_react@19.3.1/node_modules/react-dom/cjs/react-dom-client.development.js,line:28571,column:20,isLibrary:true,mapping:mapped},{functionName:renderWithHooks,file:/node_modules/.pnpm/react-dom@19.3.1_react@19.3.1/node_modules/react-dom/cjs/react-dom-client.development.js,line:8030,column:22,isLibrary:true,mapping:mapped},{functionName:updateFunctionComponent,file:/node_modules/.pnpm/react-dom@19.3.1_react@19.3.1/node_modules/react-dom/cjs/react-dom-client.development.js,line:10569,column:19,isLibrary:true,mapping:mapped},{functionName:beginWork,file:/node_modules/.pnpm/react-dom@19.3.1_react@19.3.1/node_modules/react-dom/cjs/react-dom-client.development.js,line:12205,column:18,isLibrary:true,mapping:mapped},{functionName:runWithFiberInDEV,file:/node_modules/.pnpm/react-dom@19.3.1_react@19.3.1/node_modules/react-dom/cjs/react-dom-client.development.js,line:1045,column:30,isLibrary:true,mapping:mapped},{functionName:performUnitOfWork,file:/node_modules/.pnpm/react-dom@19.3.1_react@19.3.1/node_modules/react-dom/cjs/react-dom-client.development.js,line:19176,column:22,isLibrary:true,mapping:mapped},{functionName:workLoopSync,file:/node_modules/.pnpm/react-dom@19.3.1_react@19.3.1/node_modules/react-dom/cjs/react-dom-client.development.js,line:19004,column:41,isLibrary:true,mapping:mapped}],isLibraryBoundary:false,forced:false,status:active,statusReason:state-unchanged-since-catch,rendered:{output:nothing,hostNodes:0,text:null}}
suspended: []
blankTreeHint: "error boundary <WidgetBoundary> at /src/features/dashboard/dashboard-page.tsx:71 caught \"Cannot read properties of null (reading 'toFixed')\" thrown by <CarrierPerformanceCard> — its children did not render and it renders nothing in its place, so the failure is invisible on screen"
ownershipCoverage: {complete:false,totalCandidates:1,app:0,library:0,unknown:1}
scanTruncated: false
# exit code: 0 (04:15:33Z UTC)
```

```console
$ agent-browser --session art-l6 get text '[data-testid=low-stock-count]'
104
# exit code: 0 (04:15:41Z UTC)
```

```console
$ npx genie-react call query_get '{"queryKey":["dashboard","stock-summary"]}' --session art-l6
queryHash: "[\"dashboard\",\"stock-summary\"]"
queryKey: [dashboard,stock-summary]
status: success
fetchStatus: idle
isStale: false
isActive: true
isInvalidated: false
observerCount: 1
hasQueryFn: true
gcTime: Infinity
staleTime: Infinity
dataUpdatedAt: 1795061730389
errorUpdatedAt: 0
dataUpdateCount: 1
errorUpdateCount: 0
fetchFailureCount: 0
fetchCount: 1
recentFetches: 0
fetchMeta: null
data:
  lowStock: 104
  outOfStock: 0
  items[5]:
    each: {onHand:{__genie_dehydrated__:true,kind:object,preview:"{…}"}}
    - {productId:p-0967,sku:SAF-07762,name:"Work Gloves Lite",category:Safety,reorderPoint:114,onHand:{path:[items,0,onHand]},totalOnHand:10}
    - {productId:p-0231,sku:SAF-02610,name:"Hi-Vis Vest Max",category:Safety,reorderPoint:80,onHand:{path:[items,1,onHand]},totalOnHand:8}
    - {productId:p-2002,sku:TOO-15007,name:"Hand Truck XL",category:Tools,reorderPoint:87,onHand:{path:[items,2,onHand]},totalOnHand:9}
    - {productId:p-1680,sku:SAF-12753,name:"First Aid Kit XL",category:Safety,reorderPoint:109,onHand:{path:[items,3,onHand]},totalOnHand:12}
    - {productId:p-2025,sku:TOO-15168,name:"Hand Truck XL",category:Tools,reorderPoint:114,onHand:{path:[items,4,onHand]},totalOnHand:13}
observersOmitted: 0
observers[1]:
  - {observerId:query-observer:7,identityStatus:current,notificationPolicy:{mode:auto-tracked,trackedFieldsAvailable:true,fields:[data]},deliveryEvidence:public-track-prop-observed,hasSelect:false,enabled:default,currentResult:{data:{lowStock:104,outOfStock:0,items:{__genie_dehydrated__:true,kind:array,preview:"Array(5)",path:[data,items],size:5}},dataUpdatedAt:1795061730389,error:null,errorUpdatedAt:0,failureCount:0,failureReason:null,errorUpdateCount:0,isError:false,isFetched:true,isFetchedAfterMount:true,isFetching:false,isLoading:false,isPending:false,isLoadingError:false,isInitialLoading:false,isPaused:false,isPlaceholderData:false,isRefetchError:false,isRefetching:false,isStale:false,isSuccess:true,isEnabled:true,refetch:{__genie_dehydrated__:true,kind:function,preview:"ƒ bound refetch()",path:[refetch]},status:success,fetchStatus:idle,promise:{__genie_dehydrated__:true,kind:promise,preview:Promise,path:[promise]}},resultFields:[data,dataUpdatedAt,error,errorUpdatedAt,failureCount,failureReason,errorUpdateCount,isError,isFetched,isFetchedAfterMount,isFetching,isLoading,isPending,isLoadingError,isInitialLoading,isPaused,isPlaceholderData,isRefetchError,isRefetching,isStale,isSuccess,isEnabled,refetch,status,fetchStatus,promise],subscriberObservationStatus:not-observed,subscriber:null}
# exit code: 0 (04:15:41Z UTC)
```

```console
$ agent-browser --session art-l6 find role link click --name 'View all'
✓ Done
# exit code: 0 (04:15:46Z UTC)
```

```console
$ agent-browser --session art-l6 wait 1500
✓ Done
# exit code: 0 (04:15:48Z UTC)
```

```console
$ agent-browser --session art-l6 find role button click --name 'Adjust SAF-07762'
✓ Done
# exit code: 0 (04:15:53Z UTC)
```

```console
$ agent-browser --session art-l6 select '[role=dialog] select:nth-of-type(1)' wh-reno
✗ No option matched ["wh-reno"]. Available options:  ("Select a warehouse")
# exit code: 1 (04:15:53Z UTC)
```

```console
$ agent-browser --session art-l6 snapshot -i -s '[role=dialog]'
- heading "Adjust SAF-07762" [level=2, ref=e650]
- button "Close dialog" [ref=e651]
- combobox "Warehouse" [expanded=false, ref=e652]: Select a warehouse
  - option "Select a warehouse" [selected, ref=e959]
  - option "Reno DC · 0 on hand" [ref=e960]
  - option "Columbus DC · 2 on hand" [ref=e961]
  - option "Rotterdam Hub · 1 on hand" [ref=e962]
  - option "Leipzig Hub · 6 on hand" [ref=e963]
  - option "Singapore Hub · 1 on hand" [ref=e964]
  - option "São Paulo DC · 0 on hand" [ref=e965]
- spinbutton "Adjustment" [ref=e653]: 0
- combobox "Reason" [expanded=false, ref=e654]: Cycle count
  - option "Cycle count" [selected, ref=e966]
  - option "Damaged goods" [ref=e967]
  - option "Received shipment" [ref=e968]
  - option "Customer return" [ref=e969]
  - option "Transfer" [ref=e970]
- button "Cancel" [ref=e655]
- button "Apply adjustment" [ref=e656]
# exit code: 0 (04:15:56Z UTC)
```

```console
$ agent-browser --session art-l6 select @e652 'Reno DC · 0 on hand'
✓ Done
# exit code: 0 (04:16:01Z UTC)
```

```console
$ agent-browser --session art-l6 fill @e653 614
✓ Done
# exit code: 0 (04:16:01Z UTC)
```

```console
$ agent-browser --session art-l6 click @e656
✓ Done
# exit code: 0 (04:16:07Z UTC)
```

```console
$ agent-browser --session art-l6 wait 1500
✓ Done
# exit code: 0 (04:16:08Z UTC)
```

```console
$ agent-browser --session art-l6 snapshot | grep -n 'SAF-07762' | head -5
505:        - StaticText "SAF-07762 adjusted"
# exit code: 0 (04:16:08Z UTC)
```

```console
$ agent-browser --session art-l6 find role link click --name 'Dashboard'
✓ Done
# exit code: 0 (04:16:13Z UTC)
```

```console
$ agent-browser --session art-l6 wait 2000
✓ Done
# exit code: 0 (04:16:15Z UTC)
```

```console
$ agent-browser --session art-l6 get text '[data-testid=low-stock-count]'
104
# exit code: 0 (04:16:15Z UTC)
```

```console
$ npx genie-react call query_get '{"queryKey":["dashboard","stock-summary"]}' --session art-l6 --fields staleTime,isStale,dataUpdatedAt,dataUpdateCount,fetchCount
[1]:
  - {staleTime:Infinity,isStale:false,dataUpdatedAt:1795061730389,dataUpdateCount:1,fetchCount:1}
# exit code: 0 (04:16:16Z UTC)
```

```console
$ agent-browser --session art-l6 eval 'fetch("/api/dashboard/stock-summary").then(r => r.json()).then(d => d.lowStock)'
null
# exit code: 0 (04:16:24Z UTC)
```

```console
$ agent-browser --session art-l6 reload
http://127.0.0.1:5216/
# exit code: 0 (04:16:36Z UTC)
```

```console
$ agent-browser --session art-l6 wait 2500
✓ Done
# exit code: 0 (04:16:38Z UTC)
```

```console
$ agent-browser --session art-l6 get text '[data-testid=low-stock-count]'
103
# exit code: 0 (04:16:38Z UTC)
```

```console
$ npx genie-react call query_get '{"queryKey":["dashboard","stock-summary"]}' --session art-l6 --fields staleTime,isStale,dataUpdatedAt,dataUpdateCount,fetchCount
[1]:
  - {staleTime:Infinity,isStale:false,dataUpdatedAt:1795061796856,dataUpdateCount:1,fetchCount:1}
# exit code: 0 (04:16:39Z UTC)
```

PART 2: same session relaunched with agent-browser's React DevTools hook (exploratory relaunch commands not logged, see evidence notes)

```console
$ agent-browser --session art-l6 get url
http://127.0.0.1:5216/
# exit code: 0 (04:18:50Z UTC)
```

```console
$ agent-browser --session art-l6 reload
http://127.0.0.1:5216/
# exit code: 0 (04:18:50Z UTC)
```

```console
$ agent-browser --session art-l6 wait 2500
✓ Done
# exit code: 0 (04:18:53Z UTC)
```

```console
$ npx genie-react status --session art-l6 --wait 15000 | grep -E '^(connected|ready|app):'
connected: true
ready: true
app: {name:"Meridian Ops",url:http://127.0.0.1:5216/,reactVersion:19.3.1,reactMounted:true}
# exit code: 0 (04:18:54Z UTC)
```

```console
$ agent-browser --session art-l6 react tree --json | python3 /tmp/docs7/art-l6/fiber.py WidgetBoundary LowStockCard StatCard
49 158 157 Memo(StatCard)
49 163 157 Memo(StatCard)
49 168 157 Memo(StatCard)
49 173 157 Memo(StatCard)
49 221 208 WidgetBoundary
49 239 208 LowStockCard
# exit code: 0 (04:18:54Z UTC)
```

```console
$ agent-browser --session art-l6 react inspect 221
WidgetBoundary #221
props:
  name: "carrier-performance"
  children: <CarrierPerformanceCard />
state:
  failed: true
rendered by: DashboardPage > Lazy > Memo(MatchInnerImpl) > MatchView > Memo(MatchImpl) > Memo(OutletImpl) > AuthenticatedLayout > Lazy > Memo(MatchInnerImpl) > MatchView > Memo(MatchImpl) > Memo(OutletImpl) > RootLayout > Memo(MatchInnerImpl) > MatchView > Memo(MatchImpl) > MatchesInner > Matches > RouterProvider > App
# exit code: 0 (04:18:58Z UTC)
```

```console
$ agent-browser --session art-l6 react inspect 239
LowStockCard #239
hooks:
  Query: undefined (1 sub)
rendered by: DashboardPage > Lazy > Memo(MatchInnerImpl) > MatchView > Memo(MatchImpl) > Memo(OutletImpl) > AuthenticatedLayout > Lazy > Memo(MatchInnerImpl) > MatchView > Memo(MatchImpl) > Memo(OutletImpl) > RootLayout > Memo(MatchInnerImpl) > MatchView > Memo(MatchImpl) > MatchesInner > Matches > RouterProvider > App
# exit code: 0 (04:18:58Z UTC)
```

```console
$ npx genie-react call react_error_state '{}' --session art-l6 --select caughtErrors.0.boundaryName,caughtErrors.0.boundarySource,caughtErrors.0.throwingComponent,caughtErrors.0.message,caughtErrors.0.status,caughtErrors.0.rendered
error invalid_input: Tool call failed. The --select expression matched no paths. details.selection.available lists the result's top-level paths. Correct --select and retry.
next: $ pnpm exec genie-react tools react_error_state --session art-l6
userActionRequired: true
errorCode: invalid-input
details:
  selection: {available:[/blankTreeHint,/caughtErrors,/ownershipCoverage,/scanTruncated,/suspended]}
exit: {code:2,class:usage}
# exit code: 1 (04:18:59Z UTC)
```

```console
$ npx genie-react call react_error_state '{}' --session art-l6 --fields boundaryName,boundarySource,throwingComponent,message,status,rendered
[1]:
  - {boundaryName:WidgetBoundary,boundarySource:{file:/src/features/dashboard/dashboard-page.tsx,line:71,column:9,functionName:DashboardPage,sourceMapConfidence:mapped,role:element-callsite},throwingComponent:CarrierPerformanceCard,message:"Cannot read properties of null (reading 'toFixed')",status:active,rendered:{output:nothing,hostNodes:0,text:null}}
# exit code: 0 (04:19:04Z UTC)
```

```console
$ npx genie-react call react_clear_renders '{"component":"StatCard"}' --session art-l6
ok: true
tracking: true
documentCommitId: 12
observation: {id:observation:1,epoch:1,startedAfterDocumentCommitId:12}
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
# exit code: 0 (04:19:11Z UTC)
```

```console
$ agent-browser --session art-l6 react renders start
✓ Done
# exit code: 0 (04:19:11Z UTC)
```

```console
$ agent-browser --session art-l6 find role button click --name 'Collapse sidebar'
✓ Done
# exit code: 0 (04:19:11Z UTC)
```

```console
$ npx genie-react call react_quiesce '{"idleMs":500,"timeoutMs":10000}' --fail-on-result-error --session art-l6
ok: true
outcome: idle
elapsedMs: 766
observedCommits: 0
documentCommitId: 13
sessionId: 97f06216-a066-48a7-8b86-8c69477f7734
renderCollection: available
pendingWork:
  documentCommitId: 13
  scheduledRoots: 0
  suspendedBoundaries: 0
  dehydratedBoundaries: 0
  boundaries: []
  scanTruncated: false
  scannedFibers: 463
# exit code: 0 (04:19:12Z UTC)
```

```console
$ agent-browser --session art-l6 react renders stop
# Render Profile - 22.05s recording
# 911 renders (401 mounts + 510 re-renders) across 62 components
# FPS: avg 60, min 12, max 61, drops (<30fps): 3

## Components by total render time
| Component              | Insts | Mounts | Re-renders | Total    | Self     | DOM   | Top change reason          |
| ---------------------- | ----- | ------ | ---------- | -------- | -------- | ----- | -------------------------- |
| CatchBoundary          |    10 |      8 |         30 |  101.2ms |    0.1ms |  8/38 | parent (MatchView)         |
| MatchImpl              |     6 |      6 |         27 |   85.9ms |    0.3ms |  6/33 | parent (OutletImpl)        |
| OutletImpl             |     4 |      5 |         17 |     58ms |        - |  5/22 | parent (RootLayout)        |
| AppShell               |     2 |      2 |          9 |   33.7ms |    0.4ms |  2/11 | parent (PermissionsProvider) |
| PreferencesProvider    |     2 |      2 |          9 |   33.3ms |    0.8ms |  2/11 | parent (AppShell)          |
| MatchView              |     3 |      6 |          0 |   30.8ms |    0.4ms |   6/6 | mount                      |
| MatchInnerImpl         |     4 |      6 |          1 |   30.3ms |    0.3ms |   6/7 | mount                      |
| QueryClientProvider    |     2 |      1 |         12 |   28.7ms |    0.1ms |  1/13 | parent (unknown)           |
| AuthProvider           |     2 |      1 |         12 |   28.6ms |    0.1ms |  1/13 | parent (QueryClientProvider) |
| App                    |     2 |      1 |         12 |   28.5ms |        - |  1/13 | parent (AuthProvider)      |
| MatchesInner           |     2 |      1 |         12 |   28.1ms |    0.1ms |  1/13 | parent (Matches)           |
| CatchNotFound          |     2 |      1 |         10 |   27.7ms |    0.2ms |  1/11 | parent (CatchBoundary)     |
| DashboardPage          |     2 |      3 |          8 |   23.4ms |    2.3ms |  5/11 | parent (Lazy)              |
| Lazy                   |     2 |      5 |          0 |   22.3ms |        - |   5/5 | mount                      |
| Card                   |    12 |     27 |         34 |   17.9ms |    0.8ms | 61/61 | mount                      |
| RootLayout             |     1 |      2 |          0 |   15.4ms |    0.2ms |   2/2 | mount                      |
| AuthenticatedLayout    |     1 |      2 |          0 |   14.2ms |    0.2ms |   2/2 | mount                      |
| PermissionsProvider    |     1 |      2 |          0 |     14ms |        - |   2/2 | mount                      |
| NotificationBell       |     2 |      2 |          9 |   13.1ms |    2.1ms | 11/11 | state (hook #1)            |
| CardBody               |    12 |     27 |         34 |     12ms |    0.4ms | 61/61 | mount                      |
| Matches                |     1 |      1 |          1 |    8.5ms |    0.2ms |   1/2 | state (hook #0)            |
| StatCard               |     8 |     20 |         24 |    8.4ms |    4.1ms | 44/44 | mount                      |
| NotificationsDrawer    |     2 |      2 |          9 |    8.1ms |    7.1ms |  2/11 | props.onClose              |
| SidebarNav             |     2 |      2 |          9 |      7ms |    0.9ms |  3/11 | parent (PreferencesProvider) |
| Boxes                  |     2 |     10 |          1 |    5.3ms |        - | 10/11 | mount                      |
| RevenueByRegionCard    |     2 |      4 |          7 |    5.2ms |    1.1ms |  4/11 | state (hook #5)            |
| CardHeader             |    12 |     27 |         34 |    5.1ms |    3.8ms | 61/61 | mount                      |
| StatusBreakdownCard    |     2 |      3 |          8 |    4.7ms |    0.9ms |  3/11 | state (hook #4)            |
| TopBar                 |     2 |      2 |          9 |    4.6ms |    0.5ms |  3/11 | parent (PreferencesProvider) |
| DonutChart             |     2 |      2 |          6 |    4.6ms |    3.7ms |   8/8 | props.segments             |
| OrdersTrendCard        |     2 |      5 |          6 |    4.5ms |    1.8ms |  5/11 | mount                      |
| RecentActivityCard     |     2 |      3 |          8 |    3.6ms |    2.1ms |  3/11 | state (hook #4)            |
| LayoutDashboard        |     2 |     10 |          1 |    3.3ms |    0.1ms | 10/11 | mount                      |
| BarList                |     2 |      1 |          6 |    3.2ms |    3.1ms |   7/7 | props.data                 |
| Package                |     2 |     10 |          1 |    3.1ms |      1ms | 10/11 | mount                      |
| LowStockCard           |     2 |      3 |          8 |    3.1ms |    1.8ms |  3/11 | state (hook #4)            |
| Bell                   |     2 |      2 |          9 |    2.9ms |    1.1ms |  2/11 | parent (NotificationBell)  |
| Avatar                 |    14 |     16 |         19 |    2.8ms |    1.8ms | 35/35 | parent (CardBody)          |
| ArrowUpRight           |     4 |      8 |          4 |    2.2ms |    0.8ms |  8/12 | mount                      |
| Users                  |     2 |     10 |          1 |    2.1ms |        - | 10/11 | mount                      |
| ChartColumn            |     2 |     10 |          1 |    2.1ms |        - | 10/11 | mount                      |
| Settings               |     2 |     10 |          1 |      2ms |      1ms | 10/11 | mount                      |
| WidgetBoundary         |     2 |      3 |          8 |      2ms |    0.8ms |  3/11 | parent (DashboardPage)     |
| CarrierPerformanceCard |     2 |      5 |          1 |    1.8ms |    1.2ms |   5/6 | mount                      |
| Skeleton               |    18 |     57 |         12 |    1.6ms |    1.1ms | 69/69 | mount                      |
| ArrowDownRight         |     4 |      8 |          4 |    1.2ms |    0.6ms |  8/12 | mount                      |
| Search                 |     2 |     10 |          1 |    1.1ms |    0.1ms | 10/11 | mount                      |
| LineChart              |     2 |      2 |          1 |    1.1ms |    0.8ms |   3/3 | mount                      |
| Drawer                 |     2 |      2 |          9 |      1ms |      1ms |  2/11 | props.onClose              |
| ChevronsLeft           |     1 |     10 |          0 |      1ms |        - | 10/10 | mount                      |
... and 12 more

## Change details (prev -> next)
  CatchBoundary
    props.getResetKey: fn() -> fn()
    props.onCatch: fn() -> fn()
    props.errorComponent: fn() -> fn()
  AppShell
    state (hook #0): false -> true
    state (hook #5): {tag, create, deps, ...} -> {tag, create, deps, ...}
  PreferencesProvider
    state (hook #3): {tag, create, deps, ...} -> {tag, create, deps, ...}
  MatchesInner
    state (hook #3): Array(2) -> Array(2)
    state (hook #4): Array(0) -> Array(0)
    state (hook #5): {tag, create, deps, ...} -> {tag, create, deps, ...}
    state (hook #6): {tag, create, deps, ...} -> {tag, create, deps, ...}
    state (hook #7): {tag, create, deps, ...} -> {tag, create, deps, ...}
  CatchNotFound
    state (hook #3): Array(2) -> Array(2)
    state (hook #5): {tag, create, deps, ...} -> {tag, create, deps, ...}
    state (hook #6): {tag, create, deps, ...} -> {tag, create, deps, ...}
    state (hook #10): Array(2) -> Array(2)
    state (hook #11): "pending" -> "idle"
    state (hook #12): {tag, create, deps, ...} -> {tag, create, deps, ...}
    state (hook #13): {tag, create, deps, ...} -> {tag, create, deps, ...}
  DashboardPage
    state (hook #1): {tag, create, deps, ...} -> {tag, create, deps, ...}
    state (hook #4): {status, fetchStatus, isPending, ...} -> {status, fetchStatus, isPending, ...}
    state (hook #5): {tag, create, deps, ...} -> {tag, create, deps, ...}
    state (hook #6): {tag, create, deps, ...} -> {tag, create, deps, ...}
    state (hook #7): {tag, create, deps, ...} -> {tag, create, deps, ...}
    state (hook #11): {tag, create, deps, ...} -> {tag, create, deps, ...}
    state (hook #12): {tag, create, deps, ...} -> {tag, create, deps, ...}
    state (hook #10): {status, fetchStatus, isPending, ...} -> {status, fetchStatus, isPending, ...}
    state (hook #13): Array(2) -> Array(2)
  NotificationBell
    state (hook #1): {tag, create, deps, ...} -> {tag, create, deps, ...}
    state (hook #4): {status, fetchStatus, isPending, ...} -> {status, fetchStatus, isPending, ...}
    state (hook #5): {tag, create, deps, ...} -> {tag, create, deps, ...}
    state (hook #6): {tag, create, deps, ...} -> {tag, create, deps, ...}
    state (hook #7): {tag, create, deps, ...} -> {tag, create, deps, ...}
  Matches
    state (hook #0): undefined -> {tempLocationKey, _scroll, subscribers, ...}
  StatCard
    props.value: undefined -> 13247613
    props.delta: undefined -> 4.6
    props.trend: Array(0) -> Array(14)
  NotificationsDrawer
    props.onClose: fn() -> fn()
    props.notifications: Array(0) -> Array(12)
    state (hook #1): {tag, create, deps, ...} -> {tag, create, deps, ...}
    state (hook #4): {tag, create, deps, ...} -> {tag, create, deps, ...}
    context (unknown): {formatMoney, formatCompactMoney, formatNumber, ...} -> {formatMoney, formatCompactMoney, formatNumber, ...}
  SidebarNav
    props.collapsed: false -> true
    state (hook #2): {tag, create, deps, ...} -> {tag, create, deps, ...}
  RevenueByRegionCard
    state (hook #0): {tag, create, deps, ...} -> {tag, create, deps, ...}
    state (hook #3): {status, fetchStatus, isPending, ...} -> {status, fetchStatus, isPending, ...}
    state (hook #4): {tag, create, deps, ...} -> {tag, create, deps, ...}
    state (hook #5): {tag, create, deps, ...} -> {tag, create, deps, ...}
    context (unknown): {formatMoney, formatCompactMoney, formatNumber, ...} -> {formatMoney, formatCompactMoney, formatNumber, ...}
  CardHeader
    props.actions: {$$typeof, type, key, ...} -> {$$typeof, type, key, ...}
  StatusBreakdownCard
    state (hook #0): {tag, create, deps, ...} -> {tag, create, deps, ...}
    state (hook #3): {status, fetchStatus, isPending, ...} -> {status, fetchStatus, isPending, ...}
    state (hook #4): {tag, create, deps, ...} -> {tag, create, deps, ...}
    state (hook #5): {tag, create, deps, ...} -> {tag, create, deps, ...}
  DonutChart
    props.segments: Array(6) -> Array(6)
# exit code: 0 (04:19:12Z UTC)
```

```console
$ npx genie-react call react_render_causes '{"component":"StatCard","limit":10}' --session art-l6
componentMatch:
  component: StatCard
  exact: true
  status: matched
  matchedNames: [StatCard]
  matchedNameCount: 1
  similarNames: []
tracking: true
commits: 1
documentCommitId: 13
observation: {id:observation:1,epoch:1,startedAfterDocumentCommitId:12}
attribution:
  status: current
  startedAtDocumentCommitId: 13
  completedAtDocumentCommitId: 13
  startedAtAnalysisGeneration: 14
  completedAtAnalysisGeneration: 14
view: summary
events[4] (componentName #componentId {fields}, then ← kind evidence name {fields} per cause):
  each: {documentCommitId:13,necessity:unnecessary,necessityReason:output-unchanged,inputEvidence:incomplete,inputCoverage:{complete:false,scanTruncated:true},source:{role:element-callsite,ownership:app}}
  StatCard #16558743093476 {renderEventId:render:13:4,mountId:mount:6,source:{location:/src/features/dashboard/dashboard-page.tsx:55:9}}
    ← context exact "Context(PreferencesProvider)" {contextIndex:0}
  StatCard #16558743093463 {renderEventId:render:13:3,mountId:mount:5,source:{location:/src/features/dashboard/dashboard-page.tsx:49:9}}
    ← context exact "Context(PreferencesProvider)" {contextIndex:0}
  StatCard #16558743093449 {renderEventId:render:13:2,mountId:mount:4,source:{location:/src/features/dashboard/dashboard-page.tsx:42:9}}
    ← context exact "Context(PreferencesProvider)" {contextIndex:0}
  StatCard #16558743093435 {renderEventId:render:13:1,mountId:mount:3,source:{location:/src/features/dashboard/dashboard-page.tsx:35:9}}
    ← context exact "Context(PreferencesProvider)" {contextIndex:0}
omittedByLimit: 0
sourceClassification:
  complete: true
  affects: result
  totalCandidates: 4
  evaluated: 4
  app: 4
  library: 0
  unknown: 0
  unknownComponents: []
  unknownComponentsOmitted: 0
renderEventRetention: {evictedEvents:0,earliestDocumentCommitId:13,latestDocumentCommitId:13}
coverage:
  skippedCommitFibers: 0
  droppedUnmountFibers: 0
  analysisFailedFibers: 0
  pausedCommits: 0
  unobservedCommits: 0
  refreshCommitsExcluded: 0
  truncatedInputFibers: 9
  propsNotEnumeratedFibers: 0
  budgetExhaustedCommits: 0
  budgetExhaustedSubsystems: []
  incompleteBecause[1]:
    - {reason:inputs-truncated,fibers:9,components:[StatCard,NotificationsDrawer,UserMenu,OrdersTrendCard,RevenueByRegionCard,RecentActivityCard],detail:"An input held values Genie compares only in part, such as functions, class instances or objects past the inspected depth; read deepDiff.truncated on these components."}
  complete: false
  inputAttributionComplete: false
  semantics: lower-bound
  coverageDomain: render-causality
  droppedRenderEvents: 0
# exit code: 0 (04:19:12Z UTC)
```

```console
$ agent-browser --session art-l6 find role button click --name 'Expand sidebar'
✓ Done
# exit code: 0 (04:19:22Z UTC)
```

```console
$ agent-browser --session art-l6 wait 1000
✓ Done
# exit code: 0 (04:19:23Z UTC)
```

```console
$ npx genie-react call react_clear_renders '{"component":"StatCard"}' --session art-l6 --fields ok,tracking
[1]:
  - {ok:true,tracking:true}
# exit code: 0 (04:19:23Z UTC)
```

```console
$ agent-browser --session art-l6 react renders start
✓ Done
# exit code: 0 (04:19:23Z UTC)
```

```console
$ agent-browser --session art-l6 find role button click --name 'Collapse sidebar'
✓ Done
# exit code: 0 (04:19:23Z UTC)
```

```console
$ agent-browser --session art-l6 wait 800
✓ Done
# exit code: 0 (04:19:24Z UTC)
```

```console
$ agent-browser --session art-l6 react renders stop
# Render Profile - 0.9s recording
# 83 renders (6 mounts + 77 re-renders) across 50 components
# FPS: avg 60, min 60, max 61, drops (<30fps): 0

## Components by total render time
| Component           | Insts | Mounts | Re-renders | Total    | Self     | DOM   | Top change reason          |
| ------------------- | ----- | ------ | ---------- | -------- | -------- | ----- | -------------------------- |
| MatchImpl           |     6 |      0 |          3 |   17.1ms |        - |   0/3 | parent (OutletImpl)        |
| CatchBoundary       |     6 |      0 |          3 |   17.1ms |        - |   0/3 | parent (MatchView)         |
| OutletImpl          |     4 |      0 |          2 |   10.2ms |        - |   0/2 | parent (RootLayout)        |
| QueryClientProvider |     2 |      0 |          1 |    6.9ms |        - |   0/1 | parent (unknown)           |
| AuthProvider        |     2 |      0 |          1 |    6.9ms |        - |   0/1 | parent (QueryClientProvider) |
| App                 |     2 |      0 |          1 |    6.9ms |        - |   0/1 | parent (AuthProvider)      |
| MatchesInner        |     2 |      0 |          1 |    6.9ms |        - |   0/1 | parent (Matches)           |
| CatchNotFound       |     2 |      0 |          1 |    6.9ms |        - |   0/1 | parent (CatchBoundary)     |
| AppShell            |     2 |      0 |          1 |    6.9ms |    0.2ms |   0/1 | state (hook #0)            |
| PreferencesProvider |     2 |      0 |          1 |    6.7ms |        - |   0/1 | state (hook #3)            |
| DashboardPage       |     2 |      0 |          1 |    3.3ms |        - |   0/1 | parent (Lazy)              |
| Card                |    10 |      0 |          5 |      2ms |    0.1ms |   5/5 | parent (RecentActivityCard) |
| SidebarNav          |     2 |      0 |          1 |    1.9ms |    0.3ms |   1/1 | props.collapsed            |
| TopBar              |     2 |      0 |          1 |    1.5ms |    0.1ms |   1/1 | parent (PreferencesProvider) |
| CardBody            |    10 |      0 |          5 |    1.4ms |        - |   5/5 | parent (Card)              |
| StatCard            |     8 |      0 |          4 |    1.4ms |    0.9ms |   4/4 | context (unknown)          |
| NotificationBell    |     2 |      0 |          1 |    1.2ms |    0.2ms |   1/1 | state (hook #6)            |
| NotificationsDrawer |     2 |      0 |          1 |    0.8ms |    0.8ms |   0/1 | context (unknown)          |
| RecentActivityCard  |     2 |      0 |          1 |    0.8ms |    0.5ms |   0/1 | context (unknown)          |
| LowStockCard        |     2 |      0 |          1 |    0.7ms |    0.5ms |   0/1 | state (hook #5)            |
| OrdersTrendCard     |     2 |      0 |          1 |    0.6ms |    0.2ms |   0/1 | context (unknown)          |
| CardHeader          |    10 |      0 |          5 |    0.5ms |    0.4ms |   5/5 | parent (Card)              |
| RevenueByRegionCard |     2 |      0 |          1 |    0.5ms |        - |   0/1 | context (unknown)          |
| DonutChart          |     2 |      0 |          1 |    0.5ms |    0.4ms |   1/1 | props.segments             |
| BarList             |     2 |      0 |          1 |    0.4ms |    0.4ms |   1/1 | props.data                 |
| ArrowDownRight      |     4 |      0 |          2 |    0.3ms |    0.2ms |   0/2 | parent (StatCard)          |
| Boxes               |     2 |      0 |          1 |    0.3ms |        - |   0/1 | parent (SidebarNav)        |
| LineChart           |     2 |      0 |          1 |    0.3ms |    0.2ms |   1/1 | props.points               |
| ArrowUpRight        |     4 |      0 |          2 |    0.2ms |    0.2ms |   0/2 | parent (StatCard)          |
| LayoutDashboard     |     2 |      0 |          1 |    0.2ms |        - |   0/1 | parent (SidebarNav)        |
| Users               |     2 |      0 |          1 |    0.2ms |        - |   0/1 | parent (SidebarNav)        |
| ChartColumn         |     2 |      0 |          1 |    0.2ms |        - |   0/1 | parent (SidebarNav)        |
| Bell                |     2 |      0 |          1 |    0.2ms |    0.1ms |   0/1 | parent (NotificationBell)  |
| Avatar              |    14 |      0 |          7 |    0.1ms |    0.1ms |   7/7 | parent (CardBody)          |
| Badge               |     5 |      5 |          0 |    0.1ms |        - |   5/5 | mount                      |
| Package             |     2 |      0 |          1 |    0.1ms |        - |   0/1 | parent (SidebarNav)        |
| Settings            |     2 |      0 |          1 |    0.1ms |    0.1ms |   0/1 | parent (SidebarNav)        |
| ChevronsRight       |     1 |      1 |          0 |    0.1ms |        - |   1/1 | mount                      |
| Search              |     2 |      0 |          1 |    0.1ms |    0.1ms |   0/1 | parent (TopBar)            |
| UserMenu            |     2 |      0 |          1 |    0.1ms |    0.1ms |   1/1 | context (unknown)          |
| Sparkline           |     4 |      0 |          2 |        - |        - |   0/2 | parent (StatCard)          |
| Transitioner        |     2 |      0 |          1 |        - |        - |   0/1 | parent (Matches)           |
| Drawer              |     2 |      0 |          1 |        - |        - |   0/1 | props.onClose              |
| OverlayFrame        |     2 |      0 |          1 |        - |        - |   0/1 | state (hook #1)            |
| Select              |     2 |      0 |          1 |        - |        - |   1/1 | props.onChange             |
| StatusBreakdownCard |     2 |      0 |          1 |        - |        - |   0/1 | parent (DashboardPage)     |
| WidgetBoundary      |     2 |      0 |          1 |        - |        - |   0/1 | parent (DashboardPage)     |
| Toaster             |     2 |      0 |          1 |        - |        - |   0/1 | parent (RootLayout)        |
| Genie               |     2 |      0 |          1 |        - |        - |   0/1 | parent (RootLayout)        |
| DashboardDevTools   |     2 |      0 |          1 |        - |        - |   0/1 | parent (RootLayout)        |

## Change details (prev -> next)
  AppShell
    state (hook #0): false -> true
    state (hook #5): {tag, create, deps, ...} -> {tag, create, deps, ...}
  PreferencesProvider
    state (hook #3): {tag, create, deps, ...} -> {tag, create, deps, ...}
  SidebarNav
    props.collapsed: false -> true
    state (hook #2): {tag, create, deps, ...} -> {tag, create, deps, ...}
  StatCard
    context (unknown): {formatMoney, formatCompactMoney, formatNumber, ...} -> {formatMoney, formatCompactMoney, formatNumber, ...}
  NotificationBell
    state (hook #1): {tag, create, deps, ...} -> {tag, create, deps, ...}
    state (hook #5): {tag, create, deps, ...} -> {tag, create, deps, ...}
    state (hook #6): {tag, create, deps, ...} -> {tag, create, deps, ...}
    state (hook #7): {tag, create, deps, ...} -> {tag, create, deps, ...}
  NotificationsDrawer
    props.onClose: fn() -> fn()
    state (hook #1): {tag, create, deps, ...} -> {tag, create, deps, ...}
    state (hook #4): {tag, create, deps, ...} -> {tag, create, deps, ...}
    context (unknown): {formatMoney, formatCompactMoney, formatNumber, ...} -> {formatMoney, formatCompactMoney, formatNumber, ...}
  RecentActivityCard
    state (hook #0): {tag, create, deps, ...} -> {tag, create, deps, ...}
    state (hook #4): {tag, create, deps, ...} -> {tag, create, deps, ...}
    state (hook #5): {tag, create, deps, ...} -> {tag, create, deps, ...}
    context (unknown): {formatMoney, formatCompactMoney, formatNumber, ...} -> {formatMoney, formatCompactMoney, formatNumber, ...}
  LowStockCard
    state (hook #0): {tag, create, deps, ...} -> {tag, create, deps, ...}
    state (hook #3): {status, fetchStatus, isPending, ...} -> {status, fetchStatus, isPending, ...}
    state (hook #4): {tag, create, deps, ...} -> {tag, create, deps, ...}
    state (hook #5): {tag, create, deps, ...} -> {tag, create, deps, ...}
  OrdersTrendCard
    context (unknown): {formatMoney, formatCompactMoney, formatNumber, ...} -> {formatMoney, formatCompactMoney, formatNumber, ...}
  CardHeader
    props.actions: {$$typeof, type, key, ...} -> {$$typeof, type, key, ...}
  RevenueByRegionCard
    state (hook #0): {tag, create, deps, ...} -> {tag, create, deps, ...}
    state (hook #4): {tag, create, deps, ...} -> {tag, create, deps, ...}
    state (hook #5): {tag, create, deps, ...} -> {tag, create, deps, ...}
    context (unknown): {formatMoney, formatCompactMoney, formatNumber, ...} -> {formatMoney, formatCompactMoney, formatNumber, ...}
  DonutChart
    props.segments: Array(6) -> Array(6)
  BarList
    props.data: Array(4) -> Array(4)
  LineChart
    props.formatValue: fn() -> fn()
    props.points: Array(30) -> Array(30)
    state (hook #0): Array(2) -> Array(2)
  UserMenu
    state (hook #2): {tag, create, deps, ...} -> {tag, create, deps, ...}
    context (unknown): {formatMoney, formatCompactMoney, formatNumber, ...} -> {formatMoney, formatCompactMoney, formatNumber, ...}
# exit code: 0 (04:19:24Z UTC)
```

```console
$ npx genie-react call react_render_causes '{"component":"StatCard","limit":10}' --session art-l6
componentMatch:
  component: StatCard
  exact: true
  status: matched
  matchedNames: [StatCard]
  matchedNameCount: 1
  similarNames: []
tracking: true
commits: 1
documentCommitId: 15
observation: {id:observation:2,epoch:2,startedAfterDocumentCommitId:14}
attribution:
  status: current
  startedAtDocumentCommitId: 15
  completedAtDocumentCommitId: 15
  startedAtAnalysisGeneration: 17
  completedAtAnalysisGeneration: 17
view: summary
events[4] (componentName #componentId {fields}, then ← kind evidence name {fields} per cause):
  each: {documentCommitId:15,necessity:unnecessary,necessityReason:output-unchanged,inputEvidence:incomplete,inputCoverage:{complete:false,scanTruncated:true},source:{role:element-callsite,ownership:app}}
  StatCard #16558743093476 {renderEventId:render:15:160,mountId:mount:6,source:{location:/src/features/dashboard/dashboard-page.tsx:55:9}}
    ← context exact "Context(PreferencesProvider)" {contextIndex:0}
  StatCard #16558743093463 {renderEventId:render:15:159,mountId:mount:5,source:{location:/src/features/dashboard/dashboard-page.tsx:49:9}}
    ← context exact "Context(PreferencesProvider)" {contextIndex:0}
  StatCard #16558743093449 {renderEventId:render:15:158,mountId:mount:4,source:{location:/src/features/dashboard/dashboard-page.tsx:42:9}}
    ← context exact "Context(PreferencesProvider)" {contextIndex:0}
  StatCard #16558743093435 {renderEventId:render:15:157,mountId:mount:3,source:{location:/src/features/dashboard/dashboard-page.tsx:35:9}}
    ← context exact "Context(PreferencesProvider)" {contextIndex:0}
omittedByLimit: 0
sourceClassification:
  complete: true
  affects: result
  totalCandidates: 4
  evaluated: 4
  app: 4
  library: 0
  unknown: 0
  unknownComponents: []
  unknownComponentsOmitted: 0
renderEventRetention: {evictedEvents:0,earliestDocumentCommitId:15,latestDocumentCommitId:15}
coverage:
  skippedCommitFibers: 0
  droppedUnmountFibers: 0
  analysisFailedFibers: 0
  pausedCommits: 0
  unobservedCommits: 0
  refreshCommitsExcluded: 0
  truncatedInputFibers: 9
  propsNotEnumeratedFibers: 0
  budgetExhaustedCommits: 0
  budgetExhaustedSubsystems: []
  incompleteBecause[1]:
    - {reason:inputs-truncated,fibers:9,components:[StatCard,NotificationsDrawer,UserMenu,OrdersTrendCard,RevenueByRegionCard,RecentActivityCard],detail:"An input held values Genie compares only in part, such as functions, class instances or objects past the inspected depth; read deepDiff.truncated on these components."}
  complete: false
  inputAttributionComplete: false
  semantics: lower-bound
  coverageDomain: render-causality
  droppedRenderEvents: 0
# exit code: 0 (04:19:24Z UTC)
```

```console
$ agent-browser --session art-l6 find role button click --name 'Expand sidebar'
✓ Done
# exit code: 0 (04:19:32Z UTC)
```

```console
$ agent-browser --session art-l6 open http://127.0.0.1:5216/orders/o-105000
✓ Meridian Ops
  http://127.0.0.1:5216/orders/o-105000?tab=overview
# exit code: 0 (04:19:32Z UTC)
```

```console
$ agent-browser --session art-l6 wait 2500
✓ Done
# exit code: 0 (04:19:35Z UTC)
```

```console
$ agent-browser --session art-l6 network requests --clear
✓ Request log cleared
# exit code: 0 (04:19:35Z UTC)
```

```console
$ npx genie-react call react_clear_renders '{}' --session art-l6 --fields ok,tracking
[1]:
  - {ok:true,tracking:true}
# exit code: 0 (04:19:35Z UTC)
```

```console
$ agent-browser --session art-l6 find role button click --name 'Edit order'
✓ Done
# exit code: 0 (04:19:35Z UTC)
```

```console
$ npx genie-react call react_quiesce '{"idleMs":500,"timeoutMs":10000}' --fail-on-result-error --session art-l6 --fields ok,outcome
[1]:
  - {ok:true,outcome:idle}
# exit code: 0 (04:19:36Z UTC)
```

```console
$ agent-browser --session art-l6 network requests --filter /api/
[16442.686] POST http://127.0.0.1:5216/api/telemetry (Fetch) 200
[16442.704] GET http://127.0.0.1:5216/api/activity?after=0 (Fetch) 200
# exit code: 0 (04:19:36Z UTC)
```

```console
$ agent-browser --session art-l6 react tree --json | python3 /tmp/docs7/art-l6/fiber.py OrderDetailPage
47 153 152 OrderDetailPage
# exit code: 0 (04:19:36Z UTC)
```

```console
$ agent-browser --session art-l6 react inspect 153
OrderDetailPage #153
hooks:
  Params: undefined (1 sub)
  Search: undefined (1 sub)
  Navigate: undefined (2 sub)
  SuspenseQuery: undefined (1 sub)
  SuspenseQuery: undefined (1 sub)
  Preferences: undefined (1 sub)
  BoundStore: undefined (1 sub)
  [27] State: true
  PageView: undefined (1 sub)
  [29] Effect: () => {}
rendered by: Lazy > Memo(MatchInnerImpl) > MatchView > Memo(MatchImpl) > Memo(OutletImpl) > AuthenticatedLayout > Lazy > Memo(MatchInnerImpl) > MatchView > Memo(MatchImpl) > Memo(OutletImpl) > RootLayout > Memo(MatchInnerImpl) > MatchView > Memo(MatchImpl) > MatchesInner > Matches > RouterProvider > App
# exit code: 0 (04:19:40Z UTC)
```

```console
$ npx genie-react call react_effect_timeline '{"component":"OrderDetailPage","appOnly":true,"limit":20}' --session art-l6
tracking: true
documentCommitId: 9
componentMatch:
  component: OrderDetailPage
  exact: true
  status: matched
  matchedNames: [OrderDetailPage]
  matchedNameCount: 1
  similarNames: []
observation: {id:observation:1,epoch:1,startedAfterDocumentCommitId:8}
events[1]:
  - {effectEventId:effect:9:3,effectId:effect:mount:1:11,observationId:observation:1,commitId:1,documentCommitId:9,componentId:9344422772792,componentName:OrderDetailPage,mountId:mount:1,effectIndex:11,hookIndex:33,kind:effect,phase:update,event:scheduled,evidence:exact,dependencyComparison:compared,changedDependencySlots:[1],dependencyChanges:[{slot:1,change:reference-only}],changedDependencySlotsOmitted:0,dependencySlotsUnscanned:0,execution:{status:observed,evidence:exact,startedAt:2968.9,completedAt:2969.5,durationMs:0.6,outcome:completed,trigger:commit},cleanupExecution:{status:unobserved,reason:no-cleanup-returned},consequences:{status:instrumented,observedDomains:[query-notification,router-notification,react-update,react-commit],unobservedDomains:[asynchronous-react-update,external-store-write,network,event-listener,navigation],events:[]},timeline:[{stage:schedule,timestamp:1795061975680,evidence:exact,referenceId:effect:9:3},{stage:execution,timestamp:1795061975681,evidence:exact,trigger:commit,outcome:completed}],hook:useEffect,customHooks:[usePageView],sourceOwnership:app,ownershipEvidence:exact,ownershipReason:exact-hook-order,source:{file:/lib/telemetry.ts,line:7,column:2,functionName:usePageView,sourceMapConfidence:mapped,role:hook-callsite},componentOwnership:app,componentSource:{file:/src/features/orders/order-detail-page.tsx,line:49,column:5,functionName:OrderDetailPage,sourceMapConfidence:mapped,role:component-body}}
omittedByLimit: 0
evictedEvents: 0
droppedEvents: 0
refreshCommitsExcluded: 0
libraryEventsHidden: 2
ownershipCoverage: {complete:true,totalCandidates:3,app:1,library:2,unknown:0}
filteredNote: "1 effects shown; 2 library effects hidden — set appOnly:false to include them"
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
  coverageDomain: render-measurement
  targeted: {components:[],roots:[],processedFibers:0,skippedFibers:0,complete:true}
  observationBudget:
    adaptive: true
    adaptiveScale: 1
    fiberLimit: 250
    operationLimit: 30000
    timeLimitMs: 12
    targetOperationReserve: 4000
    targetTimeReserveMs: 4
    lifecycleBufferLimit: 1000
    lifecycleTargetReserve: 100
  truncatedEffectLists: 0
# exit code: 0 (04:19:40Z UTC)
```

```console
$ agent-browser --session art-l6 press Escape
✓ Done
# exit code: 0 (04:19:49Z UTC)
```

```console
$ agent-browser --session art-l6 find role link click --name 'Dashboard'
✓ Done
# exit code: 0 (04:19:54Z UTC)
```

```console
$ agent-browser --session art-l6 wait 2500
✓ Done
# exit code: 0 (04:19:57Z UTC)
```

```console
$ npx genie-react verify begin --session art-l6 --name 'collapse sidebar' --claim 'render StatCard max 0' --claim 'render SidebarNav min 1'
recording vfy_6aae1fd6-9dd8-42fa-b798-763ea1a6540d "collapse sidebar"
  url "http://127.0.0.1:5216/orders/o-105000?tab=overview"
  1 null render StatCard max 0  {}
  2 null render SidebarNav min 1  {}
window: {observationId:observation:2,startDocumentCommitId:21,domains:[react,query,router],quietMs:500,timeoutMs:10000,tailMs:500}
next: $ pnpm exec genie-react verify end vfy_6aae1fd6-9dd8-42fa-b798-763ea1a6540d --session art-l6
session: {sessionId:0967cf44-e8c0-4b5c-b8f9-9383e6957d6d,logicalSessionId:ff55ccd6-9602-4bdc-a6b2-3ee469a001bc,documentGeneration:4}
schemaVersion: "1.0"
targets: [{target:{component:StatCard},status:resolved,instances:4,source:/src/features/dashboard/dashboard-page.tsx},{target:{component:SidebarNav},status:resolved,instances:1,source:/src/layout/app-shell.tsx}]
startedAt: 2026-11-19T04:19:57.469Z
expiresAt: 2026-11-19T04:24:57.510Z
request: {budget:{fiberLimit:250,operationLimit:20000,timeLimitMs:8,targetOperationReserve:4000,targetTimeReserveMs:4,adaptive:true},settle:{quietMs:500,timeoutMs:10000},maxDurationMs:300000,allowOverrides:false}
# exit code: 0 (04:19:57Z UTC)
```

```console
$ agent-browser --session art-l6 get url
http://127.0.0.1:5216/
# exit code: 0 (04:20:03Z UTC)
```

```console
$ agent-browser --session art-l6 find role button click --name 'Collapse sidebar'
✓ Done
# exit code: 0 (04:20:08Z UTC)
```

```console
$ npx genie-react verify end vfy_6aae1fd6-9dd8-42fa-b798-763ea1a6540d --session art-l6
refused vfy_6aae1fd6-9dd8-42fa-b798-763ea1a6540d "collapse sidebar"  1 commit, quiet after 821 ms (react, query, router)
  url "http://127.0.0.1:5216/orders/o-105000?tab=overview"
  1 refused render StatCard max 0  document_hidden: The document was hidden during the window; throttled timers can push work past the measurement.
      observed: {}
      evidence:{begin:{source:document,state:hidden,hiddenTransitions:1},end:{source:document,state:hidden,hiddenTransitions:1}},fix:{action:begin-again}
      fix: $ pnpm exec genie-react verify begin --session art-l6 --name 'collapse sidebar' --claim 'render StatCard max 0' --claim 'render SidebarNav min 1'
      claim: {kind:renders,target:{component:StatCard},max:0,counting:renders,allowRemount:false}
      deciding: []
  2 refused render SidebarNav min 1  document_hidden: The document was hidden during the window; throttled timers can push work past the measurement.
      observed: {}
      evidence:{begin:{source:document,state:hidden,hiddenTransitions:1},end:{source:document,state:hidden,hiddenTransitions:1}},fix:{action:begin-again}
      fix: $ pnpm exec genie-react verify begin --session art-l6 --name 'collapse sidebar' --claim 'render StatCard max 0' --claim 'render SidebarNav min 1'
      claim: {kind:renders,target:{component:SidebarNav},min:1,counting:renders,allowRemount:false}
      deciding: []
  window document_hidden: The document was hidden during the window; throttled timers can push work past the measurement.
    guard:document-visible
    evidence:{begin:{source:document,state:hidden,hiddenTransitions:1},end:{source:document,state:hidden,hiddenTransitions:1}},fix:{action:begin-again}
    fix: $ pnpm exec genie-react verify begin --session art-l6 --name 'collapse sidebar' --claim 'render StatCard max 0' --claim 'render SidebarNav min 1'
window: {observationId:observation:2,startDocumentCommitId:21,settledDocumentCommitId:22,frozenDocumentCommitId:22,commits:1,settle:{outcome:met,quietMs:500,timeoutMs:10000,waitedMs:821,domains:{react:met,query:met,router:met}},tail:{ms:500,commits:0},environment:{bundle:development,strictMode:on,renderCollection:available,visibility:document}}
! ui-outcome-not-observed: Genie does not check the screen; confirm it with the UI driver
attempt 1 for these claims on this tab
evidence: $ pnpm exec genie-react verify show vfy_6aae1fd6-9dd8-42fa-b798-763ea1a6540d --claim 1 --session art-l6
session: {sessionId:0967cf44-e8c0-4b5c-b8f9-9383e6957d6d,logicalSessionId:ff55ccd6-9602-4bdc-a6b2-3ee469a001bc,documentGeneration:4}
schemaVersion: "1.0"
exitCode: 4
stage: end
ledger: {fingerprint:cf_45b458cfdb14,scope:logical-session,storage:memory,attempt:1,history:[],codeChangedSincePrevious:null,failsOnSameCode:0}
evidence: {retained:true,tools:[react_get_renders,react_component_cohort,react_list_overrides,query_is_fetching,react_refresh_events,browser_visibility,react_profile_stop]}
startedAt: 2026-11-19T04:19:57.469Z
endedAt: 2026-11-19T04:20:10.221Z
request: {budget:{fiberLimit:250,operationLimit:20000,timeLimitMs:8,targetOperationReserve:4000,targetTimeReserveMs:4,adaptive:true},settle:{quietMs:500,timeoutMs:10000},maxDurationMs:300000,allowOverrides:false}
# exit code: 4 (04:20:10Z UTC)
```

Not logged: diagnosis commands between the refusal and this point (eval document.visibilityState printed "hidden", tab list showed one tab t1, 'tab t1' switched to it, after which visibilityState was "visible", then one reload).

```console
$ agent-browser --session art-l6 eval 'document.visibilityState'
"visible"
# exit code: 0 (04:20:29Z UTC)
```

```console
$ agent-browser --session art-l6 get url
http://127.0.0.1:5216/
# exit code: 0 (04:20:29Z UTC)
```

```console
$ npx genie-react verify begin --session art-l6 --name 'collapse sidebar' --claim 'render StatCard max 0' --claim 'render SidebarNav min 1'
recording vfy_42010864-934d-4cae-abd4-ac8858928b42 "collapse sidebar"
  url "http://127.0.0.1:5216/"
  1 null render StatCard max 0  {}
  2 null render SidebarNav min 1  {}
window: {observationId:observation:1,startDocumentCommitId:12,domains:[react,query,router],quietMs:500,timeoutMs:10000,tailMs:500}
next: $ pnpm exec genie-react verify end vfy_42010864-934d-4cae-abd4-ac8858928b42 --session art-l6
session: {sessionId:00e42189-937d-466e-925c-5a54287cbfe1,logicalSessionId:ff55ccd6-9602-4bdc-a6b2-3ee469a001bc,documentGeneration:5}
schemaVersion: "1.0"
targets: [{target:{component:StatCard},status:resolved,instances:4,source:/src/features/dashboard/dashboard-page.tsx},{target:{component:SidebarNav},status:resolved,instances:1,source:/src/layout/app-shell.tsx}]
startedAt: 2026-11-19T04:20:29.295Z
expiresAt: 2026-11-19T04:25:29.307Z
request: {budget:{fiberLimit:250,operationLimit:20000,timeLimitMs:8,targetOperationReserve:4000,targetTimeReserveMs:4,adaptive:true},settle:{quietMs:500,timeoutMs:10000},maxDurationMs:300000,allowOverrides:false}
# exit code: 0 (04:20:29Z UTC)
```

```console
$ agent-browser --session art-l6 find role button click --name 'Collapse sidebar'
✗ 4 elements have role "button", but none match name "Collapse sidebar". Names seen: "Expand sidebar", "Search orders, customers, products… ⌘K", "Notifications, 4 unread", "Account menu"
# exit code: 1 (04:20:33Z UTC)
```

```console
$ npx genie-react verify end vfy_42010864-934d-4cae-abd4-ac8858928b42 --session art-l6
fail vfy_42010864-934d-4cae-abd4-ac8858928b42 "collapse sidebar"  0 commits, quiet after 611 ms (react, query, router)
  url "http://127.0.0.1:5216/"
  1 refused render StatCard max 0  no_activity: No React commit happened in the window; the interaction did not reach this tab or did not change React state.
      observed: {renders:0,mounts:0,updates:0,remounts:0,semantics:exact,instances:4,activeInstances:4}
      evidence:{startDocumentCommitId:12,frozenDocumentCommitId:12,commits:0},fix:{action:drive-observed-tab,url:http://127.0.0.1:5216/}
      fix: $ pnpm exec genie-react verify begin --session art-l6 --name 'collapse sidebar' --claim 'render StatCard max 0' --claim 'render SidebarNav min 1'
      claim: {kind:renders,target:{component:StatCard},max:0,counting:renders,allowRemount:false}
      deciding: []
  2 fail render SidebarNav min 1  {renders:0,mounts:0,updates:0,remounts:0,semantics:exact,instances:1,activeInstances:1}
      claim: {kind:renders,target:{component:SidebarNav},min:1,counting:renders,allowRemount:false}
      deciding: []
  window no_activity: No React commit happened in the window; the interaction did not reach this tab or did not change React state.
    guard:activity
    evidence:{startDocumentCommitId:12,frozenDocumentCommitId:12,commits:0},fix:{action:drive-observed-tab,url:http://127.0.0.1:5216/}
    fix: $ pnpm exec genie-react verify begin --session art-l6 --name 'collapse sidebar' --claim 'render StatCard max 0' --claim 'render SidebarNav min 1'
window: {observationId:observation:1,startDocumentCommitId:12,settledDocumentCommitId:12,frozenDocumentCommitId:12,commits:0,settle:{outcome:met,quietMs:500,timeoutMs:10000,waitedMs:611,domains:{react:met,query:met,router:met}},tail:{ms:500,commits:0},environment:{bundle:development,strictMode:on,renderCollection:available,visibility:document}}
! ui-outcome-not-observed: Genie does not check the screen; confirm it with the UI driver
attempt 1 for these claims on this tab
evidence: $ pnpm exec genie-react verify show vfy_42010864-934d-4cae-abd4-ac8858928b42 --claim 1 --session art-l6
session: {sessionId:00e42189-937d-466e-925c-5a54287cbfe1,logicalSessionId:ff55ccd6-9602-4bdc-a6b2-3ee469a001bc,documentGeneration:5}
schemaVersion: "1.0"
exitCode: 1
stage: end
ledger: {fingerprint:cf_8890737d2c5f,scope:logical-session,storage:memory,attempt:1,history:[],codeChangedSincePrevious:null,failsOnSameCode:0}
evidence: {retained:true,tools:[react_get_renders,react_component_cohort,react_list_overrides,query_is_fetching,react_refresh_events,browser_visibility,react_profile_stop]}
startedAt: 2026-11-19T04:20:29.295Z
endedAt: 2026-11-19T04:20:34.862Z
request: {budget:{fiberLimit:250,operationLimit:20000,timeLimitMs:8,targetOperationReserve:4000,targetTimeReserveMs:4,adaptive:true},settle:{quietMs:500,timeoutMs:10000},maxDurationMs:300000,allowOverrides:false}
# exit code: 1 (04:20:34Z UTC)
```

```console
$ agent-browser --session art-l6 is visible 'button[aria-label="Expand sidebar"]'
true
# exit code: 0 (04:20:34Z UTC)
```

```console
$ agent-browser --session art-l6 find role button click --name 'Expand sidebar'
✓ Done
# exit code: 0 (04:20:42Z UTC)
```

```console
$ agent-browser --session art-l6 wait 1000
✓ Done
# exit code: 0 (04:20:43Z UTC)
```

```console
$ npx genie-react verify begin --session art-l6 --name 'collapse sidebar' --claim 'render StatCard max 0' --claim 'render SidebarNav min 1'
recording vfy_6a45538b-c47a-484d-b42d-0bc1f073c4cd "collapse sidebar"
  url "http://127.0.0.1:5216/"
  1 null render StatCard max 0  {}
  2 null render SidebarNav min 1  {}
window: {observationId:observation:2,startDocumentCommitId:13,domains:[react,query,router],quietMs:500,timeoutMs:10000,tailMs:500}
next: $ pnpm exec genie-react verify end vfy_6a45538b-c47a-484d-b42d-0bc1f073c4cd --session art-l6
session: {sessionId:00e42189-937d-466e-925c-5a54287cbfe1,logicalSessionId:ff55ccd6-9602-4bdc-a6b2-3ee469a001bc,documentGeneration:5}
schemaVersion: "1.0"
targets: [{target:{component:StatCard},status:resolved,instances:4,source:/src/features/dashboard/dashboard-page.tsx},{target:{component:SidebarNav},status:resolved,instances:1,source:/src/layout/app-shell.tsx}]
startedAt: 2026-11-19T04:20:43.384Z
expiresAt: 2026-11-19T04:25:43.388Z
request: {budget:{fiberLimit:250,operationLimit:20000,timeLimitMs:8,targetOperationReserve:4000,targetTimeReserveMs:4,adaptive:true},settle:{quietMs:500,timeoutMs:10000},maxDurationMs:300000,allowOverrides:false}
# exit code: 0 (04:20:43Z UTC)
```

```console
$ agent-browser --session art-l6 find role button click --name 'Collapse sidebar'
✓ Done
# exit code: 0 (04:20:48Z UTC)
```

```console
$ npx genie-react verify end vfy_6a45538b-c47a-484d-b42d-0bc1f073c4cd --session art-l6
fail vfy_6a45538b-c47a-484d-b42d-0bc1f073c4cd "collapse sidebar"  1 commit, quiet after 754 ms (react, query, router)
  url "http://127.0.0.1:5216/"
  1 fail render StatCard max 0  {renders:4,mounts:0,updates:4,remounts:0,semantics:exact,instances:4,activeInstances:4}
      claim: {kind:renders,target:{component:StatCard},max:0,counting:renders,allowRemount:false}
      deciding: [{kind:instance,mountId:mount:1,renders:1,mounts:0,updates:1,mountGeneration:1,latestDocumentCommitId:14,source:/src/features/dashboard/dashboard-page.tsx:35:9},{kind:instance,mountId:mount:2,renders:1,mounts:0,updates:1,mountGeneration:1,latestDocumentCommitId:14,source:/src/features/dashboard/dashboard-page.tsx:42:9},{kind:instance,mountId:mount:3,renders:1,mounts:0,updates:1,mountGeneration:1,latestDocumentCommitId:14,source:/src/features/dashboard/dashboard-page.tsx:49:9}]
  2 pass render SidebarNav min 1  {renders:1,mounts:0,updates:1,remounts:0,semantics:exact,instances:1,activeInstances:1}
      claim: {kind:renders,target:{component:SidebarNav},min:1,counting:renders,allowRemount:false}
      deciding: [{kind:instance,mountId:mount:5,renders:1,mounts:0,updates:1,mountGeneration:1,latestDocumentCommitId:14,source:/src/layout/app-shell.tsx:38:9}]
window: {observationId:observation:2,startDocumentCommitId:13,settledDocumentCommitId:14,frozenDocumentCommitId:14,commits:1,settle:{outcome:met,quietMs:500,timeoutMs:10000,waitedMs:754,domains:{react:met,query:met,router:met}},tail:{ms:500,commits:0},environment:{bundle:development,strictMode:on,renderCollection:available,visibility:document}}
! ui-outcome-not-observed: Genie does not check the screen; confirm it with the UI driver
attempt 2 for these claims on this tab; previous fail vfy_42010864-934d-4cae-abd4-ac8858928b42 (no_activity); no code change observed
evidence: $ pnpm exec genie-react verify show vfy_6a45538b-c47a-484d-b42d-0bc1f073c4cd --claim 1 --session art-l6
session: {sessionId:00e42189-937d-466e-925c-5a54287cbfe1,logicalSessionId:ff55ccd6-9602-4bdc-a6b2-3ee469a001bc,documentGeneration:5}
schemaVersion: "1.0"
exitCode: 1
stage: end
ledger: {fingerprint:cf_8890737d2c5f,scope:logical-session,storage:memory,attempt:2,history:[{verificationId:vfy_42010864-934d-4cae-abd4-ac8858928b42,verdict:fail,reasons:[no_activity],endedAt:2026-11-19T04:20:34.862Z}],codeChangedSincePrevious:none-observed,failsOnSameCode:1}
evidence: {retained:true,tools:[react_get_renders,react_component_cohort,react_list_overrides,query_is_fetching,react_refresh_events,browser_visibility,react_profile_stop]}
startedAt: 2026-11-19T04:20:43.384Z
endedAt: 2026-11-19T04:20:49.756Z
request: {budget:{fiberLimit:250,operationLimit:20000,timeLimitMs:8,targetOperationReserve:4000,targetTimeReserveMs:4,adaptive:true},settle:{quietMs:500,timeoutMs:10000},maxDurationMs:300000,allowOverrides:false}
# exit code: 1 (04:20:49Z UTC)
```

