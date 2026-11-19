# Evidence: mutation-succeeded-list-did-not-update

- Date: 2026-11-19
- Commit: `6867352ba46ec3998fe8cda0ba915536fddfa666`
- App: `evals/fixture-app` (eval fixture, screen `tasks`, seeded bug from `evals/tasks/query-key-mismatch.json`)
- URL: `http://localhost:5224/?screen=tasks` (dev server started with `npx vite --port 5224 --strictPort` from `evals/fixture-app`; Vite bound `[::1]:5224`)
- Driver: agent-browser 0.43.0, session `art-m4`. Genie CLI 1.0.2 from this checkout (`pnpm install && pnpm build`).
- The reference fix was applied only between the two `git diff` / `git checkout` markers below and reverted with git. It is not committed.

Every command below ran in this order from `evals/fixture-app`. Output is complete and untrimmed. `[exit N]` is the command's exit code.

```text

$ agent-browser --session art-m4 open "http://localhost:5224/?screen=tasks"
[agent-browser] launched browser
✓ Acme Console
  http://localhost:5224/?screen=tasks
[exit 0]

$ npx genie-react status --session art-m4 --wait 15000
selectedBridgeUrl: "ws://[::1]:5224/__genie/ws"
sessionSelector:
  requested: art-m4
  source: flag
  resolvedSessionId: b9855d12-d665-4819-9b76-969e8062ecb0
  implicit: false
  agentBrowser: {session:art-m4,via:selector,logicalSessionId:ec02058d-ea72-4c6a-bfed-e780478b9162}
connected: true
ready: true
sessionId: b9855d12-d665-4819-9b76-969e8062ecb0
app:
  name: "Acme Console"
  url: "http://localhost:5224/?screen=tasks"
  reactVersion: 19.2.7
  reactMounted: true
domains: [session,react,memory,perf,plugin,timeline,query]
toolCount: 78
sessions[1] (sessionId {fields}):
  b9855d12-d665-4819-9b76-969e8062ecb0 {logicalSessionId:ec02058d-ea72-4c6a-bfed-e780478b9162,documentGeneration:2,logicalSessionCollision:false,collisionWithSessionIds:[],app:{name:"Acme Console",url:"http://localhost:5224/?screen=tasks",reactVersion:19.2.7,reactMounted:true},domains:[session,react,memory,perf,plugin,timeline,query],toolCount:78,connectedAt:1795060457840,ready:true,readyAt:1795060457845,current:true,origin:http://localhost:5224,runtimeVersion:1.0.2}
warnings: []
hub: {version:1.0.2,protocol:1}
[exit 0]

$ agent-browser --session art-m4 snapshot -i
- generic "SearchDashboardReportsTasksOverviewAccountCartTasksAdd taskRenew TLS certificateRotate API keys" [ref=e1] clickable [onclick]
  - navigation "Screens" [ref=e2]
    - link "Search" [ref=e3]
    - link "Dashboard" [ref=e4]
    - link "Reports" [ref=e5]
    - link "Tasks" [ref=e6]
    - link "Overview" [ref=e7]
    - link "Account" [ref=e8]
    - link "Cart" [ref=e9]
  - heading "Tasks" [level=1, ref=e10]
  - textbox "New task title" [ref=e11]
  - button "Add task" [ref=e12]
[exit 0]

$ agent-browser --session art-m4 get text 'ul[aria-label="Tasks"]'
Renew TLS certificate
Rotate API keys
[exit 0]

$ npx genie-react call query_list --session art-m4 '{}'
queries[1]:
  - {queryHash:"[\"tasks\",\"list\"]",queryKey:[tasks,list],status:success,fetchStatus:idle,isStale:true,isActive:true,isDisabled:false,hasFetched:true,isCached:true,observerCount:1,dataUpdatedAt:1795060457935,recentFetches:0}
total: 1
churn: {orphaned:0,families:[]}
[exit 0]

$ npx genie-react verify begin --help
verify: Declare claims, drive the UI, then get a pass, fail, refused or inconclusive verdict
arguments:
  <action> (required; one of begin, end, show, abort)  begin starts a locked window; end settles, freezes and decides; show reads a stored verdict; abort releases the window
  <id> (optional)  The verification ID begin printed; required for end, show and abort
options:
  -h, --help  Describe commands, arguments, options and output; JSON with --json
  --version  Print the CLI package version; a JSON object with --json
  --json  Print JSON instead of compact text; batch collects results into one JSON array (not with --ndjson)
  --max-bytes <value>  Bound stdout bytes including newlines; an oversized call or tools result is written, in the output format, to a private per-user temp directory and replaced by a truncation envelope with its path and retry suggestions (default 102400; 512..50000000)
  --url <value>  Override the bridge WebSocket URL; otherwise use GENIE_BRIDGE_URL or discovery
  --connect-timeout <value>  Bound bridge connection startup in milliseconds (default 8000; 100..120000)
  --session <value>  Target a physical ID, logical ID or unique name, else the tab an agent-browser session of that name shows; overrides GENIE_SESSION
  --verbose  Emit bootstrap and connection diagnostics on stderr (JSONL with --json) (default false)
  --wait <value>  Wait for a ready app in milliseconds (default 15000; 1..120000)
  --timeout <value>  Set a positive call timeout in milliseconds; bridge clamps it to 1000–120000 (> 0)
  --name <value>  verify begin: label for the run, 1–80 characters; not part of its rerun history
  --claim <value>  verify begin: one claim in the verify DSL, repeatable up to 20 (10 distinct targets): render <Name>[@file][[key=k]] max|min <N> [counting updates] [allow-remount]; render <Name> only <cause>[,<cause>]; effect <Name>[#index] max <N> | settles; boundaries clean | clean-at-end. verify show: the claim number whose evidence to print (not with --claims) {multiple:true}
  --claims <value>  verify begin: path to a JSON document {name?, claims, budget?, settle?, tailMs?}, or - for stdin; the schema is devtools_verify_begin in tools (not with --claim)
  --budget <value>  verify begin: render analysis budget as one JSON object, such as {"fiberLimit":1200}; a budget_exhausted refusal prints the one to use
  --quiet-ms <value>  verify begin: how long every settle domain must stay quiet before the freeze (default 500; 100..5000)
  --timeout-ms <value>  verify begin: how long verify end waits for the app to settle; unrelated to the call timeout --timeout (default 10000; 500..60000)
  --tail-ms <value>  verify begin: how long to keep recording after the app settles; default quiet-ms (at least 500), and for effect settles claims the larger of twice quiet-ms and 2000 (0..30000)
  --domains <value>  verify begin: comma-separated settle domains, from react, query and router; default every domain the app advertises, and react is required
  --max-duration <value>  verify begin: milliseconds before the hub expires an unfinished window and releases its lock (default 300000; 10000..1800000)
  --allow-overrides  verify begin: allow overrides and simulated Query state in the window; the verdict then says they were active (default false)
  --section <value>  verify show: guards, or raw:<tool> for a retained tool result such as raw:react_get_renders (one of react, effects, query, router, memory, performance; not with --claim)
output:
  default: text
  json: json
  diagnostics: "text lines on stderr; jsonl with --json"
  defaultMaxBytes: 102400
  limitScope: "whole result"
  exits:
    0: "pass, or begin and abort succeeded"
    1: "fail: the evidence proves a claim false"
    2: "invalid claim, option or ID"
    3: "the hub refused the connection"
    4: "refused: the evidence is not good enough; each refusal names a fix"
    5: "inconclusive: complete evidence that does not decide the claim"
    69: "no hub or app answered"
    124: "the call timed out; verify end <id> again returns the stored verdict"
    130: "interrupted by SIGINT"
notes:
  Claims are fixed at begin. Drive the UI with your own driver between begin and end; Genie does not drive it and does not check what the user sees.
  end settles every settle domain with recording on, records the tail, freezes, and decides. A failure decides the run, then a refusal, then an inconclusive. Upper-bound claims pass only on exact evidence.
  While a window records, react_clear_renders, react_profile_start, react_profile_stop, devtools_interaction_begin and the override tools are refused on that document; abort releases it, and the hub expires it after --max-duration.
  Add a positive control such as render <Name> min 1 on a component the interaction must change, so an interaction that never reached the app fails instead of refusing.
examples:
  $ pnpm exec genie-react verify begin --session my-agent --name 'type cert in filter' --claim 'render StatusBadge max 0' --claim 'render SearchScreen min 1' --claim 'boundaries clean'
  $ pnpm exec genie-react verify end '<id>' --session my-agent
  $ pnpm exec genie-react verify show '<id>' --claim 1 --session my-agent
  $ pnpm exec genie-react verify abort '<id>' --session my-agent
[exit 0]

$ npx genie-react verify begin --session art-m4 --name 'add a task' --claim 'render TaskList min 1' --claim 'render AddTaskForm min 1' --claim 'boundaries clean'
recording vfy_1bc13cc2-7292-4984-9339-900d959670ee "add a task"
  url "http://localhost:5224/?screen=tasks"
  1 null render TaskList min 1  {}
  2 null render AddTaskForm min 1  {}
  3 null boundaries clean  {}
window: {observationId:observation:1,startDocumentCommitId:2,domains:[react,query],quietMs:500,timeoutMs:10000,tailMs:500}
next: $ pnpm exec genie-react verify end vfy_1bc13cc2-7292-4984-9339-900d959670ee --session art-m4
session: {sessionId:b9855d12-d665-4819-9b76-969e8062ecb0,logicalSessionId:ec02058d-ea72-4c6a-bfed-e780478b9162,documentGeneration:2}
schemaVersion: "1.0"
targets: [{target:{component:TaskList},status:resolved,instances:1,source:/src/screens/tasks/TasksScreen.tsx},{target:{component:AddTaskForm},status:resolved,instances:1,source:/src/screens/tasks/TasksScreen.tsx}]
startedAt: 2026-11-19T03:54:37.793Z
expiresAt: 2026-11-19T03:59:37.809Z
request: {budget:{fiberLimit:250,operationLimit:20000,timeLimitMs:8,targetOperationReserve:4000,targetTimeReserveMs:4,adaptive:true},settle:{quietMs:500,timeoutMs:10000},maxDurationMs:300000,allowOverrides:false}
[exit 0]

$ agent-browser --session art-m4 fill 'input[aria-label="New task title"]' 'Archive Q3 invoices'
✓ Done
[exit 0]

$ agent-browser --session art-m4 click 'button[type=submit]'
✓ Done
[exit 0]

$ agent-browser --session art-m4 wait --text Saved
Saved
[exit 0]

$ npx genie-react verify end vfy_1bc13cc2-7292-4984-9339-900d959670ee --session art-m4
fail vfy_1bc13cc2-7292-4984-9339-900d959670ee "add a task"  3 commits, quiet after 622 ms (react, query)
  url "http://localhost:5224/?screen=tasks"
  1 fail render TaskList min 1  {renders:0,mounts:0,updates:0,remounts:0,semantics:exact,instances:1,activeInstances:1}
      claim: {kind:renders,target:{component:TaskList},min:1,counting:renders,allowRemount:false}
      deciding: []
  2 pass render AddTaskForm min 1  {renders:3,mounts:0,updates:3,remounts:0,semantics:exact,instances:1,activeInstances:1}
      claim: {kind:renders,target:{component:AddTaskForm},min:1,counting:renders,allowRemount:false}
      deciding: [{kind:instance,mountId:mount:2,renders:3,mounts:0,updates:3,mountGeneration:1,latestDocumentCommitId:5,source:/src/screens/tasks/TasksScreen.tsx:45:7}]
  3 pass boundaries clean  {caughtDuringWindow:0,caughtAtEnd:0}
      claim: {kind:boundaries-clean,scope:window}
      deciding: [{kind:boundary-log,scope:window,complete:true,afterDocumentCommitId:2}]
      caveats: [uncaught-errors-outside-boundaries-unobserved]
window: {observationId:observation:1,startDocumentCommitId:2,settledDocumentCommitId:5,frozenDocumentCommitId:5,commits:3,settle:{outcome:met,quietMs:500,timeoutMs:10000,waitedMs:622,domains:{react:met,query:met}},tail:{ms:500,commits:0},environment:{bundle:development,strictMode:on,renderCollection:available,visibility:document}}
! ui-outcome-not-observed: Genie does not check the screen; confirm it with the UI driver
attempt 1 for these claims on this tab
evidence: $ pnpm exec genie-react verify show vfy_1bc13cc2-7292-4984-9339-900d959670ee --claim 1 --session art-m4
session: {sessionId:b9855d12-d665-4819-9b76-969e8062ecb0,logicalSessionId:ec02058d-ea72-4c6a-bfed-e780478b9162,documentGeneration:2}
schemaVersion: "1.0"
exitCode: 1
stage: end
ledger: {fingerprint:cf_6975f08a5abf,scope:logical-session,storage:memory,attempt:1,history:[],codeChangedSincePrevious:null,failsOnSameCode:0}
evidence: {retained:true,tools:[react_get_renders,react_component_cohort,react_list_overrides,query_is_fetching,react_refresh_events,browser_visibility,react_profile_stop,react_error_state]}
startedAt: 2026-11-19T03:54:37.793Z
endedAt: 2026-11-19T03:54:43.604Z
request: {budget:{fiberLimit:250,operationLimit:20000,timeLimitMs:8,targetOperationReserve:4000,targetTimeReserveMs:4,adaptive:true},settle:{quietMs:500,timeoutMs:10000},maxDurationMs:300000,allowOverrides:false}
[exit 1]

$ agent-browser --session art-m4 get text 'ul[aria-label="Tasks"]'
Renew TLS certificate
Rotate API keys
[exit 0]

$ npx genie-react call query_invalidations --session art-m4 '{}'
calls[1]:
  - {sequence:1,method:invalidateQueries,timestamp:1795060482111,byGenie:false,filters:{queryKey:[task,list],exact:false,type:null,refetchType:null,predicate:false},matchedCount:0,matched:[],nearMisses:[],stack:["at QueryClient.wrapper (http://localhost:5224/@fs~/.t3/worktrees/genie-react/ali-articles-ui-states--82d5c89ab8656bfc/packages/genie-react/dist/query-C49AIejT.js:123:5)","at Object.onSuccess (http://localhost:5224/src/screens/tasks/taskQueries.ts:17:32)","at Mutation.execute (http://localhost:5224/.vite/deps/modern-CUbVEGj4.js?v=12c06728:1669:34)"]}
omittedByLimit: 0
coverage:
  methods: [invalidateQueries,refetchQueries,resetQueries,removeQueries]
  since: 1795060457816
[exit 0]

$ npx genie-react call query_get --session art-m4 '{"queryKey":["tasks","list"]}'
queryHash: "[\"tasks\",\"list\"]"
queryKey: [tasks,list]
status: success
fetchStatus: idle
isStale: true
isActive: true
isInvalidated: false
observerCount: 1
hasQueryFn: true
gcTime: 300000
dataUpdatedAt: 1795060457935
errorUpdatedAt: 0
dataUpdateCount: 1
errorUpdateCount: 0
fetchFailureCount: 0
fetchCount: 1
recentFetches: 0
fetchMeta: null
data: [{id:1,title:"Renew TLS certificate"},{id:2,title:"Rotate API keys"}]
observersOmitted: 0
observers[1]:
  - {observerId:query-observer:1,identityStatus:current,notificationPolicy:{mode:auto-tracked,trackedFieldsAvailable:true,fields:[data,isPending]},deliveryEvidence:public-track-prop-observed,hasSelect:false,enabled:default,currentResult:{data:[{__genie_dehydrated__:true,kind:object,preview:"{…}",path:[data,0]},{__genie_dehydrated__:true,kind:object,preview:"{…}",path:[data,1]}],dataUpdatedAt:1795060457935,error:null,errorUpdatedAt:0,failureCount:0,failureReason:null,errorUpdateCount:0,isError:false,isFetched:true,isFetchedAfterMount:true,isFetching:false,isLoading:false,isPending:false,isLoadingError:false,isInitialLoading:false,isPaused:false,isPlaceholderData:false,isRefetchError:false,isRefetching:false,isStale:true,isSuccess:true,isEnabled:true,refetch:{__genie_dehydrated__:true,kind:function,preview:"ƒ bound refetch()",path:[refetch]},status:success,fetchStatus:idle,promise:{__genie_dehydrated__:true,kind:promise,preview:Promise,path:[promise]}},resultFields:[data,dataUpdatedAt,error,errorUpdatedAt,failureCount,failureReason,errorUpdateCount,isError,isFetched,isFetchedAfterMount,isFetching,isLoading,isPending,isLoadingError,isInitialLoading,isPaused,isPlaceholderData,isRefetchError,isRefetching,isStale,isSuccess,isEnabled,refetch,status,fetchStatus,promise],subscriberObservationStatus:not-observed,subscriber:null}
[exit 0]

$ git diff  (reference fix applied temporarily)
diff --git a/evals/fixture-app/src/screens/tasks/taskQueries.ts b/evals/fixture-app/src/screens/tasks/taskQueries.ts
index bb4e8c6..5354854 100644
--- a/evals/fixture-app/src/screens/tasks/taskQueries.ts
+++ b/evals/fixture-app/src/screens/tasks/taskQueries.ts
@@ -14,6 +14,6 @@ export function useAddTask() {
   const queryClient = useQueryClient()
   return useMutation({
     mutationFn: api.addTask,
-    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['task', 'list'] }),
+    onSuccess: () => queryClient.invalidateQueries({ queryKey: taskKeys.list() }),
   })
 }

$ agent-browser --session art-m4 open "http://localhost:5224/?screen=tasks"
✓ Acme Console
  http://localhost:5224/?screen=tasks
[exit 0]

$ npx genie-react status --session art-m4 --wait 15000 --json | jq -c "{ready,url:.app.url}"
{"ready":true,"url":"http://localhost:5224/?screen=tasks"}
[exit 0]

$ agent-browser --session art-m4 get text 'ul[aria-label="Tasks"]'
Renew TLS certificate
Rotate API keys
[exit 0]

$ npx genie-react verify begin --session art-m4 --name 'add a task' --claim 'render TaskList min 1' --claim 'render AddTaskForm min 1' --claim 'boundaries clean'
recording vfy_f3161a72-a360-43de-9b86-a0c5c3ec9034 "add a task"
  url "http://localhost:5224/?screen=tasks"
  1 null render TaskList min 1  {}
  2 null render AddTaskForm min 1  {}
  3 null boundaries clean  {}
window: {observationId:observation:1,startDocumentCommitId:2,domains:[react,query],quietMs:500,timeoutMs:10000,tailMs:500}
next: $ pnpm exec genie-react verify end vfy_f3161a72-a360-43de-9b86-a0c5c3ec9034 --session art-m4
session: {sessionId:bf42ab14-e596-4a4e-ad37-56d69e846406,logicalSessionId:ec02058d-ea72-4c6a-bfed-e780478b9162,documentGeneration:3}
schemaVersion: "1.0"
targets: [{target:{component:TaskList},status:resolved,instances:1,source:/src/screens/tasks/TasksScreen.tsx},{target:{component:AddTaskForm},status:resolved,instances:1,source:/src/screens/tasks/TasksScreen.tsx}]
startedAt: 2026-11-19T03:55:03.285Z
expiresAt: 2026-11-19T04:00:03.291Z
request: {budget:{fiberLimit:250,operationLimit:20000,timeLimitMs:8,targetOperationReserve:4000,targetTimeReserveMs:4,adaptive:true},settle:{quietMs:500,timeoutMs:10000},maxDurationMs:300000,allowOverrides:false}
[exit 0]

$ agent-browser --session art-m4 fill 'input[aria-label="New task title"]' 'Archive Q3 invoices'
✓ Done
[exit 0]

$ agent-browser --session art-m4 click 'button[type=submit]'
✓ Done
[exit 0]

$ agent-browser --session art-m4 wait --text Saved
Saved
[exit 0]

$ npx genie-react verify end vfy_f3161a72-a360-43de-9b86-a0c5c3ec9034 --session art-m4
pass vfy_f3161a72-a360-43de-9b86-a0c5c3ec9034 "add a task"  3 commits, quiet after 621 ms (react, query)
  url "http://localhost:5224/?screen=tasks"
  1 pass render TaskList min 1  {renders:1,mounts:0,updates:1,remounts:0,semantics:exact,instances:1,activeInstances:1}
      claim: {kind:renders,target:{component:TaskList},min:1,counting:renders,allowRemount:false}
      deciding: [{kind:instance,mountId:mount:1,renders:1,mounts:0,updates:1,mountGeneration:1,latestDocumentCommitId:5,source:/src/screens/tasks/TasksScreen.tsx:46:7}]
  2 pass render AddTaskForm min 1  {renders:3,mounts:0,updates:3,remounts:0,semantics:exact,instances:1,activeInstances:1}
      claim: {kind:renders,target:{component:AddTaskForm},min:1,counting:renders,allowRemount:false}
      deciding: [{kind:instance,mountId:mount:2,renders:3,mounts:0,updates:3,mountGeneration:1,latestDocumentCommitId:5,source:/src/screens/tasks/TasksScreen.tsx:45:7}]
  3 pass boundaries clean  {caughtDuringWindow:0,caughtAtEnd:0}
      claim: {kind:boundaries-clean,scope:window}
      deciding: [{kind:boundary-log,scope:window,complete:true,afterDocumentCommitId:2}]
      caveats: [uncaught-errors-outside-boundaries-unobserved]
window: {observationId:observation:1,startDocumentCommitId:2,settledDocumentCommitId:5,frozenDocumentCommitId:5,commits:3,settle:{outcome:met,quietMs:500,timeoutMs:10000,waitedMs:621,domains:{react:met,query:met}},tail:{ms:500,commits:0},environment:{bundle:development,strictMode:on,renderCollection:available,visibility:document}}
! ui-outcome-not-observed: Genie does not check the screen; confirm it with the UI driver
attempt 2 for these claims on this tab; previous fail vfy_1bc13cc2-7292-4984-9339-900d959670ee; document reloaded since
evidence: $ pnpm exec genie-react verify show vfy_f3161a72-a360-43de-9b86-a0c5c3ec9034 --session art-m4
session: {sessionId:bf42ab14-e596-4a4e-ad37-56d69e846406,logicalSessionId:ec02058d-ea72-4c6a-bfed-e780478b9162,documentGeneration:3}
schemaVersion: "1.0"
exitCode: 0
stage: end
ledger: {fingerprint:cf_6975f08a5abf,scope:logical-session,storage:memory,attempt:2,history:[{verificationId:vfy_1bc13cc2-7292-4984-9339-900d959670ee,verdict:fail,reasons:[],endedAt:2026-11-19T03:54:43.604Z}],codeChangedSincePrevious:document-reloaded,failsOnSameCode:0}
evidence: {retained:true,tools:[react_get_renders,react_component_cohort,react_list_overrides,query_is_fetching,react_refresh_events,browser_visibility,react_profile_stop,react_error_state]}
startedAt: 2026-11-19T03:55:03.285Z
endedAt: 2026-11-19T03:55:10.381Z
request: {budget:{fiberLimit:250,operationLimit:20000,timeLimitMs:8,targetOperationReserve:4000,targetTimeReserveMs:4,adaptive:true},settle:{quietMs:500,timeoutMs:10000},maxDurationMs:300000,allowOverrides:false}
[exit 0]

$ agent-browser --session art-m4 get text 'ul[aria-label="Tasks"]'
Renew TLS certificate
Rotate API keys
Archive Q3 invoices
[exit 0]

$ npx genie-react call query_invalidations --session art-m4 '{}'
calls[1]:
  - {sequence:1,method:invalidateQueries,timestamp:1795060508770,byGenie:false,filters:{queryKey:[tasks,list],exact:false,type:null,refetchType:null,predicate:false},matchedCount:1,matched:[{queryHash:"[\"tasks\",\"list\"]",queryKey:[tasks,list],isActive:true,observerCount:1}],nearMisses:[],stack:["at QueryClient.wrapper (http://localhost:5224/@fs~/.t3/worktrees/genie-react/ali-articles-ui-states--82d5c89ab8656bfc/packages/genie-react/dist/query-C49AIejT.js:123:5)","at Object.onSuccess (http://localhost:5224/src/screens/tasks/taskQueries.ts?t=1795060495112:17:32)","at Mutation.execute (http://localhost:5224/.vite/deps/modern-CUbVEGj4.js?v=12c06728:1669:34)"]}
omittedByLimit: 0
coverage:
  methods: [invalidateQueries,refetchQueries,resetQueries,removeQueries]
  since: 1795060502755
[exit 0]

$ npx genie-react call query_get --session art-m4 '{"queryKey":["tasks","list"]}' --fields status,isInvalidated,dataUpdateCount,fetchCount,data
[1]:
  - {status:success,isInvalidated:false,dataUpdateCount:2,fetchCount:2,data:[{id:1,title:"Renew TLS certificate"},{id:2,title:"Rotate API keys"},{id:3,title:"Archive Q3 invoices"}]}
[exit 0]

$ git checkout -- src/screens/tasks/taskQueries.ts   (fix reverted)

$ agent-browser --session art-m4 open "http://localhost:5224/?screen=tasks"
✓ Acme Console
  http://localhost:5224/?screen=tasks
[exit 0]

$ npx genie-react status --session art-m4 --wait 15000 --json | jq -c "{ready,url:.app.url}"
{"ready":true,"url":"http://localhost:5224/?screen=tasks"}
[exit 0]

$ agent-browser --session art-m4 fill 'input[aria-label="New task title"]' 'Archive Q3 invoices'
✓ Done
[exit 0]

$ agent-browser --session art-m4 click 'button[type=submit]'
✓ Done
[exit 0]

$ agent-browser --session art-m4 wait --text Saved
Saved
[exit 0]

$ agent-browser --session art-m4 get text 'ul[aria-label="Tasks"]'
Renew TLS certificate
Rotate API keys
[exit 0]

$ npx genie-react call query_invalidations --session art-m4 '{}' --json | jq -c '.calls[] | {queryKey:.filters.queryKey,matchedCount,nearMisses}'
{"queryKey":["task","list"],"matchedCount":0,"nearMisses":[]}
[exit 0]

$ npx genie-react tools query_refetch --session art-m4 | head -5
query_refetch "Refetch queries"
description: "Refetch matching queries immediately. Operates on existing cache entries; use query_fetch when you also want the resolved data returned."
group: action
inputJsonSchema {$schema:https://json-schema.org/draft/2020-12/schema,type:object}: (arguments; name? is optional)
  queryKey?: array items:{} — "Query key prefix to match, e.g. [\"todos\"]. Omit to target all queries."
[exit 0]

$ npx genie-react call query_refetch --session art-m4 '{"queryKey":["tasks","list"]}'
ok: true
matched: 1
queries: [{queryHash:"[\"tasks\",\"list\"]",queryKey:[tasks,list],status:success,fetchStatus:idle}]
[exit 0]

$ agent-browser --session art-m4 get text 'ul[aria-label="Tasks"]'
Renew TLS certificate
Rotate API keys
Archive Q3 invoices
[exit 0]
```
