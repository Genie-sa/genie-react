# Evidence: the-fix-that-passed-and-changed-nothing

- Date: 2026-11-19 (runs between 03:54 and 03:56 UTC)
- Commit: `6867352ba46ec3998fe8cda0ba915536fddfa666` (`git rev-parse HEAD`, first command below)
- App: `apps/realworld-dashboard` (Meridian Ops), dev server started from the app folder with
  `DASHBOARD_PORT=5215 pnpm exec vite --port 5215 --strictPort`
- URL: `http://127.0.0.1:5215/orders` (redirects to `/orders?sort=placedAt&dir=desc`)
- Genie: CLI and runtime 1.0.2 from this checkout (`pnpm install && pnpm build`), React 19.3.1
  development build in StrictMode, headless Chromium through agent-browser 0.39.1
- Session: `art-l5`, already signed in as the manager demo user (see the evidence for
  `prove-your-agents-react-fix`, which ran just before these commands on the same tab)

Every command below ran from `apps/realworld-dashboard`, in this order. Output is untrimmed. Steps
that are not shell commands are noted here: waits of 2 seconds after each `open` and after the
source edit, and the temporary source edit itself, which was applied with a script and is shown by
the `git diff` run that follows it. The edit is a deliberately wrong fix. It was reverted with
`git checkout` (last command) and never committed.

Order of runs:

1. Unchanged code, real interaction on SO-105999: fail.
2. Wrong fix applied. Same commands, same row, which run 1 already put on hold, so the
   **Put on hold** item is disabled: pass with 0 renders.
3. Same as 2 with `render OrderRow min 1` added: fail.
4. Backend reset, real interaction on SO-105999 with the wrong fix: fail with 24 renders.
5. Page reloaded between `begin` and `end`: refused, exit 4.
6. Open the search palette with `effect CommandPalette max 1`: inconclusive, exit 5.
7. `begin` and `end` with no interaction at all: pass, because `SyncStatus` ticks once a second.
   `verify show --section raw:react_get_renders` shows those commits.

## Runs

```console
$ git rev-parse HEAD
6867352ba46ec3998fe8cda0ba915536fddfa666
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
$ npx genie-react verify begin --session art-l5 --name 'put one order on hold' --claim 'render OrderRow only props.order' --claim 'boundaries clean'
recording vfy_c6434521-1454-4087-9d79-40c74da41761 "put one order on hold"
  url "http://127.0.0.1:5215/orders?sort=placedAt&dir=desc"
  1 null render OrderRow only props.order  {}
  2 null boundaries clean  {}
window: {observationId:observation:1,startDocumentCommitId:9,domains:[react,query,router],quietMs:500,timeoutMs:10000,tailMs:500}
next: $ pnpm exec genie-react verify end vfy_c6434521-1454-4087-9d79-40c74da41761 --session art-l5
session: {sessionId:37c13a48-021b-49f9-bb36-bb4281a62b6f,logicalSessionId:91e3ff5f-eb6d-450b-9f23-9632c736dd69,documentGeneration:8}
schemaVersion: "1.0"
targets: [{target:{component:OrderRow},status:resolved,instances:12,unresolvedSources:12}]
startedAt: 2026-11-19T03:53:58.289Z
expiresAt: 2026-11-19T03:58:58.306Z
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
$ npx genie-react verify end vfy_c6434521-1454-4087-9d79-40c74da41761 --session art-l5
fail vfy_c6434521-1454-4087-9d79-40c74da41761 "put one order on hold"  9 commits, quiet after 967 ms (react, query, router)
  url "http://127.0.0.1:5215/orders?sort=placedAt&dir=desc"
  1 fail render OrderRow only props.order  {renders:24,events:24,violatingEvents:24,causes:[props.onStatusChange,props.order]}
      claim: {kind:render-causes,target:{component:OrderRow},allow:[{kind:props,name:order}]}
      deciding: [{kind:render-event,renderEventId:render:15:172,documentCommitId:15,mountId:mount:12,causes:[{cause:props.onStatusChange,evidence:exact}]},{kind:render-event,renderEventId:render:15:171,documentCommitId:15,mountId:mount:11,causes:[{cause:props.onStatusChange,evidence:exact}]},{kind:render-event,renderEventId:render:15:170,documentCommitId:15,mountId:mount:10,causes:[{cause:props.onStatusChange,evidence:exact}]}]
  2 pass boundaries clean  {caughtDuringWindow:0,caughtAtEnd:0}
      claim: {kind:boundaries-clean,scope:window}
      deciding: [{kind:boundary-log,scope:window,complete:true,afterDocumentCommitId:9}]
      caveats: [uncaught-errors-outside-boundaries-unobserved]
window: {observationId:observation:1,startDocumentCommitId:9,settledDocumentCommitId:17,frozenDocumentCommitId:18,commits:9,settle:{outcome:met,quietMs:500,timeoutMs:10000,waitedMs:967,domains:{react:met,query:met,router:met}},tail:{ms:500,commits:1},environment:{bundle:development,strictMode:on,renderCollection:available,visibility:document}}
! ui-outcome-not-observed: Genie does not check the screen; confirm it with the UI driver
attempt 1 for these claims on this tab
evidence: $ pnpm exec genie-react verify show vfy_c6434521-1454-4087-9d79-40c74da41761 --claim 1 --session art-l5
session: {sessionId:37c13a48-021b-49f9-bb36-bb4281a62b6f,logicalSessionId:91e3ff5f-eb6d-450b-9f23-9632c736dd69,documentGeneration:8}
schemaVersion: "1.0"
exitCode: 1
stage: end
ledger: {fingerprint:cf_f2eb4215c219,scope:logical-session,storage:memory,attempt:1,history:[],codeChangedSincePrevious:null,failsOnSameCode:0}
evidence: {retained:true,tools:[react_get_renders,react_component_cohort,react_list_overrides,query_is_fetching,react_refresh_events,browser_visibility,react_profile_stop,react_render_causes,react_error_state]}
startedAt: 2026-11-19T03:53:58.289Z
endedAt: 2026-11-19T03:54:01.767Z
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
$ git diff -- src/features/orders
diff --git a/apps/realworld-dashboard/src/features/orders/orders-table.tsx b/apps/realworld-dashboard/src/features/orders/orders-table.tsx
index 90c16f4..021e8bd 100644
--- a/apps/realworld-dashboard/src/features/orders/orders-table.tsx
+++ b/apps/realworld-dashboard/src/features/orders/orders-table.tsx
@@ -39,12 +39,13 @@ export function OrdersTable({
     () => ORDER_COLUMNS.filter((column) => !hiddenColumns.includes(column.id)),
     [hiddenColumns],
   )
+  const ordersById = useMemo(() => new Map(rows.map((row) => [row.id, row])), [rows])
   const onStatusChange = useCallback(
     (id: string, status: OrderSummary['status']) => {
-      const order = rows.find((row) => row.id === id)
+      const order = ordersById.get(id)
       if (order) changeStatus({ id, number: order.number, status })
     },
-    [rows, changeStatus],
+    [ordersById, changeStatus],
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
$ npx genie-react verify begin --session art-l5 --name 'put one order on hold' --claim 'render OrderRow only props.order' --claim 'boundaries clean'
recording vfy_3cf3a5e7-d247-468d-bc36-c8893ac3812c "put one order on hold"
  url "http://127.0.0.1:5215/orders?sort=placedAt&dir=desc"
  1 null render OrderRow only props.order  {}
  2 null boundaries clean  {}
window: {observationId:observation:1,startDocumentCommitId:17,domains:[react,query,router],quietMs:500,timeoutMs:10000,tailMs:500}
next: $ pnpm exec genie-react verify end vfy_3cf3a5e7-d247-468d-bc36-c8893ac3812c --session art-l5
session: {sessionId:6a71511f-40db-41c1-8c19-348c89f83aa5,logicalSessionId:91e3ff5f-eb6d-450b-9f23-9632c736dd69,documentGeneration:9}
schemaVersion: "1.0"
targets: [{target:{component:OrderRow},status:resolved,instances:12,source:/src/features/orders/orders-table.tsx}]
startedAt: 2026-11-19T03:54:20.141Z
expiresAt: 2026-11-19T03:59:20.155Z
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
$ npx genie-react verify end vfy_3cf3a5e7-d247-468d-bc36-c8893ac3812c --session art-l5
pass vfy_3cf3a5e7-d247-468d-bc36-c8893ac3812c "put one order on hold"  4 commits, quiet after 738 ms (react, query, router)
  url "http://127.0.0.1:5215/orders?sort=placedAt&dir=desc"
  1 pass render OrderRow only props.order  {renders:0,events:0,violatingEvents:0,causes:[]}
      claim: {kind:render-causes,target:{component:OrderRow},allow:[{kind:props,name:order}]}
      deciding: []
  2 pass boundaries clean  {caughtDuringWindow:0,caughtAtEnd:0}
      claim: {kind:boundaries-clean,scope:window}
      deciding: [{kind:boundary-log,scope:window,complete:true,afterDocumentCommitId:17}]
      caveats: [uncaught-errors-outside-boundaries-unobserved]
window: {observationId:observation:1,startDocumentCommitId:17,settledDocumentCommitId:20,frozenDocumentCommitId:21,commits:4,settle:{outcome:met,quietMs:500,timeoutMs:10000,waitedMs:738,domains:{react:met,query:met,router:met}},tail:{ms:500,commits:1},environment:{bundle:development,strictMode:on,renderCollection:available,visibility:document}}
! ui-outcome-not-observed: Genie does not check the screen; confirm it with the UI driver
attempt 1 for these claims on this tab
evidence: $ pnpm exec genie-react verify show vfy_3cf3a5e7-d247-468d-bc36-c8893ac3812c --session art-l5
session: {sessionId:6a71511f-40db-41c1-8c19-348c89f83aa5,logicalSessionId:91e3ff5f-eb6d-450b-9f23-9632c736dd69,documentGeneration:9}
schemaVersion: "1.0"
exitCode: 0
stage: end
ledger: {fingerprint:cf_deb9542bf6f1,scope:logical-session,storage:memory,attempt:1,history:[],codeChangedSincePrevious:null,failsOnSameCode:0}
evidence: {retained:true,tools:[react_get_renders,react_component_cohort,react_list_overrides,query_is_fetching,react_refresh_events,browser_visibility,react_profile_stop,react_render_causes,react_error_state]}
startedAt: 2026-11-19T03:54:20.141Z
endedAt: 2026-11-19T03:54:23.271Z
request: {budget:{fiberLimit:250,operationLimit:20000,timeLimitMs:8,targetOperationReserve:4000,targetTimeReserveMs:4,adaptive:true},settle:{quietMs:500,timeoutMs:10000},maxDurationMs:300000,allowOverrides:false}
# exit code: 0
```

```console
$ agent-browser --session art-l5 snapshot -i | grep -A4 'Actions for SO-105999'
  - gridcell "Actions for SO-105999" [ref=e471]
    - button "Actions for SO-105999" [expanded=true, ref=e597]
    - menuitem "Put on hold" [disabled, ref=e608]
    - menuitem "Mark shipped" [ref=e609]
    - menuitem "Cancel order" [ref=e610]
  - gridcell "Select SO-105998" [ref=e472]
# exit code: 0
```

```console
$ agent-browser --session art-l5 open 'http://127.0.0.1:5215/orders'
✓ Meridian Ops
  http://127.0.0.1:5215/orders?sort=placedAt&dir=desc
# exit code: 0
```

```console
$ npx genie-react verify begin --session art-l5 --name 'put one order on hold' --claim 'render OrderRow only props.order' --claim 'render OrderRow min 1' --claim 'boundaries clean'
recording vfy_b0ea2304-3805-4fea-86ec-6ca0f600c13b "put one order on hold"
  url "http://127.0.0.1:5215/orders?sort=placedAt&dir=desc"
  1 null render OrderRow only props.order  {}
  2 null render OrderRow min 1  {}
  3 null boundaries clean  {}
window: {observationId:observation:1,startDocumentCommitId:9,domains:[react,query,router],quietMs:500,timeoutMs:10000,tailMs:500}
next: $ pnpm exec genie-react verify end vfy_b0ea2304-3805-4fea-86ec-6ca0f600c13b --session art-l5
session: {sessionId:0f8b3bcc-1552-4a8f-be99-153f0b80211c,logicalSessionId:91e3ff5f-eb6d-450b-9f23-9632c736dd69,documentGeneration:10}
schemaVersion: "1.0"
targets: [{target:{component:OrderRow},status:resolved,instances:12,source:/src/features/orders/orders-table.tsx}]
startedAt: 2026-11-19T03:54:44.179Z
expiresAt: 2026-11-19T03:59:44.191Z
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
$ npx genie-react verify end vfy_b0ea2304-3805-4fea-86ec-6ca0f600c13b --session art-l5
fail vfy_b0ea2304-3805-4fea-86ec-6ca0f600c13b "put one order on hold"  4 commits, quiet after 876 ms (react, query, router)
  url "http://127.0.0.1:5215/orders?sort=placedAt&dir=desc"
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
window: {observationId:observation:1,startDocumentCommitId:9,settledDocumentCommitId:12,frozenDocumentCommitId:13,commits:4,settle:{outcome:met,quietMs:500,timeoutMs:10000,waitedMs:876,domains:{react:met,query:met,router:met}},tail:{ms:500,commits:1},environment:{bundle:development,strictMode:on,renderCollection:available,visibility:document}}
! ui-outcome-not-observed: Genie does not check the screen; confirm it with the UI driver
attempt 3 for these claims on this tab; previous pass vfy_3bbabc5d-9307-4502-943e-97ee8f8849d7; document reloaded since
evidence: $ pnpm exec genie-react verify show vfy_b0ea2304-3805-4fea-86ec-6ca0f600c13b --claim 2 --session art-l5
session: {sessionId:0f8b3bcc-1552-4a8f-be99-153f0b80211c,logicalSessionId:91e3ff5f-eb6d-450b-9f23-9632c736dd69,documentGeneration:10}
schemaVersion: "1.0"
exitCode: 1
stage: end
ledger: {fingerprint:cf_75872ee88939,scope:logical-session,storage:memory,attempt:3,history:[{verificationId:vfy_2dbfa57a-44c7-4efc-b956-475e5f2b3eab,verdict:fail,reasons:[],endedAt:2026-11-19T03:52:52.215Z},{verificationId:vfy_3bbabc5d-9307-4502-943e-97ee8f8849d7,verdict:pass,reasons:[],endedAt:2026-11-19T03:53:25.436Z}],codeChangedSincePrevious:document-reloaded,failsOnSameCode:0}
evidence: {retained:true,tools:[react_get_renders,react_component_cohort,react_list_overrides,query_is_fetching,react_refresh_events,browser_visibility,react_profile_stop,react_render_causes,react_error_state]}
startedAt: 2026-11-19T03:54:44.179Z
endedAt: 2026-11-19T03:54:47.427Z
request: {budget:{fiberLimit:250,operationLimit:20000,timeLimitMs:8,targetOperationReserve:4000,targetTimeReserveMs:4,adaptive:true},settle:{quietMs:500,timeoutMs:10000},maxDurationMs:300000,allowOverrides:false}
# exit code: 1
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
$ npx genie-react verify begin --session art-l5 --name 'put one order on hold' --claim 'render OrderRow only props.order' --claim 'render OrderRow min 1' --claim 'boundaries clean'
recording vfy_f2a5d2cf-60c2-46d7-8cd8-8c10bd255547 "put one order on hold"
  url "http://127.0.0.1:5215/orders?sort=placedAt&dir=desc"
  1 null render OrderRow only props.order  {}
  2 null render OrderRow min 1  {}
  3 null boundaries clean  {}
window: {observationId:observation:1,startDocumentCommitId:8,domains:[react,query,router],quietMs:500,timeoutMs:10000,tailMs:500}
next: $ pnpm exec genie-react verify end vfy_f2a5d2cf-60c2-46d7-8cd8-8c10bd255547 --session art-l5
session: {sessionId:190fcada-d910-4e46-8f8a-055a06230d43,logicalSessionId:91e3ff5f-eb6d-450b-9f23-9632c736dd69,documentGeneration:11}
schemaVersion: "1.0"
targets: [{target:{component:OrderRow},status:resolved,instances:12,source:/src/features/orders/orders-table.tsx}]
startedAt: 2026-11-19T03:54:59.929Z
expiresAt: 2026-11-19T03:59:59.940Z
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
$ npx genie-react verify end vfy_f2a5d2cf-60c2-46d7-8cd8-8c10bd255547 --session art-l5
fail vfy_f2a5d2cf-60c2-46d7-8cd8-8c10bd255547 "put one order on hold"  10 commits, quiet after 924 ms (react, query, router)
  url "http://127.0.0.1:5215/orders?sort=placedAt&dir=desc"
  1 fail render OrderRow only props.order  {renders:24,events:24,violatingEvents:24,causes:[props.onStatusChange,props.order]}
      claim: {kind:render-causes,target:{component:OrderRow},allow:[{kind:props,name:order}]}
      deciding: [{kind:render-event,renderEventId:render:15:175,documentCommitId:15,mountId:mount:12,causes:[{cause:props.onStatusChange,evidence:exact}]},{kind:render-event,renderEventId:render:15:174,documentCommitId:15,mountId:mount:11,causes:[{cause:props.onStatusChange,evidence:exact}]},{kind:render-event,renderEventId:render:15:173,documentCommitId:15,mountId:mount:10,causes:[{cause:props.onStatusChange,evidence:exact}]}]
  2 pass render OrderRow min 1  {renders:24,mounts:0,updates:24,remounts:0,semantics:exact,instances:12,activeInstances:12}
      claim: {kind:renders,target:{component:OrderRow},min:1,counting:renders,allowRemount:false}
      deciding: [{kind:instance,mountId:mount:1,key:o-106000,renders:2,mounts:0,updates:2,mountGeneration:1,latestDocumentCommitId:15,source:/src/features/orders/orders-table.tsx:122:17},{kind:instance,mountId:mount:2,key:o-105999,renders:2,mounts:0,updates:2,mountGeneration:1,latestDocumentCommitId:15,source:/src/features/orders/orders-table.tsx:122:17},{kind:instance,mountId:mount:3,key:o-105998,renders:2,mounts:0,updates:2,mountGeneration:1,latestDocumentCommitId:15,source:/src/features/orders/orders-table.tsx:122:17}]
  3 pass boundaries clean  {caughtDuringWindow:0,caughtAtEnd:0}
      claim: {kind:boundaries-clean,scope:window}
      deciding: [{kind:boundary-log,scope:window,complete:true,afterDocumentCommitId:8}]
      caveats: [uncaught-errors-outside-boundaries-unobserved]
window: {observationId:observation:1,startDocumentCommitId:8,settledDocumentCommitId:17,frozenDocumentCommitId:18,commits:10,settle:{outcome:met,quietMs:500,timeoutMs:10000,waitedMs:924,domains:{react:met,query:met,router:met}},tail:{ms:500,commits:1},environment:{bundle:development,strictMode:on,renderCollection:available,visibility:document}}
! ui-outcome-not-observed: Genie does not check the screen; confirm it with the UI driver
attempt 4 for these claims on this tab; previous fail vfy_b0ea2304-3805-4fea-86ec-6ca0f600c13b; document reloaded since
evidence: $ pnpm exec genie-react verify show vfy_f2a5d2cf-60c2-46d7-8cd8-8c10bd255547 --claim 1 --session art-l5
session: {sessionId:190fcada-d910-4e46-8f8a-055a06230d43,logicalSessionId:91e3ff5f-eb6d-450b-9f23-9632c736dd69,documentGeneration:11}
schemaVersion: "1.0"
exitCode: 1
stage: end
ledger: {fingerprint:cf_75872ee88939,scope:logical-session,storage:memory,attempt:4,history:[{verificationId:vfy_2dbfa57a-44c7-4efc-b956-475e5f2b3eab,verdict:fail,reasons:[],endedAt:2026-11-19T03:52:52.215Z},{verificationId:vfy_3bbabc5d-9307-4502-943e-97ee8f8849d7,verdict:pass,reasons:[],endedAt:2026-11-19T03:53:25.436Z},{verificationId:vfy_b0ea2304-3805-4fea-86ec-6ca0f600c13b,verdict:fail,reasons:[],endedAt:2026-11-19T03:54:47.427Z}],codeChangedSincePrevious:document-reloaded,failsOnSameCode:0}
evidence: {retained:true,tools:[react_get_renders,react_component_cohort,react_list_overrides,query_is_fetching,react_refresh_events,browser_visibility,react_profile_stop,react_render_causes,react_error_state]}
startedAt: 2026-11-19T03:54:59.929Z
endedAt: 2026-11-19T03:55:03.238Z
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
$ npx genie-react verify begin --session art-l5 --name 'put one order on hold' --claim 'render OrderRow only props.order' --claim 'render OrderRow min 1' --claim 'boundaries clean'
recording vfy_21b5da2d-e0e6-4b88-b71f-f68ae510fed2 "put one order on hold"
  url "http://127.0.0.1:5215/orders?sort=placedAt&dir=desc"
  1 null render OrderRow only props.order  {}
  2 null render OrderRow min 1  {}
  3 null boundaries clean  {}
window: {observationId:observation:1,startDocumentCommitId:9,domains:[react,query,router],quietMs:500,timeoutMs:10000,tailMs:500}
next: $ pnpm exec genie-react verify end vfy_21b5da2d-e0e6-4b88-b71f-f68ae510fed2 --session art-l5
session: {sessionId:d54c1509-b8fe-4956-b651-e1460e7f6407,logicalSessionId:91e3ff5f-eb6d-450b-9f23-9632c736dd69,documentGeneration:12}
schemaVersion: "1.0"
targets: [{target:{component:OrderRow},status:resolved,instances:12,source:/src/features/orders/orders-table.tsx}]
startedAt: 2026-11-19T03:55:12.580Z
expiresAt: 2026-11-19T04:00:12.591Z
request: {budget:{fiberLimit:250,operationLimit:20000,timeLimitMs:8,targetOperationReserve:4000,targetTimeReserveMs:4,adaptive:true},settle:{quietMs:500,timeoutMs:10000},maxDurationMs:300000,allowOverrides:false}
# exit code: 0
```

```console
$ agent-browser --session art-l5 click 'button[aria-label="Actions for SO-105999"]'
✓ Done
# exit code: 0
```

```console
$ agent-browser --session art-l5 reload
http://127.0.0.1:5215/orders?sort=placedAt&dir=desc
# exit code: 0
```

```console
$ npx genie-react verify end vfy_21b5da2d-e0e6-4b88-b71f-f68ae510fed2 --session art-l5
refused vfy_21b5da2d-e0e6-4b88-b71f-f68ae510fed2 "put one order on hold"
  url "http://127.0.0.1:5215/orders?sort=placedAt&dir=desc"
  1 refused render OrderRow only props.order  session_changed: The document closed or reloaded during the window.
      observed: {}
      evidence:{},fix:{action:begin-again}
      fix: $ pnpm exec genie-react verify begin --session art-l5 --name 'put one order on hold' --claim 'render OrderRow only props.order' --claim 'render OrderRow min 1' --claim 'boundaries clean'
      claim: {kind:render-causes,target:{component:OrderRow},allow:[{kind:props,name:order}]}
      deciding: []
  2 refused render OrderRow min 1  session_changed: The document closed or reloaded during the window.
      observed: {}
      evidence:{},fix:{action:begin-again}
      fix: $ pnpm exec genie-react verify begin --session art-l5 --name 'put one order on hold' --claim 'render OrderRow only props.order' --claim 'render OrderRow min 1' --claim 'boundaries clean'
      claim: {kind:renders,target:{component:OrderRow},min:1,counting:renders,allowRemount:false}
      deciding: []
  3 refused boundaries clean  session_changed: The document closed or reloaded during the window.
      observed: {}
      evidence:{},fix:{action:begin-again}
      fix: $ pnpm exec genie-react verify begin --session art-l5 --name 'put one order on hold' --claim 'render OrderRow only props.order' --claim 'render OrderRow min 1' --claim 'boundaries clean'
      claim: {kind:boundaries-clean,scope:window}
      deciding: []
  window session_changed: The document closed or reloaded during the window.
    guard:same-document
    evidence:{},fix:{action:begin-again}
    fix: $ pnpm exec genie-react verify begin --session art-l5 --name 'put one order on hold' --claim 'render OrderRow only props.order' --claim 'render OrderRow min 1' --claim 'boundaries clean'
window: {observationId:observation:1,startDocumentCommitId:9}
! ui-outcome-not-observed: Genie does not check the screen; confirm it with the UI driver
attempt 5 for these claims on this tab; previous fail vfy_f2a5d2cf-60c2-46d7-8cd8-8c10bd255547; document reloaded since
evidence: $ pnpm exec genie-react verify show vfy_21b5da2d-e0e6-4b88-b71f-f68ae510fed2 --claim 1 --session art-l5
session: {sessionId:d54c1509-b8fe-4956-b651-e1460e7f6407,logicalSessionId:91e3ff5f-eb6d-450b-9f23-9632c736dd69,documentGeneration:12}
schemaVersion: "1.0"
exitCode: 4
stage: end
ledger: {fingerprint:cf_75872ee88939,scope:logical-session,storage:memory,attempt:5,history:[{verificationId:vfy_2dbfa57a-44c7-4efc-b956-475e5f2b3eab,verdict:fail,reasons:[],endedAt:2026-11-19T03:52:52.215Z},{verificationId:vfy_3bbabc5d-9307-4502-943e-97ee8f8849d7,verdict:pass,reasons:[],endedAt:2026-11-19T03:53:25.436Z},{verificationId:vfy_b0ea2304-3805-4fea-86ec-6ca0f600c13b,verdict:fail,reasons:[],endedAt:2026-11-19T03:54:47.427Z},{verificationId:vfy_f2a5d2cf-60c2-46d7-8cd8-8c10bd255547,verdict:fail,reasons:[],endedAt:2026-11-19T03:55:03.238Z}],codeChangedSincePrevious:document-reloaded,failsOnSameCode:0}
evidence: {retained:false,tools:[]}
startedAt: 2026-11-19T03:55:12.580Z
endedAt: 2026-11-19T03:55:15.054Z
request: {budget:{fiberLimit:250,operationLimit:20000,timeLimitMs:8,targetOperationReserve:4000,targetTimeReserveMs:4,adaptive:true},settle:{quietMs:500,timeoutMs:10000},maxDurationMs:300000,allowOverrides:false}
# exit code: 4
```

```console
$ npx genie-react verify begin --session art-l5 --name 'open search' --claim 'effect CommandPalette max 1' --claim 'render CommandPalette min 1'
recording vfy_8766d2c9-f8aa-4fc5-8f27-098b9a3ceee9 "open search"
  url "http://127.0.0.1:5215/orders?sort=placedAt&dir=desc"
  1 null effect CommandPalette max 1  {}
  2 null render CommandPalette min 1  {}
window: {observationId:observation:1,startDocumentCommitId:44,domains:[react,query,router],quietMs:500,timeoutMs:10000,tailMs:500}
next: $ pnpm exec genie-react verify end vfy_8766d2c9-f8aa-4fc5-8f27-098b9a3ceee9 --session art-l5
session: {sessionId:47de04cf-4220-48fc-a359-b1616afeba0c,logicalSessionId:91e3ff5f-eb6d-450b-9f23-9632c736dd69,documentGeneration:13}
schemaVersion: "1.0"
targets: [{target:{component:CommandPalette},status:pending,instances:0}]
startedAt: 2026-11-19T03:55:50.855Z
expiresAt: 2026-11-19T04:00:50.861Z
request: {budget:{fiberLimit:250,operationLimit:20000,timeLimitMs:8,targetOperationReserve:4000,targetTimeReserveMs:4,adaptive:true},settle:{quietMs:500,timeoutMs:10000},maxDurationMs:300000,allowOverrides:false}
# exit code: 0
```

```console
$ agent-browser --session art-l5 find role button click --name 'Search orders, customers, products…'
✓ Done
# exit code: 0
```

```console
$ agent-browser --session art-l5 wait 1000
✓ Done
# exit code: 0
```

```console
$ npx genie-react verify end vfy_8766d2c9-f8aa-4fc5-8f27-098b9a3ceee9 --session art-l5
inconclusive vfy_8766d2c9-f8aa-4fc5-8f27-098b9a3ceee9 "open search"  4 commits, quiet after 790 ms (react, query, router)
  url "http://127.0.0.1:5215/orders?sort=placedAt&dir=desc"
  1 inconclusive effect CommandPalette max 1  strict_mode_replay: The raw count exceeds 1 only by StrictMode's development replay of a fresh mount, which a production build does not run.
      observed: {effects:[{effectIndex:0,runs:1,rawRuns:2},{effectIndex:1,runs:1,rawRuns:2}]}
      evidence:{effectIndexes:[0,1]}
      claim: {kind:effect-runs,target:{component:CommandPalette},max:1}
      deciding: []
  2 pass render CommandPalette min 1  {renders:1,mounts:1,updates:0,remounts:0,semantics:exact,instances:1,activeInstances:1}
      claim: {kind:renders,target:{component:CommandPalette},min:1,counting:renders,allowRemount:false}
      deciding: [{kind:instance,mountId:mount:1,renders:1,mounts:1,updates:0,mountGeneration:1,latestDocumentCommitId:45,source:/src/layout/app-shell.tsx:44:23}]
window: {observationId:observation:1,startDocumentCommitId:44,settledDocumentCommitId:47,frozenDocumentCommitId:48,commits:4,settle:{outcome:met,quietMs:500,timeoutMs:10000,waitedMs:790,domains:{react:met,query:met,router:met}},tail:{ms:500,commits:1},environment:{bundle:development,strictMode:on,renderCollection:available,visibility:document}}
! ui-outcome-not-observed: Genie does not check the screen; confirm it with the UI driver
attempt 1 for these claims on this tab
evidence: $ pnpm exec genie-react verify show vfy_8766d2c9-f8aa-4fc5-8f27-098b9a3ceee9 --claim 1 --session art-l5
session: {sessionId:47de04cf-4220-48fc-a359-b1616afeba0c,logicalSessionId:91e3ff5f-eb6d-450b-9f23-9632c736dd69,documentGeneration:13}
schemaVersion: "1.0"
exitCode: 5
stage: end
ledger: {fingerprint:cf_91ed9ca885f6,scope:logical-session,storage:memory,attempt:1,history:[],codeChangedSincePrevious:null,failsOnSameCode:0}
evidence: {retained:true,tools:[react_get_renders,react_component_cohort,react_list_overrides,query_is_fetching,react_refresh_events,browser_visibility,react_profile_stop,react_effect_timeline,react_effect_audit]}
startedAt: 2026-11-19T03:55:50.855Z
endedAt: 2026-11-19T03:55:53.522Z
request: {budget:{fiberLimit:250,operationLimit:20000,timeLimitMs:8,targetOperationReserve:4000,targetTimeReserveMs:4,adaptive:true},settle:{quietMs:500,timeoutMs:10000},maxDurationMs:300000,allowOverrides:false}
# exit code: 5
```

```console
$ agent-browser --session art-l5 open 'http://127.0.0.1:5215/orders'
✓ Meridian Ops
  http://127.0.0.1:5215/orders?sort=placedAt&dir=desc
# exit code: 0
```

```console
$ npx genie-react verify begin --session art-l5 --name 'put one order on hold' --claim 'render OrderRow only props.order' --claim 'boundaries clean'
recording vfy_d1ccc920-0e7e-4a55-be8e-23c38452a555 "put one order on hold"
  url "http://127.0.0.1:5215/orders?sort=placedAt&dir=desc"
  1 null render OrderRow only props.order  {}
  2 null boundaries clean  {}
window: {observationId:observation:1,startDocumentCommitId:8,domains:[react,query,router],quietMs:500,timeoutMs:10000,tailMs:500}
next: $ pnpm exec genie-react verify end vfy_d1ccc920-0e7e-4a55-be8e-23c38452a555 --session art-l5
session: {sessionId:7a1bdd88-8d89-41cb-85a7-48808a6ea4da,logicalSessionId:91e3ff5f-eb6d-450b-9f23-9632c736dd69,documentGeneration:14}
schemaVersion: "1.0"
targets: [{target:{component:OrderRow},status:resolved,instances:12,source:/src/features/orders/orders-table.tsx}]
startedAt: 2026-11-19T03:56:04.703Z
expiresAt: 2026-11-19T04:01:04.714Z
request: {budget:{fiberLimit:250,operationLimit:20000,timeLimitMs:8,targetOperationReserve:4000,targetTimeReserveMs:4,adaptive:true},settle:{quietMs:500,timeoutMs:10000},maxDurationMs:300000,allowOverrides:false}
# exit code: 0
```

```console
$ npx genie-react verify end vfy_d1ccc920-0e7e-4a55-be8e-23c38452a555 --session art-l5
pass vfy_d1ccc920-0e7e-4a55-be8e-23c38452a555 "put one order on hold"  2 commits, quiet after 714 ms (react, query, router)
  url "http://127.0.0.1:5215/orders?sort=placedAt&dir=desc"
  1 pass render OrderRow only props.order  {renders:0,events:0,violatingEvents:0,causes:[]}
      claim: {kind:render-causes,target:{component:OrderRow},allow:[{kind:props,name:order}]}
      deciding: []
  2 pass boundaries clean  {caughtDuringWindow:0,caughtAtEnd:0}
      claim: {kind:boundaries-clean,scope:window}
      deciding: [{kind:boundary-log,scope:window,complete:true,afterDocumentCommitId:8}]
      caveats: [uncaught-errors-outside-boundaries-unobserved]
window: {observationId:observation:1,startDocumentCommitId:8,settledDocumentCommitId:9,frozenDocumentCommitId:10,commits:2,settle:{outcome:met,quietMs:500,timeoutMs:10000,waitedMs:714,domains:{react:met,query:met,router:met}},tail:{ms:500,commits:1},environment:{bundle:development,strictMode:on,renderCollection:available,visibility:document}}
! ui-outcome-not-observed: Genie does not check the screen; confirm it with the UI driver
attempt 2 for these claims on this tab; previous pass vfy_3cf3a5e7-d247-468d-bc36-c8893ac3812c; document reloaded since
evidence: $ pnpm exec genie-react verify show vfy_d1ccc920-0e7e-4a55-be8e-23c38452a555 --session art-l5
session: {sessionId:7a1bdd88-8d89-41cb-85a7-48808a6ea4da,logicalSessionId:91e3ff5f-eb6d-450b-9f23-9632c736dd69,documentGeneration:14}
schemaVersion: "1.0"
exitCode: 0
stage: end
ledger: {fingerprint:cf_deb9542bf6f1,scope:logical-session,storage:memory,attempt:2,history:[{verificationId:vfy_3cf3a5e7-d247-468d-bc36-c8893ac3812c,verdict:pass,reasons:[],endedAt:2026-11-19T03:54:23.271Z}],codeChangedSincePrevious:document-reloaded,failsOnSameCode:0}
evidence: {retained:true,tools:[react_get_renders,react_component_cohort,react_list_overrides,query_is_fetching,react_refresh_events,browser_visibility,react_profile_stop,react_render_causes,react_error_state]}
startedAt: 2026-11-19T03:56:04.703Z
endedAt: 2026-11-19T03:56:06.214Z
request: {budget:{fiberLimit:250,operationLimit:20000,timeLimitMs:8,targetOperationReserve:4000,targetTimeReserveMs:4,adaptive:true},settle:{quietMs:500,timeoutMs:10000},maxDurationMs:300000,allowOverrides:false}
# exit code: 0
```

```console
$ npx genie-react verify show vfy_d1ccc920-0e7e-4a55-be8e-23c38452a555 --section raw:react_get_renders --session art-l5
verificationId: vfy_d1ccc920-0e7e-4a55-be8e-23c38452a555
section: raw:react_get_renders
results[3]:
  each: {status:ok,tool:react_get_renders,args:{sort:renders,appOnly:false},result:{renderCollection:available,bundle:development,timingsBundleDependent:true,countsScope:observed-run,attribution:{status:current},summary:{referenceOnlyPropComponents:0,topReferenceOnlyProps:[],coverageDomain:render-measurement},sourceClassification:{complete:true,affects:ownership-labels,unknown:0,unknownComponents:[],unknownComponentsOmitted:0},nextCursor:null,pagination:{offset:0},coverage:{skippedCommitFibers:0,droppedUnmountFibers:0,analysisFailedFibers:0,pausedCommits:0,refreshCommitsExcluded:0,truncatedInputFibers:0,propsNotEnumeratedFibers:0,budgetExhaustedCommits:0,budgetExhaustedSubsystems:[],coverageDomain:render-causality}}}
  - {args:{limit:1,includeCursor:false},capturedAt:2026-11-19T03:56:04.703Z,durationMs:2,result:{tracking:false,commits:0,documentCommitId:8,observation:null,attribution:{startedAtDocumentCommitId:8,completedAtDocumentCommitId:8,startedAtAnalysisGeneration:8,completedAtAnalysisGeneration:8},view:summary,summary:{commits:0,trackedComponents:0,totalRenders:0,totalUpdates:0,noObservedInputChangeComponents:0,semantics:unknown},components:[],sourceClassification:{totalCandidates:0,evaluated:0,app:0,library:0},omittedByLimit:0,pagination:{snapshotId:null,totalComponents:0,expiresAt:null},comparable:false,notComparableReasons:[commits-not-observed],coverage:{unobservedCommits:8,incompleteBecause:[{reason:commits-not-observed,fibers:0,detail:"8 commits happened while no render window, profile, measurement or timeline was open. Genie analyses renders and effects only while one is open, so nothing from those commits is recorded.",next:"Open a window with react_clear_renders (or devtools_interaction_begin), repeat the interaction, then read again. To observe a page load, load the page with _genie_observe in its URL."}],complete:false,inputAttributionComplete:false,semantics:lower-bound}}}
  - {args:{limit:1,includeCursor:false},capturedAt:2026-11-19T03:56:06.202Z,durationMs:1,result:{tracking:true,commits:2,documentCommitId:10,observation:{id:observation:1,epoch:1,startedAfterDocumentCommitId:8},attribution:{startedAtDocumentCommitId:10,completedAtDocumentCommitId:10,startedAtAnalysisGeneration:11,completedAtAnalysisGeneration:11},view:summary,summary:{commits:2,trackedComponents:3,totalRenders:6,totalUpdates:6,noObservedInputChangeComponents:2,semantics:exact},components:[{id:4408263835719,name:SyncStatus,mountId:mount:13,renders:2,updates:2,selfTime:0.1,totalTime:0.3,cumulativeSelfTime:0.2,cumulativeTotalTime:0.6,latestDocumentCommitId:10,causeCounts:{state:2},causes:[{kind:state,evidence:exact,name:"state[0]"}],necessity:necessary,necessityReason:dom-changed,inputEvidence:changed,source:{location:/src/features/orders/orders-page.tsx:50:11,role:element-callsite,ownership:app}}],sourceClassification:{totalCandidates:3,evaluated:3,app:1,library:2},omittedByLimit:2,pagination:{snapshotId:null,totalComponents:3,expiresAt:null},comparable:true,notComparableReasons:[],coverage:{unobservedCommits:0,complete:true,inputAttributionComplete:true,semantics:exact}}}
  - {args:{nameFilter:OrderRow,limit:200,view:full},capturedAt:2026-11-19T03:56:06.204Z,durationMs:1,result:{tracking:false,commits:2,documentCommitId:10,observation:{id:observation:1,epoch:1,startedAfterDocumentCommitId:8},attribution:{startedAtDocumentCommitId:10,completedAtDocumentCommitId:10,startedAtAnalysisGeneration:11,completedAtAnalysisGeneration:11},view:full,summary:{commits:2,trackedComponents:0,totalRenders:0,totalUpdates:0,unstableComponents:0,unnecessaryComponents:0,noObservedInputChangeComponents:0,topUnstableProps:[],semantics:exact},components:[],sourceClassification:{totalCandidates:0,evaluated:0,app:0,library:0},omittedByLimit:0,pagination:{snapshotId:935b2d95-f307-4baf-8bd0-917aca41fb9f,totalComponents:0,expiresAt:1795060866204},comparable:true,notComparableReasons:[],coverage:{unobservedCommits:0,complete:true,inputAttributionComplete:true,semantics:exact}}}
# exit code: 0
```

```console
$ git checkout -- src/features/orders/orders-table.tsx && git status --short -- .
## t3/articles-verify-proof
# exit code: 0
```
