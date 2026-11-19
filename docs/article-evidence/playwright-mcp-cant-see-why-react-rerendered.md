# Evidence: playwright-mcp-cant-see-why-react-rerendered

Raw evidence for [Playwright MCP sees the screen. It can't see why React re-rendered](https://genie-react.com/docs/articles/playwright-mcp-cant-see-why-react-rerendered).

- Date: 2026-11-19 (UTC timestamps in each log header)
- Commit: `6867352ba46ec3998fe8cda0ba915536fddfa666`
- App: `apps/realworld-legacy` (Acme Tracker), dev server `http://127.0.0.1:5223`, standalone Genie hub `ws://127.0.0.1:5224/__genie/ws`, signed in as `dana@acme.test`
- Bug: `issue-row-inline-handler` from `evals/realworld/legacy/issue-row-inline-handler.json`. Its reference fix was applied for the "after" runs and reverted with `git checkout -- apps/realworld-legacy`.
- Tools: `genie-react` 1.0.2 (this checkout), `agent-browser` 0.43.0, `@playwright/mcp` 0.0.86 installed in a scratch folder outside the repo, Google Chrome.

Servers were started from `apps/realworld-legacy` with:

```bash
GENIE_HUB_PORT=5224 pnpm hub
GENIE_HUB_PORT=5224 pnpm exec webpack serve --mode development --port 5223
```

How to read the logs: each `$ ` line is the exact command, followed by its full output. A logging wrapper ran every command and appended `[exit N]`, the shell exit status of the command line. Absolute paths into this checkout are shortened to `<repo>` and the home folder to `~`. Nothing else is edited. Failed attempts, including my own quoting mistakes, are left in.

## 1. Shipped code (bug present): driver, Genie, verify, profiler

~~~~text
# date: 2026-11-19T04:03:10Z
# HEAD: 6867352ba46ec3998fe8cda0ba915536fddfa666
# app: apps/realworld-legacy at http://127.0.0.1:5223 (hub ws://127.0.0.1:5224), shipped code (seeded bug issue-row-inline-handler present)
## driver only

$ npx genie-react call app_backend_reset '{}' --session art-m3
seed: 2019
issues: 3240
notificationPollMs: 15000
[exit 0]

$ npx genie-react call app_sign_in '{}' --session art-m3
user: {id:u-1,name:"Dana Whitfield",email:dana@acme.test,title:Designer,team:Infra}
[exit 0]

$ agent-browser --session art-m3 open http://127.0.0.1:5223/issues
✓ Acme Tracker
  http://127.0.0.1:5223/issues
[exit 0]

$ agent-browser --session art-m3 wait '.issue-row'
✓ Done
[exit 0]

$ agent-browser --session art-m3 console --clear
✓ Console log cleared
[exit 0]

$ agent-browser --session art-m3 network requests --clear
✓ Request log cleared
[exit 0]

$ agent-browser --session art-m3 click '.issue-row:nth-child(4) input[type=checkbox]'
✓ Done
[exit 0]

$ agent-browser --session art-m3 is checked '.issue-row:nth-child(4) input[type=checkbox]'
true
[exit 0]

$ agent-browser --session art-m3 snapshot -i -s 'tbody' | head -12
- cell "Select CORE-1" [ref=e1088]
  - checkbox "Select CORE-1" [checked=false, ref=e1806]
- cell "CORE-1" [ref=e1089]
- cell "Migrate push notification opt-out" [ref=e1090]
  - button "Migrate push notification opt-out" [ref=e1807]
- cell "Backlog" [ref=e1091]
- cell "Urgent" [ref=e1092]
- cell "Zara Malik" [ref=e1093]
- cell "just now" [ref=e1094]
- cell "Select CORE-27" [ref=e1095]
  - checkbox "Select CORE-27" [checked=false, ref=e1808]
- cell "CORE-27" [ref=e1096]
[exit 0]

$ agent-browser --session art-m3 screenshot /tmp/art-m3/a1-after-click-before.png
✓ Screenshot saved to /tmp/art-m3/a1-after-click-before.png
[exit 0]

$ agent-browser --session art-m3 console
[exit 0]

$ agent-browser --session art-m3 errors
[exit 0]

$ agent-browser --session art-m3 network requests
[73908.1140] GET http://127.0.0.1:5223/api/notifications (Fetch) 200
[73908.1141] GET http://127.0.0.1:5223/api/notifications (Fetch) 200
[exit 0]
## genie

$ npx genie-react call app_backend_reset '{}' --session art-m3
seed: 2019
issues: 3240
notificationPollMs: 15000
[exit 0]

$ npx genie-react call app_sign_in '{}' --session art-m3
user: {id:u-1,name:"Dana Whitfield",email:dana@acme.test,title:Designer,team:Infra}
[exit 0]

$ agent-browser --session art-m3 open http://127.0.0.1:5223/issues
✓ Acme Tracker
  http://127.0.0.1:5223/issues
[exit 0]

$ agent-browser --session art-m3 wait '.issue-row'
✓ Done
[exit 0]

$ npx genie-react call react_clear_renders '{"component":["IssueRow","IssueTable"],"budget":{\"adaptive\":false,\"fiberLimit\":20000,\"operationLimit\":2000000,\"timeLimitMs\":500,\"targetOperationReserve\":100000,\"targetTimeReserveMs\":100}}' --session art-m3
error invalid_input: Tool arguments must be one JSON object, such as {}. Run pnpm exec genie-react tools <tool> for its schema.
next: $ pnpm exec genie-react tools react_clear_renders --session art-m3
userActionRequired: true
errorCode: invalid-input
exit: {code:2,class:usage}
[exit 1]

$ agent-browser --session art-m3 click '.issue-row:nth-child(4) input[type=checkbox]'
✓ Done
[exit 0]

$ npx genie-react call react_quiesce '{"idleMs":500,"timeoutMs":10000}' --session art-m3
ok: true
outcome: idle
elapsedMs: 922
observedCommits: 1
documentCommitId: 19
sessionId: d6a8bbf0-449e-46d8-ad1c-d6ba105013be
renderCollection: available
pendingWork:
  documentCommitId: 19
  scheduledRoots: 0
  suspendedBoundaries: 0
  dehydratedBoundaries: 0
  boundaries: []
  scanTruncated: false
  scannedFibers: 2258
[exit 0]

$ npx genie-react call react_component_cohort '{"component":"IssueRow","limit":1}' --session art-m3
error conflict: Tool call failed. The tab reloaded after you started the render window or recording this read depends on, so that evidence is gone. No other agent was involved. Start a new window (react_clear_renders, devtools_interaction_begin or timeline_start) and repeat the interaction.
next: $ pnpm exec genie-react status --session art-m3
userActionRequired: true
errorCode: conflict
details: {hubCode:OBSERVATION_SUPERSEDED,ownership:{resource:render-window,cause:reloaded}}
exit: {code:1,class:failure}
[exit 1]

$ npx genie-react call react_render_causes '{"component":"IssueRow","limit":2}' --session art-m3
error conflict: Tool call failed. The tab reloaded after you started the render window or recording this read depends on, so that evidence is gone. No other agent was involved. Start a new window (react_clear_renders, devtools_interaction_begin or timeline_start) and repeat the interaction.
next: $ pnpm exec genie-react status --session art-m3
userActionRequired: true
errorCode: conflict
details: {hubCode:OBSERVATION_SUPERSEDED,ownership:{resource:render-window,cause:reloaded}}
exit: {code:1,class:failure}
[exit 1]
## verify

$ npx genie-react call app_backend_reset '{}' --session art-m3
seed: 2019
issues: 3240
notificationPollMs: 15000
[exit 0]

$ npx genie-react call app_sign_in '{}' --session art-m3
user: {id:u-1,name:"Dana Whitfield",email:dana@acme.test,title:Designer,team:Infra}
[exit 0]

$ agent-browser --session art-m3 open http://127.0.0.1:5223/issues
✓ Acme Tracker
  http://127.0.0.1:5223/issues
[exit 0]

$ agent-browser --session art-m3 wait '.issue-row'
✓ Done
[exit 0]

$ npx genie-react verify begin --session art-m3 --name 'select one row' --budget '{\"adaptive\":false,\"fiberLimit\":20000,\"operationLimit\":2000000,\"timeLimitMs\":500,\"targetOperationReserve\":100000,\"targetTimeReserveMs\":100}' --claim 'render IssueRow only props.selected' --claim 'render IssueTable min 1' --claim 'boundaries clean' > /tmp/art-m3/vb1.txt; cat /tmp/art-m3/vb1.txt
error invalid_input: --budget must be one JSON object, such as {"fiberLimit":1200}.
next: $ pnpm exec genie-react verify begin --help
userActionRequired: true
errorCode: invalid-input
exit: {code:2,class:usage}
[exit 0]

$ agent-browser --session art-m3 click '.issue-row:nth-child(4) input[type=checkbox]'
✓ Done
[exit 0]

$ npx genie-react verify end  --session art-m3; echo "exit code: $?"
error invalid_input: verify end needs the verification ID that verify begin printed (vfy_ followed by a UUID).
next: $ pnpm exec genie-react verify end --help
userActionRequired: true
errorCode: invalid-input
exit: {code:2,class:usage}
exit code: 2
[exit 0]

$ npx genie-react verify show  --session art-m3 --claim 1
error invalid_input: verify show needs the verification ID that verify begin printed (vfy_ followed by a UUID).
next: $ pnpm exec genie-react verify show --help
userActionRequired: true
errorCode: invalid-input
exit: {code:2,class:usage}
[exit 2]
## rerun after fixing the budget quoting in my script
## genie

$ npx genie-react call app_backend_reset '{}' --session art-m3
seed: 2019
issues: 3240
notificationPollMs: 15000
[exit 0]

$ npx genie-react call app_sign_in '{}' --session art-m3
user: {id:u-1,name:"Dana Whitfield",email:dana@acme.test,title:Designer,team:Infra}
[exit 0]

$ agent-browser --session art-m3 open http://127.0.0.1:5223/issues
✓ Acme Tracker
  http://127.0.0.1:5223/issues
[exit 0]

$ agent-browser --session art-m3 wait '.issue-row'
✓ Done
[exit 0]

$ npx genie-react call react_clear_renders '{"component":["IssueRow","IssueTable"],"budget":{"adaptive":false,"fiberLimit":20000,"operationLimit":2000000,"timeLimitMs":500,"targetOperationReserve":100000,"targetTimeReserveMs":100}}' --session art-m3
ok: true
tracking: true
documentCommitId: 17
observation: {id:observation:1,epoch:1,startedAfterDocumentCommitId:17}
observationConfig:
  adaptive: false
  adaptiveScale: 1
  fiberLimit: 20000
  operationLimit: 2000000
  timeLimitMs: 500
  targetOperationReserve: 100000
  targetTimeReserveMs: 100
  lifecycleBufferLimit: 1000
  lifecycleTargetReserve: 100
strictMode: on
[exit 0]

$ agent-browser --session art-m3 click '.issue-row:nth-child(4) input[type=checkbox]'
✓ Done
[exit 0]

$ npx genie-react call react_quiesce '{"idleMs":500,"timeoutMs":10000}' --session art-m3
ok: true
outcome: idle
elapsedMs: 982
observedCommits: 1
documentCommitId: 19
sessionId: f5af5606-4144-4353-954b-d82dcd961216
renderCollection: available
pendingWork:
  documentCommitId: 19
  scheduledRoots: 0
  suspendedBoundaries: 0
  dehydratedBoundaries: 0
  boundaries: []
  scanTruncated: false
  scannedFibers: 2258
[exit 0]

$ npx genie-react call react_component_cohort '{"component":"IssueRow","limit":1}' --session art-m3
attribution:
  status: current
  startedAtDocumentCommitId: 19
  completedAtDocumentCommitId: 19
  startedAtAnalysisGeneration: 20
  completedAtAnalysisGeneration: 20
documentCommitId: 19
ownershipCoverage:
  complete: true
  totalCandidates: 100
  app: 100
  library: 0
  unknown: 0
  affects: ownership-labels
observation: {id:observation:1,epoch:1,startedAfterDocumentCommitId:17}
query: {component:IssueRow,exact:true}
componentMatch:
  component: IssueRow
  exact: true
  status: matched
  matchedNames: [IssueRow]
  matchedNameCount: 1
  similarNames: []
status: updated
matched: 100
mountedUpdated: 100
mountedIdle: 0
mountedUnknown: 0
unmounted: 0
returned: 1
omittedByLimit: 99
rendererBundle: development
coverage:
  complete: true
  freezeDetection: disabled
  scannedFibers: 2258
  scanLimit: 20000
  scanTruncated: false
  rootAvailable: true
  rootCount: 1
  scannedRootCount: 1
  rootLimit: 100
  rootScope: committed
  rootScopeComplete: true
  rootScopeTruncated: false
  inputAttributionComplete: false
  skippedCommitFibers: 0
  droppedUnmountFibers: 0
  analysisFailedFibers: 0
  pausedCommits: 0
  unobservedCommits: 0
  refreshCommitsExcluded: 0
  truncatedInputFibers: 1
  propsNotEnumeratedFibers: 0
  budgetExhaustedCommits: 0
  budgetExhaustedSubsystems: []
  generationHistoryEvictions: 0
view: summary
shared:
  logicalPathPrefix: "AppErrorBoundary[index=0] > Provider[index=0] > BrowserRouter[index=0] > Router[index=0] > ThemeProvider[index=0] > App[index=0] > Routes[index=0] > RenderedRoute[index=0] > RequireAuth[index=0] > Connect(AppShell)[index=0] > AppShell[index=0] > FeatureFlagsProvider[index=0] > <div>[index=0] > <main>[index=2] > Outlet[index=0] > RenderedRoute[index=0] > IssuesPage[index=0] > <div>[index=0] > withRouter(Connect(IssueTable))[index=3] > Connect(IssueTable)[index=0] > IssueTable[index=0] > <div>[index=0] > <table>[index=0] > <tbody>[index=1]"
  componentName: IssueRow
  sourceOwnership: app
  source: <repo>/apps/realworld-legacy/src/features/issues/issue-table.tsx:48:15
  parent: {fiberId:14934473703608,name:IssueTable,key:null}
  keyedParent: null
  logicalIdentityEvidence: keyed
  mountGenerationEvidence: exact
  renderingState: mounted-rendering
  reactVisibility: not-hidden
instances[1]:
  - {status:mounted-updated,mountId:mount:2,fiberId:14934473703633,key:iss-1,siblingIndex:0,logicalPath:"IssueRow[key=\"iss-1\"]",mountGeneration:1,hostSelector:tr.issue-row}
[exit 0]

$ npx genie-react call react_render_causes '{"component":"IssueRow","limit":2}' --session art-m3
componentMatch:
  component: IssueRow
  exact: true
  status: matched
  matchedNames: [IssueRow]
  matchedNameCount: 1
  similarNames: []
tracking: true
commits: 3
documentCommitId: 20
observation: {id:observation:1,epoch:1,startedAfterDocumentCommitId:17}
attribution:
  status: current
  startedAtDocumentCommitId: 20
  completedAtDocumentCommitId: 20
  startedAtAnalysisGeneration: 21
  completedAtAnalysisGeneration: 21
view: summary
events[2] (componentName #componentId {fields}, then ← kind evidence name {fields} per cause):
  IssueRow #14934473705596 {renderEventId:render:18:101,documentCommitId:18,mountId:mount:101,key:iss-1754,necessity:unknown,necessityReason:callbacks-changed,inputEvidence:changed,source:{location:<repo>/apps/realworld-legacy/src/features/issues/issue-table.tsx:48:15,role:element-callsite,ownership:app}}
    ← props exact onToggle
  IssueRow #14934473705577 {renderEventId:render:18:100,documentCommitId:18,mountId:mount:100,key:iss-1700,necessity:unknown,necessityReason:callbacks-changed,inputEvidence:changed,source:{location:<repo>/apps/realworld-legacy/src/features/issues/issue-table.tsx:48:15,role:element-callsite,ownership:app}}
    ← props exact onToggle
omittedByLimit: 98
sourceClassification:
  complete: true
  affects: result
  totalCandidates: 100
  evaluated: 100
  app: 100
  library: 0
  unknown: 0
  unknownComponents: []
  unknownComponentsOmitted: 0
renderEventRetention: {evictedEvents:0,earliestDocumentCommitId:18,latestDocumentCommitId:20}
coverage:
  skippedCommitFibers: 0
  droppedUnmountFibers: 0
  analysisFailedFibers: 0
  pausedCommits: 0
  unobservedCommits: 0
  refreshCommitsExcluded: 0
  truncatedInputFibers: 1
  propsNotEnumeratedFibers: 0
  budgetExhaustedCommits: 0
  budgetExhaustedSubsystems: []
  incompleteBecause[1]:
    - {reason:inputs-truncated,fibers:1,components:[IssueTableToolbar],detail:"An input held values Genie compares only in part, such as functions, class instances or objects past the inspected depth; read deepDiff.truncated on these components."}
  complete: false
  inputAttributionComplete: false
  semantics: lower-bound
  coverageDomain: render-causality
  droppedRenderEvents: 0
[exit 0]
## verify

$ npx genie-react call app_backend_reset '{}' --session art-m3
seed: 2019
issues: 3240
notificationPollMs: 15000
[exit 0]

$ npx genie-react call app_sign_in '{}' --session art-m3
user: {id:u-1,name:"Dana Whitfield",email:dana@acme.test,title:Designer,team:Infra}
[exit 0]

$ agent-browser --session art-m3 open http://127.0.0.1:5223/issues
✓ Acme Tracker
  http://127.0.0.1:5223/issues
[exit 0]

$ agent-browser --session art-m3 wait '.issue-row'
✓ Done
[exit 0]

$ npx genie-react verify begin --session art-m3 --name 'select one row' --budget '{"adaptive":false,"fiberLimit":20000,"operationLimit":2000000,"timeLimitMs":500,"targetOperationReserve":100000,"targetTimeReserveMs":100}' --claim 'render IssueRow only props.selected' --claim 'render IssueTable min 1' --claim 'boundaries clean' > /tmp/art-m3/vb1.txt; cat /tmp/art-m3/vb1.txt
recording vfy_07278364-4735-4e75-b781-41f5e78784ce "select one row"
  url "http://127.0.0.1:5223/issues"
  1 null render IssueRow only props.selected  {}
  2 null render IssueTable min 1  {}
  3 null boundaries clean  {}
window: {observationId:observation:1,startDocumentCommitId:17,domains:[react],quietMs:500,timeoutMs:10000,tailMs:500}
next: $ pnpm exec genie-react verify end vfy_07278364-4735-4e75-b781-41f5e78784ce --session art-m3
session: {sessionId:6421ada1-edc1-43fa-ac1d-364059341a88,logicalSessionId:4ddd7a3e-437b-4904-afe1-fb005aad89d6,documentGeneration:37}
schemaVersion: "1.0"
targets: [{target:{component:IssueRow},status:resolved,instances:100,source:<repo>/apps/realworld-legacy/src/features/issues/issue-table.tsx},{target:{component:IssueTable},status:resolved,instances:1,source:<repo>/apps/realworld-legacy/src/features/issues/issue-table.tsx}]
startedAt: 2026-11-19T04:03:52.092Z
expiresAt: 2026-11-19T04:08:52.108Z
request: {budget:{fiberLimit:20000,operationLimit:2000000,timeLimitMs:500,targetOperationReserve:100000,targetTimeReserveMs:100,adaptive:false},settle:{quietMs:500,timeoutMs:10000},maxDurationMs:300000,allowOverrides:false}
[exit 0]

$ agent-browser --session art-m3 click '.issue-row:nth-child(4) input[type=checkbox]'
✓ Done
[exit 0]

$ npx genie-react verify end vfy_07278364-4735-4e75-b781-41f5e78784ce --session art-m3; echo "exit code: $?"
fail vfy_07278364-4735-4e75-b781-41f5e78784ce "select one row"  3 commits, quiet after 1123 ms (react)
  url "http://127.0.0.1:5223/issues"
  1 fail render IssueRow only props.selected  {renders:100,events:100,violatingEvents:100,causes:[props.onToggle,props.selected]}
      claim: {kind:render-causes,target:{component:IssueRow},allow:[{kind:props,name:selected}]}
      deciding: [{kind:render-event,renderEventId:render:18:110,documentCommitId:18,mountId:mount:100,causes:[{cause:props.onToggle,evidence:exact}]},{kind:render-event,renderEventId:render:18:109,documentCommitId:18,mountId:mount:99,causes:[{cause:props.onToggle,evidence:exact}]},{kind:render-event,renderEventId:render:18:108,documentCommitId:18,mountId:mount:98,causes:[{cause:props.onToggle,evidence:exact}]}]
  2 pass render IssueTable min 1  {renders:1,mounts:0,updates:1,remounts:0,semantics:exact,instances:1,activeInstances:1}
      claim: {kind:renders,target:{component:IssueTable},min:1,counting:renders,allowRemount:false}
      deciding: [{kind:instance,mountId:mount:101,renders:1,mounts:0,updates:1,mountGeneration:1,latestDocumentCommitId:18,source:<repo>/apps/realworld-legacy/src/features/issues/issue-table.tsx:43:7}]
  3 pass boundaries clean  {caughtDuringWindow:0,caughtAtEnd:0}
      claim: {kind:boundaries-clean,scope:window}
      deciding: [{kind:boundary-log,scope:window,complete:true,afterDocumentCommitId:17}]
      caveats: [uncaught-errors-outside-boundaries-unobserved]
window: {observationId:observation:1,startDocumentCommitId:17,settledDocumentCommitId:19,frozenDocumentCommitId:20,commits:3,settle:{outcome:met,quietMs:500,timeoutMs:10000,waitedMs:1123,domains:{react:met}},tail:{ms:500,commits:1},environment:{bundle:development,strictMode:on,renderCollection:available,visibility:unavailable}}
! ui-outcome-not-observed: Genie does not check the screen; confirm it with the UI driver
! visibility-unobserved: the app reports no visibility signal, so a hidden interval was not observed
attempt 1 for these claims on this tab
evidence: $ pnpm exec genie-react verify show vfy_07278364-4735-4e75-b781-41f5e78784ce --claim 1 --session art-m3
session: {sessionId:6421ada1-edc1-43fa-ac1d-364059341a88,logicalSessionId:4ddd7a3e-437b-4904-afe1-fb005aad89d6,documentGeneration:37}
schemaVersion: "1.0"
exitCode: 1
stage: end
ledger: {fingerprint:cf_c8caf9c40557,scope:logical-session,storage:memory,attempt:1,history:[],codeChangedSincePrevious:null,failsOnSameCode:0}
evidence: {retained:true,tools:[react_get_renders,react_component_cohort,react_list_overrides,react_refresh_events,react_profile_stop,react_render_causes,react_error_state]}
startedAt: 2026-11-19T04:03:52.092Z
endedAt: 2026-11-19T04:03:54.055Z
request: {budget:{fiberLimit:20000,operationLimit:2000000,timeLimitMs:500,targetOperationReserve:100000,targetTimeReserveMs:100,adaptive:false},settle:{quietMs:500,timeoutMs:10000},maxDurationMs:300000,allowOverrides:false}
exit code: 1
[exit 0]

$ npx genie-react verify show vfy_07278364-4735-4e75-b781-41f5e78784ce --session art-m3 --claim 1
verificationId: vfy_07278364-4735-4e75-b781-41f5e78784ce
verdict: fail
claim:
  index: 1
  text: "render IssueRow only props.selected"
  claim: {kind:render-causes,target:{component:IssueRow},allow:[{kind:props,name:selected}]}
  verdict: fail
  observed: {renders:100,events:100,violatingEvents:100,causes:[props.onToggle,props.selected]}
  deciding[3]:
    each: {kind:render-event,documentCommitId:18,causes:[{cause:props.onToggle,evidence:exact}]}
    - {renderEventId:render:18:110,mountId:mount:100}
    - {renderEventId:render:18:109,mountId:mount:99}
    - {renderEventId:render:18:108,mountId:mount:98}
  caveats: []
evidence:
  records[100]:
    each: {mountGeneration:1,mountGenerationEvidence:exact,renders:1,mounts:0,updates:1,unmounted:false,latestDocumentCommitId:18,sourceFile:<repo>/apps/realworld-legacy/src/features/issues/issue-table.tsx,sourceLocation:<repo>/apps/realworld-legacy/src/features/issues/issue-table.tsx:48:15}
    - {mountId:mount:1,key:iss-1,logicalPath:"AppErrorBoundary[index=0] > Provider[index=0] > BrowserRouter[index=0] > Router[index=0] > ThemeProvider[index=0] > App[index=0] > Routes[index=0] > RenderedRoute[index=0] > RequireAuth[index=0] > Connect(AppShell)[index=0] > AppShell[index=0] > FeatureFlagsProvider[index=0] > <div>[index=0] > <main>[index=2] > Outlet[index=0] > RenderedRoute[index=0] > IssuesPage[index=0] > <div>[index=0] > withRouter(Connect(IssueTable))[index=3] > Connect(IssueTable)[index=0] > IssueTable[index=0] > <div>[index=0] > <table>[index=0] > <tbody>[index=1] > IssueRow[key=\"iss-1\"]"}
    - {mountId:mount:2,key:iss-27,logicalPath:"AppErrorBoundary[index=0] > Provider[index=0] > BrowserRouter[index=0] > Router[index=0] > ThemeProvider[index=0] > App[index=0] > Routes[index=0] > RenderedRoute[index=0] > RequireAuth[index=0] > Connect(AppShell)[index=0] > AppShell[index=0] > FeatureFlagsProvider[index=0] > <div>[index=0] > <main>[index=2] > Outlet[index=0] > RenderedRoute[index=0] > IssuesPage[index=0] > <div>[index=0] > withRouter(Connect(IssueTable))[index=3] > Connect(IssueTable)[index=0] > IssueTable[index=0] > <div>[index=0] > <table>[index=0] > <tbody>[index=1] > IssueRow[key=\"iss-27\"]"}
    - {mountId:mount:3,key:iss-37,logicalPath:"AppErrorBoundary[index=0] > Provider[index=0] > BrowserRouter[index=0] > Router[index=0] > ThemeProvider[index=0] > App[index=0] > Routes[index=0] > RenderedRoute[index=0] > RequireAuth[index=0] > Connect(AppShell)[index=0] > AppShell[index=0] > FeatureFlagsProvider[index=0] > <div>[index=0] > <main>[index=2] > Outlet[index=0] > RenderedRoute[index=0] > IssuesPage[index=0] > <div>[index=0] > withRouter(Connect(IssueTable))[index=3] > Connect(IssueTable)[index=0] > IssueTable[index=0] > <div>[index=0] > <table>[index=0] > <tbody>[index=1] > IssueRow[key=\"iss-37\"]"}
    - {mountId:mount:4,key:iss-40,logicalPath:"AppErrorBoundary[index=0] > Provider[index=0] > BrowserRouter[index=0] > Router[index=0] > ThemeProvider[index=0] > App[index=0] > Routes[index=0] > RenderedRoute[index=0] > RequireAuth[index=0] > Connect(AppShell)[index=0] > AppShell[index=0] > FeatureFlagsProvider[index=0] > <div>[index=0] > <main>[index=2] > Outlet[index=0] > RenderedRoute[index=0] > IssuesPage[index=0] > <div>[index=0] > withRouter(Connect(IssueTable))[index=3] > Connect(IssueTable)[index=0] > IssueTable[index=0] > <div>[index=0] > <table>[index=0] > <tbody>[index=1] > IssueRow[key=\"iss-40\"]"}
    - {mountId:mount:5,key:iss-41,logicalPath:"AppErrorBoundary[index=0] > Provider[index=0] > BrowserRouter[index=0] > Router[index=0] > ThemeProvider[index=0] > App[index=0] > Routes[index=0] > RenderedRoute[index=0] > RequireAuth[index=0] > Connect(AppShell)[index=0] > AppShell[index=0] > FeatureFlagsProvider[index=0] > <div>[index=0] > <main>[index=2] > Outlet[index=0] > RenderedRoute[index=0] > IssuesPage[index=0] > <div>[index=0] > withRouter(Connect(IssueTable))[index=3] > Connect(IssueTable)[index=0] > IssueTable[index=0] > <div>[index=0] > <table>[index=0] > <tbody>[index=1] > IssueRow[key=\"iss-41\"]"}
    - {mountId:mount:6,key:iss-52,logicalPath:"AppErrorBoundary[index=0] > Provider[index=0] > BrowserRouter[index=0] > Router[index=0] > ThemeProvider[index=0] > App[index=0] > Routes[index=0] > RenderedRoute[index=0] > RequireAuth[index=0] > Connect(AppShell)[index=0] > AppShell[index=0] > FeatureFlagsProvider[index=0] > <div>[index=0] > <main>[index=2] > Outlet[index=0] > RenderedRoute[index=0] > IssuesPage[index=0] > <div>[index=0] > withRouter(Connect(IssueTable))[index=3] > Connect(IssueTable)[index=0] > IssueTable[index=0] > <div>[index=0] > <table>[index=0] > <tbody>[index=1] > IssueRow[key=\"iss-52\"]"}
    - {mountId:mount:7,key:iss-87,logicalPath:"AppErrorBoundary[index=0] > Provider[index=0] > BrowserRouter[index=0] > Router[index=0] > ThemeProvider[index=0] > App[index=0] > Routes[index=0] > RenderedRoute[index=0] > RequireAuth[index=0] > Connect(AppShell)[index=0] > AppShell[index=0] > FeatureFlagsProvider[index=0] > <div>[index=0] > <main>[index=2] > Outlet[index=0] > RenderedRoute[index=0] > IssuesPage[index=0] > <div>[index=0] > withRouter(Connect(IssueTable))[index=3] > Connect(IssueTable)[index=0] > IssueTable[index=0] > <div>[index=0] > <table>[index=0] > <tbody>[index=1] > IssueRow[key=\"iss-87\"]"}
    - {mountId:mount:8,key:iss-94,logicalPath:"AppErrorBoundary[index=0] > Provider[index=0] > BrowserRouter[index=0] > Router[index=0] > ThemeProvider[index=0] > App[index=0] > Routes[index=0] > RenderedRoute[index=0] > RequireAuth[index=0] > Connect(AppShell)[index=0] > AppShell[index=0] > FeatureFlagsProvider[index=0] > <div>[index=0] > <main>[index=2] > Outlet[index=0] > RenderedRoute[index=0] > IssuesPage[index=0] > <div>[index=0] > withRouter(Connect(IssueTable))[index=3] > Connect(IssueTable)[index=0] > IssueTable[index=0] > <div>[index=0] > <table>[index=0] > <tbody>[index=1] > IssueRow[key=\"iss-94\"]"}
    - {mountId:mount:9,key:iss-101,logicalPath:"AppErrorBoundary[index=0] > Provider[index=0] > BrowserRouter[index=0] > Router[index=0] > ThemeProvider[index=0] > App[index=0] > Routes[index=0] > RenderedRoute[index=0] > RequireAuth[index=0] > Connect(AppShell)[index=0] > AppShell[index=0] > FeatureFlagsProvider[index=0] > <div>[index=0] > <main>[index=2] > Outlet[index=0] > RenderedRoute[index=0] > IssuesPage[index=0] > <div>[index=0] > withRouter(Connect(IssueTable))[index=3] > Connect(IssueTable)[index=0] > IssueTable[index=0] > <div>[index=0] > <table>[index=0] > <tbody>[index=1] > IssueRow[key=\"iss-101\"]"}
    - {mountId:mount:10,key:iss-107,logicalPath:"AppErrorBoundary[index=0] > Provider[index=0] > BrowserRouter[index=0] > Router[index=0] > ThemeProvider[index=0] > App[index=0] > Routes[index=0] > RenderedRoute[index=0] > RequireAuth[index=0] > Connect(AppShell)[index=0] > AppShell[index=0] > FeatureFlagsProvider[index=0] > <div>[index=0] > <main>[index=2] > Outlet[index=0] > RenderedRoute[index=0] > IssuesPage[index=0] > <div>[index=0] > withRouter(Connect(IssueTable))[index=3] > Connect(IssueTable)[index=0] > IssueTable[index=0] > <div>[index=0] > <table>[index=0] > <tbody>[index=1] > IssueRow[key=\"iss-107\"]"}
    - {mountId:mount:11,key:iss-115,logicalPath:"AppErrorBoundary[index=0] > Provider[index=0] > BrowserRouter[index=0] > Router[index=0] > ThemeProvider[index=0] > App[index=0] > Routes[index=0] > RenderedRoute[index=0] > RequireAuth[index=0] > Connect(AppShell)[index=0] > AppShell[index=0] > FeatureFlagsProvider[index=0] > <div>[index=0] > <main>[index=2] > Outlet[index=0] > RenderedRoute[index=0] > IssuesPage[index=0] > <div>[index=0] > withRouter(Connect(IssueTable))[index=3] > Connect(IssueTable)[index=0] > IssueTable[index=0] > <div>[index=0] > <table>[index=0] > <tbody>[index=1] > IssueRow[key=\"iss-115\"]"}
    - {mountId:mount:12,key:iss-127,logicalPath:"AppErrorBoundary[index=0] > Provider[index=0] > BrowserRouter[index=0] > Router[index=0] > ThemeProvider[index=0] > App[index=0] > Routes[index=0] > RenderedRoute[index=0] > RequireAuth[index=0] > Connect(AppShell)[index=0] > AppShell[index=0] > FeatureFlagsProvider[index=0] > <div>[index=0] > <main>[index=2] > Outlet[index=0] > RenderedRoute[index=0] > IssuesPage[index=0] > <div>[index=0] > withRouter(Connect(IssueTable))[index=3] > Connect(IssueTable)[index=0] > IssueTable[index=0] > <div>[index=0] > <table>[index=0] > <tbody>[index=1] > IssueRow[key=\"iss-127\"]"}
    - {mountId:mount:13,key:iss-144,logicalPath:"AppErrorBoundary[index=0] > Provider[index=0] > BrowserRouter[index=0] > Router[index=0] > ThemeProvider[index=0] > App[index=0] > Routes[index=0] > RenderedRoute[index=0] > RequireAuth[index=0] > Connect(AppShell)[index=0] > AppShell[index=0] > FeatureFlagsProvider[index=0] > <div>[index=0] > <main>[index=2] > Outlet[index=0] > RenderedRoute[index=0] > IssuesPage[index=0] > <div>[index=0] > withRouter(Connect(IssueTable))[index=3] > Connect(IssueTable)[index=0] > IssueTable[index=0] > <div>[index=0] > <table>[index=0] > <tbody>[index=1] > IssueRow[key=\"iss-144\"]"}
    - {mountId:mount:14,key:iss-149,logicalPath:"AppErrorBoundary[index=0] > Provider[index=0] > BrowserRouter[index=0] > Router[index=0] > ThemeProvider[index=0] > App[index=0] > Routes[index=0] > RenderedRoute[index=0] > RequireAuth[index=0] > Connect(AppShell)[index=0] > AppShell[index=0] > FeatureFlagsProvider[index=0] > <div>[index=0] > <main>[index=2] > Outlet[index=0] > RenderedRoute[index=0] > IssuesPage[index=0] > <div>[index=0] > withRouter(Connect(IssueTable))[index=3] > Connect(IssueTable)[index=0] > IssueTable[index=0] > <div>[index=0] > <table>[index=0] > <tbody>[index=1] > IssueRow[key=\"iss-149\"]"}
    - {mountId:mount:15,key:iss-167,logicalPath:"AppErrorBoundary[index=0] > Provider[index=0] > BrowserRouter[index=0] > Router[index=0] > ThemeProvider[index=0] > App[index=0] > Routes[index=0] > RenderedRoute[index=0] > RequireAuth[index=0] > Connect(AppShell)[index=0] > AppShell[index=0] > FeatureFlagsProvider[index=0] > <div>[index=0] > <main>[index=2] > Outlet[index=0] > RenderedRoute[index=0] > IssuesPage[index=0] > <div>[index=0] > withRouter(Connect(IssueTable))[index=3] > Connect(IssueTable)[index=0] > IssueTable[index=0] > <div>[index=0] > <table>[index=0] > <tbody>[index=1] > IssueRow[key=\"iss-167\"]"}
    - {mountId:mount:16,key:iss-169,logicalPath:"AppErrorBoundary[index=0] > Provider[index=0] > BrowserRouter[index=0] > Router[index=0] > ThemeProvider[index=0] > App[index=0] > Routes[index=0] > RenderedRoute[index=0] > RequireAuth[index=0] > Connect(AppShell)[index=0] > AppShell[index=0] > FeatureFlagsProvider[index=0] > <div>[index=0] > <main>[index=2] > Outlet[index=0] > RenderedRoute[index=0] > IssuesPage[index=0] > <div>[index=0] > withRouter(Connect(IssueTable))[index=3] > Connect(IssueTable)[index=0] > IssueTable[index=0] > <div>[index=0] > <table>[index=0] > <tbody>[index=1] > IssueRow[key=\"iss-169\"]"}
    - {mountId:mount:17,key:iss-206,logicalPath:"AppErrorBoundary[index=0] > Provider[index=0] > BrowserRouter[index=0] > Router[index=0] > ThemeProvider[index=0] > App[index=0] > Routes[index=0] > RenderedRoute[index=0] > RequireAuth[index=0] > Connect(AppShell)[index=0] > AppShell[index=0] > FeatureFlagsProvider[index=0] > <div>[index=0] > <main>[index=2] > Outlet[index=0] > RenderedRoute[index=0] > IssuesPage[index=0] > <div>[index=0] > withRouter(Connect(IssueTable))[index=3] > Connect(IssueTable)[index=0] > IssueTable[index=0] > <div>[index=0] > <table>[index=0] > <tbody>[index=1] > IssueRow[key=\"iss-206\"]"}
    - {mountId:mount:18,key:iss-235,logicalPath:"AppErrorBoundary[index=0] > Provider[index=0] > BrowserRouter[index=0] > Router[index=0] > ThemeProvider[index=0] > App[index=0] > Routes[index=0] > RenderedRoute[index=0] > RequireAuth[index=0] > Connect(AppShell)[index=0] > AppShell[index=0] > FeatureFlagsProvider[index=0] > <div>[index=0] > <main>[index=2] > Outlet[index=0] > RenderedRoute[index=0] > IssuesPage[index=0] > <div>[index=0] > withRouter(Connect(IssueTable))[index=3] > Connect(IssueTable)[index=0] > IssueTable[index=0] > <div>[index=0] > <table>[index=0] > <tbody>[index=1] > IssueRow[key=\"iss-235\"]"}
    - {mountId:mount:19,key:iss-238,logicalPath:"AppErrorBoundary[index=0] > Provider[index=0] > BrowserRouter[index=0] > Router[index=0] > ThemeProvider[index=0] > App[index=0] > Routes[index=0] > RenderedRoute[index=0] > RequireAuth[index=0] > Connect(AppShell)[index=0] > AppShell[index=0] > FeatureFlagsProvider[index=0] > <div>[index=0] > <main>[index=2] > Outlet[index=0] > RenderedRoute[index=0] > IssuesPage[index=0] > <div>[index=0] > withRouter(Connect(IssueTable))[index=3] > Connect(IssueTable)[index=0] > IssueTable[index=0] > <div>[index=0] > <table>[index=0] > <tbody>[index=1] > IssueRow[key=\"iss-238\"]"}
    - {mountId:mount:20,key:iss-239,logicalPath:"AppErrorBoundary[index=0] > Provider[index=0] > BrowserRouter[index=0] > Router[index=0] > ThemeProvider[index=0] > App[index=0] > Routes[index=0] > RenderedRoute[index=0] > RequireAuth[index=0] > Connect(AppShell)[index=0] > AppShell[index=0] > FeatureFlagsProvider[index=0] > <div>[index=0] > <main>[index=2] > Outlet[index=0] > RenderedRoute[index=0] > IssuesPage[index=0] > <div>[index=0] > withRouter(Connect(IssueTable))[index=3] > Connect(IssueTable)[index=0] > IssueTable[index=0] > <div>[index=0] > <table>[index=0] > <tbody>[index=1] > IssueRow[key=\"iss-239\"]"}
    - {mountId:mount:21,key:iss-258,logicalPath:"AppErrorBoundary[index=0] > Provider[index=0] > BrowserRouter[index=0] > Router[index=0] > ThemeProvider[index=0] > App[index=0] > Routes[index=0] > RenderedRoute[index=0] > RequireAuth[index=0] > Connect(AppShell)[index=0] > AppShell[index=0] > FeatureFlagsProvider[index=0] > <div>[index=0] > <main>[index=2] > Outlet[index=0] > RenderedRoute[index=0] > IssuesPage[index=0] > <div>[index=0] > withRouter(Connect(IssueTable))[index=3] > Connect(IssueTable)[index=0] > IssueTable[index=0] > <div>[index=0] > <table>[index=0] > <tbody>[index=1] > IssueRow[key=\"iss-258\"]"}
    - {mountId:mount:22,key:iss-265,logicalPath:"AppErrorBoundary[index=0] > Provider[index=0] > BrowserRouter[index=0] > Router[index=0] > ThemeProvider[index=0] > App[index=0] > Routes[index=0] > RenderedRoute[index=0] > RequireAuth[index=0] > Connect(AppShell)[index=0] > AppShell[index=0] > FeatureFlagsProvider[index=0] > <div>[index=0] > <main>[index=2] > Outlet[index=0] > RenderedRoute[index=0] > IssuesPage[index=0] > <div>[index=0] > withRouter(Connect(IssueTable))[index=3] > Connect(IssueTable)[index=0] > IssueTable[index=0] > <div>[index=0] > <table>[index=0] > <tbody>[index=1] > IssueRow[key=\"iss-265\"]"}
    - {mountId:mount:23,key:iss-277,logicalPath:"AppErrorBoundary[index=0] > Provider[index=0] > BrowserRouter[index=0] > Router[index=0] > ThemeProvider[index=0] > App[index=0] > Routes[index=0] > RenderedRoute[index=0] > RequireAuth[index=0] > Connect(AppShell)[index=0] > AppShell[index=0] > FeatureFlagsProvider[index=0] > <div>[index=0] > <main>[index=2] > Outlet[index=0] > RenderedRoute[index=0] > IssuesPage[index=0] > <div>[index=0] > withRouter(Connect(IssueTable))[index=3] > Connect(IssueTable)[index=0] > IssueTable[index=0] > <div>[index=0] > <table>[index=0] > <tbody>[index=1] > IssueRow[key=\"iss-277\"]"}
    - {mountId:mount:24,key:iss-280,logicalPath:"AppErrorBoundary[index=0] > Provider[index=0] > BrowserRouter[index=0] > Router[index=0] > ThemeProvider[index=0] > App[index=0] > Routes[index=0] > RenderedRoute[index=0] > RequireAuth[index=0] > Connect(AppShell)[index=0] > AppShell[index=0] > FeatureFlagsProvider[index=0] > <div>[index=0] > <main>[index=2] > Outlet[index=0] > RenderedRoute[index=0] > IssuesPage[index=0] > <div>[index=0] > withRouter(Connect(IssueTable))[index=3] > Connect(IssueTable)[index=0] > IssueTable[index=0] > <div>[index=0] > <table>[index=0] > <tbody>[index=1] > IssueRow[key=\"iss-280\"]"}
    - {mountId:mount:25,key:iss-290,logicalPath:"AppErrorBoundary[index=0] > Provider[index=0] > BrowserRouter[index=0] > Router[index=0] > ThemeProvider[index=0] > App[index=0] > Routes[index=0] > RenderedRoute[index=0] > RequireAuth[index=0] > Connect(AppShell)[index=0] > AppShell[index=0] > FeatureFlagsProvider[index=0] > <div>[index=0] > <main>[index=2] > Outlet[index=0] > RenderedRoute[index=0] > IssuesPage[index=0] > <div>[index=0] > withRouter(Connect(IssueTable))[index=3] > Connect(IssueTable)[index=0] > IssueTable[index=0] > <div>[index=0] > <table>[index=0] > <tbody>[index=1] > IssueRow[key=\"iss-290\"]"}
    - {mountId:mount:26,key:iss-311,logicalPath:"AppErrorBoundary[index=0] > Provider[index=0] > BrowserRouter[index=0] > Router[index=0] > ThemeProvider[index=0] > App[index=0] > Routes[index=0] > RenderedRoute[index=0] > RequireAuth[index=0] > Connect(AppShell)[index=0] > AppShell[index=0] > FeatureFlagsProvider[index=0] > <div>[index=0] > <main>[index=2] > Outlet[index=0] > RenderedRoute[index=0] > IssuesPage[index=0] > <div>[index=0] > withRouter(Connect(IssueTable))[index=3] > Connect(IssueTable)[index=0] > IssueTable[index=0] > <div>[index=0] > <table>[index=0] > <tbody>[index=1] > IssueRow[key=\"iss-311\"]"}
    - {mountId:mount:27,key:iss-321,logicalPath:"AppErrorBoundary[index=0] > Provider[index=0] > BrowserRouter[index=0] > Router[index=0] > ThemeProvider[index=0] > App[index=0] > Routes[index=0] > RenderedRoute[index=0] > RequireAuth[index=0] > Connect(AppShell)[index=0] > AppShell[index=0] > FeatureFlagsProvider[index=0] > <div>[index=0] > <main>[index=2] > Outlet[index=0] > RenderedRoute[index=0] > IssuesPage[index=0] > <div>[index=0] > withRouter(Connect(IssueTable))[index=3] > Connect(IssueTable)[index=0] > IssueTable[index=0] > <div>[index=0] > <table>[index=0] > <tbody>[index=1] > IssueRow[key=\"iss-321\"]"}
    - {mountId:mount:28,key:iss-334,logicalPath:"AppErrorBoundary[index=0] > Provider[index=0] > BrowserRouter[index=0] > Router[index=0] > ThemeProvider[index=0] > App[index=0] > Routes[index=0] > RenderedRoute[index=0] > RequireAuth[index=0] > Connect(AppShell)[index=0] > AppShell[index=0] > FeatureFlagsProvider[index=0] > <div>[index=0] > <main>[index=2] > Outlet[index=0] > RenderedRoute[index=0] > IssuesPage[index=0] > <div>[index=0] > withRouter(Connect(IssueTable))[index=3] > Connect(IssueTable)[index=0] > IssueTable[index=0] > <div>[index=0] > <table>[index=0] > <tbody>[index=1] > IssueRow[key=\"iss-334\"]"}
    - {mountId:mount:29,key:iss-347,logicalPath:"AppErrorBoundary[index=0] > Provider[index=0] > BrowserRouter[index=0] > Router[index=0] > ThemeProvider[index=0] > App[index=0] > Routes[index=0] > RenderedRoute[index=0] > RequireAuth[index=0] > Connect(AppShell)[index=0] > AppShell[index=0] > FeatureFlagsProvider[index=0] > <div>[index=0] > <main>[index=2] > Outlet[index=0] > RenderedRoute[index=0] > IssuesPage[index=0] > <div>[index=0] > withRouter(Connect(IssueTable))[index=3] > Connect(IssueTable)[index=0] > IssueTable[index=0] > <div>[index=0] > <table>[index=0] > <tbody>[index=1] > IssueRow[key=\"iss-347\"]"}
    - {mountId:mount:30,key:iss-350,logicalPath:"AppErrorBoundary[index=0] > Provider[index=0] > BrowserRouter[index=0] > Router[index=0] > ThemeProvider[index=0] > App[index=0] > Routes[index=0] > RenderedRoute[index=0] > RequireAuth[index=0] > Connect(AppShell)[index=0] > AppShell[index=0] > FeatureFlagsProvider[index=0] > <div>[index=0] > <main>[index=2] > Outlet[index=0] > RenderedRoute[index=0] > IssuesPage[index=0] > <div>[index=0] > withRouter(Connect(IssueTable))[index=3] > Connect(IssueTable)[index=0] > IssueTable[index=0] > <div>[index=0] > <table>[index=0] > <tbody>[index=1] > IssueRow[key=\"iss-350\"]"}
    - {mountId:mount:31,key:iss-360,logicalPath:"AppErrorBoundary[index=0] > Provider[index=0] > BrowserRouter[index=0] > Router[index=0] > ThemeProvider[index=0] > App[index=0] > Routes[index=0] > RenderedRoute[index=0] > RequireAuth[index=0] > Connect(AppShell)[index=0] > AppShell[index=0] > FeatureFlagsProvider[index=0] > <div>[index=0] > <main>[index=2] > Outlet[index=0] > RenderedRoute[index=0] > IssuesPage[index=0] > <div>[index=0] > withRouter(Connect(IssueTable))[index=3] > Connect(IssueTable)[index=0] > IssueTable[index=0] > <div>[index=0] > <table>[index=0] > <tbody>[index=1] > IssueRow[key=\"iss-360\"]"}
    - {mountId:mount:32,key:iss-362,logicalPath:"AppErrorBoundary[index=0] > Provider[index=0] > BrowserRouter[index=0] > Router[index=0] > ThemeProvider[index=0] > App[index=0] > Routes[index=0] > RenderedRoute[index=0] > RequireAuth[index=0] > Connect(AppShell)[index=0] > AppShell[index=0] > FeatureFlagsProvider[index=0] > <div>[index=0] > <main>[index=2] > Outlet[index=0] > RenderedRoute[index=0] > IssuesPage[index=0] > <div>[index=0] > withRouter(Connect(IssueTable))[index=3] > Connect(IssueTable)[index=0] > IssueTable[index=0] > <div>[index=0] > <table>[index=0] > <tbody>[index=1] > IssueRow[key=\"iss-362\"]"}
    - {mountId:mount:33,key:iss-368,logicalPath:"AppErrorBoundary[index=0] > Provider[index=0] > BrowserRouter[index=0] > Router[index=0] > ThemeProvider[index=0] > App[index=0] > Routes[index=0] > RenderedRoute[index=0] > RequireAuth[index=0] > Connect(AppShell)[index=0] > AppShell[index=0] > FeatureFlagsProvider[index=0] > <div>[index=0] > <main>[index=2] > Outlet[index=0] > RenderedRoute[index=0] > IssuesPage[index=0] > <div>[index=0] > withRouter(Connect(IssueTable))[index=3] > Connect(IssueTable)[index=0] > IssueTable[index=0] > <div>[index=0] > <table>[index=0] > <tbody>[index=1] > IssueRow[key=\"iss-368\"]"}
    - {mountId:mount:34,key:iss-369,logicalPath:"AppErrorBoundary[index=0] > Provider[index=0] > BrowserRouter[index=0] > Router[index=0] > ThemeProvider[index=0] > App[index=0] > Routes[index=0] > RenderedRoute[index=0] > RequireAuth[index=0] > Connect(AppShell)[index=0] > AppShell[index=0] > FeatureFlagsProvider[index=0] > <div>[index=0] > <main>[index=2] > Outlet[index=0] > RenderedRoute[index=0] > IssuesPage[index=0] > <div>[index=0] > withRouter(Connect(IssueTable))[index=3] > Connect(IssueTable)[index=0] > IssueTable[index=0] > <div>[index=0] > <table>[index=0] > <tbody>[index=1] > IssueRow[key=\"iss-369\"]"}
    - {mountId:mount:35,key:iss-385,logicalPath:"AppErrorBoundary[index=0] > Provider[index=0] > BrowserRouter[index=0] > Router[index=0] > ThemeProvider[index=0] > App[index=0] > Routes[index=0] > RenderedRoute[index=0] > RequireAuth[index=0] > Connect(AppShell)[index=0] > AppShell[index=0] > FeatureFlagsProvider[index=0] > <div>[index=0] > <main>[index=2] > Outlet[index=0] > RenderedRoute[index=0] > IssuesPage[index=0] > <div>[index=0] > withRouter(Connect(IssueTable))[index=3] > Connect(IssueTable)[index=0] > IssueTable[index=0] > <div>[index=0] > <table>[index=0] > <tbody>[index=1] > IssueRow[key=\"iss-385\"]"}
    - {mountId:mount:36,key:iss-399,logicalPath:"AppErrorBoundary[index=0] > Provider[index=0] > BrowserRouter[index=0] > Router[index=0] > ThemeProvider[index=0] > App[index=0] > Routes[index=0] > RenderedRoute[index=0] > RequireAuth[index=0] > Connect(AppShell)[index=0] > AppShell[index=0] > FeatureFlagsProvider[index=0] > <div>[index=0] > <main>[index=2] > Outlet[index=0] > RenderedRoute[index=0] > IssuesPage[index=0] > <div>[index=0] > withRouter(Connect(IssueTable))[index=3] > Connect(IssueTable)[index=0] > IssueTable[index=0] > <div>[index=0] > <table>[index=0] > <tbody>[index=1] > IssueRow[key=\"iss-399\"]"}
    - {mountId:mount:37,key:iss-420,logicalPath:"AppErrorBoundary[index=0] > Provider[index=0] > BrowserRouter[index=0] > Router[index=0] > ThemeProvider[index=0] > App[index=0] > Routes[index=0] > RenderedRoute[index=0] > RequireAuth[index=0] > Connect(AppShell)[index=0] > AppShell[index=0] > FeatureFlagsProvider[index=0] > <div>[index=0] > <main>[index=2] > Outlet[index=0] > RenderedRoute[index=0] > IssuesPage[index=0] > <div>[index=0] > withRouter(Connect(IssueTable))[index=3] > Connect(IssueTable)[index=0] > IssueTable[index=0] > <div>[index=0] > <table>[index=0] > <tbody>[index=1] > IssueRow[key=\"iss-420\"]"}
    - {mountId:mount:38,key:iss-427,logicalPath:"AppErrorBoundary[index=0] > Provider[index=0] > BrowserRouter[index=0] > Router[index=0] > ThemeProvider[index=0] > App[index=0] > Routes[index=0] > RenderedRoute[index=0] > RequireAuth[index=0] > Connect(AppShell)[index=0] > AppShell[index=0] > FeatureFlagsProvider[index=0] > <div>[index=0] > <main>[index=2] > Outlet[index=0] > RenderedRoute[index=0] > IssuesPage[index=0] > <div>[index=0] > withRouter(Connect(IssueTable))[index=3] > Connect(IssueTable)[index=0] > IssueTable[index=0] > <div>[index=0] > <table>[index=0] > <tbody>[index=1] > IssueRow[key=\"iss-427\"]"}
    - {mountId:mount:39,key:iss-444,logicalPath:"AppErrorBoundary[index=0] > Provider[index=0] > BrowserRouter[index=0] > Router[index=0] > ThemeProvider[index=0] > App[index=0] > Routes[index=0] > RenderedRoute[index=0] > RequireAuth[index=0] > Connect(AppShell)[index=0] > AppShell[index=0] > FeatureFlagsProvider[index=0] > <div>[index=0] > <main>[index=2] > Outlet[index=0] > RenderedRoute[index=0] > IssuesPage[index=0] > <div>[index=0] > withRouter(Connect(IssueTable))[index=3] > Connect(IssueTable)[index=0] > IssueTable[index=0] > <div>[index=0] > <table>[index=0] > <tbody>[index=1] > IssueRow[key=\"iss-444\"]"}
    - {mountId:mount:40,key:iss-498,logicalPath:"AppErrorBoundary[index=0] > Provider[index=0] > BrowserRouter[index=0] > Router[index=0] > ThemeProvider[index=0] > App[index=0] > Routes[index=0] > RenderedRoute[index=0] > RequireAuth[index=0] > Connect(AppShell)[index=0] > AppShell[index=0] > FeatureFlagsProvider[index=0] > <div>[index=0] > <main>[index=2] > Outlet[index=0] > RenderedRoute[index=0] > IssuesPage[index=0] > <div>[index=0] > withRouter(Connect(IssueTable))[index=3] > Connect(IssueTable)[index=0] > IssueTable[index=0] > <div>[index=0] > <table>[index=0] > <tbody>[index=1] > IssueRow[key=\"iss-498\"]"}
    - {mountId:mount:41,key:iss-499,logicalPath:"AppErrorBoundary[index=0] > Provider[index=0] > BrowserRouter[index=0] > Router[index=0] > ThemeProvider[index=0] > App[index=0] > Routes[index=0] > RenderedRoute[index=0] > RequireAuth[index=0] > Connect(AppShell)[index=0] > AppShell[index=0] > FeatureFlagsProvider[index=0] > <div>[index=0] > <main>[index=2] > Outlet[index=0] > RenderedRoute[index=0] > IssuesPage[index=0] > <div>[index=0] > withRouter(Connect(IssueTable))[index=3] > Connect(IssueTable)[index=0] > IssueTable[index=0] > <div>[index=0] > <table>[index=0] > <tbody>[index=1] > IssueRow[key=\"iss-499\"]"}
    - {mountId:mount:42,key:iss-531,logicalPath:"AppErrorBoundary[index=0] > Provider[index=0] > BrowserRouter[index=0] > Router[index=0] > ThemeProvider[index=0] > App[index=0] > Routes[index=0] > RenderedRoute[index=0] > RequireAuth[index=0] > Connect(AppShell)[index=0] > AppShell[index=0] > FeatureFlagsProvider[index=0] > <div>[index=0] > <main>[index=2] > Outlet[index=0] > RenderedRoute[index=0] > IssuesPage[index=0] > <div>[index=0] > withRouter(Connect(IssueTable))[index=3] > Connect(IssueTable)[index=0] > IssueTable[index=0] > <div>[index=0] > <table>[index=0] > <tbody>[index=1] > IssueRow[key=\"iss-531\"]"}
    - {mountId:mount:43,key:iss-557,logicalPath:"AppErrorBoundary[index=0] > Provider[index=0] > BrowserRouter[index=0] > Router[index=0] > ThemeProvider[index=0] > App[index=0] > Routes[index=0] > RenderedRoute[index=0] > RequireAuth[index=0] > Connect(AppShell)[index=0] > AppShell[index=0] > FeatureFlagsProvider[index=0] > <div>[index=0] > <main>[index=2] > Outlet[index=0] > RenderedRoute[index=0] > IssuesPage[index=0] > <div>[index=0] > withRouter(Connect(IssueTable))[index=3] > Connect(IssueTable)[index=0] > IssueTable[index=0] > <div>[index=0] > <table>[index=0] > <tbody>[index=1] > IssueRow[key=\"iss-557\"]"}
    - {mountId:mount:44,key:iss-577,logicalPath:"AppErrorBoundary[index=0] > Provider[index=0] > BrowserRouter[index=0] > Router[index=0] > ThemeProvider[index=0] > App[index=0] > Routes[index=0] > RenderedRoute[index=0] > RequireAuth[index=0] > Connect(AppShell)[index=0] > AppShell[index=0] > FeatureFlagsProvider[index=0] > <div>[index=0] > <main>[index=2] > Outlet[index=0] > RenderedRoute[index=0] > IssuesPage[index=0] > <div>[index=0] > withRouter(Connect(IssueTable))[index=3] > Connect(IssueTable)[index=0] > IssueTable[index=0] > <div>[index=0] > <table>[index=0] > <tbody>[index=1] > IssueRow[key=\"iss-577\"]"}
    - {mountId:mount:45,key:iss-584,logicalPath:"AppErrorBoundary[index=0] > Provider[index=0] > BrowserRouter[index=0] > Router[index=0] > ThemeProvider[index=0] > App[index=0] > Routes[index=0] > RenderedRoute[index=0] > RequireAuth[index=0] > Connect(AppShell)[index=0] > AppShell[index=0] > FeatureFlagsProvider[index=0] > <div>[index=0] > <main>[index=2] > Outlet[index=0] > RenderedRoute[index=0] > IssuesPage[index=0] > <div>[index=0] > withRouter(Connect(IssueTable))[index=3] > Connect(IssueTable)[index=0] > IssueTable[index=0] > <div>[index=0] > <table>[index=0] > <tbody>[index=1] > IssueRow[key=\"iss-584\"]"}
    - {mountId:mount:46,key:iss-597,logicalPath:"AppErrorBoundary[index=0] > Provider[index=0] > BrowserRouter[index=0] > Router[index=0] > ThemeProvider[index=0] > App[index=0] > Routes[index=0] > RenderedRoute[index=0] > RequireAuth[index=0] > Connect(AppShell)[index=0] > AppShell[index=0] > FeatureFlagsProvider[index=0] > <div>[index=0] > <main>[index=2] > Outlet[index=0] > RenderedRoute[index=0] > IssuesPage[index=0] > <div>[index=0] > withRouter(Connect(IssueTable))[index=3] > Connect(IssueTable)[index=0] > IssueTable[index=0] > <div>[index=0] > <table>[index=0] > <tbody>[index=1] > IssueRow[key=\"iss-597\"]"}
    - {mountId:mount:47,key:iss-613,logicalPath:"AppErrorBoundary[index=0] > Provider[index=0] > BrowserRouter[index=0] > Router[index=0] > ThemeProvider[index=0] > App[index=0] > Routes[index=0] > RenderedRoute[index=0] > RequireAuth[index=0] > Connect(AppShell)[index=0] > AppShell[index=0] > FeatureFlagsProvider[index=0] > <div>[index=0] > <main>[index=2] > Outlet[index=0] > RenderedRoute[index=0] > IssuesPage[index=0] > <div>[index=0] > withRouter(Connect(IssueTable))[index=3] > Connect(IssueTable)[index=0] > IssueTable[index=0] > <div>[index=0] > <table>[index=0] > <tbody>[index=1] > IssueRow[key=\"iss-613\"]"}
    - {mountId:mount:48,key:iss-616,logicalPath:"AppErrorBoundary[index=0] > Provider[index=0] > BrowserRouter[index=0] > Router[index=0] > ThemeProvider[index=0] > App[index=0] > Routes[index=0] > RenderedRoute[index=0] > RequireAuth[index=0] > Connect(AppShell)[index=0] > AppShell[index=0] > FeatureFlagsProvider[index=0] > <div>[index=0] > <main>[index=2] > Outlet[index=0] > RenderedRoute[index=0] > IssuesPage[index=0] > <div>[index=0] > withRouter(Connect(IssueTable))[index=3] > Connect(IssueTable)[index=0] > IssueTable[index=0] > <div>[index=0] > <table>[index=0] > <tbody>[index=1] > IssueRow[key=\"iss-616\"]"}
    - {mountId:mount:49,key:iss-635,logicalPath:"AppErrorBoundary[index=0] > Provider[index=0] > BrowserRouter[index=0] > Router[index=0] > ThemeProvider[index=0] > App[index=0] > Routes[index=0] > RenderedRoute[index=0] > RequireAuth[index=0] > Connect(AppShell)[index=0] > AppShell[index=0] > FeatureFlagsProvider[index=0] > <div>[index=0] > <main>[index=2] > Outlet[index=0] > RenderedRoute[index=0] > IssuesPage[index=0] > <div>[index=0] > withRouter(Connect(IssueTable))[index=3] > Connect(IssueTable)[index=0] > IssueTable[index=0] > <div>[index=0] > <table>[index=0] > <tbody>[index=1] > IssueRow[key=\"iss-635\"]"}
    - {mountId:mount:50,key:iss-713,logicalPath:"AppErrorBoundary[index=0] > Provider[index=0] > BrowserRouter[index=0] > Router[index=0] > ThemeProvider[index=0] > App[index=0] > Routes[index=0] > RenderedRoute[index=0] > RequireAuth[index=0] > Connect(AppShell)[index=0] > AppShell[index=0] > FeatureFlagsProvider[index=0] > <div>[index=0] > <main>[index=2] > Outlet[index=0] > RenderedRoute[index=0] > IssuesPage[index=0] > <div>[index=0] > withRouter(Connect(IssueTable))[index=3] > Connect(IssueTable)[index=0] > IssueTable[index=0] > <div>[index=0] > <table>[index=0] > <tbody>[index=1] > IssueRow[key=\"iss-713\"]"}
    - {mountId:mount:51,key:iss-715,logicalPath:"AppErrorBoundary[index=0] > Provider[index=0] > BrowserRouter[index=0] > Router[index=0] > ThemeProvider[index=0] > App[index=0] > Routes[index=0] > RenderedRoute[index=0] > RequireAuth[index=0] > Connect(AppShell)[index=0] > AppShell[index=0] > FeatureFlagsProvider[index=0] > <div>[index=0] > <main>[index=2] > Outlet[index=0] > RenderedRoute[index=0] > IssuesPage[index=0] > <div>[index=0] > withRouter(Connect(IssueTable))[index=3] > Connect(IssueTable)[index=0] > IssueTable[index=0] > <div>[index=0] > <table>[index=0] > <tbody>[index=1] > IssueRow[key=\"iss-715\"]"}
    - {mountId:mount:52,key:iss-725,logicalPath:"AppErrorBoundary[index=0] > Provider[index=0] > BrowserRouter[index=0] > Router[index=0] > ThemeProvider[index=0] > App[index=0] > Routes[index=0] > RenderedRoute[index=0] > RequireAuth[index=0] > Connect(AppShell)[index=0] > AppShell[index=0] > FeatureFlagsProvider[index=0] > <div>[index=0] > <main>[index=2] > Outlet[index=0] > RenderedRoute[index=0] > IssuesPage[index=0] > <div>[index=0] > withRouter(Connect(IssueTable))[index=3] > Connect(IssueTable)[index=0] > IssueTable[index=0] > <div>[index=0] > <table>[index=0] > <tbody>[index=1] > IssueRow[key=\"iss-725\"]"}
    - {mountId:mount:53,key:iss-727,logicalPath:"AppErrorBoundary[index=0] > Provider[index=0] > BrowserRouter[index=0] > Router[index=0] > ThemeProvider[index=0] > App[index=0] > Routes[index=0] > RenderedRoute[index=0] > RequireAuth[index=0] > Connect(AppShell)[index=0] > AppShell[index=0] > FeatureFlagsProvider[index=0] > <div>[index=0] > <main>[index=2] > Outlet[index=0] > RenderedRoute[index=0] > IssuesPage[index=0] > <div>[index=0] > withRouter(Connect(IssueTable))[index=3] > Connect(IssueTable)[index=0] > IssueTable[index=0] > <div>[index=0] > <table>[index=0] > <tbody>[index=1] > IssueRow[key=\"iss-727\"]"}
    - {mountId:mount:54,key:iss-728,logicalPath:"AppErrorBoundary[index=0] > Provider[index=0] > BrowserRouter[index=0] > Router[index=0] > ThemeProvider[index=0] > App[index=0] > Routes[index=0] > RenderedRoute[index=0] > RequireAuth[index=0] > Connect(AppShell)[index=0] > AppShell[index=0] > FeatureFlagsProvider[index=0] > <div>[index=0] > <main>[index=2] > Outlet[index=0] > RenderedRoute[index=0] > IssuesPage[index=0] > <div>[index=0] > withRouter(Connect(IssueTable))[index=3] > Connect(IssueTable)[index=0] > IssueTable[index=0] > <div>[index=0] > <table>[index=0] > <tbody>[index=1] > IssueRow[key=\"iss-728\"]"}
    - {mountId:mount:55,key:iss-736,logicalPath:"AppErrorBoundary[index=0] > Provider[index=0] > BrowserRouter[index=0] > Router[index=0] > ThemeProvider[index=0] > App[index=0] > Routes[index=0] > RenderedRoute[index=0] > RequireAuth[index=0] > Connect(AppShell)[index=0] > AppShell[index=0] > FeatureFlagsProvider[index=0] > <div>[index=0] > <main>[index=2] > Outlet[index=0] > RenderedRoute[index=0] > IssuesPage[index=0] > <div>[index=0] > withRouter(Connect(IssueTable))[index=3] > Connect(IssueTable)[index=0] > IssueTable[index=0] > <div>[index=0] > <table>[index=0] > <tbody>[index=1] > IssueRow[key=\"iss-736\"]"}
    - {mountId:mount:56,key:iss-769,logicalPath:"AppErrorBoundary[index=0] > Provider[index=0] > BrowserRouter[index=0] > Router[index=0] > ThemeProvider[index=0] > App[index=0] > Routes[index=0] > RenderedRoute[index=0] > RequireAuth[index=0] > Connect(AppShell)[index=0] > AppShell[index=0] > FeatureFlagsProvider[index=0] > <div>[index=0] > <main>[index=2] > Outlet[index=0] > RenderedRoute[index=0] > IssuesPage[index=0] > <div>[index=0] > withRouter(Connect(IssueTable))[index=3] > Connect(IssueTable)[index=0] > IssueTable[index=0] > <div>[index=0] > <table>[index=0] > <tbody>[index=1] > IssueRow[key=\"iss-769\"]"}
    - {mountId:mount:57,key:iss-795,logicalPath:"AppErrorBoundary[index=0] > Provider[index=0] > BrowserRouter[index=0] > Router[index=0] > ThemeProvider[index=0] > App[index=0] > Routes[index=0] > RenderedRoute[index=0] > RequireAuth[index=0] > Connect(AppShell)[index=0] > AppShell[index=0] > FeatureFlagsProvider[index=0] > <div>[index=0] > <main>[index=2] > Outlet[index=0] > RenderedRoute[index=0] > IssuesPage[index=0] > <div>[index=0] > withRouter(Connect(IssueTable))[index=3] > Connect(IssueTable)[index=0] > IssueTable[index=0] > <div>[index=0] > <table>[index=0] > <tbody>[index=1] > IssueRow[key=\"iss-795\"]"}
    - {mountId:mount:58,key:iss-813,logicalPath:"AppErrorBoundary[index=0] > Provider[index=0] > BrowserRouter[index=0] > Router[index=0] > ThemeProvider[index=0] > App[index=0] > Routes[index=0] > RenderedRoute[index=0] > RequireAuth[index=0] > Connect(AppShell)[index=0] > AppShell[index=0] > FeatureFlagsProvider[index=0] > <div>[index=0] > <main>[index=2] > Outlet[index=0] > RenderedRoute[index=0] > IssuesPage[index=0] > <div>[index=0] > withRouter(Connect(IssueTable))[index=3] > Connect(IssueTable)[index=0] > IssueTable[index=0] > <div>[index=0] > <table>[index=0] > <tbody>[index=1] > IssueRow[key=\"iss-813\"]"}
    - {mountId:mount:59,key:iss-815,logicalPath:"AppErrorBoundary[index=0] > Provider[index=0] > BrowserRouter[index=0] > Router[index=0] > ThemeProvider[index=0] > App[index=0] > Routes[index=0] > RenderedRoute[index=0] > RequireAuth[index=0] > Connect(AppShell)[index=0] > AppShell[index=0] > FeatureFlagsProvider[index=0] > <div>[index=0] > <main>[index=2] > Outlet[index=0] > RenderedRoute[index=0] > IssuesPage[index=0] > <div>[index=0] > withRouter(Connect(IssueTable))[index=3] > Connect(IssueTable)[index=0] > IssueTable[index=0] > <div>[index=0] > <table>[index=0] > <tbody>[index=1] > IssueRow[key=\"iss-815\"]"}
    - {mountId:mount:60,key:iss-869,logicalPath:"AppErrorBoundary[index=0] > Provider[index=0] > BrowserRouter[index=0] > Router[index=0] > ThemeProvider[index=0] > App[index=0] > Routes[index=0] > RenderedRoute[index=0] > RequireAuth[index=0] > Connect(AppShell)[index=0] > AppShell[index=0] > FeatureFlagsProvider[index=0] > <div>[index=0] > <main>[index=2] > Outlet[index=0] > RenderedRoute[index=0] > IssuesPage[index=0] > <div>[index=0] > withRouter(Connect(IssueTable))[index=3] > Connect(IssueTable)[index=0] > IssueTable[index=0] > <div>[index=0] > <table>[index=0] > <tbody>[index=1] > IssueRow[key=\"iss-869\"]"}
    - {mountId:mount:61,key:iss-874,logicalPath:"AppErrorBoundary[index=0] > Provider[index=0] > BrowserRouter[index=0] > Router[index=0] > ThemeProvider[index=0] > App[index=0] > Routes[index=0] > RenderedRoute[index=0] > RequireAuth[index=0] > Connect(AppShell)[index=0] > AppShell[index=0] > FeatureFlagsProvider[index=0] > <div>[index=0] > <main>[index=2] > Outlet[index=0] > RenderedRoute[index=0] > IssuesPage[index=0] > <div>[index=0] > withRouter(Connect(IssueTable))[index=3] > Connect(IssueTable)[index=0] > IssueTable[index=0] > <div>[index=0] > <table>[index=0] > <tbody>[index=1] > IssueRow[key=\"iss-874\"]"}
    - {mountId:mount:62,key:iss-877,logicalPath:"AppErrorBoundary[index=0] > Provider[index=0] > BrowserRouter[index=0] > Router[index=0] > ThemeProvider[index=0] > App[index=0] > Routes[index=0] > RenderedRoute[index=0] > RequireAuth[index=0] > Connect(AppShell)[index=0] > AppShell[index=0] > FeatureFlagsProvider[index=0] > <div>[index=0] > <main>[index=2] > Outlet[index=0] > RenderedRoute[index=0] > IssuesPage[index=0] > <div>[index=0] > withRouter(Connect(IssueTable))[index=3] > Connect(IssueTable)[index=0] > IssueTable[index=0] > <div>[index=0] > <table>[index=0] > <tbody>[index=1] > IssueRow[key=\"iss-877\"]"}
    - {mountId:mount:63,key:iss-900,logicalPath:"AppErrorBoundary[index=0] > Provider[index=0] > BrowserRouter[index=0] > Router[index=0] > ThemeProvider[index=0] > App[index=0] > Routes[index=0] > RenderedRoute[index=0] > RequireAuth[index=0] > Connect(AppShell)[index=0] > AppShell[index=0] > FeatureFlagsProvider[index=0] > <div>[index=0] > <main>[index=2] > Outlet[index=0] > RenderedRoute[index=0] > IssuesPage[index=0] > <div>[index=0] > withRouter(Connect(IssueTable))[index=3] > Connect(IssueTable)[index=0] > IssueTable[index=0] > <div>[index=0] > <table>[index=0] > <tbody>[index=1] > IssueRow[key=\"iss-900\"]"}
    - {mountId:mount:64,key:iss-911,logicalPath:"AppErrorBoundary[index=0] > Provider[index=0] > BrowserRouter[index=0] > Router[index=0] > ThemeProvider[index=0] > App[index=0] > Routes[index=0] > RenderedRoute[index=0] > RequireAuth[index=0] > Connect(AppShell)[index=0] > AppShell[index=0] > FeatureFlagsProvider[index=0] > <div>[index=0] > <main>[index=2] > Outlet[index=0] > RenderedRoute[index=0] > IssuesPage[index=0] > <div>[index=0] > withRouter(Connect(IssueTable))[index=3] > Connect(IssueTable)[index=0] > IssueTable[index=0] > <div>[index=0] > <table>[index=0] > <tbody>[index=1] > IssueRow[key=\"iss-911\"]"}
    - {mountId:mount:65,key:iss-923,logicalPath:"AppErrorBoundary[index=0] > Provider[index=0] > BrowserRouter[index=0] > Router[index=0] > ThemeProvider[index=0] > App[index=0] > Routes[index=0] > RenderedRoute[index=0] > RequireAuth[index=0] > Connect(AppShell)[index=0] > AppShell[index=0] > FeatureFlagsProvider[index=0] > <div>[index=0] > <main>[index=2] > Outlet[index=0] > RenderedRoute[index=0] > IssuesPage[index=0] > <div>[index=0] > withRouter(Connect(IssueTable))[index=3] > Connect(IssueTable)[index=0] > IssueTable[index=0] > <div>[index=0] > <table>[index=0] > <tbody>[index=1] > IssueRow[key=\"iss-923\"]"}
    - {mountId:mount:66,key:iss-927,logicalPath:"AppErrorBoundary[index=0] > Provider[index=0] > BrowserRouter[index=0] > Router[index=0] > ThemeProvider[index=0] > App[index=0] > Routes[index=0] > RenderedRoute[index=0] > RequireAuth[index=0] > Connect(AppShell)[index=0] > AppShell[index=0] > FeatureFlagsProvider[index=0] > <div>[index=0] > <main>[index=2] > Outlet[index=0] > RenderedRoute[index=0] > IssuesPage[index=0] > <div>[index=0] > withRouter(Connect(IssueTable))[index=3] > Connect(IssueTable)[index=0] > IssueTable[index=0] > <div>[index=0] > <table>[index=0] > <tbody>[index=1] > IssueRow[key=\"iss-927\"]"}
    - {mountId:mount:67,key:iss-966,logicalPath:"AppErrorBoundary[index=0] > Provider[index=0] > BrowserRouter[index=0] > Router[index=0] > ThemeProvider[index=0] > App[index=0] > Routes[index=0] > RenderedRoute[index=0] > RequireAuth[index=0] > Connect(AppShell)[index=0] > AppShell[index=0] > FeatureFlagsProvider[index=0] > <div>[index=0] > <main>[index=2] > Outlet[index=0] > RenderedRoute[index=0] > IssuesPage[index=0] > <div>[index=0] > withRouter(Connect(IssueTable))[index=3] > Connect(IssueTable)[index=0] > IssueTable[index=0] > <div>[index=0] > <table>[index=0] > <tbody>[index=1] > IssueRow[key=\"iss-966\"]"}
    - {mountId:mount:68,key:iss-972,logicalPath:"AppErrorBoundary[index=0] > Provider[index=0] > BrowserRouter[index=0] > Router[index=0] > ThemeProvider[index=0] > App[index=0] > Routes[index=0] > RenderedRoute[index=0] > RequireAuth[index=0] > Connect(AppShell)[index=0] > AppShell[index=0] > FeatureFlagsProvider[index=0] > <div>[index=0] > <main>[index=2] > Outlet[index=0] > RenderedRoute[index=0] > IssuesPage[index=0] > <div>[index=0] > withRouter(Connect(IssueTable))[index=3] > Connect(IssueTable)[index=0] > IssueTable[index=0] > <div>[index=0] > <table>[index=0] > <tbody>[index=1] > IssueRow[key=\"iss-972\"]"}
    - {mountId:mount:69,key:iss-992,logicalPath:"AppErrorBoundary[index=0] > Provider[index=0] > BrowserRouter[index=0] > Router[index=0] > ThemeProvider[index=0] > App[index=0] > Routes[index=0] > RenderedRoute[index=0] > RequireAuth[index=0] > Connect(AppShell)[index=0] > AppShell[index=0] > FeatureFlagsProvider[index=0] > <div>[index=0] > <main>[index=2] > Outlet[index=0] > RenderedRoute[index=0] > IssuesPage[index=0] > <div>[index=0] > withRouter(Connect(IssueTable))[index=3] > Connect(IssueTable)[index=0] > IssueTable[index=0] > <div>[index=0] > <table>[index=0] > <tbody>[index=1] > IssueRow[key=\"iss-992\"]"}
    - {mountId:mount:70,key:iss-1064,logicalPath:"AppErrorBoundary[index=0] > Provider[index=0] > BrowserRouter[index=0] > Router[index=0] > ThemeProvider[index=0] > App[index=0] > Routes[index=0] > RenderedRoute[index=0] > RequireAuth[index=0] > Connect(AppShell)[index=0] > AppShell[index=0] > FeatureFlagsProvider[index=0] > <div>[index=0] > <main>[index=2] > Outlet[index=0] > RenderedRoute[index=0] > IssuesPage[index=0] > <div>[index=0] > withRouter(Connect(IssueTable))[index=3] > Connect(IssueTable)[index=0] > IssueTable[index=0] > <div>[index=0] > <table>[index=0] > <tbody>[index=1] > IssueRow[key=\"iss-1064\"]"}
    - {mountId:mount:71,key:iss-1095,logicalPath:"AppErrorBoundary[index=0] > Provider[index=0] > BrowserRouter[index=0] > Router[index=0] > ThemeProvider[index=0] > App[index=0] > Routes[index=0] > RenderedRoute[index=0] > RequireAuth[index=0] > Connect(AppShell)[index=0] > AppShell[index=0] > FeatureFlagsProvider[index=0] > <div>[index=0] > <main>[index=2] > Outlet[index=0] > RenderedRoute[index=0] > IssuesPage[index=0] > <div>[index=0] > withRouter(Connect(IssueTable))[index=3] > Connect(IssueTable)[index=0] > IssueTable[index=0] > <div>[index=0] > <table>[index=0] > <tbody>[index=1] > IssueRow[key=\"iss-1095\"]"}
    - {mountId:mount:72,key:iss-1124,logicalPath:"AppErrorBoundary[index=0] > Provider[index=0] > BrowserRouter[index=0] > Router[index=0] > ThemeProvider[index=0] > App[index=0] > Routes[index=0] > RenderedRoute[index=0] > RequireAuth[index=0] > Connect(AppShell)[index=0] > AppShell[index=0] > FeatureFlagsProvider[index=0] > <div>[index=0] > <main>[index=2] > Outlet[index=0] > RenderedRoute[index=0] > IssuesPage[index=0] > <div>[index=0] > withRouter(Connect(IssueTable))[index=3] > Connect(IssueTable)[index=0] > IssueTable[index=0] > <div>[index=0] > <table>[index=0] > <tbody>[index=1] > IssueRow[key=\"iss-1124\"]"}
    - {mountId:mount:73,key:iss-1131,logicalPath:"AppErrorBoundary[index=0] > Provider[index=0] > BrowserRouter[index=0] > Router[index=0] > ThemeProvider[index=0] > App[index=0] > Routes[index=0] > RenderedRoute[index=0] > RequireAuth[index=0] > Connect(AppShell)[index=0] > AppShell[index=0] > FeatureFlagsProvider[index=0] > <div>[index=0] > <main>[index=2] > Outlet[index=0] > RenderedRoute[index=0] > IssuesPage[index=0] > <div>[index=0] > withRouter(Connect(IssueTable))[index=3] > Connect(IssueTable)[index=0] > IssueTable[index=0] > <div>[index=0] > <table>[index=0] > <tbody>[index=1] > IssueRow[key=\"iss-1131\"]"}
    - {mountId:mount:74,key:iss-1143,logicalPath:"AppErrorBoundary[index=0] > Provider[index=0] > BrowserRouter[index=0] > Router[index=0] > ThemeProvider[index=0] > App[index=0] > Routes[index=0] > RenderedRoute[index=0] > RequireAuth[index=0] > Connect(AppShell)[index=0] > AppShell[index=0] > FeatureFlagsProvider[index=0] > <div>[index=0] > <main>[index=2] > Outlet[index=0] > RenderedRoute[index=0] > IssuesPage[index=0] > <div>[index=0] > withRouter(Connect(IssueTable))[index=3] > Connect(IssueTable)[index=0] > IssueTable[index=0] > <div>[index=0] > <table>[index=0] > <tbody>[index=1] > IssueRow[key=\"iss-1143\"]"}
    - {mountId:mount:75,key:iss-1187,logicalPath:"AppErrorBoundary[index=0] > Provider[index=0] > BrowserRouter[index=0] > Router[index=0] > ThemeProvider[index=0] > App[index=0] > Routes[index=0] > RenderedRoute[index=0] > RequireAuth[index=0] > Connect(AppShell)[index=0] > AppShell[index=0] > FeatureFlagsProvider[index=0] > <div>[index=0] > <main>[index=2] > Outlet[index=0] > RenderedRoute[index=0] > IssuesPage[index=0] > <div>[index=0] > withRouter(Connect(IssueTable))[index=3] > Connect(IssueTable)[index=0] > IssueTable[index=0] > <div>[index=0] > <table>[index=0] > <tbody>[index=1] > IssueRow[key=\"iss-1187\"]"}
    - {mountId:mount:76,key:iss-1212,logicalPath:"AppErrorBoundary[index=0] > Provider[index=0] > BrowserRouter[index=0] > Router[index=0] > ThemeProvider[index=0] > App[index=0] > Routes[index=0] > RenderedRoute[index=0] > RequireAuth[index=0] > Connect(AppShell)[index=0] > AppShell[index=0] > FeatureFlagsProvider[index=0] > <div>[index=0] > <main>[index=2] > Outlet[index=0] > RenderedRoute[index=0] > IssuesPage[index=0] > <div>[index=0] > withRouter(Connect(IssueTable))[index=3] > Connect(IssueTable)[index=0] > IssueTable[index=0] > <div>[index=0] > <table>[index=0] > <tbody>[index=1] > IssueRow[key=\"iss-1212\"]"}
    - {mountId:mount:77,key:iss-1217,logicalPath:"AppErrorBoundary[index=0] > Provider[index=0] > BrowserRouter[index=0] > Router[index=0] > ThemeProvider[index=0] > App[index=0] > Routes[index=0] > RenderedRoute[index=0] > RequireAuth[index=0] > Connect(AppShell)[index=0] > AppShell[index=0] > FeatureFlagsProvider[index=0] > <div>[index=0] > <main>[index=2] > Outlet[index=0] > RenderedRoute[index=0] > IssuesPage[index=0] > <div>[index=0] > withRouter(Connect(IssueTable))[index=3] > Connect(IssueTable)[index=0] > IssueTable[index=0] > <div>[index=0] > <table>[index=0] > <tbody>[index=1] > IssueRow[key=\"iss-1217\"]"}
    - {mountId:mount:78,key:iss-1245,logicalPath:"AppErrorBoundary[index=0] > Provider[index=0] > BrowserRouter[index=0] > Router[index=0] > ThemeProvider[index=0] > App[index=0] > Routes[index=0] > RenderedRoute[index=0] > RequireAuth[index=0] > Connect(AppShell)[index=0] > AppShell[index=0] > FeatureFlagsProvider[index=0] > <div>[index=0] > <main>[index=2] > Outlet[index=0] > RenderedRoute[index=0] > IssuesPage[index=0] > <div>[index=0] > withRouter(Connect(IssueTable))[index=3] > Connect(IssueTable)[index=0] > IssueTable[index=0] > <div>[index=0] > <table>[index=0] > <tbody>[index=1] > IssueRow[key=\"iss-1245\"]"}
    - {mountId:mount:79,key:iss-1262,logicalPath:"AppErrorBoundary[index=0] > Provider[index=0] > BrowserRouter[index=0] > Router[index=0] > ThemeProvider[index=0] > App[index=0] > Routes[index=0] > RenderedRoute[index=0] > RequireAuth[index=0] > Connect(AppShell)[index=0] > AppShell[index=0] > FeatureFlagsProvider[index=0] > <div>[index=0] > <main>[index=2] > Outlet[index=0] > RenderedRoute[index=0] > IssuesPage[index=0] > <div>[index=0] > withRouter(Connect(IssueTable))[index=3] > Connect(IssueTable)[index=0] > IssueTable[index=0] > <div>[index=0] > <table>[index=0] > <tbody>[index=1] > IssueRow[key=\"iss-1262\"]"}
    - {mountId:mount:80,key:iss-1268,logicalPath:"AppErrorBoundary[index=0] > Provider[index=0] > BrowserRouter[index=0] > Router[index=0] > ThemeProvider[index=0] > App[index=0] > Routes[index=0] > RenderedRoute[index=0] > RequireAuth[index=0] > Connect(AppShell)[index=0] > AppShell[index=0] > FeatureFlagsProvider[index=0] > <div>[index=0] > <main>[index=2] > Outlet[index=0] > RenderedRoute[index=0] > IssuesPage[index=0] > <div>[index=0] > withRouter(Connect(IssueTable))[index=3] > Connect(IssueTable)[index=0] > IssueTable[index=0] > <div>[index=0] > <table>[index=0] > <tbody>[index=1] > IssueRow[key=\"iss-1268\"]"}
    - {mountId:mount:81,key:iss-1355,logicalPath:"AppErrorBoundary[index=0] > Provider[index=0] > BrowserRouter[index=0] > Router[index=0] > ThemeProvider[index=0] > App[index=0] > Routes[index=0] > RenderedRoute[index=0] > RequireAuth[index=0] > Connect(AppShell)[index=0] > AppShell[index=0] > FeatureFlagsProvider[index=0] > <div>[index=0] > <main>[index=2] > Outlet[index=0] > RenderedRoute[index=0] > IssuesPage[index=0] > <div>[index=0] > withRouter(Connect(IssueTable))[index=3] > Connect(IssueTable)[index=0] > IssueTable[index=0] > <div>[index=0] > <table>[index=0] > <tbody>[index=1] > IssueRow[key=\"iss-1355\"]"}
    - {mountId:mount:82,key:iss-1356,logicalPath:"AppErrorBoundary[index=0] > Provider[index=0] > BrowserRouter[index=0] > Router[index=0] > ThemeProvider[index=0] > App[index=0] > Routes[index=0] > RenderedRoute[index=0] > RequireAuth[index=0] > Connect(AppShell)[index=0] > AppShell[index=0] > FeatureFlagsProvider[index=0] > <div>[index=0] > <main>[index=2] > Outlet[index=0] > RenderedRoute[index=0] > IssuesPage[index=0] > <div>[index=0] > withRouter(Connect(IssueTable))[index=3] > Connect(IssueTable)[index=0] > IssueTable[index=0] > <div>[index=0] > <table>[index=0] > <tbody>[index=1] > IssueRow[key=\"iss-1356\"]"}
    - {mountId:mount:83,key:iss-1363,logicalPath:"AppErrorBoundary[index=0] > Provider[index=0] > BrowserRouter[index=0] > Router[index=0] > ThemeProvider[index=0] > App[index=0] > Routes[index=0] > RenderedRoute[index=0] > RequireAuth[index=0] > Connect(AppShell)[index=0] > AppShell[index=0] > FeatureFlagsProvider[index=0] > <div>[index=0] > <main>[index=2] > Outlet[index=0] > RenderedRoute[index=0] > IssuesPage[index=0] > <div>[index=0] > withRouter(Connect(IssueTable))[index=3] > Connect(IssueTable)[index=0] > IssueTable[index=0] > <div>[index=0] > <table>[index=0] > <tbody>[index=1] > IssueRow[key=\"iss-1363\"]"}
    - {mountId:mount:84,key:iss-1378,logicalPath:"AppErrorBoundary[index=0] > Provider[index=0] > BrowserRouter[index=0] > Router[index=0] > ThemeProvider[index=0] > App[index=0] > Routes[index=0] > RenderedRoute[index=0] > RequireAuth[index=0] > Connect(AppShell)[index=0] > AppShell[index=0] > FeatureFlagsProvider[index=0] > <div>[index=0] > <main>[index=2] > Outlet[index=0] > RenderedRoute[index=0] > IssuesPage[index=0] > <div>[index=0] > withRouter(Connect(IssueTable))[index=3] > Connect(IssueTable)[index=0] > IssueTable[index=0] > <div>[index=0] > <table>[index=0] > <tbody>[index=1] > IssueRow[key=\"iss-1378\"]"}
    - {mountId:mount:85,key:iss-1383,logicalPath:"AppErrorBoundary[index=0] > Provider[index=0] > BrowserRouter[index=0] > Router[index=0] > ThemeProvider[index=0] > App[index=0] > Routes[index=0] > RenderedRoute[index=0] > RequireAuth[index=0] > Connect(AppShell)[index=0] > AppShell[index=0] > FeatureFlagsProvider[index=0] > <div>[index=0] > <main>[index=2] > Outlet[index=0] > RenderedRoute[index=0] > IssuesPage[index=0] > <div>[index=0] > withRouter(Connect(IssueTable))[index=3] > Connect(IssueTable)[index=0] > IssueTable[index=0] > <div>[index=0] > <table>[index=0] > <tbody>[index=1] > IssueRow[key=\"iss-1383\"]"}
    - {mountId:mount:86,key:iss-1402,logicalPath:"AppErrorBoundary[index=0] > Provider[index=0] > BrowserRouter[index=0] > Router[index=0] > ThemeProvider[index=0] > App[index=0] > Routes[index=0] > RenderedRoute[index=0] > RequireAuth[index=0] > Connect(AppShell)[index=0] > AppShell[index=0] > FeatureFlagsProvider[index=0] > <div>[index=0] > <main>[index=2] > Outlet[index=0] > RenderedRoute[index=0] > IssuesPage[index=0] > <div>[index=0] > withRouter(Connect(IssueTable))[index=3] > Connect(IssueTable)[index=0] > IssueTable[index=0] > <div>[index=0] > <table>[index=0] > <tbody>[index=1] > IssueRow[key=\"iss-1402\"]"}
    - {mountId:mount:87,key:iss-1453,logicalPath:"AppErrorBoundary[index=0] > Provider[index=0] > BrowserRouter[index=0] > Router[index=0] > ThemeProvider[index=0] > App[index=0] > Routes[index=0] > RenderedRoute[index=0] > RequireAuth[index=0] > Connect(AppShell)[index=0] > AppShell[index=0] > FeatureFlagsProvider[index=0] > <div>[index=0] > <main>[index=2] > Outlet[index=0] > RenderedRoute[index=0] > IssuesPage[index=0] > <div>[index=0] > withRouter(Connect(IssueTable))[index=3] > Connect(IssueTable)[index=0] > IssueTable[index=0] > <div>[index=0] > <table>[index=0] > <tbody>[index=1] > IssueRow[key=\"iss-1453\"]"}
    - {mountId:mount:88,key:iss-1461,logicalPath:"AppErrorBoundary[index=0] > Provider[index=0] > BrowserRouter[index=0] > Router[index=0] > ThemeProvider[index=0] > App[index=0] > Routes[index=0] > RenderedRoute[index=0] > RequireAuth[index=0] > Connect(AppShell)[index=0] > AppShell[index=0] > FeatureFlagsProvider[index=0] > <div>[index=0] > <main>[index=2] > Outlet[index=0] > RenderedRoute[index=0] > IssuesPage[index=0] > <div>[index=0] > withRouter(Connect(IssueTable))[index=3] > Connect(IssueTable)[index=0] > IssueTable[index=0] > <div>[index=0] > <table>[index=0] > <tbody>[index=1] > IssueRow[key=\"iss-1461\"]"}
    - {mountId:mount:89,key:iss-1487,logicalPath:"AppErrorBoundary[index=0] > Provider[index=0] > BrowserRouter[index=0] > Router[index=0] > ThemeProvider[index=0] > App[index=0] > Routes[index=0] > RenderedRoute[index=0] > RequireAuth[index=0] > Connect(AppShell)[index=0] > AppShell[index=0] > FeatureFlagsProvider[index=0] > <div>[index=0] > <main>[index=2] > Outlet[index=0] > RenderedRoute[index=0] > IssuesPage[index=0] > <div>[index=0] > withRouter(Connect(IssueTable))[index=3] > Connect(IssueTable)[index=0] > IssueTable[index=0] > <div>[index=0] > <table>[index=0] > <tbody>[index=1] > IssueRow[key=\"iss-1487\"]"}
    - {mountId:mount:90,key:iss-1502,logicalPath:"AppErrorBoundary[index=0] > Provider[index=0] > BrowserRouter[index=0] > Router[index=0] > ThemeProvider[index=0] > App[index=0] > Routes[index=0] > RenderedRoute[index=0] > RequireAuth[index=0] > Connect(AppShell)[index=0] > AppShell[index=0] > FeatureFlagsProvider[index=0] > <div>[index=0] > <main>[index=2] > Outlet[index=0] > RenderedRoute[index=0] > IssuesPage[index=0] > <div>[index=0] > withRouter(Connect(IssueTable))[index=3] > Connect(IssueTable)[index=0] > IssueTable[index=0] > <div>[index=0] > <table>[index=0] > <tbody>[index=1] > IssueRow[key=\"iss-1502\"]"}
    - {mountId:mount:91,key:iss-1540,logicalPath:"AppErrorBoundary[index=0] > Provider[index=0] > BrowserRouter[index=0] > Router[index=0] > ThemeProvider[index=0] > App[index=0] > Routes[index=0] > RenderedRoute[index=0] > RequireAuth[index=0] > Connect(AppShell)[index=0] > AppShell[index=0] > FeatureFlagsProvider[index=0] > <div>[index=0] > <main>[index=2] > Outlet[index=0] > RenderedRoute[index=0] > IssuesPage[index=0] > <div>[index=0] > withRouter(Connect(IssueTable))[index=3] > Connect(IssueTable)[index=0] > IssueTable[index=0] > <div>[index=0] > <table>[index=0] > <tbody>[index=1] > IssueRow[key=\"iss-1540\"]"}
    - {mountId:mount:92,key:iss-1585,logicalPath:"AppErrorBoundary[index=0] > Provider[index=0] > BrowserRouter[index=0] > Router[index=0] > ThemeProvider[index=0] > App[index=0] > Routes[index=0] > RenderedRoute[index=0] > RequireAuth[index=0] > Connect(AppShell)[index=0] > AppShell[index=0] > FeatureFlagsProvider[index=0] > <div>[index=0] > <main>[index=2] > Outlet[index=0] > RenderedRoute[index=0] > IssuesPage[index=0] > <div>[index=0] > withRouter(Connect(IssueTable))[index=3] > Connect(IssueTable)[index=0] > IssueTable[index=0] > <div>[index=0] > <table>[index=0] > <tbody>[index=1] > IssueRow[key=\"iss-1585\"]"}
    - {mountId:mount:93,key:iss-1597,logicalPath:"AppErrorBoundary[index=0] > Provider[index=0] > BrowserRouter[index=0] > Router[index=0] > ThemeProvider[index=0] > App[index=0] > Routes[index=0] > RenderedRoute[index=0] > RequireAuth[index=0] > Connect(AppShell)[index=0] > AppShell[index=0] > FeatureFlagsProvider[index=0] > <div>[index=0] > <main>[index=2] > Outlet[index=0] > RenderedRoute[index=0] > IssuesPage[index=0] > <div>[index=0] > withRouter(Connect(IssueTable))[index=3] > Connect(IssueTable)[index=0] > IssueTable[index=0] > <div>[index=0] > <table>[index=0] > <tbody>[index=1] > IssueRow[key=\"iss-1597\"]"}
    - {mountId:mount:94,key:iss-1609,logicalPath:"AppErrorBoundary[index=0] > Provider[index=0] > BrowserRouter[index=0] > Router[index=0] > ThemeProvider[index=0] > App[index=0] > Routes[index=0] > RenderedRoute[index=0] > RequireAuth[index=0] > Connect(AppShell)[index=0] > AppShell[index=0] > FeatureFlagsProvider[index=0] > <div>[index=0] > <main>[index=2] > Outlet[index=0] > RenderedRoute[index=0] > IssuesPage[index=0] > <div>[index=0] > withRouter(Connect(IssueTable))[index=3] > Connect(IssueTable)[index=0] > IssueTable[index=0] > <div>[index=0] > <table>[index=0] > <tbody>[index=1] > IssueRow[key=\"iss-1609\"]"}
    - {mountId:mount:95,key:iss-1662,logicalPath:"AppErrorBoundary[index=0] > Provider[index=0] > BrowserRouter[index=0] > Router[index=0] > ThemeProvider[index=0] > App[index=0] > Routes[index=0] > RenderedRoute[index=0] > RequireAuth[index=0] > Connect(AppShell)[index=0] > AppShell[index=0] > FeatureFlagsProvider[index=0] > <div>[index=0] > <main>[index=2] > Outlet[index=0] > RenderedRoute[index=0] > IssuesPage[index=0] > <div>[index=0] > withRouter(Connect(IssueTable))[index=3] > Connect(IssueTable)[index=0] > IssueTable[index=0] > <div>[index=0] > <table>[index=0] > <tbody>[index=1] > IssueRow[key=\"iss-1662\"]"}
    - {mountId:mount:96,key:iss-1668,logicalPath:"AppErrorBoundary[index=0] > Provider[index=0] > BrowserRouter[index=0] > Router[index=0] > ThemeProvider[index=0] > App[index=0] > Routes[index=0] > RenderedRoute[index=0] > RequireAuth[index=0] > Connect(AppShell)[index=0] > AppShell[index=0] > FeatureFlagsProvider[index=0] > <div>[index=0] > <main>[index=2] > Outlet[index=0] > RenderedRoute[index=0] > IssuesPage[index=0] > <div>[index=0] > withRouter(Connect(IssueTable))[index=3] > Connect(IssueTable)[index=0] > IssueTable[index=0] > <div>[index=0] > <table>[index=0] > <tbody>[index=1] > IssueRow[key=\"iss-1668\"]"}
    - {mountId:mount:97,key:iss-1673,logicalPath:"AppErrorBoundary[index=0] > Provider[index=0] > BrowserRouter[index=0] > Router[index=0] > ThemeProvider[index=0] > App[index=0] > Routes[index=0] > RenderedRoute[index=0] > RequireAuth[index=0] > Connect(AppShell)[index=0] > AppShell[index=0] > FeatureFlagsProvider[index=0] > <div>[index=0] > <main>[index=2] > Outlet[index=0] > RenderedRoute[index=0] > IssuesPage[index=0] > <div>[index=0] > withRouter(Connect(IssueTable))[index=3] > Connect(IssueTable)[index=0] > IssueTable[index=0] > <div>[index=0] > <table>[index=0] > <tbody>[index=1] > IssueRow[key=\"iss-1673\"]"}
    - {mountId:mount:98,key:iss-1681,logicalPath:"AppErrorBoundary[index=0] > Provider[index=0] > BrowserRouter[index=0] > Router[index=0] > ThemeProvider[index=0] > App[index=0] > Routes[index=0] > RenderedRoute[index=0] > RequireAuth[index=0] > Connect(AppShell)[index=0] > AppShell[index=0] > FeatureFlagsProvider[index=0] > <div>[index=0] > <main>[index=2] > Outlet[index=0] > RenderedRoute[index=0] > IssuesPage[index=0] > <div>[index=0] > withRouter(Connect(IssueTable))[index=3] > Connect(IssueTable)[index=0] > IssueTable[index=0] > <div>[index=0] > <table>[index=0] > <tbody>[index=1] > IssueRow[key=\"iss-1681\"]"}
    - {mountId:mount:99,key:iss-1700,logicalPath:"AppErrorBoundary[index=0] > Provider[index=0] > BrowserRouter[index=0] > Router[index=0] > ThemeProvider[index=0] > App[index=0] > Routes[index=0] > RenderedRoute[index=0] > RequireAuth[index=0] > Connect(AppShell)[index=0] > AppShell[index=0] > FeatureFlagsProvider[index=0] > <div>[index=0] > <main>[index=2] > Outlet[index=0] > RenderedRoute[index=0] > IssuesPage[index=0] > <div>[index=0] > withRouter(Connect(IssueTable))[index=3] > Connect(IssueTable)[index=0] > IssueTable[index=0] > <div>[index=0] > <table>[index=0] > <tbody>[index=1] > IssueRow[key=\"iss-1700\"]"}
    - {mountId:mount:100,key:iss-1754,logicalPath:"AppErrorBoundary[index=0] > Provider[index=0] > BrowserRouter[index=0] > Router[index=0] > ThemeProvider[index=0] > App[index=0] > Routes[index=0] > RenderedRoute[index=0] > RequireAuth[index=0] > Connect(AppShell)[index=0] > AppShell[index=0] > FeatureFlagsProvider[index=0] > <div>[index=0] > <main>[index=2] > Outlet[index=0] > RenderedRoute[index=0] > IssuesPage[index=0] > <div>[index=0] > withRouter(Connect(IssueTable))[index=3] > Connect(IssueTable)[index=0] > IssueTable[index=0] > <div>[index=0] > <table>[index=0] > <tbody>[index=1] > IssueRow[key=\"iss-1754\"]"}
  events[100]:
    each: {documentCommitId:18,inputCoverageComplete:true}
    - {renderEventId:render:18:110,mountId:mount:100,causes:[{kind:props,evidence:exact,name:onToggle,reason:null}]}
    - {renderEventId:render:18:109,mountId:mount:99,causes:[{kind:props,evidence:exact,name:onToggle,reason:null}]}
    - {renderEventId:render:18:108,mountId:mount:98,causes:[{kind:props,evidence:exact,name:onToggle,reason:null}]}
    - {renderEventId:render:18:107,mountId:mount:97,causes:[{kind:props,evidence:exact,name:onToggle,reason:null}]}
    - {renderEventId:render:18:106,mountId:mount:96,causes:[{kind:props,evidence:exact,name:onToggle,reason:null}]}
    - {renderEventId:render:18:105,mountId:mount:95,causes:[{kind:props,evidence:exact,name:onToggle,reason:null}]}
    - {renderEventId:render:18:104,mountId:mount:94,causes:[{kind:props,evidence:exact,name:onToggle,reason:null}]}
    - {renderEventId:render:18:103,mountId:mount:93,causes:[{kind:props,evidence:exact,name:onToggle,reason:null}]}
    - {renderEventId:render:18:102,mountId:mount:92,causes:[{kind:props,evidence:exact,name:onToggle,reason:null}]}
    - {renderEventId:render:18:101,mountId:mount:91,causes:[{kind:props,evidence:exact,name:onToggle,reason:null}]}
    - {renderEventId:render:18:100,mountId:mount:90,causes:[{kind:props,evidence:exact,name:onToggle,reason:null}]}
    - {renderEventId:render:18:99,mountId:mount:89,causes:[{kind:props,evidence:exact,name:onToggle,reason:null}]}
    - {renderEventId:render:18:98,mountId:mount:88,causes:[{kind:props,evidence:exact,name:onToggle,reason:null}]}
    - {renderEventId:render:18:97,mountId:mount:87,causes:[{kind:props,evidence:exact,name:onToggle,reason:null}]}
    - {renderEventId:render:18:96,mountId:mount:86,causes:[{kind:props,evidence:exact,name:onToggle,reason:null}]}
    - {renderEventId:render:18:95,mountId:mount:85,causes:[{kind:props,evidence:exact,name:onToggle,reason:null}]}
    - {renderEventId:render:18:94,mountId:mount:84,causes:[{kind:props,evidence:exact,name:onToggle,reason:null}]}
    - {renderEventId:render:18:93,mountId:mount:83,causes:[{kind:props,evidence:exact,name:onToggle,reason:null}]}
    - {renderEventId:render:18:92,mountId:mount:82,causes:[{kind:props,evidence:exact,name:onToggle,reason:null}]}
    - {renderEventId:render:18:91,mountId:mount:81,causes:[{kind:props,evidence:exact,name:onToggle,reason:null}]}
    - {renderEventId:render:18:90,mountId:mount:80,causes:[{kind:props,evidence:exact,name:onToggle,reason:null}]}
    - {renderEventId:render:18:89,mountId:mount:79,causes:[{kind:props,evidence:exact,name:onToggle,reason:null}]}
    - {renderEventId:render:18:88,mountId:mount:78,causes:[{kind:props,evidence:exact,name:onToggle,reason:null}]}
    - {renderEventId:render:18:87,mountId:mount:77,causes:[{kind:props,evidence:exact,name:onToggle,reason:null}]}
    - {renderEventId:render:18:86,mountId:mount:76,causes:[{kind:props,evidence:exact,name:onToggle,reason:null}]}
    - {renderEventId:render:18:85,mountId:mount:75,causes:[{kind:props,evidence:exact,name:onToggle,reason:null}]}
    - {renderEventId:render:18:84,mountId:mount:74,causes:[{kind:props,evidence:exact,name:onToggle,reason:null}]}
    - {renderEventId:render:18:83,mountId:mount:73,causes:[{kind:props,evidence:exact,name:onToggle,reason:null}]}
    - {renderEventId:render:18:82,mountId:mount:72,causes:[{kind:props,evidence:exact,name:onToggle,reason:null}]}
    - {renderEventId:render:18:81,mountId:mount:71,causes:[{kind:props,evidence:exact,name:onToggle,reason:null}]}
    - {renderEventId:render:18:80,mountId:mount:70,causes:[{kind:props,evidence:exact,name:onToggle,reason:null}]}
    - {renderEventId:render:18:79,mountId:mount:69,causes:[{kind:props,evidence:exact,name:onToggle,reason:null}]}
    - {renderEventId:render:18:78,mountId:mount:68,causes:[{kind:props,evidence:exact,name:onToggle,reason:null}]}
    - {renderEventId:render:18:77,mountId:mount:67,causes:[{kind:props,evidence:exact,name:onToggle,reason:null}]}
    - {renderEventId:render:18:76,mountId:mount:66,causes:[{kind:props,evidence:exact,name:onToggle,reason:null}]}
    - {renderEventId:render:18:75,mountId:mount:65,causes:[{kind:props,evidence:exact,name:onToggle,reason:null}]}
    - {renderEventId:render:18:74,mountId:mount:64,causes:[{kind:props,evidence:exact,name:onToggle,reason:null}]}
    - {renderEventId:render:18:73,mountId:mount:63,causes:[{kind:props,evidence:exact,name:onToggle,reason:null}]}
    - {renderEventId:render:18:72,mountId:mount:62,causes:[{kind:props,evidence:exact,name:onToggle,reason:null}]}
    - {renderEventId:render:18:71,mountId:mount:61,causes:[{kind:props,evidence:exact,name:onToggle,reason:null}]}
    - {renderEventId:render:18:70,mountId:mount:60,causes:[{kind:props,evidence:exact,name:onToggle,reason:null}]}
    - {renderEventId:render:18:69,mountId:mount:59,causes:[{kind:props,evidence:exact,name:onToggle,reason:null}]}
    - {renderEventId:render:18:68,mountId:mount:58,causes:[{kind:props,evidence:exact,name:onToggle,reason:null}]}
    - {renderEventId:render:18:67,mountId:mount:57,causes:[{kind:props,evidence:exact,name:onToggle,reason:null}]}
    - {renderEventId:render:18:66,mountId:mount:56,causes:[{kind:props,evidence:exact,name:onToggle,reason:null}]}
    - {renderEventId:render:18:65,mountId:mount:55,causes:[{kind:props,evidence:exact,name:onToggle,reason:null}]}
    - {renderEventId:render:18:64,mountId:mount:54,causes:[{kind:props,evidence:exact,name:onToggle,reason:null}]}
    - {renderEventId:render:18:63,mountId:mount:53,causes:[{kind:props,evidence:exact,name:onToggle,reason:null}]}
    - {renderEventId:render:18:62,mountId:mount:52,causes:[{kind:props,evidence:exact,name:onToggle,reason:null}]}
    - {renderEventId:render:18:61,mountId:mount:51,causes:[{kind:props,evidence:exact,name:onToggle,reason:null}]}
    - {renderEventId:render:18:60,mountId:mount:50,causes:[{kind:props,evidence:exact,name:onToggle,reason:null}]}
    - {renderEventId:render:18:59,mountId:mount:49,causes:[{kind:props,evidence:exact,name:onToggle,reason:null}]}
    - {renderEventId:render:18:58,mountId:mount:48,causes:[{kind:props,evidence:exact,name:onToggle,reason:null}]}
    - {renderEventId:render:18:57,mountId:mount:47,causes:[{kind:props,evidence:exact,name:onToggle,reason:null}]}
    - {renderEventId:render:18:56,mountId:mount:46,causes:[{kind:props,evidence:exact,name:onToggle,reason:null}]}
    - {renderEventId:render:18:55,mountId:mount:45,causes:[{kind:props,evidence:exact,name:onToggle,reason:null}]}
    - {renderEventId:render:18:54,mountId:mount:44,causes:[{kind:props,evidence:exact,name:onToggle,reason:null}]}
    - {renderEventId:render:18:53,mountId:mount:43,causes:[{kind:props,evidence:exact,name:onToggle,reason:null}]}
    - {renderEventId:render:18:52,mountId:mount:42,causes:[{kind:props,evidence:exact,name:onToggle,reason:null}]}
    - {renderEventId:render:18:51,mountId:mount:41,causes:[{kind:props,evidence:exact,name:onToggle,reason:null}]}
    - {renderEventId:render:18:50,mountId:mount:40,causes:[{kind:props,evidence:exact,name:onToggle,reason:null}]}
    - {renderEventId:render:18:49,mountId:mount:39,causes:[{kind:props,evidence:exact,name:onToggle,reason:null}]}
    - {renderEventId:render:18:48,mountId:mount:38,causes:[{kind:props,evidence:exact,name:onToggle,reason:null}]}
    - {renderEventId:render:18:47,mountId:mount:37,causes:[{kind:props,evidence:exact,name:onToggle,reason:null}]}
    - {renderEventId:render:18:46,mountId:mount:36,causes:[{kind:props,evidence:exact,name:onToggle,reason:null}]}
    - {renderEventId:render:18:45,mountId:mount:35,causes:[{kind:props,evidence:exact,name:onToggle,reason:null}]}
    - {renderEventId:render:18:44,mountId:mount:34,causes:[{kind:props,evidence:exact,name:onToggle,reason:null}]}
    - {renderEventId:render:18:43,mountId:mount:33,causes:[{kind:props,evidence:exact,name:onToggle,reason:null}]}
    - {renderEventId:render:18:42,mountId:mount:32,causes:[{kind:props,evidence:exact,name:onToggle,reason:null}]}
    - {renderEventId:render:18:41,mountId:mount:31,causes:[{kind:props,evidence:exact,name:onToggle,reason:null}]}
    - {renderEventId:render:18:40,mountId:mount:30,causes:[{kind:props,evidence:exact,name:onToggle,reason:null}]}
    - {renderEventId:render:18:39,mountId:mount:29,causes:[{kind:props,evidence:exact,name:onToggle,reason:null}]}
    - {renderEventId:render:18:38,mountId:mount:28,causes:[{kind:props,evidence:exact,name:onToggle,reason:null}]}
    - {renderEventId:render:18:37,mountId:mount:27,causes:[{kind:props,evidence:exact,name:onToggle,reason:null}]}
    - {renderEventId:render:18:36,mountId:mount:26,causes:[{kind:props,evidence:exact,name:onToggle,reason:null}]}
    - {renderEventId:render:18:35,mountId:mount:25,causes:[{kind:props,evidence:exact,name:onToggle,reason:null}]}
    - {renderEventId:render:18:34,mountId:mount:24,causes:[{kind:props,evidence:exact,name:onToggle,reason:null}]}
    - {renderEventId:render:18:33,mountId:mount:23,causes:[{kind:props,evidence:exact,name:onToggle,reason:null}]}
    - {renderEventId:render:18:32,mountId:mount:22,causes:[{kind:props,evidence:exact,name:onToggle,reason:null}]}
    - {renderEventId:render:18:31,mountId:mount:21,causes:[{kind:props,evidence:exact,name:onToggle,reason:null}]}
    - {renderEventId:render:18:30,mountId:mount:20,causes:[{kind:props,evidence:exact,name:onToggle,reason:null}]}
    - {renderEventId:render:18:29,mountId:mount:19,causes:[{kind:props,evidence:exact,name:onToggle,reason:null}]}
    - {renderEventId:render:18:28,mountId:mount:18,causes:[{kind:props,evidence:exact,name:onToggle,reason:null}]}
    - {renderEventId:render:18:27,mountId:mount:17,causes:[{kind:props,evidence:exact,name:onToggle,reason:null}]}
    - {renderEventId:render:18:26,mountId:mount:16,causes:[{kind:props,evidence:exact,name:onToggle,reason:null}]}
    - {renderEventId:render:18:25,mountId:mount:15,causes:[{kind:props,evidence:exact,name:onToggle,reason:null}]}
    - {renderEventId:render:18:24,mountId:mount:14,causes:[{kind:props,evidence:exact,name:onToggle,reason:null}]}
    - {renderEventId:render:18:23,mountId:mount:13,causes:[{kind:props,evidence:exact,name:onToggle,reason:null}]}
    - {renderEventId:render:18:22,mountId:mount:12,causes:[{kind:props,evidence:exact,name:onToggle,reason:null}]}
    - {renderEventId:render:18:21,mountId:mount:11,causes:[{kind:props,evidence:exact,name:onToggle,reason:null}]}
    - {renderEventId:render:18:20,mountId:mount:10,causes:[{kind:props,evidence:exact,name:onToggle,reason:null}]}
    - {renderEventId:render:18:19,mountId:mount:9,causes:[{kind:props,evidence:exact,name:onToggle,reason:null}]}
    - {renderEventId:render:18:18,mountId:mount:8,causes:[{kind:props,evidence:exact,name:onToggle,reason:null}]}
    - {renderEventId:render:18:17,mountId:mount:7,causes:[{kind:props,evidence:exact,name:onToggle,reason:null}]}
    - {renderEventId:render:18:16,mountId:mount:6,causes:[{kind:props,evidence:exact,name:onToggle,reason:null}]}
    - {renderEventId:render:18:15,mountId:mount:5,causes:[{kind:props,evidence:exact,name:onToggle,reason:null}]}
    - {renderEventId:render:18:14,mountId:mount:4,causes:[{kind:props,evidence:exact,name:selected,reason:null},{kind:props,evidence:exact,name:onToggle,reason:null}]}
    - {renderEventId:render:18:13,mountId:mount:3,causes:[{kind:props,evidence:exact,name:onToggle,reason:null}]}
    - {renderEventId:render:18:12,mountId:mount:2,causes:[{kind:props,evidence:exact,name:onToggle,reason:null}]}
    - {renderEventId:render:18:11,mountId:mount:1,causes:[{kind:props,evidence:exact,name:onToggle,reason:null}]}
  effects: null
  beginInstances[100]:
    each: {renderingState:mounted-rendering,sourceFile:<repo>/apps/realworld-legacy/src/features/issues/issue-table.tsx,sourceLocation:<repo>/apps/realworld-legacy/src/features/issues/issue-table.tsx:48:15}
    - {mountId:mount:1,key:iss-1}
    - {mountId:mount:2,key:iss-27}
    - {mountId:mount:3,key:iss-37}
    - {mountId:mount:4,key:iss-40}
    - {mountId:mount:5,key:iss-41}
    - {mountId:mount:6,key:iss-52}
    - {mountId:mount:7,key:iss-87}
    - {mountId:mount:8,key:iss-94}
    - {mountId:mount:9,key:iss-101}
    - {mountId:mount:10,key:iss-107}
    - {mountId:mount:11,key:iss-115}
    - {mountId:mount:12,key:iss-127}
    - {mountId:mount:13,key:iss-144}
    - {mountId:mount:14,key:iss-149}
    - {mountId:mount:15,key:iss-167}
    - {mountId:mount:16,key:iss-169}
    - {mountId:mount:17,key:iss-206}
    - {mountId:mount:18,key:iss-235}
    - {mountId:mount:19,key:iss-238}
    - {mountId:mount:20,key:iss-239}
    - {mountId:mount:21,key:iss-258}
    - {mountId:mount:22,key:iss-265}
    - {mountId:mount:23,key:iss-277}
    - {mountId:mount:24,key:iss-280}
    - {mountId:mount:25,key:iss-290}
    - {mountId:mount:26,key:iss-311}
    - {mountId:mount:27,key:iss-321}
    - {mountId:mount:28,key:iss-334}
    - {mountId:mount:29,key:iss-347}
    - {mountId:mount:30,key:iss-350}
    - {mountId:mount:31,key:iss-360}
    - {mountId:mount:32,key:iss-362}
    - {mountId:mount:33,key:iss-368}
    - {mountId:mount:34,key:iss-369}
    - {mountId:mount:35,key:iss-385}
    - {mountId:mount:36,key:iss-399}
    - {mountId:mount:37,key:iss-420}
    - {mountId:mount:38,key:iss-427}
    - {mountId:mount:39,key:iss-444}
    - {mountId:mount:40,key:iss-498}
    - {mountId:mount:41,key:iss-499}
    - {mountId:mount:42,key:iss-531}
    - {mountId:mount:43,key:iss-557}
    - {mountId:mount:44,key:iss-577}
    - {mountId:mount:45,key:iss-584}
    - {mountId:mount:46,key:iss-597}
    - {mountId:mount:47,key:iss-613}
    - {mountId:mount:48,key:iss-616}
    - {mountId:mount:49,key:iss-635}
    - {mountId:mount:50,key:iss-713}
    - {mountId:mount:51,key:iss-715}
    - {mountId:mount:52,key:iss-725}
    - {mountId:mount:53,key:iss-727}
    - {mountId:mount:54,key:iss-728}
    - {mountId:mount:55,key:iss-736}
    - {mountId:mount:56,key:iss-769}
    - {mountId:mount:57,key:iss-795}
    - {mountId:mount:58,key:iss-813}
    - {mountId:mount:59,key:iss-815}
    - {mountId:mount:60,key:iss-869}
    - {mountId:mount:61,key:iss-874}
    - {mountId:mount:62,key:iss-877}
    - {mountId:mount:63,key:iss-900}
    - {mountId:mount:64,key:iss-911}
    - {mountId:mount:65,key:iss-923}
    - {mountId:mount:66,key:iss-927}
    - {mountId:mount:67,key:iss-966}
    - {mountId:mount:68,key:iss-972}
    - {mountId:mount:69,key:iss-992}
    - {mountId:mount:70,key:iss-1064}
    - {mountId:mount:71,key:iss-1095}
    - {mountId:mount:72,key:iss-1124}
    - {mountId:mount:73,key:iss-1131}
    - {mountId:mount:74,key:iss-1143}
    - {mountId:mount:75,key:iss-1187}
    - {mountId:mount:76,key:iss-1212}
    - {mountId:mount:77,key:iss-1217}
    - {mountId:mount:78,key:iss-1245}
    - {mountId:mount:79,key:iss-1262}
    - {mountId:mount:80,key:iss-1268}
    - {mountId:mount:81,key:iss-1355}
    - {mountId:mount:82,key:iss-1356}
    - {mountId:mount:83,key:iss-1363}
    - {mountId:mount:84,key:iss-1378}
    - {mountId:mount:85,key:iss-1383}
    - {mountId:mount:86,key:iss-1402}
    - {mountId:mount:87,key:iss-1453}
    - {mountId:mount:88,key:iss-1461}
    - {mountId:mount:89,key:iss-1487}
    - {mountId:mount:90,key:iss-1502}
    - {mountId:mount:91,key:iss-1540}
    - {mountId:mount:92,key:iss-1585}
    - {mountId:mount:93,key:iss-1597}
    - {mountId:mount:94,key:iss-1609}
    - {mountId:mount:95,key:iss-1662}
    - {mountId:mount:96,key:iss-1668}
    - {mountId:mount:97,key:iss-1673}
    - {mountId:mount:98,key:iss-1681}
    - {mountId:mount:99,key:iss-1700}
    - {mountId:mount:100,key:iss-1754}
  endInstances[100]:
    each: {renderingState:mounted-rendering,sourceFile:<repo>/apps/realworld-legacy/src/features/issues/issue-table.tsx,sourceLocation:<repo>/apps/realworld-legacy/src/features/issues/issue-table.tsx:48:15}
    - {mountId:mount:1,key:iss-1}
    - {mountId:mount:2,key:iss-27}
    - {mountId:mount:3,key:iss-37}
    - {mountId:mount:4,key:iss-40}
    - {mountId:mount:5,key:iss-41}
    - {mountId:mount:6,key:iss-52}
    - {mountId:mount:7,key:iss-87}
    - {mountId:mount:8,key:iss-94}
    - {mountId:mount:9,key:iss-101}
    - {mountId:mount:10,key:iss-107}
    - {mountId:mount:11,key:iss-115}
    - {mountId:mount:12,key:iss-127}
    - {mountId:mount:13,key:iss-144}
    - {mountId:mount:14,key:iss-149}
    - {mountId:mount:15,key:iss-167}
    - {mountId:mount:16,key:iss-169}
    - {mountId:mount:17,key:iss-206}
    - {mountId:mount:18,key:iss-235}
    - {mountId:mount:19,key:iss-238}
    - {mountId:mount:20,key:iss-239}
    - {mountId:mount:21,key:iss-258}
    - {mountId:mount:22,key:iss-265}
    - {mountId:mount:23,key:iss-277}
    - {mountId:mount:24,key:iss-280}
    - {mountId:mount:25,key:iss-290}
    - {mountId:mount:26,key:iss-311}
    - {mountId:mount:27,key:iss-321}
    - {mountId:mount:28,key:iss-334}
    - {mountId:mount:29,key:iss-347}
    - {mountId:mount:30,key:iss-350}
    - {mountId:mount:31,key:iss-360}
    - {mountId:mount:32,key:iss-362}
    - {mountId:mount:33,key:iss-368}
    - {mountId:mount:34,key:iss-369}
    - {mountId:mount:35,key:iss-385}
    - {mountId:mount:36,key:iss-399}
    - {mountId:mount:37,key:iss-420}
    - {mountId:mount:38,key:iss-427}
    - {mountId:mount:39,key:iss-444}
    - {mountId:mount:40,key:iss-498}
    - {mountId:mount:41,key:iss-499}
    - {mountId:mount:42,key:iss-531}
    - {mountId:mount:43,key:iss-557}
    - {mountId:mount:44,key:iss-577}
    - {mountId:mount:45,key:iss-584}
    - {mountId:mount:46,key:iss-597}
    - {mountId:mount:47,key:iss-613}
    - {mountId:mount:48,key:iss-616}
    - {mountId:mount:49,key:iss-635}
    - {mountId:mount:50,key:iss-713}
    - {mountId:mount:51,key:iss-715}
    - {mountId:mount:52,key:iss-725}
    - {mountId:mount:53,key:iss-727}
    - {mountId:mount:54,key:iss-728}
    - {mountId:mount:55,key:iss-736}
    - {mountId:mount:56,key:iss-769}
    - {mountId:mount:57,key:iss-795}
    - {mountId:mount:58,key:iss-813}
    - {mountId:mount:59,key:iss-815}
    - {mountId:mount:60,key:iss-869}
    - {mountId:mount:61,key:iss-874}
    - {mountId:mount:62,key:iss-877}
    - {mountId:mount:63,key:iss-900}
    - {mountId:mount:64,key:iss-911}
    - {mountId:mount:65,key:iss-923}
    - {mountId:mount:66,key:iss-927}
    - {mountId:mount:67,key:iss-966}
    - {mountId:mount:68,key:iss-972}
    - {mountId:mount:69,key:iss-992}
    - {mountId:mount:70,key:iss-1064}
    - {mountId:mount:71,key:iss-1095}
    - {mountId:mount:72,key:iss-1124}
    - {mountId:mount:73,key:iss-1131}
    - {mountId:mount:74,key:iss-1143}
    - {mountId:mount:75,key:iss-1187}
    - {mountId:mount:76,key:iss-1212}
    - {mountId:mount:77,key:iss-1217}
    - {mountId:mount:78,key:iss-1245}
    - {mountId:mount:79,key:iss-1262}
    - {mountId:mount:80,key:iss-1268}
    - {mountId:mount:81,key:iss-1355}
    - {mountId:mount:82,key:iss-1356}
    - {mountId:mount:83,key:iss-1363}
    - {mountId:mount:84,key:iss-1378}
    - {mountId:mount:85,key:iss-1383}
    - {mountId:mount:86,key:iss-1402}
    - {mountId:mount:87,key:iss-1453}
    - {mountId:mount:88,key:iss-1461}
    - {mountId:mount:89,key:iss-1487}
    - {mountId:mount:90,key:iss-1502}
    - {mountId:mount:91,key:iss-1540}
    - {mountId:mount:92,key:iss-1585}
    - {mountId:mount:93,key:iss-1597}
    - {mountId:mount:94,key:iss-1609}
    - {mountId:mount:95,key:iss-1662}
    - {mountId:mount:96,key:iss-1668}
    - {mountId:mount:97,key:iss-1673}
    - {mountId:mount:98,key:iss-1681}
    - {mountId:mount:99,key:iss-1700}
    - {mountId:mount:100,key:iss-1754}
evidenceRetained: true
[exit 0]
## driver profiler

$ npx genie-react call app_backend_reset '{}' --session art-m3
seed: 2019
issues: 3240
notificationPollMs: 15000
[exit 0]

$ npx genie-react call app_sign_in '{}' --session art-m3
user: {id:u-1,name:"Dana Whitfield",email:dana@acme.test,title:Designer,team:Infra}
[exit 0]

$ agent-browser --session art-m3 open http://127.0.0.1:5223/issues
✓ Acme Tracker
  http://127.0.0.1:5223/issues
[exit 0]

$ agent-browser --session art-m3 wait '.issue-row'
✓ Done
[exit 0]

$ agent-browser --session art-m3 profiler start
✓ Profiling started
[exit 0]

$ agent-browser --session art-m3 click '.issue-row:nth-child(4) input[type=checkbox]'
✓ Done
[exit 0]

$ agent-browser --session art-m3 wait 500
✓ Done
[exit 0]

$ agent-browser --session art-m3 profiler stop /tmp/art-m3/a1-click-before.cpuprofile
✓ Profile saved to /tmp/art-m3/a1-click-before.cpuprofile (3155 events)
[exit 0]
## default budget check

$ agent-browser --session art-m3 open http://127.0.0.1:5223/issues
✓ Acme Tracker
  http://127.0.0.1:5223/issues
[exit 0]

$ agent-browser --session art-m3 wait .issue-row
✓ Done
[exit 0]

$ npx genie-react call react_clear_renders '{"component":"IssueRow"}' --session art-m3
ok: true
tracking: true
documentCommitId: 17
observation: {id:observation:1,epoch:1,startedAfterDocumentCommitId:17}
observationConfig:
  adaptive: true
  adaptiveScale: 3
  fiberLimit: 750
  operationLimit: 90000
  timeLimitMs: 36
  targetOperationReserve: 4000
  targetTimeReserveMs: 4
  lifecycleBufferLimit: 1000
  lifecycleTargetReserve: 100
strictMode: on
[exit 0]

$ agent-browser --session art-m3 click '.issue-row:nth-child(4) input[type=checkbox]'
✓ Done
[exit 0]

$ npx genie-react call react_quiesce '{"idleMs":500,"timeoutMs":10000}' --session art-m3
ok: true
outcome: idle
elapsedMs: 964
observedCommits: 1
documentCommitId: 19
sessionId: 3f128729-ccfd-47a6-a490-153598ed66f2
renderCollection: available
pendingWork:
  documentCommitId: 19
  scheduledRoots: 0
  suspendedBoundaries: 0
  dehydratedBoundaries: 0
  boundaries: []
  scanTruncated: false
  scannedFibers: 2258
[exit 0]

$ npx genie-react call react_component_cohort '{"component":"IssueRow","limit":1}' --session art-m3
attribution:
  status: current
  startedAtDocumentCommitId: 19
  completedAtDocumentCommitId: 19
  startedAtAnalysisGeneration: 20
  completedAtAnalysisGeneration: 20
documentCommitId: 19
ownershipCoverage:
  complete: true
  totalCandidates: 100
  app: 100
  library: 0
  unknown: 0
  affects: ownership-labels
observation: {id:observation:1,epoch:1,startedAfterDocumentCommitId:17}
query: {component:IssueRow,exact:true}
componentMatch:
  component: IssueRow
  exact: true
  status: matched
  matchedNames: [IssueRow]
  matchedNameCount: 1
  similarNames: []
status: mixed
matched: 100
mountedUpdated: 34
mountedIdle: 0
mountedUnknown: 66
unmounted: 0
returned: 1
omittedByLimit: 99
rendererBundle: development
coverage:
  complete: false
  freezeDetection: disabled
  scannedFibers: 2258
  scanLimit: 20000
  scanTruncated: false
  rootAvailable: true
  rootCount: 1
  scannedRootCount: 1
  rootLimit: 100
  rootScope: committed
  rootScopeComplete: true
  rootScopeTruncated: false
  inputAttributionComplete: false
  skippedCommitFibers: 66
  droppedUnmountFibers: 0
  analysisFailedFibers: 0
  pausedCommits: 0
  unobservedCommits: 0
  refreshCommitsExcluded: 0
  truncatedInputFibers: 1
  propsNotEnumeratedFibers: 0
  budgetExhaustedCommits: 1
  budgetExhaustedSubsystems[5]:
    each: {commits:1}
    - {subsystem:target:input-equivalence}
    - {subsystem:target:instance-ancestry}
    - {subsystem:target:instance-siblings}
    - {subsystem:target:target-error-state}
    - {subsystem:target:target-fibers}
  generationHistoryEvictions: 0
view: summary
shared:
  logicalPathPrefix: "AppErrorBoundary[index=0] > Provider[index=0] > BrowserRouter[index=0] > Router[index=0] > ThemeProvider[index=0] > App[index=0] > Routes[index=0] > RenderedRoute[index=0] > RequireAuth[index=0] > Connect(AppShell)[index=0] > AppShell[index=0] > FeatureFlagsProvider[index=0] > <div>[index=0] > <main>[index=2] > Outlet[index=0] > RenderedRoute[index=0] > IssuesPage[index=0] > <div>[index=0] > withRouter(Connect(IssueTable))[index=3] > Connect(IssueTable)[index=0] > IssueTable[index=0] > <div>[index=0] > <table>[index=0] > <tbody>[index=1]"
  componentName: IssueRow
  sourceOwnership: app
  source: <repo>/apps/realworld-legacy/src/features/issues/issue-table.tsx:48:15
  parent: {fiberId:10485927772344,name:IssueTable,key:null}
  keyedParent: null
  logicalIdentityEvidence: keyed
  mountGenerationEvidence: exact
  renderingState: mounted-rendering
  reactVisibility: not-hidden
instances[1]:
  - {status:mounted-updated,mountId:mount:1,fiberId:10485927772369,key:iss-1,siblingIndex:0,logicalPath:"IssueRow[key=\"iss-1\"]",mountGeneration:1,hostSelector:tr.issue-row}
[exit 0]
~~~~

## 2. Playwright MCP on the same click (shipped code)

The MCP server was driven over stdio by this scratch client (not committed elsewhere):

~~~~js
// Minimal MCP stdio client: drives @playwright/mcp through one checkbox click and prints every tool result.
import { spawn } from 'node:child_process'
const cli = '/tmp/art-m3/pwmcp/node_modules/@playwright/mcp/cli.js'
const args = [cli, '--headless', '--isolated', '--browser', 'chrome', '--output-dir', '/tmp/art-m3/pwmcp-out']
const child = spawn(process.execPath, args, { stdio: ['pipe', 'pipe', 'inherit'], cwd: '/tmp/art-m3/pwmcp-out' })
let buf = ''
const pending = new Map()
child.stdout.on('data', (d) => {
  buf += d
  let i
  while ((i = buf.indexOf('\n')) >= 0) {
    const line = buf.slice(0, i); buf = buf.slice(i + 1)
    if (!line.trim()) continue
    const msg = JSON.parse(line)
    if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id) }
  }
})
let nextId = 1
const rpc = (method, params) => new Promise((resolve) => {
  const id = nextId++
  pending.set(id, resolve)
  child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n')
})
const call = async (name, args = {}, show = true) => {
  const res = await rpc('tools/call', { name, arguments: args })
  if (show) {
    console.log(`\n>>> tools/call ${name} ${JSON.stringify(args)}`)
    for (const c of res.result?.content ?? []) console.log(c.type === 'text' ? c.text : `[${c.type} ${c.mimeType ?? ''} ${c.data ? c.data.length + ' base64 chars' : ''}]`)
    if (res.error) console.log('ERROR', JSON.stringify(res.error))
  }
  return res
}
await rpc('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'scratch-client', version: '0.0.0' } })
child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n')
const tools = await rpc('tools/list', {})
console.log('>>> tools/list names:', tools.result.tools.map((t) => t.name).join(', '))
const base = 'http://127.0.0.1:5223'
await call('browser_navigate', { url: `${base}/login` })
await call('browser_type', { target: 'input[name=email]', text: 'dana@acme.test' }, false)
await call('browser_type', { target: 'input[name=password]', text: 'password' }, false)
await call('browser_click', { target: 'button[type=submit]' }, false)
await call('browser_wait_for', { text: 'Board', time: 10 }, false)
await call('browser_navigate', { url: `${base}/issues` }, false)
await call('browser_wait_for', { text: 'CORE-40', time: 15 })
await call('browser_click', { target: '.issue-row:nth-child(4) input[type=checkbox]' })
await call('browser_snapshot', { target: '.issue-row:nth-child(4)' })
await call('browser_take_screenshot', { filename: '/tmp/art-m3/pwmcp-out/after-click.png' })
await call('browser_console_messages', { level: 'debug' })
await call('browser_network_requests', {})
await call('browser_close', {})
child.kill()
process.exit(0)
~~~~

```bash
cd /tmp/art-m3/pwmcp && npm i @playwright/mcp@0.0.86
cd /tmp/art-m3/pwmcp-out && node /tmp/art-m3/scripts/pwmcp-client.mjs
```

Output:

~~~~text
>>> tools/list names: browser_close, browser_resize, browser_console_messages, browser_handle_dialog, browser_emulate_media, browser_evaluate, browser_file_upload, browser_drop, browser_find, browser_fill_form, browser_press_key, browser_type, browser_navigate, browser_navigate_back, browser_network_requests, browser_network_request, browser_run_code_unsafe, browser_take_screenshot, browser_snapshot, browser_click, browser_drag, browser_hover, browser_select_option, browser_tabs, browser_wait_for

>>> tools/call browser_navigate {"url":"http://127.0.0.1:5223/login"}
### Ran Playwright code
```js
await page.goto('http://127.0.0.1:5223/login');
```
### Page
- Page URL: http://127.0.0.1:5223/login
- Page Title: Acme Tracker
- Console: 1 errors, 2 warnings
### Snapshot
- [Snapshot](../../../../tmp/art-m3/pwmcp-out/page-2026-11-19T04-05-01-168Z.yml)
### Events
- New console entries: ../../../../tmp/art-m3/pwmcp-out/console-2026-11-19T04-05-00-855Z.log#L1-L3

>>> tools/call browser_wait_for {"text":"CORE-40","time":15}
### Result
Waited for CORE-40
### Ran Playwright code
```js
await page.getByText("CORE-40").first().waitFor({ state: 'visible' });
```
### Page
- Page URL: http://127.0.0.1:5223/issues
- Page Title: Acme Tracker
- Console: 0 errors, 4 warnings
### Snapshot
- [Snapshot](../../../../tmp/art-m3/pwmcp-out/page-2026-11-19T04-05-02-757Z.yml)
### Events
- New console entries: ../../../../tmp/art-m3/pwmcp-out/console-2026-11-19T04-05-02-389Z.log#L4-L9

>>> tools/call browser_click {"target":".issue-row:nth-child(4) input[type=checkbox]"}
### Ran Playwright code
```js
await page.locator('.issue-row:nth-child(4) input[type=checkbox]').click();
```
### Page
- Page URL: http://127.0.0.1:5223/issues
- Page Title: Acme Tracker
- Console: 0 errors, 4 warnings
### Snapshot
- [Snapshot](../../../../tmp/art-m3/pwmcp-out/page-2026-11-19T04-05-03-380Z.yml)

>>> tools/call browser_snapshot {"target":".issue-row:nth-child(4)"}
### Page
- Page URL: http://127.0.0.1:5223/issues
- Page Title: Acme Tracker
- Console: 0 errors, 4 warnings
### Snapshot
```yaml
- row [ref=f1e145]:
  - cell [ref=f1e146]:
    - checkbox "Select CORE-40" [checked] [active] [ref=f1e147]
  - cell "CORE-40" [ref=f1e148]
  - cell [ref=f1e149]:
    - button "Remove timezone handling" [ref=f1e150] [cursor=pointer]
  - cell "To do" [ref=f1e151]
  - cell "Low" [ref=f1e153]
  - cell "Elliot Graves" [ref=f1e155]
  - cell [ref=f1e157]:
    - time [ref=f1e158]: just now
```

>>> tools/call browser_take_screenshot {"filename":"/tmp/art-m3/pwmcp-out/after-click.png"}
### Result
- [Screenshot of viewport](../../../../tmp/art-m3/pwmcp-out/after-click.png)
### Ran Playwright code
```js
// Screenshot viewport and save it as ../../../../tmp/art-m3/pwmcp-out/after-click.png
await page.screenshot({
  path: '../../../../tmp/art-m3/pwmcp-out/after-click.png',
  scale: 'css',
  type: 'png'
});
```

>>> tools/call browser_console_messages {"level":"debug"}
### Result
Total messages: 5 (Errors: 0, Warnings: 4)

[INFO] [webpack-dev-server] Server started: Hot Module Replacement disabled, Live Reloading enabled, Progress disabled, Overlay enabled. @ webpack-internal:///../../node_modules/.pnpm/webpack-dev-server@5.2.7_webpack-cli@6.0.1_webpack@5.112.2/node_modules/webpack-dev-server/client/modules/logger/index.js:633
[WARNING] ⚠️ React Router Future Flag Warning: React Router will begin wrapping state updates in `React.startTransition` in v7. You can use the `v7_startTransition` future flag to opt-in early. For more information, see https://reactrouter.com/v6/upgrading/future#v7_starttransition. @ webpack-internal:///../../node_modules/.pnpm/react-router@6.30.6_react@18.3.1/node_modules/react-router/dist/index.js:993
[WARNING] ⚠️ React Router Future Flag Warning: Relative route resolution within Splat routes is changing in v7. You can use the `v7_relativeSplatPath` future flag to opt-in early. For more information, see https://reactrouter.com/v6/upgrading/future#v7_relativesplatpath. @ webpack-internal:///../../node_modules/.pnpm/react-router@6.30.6_react@18.3.1/node_modules/react-router/dist/index.js:993
[WARNING] Selector unknown returned a different result when called with the same parameters. This can lead to unnecessary rerenders.
Selectors that return a new reference (such as an object or an array) should be memoized: https://redux.js.org/usage/deriving-data-selectors#optimizing-selectors-with-memoization {state: Object, selected: Object, selected2: Object, stack: Error
    at eval (webpack-internal:///../../node_…/react-dom/cjs/react-dom.development.js:15486:18)} @ webpack-internal:///../../node_modules/.pnpm/react-redux@8.1.3_@types+react-dom@18.3.7_@types+react@18.3.31__@types+react@18.3.31_re_779c1f8df9514e9b3343c5f8a2cdf8b0/node_modules/react-redux/es/hooks/useSelector.js:85
[WARNING] Selector unknown returned a different result when called with the same parameters. This can lead to unnecessary rerenders.
Selectors that return a new reference (such as an object or an array) should be memoized: https://redux.js.org/usage/deriving-data-selectors#optimizing-selectors-with-memoization {state: Object, selected: Object, selected2: Object, stack: Error
    at eval (webpack-internal:///../../node_…/react-dom/cjs/react-dom.development.js:15486:18)} @ webpack-internal:///../../node_modules/.pnpm/react-redux@8.1.3_@types+react-dom@18.3.7_@types+react@18.3.31__@types+react@18.3.31_re_779c1f8df9514e9b3343c5f8a2cdf8b0/node_modules/react-redux/es/hooks/useSelector.js:85

>>> tools/call browser_network_requests {}
### Result
14. [GET] http://127.0.0.1:5223/api/session => [200] OK
15. [GET] http://127.0.0.1:5223/api/session => [200] OK
16. [GET] http://127.0.0.1:5223/api/projects => [200] OK
17. [GET] http://127.0.0.1:5223/api/issues => [200] OK
18. [GET] http://127.0.0.1:5223/api/projects => [200] OK
19. [GET] http://127.0.0.1:5223/api/issues => [200] OK
20. [GET] http://127.0.0.1:5223/api/users => [200] OK
21. [GET] http://127.0.0.1:5223/api/config => [200] OK
22. [GET] http://127.0.0.1:5223/api/notifications => [200] OK
23. [GET] http://127.0.0.1:5223/api/notifications => [200] OK

Note: 2 static requests not shown, run with "static" option to see them.

>>> tools/call browser_close {}
### Result
No open tabs. Navigate to a URL to create one.
### Ran Playwright code
```js
await browser.close();
```
~~~~

## 3. Chrome CPU profile summaries

The profiles were recorded with `agent-browser profiler start` and `profiler stop` (commands in sections 1 and 4). This script sums sampled self time per function:

~~~~js
// Summarize a Chrome trace's ProfileChunk samples: self time by function for app source files.
import fs from 'node:fs'
const trace = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'))
const nodes = new Map(); let samples = [], deltas = []
for (const e of trace.traceEvents) {
  if (e.name !== 'ProfileChunk') continue
  const d = e.args.data
  for (const n of d.cpuProfile?.nodes ?? []) nodes.set(n.id, n)
  samples.push(...(d.cpuProfile?.samples ?? [])); deltas.push(...(d.timeDeltas ?? []))
}
const self = new Map(); let total = 0
samples.forEach((id, i) => {
  const n = nodes.get(id); const dt = (deltas[i + 1] ?? 0) / 1000; total += dt
  const cf = n?.callFrame ?? {}
  const key = `${cf.functionName || '(anonymous)'} ${String(cf.url || '').split('/').slice(-2).join('/')}`
  self.set(key, (self.get(key) ?? 0) + dt)
})
console.log(`samples: ${samples.length}, sampled ms: ${total.toFixed(1)}`)
const filter = process.argv[3] ? new RegExp(process.argv[3]) : null
;[...self].filter(([k]) => !filter || filter.test(k)).sort((a, b) => b[1] - a[1]).slice(0, 15).forEach(([k, v]) => console.log(v.toFixed(2).padStart(8), 'ms', k))
~~~~

```bash
node profile-summary.mjs /tmp/art-m3/a1-click-before.cpuprofile
node profile-summary.mjs /tmp/art-m3/a1-click-before.cpuprofile 'issue-row|issue-table'
```

~~~~text
samples: 3613, sampled ms: 539.5
  470.83 ms (idle) 
   33.31 ms (program) 
   11.07 ms RelativeTime components/relative-time.tsx
    2.68 ms ReactElement 
    1.80 ms (garbage collector) 
    1.58 ms now 
    1.54 ms compareIssues 
    0.91 ms updatedAncestorInfo cjs/react-dom.development.js
    0.81 ms (anonymous) store/issue-selectors.ts
    0.72 ms changesOf dist/redux-ACFh8WbR.js
    0.62 ms elementFromPoint 
    0.46 ms diffProperties cjs/react-dom.development.js
    0.46 ms walk dist/protocol-Do_om1x2.js
    0.45 ms scanInsideDispatch dist/redux-ACFh8WbR.js
    0.41 ms shallowEqual utils/shallowEqual.js
samples: 3613, sampled ms: 539.5
    0.15 ms render issues/issue-row.tsx
~~~~

```bash
node profile-summary.mjs /tmp/art-m3/a1-click-after.cpuprofile
node profile-summary.mjs /tmp/art-m3/a1-click-after.cpuprofile 'issue-row|issue-table|relative-time'
```

~~~~text
samples: 3597, sampled ms: 531.0
  499.11 ms (idle) 
    5.92 ms RelativeTime components/relative-time.tsx
    5.75 ms (program) 
    2.00 ms compareIssues 
    1.97 ms getBoundingClientRect 
    1.88 ms (anonymous) store/issue-selectors.ts
    1.18 ms (garbage collector) 
    0.96 ms ReactElement cjs/react-jsx-dev-runtime.development.js
    0.74 ms jsxWithValidation cjs/react-jsx-dev-runtime.development.js
    0.59 ms __spreadProps react/rtk-query-react.esm.js
    0.55 ms updatedAncestorInfo cjs/react-dom.development.js
    0.46 ms elementFromPoint 
    0.43 ms readEntries dist/redux-ACFh8WbR.js
    0.36 ms (anonymous) query/rtk-query.esm.js
    0.31 ms matchesFilters 
samples: 3597, sampled ms: 531.0
    5.92 ms RelativeTime components/relative-time.tsx
    0.16 ms (anonymous) issues/issue-table.tsx
~~~~

## 4. Reference fix applied: driver, Genie, verify, profiler

~~~~text
# date: 2026-11-19T04:04:04Z
# HEAD: 6867352ba46ec3998fe8cda0ba915536fddfa666
# app: apps/realworld-legacy at http://127.0.0.1:5223 (hub ws://127.0.0.1:5224), reference fix from evals/realworld/legacy/issue-row-inline-handler.json applied temporarily
$ git diff
diff --git a/apps/realworld-legacy/src/features/issues/issue-row.tsx b/apps/realworld-legacy/src/features/issues/issue-row.tsx
index b790cc6..636ec0c 100644
--- a/apps/realworld-legacy/src/features/issues/issue-row.tsx
+++ b/apps/realworld-legacy/src/features/issues/issue-row.tsx
@@ -7,7 +7,7 @@ import { UserName } from '../../components/user-name'
 interface IssueRowProps {
   issue: Issue
   selected: boolean
-  onToggle: () => void
+  onToggle: (id: string) => void
   onOpen: (key: string) => void
 }
 
@@ -24,7 +24,7 @@ export class IssueRow extends PureComponent<IssueRowProps> {
             type="checkbox"
             aria-label={`Select ${issue.key}`}
             checked={selected}
-            onChange={onToggle}
+            onChange={() => onToggle(issue.id)}
           />
         </td>
         <td className="issue-key">{issue.key}</td>
diff --git a/apps/realworld-legacy/src/features/issues/issue-table.tsx b/apps/realworld-legacy/src/features/issues/issue-table.tsx
index 8c2a87d..7d1c61a 100644
--- a/apps/realworld-legacy/src/features/issues/issue-table.tsx
+++ b/apps/realworld-legacy/src/features/issues/issue-table.tsx
@@ -49,7 +49,7 @@ class IssueTable extends Component<IssueTableProps> {
                 key={issue.id}
                 issue={issue}
                 selected={selectedIds.includes(issue.id)}
-                onToggle={() => this.props.selectionToggled(issue.id)}
+                onToggle={this.props.selectionToggled}
                 onOpen={this.openIssue}
               />
             ))}
## driver only

$ npx genie-react call app_backend_reset '{}' --session art-m3
seed: 2019
issues: 3240
notificationPollMs: 15000
[exit 0]

$ npx genie-react call app_sign_in '{}' --session art-m3
user: {id:u-1,name:"Dana Whitfield",email:dana@acme.test,title:Designer,team:Infra}
[exit 0]

$ agent-browser --session art-m3 open http://127.0.0.1:5223/issues
✓ Acme Tracker
  http://127.0.0.1:5223/issues
[exit 0]

$ agent-browser --session art-m3 wait '.issue-row'
✓ Done
[exit 0]

$ agent-browser --session art-m3 console --clear
✓ Console log cleared
[exit 0]

$ agent-browser --session art-m3 network requests --clear
✓ Request log cleared
[exit 0]

$ agent-browser --session art-m3 click '.issue-row:nth-child(4) input[type=checkbox]'
✓ Done
[exit 0]

$ agent-browser --session art-m3 is checked '.issue-row:nth-child(4) input[type=checkbox]'
true
[exit 0]

$ agent-browser --session art-m3 snapshot -i -s 'tbody' | head -12
- cell "Select CORE-1" [ref=e2095]
  - checkbox "Select CORE-1" [checked=false, ref=e2813]
- cell "CORE-1" [ref=e2096]
- cell "Migrate push notification opt-out" [ref=e2097]
  - button "Migrate push notification opt-out" [ref=e2814]
- cell "Backlog" [ref=e2098]
- cell "Urgent" [ref=e2099]
- cell "Zara Malik" [ref=e2100]
- cell "just now" [ref=e2101]
- cell "Select CORE-27" [ref=e2102]
  - checkbox "Select CORE-27" [checked=false, ref=e2815]
- cell "CORE-27" [ref=e2103]
[exit 0]

$ agent-browser --session art-m3 screenshot /tmp/art-m3/a1-after-click-after.png
✓ Screenshot saved to /tmp/art-m3/a1-after-click-after.png
[exit 0]

$ agent-browser --session art-m3 console
[exit 0]

$ agent-browser --session art-m3 errors
[exit 0]

$ agent-browser --session art-m3 network requests
[73908.1304] GET http://127.0.0.1:5223/api/notifications (Fetch) 200
[73908.1305] GET http://127.0.0.1:5223/api/notifications (Fetch) 200
[exit 0]
## genie

$ npx genie-react call app_backend_reset '{}' --session art-m3
seed: 2019
issues: 3240
notificationPollMs: 15000
[exit 0]

$ npx genie-react call app_sign_in '{}' --session art-m3
user: {id:u-1,name:"Dana Whitfield",email:dana@acme.test,title:Designer,team:Infra}
[exit 0]

$ agent-browser --session art-m3 open http://127.0.0.1:5223/issues
✓ Acme Tracker
  http://127.0.0.1:5223/issues
[exit 0]

$ agent-browser --session art-m3 wait '.issue-row'
✓ Done
[exit 0]

$ npx genie-react call react_clear_renders '{"component":["IssueRow","IssueTable"],"budget":{"adaptive":false,"fiberLimit":20000,"operationLimit":2000000,"timeLimitMs":500,"targetOperationReserve":100000,"targetTimeReserveMs":100}}' --session art-m3
ok: true
tracking: true
documentCommitId: 17
observation: {id:observation:1,epoch:1,startedAfterDocumentCommitId:17}
observationConfig:
  adaptive: false
  adaptiveScale: 1
  fiberLimit: 20000
  operationLimit: 2000000
  timeLimitMs: 500
  targetOperationReserve: 100000
  targetTimeReserveMs: 100
  lifecycleBufferLimit: 1000
  lifecycleTargetReserve: 100
strictMode: on
[exit 0]

$ agent-browser --session art-m3 click '.issue-row:nth-child(4) input[type=checkbox]'
✓ Done
[exit 0]

$ npx genie-react call react_quiesce '{"idleMs":500,"timeoutMs":10000}' --session art-m3
ok: true
outcome: idle
elapsedMs: 947
observedCommits: 1
documentCommitId: 19
sessionId: a4ad42a3-27cb-46a0-b017-34bc0f73606c
renderCollection: available
pendingWork:
  documentCommitId: 19
  scheduledRoots: 0
  suspendedBoundaries: 0
  dehydratedBoundaries: 0
  boundaries: []
  scanTruncated: false
  scannedFibers: 2258
[exit 0]

$ npx genie-react call react_component_cohort '{"component":"IssueRow","limit":1}' --session art-m3
attribution:
  status: current
  startedAtDocumentCommitId: 19
  completedAtDocumentCommitId: 19
  startedAtAnalysisGeneration: 20
  completedAtAnalysisGeneration: 20
documentCommitId: 19
ownershipCoverage:
  complete: true
  totalCandidates: 100
  app: 100
  library: 0
  unknown: 0
  affects: ownership-labels
observation: {id:observation:1,epoch:1,startedAfterDocumentCommitId:17}
query: {component:IssueRow,exact:true}
componentMatch:
  component: IssueRow
  exact: true
  status: matched
  matchedNames: [IssueRow]
  matchedNameCount: 1
  similarNames: []
status: mixed
matched: 100
mountedUpdated: 1
mountedIdle: 99
mountedUnknown: 0
unmounted: 0
returned: 1
omittedByLimit: 99
rendererBundle: development
coverage:
  complete: true
  freezeDetection: disabled
  scannedFibers: 2258
  scanLimit: 20000
  scanTruncated: false
  rootAvailable: true
  rootCount: 1
  scannedRootCount: 1
  rootLimit: 100
  rootScope: committed
  rootScopeComplete: true
  rootScopeTruncated: false
  inputAttributionComplete: false
  skippedCommitFibers: 0
  droppedUnmountFibers: 0
  analysisFailedFibers: 0
  pausedCommits: 0
  unobservedCommits: 0
  refreshCommitsExcluded: 0
  truncatedInputFibers: 1
  propsNotEnumeratedFibers: 0
  budgetExhaustedCommits: 0
  budgetExhaustedSubsystems: []
  generationHistoryEvictions: 0
view: summary
shared:
  logicalPathPrefix: "AppErrorBoundary[index=0] > Provider[index=0] > BrowserRouter[index=0] > Router[index=0] > ThemeProvider[index=0] > App[index=0] > Routes[index=0] > RenderedRoute[index=0] > RequireAuth[index=0] > Connect(AppShell)[index=0] > AppShell[index=0] > FeatureFlagsProvider[index=0] > <div>[index=0] > <main>[index=2] > Outlet[index=0] > RenderedRoute[index=0] > IssuesPage[index=0] > <div>[index=0] > withRouter(Connect(IssueTable))[index=3] > Connect(IssueTable)[index=0] > IssueTable[index=0] > <div>[index=0] > <table>[index=0] > <tbody>[index=1]"
  componentName: IssueRow
  sourceOwnership: app
  source: <repo>/apps/realworld-legacy/src/features/issues/issue-table.tsx:48:15
  parent: {fiberId:3137356169400,name:IssueTable,key:null}
  keyedParent: null
  logicalIdentityEvidence: keyed
  mountGenerationEvidence: exact
  renderingState: mounted-rendering
  reactVisibility: not-hidden
instances[1]:
  - {status:mounted-idle,mountId:mount:27,fiberId:3137356169425,key:iss-1,siblingIndex:0,logicalPath:"IssueRow[key=\"iss-1\"]",mountGeneration:1,hostSelector:tr.issue-row}
[exit 0]

$ npx genie-react call react_render_causes '{"component":"IssueRow","limit":2}' --session art-m3
componentMatch:
  component: IssueRow
  exact: true
  status: matched
  matchedNames: [IssueRow]
  matchedNameCount: 1
  similarNames: []
tracking: true
commits: 3
documentCommitId: 20
observation: {id:observation:1,epoch:1,startedAfterDocumentCommitId:17}
attribution:
  status: current
  startedAtDocumentCommitId: 20
  completedAtDocumentCommitId: 20
  startedAtAnalysisGeneration: 21
  completedAtAnalysisGeneration: 21
view: summary
events[1] (componentName #componentId {fields}, then ← kind evidence name {fields} per cause):
  IssueRow #3137356169428 {renderEventId:render:18:2,documentCommitId:18,mountId:mount:2,key:iss-40,necessity:necessary,necessityReason:dom-changed,inputEvidence:changed,source:{location:<repo>/apps/realworld-legacy/src/features/issues/issue-table.tsx:48:15,role:element-callsite,ownership:app}}
    ← props exact selected
omittedByLimit: 0
sourceClassification:
  complete: true
  affects: result
  totalCandidates: 1
  evaluated: 1
  app: 1
  library: 0
  unknown: 0
  unknownComponents: []
  unknownComponentsOmitted: 0
renderEventRetention: {evictedEvents:0,earliestDocumentCommitId:18,latestDocumentCommitId:20}
coverage:
  skippedCommitFibers: 0
  droppedUnmountFibers: 0
  analysisFailedFibers: 0
  pausedCommits: 0
  unobservedCommits: 0
  refreshCommitsExcluded: 0
  truncatedInputFibers: 1
  propsNotEnumeratedFibers: 0
  budgetExhaustedCommits: 0
  budgetExhaustedSubsystems: []
  incompleteBecause[1]:
    - {reason:inputs-truncated,fibers:1,components:[IssueTableToolbar],detail:"An input held values Genie compares only in part, such as functions, class instances or objects past the inspected depth; read deepDiff.truncated on these components."}
  complete: false
  inputAttributionComplete: false
  semantics: lower-bound
  coverageDomain: render-causality
  droppedRenderEvents: 0
[exit 0]
## verify

$ npx genie-react call app_backend_reset '{}' --session art-m3
seed: 2019
issues: 3240
notificationPollMs: 15000
[exit 0]

$ npx genie-react call app_sign_in '{}' --session art-m3
user: {id:u-1,name:"Dana Whitfield",email:dana@acme.test,title:Designer,team:Infra}
[exit 0]

$ agent-browser --session art-m3 open http://127.0.0.1:5223/issues
✓ Acme Tracker
  http://127.0.0.1:5223/issues
[exit 0]

$ agent-browser --session art-m3 wait '.issue-row'
✓ Done
[exit 0]

$ npx genie-react verify begin --session art-m3 --name 'select one row' --budget '{"adaptive":false,"fiberLimit":20000,"operationLimit":2000000,"timeLimitMs":500,"targetOperationReserve":100000,"targetTimeReserveMs":100}' --claim 'render IssueRow only props.selected' --claim 'render IssueTable min 1' --claim 'boundaries clean' > /tmp/art-m3/vb1.txt; cat /tmp/art-m3/vb1.txt
recording vfy_d90460fe-fdf7-4ce5-b087-04590ac48bb8 "select one row"
  url "http://127.0.0.1:5223/issues"
  1 null render IssueRow only props.selected  {}
  2 null render IssueTable min 1  {}
  3 null boundaries clean  {}
window: {observationId:observation:1,startDocumentCommitId:16,domains:[react],quietMs:500,timeoutMs:10000,tailMs:500}
next: $ pnpm exec genie-react verify end vfy_d90460fe-fdf7-4ce5-b087-04590ac48bb8 --session art-m3
session: {sessionId:99ce4d21-030b-4444-838d-3dede811cfe0,logicalSessionId:4ddd7a3e-437b-4904-afe1-fb005aad89d6,documentGeneration:41}
schemaVersion: "1.0"
targets: [{target:{component:IssueRow},status:resolved,instances:100,source:<repo>/apps/realworld-legacy/src/features/issues/issue-table.tsx},{target:{component:IssueTable},status:resolved,instances:1,source:<repo>/apps/realworld-legacy/src/features/issues/issue-table.tsx}]
startedAt: 2026-11-19T04:04:18.958Z
expiresAt: 2026-11-19T04:09:18.972Z
request: {budget:{fiberLimit:20000,operationLimit:2000000,timeLimitMs:500,targetOperationReserve:100000,targetTimeReserveMs:100,adaptive:false},settle:{quietMs:500,timeoutMs:10000},maxDurationMs:300000,allowOverrides:false}
[exit 0]

$ agent-browser --session art-m3 click '.issue-row:nth-child(4) input[type=checkbox]'
✓ Done
[exit 0]

$ npx genie-react verify end vfy_d90460fe-fdf7-4ce5-b087-04590ac48bb8 --session art-m3; echo "exit code: $?"
pass vfy_d90460fe-fdf7-4ce5-b087-04590ac48bb8 "select one row"  3 commits, quiet after 1095 ms (react)
  url "http://127.0.0.1:5223/issues"
  1 pass render IssueRow only props.selected  {renders:1,events:1,violatingEvents:0,causes:[props.selected]}
      claim: {kind:render-causes,target:{component:IssueRow},allow:[{kind:props,name:selected}]}
      deciding: [{kind:render-event,renderEventId:render:17:11,documentCommitId:17,mountId:mount:4,causes:[{cause:props.selected,evidence:exact}]}]
  2 pass render IssueTable min 1  {renders:1,mounts:0,updates:1,remounts:0,semantics:exact,instances:1,activeInstances:1}
      claim: {kind:renders,target:{component:IssueTable},min:1,counting:renders,allowRemount:false}
      deciding: [{kind:instance,mountId:mount:101,renders:1,mounts:0,updates:1,mountGeneration:1,latestDocumentCommitId:17,source:<repo>/apps/realworld-legacy/src/features/issues/issue-table.tsx:43:7}]
  3 pass boundaries clean  {caughtDuringWindow:0,caughtAtEnd:0}
      claim: {kind:boundaries-clean,scope:window}
      deciding: [{kind:boundary-log,scope:window,complete:true,afterDocumentCommitId:16}]
      caveats: [uncaught-errors-outside-boundaries-unobserved]
window: {observationId:observation:1,startDocumentCommitId:16,settledDocumentCommitId:18,frozenDocumentCommitId:19,commits:3,settle:{outcome:met,quietMs:500,timeoutMs:10000,waitedMs:1095,domains:{react:met}},tail:{ms:500,commits:1},environment:{bundle:development,strictMode:on,renderCollection:available,visibility:unavailable}}
! ui-outcome-not-observed: Genie does not check the screen; confirm it with the UI driver
! visibility-unobserved: the app reports no visibility signal, so a hidden interval was not observed
attempt 2 for these claims on this tab; previous fail vfy_07278364-4735-4e75-b781-41f5e78784ce; document reloaded since
evidence: $ pnpm exec genie-react verify show vfy_d90460fe-fdf7-4ce5-b087-04590ac48bb8 --session art-m3
session: {sessionId:99ce4d21-030b-4444-838d-3dede811cfe0,logicalSessionId:4ddd7a3e-437b-4904-afe1-fb005aad89d6,documentGeneration:41}
schemaVersion: "1.0"
exitCode: 0
stage: end
ledger: {fingerprint:cf_c8caf9c40557,scope:logical-session,storage:memory,attempt:2,history:[{verificationId:vfy_07278364-4735-4e75-b781-41f5e78784ce,verdict:fail,reasons:[],endedAt:2026-11-19T04:03:54.055Z}],codeChangedSincePrevious:document-reloaded,failsOnSameCode:0}
evidence: {retained:true,tools:[react_get_renders,react_component_cohort,react_list_overrides,react_refresh_events,react_profile_stop,react_render_causes,react_error_state]}
startedAt: 2026-11-19T04:04:18.958Z
endedAt: 2026-11-19T04:04:20.838Z
request: {budget:{fiberLimit:20000,operationLimit:2000000,timeLimitMs:500,targetOperationReserve:100000,targetTimeReserveMs:100,adaptive:false},settle:{quietMs:500,timeoutMs:10000},maxDurationMs:300000,allowOverrides:false}
exit code: 0
[exit 0]

$ npx genie-react verify show vfy_d90460fe-fdf7-4ce5-b087-04590ac48bb8 --session art-m3 --claim 1
verificationId: vfy_d90460fe-fdf7-4ce5-b087-04590ac48bb8
verdict: pass
claim:
  index: 1
  text: "render IssueRow only props.selected"
  claim: {kind:render-causes,target:{component:IssueRow},allow:[{kind:props,name:selected}]}
  verdict: pass
  observed: {renders:1,events:1,violatingEvents:0,causes:[props.selected]}
  deciding[1]:
    - {kind:render-event,renderEventId:render:17:11,documentCommitId:17,mountId:mount:4,causes:[{cause:props.selected,evidence:exact}]}
  caveats: []
evidence:
  records[1]:
    - {mountId:mount:4,key:iss-40,logicalPath:"AppErrorBoundary[index=0] > Provider[index=0] > BrowserRouter[index=0] > Router[index=0] > ThemeProvider[index=0] > App[index=0] > Routes[index=0] > RenderedRoute[index=0] > RequireAuth[index=0] > Connect(AppShell)[index=0] > AppShell[index=0] > FeatureFlagsProvider[index=0] > <div>[index=0] > <main>[index=2] > Outlet[index=0] > RenderedRoute[index=0] > IssuesPage[index=0] > <div>[index=0] > withRouter(Connect(IssueTable))[index=3] > Connect(IssueTable)[index=0] > IssueTable[index=0] > <div>[index=0] > <table>[index=0] > <tbody>[index=1] > IssueRow[key=\"iss-40\"]",mountGeneration:1,mountGenerationEvidence:exact,renders:1,mounts:0,updates:1,unmounted:false,latestDocumentCommitId:17,sourceFile:<repo>/apps/realworld-legacy/src/features/issues/issue-table.tsx,sourceLocation:<repo>/apps/realworld-legacy/src/features/issues/issue-table.tsx:48:15}
  events[1]:
    - {renderEventId:render:17:11,documentCommitId:17,mountId:mount:4,causes:[{kind:props,evidence:exact,name:selected,reason:null}],inputCoverageComplete:true}
  effects: null
  beginInstances[100]:
    each: {renderingState:mounted-rendering,sourceFile:<repo>/apps/realworld-legacy/src/features/issues/issue-table.tsx,sourceLocation:<repo>/apps/realworld-legacy/src/features/issues/issue-table.tsx:48:15}
    - {mountId:mount:1,key:iss-1}
    - {mountId:mount:2,key:iss-27}
    - {mountId:mount:3,key:iss-37}
    - {mountId:mount:4,key:iss-40}
    - {mountId:mount:5,key:iss-41}
    - {mountId:mount:6,key:iss-52}
    - {mountId:mount:7,key:iss-87}
    - {mountId:mount:8,key:iss-94}
    - {mountId:mount:9,key:iss-101}
    - {mountId:mount:10,key:iss-107}
    - {mountId:mount:11,key:iss-115}
    - {mountId:mount:12,key:iss-127}
    - {mountId:mount:13,key:iss-144}
    - {mountId:mount:14,key:iss-149}
    - {mountId:mount:15,key:iss-167}
    - {mountId:mount:16,key:iss-169}
    - {mountId:mount:17,key:iss-206}
    - {mountId:mount:18,key:iss-235}
    - {mountId:mount:19,key:iss-238}
    - {mountId:mount:20,key:iss-239}
    - {mountId:mount:21,key:iss-258}
    - {mountId:mount:22,key:iss-265}
    - {mountId:mount:23,key:iss-277}
    - {mountId:mount:24,key:iss-280}
    - {mountId:mount:25,key:iss-290}
    - {mountId:mount:26,key:iss-311}
    - {mountId:mount:27,key:iss-321}
    - {mountId:mount:28,key:iss-334}
    - {mountId:mount:29,key:iss-347}
    - {mountId:mount:30,key:iss-350}
    - {mountId:mount:31,key:iss-360}
    - {mountId:mount:32,key:iss-362}
    - {mountId:mount:33,key:iss-368}
    - {mountId:mount:34,key:iss-369}
    - {mountId:mount:35,key:iss-385}
    - {mountId:mount:36,key:iss-399}
    - {mountId:mount:37,key:iss-420}
    - {mountId:mount:38,key:iss-427}
    - {mountId:mount:39,key:iss-444}
    - {mountId:mount:40,key:iss-498}
    - {mountId:mount:41,key:iss-499}
    - {mountId:mount:42,key:iss-531}
    - {mountId:mount:43,key:iss-557}
    - {mountId:mount:44,key:iss-577}
    - {mountId:mount:45,key:iss-584}
    - {mountId:mount:46,key:iss-597}
    - {mountId:mount:47,key:iss-613}
    - {mountId:mount:48,key:iss-616}
    - {mountId:mount:49,key:iss-635}
    - {mountId:mount:50,key:iss-713}
    - {mountId:mount:51,key:iss-715}
    - {mountId:mount:52,key:iss-725}
    - {mountId:mount:53,key:iss-727}
    - {mountId:mount:54,key:iss-728}
    - {mountId:mount:55,key:iss-736}
    - {mountId:mount:56,key:iss-769}
    - {mountId:mount:57,key:iss-795}
    - {mountId:mount:58,key:iss-813}
    - {mountId:mount:59,key:iss-815}
    - {mountId:mount:60,key:iss-869}
    - {mountId:mount:61,key:iss-874}
    - {mountId:mount:62,key:iss-877}
    - {mountId:mount:63,key:iss-900}
    - {mountId:mount:64,key:iss-911}
    - {mountId:mount:65,key:iss-923}
    - {mountId:mount:66,key:iss-927}
    - {mountId:mount:67,key:iss-966}
    - {mountId:mount:68,key:iss-972}
    - {mountId:mount:69,key:iss-992}
    - {mountId:mount:70,key:iss-1064}
    - {mountId:mount:71,key:iss-1095}
    - {mountId:mount:72,key:iss-1124}
    - {mountId:mount:73,key:iss-1131}
    - {mountId:mount:74,key:iss-1143}
    - {mountId:mount:75,key:iss-1187}
    - {mountId:mount:76,key:iss-1212}
    - {mountId:mount:77,key:iss-1217}
    - {mountId:mount:78,key:iss-1245}
    - {mountId:mount:79,key:iss-1262}
    - {mountId:mount:80,key:iss-1268}
    - {mountId:mount:81,key:iss-1355}
    - {mountId:mount:82,key:iss-1356}
    - {mountId:mount:83,key:iss-1363}
    - {mountId:mount:84,key:iss-1378}
    - {mountId:mount:85,key:iss-1383}
    - {mountId:mount:86,key:iss-1402}
    - {mountId:mount:87,key:iss-1453}
    - {mountId:mount:88,key:iss-1461}
    - {mountId:mount:89,key:iss-1487}
    - {mountId:mount:90,key:iss-1502}
    - {mountId:mount:91,key:iss-1540}
    - {mountId:mount:92,key:iss-1585}
    - {mountId:mount:93,key:iss-1597}
    - {mountId:mount:94,key:iss-1609}
    - {mountId:mount:95,key:iss-1662}
    - {mountId:mount:96,key:iss-1668}
    - {mountId:mount:97,key:iss-1673}
    - {mountId:mount:98,key:iss-1681}
    - {mountId:mount:99,key:iss-1700}
    - {mountId:mount:100,key:iss-1754}
  endInstances[100]:
    each: {renderingState:mounted-rendering,sourceFile:<repo>/apps/realworld-legacy/src/features/issues/issue-table.tsx,sourceLocation:<repo>/apps/realworld-legacy/src/features/issues/issue-table.tsx:48:15}
    - {mountId:mount:1,key:iss-1}
    - {mountId:mount:2,key:iss-27}
    - {mountId:mount:3,key:iss-37}
    - {mountId:mount:4,key:iss-40}
    - {mountId:mount:5,key:iss-41}
    - {mountId:mount:6,key:iss-52}
    - {mountId:mount:7,key:iss-87}
    - {mountId:mount:8,key:iss-94}
    - {mountId:mount:9,key:iss-101}
    - {mountId:mount:10,key:iss-107}
    - {mountId:mount:11,key:iss-115}
    - {mountId:mount:12,key:iss-127}
    - {mountId:mount:13,key:iss-144}
    - {mountId:mount:14,key:iss-149}
    - {mountId:mount:15,key:iss-167}
    - {mountId:mount:16,key:iss-169}
    - {mountId:mount:17,key:iss-206}
    - {mountId:mount:18,key:iss-235}
    - {mountId:mount:19,key:iss-238}
    - {mountId:mount:20,key:iss-239}
    - {mountId:mount:21,key:iss-258}
    - {mountId:mount:22,key:iss-265}
    - {mountId:mount:23,key:iss-277}
    - {mountId:mount:24,key:iss-280}
    - {mountId:mount:25,key:iss-290}
    - {mountId:mount:26,key:iss-311}
    - {mountId:mount:27,key:iss-321}
    - {mountId:mount:28,key:iss-334}
    - {mountId:mount:29,key:iss-347}
    - {mountId:mount:30,key:iss-350}
    - {mountId:mount:31,key:iss-360}
    - {mountId:mount:32,key:iss-362}
    - {mountId:mount:33,key:iss-368}
    - {mountId:mount:34,key:iss-369}
    - {mountId:mount:35,key:iss-385}
    - {mountId:mount:36,key:iss-399}
    - {mountId:mount:37,key:iss-420}
    - {mountId:mount:38,key:iss-427}
    - {mountId:mount:39,key:iss-444}
    - {mountId:mount:40,key:iss-498}
    - {mountId:mount:41,key:iss-499}
    - {mountId:mount:42,key:iss-531}
    - {mountId:mount:43,key:iss-557}
    - {mountId:mount:44,key:iss-577}
    - {mountId:mount:45,key:iss-584}
    - {mountId:mount:46,key:iss-597}
    - {mountId:mount:47,key:iss-613}
    - {mountId:mount:48,key:iss-616}
    - {mountId:mount:49,key:iss-635}
    - {mountId:mount:50,key:iss-713}
    - {mountId:mount:51,key:iss-715}
    - {mountId:mount:52,key:iss-725}
    - {mountId:mount:53,key:iss-727}
    - {mountId:mount:54,key:iss-728}
    - {mountId:mount:55,key:iss-736}
    - {mountId:mount:56,key:iss-769}
    - {mountId:mount:57,key:iss-795}
    - {mountId:mount:58,key:iss-813}
    - {mountId:mount:59,key:iss-815}
    - {mountId:mount:60,key:iss-869}
    - {mountId:mount:61,key:iss-874}
    - {mountId:mount:62,key:iss-877}
    - {mountId:mount:63,key:iss-900}
    - {mountId:mount:64,key:iss-911}
    - {mountId:mount:65,key:iss-923}
    - {mountId:mount:66,key:iss-927}
    - {mountId:mount:67,key:iss-966}
    - {mountId:mount:68,key:iss-972}
    - {mountId:mount:69,key:iss-992}
    - {mountId:mount:70,key:iss-1064}
    - {mountId:mount:71,key:iss-1095}
    - {mountId:mount:72,key:iss-1124}
    - {mountId:mount:73,key:iss-1131}
    - {mountId:mount:74,key:iss-1143}
    - {mountId:mount:75,key:iss-1187}
    - {mountId:mount:76,key:iss-1212}
    - {mountId:mount:77,key:iss-1217}
    - {mountId:mount:78,key:iss-1245}
    - {mountId:mount:79,key:iss-1262}
    - {mountId:mount:80,key:iss-1268}
    - {mountId:mount:81,key:iss-1355}
    - {mountId:mount:82,key:iss-1356}
    - {mountId:mount:83,key:iss-1363}
    - {mountId:mount:84,key:iss-1378}
    - {mountId:mount:85,key:iss-1383}
    - {mountId:mount:86,key:iss-1402}
    - {mountId:mount:87,key:iss-1453}
    - {mountId:mount:88,key:iss-1461}
    - {mountId:mount:89,key:iss-1487}
    - {mountId:mount:90,key:iss-1502}
    - {mountId:mount:91,key:iss-1540}
    - {mountId:mount:92,key:iss-1585}
    - {mountId:mount:93,key:iss-1597}
    - {mountId:mount:94,key:iss-1609}
    - {mountId:mount:95,key:iss-1662}
    - {mountId:mount:96,key:iss-1668}
    - {mountId:mount:97,key:iss-1673}
    - {mountId:mount:98,key:iss-1681}
    - {mountId:mount:99,key:iss-1700}
    - {mountId:mount:100,key:iss-1754}
evidenceRetained: true
[exit 0]
$ git checkout -- apps/realworld-legacy   # fix reverted
$ (reference fix re-applied for the profiler run; same diff as above)
## driver profiler

$ npx genie-react call app_backend_reset '{}' --session art-m3
seed: 2019
issues: 3240
notificationPollMs: 15000
[exit 0]

$ npx genie-react call app_sign_in '{}' --session art-m3
user: {id:u-1,name:"Dana Whitfield",email:dana@acme.test,title:Designer,team:Infra}
[exit 0]

$ agent-browser --session art-m3 open http://127.0.0.1:5223/issues
✓ Acme Tracker
  http://127.0.0.1:5223/issues
[exit 0]

$ agent-browser --session art-m3 wait '.issue-row'
✓ Done
[exit 0]

$ agent-browser --session art-m3 profiler start
✓ Profiling started
[exit 0]

$ agent-browser --session art-m3 click '.issue-row:nth-child(4) input[type=checkbox]'
✓ Done
[exit 0]

$ agent-browser --session art-m3 wait 500
✓ Done
[exit 0]

$ agent-browser --session art-m3 profiler stop /tmp/art-m3/a1-click-after.cpuprofile
✓ Profile saved to /tmp/art-m3/a1-click-after.cpuprofile (4106 events)
[exit 0]
$ git checkout -- apps/realworld-legacy   # fix reverted
~~~~
