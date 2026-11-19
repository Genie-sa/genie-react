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
