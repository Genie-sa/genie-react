# Evidence: AI React performance tuning on the New order page

- Date: 2026-11-19 (UTC times appear in the log)
- Commit: `c46150076cdc8ecf927d31abbd78104804fd7ad7` (`git rev-parse HEAD`). App source unmodified except for the temporary fixes shown in the log, each reverted with `git checkout`.
- App: `apps/realworld-dashboard` (Meridian Ops), React 19.3.1 in StrictMode, Vite 8 dev server, **development bundle**
- URL: http://127.0.0.1:5217/orders/new
- Genie CLI and runtime: 1.0.2 (workspace build), session `art-l7`, driver agent-browser 0.39.1
- Seeded bug: `evals/realworld/dashboard/new-order-notes-typing-lag.json`
- The dev server ran twice. The second session (marked in the log) reran the six-and-six capture comparison with an 8 ms budget. One attempt to reapply the fix in that session failed, and the log marks the six captures it produced as discarded.

## Setup

```bash
pnpm install && pnpm build
pnpm install --offline   # the first install ran before the CLI was built, so the app had no node_modules/.bin/genie-react until this second install linked it
cd apps/realworld-dashboard
DASHBOARD_PORT=5217 pnpm exec vite --port 5217 --strictPort
```

Every command below ran from `apps/realworld-dashboard`. Each block is the command, its full output, and its exit code (`[exit N]`). Lines starting with `###` are notes added while recording, such as when a temporary fix was applied or reverted.

## Log

```text
$ agent-browser --session art-l7 open http://127.0.0.1:5217/login
[agent-browser] launched browser
✓ Meridian Ops
  http://127.0.0.1:5217/login
[exit 0]

$ node_modules/.bin/genie-react status --session art-l7 --wait 15000
selectedBridgeUrl: ws://127.0.0.1:5217/__genie/ws
sessionSelector:
  requested: art-l7
  source: flag
  resolvedSessionId: 00315d6e-6434-4a4a-879f-e548a26ec1d2
  implicit: false
  agentBrowser: {session:art-l7,via:selector,logicalSessionId:f302b7a7-ad8a-4a18-be94-bcefe0ff9a9b}
connected: true
ready: true
sessionId: 00315d6e-6434-4a4a-879f-e548a26ec1d2
app: {name:"Meridian Ops",url:http://127.0.0.1:5217/login,reactVersion:19.3.1,reactMounted:true}
domains: [session,react,app,memory,perf,plugin,timeline,router,query]
toolCount: 98
sessions[1] (sessionId {fields}):
  00315d6e-6434-4a4a-879f-e548a26ec1d2 {logicalSessionId:f302b7a7-ad8a-4a18-be94-bcefe0ff9a9b,documentGeneration:2,logicalSessionCollision:false,collisionWithSessionIds:[],app:{name:"Meridian Ops",url:http://127.0.0.1:5217/login,reactVersion:19.3.1,reactMounted:true},domains:[session,react,app,memory,perf,plugin,timeline,router,query],toolCount:98,connectedAt:1795061553458,ready:true,readyAt:1795061553458,current:true,origin:http://127.0.0.1:5217,runtimeVersion:1.0.2}
warnings: []
hub: {version:1.0.2,protocol:1}
[exit 0]

$ node_modules/.bin/genie-react call app_login_as '{"role":"manager"}' --session art-l7
changed: true
role: manager
userId: u-manager
[exit 0]

$ agent-browser --session art-l7 open http://127.0.0.1:5217/orders/new
✓ Meridian Ops
  http://127.0.0.1:5217/orders/new
[exit 0]

$ node_modules/.bin/genie-react call devtools_wait '{"condition":"settled","timeoutMs":10000}' --session art-l7
ok: true
condition: settled
waitedMs: 919
validConditions: [connected,ready,component,query-settled,navigation,react-quiet,settled]
lastObserved:
  react:
    documentCommitId: 9
    renderCollection: available
    quietForMs: 606
    requiredQuietMs: 500
    pendingWork: {documentCommitId:9,scheduledRoots:0,suspendedBoundaries:0,dehydratedBoundaries:0,boundaries:[],scanTruncated:false,scannedFibers:292}
domains:
  react:
    status: met
    lastObserved: {documentCommitId:9,renderCollection:available,quietForMs:606,requiredQuietMs:500,pendingWork:{documentCommitId:9,scheduledRoots:0,suspendedBoundaries:0,dehydratedBoundaries:0,boundaries:[],scanTruncated:false,scannedFibers:292}}
[exit 0]

$ agent-browser --session art-l7 snapshot -i
- generic "MMeridian OpsDashboardOrdersCustomersInventoryReportsSettingsSearch orders, customers, products…⌘K4P" [ref=e1] clickable [onclick]
  - link "Dashboard" [ref=e5]
  - link "Orders" [ref=e6]
  - link "Customers" [ref=e7]
  - link "Inventory" [ref=e8]
  - link "Reports" [ref=e9]
  - link "Settings" [ref=e10]
  - button "Collapse sidebar" [ref=e2]
  - button "Search orders, customers, products… ⌘K" [ref=e3]
  - button "Notifications, 4 unread" [ref=e4]
  - button "Account menu" [expanded=false, ref=e11]
  - link "All orders" [ref=e12]
  - heading "New order" [level=1, ref=e13]
  - heading "Customer and fulfillment" [level=2, ref=e19]
  - combobox "Customer" [expanded=false, ref=e20]
  - combobox "Warehouse" [expanded=false, ref=e14]: Select a warehouse
    - option "Select a warehouse" [selected, ref=e24]
    - option "Reno DC (NA)" [ref=e25]
    - option "Columbus DC (NA)" [ref=e26]
    - option "Rotterdam Hub (EMEA)" [ref=e27]
    - option "Leipzig Hub (EMEA)" [ref=e28]
    - option "Singapore Hub (APAC)" [ref=e29]
    - option "São Paulo DC (LATAM)" [ref=e30]
  - combobox "Priority" [expanded=false, ref=e15]: standard
    - option "standard" [selected, ref=e31]
    - option "expedited" [ref=e32]
    - option "critical" [ref=e33]
  - textbox "Shipping address" [ref=e16]
  - heading "Products" [level=2, ref=e21]
  - textbox "Find a product" [ref=e17]
  - heading "Notes" [level=2, ref=e22]
  - textbox "Notes for the warehouse team" [ref=e18]
  - heading "Summary" [level=2, ref=e34]
  - button "Create order" [ref=e23]
[exit 0]

$ node_modules/.bin/genie-react call react_clear_renders '{"component":"ProductPicker"}' --session art-l7
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

$ agent-browser --session art-l7 type @e18 'Leave at dock 4, call ahead'
✓ Done
[exit 0]

$ node_modules/.bin/genie-react call react_quiesce '{"idleMs":500,"timeoutMs":10000}' --fail-on-result-error --session art-l7
ok: true
outcome: idle
elapsedMs: 752
observedCommits: 0
documentCommitId: 36
sessionId: 80c88640-22c9-400a-bea8-d0168da604c8
renderCollection: available
pendingWork:
  documentCommitId: 36
  scheduledRoots: 0
  suspendedBoundaries: 0
  dehydratedBoundaries: 0
  boundaries: []
  scanTruncated: false
  scannedFibers: 292
[exit 0]

$ node_modules/.bin/genie-react call react_get_renders '{"sort":"selfTime","limit":5}' --session art-l7
tracking: true
renderCollection: available
bundle: development
timingsBundleDependent: true
countsScope: observed-run
commits: 27
documentCommitId: 36
observation: {id:observation:1,epoch:1,startedAfterDocumentCommitId:9}
attribution:
  status: current
  startedAtDocumentCommitId: 36
  completedAtDocumentCommitId: 36
  startedAtAnalysisGeneration: 37
  completedAtAnalysisGeneration: 37
view: summary
summary:
  commits: 27
  trackedComponents: 28
  totalRenders: 756
  totalUpdates: 756
  referenceOnlyPropComponents: 0
  noObservedInputChangeComponents: 6
  topReferenceOnlyProps: [{name:selectedIds,count:1}]
  semantics: unknown
  coverageDomain: render-measurement
components[5] (name #id {fields}, then ← kind evidence name {fields} per cause):
  each: {renders:27,updates:27,latestDocumentCommitId:36,inputEvidence:changed,source:{ownership:app}}
  ProductPicker #7344108863628 {mountId:mount:1,selfTime:42.3,totalTime:42.4,cumulativeSelfTime:1092.8,cumulativeTotalTime:1093.9,causeCounts:{props:54,parent:27},necessity:unknown,necessityReason:callbacks-changed,source:{location:/src/features/orders/create-order-page.tsx:172:15,role:element-callsite}}
    ← parent inferred CardBody {origin:CreateOrderPage}
    ← props exact selectedIds {referenceOnly:true}
    ← props exact onPick
  CreateOrderPage #7344108863541 {mountId:mount:2,noObservedInputChange:27,selfTime:1,totalTime:44.2,cumulativeSelfTime:19.2,cumulativeTotalTime:1142.7,causeCounts:{state:27},necessity:unnecessary,necessityReason:inputs-unchanged,source:{location:/src/features/orders/create-order-page.tsx:100:5,role:component-body}}
    ← state exact "state[3]"
  CustomerCombobox #7344108863566 {mountId:mount:11,selfTime:0.2,totalTime:0.2,cumulativeSelfTime:2,cumulativeTotalTime:2.3,causeCounts:{props:27,parent:27},necessity:unknown,necessityReason:callbacks-changed,source:{location:/src/features/orders/create-order-page.tsx:116:19,role:element-callsite}}
    ← parent inferred Field {origin:CreateOrderPage}
    ← props exact onChange
  Field #7344108863570 {mountId:mount:13,selfTime:0.2,totalTime:0.3,cumulativeSelfTime:4.4,cumulativeTotalTime:5.4,causeCounts:{children:27,parent:27},necessity:unknown,necessityReason:callbacks-changed,source:{location:/src/features/orders/create-order-page.tsx:128:15,role:element-callsite}}
    ← parent inferred CardBody {origin:CreateOrderPage}
    ← children exact
  Field #7344108863607 {mountId:mount:15,selfTime:0.2,totalTime:0.2,cumulativeSelfTime:2.5,cumulativeTotalTime:3,causeCounts:{children:27,parent:27},necessity:unknown,necessityReason:callbacks-changed,source:{location:/src/features/orders/create-order-page.tsx:144:15,role:element-callsite}}
    ← parent inferred CardBody {origin:CreateOrderPage}
    ← children exact
sourceClassification:
  complete: false
  affects: result
  totalCandidates: 31
  evaluated: 31
  app: 27
  library: 3
  unknown: 1
  unknownComponents: ["create-order-page.tsx (/src/features/orders/create-order-page.tsx)"]
  unknownComponentsOmitted: 0
omittedByLimit: 23
nextCursor: 4436e8a4-7e1c-464e-ae2d-8c96d4fa67f6:5
pagination:
  snapshotId: 4436e8a4-7e1c-464e-ae2d-8c96d4fa67f6
  offset: 0
  totalComponents: 28
  expiresAt: 1795061867557
comparable: false
notComparableReasons: [app-source-classification-incomplete]
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
  complete: false
  inputAttributionComplete: true
  semantics: unknown
  coverageDomain: render-causality
  incompleteBecause[1]:
    - {reason:source-classification-incomplete,fibers:1,detail:"1 of 31 candidates have unresolved ownership. appOnly keeps them, but any of them may be library code it would hide, so rows and counts can change once ownership resolves.",next:"Pass appOnly:false for counts that do not depend on ownership, or read again shortly: ownership keeps resolving in the background, though a component React rendered without an owner stack stays unknown."}
filteredNote: "5 components shown; 3 library components hidden — set appOnly:false to include them"
[exit 0]

$ node_modules/.bin/genie-react call react_render_causes '{"component":"CreateOrderPage","limit":1}' --session art-l7
componentMatch:
  component: CreateOrderPage
  exact: true
  status: matched
  matchedNames: [CreateOrderPage]
  matchedNameCount: 1
  similarNames: []
tracking: true
commits: 27
documentCommitId: 36
observation: {id:observation:1,epoch:1,startedAfterDocumentCommitId:9}
attribution:
  status: current
  startedAtDocumentCommitId: 36
  completedAtDocumentCommitId: 36
  startedAtAnalysisGeneration: 37
  completedAtAnalysisGeneration: 37
view: summary
events[1] (componentName #componentId {fields}, then ← kind evidence name {fields} per cause):
  CreateOrderPage #7344108863541 {renderEventId:render:36:968,documentCommitId:36,mountId:mount:2,necessity:unnecessary,necessityReason:inputs-unchanged,inputEvidence:changed,source:{location:/src/features/orders/create-order-page.tsx:100:5,role:component-body,ownership:app}}
    ← state exact "state[3]"
omittedByLimit: 26
sourceClassification:
  complete: true
  affects: result
  totalCandidates: 27
  evaluated: 27
  app: 27
  library: 0
  unknown: 0
  unknownComponents: []
  unknownComponentsOmitted: 0
renderEventRetention: {evictedEvents:0,earliestDocumentCommitId:10,latestDocumentCommitId:36}
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

$ node_modules/.bin/genie-react call react_render_causes '{"component":"ProductPicker","limit":1}' --session art-l7
componentMatch:
  component: ProductPicker
  exact: true
  status: matched
  matchedNames: [ProductPicker]
  matchedNameCount: 1
  similarNames: []
tracking: true
commits: 27
documentCommitId: 36
observation: {id:observation:1,epoch:1,startedAfterDocumentCommitId:9}
attribution:
  status: current
  startedAtDocumentCommitId: 36
  completedAtDocumentCommitId: 36
  startedAtAnalysisGeneration: 37
  completedAtAnalysisGeneration: 37
view: summary
events[1] (componentName #componentId {fields}, then ← kind evidence name {fields} per cause):
  ProductPicker #7344108863628 {renderEventId:render:36:963,documentCommitId:36,mountId:mount:1,necessity:unknown,necessityReason:callbacks-changed,inputEvidence:changed,source:{location:/src/features/orders/create-order-page.tsx:172:15,role:element-callsite,ownership:app}}
    ← parent inferred CardBody {origin:CreateOrderPage}
    ← props exact selectedIds {referenceOnly:true}
    ← props exact onPick
omittedByLimit: 26
sourceClassification:
  complete: true
  affects: result
  totalCandidates: 27
  evaluated: 27
  app: 27
  library: 0
  unknown: 0
  unknownComponents: []
  unknownComponentsOmitted: 0
renderEventRetention: {evictedEvents:0,earliestDocumentCommitId:10,latestDocumentCommitId:36}
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

$ agent-browser --session art-l7 fill 'textarea[name="notes"]' ''
✓ Done
[exit 0]

$ node_modules/.bin/genie-react verify begin --session art-l7 --name 'type warehouse notes' --claim 'render ProductPicker max 0' --claim 'render CreateOrderPage min 1' --claim 'boundaries clean'
recording vfy_c854b38a-c520-4366-af0d-ed0486fed86f "type warehouse notes"
  url "http://127.0.0.1:5217/orders/new"
  1 null render ProductPicker max 0  {}
  2 null render CreateOrderPage min 1  {}
  3 null boundaries clean  {}
window: {observationId:observation:2,startDocumentCommitId:36,domains:[react,query,router],quietMs:500,timeoutMs:10000,tailMs:500}
next: $ pnpm exec genie-react verify end vfy_c854b38a-c520-4366-af0d-ed0486fed86f --session art-l7
session: {sessionId:80c88640-22c9-400a-bea8-d0168da604c8,logicalSessionId:f302b7a7-ad8a-4a18-be94-bcefe0ff9a9b,documentGeneration:3}
schemaVersion: "1.0"
targets: [{target:{component:ProductPicker},status:resolved,instances:1,source:/src/features/orders/create-order-page.tsx},{target:{component:CreateOrderPage},status:resolved,instances:1,source:/src/features/orders/create-order-page.tsx}]
startedAt: 2026-11-19T04:13:52.633Z
expiresAt: 2026-11-19T04:18:52.644Z
request: {budget:{fiberLimit:250,operationLimit:20000,timeLimitMs:8,targetOperationReserve:4000,targetTimeReserveMs:4,adaptive:true},settle:{quietMs:500,timeoutMs:10000},maxDurationMs:300000,allowOverrides:false}
[exit 0]

$ agent-browser --session art-l7 type 'textarea[name="notes"]' 'Leave at dock 4, call ahead'
✓ Done
[exit 0]

$ node_modules/.bin/genie-react verify end vfy_c854b38a-c520-4366-af0d-ed0486fed86f --session art-l7
fail vfy_c854b38a-c520-4366-af0d-ed0486fed86f "type warehouse notes"  27 commits, quiet after 757 ms (react, query, router)
  url "http://127.0.0.1:5217/orders/new"
  1 fail render ProductPicker max 0  {renders:27,mounts:0,updates:27,remounts:0,semantics:exact,instances:1,activeInstances:1}
      claim: {kind:renders,target:{component:ProductPicker},max:0,counting:renders,allowRemount:false}
      deciding: [{kind:instance,mountId:mount:1,renders:27,mounts:0,updates:27,mountGeneration:1,latestDocumentCommitId:63,source:/src/features/orders/create-order-page.tsx:172:15}]
  2 pass render CreateOrderPage min 1  {renders:27,mounts:0,updates:27,remounts:0,semantics:exact,instances:1,activeInstances:1}
      claim: {kind:renders,target:{component:CreateOrderPage},min:1,counting:renders,allowRemount:false}
      deciding: [{kind:instance,mountId:mount:2,renders:27,mounts:0,updates:27,mountGeneration:1,latestDocumentCommitId:63,source:/src/features/orders/create-order-page.tsx:100:5}]
  3 pass boundaries clean  {caughtDuringWindow:0,caughtAtEnd:0}
      claim: {kind:boundaries-clean,scope:window}
      deciding: [{kind:boundary-log,scope:window,complete:true,afterDocumentCommitId:36}]
      caveats: [uncaught-errors-outside-boundaries-unobserved]
window: {observationId:observation:2,startDocumentCommitId:36,settledDocumentCommitId:63,frozenDocumentCommitId:63,commits:27,settle:{outcome:met,quietMs:500,timeoutMs:10000,waitedMs:757,domains:{react:met,query:met,router:met}},tail:{ms:500,commits:0},environment:{bundle:development,strictMode:on,renderCollection:available,visibility:document}}
! ui-outcome-not-observed: Genie does not check the screen; confirm it with the UI driver
attempt 1 for these claims on this tab
evidence: $ pnpm exec genie-react verify show vfy_c854b38a-c520-4366-af0d-ed0486fed86f --claim 1 --session art-l7
session: {sessionId:80c88640-22c9-400a-bea8-d0168da604c8,logicalSessionId:f302b7a7-ad8a-4a18-be94-bcefe0ff9a9b,documentGeneration:3}
schemaVersion: "1.0"
exitCode: 1
stage: end
ledger: {fingerprint:cf_79c0241efc06,scope:logical-session,storage:memory,attempt:1,history:[],codeChangedSincePrevious:null,failsOnSameCode:0}
evidence: {retained:true,tools:[react_get_renders,react_component_cohort,react_list_overrides,query_is_fetching,react_refresh_events,browser_visibility,react_profile_stop,react_error_state]}
startedAt: 2026-11-19T04:13:52.633Z
endedAt: 2026-11-19T04:13:59.430Z
request: {budget:{fiberLimit:250,operationLimit:20000,timeLimitMs:8,targetOperationReserve:4000,targetTimeReserveMs:4,adaptive:true},settle:{quietMs:500,timeoutMs:10000},maxDurationMs:300000,allowOverrides:false}
[exit 1]

$ agent-browser --session art-l7 fill 'textarea[name="notes"]' ''
✓ Done
[exit 0]

$ node_modules/.bin/genie-react call react_clear_renders '{}' --session art-l7 --fields ok,observation
[1]:
  - {ok:true,observation:{id:observation:3,epoch:3,startedAfterDocumentCommitId:63}}
[exit 0]

$ agent-browser --session art-l7 type 'textarea[name="notes"]' 'Leave at dock 4, call ahead'
✓ Done
[exit 0]

$ node_modules/.bin/genie-react call react_quiesce '{"idleMs":500,"timeoutMs":10000}' --fail-on-result-error --session art-l7 --fields outcome
[1]:
  - {outcome:idle}
[exit 0]

$ node_modules/.bin/genie-react call devtools_capture_create '{"name":"before","include":["react"]}' --session art-l7 --json
{"schemaVersion":"1.0","captureId":"cap_e9270778-d3b0-47fe-a1c8-18b0d66e4a05","name":"before","createdAt":"2026-11-19T04:14:07.705Z","session":{"sessionId":"80c88640-22c9-400a-bea8-d0168da604c8","logicalSessionId":"f302b7a7-ad8a-4a18-be94-bcefe0ff9a9b","documentGeneration":3,"app":{"name":"Meridian Ops","url":"http://127.0.0.1:5217/orders/new","reactVersion":"19.3.1","reactMounted":true}},"include":["react"],"consistency":{"kind":"react-commit-stable","attempts":1,"reactCommit":90,"reason":"React document commit markers matched before, during, and after all captured sections."},"complete":false,"sizeBytes":273381,"pinned":false,"summary":{"sectionStatus":{"react":"ok"},"metrics":{"react.commits":27,"react.renders":756,"query.pending":null,"memory.usedHeapBytes":null,"performance.avgFps":null},"warningCount":0},"integrity":{"algorithm":"sha256","scope":"capture-content-v1","digest":"91a60fa36b1aa61ba827f81509c3d927d08ce6e15994d9bd5963b2cd86777f19"},"warnings":[],"availableSections":["react"],"renders":{"comparable":false,"notComparableReasons":["app-source-classification-incomplete"],"coverage":{"complete":false,"semantics":"unknown"}}}
[exit 0]

$ agent-browser --session art-l7 fill 'textarea[name="notes"]' ''
✓ Done
[exit 0]

$ node_modules/.bin/genie-react call react_clear_renders '{}' --session art-l7 --fields ok,observation
[1]:
  - {ok:true,observation:{id:observation:4,epoch:4,startedAfterDocumentCommitId:90}}
[exit 0]

$ agent-browser --session art-l7 type 'textarea[name="notes"]' 'Leave at dock 4, call ahead'
✓ Done
[exit 0]

$ node_modules/.bin/genie-react call react_quiesce '{"idleMs":500,"timeoutMs":10000}' --fail-on-result-error --session art-l7 --fields outcome
[1]:
  - {outcome:idle}
[exit 0]

$ node_modules/.bin/genie-react call devtools_capture_create '{"name":"before","include":["react"]}' --session art-l7 --json
{"schemaVersion":"1.0","captureId":"cap_1fa8607e-cf65-4a6e-a9a9-761edaef15bf","name":"before","createdAt":"2026-11-19T04:14:09.991Z","session":{"sessionId":"80c88640-22c9-400a-bea8-d0168da604c8","logicalSessionId":"f302b7a7-ad8a-4a18-be94-bcefe0ff9a9b","documentGeneration":3,"app":{"name":"Meridian Ops","url":"http://127.0.0.1:5217/orders/new","reactVersion":"19.3.1","reactMounted":true}},"include":["react"],"consistency":{"kind":"react-commit-stable","attempts":1,"reactCommit":117,"reason":"React document commit markers matched before, during, and after all captured sections."},"complete":false,"sizeBytes":273518,"pinned":false,"summary":{"sectionStatus":{"react":"ok"},"metrics":{"react.commits":27,"react.renders":756,"query.pending":null,"memory.usedHeapBytes":null,"performance.avgFps":null},"warningCount":0},"integrity":{"algorithm":"sha256","scope":"capture-content-v1","digest":"41addd6d25ec7c52de9ba35957a3a7e7d85b42ce3fcc8943fda211cfed61a1b5"},"warnings":[],"availableSections":["react"],"renders":{"comparable":false,"notComparableReasons":["app-source-classification-incomplete"],"coverage":{"complete":false,"semantics":"unknown"}}}
[exit 0]

$ agent-browser --session art-l7 fill 'textarea[name="notes"]' ''
✓ Done
[exit 0]

$ node_modules/.bin/genie-react call react_clear_renders '{}' --session art-l7 --fields ok,observation
[1]:
  - {ok:true,observation:{id:observation:5,epoch:5,startedAfterDocumentCommitId:117}}
[exit 0]

$ agent-browser --session art-l7 type 'textarea[name="notes"]' 'Leave at dock 4, call ahead'
✓ Done
[exit 0]

$ node_modules/.bin/genie-react call react_quiesce '{"idleMs":500,"timeoutMs":10000}' --fail-on-result-error --session art-l7 --fields outcome
[1]:
  - {outcome:idle}
[exit 0]

$ node_modules/.bin/genie-react call devtools_capture_create '{"name":"before","include":["react"]}' --session art-l7 --json
{"schemaVersion":"1.0","captureId":"cap_620d1587-9a0a-464e-859f-2f9dbbb9b220","name":"before","createdAt":"2026-11-19T04:14:12.258Z","session":{"sessionId":"80c88640-22c9-400a-bea8-d0168da604c8","logicalSessionId":"f302b7a7-ad8a-4a18-be94-bcefe0ff9a9b","documentGeneration":3,"app":{"name":"Meridian Ops","url":"http://127.0.0.1:5217/orders/new","reactVersion":"19.3.1","reactMounted":true}},"include":["react"],"consistency":{"kind":"react-commit-stable","attempts":1,"reactCommit":144,"reason":"React document commit markers matched before, during, and after all captured sections."},"complete":false,"sizeBytes":273533,"pinned":false,"summary":{"sectionStatus":{"react":"ok"},"metrics":{"react.commits":27,"react.renders":756,"query.pending":null,"memory.usedHeapBytes":null,"performance.avgFps":null},"warningCount":0},"integrity":{"algorithm":"sha256","scope":"capture-content-v1","digest":"a44b04d5a4790a54868e13e9c6672a8ec4a27d6b62cdc259eabdb6af20372a74"},"warnings":[],"availableSections":["react"],"renders":{"comparable":false,"notComparableReasons":["app-source-classification-incomplete"],"coverage":{"complete":false,"semantics":"unknown"}}}
[exit 0]

$ agent-browser --session art-l7 fill 'textarea[name="notes"]' ''
✓ Done
[exit 0]

$ node_modules/.bin/genie-react call react_clear_renders '{}' --session art-l7 --fields ok,observation
[1]:
  - {ok:true,observation:{id:observation:6,epoch:6,startedAfterDocumentCommitId:144}}
[exit 0]

$ agent-browser --session art-l7 type 'textarea[name="notes"]' 'Leave at dock 4, call ahead'
✓ Done
[exit 0]

$ node_modules/.bin/genie-react call react_quiesce '{"idleMs":500,"timeoutMs":10000}' --fail-on-result-error --session art-l7 --fields outcome
[1]:
  - {outcome:idle}
[exit 0]

$ node_modules/.bin/genie-react call devtools_capture_create '{"name":"before","include":["react"]}' --session art-l7 --json
{"schemaVersion":"1.0","captureId":"cap_18650357-6453-4272-8304-b571c77ee2dd","name":"before","createdAt":"2026-11-19T04:14:14.559Z","session":{"sessionId":"80c88640-22c9-400a-bea8-d0168da604c8","logicalSessionId":"f302b7a7-ad8a-4a18-be94-bcefe0ff9a9b","documentGeneration":3,"app":{"name":"Meridian Ops","url":"http://127.0.0.1:5217/orders/new","reactVersion":"19.3.1","reactMounted":true}},"include":["react"],"consistency":{"kind":"react-commit-stable","attempts":1,"reactCommit":171,"reason":"React document commit markers matched before, during, and after all captured sections."},"complete":false,"sizeBytes":273513,"pinned":false,"summary":{"sectionStatus":{"react":"ok"},"metrics":{"react.commits":27,"react.renders":756,"query.pending":null,"memory.usedHeapBytes":null,"performance.avgFps":null},"warningCount":0},"integrity":{"algorithm":"sha256","scope":"capture-content-v1","digest":"54f9f888a7ab411ec218a07af0037348d93db0ef5ff85cdf24cdcadb6e301804"},"warnings":[],"availableSections":["react"],"renders":{"comparable":false,"notComparableReasons":["app-source-classification-incomplete"],"coverage":{"complete":false,"semantics":"unknown"}}}
[exit 0]

$ agent-browser --session art-l7 fill 'textarea[name="notes"]' ''
✓ Done
[exit 0]

$ node_modules/.bin/genie-react call react_clear_renders '{}' --session art-l7 --fields ok,observation
[1]:
  - {ok:true,observation:{id:observation:7,epoch:7,startedAfterDocumentCommitId:171}}
[exit 0]

$ agent-browser --session art-l7 type 'textarea[name="notes"]' 'Leave at dock 4, call ahead'
✓ Done
[exit 0]

$ node_modules/.bin/genie-react call react_quiesce '{"idleMs":500,"timeoutMs":10000}' --fail-on-result-error --session art-l7 --fields outcome
[1]:
  - {outcome:idle}
[exit 0]

$ node_modules/.bin/genie-react call devtools_capture_create '{"name":"before","include":["react"]}' --session art-l7 --json
{"schemaVersion":"1.0","captureId":"cap_cd01bb91-2486-4518-b844-1ffb2998de70","name":"before","createdAt":"2026-11-19T04:14:17.085Z","session":{"sessionId":"80c88640-22c9-400a-bea8-d0168da604c8","logicalSessionId":"f302b7a7-ad8a-4a18-be94-bcefe0ff9a9b","documentGeneration":3,"app":{"name":"Meridian Ops","url":"http://127.0.0.1:5217/orders/new","reactVersion":"19.3.1","reactMounted":true}},"include":["react"],"consistency":{"kind":"react-commit-stable","attempts":1,"reactCommit":198,"reason":"React document commit markers matched before, during, and after all captured sections."},"complete":false,"sizeBytes":273533,"pinned":false,"summary":{"sectionStatus":{"react":"ok"},"metrics":{"react.commits":27,"react.renders":756,"query.pending":null,"memory.usedHeapBytes":null,"performance.avgFps":null},"warningCount":0},"integrity":{"algorithm":"sha256","scope":"capture-content-v1","digest":"1cd0b94d96ce9f789dad2ef9c5c5e6a45701de1bd0c69ef3a8f5705041168208"},"warnings":[],"availableSections":["react"],"renders":{"comparable":false,"notComparableReasons":["app-source-classification-incomplete"],"coverage":{"complete":false,"semantics":"unknown"}}}
[exit 0]

$ agent-browser --session art-l7 fill 'textarea[name="notes"]' ''
✓ Done
[exit 0]

$ node_modules/.bin/genie-react call react_clear_renders '{}' --session art-l7 --fields ok,observation
[1]:
  - {ok:true,observation:{id:observation:8,epoch:8,startedAfterDocumentCommitId:198}}
[exit 0]

$ agent-browser --session art-l7 type 'textarea[name="notes"]' 'Leave at dock 4, call ahead'
✓ Done
[exit 0]

$ node_modules/.bin/genie-react call react_quiesce '{"idleMs":500,"timeoutMs":10000}' --fail-on-result-error --session art-l7 --fields outcome
[1]:
  - {outcome:idle}
[exit 0]

$ node_modules/.bin/genie-react call devtools_capture_create '{"name":"before","include":["react"]}' --session art-l7 --json
{"schemaVersion":"1.0","captureId":"cap_44e663e7-82db-4101-bfe0-2b6811cebaa3","name":"before","createdAt":"2026-11-19T04:14:19.342Z","session":{"sessionId":"80c88640-22c9-400a-bea8-d0168da604c8","logicalSessionId":"f302b7a7-ad8a-4a18-be94-bcefe0ff9a9b","documentGeneration":3,"app":{"name":"Meridian Ops","url":"http://127.0.0.1:5217/orders/new","reactVersion":"19.3.1","reactMounted":true}},"include":["react"],"consistency":{"kind":"react-commit-stable","attempts":1,"reactCommit":225,"reason":"React document commit markers matched before, during, and after all captured sections."},"complete":false,"sizeBytes":273523,"pinned":false,"summary":{"sectionStatus":{"react":"ok"},"metrics":{"react.commits":27,"react.renders":756,"query.pending":null,"memory.usedHeapBytes":null,"performance.avgFps":null},"warningCount":0},"integrity":{"algorithm":"sha256","scope":"capture-content-v1","digest":"e88716e7f7777d1100e4f1c1570526df6f95a7d054e05022fe4bc5610bc14925"},"warnings":[],"availableSections":["react"],"renders":{"comparable":false,"notComparableReasons":["app-source-classification-incomplete"],"coverage":{"complete":false,"semantics":"unknown"}}}
[exit 0]

### FIX 1 APPLIED (useMemo index)
diff --git a/apps/realworld-dashboard/src/features/orders/product-picker.tsx b/apps/realworld-dashboard/src/features/orders/product-picker.tsx
index 30294a2..93906fe 100644
--- a/apps/realworld-dashboard/src/features/orders/product-picker.tsx
+++ b/apps/realworld-dashboard/src/features/orders/product-picker.tsx
@@ -1,5 +1,5 @@
 import { Plus } from 'lucide-react'
-import { useState } from 'react'
+import { useMemo, useState } from 'react'
 import type { Product } from '../../api/types'
 import { usePreferences } from '../../app/preferences'
 import { Input } from '../../components/ui/form-controls'
@@ -19,7 +19,7 @@ export function ProductPicker({
 }) {
   const { formatMoney } = usePreferences()
   const [term, setTerm] = useState('')
-  const index = buildProductIndex(products)
+  const index = useMemo(() => buildProductIndex(products), [products])
   const matches = term.trim().length < MIN_TERM_LENGTH ? [] : index.search(term, RESULT_LIMIT)
 
   return (

$ agent-browser --session art-l7 fill 'textarea[name="notes"]' ''
✓ Done
[exit 0]

$ node_modules/.bin/genie-react call react_clear_renders '{"component":"ProductPicker"}' --session art-l7 --fields ok,observation
[1]:
  - {ok:true,observation:{id:observation:1,epoch:1,startedAfterDocumentCommitId:9}}
[exit 0]

$ agent-browser --session art-l7 type 'textarea[name="notes"]' 'Leave at dock 4, call ahead'
✓ Done
[exit 0]

$ node_modules/.bin/genie-react call react_quiesce '{"idleMs":500,"timeoutMs":10000}' --fail-on-result-error --session art-l7
ok: true
outcome: idle
elapsedMs: 749
observedCommits: 0
documentCommitId: 36
sessionId: 5f00bcef-5c75-46b0-ac97-32473488bc79
renderCollection: available
pendingWork:
  documentCommitId: 36
  scheduledRoots: 0
  suspendedBoundaries: 0
  dehydratedBoundaries: 0
  boundaries: []
  scanTruncated: false
  scannedFibers: 292
[exit 0]

$ node_modules/.bin/genie-react call react_get_renders '{"sort":"selfTime","limit":3}' --session art-l7
tracking: true
renderCollection: available
bundle: development
timingsBundleDependent: true
countsScope: observed-run
commits: 27
documentCommitId: 36
observation: {id:observation:1,epoch:1,startedAfterDocumentCommitId:9}
attribution:
  status: current
  startedAtDocumentCommitId: 36
  completedAtDocumentCommitId: 36
  startedAtAnalysisGeneration: 37
  completedAtAnalysisGeneration: 37
view: summary
summary:
  commits: 27
  trackedComponents: 28
  totalRenders: 756
  totalUpdates: 756
  referenceOnlyPropComponents: 0
  noObservedInputChangeComponents: 6
  topReferenceOnlyProps: [{name:selectedIds,count:1}]
  semantics: unknown
  coverageDomain: render-measurement
components[3] (name #id {fields}, then ← kind evidence name {fields} per cause):
  each: {renders:27,updates:27,latestDocumentCommitId:36,inputEvidence:changed,source:{ownership:app}}
  CreateOrderPage #9792491880501 {mountId:mount:2,noObservedInputChange:27,selfTime:0.9,totalTime:2.2,cumulativeSelfTime:18.8,cumulativeTotalTime:46.6,causeCounts:{state:27},necessity:unnecessary,necessityReason:inputs-unchanged,source:{location:/src/features/orders/create-order-page.tsx:100:5,role:component-body}}
    ← state exact "state[3]"
  Field #9792491880530 {mountId:mount:13,selfTime:0.2,totalTime:0.3,cumulativeSelfTime:3.9,cumulativeTotalTime:4.9,causeCounts:{children:27,parent:27},necessity:unknown,necessityReason:callbacks-changed,source:{location:/src/features/orders/create-order-page.tsx:128:15,role:element-callsite}}
    ← parent inferred CardBody {origin:CreateOrderPage}
    ← children exact
  Field #9792491880567 {mountId:mount:15,selfTime:0.2,totalTime:0.2,cumulativeSelfTime:2.2,cumulativeTotalTime:2.8,causeCounts:{children:27,parent:27},necessity:unknown,necessityReason:callbacks-changed,source:{location:/src/features/orders/create-order-page.tsx:144:15,role:element-callsite}}
    ← parent inferred CardBody {origin:CreateOrderPage}
    ← children exact
sourceClassification:
  complete: false
  affects: result
  totalCandidates: 31
  evaluated: 31
  app: 27
  library: 3
  unknown: 1
  unknownComponents: ["create-order-page.tsx (/src/features/orders/create-order-page.tsx)"]
  unknownComponentsOmitted: 0
omittedByLimit: 25
nextCursor: 773b2a6e-c5ac-4636-b229-ccc6b301e0dc:3
pagination:
  snapshotId: 773b2a6e-c5ac-4636-b229-ccc6b301e0dc
  offset: 0
  totalComponents: 28
  expiresAt: 1795061977156
comparable: false
notComparableReasons: [app-source-classification-incomplete]
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
  complete: false
  inputAttributionComplete: true
  semantics: unknown
  coverageDomain: render-causality
  incompleteBecause[1]:
    - {reason:source-classification-incomplete,fibers:1,detail:"1 of 31 candidates have unresolved ownership. appOnly keeps them, but any of them may be library code it would hide, so rows and counts can change once ownership resolves.",next:"Pass appOnly:false for counts that do not depend on ownership, or read again shortly: ownership keeps resolving in the background, though a component React rendered without an owner stack stays unknown."}
filteredNote: "3 components shown; 3 library components hidden — set appOnly:false to include them"
[exit 0]

$ node_modules/.bin/genie-react call react_get_renders '{"component":"ProductPicker","appOnly":false}' --session art-l7 --fields components,coverage.complete,bundle
error invalid_input: Tool call failed. Unknown --fields value coverage.complete. details.fields.available lists the fields the result has. Correct --fields and retry.
next: $ pnpm exec genie-react tools react_get_renders --session art-l7
userActionRequired: true
errorCode: invalid-input
details:
  fields:
    unknown: [coverage.complete]
    available: [attribution,bundle,commits,comparable,componentMatch,components,countsScope,coverage,documentCommitId,filteredNote,nextCursor,notComparableReasons,observation,omittedByLimit,pagination,renderCollection,sourceClassification,summary,timingsBundleDependent,tracking,view]
exit: {code:2,class:usage}
[exit 1]

$ node_modules/.bin/genie-react call react_get_renders '{"component":"ProductPicker","appOnly":false}' --session art-l7 --fields bundle,components,coverage
[1]:
  - {bundle:development,components:[{id:9792491880588,name:ProductPicker,mountId:mount:1,renders:27,updates:27,selfTime:0.1,totalTime:0.2,cumulativeSelfTime:0.7,cumulativeTotalTime:1.4,latestDocumentCommitId:36,causeCounts:{props:54,parent:27},causes:[{kind:parent,evidence:inferred,name:CardBody,origin:CreateOrderPage},{kind:props,evidence:exact,name:selectedIds,referenceOnly:true},{kind:props,evidence:exact,name:onPick}],necessity:unknown,necessityReason:callbacks-changed,inputEvidence:changed,source:{location:/src/features/orders/create-order-page.tsx:172:15,role:element-callsite,ownership:app}}],coverage:{skippedCommitFibers:0,droppedUnmountFibers:0,analysisFailedFibers:0,pausedCommits:0,unobservedCommits:0,refreshCommitsExcluded:0,truncatedInputFibers:0,propsNotEnumeratedFibers:0,budgetExhaustedCommits:0,budgetExhaustedSubsystems:[],complete:true,inputAttributionComplete:true,semantics:exact,coverageDomain:render-causality}}
[exit 0]

$ agent-browser --session art-l7 fill 'textarea[name="notes"]' ''
✓ Done
[exit 0]

$ node_modules/.bin/genie-react call react_clear_renders '{}' --session art-l7 --fields ok,observation
[1]:
  - {ok:true,observation:{id:observation:2,epoch:2,startedAfterDocumentCommitId:36}}
[exit 0]

$ agent-browser --session art-l7 type 'textarea[name="notes"]' 'Leave at dock 4, call ahead'
✓ Done
[exit 0]

$ node_modules/.bin/genie-react call react_quiesce '{"idleMs":500,"timeoutMs":10000}' --fail-on-result-error --session art-l7 --fields outcome
[1]:
  - {outcome:idle}
[exit 0]

$ node_modules/.bin/genie-react call devtools_capture_create '{"name":"after-usememo","include":["react"]}' --session art-l7 --json
{"schemaVersion":"1.0","captureId":"cap_7f2d6b5b-aae6-426f-974b-5b3585288704","name":"after-usememo","createdAt":"2026-11-19T04:14:52.037Z","session":{"sessionId":"5f00bcef-5c75-46b0-ac97-32473488bc79","logicalSessionId":"f302b7a7-ad8a-4a18-be94-bcefe0ff9a9b","documentGeneration":4,"app":{"name":"Meridian Ops","url":"http://127.0.0.1:5217/orders/new","reactVersion":"19.3.1","reactMounted":true}},"include":["react"],"consistency":{"kind":"react-commit-stable","attempts":1,"reactCommit":63,"reason":"React document commit markers matched before, during, and after all captured sections."},"complete":false,"sizeBytes":273368,"pinned":false,"summary":{"sectionStatus":{"react":"ok"},"metrics":{"react.commits":27,"react.renders":756,"query.pending":null,"memory.usedHeapBytes":null,"performance.avgFps":null},"warningCount":0},"integrity":{"algorithm":"sha256","scope":"capture-content-v1","digest":"757c7c3d65d7b1a6894094fa5c09aa4e555ef100f0f4d529a8519ef1b9895092"},"warnings":[],"availableSections":["react"],"renders":{"comparable":false,"notComparableReasons":["app-source-classification-incomplete"],"coverage":{"complete":false,"semantics":"unknown"}}}
[exit 0]

$ agent-browser --session art-l7 fill 'textarea[name="notes"]' ''
✓ Done
[exit 0]

$ node_modules/.bin/genie-react call react_clear_renders '{}' --session art-l7 --fields ok,observation
[1]:
  - {ok:true,observation:{id:observation:3,epoch:3,startedAfterDocumentCommitId:63}}
[exit 0]

$ agent-browser --session art-l7 type 'textarea[name="notes"]' 'Leave at dock 4, call ahead'
✓ Done
[exit 0]

$ node_modules/.bin/genie-react call react_quiesce '{"idleMs":500,"timeoutMs":10000}' --fail-on-result-error --session art-l7 --fields outcome
[1]:
  - {outcome:idle}
[exit 0]

$ node_modules/.bin/genie-react call devtools_capture_create '{"name":"after-usememo","include":["react"]}' --session art-l7 --json
{"schemaVersion":"1.0","captureId":"cap_86dc19c7-c829-4a37-b292-e9c50169ab28","name":"after-usememo","createdAt":"2026-11-19T04:14:53.201Z","session":{"sessionId":"5f00bcef-5c75-46b0-ac97-32473488bc79","logicalSessionId":"f302b7a7-ad8a-4a18-be94-bcefe0ff9a9b","documentGeneration":4,"app":{"name":"Meridian Ops","url":"http://127.0.0.1:5217/orders/new","reactVersion":"19.3.1","reactMounted":true}},"include":["react"],"consistency":{"kind":"react-commit-stable","attempts":1,"reactCommit":90,"reason":"React document commit markers matched before, during, and after all captured sections."},"complete":false,"sizeBytes":273364,"pinned":false,"summary":{"sectionStatus":{"react":"ok"},"metrics":{"react.commits":27,"react.renders":756,"query.pending":null,"memory.usedHeapBytes":null,"performance.avgFps":null},"warningCount":0},"integrity":{"algorithm":"sha256","scope":"capture-content-v1","digest":"e77da1a9e2bdb7df559c7e08250d7166569d8740c974d2cb089a0fc6f2f07125"},"warnings":[],"availableSections":["react"],"renders":{"comparable":false,"notComparableReasons":["app-source-classification-incomplete"],"coverage":{"complete":false,"semantics":"unknown"}}}
[exit 0]

$ agent-browser --session art-l7 fill 'textarea[name="notes"]' ''
✓ Done
[exit 0]

$ node_modules/.bin/genie-react call react_clear_renders '{}' --session art-l7 --fields ok,observation
[1]:
  - {ok:true,observation:{id:observation:4,epoch:4,startedAfterDocumentCommitId:90}}
[exit 0]

$ agent-browser --session art-l7 type 'textarea[name="notes"]' 'Leave at dock 4, call ahead'
✓ Done
[exit 0]

$ node_modules/.bin/genie-react call react_quiesce '{"idleMs":500,"timeoutMs":10000}' --fail-on-result-error --session art-l7 --fields outcome
[1]:
  - {outcome:idle}
[exit 0]

$ node_modules/.bin/genie-react call devtools_capture_create '{"name":"after-usememo","include":["react"]}' --session art-l7 --json
{"schemaVersion":"1.0","captureId":"cap_9b12de7d-adb5-4621-97a1-ac6851469531","name":"after-usememo","createdAt":"2026-11-19T04:14:54.372Z","session":{"sessionId":"5f00bcef-5c75-46b0-ac97-32473488bc79","logicalSessionId":"f302b7a7-ad8a-4a18-be94-bcefe0ff9a9b","documentGeneration":4,"app":{"name":"Meridian Ops","url":"http://127.0.0.1:5217/orders/new","reactVersion":"19.3.1","reactMounted":true}},"include":["react"],"consistency":{"kind":"react-commit-stable","attempts":1,"reactCommit":117,"reason":"React document commit markers matched before, during, and after all captured sections."},"complete":false,"sizeBytes":273519,"pinned":false,"summary":{"sectionStatus":{"react":"ok"},"metrics":{"react.commits":27,"react.renders":756,"query.pending":null,"memory.usedHeapBytes":null,"performance.avgFps":null},"warningCount":0},"integrity":{"algorithm":"sha256","scope":"capture-content-v1","digest":"e6cf682e786e42f774cad44c005bcbde63f363bbfbb6de56e94904da0d24ebf8"},"warnings":[],"availableSections":["react"],"renders":{"comparable":false,"notComparableReasons":["app-source-classification-incomplete"],"coverage":{"complete":false,"semantics":"unknown"}}}
[exit 0]

$ agent-browser --session art-l7 fill 'textarea[name="notes"]' ''
✓ Done
[exit 0]

$ node_modules/.bin/genie-react call react_clear_renders '{}' --session art-l7 --fields ok,observation
[1]:
  - {ok:true,observation:{id:observation:5,epoch:5,startedAfterDocumentCommitId:117}}
[exit 0]

$ agent-browser --session art-l7 type 'textarea[name="notes"]' 'Leave at dock 4, call ahead'
✓ Done
[exit 0]

$ node_modules/.bin/genie-react call react_quiesce '{"idleMs":500,"timeoutMs":10000}' --fail-on-result-error --session art-l7 --fields outcome
[1]:
  - {outcome:idle}
[exit 0]

$ node_modules/.bin/genie-react call devtools_capture_create '{"name":"after-usememo","include":["react"]}' --session art-l7 --json
{"schemaVersion":"1.0","captureId":"cap_4b05a5ef-745d-42de-9634-6c605d8e2aa8","name":"after-usememo","createdAt":"2026-11-19T04:14:55.603Z","session":{"sessionId":"5f00bcef-5c75-46b0-ac97-32473488bc79","logicalSessionId":"f302b7a7-ad8a-4a18-be94-bcefe0ff9a9b","documentGeneration":4,"app":{"name":"Meridian Ops","url":"http://127.0.0.1:5217/orders/new","reactVersion":"19.3.1","reactMounted":true}},"include":["react"],"consistency":{"kind":"react-commit-stable","attempts":1,"reactCommit":144,"reason":"React document commit markers matched before, during, and after all captured sections."},"complete":false,"sizeBytes":273508,"pinned":false,"summary":{"sectionStatus":{"react":"ok"},"metrics":{"react.commits":27,"react.renders":756,"query.pending":null,"memory.usedHeapBytes":null,"performance.avgFps":null},"warningCount":0},"integrity":{"algorithm":"sha256","scope":"capture-content-v1","digest":"6372a6e7a01ecd40ed41c5891a3cc436b160a861864b3593dba9f9cf522987a2"},"warnings":[],"availableSections":["react"],"renders":{"comparable":false,"notComparableReasons":["app-source-classification-incomplete"],"coverage":{"complete":false,"semantics":"unknown"}}}
[exit 0]

$ agent-browser --session art-l7 fill 'textarea[name="notes"]' ''
✓ Done
[exit 0]

$ node_modules/.bin/genie-react call react_clear_renders '{}' --session art-l7 --fields ok,observation
[1]:
  - {ok:true,observation:{id:observation:6,epoch:6,startedAfterDocumentCommitId:144}}
[exit 0]

$ agent-browser --session art-l7 type 'textarea[name="notes"]' 'Leave at dock 4, call ahead'
✓ Done
[exit 0]

$ node_modules/.bin/genie-react call react_quiesce '{"idleMs":500,"timeoutMs":10000}' --fail-on-result-error --session art-l7 --fields outcome
[1]:
  - {outcome:idle}
[exit 0]

$ node_modules/.bin/genie-react call devtools_capture_create '{"name":"after-usememo","include":["react"]}' --session art-l7 --json
{"schemaVersion":"1.0","captureId":"cap_16865613-a1b8-4dac-ae5b-bfb04fb2cce2","name":"after-usememo","createdAt":"2026-11-19T04:14:56.768Z","session":{"sessionId":"5f00bcef-5c75-46b0-ac97-32473488bc79","logicalSessionId":"f302b7a7-ad8a-4a18-be94-bcefe0ff9a9b","documentGeneration":4,"app":{"name":"Meridian Ops","url":"http://127.0.0.1:5217/orders/new","reactVersion":"19.3.1","reactMounted":true}},"include":["react"],"consistency":{"kind":"react-commit-stable","attempts":1,"reactCommit":171,"reason":"React document commit markers matched before, during, and after all captured sections."},"complete":false,"sizeBytes":273526,"pinned":false,"summary":{"sectionStatus":{"react":"ok"},"metrics":{"react.commits":27,"react.renders":756,"query.pending":null,"memory.usedHeapBytes":null,"performance.avgFps":null},"warningCount":0},"integrity":{"algorithm":"sha256","scope":"capture-content-v1","digest":"7c0e56692d362562863226df14c8571a8dc0b86b7c97fd97444a753ba34d603d"},"warnings":[],"availableSections":["react"],"renders":{"comparable":false,"notComparableReasons":["app-source-classification-incomplete"],"coverage":{"complete":false,"semantics":"unknown"}}}
[exit 0]

$ agent-browser --session art-l7 fill 'textarea[name="notes"]' ''
✓ Done
[exit 0]

$ node_modules/.bin/genie-react call react_clear_renders '{}' --session art-l7 --fields ok,observation
[1]:
  - {ok:true,observation:{id:observation:7,epoch:7,startedAfterDocumentCommitId:171}}
[exit 0]

$ agent-browser --session art-l7 type 'textarea[name="notes"]' 'Leave at dock 4, call ahead'
✓ Done
[exit 0]

$ node_modules/.bin/genie-react call react_quiesce '{"idleMs":500,"timeoutMs":10000}' --fail-on-result-error --session art-l7 --fields outcome
[1]:
  - {outcome:idle}
[exit 0]

$ node_modules/.bin/genie-react call devtools_capture_create '{"name":"after-usememo","include":["react"]}' --session art-l7 --json
{"schemaVersion":"1.0","captureId":"cap_21222976-a926-45d7-9441-e53d419272a1","name":"after-usememo","createdAt":"2026-11-19T04:14:57.913Z","session":{"sessionId":"5f00bcef-5c75-46b0-ac97-32473488bc79","logicalSessionId":"f302b7a7-ad8a-4a18-be94-bcefe0ff9a9b","documentGeneration":4,"app":{"name":"Meridian Ops","url":"http://127.0.0.1:5217/orders/new","reactVersion":"19.3.1","reactMounted":true}},"include":["react"],"consistency":{"kind":"react-commit-stable","attempts":1,"reactCommit":198,"reason":"React document commit markers matched before, during, and after all captured sections."},"complete":false,"sizeBytes":273514,"pinned":false,"summary":{"sectionStatus":{"react":"ok"},"metrics":{"react.commits":27,"react.renders":756,"query.pending":null,"memory.usedHeapBytes":null,"performance.avgFps":null},"warningCount":0},"integrity":{"algorithm":"sha256","scope":"capture-content-v1","digest":"be41230804987f2bdd81da4e863c5e36389970180accab1f5035c91402903061"},"warnings":[],"availableSections":["react"],"renders":{"comparable":false,"notComparableReasons":["app-source-classification-incomplete"],"coverage":{"complete":false,"semantics":"unknown"}}}
[exit 0]

$ node_modules/.bin/genie-react call devtools_capture_compare '{"baselineCaptureIds":["cap_e9270778-d3b0-47fe-a1c8-18b0d66e4a05","cap_1fa8607e-cf65-4a6e-a9a9-761edaef15bf","cap_620d1587-9a0a-464e-859f-2f9dbbb9b220","cap_18650357-6453-4272-8304-b571c77ee2dd","cap_cd01bb91-2486-4518-b844-1ffb2998de70","cap_44e663e7-82db-4101-bfe0-2b6811cebaa3"],"candidateCaptureIds":["cap_7f2d6b5b-aae6-426f-974b-5b3585288704","cap_86dc19c7-c829-4a37-b292-e9c50169ab28","cap_9b12de7d-adb5-4621-97a1-ac6851469531","cap_4b05a5ef-745d-42de-9634-6c605d8e2aa8","cap_16865613-a1b8-4dac-ae5b-bfb04fb2cce2","cap_21222976-a926-45d7-9441-e53d419272a1"],"metrics":["react.selfTimeMs","react.renders"],"budgets":[{"metric":"react.selfTimeMs","maxValue":100}]}' --session art-l7
schemaVersion: "1.0"
kind: capture-comparison
comparisonId: cmp_0615b073-695e-42c3-85a7-e748260be21d
createdAt: 2026-11-19T04:15:05.942Z
minimumRuns: 5
policy: {warmupRuns:1,outlierThreshold:3.5,confidenceLevel:0.95,minimumEffectPct:5}
excluded:
  warmupBaselineCaptureIds: [cap_e9270778-d3b0-47fe-a1c8-18b0d66e4a05]
  warmupCandidateCaptureIds: [cap_7f2d6b5b-aae6-426f-974b-5b3585288704]
baselineCaptureIds: [cap_e9270778-d3b0-47fe-a1c8-18b0d66e4a05,cap_1fa8607e-cf65-4a6e-a9a9-761edaef15bf,cap_620d1587-9a0a-464e-859f-2f9dbbb9b220,cap_18650357-6453-4272-8304-b571c77ee2dd,cap_cd01bb91-2486-4518-b844-1ffb2998de70,cap_44e663e7-82db-4101-bfe0-2b6811cebaa3]
candidateCaptureIds: [cap_7f2d6b5b-aae6-426f-974b-5b3585288704,cap_86dc19c7-c829-4a37-b292-e9c50169ab28,cap_9b12de7d-adb5-4621-97a1-ac6851469531,cap_4b05a5ef-745d-42de-9634-6c605d8e2aa8,cap_16865613-a1b8-4dac-ae5b-bfb04fb2cce2,cap_21222976-a926-45d7-9441-e53d419272a1]
overall: pass
notComparableReasons: []
metrics[2] (metric verdict {fields}, then one line per reason):
  react.selfTimeMs pass {direction:lower-is-better,baseline:{samples:5,median:48,p95:51.56,mad:0.6,min:47.2,max:52.3},candidate:{samples:5,median:3.8,p95:3.8,mad:0,min:3.7,max:3.8},missingBaselineCaptureIds:[],missingCandidateCaptureIds:[],excludedCaptureIds:{},outlierBaselineCaptureIds:[],outlierCandidateCaptureIds:[],comparable:true,notComparableReasons:[],delta:{median:-44.2,regressionPct:-92.0833},budget:{metric:react.selfTimeMs,maxValue:100},confidence:{level:0.95,pValue:0.0079,achieved:0.9921,significant:true,minimumEffectPct:5,observedEffectPct:-92.0833,noiseFloorPct:1.8532}}
    reasons: []
  react.renders informational {direction:lower-is-better,baseline:{samples:5,median:756,p95:756,mad:0,min:756,max:756},candidate:{samples:5,median:756,p95:756,mad:0,min:756,max:756},missingBaselineCaptureIds:[],missingCandidateCaptureIds:[],excludedCaptureIds:{},outlierBaselineCaptureIds:[],outlierCandidateCaptureIds:[],comparable:true,notComparableReasons:[],delta:{median:0,regressionPct:0},confidence:{level:0.95,pValue:1,achieved:0,significant:false,minimumEffectPct:5,observedEffectPct:0,noiseFloorPct:0}}
    reason: "no significant change (0%, p=1); pass budgets to gate on it"
violations: []
warnings: ["Ownership of create-order-page.tsx (/src/features/orders/create-order-page.tsx) is unknown; app-only render totals count them, and component metrics are compared only when every capture names the same ones."]
[exit 0]

### FIX 2 APPLIED (memo ProductPicker, stable selectedIds and onPick), full diff:
diff --git a/apps/realworld-dashboard/src/features/orders/create-order-page.tsx b/apps/realworld-dashboard/src/features/orders/create-order-page.tsx
index 0ff38dc..1b71325 100644
--- a/apps/realworld-dashboard/src/features/orders/create-order-page.tsx
+++ b/apps/realworld-dashboard/src/features/orders/create-order-page.tsx
@@ -2,10 +2,11 @@ import { zodResolver } from '@hookform/resolvers/zod'
 import { useQuery } from '@tanstack/react-query'
 import { Link, useNavigate } from '@tanstack/react-router'
 import { ArrowLeft, Trash2 } from 'lucide-react'
+import { useCallback, useMemo } from 'react'
 import { useFieldArray, useForm } from 'react-hook-form'
 import { z } from 'zod'
 import { api } from '../../api/endpoints'
-import { ORDER_PRIORITIES, type OrderPriority } from '../../api/types'
+import { ORDER_PRIORITIES, type OrderPriority, type Product } from '../../api/types'
 import { usePreferences } from '../../app/preferences'
 import { referenceDataOptions } from '../../app/query-client'
 import { Button } from '../../components/ui/button'
@@ -68,6 +69,18 @@ export function CreateOrderPage() {
   })
   const lines = useFieldArray({ control: form.control, name: 'lines' })
   const values = form.watch()
+  const appendLine = lines.append
+  const selectedIds = useMemo(() => lines.fields.map((line) => line.productId), [lines.fields])
+  const addProduct = useCallback(
+    (product: Product) =>
+      appendLine({
+        productId: product.id,
+        name: product.name,
+        unitPrice: product.unitPrice,
+        quantity: 1,
+      }),
+    [appendLine],
+  )
   const { errors } = form.formState
 
   const subtotal = values.lines.reduce(
@@ -171,15 +184,8 @@ export function CreateOrderPage() {
             <CardBody className="space-y-4">
               <ProductPicker
                 products={products.data ?? []}
-                selectedIds={values.lines.map((line) => line.productId)}
-                onPick={(product) =>
-                  lines.append({
-                    productId: product.id,
-                    name: product.name,
-                    unitPrice: product.unitPrice,
-                    quantity: 1,
-                  })
-                }
+                selectedIds={selectedIds}
+                onPick={addProduct}
               />
               {lines.fields.length > 0 && (
                 <table className="w-full text-sm">
diff --git a/apps/realworld-dashboard/src/features/orders/product-picker.tsx b/apps/realworld-dashboard/src/features/orders/product-picker.tsx
index 30294a2..18b8f06 100644
--- a/apps/realworld-dashboard/src/features/orders/product-picker.tsx
+++ b/apps/realworld-dashboard/src/features/orders/product-picker.tsx
@@ -1,25 +1,25 @@
 import { Plus } from 'lucide-react'
-import { useState } from 'react'
+import { memo, useMemo, useState } from 'react'
 import type { Product } from '../../api/types'
 import { usePreferences } from '../../app/preferences'
 import { Input } from '../../components/ui/form-controls'
 import { buildProductIndex } from './product-index'
 
 const RESULT_LIMIT = 8
 const MIN_TERM_LENGTH = 2
 
-export function ProductPicker({
+export const ProductPicker = memo(function ProductPicker({
   products,
   selectedIds,
   onPick,
 }: {
   products: readonly Product[]
   selectedIds: readonly string[]
   onPick: (product: Product) => void
 }) {
   const { formatMoney } = usePreferences()
   const [term, setTerm] = useState('')
-  const index = buildProductIndex(products)
+  const index = useMemo(() => buildProductIndex(products), [products])
   const matches = term.trim().length < MIN_TERM_LENGTH ? [] : index.search(term, RESULT_LIMIT)
 
   return (
@@ -64,4 +64,4 @@ export function ProductPicker({
       )}
     </div>
   )
-}
+})

$ node_modules/.bin/genie-react status --session art-l7 --wait 15000 --fields ready,app
error invalid_input: Option --fields isn't valid for status.
next: $ pnpm exec genie-react --help
userActionRequired: true
errorCode: invalid-input
exit: {code:2,class:usage}
[exit 1]

$ agent-browser --session art-l7 fill 'textarea[name="notes"]' ''
✓ Done
[exit 0]

$ node_modules/.bin/genie-react verify begin --session art-l7 --name 'type warehouse notes' --claim 'render ProductPicker max 0' --claim 'render CreateOrderPage min 1' --claim 'boundaries clean'
recording vfy_7bbd1139-45e0-434c-8bd3-eba28f0b9723 "type warehouse notes"
  url "http://127.0.0.1:5217/orders/new"
  1 null render ProductPicker max 0  {}
  2 null render CreateOrderPage min 1  {}
  3 null boundaries clean  {}
window: {observationId:observation:1,startDocumentCommitId:9,domains:[react,query,router],quietMs:500,timeoutMs:10000,tailMs:500}
next: $ pnpm exec genie-react verify end vfy_7bbd1139-45e0-434c-8bd3-eba28f0b9723 --session art-l7
session: {sessionId:a698870e-da48-4ac7-8e4f-88690a50028d,logicalSessionId:f302b7a7-ad8a-4a18-be94-bcefe0ff9a9b,documentGeneration:5}
schemaVersion: "1.0"
targets: [{target:{component:ProductPicker},status:resolved,instances:1,source:/src/features/orders/create-order-page.tsx},{target:{component:CreateOrderPage},status:resolved,instances:1,source:/src/features/orders/create-order-page.tsx}]
startedAt: 2026-11-19T04:16:03.641Z
expiresAt: 2026-11-19T04:21:03.683Z
request: {budget:{fiberLimit:250,operationLimit:20000,timeLimitMs:8,targetOperationReserve:4000,targetTimeReserveMs:4,adaptive:true},settle:{quietMs:500,timeoutMs:10000},maxDurationMs:300000,allowOverrides:false}
[exit 0]

$ agent-browser --session art-l7 type 'textarea[name="notes"]' 'Leave at dock 4, call ahead'
✓ Done
[exit 0]

$ node_modules/.bin/genie-react verify end vfy_7bbd1139-45e0-434c-8bd3-eba28f0b9723 --session art-l7
pass vfy_7bbd1139-45e0-434c-8bd3-eba28f0b9723 "type warehouse notes"  27 commits, quiet after 798 ms (react, query, router)
  url "http://127.0.0.1:5217/orders/new"
  1 pass render ProductPicker max 0  {renders:0,mounts:0,updates:0,remounts:0,semantics:exact,instances:1,activeInstances:1}
      claim: {kind:renders,target:{component:ProductPicker},max:0,counting:renders,allowRemount:false}
      deciding: [{kind:coverage,complete:true,targetedComplete:true,semantics:exact},{kind:instance,mountId:mount:1,renderingState:mounted-rendering,source:/src/features/orders/create-order-page.tsx:185:15}]
  2 pass render CreateOrderPage min 1  {renders:27,mounts:0,updates:27,remounts:0,semantics:exact,instances:1,activeInstances:1}
      claim: {kind:renders,target:{component:CreateOrderPage},min:1,counting:renders,allowRemount:false}
      deciding: [{kind:instance,mountId:mount:2,renders:27,mounts:0,updates:27,mountGeneration:1,latestDocumentCommitId:36,source:/src/features/orders/create-order-page.tsx:113:5}]
  3 pass boundaries clean  {caughtDuringWindow:0,caughtAtEnd:0}
      claim: {kind:boundaries-clean,scope:window}
      deciding: [{kind:boundary-log,scope:window,complete:true,afterDocumentCommitId:9}]
      caveats: [uncaught-errors-outside-boundaries-unobserved]
window: {observationId:observation:1,startDocumentCommitId:9,settledDocumentCommitId:36,frozenDocumentCommitId:36,commits:27,settle:{outcome:met,quietMs:500,timeoutMs:10000,waitedMs:798,domains:{react:met,query:met,router:met}},tail:{ms:500,commits:0},environment:{bundle:development,strictMode:on,renderCollection:available,visibility:document}}
! ui-outcome-not-observed: Genie does not check the screen; confirm it with the UI driver
attempt 2 for these claims on this tab; previous fail vfy_c854b38a-c520-4366-af0d-ed0486fed86f; document reloaded since
evidence: $ pnpm exec genie-react verify show vfy_7bbd1139-45e0-434c-8bd3-eba28f0b9723 --session art-l7
session: {sessionId:a698870e-da48-4ac7-8e4f-88690a50028d,logicalSessionId:f302b7a7-ad8a-4a18-be94-bcefe0ff9a9b,documentGeneration:5}
schemaVersion: "1.0"
exitCode: 0
stage: end
ledger: {fingerprint:cf_79c0241efc06,scope:logical-session,storage:memory,attempt:2,history:[{verificationId:vfy_c854b38a-c520-4366-af0d-ed0486fed86f,verdict:fail,reasons:[],endedAt:2026-11-19T04:13:59.430Z}],codeChangedSincePrevious:document-reloaded,failsOnSameCode:0}
evidence: {retained:true,tools:[react_get_renders,react_component_cohort,react_list_overrides,query_is_fetching,react_refresh_events,browser_visibility,react_profile_stop,react_error_state]}
startedAt: 2026-11-19T04:16:03.641Z
endedAt: 2026-11-19T04:16:07.988Z
request: {budget:{fiberLimit:250,operationLimit:20000,timeLimitMs:8,targetOperationReserve:4000,targetTimeReserveMs:4,adaptive:true},settle:{quietMs:500,timeoutMs:10000},maxDurationMs:300000,allowOverrides:false}
[exit 0]

$ agent-browser --session art-l7 get value 'textarea[name="notes"]'
Leave at dock 4, call ahead
[exit 0]

$ node_modules/.bin/genie-react call react_clear_renders '{"component":"ProductPicker"}' --session art-l7 --fields ok
[1]:
  - {ok:true}
[exit 0]

$ agent-browser --session art-l7 type 'input[aria-label="Find a product"]' 'pallet'
✓ Done
[exit 0]

$ node_modules/.bin/genie-react call react_quiesce '{"idleMs":500,"timeoutMs":10000}' --fail-on-result-error --session art-l7 --fields outcome
[1]:
  - {outcome:idle}
[exit 0]

$ node_modules/.bin/genie-react call react_get_renders '{"component":"ProductPicker","appOnly":false}' --session art-l7 --fields bundle,components,coverage
[1]:
  - {bundle:development,components:[{id:1726543298575,name:ProductPicker,mountId:mount:1,renders:6,updates:6,selfTime:1.6,totalTime:2.5,cumulativeSelfTime:7.1,cumulativeTotalTime:11.3,latestDocumentCommitId:42,causeCounts:{state:6},causes:[{kind:state,evidence:exact,name:"state[0]"}],necessity:necessary,necessityReason:dom-changed,inputEvidence:changed,wrappers:[ProductPicker],source:{location:/src/features/orders/create-order-page.tsx:185:15,role:element-callsite,ownership:app}}],coverage:{skippedCommitFibers:0,droppedUnmountFibers:0,analysisFailedFibers:0,pausedCommits:0,unobservedCommits:0,refreshCommitsExcluded:0,truncatedInputFibers:0,propsNotEnumeratedFibers:0,budgetExhaustedCommits:0,budgetExhaustedSubsystems:[],complete:true,inputAttributionComplete:true,semantics:exact,coverageDomain:render-causality}}
[exit 0]

$ agent-browser --session art-l7 snapshot -i -s 'ul[aria-label="Product matches"]'
- button "Pallet Wrap XLPAC-01126 $239.45" [ref=e68]
- button "Pallet Wrap ProPAC-01679 $84.25" [ref=e69]
- button "Pallet Wrap XLPAC-01840 $360.44" [ref=e70]
- button "Pallet Wrap LitePAC-02155 $439.22" [ref=e71]
- button "Pallet Wrap Heavy DutyPAC-02218 $447.87" [ref=e72]
- button "Pallet Wrap LitePAC-03023 $103.38" [ref=e73]
- button "Pallet Wrap XLPAC-03037 $228.93" [ref=e74]
- button "Pallet Wrap StandardPAC-03128 $470.12" [ref=e75]
[exit 0]

$ agent-browser --session art-l7 click @e68
✓ Done
[exit 0]

$ agent-browser --session art-l7 type 'input[aria-label="Find a product"]' 'pallet'
✓ Done
[exit 0]

$ agent-browser --session art-l7 snapshot -i -s 'ul[aria-label="Product matches"]'
- button "Pallet Wrap XLPAC-01126 $239.45" [disabled, ref=e77]
- button "Pallet Wrap ProPAC-01679 $84.25" [ref=e78]
- button "Pallet Wrap XLPAC-01840 $360.44" [ref=e79]
- button "Pallet Wrap LitePAC-02155 $439.22" [ref=e80]
- button "Pallet Wrap Heavy DutyPAC-02218 $447.87" [ref=e81]
- button "Pallet Wrap LitePAC-03023 $103.38" [ref=e82]
- button "Pallet Wrap XLPAC-03037 $228.93" [ref=e83]
- button "Pallet Wrap StandardPAC-03128 $470.12" [ref=e84]
[exit 0]

$ agent-browser --session art-l7 get text 'table'
Pallet Wrap XL	
	$239.45	
[exit 0]

### FIXES REVERTED (git checkout -- src/features/orders/)
$ agent-browser --session art-l7 open http://127.0.0.1:5217/orders/new
✓ Meridian Ops
  http://127.0.0.1:5217/orders/new
[exit 0]

$ node_modules/.bin/genie-react call devtools_wait '{"condition":"settled","timeoutMs":10000}' --session art-l7 --fields ok
[1]:
  - {ok:true}
[exit 0]

$ node_modules/.bin/genie-react call react_clear_renders '{"component":"ProductPicker"}' --session art-l7 --fields ok
[1]:
  - {ok:true}
[exit 0]

$ agent-browser --session art-l7 type 'textarea[name="notes"]' 'Leave at dock 4, call ahead'
✓ Done
[exit 0]

$ node_modules/.bin/genie-react call react_quiesce '{"idleMs":500,"timeoutMs":10000}' --fail-on-result-error --session art-l7 --fields outcome
[1]:
  - {outcome:idle}
[exit 0]

$ node_modules/.bin/genie-react call react_get_renders '{"component":"ProductPicker","appOnly":false}' --session art-l7 --fields bundle,components,coverage
[1]:
  - {bundle:development,components:[{id:10539866521740,name:ProductPicker,mountId:mount:1,renders:27,updates:27,selfTime:50.6,totalTime:50.7,cumulativeSelfTime:1207.9,cumulativeTotalTime:1209.1,latestDocumentCommitId:36,causeCounts:{props:54,parent:27},causes:[{kind:parent,evidence:inferred,name:CardBody,origin:CreateOrderPage},{kind:props,evidence:exact,name:selectedIds,referenceOnly:true},{kind:props,evidence:exact,name:onPick}],necessity:unknown,necessityReason:callbacks-changed,inputEvidence:changed,source:{location:/src/features/orders/create-order-page.tsx:172:15,role:element-callsite,ownership:app}}],coverage:{skippedCommitFibers:0,droppedUnmountFibers:0,analysisFailedFibers:0,pausedCommits:0,unobservedCommits:0,refreshCommitsExcluded:0,truncatedInputFibers:0,propsNotEnumeratedFibers:0,budgetExhaustedCommits:0,budgetExhaustedSubsystems:[],complete:true,inputAttributionComplete:true,semantics:exact,coverageDomain:render-causality}}
[exit 0]

### SECOND SESSION: dev server restarted to rerun the repeated-run comparison with an 8 ms budget
$ agent-browser --session art-l7 open http://127.0.0.1:5217/login
[agent-browser] launched browser
✓ Meridian Ops
  http://127.0.0.1:5217/login
[exit 0]

$ node_modules/.bin/genie-react status --session art-l7 --wait 15000
selectedBridgeUrl: ws://127.0.0.1:5217/__genie/ws
sessionSelector:
  requested: art-l7
  source: flag
  resolvedSessionId: 6848e94b-2cca-47b3-9d06-eee603147514
  implicit: false
  agentBrowser: {session:art-l7,via:selector,logicalSessionId:204804a9-d37f-4d12-9ea1-c13efb806b84}
connected: true
ready: true
sessionId: 6848e94b-2cca-47b3-9d06-eee603147514
app: {name:"Meridian Ops",url:http://127.0.0.1:5217/login,reactVersion:19.3.1,reactMounted:true}
domains: [session,react,app,memory,perf,plugin,timeline,router,query]
toolCount: 98
sessions[1] (sessionId {fields}):
  6848e94b-2cca-47b3-9d06-eee603147514 {logicalSessionId:204804a9-d37f-4d12-9ea1-c13efb806b84,documentGeneration:1,logicalSessionCollision:false,collisionWithSessionIds:[],app:{name:"Meridian Ops",url:http://127.0.0.1:5217/login,reactVersion:19.3.1,reactMounted:true},domains:[session,react,app,memory,perf,plugin,timeline,router,query],toolCount:98,connectedAt:1795062062354,ready:true,readyAt:1795062062354,current:true,origin:http://127.0.0.1:5217,runtimeVersion:1.0.2}
warnings: []
hub: {version:1.0.2,protocol:1}
[exit 0]

$ node_modules/.bin/genie-react call app_login_as '{"role":"manager"}' --session art-l7
changed: true
role: manager
userId: u-manager
[exit 0]

$ agent-browser --session art-l7 open http://127.0.0.1:5217/orders/new
✓ Meridian Ops
  http://127.0.0.1:5217/orders/new
[exit 0]

$ node_modules/.bin/genie-react call devtools_wait '{"condition":"settled","timeoutMs":10000}' --session art-l7 --fields ok
[1]:
  - {ok:true}
[exit 0]

$ agent-browser --session art-l7 fill 'textarea[name="notes"]' ''
✓ Done
[exit 0]

$ node_modules/.bin/genie-react call react_clear_renders '{}' --session art-l7 --fields ok,observation
[1]:
  - {ok:true,observation:{id:observation:1,epoch:1,startedAfterDocumentCommitId:9}}
[exit 0]

$ agent-browser --session art-l7 type 'textarea[name="notes"]' 'Leave at dock 4, call ahead'
✓ Done
[exit 0]

$ node_modules/.bin/genie-react call react_quiesce '{"idleMs":500,"timeoutMs":10000}' --fail-on-result-error --session art-l7 --fields outcome
[1]:
  - {outcome:idle}
[exit 0]

$ node_modules/.bin/genie-react call devtools_capture_create '{"name":"before","include":["react"]}' --session art-l7 --json
{"schemaVersion":"1.0","captureId":"cap_00b8a9bd-98bc-4bda-a4b7-e30a4b8a9029","name":"before","createdAt":"2026-11-19T04:21:13.979Z","session":{"sessionId":"b870902b-f88b-4339-9a2e-6b45f36af6bc","logicalSessionId":"204804a9-d37f-4d12-9ea1-c13efb806b84","documentGeneration":2,"app":{"name":"Meridian Ops","url":"http://127.0.0.1:5217/orders/new","reactVersion":"19.3.1","reactMounted":true}},"include":["react"],"consistency":{"kind":"react-commit-stable","attempts":1,"reactCommit":36,"reason":"React document commit markers matched before, during, and after all captured sections."},"complete":false,"sizeBytes":273327,"pinned":false,"summary":{"sectionStatus":{"react":"ok"},"metrics":{"react.commits":27,"react.renders":756,"query.pending":null,"memory.usedHeapBytes":null,"performance.avgFps":null},"warningCount":0},"integrity":{"algorithm":"sha256","scope":"capture-content-v1","digest":"d917b6ece44f2ff6a9fcaa7312854066d9a737d0c3e6a88a0cd9e42042caa400"},"warnings":[],"availableSections":["react"],"renders":{"comparable":false,"notComparableReasons":["app-source-classification-incomplete"],"coverage":{"complete":false,"semantics":"unknown"}}}
[exit 0]

$ agent-browser --session art-l7 fill 'textarea[name="notes"]' ''
✓ Done
[exit 0]

$ node_modules/.bin/genie-react call react_clear_renders '{}' --session art-l7 --fields ok,observation
[1]:
  - {ok:true,observation:{id:observation:2,epoch:2,startedAfterDocumentCommitId:36}}
[exit 0]

$ agent-browser --session art-l7 type 'textarea[name="notes"]' 'Leave at dock 4, call ahead'
✓ Done
[exit 0]

$ node_modules/.bin/genie-react call react_quiesce '{"idleMs":500,"timeoutMs":10000}' --fail-on-result-error --session art-l7 --fields outcome
[1]:
  - {outcome:idle}
[exit 0]

$ node_modules/.bin/genie-react call devtools_capture_create '{"name":"before","include":["react"]}' --session art-l7 --json
{"schemaVersion":"1.0","captureId":"cap_e4033d19-f06f-48b3-9400-d07104cbea2e","name":"before","createdAt":"2026-11-19T04:21:16.176Z","session":{"sessionId":"b870902b-f88b-4339-9a2e-6b45f36af6bc","logicalSessionId":"204804a9-d37f-4d12-9ea1-c13efb806b84","documentGeneration":2,"app":{"name":"Meridian Ops","url":"http://127.0.0.1:5217/orders/new","reactVersion":"19.3.1","reactMounted":true}},"include":["react"],"consistency":{"kind":"react-commit-stable","attempts":1,"reactCommit":63,"reason":"React document commit markers matched before, during, and after all captured sections."},"complete":false,"sizeBytes":273374,"pinned":false,"summary":{"sectionStatus":{"react":"ok"},"metrics":{"react.commits":27,"react.renders":756,"query.pending":null,"memory.usedHeapBytes":null,"performance.avgFps":null},"warningCount":0},"integrity":{"algorithm":"sha256","scope":"capture-content-v1","digest":"be713ff5be2062f381a6008e154f8792944bd86be33d674268ab934ca7bc6f67"},"warnings":[],"availableSections":["react"],"renders":{"comparable":false,"notComparableReasons":["app-source-classification-incomplete"],"coverage":{"complete":false,"semantics":"unknown"}}}
[exit 0]

$ agent-browser --session art-l7 fill 'textarea[name="notes"]' ''
✓ Done
[exit 0]

$ node_modules/.bin/genie-react call react_clear_renders '{}' --session art-l7 --fields ok,observation
[1]:
  - {ok:true,observation:{id:observation:3,epoch:3,startedAfterDocumentCommitId:63}}
[exit 0]

$ agent-browser --session art-l7 type 'textarea[name="notes"]' 'Leave at dock 4, call ahead'
✓ Done
[exit 0]

$ node_modules/.bin/genie-react call react_quiesce '{"idleMs":500,"timeoutMs":10000}' --fail-on-result-error --session art-l7 --fields outcome
[1]:
  - {outcome:idle}
[exit 0]

$ node_modules/.bin/genie-react call devtools_capture_create '{"name":"before","include":["react"]}' --session art-l7 --json
{"schemaVersion":"1.0","captureId":"cap_5ece76c9-1502-460d-a234-97181ada0e22","name":"before","createdAt":"2026-11-19T04:21:18.359Z","session":{"sessionId":"b870902b-f88b-4339-9a2e-6b45f36af6bc","logicalSessionId":"204804a9-d37f-4d12-9ea1-c13efb806b84","documentGeneration":2,"app":{"name":"Meridian Ops","url":"http://127.0.0.1:5217/orders/new","reactVersion":"19.3.1","reactMounted":true}},"include":["react"],"consistency":{"kind":"react-commit-stable","attempts":1,"reactCommit":90,"reason":"React document commit markers matched before, during, and after all captured sections."},"complete":false,"sizeBytes":273378,"pinned":false,"summary":{"sectionStatus":{"react":"ok"},"metrics":{"react.commits":27,"react.renders":756,"query.pending":null,"memory.usedHeapBytes":null,"performance.avgFps":null},"warningCount":0},"integrity":{"algorithm":"sha256","scope":"capture-content-v1","digest":"b7e0dfe21b9a12611acb4ef48efb66727008511cb80f4402377ad8093eb4bf85"},"warnings":[],"availableSections":["react"],"renders":{"comparable":false,"notComparableReasons":["app-source-classification-incomplete"],"coverage":{"complete":false,"semantics":"unknown"}}}
[exit 0]

$ agent-browser --session art-l7 fill 'textarea[name="notes"]' ''
✓ Done
[exit 0]

$ node_modules/.bin/genie-react call react_clear_renders '{}' --session art-l7 --fields ok,observation
[1]:
  - {ok:true,observation:{id:observation:4,epoch:4,startedAfterDocumentCommitId:90}}
[exit 0]

$ agent-browser --session art-l7 type 'textarea[name="notes"]' 'Leave at dock 4, call ahead'
✓ Done
[exit 0]

$ node_modules/.bin/genie-react call react_quiesce '{"idleMs":500,"timeoutMs":10000}' --fail-on-result-error --session art-l7 --fields outcome
[1]:
  - {outcome:idle}
[exit 0]

$ node_modules/.bin/genie-react call devtools_capture_create '{"name":"before","include":["react"]}' --session art-l7 --json
{"schemaVersion":"1.0","captureId":"cap_a60e2f31-f0ff-45f3-8e0d-e7f995784ab7","name":"before","createdAt":"2026-11-19T04:21:20.586Z","session":{"sessionId":"b870902b-f88b-4339-9a2e-6b45f36af6bc","logicalSessionId":"204804a9-d37f-4d12-9ea1-c13efb806b84","documentGeneration":2,"app":{"name":"Meridian Ops","url":"http://127.0.0.1:5217/orders/new","reactVersion":"19.3.1","reactMounted":true}},"include":["react"],"consistency":{"kind":"react-commit-stable","attempts":1,"reactCommit":117,"reason":"React document commit markers matched before, during, and after all captured sections."},"complete":false,"sizeBytes":273521,"pinned":false,"summary":{"sectionStatus":{"react":"ok"},"metrics":{"react.commits":27,"react.renders":756,"query.pending":null,"memory.usedHeapBytes":null,"performance.avgFps":null},"warningCount":0},"integrity":{"algorithm":"sha256","scope":"capture-content-v1","digest":"8321154f4587680982f821461fbe072e8c824e7bbaf4af7bd313d07b810f2d4f"},"warnings":[],"availableSections":["react"],"renders":{"comparable":false,"notComparableReasons":["app-source-classification-incomplete"],"coverage":{"complete":false,"semantics":"unknown"}}}
[exit 0]

$ agent-browser --session art-l7 fill 'textarea[name="notes"]' ''
✓ Done
[exit 0]

$ node_modules/.bin/genie-react call react_clear_renders '{}' --session art-l7 --fields ok,observation
[1]:
  - {ok:true,observation:{id:observation:5,epoch:5,startedAfterDocumentCommitId:117}}
[exit 0]

$ agent-browser --session art-l7 type 'textarea[name="notes"]' 'Leave at dock 4, call ahead'
✓ Done
[exit 0]

$ node_modules/.bin/genie-react call react_quiesce '{"idleMs":500,"timeoutMs":10000}' --fail-on-result-error --session art-l7 --fields outcome
[1]:
  - {outcome:idle}
[exit 0]

$ node_modules/.bin/genie-react call devtools_capture_create '{"name":"before","include":["react"]}' --session art-l7 --json
{"schemaVersion":"1.0","captureId":"cap_b4a38a1e-3255-4088-b059-4e9a609ddb96","name":"before","createdAt":"2026-11-19T04:21:22.833Z","session":{"sessionId":"b870902b-f88b-4339-9a2e-6b45f36af6bc","logicalSessionId":"204804a9-d37f-4d12-9ea1-c13efb806b84","documentGeneration":2,"app":{"name":"Meridian Ops","url":"http://127.0.0.1:5217/orders/new","reactVersion":"19.3.1","reactMounted":true}},"include":["react"],"consistency":{"kind":"react-commit-stable","attempts":1,"reactCommit":144,"reason":"React document commit markers matched before, during, and after all captured sections."},"complete":false,"sizeBytes":273528,"pinned":false,"summary":{"sectionStatus":{"react":"ok"},"metrics":{"react.commits":27,"react.renders":756,"query.pending":null,"memory.usedHeapBytes":null,"performance.avgFps":null},"warningCount":0},"integrity":{"algorithm":"sha256","scope":"capture-content-v1","digest":"fd977674ab67594d077fc32ce74b97317f509e46497665531b7d3c47e30f19c7"},"warnings":[],"availableSections":["react"],"renders":{"comparable":false,"notComparableReasons":["app-source-classification-incomplete"],"coverage":{"complete":false,"semantics":"unknown"}}}
[exit 0]

$ agent-browser --session art-l7 fill 'textarea[name="notes"]' ''
✓ Done
[exit 0]

$ node_modules/.bin/genie-react call react_clear_renders '{}' --session art-l7 --fields ok,observation
[1]:
  - {ok:true,observation:{id:observation:6,epoch:6,startedAfterDocumentCommitId:144}}
[exit 0]

$ agent-browser --session art-l7 type 'textarea[name="notes"]' 'Leave at dock 4, call ahead'
✓ Done
[exit 0]

$ node_modules/.bin/genie-react call react_quiesce '{"idleMs":500,"timeoutMs":10000}' --fail-on-result-error --session art-l7 --fields outcome
[1]:
  - {outcome:idle}
[exit 0]

$ node_modules/.bin/genie-react call devtools_capture_create '{"name":"before","include":["react"]}' --session art-l7 --json
{"schemaVersion":"1.0","captureId":"cap_fcff64b0-2291-47e2-86d9-1b958d082e51","name":"before","createdAt":"2026-11-19T04:21:25.047Z","session":{"sessionId":"b870902b-f88b-4339-9a2e-6b45f36af6bc","logicalSessionId":"204804a9-d37f-4d12-9ea1-c13efb806b84","documentGeneration":2,"app":{"name":"Meridian Ops","url":"http://127.0.0.1:5217/orders/new","reactVersion":"19.3.1","reactMounted":true}},"include":["react"],"consistency":{"kind":"react-commit-stable","attempts":1,"reactCommit":171,"reason":"React document commit markers matched before, during, and after all captured sections."},"complete":false,"sizeBytes":273526,"pinned":false,"summary":{"sectionStatus":{"react":"ok"},"metrics":{"react.commits":27,"react.renders":756,"query.pending":null,"memory.usedHeapBytes":null,"performance.avgFps":null},"warningCount":0},"integrity":{"algorithm":"sha256","scope":"capture-content-v1","digest":"e7437631b941566761d36f8af180fda381a2788a3a6152f1f9f70db44b719653"},"warnings":[],"availableSections":["react"],"renders":{"comparable":false,"notComparableReasons":["app-source-classification-incomplete"],"coverage":{"complete":false,"semantics":"unknown"}}}
[exit 0]

### FIX 1 APPLIED again (useMemo index, same diff as above)
$ agent-browser --session art-l7 open http://127.0.0.1:5217/orders/new
✓ Meridian Ops
  http://127.0.0.1:5217/orders/new
[exit 0]

$ node_modules/.bin/genie-react call devtools_wait '{"condition":"settled","timeoutMs":10000}' --session art-l7 --fields ok
[1]:
  - {ok:true}
[exit 0]

$ agent-browser --session art-l7 fill 'textarea[name="notes"]' ''
✓ Done
[exit 0]

$ node_modules/.bin/genie-react call react_clear_renders '{}' --session art-l7 --fields ok,observation
[1]:
  - {ok:true,observation:{id:observation:1,epoch:1,startedAfterDocumentCommitId:9}}
[exit 0]

$ agent-browser --session art-l7 type 'textarea[name="notes"]' 'Leave at dock 4, call ahead'
✓ Done
[exit 0]

$ node_modules/.bin/genie-react call react_quiesce '{"idleMs":500,"timeoutMs":10000}' --fail-on-result-error --session art-l7 --fields outcome
[1]:
  - {outcome:idle}
[exit 0]

$ node_modules/.bin/genie-react call devtools_capture_create '{"name":"after-usememo","include":["react"]}' --session art-l7 --json
{"schemaVersion":"1.0","captureId":"cap_c8d36b8e-1250-4bf0-880e-32e5c3e425bf","name":"after-usememo","createdAt":"2026-11-19T04:21:32.482Z","session":{"sessionId":"6378a0f3-21bb-4d18-8158-6045aa72ae3b","logicalSessionId":"204804a9-d37f-4d12-9ea1-c13efb806b84","documentGeneration":3,"app":{"name":"Meridian Ops","url":"http://127.0.0.1:5217/orders/new","reactVersion":"19.3.1","reactMounted":true}},"include":["react"],"consistency":{"kind":"react-commit-stable","attempts":1,"reactCommit":36,"reason":"React document commit markers matched before, during, and after all captured sections."},"complete":false,"sizeBytes":273787,"pinned":false,"summary":{"sectionStatus":{"react":"ok"},"metrics":{"react.commits":27,"react.renders":756,"query.pending":null,"memory.usedHeapBytes":null,"performance.avgFps":null},"warningCount":0},"integrity":{"algorithm":"sha256","scope":"capture-content-v1","digest":"65491a6bb3292f1057738e1b9fe0b554d13c125e84248c36ffe9d1f2f79fbcab"},"warnings":[],"availableSections":["react"],"renders":{"comparable":false,"notComparableReasons":["app-source-classification-incomplete"],"coverage":{"complete":false,"semantics":"unknown"}}}
[exit 0]

$ agent-browser --session art-l7 fill 'textarea[name="notes"]' ''
✓ Done
[exit 0]

$ node_modules/.bin/genie-react call react_clear_renders '{}' --session art-l7 --fields ok,observation
[1]:
  - {ok:true,observation:{id:observation:2,epoch:2,startedAfterDocumentCommitId:36}}
[exit 0]

$ agent-browser --session art-l7 type 'textarea[name="notes"]' 'Leave at dock 4, call ahead'
✓ Done
[exit 0]

$ node_modules/.bin/genie-react call react_quiesce '{"idleMs":500,"timeoutMs":10000}' --fail-on-result-error --session art-l7 --fields outcome
[1]:
  - {outcome:idle}
[exit 0]

$ node_modules/.bin/genie-react call devtools_capture_create '{"name":"after-usememo","include":["react"]}' --session art-l7 --json
{"schemaVersion":"1.0","captureId":"cap_cd88fdcc-b361-4e03-a8c2-1da127ef039a","name":"after-usememo","createdAt":"2026-11-19T04:21:34.737Z","session":{"sessionId":"6378a0f3-21bb-4d18-8158-6045aa72ae3b","logicalSessionId":"204804a9-d37f-4d12-9ea1-c13efb806b84","documentGeneration":3,"app":{"name":"Meridian Ops","url":"http://127.0.0.1:5217/orders/new","reactVersion":"19.3.1","reactMounted":true}},"include":["react"],"consistency":{"kind":"react-commit-stable","attempts":1,"reactCommit":63,"reason":"React document commit markers matched before, during, and after all captured sections."},"complete":false,"sizeBytes":273847,"pinned":false,"summary":{"sectionStatus":{"react":"ok"},"metrics":{"react.commits":27,"react.renders":756,"query.pending":null,"memory.usedHeapBytes":null,"performance.avgFps":null},"warningCount":0},"integrity":{"algorithm":"sha256","scope":"capture-content-v1","digest":"667a5d0388a0d0eae5f8e20a2d03005daf19126c3ec75b35a2d1b6dbc1506b8c"},"warnings":[],"availableSections":["react"],"renders":{"comparable":false,"notComparableReasons":["app-source-classification-incomplete"],"coverage":{"complete":false,"semantics":"unknown"}}}
[exit 0]

$ agent-browser --session art-l7 fill 'textarea[name="notes"]' ''
✓ Done
[exit 0]

$ node_modules/.bin/genie-react call react_clear_renders '{}' --session art-l7 --fields ok,observation
[1]:
  - {ok:true,observation:{id:observation:3,epoch:3,startedAfterDocumentCommitId:63}}
[exit 0]

$ agent-browser --session art-l7 type 'textarea[name="notes"]' 'Leave at dock 4, call ahead'
✓ Done
[exit 0]

$ node_modules/.bin/genie-react call react_quiesce '{"idleMs":500,"timeoutMs":10000}' --fail-on-result-error --session art-l7 --fields outcome
[1]:
  - {outcome:idle}
[exit 0]

$ node_modules/.bin/genie-react call devtools_capture_create '{"name":"after-usememo","include":["react"]}' --session art-l7 --json
{"schemaVersion":"1.0","captureId":"cap_25b50d24-1a96-44bd-9b21-a5a02cd7b82c","name":"after-usememo","createdAt":"2026-11-19T04:21:37.002Z","session":{"sessionId":"6378a0f3-21bb-4d18-8158-6045aa72ae3b","logicalSessionId":"204804a9-d37f-4d12-9ea1-c13efb806b84","documentGeneration":3,"app":{"name":"Meridian Ops","url":"http://127.0.0.1:5217/orders/new","reactVersion":"19.3.1","reactMounted":true}},"include":["react"],"consistency":{"kind":"react-commit-stable","attempts":1,"reactCommit":90,"reason":"React document commit markers matched before, during, and after all captured sections."},"complete":false,"sizeBytes":273851,"pinned":false,"summary":{"sectionStatus":{"react":"ok"},"metrics":{"react.commits":27,"react.renders":756,"query.pending":null,"memory.usedHeapBytes":null,"performance.avgFps":null},"warningCount":0},"integrity":{"algorithm":"sha256","scope":"capture-content-v1","digest":"6b22ddb7dcc265b7eea6cc8880bf08b8e3ecde9236d1c29e7ef988faa5b57c94"},"warnings":[],"availableSections":["react"],"renders":{"comparable":false,"notComparableReasons":["app-source-classification-incomplete"],"coverage":{"complete":false,"semantics":"unknown"}}}
[exit 0]

$ agent-browser --session art-l7 fill 'textarea[name="notes"]' ''
✓ Done
[exit 0]

$ node_modules/.bin/genie-react call react_clear_renders '{}' --session art-l7 --fields ok,observation
[1]:
  - {ok:true,observation:{id:observation:4,epoch:4,startedAfterDocumentCommitId:90}}
[exit 0]

$ agent-browser --session art-l7 type 'textarea[name="notes"]' 'Leave at dock 4, call ahead'
✓ Done
[exit 0]

$ node_modules/.bin/genie-react call react_quiesce '{"idleMs":500,"timeoutMs":10000}' --fail-on-result-error --session art-l7 --fields outcome
[1]:
  - {outcome:idle}
[exit 0]

$ node_modules/.bin/genie-react call devtools_capture_create '{"name":"after-usememo","include":["react"]}' --session art-l7 --json
{"schemaVersion":"1.0","captureId":"cap_bd791b2f-8674-4212-922f-bb7cabfd62bb","name":"after-usememo","createdAt":"2026-11-19T04:21:39.270Z","session":{"sessionId":"6378a0f3-21bb-4d18-8158-6045aa72ae3b","logicalSessionId":"204804a9-d37f-4d12-9ea1-c13efb806b84","documentGeneration":3,"app":{"name":"Meridian Ops","url":"http://127.0.0.1:5217/orders/new","reactVersion":"19.3.1","reactMounted":true}},"include":["react"],"consistency":{"kind":"react-commit-stable","attempts":1,"reactCommit":117,"reason":"React document commit markers matched before, during, and after all captured sections."},"complete":false,"sizeBytes":273978,"pinned":false,"summary":{"sectionStatus":{"react":"ok"},"metrics":{"react.commits":27,"react.renders":756,"query.pending":null,"memory.usedHeapBytes":null,"performance.avgFps":null},"warningCount":0},"integrity":{"algorithm":"sha256","scope":"capture-content-v1","digest":"d5561dfab831bc293823d315cffc04f325dce888bb6436e0fb2e45921c0b7331"},"warnings":[],"availableSections":["react"],"renders":{"comparable":false,"notComparableReasons":["app-source-classification-incomplete"],"coverage":{"complete":false,"semantics":"unknown"}}}
[exit 0]

$ agent-browser --session art-l7 fill 'textarea[name="notes"]' ''
✓ Done
[exit 0]

$ node_modules/.bin/genie-react call react_clear_renders '{}' --session art-l7 --fields ok,observation
[1]:
  - {ok:true,observation:{id:observation:5,epoch:5,startedAfterDocumentCommitId:117}}
[exit 0]

$ agent-browser --session art-l7 type 'textarea[name="notes"]' 'Leave at dock 4, call ahead'
✓ Done
[exit 0]

$ node_modules/.bin/genie-react call react_quiesce '{"idleMs":500,"timeoutMs":10000}' --fail-on-result-error --session art-l7 --fields outcome
[1]:
  - {outcome:idle}
[exit 0]

$ node_modules/.bin/genie-react call devtools_capture_create '{"name":"after-usememo","include":["react"]}' --session art-l7 --json
{"schemaVersion":"1.0","captureId":"cap_9c00a6cd-54e1-452f-8028-d806952d236f","name":"after-usememo","createdAt":"2026-11-19T04:21:41.563Z","session":{"sessionId":"6378a0f3-21bb-4d18-8158-6045aa72ae3b","logicalSessionId":"204804a9-d37f-4d12-9ea1-c13efb806b84","documentGeneration":3,"app":{"name":"Meridian Ops","url":"http://127.0.0.1:5217/orders/new","reactVersion":"19.3.1","reactMounted":true}},"include":["react"],"consistency":{"kind":"react-commit-stable","attempts":1,"reactCommit":144,"reason":"React document commit markers matched before, during, and after all captured sections."},"complete":false,"sizeBytes":273991,"pinned":false,"summary":{"sectionStatus":{"react":"ok"},"metrics":{"react.commits":27,"react.renders":756,"query.pending":null,"memory.usedHeapBytes":null,"performance.avgFps":null},"warningCount":0},"integrity":{"algorithm":"sha256","scope":"capture-content-v1","digest":"596c4140cd896306ba4dd1820484d2b81681fcdb5b369157f09054e899666edf"},"warnings":[],"availableSections":["react"],"renders":{"comparable":false,"notComparableReasons":["app-source-classification-incomplete"],"coverage":{"complete":false,"semantics":"unknown"}}}
[exit 0]

$ agent-browser --session art-l7 fill 'textarea[name="notes"]' ''
✓ Done
[exit 0]

$ node_modules/.bin/genie-react call react_clear_renders '{}' --session art-l7 --fields ok,observation
[1]:
  - {ok:true,observation:{id:observation:6,epoch:6,startedAfterDocumentCommitId:144}}
[exit 0]

$ agent-browser --session art-l7 type 'textarea[name="notes"]' 'Leave at dock 4, call ahead'
✓ Done
[exit 0]

$ node_modules/.bin/genie-react call react_quiesce '{"idleMs":500,"timeoutMs":10000}' --fail-on-result-error --session art-l7 --fields outcome
[1]:
  - {outcome:idle}
[exit 0]

$ node_modules/.bin/genie-react call devtools_capture_create '{"name":"after-usememo","include":["react"]}' --session art-l7 --json
{"schemaVersion":"1.0","captureId":"cap_c34e8063-90c9-48cf-b305-b84e66fb1097","name":"after-usememo","createdAt":"2026-11-19T04:21:43.852Z","session":{"sessionId":"6378a0f3-21bb-4d18-8158-6045aa72ae3b","logicalSessionId":"204804a9-d37f-4d12-9ea1-c13efb806b84","documentGeneration":3,"app":{"name":"Meridian Ops","url":"http://127.0.0.1:5217/orders/new","reactVersion":"19.3.1","reactMounted":true}},"include":["react"],"consistency":{"kind":"react-commit-stable","attempts":1,"reactCommit":171,"reason":"React document commit markers matched before, during, and after all captured sections."},"complete":false,"sizeBytes":273991,"pinned":false,"summary":{"sectionStatus":{"react":"ok"},"metrics":{"react.commits":27,"react.renders":756,"query.pending":null,"memory.usedHeapBytes":null,"performance.avgFps":null},"warningCount":0},"integrity":{"algorithm":"sha256","scope":"capture-content-v1","digest":"a8b44ccc884a170bed31f0c2044efd6dbe73efbcd9429363b7eadcdd512460c8"},"warnings":[],"availableSections":["react"],"renders":{"comparable":false,"notComparableReasons":["app-source-classification-incomplete"],"coverage":{"complete":false,"semantics":"unknown"}}}
[exit 0]

### NOTE: the 'FIX 1 APPLIED again' step above failed (git apply did not apply; git diff empty). The six after-usememo captures listed just above ran on UNFIXED code and are discarded: cap_c8d36b8e-1250-4bf0-880e-32e5c3e425bf cap_cd88fdcc-b361-4e03-a8c2-1da127ef039a cap_25b50d24-1a96-44bd-9b21-a5a02cd7b82c cap_bd791b2f-8674-4212-922f-bb7cabfd62bb cap_9c00a6cd-54e1-452f-8028-d806952d236f cap_c34e8063-90c9-48cf-b305-b84e66fb1097 
$ git diff src/features/orders/product-picker.tsx
diff --git a/apps/realworld-dashboard/src/features/orders/product-picker.tsx b/apps/realworld-dashboard/src/features/orders/product-picker.tsx
index 30294a2..93906fe 100644
--- a/apps/realworld-dashboard/src/features/orders/product-picker.tsx
+++ b/apps/realworld-dashboard/src/features/orders/product-picker.tsx
@@ -1,5 +1,5 @@
 import { Plus } from 'lucide-react'
-import { useState } from 'react'
+import { useMemo, useState } from 'react'
 import type { Product } from '../../api/types'
 import { usePreferences } from '../../app/preferences'
 import { Input } from '../../components/ui/form-controls'
@@ -19,7 +19,7 @@ export function ProductPicker({
 }) {
   const { formatMoney } = usePreferences()
   const [term, setTerm] = useState('')
-  const index = buildProductIndex(products)
+  const index = useMemo(() => buildProductIndex(products), [products])
   const matches = term.trim().length < MIN_TERM_LENGTH ? [] : index.search(term, RESULT_LIMIT)
 
   return (
[exit 0]

$ agent-browser --session art-l7 open http://127.0.0.1:5217/orders/new
✓ Meridian Ops
  http://127.0.0.1:5217/orders/new
[exit 0]

$ node_modules/.bin/genie-react call devtools_wait '{"condition":"settled","timeoutMs":10000}' --session art-l7 --fields ok
[1]:
  - {ok:true}
[exit 0]

$ agent-browser --session art-l7 fill 'textarea[name="notes"]' ''
✓ Done
[exit 0]

$ node_modules/.bin/genie-react call react_clear_renders '{}' --session art-l7 --fields ok,observation
[1]:
  - {ok:true,observation:{id:observation:1,epoch:1,startedAfterDocumentCommitId:9}}
[exit 0]

$ agent-browser --session art-l7 type 'textarea[name="notes"]' 'Leave at dock 4, call ahead'
✓ Done
[exit 0]

$ node_modules/.bin/genie-react call react_quiesce '{"idleMs":500,"timeoutMs":10000}' --fail-on-result-error --session art-l7 --fields outcome
[1]:
  - {outcome:idle}
[exit 0]

$ node_modules/.bin/genie-react call devtools_capture_create '{"name":"after-usememo","include":["react"]}' --session art-l7 --json
{"schemaVersion":"1.0","captureId":"cap_675b2131-aeea-42ba-9be1-0cec28869a65","name":"after-usememo","createdAt":"2026-11-19T04:22:02.742Z","session":{"sessionId":"aaabae0b-0714-47a9-b9de-459912e06913","logicalSessionId":"204804a9-d37f-4d12-9ea1-c13efb806b84","documentGeneration":5,"app":{"name":"Meridian Ops","url":"http://127.0.0.1:5217/orders/new","reactVersion":"19.3.1","reactMounted":true}},"include":["react"],"consistency":{"kind":"react-commit-stable","attempts":1,"reactCommit":36,"reason":"React document commit markers matched before, during, and after all captured sections."},"complete":false,"sizeBytes":273759,"pinned":false,"summary":{"sectionStatus":{"react":"ok"},"metrics":{"react.commits":27,"react.renders":756,"query.pending":null,"memory.usedHeapBytes":null,"performance.avgFps":null},"warningCount":0},"integrity":{"algorithm":"sha256","scope":"capture-content-v1","digest":"fd0d5372121ce7b9f19997630619d2201d2aab491326da7c0e13cc3a1e0aede0"},"warnings":[],"availableSections":["react"],"renders":{"comparable":false,"notComparableReasons":["app-source-classification-incomplete"],"coverage":{"complete":false,"semantics":"unknown"}}}
[exit 0]

$ agent-browser --session art-l7 fill 'textarea[name="notes"]' ''
✓ Done
[exit 0]

$ node_modules/.bin/genie-react call react_clear_renders '{}' --session art-l7 --fields ok,observation
[1]:
  - {ok:true,observation:{id:observation:2,epoch:2,startedAfterDocumentCommitId:36}}
[exit 0]

$ agent-browser --session art-l7 type 'textarea[name="notes"]' 'Leave at dock 4, call ahead'
✓ Done
[exit 0]

$ node_modules/.bin/genie-react call react_quiesce '{"idleMs":500,"timeoutMs":10000}' --fail-on-result-error --session art-l7 --fields outcome
[1]:
  - {outcome:idle}
[exit 0]

$ node_modules/.bin/genie-react call devtools_capture_create '{"name":"after-usememo","include":["react"]}' --session art-l7 --json
{"schemaVersion":"1.0","captureId":"cap_d9330e7f-fa23-4910-af6a-d8db7af09f49","name":"after-usememo","createdAt":"2026-11-19T04:22:03.866Z","session":{"sessionId":"aaabae0b-0714-47a9-b9de-459912e06913","logicalSessionId":"204804a9-d37f-4d12-9ea1-c13efb806b84","documentGeneration":5,"app":{"name":"Meridian Ops","url":"http://127.0.0.1:5217/orders/new","reactVersion":"19.3.1","reactMounted":true}},"include":["react"],"consistency":{"kind":"react-commit-stable","attempts":1,"reactCommit":63,"reason":"React document commit markers matched before, during, and after all captured sections."},"complete":false,"sizeBytes":273801,"pinned":false,"summary":{"sectionStatus":{"react":"ok"},"metrics":{"react.commits":27,"react.renders":756,"query.pending":null,"memory.usedHeapBytes":null,"performance.avgFps":null},"warningCount":0},"integrity":{"algorithm":"sha256","scope":"capture-content-v1","digest":"2fe4d342ad7aa26b37474e04e328e469d41c690a55e25cc7a6b80ebd70d6f53c"},"warnings":[],"availableSections":["react"],"renders":{"comparable":false,"notComparableReasons":["app-source-classification-incomplete"],"coverage":{"complete":false,"semantics":"unknown"}}}
[exit 0]

$ agent-browser --session art-l7 fill 'textarea[name="notes"]' ''
✓ Done
[exit 0]

$ node_modules/.bin/genie-react call react_clear_renders '{}' --session art-l7 --fields ok,observation
[1]:
  - {ok:true,observation:{id:observation:3,epoch:3,startedAfterDocumentCommitId:63}}
[exit 0]

$ agent-browser --session art-l7 type 'textarea[name="notes"]' 'Leave at dock 4, call ahead'
✓ Done
[exit 0]

$ node_modules/.bin/genie-react call react_quiesce '{"idleMs":500,"timeoutMs":10000}' --fail-on-result-error --session art-l7 --fields outcome
[1]:
  - {outcome:idle}
[exit 0]

$ node_modules/.bin/genie-react call devtools_capture_create '{"name":"after-usememo","include":["react"]}' --session art-l7 --json
{"schemaVersion":"1.0","captureId":"cap_7ee02774-df5d-4218-8caa-47399c3fa6d7","name":"after-usememo","createdAt":"2026-11-19T04:22:05.008Z","session":{"sessionId":"aaabae0b-0714-47a9-b9de-459912e06913","logicalSessionId":"204804a9-d37f-4d12-9ea1-c13efb806b84","documentGeneration":5,"app":{"name":"Meridian Ops","url":"http://127.0.0.1:5217/orders/new","reactVersion":"19.3.1","reactMounted":true}},"include":["react"],"consistency":{"kind":"react-commit-stable","attempts":1,"reactCommit":90,"reason":"React document commit markers matched before, during, and after all captured sections."},"complete":false,"sizeBytes":273813,"pinned":false,"summary":{"sectionStatus":{"react":"ok"},"metrics":{"react.commits":27,"react.renders":756,"query.pending":null,"memory.usedHeapBytes":null,"performance.avgFps":null},"warningCount":0},"integrity":{"algorithm":"sha256","scope":"capture-content-v1","digest":"591b6946709bb7964f23a5a1219ffe0ecd29e1bc6c92821c586bc25a0a693c9a"},"warnings":[],"availableSections":["react"],"renders":{"comparable":false,"notComparableReasons":["app-source-classification-incomplete"],"coverage":{"complete":false,"semantics":"unknown"}}}
[exit 0]

$ agent-browser --session art-l7 fill 'textarea[name="notes"]' ''
✓ Done
[exit 0]

$ node_modules/.bin/genie-react call react_clear_renders '{}' --session art-l7 --fields ok,observation
[1]:
  - {ok:true,observation:{id:observation:4,epoch:4,startedAfterDocumentCommitId:90}}
[exit 0]

$ agent-browser --session art-l7 type 'textarea[name="notes"]' 'Leave at dock 4, call ahead'
✓ Done
[exit 0]

$ node_modules/.bin/genie-react call react_quiesce '{"idleMs":500,"timeoutMs":10000}' --fail-on-result-error --session art-l7 --fields outcome
[1]:
  - {outcome:idle}
[exit 0]

$ node_modules/.bin/genie-react call devtools_capture_create '{"name":"after-usememo","include":["react"]}' --session art-l7 --json
{"schemaVersion":"1.0","captureId":"cap_95021401-2a6e-44fc-a130-6e078f5a3ea2","name":"after-usememo","createdAt":"2026-11-19T04:22:06.124Z","session":{"sessionId":"aaabae0b-0714-47a9-b9de-459912e06913","logicalSessionId":"204804a9-d37f-4d12-9ea1-c13efb806b84","documentGeneration":5,"app":{"name":"Meridian Ops","url":"http://127.0.0.1:5217/orders/new","reactVersion":"19.3.1","reactMounted":true}},"include":["react"],"consistency":{"kind":"react-commit-stable","attempts":1,"reactCommit":117,"reason":"React document commit markers matched before, during, and after all captured sections."},"complete":false,"sizeBytes":273970,"pinned":false,"summary":{"sectionStatus":{"react":"ok"},"metrics":{"react.commits":27,"react.renders":756,"query.pending":null,"memory.usedHeapBytes":null,"performance.avgFps":null},"warningCount":0},"integrity":{"algorithm":"sha256","scope":"capture-content-v1","digest":"45baa7fe20f5c03c94d08a6ecb90e492f912a30c27e2cbff245a2b4bb241df91"},"warnings":[],"availableSections":["react"],"renders":{"comparable":false,"notComparableReasons":["app-source-classification-incomplete"],"coverage":{"complete":false,"semantics":"unknown"}}}
[exit 0]

$ agent-browser --session art-l7 fill 'textarea[name="notes"]' ''
✓ Done
[exit 0]

$ node_modules/.bin/genie-react call react_clear_renders '{}' --session art-l7 --fields ok,observation
[1]:
  - {ok:true,observation:{id:observation:5,epoch:5,startedAfterDocumentCommitId:117}}
[exit 0]

$ agent-browser --session art-l7 type 'textarea[name="notes"]' 'Leave at dock 4, call ahead'
✓ Done
[exit 0]

$ node_modules/.bin/genie-react call react_quiesce '{"idleMs":500,"timeoutMs":10000}' --fail-on-result-error --session art-l7 --fields outcome
[1]:
  - {outcome:idle}
[exit 0]

$ node_modules/.bin/genie-react call devtools_capture_create '{"name":"after-usememo","include":["react"]}' --session art-l7 --json
{"schemaVersion":"1.0","captureId":"cap_88c07750-96f2-478e-a7e2-1c8d50defc17","name":"after-usememo","createdAt":"2026-11-19T04:22:07.247Z","session":{"sessionId":"aaabae0b-0714-47a9-b9de-459912e06913","logicalSessionId":"204804a9-d37f-4d12-9ea1-c13efb806b84","documentGeneration":5,"app":{"name":"Meridian Ops","url":"http://127.0.0.1:5217/orders/new","reactVersion":"19.3.1","reactMounted":true}},"include":["react"],"consistency":{"kind":"react-commit-stable","attempts":1,"reactCommit":144,"reason":"React document commit markers matched before, during, and after all captured sections."},"complete":false,"sizeBytes":273975,"pinned":false,"summary":{"sectionStatus":{"react":"ok"},"metrics":{"react.commits":27,"react.renders":756,"query.pending":null,"memory.usedHeapBytes":null,"performance.avgFps":null},"warningCount":0},"integrity":{"algorithm":"sha256","scope":"capture-content-v1","digest":"c5e88424a96e97430137e10ddf3f06a5a08591dcf0ed0f4e790016d8f059e2b8"},"warnings":[],"availableSections":["react"],"renders":{"comparable":false,"notComparableReasons":["app-source-classification-incomplete"],"coverage":{"complete":false,"semantics":"unknown"}}}
[exit 0]

$ agent-browser --session art-l7 fill 'textarea[name="notes"]' ''
✓ Done
[exit 0]

$ node_modules/.bin/genie-react call react_clear_renders '{}' --session art-l7 --fields ok,observation
[1]:
  - {ok:true,observation:{id:observation:6,epoch:6,startedAfterDocumentCommitId:144}}
[exit 0]

$ agent-browser --session art-l7 type 'textarea[name="notes"]' 'Leave at dock 4, call ahead'
✓ Done
[exit 0]

$ node_modules/.bin/genie-react call react_quiesce '{"idleMs":500,"timeoutMs":10000}' --fail-on-result-error --session art-l7 --fields outcome
[1]:
  - {outcome:idle}
[exit 0]

$ node_modules/.bin/genie-react call devtools_capture_create '{"name":"after-usememo","include":["react"]}' --session art-l7 --json
{"schemaVersion":"1.0","captureId":"cap_e8900831-ff49-4efe-bfdf-18124f72486c","name":"after-usememo","createdAt":"2026-11-19T04:22:08.416Z","session":{"sessionId":"aaabae0b-0714-47a9-b9de-459912e06913","logicalSessionId":"204804a9-d37f-4d12-9ea1-c13efb806b84","documentGeneration":5,"app":{"name":"Meridian Ops","url":"http://127.0.0.1:5217/orders/new","reactVersion":"19.3.1","reactMounted":true}},"include":["react"],"consistency":{"kind":"react-commit-stable","attempts":1,"reactCommit":171,"reason":"React document commit markers matched before, during, and after all captured sections."},"complete":false,"sizeBytes":273959,"pinned":false,"summary":{"sectionStatus":{"react":"ok"},"metrics":{"react.commits":27,"react.renders":756,"query.pending":null,"memory.usedHeapBytes":null,"performance.avgFps":null},"warningCount":0},"integrity":{"algorithm":"sha256","scope":"capture-content-v1","digest":"1e13d2bc28bcbebcedbb6b9099cfe47e03dba6ff70457536869206d0ff2e3be7"},"warnings":[],"availableSections":["react"],"renders":{"comparable":false,"notComparableReasons":["app-source-classification-incomplete"],"coverage":{"complete":false,"semantics":"unknown"}}}
[exit 0]

$ node_modules/.bin/genie-react call devtools_capture_compare '{"baselineCaptureIds":["cap_00b8a9bd-98bc-4bda-a4b7-e30a4b8a9029","cap_e4033d19-f06f-48b3-9400-d07104cbea2e","cap_5ece76c9-1502-460d-a234-97181ada0e22","cap_a60e2f31-f0ff-45f3-8e0d-e7f995784ab7","cap_b4a38a1e-3255-4088-b059-4e9a609ddb96","cap_fcff64b0-2291-47e2-86d9-1b958d082e51"],"candidateCaptureIds":["cap_675b2131-aeea-42ba-9be1-0cec28869a65","cap_d9330e7f-fa23-4910-af6a-d8db7af09f49","cap_7ee02774-df5d-4218-8caa-47399c3fa6d7","cap_95021401-2a6e-44fc-a130-6e078f5a3ea2","cap_88c07750-96f2-478e-a7e2-1c8d50defc17","cap_e8900831-ff49-4efe-bfdf-18124f72486c"],"metrics":["react.selfTimeMs","react.renders"],"budgets":[{"metric":"react.selfTimeMs","maxValue":8}]}' --session art-l7
schemaVersion: "1.0"
kind: capture-comparison
comparisonId: cmp_e81ab4f2-32f6-4740-a3ed-bc4c881cda5e
createdAt: 2026-11-19T04:22:13.516Z
minimumRuns: 5
policy: {warmupRuns:1,outlierThreshold:3.5,confidenceLevel:0.95,minimumEffectPct:5}
excluded:
  warmupBaselineCaptureIds: [cap_00b8a9bd-98bc-4bda-a4b7-e30a4b8a9029]
  warmupCandidateCaptureIds: [cap_675b2131-aeea-42ba-9be1-0cec28869a65]
baselineCaptureIds: [cap_00b8a9bd-98bc-4bda-a4b7-e30a4b8a9029,cap_e4033d19-f06f-48b3-9400-d07104cbea2e,cap_5ece76c9-1502-460d-a234-97181ada0e22,cap_a60e2f31-f0ff-45f3-8e0d-e7f995784ab7,cap_b4a38a1e-3255-4088-b059-4e9a609ddb96,cap_fcff64b0-2291-47e2-86d9-1b958d082e51]
candidateCaptureIds: [cap_675b2131-aeea-42ba-9be1-0cec28869a65,cap_d9330e7f-fa23-4910-af6a-d8db7af09f49,cap_7ee02774-df5d-4218-8caa-47399c3fa6d7,cap_95021401-2a6e-44fc-a130-6e078f5a3ea2,cap_88c07750-96f2-478e-a7e2-1c8d50defc17,cap_e8900831-ff49-4efe-bfdf-18124f72486c]
overall: pass
notComparableReasons: []
metrics[2] (metric verdict {fields}, then one line per reason):
  react.selfTimeMs pass {direction:lower-is-better,baseline:{samples:5,median:46.2,p95:50.94,mad:2,min:44.2,max:51.2},candidate:{samples:5,median:3.7,p95:3.98,mad:0.2,min:3.5,max:4},missingBaselineCaptureIds:[],missingCandidateCaptureIds:[],excludedCaptureIds:{},outlierBaselineCaptureIds:[],outlierCandidateCaptureIds:[],comparable:true,notComparableReasons:[],delta:{median:-42.5,regressionPct:-91.9913},budget:{metric:react.selfTimeMs,maxValue:8},confidence:{level:0.95,pValue:0.0079,achieved:0.9921,significant:true,minimumEffectPct:5,observedEffectPct:-91.9913,noiseFloorPct:6.4182}}
    reasons: []
  react.renders informational {direction:lower-is-better,baseline:{samples:5,median:756,p95:756,mad:0,min:756,max:756},candidate:{samples:5,median:756,p95:756,mad:0,min:756,max:756},missingBaselineCaptureIds:[],missingCandidateCaptureIds:[],excludedCaptureIds:{},outlierBaselineCaptureIds:[],outlierCandidateCaptureIds:[],comparable:true,notComparableReasons:[],delta:{median:0,regressionPct:0},confidence:{level:0.95,pValue:1,achieved:0,significant:false,minimumEffectPct:5,observedEffectPct:0,noiseFloorPct:0}}
    reason: "no significant change (0%, p=1); pass budgets to gate on it"
violations: []
warnings: ["Ownership of create-order-page.tsx (/src/features/orders/create-order-page.tsx) is unknown; app-only render totals count them, and component metrics are compared only when every capture names the same ones."]
[exit 0]

$ node_modules/.bin/genie-react call devtools_capture_compare '{"baselineCaptureIds":["cap_675b2131-aeea-42ba-9be1-0cec28869a65","cap_d9330e7f-fa23-4910-af6a-d8db7af09f49","cap_7ee02774-df5d-4218-8caa-47399c3fa6d7","cap_95021401-2a6e-44fc-a130-6e078f5a3ea2","cap_88c07750-96f2-478e-a7e2-1c8d50defc17","cap_e8900831-ff49-4efe-bfdf-18124f72486c"],"candidateCaptureIds":["cap_00b8a9bd-98bc-4bda-a4b7-e30a4b8a9029","cap_e4033d19-f06f-48b3-9400-d07104cbea2e","cap_5ece76c9-1502-460d-a234-97181ada0e22","cap_a60e2f31-f0ff-45f3-8e0d-e7f995784ab7","cap_b4a38a1e-3255-4088-b059-4e9a609ddb96","cap_fcff64b0-2291-47e2-86d9-1b958d082e51"],"metrics":["react.selfTimeMs"],"budgets":[{"metric":"react.selfTimeMs","maxValue":8}]}' --session art-l7
schemaVersion: "1.0"
kind: capture-comparison
comparisonId: cmp_fd1ea79e-8843-49f1-950d-50b1b74bb750
createdAt: 2026-11-19T04:22:13.607Z
minimumRuns: 5
policy: {warmupRuns:1,outlierThreshold:3.5,confidenceLevel:0.95,minimumEffectPct:5}
excluded:
  warmupBaselineCaptureIds: [cap_675b2131-aeea-42ba-9be1-0cec28869a65]
  warmupCandidateCaptureIds: [cap_00b8a9bd-98bc-4bda-a4b7-e30a4b8a9029]
baselineCaptureIds: [cap_675b2131-aeea-42ba-9be1-0cec28869a65,cap_d9330e7f-fa23-4910-af6a-d8db7af09f49,cap_7ee02774-df5d-4218-8caa-47399c3fa6d7,cap_95021401-2a6e-44fc-a130-6e078f5a3ea2,cap_88c07750-96f2-478e-a7e2-1c8d50defc17,cap_e8900831-ff49-4efe-bfdf-18124f72486c]
candidateCaptureIds: [cap_00b8a9bd-98bc-4bda-a4b7-e30a4b8a9029,cap_e4033d19-f06f-48b3-9400-d07104cbea2e,cap_5ece76c9-1502-460d-a234-97181ada0e22,cap_a60e2f31-f0ff-45f3-8e0d-e7f995784ab7,cap_b4a38a1e-3255-4088-b059-4e9a609ddb96,cap_fcff64b0-2291-47e2-86d9-1b958d082e51]
overall: fail
notComparableReasons: []
metrics[1] (metric verdict {fields}, then one line per reason):
  react.selfTimeMs fail {direction:lower-is-better,baseline:{samples:5,median:3.7,p95:3.98,mad:0.2,min:3.5,max:4},candidate:{samples:5,median:46.2,p95:50.94,mad:2,min:44.2,max:51.2},missingBaselineCaptureIds:[],missingCandidateCaptureIds:[],excludedCaptureIds:{},outlierBaselineCaptureIds:[],outlierCandidateCaptureIds:[],comparable:true,notComparableReasons:[],delta:{median:42.5,regressionPct:1148.6486},budget:{metric:react.selfTimeMs,maxValue:8},confidence:{level:0.95,pValue:0.0079,achieved:0.9921,significant:true,minimumEffectPct:5,observedEffectPct:1148.6486,noiseFloorPct:80.1405}}
    reason: "candidate median 46.2 exceeds maxValue 8"
violations: [{metric:react.selfTimeMs,reasons:["candidate median 46.2 exceeds maxValue 8"]}]
warnings: ["Ownership of create-order-page.tsx (/src/features/orders/create-order-page.tsx) is unknown; app-only render totals count them, and component metrics are compared only when every capture names the same ones."]
[exit 0]

### FIX REVERTED (git checkout -- src/features/orders/)
```
