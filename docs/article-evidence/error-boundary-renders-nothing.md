# Evidence: error-boundary-renders-nothing

- Date: 2026-11-19
- Commit: `6867352ba46ec3998fe8cda0ba915536fddfa666` (`git rev-parse HEAD`)
- App: `evals/fixture-app` (React 19.2.7, TanStack Query 5, Vite 8 with the `genie()` plugin), the `account` screen at http://localhost:5214/?screen=account
- Genie: `@genie-react/cli` 1.0.2 and `genie-react` 1.0.2 from this checkout (`pnpm install && pnpm build`)
- Driver: agent-browser 0.39.1, session `art-l4`
- Bug: the `account` screen of the eval fixture, answer key in [`evals/tasks/error-boundary-hidden.json`](../../evals/tasks/error-boundary-hidden.json) and [`evals/tasks/error-boundary-hidden-fix.json`](../../evals/tasks/error-boundary-hidden-fix.json)

Every block below is the full output of the command, followed by its exit code. Commands run from `evals/fixture-app`. Two commands pipe their output through `grep` or `--select`, as shown in the command line.

Not reproduced here: two exploratory verify runs I made before the main run to pick the verify interaction. A verify window around `query_refetch` on the shipped code failed on `boundaries clean`. With the `formatLocation` fix applied, a verify window around `query_reset` passed. The article quotes none of their output.

## Server

```console
$ cd evals/fixture-app
$ pnpm exec vite --port 5214 --strictPort
  VITE v8.1.5  ready in 1404 ms

  ➜  Local:   http://localhost:5214/
  ➜  Network: use --host to expose
[genie] bridge ready at ws://[::1]:5214/__genie/ws
```

## Before the fix
```console
$ agent-browser --session art-l4 open 'http://localhost:5214/?screen=account'
✓ Acme Console
  http://localhost:5214/?screen=account
[exit 0]
```

```console
$ npx genie-react status --session art-l4 --wait 15000 --select /ready
status: ok
selection: {expression:/ready,matchedPathCount:1,matchedPaths:[/ready],omittedPathCount:50}
result: true
[exit 0]
```

```console
$ agent-browser --session art-l4 get text '[aria-label=Profile]'
Profile
[exit 0]
```

```console
$ agent-browser --session art-l4 screenshot /tmp/art-l4-ev/eb-before.png
✓ Screenshot saved to /tmp/art-l4-ev/eb-before.png
[exit 0]
```

```console
$ npx genie-react call react_error_state '{}' --session art-l4
caughtErrors[1]:
  - {boundaryId:618441736212,boundaryName:CardBody,boundaryKind:error-boundary,boundarySource:{file:/src/screens/account/AccountScreen.tsx,line:10,column:9,functionName:AccountScreen,sourceMapConfidence:mapped,role:element-callsite},sourceOwnership:unknown,throwingComponent:ProfileDetails,message:"Cannot read properties of undefined (reading 'city')",stack:"TypeError: Cannot read properties of undefined (reading 'city')
    at formatLocation (http://localhost:5214/src/screens/account/ProfileDetails.tsx:8:20)
    at ProfileDetails (http://localhost:5214/src/screens/account/ProfileDetails.tsx:47:45)
    at Object.react_stack_bottom_frame (http://localhost:5214/.vite/deps/react-dom_client.js?v=611eef11:12904:12)
    at renderWithHooks (http://localhost:5214/.vite/deps/react-dom_client.js?v=611eef11:4235:19)
    at updateFunctionComponent (http://localhost:5214/.vite/deps/react-dom_client.js?v=611eef11:5607:16)
    at beginWork (http://localhost:5214/.vite/deps/react-dom_client.js?v=611eef11:6178:20)
    at runWithFiberInDEV (http://localhost:5214/.vite/deps/react-dom_client.js?v=611eef11:852:66)
    at performUnitOfWork (http://localhost:5214/.vite/deps/react-dom_client.js?v=611eef11:8467:92)
    at workLoopSync (http://localhost:5214/.vite/deps/react-dom_client.js?v=611eef11:8363:37)
    at renderRootSync (http://localhost:5214/.vite/deps/react-dom_client.js?v=611eef11:8347:6)",stackFrames:[{functionName:formatLocation,file:/src/screens/account/ProfileDetails.tsx,line:6,column:21,isLibrary:false,mapping:mapped},{functionName:ProfileDetails,file:/src/screens/account/ProfileDetails.tsx,line:19,column:12,isLibrary:false,mapping:mapped},{functionName:Object.react_stack_bottom_frame,file:/node_modules/.pnpm/react-dom@19.2.7_react@19.2.7/node_modules/react-dom/cjs/react-dom-client.development.js,line:25904,column:20,isLibrary:true,mapping:mapped},{functionName:renderWithHooks,file:/node_modules/.pnpm/react-dom@19.2.7_react@19.2.7/node_modules/react-dom/cjs/react-dom-client.development.js,line:7662,column:22,isLibrary:true,mapping:mapped},{functionName:updateFunctionComponent,file:/node_modules/.pnpm/react-dom@19.2.7_react@19.2.7/node_modules/react-dom/cjs/react-dom-client.development.js,line:10166,column:19,isLibrary:true,mapping:mapped},{functionName:beginWork,file:/node_modules/.pnpm/react-dom@19.2.7_react@19.2.7/node_modules/react-dom/cjs/react-dom-client.development.js,line:11778,column:18,isLibrary:true,mapping:mapped},{functionName:runWithFiberInDEV,file:/node_modules/.pnpm/react-dom@19.2.7_react@19.2.7/node_modules/react-dom/cjs/react-dom-client.development.js,line:871,column:30,isLibrary:true,mapping:mapped},{functionName:performUnitOfWork,file:/node_modules/.pnpm/react-dom@19.2.7_react@19.2.7/node_modules/react-dom/cjs/react-dom-client.development.js,line:17641,column:22,isLibrary:true,mapping:mapped},{functionName:workLoopSync,file:/node_modules/.pnpm/react-dom@19.2.7_react@19.2.7/node_modules/react-dom/cjs/react-dom-client.development.js,line:17469,column:41,isLibrary:true,mapping:mapped},{functionName:renderRootSync,file:/node_modules/.pnpm/react-dom@19.2.7_react@19.2.7/node_modules/react-dom/cjs/react-dom-client.development.js,line:17450,column:11,isLibrary:true,mapping:mapped}],isLibraryBoundary:false,forced:false,status:active,statusReason:state-unchanged-since-catch,rendered:{output:nothing,hostNodes:0,text:null}}
suspended: []
blankTreeHint: "error boundary <CardBody> at /src/screens/account/AccountScreen.tsx:10 caught \"Cannot read properties of undefined (reading 'city')\" thrown by <ProfileDetails> — its children did not render and it renders nothing in its place, so the failure is invisible on screen"
ownershipCoverage: {complete:false,totalCandidates:1,app:0,library:0,unknown:1}
scanTruncated: false
[exit 0]
```

```console
$ agent-browser --session art-l4 open 'http://localhost:5214/?screen=account'
✓ Acme Console
  http://localhost:5214/?screen=account
[exit 0]
```

```console
$ agent-browser --session art-l4 wait 1500
✓ Done
[exit 0]
```

```console
$ agent-browser --session art-l4 get text '[aria-label=Profile]'
Profile
[exit 0]
```

```console
$ npx genie-react verify begin --session art-l4 --name 'reload profile' --claim 'render ProfileDetails min 1' --claim 'boundaries clean'
recording vfy_37503d24-ee87-4f74-8b63-9db78130034f "reload profile"
  url "http://localhost:5214/?screen=account"
  1 null render ProfileDetails min 1  {}
  2 null boundaries clean  {}
window: {observationId:observation:1,startDocumentCommitId:2,domains:[react,query],quietMs:500,timeoutMs:10000,tailMs:500}
next: $ pnpm exec genie-react verify end vfy_37503d24-ee87-4f74-8b63-9db78130034f --session art-l4
session: {sessionId:99cb4a88-32ec-48b4-9486-8381f90524b4,logicalSessionId:3f2fa767-cbe2-4ca6-b345-c98b8eddc899,documentGeneration:5}
schemaVersion: "1.0"
targets: [{target:{component:ProfileDetails},status:pending,instances:0}]
startedAt: 2026-11-19T03:59:32.735Z
expiresAt: 2026-11-19T04:04:32.740Z
request: {budget:{fiberLimit:250,operationLimit:20000,timeLimitMs:8,targetOperationReserve:4000,targetTimeReserveMs:4,adaptive:true},settle:{quietMs:500,timeoutMs:10000},maxDurationMs:300000,allowOverrides:false}
[exit 0]
```

```console
$ npx genie-react call query_reset '{"queryKey":["profile"]}' --session art-l4
ok: true
matched: 1
[exit 0]
```

```console
$ npx genie-react verify end vfy_37503d24-ee87-4f74-8b63-9db78130034f --session art-l4
fail vfy_37503d24-ee87-4f74-8b63-9db78130034f "reload profile"  0 commits, quiet after 610 ms (react, query)
  url "http://localhost:5214/?screen=account"
  1 refused render ProfileDetails min 1  target_not_found: No ProfileDetails instance was mounted at begin or rendered in the window; a target Genie cannot see is not a target that did nothing.
      observed: {renders:0,mounts:0,updates:0,remounts:0,semantics:exact,instances:0,activeInstances:0}
      evidence:{pendingAtBegin:true},fix:{action:find-target,component:ProfileDetails}
      fix: $ pnpm exec genie-react call react_find_components '{"query":"ProfileDetails"}' --session art-l4
      claim: {kind:renders,target:{component:ProfileDetails},min:1,counting:renders,allowRemount:false}
      deciding: []
  2 fail boundaries clean  {caughtDuringWindow:0,caughtAtEnd:1}
      claim: {kind:boundaries-clean,scope:window}
      deciding: [{kind:boundary-at-end,boundary:CardBody,boundaryKind:error-boundary,message:"Cannot read properties of undefined (reading 'city')"}]
      caveats: [uncaught-errors-outside-boundaries-unobserved]
  window no_activity: No React commit happened in the window; the interaction did not reach this tab or did not change React state.
    guard:activity
    evidence:{startDocumentCommitId:2,frozenDocumentCommitId:2,commits:0},fix:{action:drive-observed-tab,url:"http://localhost:5214/?screen=account"}
    fix: $ pnpm exec genie-react verify begin --session art-l4 --name 'reload profile' --claim 'render ProfileDetails min 1' --claim 'boundaries clean'
window: {observationId:observation:1,startDocumentCommitId:2,settledDocumentCommitId:2,frozenDocumentCommitId:2,commits:0,settle:{outcome:met,quietMs:500,timeoutMs:10000,waitedMs:610,domains:{react:met,query:met}},tail:{ms:500,commits:0},environment:{bundle:development,strictMode:on,renderCollection:available,visibility:document}}
! ui-outcome-not-observed: Genie does not check the screen; confirm it with the UI driver
attempt 2 for these claims on this tab; previous fail vfy_c95714e2-a682-4f7f-a76a-69323719501d (target_not_found); document reloaded since
evidence: $ pnpm exec genie-react verify show vfy_37503d24-ee87-4f74-8b63-9db78130034f --claim 1 --session art-l4
session: {sessionId:99cb4a88-32ec-48b4-9486-8381f90524b4,logicalSessionId:3f2fa767-cbe2-4ca6-b345-c98b8eddc899,documentGeneration:5}
schemaVersion: "1.0"
exitCode: 1
stage: end
ledger: {fingerprint:cf_51bc07c58c4b,scope:logical-session,storage:memory,attempt:2,history:[{verificationId:vfy_c95714e2-a682-4f7f-a76a-69323719501d,verdict:fail,reasons:[target_not_found],endedAt:2026-11-19T03:59:03.432Z}],codeChangedSincePrevious:document-reloaded,failsOnSameCode:0}
evidence: {retained:true,tools:[react_get_renders,react_component_cohort,react_list_overrides,query_is_fetching,react_refresh_events,browser_visibility,react_profile_stop,react_error_state]}
startedAt: 2026-11-19T03:59:32.735Z
endedAt: 2026-11-19T03:59:37.791Z
request: {budget:{fiberLimit:250,operationLimit:20000,timeLimitMs:8,targetOperationReserve:4000,targetTimeReserveMs:4,adaptive:true},settle:{quietMs:500,timeoutMs:10000},maxDurationMs:300000,allowOverrides:false}
[exit 1]
```

## After the formatLocation fix
```console
$ git diff
diff --git a/evals/fixture-app/src/screens/account/ProfileDetails.tsx b/evals/fixture-app/src/screens/account/ProfileDetails.tsx
index c4b0ec2..18ee618 100644
--- a/evals/fixture-app/src/screens/account/ProfileDetails.tsx
+++ b/evals/fixture-app/src/screens/account/ProfileDetails.tsx
@@ -1,9 +1,8 @@
 import { useQuery } from '@tanstack/react-query'
 import { api, type Profile } from '../../api'
 
-function formatLocation(profile: Profile): string {
-  const address = profile.address as NonNullable<Profile['address']>
-  return `${address.city}, ${address.country}`
+function formatLocation({ address }: Profile): string {
+  return address ? `${address.city}, ${address.country}` : 'Not provided'
 }
 
 export function ProfileDetails() {
[exit 0]
```

```console
$ agent-browser --session art-l4 open 'http://localhost:5214/?screen=account'
✓ Acme Console
  http://localhost:5214/?screen=account
[exit 0]
```

```console
$ agent-browser --session art-l4 wait 1500
✓ Done
[exit 0]
```

```console
$ agent-browser --session art-l4 get text '[aria-label=Profile]'
Profile
Name
Dana Whitfield
Email
dana@example.com
Location
Not provided
[exit 0]
```

```console
$ npx genie-react verify begin --session art-l4 --name 'reload profile' --claim 'render ProfileDetails min 1' --claim 'boundaries clean'
recording vfy_69fd1a1a-0834-4da3-a956-145e7a243e5f "reload profile"
  url "http://localhost:5214/?screen=account"
  1 null render ProfileDetails min 1  {}
  2 null boundaries clean  {}
window: {observationId:observation:1,startDocumentCommitId:2,domains:[react,query],quietMs:500,timeoutMs:10000,tailMs:500}
next: $ pnpm exec genie-react verify end vfy_69fd1a1a-0834-4da3-a956-145e7a243e5f --session art-l4
session: {sessionId:b2ec83bd-41ae-4e17-a61d-cab37474d917,logicalSessionId:3f2fa767-cbe2-4ca6-b345-c98b8eddc899,documentGeneration:6}
schemaVersion: "1.0"
targets: [{target:{component:ProfileDetails},status:resolved,instances:1,source:/src/screens/account/AccountScreen.tsx}]
startedAt: 2026-11-19T03:59:48.326Z
expiresAt: 2026-11-19T04:04:48.334Z
request: {budget:{fiberLimit:250,operationLimit:20000,timeLimitMs:8,targetOperationReserve:4000,targetTimeReserveMs:4,adaptive:true},settle:{quietMs:500,timeoutMs:10000},maxDurationMs:300000,allowOverrides:false}
[exit 0]
```

```console
$ npx genie-react call query_reset '{"queryKey":["profile"]}' --session art-l4
ok: true
matched: 1
[exit 0]
```

```console
$ npx genie-react verify end vfy_69fd1a1a-0834-4da3-a956-145e7a243e5f --session art-l4
pass vfy_69fd1a1a-0834-4da3-a956-145e7a243e5f "reload profile"  2 commits, quiet after 612 ms (react, query)
  url "http://localhost:5214/?screen=account"
  1 pass render ProfileDetails min 1  {renders:2,mounts:0,updates:2,remounts:0,semantics:exact,instances:1,activeInstances:1}
      claim: {kind:renders,target:{component:ProfileDetails},min:1,counting:renders,allowRemount:false}
      deciding: [{kind:instance,mountId:mount:1,renders:2,mounts:0,updates:2,mountGeneration:1,latestDocumentCommitId:4,source:/src/screens/account/AccountScreen.tsx:11:11}]
  2 pass boundaries clean  {caughtDuringWindow:0,caughtAtEnd:0}
      claim: {kind:boundaries-clean,scope:window}
      deciding: [{kind:boundary-log,scope:window,complete:true,afterDocumentCommitId:2}]
      caveats: [uncaught-errors-outside-boundaries-unobserved]
window: {observationId:observation:1,startDocumentCommitId:2,settledDocumentCommitId:4,frozenDocumentCommitId:4,commits:2,settle:{outcome:met,quietMs:500,timeoutMs:10000,waitedMs:612,domains:{react:met,query:met}},tail:{ms:500,commits:0},environment:{bundle:development,strictMode:on,renderCollection:available,visibility:document}}
! ui-outcome-not-observed: Genie does not check the screen; confirm it with the UI driver
attempt 2 for these claims on this tab; previous pass vfy_b52c59db-6526-42da-9d6f-9c9e666c52f7; document reloaded since
evidence: $ pnpm exec genie-react verify show vfy_69fd1a1a-0834-4da3-a956-145e7a243e5f --session art-l4
session: {sessionId:b2ec83bd-41ae-4e17-a61d-cab37474d917,logicalSessionId:3f2fa767-cbe2-4ca6-b345-c98b8eddc899,documentGeneration:6}
schemaVersion: "1.0"
exitCode: 0
stage: end
ledger: {fingerprint:cf_094410ac491b,scope:logical-session,storage:memory,attempt:2,history:[{verificationId:vfy_b52c59db-6526-42da-9d6f-9c9e666c52f7,verdict:pass,reasons:[],endedAt:2026-11-19T03:59:22.964Z}],codeChangedSincePrevious:document-reloaded,failsOnSameCode:0}
evidence: {retained:true,tools:[react_get_renders,react_component_cohort,react_list_overrides,query_is_fetching,react_refresh_events,browser_visibility,react_profile_stop,react_error_state]}
startedAt: 2026-11-19T03:59:48.326Z
endedAt: 2026-11-19T03:59:54.501Z
request: {budget:{fiberLimit:250,operationLimit:20000,timeLimitMs:8,targetOperationReserve:4000,targetTimeReserveMs:4,adaptive:true},settle:{quietMs:500,timeoutMs:10000},maxDurationMs:300000,allowOverrides:false}
[exit 0]
```

```console
$ agent-browser --session art-l4 get text '[aria-label=Profile]'
Profile
Name
Dana Whitfield
Email
dana@example.com
Location
Not provided
[exit 0]
```

## Force the boundary after the formatLocation fix
```console
$ npx genie-react call react_find_components '{"query":"ProfileDetails","exact":true}' --session art-l4
matches[1]:
  - {id:7154375327765,name:ProfileDetails,path:"QueryClientProvider > App > AccountScreen > CardBody > ProfileDetails",kind:function,props:{},source:{file:/src/screens/account/AccountScreen.tsx,line:11,column:11,functionName:AccountScreen,sourceMapConfidence:mapped,role:element-callsite},isLibrary:false}
ownershipCoverage: {complete:true,totalCandidates:1,app:1,library:0,unknown:0}
omittedByLimit: 0
scanTruncated: false
nextCursor: null
unmountedSinceSearch: 0
[exit 0]
```

```console
$ npx genie-react call react_force_error_boundary '{"id":7154375327765,"forceError":true}' --session art-l4
ok: true
boundaryId: 7154375327764
boundaryName: CardBody
erroring: true
activeOverrides: 1
[exit 0]
```

```console
$ agent-browser --session art-l4 get text '[aria-label=Profile]'
Profile
[exit 0]
```

```console
$ npx genie-react call react_error_state '{"includeSource":false}' --session art-l4
caughtErrors[1]:
  - {boundaryId:7154375327764,boundaryName:CardBody,boundaryKind:error-boundary,boundarySource:null,sourceOwnership:unknown,throwingComponent:CardBody,message:"Simulated error coming from DevTools",stack:"Error: Simulated error coming from DevTools
    at updateClassComponent (http://localhost:5214/.vite/deps/react-dom_client.js?v=611eef11:5638:18)
    at beginWork (http://localhost:5214/.vite/deps/react-dom_client.js?v=611eef11:6179:139)
    at runWithFiberInDEV (http://localhost:5214/.vite/deps/react-dom_client.js?v=611eef11:852:66)
    at performUnitOfWork (http://localhost:5214/.vite/deps/react-dom_client.js?v=611eef11:8467:92)
    at workLoopSync (http://localhost:5214/.vite/deps/react-dom_client.js?v=611eef11:8363:37)
    at renderRootSync (http://localhost:5214/.vite/deps/react-dom_client.js?v=611eef11:8347:6)
    at performWorkOnRoot (http://localhost:5214/.vite/deps/react-dom_client.js?v=611eef11:7995:181)
    at performSyncWorkOnRoot (http://localhost:5214/.vite/deps/react-dom_client.js?v=611eef11:9105:4)
    at flushSyncWorkAcrossRoots_impl (http://localhost:5214/.vite/deps/react-dom_client.js?v=611eef11:9022:302)
    at processRootScheduleInMicrotask (http://localhost:5214/.vite/deps/react-dom_client.js?v=611eef11:9043:101)",stackFrames:[{functionName:updateClassComponent,file:/node_modules/.pnpm/react-dom@19.2.7_react@19.2.7/node_modules/react-dom/cjs/react-dom-client.development.js,line:10235,column:23,isLibrary:true,mapping:mapped},{functionName:beginWork,file:/node_modules/.pnpm/react-dom@19.2.7_react@19.2.7/node_modules/react-dom/cjs/react-dom-client.development.js,line:11792,column:13,isLibrary:true,mapping:mapped},{functionName:runWithFiberInDEV,file:/node_modules/.pnpm/react-dom@19.2.7_react@19.2.7/node_modules/react-dom/cjs/react-dom-client.development.js,line:871,column:30,isLibrary:true,mapping:mapped},{functionName:performUnitOfWork,file:/node_modules/.pnpm/react-dom@19.2.7_react@19.2.7/node_modules/react-dom/cjs/react-dom-client.development.js,line:17641,column:22,isLibrary:true,mapping:mapped},{functionName:workLoopSync,file:/node_modules/.pnpm/react-dom@19.2.7_react@19.2.7/node_modules/react-dom/cjs/react-dom-client.development.js,line:17469,column:41,isLibrary:true,mapping:mapped},{functionName:renderRootSync,file:/node_modules/.pnpm/react-dom@19.2.7_react@19.2.7/node_modules/react-dom/cjs/react-dom-client.development.js,line:17450,column:11,isLibrary:true,mapping:mapped},{functionName:performWorkOnRoot,file:/node_modules/.pnpm/react-dom@19.2.7_react@19.2.7/node_modules/react-dom/cjs/react-dom-client.development.js,line:16504,column:11,isLibrary:true,mapping:mapped},{functionName:performSyncWorkOnRoot,file:/node_modules/.pnpm/react-dom@19.2.7_react@19.2.7/node_modules/react-dom/cjs/react-dom-client.development.js,line:18972,column:7,isLibrary:true,mapping:mapped},{functionName:flushSyncWorkAcrossRoots_impl,file:/node_modules/.pnpm/react-dom@19.2.7_react@19.2.7/node_modules/react-dom/cjs/react-dom-client.development.js,line:18814,column:21,isLibrary:true,mapping:mapped},{functionName:processRootScheduleInMicrotask,file:/node_modules/.pnpm/react-dom@19.2.7_react@19.2.7/node_modules/react-dom/cjs/react-dom-client.development.js,line:18853,column:9,isLibrary:true,mapping:mapped}],isLibraryBoundary:false,forced:true,status:active,statusReason:forced,rendered:{output:nothing,hostNodes:0,text:null}}
suspended: []
blankTreeHint: "error boundary <CardBody> is held in its error state by react_force_error_boundary (no real error) — call react_reset_overrides to release it"
ownershipCoverage: {complete:false,totalCandidates:1,app:0,library:0,unknown:1}
scanTruncated: false
[exit 0]
```

```console
$ npx genie-react call react_reset_overrides '{}' --session art-l4
ok: true
cleared: [{kind:error,componentName:CardBody,outcome:released}]
remaining: 0
commitObserved: true
[exit 0]
```

```console
$ agent-browser --session art-l4 get text '[aria-label=Profile]'
Profile
Name
Dana Whitfield
Email
dana@example.com
Location
Not provided
[exit 0]
```

## After also giving CardBody a fallback
```console
$ git diff -- src/screens/account/CardBody.tsx
diff --git a/evals/fixture-app/src/screens/account/CardBody.tsx b/evals/fixture-app/src/screens/account/CardBody.tsx
index 0e358d8..7b6999d 100644
--- a/evals/fixture-app/src/screens/account/CardBody.tsx
+++ b/evals/fixture-app/src/screens/account/CardBody.tsx
@@ -12,6 +12,7 @@ export class CardBody extends Component<{ children: ReactNode }, CardBodyState>
   }
 
   render() {
-    return this.state.failed ? null : this.props.children
+    if (!this.state.failed) return this.props.children
+    return <p role="alert">This section failed to load.</p>
   }
 }
[exit 0]
```

```console
$ agent-browser --session art-l4 open 'http://localhost:5214/?screen=account'
✓ Acme Console
  http://localhost:5214/?screen=account
[exit 0]
```

```console
$ agent-browser --session art-l4 wait 1500
✓ Done
[exit 0]
```

```console
$ npx genie-react call react_find_components '{"query":"ProfileDetails","exact":true}' --session art-l4 --fields id,name
[1]:
  - {id:10548456456213,name:ProfileDetails}
[exit 0]
```

```console
$ npx genie-react call react_force_error_boundary '{"id":10548456456213,"forceError":true}' --session art-l4
ok: true
boundaryId: 10548456456212
boundaryName: CardBody
erroring: true
activeOverrides: 1
[exit 0]
```

```console
$ agent-browser --session art-l4 get text '[aria-label=Profile]'
Profile

This section failed to load.
[exit 0]
```

```console
$ npx genie-react call react_error_state '{"includeSource":false}' --session art-l4 --select /caughtErrors/0/rendered
status: ok
selection:
  expression: /caughtErrors/0/rendered
  matchedPathCount: 1
  matchedPaths: [/caughtErrors/0/rendered]
  omittedPathCount: 80
result: {output:visible,hostNodes:1,text:"This section failed to load."}
[exit 0]
```

```console
$ npx genie-react call react_error_state '{"includeSource":false}' --session art-l4 --select /blankTreeHint
status: ok
selection:
  expression: /blankTreeHint
  matchedPathCount: 1
  matchedPaths: [/blankTreeHint]
  omittedPathCount: 82
result: "error boundary <CardBody> is held in its error state by react_force_error_boundary (no real error) — call react_reset_overrides to release it"
[exit 0]
```

```console
$ npx genie-react call react_reset_overrides '{}' --session art-l4
ok: true
cleared: [{kind:error,componentName:CardBody,outcome:released}]
remaining: 0
commitObserved: true
[exit 0]
```

```console
$ agent-browser --session art-l4 get text '[aria-label=Profile]'
Profile
Name
Dana Whitfield
Email
dana@example.com
Location
Not provided
[exit 0]
```

## Fallback only: CardBody fallback kept, formatLocation fix reverted
```console
$ git diff --stat
 evals/fixture-app/src/screens/account/CardBody.tsx | 3 ++-
 1 file changed, 2 insertions(+), 1 deletion(-)
[exit 0]
```

```console
$ agent-browser --session art-l4 open 'http://localhost:5214/?screen=account'
✓ Acme Console
  http://localhost:5214/?screen=account
[exit 0]
```

```console
$ agent-browser --session art-l4 wait 1500
✓ Done
[exit 0]
```

```console
$ agent-browser --session art-l4 get text '[aria-label=Profile]'
Profile

This section failed to load.
[exit 0]
```

```console
$ npx genie-react call react_error_state '{"includeSource":false}' --session art-l4 --select /caughtErrors/0/rendered
status: ok
selection:
  expression: /caughtErrors/0/rendered
  matchedPathCount: 1
  matchedPaths: [/caughtErrors/0/rendered]
  omittedPathCount: 80
result: {output:visible,hostNodes:1,text:"This section failed to load."}
[exit 0]
```

```console
$ npx genie-react verify begin --session art-l4 --name 'reload profile' --claim 'render ProfileDetails min 1' --claim 'boundaries clean'
recording vfy_ed5ccd3c-5f42-452b-96d2-7870c34814ea "reload profile"
  url "http://localhost:5214/?screen=account"
  1 null render ProfileDetails min 1  {}
  2 null boundaries clean  {}
window: {observationId:observation:1,startDocumentCommitId:2,domains:[react,query],quietMs:500,timeoutMs:10000,tailMs:500}
next: $ pnpm exec genie-react verify end vfy_ed5ccd3c-5f42-452b-96d2-7870c34814ea --session art-l4
session: {sessionId:1c87d760-c7ec-4954-96ed-9f64913c1714,logicalSessionId:3f2fa767-cbe2-4ca6-b345-c98b8eddc899,documentGeneration:8}
schemaVersion: "1.0"
targets: [{target:{component:ProfileDetails},status:pending,instances:0}]
startedAt: 2026-11-19T04:00:35.940Z
expiresAt: 2026-11-19T04:05:35.944Z
request: {budget:{fiberLimit:250,operationLimit:20000,timeLimitMs:8,targetOperationReserve:4000,targetTimeReserveMs:4,adaptive:true},settle:{quietMs:500,timeoutMs:10000},maxDurationMs:300000,allowOverrides:false}
[exit 0]
```

```console
$ npx genie-react call query_reset '{"queryKey":["profile"]}' --session art-l4
ok: true
matched: 1
[exit 0]
```

```console
$ npx genie-react verify end vfy_ed5ccd3c-5f42-452b-96d2-7870c34814ea --session art-l4
fail vfy_ed5ccd3c-5f42-452b-96d2-7870c34814ea "reload profile"  0 commits, quiet after 609 ms (react, query)
  url "http://localhost:5214/?screen=account"
  1 refused render ProfileDetails min 1  target_not_found: No ProfileDetails instance was mounted at begin or rendered in the window; a target Genie cannot see is not a target that did nothing.
      observed: {renders:0,mounts:0,updates:0,remounts:0,semantics:exact,instances:0,activeInstances:0}
      evidence:{pendingAtBegin:true},fix:{action:find-target,component:ProfileDetails}
      fix: $ pnpm exec genie-react call react_find_components '{"query":"ProfileDetails"}' --session art-l4
      claim: {kind:renders,target:{component:ProfileDetails},min:1,counting:renders,allowRemount:false}
      deciding: []
  2 fail boundaries clean  {caughtDuringWindow:0,caughtAtEnd:1}
      claim: {kind:boundaries-clean,scope:window}
      deciding: [{kind:boundary-at-end,boundary:CardBody,boundaryKind:error-boundary,message:"Cannot read properties of undefined (reading 'city')"}]
      caveats: [uncaught-errors-outside-boundaries-unobserved]
  window no_activity: No React commit happened in the window; the interaction did not reach this tab or did not change React state.
    guard:activity
    evidence:{startDocumentCommitId:2,frozenDocumentCommitId:2,commits:0},fix:{action:drive-observed-tab,url:"http://localhost:5214/?screen=account"}
    fix: $ pnpm exec genie-react verify begin --session art-l4 --name 'reload profile' --claim 'render ProfileDetails min 1' --claim 'boundaries clean'
window: {observationId:observation:1,startDocumentCommitId:2,settledDocumentCommitId:2,frozenDocumentCommitId:2,commits:0,settle:{outcome:met,quietMs:500,timeoutMs:10000,waitedMs:609,domains:{react:met,query:met}},tail:{ms:500,commits:0},environment:{bundle:development,strictMode:on,renderCollection:available,visibility:document}}
! ui-outcome-not-observed: Genie does not check the screen; confirm it with the UI driver
attempt 3 for these claims on this tab; previous fail vfy_37503d24-ee87-4f74-8b63-9db78130034f (target_not_found); document reloaded since
evidence: $ pnpm exec genie-react verify show vfy_ed5ccd3c-5f42-452b-96d2-7870c34814ea --claim 1 --session art-l4
session: {sessionId:1c87d760-c7ec-4954-96ed-9f64913c1714,logicalSessionId:3f2fa767-cbe2-4ca6-b345-c98b8eddc899,documentGeneration:8}
schemaVersion: "1.0"
exitCode: 1
stage: end
ledger: {fingerprint:cf_51bc07c58c4b,scope:logical-session,storage:memory,attempt:3,history:[{verificationId:vfy_c95714e2-a682-4f7f-a76a-69323719501d,verdict:fail,reasons:[target_not_found],endedAt:2026-11-19T03:59:03.432Z},{verificationId:vfy_37503d24-ee87-4f74-8b63-9db78130034f,verdict:fail,reasons:[target_not_found],endedAt:2026-11-19T03:59:37.791Z}],codeChangedSincePrevious:document-reloaded,failsOnSameCode:0}
evidence: {retained:true,tools:[react_get_renders,react_component_cohort,react_list_overrides,query_is_fetching,react_refresh_events,browser_visibility,react_profile_stop,react_error_state]}
startedAt: 2026-11-19T04:00:35.940Z
endedAt: 2026-11-19T04:00:42.135Z
request: {budget:{fiberLimit:250,operationLimit:20000,timeLimitMs:8,targetOperationReserve:4000,targetTimeReserveMs:4,adaptive:true},settle:{quietMs:500,timeoutMs:10000},maxDurationMs:300000,allowOverrides:false}
[exit 1]
```

## Revert

```console
$ git checkout -- evals/fixture-app
$ git status --short
```
