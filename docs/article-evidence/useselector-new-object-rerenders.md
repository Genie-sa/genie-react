# Evidence: useselector-new-object-rerenders

- Date: 2026-11-19
- Commit: 6867352ba46ec3998fe8cda0ba915536fddfa666 (`git rev-parse HEAD`)
- App: `apps/realworld-legacy` (Acme Tracker), dev server at http://127.0.0.1:5212, standalone Genie hub on port 5213
- Genie: `genie-react` CLI 1.0.2 from this checkout (`npx genie-react` run from `apps/realworld-legacy`), agent-browser 0.39.1
- Session: `art-l2`
- Answer keys: `evals/realworld/legacy/account-menu-selector.json`, `board-column-selector-cache.json`, `issue-table-selector-recompute.json`

Absolute paths are shortened: `<repo>` is the checkout root and `<tmp>` is the system temp directory. No other value is changed. Each logged command is followed by its full output and its exit code as `[exit N]`. Lines starting with `#` are notes written during the run.

Setup is the same as in [one-context-value-froze-the-board.md](one-context-value-froze-the-board.md): `pnpm install && pnpm build`, `pnpm install --offline` to link the built CLI, the hub on port 5213 and webpack on port 5212. The browser was already signed in as `dana@acme.test` through `app_sign_in` (logged there).

Reference fixes were applied from each answer key's `referenceFix` (exact `find`/`replace`, each `find` must match once) and reverted with `git checkout`. The diffs are in the logs.

## Part 1. Exploration on /issues (logged)

These runs found that one keystroke in the issue filter did not leave its action in `redux_actions`, and led to the slower notification poll and the View name input used in the article.

```
$ agent-browser --session art-l2 open 'http://127.0.0.1:5212/issues'
✓ Acme Tracker
  http://127.0.0.1:5212/issues
[exit 0]

$ npx genie-react status --session art-l2 --wait 15000 --select /app
status: ok
selection: {expression:/app,matchedPathCount:1,matchedPaths:[/app],omittedPathCount:48}
result: {name:"Acme Tracker",url:http://127.0.0.1:5212/issues,reactVersion:18.3.1,reactMounted:true}
[exit 0]

$ npx genie-react call react_clear_renders '{"budget":{"adaptive":false,"fiberLimit":20000,"operationLimit":2000000,"timeLimitMs":500,"targetOperationReserve":100000,"targetTimeReserveMs":100}}' --session art-l2 --select /ok
status: ok
selection: {expression:/ok,matchedPathCount:1,matchedPaths:[/ok],omittedPathCount:15}
result: true
[exit 0]

$ agent-browser --session art-l2 type 'input[aria-label="Filter issues"]' cache
✓ Done
[exit 0]

$ npx genie-react call react_quiesce '{"idleMs":500,"timeoutMs":10000}' --fail-on-result-error --session art-l2 --select /outcome
status: ok
selection: {expression:/outcome,matchedPathCount:1,matchedPaths:[/outcome],omittedPathCount:13}
result: idle
[exit 0]

$ npx genie-react call react_get_renders '{"component":"AccountMenu","appOnly":false}' --session art-l2 --fields name,renders,updates,causeCounts,necessity,necessityReason
[1]:
  - {name:AccountMenu,renders:9,updates:9,causeCounts:{external-store:9},necessity:unnecessary,necessityReason:inputs-unchanged}
[exit 0]

$ npx genie-react call react_render_causes '{"component":"AccountMenu","limit":10}' --session art-l2
componentMatch:
  component: AccountMenu
  exact: true
  status: matched
  matchedNames: [AccountMenu]
  matchedNameCount: 1
  similarNames: []
tracking: true
commits: 11
documentCommitId: 29
observation: {id:observation:1,epoch:1,startedAfterDocumentCommitId:18}
attribution:
  status: current
  startedAtDocumentCommitId: 29
  completedAtDocumentCommitId: 29
  startedAtAnalysisGeneration: 30
  completedAtAnalysisGeneration: 30
view: summary
events[1] (componentName #componentId {fields}, then ← kind evidence name {fields} per cause):
  AccountMenu #10279249248446 {renderEventId:render:27:8091,documentCommitId:27,mountId:mount:151,necessity:unnecessary,necessityReason:inputs-unchanged,inputEvidence:none-observed,source:{location:<repo>/apps/realworld-legacy/src/layout/top-bar.tsx:32:9,role:element-callsite,ownership:app}}
    ← external-store inferred anonymous-external-store {redux:{evidence:inferred,actions:["unrecorded change"]}}
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
renderEventRetention: {evictedEvents:3675,earliestDocumentCommitId:26,latestDocumentCommitId:29}
coverage:
  skippedCommitFibers: 0
  droppedUnmountFibers: 0
  analysisFailedFibers: 0
  pausedCommits: 0
  unobservedCommits: 0
  refreshCommitsExcluded: 0
  truncatedInputFibers: 5
  propsNotEnumeratedFibers: 0
  budgetExhaustedCommits: 0
  budgetExhaustedSubsystems: []
  incompleteBecause[1]:
    - {reason:inputs-truncated,fibers:5,components:[IssueTableToolbar],detail:"An input held values Genie compares only in part, such as functions, class instances or objects past the inspected depth; read deepDiff.truncated on these components."}
  complete: false
  inputAttributionComplete: false
  semantics: lower-bound
  coverageDomain: render-causality
  droppedRenderEvents: 3675
[exit 0]

$ agent-browser --session art-l2 open 'http://127.0.0.1:5212/issues'
✓ Acme Tracker
  http://127.0.0.1:5212/issues
[exit 0]

$ npx genie-react status --session art-l2 --wait 15000 --select /app
status: ok
selection: {expression:/app,matchedPathCount:1,matchedPaths:[/app],omittedPathCount:48}
result: {name:"Acme Tracker",url:http://127.0.0.1:5212/issues,reactVersion:18.3.1,reactMounted:true}
[exit 0]

$ npx genie-react call react_clear_renders '{"components":["AccountMenu"]}' --session art-l2 --select /ok
status: ok
selection: {expression:/ok,matchedPathCount:1,matchedPaths:[/ok],omittedPathCount:16}
result: true
[exit 0]

$ agent-browser --session art-l2 type 'input[aria-label="Filter issues"]' cache
✓ Done
[exit 0]

$ npx genie-react call react_quiesce '{"idleMs":500,"timeoutMs":10000}' --fail-on-result-error --session art-l2 --select /outcome
status: ok
selection: {expression:/outcome,matchedPathCount:1,matchedPaths:[/outcome],omittedPathCount:13}
result: idle
[exit 0]

$ npx genie-react call react_render_causes '{"component":"AccountMenu","limit":20}' --session art-l2
componentMatch:
  component: AccountMenu
  exact: true
  status: matched
  matchedNames: [AccountMenu]
  matchedNameCount: 1
  similarNames: []
tracking: true
commits: 10
documentCommitId: 29
observation: {id:observation:1,epoch:1,startedAfterDocumentCommitId:19}
attribution:
  status: current
  startedAtDocumentCommitId: 29
  completedAtDocumentCommitId: 29
  startedAtAnalysisGeneration: 30
  completedAtAnalysisGeneration: 30
view: summary
events[1] (componentName #componentId {fields}, then ← kind evidence name {fields} per cause):
  AccountMenu #3352708513982 {renderEventId:render:28:7913,documentCommitId:28,mountId:mount:151,necessity:unnecessary,necessityReason:inputs-unchanged,inputEvidence:none-observed,source:{location:<repo>/apps/realworld-legacy/src/layout/top-bar.tsx:32:9,role:element-callsite,ownership:app}}
    ← external-store inferred anonymous-external-store {redux:{evidence:inferred,actions:["unrecorded change"]}}
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
renderEventRetention: {evictedEvents:3674,earliestDocumentCommitId:27,latestDocumentCommitId:29}
coverage:
  skippedCommitFibers: 0
  droppedUnmountFibers: 0
  analysisFailedFibers: 0
  pausedCommits: 0
  unobservedCommits: 0
  refreshCommitsExcluded: 0
  truncatedInputFibers: 5
  propsNotEnumeratedFibers: 0
  budgetExhaustedCommits: 0
  budgetExhaustedSubsystems: []
  incompleteBecause[1]:
    - {reason:inputs-truncated,fibers:5,components:[IssueTableToolbar],detail:"An input held values Genie compares only in part, such as functions, class instances or objects past the inspected depth; read deepDiff.truncated on these components."}
  complete: false
  inputAttributionComplete: false
  semantics: lower-bound
  coverageDomain: render-causality
  droppedRenderEvents: 3674
[exit 0]

# --- one keystroke per window, so AccountMenu events stay inside render-event retention
$ npx genie-react call react_clear_renders '{}' --session art-l2 --select /ok
status: ok
selection: {expression:/ok,matchedPathCount:1,matchedPaths:[/ok],omittedPathCount:15}
result: true
[exit 0]

$ agent-browser --session art-l2 type 'input[aria-label="Filter issues"]' s
✓ Done
[exit 0]

$ npx genie-react call react_quiesce '{"idleMs":500,"timeoutMs":10000}' --fail-on-result-error --session art-l2 --select /outcome
status: ok
selection: {expression:/outcome,matchedPathCount:1,matchedPaths:[/outcome],omittedPathCount:13}
result: idle
[exit 0]

$ npx genie-react call react_render_causes '{"component":"AccountMenu","limit":5}' --session art-l2 --select /events
status: ok
selection: {expression:/events,matchedPathCount:1,matchedPaths:[/events],omittedPathCount:52}
result[4]:
  each: {componentId:3352708513982,componentName:AccountMenu,mountId:mount:151,necessity:unnecessary,necessityReason:inputs-unchanged,inputEvidence:none-observed,source:{location:<repo>/apps/realworld-legacy/src/layout/top-bar.tsx:32:9,role:element-callsite,ownership:app}}
  - {renderEventId:render:45:8861,documentCommitId:45,causes:[{kind:external-store,evidence:inferred,name:anonymous-external-store,redux:{evidence:exact,actions:[notifications/fetch/fulfilled]}}]}
  - {renderEventId:render:44:8827,documentCommitId:44,causes:[{kind:external-store,evidence:inferred,name:anonymous-external-store,redux:{evidence:inferred,actions:[issues/filtersChanged,"unrecorded change",notifications/fetch/fulfilled]}}]}
  - {renderEventId:render:42:8792,documentCommitId:42,causes:[{kind:external-store,evidence:inferred,name:anonymous-external-store,redux:{evidence:inferred,actions:["unrecorded change"]}}]}
  - {renderEventId:render:41:8752,documentCommitId:41,causes:[{kind:external-store,evidence:inferred,name:anonymous-external-store,redux:{evidence:inferred,actions:[issues/filtersChanged,"unrecorded change",issues/filtersChanged]}}]}
[exit 0]

$ npx genie-react call redux_actions '{"limit":10}' --session art-l2
store: {storeId:redux-store:1,name:app}
records[10]:
  each: {error:null,changedSlicesTruncated:false,unrecordedNestedDispatches:0,mutation:{findings:[],findingsOmitted:false}}
  - {sequence:5479,actionId:redux-store:1/action:5479,kind:action,type:service/subscriptions/unsubscribeQueryResult,label:service/subscriptions/unsubscribeQueryResult,parentActionId:redux-store:1/action:5169,at:1795060499748,durationMs:0,outcome:returned,rootStateChanged:false,changedSlices:[],mutation:{status:none-detected,notScannedReason:null,objectsCompared:4,scanTruncated:true}}
  - {sequence:5480,actionId:redux-store:1/action:5480,kind:action,type:service/subscriptions/unsubscribeQueryResult,label:service/subscriptions/unsubscribeQueryResult,parentActionId:redux-store:1/action:5172,at:1795060499748,durationMs:0,outcome:returned,rootStateChanged:false,changedSlices:[],mutation:{status:none-detected,notScannedReason:null,objectsCompared:4,scanTruncated:true}}
  - {sequence:5481,actionId:redux-store:1/action:5481,kind:action,type:service/subscriptions/unsubscribeQueryResult,label:service/subscriptions/unsubscribeQueryResult,parentActionId:redux-store:1/action:5175,at:1795060499748,durationMs:0,outcome:returned,rootStateChanged:false,changedSlices:[],mutation:{status:none-detected,notScannedReason:null,objectsCompared:4,scanTruncated:true}}
  - {sequence:5482,actionId:redux-store:1/action:5482,kind:unrecorded-change,type:null,label:"state changed without a recorded dispatch",parentActionId:null,at:1795060499748,durationMs:0,outcome:detected,rootStateChanged:true,changedSlices:[service],mutation:{status:not-scanned,notScannedReason:not-a-plain-action,objectsCompared:0,scanTruncated:false}}
  - {sequence:5483,actionId:redux-store:1/action:5483,kind:thunk,type:null,label:"anonymous thunk",parentActionId:null,at:1795060500208,durationMs:0.4,outcome:returned,rootStateChanged:null,changedSlices:[],mutation:{status:not-scanned,notScannedReason:not-a-plain-action,objectsCompared:0,scanTruncated:false}}
  - {sequence:5484,actionId:redux-store:1/action:5484,kind:action,type:notifications/fetch/pending,label:notifications/fetch/pending,parentActionId:redux-store:1/action:5483,at:1795060500208,durationMs:0.1,outcome:returned,rootStateChanged:false,changedSlices:[],mutation:{status:none-detected,notScannedReason:null,objectsCompared:4,scanTruncated:true}}
  - {sequence:5485,actionId:redux-store:1/action:5485,kind:thunk,type:null,label:"anonymous thunk",parentActionId:null,at:1795060500209,durationMs:0.1,outcome:returned,rootStateChanged:null,changedSlices:[],mutation:{status:not-scanned,notScannedReason:not-a-plain-action,objectsCompared:0,scanTruncated:false}}
  - {sequence:5486,actionId:redux-store:1/action:5486,kind:action,type:notifications/fetch/pending,label:notifications/fetch/pending,parentActionId:redux-store:1/action:5485,at:1795060500209,durationMs:0,outcome:returned,rootStateChanged:false,changedSlices:[],mutation:{status:none-detected,notScannedReason:null,objectsCompared:4,scanTruncated:true}}
  - {sequence:5487,actionId:redux-store:1/action:5487,kind:action,type:notifications/fetch/fulfilled,label:notifications/fetch/fulfilled,parentActionId:redux-store:1/action:5483,at:1795060500271,durationMs:0.7,outcome:returned,rootStateChanged:true,changedSlices:[notifications],mutation:{status:none-detected,notScannedReason:null,objectsCompared:4,scanTruncated:true}}
  - {sequence:5488,actionId:redux-store:1/action:5488,kind:action,type:notifications/fetch/fulfilled,label:notifications/fetch/fulfilled,parentActionId:redux-store:1/action:5485,at:1795060500333,durationMs:0.5,outcome:returned,rootStateChanged:true,changedSlices:[notifications],mutation:{status:none-detected,notScannedReason:null,objectsCompared:4,scanTruncated:true}}
matched: 500
omittedBefore: 490
more: false
nextAfterSequence: 5488
latestSequence: 5488
coverage: {historyLimit:500,evictedRecords:4988,unrecordedChanges:2,mutationDetection:true}
[exit 0]

$ agent-browser --session art-l2 open 'http://127.0.0.1:5212/issues'
✓ Acme Tracker
  http://127.0.0.1:5212/issues
[exit 0]

$ npx genie-react status --session art-l2 --wait 15000 --select /app
status: ok
selection: {expression:/app,matchedPathCount:1,matchedPaths:[/app],omittedPathCount:48}
result: {name:"Acme Tracker",url:http://127.0.0.1:5212/issues,reactVersion:18.3.1,reactMounted:true}
[exit 0]

$ npx genie-react call react_clear_renders '{}' --session art-l2 --select /ok
status: ok
selection: {expression:/ok,matchedPathCount:1,matchedPaths:[/ok],omittedPathCount:15}
result: true
[exit 0]

$ agent-browser --session art-l2 type 'input[aria-label="Filter issues"]' c
✓ Done
[exit 0]

$ npx genie-react call react_quiesce '{"idleMs":500,"timeoutMs":10000}' --fail-on-result-error --session art-l2 --select /outcome
status: ok
selection: {expression:/outcome,matchedPathCount:1,matchedPaths:[/outcome],omittedPathCount:13}
result: idle
[exit 0]

$ npx genie-react call react_render_causes '{"component":"AccountMenu","limit":5}' --session art-l2 --select /events
status: ok
selection: {expression:/events,matchedPathCount:1,matchedPaths:[/events],omittedPathCount:52}
result[1]:
  - {renderEventId:render:22:982,documentCommitId:22,componentId:16894169972926,componentName:AccountMenu,mountId:mount:151,causes:[{kind:external-store,evidence:inferred,name:anonymous-external-store,redux:{evidence:inferred,actions:["unrecorded change"]}}],necessity:unnecessary,necessityReason:inputs-unchanged,inputEvidence:none-observed,source:{location:<repo>/apps/realworld-legacy/src/layout/top-bar.tsx:32:9,role:element-callsite,ownership:app}}
[exit 0]

$ npx genie-react call redux_actions '{"typePrefix":"issues/","limit":5,"view":"full"}' --session art-l2
store: {storeId:redux-store:1,name:app}
records: []
matched: 0
omittedBefore: 0
more: false
nextAfterSequence: null
latestSequence: 2943
coverage: {historyLimit:500,evictedRecords:2443,unrecordedChanges:1,mutationDetection:true}
[exit 0]

$ agent-browser --session art-l2 get value 'input[aria-label="Filter issues"]'
c
[exit 0]

$ npx genie-react call redux_state '{"path":["issues","filters"]}' --session art-l2
store: {storeId:redux-store:1,name:app}
path: [issues,filters]
found: true
value: {text:c,status:all,priority:all,assigneeId:all,projectKey:all}
topLevelKeys: [session,ui,projects,issues,board,notifications,search,savedViews,reports,service]
asOfSequence: 2943
[exit 0]

$ npx genie-react call redux_actions '{"limit":200}' --session art-l2 --json | jq -c '[.records[] | .type] | group_by(.) | map({type: .[0], n: length})'
jq: error (at <stdin>:1): Cannot iterate over null (null)
[exit 5]

# --- one keystroke, then render causes (full) and the Redux action in one batch so RTK Query probe actions do not evict it from the 500-record history
$ npx genie-react call react_clear_renders '{}' --session art-l2 --select /ok
status: ok
selection: {expression:/ok,matchedPathCount:1,matchedPaths:[/ok],omittedPathCount:15}
result: true
[exit 0]

$ agent-browser --session art-l2 type 'input[aria-label="Filter issues"]' c
✓ Done
[exit 0]

$ npx genie-react call react_quiesce '{"idleMs":500,"timeoutMs":10000}' --fail-on-result-error --session art-l2 --select /outcome
status: ok
selection: {expression:/outcome,matchedPathCount:1,matchedPaths:[/outcome],omittedPathCount:13}
result: idle
[exit 0]

$ npx genie-react batch '[{"tool":"react_render_causes","args":{"component":"AccountMenu","limit":3,"view":"full"}},{"tool":"redux_actions","args":{"typePrefix":"issues/","limit":2,"view":"full"}}]' --session art-l2 --json > /tmp/docs7/art-l2/batch1.json; echo saved
saved
[exit 0]

# --- clean run, before fix: fresh /issues, type 'ca'
$ agent-browser --session art-l2 open 'http://127.0.0.1:5212/issues'
✓ Acme Tracker
  http://127.0.0.1:5212/issues
[exit 0]

$ npx genie-react status --session art-l2 --wait 15000 --select /app
status: ok
selection: {expression:/app,matchedPathCount:1,matchedPaths:[/app],omittedPathCount:48}
result: {name:"Acme Tracker",url:http://127.0.0.1:5212/issues,reactVersion:18.3.1,reactMounted:true}
[exit 0]

$ npx genie-react call react_clear_renders '{}' --session art-l2 --select /ok
status: ok
selection: {expression:/ok,matchedPathCount:1,matchedPaths:[/ok],omittedPathCount:15}
result: true
[exit 0]

$ agent-browser --session art-l2 type 'input[aria-label="Filter issues"]' ca
✓ Done
[exit 0]

$ npx genie-react call react_quiesce '{"idleMs":500,"timeoutMs":10000}' --fail-on-result-error --session art-l2 --select /outcome
status: ok
selection: {expression:/outcome,matchedPathCount:1,matchedPaths:[/outcome],omittedPathCount:13}
result: idle
[exit 0]

$ npx genie-react call redux_actions '{"typePrefix":"issues/","limit":2,"view":"full"}' --session art-l2 --json | jq -c '.records[] | {sequence, type, changedSlices, payload: .payload.payload, renderEventIds}'

[exit 0]

$ npx genie-react call react_render_causes '{"component":"AccountMenu","view":"full"}' --session art-l2 --json | jq -c '.events[] | {renderEventId, necessity, necessityReason, cause: (.causes[0] | {kind, evidence, equality, selectionEqual, changedFields, before, after, deepDiff, redux: {evidence: .redux.evidence, reason: .redux.reason, actions: [.redux.actions[] | {sequence, type, changedSlices}]}})}'
{"renderEventId":"render:23:3324","necessity":"unnecessary","necessityReason":"inputs-unchanged","cause":{"kind":"external-store","evidence":"inferred","equality":"object-is","selectionEqual":false,"changedFields":[],"before":{"user":{"id":"u-1","name":"Dana Whitfield","email":"dana@acme.test","title":"Designer","team":"Infra"},"savedViewCount":0},"after":{"user":{"id":"u-1","name":"Dana Whitfield","email":"dana@acme.test","title":"Designer","team":"Infra"},"savedViewCount":0},"deepDiff":{"changes":[{"kind":"reference-only","path":""}],"visited":3,"truncated":false},"redux":{"evidence":"inferred","reason":"unrecorded-state-change","actions":[{"sequence":3263,"type":null,"changedSlices":["service"]}]}}}
[exit 0]

$ npx genie-react call react_get_renders '{"component":"AccountMenu","appOnly":false}' --session art-l2 --fields name,renders,causeCounts,necessity,necessityReason
[1]:
  - {name:AccountMenu,renders:4,causeCounts:{external-store:4},necessity:unnecessary,necessityReason:inputs-unchanged}
[exit 0]

# --- the 15 s notifications poll re-renders the 100-row table and dispatches ~400 RTK Query probe actions, evicting the keystroke from the 500-record history. Slow the poll with the app's own tool, then reload.
$ npx genie-react call app_backend_reset '{"notificationPollMs":120000}' --session art-l2
seed: 2019
issues: 3240
notificationPollMs: 120000
[exit 0]

$ agent-browser --session art-l2 open 'http://127.0.0.1:5212/issues'
✓ Acme Tracker
  http://127.0.0.1:5212/issues
[exit 0]

$ npx genie-react status --session art-l2 --wait 15000 --select /app
status: ok
selection: {expression:/app,matchedPathCount:1,matchedPaths:[/app],omittedPathCount:48}
result: {name:"Acme Tracker",url:http://127.0.0.1:5212/issues,reactVersion:18.3.1,reactMounted:true}
[exit 0]

$ npx genie-react call react_clear_renders '{}' --session art-l2 --select /ok
status: ok
selection: {expression:/ok,matchedPathCount:1,matchedPaths:[/ok],omittedPathCount:15}
result: true
[exit 0]

$ agent-browser --session art-l2 type 'input[aria-label="Filter issues"]' ca
✓ Done
[exit 0]

$ npx genie-react call react_quiesce '{"idleMs":500,"timeoutMs":10000}' --fail-on-result-error --session art-l2 --select /outcome
status: ok
selection: {expression:/outcome,matchedPathCount:1,matchedPaths:[/outcome],omittedPathCount:13}
result: idle
[exit 0]

$ npx genie-react call redux_actions '{"typePrefix":"issues/","limit":2,"view":"full"}' --session art-l2 --json | jq -c '.records[] | {sequence, type, changedSlices, payload: .payload.payload, renderEventIds}'

[exit 0]

$ npx genie-react call react_render_causes '{"component":"AccountMenu","view":"full"}' --session art-l2 --json | jq -c '.events[] | {renderEventId, necessity, necessityReason, cause: (.causes[0] | {kind, evidence, equality, selectionEqual, changedFields, before, after, deepDiff, redux: {evidence: .redux.evidence, reason: .redux.reason, actions: [.redux.actions[] | {sequence, type, changedSlices}]}})}'
{"renderEventId":"render:24:3174","necessity":"unnecessary","necessityReason":"inputs-unchanged","cause":{"kind":"external-store","evidence":"inferred","equality":"object-is","selectionEqual":false,"changedFields":[],"before":{"user":{"id":"u-1","name":"Dana Whitfield","email":"dana@acme.test","title":"Designer","team":"Infra"},"savedViewCount":0},"after":{"user":{"id":"u-1","name":"Dana Whitfield","email":"dana@acme.test","title":"Designer","team":"Infra"},"savedViewCount":0},"deepDiff":{"changes":[{"kind":"reference-only","path":""}],"visited":3,"truncated":false},"redux":{"evidence":"inferred","reason":"unrecorded-state-change","actions":[{"sequence":3663,"type":null,"changedSlices":["service"]}]}}}
[exit 0]

$ npx genie-react call react_get_renders '{"component":"AccountMenu","appOnly":false}' --session art-l2 --fields name,renders,causeCounts,necessity,necessityReason
[1]:
  - {name:AccountMenu,renders:4,causeCounts:{external-store:4},necessity:unnecessary,necessityReason:inputs-unchanged}
[exit 0]

```

## Part 2. Exploration outside the log

These commands ran between Part 1 and Part 3 with a small shell helper that did not record them. The outputs are copied as printed. `G` stands for `npx genie-react ... --session art-l2`.

Grouping the newest 200 Redux records by type, shortly after typing `c` on a freshly loaded /issues:

```
$ npx genie-react call redux_state '{"path":["issues","filters","text"]}' --session art-l2 --select /value | tail -1
result: c
$ npx genie-react call redux_actions '{"limit":200}' --session art-l2 --json --max-bytes 50000000 | jq -c '.records | map(.type // .kind) | group_by(.) | map({type: .[0], n: length})'
[{"type":"service/subscriptions/internal_probeSubscription","n":200}]
$ ... | jq -c '.coverage, .latestSequence'
{"historyLimit":500,"evictedRecords":2849,"unrecordedChanges":0,"mutationDetection":true}
3349
```

The sequence number at rest, read three times about 3 seconds apart:

```
result: 3349
result: 3755
result: 3755
```

One keystroke on a page that had settled:

```
$ G call redux_actions '{"limit":1}' --select /latestSequence | tail -1
result: 5081
$ agent-browser --session art-l2 type 'input[aria-label="Filter issues"]' a
$ G call redux_actions '{"typePrefix":"issues/","limit":3}' --fields sequence,type,changedSlices
[1]:
  - {sequence:5082,type:issues/filtersChanged,changedSlices:[issues]}
$ G call redux_actions '{"limit":1}' --select /latestSequence | tail -1
result: 5191
```

Identifying the renders `redux_actions` linked to `issues/filtersChanged` (sequence 5192, `renderEventIds` `render:102:8788` and `render:102:8817`, from the logged batch in Part 1):

```
$ G call react_render_causes '{"commit":102,"limit":500,"appOnly":false}' --json --max-bytes 50000000 > c102.json
$ jq -c '.events[] | select(.renderEventId=="render:102:8788" or .renderEventId=="render:102:8817") | {renderEventId, componentName, causes}' c102.json
{"renderEventId":"render:102:8817","componentName":"Connect(IssueTable)","causes":[{"kind":"external-store","evidence":"inferred","name":"selector","redux":{"evidence":"exact","actions":["issues/filtersChanged"]}}]}
{"renderEventId":"render:102:8788","componentName":"Connect(ProjectNav)","causes":[{"kind":"external-store","evidence":"inferred","name":"selector","redux":{"evidence":"exact","actions":["issues/filtersChanged"]}}]}
```

After `app_backend_reset` with `notificationPollMs: 120000` and the logged `measure-filter` run (which returned no `issues/` records), paging through the full 500-record history:

```
$ G call redux_actions '{"limit":200}' --json --max-bytes 50000000 | jq -c '.records | map({s:.sequence,t:(.type // .kind)}) | group_by(.t) | map({t:.[0].t, n:length, min:(map(.s)|min), max:(map(.s)|max)})'
[{"t":"service/subscriptions/internal_probeSubscription","n":200,"min":3664,"max":3863}]
$ for a in 3363 3563; do G call redux_actions "{\"afterSequence\":$a,\"limit\":200}" --json --max-bytes 50000000 | jq -c '...same grouping...'; done
[{"t":"service/executeQuery/rejected","n":53,"min":3407,"max":3563},{"t":"service/subscriptions/unsubscribeQueryResult","n":41,"min":3364,"max":3404},{"t":"thunk","n":106,"min":3405,"max":3562}]
[{"t":"service/executeQuery/rejected","n":33,"min":3566,"max":3662},{"t":"service/subscriptions/internal_probeSubscription","n":100,"min":3664,"max":3763},{"t":"thunk","n":66,"min":3564,"max":3661},{"t":"unrecorded-change","n":1,"min":3663,"max":3663}]
```

The Redux collector's history size is a constant: `HISTORY_LIMIT = 500` in `packages/genie-react/src/collectors/redux/store-tap.ts`.

Trying the sidebar toggle on /settings, a quieter page:

```
$ agent-browser --session art-l2 open 'http://127.0.0.1:5212/settings'; sleep 3
$ G call react_clear_renders '{}' --select /ok | tail -1
result: true
$ agent-browser --session art-l2 click 'button[aria-label="Toggle sidebar"]'
$ G call react_quiesce '{"idleMs":500,"timeoutMs":10000}' --select /outcome | tail -1
result: idle
$ G call redux_actions '{"typePrefix":"ui/","limit":2,"view":"full"}' --json | jq -c '.records[] | {sequence,type,changedSlices,renderEventIds}'
{"sequence":47,"type":"ui/sidebarToggled","changedSlices":["ui"],"renderEventIds":["render:19:3"]}
$ G call react_render_causes '{"component":"AccountMenu","view":"full"}' --json | jq -c '.events[] | {renderEventId, r: .causes[0].redux | {evidence, reason, actions: [.actions[]|{sequence,type}]}}'
{"renderEventId":"render:20:36","r":{"evidence":"inferred","reason":"no-recorded-change-between-renders","actions":[]}}
{"renderEventId":"render:19:16","r":{"evidence":"inferred","reason":"previous-render-unavailable","actions":[{"sequence":45,"type":"notifications/fetch/fulfilled"},{"sequence":46,"type":"notifications/fetch/fulfilled"},{"sequence":47,"type":"ui/sidebarToggled"}]}}
$ G call react_get_renders '{"appOnly":false,"limit":1}' --select /summary/totalRenders | tail -1
result: 29
```

I did not use the sidebar toggle, because it re-renders `TopBar`, the menu's parent, so the menu would render even after the fix.

Two tries on /issues with the filter, reading in one batch right after the keystrokes:

```
$ agent-browser --session art-l2 open 'http://127.0.0.1:5212/issues'; sleep 3
$ G call react_clear_renders '{}' --select /ok | tail -1
result: true
$ agent-browser --session art-l2 type 'input[aria-label="Filter issues"]' ca
$ G call react_quiesce '{"idleMs":500,"timeoutMs":10000}' --select /outcome | tail -1
result: idle
$ G batch '[{"tool":"react_render_causes","args":{"component":"AccountMenu","view":"full"}},{"tool":"redux_actions","args":{"typePrefix":"issues/","limit":5}}]' --json > try.json
$ jq -c '.[0].result.events[] | {renderEventId, r: .causes[0].redux | {evidence, reason, actions: [.actions[]|{sequence,type}]}}' try.json
{"renderEventId":"render:24:3174","r":{"evidence":"inferred","reason":"unrecorded-state-change","actions":[{"sequence":3663,"type":null}]}}
$ jq -c '.[0].result.renderEventRetention' try.json
{"evictedEvents":1078,"earliestDocumentCommitId":23,"latestDocumentCommitId":26}
$ jq -c '.[1].result.records[] | {sequence,type,renderEventIds}' try.json
(no output)
```

```
$ agent-browser --session art-l2 open 'http://127.0.0.1:5212/issues'; sleep 6
$ G call react_clear_renders '{}' --select /ok | tail -1
result: true
$ agent-browser --session art-l2 type 'input[aria-label="Filter issues"]' c
$ G call react_quiesce '{"idleMs":500,"timeoutMs":10000}' --select /outcome | tail -1
result: idle
$ G batch '...same batch...' --json > try.json
$ jq ... try.json
{"renderEventId":"render:25:982","r":{"evidence":"inferred","reason":"unrecorded-state-change","actions":[{"sequence":2743,"type":null}]}}
{"evictedEvents":39,"earliestDocumentCommitId":24,"latestDocumentCommitId":26}
2943
```

The View name input, one keystroke and then two:

```
$ agent-browser --session art-l2 open 'http://127.0.0.1:5212/issues'; sleep 8
$ G call redux_actions '{"limit":1}' --select /latestSequence | tail -1
result: 1959
$ G call react_clear_renders '{}' --select /ok | tail -1
result: true
$ agent-browser --session art-l2 type 'input[aria-label="View name"]' S
$ G call react_quiesce '{"idleMs":500,"timeoutMs":10000}' --select /outcome | tail -1
result: idle
$ G batch '[{"tool":"react_render_causes","args":{"component":"AccountMenu","view":"full"}},{"tool":"redux_actions","args":{"typePrefix":"savedViews/","limit":5,"view":"full"}}]' --json > try.json
{"renderEventId":"render:25:2","r":{"evidence":"inferred","reason":"previous-render-unavailable","actions":[{"sequence":1558,"type":"notifications/fetch/fulfilled"},{"sequence":1759,"type":"notifications/fetch/fulfilled"},{"sequence":1960,"type":"savedViews/draftNameChanged"}]}}
{"sequence":1960,"type":"savedViews/draftNameChanged","changedSlices":["savedViews"],"renderEventIds":["render:25:7","render:25:30"]}
2160
```

```
$ agent-browser --session art-l2 open 'http://127.0.0.1:5212/issues'; sleep 8
$ G call react_clear_renders '{}' --select /ok | tail -1
result: true
$ agent-browser --session art-l2 type 'input[aria-label="View name"]' Sp
$ G call react_quiesce '{"idleMs":500,"timeoutMs":10000}' --select /outcome | tail -1
result: idle
$ G batch '...same batch...' --json > try.json
{"renderEventId":"render:27:735","r":{"evidence":"exact","reason":"dispatched-between-renders","actions":[{"sequence":2561,"type":"savedViews/draftNameChanged"}]}}
{"sequence":2360,"type":"savedViews/draftNameChanged","changedSlices":["savedViews"],"renderEventIds":["render:26:7","render:26:30"]}
{"sequence":2561,"type":"savedViews/draftNameChanged","changedSlices":["savedViews"],"renderEventIds":["render:27:735","render:27:740","render:27:759","render:27:763"]}
```

## Part 3. The runs the article quotes (logged)

```
# poll slowed for every run below (app_backend_reset with notificationPollMs 120000 was called before; calling again for the record)
$ npx genie-react call app_backend_reset '{"notificationPollMs":120000}' --session art-l2
seed: 2019
issues: 3240
notificationPollMs: 120000
[exit 0]

# === 1. symptom, before fix: type 'cache' in the issue filter
$ agent-browser --session art-l2 open 'http://127.0.0.1:5212/issues'
✓ Acme Tracker
  http://127.0.0.1:5212/issues
[exit 0]

$ npx genie-react status --session art-l2 --wait 15000 --select /app
status: ok
selection: {expression:/app,matchedPathCount:1,matchedPaths:[/app],omittedPathCount:48}
result: {name:"Acme Tracker",url:http://127.0.0.1:5212/issues,reactVersion:18.3.1,reactMounted:true}
[exit 0]

$ npx genie-react call react_clear_renders '{"component":"AccountMenu"}' --session art-l2 --select /ok
status: ok
selection: {expression:/ok,matchedPathCount:1,matchedPaths:[/ok],omittedPathCount:15}
result: true
[exit 0]

$ agent-browser --session art-l2 type 'input[aria-label="Filter issues"]' cache
✓ Done
[exit 0]

$ npx genie-react call react_quiesce '{"idleMs":500,"timeoutMs":10000}' --fail-on-result-error --session art-l2 --select /outcome
status: ok
selection: {expression:/outcome,matchedPathCount:1,matchedPaths:[/outcome],omittedPathCount:13}
result: idle
[exit 0]

$ npx genie-react call react_get_renders '{"component":"AccountMenu","appOnly":false}' --session art-l2 --fields name,renders,updates,causeCounts,necessity,necessityReason
[1]:
  - {name:AccountMenu,renders:9,updates:9,causeCounts:{external-store:9},necessity:unnecessary,necessityReason:inputs-unchanged}
[exit 0]

$ npx genie-react call redux_actions '{"limit":1}' --session art-l2 --select /latestSequence
status: ok
selection:
  expression: /latestSequence
  matchedPathCount: 1
  matchedPaths: [/latestSequence]
  omittedPathCount: 30
result: 5378
[exit 0]

# === 2. chain, before fix: type 'Sp' in View name, read causes and actions in one batch
$ agent-browser --session art-l2 open 'http://127.0.0.1:5212/issues'
✓ Acme Tracker
  http://127.0.0.1:5212/issues
[exit 0]

$ npx genie-react status --session art-l2 --wait 15000 --select /app
status: ok
selection: {expression:/app,matchedPathCount:1,matchedPaths:[/app],omittedPathCount:48}
result: {name:"Acme Tracker",url:http://127.0.0.1:5212/issues,reactVersion:18.3.1,reactMounted:true}
[exit 0]

$ npx genie-react call react_clear_renders '{}' --session art-l2 --select /ok
status: ok
selection: {expression:/ok,matchedPathCount:1,matchedPaths:[/ok],omittedPathCount:15}
result: true
[exit 0]

$ agent-browser --session art-l2 type 'input[aria-label="View name"]' Sp
✓ Done
[exit 0]

$ npx genie-react call react_quiesce '{"idleMs":500,"timeoutMs":10000}' --fail-on-result-error --session art-l2 --select /outcome
status: ok
selection: {expression:/outcome,matchedPathCount:1,matchedPaths:[/outcome],omittedPathCount:13}
result: idle
[exit 0]

$ npx genie-react batch '[{"tool":"react_render_causes","args":{"component":"AccountMenu","view":"full"}},{"tool":"redux_actions","args":{"typePrefix":"savedViews/","view":"full"}}]' --session art-l2 --json > /tmp/docs7/art-l2/chain.json; echo saved
saved
[exit 0]

--- full untrimmed batch output (/tmp/docs7/art-l2/chain.json):
[{"schemaVersion":"2.0","tool":"react_render_causes","ok":true,"status":"ok","result":{"componentMatch":{"component":"AccountMenu","exact":true,"status":"matched","matchedNames":["AccountMenu"],"matchedNameCount":1,"similarNames":[]},"tracking":true,"commits":3,"documentCommitId":28,"observation":{"id":"observation:1","epoch":1,"startedAfterDocumentCommitId":25},"attribution":{"status":"current","startedAtDocumentCommitId":28,"completedAtDocumentCommitId":28,"startedAtAnalysisGeneration":29,"completedAtAnalysisGeneration":29},"view":"full","events":[{"renderEventId":"render:27:735","observationId":"observation:1","commitId":2,"documentCommitId":27,"componentId":6046676418600,"componentName":"AccountMenu","instance":{"fiberId":6046676418600,"mountId":"mount:1","key":null,"siblingIndex":3,"parent":{"fiberId":6046676418591,"name":"TopBar","key":null},"keyedParent":null,"logicalPath":"AppErrorBoundary[index=0] > Provider[index=0] > BrowserRouter[index=0] > Router[index=0] > ThemeProvider[index=0] > App[index=0] > Routes[index=0] > RenderedRoute[index=0] > RequireAuth[index=0] > Connect(AppShell)[index=0] > AppShell[index=0] > FeatureFlagsProvider[index=0] > <div>[index=0] > TopBar[index=0] > <header>[index=0] > <div>[index=3] > AccountMenu[index=3]","logicalIdentityEvidence":"positional","mountGeneration":1,"mountGenerationEvidence":"exact","hostSelector":null},"causes":[{"kind":"external-store","evidence":"inferred","reason":"external-store-snapshot-changed","hookIndex":4,"externalStoreIndex":0,"subscriberId":"subscriber:mount:1:0","selectionEqual":false,"subscriptionFired":true,"before":{"user":{"id":"u-1","name":"Dana Whitfield","email":"dana@acme.test","title":"Designer","team":"Infra"},"savedViewCount":0},"after":{"user":{"id":"u-1","name":"Dana Whitfield","email":"dana@acme.test","title":"Designer","team":"Infra"},"savedViewCount":0},"changedFields":[],"deepDiff":{"changes":[{"kind":"reference-only","path":""}],"visited":3,"truncated":false},"storeId":"external-store:1","storeLabel":"anonymous-external-store","selector":null,"equality":"object-is","fanout":null,"notificationId":null,"competingCandidates":["external-store-snapshot-identity-changed"],"redux":{"storeId":"redux-store:1","link":"subscription","evidence":"exact","reason":"dispatched-between-renders","actions":[{"actionId":"redux-store:1/action:2561","sequence":2561,"kind":"action","type":"savedViews/draftNameChanged","changedSlices":["savedViews"]}],"omittedActions":0},"hookProvenance":{"status":"unavailable","evidence":"unknown","reason":"shadow-render-disabled"}}],"necessity":"unnecessary","necessityReason":"inputs-unchanged","assessment":{"inputEvidence":"none-observed","observedInputKinds":[],"behaviorEvidence":{"subtreeHostMutations":{"status":"none-observed","count":0,"pendingSubtrees":0,"omittedByLimit":0,"callbackOnlyUpdates":0,"writes":[],"callbacks":[]},"scheduledEffects":{"status":"observed","count":2},"subtreeScheduledEffects":{"status":"observed","count":2},"unobservedDomains":["focus","url","network","transition","freshness","effect-execution"]},"optimizationSafety":"not-proven-safe","requiredValidation":["dom","aria","focus","url","network","transition"]},"inputCoverage":{"complete":true,"omittedInputs":0,"scanTruncated":false,"propsNotEnumerated":false},"source":{"file":"<repo>/apps/realworld-legacy/src/layout/top-bar.tsx","line":32,"column":9,"functionName":null,"sourceMapConfidence":"served","role":"element-callsite"},"sourceAttribution":{"role":"usage-or-definition-fallback","evidence":"inferred"},"sourceOwnership":"app","isLibrary":false}],"omittedByLimit":0,"sourceClassification":{"complete":true,"affects":"result","totalCandidates":1,"evaluated":1,"app":1,"library":0,"unknown":0,"unknownComponents":[],"unknownComponentsOmitted":0},"renderEventRetention":{"evictedEvents":39,"earliestDocumentCommitId":26,"latestDocumentCommitId":28},"coverage":{"skippedCommitFibers":0,"droppedUnmountFibers":0,"analysisFailedFibers":0,"pausedCommits":0,"unobservedCommits":0,"refreshCommitsExcluded":0,"truncatedInputFibers":0,"propsNotEnumeratedFibers":0,"budgetExhaustedCommits":0,"budgetExhaustedSubsystems":[],"complete":false,"inputAttributionComplete":true,"semantics":"lower-bound","coverageDomain":"render-causality","droppedRenderEvents":39}},"session":{"sessionId":"63372052-5304-446b-8c3a-dbf296b9849c","logicalSessionId":"78de5a45-c576-47c7-b2e0-a17f611dd5ff"}},{"schemaVersion":"2.0","tool":"redux_actions","ok":true,"status":"ok","result":{"store":{"storeId":"redux-store:1","name":"app"},"records":[{"sequence":2360,"actionId":"redux-store:1/action:2360","kind":"action","type":"savedViews/draftNameChanged","label":"savedViews/draftNameChanged","parentActionId":null,"at":1795060884014,"durationMs":1.2,"outcome":"returned","error":null,"rootStateChanged":true,"changedSlices":["savedViews"],"changedSlicesTruncated":false,"unrecordedNestedDispatches":0,"mutation":{"status":"none-detected","notScannedReason":null,"findings":[],"findingsOmitted":false,"objectsCompared":4,"scanTruncated":true},"payload":{"type":"savedViews/draftNameChanged","payload":"S"},"renderEventIds":["render:26:7","render:26:30"],"reactWorkActive":false,"genieMs":0},{"sequence":2561,"actionId":"redux-store:1/action:2561","kind":"action","type":"savedViews/draftNameChanged","label":"savedViews/draftNameChanged","parentActionId":null,"at":1795060884045,"durationMs":1.3,"outcome":"returned","error":null,"rootStateChanged":true,"changedSlices":["savedViews"],"changedSlicesTruncated":false,"unrecordedNestedDispatches":0,"mutation":{"status":"none-detected","notScannedReason":null,"findings":[],"findingsOmitted":false,"objectsCompared":4,"scanTruncated":true},"payload":{"type":"savedViews/draftNameChanged","payload":"Sp"},"renderEventIds":["render:27:735","render:27:740","render:27:759","render:27:763"],"reactWorkActive":false,"genieMs":0.1}],"matched":2,"omittedBefore":0,"more":false,"nextAfterSequence":2561,"latestSequence":2761,"coverage":{"historyLimit":500,"evictedRecords":2261,"unrecordedChanges":0,"mutationDetection":true}},"session":{"sessionId":"63372052-5304-446b-8c3a-dbf296b9849c","logicalSessionId":"78de5a45-c576-47c7-b2e0-a17f611dd5ff"}}]

$ jq '.[0].result.events[] | {renderEventId, necessity, necessityReason, cause: (.causes[0] | {kind, evidence, equality, selectionEqual, changedFields, before, after, deepDiff, redux: {evidence: .redux.evidence, reason: .redux.reason, actions: [.redux.actions[] | {sequence, type, changedSlices}]}})}' /tmp/docs7/art-l2/chain.json
{
  "renderEventId": "render:27:735",
  "necessity": "unnecessary",
  "necessityReason": "inputs-unchanged",
  "cause": {
    "kind": "external-store",
    "evidence": "inferred",
    "equality": "object-is",
    "selectionEqual": false,
    "changedFields": [],
    "before": {
      "user": {
        "id": "u-1",
        "name": "Dana Whitfield",
        "email": "dana@acme.test",
        "title": "Designer",
        "team": "Infra"
      },
      "savedViewCount": 0
    },
    "after": {
      "user": {
        "id": "u-1",
        "name": "Dana Whitfield",
        "email": "dana@acme.test",
        "title": "Designer",
        "team": "Infra"
      },
      "savedViewCount": 0
    },
    "deepDiff": {
      "changes": [
        {
          "kind": "reference-only",
          "path": ""
        }
      ],
      "visited": 3,
      "truncated": false
    },
    "redux": {
      "evidence": "exact",
      "reason": "dispatched-between-renders",
      "actions": [
        {
          "sequence": 2561,
          "type": "savedViews/draftNameChanged",
          "changedSlices": [
            "savedViews"
          ]
        }
      ]
    }
  }
}
[exit 0]

$ jq '.[1].result.records[] | {sequence, type, changedSlices, payload: .payload.payload, renderEventIds}' /tmp/docs7/art-l2/chain.json
{
  "sequence": 2360,
  "type": "savedViews/draftNameChanged",
  "changedSlices": [
    "savedViews"
  ],
  "payload": "S",
  "renderEventIds": [
    "render:26:7",
    "render:26:30"
  ]
}
{
  "sequence": 2561,
  "type": "savedViews/draftNameChanged",
  "changedSlices": [
    "savedViews"
  ],
  "payload": "Sp",
  "renderEventIds": [
    "render:27:735",
    "render:27:740",
    "render:27:759",
    "render:27:763"
  ]
}
[exit 0]

# === 3. verify, before fix
$ agent-browser --session art-l2 open 'http://127.0.0.1:5212/issues'
✓ Acme Tracker
  http://127.0.0.1:5212/issues
[exit 0]

$ npx genie-react status --session art-l2 --wait 15000 --select /app
status: ok
selection: {expression:/app,matchedPathCount:1,matchedPaths:[/app],omittedPathCount:48}
result: {name:"Acme Tracker",url:http://127.0.0.1:5212/issues,reactVersion:18.3.1,reactMounted:true}
[exit 0]

$ npx genie-react verify begin --session art-l2 --name 'type cache in the issue filter' --claim 'render AccountMenu max 0' --claim 'render IssueTableToolbar min 1' --claim 'boundaries clean' --budget '{"adaptive":false,"fiberLimit":20000,"operationLimit":2000000,"timeLimitMs":500}'
recording vfy_c6ed20f8-1978-46fd-9434-db0b87c5327c "type cache in the issue filter"
  url "http://127.0.0.1:5212/issues"
  1 null render AccountMenu max 0  {}
  2 null render IssueTableToolbar min 1  {}
  3 null boundaries clean  {}
window: {observationId:observation:1,startDocumentCommitId:24,domains:[react],quietMs:500,timeoutMs:10000,tailMs:500}
next: $ pnpm exec genie-react verify end vfy_c6ed20f8-1978-46fd-9434-db0b87c5327c --session art-l2
session: {sessionId:be4f555b-c39f-4fef-ba51-cf7c303e83d3,logicalSessionId:78de5a45-c576-47c7-b2e0-a17f611dd5ff,documentGeneration:20}
schemaVersion: "1.0"
targets: [{target:{component:AccountMenu},status:resolved,instances:1,source:<repo>/apps/realworld-legacy/src/layout/top-bar.tsx},{target:{component:IssueTableToolbar},status:resolved,instances:1,source:<repo>/apps/realworld-legacy/src/features/issues/issues-page.tsx}]
startedAt: 2026-11-19T04:01:47.009Z
expiresAt: 2026-11-19T04:06:47.026Z
request: {budget:{fiberLimit:20000,operationLimit:2000000,timeLimitMs:500,targetOperationReserve:4000,targetTimeReserveMs:4,adaptive:false},settle:{quietMs:500,timeoutMs:10000},maxDurationMs:300000,allowOverrides:false}
[exit 0]

$ agent-browser --session art-l2 type 'input[aria-label="Filter issues"]' cache
✓ Done
[exit 0]

$ npx genie-react verify end vfy_c6ed20f8-1978-46fd-9434-db0b87c5327c --session art-l2
fail vfy_c6ed20f8-1978-46fd-9434-db0b87c5327c "type cache in the issue filter"  11 commits, quiet after 657 ms (react)
  url "http://127.0.0.1:5212/issues"
  1 fail render AccountMenu max 0  {renders:9,mounts:0,updates:9,remounts:0,semantics:exact,instances:1,activeInstances:1}
      claim: {kind:renders,target:{component:AccountMenu},max:0,counting:renders,allowRemount:false}
      deciding: [{kind:instance,mountId:mount:1,renders:9,mounts:0,updates:9,mountGeneration:1,latestDocumentCommitId:33,source:<repo>/apps/realworld-legacy/src/layout/top-bar.tsx:32:9}]
  2 pass render IssueTableToolbar min 1  {renders:5,mounts:0,updates:5,remounts:0,semantics:exact,instances:1,activeInstances:1}
      claim: {kind:renders,target:{component:IssueTableToolbar},min:1,counting:renders,allowRemount:false}
      deciding: [{kind:instance,mountId:mount:2,renders:5,mounts:0,updates:5,mountGeneration:1,latestDocumentCommitId:32,source:<repo>/apps/realworld-legacy/src/features/issues/issues-page.tsx:21:7}]
  3 pass boundaries clean  {caughtDuringWindow:0,caughtAtEnd:0}
      claim: {kind:boundaries-clean,scope:window}
      deciding: [{kind:boundary-log,scope:window,complete:true,afterDocumentCommitId:24}]
      caveats: [uncaught-errors-outside-boundaries-unobserved]
window: {observationId:observation:1,startDocumentCommitId:24,settledDocumentCommitId:34,frozenDocumentCommitId:35,commits:11,settle:{outcome:met,quietMs:500,timeoutMs:10000,waitedMs:657,domains:{react:met}},tail:{ms:500,commits:1},environment:{bundle:development,strictMode:on,renderCollection:available,visibility:unavailable}}
! ui-outcome-not-observed: Genie does not check the screen; confirm it with the UI driver
! visibility-unobserved: the app reports no visibility signal, so a hidden interval was not observed
attempt 1 for these claims on this tab
evidence: $ pnpm exec genie-react verify show vfy_c6ed20f8-1978-46fd-9434-db0b87c5327c --claim 1 --session art-l2
session: {sessionId:be4f555b-c39f-4fef-ba51-cf7c303e83d3,logicalSessionId:78de5a45-c576-47c7-b2e0-a17f611dd5ff,documentGeneration:20}
schemaVersion: "1.0"
exitCode: 1
stage: end
ledger: {fingerprint:cf_a5706c2a0820,scope:logical-session,storage:memory,attempt:1,history:[],codeChangedSincePrevious:null,failsOnSameCode:0}
evidence: {retained:true,tools:[react_get_renders,react_component_cohort,react_list_overrides,react_refresh_events,react_profile_stop,react_error_state]}
startedAt: 2026-11-19T04:01:47.009Z
endedAt: 2026-11-19T04:01:48.727Z
request: {budget:{fiberLimit:20000,operationLimit:2000000,timeLimitMs:500,targetOperationReserve:4000,targetTimeReserveMs:4,adaptive:false},settle:{quietMs:500,timeoutMs:10000},maxDurationMs:300000,allowOverrides:false}
[exit 1]

# --- reference fix applied to src/layout/account-menu.tsx; webpack rebuilt
diff --git a/apps/realworld-legacy/src/layout/account-menu.tsx b/apps/realworld-legacy/src/layout/account-menu.tsx
index ab4d153..88282ad 100644
--- a/apps/realworld-legacy/src/layout/account-menu.tsx
+++ b/apps/realworld-legacy/src/layout/account-menu.tsx
@@ -6,10 +6,8 @@ import { signOut } from '../store/session'
 
 export function AccountMenu() {
   const dispatch = useAppDispatch()
-  const { user, savedViewCount } = useAppSelector((state) => ({
-    user: state.session.user,
-    savedViewCount: state.savedViews.views.length,
-  }))
+  const user = useAppSelector((state) => state.session.user)
+  const savedViewCount = useAppSelector((state) => state.savedViews.views.length)
   if (!user) return null
   return (
     <Dropdown>
# === 4. verify, after fix
$ agent-browser --session art-l2 open 'http://127.0.0.1:5212/issues'
✓ Acme Tracker
  http://127.0.0.1:5212/issues
[exit 0]

$ npx genie-react status --session art-l2 --wait 15000 --select /app
status: ok
selection: {expression:/app,matchedPathCount:1,matchedPaths:[/app],omittedPathCount:48}
result: {name:"Acme Tracker",url:http://127.0.0.1:5212/issues,reactVersion:18.3.1,reactMounted:true}
[exit 0]

$ npx genie-react verify begin --session art-l2 --name 'type cache in the issue filter' --claim 'render AccountMenu max 0' --claim 'render IssueTableToolbar min 1' --claim 'boundaries clean' --budget '{"adaptive":false,"fiberLimit":20000,"operationLimit":2000000,"timeLimitMs":500}'
recording vfy_4cdb6b26-c1e3-4d80-8ada-77290a66f81c "type cache in the issue filter"
  url "http://127.0.0.1:5212/issues"
  1 null render AccountMenu max 0  {}
  2 null render IssueTableToolbar min 1  {}
  3 null boundaries clean  {}
window: {observationId:observation:1,startDocumentCommitId:25,domains:[react],quietMs:500,timeoutMs:10000,tailMs:500}
next: $ pnpm exec genie-react verify end vfy_4cdb6b26-c1e3-4d80-8ada-77290a66f81c --session art-l2
session: {sessionId:60b05796-7db8-4fa0-b25d-98c54a711a9d,logicalSessionId:78de5a45-c576-47c7-b2e0-a17f611dd5ff,documentGeneration:22}
schemaVersion: "1.0"
targets: [{target:{component:AccountMenu},status:resolved,instances:1,source:<repo>/apps/realworld-legacy/src/layout/top-bar.tsx},{target:{component:IssueTableToolbar},status:resolved,instances:1,source:<repo>/apps/realworld-legacy/src/features/issues/issues-page.tsx}]
startedAt: 2026-11-19T04:02:10.774Z
expiresAt: 2026-11-19T04:07:10.793Z
request: {budget:{fiberLimit:20000,operationLimit:2000000,timeLimitMs:500,targetOperationReserve:4000,targetTimeReserveMs:4,adaptive:false},settle:{quietMs:500,timeoutMs:10000},maxDurationMs:300000,allowOverrides:false}
[exit 0]

$ agent-browser --session art-l2 type 'input[aria-label="Filter issues"]' cache
✓ Done
[exit 0]

$ npx genie-react verify end vfy_4cdb6b26-c1e3-4d80-8ada-77290a66f81c --session art-l2
pass vfy_4cdb6b26-c1e3-4d80-8ada-77290a66f81c "type cache in the issue filter"  11 commits, quiet after 651 ms (react)
  url "http://127.0.0.1:5212/issues"
  1 pass render AccountMenu max 0  {renders:0,mounts:0,updates:0,remounts:0,semantics:exact,instances:1,activeInstances:1}
      claim: {kind:renders,target:{component:AccountMenu},max:0,counting:renders,allowRemount:false}
      deciding: [{kind:coverage,complete:true,targetedComplete:true,semantics:exact},{kind:instance,mountId:mount:1,renderingState:mounted-rendering,source:<repo>/apps/realworld-legacy/src/layout/top-bar.tsx:32:9}]
  2 pass render IssueTableToolbar min 1  {renders:5,mounts:0,updates:5,remounts:0,semantics:exact,instances:1,activeInstances:1}
      claim: {kind:renders,target:{component:IssueTableToolbar},min:1,counting:renders,allowRemount:false}
      deciding: [{kind:instance,mountId:mount:2,renders:5,mounts:0,updates:5,mountGeneration:1,latestDocumentCommitId:33,source:<repo>/apps/realworld-legacy/src/features/issues/issues-page.tsx:21:7}]
  3 pass boundaries clean  {caughtDuringWindow:0,caughtAtEnd:0}
      claim: {kind:boundaries-clean,scope:window}
      deciding: [{kind:boundary-log,scope:window,complete:true,afterDocumentCommitId:25}]
      caveats: [uncaught-errors-outside-boundaries-unobserved]
window: {observationId:observation:1,startDocumentCommitId:25,settledDocumentCommitId:35,frozenDocumentCommitId:36,commits:11,settle:{outcome:met,quietMs:500,timeoutMs:10000,waitedMs:651,domains:{react:met}},tail:{ms:500,commits:1},environment:{bundle:development,strictMode:on,renderCollection:available,visibility:unavailable}}
! ui-outcome-not-observed: Genie does not check the screen; confirm it with the UI driver
! visibility-unobserved: the app reports no visibility signal, so a hidden interval was not observed
attempt 2 for these claims on this tab; previous fail vfy_c6ed20f8-1978-46fd-9434-db0b87c5327c; document reloaded since
evidence: $ pnpm exec genie-react verify show vfy_4cdb6b26-c1e3-4d80-8ada-77290a66f81c --session art-l2
session: {sessionId:60b05796-7db8-4fa0-b25d-98c54a711a9d,logicalSessionId:78de5a45-c576-47c7-b2e0-a17f611dd5ff,documentGeneration:22}
schemaVersion: "1.0"
exitCode: 0
stage: end
ledger: {fingerprint:cf_a5706c2a0820,scope:logical-session,storage:memory,attempt:2,history:[{verificationId:vfy_c6ed20f8-1978-46fd-9434-db0b87c5327c,verdict:fail,reasons:[],endedAt:2026-11-19T04:01:48.727Z}],codeChangedSincePrevious:document-reloaded,failsOnSameCode:0}
evidence: {retained:true,tools:[react_get_renders,react_component_cohort,react_list_overrides,react_refresh_events,react_profile_stop,react_error_state]}
startedAt: 2026-11-19T04:02:10.774Z
endedAt: 2026-11-19T04:02:12.515Z
request: {budget:{fiberLimit:20000,operationLimit:2000000,timeLimitMs:500,targetOperationReserve:4000,targetTimeReserveMs:4,adaptive:false},settle:{quietMs:500,timeoutMs:10000},maxDurationMs:300000,allowOverrides:false}
[exit 0]

# === 5. symptom, after fix
$ agent-browser --session art-l2 open 'http://127.0.0.1:5212/issues'
✓ Acme Tracker
  http://127.0.0.1:5212/issues
[exit 0]

$ npx genie-react status --session art-l2 --wait 15000 --select /app
status: ok
selection: {expression:/app,matchedPathCount:1,matchedPaths:[/app],omittedPathCount:48}
result: {name:"Acme Tracker",url:http://127.0.0.1:5212/issues,reactVersion:18.3.1,reactMounted:true}
[exit 0]

$ npx genie-react call react_clear_renders '{"component":"AccountMenu"}' --session art-l2 --select /ok
status: ok
selection: {expression:/ok,matchedPathCount:1,matchedPaths:[/ok],omittedPathCount:15}
result: true
[exit 0]

$ agent-browser --session art-l2 type 'input[aria-label="Filter issues"]' cache
✓ Done
[exit 0]

$ npx genie-react call react_quiesce '{"idleMs":500,"timeoutMs":10000}' --fail-on-result-error --session art-l2 --select /outcome
status: ok
selection: {expression:/outcome,matchedPathCount:1,matchedPaths:[/outcome],omittedPathCount:13}
result: idle
[exit 0]

$ npx genie-react call react_get_renders '{"component":"AccountMenu","appOnly":false}' --session art-l2 --fields name,renders,updates,causeCounts,necessity,necessityReason
! fields_unverified: The projected collection is empty, so no rows were emitted and --fields could not be checked against row keys. {collection:/components}
[exit 0]

$ npx genie-react call redux_actions '{"limit":1}' --session art-l2 --select /latestSequence
status: ok
selection:
  expression: /latestSequence
  matchedPathCount: 1
  matchedPaths: [/latestSequence]
  omittedPathCount: 30
result: 4978
[exit 0]

# --- fix reverted with git checkout
# === 6. react-redux's own development warning, shipped code
$ agent-browser --session art-l2 open 'http://127.0.0.1:5212/issues'
✓ Acme Tracker
  http://127.0.0.1:5212/issues
[exit 0]

$ agent-browser --session art-l2 console | grep -n 'Selector' | head -5
7:[warning] Selector unknown returned a different result when called with the same parameters. This can lead to unnecessary rerenders.
8:Selectors that return a new reference (such as an object or an array) should be memoized: https://redux.js.org/usage/deriving-data-selectors#optimizing-selectors-with-memoization {state: Object, selected: Object, selected2: Object, stack: "Error
10:[warning] Selector unknown returned a different result when called with the same parameters. This can lead to unnecessary rerenders.
11:Selectors that return a new reference (such as an object or an array) should be memoized: https://redux.js.org/usage/deriving-data-selectors#optimizing-selectors-with-memoization {state: Object, selected: Object, selected2: Object, stack: "Error
16:[warning] Selector unknown returned a different result when called with the same parameters. This can lead to unnecessary rerenders.
[exit 0]

```

## Part 4. The two other selector bugs (logged)

```
# === board-column-selector-cache, before fix
$ agent-browser --session art-l2 open 'http://127.0.0.1:5212/board'
✓ Acme Tracker
  http://127.0.0.1:5212/board
[exit 0]

$ npx genie-react status --session art-l2 --wait 15000 --select /app
status: ok
selection: {expression:/app,matchedPathCount:1,matchedPaths:[/app],omittedPathCount:48}
result: {name:"Acme Tracker",url:http://127.0.0.1:5212/board,reactVersion:18.3.1,reactMounted:true}
[exit 0]

$ npx genie-react verify begin --session art-l2 --name 'toggle the sidebar' --claim 'render BoardColumn max 0' --claim 'render SideNav min 1' --budget '{"adaptive":false,"fiberLimit":20000,"operationLimit":2000000,"timeLimitMs":500}'
recording vfy_46588cf6-5a59-4742-b4d6-9307c024f382 "toggle the sidebar"
  url "http://127.0.0.1:5212/board"
  1 null render BoardColumn max 0  {}
  2 null render SideNav min 1  {}
window: {observationId:observation:1,startDocumentCommitId:25,domains:[react],quietMs:500,timeoutMs:10000,tailMs:500}
next: $ pnpm exec genie-react verify end vfy_46588cf6-5a59-4742-b4d6-9307c024f382 --session art-l2
session: {sessionId:0d454c44-abee-4494-bd40-4e0298752628,logicalSessionId:78de5a45-c576-47c7-b2e0-a17f611dd5ff,documentGeneration:25}
schemaVersion: "1.0"
targets: [{target:{component:BoardColumn},status:resolved,instances:5,source:<repo>/apps/realworld-legacy/src/features/board/board-page.tsx},{target:{component:SideNav},status:resolved,instances:1,source:<repo>/apps/realworld-legacy/src/layout/app-shell.tsx}]
startedAt: 2026-11-19T04:02:57.219Z
expiresAt: 2026-11-19T04:07:57.240Z
request: {budget:{fiberLimit:20000,operationLimit:2000000,timeLimitMs:500,targetOperationReserve:4000,targetTimeReserveMs:4,adaptive:false},settle:{quietMs:500,timeoutMs:10000},maxDurationMs:300000,allowOverrides:false}
[exit 0]

$ agent-browser --session art-l2 click 'button[aria-label="Toggle sidebar"]'
✓ Done
[exit 0]

$ npx genie-react verify end vfy_46588cf6-5a59-4742-b4d6-9307c024f382 --session art-l2
fail vfy_46588cf6-5a59-4742-b4d6-9307c024f382 "toggle the sidebar"  4 commits, quiet after 813 ms (react)
  url "http://127.0.0.1:5212/board"
  1 fail render BoardColumn max 0  {renders:5,mounts:0,updates:5,remounts:0,semantics:exact,instances:5,activeInstances:5}
      claim: {kind:renders,target:{component:BoardColumn},max:0,counting:renders,allowRemount:false}
      deciding: [{kind:instance,mountId:mount:1,key:backlog,renders:1,mounts:0,updates:1,mountGeneration:1,latestDocumentCommitId:27,source:<repo>/apps/realworld-legacy/src/features/board/board-page.tsx:28:11},{kind:instance,mountId:mount:2,key:todo,renders:1,mounts:0,updates:1,mountGeneration:1,latestDocumentCommitId:27,source:<repo>/apps/realworld-legacy/src/features/board/board-page.tsx:28:11},{kind:instance,mountId:mount:3,key:in_progress,renders:1,mounts:0,updates:1,mountGeneration:1,latestDocumentCommitId:27,source:<repo>/apps/realworld-legacy/src/features/board/board-page.tsx:28:11}]
  2 pass render SideNav min 1  {renders:1,mounts:0,updates:1,remounts:0,semantics:exact,instances:1,activeInstances:1}
      claim: {kind:renders,target:{component:SideNav},min:1,counting:renders,allowRemount:false}
      deciding: [{kind:instance,mountId:mount:6,renders:1,mounts:0,updates:1,mountGeneration:1,latestDocumentCommitId:26,source:<repo>/apps/realworld-legacy/src/layout/app-shell.tsx:26:9}]
window: {observationId:observation:1,startDocumentCommitId:25,settledDocumentCommitId:28,frozenDocumentCommitId:29,commits:4,settle:{outcome:met,quietMs:500,timeoutMs:10000,waitedMs:813,domains:{react:met}},tail:{ms:500,commits:1},environment:{bundle:development,strictMode:unknown,renderCollection:available,visibility:unavailable}}
! ui-outcome-not-observed: Genie does not check the screen; confirm it with the UI driver
! visibility-unobserved: the app reports no visibility signal, so a hidden interval was not observed
attempt 1 for these claims on this tab
evidence: $ pnpm exec genie-react verify show vfy_46588cf6-5a59-4742-b4d6-9307c024f382 --claim 1 --session art-l2
session: {sessionId:0d454c44-abee-4494-bd40-4e0298752628,logicalSessionId:78de5a45-c576-47c7-b2e0-a17f611dd5ff,documentGeneration:25}
schemaVersion: "1.0"
exitCode: 1
stage: end
ledger: {fingerprint:cf_9ebc467d42b2,scope:logical-session,storage:memory,attempt:1,history:[],codeChangedSincePrevious:null,failsOnSameCode:0}
evidence: {retained:true,tools:[react_get_renders,react_component_cohort,react_list_overrides,react_refresh_events,react_profile_stop]}
startedAt: 2026-11-19T04:02:57.219Z
endedAt: 2026-11-19T04:02:58.911Z
request: {budget:{fiberLimit:20000,operationLimit:2000000,timeLimitMs:500,targetOperationReserve:4000,targetTimeReserveMs:4,adaptive:false},settle:{quietMs:500,timeoutMs:10000},maxDurationMs:300000,allowOverrides:false}
[exit 1]

# === issue-table-selector-recompute, before fix
$ agent-browser --session art-l2 open 'http://127.0.0.1:5212/issues'
✓ Acme Tracker
  http://127.0.0.1:5212/issues
[exit 0]

$ npx genie-react status --session art-l2 --wait 15000 --select /app
status: ok
selection: {expression:/app,matchedPathCount:1,matchedPaths:[/app],omittedPathCount:48}
result: {name:"Acme Tracker",url:http://127.0.0.1:5212/issues,reactVersion:18.3.1,reactMounted:true}
[exit 0]

$ npx genie-react verify begin --session art-l2 --name 'type a saved-view name' --claim 'render IssueTable max 0' --claim 'render SavedViews min 1' --budget '{"adaptive":false,"fiberLimit":20000,"operationLimit":2000000,"timeLimitMs":500}'
recording vfy_1b84f623-eca2-485b-9200-92dbcd3b0b2c "type a saved-view name"
  url "http://127.0.0.1:5212/issues"
  1 null render IssueTable max 0  {}
  2 null render SavedViews min 1  {}
window: {observationId:observation:1,startDocumentCommitId:25,domains:[react],quietMs:500,timeoutMs:10000,tailMs:500}
next: $ pnpm exec genie-react verify end vfy_1b84f623-eca2-485b-9200-92dbcd3b0b2c --session art-l2
session: {sessionId:a433e55f-b658-4b66-9a49-0626c36a00c4,logicalSessionId:78de5a45-c576-47c7-b2e0-a17f611dd5ff,documentGeneration:26}
schemaVersion: "1.0"
targets: [{target:{component:IssueTable},status:resolved,instances:1,source:<repo>/apps/realworld-legacy/src/features/issues/issue-table.tsx},{target:{component:SavedViews},status:resolved,instances:1,source:<repo>/apps/realworld-legacy/src/features/issues/issues-page.tsx}]
startedAt: 2026-11-19T04:03:07.812Z
expiresAt: 2026-11-19T04:08:07.830Z
request: {budget:{fiberLimit:20000,operationLimit:2000000,timeLimitMs:500,targetOperationReserve:4000,targetTimeReserveMs:4,adaptive:false},settle:{quietMs:500,timeoutMs:10000},maxDurationMs:300000,allowOverrides:false}
[exit 0]

$ agent-browser --session art-l2 type 'input[aria-label="View name"]' 'Sprint triage'
✓ Done
[exit 0]

$ npx genie-react verify end vfy_1b84f623-eca2-485b-9200-92dbcd3b0b2c --session art-l2
fail vfy_1b84f623-eca2-485b-9200-92dbcd3b0b2c "type a saved-view name"  16 commits, quiet after 1098 ms (react)
  url "http://127.0.0.1:5212/issues"
  1 fail render IssueTable max 0  {renders:13,mounts:0,updates:13,remounts:0,semantics:exact,instances:1,activeInstances:1}
      claim: {kind:renders,target:{component:IssueTable},max:0,counting:renders,allowRemount:false}
      deciding: [{kind:instance,mountId:mount:1,renders:13,mounts:0,updates:13,mountGeneration:1,latestDocumentCommitId:39,source:<repo>/apps/realworld-legacy/src/features/issues/issue-table.tsx:43:7}]
  2 pass render SavedViews min 1  {renders:13,mounts:0,updates:13,remounts:0,semantics:exact,instances:1,activeInstances:1}
      claim: {kind:renders,target:{component:SavedViews},min:1,counting:renders,allowRemount:false}
      deciding: [{kind:instance,mountId:mount:2,renders:13,mounts:0,updates:13,mountGeneration:1,latestDocumentCommitId:39,source:<repo>/apps/realworld-legacy/src/features/issues/issues-page.tsx:22:7}]
window: {observationId:observation:1,startDocumentCommitId:25,settledDocumentCommitId:40,frozenDocumentCommitId:41,commits:16,settle:{outcome:met,quietMs:500,timeoutMs:10000,waitedMs:1098,domains:{react:met}},tail:{ms:500,commits:1},environment:{bundle:development,strictMode:on,renderCollection:available,visibility:unavailable}}
! ui-outcome-not-observed: Genie does not check the screen; confirm it with the UI driver
! visibility-unobserved: the app reports no visibility signal, so a hidden interval was not observed
attempt 1 for these claims on this tab
evidence: $ pnpm exec genie-react verify show vfy_1b84f623-eca2-485b-9200-92dbcd3b0b2c --claim 1 --session art-l2
session: {sessionId:a433e55f-b658-4b66-9a49-0626c36a00c4,logicalSessionId:78de5a45-c576-47c7-b2e0-a17f611dd5ff,documentGeneration:26}
schemaVersion: "1.0"
exitCode: 1
stage: end
ledger: {fingerprint:cf_489115172995,scope:logical-session,storage:memory,attempt:1,history:[],codeChangedSincePrevious:null,failsOnSameCode:0}
evidence: {retained:true,tools:[react_get_renders,react_component_cohort,react_list_overrides,react_refresh_events,react_profile_stop]}
startedAt: 2026-11-19T04:03:07.812Z
endedAt: 2026-11-19T04:03:10.364Z
request: {budget:{fiberLimit:20000,operationLimit:2000000,timeLimitMs:500,targetOperationReserve:4000,targetTimeReserveMs:4,adaptive:false},settle:{quietMs:500,timeoutMs:10000},maxDurationMs:300000,allowOverrides:false}
[exit 1]

# --- board-column-selector-cache reference fix applied:
diff --git a/apps/realworld-legacy/src/features/board/board-column.tsx b/apps/realworld-legacy/src/features/board/board-column.tsx
index 8958042..e514fe4 100644
--- a/apps/realworld-legacy/src/features/board/board-column.tsx
+++ b/apps/realworld-legacy/src/features/board/board-column.tsx
@@ -1,18 +1,19 @@
-import { useCallback } from 'react'
+import { useCallback, useMemo } from 'react'
 import { useNavigate } from 'react-router-dom'
 import type { IssueStatus } from '../../api/types'
-import { selectCardsForColumn } from '../../store/board-selectors'
+import { makeSelectCardsForColumn } from '../../store/board-selectors'
 import { useAppSelector } from '../../store/hooks'
 import { BoardCard } from './board-card'
 
 interface BoardColumnProps {
   status: IssueStatus
   title: string
 }
 
 export function BoardColumn({ status, title }: BoardColumnProps) {
   const navigate = useNavigate()
-  const cards = useAppSelector((state) => selectCardsForColumn(state, status))
+  const selectCards = useMemo(makeSelectCardsForColumn, [])
+  const cards = useAppSelector((state) => selectCards(state, status))
   const openIssue = useCallback((key: string) => navigate(`/issues/${key}`), [navigate])
 
   return (
diff --git a/apps/realworld-legacy/src/store/board-selectors.ts b/apps/realworld-legacy/src/store/board-selectors.ts
index 42068b9..d534637 100644
--- a/apps/realworld-legacy/src/store/board-selectors.ts
+++ b/apps/realworld-legacy/src/store/board-selectors.ts
@@ -26,7 +26,8 @@ const selectBoardIssues = createSelector(
   },
 )
 
-export const selectCardsForColumn = createSelector(
-  [selectBoardIssues, (_state: RootState, status: IssueStatus) => status],
-  (issues, status) => issues.filter((issue) => issue.status === status),
-)
+export const makeSelectCardsForColumn = () =>
+  createSelector(
+    [selectBoardIssues, (_state: RootState, status: IssueStatus) => status],
+    (issues, status) => issues.filter((issue) => issue.status === status),
+  )
# === board-column-selector-cache, after fix
$ agent-browser --session art-l2 open 'http://127.0.0.1:5212/board'
✓ Acme Tracker
  http://127.0.0.1:5212/board
[exit 0]

$ npx genie-react status --session art-l2 --wait 15000 --select /app
status: ok
selection: {expression:/app,matchedPathCount:1,matchedPaths:[/app],omittedPathCount:48}
result: {name:"Acme Tracker",url:http://127.0.0.1:5212/board,reactVersion:18.3.1,reactMounted:true}
[exit 0]

$ npx genie-react verify begin --session art-l2 --name 'toggle the sidebar' --claim 'render BoardColumn max 0' --claim 'render SideNav min 1' --budget '{"adaptive":false,"fiberLimit":20000,"operationLimit":2000000,"timeLimitMs":500}'
recording vfy_b0ac991e-7141-4ac2-8d75-219efa0908f6 "toggle the sidebar"
  url "http://127.0.0.1:5212/board"
  1 null render BoardColumn max 0  {}
  2 null render SideNav min 1  {}
window: {observationId:observation:1,startDocumentCommitId:25,domains:[react],quietMs:500,timeoutMs:10000,tailMs:500}
next: $ pnpm exec genie-react verify end vfy_b0ac991e-7141-4ac2-8d75-219efa0908f6 --session art-l2
session: {sessionId:35bc577a-4356-4bcb-9564-172dacef1f3c,logicalSessionId:78de5a45-c576-47c7-b2e0-a17f611dd5ff,documentGeneration:28}
schemaVersion: "1.0"
targets: [{target:{component:BoardColumn},status:resolved,instances:5,source:<repo>/apps/realworld-legacy/src/features/board/board-page.tsx},{target:{component:SideNav},status:resolved,instances:1,source:<repo>/apps/realworld-legacy/src/layout/app-shell.tsx}]
startedAt: 2026-11-19T04:03:34.090Z
expiresAt: 2026-11-19T04:08:34.119Z
request: {budget:{fiberLimit:20000,operationLimit:2000000,timeLimitMs:500,targetOperationReserve:4000,targetTimeReserveMs:4,adaptive:false},settle:{quietMs:500,timeoutMs:10000},maxDurationMs:300000,allowOverrides:false}
[exit 0]

$ agent-browser --session art-l2 click 'button[aria-label="Toggle sidebar"]'
✓ Done
[exit 0]

$ npx genie-react verify end vfy_b0ac991e-7141-4ac2-8d75-219efa0908f6 --session art-l2
pass vfy_b0ac991e-7141-4ac2-8d75-219efa0908f6 "toggle the sidebar"  4 commits, quiet after 824 ms (react)
  url "http://127.0.0.1:5212/board"
  1 pass render BoardColumn max 0  {renders:0,mounts:0,updates:0,remounts:0,semantics:exact,instances:5,activeInstances:5}
      claim: {kind:renders,target:{component:BoardColumn},max:0,counting:renders,allowRemount:false}
      deciding: [{kind:coverage,complete:true,targetedComplete:true,semantics:exact},{kind:instance,mountId:mount:1,renderingState:mounted-rendering,source:<repo>/apps/realworld-legacy/src/features/board/board-page.tsx:28:11},{kind:instance,mountId:mount:2,renderingState:mounted-rendering,source:<repo>/apps/realworld-legacy/src/features/board/board-page.tsx:28:11}]
  2 pass render SideNav min 1  {renders:1,mounts:0,updates:1,remounts:0,semantics:exact,instances:1,activeInstances:1}
      claim: {kind:renders,target:{component:SideNav},min:1,counting:renders,allowRemount:false}
      deciding: [{kind:instance,mountId:mount:6,renders:1,mounts:0,updates:1,mountGeneration:1,latestDocumentCommitId:26,source:<repo>/apps/realworld-legacy/src/layout/app-shell.tsx:26:9}]
window: {observationId:observation:1,startDocumentCommitId:25,settledDocumentCommitId:28,frozenDocumentCommitId:29,commits:4,settle:{outcome:met,quietMs:500,timeoutMs:10000,waitedMs:824,domains:{react:met}},tail:{ms:500,commits:1},environment:{bundle:development,strictMode:unknown,renderCollection:available,visibility:unavailable}}
! ui-outcome-not-observed: Genie does not check the screen; confirm it with the UI driver
! visibility-unobserved: the app reports no visibility signal, so a hidden interval was not observed
attempt 2 for these claims on this tab; previous fail vfy_46588cf6-5a59-4742-b4d6-9307c024f382; document reloaded since
evidence: $ pnpm exec genie-react verify show vfy_b0ac991e-7141-4ac2-8d75-219efa0908f6 --session art-l2
session: {sessionId:35bc577a-4356-4bcb-9564-172dacef1f3c,logicalSessionId:78de5a45-c576-47c7-b2e0-a17f611dd5ff,documentGeneration:28}
schemaVersion: "1.0"
exitCode: 0
stage: end
ledger: {fingerprint:cf_9ebc467d42b2,scope:logical-session,storage:memory,attempt:2,history:[{verificationId:vfy_46588cf6-5a59-4742-b4d6-9307c024f382,verdict:fail,reasons:[],endedAt:2026-11-19T04:02:58.911Z}],codeChangedSincePrevious:document-reloaded,failsOnSameCode:0}
evidence: {retained:true,tools:[react_get_renders,react_component_cohort,react_list_overrides,react_refresh_events,react_profile_stop]}
startedAt: 2026-11-19T04:03:34.090Z
endedAt: 2026-11-19T04:03:35.844Z
request: {budget:{fiberLimit:20000,operationLimit:2000000,timeLimitMs:500,targetOperationReserve:4000,targetTimeReserveMs:4,adaptive:false},settle:{quietMs:500,timeoutMs:10000},maxDurationMs:300000,allowOverrides:false}
[exit 0]

# --- reverted
# --- issue-table-selector-recompute reference fix applied:
diff --git a/apps/realworld-legacy/src/store/issue-selectors.ts b/apps/realworld-legacy/src/store/issue-selectors.ts
index 82fb68b..1c2d53e 100644
--- a/apps/realworld-legacy/src/store/issue-selectors.ts
+++ b/apps/realworld-legacy/src/store/issue-selectors.ts
@@ -10,10 +10,8 @@ export const { selectAll: selectAllIssues } = issuesAdapter.getSelectors(
   (state: RootState) => state.issues,
 )
 
-const selectIssueQuery = (state: RootState) => ({
-  filters: state.issues.filters,
-  sort: state.issues.sort,
-})
+const selectIssueFilters = (state: RootState) => state.issues.filters
+const selectIssueSort = (state: RootState) => state.issues.sort
 
 function matchesFilters(issue: Issue, filters: IssueFilters): boolean {
   if (filters.status !== 'all' && issue.status !== filters.status) return false
@@ -45,8 +43,8 @@ function compareIssues(a: Issue, b: Issue, { field }: IssueSort): number {
 }
 
 export const selectVisibleIssues = createSelector(
-  [selectAllIssues, selectIssueQuery],
-  (issues, { filters, sort }) => {
+  [selectAllIssues, selectIssueFilters, selectIssueSort],
+  (issues, filters, sort) => {
     const direction = sort.direction === 'asc' ? 1 : -1
     return issues
       .filter((issue) => matchesFilters(issue, filters))
# === issue-table-selector-recompute, after fix
$ agent-browser --session art-l2 open 'http://127.0.0.1:5212/issues'
✓ Acme Tracker
  http://127.0.0.1:5212/issues
[exit 0]

$ npx genie-react status --session art-l2 --wait 15000 --select /app
status: ok
selection: {expression:/app,matchedPathCount:1,matchedPaths:[/app],omittedPathCount:48}
result: {name:"Acme Tracker",url:http://127.0.0.1:5212/issues,reactVersion:18.3.1,reactMounted:true}
[exit 0]

$ npx genie-react verify begin --session art-l2 --name 'type a saved-view name' --claim 'render IssueTable max 0' --claim 'render SavedViews min 1' --budget '{"adaptive":false,"fiberLimit":20000,"operationLimit":2000000,"timeLimitMs":500}'
recording vfy_7e92b654-c2d0-4f66-923c-d3c2143b77e4 "type a saved-view name"
  url "http://127.0.0.1:5212/issues"
  1 null render IssueTable max 0  {}
  2 null render SavedViews min 1  {}
window: {observationId:observation:1,startDocumentCommitId:25,domains:[react],quietMs:500,timeoutMs:10000,tailMs:500}
next: $ pnpm exec genie-react verify end vfy_7e92b654-c2d0-4f66-923c-d3c2143b77e4 --session art-l2
session: {sessionId:2a3768ac-3907-4ae8-b34c-91bd63885ebf,logicalSessionId:78de5a45-c576-47c7-b2e0-a17f611dd5ff,documentGeneration:30}
schemaVersion: "1.0"
targets: [{target:{component:IssueTable},status:resolved,instances:1,source:<repo>/apps/realworld-legacy/src/features/issues/issue-table.tsx},{target:{component:SavedViews},status:resolved,instances:1,source:<repo>/apps/realworld-legacy/src/features/issues/issues-page.tsx}]
startedAt: 2026-11-19T04:03:51.502Z
expiresAt: 2026-11-19T04:08:51.528Z
request: {budget:{fiberLimit:20000,operationLimit:2000000,timeLimitMs:500,targetOperationReserve:4000,targetTimeReserveMs:4,adaptive:false},settle:{quietMs:500,timeoutMs:10000},maxDurationMs:300000,allowOverrides:false}
[exit 0]

$ agent-browser --session art-l2 type 'input[aria-label="View name"]' 'Sprint triage'
✓ Done
[exit 0]

$ npx genie-react verify end vfy_7e92b654-c2d0-4f66-923c-d3c2143b77e4 --session art-l2
pass vfy_7e92b654-c2d0-4f66-923c-d3c2143b77e4 "type a saved-view name"  15 commits, quiet after 802 ms (react)
  url "http://127.0.0.1:5212/issues"
  1 pass render IssueTable max 0  {renders:0,mounts:0,updates:0,remounts:0,semantics:exact,instances:1,activeInstances:1}
      claim: {kind:renders,target:{component:IssueTable},max:0,counting:renders,allowRemount:false}
      deciding: [{kind:coverage,complete:true,targetedComplete:true,semantics:exact},{kind:instance,mountId:mount:1,renderingState:mounted-rendering,source:<repo>/apps/realworld-legacy/src/features/issues/issue-table.tsx:43:7}]
  2 pass render SavedViews min 1  {renders:13,mounts:0,updates:13,remounts:0,semantics:exact,instances:1,activeInstances:1}
      claim: {kind:renders,target:{component:SavedViews},min:1,counting:renders,allowRemount:false}
      deciding: [{kind:instance,mountId:mount:2,renders:13,mounts:0,updates:13,mountGeneration:1,latestDocumentCommitId:38,source:<repo>/apps/realworld-legacy/src/features/issues/issues-page.tsx:22:7}]
window: {observationId:observation:1,startDocumentCommitId:25,settledDocumentCommitId:39,frozenDocumentCommitId:40,commits:15,settle:{outcome:met,quietMs:500,timeoutMs:10000,waitedMs:802,domains:{react:met}},tail:{ms:500,commits:1},environment:{bundle:development,strictMode:on,renderCollection:available,visibility:unavailable}}
! ui-outcome-not-observed: Genie does not check the screen; confirm it with the UI driver
! visibility-unobserved: the app reports no visibility signal, so a hidden interval was not observed
attempt 2 for these claims on this tab; previous fail vfy_1b84f623-eca2-485b-9200-92dbcd3b0b2c; document reloaded since
evidence: $ pnpm exec genie-react verify show vfy_7e92b654-c2d0-4f66-923c-d3c2143b77e4 --session art-l2
session: {sessionId:2a3768ac-3907-4ae8-b34c-91bd63885ebf,logicalSessionId:78de5a45-c576-47c7-b2e0-a17f611dd5ff,documentGeneration:30}
schemaVersion: "1.0"
exitCode: 0
stage: end
ledger: {fingerprint:cf_489115172995,scope:logical-session,storage:memory,attempt:2,history:[{verificationId:vfy_1b84f623-eca2-485b-9200-92dbcd3b0b2c,verdict:fail,reasons:[],endedAt:2026-11-19T04:03:10.364Z}],codeChangedSincePrevious:document-reloaded,failsOnSameCode:0}
evidence: {retained:true,tools:[react_get_renders,react_component_cohort,react_list_overrides,react_refresh_events,react_profile_stop]}
startedAt: 2026-11-19T04:03:51.502Z
endedAt: 2026-11-19T04:03:53.618Z
request: {budget:{fiberLimit:20000,operationLimit:2000000,timeLimitMs:500,targetOperationReserve:4000,targetTimeReserveMs:4,adaptive:false},settle:{quietMs:500,timeoutMs:10000},maxDurationMs:300000,allowOverrides:false}
[exit 0]

# --- reverted
# === causes on shipped code
$ agent-browser --session art-l2 open 'http://127.0.0.1:5212/board'
✓ Acme Tracker
  http://127.0.0.1:5212/board
[exit 0]

$ npx genie-react call react_clear_renders '{"component":"BoardColumn"}' --session art-l2 --select /ok
status: ok
selection: {expression:/ok,matchedPathCount:1,matchedPaths:[/ok],omittedPathCount:15}
result: true
[exit 0]

$ agent-browser --session art-l2 click 'button[aria-label="Toggle sidebar"]'
✓ Done
[exit 0]

$ npx genie-react call react_quiesce '{"idleMs":500,"timeoutMs":10000}' --fail-on-result-error --session art-l2 --select /outcome
status: ok
selection: {expression:/outcome,matchedPathCount:1,matchedPaths:[/outcome],omittedPathCount:13}
result: idle
[exit 0]

$ npx genie-react call react_render_causes '{"component":"BoardColumn","limit":1,"view":"full"}' --session art-l2 --json | jq -c '.events[] | {componentName, necessity, cause: (.causes[0] | {kind, evidence, equality, changedFields, deepDiff, redux: {evidence: .redux.evidence, actions: [.redux.actions[]? | .type]}})}'
{"componentName":"BoardColumn","necessity":"unknown","cause":{"kind":"unknown","evidence":"unknown","equality":null,"changedFields":null,"deepDiff":null,"redux":{"evidence":null,"actions":[]}}}
[exit 0]

$ agent-browser --session art-l2 open 'http://127.0.0.1:5212/issues'
✓ Acme Tracker
  http://127.0.0.1:5212/issues
[exit 0]

$ npx genie-react call react_clear_renders '{"component":"IssueTable"}' --session art-l2 --select /ok
status: ok
selection: {expression:/ok,matchedPathCount:1,matchedPaths:[/ok],omittedPathCount:15}
result: true
[exit 0]

$ agent-browser --session art-l2 type 'input[aria-label="View name"]' S
✓ Done
[exit 0]

$ npx genie-react call react_quiesce '{"idleMs":500,"timeoutMs":10000}' --fail-on-result-error --session art-l2 --select /outcome
status: ok
selection: {expression:/outcome,matchedPathCount:1,matchedPaths:[/outcome],omittedPathCount:13}
result: idle
[exit 0]

$ npx genie-react call react_render_causes '{"component":"IssueTable","limit":1,"view":"full","appOnly":false}' --session art-l2 --json | jq -c '.events[] | {componentName, necessity, causes: [.causes[] | {kind, evidence, name, deepDiff}]}'
{"componentName":"IssueTable","necessity":"unnecessary","causes":[{"kind":"parent","evidence":"inferred","name":null,"deepDiff":null},{"kind":"props","evidence":"exact","name":"rows","deepDiff":{"changes":[{"kind":"reference-only","path":""}],"visited":101,"truncated":false}}]}
[exit 0]

$ agent-browser --session art-l2 open 'http://127.0.0.1:5212/board'
✓ Acme Tracker
  http://127.0.0.1:5212/board
[exit 0]

$ npx genie-react call react_clear_renders '{}' --session art-l2 --select /ok
status: ok
selection: {expression:/ok,matchedPathCount:1,matchedPaths:[/ok],omittedPathCount:15}
result: true
[exit 0]

$ agent-browser --session art-l2 click 'button[aria-label="Toggle sidebar"]'
✓ Done
[exit 0]

$ npx genie-react call react_quiesce '{"idleMs":500,"timeoutMs":10000}' --fail-on-result-error --session art-l2 --select /outcome
status: ok
selection: {expression:/outcome,matchedPathCount:1,matchedPaths:[/outcome],omittedPathCount:13}
result: idle
[exit 0]

$ npx genie-react call react_render_causes '{"component":"BoardColumn","view":"full"}' --session art-l2 --json | jq -c '.events[] | {componentName, necessity, causes: [.causes[] | {kind, evidence, name, equality, changedFields, deepDiff, redux: (.redux | if . then {evidence, reason, actions: [.actions[]? | .type]} else null end)}]}'
jq: error (at <stdin>:1): Cannot iterate over null (null)
[exit 5]

# (the --json read above was truncated at max_bytes; reading the same window in compact text)
$ npx genie-react call react_render_causes '{"component":"BoardColumn"}' --session art-l2
componentMatch:
  component: BoardColumn
  exact: true
  status: matched
  matchedNames: [BoardColumn]
  matchedNameCount: 1
  similarNames: []
tracking: true
commits: 15
documentCommitId: 40
observation: {id:observation:1,epoch:1,startedAfterDocumentCommitId:25}
attribution:
  status: current
  startedAtDocumentCommitId: 40
  completedAtDocumentCommitId: 40
  startedAtAnalysisGeneration: 41
  completedAtAnalysisGeneration: 41
view: summary
events[5] (componentName #componentId {fields}, then ← kind evidence name {fields} per cause):
  each: {documentCommitId:27,necessity:unknown,necessityReason:effects-scheduled,inputEvidence:incomplete,inputCoverage:{complete:false,scanTruncated:true},source:{location:<repo>/apps/realworld-legacy/src/features/board/board-page.tsx:28:11,role:element-callsite,ownership:app}}
  BoardColumn #7642776868494 {renderEventId:render:27:1312,mountId:mount:1298,key:done}
    ← external-store inferred anonymous-external-store {redux:{evidence:inferred,actions:[notifications/fetch/fulfilled,notifications/fetch/fulfilled,ui/sidebarToggled]}}
  BoardColumn #7642776867912 {renderEventId:render:27:1309,mountId:mount:1297,key:in_review}
    ← external-store inferred anonymous-external-store {redux:{evidence:inferred,actions:[notifications/fetch/fulfilled,notifications/fetch/fulfilled,ui/sidebarToggled]}}
  BoardColumn #7642776866727 {renderEventId:render:27:1306,mountId:mount:1296,key:in_progress}
    ← external-store inferred anonymous-external-store {redux:{evidence:inferred,actions:[notifications/fetch/fulfilled,notifications/fetch/fulfilled,ui/sidebarToggled]}}
  BoardColumn #7642776864952 {renderEventId:render:27:1303,mountId:mount:1295,key:todo}
    ← external-store inferred anonymous-external-store {redux:{evidence:inferred,actions:[notifications/fetch/fulfilled,notifications/fetch/fulfilled,ui/sidebarToggled]}}
  BoardColumn #7642776863232 {renderEventId:render:27:1300,mountId:mount:1294,key:backlog}
    ← external-store inferred anonymous-external-store {redux:{evidence:inferred,actions:[notifications/fetch/fulfilled,notifications/fetch/fulfilled,ui/sidebarToggled]}}
omittedByLimit: 0
sourceClassification:
  complete: true
  affects: result
  totalCandidates: 5
  evaluated: 5
  app: 5
  library: 0
  unknown: 0
  unknownComponents: []
  unknownComponentsOmitted: 0
renderEventRetention: {evictedEvents:304,earliestDocumentCommitId:26,latestDocumentCommitId:40}
coverage:
  skippedCommitFibers: 0
  droppedUnmountFibers: 0
  analysisFailedFibers: 0
  pausedCommits: 0
  unobservedCommits: 0
  refreshCommitsExcluded: 0
  truncatedInputFibers: 1265
  propsNotEnumeratedFibers: 0
  budgetExhaustedCommits: 0
  budgetExhaustedSubsystems: []
  incompleteBecause[1]:
    - {reason:inputs-truncated,fibers:1265,components:[PriorityPicker,FeatureGate,BoardColumn],detail:"An input held values Genie compares only in part, such as functions, class instances or objects past the inspected depth; read deepDiff.truncated on these components."}
  complete: false
  inputAttributionComplete: false
  semantics: lower-bound
  coverageDomain: render-causality
  droppedRenderEvents: 304
[exit 0]

```

## Re-run on Genie 1.1.0

- Date: 2026-11-19 (UTC times in the log)
- Commit: `ce408cb205c0e798cb04c35512772b7454283141` (`git rev-parse HEAD`, origin/main with the 1.1.0 release)
- App: `apps/realworld-legacy` (Acme Tracker), dev server at http://127.0.0.1:5234, standalone Genie hub on port 15234, pages http://127.0.0.1:5234/issues and http://127.0.0.1:5234/board
- Genie: `genie-react` CLI and hub 1.1.0 from this checkout, agent-browser 0.39.1
- Session: `upd-d`
- Notification poll: the app default of 15000 ms for every run. No run slowed it.

```
$ pnpm install && pnpm build                 # repo root, exit 0
$ cd apps/realworld-legacy
$ node_modules/.bin/genie-react --version    # 1.1.0
$ GENIE_HUB_PORT=15234 pnpm hub
$ PORT=5234 GENIE_HUB_PORT=15234 pnpm exec webpack serve --mode development --port 5234
```

Hub output:

```

> @genie-react/realworld-legacy@ hub ~/.t3/worktrees/genie-react/t3-9e64af67-f21cc60f9d8a6648/apps/realworld-legacy
> genie-react hub --port ${GENIE_HUB_PORT:-4712}

ok hub_ready: The local hub is available.
next: $ pnpm exec genie-react status
event: ready
userActionRequired: false
data:
  cwd: ~/.t3/worktrees/genie-react/t3-9e64af67-f21cc60f9d8a6648/apps/realworld-legacy
  port: 15234
  url: ws://127.0.0.1:15234/__genie/ws
  clientUrl: http://127.0.0.1:15234/__genie/client.js
```

Every command below ran from `apps/realworld-legacy` through a logging wrapper that exports `GENIE_HUB_PORT=15234`, prints `$ ` and the exact command, its full output, and `[exit N]`, and replaces the home directory with `~`. Lines starting with `#` are notes written during the run. The wrapper printed nothing else, and nothing in the log is edited.

Reference fixes were applied from each answer key's `referenceFix` with an exact find and replace (each `find` must match once) and reverted with `git checkout -- apps/realworld-legacy`. The log has the full diff of the `AccountMenu` fix. For the board and issue-table fixes it has `git diff --stat`, and their full diffs are in Part 4 above.

### Log

```
$ date -u +%Y-%m-%dT%H:%M:%SZ; git rev-parse HEAD
2026-11-19T08:55:40Z
ce408cb205c0e798cb04c35512772b7454283141
[exit 0]

$ npx genie-react --version
1.1.0
[exit 0]

$ agent-browser --session upd-d open 'http://127.0.0.1:5234/login'
[agent-browser] launched browser
✓ Acme Tracker
  http://127.0.0.1:5234/login
[exit 0]

$ npx genie-react status --session upd-d --wait 15000
selectedBridgeUrl: ws://127.0.0.1:15234/__genie/ws
sessionSelector:
  requested: upd-d
  source: flag
  resolvedSessionId: 89be3b32-85e2-4af4-808c-46a10a77c0f2
  implicit: false
  agentBrowser: {session:upd-d,via:selector,logicalSessionId:a07593a5-db3c-4fae-a8d8-4c337dd757ea}
connected: true
ready: true
sessionId: 89be3b32-85e2-4af4-808c-46a10a77c0f2
app: {name:"Acme Tracker",url:http://127.0.0.1:5234/login,reactVersion:18.3.1,reactMounted:true}
domains: [session,react,memory,perf,timeline,redux,app]
toolCount: 61
sessions[1] (sessionId {fields}):
  89be3b32-85e2-4af4-808c-46a10a77c0f2 {logicalSessionId:a07593a5-db3c-4fae-a8d8-4c337dd757ea,documentGeneration:1,logicalSessionCollision:false,collisionWithSessionIds:[],app:{name:"Acme Tracker",url:http://127.0.0.1:5234/login,reactVersion:18.3.1,reactMounted:true},domains:[session,react,memory,perf,timeline,redux,app],toolCount:61,connectedAt:1795078541970,ready:true,readyAt:1795078541971,current:true,origin:http://127.0.0.1:5234,originUnverified:true,runtimeVersion:1.1.0}
warnings: []
hub: {version:1.1.0,protocol:1}
[exit 0]

$ npx genie-react call app_backend_reset '{}' --session upd-d
seed: 2019
issues: 3240
notificationPollMs: 15000
[exit 0]

$ npx genie-react call app_sign_in '{}' --session upd-d
user: {id:u-1,name:"Dana Whitfield",email:dana@acme.test,title:Designer,team:Infra}
[exit 0]

$ agent-browser --session upd-d open 'http://127.0.0.1:5234/issues'
✓ Acme Tracker
  http://127.0.0.1:5234/issues
[exit 0]

$ agent-browser --session upd-d wait '.issue-row'
✓ Done
[exit 0]

$ npx genie-react call react_clear_renders '{"component":"AccountMenu"}' --session upd-d --select /ok
status: ok
selection: {expression:/ok,matchedPathCount:1,matchedPaths:[/ok],omittedPathCount:15}
result: true
[exit 0]

$ agent-browser --session upd-d type 'input[aria-label="Filter issues"]' cache
✓ Done
[exit 0]

$ npx genie-react call react_quiesce '{"idleMs":500,"timeoutMs":10000}' --fail-on-result-error --session upd-d --select /outcome
status: ok
selection: {expression:/outcome,matchedPathCount:1,matchedPaths:[/outcome],omittedPathCount:16}
result: idle
[exit 0]

$ npx genie-react call react_get_renders '{"component":"AccountMenu","appOnly":false}' --session upd-d --fields name,renders,updates,causeCounts,necessity,necessityReason
[1]:
  - {name:AccountMenu,renders:9,updates:9,causeCounts:{external-store:9},necessity:unnecessary,necessityReason:inputs-unchanged}
[exit 0]

# === chain on the issue filter, default notification poll (15 s), fresh page
$ agent-browser --session upd-d open 'http://127.0.0.1:5234/issues'
✓ Acme Tracker
  http://127.0.0.1:5234/issues
[exit 0]

$ agent-browser --session upd-d wait '.issue-row'
✓ Done
[exit 0]

$ npx genie-react call react_clear_renders '{}' --session upd-d --select /ok
status: ok
selection: {expression:/ok,matchedPathCount:1,matchedPaths:[/ok],omittedPathCount:15}
result: true
[exit 0]

$ agent-browser --session upd-d type 'input[aria-label="Filter issues"]' cache
✓ Done
[exit 0]

$ npx genie-react call react_quiesce '{"idleMs":500,"timeoutMs":10000}' --fail-on-result-error --session upd-d --select /outcome
status: ok
selection: {expression:/outcome,matchedPathCount:1,matchedPaths:[/outcome],omittedPathCount:16}
result: idle
[exit 0]

$ npx genie-react batch '[{"tool":"react_render_causes","args":{"component":"AccountMenu","view":"full"}},{"tool":"redux_actions","args":{"typePrefix":"issues/","view":"full"}}]' --session upd-d --json > /tmp/upd-d/chain-filter.json; echo bytes $(wc -c < /tmp/upd-d/chain-filter.json)
bytes 37493
[exit 0]

# --- the unscoped window above evicted 3674 render events (100-row table), so only the last AccountMenu render survived. Scope the window to AccountMenu.
$ agent-browser --session upd-d open 'http://127.0.0.1:5234/issues'
✓ Acme Tracker
  http://127.0.0.1:5234/issues
[exit 0]

$ agent-browser --session upd-d wait '.issue-row'
✓ Done
[exit 0]

$ npx genie-react call react_clear_renders '{"component":"AccountMenu"}' --session upd-d --select /ok
status: ok
selection: {expression:/ok,matchedPathCount:1,matchedPaths:[/ok],omittedPathCount:15}
result: true
[exit 0]

$ agent-browser --session upd-d type 'input[aria-label="Filter issues"]' cache
✓ Done
[exit 0]

$ npx genie-react call react_quiesce '{"idleMs":500,"timeoutMs":10000}' --fail-on-result-error --session upd-d --select /outcome
status: ok
selection: {expression:/outcome,matchedPathCount:1,matchedPaths:[/outcome],omittedPathCount:16}
result: idle
[exit 0]

$ npx genie-react batch '[{"tool":"react_render_causes","args":{"component":"AccountMenu","view":"full"}},{"tool":"redux_actions","args":{"typePrefix":"issues/","view":"full"}}]' --session upd-d --json > /tmp/upd-d/chain-filter2.json; echo bytes $(wc -c < /tmp/upd-d/chain-filter2.json)
bytes 37497
[exit 0]

# --- render-event retention still drops the earlier AccountMenu events over five keystrokes. One keystroke per window, default poll.
$ agent-browser --session upd-d open 'http://127.0.0.1:5234/issues'
✓ Acme Tracker
  http://127.0.0.1:5234/issues
[exit 0]

$ agent-browser --session upd-d wait '.issue-row'
✓ Done
[exit 0]

$ npx genie-react call react_clear_renders '{}' --session upd-d --select /ok
status: ok
selection: {expression:/ok,matchedPathCount:1,matchedPaths:[/ok],omittedPathCount:15}
result: true
[exit 0]

$ agent-browser --session upd-d type 'input[aria-label="Filter issues"]' c
✓ Done
[exit 0]

$ npx genie-react call react_quiesce '{"idleMs":500,"timeoutMs":10000}' --fail-on-result-error --session upd-d --select /outcome
status: ok
selection: {expression:/outcome,matchedPathCount:1,matchedPaths:[/outcome],omittedPathCount:16}
result: idle
[exit 0]

$ npx genie-react batch '[{"tool":"react_render_causes","args":{"component":"AccountMenu","view":"full"}},{"tool":"redux_actions","args":{"typePrefix":"issues/","view":"full"}}]' --session upd-d --json > /tmp/upd-d/chain-filter3.json; echo bytes $(wc -c < /tmp/upd-d/chain-filter3.json)
bytes 34822
[exit 0]

$ npx genie-react call react_get_renders '{"component":"AccountMenu","appOnly":false}' --session upd-d --fields name,renders,updates,causeCounts,necessity,necessityReason
[1]:
  - {name:AccountMenu,renders:2,updates:2,causeCounts:{external-store:2},necessity:unnecessary,necessityReason:inputs-unchanged}
[exit 0]

$ npx genie-react call react_render_causes '{"component":"AccountMenu","limit":10}' --session upd-d
componentMatch:
  component: AccountMenu
  exact: true
  status: matched
  matchedNames: [AccountMenu]
  matchedNameCount: 1
  similarNames: []
tracking: true
commits: 11
documentCommitId: 28
observation: {id:observation:1,epoch:1,startedAfterDocumentCommitId:17}
attribution:
  status: current
  startedAtDocumentCommitId: 28
  completedAtDocumentCommitId: 28
  startedAtAnalysisGeneration: 29
  completedAtAnalysisGeneration: 29
view: summary
events[1] (componentName #componentId {fields}, then ← kind evidence name {fields} per cause):
  AccountMenu #9960767357118 {renderEventId:render:19:982,documentCommitId:19,mountId:mount:151,necessity:unnecessary,necessityReason:inputs-unchanged,inputEvidence:none-observed,source:{location:~/.t3/worktrees/genie-react/t3-9e64af67-f21cc60f9d8a6648/apps/realworld-legacy/src/layout/top-bar.tsx:32:9,role:element-callsite,ownership:app}}
    ← external-store inferred anonymous-external-store {changedFields:[],redux:{evidence:inferred,actions:["unrecorded change"]}}
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
renderEventRetention: {evictedEvents:47,earliestDocumentCommitId:18,latestDocumentCommitId:28}
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
  droppedRenderEvents: 47
[exit 0]

# --- View name input, default poll (15000 ms), one keystroke: does the first render in the window get an exact link?
$ agent-browser --session upd-d open 'http://127.0.0.1:5234/issues'
✓ Acme Tracker
  http://127.0.0.1:5234/issues
[exit 0]

$ agent-browser --session upd-d wait '.issue-row'
✓ Done
[exit 0]

$ npx genie-react call react_clear_renders '{}' --session upd-d --select /ok
status: ok
selection: {expression:/ok,matchedPathCount:1,matchedPaths:[/ok],omittedPathCount:15}
result: true
[exit 0]

$ agent-browser --session upd-d type 'input[aria-label="View name"]' S
✓ Done
[exit 0]

$ npx genie-react call react_quiesce '{"idleMs":500,"timeoutMs":10000}' --fail-on-result-error --session upd-d --select /outcome
status: ok
selection: {expression:/outcome,matchedPathCount:1,matchedPaths:[/outcome],omittedPathCount:16}
result: idle
[exit 0]

$ npx genie-react batch '[{"tool":"react_render_causes","args":{"component":"AccountMenu","view":"full"}},{"tool":"redux_actions","args":{"typePrefix":"savedViews/","view":"full"}}]' --session upd-d --json > /tmp/upd-d/chain-view1.json; echo bytes $(wc -c < /tmp/upd-d/chain-view1.json)
bytes 6147
[exit 0]

# === chain, before fix: type Sp in View name, default poll, read causes and actions in one batch
$ npx genie-react call app_backend_reset '{}' --session upd-d
seed: 2019
issues: 3240
notificationPollMs: 15000
[exit 0]

$ agent-browser --session upd-d open 'http://127.0.0.1:5234/issues'
✓ Acme Tracker
  http://127.0.0.1:5234/issues
[exit 0]

$ agent-browser --session upd-d wait '.issue-row'
✓ Done
[exit 0]

$ npx genie-react call react_clear_renders '{}' --session upd-d --select /ok
status: ok
selection: {expression:/ok,matchedPathCount:1,matchedPaths:[/ok],omittedPathCount:15}
result: true
[exit 0]

$ agent-browser --session upd-d type 'input[aria-label="View name"]' Sp
✓ Done
[exit 0]

$ npx genie-react call react_quiesce '{"idleMs":500,"timeoutMs":10000}' --fail-on-result-error --session upd-d --select /outcome
status: ok
selection: {expression:/outcome,matchedPathCount:1,matchedPaths:[/outcome],omittedPathCount:16}
result: idle
[exit 0]

$ npx genie-react batch '[{"tool":"react_render_causes","args":{"component":"AccountMenu","view":"full"}},{"tool":"redux_actions","args":{"typePrefix":"savedViews/","view":"full"}}]' --session upd-d --json > /tmp/upd-d/chain.json; echo bytes $(wc -c < /tmp/upd-d/chain.json)
bytes 6838
[exit 0]

# === verify, before fix (default poll)
$ agent-browser --session upd-d open 'http://127.0.0.1:5234/issues'
✓ Acme Tracker
  http://127.0.0.1:5234/issues
[exit 0]

$ agent-browser --session upd-d wait '.issue-row'
✓ Done
[exit 0]

$ npx genie-react verify begin --session upd-d --name 'type cache in the issue filter' --claim 'render AccountMenu max 0' --claim 'render IssueTableToolbar min 1' --claim 'boundaries clean' --budget '{"adaptive":false,"fiberLimit":20000,"operationLimit":2000000,"timeLimitMs":500}' | tee /tmp/upd-d/vb.txt
recording vfy_893fe945-b083-4b3a-af4d-d2dbef163247 "type cache in the issue filter"
  url "http://127.0.0.1:5234/issues"
  1 recording render AccountMenu max 0
  2 recording render IssueTableToolbar min 1
  3 recording boundaries clean
window: {observationId:observation:1,startDocumentCommitId:17,domains:[react],quietMs:500,timeoutMs:10000,tailMs:500}
next: $ npx genie-react verify end vfy_893fe945-b083-4b3a-af4d-d2dbef163247 --session upd-d
session: {sessionId:e8278f0a-28ba-44f8-a7f1-176f325c6f03,logicalSessionId:a07593a5-db3c-4fae-a8d8-4c337dd757ea,documentGeneration:8}
schemaVersion: "1.0"
targets: [{target:{component:AccountMenu},status:resolved,instances:1,source:~/.t3/worktrees/genie-react/t3-9e64af67-f21cc60f9d8a6648/apps/realworld-legacy/src/layout/top-bar.tsx},{target:{component:IssueTableToolbar},status:resolved,instances:1,source:~/.t3/worktrees/genie-react/t3-9e64af67-f21cc60f9d8a6648/apps/realworld-legacy/src/features/issues/issues-page.tsx}]
startedAt: 2026-11-19T08:58:20.886Z
expiresAt: 2026-11-19T09:03:20.905Z
request: {budget:{fiberLimit:20000,operationLimit:2000000,timeLimitMs:500,targetOperationReserve:4000,targetTimeReserveMs:4,adaptive:false},settle:{quietMs:500,timeoutMs:10000},maxDurationMs:300000,allowOverrides:false}
[exit 0]

$ agent-browser --session upd-d type 'input[aria-label="Filter issues"]' cache
✓ Done
[exit 0]

$ npx genie-react verify end vfy_893fe945-b083-4b3a-af4d-d2dbef163247 --session upd-d
fail vfy_893fe945-b083-4b3a-af4d-d2dbef163247 "type cache in the issue filter"  11 commits, quiet after 814 ms (react)
  url "http://127.0.0.1:5234/issues"
  1 fail render AccountMenu max 0  {renders:9,mounts:0,updates:9,remounts:0,semantics:exact,instances:1,activeInstances:1}
      claim: {kind:renders,target:{component:AccountMenu},max:0,counting:renders,allowRemount:false}
      deciding: [{kind:instance,mountId:mount:1,renders:9,mounts:0,updates:9,mountGeneration:1,latestDocumentCommitId:26,source:~/.t3/worktrees/genie-react/t3-9e64af67-f21cc60f9d8a6648/apps/realworld-legacy/src/layout/top-bar.tsx:32:9}]
  2 pass render IssueTableToolbar min 1  {renders:5,mounts:0,updates:5,remounts:0,semantics:exact,instances:1,activeInstances:1}
      claim: {kind:renders,target:{component:IssueTableToolbar},min:1,counting:renders,allowRemount:false}
      deciding: [{kind:instance,mountId:mount:2,renders:5,mounts:0,updates:5,mountGeneration:1,latestDocumentCommitId:25,source:~/.t3/worktrees/genie-react/t3-9e64af67-f21cc60f9d8a6648/apps/realworld-legacy/src/features/issues/issues-page.tsx:21:7}]
  3 pass boundaries clean  {caughtDuringWindow:0,caughtAtEnd:0}
      claim: {kind:boundaries-clean,scope:window}
      deciding: [{kind:boundary-log,scope:window,complete:true,afterDocumentCommitId:17}]
      caveats: [uncaught-errors-outside-boundaries-unobserved]
window: {observationId:observation:1,startDocumentCommitId:17,settledDocumentCommitId:27,frozenDocumentCommitId:28,commits:11,settle:{outcome:met,quietMs:500,timeoutMs:10000,waitedMs:814,domains:{react:met}},tail:{ms:500,commits:1},environment:{bundle:development,strictMode:on,renderCollection:available,visibility:unavailable}}
! ui-outcome-not-observed: Genie does not check the screen; confirm it with the UI driver
! visibility-unobserved: the app reports no visibility signal, so a hidden interval was not observed
attempt 1 for these claims on this tab
evidence: $ npx genie-react verify show vfy_893fe945-b083-4b3a-af4d-d2dbef163247 --claim 1 --session upd-d
session: {sessionId:e8278f0a-28ba-44f8-a7f1-176f325c6f03,logicalSessionId:a07593a5-db3c-4fae-a8d8-4c337dd757ea,documentGeneration:8}
schemaVersion: "1.0"
exitCode: 1
stage: end
ledger: {fingerprint:cf_11bdf759a37d,scope:logical-session,storage:memory,attempt:1,history:[],codeChangedSincePrevious:null,failsOnSameCode:0}
evidence: {retained:true,tools:[react_get_renders,react_component_cohort,react_list_overrides,react_refresh_events,react_profile_stop,react_error_state]}
startedAt: 2026-11-19T08:58:20.886Z
endedAt: 2026-11-19T08:58:22.789Z
request: {budget:{fiberLimit:20000,operationLimit:2000000,timeLimitMs:500,targetOperationReserve:4000,targetTimeReserveMs:4,adaptive:false},settle:{quietMs:500,timeoutMs:10000},maxDurationMs:300000,allowOverrides:false}
[exit 1]

# --- reference fix applied from evals/realworld/legacy/account-menu-selector.json
diff --git a/apps/realworld-legacy/src/layout/account-menu.tsx b/apps/realworld-legacy/src/layout/account-menu.tsx
index ab4d153..88282ad 100644
--- a/apps/realworld-legacy/src/layout/account-menu.tsx
+++ b/apps/realworld-legacy/src/layout/account-menu.tsx
@@ -6,10 +6,8 @@ import { signOut } from '../store/session'
 
 export function AccountMenu() {
   const dispatch = useAppDispatch()
-  const { user, savedViewCount } = useAppSelector((state) => ({
-    user: state.session.user,
-    savedViewCount: state.savedViews.views.length,
-  }))
+  const user = useAppSelector((state) => state.session.user)
+  const savedViewCount = useAppSelector((state) => state.savedViews.views.length)
   if (!user) return null
   return (
     <Dropdown>
# === verify, after fix
$ agent-browser --session upd-d open 'http://127.0.0.1:5234/issues'
✓ Acme Tracker
  http://127.0.0.1:5234/issues
[exit 0]

$ agent-browser --session upd-d wait '.issue-row'
✓ Done
[exit 0]

$ npx genie-react verify begin --session upd-d --name 'type cache in the issue filter' --claim 'render AccountMenu max 0' --claim 'render IssueTableToolbar min 1' --claim 'boundaries clean' --budget '{"adaptive":false,"fiberLimit":20000,"operationLimit":2000000,"timeLimitMs":500}' | tee /tmp/upd-d/vb.txt
recording vfy_c9a9cc76-b1fd-489e-ba81-baf26b7ee0a1 "type cache in the issue filter"
  url "http://127.0.0.1:5234/issues"
  1 recording render AccountMenu max 0
  2 recording render IssueTableToolbar min 1
  3 recording boundaries clean
window: {observationId:observation:1,startDocumentCommitId:17,domains:[react],quietMs:500,timeoutMs:10000,tailMs:500}
next: $ npx genie-react verify end vfy_c9a9cc76-b1fd-489e-ba81-baf26b7ee0a1 --session upd-d
session: {sessionId:1710d010-7dd2-4a12-ab44-7ee8db699267,logicalSessionId:a07593a5-db3c-4fae-a8d8-4c337dd757ea,documentGeneration:10}
schemaVersion: "1.0"
targets: [{target:{component:AccountMenu},status:resolved,instances:1,source:~/.t3/worktrees/genie-react/t3-9e64af67-f21cc60f9d8a6648/apps/realworld-legacy/src/layout/top-bar.tsx},{target:{component:IssueTableToolbar},status:resolved,instances:1,source:~/.t3/worktrees/genie-react/t3-9e64af67-f21cc60f9d8a6648/apps/realworld-legacy/src/features/issues/issues-page.tsx}]
startedAt: 2026-11-19T08:58:53.316Z
expiresAt: 2026-11-19T09:03:53.334Z
request: {budget:{fiberLimit:20000,operationLimit:2000000,timeLimitMs:500,targetOperationReserve:4000,targetTimeReserveMs:4,adaptive:false},settle:{quietMs:500,timeoutMs:10000},maxDurationMs:300000,allowOverrides:false}
[exit 0]

$ agent-browser --session upd-d type 'input[aria-label="Filter issues"]' cache
✓ Done
[exit 0]

$ npx genie-react verify end vfy_c9a9cc76-b1fd-489e-ba81-baf26b7ee0a1 --session upd-d
pass vfy_c9a9cc76-b1fd-489e-ba81-baf26b7ee0a1 "type cache in the issue filter"  11 commits, quiet after 817 ms (react)
  url "http://127.0.0.1:5234/issues"
  1 pass render AccountMenu max 0  {renders:0,mounts:0,updates:0,remounts:0,semantics:exact,instances:1,activeInstances:1}
      claim: {kind:renders,target:{component:AccountMenu},max:0,counting:renders,allowRemount:false}
      deciding: [{kind:coverage,complete:true,targetedComplete:true,semantics:exact},{kind:instance,mountId:mount:1,renderingState:mounted-rendering,source:~/.t3/worktrees/genie-react/t3-9e64af67-f21cc60f9d8a6648/apps/realworld-legacy/src/layout/top-bar.tsx:32:9}]
  2 pass render IssueTableToolbar min 1  {renders:5,mounts:0,updates:5,remounts:0,semantics:exact,instances:1,activeInstances:1}
      claim: {kind:renders,target:{component:IssueTableToolbar},min:1,counting:renders,allowRemount:false}
      deciding: [{kind:instance,mountId:mount:2,renders:5,mounts:0,updates:5,mountGeneration:1,latestDocumentCommitId:25,source:~/.t3/worktrees/genie-react/t3-9e64af67-f21cc60f9d8a6648/apps/realworld-legacy/src/features/issues/issues-page.tsx:21:7}]
  3 pass boundaries clean  {caughtDuringWindow:0,caughtAtEnd:0}
      claim: {kind:boundaries-clean,scope:window}
      deciding: [{kind:boundary-log,scope:window,complete:true,afterDocumentCommitId:17}]
      caveats: [uncaught-errors-outside-boundaries-unobserved]
window: {observationId:observation:1,startDocumentCommitId:17,settledDocumentCommitId:27,frozenDocumentCommitId:28,commits:11,settle:{outcome:met,quietMs:500,timeoutMs:10000,waitedMs:817,domains:{react:met}},tail:{ms:500,commits:1},environment:{bundle:development,strictMode:on,renderCollection:available,visibility:unavailable}}
! ui-outcome-not-observed: Genie does not check the screen; confirm it with the UI driver
! visibility-unobserved: the app reports no visibility signal, so a hidden interval was not observed
attempt 2 for these claims on this tab; previous fail vfy_893fe945-b083-4b3a-af4d-d2dbef163247; document reloaded since
evidence: $ npx genie-react verify show vfy_c9a9cc76-b1fd-489e-ba81-baf26b7ee0a1 --session upd-d
session: {sessionId:1710d010-7dd2-4a12-ab44-7ee8db699267,logicalSessionId:a07593a5-db3c-4fae-a8d8-4c337dd757ea,documentGeneration:10}
schemaVersion: "1.0"
exitCode: 0
stage: end
ledger: {fingerprint:cf_11bdf759a37d,scope:logical-session,storage:memory,attempt:2,history:[{verificationId:vfy_893fe945-b083-4b3a-af4d-d2dbef163247,verdict:fail,reasons:[],endedAt:2026-11-19T08:58:22.789Z}],codeChangedSincePrevious:document-reloaded,failsOnSameCode:0}
evidence: {retained:true,tools:[react_get_renders,react_component_cohort,react_list_overrides,react_refresh_events,react_profile_stop,react_error_state]}
startedAt: 2026-11-19T08:58:53.316Z
endedAt: 2026-11-19T08:58:55.225Z
request: {budget:{fiberLimit:20000,operationLimit:2000000,timeLimitMs:500,targetOperationReserve:4000,targetTimeReserveMs:4,adaptive:false},settle:{quietMs:500,timeoutMs:10000},maxDurationMs:300000,allowOverrides:false}
[exit 0]

# === symptom, after fix
$ agent-browser --session upd-d open 'http://127.0.0.1:5234/issues'
✓ Acme Tracker
  http://127.0.0.1:5234/issues
[exit 0]

$ agent-browser --session upd-d wait '.issue-row'
✓ Done
[exit 0]

$ npx genie-react call react_clear_renders '{"component":"AccountMenu"}' --session upd-d --select /ok
status: ok
selection: {expression:/ok,matchedPathCount:1,matchedPaths:[/ok],omittedPathCount:15}
result: true
[exit 0]

$ agent-browser --session upd-d type 'input[aria-label="Filter issues"]' cache
✓ Done
[exit 0]

$ npx genie-react call react_quiesce '{"idleMs":500,"timeoutMs":10000}' --fail-on-result-error --session upd-d --select /outcome
status: ok
selection: {expression:/outcome,matchedPathCount:1,matchedPaths:[/outcome],omittedPathCount:16}
result: idle
[exit 0]

$ npx genie-react call react_get_renders '{"component":"AccountMenu","appOnly":false}' --session upd-d --fields name,renders,updates,causeCounts,necessity,necessityReason
! fields_unverified: The projected collection is empty, so no rows were emitted and --fields could not be checked against row keys. {collection:/components}
[exit 0]

# --- fix reverted with git checkout -- apps/realworld-legacy
# === causes on shipped code: board columns after a sidebar toggle
$ agent-browser --session upd-d open 'http://127.0.0.1:5234/board'
✓ Acme Tracker
  http://127.0.0.1:5234/board
[exit 0]

$ agent-browser --session upd-d wait '.board-column'
✓ Done
[exit 0]

$ npx genie-react call react_clear_renders '{}' --session upd-d --select /ok
status: ok
selection: {expression:/ok,matchedPathCount:1,matchedPaths:[/ok],omittedPathCount:15}
result: true
[exit 0]

$ agent-browser --session upd-d click 'button[aria-label="Toggle sidebar"]'
✓ Done
[exit 0]

$ npx genie-react call react_quiesce '{"idleMs":500,"timeoutMs":10000}' --fail-on-result-error --session upd-d --select /outcome
status: ok
selection: {expression:/outcome,matchedPathCount:1,matchedPaths:[/outcome],omittedPathCount:16}
result: idle
[exit 0]

$ npx genie-react call react_render_causes '{"component":"BoardColumn"}' --session upd-d
componentMatch:
  component: BoardColumn
  exact: true
  status: matched
  matchedNames: [BoardColumn]
  matchedNameCount: 1
  similarNames: []
tracking: true
commits: 4
documentCommitId: 20
observation: {id:observation:1,epoch:1,startedAfterDocumentCommitId:16}
attribution:
  status: current
  startedAtDocumentCommitId: 20
  completedAtDocumentCommitId: 20
  startedAtAnalysisGeneration: 21
  completedAtAnalysisGeneration: 21
view: summary
events[10] (componentName #componentId {fields}, then ← kind evidence name {fields} per cause):
  each: {necessity:unknown,necessityReason:effects-scheduled,inputEvidence:incomplete,inputCoverage:{complete:false,scanTruncated:true},source:{location:~/.t3/worktrees/genie-react/t3-9e64af67-f21cc60f9d8a6648/apps/realworld-legacy/src/features/board/board-page.tsx:28:11,role:element-callsite,ownership:app}}
  BoardColumn #15336841680526 {renderEventId:render:19:1335,documentCommitId:19,mountId:mount:1298,key:done}
    ← external-store inferred anonymous-external-store {changedFields:[],redux:{evidence:exact,actions:[notifications/fetch/fulfilled]}}
  BoardColumn #15336841679944 {renderEventId:render:19:1332,documentCommitId:19,mountId:mount:1297,key:in_review}
    ← external-store inferred anonymous-external-store {changedFields:[],redux:{evidence:exact,actions:[notifications/fetch/fulfilled]}}
  BoardColumn #15336841678759 {renderEventId:render:19:1329,documentCommitId:19,mountId:mount:1296,key:in_progress}
    ← external-store inferred anonymous-external-store {changedFields:[],redux:{evidence:exact,actions:[notifications/fetch/fulfilled]}}
  BoardColumn #15336841676984 {renderEventId:render:19:1326,documentCommitId:19,mountId:mount:1295,key:todo}
    ← external-store inferred anonymous-external-store {changedFields:[],redux:{evidence:exact,actions:[notifications/fetch/fulfilled]}}
  BoardColumn #15336841675264 {renderEventId:render:19:1323,documentCommitId:19,mountId:mount:1294,key:backlog}
    ← external-store inferred anonymous-external-store {changedFields:[],redux:{evidence:exact,actions:[notifications/fetch/fulfilled]}}
  BoardColumn #15336841680526 {renderEventId:render:18:1312,documentCommitId:18,mountId:mount:1298,key:done}
    ← external-store inferred anonymous-external-store {changedFields:[],redux:{evidence:inferred,actions:[ui/sidebarToggled]}}
  BoardColumn #15336841679944 {renderEventId:render:18:1309,documentCommitId:18,mountId:mount:1297,key:in_review}
    ← external-store inferred anonymous-external-store {changedFields:[],redux:{evidence:inferred,actions:[ui/sidebarToggled]}}
  BoardColumn #15336841678759 {renderEventId:render:18:1306,documentCommitId:18,mountId:mount:1296,key:in_progress}
    ← external-store inferred anonymous-external-store {changedFields:[],redux:{evidence:inferred,actions:[ui/sidebarToggled]}}
  BoardColumn #15336841676984 {renderEventId:render:18:1303,documentCommitId:18,mountId:mount:1295,key:todo}
    ← external-store inferred anonymous-external-store {changedFields:[],redux:{evidence:inferred,actions:[ui/sidebarToggled]}}
  BoardColumn #15336841675264 {renderEventId:render:18:1300,documentCommitId:18,mountId:mount:1294,key:backlog}
    ← external-store inferred anonymous-external-store {changedFields:[],redux:{evidence:inferred,actions:[ui/sidebarToggled]}}
omittedByLimit: 0
sourceClassification:
  complete: true
  affects: result
  totalCandidates: 10
  evaluated: 10
  app: 10
  library: 0
  unknown: 0
  unknownComponents: []
  unknownComponentsOmitted: 0
renderEventRetention: {evictedEvents:302,earliestDocumentCommitId:17,latestDocumentCommitId:20}
coverage:
  skippedCommitFibers: 0
  droppedUnmountFibers: 0
  analysisFailedFibers: 0
  pausedCommits: 0
  unobservedCommits: 0
  refreshCommitsExcluded: 0
  truncatedInputFibers: 1270
  propsNotEnumeratedFibers: 0
  budgetExhaustedCommits: 0
  budgetExhaustedSubsystems: []
  incompleteBecause[1]:
    - {reason:inputs-truncated,fibers:1270,components:[PriorityPicker,FeatureGate,BoardColumn],detail:"An input held values Genie compares only in part, such as functions, class instances or objects past the inspected depth; read deepDiff.truncated on these components."}
  complete: false
  inputAttributionComplete: false
  semantics: lower-bound
  coverageDomain: render-causality
  droppedRenderEvents: 302
[exit 0]

# === board-column-selector-cache, before fix
$ agent-browser --session upd-d open 'http://127.0.0.1:5234/board'
✓ Acme Tracker
  http://127.0.0.1:5234/board
[exit 0]

$ agent-browser --session upd-d wait '.board-column'
✓ Done
[exit 0]

$ npx genie-react verify begin --session upd-d --name 'toggle the sidebar' --claim 'render BoardColumn max 0' --claim 'render SideNav min 1' --budget '{"adaptive":false,"fiberLimit":20000,"operationLimit":2000000,"timeLimitMs":500}' | tee /tmp/upd-d/vb.txt
recording vfy_0de914c5-4c0e-49f8-af96-0306566d9680 "toggle the sidebar"
  url "http://127.0.0.1:5234/board"
  1 recording render BoardColumn max 0
  2 recording render SideNav min 1
window: {observationId:observation:1,startDocumentCommitId:16,domains:[react],quietMs:500,timeoutMs:10000,tailMs:500}
next: $ npx genie-react verify end vfy_0de914c5-4c0e-49f8-af96-0306566d9680 --session upd-d
session: {sessionId:8e076cdb-031d-49fe-aef0-f1bd5a2cd3d5,logicalSessionId:a07593a5-db3c-4fae-a8d8-4c337dd757ea,documentGeneration:14}
schemaVersion: "1.0"
targets: [{target:{component:BoardColumn},status:resolved,instances:5,source:~/.t3/worktrees/genie-react/t3-9e64af67-f21cc60f9d8a6648/apps/realworld-legacy/src/features/board/board-page.tsx},{target:{component:SideNav},status:resolved,instances:1,source:~/.t3/worktrees/genie-react/t3-9e64af67-f21cc60f9d8a6648/apps/realworld-legacy/src/layout/app-shell.tsx}]
startedAt: 2026-11-19T08:59:35.656Z
expiresAt: 2026-11-19T09:04:35.679Z
request: {budget:{fiberLimit:20000,operationLimit:2000000,timeLimitMs:500,targetOperationReserve:4000,targetTimeReserveMs:4,adaptive:false},settle:{quietMs:500,timeoutMs:10000},maxDurationMs:300000,allowOverrides:false}
[exit 0]

$ agent-browser --session upd-d click 'button[aria-label="Toggle sidebar"]'
✓ Done
[exit 0]

$ npx genie-react verify end vfy_0de914c5-4c0e-49f8-af96-0306566d9680 --session upd-d
fail vfy_0de914c5-4c0e-49f8-af96-0306566d9680 "toggle the sidebar"  5 commits, quiet after 1150 ms (react)
  url "http://127.0.0.1:5234/board"
  1 fail render BoardColumn max 0  {renders:10,mounts:0,updates:10,remounts:0,semantics:exact,instances:5,activeInstances:5}
      claim: {kind:renders,target:{component:BoardColumn},max:0,counting:renders,allowRemount:false}
      deciding: [{kind:instance,mountId:mount:1,key:backlog,renders:2,mounts:0,updates:2,mountGeneration:1,latestDocumentCommitId:19,source:~/.t3/worktrees/genie-react/t3-9e64af67-f21cc60f9d8a6648/apps/realworld-legacy/src/features/board/board-page.tsx:28:11},{kind:instance,mountId:mount:2,key:todo,renders:2,mounts:0,updates:2,mountGeneration:1,latestDocumentCommitId:19,source:~/.t3/worktrees/genie-react/t3-9e64af67-f21cc60f9d8a6648/apps/realworld-legacy/src/features/board/board-page.tsx:28:11},{kind:instance,mountId:mount:3,key:in_progress,renders:2,mounts:0,updates:2,mountGeneration:1,latestDocumentCommitId:19,source:~/.t3/worktrees/genie-react/t3-9e64af67-f21cc60f9d8a6648/apps/realworld-legacy/src/features/board/board-page.tsx:28:11}]
  2 pass render SideNav min 1  {renders:1,mounts:0,updates:1,remounts:0,semantics:exact,instances:1,activeInstances:1}
      claim: {kind:renders,target:{component:SideNav},min:1,counting:renders,allowRemount:false}
      deciding: [{kind:instance,mountId:mount:6,renders:1,mounts:0,updates:1,mountGeneration:1,latestDocumentCommitId:18,source:~/.t3/worktrees/genie-react/t3-9e64af67-f21cc60f9d8a6648/apps/realworld-legacy/src/layout/app-shell.tsx:26:9}]
window: {observationId:observation:1,startDocumentCommitId:16,settledDocumentCommitId:20,frozenDocumentCommitId:21,commits:5,settle:{outcome:met,quietMs:500,timeoutMs:10000,waitedMs:1150,domains:{react:met}},tail:{ms:500,commits:1},environment:{bundle:development,strictMode:unknown,renderCollection:available,visibility:unavailable}}
! ui-outcome-not-observed: Genie does not check the screen; confirm it with the UI driver
! visibility-unobserved: the app reports no visibility signal, so a hidden interval was not observed
attempt 1 for these claims on this tab
evidence: $ npx genie-react verify show vfy_0de914c5-4c0e-49f8-af96-0306566d9680 --claim 1 --session upd-d
session: {sessionId:8e076cdb-031d-49fe-aef0-f1bd5a2cd3d5,logicalSessionId:a07593a5-db3c-4fae-a8d8-4c337dd757ea,documentGeneration:14}
schemaVersion: "1.0"
exitCode: 1
stage: end
ledger: {fingerprint:cf_b557007fb5b6,scope:logical-session,storage:memory,attempt:1,history:[],codeChangedSincePrevious:null,failsOnSameCode:0}
evidence: {retained:true,tools:[react_get_renders,react_component_cohort,react_list_overrides,react_refresh_events,react_profile_stop]}
startedAt: 2026-11-19T08:59:35.656Z
endedAt: 2026-11-19T08:59:37.682Z
request: {budget:{fiberLimit:20000,operationLimit:2000000,timeLimitMs:500,targetOperationReserve:4000,targetTimeReserveMs:4,adaptive:false},settle:{quietMs:500,timeoutMs:10000},maxDurationMs:300000,allowOverrides:false}
[exit 1]

# === issue-table-selector-recompute, before fix
$ agent-browser --session upd-d open 'http://127.0.0.1:5234/issues'
✓ Acme Tracker
  http://127.0.0.1:5234/issues
[exit 0]

$ agent-browser --session upd-d wait '.issue-row'
✓ Done
[exit 0]

$ npx genie-react verify begin --session upd-d --name 'type a saved-view name' --claim 'render IssueTable max 0' --claim 'render SavedViews min 1' --budget '{"adaptive":false,"fiberLimit":20000,"operationLimit":2000000,"timeLimitMs":500}' | tee /tmp/upd-d/vb.txt
recording vfy_e3305d80-260a-4d8b-9055-cc5781fb33ca "type a saved-view name"
  url "http://127.0.0.1:5234/issues"
  1 recording render IssueTable max 0
  2 recording render SavedViews min 1
window: {observationId:observation:1,startDocumentCommitId:17,domains:[react],quietMs:500,timeoutMs:10000,tailMs:500}
next: $ npx genie-react verify end vfy_e3305d80-260a-4d8b-9055-cc5781fb33ca --session upd-d
session: {sessionId:1c0813e9-3901-4637-9fde-ed116df3883c,logicalSessionId:a07593a5-db3c-4fae-a8d8-4c337dd757ea,documentGeneration:15}
schemaVersion: "1.0"
targets: [{target:{component:IssueTable},status:resolved,instances:1,source:~/.t3/worktrees/genie-react/t3-9e64af67-f21cc60f9d8a6648/apps/realworld-legacy/src/features/issues/issue-table.tsx},{target:{component:SavedViews},status:resolved,instances:1,source:~/.t3/worktrees/genie-react/t3-9e64af67-f21cc60f9d8a6648/apps/realworld-legacy/src/features/issues/issues-page.tsx}]
startedAt: 2026-11-19T08:59:38.276Z
expiresAt: 2026-11-19T09:04:38.289Z
request: {budget:{fiberLimit:20000,operationLimit:2000000,timeLimitMs:500,targetOperationReserve:4000,targetTimeReserveMs:4,adaptive:false},settle:{quietMs:500,timeoutMs:10000},maxDurationMs:300000,allowOverrides:false}
[exit 0]

$ agent-browser --session upd-d type 'input[aria-label="View name"]' 'Sprint triage'
✓ Done
[exit 0]

$ npx genie-react verify end vfy_e3305d80-260a-4d8b-9055-cc5781fb33ca --session upd-d
fail vfy_e3305d80-260a-4d8b-9055-cc5781fb33ca "type a saved-view name"  15 commits, quiet after 814 ms (react)
  url "http://127.0.0.1:5234/issues"
  1 fail render IssueTable max 0  {renders:13,mounts:0,updates:13,remounts:0,semantics:exact,instances:1,activeInstances:1}
      claim: {kind:renders,target:{component:IssueTable},max:0,counting:renders,allowRemount:false}
      deciding: [{kind:instance,mountId:mount:1,renders:13,mounts:0,updates:13,mountGeneration:1,latestDocumentCommitId:30,source:~/.t3/worktrees/genie-react/t3-9e64af67-f21cc60f9d8a6648/apps/realworld-legacy/src/features/issues/issue-table.tsx:43:7}]
  2 pass render SavedViews min 1  {renders:13,mounts:0,updates:13,remounts:0,semantics:exact,instances:1,activeInstances:1}
      claim: {kind:renders,target:{component:SavedViews},min:1,counting:renders,allowRemount:false}
      deciding: [{kind:instance,mountId:mount:2,renders:13,mounts:0,updates:13,mountGeneration:1,latestDocumentCommitId:30,source:~/.t3/worktrees/genie-react/t3-9e64af67-f21cc60f9d8a6648/apps/realworld-legacy/src/features/issues/issues-page.tsx:22:7}]
window: {observationId:observation:1,startDocumentCommitId:17,settledDocumentCommitId:31,frozenDocumentCommitId:32,commits:15,settle:{outcome:met,quietMs:500,timeoutMs:10000,waitedMs:814,domains:{react:met}},tail:{ms:500,commits:1},environment:{bundle:development,strictMode:on,renderCollection:available,visibility:unavailable}}
! ui-outcome-not-observed: Genie does not check the screen; confirm it with the UI driver
! visibility-unobserved: the app reports no visibility signal, so a hidden interval was not observed
attempt 1 for these claims on this tab
evidence: $ npx genie-react verify show vfy_e3305d80-260a-4d8b-9055-cc5781fb33ca --claim 1 --session upd-d
session: {sessionId:1c0813e9-3901-4637-9fde-ed116df3883c,logicalSessionId:a07593a5-db3c-4fae-a8d8-4c337dd757ea,documentGeneration:15}
schemaVersion: "1.0"
exitCode: 1
stage: end
ledger: {fingerprint:cf_d487c1452559,scope:logical-session,storage:memory,attempt:1,history:[],codeChangedSincePrevious:null,failsOnSameCode:0}
evidence: {retained:true,tools:[react_get_renders,react_component_cohort,react_list_overrides,react_refresh_events,react_profile_stop]}
startedAt: 2026-11-19T08:59:38.276Z
endedAt: 2026-11-19T08:59:40.140Z
request: {budget:{fiberLimit:20000,operationLimit:2000000,timeLimitMs:500,targetOperationReserve:4000,targetTimeReserveMs:4,adaptive:false},settle:{quietMs:500,timeoutMs:10000},maxDurationMs:300000,allowOverrides:false}
[exit 1]

# --- renders:10 above: each column also rendered for notifications/fetch/fulfilled from the page load. Wait for the notifications count before begin.
$ agent-browser --session upd-d open 'http://127.0.0.1:5234/board'
✓ Acme Tracker
  http://127.0.0.1:5234/board
[exit 0]

$ agent-browser --session upd-d wait '.notifications__count'
✓ Done
[exit 0]

$ npx genie-react verify begin --session upd-d --name 'toggle the sidebar' --claim 'render BoardColumn max 0' --claim 'render SideNav min 1' --budget '{"adaptive":false,"fiberLimit":20000,"operationLimit":2000000,"timeLimitMs":500}' | tee /tmp/upd-d/vb.txt
recording vfy_96c52408-b84c-4c3e-a160-9beb186f493e "toggle the sidebar"
  url "http://127.0.0.1:5234/board"
  1 recording render BoardColumn max 0
  2 recording render SideNav min 1
window: {observationId:observation:1,startDocumentCommitId:17,domains:[react],quietMs:500,timeoutMs:10000,tailMs:500}
next: $ npx genie-react verify end vfy_96c52408-b84c-4c3e-a160-9beb186f493e --session upd-d
session: {sessionId:bebb5836-3537-4b88-b5a9-55980c06c5a0,logicalSessionId:a07593a5-db3c-4fae-a8d8-4c337dd757ea,documentGeneration:16}
schemaVersion: "1.0"
targets: [{target:{component:BoardColumn},status:resolved,instances:5,source:~/.t3/worktrees/genie-react/t3-9e64af67-f21cc60f9d8a6648/apps/realworld-legacy/src/features/board/board-page.tsx},{target:{component:SideNav},status:resolved,instances:1,source:~/.t3/worktrees/genie-react/t3-9e64af67-f21cc60f9d8a6648/apps/realworld-legacy/src/layout/app-shell.tsx}]
startedAt: 2026-11-19T08:59:46.014Z
expiresAt: 2026-11-19T09:04:46.035Z
request: {budget:{fiberLimit:20000,operationLimit:2000000,timeLimitMs:500,targetOperationReserve:4000,targetTimeReserveMs:4,adaptive:false},settle:{quietMs:500,timeoutMs:10000},maxDurationMs:300000,allowOverrides:false}
[exit 0]

$ agent-browser --session upd-d click 'button[aria-label="Toggle sidebar"]'
✓ Done
[exit 0]

$ npx genie-react verify end vfy_96c52408-b84c-4c3e-a160-9beb186f493e --session upd-d
fail vfy_96c52408-b84c-4c3e-a160-9beb186f493e "toggle the sidebar"  4 commits, quiet after 835 ms (react)
  url "http://127.0.0.1:5234/board"
  1 fail render BoardColumn max 0  {renders:5,mounts:0,updates:5,remounts:0,semantics:exact,instances:5,activeInstances:5}
      claim: {kind:renders,target:{component:BoardColumn},max:0,counting:renders,allowRemount:false}
      deciding: [{kind:instance,mountId:mount:1,key:backlog,renders:1,mounts:0,updates:1,mountGeneration:1,latestDocumentCommitId:19,source:~/.t3/worktrees/genie-react/t3-9e64af67-f21cc60f9d8a6648/apps/realworld-legacy/src/features/board/board-page.tsx:28:11},{kind:instance,mountId:mount:2,key:todo,renders:1,mounts:0,updates:1,mountGeneration:1,latestDocumentCommitId:19,source:~/.t3/worktrees/genie-react/t3-9e64af67-f21cc60f9d8a6648/apps/realworld-legacy/src/features/board/board-page.tsx:28:11},{kind:instance,mountId:mount:3,key:in_progress,renders:1,mounts:0,updates:1,mountGeneration:1,latestDocumentCommitId:19,source:~/.t3/worktrees/genie-react/t3-9e64af67-f21cc60f9d8a6648/apps/realworld-legacy/src/features/board/board-page.tsx:28:11}]
  2 pass render SideNav min 1  {renders:1,mounts:0,updates:1,remounts:0,semantics:exact,instances:1,activeInstances:1}
      claim: {kind:renders,target:{component:SideNav},min:1,counting:renders,allowRemount:false}
      deciding: [{kind:instance,mountId:mount:6,renders:1,mounts:0,updates:1,mountGeneration:1,latestDocumentCommitId:18,source:~/.t3/worktrees/genie-react/t3-9e64af67-f21cc60f9d8a6648/apps/realworld-legacy/src/layout/app-shell.tsx:26:9}]
window: {observationId:observation:1,startDocumentCommitId:17,settledDocumentCommitId:20,frozenDocumentCommitId:21,commits:4,settle:{outcome:met,quietMs:500,timeoutMs:10000,waitedMs:835,domains:{react:met}},tail:{ms:500,commits:1},environment:{bundle:development,strictMode:unknown,renderCollection:available,visibility:unavailable}}
! ui-outcome-not-observed: Genie does not check the screen; confirm it with the UI driver
! visibility-unobserved: the app reports no visibility signal, so a hidden interval was not observed
attempt 2 for these claims on this tab; previous fail vfy_0de914c5-4c0e-49f8-af96-0306566d9680; document reloaded since
evidence: $ npx genie-react verify show vfy_96c52408-b84c-4c3e-a160-9beb186f493e --claim 1 --session upd-d
session: {sessionId:bebb5836-3537-4b88-b5a9-55980c06c5a0,logicalSessionId:a07593a5-db3c-4fae-a8d8-4c337dd757ea,documentGeneration:16}
schemaVersion: "1.0"
exitCode: 1
stage: end
ledger: {fingerprint:cf_b557007fb5b6,scope:logical-session,storage:memory,attempt:2,history:[{verificationId:vfy_0de914c5-4c0e-49f8-af96-0306566d9680,verdict:fail,reasons:[],endedAt:2026-11-19T08:59:37.682Z}],codeChangedSincePrevious:document-reloaded,failsOnSameCode:0}
evidence: {retained:true,tools:[react_get_renders,react_component_cohort,react_list_overrides,react_refresh_events,react_profile_stop]}
startedAt: 2026-11-19T08:59:46.014Z
endedAt: 2026-11-19T08:59:47.695Z
request: {budget:{fiberLimit:20000,operationLimit:2000000,timeLimitMs:500,targetOperationReserve:4000,targetTimeReserveMs:4,adaptive:false},settle:{quietMs:500,timeoutMs:10000},maxDurationMs:300000,allowOverrides:false}
[exit 1]

# === board causes on shipped code, after the page-load notifications fetch
$ agent-browser --session upd-d open 'http://127.0.0.1:5234/board'
✓ Acme Tracker
  http://127.0.0.1:5234/board
[exit 0]

$ agent-browser --session upd-d wait '.notifications__count'
✓ Done
[exit 0]

$ npx genie-react call react_clear_renders '{}' --session upd-d --select /ok
status: ok
selection: {expression:/ok,matchedPathCount:1,matchedPaths:[/ok],omittedPathCount:15}
result: true
[exit 0]

$ agent-browser --session upd-d click 'button[aria-label="Toggle sidebar"]'
✓ Done
[exit 0]

$ npx genie-react call react_quiesce '{"idleMs":500,"timeoutMs":10000}' --fail-on-result-error --session upd-d --select /outcome
status: ok
selection: {expression:/outcome,matchedPathCount:1,matchedPaths:[/outcome],omittedPathCount:16}
result: idle
[exit 0]

$ npx genie-react call react_render_causes '{"component":"BoardColumn"}' --session upd-d
componentMatch:
  component: BoardColumn
  exact: true
  status: matched
  matchedNames: [BoardColumn]
  matchedNameCount: 1
  similarNames: []
tracking: true
commits: 3
documentCommitId: 20
observation: {id:observation:1,epoch:1,startedAfterDocumentCommitId:17}
attribution:
  status: stale
  startedAtDocumentCommitId: 20
  completedAtDocumentCommitId: 21
  startedAtAnalysisGeneration: 21
  completedAtAnalysisGeneration: 22
view: summary
events[5] (componentName #componentId {fields}, then ← kind evidence name {fields} per cause):
  each: {documentCommitId:19,necessity:unknown,necessityReason:effects-scheduled,inputEvidence:incomplete,inputCoverage:{complete:false,scanTruncated:true},source:{location:null,ownership:unknown}}
  BoardColumn #10836521260686 {renderEventId:render:19:1312,mountId:mount:1298,key:done}
    ← external-store inferred anonymous-external-store {changedFields:[],redux:{evidence:inferred,actions:[ui/sidebarToggled]}}
  BoardColumn #10836521260104 {renderEventId:render:19:1309,mountId:mount:1297,key:in_review}
    ← external-store inferred anonymous-external-store {changedFields:[],redux:{evidence:inferred,actions:[ui/sidebarToggled]}}
  BoardColumn #10836521258919 {renderEventId:render:19:1306,mountId:mount:1296,key:in_progress}
    ← external-store inferred anonymous-external-store {changedFields:[],redux:{evidence:inferred,actions:[ui/sidebarToggled]}}
  BoardColumn #10836521257144 {renderEventId:render:19:1303,mountId:mount:1295,key:todo}
    ← external-store inferred anonymous-external-store {changedFields:[],redux:{evidence:inferred,actions:[ui/sidebarToggled]}}
  BoardColumn #10836521255424 {renderEventId:render:19:1300,mountId:mount:1294,key:backlog}
    ← external-store inferred anonymous-external-store {changedFields:[],redux:{evidence:inferred,actions:[ui/sidebarToggled]}}
omittedByLimit: 0
sourceClassification:
  complete: false
  affects: result
  totalCandidates: 5
  evaluated: 0
  app: 0
  library: 0
  unknown: 5
  unknownComponents: [BoardColumn]
  unknownComponentsOmitted: 0
renderEventRetention: {evictedEvents:292,earliestDocumentCommitId:18,latestDocumentCommitId:20}
coverage:
  skippedCommitFibers: 0
  droppedUnmountFibers: 0
  analysisFailedFibers: 0
  pausedCommits: 0
  unobservedCommits: 0
  refreshCommitsExcluded: 0
  truncatedInputFibers: 1265
  propsNotEnumeratedFibers: 0
  budgetExhaustedCommits: 0
  budgetExhaustedSubsystems: []
  incompleteBecause[2]:
    - {reason:inputs-truncated,fibers:1265,components:[PriorityPicker,FeatureGate,BoardColumn],detail:"An input held values Genie compares only in part, such as functions, class instances or objects past the inspected depth; read deepDiff.truncated on these components."}
    - {reason:source-classification-incomplete,fibers:5,detail:"5 of 5 candidates have unresolved ownership. appOnly keeps them, but any of them may be library code it would hide, so rows and counts can change once ownership resolves.",next:"Pass appOnly:false for counts that do not depend on ownership, or read again shortly: ownership keeps resolving in the background, though a component React rendered without an owner stack stays unknown."}
  complete: false
  inputAttributionComplete: false
  semantics: unknown
  coverageDomain: render-causality
  droppedRenderEvents: 292
filteredNote: "5 components shown; 5 shown with ownership \"unknown\" because their source is unresolved"
[exit 0]

# === issue table causes on shipped code
$ agent-browser --session upd-d open 'http://127.0.0.1:5234/issues'
✓ Acme Tracker
  http://127.0.0.1:5234/issues
[exit 0]

$ agent-browser --session upd-d wait '.notifications__count'
✓ Done
[exit 0]

$ npx genie-react call react_clear_renders '{"component":"IssueTable"}' --session upd-d --select /ok
status: ok
selection: {expression:/ok,matchedPathCount:1,matchedPaths:[/ok],omittedPathCount:15}
result: true
[exit 0]

$ agent-browser --session upd-d type 'input[aria-label="View name"]' S
✓ Done
[exit 0]

$ npx genie-react call react_quiesce '{"idleMs":500,"timeoutMs":10000}' --fail-on-result-error --session upd-d --select /outcome
status: ok
selection: {expression:/outcome,matchedPathCount:1,matchedPaths:[/outcome],omittedPathCount:16}
result: idle
[exit 0]

$ npx genie-react call react_render_causes '{"component":"IssueTable","limit":1,"view":"full","appOnly":false}' --session upd-d --json | jq -c '.events[] | {componentName, necessity, causes: [.causes[] | {kind, evidence, name, deepDiff}]}'
{"componentName":"IssueTable","necessity":"unnecessary","causes":[{"kind":"parent","evidence":"inferred","name":null,"deepDiff":null},{"kind":"props","evidence":"exact","name":"rows","deepDiff":{"changes":[{"kind":"reference-only","path":""}],"visited":101,"truncated":false}}]}
[exit 0]

$ npx genie-react call react_render_causes '{"component":"BoardColumn","limit":1,"view":"full"}' --session upd-d --json | jq -c '.events[] | {componentName, necessity, cause: (.causes[0] | {kind, evidence, equality, selectionEqual, changedFields, deepDiff, redux: (.redux | {evidence, reason, actions: [.actions[]? | {sequence, type}]})})}'

[exit 0]

# (the empty read above ran after the window had moved to /issues, so it matched no BoardColumn events)
# --- board-column-selector-cache reference fix applied
 apps/realworld-legacy/src/features/board/board-column.tsx | 7 ++++---
 apps/realworld-legacy/src/store/board-selectors.ts        | 9 +++++----
 2 files changed, 9 insertions(+), 7 deletions(-)
# === board-column-selector-cache, after fix
$ agent-browser --session upd-d open 'http://127.0.0.1:5234/board'
✓ Acme Tracker
  http://127.0.0.1:5234/board
[exit 0]

$ agent-browser --session upd-d wait '.notifications__count'
✓ Done
[exit 0]

$ npx genie-react verify begin --session upd-d --name 'toggle the sidebar' --claim 'render BoardColumn max 0' --claim 'render SideNav min 1' --budget '{"adaptive":false,"fiberLimit":20000,"operationLimit":2000000,"timeLimitMs":500}' | tee /tmp/upd-d/vb.txt
recording vfy_95f0968c-a466-4aef-bbef-eceb9eed9f53 "toggle the sidebar"
  url "http://127.0.0.1:5234/board"
  1 recording render BoardColumn max 0
  2 recording render SideNav min 1
window: {observationId:observation:1,startDocumentCommitId:17,domains:[react],quietMs:500,timeoutMs:10000,tailMs:500}
next: $ npx genie-react verify end vfy_95f0968c-a466-4aef-bbef-eceb9eed9f53 --session upd-d
session: {sessionId:9465402e-d470-450f-8647-a08417fd43a2,logicalSessionId:a07593a5-db3c-4fae-a8d8-4c337dd757ea,documentGeneration:20}
schemaVersion: "1.0"
targets: [{target:{component:BoardColumn},status:resolved,instances:5,source:~/.t3/worktrees/genie-react/t3-9e64af67-f21cc60f9d8a6648/apps/realworld-legacy/src/features/board/board-page.tsx},{target:{component:SideNav},status:resolved,instances:1,source:~/.t3/worktrees/genie-react/t3-9e64af67-f21cc60f9d8a6648/apps/realworld-legacy/src/layout/app-shell.tsx}]
startedAt: 2026-11-19T09:00:21.927Z
expiresAt: 2026-11-19T09:05:21.954Z
request: {budget:{fiberLimit:20000,operationLimit:2000000,timeLimitMs:500,targetOperationReserve:4000,targetTimeReserveMs:4,adaptive:false},settle:{quietMs:500,timeoutMs:10000},maxDurationMs:300000,allowOverrides:false}
[exit 0]

$ agent-browser --session upd-d click 'button[aria-label="Toggle sidebar"]'
✓ Done
[exit 0]

$ npx genie-react verify end vfy_95f0968c-a466-4aef-bbef-eceb9eed9f53 --session upd-d
pass vfy_95f0968c-a466-4aef-bbef-eceb9eed9f53 "toggle the sidebar"  4 commits, quiet after 657 ms (react)
  url "http://127.0.0.1:5234/board"
  1 pass render BoardColumn max 0  {renders:0,mounts:0,updates:0,remounts:0,semantics:exact,instances:5,activeInstances:5}
      claim: {kind:renders,target:{component:BoardColumn},max:0,counting:renders,allowRemount:false}
      deciding: [{kind:coverage,complete:true,targetedComplete:true,semantics:exact},{kind:instance,mountId:mount:1,renderingState:mounted-rendering,source:~/.t3/worktrees/genie-react/t3-9e64af67-f21cc60f9d8a6648/apps/realworld-legacy/src/features/board/board-page.tsx:28:11},{kind:instance,mountId:mount:2,renderingState:mounted-rendering,source:~/.t3/worktrees/genie-react/t3-9e64af67-f21cc60f9d8a6648/apps/realworld-legacy/src/features/board/board-page.tsx:28:11}]
  2 pass render SideNav min 1  {renders:1,mounts:0,updates:1,remounts:0,semantics:exact,instances:1,activeInstances:1}
      claim: {kind:renders,target:{component:SideNav},min:1,counting:renders,allowRemount:false}
      deciding: [{kind:instance,mountId:mount:6,renders:1,mounts:0,updates:1,mountGeneration:1,latestDocumentCommitId:18,source:~/.t3/worktrees/genie-react/t3-9e64af67-f21cc60f9d8a6648/apps/realworld-legacy/src/layout/app-shell.tsx:26:9}]
window: {observationId:observation:1,startDocumentCommitId:17,settledDocumentCommitId:20,frozenDocumentCommitId:21,commits:4,settle:{outcome:met,quietMs:500,timeoutMs:10000,waitedMs:657,domains:{react:met}},tail:{ms:500,commits:1},environment:{bundle:development,strictMode:unknown,renderCollection:available,visibility:unavailable}}
! ui-outcome-not-observed: Genie does not check the screen; confirm it with the UI driver
! visibility-unobserved: the app reports no visibility signal, so a hidden interval was not observed
attempt 3 for these claims on this tab; previous fail vfy_96c52408-b84c-4c3e-a160-9beb186f493e; document reloaded since
evidence: $ npx genie-react verify show vfy_95f0968c-a466-4aef-bbef-eceb9eed9f53 --session upd-d
session: {sessionId:9465402e-d470-450f-8647-a08417fd43a2,logicalSessionId:a07593a5-db3c-4fae-a8d8-4c337dd757ea,documentGeneration:20}
schemaVersion: "1.0"
exitCode: 0
stage: end
ledger: {fingerprint:cf_b557007fb5b6,scope:logical-session,storage:memory,attempt:3,history:[{verificationId:vfy_0de914c5-4c0e-49f8-af96-0306566d9680,verdict:fail,reasons:[],endedAt:2026-11-19T08:59:37.682Z},{verificationId:vfy_96c52408-b84c-4c3e-a160-9beb186f493e,verdict:fail,reasons:[],endedAt:2026-11-19T08:59:47.695Z}],codeChangedSincePrevious:document-reloaded,failsOnSameCode:0}
evidence: {retained:true,tools:[react_get_renders,react_component_cohort,react_list_overrides,react_refresh_events,react_profile_stop]}
startedAt: 2026-11-19T09:00:21.927Z
endedAt: 2026-11-19T09:00:23.498Z
request: {budget:{fiberLimit:20000,operationLimit:2000000,timeLimitMs:500,targetOperationReserve:4000,targetTimeReserveMs:4,adaptive:false},settle:{quietMs:500,timeoutMs:10000},maxDurationMs:300000,allowOverrides:false}
[exit 0]

# --- reverted with git checkout -- apps/realworld-legacy
# --- issue-table-selector-recompute reference fix applied
 apps/realworld-legacy/src/store/issue-selectors.ts | 10 ++++------
 1 file changed, 4 insertions(+), 6 deletions(-)
# === issue-table-selector-recompute, after fix
$ agent-browser --session upd-d open 'http://127.0.0.1:5234/issues'
✓ Acme Tracker
  http://127.0.0.1:5234/issues
[exit 0]

$ agent-browser --session upd-d wait '.notifications__count'
✓ Done
[exit 0]

$ npx genie-react verify begin --session upd-d --name 'type a saved-view name' --claim 'render IssueTable max 0' --claim 'render SavedViews min 1' --budget '{"adaptive":false,"fiberLimit":20000,"operationLimit":2000000,"timeLimitMs":500}' | tee /tmp/upd-d/vb.txt
recording vfy_a3e757a3-feda-4c14-8f8c-21329cb1658f "type a saved-view name"
  url "http://127.0.0.1:5234/issues"
  1 recording render IssueTable max 0
  2 recording render SavedViews min 1
window: {observationId:observation:1,startDocumentCommitId:16,domains:[react],quietMs:500,timeoutMs:10000,tailMs:500}
next: $ npx genie-react verify end vfy_a3e757a3-feda-4c14-8f8c-21329cb1658f --session upd-d
session: {sessionId:77b09f6f-2bba-40c3-9ecb-84055c85b048,logicalSessionId:a07593a5-db3c-4fae-a8d8-4c337dd757ea,documentGeneration:22}
schemaVersion: "1.0"
targets: [{target:{component:IssueTable},status:resolved,instances:1,source:~/.t3/worktrees/genie-react/t3-9e64af67-f21cc60f9d8a6648/apps/realworld-legacy/src/features/issues/issue-table.tsx},{target:{component:SavedViews},status:resolved,instances:1,source:~/.t3/worktrees/genie-react/t3-9e64af67-f21cc60f9d8a6648/apps/realworld-legacy/src/features/issues/issues-page.tsx}]
startedAt: 2026-11-19T09:00:29.232Z
expiresAt: 2026-11-19T09:05:29.249Z
request: {budget:{fiberLimit:20000,operationLimit:2000000,timeLimitMs:500,targetOperationReserve:4000,targetTimeReserveMs:4,adaptive:false},settle:{quietMs:500,timeoutMs:10000},maxDurationMs:300000,allowOverrides:false}
[exit 0]

$ agent-browser --session upd-d type 'input[aria-label="View name"]' 'Sprint triage'
✓ Done
[exit 0]

$ npx genie-react verify end vfy_a3e757a3-feda-4c14-8f8c-21329cb1658f --session upd-d
pass vfy_a3e757a3-feda-4c14-8f8c-21329cb1658f "type a saved-view name"  15 commits, quiet after 929 ms (react)
  url "http://127.0.0.1:5234/issues"
  1 pass render IssueTable max 0  {renders:0,mounts:0,updates:0,remounts:0,semantics:exact,instances:1,activeInstances:1}
      claim: {kind:renders,target:{component:IssueTable},max:0,counting:renders,allowRemount:false}
      deciding: [{kind:coverage,complete:true,targetedComplete:true,semantics:exact},{kind:instance,mountId:mount:1,renderingState:mounted-rendering,source:~/.t3/worktrees/genie-react/t3-9e64af67-f21cc60f9d8a6648/apps/realworld-legacy/src/features/issues/issue-table.tsx:43:7}]
  2 pass render SavedViews min 1  {renders:13,mounts:0,updates:13,remounts:0,semantics:exact,instances:1,activeInstances:1}
      claim: {kind:renders,target:{component:SavedViews},min:1,counting:renders,allowRemount:false}
      deciding: [{kind:instance,mountId:mount:2,renders:13,mounts:0,updates:13,mountGeneration:1,latestDocumentCommitId:29,source:~/.t3/worktrees/genie-react/t3-9e64af67-f21cc60f9d8a6648/apps/realworld-legacy/src/features/issues/issues-page.tsx:22:7}]
window: {observationId:observation:1,startDocumentCommitId:16,settledDocumentCommitId:30,frozenDocumentCommitId:31,commits:15,settle:{outcome:met,quietMs:500,timeoutMs:10000,waitedMs:929,domains:{react:met}},tail:{ms:500,commits:1},environment:{bundle:development,strictMode:on,renderCollection:available,visibility:unavailable}}
! ui-outcome-not-observed: Genie does not check the screen; confirm it with the UI driver
! visibility-unobserved: the app reports no visibility signal, so a hidden interval was not observed
attempt 2 for these claims on this tab; previous fail vfy_e3305d80-260a-4d8b-9055-cc5781fb33ca; document reloaded since
evidence: $ npx genie-react verify show vfy_a3e757a3-feda-4c14-8f8c-21329cb1658f --session upd-d
session: {sessionId:77b09f6f-2bba-40c3-9ecb-84055c85b048,logicalSessionId:a07593a5-db3c-4fae-a8d8-4c337dd757ea,documentGeneration:22}
schemaVersion: "1.0"
exitCode: 0
stage: end
ledger: {fingerprint:cf_d487c1452559,scope:logical-session,storage:memory,attempt:2,history:[{verificationId:vfy_e3305d80-260a-4d8b-9055-cc5781fb33ca,verdict:fail,reasons:[],endedAt:2026-11-19T08:59:40.140Z}],codeChangedSincePrevious:document-reloaded,failsOnSameCode:0}
evidence: {retained:true,tools:[react_get_renders,react_component_cohort,react_list_overrides,react_refresh_events,react_profile_stop]}
startedAt: 2026-11-19T09:00:29.232Z
endedAt: 2026-11-19T09:00:30.987Z
request: {budget:{fiberLimit:20000,operationLimit:2000000,timeLimitMs:500,targetOperationReserve:4000,targetTimeReserveMs:4,adaptive:false},settle:{quietMs:500,timeoutMs:10000},maxDurationMs:300000,allowOverrides:false}
[exit 0]

# --- reverted with git checkout -- apps/realworld-legacy
```

### Files written by the batch commands

Each `batch ... --json > file` command above wrote one line of JSON. The files follow in the order they were written, untrimmed, with the home directory replaced by `~`.

`/tmp/upd-d/chain-filter.json`:

```json
[{"schemaVersion":"2.0","tool":"react_render_causes","ok":true,"status":"ok","result":{"componentMatch":{"component":"AccountMenu","exact":true,"status":"matched","matchedNames":["AccountMenu"],"matchedNameCount":1,"similarNames":[]},"tracking":true,"commits":10,"documentCommitId":26,"observation":{"id":"observation:1","epoch":1,"startedAfterDocumentCommitId":16},"attribution":{"status":"current","startedAtDocumentCommitId":26,"completedAtDocumentCommitId":26,"startedAtAnalysisGeneration":27,"completedAtAnalysisGeneration":27},"view":"full","events":[{"renderEventId":"render:25:8091","observationId":"observation:1","commitId":9,"documentCommitId":25,"componentId":170573955262,"componentName":"AccountMenu","instance":{"fiberId":170573955262,"mountId":"mount:151","key":null,"siblingIndex":3,"parent":{"fiberId":170573955253,"name":"TopBar","key":null},"keyedParent":null,"logicalPath":"AppErrorBoundary[index=0] > Provider[index=0] > BrowserRouter[index=0] > Router[index=0] > ThemeProvider[index=0] > App[index=0] > Routes[index=0] > RenderedRoute[index=0] > RequireAuth[index=0] > Connect(AppShell)[index=0] > AppShell[index=0] > FeatureFlagsProvider[index=0] > <div>[index=0] > TopBar[index=0] > <header>[index=0] > <div>[index=3] > AccountMenu[index=3]","logicalIdentityEvidence":"positional","mountGeneration":1,"mountGenerationEvidence":"exact","hostSelector":null},"causes":[{"kind":"external-store","evidence":"inferred","reason":"external-store-snapshot-changed","hookIndex":4,"externalStoreIndex":0,"subscriberId":"subscriber:mount:151:0","selectionEqual":false,"subscriptionFired":true,"before":{"user":{"id":"u-1","name":"Dana Whitfield","email":"dana@acme.test","title":"Designer","team":"Infra"},"savedViewCount":0},"after":{"user":{"id":"u-1","name":"Dana Whitfield","email":"dana@acme.test","title":"Designer","team":"Infra"},"savedViewCount":0},"changedFields":[],"deepDiff":{"changes":[{"kind":"reference-only","path":""}],"visited":3,"truncated":false},"storeId":"external-store:1","storeLabel":"anonymous-external-store","selector":null,"equality":"object-is","fanout":null,"notificationId":null,"competingCandidates":["external-store-snapshot-identity-changed"],"redux":{"storeId":"redux-store:1","link":"subscription","evidence":"inferred","reason":"unrecorded-state-change","actions":[{"actionId":"redux-store:1/action:4778","sequence":4778,"kind":"unrecorded-change","type":null,"changedSlices":["service"]}],"omittedActions":0},"hookProvenance":{"status":"unavailable","evidence":"unknown","reason":"shadow-render-disabled"}}],"necessity":"unnecessary","necessityReason":"inputs-unchanged","assessment":{"inputEvidence":"none-observed","observedInputKinds":[],"behaviorEvidence":{"subtreeHostMutations":{"status":"none-observed","count":0,"pendingSubtrees":0,"omittedByLimit":0,"callbackOnlyUpdates":0,"writes":[],"callbacks":[]},"scheduledEffects":{"status":"observed","count":2},"subtreeScheduledEffects":{"status":"observed","count":2},"unobservedDomains":["focus","url","network","transition","freshness","effect-execution"]},"optimizationSafety":"not-proven-safe","requiredValidation":["dom","aria","focus","url","network","transition"]},"inputCoverage":{"complete":true,"omittedInputs":0,"scanTruncated":false,"propsNotEnumerated":false},"source":{"file":"~/.t3/worktrees/genie-react/t3-9e64af67-f21cc60f9d8a6648/apps/realworld-legacy/src/layout/top-bar.tsx","line":32,"column":9,"functionName":null,"sourceMapConfidence":"served","role":"element-callsite"},"sourceAttribution":{"role":"usage-or-definition-fallback","evidence":"inferred"},"sourceOwnership":"app","isLibrary":false}],"omittedByLimit":0,"sourceClassification":{"complete":true,"affects":"result","totalCandidates":1,"evaluated":1,"app":1,"library":0,"unknown":0,"unknownComponents":[],"unknownComponentsOmitted":0},"renderEventRetention":{"evictedEvents":3674,"earliestDocumentCommitId":24,"latestDocumentCommitId":26},"coverage":{"skippedCommitFibers":0,"droppedUnmountFibers":0,"analysisFailedFibers":0,"pausedCommits":0,"unobservedCommits":0,"refreshCommitsExcluded":0,"truncatedInputFibers":5,"propsNotEnumeratedFibers":0,"budgetExhaustedCommits":0,"budgetExhaustedSubsystems":[],"incompleteBecause":[{"reason":"inputs-truncated","fibers":5,"components":["IssueTableToolbar"],"detail":"An input held values Genie compares only in part, such as functions, class instances or objects past the inspected depth; read deepDiff.truncated on these components."}],"complete":false,"inputAttributionComplete":false,"semantics":"lower-bound","coverageDomain":"render-causality","droppedRenderEvents":3674}},"session":{"sessionId":"954d8289-a965-44f7-9a1e-fb29bac18e39","logicalSessionId":"a07593a5-db3c-4fae-a8d8-4c337dd757ea"}},{"schemaVersion":"2.0","tool":"redux_actions","ok":true,"status":"ok","result":{"store":{"storeId":"redux-store:1","name":"app"},"records":[{"sequence":13,"actionId":"redux-store:1/action:13","kind":"action","type":"issues/fetchAll/pending","label":"issues/fetchAll/pending","parentActionId":"redux-store:1/action:12","at":1795078564160,"durationMs":0,"outcome":"returned","error":null,"rootStateChanged":true,"changedSlices":["issues"],"changedSlicesTruncated":false,"unrecordedNestedDispatches":0,"mutation":{"status":"none-detected","notScannedReason":null,"findings":[],"findingsOmitted":false,"objectsCompared":4,"scanTruncated":false},"payload":{"type":"issues/fetchAll/pending","meta":{"requestId":"m2VY5L5l3avGX-R9OE0-7","requestStatus":"pending"}},"renderEventIds":[],"reactWorkActive":true,"genieMs":0.1},{"sequence":25,"actionId":"redux-store:1/action:25","kind":"action","type":"issues/fetchAll/pending","label":"issues/fetchAll/pending","parentActionId":"redux-store:1/action:24","at":1795078564161,"durationMs":0,"outcome":"returned","error":null,"rootStateChanged":false,"changedSlices":[],"changedSlicesTruncated":false,"unrecordedNestedDispatches":0,"mutation":{"status":"none-detected","notScannedReason":null,"findings":[],"findingsOmitted":false,"objectsCompared":4,"scanTruncated":false},"payload":{"type":"issues/fetchAll/pending","meta":{"requestId":"-bJJYx3iOp86Ounxan41d","requestStatus":"pending"}},"renderEventIds":[],"reactWorkActive":true,"genieMs":0},{"sequence":41,"actionId":"redux-store:1/action:41","kind":"action","type":"issues/fetchAll/fulfilled","label":"issues/fetchAll/fulfilled","parentActionId":"redux-store:1/action:12","at":1795078564230,"durationMs":6.7,"outcome":"returned","error":null,"rootStateChanged":true,"changedSlices":["issues"],"changedSlicesTruncated":false,"unrecordedNestedDispatches":0,"mutation":{"status":"none-detected","notScannedReason":null,"findings":[],"findingsOmitted":false,"objectsCompared":4,"scanTruncated":true},"payload":{"type":"issues/fetchAll/fulfilled","payload":[{"id":"iss-1","key":"CORE-1","projectKey":"CORE","title":"Migrate push notification opt-out","description":"Reported by the docs team. This regressed after the last release, bisecting now.","status":"backlog","priority":"urgent","assigneeId":"u-18","reporterId":"u-19","labels":{"__genie_dehydrated__":true,"kind":"array","preview":"Array(2)","path":["payload",0,"labels"],"size":2},"estimate":3,"createdAt":"2026-01-31T19:49:51.000Z","updatedAt":"2026-03-02T09:00:00.000Z","completedAt":null,"commentCount":5},{"id":"iss-2","key":"CORE-2","projectKey":"CORE","title":"Add dashboard filters","description":"Reported by the frontend team. Added logs, waiting for the next occurrence.","status":"in_progress","priority":"high","assigneeId":"u-33","reporterId":"u-15","labels":{"__genie_dehydrated__":true,"kind":"array","preview":"Array(1)","path":["payload",1,"labels"],"size":1},"estimate":3,"createdAt":"2025-03-25T20:57:13.000Z","updatedAt":"2025-03-27T20:57:13.000Z","completedAt":null,"commentCount":0},{"id":"iss-3","key":"CORE-3","projectKey":"CORE","title":"Remove CSV import validation","description":"Reported by the security team. Moved to the next sprint, blocked on the API change.","status":"todo","priority":"low","assigneeId":"u-27","reporterId":"u-27","labels":{"__genie_dehydrated__":true,"kind":"array","preview":"Array(1)","path":["payload",2,"labels"],"size":1},"estimate":null,"createdAt":"2025-10-14T00:51:43.000Z","updatedAt":"2025-11-07T00:51:43.000Z","completedAt":null,"commentCount":0},{"id":"iss-4","key":"CORE-4","projectKey":"CORE","title":"Speed up billing email template","description":"Reported by the frontend team. Design signed off on the copy changes.","status":"done","priority":"high","assigneeId":"u-4","reporterId":"u-11","labels":{"__genie_dehydrated__":true,"kind":"array","preview":"Array(0)","path":["payload",3,"labels"],"size":0},"estimate":8,"createdAt":"2025-02-03T00:33:13.000Z","updatedAt":"2025-02-27T00:33:13.000Z","completedAt":"2025-02-27T00:33:13.000Z","commentCount":2},{"id":"iss-5","key":"CORE-5","projectKey":"CORE","title":"Migrate session timeout warning","description":"Reported by the design team. Pushed a draft branch, would appreciate a second pair of eyes.","status":"done","priority":"medium","assigneeId":"u-21","reporterId":"u-23","labels":{"__genie_dehydrated__":true,"kind":"array","preview":"Array(2)","path":["payload",4,"labels"],"size":2},"estimate":3,"createdAt":"2025-08-01T02:59:14.000Z","updatedAt":"2025-08-18T02:59:14.000Z","completedAt":"2025-08-18T02:59:14.000Z","commentCount":5},{"id":"iss-6","key":"CORE-6","projectKey":"CORE","title":"Document API key rotation","description":"Reported by the backend team. Added logs, waiting for the next occurrence.","status":"in_progress","priority":"medium","assigneeId":"u-25","reporterId":"u-1","labels":{"__genie_dehydrated__":true,"kind":"array","preview":"Array(0)","path":["payload",5,"labels"],"size":0},"estimate":5,"createdAt":"2025-06-28T02:44:25.000Z","updatedAt":"2025-07-10T02:44:25.000Z","completedAt":null,"commentCount":1},{"id":"iss-7","key":"CORE-7","projectKey":"CORE","title":"Investigate login redirect loop","description":"Reported by the frontend team. Customer success says three accounts are affected.","status":"done","priority":"medium","assigneeId":"u-15","reporterId":"u-32","labels":{"__genie_dehydrated__":true,"kind":"array","preview":"Array(0)","path":["payload",6,"labels"],"size":0},"estimate":8,"createdAt":"2025-02-03T23:16:14.000Z","updatedAt":"2025-02-05T23:16:14.000Z","completedAt":"2025-02-05T23:16:14.000Z","commentCount":1},{"id":"iss-8","key":"CORE-8","projectKey":"CORE","title":"Refactor report scheduler","description":"Reported by the backend team. Customer success says three accounts are affected.","status":"done","priority":"high","assigneeId":"u-13","reporterId":"u-25","labels":{"__genie_dehydrated__":true,"kind":"array","preview":"Array(2)","path":["payload",7,"labels"],"size":2},"estimate":2,"createdAt":"2025-07-19T07:53:55.000Z","updatedAt":"2025-07-22T07:53:55.000Z","completedAt":"2025-07-22T07:53:55.000Z","commentCount":6},{"id":"iss-9","key":"CORE-9","projectKey":"CORE","title":"Remove search ranking","description":"Reported by the infra team. Verified on mobile Safari and Chrome.","status":"in_progress","priority":"medium","assigneeId":"u-7","reporterId":"u-26","labels":{"__genie_dehydrated__":true,"kind":"array","preview":"Array(0)","path":["payload",8,"labels"],"size":0},"estimate":5,"createdAt":"2025-12-19T23:19:55.000Z","updatedAt":"2026-01-11T23:19:55.000Z","completedAt":null,"commentCount":6},{"id":"iss-10","key":"CORE-10","projectKey":"CORE","title":"Document error page copy","description":"Reported by the security team. Added logs, waiting for the next occurrence.","status":"backlog","priority":"high","assigneeId":"u-23","reporterId":"u-1","labels":{"__genie_dehydrated__":true,"kind":"array","preview":"Array(2)","path":["payload",9,"labels"],"size":2},"estimate":3,"createdAt":"2025-06-11T13:14:51.000Z","updatedAt":"2025-08-04T13:14:51.000Z","completedAt":null,"commentCount":5},{"id":"iss-11","key":"CORE-11","projectKey":"CORE","title":"Refactor GDPR export","description":"Reported by the infra team. The fix is behind the new flag, rolling out to 10%.","status":"done","priority":"medium","assigneeId":"u-24","reporterId":"u-30","labels":{"__genie_dehydrated__":true,"kind":"array","preview":"Array(1)","path":["payload",10,"labels"],"size":1},"estimate":8,"createdAt":"2025-11-22T17:31:02.000Z","updatedAt":"2025-11-27T17:31:02.000Z","completedAt":"2025-11-27T17:31:02.000Z","commentCount":5},{"id":"iss-12","key":"CORE-12","projectKey":"CORE","title":"Document audit log pagination","description":"Reported by the backend team. Design signed off on the copy changes.","status":"done","priority":"urgent","assigneeId":"u-31","reporterId":"u-23","labels":{"__genie_dehydrated__":true,"kind":"array","preview":"Array(0)","path":["payload",11,"labels"],"size":0},"estimate":2,"createdAt":"2026-02-27T07:10:24.000Z","updatedAt":"2026-03-01T09:00:00.000Z","completedAt":"2026-03-01T09:00:00.000Z","commentCount":4},{"id":"iss-13","key":"CORE-13","projectKey":"CORE","title":"Speed up GDPR export","description":"Reported by the performance team. The fix is behind the new flag, rolling out to 10%.","status":"todo","priority":"medium","assigneeId":"u-3","reporterId":"u-3","labels":{"__genie_dehydrated__":true,"kind":"array","preview":"Array(0)","path":["payload",12,"labels"],"size":0},"estimate":5,"createdAt":"2025-03-21T10:39:41.000Z","updatedAt":"2025-04-10T10:39:41.000Z","completedAt":null,"commentCount":3},{"id":"iss-14","key":"CORE-14","projectKey":"CORE","title":"Remove audit log pagination","description":"Reported by the frontend team. Moved to the next sprint, blocked on the API change.","status":"done","priority":"low","assigneeId":null,"reporterId":"u-12","labels":{"__genie_dehydrated__":true,"kind":"array","preview":"Array(1)","path":["payload",13,"labels"],"size":1},"estimate":2,"createdAt":"2025-09-13T23:38:34.000Z","updatedAt":"2025-09-21T23:38:34.000Z","completedAt":"2025-09-21T23:38:34.000Z","commentCount":1},{"id":"iss-15","key":"CORE-15","projectKey":"CORE","title":"Add SSO metadata refresh","description":"Reported by the backend team. Added logs, waiting for the next occurrence.","status":"todo","priority":"medium","assigneeId":"u-3","reporterId":"u-5","labels":{"__genie_dehydrated__":true,"kind":"array","preview":"Array(2)","path":["payload",14,"labels"],"size":2},"estimate":2,"createdAt":"2025-08-21T07:57:38.000Z","updatedAt":"2025-09-23T07:57:38.000Z","completedAt":null,"commentCount":4},{"id":"iss-16","key":"CORE-16","projectKey":"CORE","title":"Add GDPR export","description":"Reported by the frontend team. Pushed a draft branch, would appreciate a second pair of eyes.","status":"done","priority":"medium","assigneeId":"u-8","reporterId":"u-8","labels":{"__genie_dehydrated__":true,"kind":"array","preview":"Array(0)","path":["payload",15,"labels"],"size":0},"estimate":3,"createdAt":"2025-05-30T16:37:39.000Z","updatedAt":"2025-06-22T16:37:39.000Z","completedAt":"2025-06-22T16:37:39.000Z","commentCount":5},{"id":"iss-17","key":"CORE-17","projectKey":"CORE","title":"Fix avatar upload","description":"Reported by the backend team. Added logs, waiting for the next occurrence.","status":"in_review","priority":"medium","assigneeId":"u-26","reporterId":"u-33","labels":{"__genie_dehydrated__":true,"kind":"array","preview":"Array(0)","path":["payload",16,"labels"],"size":0},"estimate":8,"createdAt":"2025-03-04T05:27:14.000Z","updatedAt":"2025-04-26T05:27:14.000Z","completedAt":null,"commentCount":5},{"id":"iss-18","key":"CORE-18","projectKey":"CORE","title":"Refactor audit log pagination","description":"Reported by the performance team. Added logs, waiting for the next occurrence.","status":"todo","priority":"medium","assigneeId":null,"reporterId":"u-19","labels":{"__genie_dehydrated__":true,"kind":"array","preview":"Array(0)","path":["payload",17,"labels"],"size":0},"estimate":3,"createdAt":"2025-02-06T08:13:19.000Z","updatedAt":"2025-02-14T08:13:19.000Z","completedAt":null,"commentCount":1},{"id":"iss-19","key":"CORE-19","projectKey":"CORE","title":"Document rate limiter headers","description":"Reported by the frontend team. Verified on mobile Safari and Chrome.","status":"backlog","priority":"high","assigneeId":"u-18","reporterId":"u-22","labels":{"__genie_dehydrated__":true,"kind":"array","preview":"Array(2)","path":["payload",18,"labels"],"size":2},"estimate":null,"createdAt":"2025-11-28T05:01:50.000Z","updatedAt":"2026-01-08T05:01:50.000Z","completedAt":null,"commentCount":6},{"id":"iss-20","key":"CORE-20","projectKey":"CORE","title":"Migrate report scheduler","description":"Reported by the backend team. This regressed after the last release, bisecting now.","status":"todo","priority":"high","assigneeId":"u-36","reporterId":"u-19","labels":{"__genie_dehydrated__":true,"kind":"array","preview":"Array(0)","path":["payload",19,"labels"],"size":0},"estimate":2,"createdAt":"2025-06-22T00:19:23.000Z","updatedAt":"2025-07-19T00:19:23.000Z","completedAt":null,"commentCount":0},{"id":"iss-21","key":"CORE-21","projectKey":"CORE","title":"Investigate database connection pool","description":"Reported by the frontend team. Moved to the next sprint, blocked on the API change.","status":"in_review","priority":"low","assigneeId":"u-13","reporterId":"u-26","labels":{"__genie_dehydrated__":true,"kind":"array","preview":"Array(2)","path":["payload",20,"labels"],"size":2},"estimate":3,"createdAt":"2025-11-22T06:36:42.000Z","updatedAt":"2026-01-18T06:36:42.000Z","completedAt":null,"commentCount":5},{"id":"iss-22","key":"CORE-22","projectKey":"CORE","title":"Remove SSO metadata refresh","description":"Reported by the infra team. Pushed a draft branch, would appreciate a second pair of eyes.","status":"todo","priority":"low","assigneeId":"u-20","reporterId":"u-25","labels":{"__genie_dehydrated__":true,"kind":"array","preview":"Array(2)","path":["payload",21,"labels"],"size":2},"estimate":8,"createdAt":"2025-08-31T19:56:23.000Z","updatedAt":"2025-10-08T19:56:23.000Z","completedAt":null,"commentCount":4},{"id":"iss-23","key":"CORE-23","projectKey":"CORE","title":"Add rate limiter headers","description":"Reported by the infra team. I can reproduce this on staging with a fresh account.","status":"todo","priority":"high","assigneeId":"u-22","reporterId":"u-6","labels":{"__genie_dehydrated__":true,"kind":"array","preview":"Array(2)","path":["payload",22,"labels"],"size":2},"estimate":3,"createdAt":"2025-03-20T14:05:06.000Z","updatedAt":"2025-04-20T14:05:06.000Z","completedAt":null,"commentCount":5},{"id":"iss-24","key":"CORE-24","projectKey":"CORE","title":"Migrate API key rotation","description":"Reported by the security team. The fix is behind the new flag, rolling out to 10%.","status":"in_progress","priority":"high","assigneeId":"u-15","reporterId":"u-6","labels":{"__genie_dehydrated__":true,"kind":"array","preview":"Array(1)","path":["payload",23,"labels"],"size":1},"estimate":null,"createdAt":"2025-05-01T19:51:55.000Z","updatedAt":"2025-05-08T19:51:55.000Z","completedAt":null,"commentCount":2},{"id":"iss-25","key":"CORE-25","projectKey":"CORE","title":"Add webhook retries","description":"Reported by the backend team. Customer success says three accounts are affected.","status":"in_progress","priority":"low","assigneeId":null,"reporterId":"u-18","labels":{"__genie_dehydrated__":true,"kind":"array","preview":"Array(0)","path":["payload",24,"labels"],"size":0},"estimate":5,"createdAt":"2025-09-13T11:03:45.000Z","updatedAt":"2025-09-24T11:03:45.000Z","completedAt":null,"commentCount":6},{"__genie_dehydrated__":true,"kind":"truncated","preview":"+3215 more items","path":["payload"],"size":3240}],"meta":{"requestId":"m2VY5L5l3avGX-R9OE0-7","requestStatus":"fulfilled"}},"renderEventIds":[],"reactWorkActive":false,"genieMs":0.3},{"sequence":1357,"actionId":"redux-store:1/action:1357","kind":"action","type":"issues/fetchAll/fulfilled","label":"issues/fetchAll/fulfilled","parentActionId":"redux-store:1/action:24","at":1795078564309,"durationMs":5.7,"outcome":"returned","error":null,"rootStateChanged":true,"changedSlices":["issues"],"changedSlicesTruncated":false,"unrecordedNestedDispatches":0,"mutation":{"status":"none-detected","notScannedReason":null,"findings":[],"findingsOmitted":false,"objectsCompared":4,"scanTruncated":true},"payload":{"type":"issues/fetchAll/fulfilled","payload":[{"id":"iss-1","key":"CORE-1","projectKey":"CORE","title":"Migrate push notification opt-out","description":"Reported by the docs team. This regressed after the last release, bisecting now.","status":"backlog","priority":"urgent","assigneeId":"u-18","reporterId":"u-19","labels":{"__genie_dehydrated__":true,"kind":"array","preview":"Array(2)","path":["payload",0,"labels"],"size":2},"estimate":3,"createdAt":"2026-01-31T19:49:51.000Z","updatedAt":"2026-03-02T09:00:00.000Z","completedAt":null,"commentCount":5},{"id":"iss-2","key":"CORE-2","projectKey":"CORE","title":"Add dashboard filters","description":"Reported by the frontend team. Added logs, waiting for the next occurrence.","status":"in_progress","priority":"high","assigneeId":"u-33","reporterId":"u-15","labels":{"__genie_dehydrated__":true,"kind":"array","preview":"Array(1)","path":["payload",1,"labels"],"size":1},"estimate":3,"createdAt":"2025-03-25T20:57:13.000Z","updatedAt":"2025-03-27T20:57:13.000Z","completedAt":null,"commentCount":0},{"id":"iss-3","key":"CORE-3","projectKey":"CORE","title":"Remove CSV import validation","description":"Reported by the security team. Moved to the next sprint, blocked on the API change.","status":"todo","priority":"low","assigneeId":"u-27","reporterId":"u-27","labels":{"__genie_dehydrated__":true,"kind":"array","preview":"Array(1)","path":["payload",2,"labels"],"size":1},"estimate":null,"createdAt":"2025-10-14T00:51:43.000Z","updatedAt":"2025-11-07T00:51:43.000Z","completedAt":null,"commentCount":0},{"id":"iss-4","key":"CORE-4","projectKey":"CORE","title":"Speed up billing email template","description":"Reported by the frontend team. Design signed off on the copy changes.","status":"done","priority":"high","assigneeId":"u-4","reporterId":"u-11","labels":{"__genie_dehydrated__":true,"kind":"array","preview":"Array(0)","path":["payload",3,"labels"],"size":0},"estimate":8,"createdAt":"2025-02-03T00:33:13.000Z","updatedAt":"2025-02-27T00:33:13.000Z","completedAt":"2025-02-27T00:33:13.000Z","commentCount":2},{"id":"iss-5","key":"CORE-5","projectKey":"CORE","title":"Migrate session timeout warning","description":"Reported by the design team. Pushed a draft branch, would appreciate a second pair of eyes.","status":"done","priority":"medium","assigneeId":"u-21","reporterId":"u-23","labels":{"__genie_dehydrated__":true,"kind":"array","preview":"Array(2)","path":["payload",4,"labels"],"size":2},"estimate":3,"createdAt":"2025-08-01T02:59:14.000Z","updatedAt":"2025-08-18T02:59:14.000Z","completedAt":"2025-08-18T02:59:14.000Z","commentCount":5},{"id":"iss-6","key":"CORE-6","projectKey":"CORE","title":"Document API key rotation","description":"Reported by the backend team. Added logs, waiting for the next occurrence.","status":"in_progress","priority":"medium","assigneeId":"u-25","reporterId":"u-1","labels":{"__genie_dehydrated__":true,"kind":"array","preview":"Array(0)","path":["payload",5,"labels"],"size":0},"estimate":5,"createdAt":"2025-06-28T02:44:25.000Z","updatedAt":"2025-07-10T02:44:25.000Z","completedAt":null,"commentCount":1},{"id":"iss-7","key":"CORE-7","projectKey":"CORE","title":"Investigate login redirect loop","description":"Reported by the frontend team. Customer success says three accounts are affected.","status":"done","priority":"medium","assigneeId":"u-15","reporterId":"u-32","labels":{"__genie_dehydrated__":true,"kind":"array","preview":"Array(0)","path":["payload",6,"labels"],"size":0},"estimate":8,"createdAt":"2025-02-03T23:16:14.000Z","updatedAt":"2025-02-05T23:16:14.000Z","completedAt":"2025-02-05T23:16:14.000Z","commentCount":1},{"id":"iss-8","key":"CORE-8","projectKey":"CORE","title":"Refactor report scheduler","description":"Reported by the backend team. Customer success says three accounts are affected.","status":"done","priority":"high","assigneeId":"u-13","reporterId":"u-25","labels":{"__genie_dehydrated__":true,"kind":"array","preview":"Array(2)","path":["payload",7,"labels"],"size":2},"estimate":2,"createdAt":"2025-07-19T07:53:55.000Z","updatedAt":"2025-07-22T07:53:55.000Z","completedAt":"2025-07-22T07:53:55.000Z","commentCount":6},{"id":"iss-9","key":"CORE-9","projectKey":"CORE","title":"Remove search ranking","description":"Reported by the infra team. Verified on mobile Safari and Chrome.","status":"in_progress","priority":"medium","assigneeId":"u-7","reporterId":"u-26","labels":{"__genie_dehydrated__":true,"kind":"array","preview":"Array(0)","path":["payload",8,"labels"],"size":0},"estimate":5,"createdAt":"2025-12-19T23:19:55.000Z","updatedAt":"2026-01-11T23:19:55.000Z","completedAt":null,"commentCount":6},{"id":"iss-10","key":"CORE-10","projectKey":"CORE","title":"Document error page copy","description":"Reported by the security team. Added logs, waiting for the next occurrence.","status":"backlog","priority":"high","assigneeId":"u-23","reporterId":"u-1","labels":{"__genie_dehydrated__":true,"kind":"array","preview":"Array(2)","path":["payload",9,"labels"],"size":2},"estimate":3,"createdAt":"2025-06-11T13:14:51.000Z","updatedAt":"2025-08-04T13:14:51.000Z","completedAt":null,"commentCount":5},{"id":"iss-11","key":"CORE-11","projectKey":"CORE","title":"Refactor GDPR export","description":"Reported by the infra team. The fix is behind the new flag, rolling out to 10%.","status":"done","priority":"medium","assigneeId":"u-24","reporterId":"u-30","labels":{"__genie_dehydrated__":true,"kind":"array","preview":"Array(1)","path":["payload",10,"labels"],"size":1},"estimate":8,"createdAt":"2025-11-22T17:31:02.000Z","updatedAt":"2025-11-27T17:31:02.000Z","completedAt":"2025-11-27T17:31:02.000Z","commentCount":5},{"id":"iss-12","key":"CORE-12","projectKey":"CORE","title":"Document audit log pagination","description":"Reported by the backend team. Design signed off on the copy changes.","status":"done","priority":"urgent","assigneeId":"u-31","reporterId":"u-23","labels":{"__genie_dehydrated__":true,"kind":"array","preview":"Array(0)","path":["payload",11,"labels"],"size":0},"estimate":2,"createdAt":"2026-02-27T07:10:24.000Z","updatedAt":"2026-03-01T09:00:00.000Z","completedAt":"2026-03-01T09:00:00.000Z","commentCount":4},{"id":"iss-13","key":"CORE-13","projectKey":"CORE","title":"Speed up GDPR export","description":"Reported by the performance team. The fix is behind the new flag, rolling out to 10%.","status":"todo","priority":"medium","assigneeId":"u-3","reporterId":"u-3","labels":{"__genie_dehydrated__":true,"kind":"array","preview":"Array(0)","path":["payload",12,"labels"],"size":0},"estimate":5,"createdAt":"2025-03-21T10:39:41.000Z","updatedAt":"2025-04-10T10:39:41.000Z","completedAt":null,"commentCount":3},{"id":"iss-14","key":"CORE-14","projectKey":"CORE","title":"Remove audit log pagination","description":"Reported by the frontend team. Moved to the next sprint, blocked on the API change.","status":"done","priority":"low","assigneeId":null,"reporterId":"u-12","labels":{"__genie_dehydrated__":true,"kind":"array","preview":"Array(1)","path":["payload",13,"labels"],"size":1},"estimate":2,"createdAt":"2025-09-13T23:38:34.000Z","updatedAt":"2025-09-21T23:38:34.000Z","completedAt":"2025-09-21T23:38:34.000Z","commentCount":1},{"id":"iss-15","key":"CORE-15","projectKey":"CORE","title":"Add SSO metadata refresh","description":"Reported by the backend team. Added logs, waiting for the next occurrence.","status":"todo","priority":"medium","assigneeId":"u-3","reporterId":"u-5","labels":{"__genie_dehydrated__":true,"kind":"array","preview":"Array(2)","path":["payload",14,"labels"],"size":2},"estimate":2,"createdAt":"2025-08-21T07:57:38.000Z","updatedAt":"2025-09-23T07:57:38.000Z","completedAt":null,"commentCount":4},{"id":"iss-16","key":"CORE-16","projectKey":"CORE","title":"Add GDPR export","description":"Reported by the frontend team. Pushed a draft branch, would appreciate a second pair of eyes.","status":"done","priority":"medium","assigneeId":"u-8","reporterId":"u-8","labels":{"__genie_dehydrated__":true,"kind":"array","preview":"Array(0)","path":["payload",15,"labels"],"size":0},"estimate":3,"createdAt":"2025-05-30T16:37:39.000Z","updatedAt":"2025-06-22T16:37:39.000Z","completedAt":"2025-06-22T16:37:39.000Z","commentCount":5},{"id":"iss-17","key":"CORE-17","projectKey":"CORE","title":"Fix avatar upload","description":"Reported by the backend team. Added logs, waiting for the next occurrence.","status":"in_review","priority":"medium","assigneeId":"u-26","reporterId":"u-33","labels":{"__genie_dehydrated__":true,"kind":"array","preview":"Array(0)","path":["payload",16,"labels"],"size":0},"estimate":8,"createdAt":"2025-03-04T05:27:14.000Z","updatedAt":"2025-04-26T05:27:14.000Z","completedAt":null,"commentCount":5},{"id":"iss-18","key":"CORE-18","projectKey":"CORE","title":"Refactor audit log pagination","description":"Reported by the performance team. Added logs, waiting for the next occurrence.","status":"todo","priority":"medium","assigneeId":null,"reporterId":"u-19","labels":{"__genie_dehydrated__":true,"kind":"array","preview":"Array(0)","path":["payload",17,"labels"],"size":0},"estimate":3,"createdAt":"2025-02-06T08:13:19.000Z","updatedAt":"2025-02-14T08:13:19.000Z","completedAt":null,"commentCount":1},{"id":"iss-19","key":"CORE-19","projectKey":"CORE","title":"Document rate limiter headers","description":"Reported by the frontend team. Verified on mobile Safari and Chrome.","status":"backlog","priority":"high","assigneeId":"u-18","reporterId":"u-22","labels":{"__genie_dehydrated__":true,"kind":"array","preview":"Array(2)","path":["payload",18,"labels"],"size":2},"estimate":null,"createdAt":"2025-11-28T05:01:50.000Z","updatedAt":"2026-01-08T05:01:50.000Z","completedAt":null,"commentCount":6},{"id":"iss-20","key":"CORE-20","projectKey":"CORE","title":"Migrate report scheduler","description":"Reported by the backend team. This regressed after the last release, bisecting now.","status":"todo","priority":"high","assigneeId":"u-36","reporterId":"u-19","labels":{"__genie_dehydrated__":true,"kind":"array","preview":"Array(0)","path":["payload",19,"labels"],"size":0},"estimate":2,"createdAt":"2025-06-22T00:19:23.000Z","updatedAt":"2025-07-19T00:19:23.000Z","completedAt":null,"commentCount":0},{"id":"iss-21","key":"CORE-21","projectKey":"CORE","title":"Investigate database connection pool","description":"Reported by the frontend team. Moved to the next sprint, blocked on the API change.","status":"in_review","priority":"low","assigneeId":"u-13","reporterId":"u-26","labels":{"__genie_dehydrated__":true,"kind":"array","preview":"Array(2)","path":["payload",20,"labels"],"size":2},"estimate":3,"createdAt":"2025-11-22T06:36:42.000Z","updatedAt":"2026-01-18T06:36:42.000Z","completedAt":null,"commentCount":5},{"id":"iss-22","key":"CORE-22","projectKey":"CORE","title":"Remove SSO metadata refresh","description":"Reported by the infra team. Pushed a draft branch, would appreciate a second pair of eyes.","status":"todo","priority":"low","assigneeId":"u-20","reporterId":"u-25","labels":{"__genie_dehydrated__":true,"kind":"array","preview":"Array(2)","path":["payload",21,"labels"],"size":2},"estimate":8,"createdAt":"2025-08-31T19:56:23.000Z","updatedAt":"2025-10-08T19:56:23.000Z","completedAt":null,"commentCount":4},{"id":"iss-23","key":"CORE-23","projectKey":"CORE","title":"Add rate limiter headers","description":"Reported by the infra team. I can reproduce this on staging with a fresh account.","status":"todo","priority":"high","assigneeId":"u-22","reporterId":"u-6","labels":{"__genie_dehydrated__":true,"kind":"array","preview":"Array(2)","path":["payload",22,"labels"],"size":2},"estimate":3,"createdAt":"2025-03-20T14:05:06.000Z","updatedAt":"2025-04-20T14:05:06.000Z","completedAt":null,"commentCount":5},{"id":"iss-24","key":"CORE-24","projectKey":"CORE","title":"Migrate API key rotation","description":"Reported by the security team. The fix is behind the new flag, rolling out to 10%.","status":"in_progress","priority":"high","assigneeId":"u-15","reporterId":"u-6","labels":{"__genie_dehydrated__":true,"kind":"array","preview":"Array(1)","path":["payload",23,"labels"],"size":1},"estimate":null,"createdAt":"2025-05-01T19:51:55.000Z","updatedAt":"2025-05-08T19:51:55.000Z","completedAt":null,"commentCount":2},{"id":"iss-25","key":"CORE-25","projectKey":"CORE","title":"Add webhook retries","description":"Reported by the backend team. Customer success says three accounts are affected.","status":"in_progress","priority":"low","assigneeId":null,"reporterId":"u-18","labels":{"__genie_dehydrated__":true,"kind":"array","preview":"Array(0)","path":["payload",24,"labels"],"size":0},"estimate":5,"createdAt":"2025-09-13T11:03:45.000Z","updatedAt":"2025-09-24T11:03:45.000Z","completedAt":null,"commentCount":6},{"__genie_dehydrated__":true,"kind":"truncated","preview":"+3215 more items","path":["payload"],"size":3240}],"meta":{"requestId":"-bJJYx3iOp86Ounxan41d","requestStatus":"fulfilled"}},"renderEventIds":[],"reactWorkActive":false,"genieMs":0.4},{"sequence":1960,"actionId":"redux-store:1/action:1960","kind":"action","type":"issues/filtersChanged","label":"issues/filtersChanged","parentActionId":null,"at":1795078564566,"durationMs":1.4,"outcome":"returned","error":null,"rootStateChanged":true,"changedSlices":["issues"],"changedSlicesTruncated":false,"unrecordedNestedDispatches":0,"mutation":{"status":"none-detected","notScannedReason":null,"findings":[],"findingsOmitted":false,"objectsCompared":4,"scanTruncated":true},"payload":{"type":"issues/filtersChanged","payload":{"text":"c"}},"renderEventIds":["render:17:2","render:17:7","render:17:30","render:17:33","render:17:37"],"reactWorkActive":false,"genieMs":0.2},{"sequence":2544,"actionId":"redux-store:1/action:2544","kind":"action","type":"issues/filtersChanged","label":"issues/filtersChanged","parentActionId":null,"at":1795078564622,"durationMs":0.6,"outcome":"returned","error":null,"rootStateChanged":true,"changedSlices":["issues"],"changedSlicesTruncated":false,"unrecordedNestedDispatches":0,"mutation":{"status":"none-detected","notScannedReason":null,"findings":[],"findingsOmitted":false,"objectsCompared":4,"scanTruncated":true},"payload":{"type":"issues/filtersChanged","payload":{"text":"ca"}},"renderEventIds":["render:19:1882","render:19:1887","render:19:1917"],"reactWorkActive":false,"genieMs":0.3},{"sequence":3464,"actionId":"redux-store:1/action:3464","kind":"action","type":"issues/filtersChanged","label":"issues/filtersChanged","parentActionId":null,"at":1795078564684,"durationMs":0.7,"outcome":"returned","error":null,"rootStateChanged":true,"changedSlices":["issues"],"changedSlicesTruncated":false,"unrecordedNestedDispatches":0,"mutation":{"status":"none-detected","notScannedReason":null,"findings":[],"findingsOmitted":false,"objectsCompared":4,"scanTruncated":true},"payload":{"type":"issues/filtersChanged","payload":{"text":"cac"}},"renderEventIds":["render:21:4154","render:21:4159","render:21:4189"],"reactWorkActive":false,"genieMs":0.2},{"sequence":4060,"actionId":"redux-store:1/action:4060","kind":"action","type":"issues/filtersChanged","label":"issues/filtersChanged","parentActionId":null,"at":1795078564733,"durationMs":0.7,"outcome":"returned","error":null,"rootStateChanged":true,"changedSlices":["issues"],"changedSlicesTruncated":false,"unrecordedNestedDispatches":0,"mutation":{"status":"none-detected","notScannedReason":null,"findings":[],"findingsOmitted":false,"objectsCompared":4,"scanTruncated":true},"payload":{"type":"issues/filtersChanged","payload":{"text":"cach"}},"renderEventIds":["render:23:6048","render:23:6053","render:23:6082"],"reactWorkActive":false,"genieMs":0.2},{"sequence":4263,"actionId":"redux-store:1/action:4263","kind":"action","type":"issues/filtersChanged","label":"issues/filtersChanged","parentActionId":null,"at":1795078564755,"durationMs":0.6,"outcome":"returned","error":null,"rootStateChanged":true,"changedSlices":["issues"],"changedSlicesTruncated":false,"unrecordedNestedDispatches":0,"mutation":{"status":"none-detected","notScannedReason":null,"findings":[],"findingsOmitted":false,"objectsCompared":4,"scanTruncated":true},"payload":{"type":"issues/filtersChanged","payload":{"text":"cache"}},"renderEventIds":["render:24:6887","render:24:6892","render:24:6915","render:24:6918","render:24:6922"],"reactWorkActive":false,"genieMs":0.3}],"matched":9,"omittedBefore":0,"more":false,"nextAfterSequence":4263,"latestSequence":4978,"coverage":{"historyLimit":500,"evictedRecords":0,"unrecordedChanges":0,"mutationDetection":true,"libraryActions":{"recorded":false,"counted":4949,"byType":[{"kind":"action","type":"service/subscriptions/internal_probeSubscription","count":2627},{"kind":"thunk","type":null,"count":1208},{"kind":"action","type":"service/executeQuery/rejected","count":602},{"kind":"action","type":"service/subscriptions/unsubscribeQueryResult","count":502},{"kind":"unrecorded-change","type":null,"count":6},{"kind":"action","type":"service/executeQuery/pending","count":2},{"kind":"action","type":"service/executeQuery/fulfilled","count":2}],"otherTypesCount":0}}},"session":{"sessionId":"954d8289-a965-44f7-9a1e-fb29bac18e39","logicalSessionId":"a07593a5-db3c-4fae-a8d8-4c337dd757ea"}}]

```

`/tmp/upd-d/chain-filter2.json`:

```json
[{"schemaVersion":"2.0","tool":"react_render_causes","ok":true,"status":"ok","result":{"componentMatch":{"component":"AccountMenu","exact":true,"status":"matched","matchedNames":["AccountMenu"],"matchedNameCount":1,"similarNames":[]},"tracking":true,"commits":10,"documentCommitId":27,"observation":{"id":"observation:1","epoch":1,"startedAfterDocumentCommitId":17},"attribution":{"status":"current","startedAtDocumentCommitId":27,"completedAtDocumentCommitId":27,"startedAtAnalysisGeneration":28,"completedAtAnalysisGeneration":28},"view":"full","events":[{"renderEventId":"render:26:7913","observationId":"observation:1","commitId":9,"documentCommitId":26,"componentId":7467673059518,"componentName":"AccountMenu","instance":{"fiberId":7467673059518,"mountId":"mount:151","key":null,"siblingIndex":3,"parent":{"fiberId":7467673059509,"name":"TopBar","key":null},"keyedParent":null,"logicalPath":"AppErrorBoundary[index=0] > Provider[index=0] > BrowserRouter[index=0] > Router[index=0] > ThemeProvider[index=0] > App[index=0] > Routes[index=0] > RenderedRoute[index=0] > RequireAuth[index=0] > Connect(AppShell)[index=0] > AppShell[index=0] > FeatureFlagsProvider[index=0] > <div>[index=0] > TopBar[index=0] > <header>[index=0] > <div>[index=3] > AccountMenu[index=3]","logicalIdentityEvidence":"positional","mountGeneration":1,"mountGenerationEvidence":"exact","hostSelector":null},"causes":[{"kind":"external-store","evidence":"inferred","reason":"external-store-snapshot-changed","hookIndex":4,"externalStoreIndex":0,"subscriberId":"subscriber:mount:151:0","selectionEqual":false,"subscriptionFired":true,"before":{"user":{"id":"u-1","name":"Dana Whitfield","email":"dana@acme.test","title":"Designer","team":"Infra"},"savedViewCount":0},"after":{"user":{"id":"u-1","name":"Dana Whitfield","email":"dana@acme.test","title":"Designer","team":"Infra"},"savedViewCount":0},"changedFields":[],"deepDiff":{"changes":[{"kind":"reference-only","path":""}],"visited":3,"truncated":false},"storeId":"external-store:1","storeLabel":"anonymous-external-store","selector":null,"equality":"object-is","fanout":null,"notificationId":null,"competingCandidates":["external-store-snapshot-identity-changed"],"redux":{"storeId":"redux-store:1","link":"subscription","evidence":"inferred","reason":"unrecorded-state-change","actions":[{"actionId":"redux-store:1/action:5178","sequence":5178,"kind":"unrecorded-change","type":null,"changedSlices":["service"]}],"omittedActions":0},"hookProvenance":{"status":"unavailable","evidence":"unknown","reason":"shadow-render-disabled"}}],"necessity":"unnecessary","necessityReason":"inputs-unchanged","assessment":{"inputEvidence":"none-observed","observedInputKinds":[],"behaviorEvidence":{"subtreeHostMutations":{"status":"none-observed","count":0,"pendingSubtrees":0,"omittedByLimit":0,"callbackOnlyUpdates":0,"writes":[],"callbacks":[]},"scheduledEffects":{"status":"observed","count":2},"subtreeScheduledEffects":{"status":"observed","count":2},"unobservedDomains":["focus","url","network","transition","freshness","effect-execution"]},"optimizationSafety":"not-proven-safe","requiredValidation":["dom","aria","focus","url","network","transition"]},"inputCoverage":{"complete":true,"omittedInputs":0,"scanTruncated":false,"propsNotEnumerated":false},"source":{"file":"~/.t3/worktrees/genie-react/t3-9e64af67-f21cc60f9d8a6648/apps/realworld-legacy/src/layout/top-bar.tsx","line":32,"column":9,"functionName":null,"sourceMapConfidence":"served","role":"element-callsite"},"sourceAttribution":{"role":"usage-or-definition-fallback","evidence":"inferred"},"sourceOwnership":"app","isLibrary":false}],"omittedByLimit":0,"sourceClassification":{"complete":true,"affects":"result","totalCandidates":1,"evaluated":1,"app":1,"library":0,"unknown":0,"unknownComponents":[],"unknownComponentsOmitted":0},"renderEventRetention":{"evictedEvents":3674,"earliestDocumentCommitId":25,"latestDocumentCommitId":27},"coverage":{"skippedCommitFibers":0,"droppedUnmountFibers":0,"analysisFailedFibers":0,"pausedCommits":0,"unobservedCommits":0,"refreshCommitsExcluded":0,"truncatedInputFibers":5,"propsNotEnumeratedFibers":0,"budgetExhaustedCommits":0,"budgetExhaustedSubsystems":[],"incompleteBecause":[{"reason":"inputs-truncated","fibers":5,"components":["IssueTableToolbar"],"detail":"An input held values Genie compares only in part, such as functions, class instances or objects past the inspected depth; read deepDiff.truncated on these components."}],"complete":false,"inputAttributionComplete":false,"semantics":"lower-bound","coverageDomain":"render-causality","droppedRenderEvents":3674}},"session":{"sessionId":"28cdc622-79b7-4d9e-85c0-db32cb2ff919","logicalSessionId":"a07593a5-db3c-4fae-a8d8-4c337dd757ea"}},{"schemaVersion":"2.0","tool":"redux_actions","ok":true,"status":"ok","result":{"store":{"storeId":"redux-store:1","name":"app"},"records":[{"sequence":13,"actionId":"redux-store:1/action:13","kind":"action","type":"issues/fetchAll/pending","label":"issues/fetchAll/pending","parentActionId":"redux-store:1/action:12","at":1795078592026,"durationMs":0,"outcome":"returned","error":null,"rootStateChanged":true,"changedSlices":["issues"],"changedSlicesTruncated":false,"unrecordedNestedDispatches":0,"mutation":{"status":"none-detected","notScannedReason":null,"findings":[],"findingsOmitted":false,"objectsCompared":4,"scanTruncated":false},"payload":{"type":"issues/fetchAll/pending","meta":{"requestId":"I8IQ3U1ozadGIw242vDHP","requestStatus":"pending"}},"renderEventIds":[],"reactWorkActive":true,"genieMs":0.1},{"sequence":25,"actionId":"redux-store:1/action:25","kind":"action","type":"issues/fetchAll/pending","label":"issues/fetchAll/pending","parentActionId":"redux-store:1/action:24","at":1795078592027,"durationMs":0,"outcome":"returned","error":null,"rootStateChanged":false,"changedSlices":[],"changedSlicesTruncated":false,"unrecordedNestedDispatches":0,"mutation":{"status":"none-detected","notScannedReason":null,"findings":[],"findingsOmitted":false,"objectsCompared":4,"scanTruncated":false},"payload":{"type":"issues/fetchAll/pending","meta":{"requestId":"p9wO6fpnlrsyCi5eTJ4YY","requestStatus":"pending"}},"renderEventIds":[],"reactWorkActive":true,"genieMs":0},{"sequence":38,"actionId":"redux-store:1/action:38","kind":"action","type":"issues/fetchAll/fulfilled","label":"issues/fetchAll/fulfilled","parentActionId":"redux-store:1/action:12","at":1795078592093,"durationMs":7.2,"outcome":"returned","error":null,"rootStateChanged":true,"changedSlices":["issues"],"changedSlicesTruncated":false,"unrecordedNestedDispatches":0,"mutation":{"status":"none-detected","notScannedReason":null,"findings":[],"findingsOmitted":false,"objectsCompared":4,"scanTruncated":false},"payload":{"type":"issues/fetchAll/fulfilled","payload":[{"id":"iss-1","key":"CORE-1","projectKey":"CORE","title":"Migrate push notification opt-out","description":"Reported by the docs team. This regressed after the last release, bisecting now.","status":"backlog","priority":"urgent","assigneeId":"u-18","reporterId":"u-19","labels":{"__genie_dehydrated__":true,"kind":"array","preview":"Array(2)","path":["payload",0,"labels"],"size":2},"estimate":3,"createdAt":"2026-01-31T19:49:51.000Z","updatedAt":"2026-03-02T09:00:00.000Z","completedAt":null,"commentCount":5},{"id":"iss-2","key":"CORE-2","projectKey":"CORE","title":"Add dashboard filters","description":"Reported by the frontend team. Added logs, waiting for the next occurrence.","status":"in_progress","priority":"high","assigneeId":"u-33","reporterId":"u-15","labels":{"__genie_dehydrated__":true,"kind":"array","preview":"Array(1)","path":["payload",1,"labels"],"size":1},"estimate":3,"createdAt":"2025-03-25T20:57:13.000Z","updatedAt":"2025-03-27T20:57:13.000Z","completedAt":null,"commentCount":0},{"id":"iss-3","key":"CORE-3","projectKey":"CORE","title":"Remove CSV import validation","description":"Reported by the security team. Moved to the next sprint, blocked on the API change.","status":"todo","priority":"low","assigneeId":"u-27","reporterId":"u-27","labels":{"__genie_dehydrated__":true,"kind":"array","preview":"Array(1)","path":["payload",2,"labels"],"size":1},"estimate":null,"createdAt":"2025-10-14T00:51:43.000Z","updatedAt":"2025-11-07T00:51:43.000Z","completedAt":null,"commentCount":0},{"id":"iss-4","key":"CORE-4","projectKey":"CORE","title":"Speed up billing email template","description":"Reported by the frontend team. Design signed off on the copy changes.","status":"done","priority":"high","assigneeId":"u-4","reporterId":"u-11","labels":{"__genie_dehydrated__":true,"kind":"array","preview":"Array(0)","path":["payload",3,"labels"],"size":0},"estimate":8,"createdAt":"2025-02-03T00:33:13.000Z","updatedAt":"2025-02-27T00:33:13.000Z","completedAt":"2025-02-27T00:33:13.000Z","commentCount":2},{"id":"iss-5","key":"CORE-5","projectKey":"CORE","title":"Migrate session timeout warning","description":"Reported by the design team. Pushed a draft branch, would appreciate a second pair of eyes.","status":"done","priority":"medium","assigneeId":"u-21","reporterId":"u-23","labels":{"__genie_dehydrated__":true,"kind":"array","preview":"Array(2)","path":["payload",4,"labels"],"size":2},"estimate":3,"createdAt":"2025-08-01T02:59:14.000Z","updatedAt":"2025-08-18T02:59:14.000Z","completedAt":"2025-08-18T02:59:14.000Z","commentCount":5},{"id":"iss-6","key":"CORE-6","projectKey":"CORE","title":"Document API key rotation","description":"Reported by the backend team. Added logs, waiting for the next occurrence.","status":"in_progress","priority":"medium","assigneeId":"u-25","reporterId":"u-1","labels":{"__genie_dehydrated__":true,"kind":"array","preview":"Array(0)","path":["payload",5,"labels"],"size":0},"estimate":5,"createdAt":"2025-06-28T02:44:25.000Z","updatedAt":"2025-07-10T02:44:25.000Z","completedAt":null,"commentCount":1},{"id":"iss-7","key":"CORE-7","projectKey":"CORE","title":"Investigate login redirect loop","description":"Reported by the frontend team. Customer success says three accounts are affected.","status":"done","priority":"medium","assigneeId":"u-15","reporterId":"u-32","labels":{"__genie_dehydrated__":true,"kind":"array","preview":"Array(0)","path":["payload",6,"labels"],"size":0},"estimate":8,"createdAt":"2025-02-03T23:16:14.000Z","updatedAt":"2025-02-05T23:16:14.000Z","completedAt":"2025-02-05T23:16:14.000Z","commentCount":1},{"id":"iss-8","key":"CORE-8","projectKey":"CORE","title":"Refactor report scheduler","description":"Reported by the backend team. Customer success says three accounts are affected.","status":"done","priority":"high","assigneeId":"u-13","reporterId":"u-25","labels":{"__genie_dehydrated__":true,"kind":"array","preview":"Array(2)","path":["payload",7,"labels"],"size":2},"estimate":2,"createdAt":"2025-07-19T07:53:55.000Z","updatedAt":"2025-07-22T07:53:55.000Z","completedAt":"2025-07-22T07:53:55.000Z","commentCount":6},{"id":"iss-9","key":"CORE-9","projectKey":"CORE","title":"Remove search ranking","description":"Reported by the infra team. Verified on mobile Safari and Chrome.","status":"in_progress","priority":"medium","assigneeId":"u-7","reporterId":"u-26","labels":{"__genie_dehydrated__":true,"kind":"array","preview":"Array(0)","path":["payload",8,"labels"],"size":0},"estimate":5,"createdAt":"2025-12-19T23:19:55.000Z","updatedAt":"2026-01-11T23:19:55.000Z","completedAt":null,"commentCount":6},{"id":"iss-10","key":"CORE-10","projectKey":"CORE","title":"Document error page copy","description":"Reported by the security team. Added logs, waiting for the next occurrence.","status":"backlog","priority":"high","assigneeId":"u-23","reporterId":"u-1","labels":{"__genie_dehydrated__":true,"kind":"array","preview":"Array(2)","path":["payload",9,"labels"],"size":2},"estimate":3,"createdAt":"2025-06-11T13:14:51.000Z","updatedAt":"2025-08-04T13:14:51.000Z","completedAt":null,"commentCount":5},{"id":"iss-11","key":"CORE-11","projectKey":"CORE","title":"Refactor GDPR export","description":"Reported by the infra team. The fix is behind the new flag, rolling out to 10%.","status":"done","priority":"medium","assigneeId":"u-24","reporterId":"u-30","labels":{"__genie_dehydrated__":true,"kind":"array","preview":"Array(1)","path":["payload",10,"labels"],"size":1},"estimate":8,"createdAt":"2025-11-22T17:31:02.000Z","updatedAt":"2025-11-27T17:31:02.000Z","completedAt":"2025-11-27T17:31:02.000Z","commentCount":5},{"id":"iss-12","key":"CORE-12","projectKey":"CORE","title":"Document audit log pagination","description":"Reported by the backend team. Design signed off on the copy changes.","status":"done","priority":"urgent","assigneeId":"u-31","reporterId":"u-23","labels":{"__genie_dehydrated__":true,"kind":"array","preview":"Array(0)","path":["payload",11,"labels"],"size":0},"estimate":2,"createdAt":"2026-02-27T07:10:24.000Z","updatedAt":"2026-03-01T09:00:00.000Z","completedAt":"2026-03-01T09:00:00.000Z","commentCount":4},{"id":"iss-13","key":"CORE-13","projectKey":"CORE","title":"Speed up GDPR export","description":"Reported by the performance team. The fix is behind the new flag, rolling out to 10%.","status":"todo","priority":"medium","assigneeId":"u-3","reporterId":"u-3","labels":{"__genie_dehydrated__":true,"kind":"array","preview":"Array(0)","path":["payload",12,"labels"],"size":0},"estimate":5,"createdAt":"2025-03-21T10:39:41.000Z","updatedAt":"2025-04-10T10:39:41.000Z","completedAt":null,"commentCount":3},{"id":"iss-14","key":"CORE-14","projectKey":"CORE","title":"Remove audit log pagination","description":"Reported by the frontend team. Moved to the next sprint, blocked on the API change.","status":"done","priority":"low","assigneeId":null,"reporterId":"u-12","labels":{"__genie_dehydrated__":true,"kind":"array","preview":"Array(1)","path":["payload",13,"labels"],"size":1},"estimate":2,"createdAt":"2025-09-13T23:38:34.000Z","updatedAt":"2025-09-21T23:38:34.000Z","completedAt":"2025-09-21T23:38:34.000Z","commentCount":1},{"id":"iss-15","key":"CORE-15","projectKey":"CORE","title":"Add SSO metadata refresh","description":"Reported by the backend team. Added logs, waiting for the next occurrence.","status":"todo","priority":"medium","assigneeId":"u-3","reporterId":"u-5","labels":{"__genie_dehydrated__":true,"kind":"array","preview":"Array(2)","path":["payload",14,"labels"],"size":2},"estimate":2,"createdAt":"2025-08-21T07:57:38.000Z","updatedAt":"2025-09-23T07:57:38.000Z","completedAt":null,"commentCount":4},{"id":"iss-16","key":"CORE-16","projectKey":"CORE","title":"Add GDPR export","description":"Reported by the frontend team. Pushed a draft branch, would appreciate a second pair of eyes.","status":"done","priority":"medium","assigneeId":"u-8","reporterId":"u-8","labels":{"__genie_dehydrated__":true,"kind":"array","preview":"Array(0)","path":["payload",15,"labels"],"size":0},"estimate":3,"createdAt":"2025-05-30T16:37:39.000Z","updatedAt":"2025-06-22T16:37:39.000Z","completedAt":"2025-06-22T16:37:39.000Z","commentCount":5},{"id":"iss-17","key":"CORE-17","projectKey":"CORE","title":"Fix avatar upload","description":"Reported by the backend team. Added logs, waiting for the next occurrence.","status":"in_review","priority":"medium","assigneeId":"u-26","reporterId":"u-33","labels":{"__genie_dehydrated__":true,"kind":"array","preview":"Array(0)","path":["payload",16,"labels"],"size":0},"estimate":8,"createdAt":"2025-03-04T05:27:14.000Z","updatedAt":"2025-04-26T05:27:14.000Z","completedAt":null,"commentCount":5},{"id":"iss-18","key":"CORE-18","projectKey":"CORE","title":"Refactor audit log pagination","description":"Reported by the performance team. Added logs, waiting for the next occurrence.","status":"todo","priority":"medium","assigneeId":null,"reporterId":"u-19","labels":{"__genie_dehydrated__":true,"kind":"array","preview":"Array(0)","path":["payload",17,"labels"],"size":0},"estimate":3,"createdAt":"2025-02-06T08:13:19.000Z","updatedAt":"2025-02-14T08:13:19.000Z","completedAt":null,"commentCount":1},{"id":"iss-19","key":"CORE-19","projectKey":"CORE","title":"Document rate limiter headers","description":"Reported by the frontend team. Verified on mobile Safari and Chrome.","status":"backlog","priority":"high","assigneeId":"u-18","reporterId":"u-22","labels":{"__genie_dehydrated__":true,"kind":"array","preview":"Array(2)","path":["payload",18,"labels"],"size":2},"estimate":null,"createdAt":"2025-11-28T05:01:50.000Z","updatedAt":"2026-01-08T05:01:50.000Z","completedAt":null,"commentCount":6},{"id":"iss-20","key":"CORE-20","projectKey":"CORE","title":"Migrate report scheduler","description":"Reported by the backend team. This regressed after the last release, bisecting now.","status":"todo","priority":"high","assigneeId":"u-36","reporterId":"u-19","labels":{"__genie_dehydrated__":true,"kind":"array","preview":"Array(0)","path":["payload",19,"labels"],"size":0},"estimate":2,"createdAt":"2025-06-22T00:19:23.000Z","updatedAt":"2025-07-19T00:19:23.000Z","completedAt":null,"commentCount":0},{"id":"iss-21","key":"CORE-21","projectKey":"CORE","title":"Investigate database connection pool","description":"Reported by the frontend team. Moved to the next sprint, blocked on the API change.","status":"in_review","priority":"low","assigneeId":"u-13","reporterId":"u-26","labels":{"__genie_dehydrated__":true,"kind":"array","preview":"Array(2)","path":["payload",20,"labels"],"size":2},"estimate":3,"createdAt":"2025-11-22T06:36:42.000Z","updatedAt":"2026-01-18T06:36:42.000Z","completedAt":null,"commentCount":5},{"id":"iss-22","key":"CORE-22","projectKey":"CORE","title":"Remove SSO metadata refresh","description":"Reported by the infra team. Pushed a draft branch, would appreciate a second pair of eyes.","status":"todo","priority":"low","assigneeId":"u-20","reporterId":"u-25","labels":{"__genie_dehydrated__":true,"kind":"array","preview":"Array(2)","path":["payload",21,"labels"],"size":2},"estimate":8,"createdAt":"2025-08-31T19:56:23.000Z","updatedAt":"2025-10-08T19:56:23.000Z","completedAt":null,"commentCount":4},{"id":"iss-23","key":"CORE-23","projectKey":"CORE","title":"Add rate limiter headers","description":"Reported by the infra team. I can reproduce this on staging with a fresh account.","status":"todo","priority":"high","assigneeId":"u-22","reporterId":"u-6","labels":{"__genie_dehydrated__":true,"kind":"array","preview":"Array(2)","path":["payload",22,"labels"],"size":2},"estimate":3,"createdAt":"2025-03-20T14:05:06.000Z","updatedAt":"2025-04-20T14:05:06.000Z","completedAt":null,"commentCount":5},{"id":"iss-24","key":"CORE-24","projectKey":"CORE","title":"Migrate API key rotation","description":"Reported by the security team. The fix is behind the new flag, rolling out to 10%.","status":"in_progress","priority":"high","assigneeId":"u-15","reporterId":"u-6","labels":{"__genie_dehydrated__":true,"kind":"array","preview":"Array(1)","path":["payload",23,"labels"],"size":1},"estimate":null,"createdAt":"2025-05-01T19:51:55.000Z","updatedAt":"2025-05-08T19:51:55.000Z","completedAt":null,"commentCount":2},{"id":"iss-25","key":"CORE-25","projectKey":"CORE","title":"Add webhook retries","description":"Reported by the backend team. Customer success says three accounts are affected.","status":"in_progress","priority":"low","assigneeId":null,"reporterId":"u-18","labels":{"__genie_dehydrated__":true,"kind":"array","preview":"Array(0)","path":["payload",24,"labels"],"size":0},"estimate":5,"createdAt":"2025-09-13T11:03:45.000Z","updatedAt":"2025-09-24T11:03:45.000Z","completedAt":null,"commentCount":6},{"__genie_dehydrated__":true,"kind":"truncated","preview":"+3215 more items","path":["payload"],"size":3240}],"meta":{"requestId":"I8IQ3U1ozadGIw242vDHP","requestStatus":"fulfilled"}},"renderEventIds":[],"reactWorkActive":false,"genieMs":0.4},{"sequence":1757,"actionId":"redux-store:1/action:1757","kind":"action","type":"issues/fetchAll/fulfilled","label":"issues/fetchAll/fulfilled","parentActionId":"redux-store:1/action:24","at":1795078592196,"durationMs":7.1,"outcome":"returned","error":null,"rootStateChanged":true,"changedSlices":["issues"],"changedSlicesTruncated":false,"unrecordedNestedDispatches":0,"mutation":{"status":"none-detected","notScannedReason":null,"findings":[],"findingsOmitted":false,"objectsCompared":4,"scanTruncated":true},"payload":{"type":"issues/fetchAll/fulfilled","payload":[{"id":"iss-1","key":"CORE-1","projectKey":"CORE","title":"Migrate push notification opt-out","description":"Reported by the docs team. This regressed after the last release, bisecting now.","status":"backlog","priority":"urgent","assigneeId":"u-18","reporterId":"u-19","labels":{"__genie_dehydrated__":true,"kind":"array","preview":"Array(2)","path":["payload",0,"labels"],"size":2},"estimate":3,"createdAt":"2026-01-31T19:49:51.000Z","updatedAt":"2026-03-02T09:00:00.000Z","completedAt":null,"commentCount":5},{"id":"iss-2","key":"CORE-2","projectKey":"CORE","title":"Add dashboard filters","description":"Reported by the frontend team. Added logs, waiting for the next occurrence.","status":"in_progress","priority":"high","assigneeId":"u-33","reporterId":"u-15","labels":{"__genie_dehydrated__":true,"kind":"array","preview":"Array(1)","path":["payload",1,"labels"],"size":1},"estimate":3,"createdAt":"2025-03-25T20:57:13.000Z","updatedAt":"2025-03-27T20:57:13.000Z","completedAt":null,"commentCount":0},{"id":"iss-3","key":"CORE-3","projectKey":"CORE","title":"Remove CSV import validation","description":"Reported by the security team. Moved to the next sprint, blocked on the API change.","status":"todo","priority":"low","assigneeId":"u-27","reporterId":"u-27","labels":{"__genie_dehydrated__":true,"kind":"array","preview":"Array(1)","path":["payload",2,"labels"],"size":1},"estimate":null,"createdAt":"2025-10-14T00:51:43.000Z","updatedAt":"2025-11-07T00:51:43.000Z","completedAt":null,"commentCount":0},{"id":"iss-4","key":"CORE-4","projectKey":"CORE","title":"Speed up billing email template","description":"Reported by the frontend team. Design signed off on the copy changes.","status":"done","priority":"high","assigneeId":"u-4","reporterId":"u-11","labels":{"__genie_dehydrated__":true,"kind":"array","preview":"Array(0)","path":["payload",3,"labels"],"size":0},"estimate":8,"createdAt":"2025-02-03T00:33:13.000Z","updatedAt":"2025-02-27T00:33:13.000Z","completedAt":"2025-02-27T00:33:13.000Z","commentCount":2},{"id":"iss-5","key":"CORE-5","projectKey":"CORE","title":"Migrate session timeout warning","description":"Reported by the design team. Pushed a draft branch, would appreciate a second pair of eyes.","status":"done","priority":"medium","assigneeId":"u-21","reporterId":"u-23","labels":{"__genie_dehydrated__":true,"kind":"array","preview":"Array(2)","path":["payload",4,"labels"],"size":2},"estimate":3,"createdAt":"2025-08-01T02:59:14.000Z","updatedAt":"2025-08-18T02:59:14.000Z","completedAt":"2025-08-18T02:59:14.000Z","commentCount":5},{"id":"iss-6","key":"CORE-6","projectKey":"CORE","title":"Document API key rotation","description":"Reported by the backend team. Added logs, waiting for the next occurrence.","status":"in_progress","priority":"medium","assigneeId":"u-25","reporterId":"u-1","labels":{"__genie_dehydrated__":true,"kind":"array","preview":"Array(0)","path":["payload",5,"labels"],"size":0},"estimate":5,"createdAt":"2025-06-28T02:44:25.000Z","updatedAt":"2025-07-10T02:44:25.000Z","completedAt":null,"commentCount":1},{"id":"iss-7","key":"CORE-7","projectKey":"CORE","title":"Investigate login redirect loop","description":"Reported by the frontend team. Customer success says three accounts are affected.","status":"done","priority":"medium","assigneeId":"u-15","reporterId":"u-32","labels":{"__genie_dehydrated__":true,"kind":"array","preview":"Array(0)","path":["payload",6,"labels"],"size":0},"estimate":8,"createdAt":"2025-02-03T23:16:14.000Z","updatedAt":"2025-02-05T23:16:14.000Z","completedAt":"2025-02-05T23:16:14.000Z","commentCount":1},{"id":"iss-8","key":"CORE-8","projectKey":"CORE","title":"Refactor report scheduler","description":"Reported by the backend team. Customer success says three accounts are affected.","status":"done","priority":"high","assigneeId":"u-13","reporterId":"u-25","labels":{"__genie_dehydrated__":true,"kind":"array","preview":"Array(2)","path":["payload",7,"labels"],"size":2},"estimate":2,"createdAt":"2025-07-19T07:53:55.000Z","updatedAt":"2025-07-22T07:53:55.000Z","completedAt":"2025-07-22T07:53:55.000Z","commentCount":6},{"id":"iss-9","key":"CORE-9","projectKey":"CORE","title":"Remove search ranking","description":"Reported by the infra team. Verified on mobile Safari and Chrome.","status":"in_progress","priority":"medium","assigneeId":"u-7","reporterId":"u-26","labels":{"__genie_dehydrated__":true,"kind":"array","preview":"Array(0)","path":["payload",8,"labels"],"size":0},"estimate":5,"createdAt":"2025-12-19T23:19:55.000Z","updatedAt":"2026-01-11T23:19:55.000Z","completedAt":null,"commentCount":6},{"id":"iss-10","key":"CORE-10","projectKey":"CORE","title":"Document error page copy","description":"Reported by the security team. Added logs, waiting for the next occurrence.","status":"backlog","priority":"high","assigneeId":"u-23","reporterId":"u-1","labels":{"__genie_dehydrated__":true,"kind":"array","preview":"Array(2)","path":["payload",9,"labels"],"size":2},"estimate":3,"createdAt":"2025-06-11T13:14:51.000Z","updatedAt":"2025-08-04T13:14:51.000Z","completedAt":null,"commentCount":5},{"id":"iss-11","key":"CORE-11","projectKey":"CORE","title":"Refactor GDPR export","description":"Reported by the infra team. The fix is behind the new flag, rolling out to 10%.","status":"done","priority":"medium","assigneeId":"u-24","reporterId":"u-30","labels":{"__genie_dehydrated__":true,"kind":"array","preview":"Array(1)","path":["payload",10,"labels"],"size":1},"estimate":8,"createdAt":"2025-11-22T17:31:02.000Z","updatedAt":"2025-11-27T17:31:02.000Z","completedAt":"2025-11-27T17:31:02.000Z","commentCount":5},{"id":"iss-12","key":"CORE-12","projectKey":"CORE","title":"Document audit log pagination","description":"Reported by the backend team. Design signed off on the copy changes.","status":"done","priority":"urgent","assigneeId":"u-31","reporterId":"u-23","labels":{"__genie_dehydrated__":true,"kind":"array","preview":"Array(0)","path":["payload",11,"labels"],"size":0},"estimate":2,"createdAt":"2026-02-27T07:10:24.000Z","updatedAt":"2026-03-01T09:00:00.000Z","completedAt":"2026-03-01T09:00:00.000Z","commentCount":4},{"id":"iss-13","key":"CORE-13","projectKey":"CORE","title":"Speed up GDPR export","description":"Reported by the performance team. The fix is behind the new flag, rolling out to 10%.","status":"todo","priority":"medium","assigneeId":"u-3","reporterId":"u-3","labels":{"__genie_dehydrated__":true,"kind":"array","preview":"Array(0)","path":["payload",12,"labels"],"size":0},"estimate":5,"createdAt":"2025-03-21T10:39:41.000Z","updatedAt":"2025-04-10T10:39:41.000Z","completedAt":null,"commentCount":3},{"id":"iss-14","key":"CORE-14","projectKey":"CORE","title":"Remove audit log pagination","description":"Reported by the frontend team. Moved to the next sprint, blocked on the API change.","status":"done","priority":"low","assigneeId":null,"reporterId":"u-12","labels":{"__genie_dehydrated__":true,"kind":"array","preview":"Array(1)","path":["payload",13,"labels"],"size":1},"estimate":2,"createdAt":"2025-09-13T23:38:34.000Z","updatedAt":"2025-09-21T23:38:34.000Z","completedAt":"2025-09-21T23:38:34.000Z","commentCount":1},{"id":"iss-15","key":"CORE-15","projectKey":"CORE","title":"Add SSO metadata refresh","description":"Reported by the backend team. Added logs, waiting for the next occurrence.","status":"todo","priority":"medium","assigneeId":"u-3","reporterId":"u-5","labels":{"__genie_dehydrated__":true,"kind":"array","preview":"Array(2)","path":["payload",14,"labels"],"size":2},"estimate":2,"createdAt":"2025-08-21T07:57:38.000Z","updatedAt":"2025-09-23T07:57:38.000Z","completedAt":null,"commentCount":4},{"id":"iss-16","key":"CORE-16","projectKey":"CORE","title":"Add GDPR export","description":"Reported by the frontend team. Pushed a draft branch, would appreciate a second pair of eyes.","status":"done","priority":"medium","assigneeId":"u-8","reporterId":"u-8","labels":{"__genie_dehydrated__":true,"kind":"array","preview":"Array(0)","path":["payload",15,"labels"],"size":0},"estimate":3,"createdAt":"2025-05-30T16:37:39.000Z","updatedAt":"2025-06-22T16:37:39.000Z","completedAt":"2025-06-22T16:37:39.000Z","commentCount":5},{"id":"iss-17","key":"CORE-17","projectKey":"CORE","title":"Fix avatar upload","description":"Reported by the backend team. Added logs, waiting for the next occurrence.","status":"in_review","priority":"medium","assigneeId":"u-26","reporterId":"u-33","labels":{"__genie_dehydrated__":true,"kind":"array","preview":"Array(0)","path":["payload",16,"labels"],"size":0},"estimate":8,"createdAt":"2025-03-04T05:27:14.000Z","updatedAt":"2025-04-26T05:27:14.000Z","completedAt":null,"commentCount":5},{"id":"iss-18","key":"CORE-18","projectKey":"CORE","title":"Refactor audit log pagination","description":"Reported by the performance team. Added logs, waiting for the next occurrence.","status":"todo","priority":"medium","assigneeId":null,"reporterId":"u-19","labels":{"__genie_dehydrated__":true,"kind":"array","preview":"Array(0)","path":["payload",17,"labels"],"size":0},"estimate":3,"createdAt":"2025-02-06T08:13:19.000Z","updatedAt":"2025-02-14T08:13:19.000Z","completedAt":null,"commentCount":1},{"id":"iss-19","key":"CORE-19","projectKey":"CORE","title":"Document rate limiter headers","description":"Reported by the frontend team. Verified on mobile Safari and Chrome.","status":"backlog","priority":"high","assigneeId":"u-18","reporterId":"u-22","labels":{"__genie_dehydrated__":true,"kind":"array","preview":"Array(2)","path":["payload",18,"labels"],"size":2},"estimate":null,"createdAt":"2025-11-28T05:01:50.000Z","updatedAt":"2026-01-08T05:01:50.000Z","completedAt":null,"commentCount":6},{"id":"iss-20","key":"CORE-20","projectKey":"CORE","title":"Migrate report scheduler","description":"Reported by the backend team. This regressed after the last release, bisecting now.","status":"todo","priority":"high","assigneeId":"u-36","reporterId":"u-19","labels":{"__genie_dehydrated__":true,"kind":"array","preview":"Array(0)","path":["payload",19,"labels"],"size":0},"estimate":2,"createdAt":"2025-06-22T00:19:23.000Z","updatedAt":"2025-07-19T00:19:23.000Z","completedAt":null,"commentCount":0},{"id":"iss-21","key":"CORE-21","projectKey":"CORE","title":"Investigate database connection pool","description":"Reported by the frontend team. Moved to the next sprint, blocked on the API change.","status":"in_review","priority":"low","assigneeId":"u-13","reporterId":"u-26","labels":{"__genie_dehydrated__":true,"kind":"array","preview":"Array(2)","path":["payload",20,"labels"],"size":2},"estimate":3,"createdAt":"2025-11-22T06:36:42.000Z","updatedAt":"2026-01-18T06:36:42.000Z","completedAt":null,"commentCount":5},{"id":"iss-22","key":"CORE-22","projectKey":"CORE","title":"Remove SSO metadata refresh","description":"Reported by the infra team. Pushed a draft branch, would appreciate a second pair of eyes.","status":"todo","priority":"low","assigneeId":"u-20","reporterId":"u-25","labels":{"__genie_dehydrated__":true,"kind":"array","preview":"Array(2)","path":["payload",21,"labels"],"size":2},"estimate":8,"createdAt":"2025-08-31T19:56:23.000Z","updatedAt":"2025-10-08T19:56:23.000Z","completedAt":null,"commentCount":4},{"id":"iss-23","key":"CORE-23","projectKey":"CORE","title":"Add rate limiter headers","description":"Reported by the infra team. I can reproduce this on staging with a fresh account.","status":"todo","priority":"high","assigneeId":"u-22","reporterId":"u-6","labels":{"__genie_dehydrated__":true,"kind":"array","preview":"Array(2)","path":["payload",22,"labels"],"size":2},"estimate":3,"createdAt":"2025-03-20T14:05:06.000Z","updatedAt":"2025-04-20T14:05:06.000Z","completedAt":null,"commentCount":5},{"id":"iss-24","key":"CORE-24","projectKey":"CORE","title":"Migrate API key rotation","description":"Reported by the security team. The fix is behind the new flag, rolling out to 10%.","status":"in_progress","priority":"high","assigneeId":"u-15","reporterId":"u-6","labels":{"__genie_dehydrated__":true,"kind":"array","preview":"Array(1)","path":["payload",23,"labels"],"size":1},"estimate":null,"createdAt":"2025-05-01T19:51:55.000Z","updatedAt":"2025-05-08T19:51:55.000Z","completedAt":null,"commentCount":2},{"id":"iss-25","key":"CORE-25","projectKey":"CORE","title":"Add webhook retries","description":"Reported by the backend team. Customer success says three accounts are affected.","status":"in_progress","priority":"low","assigneeId":null,"reporterId":"u-18","labels":{"__genie_dehydrated__":true,"kind":"array","preview":"Array(0)","path":["payload",24,"labels"],"size":0},"estimate":5,"createdAt":"2025-09-13T11:03:45.000Z","updatedAt":"2025-09-24T11:03:45.000Z","completedAt":null,"commentCount":6},{"__genie_dehydrated__":true,"kind":"truncated","preview":"+3215 more items","path":["payload"],"size":3240}],"meta":{"requestId":"p9wO6fpnlrsyCi5eTJ4YY","requestStatus":"fulfilled"}},"renderEventIds":[],"reactWorkActive":false,"genieMs":0.3},{"sequence":2360,"actionId":"redux-store:1/action:2360","kind":"action","type":"issues/filtersChanged","label":"issues/filtersChanged","parentActionId":null,"at":1795078592418,"durationMs":1.3,"outcome":"returned","error":null,"rootStateChanged":true,"changedSlices":["issues"],"changedSlicesTruncated":false,"unrecordedNestedDispatches":0,"mutation":{"status":"none-detected","notScannedReason":null,"findings":[],"findingsOmitted":false,"objectsCompared":4,"scanTruncated":true},"payload":{"type":"issues/filtersChanged","payload":{"text":"c"}},"renderEventIds":["render:18:2","render:18:7","render:18:30","render:18:33","render:18:37"],"reactWorkActive":false,"genieMs":0.1},{"sequence":2944,"actionId":"redux-store:1/action:2944","kind":"action","type":"issues/filtersChanged","label":"issues/filtersChanged","parentActionId":null,"at":1795078592474,"durationMs":0.7,"outcome":"returned","error":null,"rootStateChanged":true,"changedSlices":["issues"],"changedSlicesTruncated":false,"unrecordedNestedDispatches":0,"mutation":{"status":"none-detected","notScannedReason":null,"findings":[],"findingsOmitted":false,"objectsCompared":4,"scanTruncated":true},"payload":{"type":"issues/filtersChanged","payload":{"text":"ca"}},"renderEventIds":["render:20:1742","render:20:1747","render:20:1777"],"reactWorkActive":false,"genieMs":0.2},{"sequence":3864,"actionId":"redux-store:1/action:3864","kind":"action","type":"issues/filtersChanged","label":"issues/filtersChanged","parentActionId":null,"at":1795078592534,"durationMs":0.6,"outcome":"returned","error":null,"rootStateChanged":true,"changedSlices":["issues"],"changedSlicesTruncated":false,"unrecordedNestedDispatches":0,"mutation":{"status":"none-detected","notScannedReason":null,"findings":[],"findingsOmitted":false,"objectsCompared":4,"scanTruncated":true},"payload":{"type":"issues/filtersChanged","payload":{"text":"cac"}},"renderEventIds":["render:22:3994","render:22:3999","render:22:4029"],"reactWorkActive":false,"genieMs":0.2},{"sequence":4460,"actionId":"redux-store:1/action:4460","kind":"action","type":"issues/filtersChanged","label":"issues/filtersChanged","parentActionId":null,"at":1795078592586,"durationMs":0.6,"outcome":"returned","error":null,"rootStateChanged":true,"changedSlices":["issues"],"changedSlicesTruncated":false,"unrecordedNestedDispatches":0,"mutation":{"status":"none-detected","notScannedReason":null,"findings":[],"findingsOmitted":false,"objectsCompared":4,"scanTruncated":true},"payload":{"type":"issues/filtersChanged","payload":{"text":"cach"}},"renderEventIds":["render:24:5878","render:24:5883","render:24:5912"],"reactWorkActive":false,"genieMs":0.3},{"sequence":4663,"actionId":"redux-store:1/action:4663","kind":"action","type":"issues/filtersChanged","label":"issues/filtersChanged","parentActionId":null,"at":1795078592610,"durationMs":0.6,"outcome":"returned","error":null,"rootStateChanged":true,"changedSlices":["issues"],"changedSlicesTruncated":false,"unrecordedNestedDispatches":0,"mutation":{"status":"none-detected","notScannedReason":null,"findings":[],"findingsOmitted":false,"objectsCompared":4,"scanTruncated":true},"payload":{"type":"issues/filtersChanged","payload":{"text":"cache"}},"renderEventIds":["render:25:6712","render:25:6717","render:25:6740","render:25:6743","render:25:6747"],"reactWorkActive":false,"genieMs":0.3}],"matched":9,"omittedBefore":0,"more":false,"nextAfterSequence":4663,"latestSequence":5378,"coverage":{"historyLimit":500,"evictedRecords":0,"unrecordedChanges":0,"mutationDetection":true,"libraryActions":{"recorded":false,"counted":5349,"byType":[{"kind":"action","type":"service/subscriptions/internal_probeSubscription","count":3027},{"kind":"thunk","type":null,"count":1208},{"kind":"action","type":"service/executeQuery/rejected","count":602},{"kind":"action","type":"service/subscriptions/unsubscribeQueryResult","count":502},{"kind":"unrecorded-change","type":null,"count":6},{"kind":"action","type":"service/executeQuery/pending","count":2},{"kind":"action","type":"service/executeQuery/fulfilled","count":2}],"otherTypesCount":0}}},"session":{"sessionId":"28cdc622-79b7-4d9e-85c0-db32cb2ff919","logicalSessionId":"a07593a5-db3c-4fae-a8d8-4c337dd757ea"}}]

```

`/tmp/upd-d/chain-filter3.json`:

```json
[{"schemaVersion":"2.0","tool":"react_render_causes","ok":true,"status":"ok","result":{"componentMatch":{"component":"AccountMenu","exact":true,"status":"matched","matchedNames":["AccountMenu"],"matchedNameCount":1,"similarNames":[]},"tracking":true,"commits":3,"documentCommitId":20,"observation":{"id":"observation:1","epoch":1,"startedAfterDocumentCommitId":17},"attribution":{"status":"current","startedAtDocumentCommitId":20,"completedAtDocumentCommitId":20,"startedAtAnalysisGeneration":21,"completedAtAnalysisGeneration":21},"view":"full","events":[{"renderEventId":"render:19:982","observationId":"observation:1","commitId":2,"documentCommitId":19,"componentId":9960767357118,"componentName":"AccountMenu","instance":{"fiberId":9960767357118,"mountId":"mount:151","key":null,"siblingIndex":3,"parent":{"fiberId":9960767357109,"name":"TopBar","key":null},"keyedParent":null,"logicalPath":"AppErrorBoundary[index=0] > Provider[index=0] > BrowserRouter[index=0] > Router[index=0] > ThemeProvider[index=0] > App[index=0] > Routes[index=0] > RenderedRoute[index=0] > RequireAuth[index=0] > Connect(AppShell)[index=0] > AppShell[index=0] > FeatureFlagsProvider[index=0] > <div>[index=0] > TopBar[index=0] > <header>[index=0] > <div>[index=3] > AccountMenu[index=3]","logicalIdentityEvidence":"positional","mountGeneration":1,"mountGenerationEvidence":"exact","hostSelector":null},"causes":[{"kind":"external-store","evidence":"inferred","reason":"external-store-snapshot-changed","hookIndex":4,"externalStoreIndex":0,"subscriberId":"subscriber:mount:151:0","selectionEqual":false,"subscriptionFired":true,"before":{"user":{"id":"u-1","name":"Dana Whitfield","email":"dana@acme.test","title":"Designer","team":"Infra"},"savedViewCount":0},"after":{"user":{"id":"u-1","name":"Dana Whitfield","email":"dana@acme.test","title":"Designer","team":"Infra"},"savedViewCount":0},"changedFields":[],"deepDiff":{"changes":[{"kind":"reference-only","path":""}],"visited":3,"truncated":false},"storeId":"external-store:1","storeLabel":"anonymous-external-store","selector":null,"equality":"object-is","fanout":null,"notificationId":null,"competingCandidates":["external-store-snapshot-identity-changed"],"redux":{"storeId":"redux-store:1","link":"subscription","evidence":"inferred","reason":"unrecorded-state-change","actions":[{"actionId":"redux-store:1/action:2743","sequence":2743,"kind":"unrecorded-change","type":null,"changedSlices":["service"]}],"omittedActions":0},"hookProvenance":{"status":"unavailable","evidence":"unknown","reason":"shadow-render-disabled"}}],"necessity":"unnecessary","necessityReason":"inputs-unchanged","assessment":{"inputEvidence":"none-observed","observedInputKinds":[],"behaviorEvidence":{"subtreeHostMutations":{"status":"none-observed","count":0,"pendingSubtrees":0,"omittedByLimit":0,"callbackOnlyUpdates":0,"writes":[],"callbacks":[]},"scheduledEffects":{"status":"observed","count":2},"subtreeScheduledEffects":{"status":"observed","count":2},"unobservedDomains":["focus","url","network","transition","freshness","effect-execution"]},"optimizationSafety":"not-proven-safe","requiredValidation":["dom","aria","focus","url","network","transition"]},"inputCoverage":{"complete":true,"omittedInputs":0,"scanTruncated":false,"propsNotEnumerated":false},"source":{"file":"~/.t3/worktrees/genie-react/t3-9e64af67-f21cc60f9d8a6648/apps/realworld-legacy/src/layout/top-bar.tsx","line":32,"column":9,"functionName":null,"sourceMapConfidence":"served","role":"element-callsite"},"sourceAttribution":{"role":"usage-or-definition-fallback","evidence":"inferred"},"sourceOwnership":"app","isLibrary":false}],"omittedByLimit":0,"sourceClassification":{"complete":true,"affects":"result","totalCandidates":1,"evaluated":1,"app":1,"library":0,"unknown":0,"unknownComponents":[],"unknownComponentsOmitted":0},"renderEventRetention":{"evictedEvents":39,"earliestDocumentCommitId":18,"latestDocumentCommitId":20},"coverage":{"skippedCommitFibers":0,"droppedUnmountFibers":0,"analysisFailedFibers":0,"pausedCommits":0,"unobservedCommits":0,"refreshCommitsExcluded":0,"truncatedInputFibers":1,"propsNotEnumeratedFibers":0,"budgetExhaustedCommits":0,"budgetExhaustedSubsystems":[],"incompleteBecause":[{"reason":"inputs-truncated","fibers":1,"components":["IssueTableToolbar"],"detail":"An input held values Genie compares only in part, such as functions, class instances or objects past the inspected depth; read deepDiff.truncated on these components."}],"complete":false,"inputAttributionComplete":false,"semantics":"lower-bound","coverageDomain":"render-causality","droppedRenderEvents":39}},"session":{"sessionId":"3c16f9c7-a8d8-4fdb-bcc2-c694878cd0f0","logicalSessionId":"a07593a5-db3c-4fae-a8d8-4c337dd757ea"}},{"schemaVersion":"2.0","tool":"redux_actions","ok":true,"status":"ok","result":{"store":{"storeId":"redux-store:1","name":"app"},"records":[{"sequence":13,"actionId":"redux-store:1/action:13","kind":"action","type":"issues/fetchAll/pending","label":"issues/fetchAll/pending","parentActionId":"redux-store:1/action:12","at":1795078610262,"durationMs":0,"outcome":"returned","error":null,"rootStateChanged":true,"changedSlices":["issues"],"changedSlicesTruncated":false,"unrecordedNestedDispatches":0,"mutation":{"status":"none-detected","notScannedReason":null,"findings":[],"findingsOmitted":false,"objectsCompared":4,"scanTruncated":false},"payload":{"type":"issues/fetchAll/pending","meta":{"requestId":"IH8eh5CHO8490DkrZXPp_","requestStatus":"pending"}},"renderEventIds":[],"reactWorkActive":true,"genieMs":0.1},{"sequence":25,"actionId":"redux-store:1/action:25","kind":"action","type":"issues/fetchAll/pending","label":"issues/fetchAll/pending","parentActionId":"redux-store:1/action:24","at":1795078610263,"durationMs":0,"outcome":"returned","error":null,"rootStateChanged":false,"changedSlices":[],"changedSlicesTruncated":false,"unrecordedNestedDispatches":0,"mutation":{"status":"none-detected","notScannedReason":null,"findings":[],"findingsOmitted":false,"objectsCompared":4,"scanTruncated":false},"payload":{"type":"issues/fetchAll/pending","meta":{"requestId":"YHCSQgm7iawd3m8DAwGKv","requestStatus":"pending"}},"renderEventIds":[],"reactWorkActive":true,"genieMs":0},{"sequence":38,"actionId":"redux-store:1/action:38","kind":"action","type":"issues/fetchAll/fulfilled","label":"issues/fetchAll/fulfilled","parentActionId":"redux-store:1/action:12","at":1795078610329,"durationMs":6.6,"outcome":"returned","error":null,"rootStateChanged":true,"changedSlices":["issues"],"changedSlicesTruncated":false,"unrecordedNestedDispatches":0,"mutation":{"status":"none-detected","notScannedReason":null,"findings":[],"findingsOmitted":false,"objectsCompared":4,"scanTruncated":false},"payload":{"type":"issues/fetchAll/fulfilled","payload":[{"id":"iss-1","key":"CORE-1","projectKey":"CORE","title":"Migrate push notification opt-out","description":"Reported by the docs team. This regressed after the last release, bisecting now.","status":"backlog","priority":"urgent","assigneeId":"u-18","reporterId":"u-19","labels":{"__genie_dehydrated__":true,"kind":"array","preview":"Array(2)","path":["payload",0,"labels"],"size":2},"estimate":3,"createdAt":"2026-01-31T19:49:51.000Z","updatedAt":"2026-03-02T09:00:00.000Z","completedAt":null,"commentCount":5},{"id":"iss-2","key":"CORE-2","projectKey":"CORE","title":"Add dashboard filters","description":"Reported by the frontend team. Added logs, waiting for the next occurrence.","status":"in_progress","priority":"high","assigneeId":"u-33","reporterId":"u-15","labels":{"__genie_dehydrated__":true,"kind":"array","preview":"Array(1)","path":["payload",1,"labels"],"size":1},"estimate":3,"createdAt":"2025-03-25T20:57:13.000Z","updatedAt":"2025-03-27T20:57:13.000Z","completedAt":null,"commentCount":0},{"id":"iss-3","key":"CORE-3","projectKey":"CORE","title":"Remove CSV import validation","description":"Reported by the security team. Moved to the next sprint, blocked on the API change.","status":"todo","priority":"low","assigneeId":"u-27","reporterId":"u-27","labels":{"__genie_dehydrated__":true,"kind":"array","preview":"Array(1)","path":["payload",2,"labels"],"size":1},"estimate":null,"createdAt":"2025-10-14T00:51:43.000Z","updatedAt":"2025-11-07T00:51:43.000Z","completedAt":null,"commentCount":0},{"id":"iss-4","key":"CORE-4","projectKey":"CORE","title":"Speed up billing email template","description":"Reported by the frontend team. Design signed off on the copy changes.","status":"done","priority":"high","assigneeId":"u-4","reporterId":"u-11","labels":{"__genie_dehydrated__":true,"kind":"array","preview":"Array(0)","path":["payload",3,"labels"],"size":0},"estimate":8,"createdAt":"2025-02-03T00:33:13.000Z","updatedAt":"2025-02-27T00:33:13.000Z","completedAt":"2025-02-27T00:33:13.000Z","commentCount":2},{"id":"iss-5","key":"CORE-5","projectKey":"CORE","title":"Migrate session timeout warning","description":"Reported by the design team. Pushed a draft branch, would appreciate a second pair of eyes.","status":"done","priority":"medium","assigneeId":"u-21","reporterId":"u-23","labels":{"__genie_dehydrated__":true,"kind":"array","preview":"Array(2)","path":["payload",4,"labels"],"size":2},"estimate":3,"createdAt":"2025-08-01T02:59:14.000Z","updatedAt":"2025-08-18T02:59:14.000Z","completedAt":"2025-08-18T02:59:14.000Z","commentCount":5},{"id":"iss-6","key":"CORE-6","projectKey":"CORE","title":"Document API key rotation","description":"Reported by the backend team. Added logs, waiting for the next occurrence.","status":"in_progress","priority":"medium","assigneeId":"u-25","reporterId":"u-1","labels":{"__genie_dehydrated__":true,"kind":"array","preview":"Array(0)","path":["payload",5,"labels"],"size":0},"estimate":5,"createdAt":"2025-06-28T02:44:25.000Z","updatedAt":"2025-07-10T02:44:25.000Z","completedAt":null,"commentCount":1},{"id":"iss-7","key":"CORE-7","projectKey":"CORE","title":"Investigate login redirect loop","description":"Reported by the frontend team. Customer success says three accounts are affected.","status":"done","priority":"medium","assigneeId":"u-15","reporterId":"u-32","labels":{"__genie_dehydrated__":true,"kind":"array","preview":"Array(0)","path":["payload",6,"labels"],"size":0},"estimate":8,"createdAt":"2025-02-03T23:16:14.000Z","updatedAt":"2025-02-05T23:16:14.000Z","completedAt":"2025-02-05T23:16:14.000Z","commentCount":1},{"id":"iss-8","key":"CORE-8","projectKey":"CORE","title":"Refactor report scheduler","description":"Reported by the backend team. Customer success says three accounts are affected.","status":"done","priority":"high","assigneeId":"u-13","reporterId":"u-25","labels":{"__genie_dehydrated__":true,"kind":"array","preview":"Array(2)","path":["payload",7,"labels"],"size":2},"estimate":2,"createdAt":"2025-07-19T07:53:55.000Z","updatedAt":"2025-07-22T07:53:55.000Z","completedAt":"2025-07-22T07:53:55.000Z","commentCount":6},{"id":"iss-9","key":"CORE-9","projectKey":"CORE","title":"Remove search ranking","description":"Reported by the infra team. Verified on mobile Safari and Chrome.","status":"in_progress","priority":"medium","assigneeId":"u-7","reporterId":"u-26","labels":{"__genie_dehydrated__":true,"kind":"array","preview":"Array(0)","path":["payload",8,"labels"],"size":0},"estimate":5,"createdAt":"2025-12-19T23:19:55.000Z","updatedAt":"2026-01-11T23:19:55.000Z","completedAt":null,"commentCount":6},{"id":"iss-10","key":"CORE-10","projectKey":"CORE","title":"Document error page copy","description":"Reported by the security team. Added logs, waiting for the next occurrence.","status":"backlog","priority":"high","assigneeId":"u-23","reporterId":"u-1","labels":{"__genie_dehydrated__":true,"kind":"array","preview":"Array(2)","path":["payload",9,"labels"],"size":2},"estimate":3,"createdAt":"2025-06-11T13:14:51.000Z","updatedAt":"2025-08-04T13:14:51.000Z","completedAt":null,"commentCount":5},{"id":"iss-11","key":"CORE-11","projectKey":"CORE","title":"Refactor GDPR export","description":"Reported by the infra team. The fix is behind the new flag, rolling out to 10%.","status":"done","priority":"medium","assigneeId":"u-24","reporterId":"u-30","labels":{"__genie_dehydrated__":true,"kind":"array","preview":"Array(1)","path":["payload",10,"labels"],"size":1},"estimate":8,"createdAt":"2025-11-22T17:31:02.000Z","updatedAt":"2025-11-27T17:31:02.000Z","completedAt":"2025-11-27T17:31:02.000Z","commentCount":5},{"id":"iss-12","key":"CORE-12","projectKey":"CORE","title":"Document audit log pagination","description":"Reported by the backend team. Design signed off on the copy changes.","status":"done","priority":"urgent","assigneeId":"u-31","reporterId":"u-23","labels":{"__genie_dehydrated__":true,"kind":"array","preview":"Array(0)","path":["payload",11,"labels"],"size":0},"estimate":2,"createdAt":"2026-02-27T07:10:24.000Z","updatedAt":"2026-03-01T09:00:00.000Z","completedAt":"2026-03-01T09:00:00.000Z","commentCount":4},{"id":"iss-13","key":"CORE-13","projectKey":"CORE","title":"Speed up GDPR export","description":"Reported by the performance team. The fix is behind the new flag, rolling out to 10%.","status":"todo","priority":"medium","assigneeId":"u-3","reporterId":"u-3","labels":{"__genie_dehydrated__":true,"kind":"array","preview":"Array(0)","path":["payload",12,"labels"],"size":0},"estimate":5,"createdAt":"2025-03-21T10:39:41.000Z","updatedAt":"2025-04-10T10:39:41.000Z","completedAt":null,"commentCount":3},{"id":"iss-14","key":"CORE-14","projectKey":"CORE","title":"Remove audit log pagination","description":"Reported by the frontend team. Moved to the next sprint, blocked on the API change.","status":"done","priority":"low","assigneeId":null,"reporterId":"u-12","labels":{"__genie_dehydrated__":true,"kind":"array","preview":"Array(1)","path":["payload",13,"labels"],"size":1},"estimate":2,"createdAt":"2025-09-13T23:38:34.000Z","updatedAt":"2025-09-21T23:38:34.000Z","completedAt":"2025-09-21T23:38:34.000Z","commentCount":1},{"id":"iss-15","key":"CORE-15","projectKey":"CORE","title":"Add SSO metadata refresh","description":"Reported by the backend team. Added logs, waiting for the next occurrence.","status":"todo","priority":"medium","assigneeId":"u-3","reporterId":"u-5","labels":{"__genie_dehydrated__":true,"kind":"array","preview":"Array(2)","path":["payload",14,"labels"],"size":2},"estimate":2,"createdAt":"2025-08-21T07:57:38.000Z","updatedAt":"2025-09-23T07:57:38.000Z","completedAt":null,"commentCount":4},{"id":"iss-16","key":"CORE-16","projectKey":"CORE","title":"Add GDPR export","description":"Reported by the frontend team. Pushed a draft branch, would appreciate a second pair of eyes.","status":"done","priority":"medium","assigneeId":"u-8","reporterId":"u-8","labels":{"__genie_dehydrated__":true,"kind":"array","preview":"Array(0)","path":["payload",15,"labels"],"size":0},"estimate":3,"createdAt":"2025-05-30T16:37:39.000Z","updatedAt":"2025-06-22T16:37:39.000Z","completedAt":"2025-06-22T16:37:39.000Z","commentCount":5},{"id":"iss-17","key":"CORE-17","projectKey":"CORE","title":"Fix avatar upload","description":"Reported by the backend team. Added logs, waiting for the next occurrence.","status":"in_review","priority":"medium","assigneeId":"u-26","reporterId":"u-33","labels":{"__genie_dehydrated__":true,"kind":"array","preview":"Array(0)","path":["payload",16,"labels"],"size":0},"estimate":8,"createdAt":"2025-03-04T05:27:14.000Z","updatedAt":"2025-04-26T05:27:14.000Z","completedAt":null,"commentCount":5},{"id":"iss-18","key":"CORE-18","projectKey":"CORE","title":"Refactor audit log pagination","description":"Reported by the performance team. Added logs, waiting for the next occurrence.","status":"todo","priority":"medium","assigneeId":null,"reporterId":"u-19","labels":{"__genie_dehydrated__":true,"kind":"array","preview":"Array(0)","path":["payload",17,"labels"],"size":0},"estimate":3,"createdAt":"2025-02-06T08:13:19.000Z","updatedAt":"2025-02-14T08:13:19.000Z","completedAt":null,"commentCount":1},{"id":"iss-19","key":"CORE-19","projectKey":"CORE","title":"Document rate limiter headers","description":"Reported by the frontend team. Verified on mobile Safari and Chrome.","status":"backlog","priority":"high","assigneeId":"u-18","reporterId":"u-22","labels":{"__genie_dehydrated__":true,"kind":"array","preview":"Array(2)","path":["payload",18,"labels"],"size":2},"estimate":null,"createdAt":"2025-11-28T05:01:50.000Z","updatedAt":"2026-01-08T05:01:50.000Z","completedAt":null,"commentCount":6},{"id":"iss-20","key":"CORE-20","projectKey":"CORE","title":"Migrate report scheduler","description":"Reported by the backend team. This regressed after the last release, bisecting now.","status":"todo","priority":"high","assigneeId":"u-36","reporterId":"u-19","labels":{"__genie_dehydrated__":true,"kind":"array","preview":"Array(0)","path":["payload",19,"labels"],"size":0},"estimate":2,"createdAt":"2025-06-22T00:19:23.000Z","updatedAt":"2025-07-19T00:19:23.000Z","completedAt":null,"commentCount":0},{"id":"iss-21","key":"CORE-21","projectKey":"CORE","title":"Investigate database connection pool","description":"Reported by the frontend team. Moved to the next sprint, blocked on the API change.","status":"in_review","priority":"low","assigneeId":"u-13","reporterId":"u-26","labels":{"__genie_dehydrated__":true,"kind":"array","preview":"Array(2)","path":["payload",20,"labels"],"size":2},"estimate":3,"createdAt":"2025-11-22T06:36:42.000Z","updatedAt":"2026-01-18T06:36:42.000Z","completedAt":null,"commentCount":5},{"id":"iss-22","key":"CORE-22","projectKey":"CORE","title":"Remove SSO metadata refresh","description":"Reported by the infra team. Pushed a draft branch, would appreciate a second pair of eyes.","status":"todo","priority":"low","assigneeId":"u-20","reporterId":"u-25","labels":{"__genie_dehydrated__":true,"kind":"array","preview":"Array(2)","path":["payload",21,"labels"],"size":2},"estimate":8,"createdAt":"2025-08-31T19:56:23.000Z","updatedAt":"2025-10-08T19:56:23.000Z","completedAt":null,"commentCount":4},{"id":"iss-23","key":"CORE-23","projectKey":"CORE","title":"Add rate limiter headers","description":"Reported by the infra team. I can reproduce this on staging with a fresh account.","status":"todo","priority":"high","assigneeId":"u-22","reporterId":"u-6","labels":{"__genie_dehydrated__":true,"kind":"array","preview":"Array(2)","path":["payload",22,"labels"],"size":2},"estimate":3,"createdAt":"2025-03-20T14:05:06.000Z","updatedAt":"2025-04-20T14:05:06.000Z","completedAt":null,"commentCount":5},{"id":"iss-24","key":"CORE-24","projectKey":"CORE","title":"Migrate API key rotation","description":"Reported by the security team. The fix is behind the new flag, rolling out to 10%.","status":"in_progress","priority":"high","assigneeId":"u-15","reporterId":"u-6","labels":{"__genie_dehydrated__":true,"kind":"array","preview":"Array(1)","path":["payload",23,"labels"],"size":1},"estimate":null,"createdAt":"2025-05-01T19:51:55.000Z","updatedAt":"2025-05-08T19:51:55.000Z","completedAt":null,"commentCount":2},{"id":"iss-25","key":"CORE-25","projectKey":"CORE","title":"Add webhook retries","description":"Reported by the backend team. Customer success says three accounts are affected.","status":"in_progress","priority":"low","assigneeId":null,"reporterId":"u-18","labels":{"__genie_dehydrated__":true,"kind":"array","preview":"Array(0)","path":["payload",24,"labels"],"size":0},"estimate":5,"createdAt":"2025-09-13T11:03:45.000Z","updatedAt":"2025-09-24T11:03:45.000Z","completedAt":null,"commentCount":6},{"__genie_dehydrated__":true,"kind":"truncated","preview":"+3215 more items","path":["payload"],"size":3240}],"meta":{"requestId":"IH8eh5CHO8490DkrZXPp_","requestStatus":"fulfilled"}},"renderEventIds":[],"reactWorkActive":false,"genieMs":0.4},{"sequence":1757,"actionId":"redux-store:1/action:1757","kind":"action","type":"issues/fetchAll/fulfilled","label":"issues/fetchAll/fulfilled","parentActionId":"redux-store:1/action:24","at":1795078610422,"durationMs":7.5,"outcome":"returned","error":null,"rootStateChanged":true,"changedSlices":["issues"],"changedSlicesTruncated":false,"unrecordedNestedDispatches":0,"mutation":{"status":"none-detected","notScannedReason":null,"findings":[],"findingsOmitted":false,"objectsCompared":4,"scanTruncated":true},"payload":{"type":"issues/fetchAll/fulfilled","payload":[{"id":"iss-1","key":"CORE-1","projectKey":"CORE","title":"Migrate push notification opt-out","description":"Reported by the docs team. This regressed after the last release, bisecting now.","status":"backlog","priority":"urgent","assigneeId":"u-18","reporterId":"u-19","labels":{"__genie_dehydrated__":true,"kind":"array","preview":"Array(2)","path":["payload",0,"labels"],"size":2},"estimate":3,"createdAt":"2026-01-31T19:49:51.000Z","updatedAt":"2026-03-02T09:00:00.000Z","completedAt":null,"commentCount":5},{"id":"iss-2","key":"CORE-2","projectKey":"CORE","title":"Add dashboard filters","description":"Reported by the frontend team. Added logs, waiting for the next occurrence.","status":"in_progress","priority":"high","assigneeId":"u-33","reporterId":"u-15","labels":{"__genie_dehydrated__":true,"kind":"array","preview":"Array(1)","path":["payload",1,"labels"],"size":1},"estimate":3,"createdAt":"2025-03-25T20:57:13.000Z","updatedAt":"2025-03-27T20:57:13.000Z","completedAt":null,"commentCount":0},{"id":"iss-3","key":"CORE-3","projectKey":"CORE","title":"Remove CSV import validation","description":"Reported by the security team. Moved to the next sprint, blocked on the API change.","status":"todo","priority":"low","assigneeId":"u-27","reporterId":"u-27","labels":{"__genie_dehydrated__":true,"kind":"array","preview":"Array(1)","path":["payload",2,"labels"],"size":1},"estimate":null,"createdAt":"2025-10-14T00:51:43.000Z","updatedAt":"2025-11-07T00:51:43.000Z","completedAt":null,"commentCount":0},{"id":"iss-4","key":"CORE-4","projectKey":"CORE","title":"Speed up billing email template","description":"Reported by the frontend team. Design signed off on the copy changes.","status":"done","priority":"high","assigneeId":"u-4","reporterId":"u-11","labels":{"__genie_dehydrated__":true,"kind":"array","preview":"Array(0)","path":["payload",3,"labels"],"size":0},"estimate":8,"createdAt":"2025-02-03T00:33:13.000Z","updatedAt":"2025-02-27T00:33:13.000Z","completedAt":"2025-02-27T00:33:13.000Z","commentCount":2},{"id":"iss-5","key":"CORE-5","projectKey":"CORE","title":"Migrate session timeout warning","description":"Reported by the design team. Pushed a draft branch, would appreciate a second pair of eyes.","status":"done","priority":"medium","assigneeId":"u-21","reporterId":"u-23","labels":{"__genie_dehydrated__":true,"kind":"array","preview":"Array(2)","path":["payload",4,"labels"],"size":2},"estimate":3,"createdAt":"2025-08-01T02:59:14.000Z","updatedAt":"2025-08-18T02:59:14.000Z","completedAt":"2025-08-18T02:59:14.000Z","commentCount":5},{"id":"iss-6","key":"CORE-6","projectKey":"CORE","title":"Document API key rotation","description":"Reported by the backend team. Added logs, waiting for the next occurrence.","status":"in_progress","priority":"medium","assigneeId":"u-25","reporterId":"u-1","labels":{"__genie_dehydrated__":true,"kind":"array","preview":"Array(0)","path":["payload",5,"labels"],"size":0},"estimate":5,"createdAt":"2025-06-28T02:44:25.000Z","updatedAt":"2025-07-10T02:44:25.000Z","completedAt":null,"commentCount":1},{"id":"iss-7","key":"CORE-7","projectKey":"CORE","title":"Investigate login redirect loop","description":"Reported by the frontend team. Customer success says three accounts are affected.","status":"done","priority":"medium","assigneeId":"u-15","reporterId":"u-32","labels":{"__genie_dehydrated__":true,"kind":"array","preview":"Array(0)","path":["payload",6,"labels"],"size":0},"estimate":8,"createdAt":"2025-02-03T23:16:14.000Z","updatedAt":"2025-02-05T23:16:14.000Z","completedAt":"2025-02-05T23:16:14.000Z","commentCount":1},{"id":"iss-8","key":"CORE-8","projectKey":"CORE","title":"Refactor report scheduler","description":"Reported by the backend team. Customer success says three accounts are affected.","status":"done","priority":"high","assigneeId":"u-13","reporterId":"u-25","labels":{"__genie_dehydrated__":true,"kind":"array","preview":"Array(2)","path":["payload",7,"labels"],"size":2},"estimate":2,"createdAt":"2025-07-19T07:53:55.000Z","updatedAt":"2025-07-22T07:53:55.000Z","completedAt":"2025-07-22T07:53:55.000Z","commentCount":6},{"id":"iss-9","key":"CORE-9","projectKey":"CORE","title":"Remove search ranking","description":"Reported by the infra team. Verified on mobile Safari and Chrome.","status":"in_progress","priority":"medium","assigneeId":"u-7","reporterId":"u-26","labels":{"__genie_dehydrated__":true,"kind":"array","preview":"Array(0)","path":["payload",8,"labels"],"size":0},"estimate":5,"createdAt":"2025-12-19T23:19:55.000Z","updatedAt":"2026-01-11T23:19:55.000Z","completedAt":null,"commentCount":6},{"id":"iss-10","key":"CORE-10","projectKey":"CORE","title":"Document error page copy","description":"Reported by the security team. Added logs, waiting for the next occurrence.","status":"backlog","priority":"high","assigneeId":"u-23","reporterId":"u-1","labels":{"__genie_dehydrated__":true,"kind":"array","preview":"Array(2)","path":["payload",9,"labels"],"size":2},"estimate":3,"createdAt":"2025-06-11T13:14:51.000Z","updatedAt":"2025-08-04T13:14:51.000Z","completedAt":null,"commentCount":5},{"id":"iss-11","key":"CORE-11","projectKey":"CORE","title":"Refactor GDPR export","description":"Reported by the infra team. The fix is behind the new flag, rolling out to 10%.","status":"done","priority":"medium","assigneeId":"u-24","reporterId":"u-30","labels":{"__genie_dehydrated__":true,"kind":"array","preview":"Array(1)","path":["payload",10,"labels"],"size":1},"estimate":8,"createdAt":"2025-11-22T17:31:02.000Z","updatedAt":"2025-11-27T17:31:02.000Z","completedAt":"2025-11-27T17:31:02.000Z","commentCount":5},{"id":"iss-12","key":"CORE-12","projectKey":"CORE","title":"Document audit log pagination","description":"Reported by the backend team. Design signed off on the copy changes.","status":"done","priority":"urgent","assigneeId":"u-31","reporterId":"u-23","labels":{"__genie_dehydrated__":true,"kind":"array","preview":"Array(0)","path":["payload",11,"labels"],"size":0},"estimate":2,"createdAt":"2026-02-27T07:10:24.000Z","updatedAt":"2026-03-01T09:00:00.000Z","completedAt":"2026-03-01T09:00:00.000Z","commentCount":4},{"id":"iss-13","key":"CORE-13","projectKey":"CORE","title":"Speed up GDPR export","description":"Reported by the performance team. The fix is behind the new flag, rolling out to 10%.","status":"todo","priority":"medium","assigneeId":"u-3","reporterId":"u-3","labels":{"__genie_dehydrated__":true,"kind":"array","preview":"Array(0)","path":["payload",12,"labels"],"size":0},"estimate":5,"createdAt":"2025-03-21T10:39:41.000Z","updatedAt":"2025-04-10T10:39:41.000Z","completedAt":null,"commentCount":3},{"id":"iss-14","key":"CORE-14","projectKey":"CORE","title":"Remove audit log pagination","description":"Reported by the frontend team. Moved to the next sprint, blocked on the API change.","status":"done","priority":"low","assigneeId":null,"reporterId":"u-12","labels":{"__genie_dehydrated__":true,"kind":"array","preview":"Array(1)","path":["payload",13,"labels"],"size":1},"estimate":2,"createdAt":"2025-09-13T23:38:34.000Z","updatedAt":"2025-09-21T23:38:34.000Z","completedAt":"2025-09-21T23:38:34.000Z","commentCount":1},{"id":"iss-15","key":"CORE-15","projectKey":"CORE","title":"Add SSO metadata refresh","description":"Reported by the backend team. Added logs, waiting for the next occurrence.","status":"todo","priority":"medium","assigneeId":"u-3","reporterId":"u-5","labels":{"__genie_dehydrated__":true,"kind":"array","preview":"Array(2)","path":["payload",14,"labels"],"size":2},"estimate":2,"createdAt":"2025-08-21T07:57:38.000Z","updatedAt":"2025-09-23T07:57:38.000Z","completedAt":null,"commentCount":4},{"id":"iss-16","key":"CORE-16","projectKey":"CORE","title":"Add GDPR export","description":"Reported by the frontend team. Pushed a draft branch, would appreciate a second pair of eyes.","status":"done","priority":"medium","assigneeId":"u-8","reporterId":"u-8","labels":{"__genie_dehydrated__":true,"kind":"array","preview":"Array(0)","path":["payload",15,"labels"],"size":0},"estimate":3,"createdAt":"2025-05-30T16:37:39.000Z","updatedAt":"2025-06-22T16:37:39.000Z","completedAt":"2025-06-22T16:37:39.000Z","commentCount":5},{"id":"iss-17","key":"CORE-17","projectKey":"CORE","title":"Fix avatar upload","description":"Reported by the backend team. Added logs, waiting for the next occurrence.","status":"in_review","priority":"medium","assigneeId":"u-26","reporterId":"u-33","labels":{"__genie_dehydrated__":true,"kind":"array","preview":"Array(0)","path":["payload",16,"labels"],"size":0},"estimate":8,"createdAt":"2025-03-04T05:27:14.000Z","updatedAt":"2025-04-26T05:27:14.000Z","completedAt":null,"commentCount":5},{"id":"iss-18","key":"CORE-18","projectKey":"CORE","title":"Refactor audit log pagination","description":"Reported by the performance team. Added logs, waiting for the next occurrence.","status":"todo","priority":"medium","assigneeId":null,"reporterId":"u-19","labels":{"__genie_dehydrated__":true,"kind":"array","preview":"Array(0)","path":["payload",17,"labels"],"size":0},"estimate":3,"createdAt":"2025-02-06T08:13:19.000Z","updatedAt":"2025-02-14T08:13:19.000Z","completedAt":null,"commentCount":1},{"id":"iss-19","key":"CORE-19","projectKey":"CORE","title":"Document rate limiter headers","description":"Reported by the frontend team. Verified on mobile Safari and Chrome.","status":"backlog","priority":"high","assigneeId":"u-18","reporterId":"u-22","labels":{"__genie_dehydrated__":true,"kind":"array","preview":"Array(2)","path":["payload",18,"labels"],"size":2},"estimate":null,"createdAt":"2025-11-28T05:01:50.000Z","updatedAt":"2026-01-08T05:01:50.000Z","completedAt":null,"commentCount":6},{"id":"iss-20","key":"CORE-20","projectKey":"CORE","title":"Migrate report scheduler","description":"Reported by the backend team. This regressed after the last release, bisecting now.","status":"todo","priority":"high","assigneeId":"u-36","reporterId":"u-19","labels":{"__genie_dehydrated__":true,"kind":"array","preview":"Array(0)","path":["payload",19,"labels"],"size":0},"estimate":2,"createdAt":"2025-06-22T00:19:23.000Z","updatedAt":"2025-07-19T00:19:23.000Z","completedAt":null,"commentCount":0},{"id":"iss-21","key":"CORE-21","projectKey":"CORE","title":"Investigate database connection pool","description":"Reported by the frontend team. Moved to the next sprint, blocked on the API change.","status":"in_review","priority":"low","assigneeId":"u-13","reporterId":"u-26","labels":{"__genie_dehydrated__":true,"kind":"array","preview":"Array(2)","path":["payload",20,"labels"],"size":2},"estimate":3,"createdAt":"2025-11-22T06:36:42.000Z","updatedAt":"2026-01-18T06:36:42.000Z","completedAt":null,"commentCount":5},{"id":"iss-22","key":"CORE-22","projectKey":"CORE","title":"Remove SSO metadata refresh","description":"Reported by the infra team. Pushed a draft branch, would appreciate a second pair of eyes.","status":"todo","priority":"low","assigneeId":"u-20","reporterId":"u-25","labels":{"__genie_dehydrated__":true,"kind":"array","preview":"Array(2)","path":["payload",21,"labels"],"size":2},"estimate":8,"createdAt":"2025-08-31T19:56:23.000Z","updatedAt":"2025-10-08T19:56:23.000Z","completedAt":null,"commentCount":4},{"id":"iss-23","key":"CORE-23","projectKey":"CORE","title":"Add rate limiter headers","description":"Reported by the infra team. I can reproduce this on staging with a fresh account.","status":"todo","priority":"high","assigneeId":"u-22","reporterId":"u-6","labels":{"__genie_dehydrated__":true,"kind":"array","preview":"Array(2)","path":["payload",22,"labels"],"size":2},"estimate":3,"createdAt":"2025-03-20T14:05:06.000Z","updatedAt":"2025-04-20T14:05:06.000Z","completedAt":null,"commentCount":5},{"id":"iss-24","key":"CORE-24","projectKey":"CORE","title":"Migrate API key rotation","description":"Reported by the security team. The fix is behind the new flag, rolling out to 10%.","status":"in_progress","priority":"high","assigneeId":"u-15","reporterId":"u-6","labels":{"__genie_dehydrated__":true,"kind":"array","preview":"Array(1)","path":["payload",23,"labels"],"size":1},"estimate":null,"createdAt":"2025-05-01T19:51:55.000Z","updatedAt":"2025-05-08T19:51:55.000Z","completedAt":null,"commentCount":2},{"id":"iss-25","key":"CORE-25","projectKey":"CORE","title":"Add webhook retries","description":"Reported by the backend team. Customer success says three accounts are affected.","status":"in_progress","priority":"low","assigneeId":null,"reporterId":"u-18","labels":{"__genie_dehydrated__":true,"kind":"array","preview":"Array(0)","path":["payload",24,"labels"],"size":0},"estimate":5,"createdAt":"2025-09-13T11:03:45.000Z","updatedAt":"2025-09-24T11:03:45.000Z","completedAt":null,"commentCount":6},{"__genie_dehydrated__":true,"kind":"truncated","preview":"+3215 more items","path":["payload"],"size":3240}],"meta":{"requestId":"YHCSQgm7iawd3m8DAwGKv","requestStatus":"fulfilled"}},"renderEventIds":[],"reactWorkActive":false,"genieMs":0.3},{"sequence":2360,"actionId":"redux-store:1/action:2360","kind":"action","type":"issues/filtersChanged","label":"issues/filtersChanged","parentActionId":null,"at":1795078610656,"durationMs":1.3,"outcome":"returned","error":null,"rootStateChanged":true,"changedSlices":["issues"],"changedSlicesTruncated":false,"unrecordedNestedDispatches":0,"mutation":{"status":"none-detected","notScannedReason":null,"findings":[],"findingsOmitted":false,"objectsCompared":4,"scanTruncated":true},"payload":{"type":"issues/filtersChanged","payload":{"text":"c"}},"renderEventIds":["render:18:2","render:18:7","render:18:30","render:18:33","render:18:37"],"reactWorkActive":false,"genieMs":0.3}],"matched":5,"omittedBefore":0,"more":false,"nextAfterSequence":2360,"latestSequence":2943,"coverage":{"historyLimit":500,"evictedRecords":0,"unrecordedChanges":0,"mutationDetection":true,"libraryActions":{"recorded":false,"counted":2918,"byType":[{"kind":"action","type":"service/subscriptions/internal_probeSubscription","count":1959},{"kind":"thunk","type":null,"count":528},{"kind":"action","type":"service/executeQuery/rejected","count":262},{"kind":"action","type":"service/subscriptions/unsubscribeQueryResult","count":162},{"kind":"unrecorded-change","type":null,"count":3},{"kind":"action","type":"service/executeQuery/pending","count":2},{"kind":"action","type":"service/executeQuery/fulfilled","count":2}],"otherTypesCount":0}}},"session":{"sessionId":"3c16f9c7-a8d8-4fdb-bcc2-c694878cd0f0","logicalSessionId":"a07593a5-db3c-4fae-a8d8-4c337dd757ea"}}]

```

`/tmp/upd-d/chain-view1.json`:

```json
[{"schemaVersion":"2.0","tool":"react_render_causes","ok":true,"status":"ok","result":{"componentMatch":{"component":"AccountMenu","exact":true,"status":"matched","matchedNames":["AccountMenu"],"matchedNameCount":1,"similarNames":[]},"tracking":true,"commits":3,"documentCommitId":19,"observation":{"id":"observation:1","epoch":1,"startedAfterDocumentCommitId":16},"attribution":{"status":"current","startedAtDocumentCommitId":19,"completedAtDocumentCommitId":19,"startedAtAnalysisGeneration":20,"completedAtAnalysisGeneration":20},"view":"full","events":[{"renderEventId":"render:17:2","observationId":"observation:1","commitId":1,"documentCommitId":17,"componentId":9720383406120,"componentName":"AccountMenu","instance":{"fiberId":9720383406120,"mountId":"mount:1","key":null,"siblingIndex":3,"parent":{"fiberId":9720383406111,"name":"TopBar","key":null},"keyedParent":null,"logicalPath":"AppErrorBoundary[index=0] > Provider[index=0] > BrowserRouter[index=0] > Router[index=0] > ThemeProvider[index=0] > App[index=0] > Routes[index=0] > RenderedRoute[index=0] > RequireAuth[index=0] > Connect(AppShell)[index=0] > AppShell[index=0] > FeatureFlagsProvider[index=0] > <div>[index=0] > TopBar[index=0] > <header>[index=0] > <div>[index=3] > AccountMenu[index=3]","logicalIdentityEvidence":"positional","mountGeneration":1,"mountGenerationEvidence":"exact","hostSelector":null},"causes":[{"kind":"external-store","evidence":"inferred","reason":"external-store-snapshot-changed","hookIndex":4,"externalStoreIndex":0,"subscriberId":"subscriber:mount:1:0","selectionEqual":false,"subscriptionFired":true,"before":{"user":{"id":"u-1","name":"Dana Whitfield","email":"dana@acme.test","title":"Designer","team":"Infra"},"savedViewCount":0},"after":{"user":{"id":"u-1","name":"Dana Whitfield","email":"dana@acme.test","title":"Designer","team":"Infra"},"savedViewCount":0},"changedFields":[],"deepDiff":{"changes":[{"kind":"reference-only","path":""}],"visited":3,"truncated":false},"storeId":"external-store:1","storeLabel":"anonymous-external-store","selector":null,"equality":"object-is","fanout":null,"notificationId":null,"competingCandidates":["external-store-snapshot-identity-changed"],"redux":{"storeId":"redux-store:1","link":"subscription","evidence":"exact","reason":"dispatched-between-renders","actions":[{"actionId":"redux-store:1/action:1960","sequence":1960,"kind":"action","type":"savedViews/draftNameChanged","changedSlices":["savedViews"]}],"omittedActions":0},"hookProvenance":{"status":"unavailable","evidence":"unknown","reason":"shadow-render-disabled"}}],"necessity":"unnecessary","necessityReason":"inputs-unchanged","assessment":{"inputEvidence":"none-observed","observedInputKinds":[],"behaviorEvidence":{"subtreeHostMutations":{"status":"none-observed","count":0,"pendingSubtrees":0,"omittedByLimit":0,"callbackOnlyUpdates":0,"writes":[],"callbacks":[]},"scheduledEffects":{"status":"observed","count":2},"subtreeScheduledEffects":{"status":"observed","count":2},"unobservedDomains":["focus","url","network","transition","freshness","effect-execution"]},"optimizationSafety":"not-proven-safe","requiredValidation":["dom","aria","focus","url","network","transition"]},"inputCoverage":{"complete":true,"omittedInputs":0,"scanTruncated":false,"propsNotEnumerated":false},"source":{"file":"~/.t3/worktrees/genie-react/t3-9e64af67-f21cc60f9d8a6648/apps/realworld-legacy/src/layout/top-bar.tsx","line":32,"column":9,"functionName":null,"sourceMapConfidence":"served","role":"element-callsite"},"sourceAttribution":{"role":"usage-or-definition-fallback","evidence":"inferred"},"sourceOwnership":"app","isLibrary":false}],"omittedByLimit":0,"sourceClassification":{"complete":true,"affects":"result","totalCandidates":1,"evaluated":1,"app":1,"library":0,"unknown":0,"unknownComponents":[],"unknownComponentsOmitted":0},"renderEventRetention":{"evictedEvents":0,"earliestDocumentCommitId":17,"latestDocumentCommitId":19},"coverage":{"skippedCommitFibers":0,"droppedUnmountFibers":0,"analysisFailedFibers":0,"pausedCommits":0,"unobservedCommits":0,"refreshCommitsExcluded":0,"truncatedInputFibers":0,"propsNotEnumeratedFibers":0,"budgetExhaustedCommits":0,"budgetExhaustedSubsystems":[],"complete":true,"inputAttributionComplete":true,"semantics":"exact","coverageDomain":"render-causality","droppedRenderEvents":0}},"session":{"sessionId":"3774dc7a-50ed-43a7-b205-6de18fd54c29","logicalSessionId":"a07593a5-db3c-4fae-a8d8-4c337dd757ea"}},{"schemaVersion":"2.0","tool":"redux_actions","ok":true,"status":"ok","result":{"store":{"storeId":"redux-store:1","name":"app"},"records":[{"sequence":1960,"actionId":"redux-store:1/action:1960","kind":"action","type":"savedViews/draftNameChanged","label":"savedViews/draftNameChanged","parentActionId":null,"at":1795078653643,"durationMs":1.1,"outcome":"returned","error":null,"rootStateChanged":true,"changedSlices":["savedViews"],"changedSlicesTruncated":false,"unrecordedNestedDispatches":0,"mutation":{"status":"none-detected","notScannedReason":null,"findings":[],"findingsOmitted":false,"objectsCompared":4,"scanTruncated":true},"payload":{"type":"savedViews/draftNameChanged","payload":"S"},"renderEventIds":["render:17:2","render:17:7","render:17:26","render:17:30"],"reactWorkActive":false,"genieMs":0.1}],"matched":1,"omittedBefore":0,"more":false,"nextAfterSequence":1960,"latestSequence":2160,"coverage":{"historyLimit":500,"evictedRecords":0,"unrecordedChanges":0,"mutationDetection":true,"libraryActions":{"recorded":false,"counted":2135,"byType":[{"kind":"action","type":"service/subscriptions/internal_probeSubscription","count":1417},{"kind":"thunk","type":null,"count":408},{"kind":"action","type":"service/executeQuery/rejected","count":202},{"kind":"action","type":"service/subscriptions/unsubscribeQueryResult","count":102},{"kind":"action","type":"service/executeQuery/pending","count":2},{"kind":"unrecorded-change","type":null,"count":2},{"kind":"action","type":"service/executeQuery/fulfilled","count":2}],"otherTypesCount":0}}},"session":{"sessionId":"3774dc7a-50ed-43a7-b205-6de18fd54c29","logicalSessionId":"a07593a5-db3c-4fae-a8d8-4c337dd757ea"}}]

```

`/tmp/upd-d/chain.json`:

```json
[{"schemaVersion":"2.0","tool":"react_render_causes","ok":true,"status":"ok","result":{"componentMatch":{"component":"AccountMenu","exact":true,"status":"matched","matchedNames":["AccountMenu"],"matchedNameCount":1,"similarNames":[]},"tracking":true,"commits":3,"documentCommitId":20,"observation":{"id":"observation:1","epoch":1,"startedAfterDocumentCommitId":17},"attribution":{"status":"current","startedAtDocumentCommitId":20,"completedAtDocumentCommitId":20,"startedAtAnalysisGeneration":21,"completedAtAnalysisGeneration":21},"view":"full","events":[{"renderEventId":"render:19:735","observationId":"observation:1","commitId":2,"documentCommitId":19,"componentId":17507494658088,"componentName":"AccountMenu","instance":{"fiberId":17507494658088,"mountId":"mount:1","key":null,"siblingIndex":3,"parent":{"fiberId":17507494658079,"name":"TopBar","key":null},"keyedParent":null,"logicalPath":"AppErrorBoundary[index=0] > Provider[index=0] > BrowserRouter[index=0] > Router[index=0] > ThemeProvider[index=0] > App[index=0] > Routes[index=0] > RenderedRoute[index=0] > RequireAuth[index=0] > Connect(AppShell)[index=0] > AppShell[index=0] > FeatureFlagsProvider[index=0] > <div>[index=0] > TopBar[index=0] > <header>[index=0] > <div>[index=3] > AccountMenu[index=3]","logicalIdentityEvidence":"positional","mountGeneration":1,"mountGenerationEvidence":"exact","hostSelector":null},"causes":[{"kind":"external-store","evidence":"inferred","reason":"external-store-snapshot-changed","hookIndex":4,"externalStoreIndex":0,"subscriberId":"subscriber:mount:1:0","selectionEqual":false,"subscriptionFired":true,"before":{"user":{"id":"u-1","name":"Dana Whitfield","email":"dana@acme.test","title":"Designer","team":"Infra"},"savedViewCount":0},"after":{"user":{"id":"u-1","name":"Dana Whitfield","email":"dana@acme.test","title":"Designer","team":"Infra"},"savedViewCount":0},"changedFields":[],"deepDiff":{"changes":[{"kind":"reference-only","path":""}],"visited":3,"truncated":false},"storeId":"external-store:1","storeLabel":"anonymous-external-store","selector":null,"equality":"object-is","fanout":null,"notificationId":null,"competingCandidates":["external-store-snapshot-identity-changed"],"redux":{"storeId":"redux-store:1","link":"subscription","evidence":"exact","reason":"dispatched-between-renders","actions":[{"actionId":"redux-store:1/action:2561","sequence":2561,"kind":"action","type":"savedViews/draftNameChanged","changedSlices":["savedViews"]}],"omittedActions":0},"hookProvenance":{"status":"unavailable","evidence":"unknown","reason":"shadow-render-disabled"}}],"necessity":"unnecessary","necessityReason":"inputs-unchanged","assessment":{"inputEvidence":"none-observed","observedInputKinds":[],"behaviorEvidence":{"subtreeHostMutations":{"status":"none-observed","count":0,"pendingSubtrees":0,"omittedByLimit":0,"callbackOnlyUpdates":0,"writes":[],"callbacks":[]},"scheduledEffects":{"status":"observed","count":2},"subtreeScheduledEffects":{"status":"observed","count":2},"unobservedDomains":["focus","url","network","transition","freshness","effect-execution"]},"optimizationSafety":"not-proven-safe","requiredValidation":["dom","aria","focus","url","network","transition"]},"inputCoverage":{"complete":true,"omittedInputs":0,"scanTruncated":false,"propsNotEnumerated":false},"source":{"file":"~/.t3/worktrees/genie-react/t3-9e64af67-f21cc60f9d8a6648/apps/realworld-legacy/src/layout/top-bar.tsx","line":32,"column":9,"functionName":null,"sourceMapConfidence":"served","role":"element-callsite"},"sourceAttribution":{"role":"usage-or-definition-fallback","evidence":"inferred"},"sourceOwnership":"app","isLibrary":false}],"omittedByLimit":0,"sourceClassification":{"complete":true,"affects":"result","totalCandidates":1,"evaluated":1,"app":1,"library":0,"unknown":0,"unknownComponents":[],"unknownComponentsOmitted":0},"renderEventRetention":{"evictedEvents":39,"earliestDocumentCommitId":18,"latestDocumentCommitId":20},"coverage":{"skippedCommitFibers":0,"droppedUnmountFibers":0,"analysisFailedFibers":0,"pausedCommits":0,"unobservedCommits":0,"refreshCommitsExcluded":0,"truncatedInputFibers":0,"propsNotEnumeratedFibers":0,"budgetExhaustedCommits":0,"budgetExhaustedSubsystems":[],"complete":false,"inputAttributionComplete":true,"semantics":"lower-bound","coverageDomain":"render-causality","droppedRenderEvents":39}},"session":{"sessionId":"b9f9b08c-5b7e-4f12-833e-e11e00a97de3","logicalSessionId":"a07593a5-db3c-4fae-a8d8-4c337dd757ea"}},{"schemaVersion":"2.0","tool":"redux_actions","ok":true,"status":"ok","result":{"store":{"storeId":"redux-store:1","name":"app"},"records":[{"sequence":2360,"actionId":"redux-store:1/action:2360","kind":"action","type":"savedViews/draftNameChanged","label":"savedViews/draftNameChanged","parentActionId":null,"at":1795078684174,"durationMs":1,"outcome":"returned","error":null,"rootStateChanged":true,"changedSlices":["savedViews"],"changedSlicesTruncated":false,"unrecordedNestedDispatches":0,"mutation":{"status":"none-detected","notScannedReason":null,"findings":[],"findingsOmitted":false,"objectsCompared":4,"scanTruncated":true},"payload":{"type":"savedViews/draftNameChanged","payload":"S"},"renderEventIds":["render:18:2","render:18:7","render:18:26","render:18:30"],"reactWorkActive":false,"genieMs":0},{"sequence":2561,"actionId":"redux-store:1/action:2561","kind":"action","type":"savedViews/draftNameChanged","label":"savedViews/draftNameChanged","parentActionId":null,"at":1795078684200,"durationMs":1.1,"outcome":"returned","error":null,"rootStateChanged":true,"changedSlices":["savedViews"],"changedSlicesTruncated":false,"unrecordedNestedDispatches":0,"mutation":{"status":"none-detected","notScannedReason":null,"findings":[],"findingsOmitted":false,"objectsCompared":4,"scanTruncated":true},"payload":{"type":"savedViews/draftNameChanged","payload":"Sp"},"renderEventIds":["render:19:735","render:19:740","render:19:759","render:19:763"],"reactWorkActive":false,"genieMs":0}],"matched":2,"omittedBefore":0,"more":false,"nextAfterSequence":2561,"latestSequence":2761,"coverage":{"historyLimit":500,"evictedRecords":0,"unrecordedChanges":0,"mutationDetection":true,"libraryActions":{"recorded":false,"counted":2735,"byType":[{"kind":"action","type":"service/subscriptions/internal_probeSubscription","count":2017},{"kind":"thunk","type":null,"count":408},{"kind":"action","type":"service/executeQuery/rejected","count":202},{"kind":"action","type":"service/subscriptions/unsubscribeQueryResult","count":102},{"kind":"action","type":"service/executeQuery/pending","count":2},{"kind":"unrecorded-change","type":null,"count":2},{"kind":"action","type":"service/executeQuery/fulfilled","count":2}],"otherTypesCount":0}}},"session":{"sessionId":"b9f9b08c-5b7e-4f12-833e-e11e00a97de3","logicalSessionId":"a07593a5-db3c-4fae-a8d8-4c337dd757ea"}}]

```

