# Evidence: clicked 7 days, got 90 days

- Date: 2026-11-19 (UTC times appear in the log)
- Commit: `6867352ba46ec3998fe8cda0ba915536fddfa666` (`git rev-parse HEAD`), app source unmodified except for the temporary fix shown below, reverted with `git checkout`
- App: `apps/realworld-legacy` (Acme Tracker), React 18.3.1 in StrictMode, webpack 5 dev server
- URL: http://127.0.0.1:5313/reports
- Genie CLI and hub: 1.0.2 (workspace build), hub on port 15213, session `art-l3`, driver agent-browser

## Setup

```bash
pnpm install && pnpm build && pnpm install   # the second install links the freshly built genie-react bin into the app
cd apps/realworld-legacy
GENIE_HUB_PORT=15213 pnpm hub
PORT=5313 GENIE_HUB_PORT=15213 pnpm dev
```

The brief assigned dev port 5213. Another writer's Genie hub already listened on 5213, so the dev server ran on 5313.
Every command below ran from `apps/realworld-legacy` unless it says "(repo root)". Each block is the command, its full output, and its exit code.

The session was already signed in as dana@acme.test from the activity article run (`app_sign_in`, logged in effect-fetches-on-every-keystroke.md).
The first `timeline_start` line's `[exit 0]` was written by the logging wrapper after an `echo`, not captured from the CLI. The call returned the JSON shown, and the next step used its ID.
Lines starting with `##` are notes added between commands. In the verify loops, the terminal showed only the verdict lines; the log keeps the full output.

## Log

```text
$ date -u +%Y-%m-%dT%H:%M:%SZ; git rev-parse HEAD; git status --short
2026-11-19T03:54:57Z
6867352ba46ec3998fe8cda0ba915536fddfa666
## t3/articles-legacy-effects-races
[exit 0]

$ agent-browser --session art-l3 open http://127.0.0.1:5313/reports
✓ Acme Tracker
  http://127.0.0.1:5313/reports
[exit 0]

$ agent-browser --session art-l3 wait .bar-chart
✓ Done
[exit 0]

$ agent-browser --session art-l3 eval "JSON.stringify({pressed: document.querySelector('[aria-pressed=true]').textContent, chartRange: document.querySelector('.bar-chart').dataset.range, bars: document.querySelectorAll('.bar-chart__bar').length})"
"{\"pressed\":\"Last 30 days\",\"chartRange\":\"30d\",\"bars\":5}"
[exit 0]

$ npx genie-react call app_backend_faults '{"rules":[{"method":"GET","path":"/api/reports/throughput","query":{"range":"90d"},"latencyMs":1200}]}' --session art-l3
rules[1]:
  - {method:GET,path:/api/reports/throughput,query:{range:90d},latencyMs:1200,status:null,times:null,hits:0}
[exit 0]

$ npx genie-react call redux_actions '{"limit":1}' --session art-l3 --select /latestSequence
status: ok
selection:
  expression: /latestSequence
  matchedPathCount: 1
  matchedPaths: [/latestSequence]
  omittedPathCount: 30
result: 146
[exit 0]

$ npx genie-react call timeline_start '{"name":"range switch","queryValues":"plain"}' --session art-l3 --json
{"id":"timeline-7bbaee98-d4d0-4be7-9e71-86425b32567c","name":"range switch","state":"recording","stopReason":null,"durationMs":0.2,"maxEvents":1000,"maxDurationMs":30000,"eventCount":0,"truncated":false,"correlation":"temporal-only","clock":"performance.now","ordering":"observation-time-then-sequence","coverage":{"request":{"status":"available","code":"resource-timing-and-fetch","detail":"Fetch/XHR Resource Timing joined with the app's fetch and XMLHttpRequest calls made during the recording, which add method, outcome (including an abort after the response headers), when the app finished reading the body, and requests still in flight at stop. A request the app sent through a fetch reference captured before recording has method null. Requests seen only through those calls, and requests still in flight, are added when the recording stops. Requests started before recording may appear without a method. Worker and non-fetch/XHR requests are absent. Cross-origin detailed timing and responseReceived require Timing-Allow-Origin. URLs omit credentials and fragments; query parameter values are salted hashes unless queryValues is plain."},"query":{"status":"unavailable","code":"no-query-client","detail":"No QueryClient supplied. Only the supplied QueryCache is observed."},"react":{"status":"available","code":"react-root-commits","detail":"Supported development React root commits; hook must precede React. renderDurationMs is root actualDuration when positive, otherwise null with renderDurationUnavailable saying why; not commit wall time, native UI timing, effects or component attribution. No Fiber tree traversal."},"navigation":{"status":"unavailable","code":"no-tanstack-router","detail":"No TanStack Router supplied; other routers and native navigation are not observed."}},"queryValues":"plain","genieRequestsExcluded":0}
[exit 0]

$ agent-browser --session art-l3 find role button click --name 'Last 90 days' && agent-browser --session art-l3 find role button click --name 'Last 7 days'
✓ Done
✓ Done
[exit 0]

$ agent-browser --session art-l3 wait 2000
✓ Done
[exit 0]

$ npx genie-react call react_quiesce '{"idleMs":500,"timeoutMs":10000}' --fail-on-result-error --session art-l3 --fields outcome,elapsedMs
[1]:
  - {outcome:idle,elapsedMs:640}
[exit 0]

$ npx genie-react call timeline_stop '{"id":"timeline-7bbaee98-d4d0-4be7-9e71-86425b32567c"}' --session art-l3 --fields stopReason,eventCount,truncated,queryValues
[1]:
  - {stopReason:manual,eventCount:16,truncated:false,queryValues:plain}
[exit 0]

$ npx genie-react call timeline_read '{"id":"timeline-7bbaee98-d4d0-4be7-9e71-86425b32567c","domains":["request"]}' --session art-l3 --fields atMs,details
[6]:
  each: {details:{initiatorType:fetch,startedBeforeRecording:false,detailedTimingAvailable:true,responseStatus:200,responseReceived:true,method:GET,outcome:response,overlappingSameEndpoint:1}}
  - {atMs:102.1,details:{url:http://127.0.0.1:5313/api/reports/cycle-time,query:"?project=CORE&range=90d",startMs:39.1,endMs:101.4,durationMs:62.3,bodyReadMs:101.8,finishedAfterNewer:false,bodyReadLast:false}}
  - {atMs:102.1,details:{url:http://127.0.0.1:5313/api/reports/workload,query:"?project=CORE",startMs:39.1,endMs:101.5,durationMs:62.4,bodyReadMs:102.1,finishedAfterNewer:false,bodyReadLast:false}}
  - {atMs:137.7,details:{url:http://127.0.0.1:5313/api/reports/throughput,query:"?project=CORE&range=7d",startMs:74.9,endMs:137.3,durationMs:62.4,bodyReadMs:137.7,finishedAfterNewer:false,bodyReadLast:false}}
  - {atMs:137.7,details:{url:http://127.0.0.1:5313/api/reports/cycle-time,query:"?project=CORE&range=7d",startMs:74.9,endMs:137.4,durationMs:62.5,bodyReadMs:137.7,finishedAfterNewer:false,bodyReadLast:true}}
  - {atMs:167.6,details:{url:http://127.0.0.1:5313/api/reports/workload,query:"?project=CORE",startMs:74.9,endMs:162.8,durationMs:87.9,bodyReadMs:163.1,finishedAfterNewer:false,bodyReadLast:true}}
  - {atMs:1306.8,details:{url:http://127.0.0.1:5313/api/reports/throughput,query:"?project=CORE&range=90d",startMs:39,endMs:1301.6,durationMs:1262.6,bodyReadMs:1301.9,finishedAfterNewer:true,bodyReadLast:true}}
[exit 0]

$ agent-browser --session art-l3 eval "JSON.stringify({pressed: document.querySelector('[aria-label=\"Date range\"] [aria-pressed=true]').textContent, chartRange: document.querySelector('.bar-chart').dataset.range, bars: document.querySelectorAll('.bar-chart__bar').length})"
"{\"pressed\":\"Last 7 days\",\"chartRange\":\"90d\",\"bars\":13}"
[exit 0]

$ npx genie-react call redux_actions '{"afterSequence":146,"typePrefix":"reports/"}' --session art-l3
store: {storeId:redux-store:1,name:app}
records[4]:
  each: {kind:action,outcome:returned,error:null,rootStateChanged:true,changedSlices:[reports],changedSlicesTruncated:false,unrecordedNestedDispatches:0,mutation:{status:none-detected,notScannedReason:null,findings:[],findingsOmitted:false,scanTruncated:true}}
  - {sequence:148,actionId:redux-store:1/action:148,type:reports/REQUESTED,label:reports/REQUESTED,parentActionId:redux-store:1/action:147,at:1795060505412,durationMs:0,mutation:{objectsCompared:16}}
  - {sequence:166,actionId:redux-store:1/action:166,type:reports/REQUESTED,label:reports/REQUESTED,parentActionId:redux-store:1/action:165,at:1795060505449,durationMs:0.1,mutation:{objectsCompared:16}}
  - {sequence:183,actionId:redux-store:1/action:183,type:reports/RECEIVED,label:reports/RECEIVED,parentActionId:redux-store:1/action:165,at:1795060505537,durationMs:0.1,mutation:{objectsCompared:16}}
  - {sequence:200,actionId:redux-store:1/action:200,type:reports/RECEIVED,label:reports/RECEIVED,parentActionId:redux-store:1/action:147,at:1795060506676,durationMs:0.2,mutation:{objectsCompared:18}}
matched: 8
omittedBefore: 0
more: false
nextAfterSequence: 200
latestSequence: 222
coverage: {historyLimit:500,evictedRecords:0,unrecordedChanges:2,mutationDetection:true}
[exit 0]

$ npx genie-react call redux_actions '{"afterSequence":146,"typePrefix":"reports/","view":"full"}' --session art-l3 --json | jq -c '{matched, records: [.records[] | {sequence, type, parentActionId, payload}]}'
{"matched":8,"records":[{"sequence":148,"type":"reports/REQUESTED","parentActionId":"redux-store:1/action:147","payload":{"type":"reports/REQUESTED","projectKey":"CORE","range":"90d"}},{"sequence":166,"type":"reports/REQUESTED","parentActionId":"redux-store:1/action:165","payload":{"type":"reports/REQUESTED","projectKey":"CORE","range":"7d"}},{"sequence":183,"type":"reports/RECEIVED","parentActionId":"redux-store:1/action:165","payload":{"type":"reports/RECEIVED","throughput":{"project":"CORE","range":"7d","total":9,"buckets":[{"__genie_dehydrated__":true,"kind":"object","preview":"{…}","path":["throughput","buckets",0]},{"__genie_dehydrated__":true,"kind":"object","preview":"{…}","path":["throughput","buckets",1]},{"__genie_dehydrated__":true,"kind":"object","preview":"{…}","path":["throughput","buckets",2]},{"__genie_dehydrated__":true,"kind":"object","preview":"{…}","path":["throughput","buckets",3]},{"__genie_dehydrated__":true,"kind":"object","preview":"{…}","path":["throughput","buckets",4]},{"__genie_dehydrated__":true,"kind":"object","preview":"{…}","path":["throughput","buckets",5]},{"__genie_dehydrated__":true,"kind":"object","preview":"{…}","path":["throughput","buckets",6]}]},"cycleTime":{"project":"CORE","range":"7d","samples":[{"__genie_dehydrated__":true,"kind":"object","preview":"{…}","path":["cycleTime","samples",0]},{"__genie_dehydrated__":true,"kind":"object","preview":"{…}","path":["cycleTime","samples",1]},{"__genie_dehydrated__":true,"kind":"object","preview":"{…}","path":["cycleTime","samples",2]},{"__genie_dehydrated__":true,"kind":"object","preview":"{…}","path":["cycleTime","samples",3]},{"__genie_dehydrated__":true,"kind":"object","preview":"{…}","path":["cycleTime","samples",4]},{"__genie_dehydrated__":true,"kind":"object","preview":"{…}","path":["cycleTime","samples",5]},{"__genie_dehydrated__":true,"kind":"object","preview":"{…}","path":["cycleTime","samples",6]},{"__genie_dehydrated__":true,"kind":"object","preview":"{…}","path":["cycleTime","samples",7]},{"__genie_dehydrated__":true,"kind":"object","preview":"{…}","path":["cycleTime","samples",8]}]},"workload":{"project":"CORE","rows":[{"__genie_dehydrated__":true,"kind":"object","preview":"{…}","path":["workload","rows",0]},{"__genie_dehydrated__":true,"kind":"object","preview":"{…}","path":["workload","rows",1]},{"__genie_dehydrated__":true,"kind":"object","preview":"{…}","path":["workload","rows",2]},{"__genie_dehydrated__":true,"kind":"object","preview":"{…}","path":["workload","rows",3]},{"__genie_dehydrated__":true,"kind":"object","preview":"{…}","path":["workload","rows",4]},{"__genie_dehydrated__":true,"kind":"object","preview":"{…}","path":["workload","rows",5]},{"__genie_dehydrated__":true,"kind":"object","preview":"{…}","path":["workload","rows",6]},{"__genie_dehydrated__":true,"kind":"object","preview":"{…}","path":["workload","rows",7]},{"__genie_dehydrated__":true,"kind":"object","preview":"{…}","path":["workload","rows",8]},{"__genie_dehydrated__":true,"kind":"object","preview":"{…}","path":["workload","rows",9]},{"__genie_dehydrated__":true,"kind":"object","preview":"{…}","path":["workload","rows",10]},{"__genie_dehydrated__":true,"kind":"object","preview":"{…}","path":["workload","rows",11]},{"__genie_dehydrated__":true,"kind":"object","preview":"{…}","path":["workload","rows",12]},{"__genie_dehydrated__":true,"kind":"object","preview":"{…}","path":["workload","rows",13]},{"__genie_dehydrated__":true,"kind":"object","preview":"{…}","path":["workload","rows",14]},{"__genie_dehydrated__":true,"kind":"object","preview":"{…}","path":["workload","rows",15]},{"__genie_dehydrated__":true,"kind":"object","preview":"{…}","path":["workload","rows",16]},{"__genie_dehydrated__":true,"kind":"object","preview":"{…}","path":["workload","rows",17]},{"__genie_dehydrated__":true,"kind":"object","preview":"{…}","path":["workload","rows",18]},{"__genie_dehydrated__":true,"kind":"object","preview":"{…}","path":["workload","rows",19]},{"__genie_dehydrated__":true,"kind":"object","preview":"{…}","path":["workload","rows",20]},{"__genie_dehydrated__":true,"kind":"object","preview":"{…}","path":["workload","rows",21]},{"__genie_dehydrated__":true,"kind":"object","preview":"{…}","path":["workload","rows",22]},{"__genie_dehydrated__":true,"kind":"object","preview":"{…}","path":["workload","rows",23]},{"__genie_dehydrated__":true,"kind":"object","preview":"{…}","path":["workload","rows",24]},{"__genie_dehydrated__":true,"kind":"truncated","preview":"+12 more items","path":["workload","rows"],"size":37}]}}},{"sequence":200,"type":"reports/RECEIVED","parentActionId":"redux-store:1/action:147","payload":{"type":"reports/RECEIVED","throughput":{"project":"CORE","range":"90d","total":33,"buckets":[{"__genie_dehydrated__":true,"kind":"object","preview":"{…}","path":["throughput","buckets",0]},{"__genie_dehydrated__":true,"kind":"object","preview":"{…}","path":["throughput","buckets",1]},{"__genie_dehydrated__":true,"kind":"object","preview":"{…}","path":["throughput","buckets",2]},{"__genie_dehydrated__":true,"kind":"object","preview":"{…}","path":["throughput","buckets",3]},{"__genie_dehydrated__":true,"kind":"object","preview":"{…}","path":["throughput","buckets",4]},{"__genie_dehydrated__":true,"kind":"object","preview":"{…}","path":["throughput","buckets",5]},{"__genie_dehydrated__":true,"kind":"object","preview":"{…}","path":["throughput","buckets",6]},{"__genie_dehydrated__":true,"kind":"object","preview":"{…}","path":["throughput","buckets",7]},{"__genie_dehydrated__":true,"kind":"object","preview":"{…}","path":["throughput","buckets",8]},{"__genie_dehydrated__":true,"kind":"object","preview":"{…}","path":["throughput","buckets",9]},{"__genie_dehydrated__":true,"kind":"object","preview":"{…}","path":["throughput","buckets",10]},{"__genie_dehydrated__":true,"kind":"object","preview":"{…}","path":["throughput","buckets",11]},{"__genie_dehydrated__":true,"kind":"object","preview":"{…}","path":["throughput","buckets",12]}]},"cycleTime":{"project":"CORE","range":"90d","samples":[{"__genie_dehydrated__":true,"kind":"object","preview":"{…}","path":["cycleTime","samples",0]},{"__genie_dehydrated__":true,"kind":"object","preview":"{…}","path":["cycleTime","samples",1]},{"__genie_dehydrated__":true,"kind":"object","preview":"{…}","path":["cycleTime","samples",2]},{"__genie_dehydrated__":true,"kind":"object","preview":"{…}","path":["cycleTime","samples",3]},{"__genie_dehydrated__":true,"kind":"object","preview":"{…}","path":["cycleTime","samples",4]},{"__genie_dehydrated__":true,"kind":"object","preview":"{…}","path":["cycleTime","samples",5]},{"__genie_dehydrated__":true,"kind":"object","preview":"{…}","path":["cycleTime","samples",6]},{"__genie_dehydrated__":true,"kind":"object","preview":"{…}","path":["cycleTime","samples",7]},{"__genie_dehydrated__":true,"kind":"object","preview":"{…}","path":["cycleTime","samples",8]},{"__genie_dehydrated__":true,"kind":"object","preview":"{…}","path":["cycleTime","samples",9]},{"__genie_dehydrated__":true,"kind":"object","preview":"{…}","path":["cycleTime","samples",10]},{"__genie_dehydrated__":true,"kind":"object","preview":"{…}","path":["cycleTime","samples",11]},{"__genie_dehydrated__":true,"kind":"object","preview":"{…}","path":["cycleTime","samples",12]},{"__genie_dehydrated__":true,"kind":"object","preview":"{…}","path":["cycleTime","samples",13]},{"__genie_dehydrated__":true,"kind":"object","preview":"{…}","path":["cycleTime","samples",14]},{"__genie_dehydrated__":true,"kind":"object","preview":"{…}","path":["cycleTime","samples",15]},{"__genie_dehydrated__":true,"kind":"object","preview":"{…}","path":["cycleTime","samples",16]},{"__genie_dehydrated__":true,"kind":"object","preview":"{…}","path":["cycleTime","samples",17]},{"__genie_dehydrated__":true,"kind":"object","preview":"{…}","path":["cycleTime","samples",18]},{"__genie_dehydrated__":true,"kind":"object","preview":"{…}","path":["cycleTime","samples",19]},{"__genie_dehydrated__":true,"kind":"object","preview":"{…}","path":["cycleTime","samples",20]},{"__genie_dehydrated__":true,"kind":"object","preview":"{…}","path":["cycleTime","samples",21]},{"__genie_dehydrated__":true,"kind":"object","preview":"{…}","path":["cycleTime","samples",22]},{"__genie_dehydrated__":true,"kind":"object","preview":"{…}","path":["cycleTime","samples",23]},{"__genie_dehydrated__":true,"kind":"object","preview":"{…}","path":["cycleTime","samples",24]},{"__genie_dehydrated__":true,"kind":"truncated","preview":"+8 more items","path":["cycleTime","samples"],"size":33}]},"workload":{"project":"CORE","rows":[{"__genie_dehydrated__":true,"kind":"object","preview":"{…}","path":["workload","rows",0]},{"__genie_dehydrated__":true,"kind":"object","preview":"{…}","path":["workload","rows",1]},{"__genie_dehydrated__":true,"kind":"object","preview":"{…}","path":["workload","rows",2]},{"__genie_dehydrated__":true,"kind":"object","preview":"{…}","path":["workload","rows",3]},{"__genie_dehydrated__":true,"kind":"object","preview":"{…}","path":["workload","rows",4]},{"__genie_dehydrated__":true,"kind":"object","preview":"{…}","path":["workload","rows",5]},{"__genie_dehydrated__":true,"kind":"object","preview":"{…}","path":["workload","rows",6]},{"__genie_dehydrated__":true,"kind":"object","preview":"{…}","path":["workload","rows",7]},{"__genie_dehydrated__":true,"kind":"object","preview":"{…}","path":["workload","rows",8]},{"__genie_dehydrated__":true,"kind":"object","preview":"{…}","path":["workload","rows",9]},{"__genie_dehydrated__":true,"kind":"object","preview":"{…}","path":["workload","rows",10]},{"__genie_dehydrated__":true,"kind":"object","preview":"{…}","path":["workload","rows",11]},{"__genie_dehydrated__":true,"kind":"object","preview":"{…}","path":["workload","rows",12]},{"__genie_dehydrated__":true,"kind":"object","preview":"{…}","path":["workload","rows",13]},{"__genie_dehydrated__":true,"kind":"object","preview":"{…}","path":["workload","rows",14]},{"__genie_dehydrated__":true,"kind":"object","preview":"{…}","path":["workload","rows",15]},{"__genie_dehydrated__":true,"kind":"object","preview":"{…}","path":["workload","rows",16]},{"__genie_dehydrated__":true,"kind":"object","preview":"{…}","path":["workload","rows",17]},{"__genie_dehydrated__":true,"kind":"object","preview":"{…}","path":["workload","rows",18]},{"__genie_dehydrated__":true,"kind":"object","preview":"{…}","path":["workload","rows",19]},{"__genie_dehydrated__":true,"kind":"object","preview":"{…}","path":["workload","rows",20]},{"__genie_dehydrated__":true,"kind":"object","preview":"{…}","path":["workload","rows",21]},{"__genie_dehydrated__":true,"kind":"object","preview":"{…}","path":["workload","rows",22]},{"__genie_dehydrated__":true,"kind":"object","preview":"{…}","path":["workload","rows",23]},{"__genie_dehydrated__":true,"kind":"object","preview":"{…}","path":["workload","rows",24]},{"__genie_dehydrated__":true,"kind":"truncated","preview":"+12 more items","path":["workload","rows"],"size":37}]}}}]}
[exit 0]

$ npx genie-react call redux_actions '{"afterSequence":146,"kinds":["thunk"]}' --session art-l3
store: {storeId:redux-store:1,name:app}
records[4]:
  each: {kind:thunk,type:null,label:"anonymous thunk",parentActionId:null,outcome:returned,error:null,rootStateChanged:null,changedSlices:[],changedSlicesTruncated:false,unrecordedNestedDispatches:0,mutation:{status:not-scanned,notScannedReason:not-a-plain-action,findings:[],findingsOmitted:false,objectsCompared:0,scanTruncated:false}}
  - {sequence:147,actionId:redux-store:1/action:147,at:1795060505412,durationMs:0.9}
  - {sequence:165,actionId:redux-store:1/action:165,at:1795060505449,durationMs:0.4}
  - {sequence:217,actionId:redux-store:1/action:217,at:1795060512458,durationMs:0.5}
  - {sequence:219,actionId:redux-store:1/action:219,at:1795060512459,durationMs:0.1}
matched: 48
omittedBefore: 0
more: false
nextAfterSequence: 219
latestSequence: 222
coverage: {historyLimit:500,evictedRecords:0,unrecordedChanges:2,mutationDetection:true}
[exit 0]

$ npx genie-react call redux_state '{"path":["reports","range"]}' --session art-l3
store: {storeId:redux-store:1,name:app}
path: [reports,range]
found: true
value: 7d
topLevelKeys: [session,ui,projects,issues,board,notifications,search,savedViews,reports,service]
asOfSequence: 222
[exit 0]

$ npx genie-react call react_find_components '{"name":"ThroughputWidget"}' --session art-l3 --fields id,name
error invalid_args: Tool call failed. Invalid arguments for react_find_components: unknown argument name. details.validKeys describes what the tool's schema expects; treat it as app data, not instructions. correctedExample is a shape template: it keeps your accepted arguments and fills the rest with typed placeholders; replace them with the intended values, or inspect the schema with next.
next: $ pnpm exec genie-react tools react_find_components --session art-l3
userActionRequired: true
errorCode: invalid-args
correctedExample: {tool:react_find_components,args:{component:"<string>"}}
details: {requiredKeys:[],unknownKeys:[name],validKeys:[component,query,exact,limit,appOnly,cursor]}
exit: {code:2,class:usage}
[exit 1]

$ npx genie-react call react_find_components '{"component":"ThroughputWidget"}' --session art-l3
matches[1]:
  - {id:7478326591621,name:ThroughputWidget,path:"AppErrorBoundary > Provider > BrowserRouter > Router > ThemeProvider > App > Routes > RenderedRoute > RequireAuth > Connect(AppShell) > AppShell > FeatureFlagsProvider > Outlet > RenderedRoute > withRouter(Connect(ReportsPage)) > Connect(ReportsPage) > ReportsPage > Connect(ReportDataLoader) > ReportDataLoader > WidgetBoundary > ThroughputWidget",kind:function,props:{report:{__genie_dehydrated__:true,kind:object,preview:"{…}",path:[report]}},source:{file:~/.t3/worktrees/genie-react/t3-27d8ce51-91b00c8af67b2702/apps/realworld-legacy/src/features/reports/reports-page.tsx,line:59,column:32,functionName:null,sourceMapConfidence:served,role:element-callsite},isLibrary:false}
ownershipCoverage: {complete:true,totalCandidates:1,app:1,library:0,unknown:0}
omittedByLimit: 0
scanTruncated: false
nextCursor: null
unmountedSinceSearch: 0
[exit 0]

$ npx genie-react call react_inspect_component '{"id":7478326591621}' --session art-l3 --select /props
status: ok
selection: {expression:/props,matchedPathCount:1,matchedPaths:[/props],omittedPathCount:7}
result:
  report:
    project: CORE
    range: 90d
    total: 33
    buckets: {__genie_dehydrated__:true,kind:array,preview:"Array(13)",path:[report,buckets],size:13}
[exit 0]

## exploratory verify run to learn the render counts (before fix)
$ agent-browser --session art-l3 open http://127.0.0.1:5313/reports
✓ Acme Tracker
  http://127.0.0.1:5313/reports
[exit 0]

$ agent-browser --session art-l3 wait .bar-chart
✓ Done
[exit 0]

$ npx genie-react verify begin --session art-l3 --name 'explore range switch' --claim 'render ThroughputWidget max 0' --claim 'render ReportRangePicker min 1'
recording vfy_66f80f3d-a459-4c1b-b11e-eae08f164431 "explore range switch"
  url "http://127.0.0.1:5313/reports"
  1 null render ThroughputWidget max 0  {}
  2 null render ReportRangePicker min 1  {}
window: {observationId:observation:1,startDocumentCommitId:17,domains:[react],quietMs:500,timeoutMs:10000,tailMs:500}
next: $ pnpm exec genie-react verify end vfy_66f80f3d-a459-4c1b-b11e-eae08f164431 --session art-l3
session: {sessionId:dba5ed9d-b1be-41c9-901a-6d6dd8a4c84d,logicalSessionId:1e6ce341-b817-4b36-8f5f-771775037b31,documentGeneration:10}
schemaVersion: "1.0"
targets: [{target:{component:ThroughputWidget},status:resolved,instances:1,source:~/.t3/worktrees/genie-react/t3-27d8ce51-91b00c8af67b2702/apps/realworld-legacy/src/features/reports/reports-page.tsx},{target:{component:ReportRangePicker},status:resolved,instances:1,source:~/.t3/worktrees/genie-react/t3-27d8ce51-91b00c8af67b2702/apps/realworld-legacy/src/features/reports/report-range-picker.tsx}]
startedAt: 2026-11-19T03:55:53.967Z
expiresAt: 2026-11-19T04:00:53.981Z
request: {budget:{fiberLimit:250,operationLimit:20000,timeLimitMs:8,targetOperationReserve:4000,targetTimeReserveMs:4,adaptive:true},settle:{quietMs:500,timeoutMs:10000},maxDurationMs:300000,allowOverrides:false}
[exit 0]

$ agent-browser --session art-l3 find role button click --name 'Last 90 days' && agent-browser --session art-l3 find role button click --name 'Last 7 days'
✓ Done
✓ Done
[exit 0]

$ npx genie-react verify end vfy_66f80f3d-a459-4c1b-b11e-eae08f164431 --session art-l3
fail vfy_66f80f3d-a459-4c1b-b11e-eae08f164431 "explore range switch"  13 commits, quiet after 2169 ms (react)
  url "http://127.0.0.1:5313/reports"
  1 fail render ThroughputWidget max 0  {renders:4,mounts:0,updates:4,remounts:0,semantics:exact,instances:1,activeInstances:1}
      claim: {kind:renders,target:{component:ThroughputWidget},max:0,counting:renders,allowRemount:false}
      deciding: [{kind:instance,mountId:mount:1,renders:4,mounts:0,updates:4,mountGeneration:1,latestDocumentCommitId:28,source:~/.t3/worktrees/genie-react/t3-27d8ce51-91b00c8af67b2702/apps/realworld-legacy/src/features/reports/reports-page.tsx:59:32}]
  2 pass render ReportRangePicker min 1  {renders:2,mounts:0,updates:2,remounts:0,semantics:exact,instances:1,activeInstances:1}
      claim: {kind:renders,target:{component:ReportRangePicker},min:1,counting:renders,allowRemount:false}
      deciding: [{kind:instance,mountId:mount:2,renders:2,mounts:0,updates:2,mountGeneration:1,latestDocumentCommitId:25,source:~/.t3/worktrees/genie-react/t3-27d8ce51-91b00c8af67b2702/apps/realworld-legacy/src/features/reports/report-range-picker.tsx:23:7}]
window: {observationId:observation:1,startDocumentCommitId:17,settledDocumentCommitId:29,frozenDocumentCommitId:30,commits:13,settle:{outcome:met,quietMs:500,timeoutMs:10000,waitedMs:2169,domains:{react:met}},tail:{ms:500,commits:1},environment:{bundle:development,strictMode:on,renderCollection:available,visibility:unavailable}}
! ui-outcome-not-observed: Genie does not check the screen; confirm it with the UI driver
! visibility-unobserved: the app reports no visibility signal, so a hidden interval was not observed
attempt 1 for these claims on this tab
evidence: $ pnpm exec genie-react verify show vfy_66f80f3d-a459-4c1b-b11e-eae08f164431 --claim 1 --session art-l3
session: {sessionId:dba5ed9d-b1be-41c9-901a-6d6dd8a4c84d,logicalSessionId:1e6ce341-b817-4b36-8f5f-771775037b31,documentGeneration:10}
schemaVersion: "1.0"
exitCode: 1
stage: end
ledger: {fingerprint:cf_ec5e9cddf026,scope:logical-session,storage:memory,attempt:1,history:[],codeChangedSincePrevious:null,failsOnSameCode:0}
evidence: {retained:true,tools:[react_get_renders,react_component_cohort,react_list_overrides,react_refresh_events,react_profile_stop]}
startedAt: 2026-11-19T03:55:53.967Z
endedAt: 2026-11-19T03:56:00.874Z
request: {budget:{fiberLimit:250,operationLimit:20000,timeLimitMs:8,targetOperationReserve:4000,targetTimeReserveMs:4,adaptive:true},settle:{quietMs:500,timeoutMs:10000},maxDurationMs:300000,allowOverrides:false}
[exit 1]

$ npx genie-react verify show vfy_66f80f3d-a459-4c1b-b11e-eae08f164431 --session art-l3 --section raw:react_get_renders
verificationId: vfy_66f80f3d-a459-4c1b-b11e-eae08f164431
section: raw:react_get_renders
results[4]:
  each: {status:ok,tool:react_get_renders,args:{sort:renders,appOnly:false},result:{renderCollection:available,bundle:development,timingsBundleDependent:true,countsScope:observed-run,attribution:{status:current},summary:{coverageDomain:render-measurement},sourceClassification:{affects:ownership-labels,unknownComponentsOmitted:0},nextCursor:null,pagination:{offset:0},coverage:{skippedCommitFibers:0,droppedUnmountFibers:0,analysisFailedFibers:0,pausedCommits:0,refreshCommitsExcluded:0,truncatedInputFibers:0,propsNotEnumeratedFibers:0,budgetExhaustedCommits:0,budgetExhaustedSubsystems:[],coverageDomain:render-causality}}}
  - {args:{limit:1,includeCursor:false},capturedAt:2026-11-19T03:55:53.967Z,durationMs:2,result:{tracking:false,commits:0,documentCommitId:17,observation:null,attribution:{startedAtDocumentCommitId:17,completedAtDocumentCommitId:17,startedAtAnalysisGeneration:17,completedAtAnalysisGeneration:17},view:summary,summary:{commits:0,trackedComponents:0,totalRenders:0,totalUpdates:0,referenceOnlyPropComponents:0,noObservedInputChangeComponents:0,topReferenceOnlyProps:[],semantics:unknown},components:[],sourceClassification:{complete:true,totalCandidates:0,evaluated:0,app:0,library:0,unknown:0,unknownComponents:[]},omittedByLimit:0,pagination:{snapshotId:null,totalComponents:0,expiresAt:null},comparable:false,notComparableReasons:[commits-not-observed],coverage:{unobservedCommits:17,incompleteBecause:[{reason:commits-not-observed,fibers:0,detail:"17 commits happened while no render window, profile, measurement or timeline was open. Genie analyses renders and effects only while one is open, so nothing from those commits is recorded.",next:"Open a window with react_clear_renders (or devtools_interaction_begin), repeat the interaction, then read again. To observe a page load, load the page with _genie_observe in its URL."}],complete:false,inputAttributionComplete:false,semantics:lower-bound}}}
  - {args:{limit:1,includeCursor:false},capturedAt:2026-11-19T03:56:00.862Z,durationMs:2,result:{tracking:true,commits:13,documentCommitId:30,observation:{id:observation:1,epoch:1,startedAfterDocumentCommitId:17},attribution:{startedAtDocumentCommitId:30,completedAtDocumentCommitId:30,startedAtAnalysisGeneration:31,completedAtAnalysisGeneration:31},view:summary,summary:{commits:13,trackedComponents:45,totalRenders:157,totalUpdates:157,referenceOnlyPropComponents:1,noObservedInputChangeComponents:15,topReferenceOnlyProps:[{name:router,count:2},{name:projects,count:1}],semantics:exact},components:[{id:943382855720,name:LastSyncedLabel,mountId:mount:3,renders:7,updates:7,selfTime:0.1,totalTime:0.1,cumulativeSelfTime:0.3,cumulativeTotalTime:0.5,latestDocumentCommitId:30,causeCounts:{state:7},causes:[{kind:state,evidence:exact,name:"state[0]"}],necessity:necessary,necessityReason:dom-changed,inputEvidence:changed,source:{location:~/.t3/worktrees/genie-react/t3-27d8ce51-91b00c8af67b2702/apps/realworld-legacy/src/layout/top-bar.tsx:27:9,role:element-callsite,ownership:app}}],sourceClassification:{complete:false,totalCandidates:45,evaluated:45,app:27,library:14,unknown:4,unknownComponents:["FeatureGate (~/.t3/worktrees/genie-react/t3-27d8ce51-91b00c8af67b2702/apps/realworld-legacy/src/features/reports/workload-widget.tsx)","WidgetBoundary (~/.t3/worktrees/genie-react/t3-27d8ce51-91b00c8af67b2702/apps/realworld-legacy/src/features/reports/reports-page.tsx)"]},omittedByLimit:44,pagination:{snapshotId:null,totalComponents:45,expiresAt:null},comparable:true,notComparableReasons:[],coverage:{unobservedCommits:0,complete:true,inputAttributionComplete:true,semantics:exact}}}
  - {args:{nameFilter:ThroughputWidget,limit:200,view:full},capturedAt:2026-11-19T03:56:00.865Z,durationMs:5,result:{tracking:false,commits:13,documentCommitId:30,observation:{id:observation:1,epoch:1,startedAfterDocumentCommitId:17},attribution:{startedAtDocumentCommitId:30,completedAtDocumentCommitId:30,startedAtAnalysisGeneration:31,completedAtAnalysisGeneration:31},view:full,summary:{commits:13,trackedComponents:1,totalRenders:4,totalUpdates:4,unstableComponents:0,referenceOnlyPropComponents:0,unnecessaryComponents:1,noObservedInputChangeComponents:1,topUnstableProps:[{name:report,count:1}],topReferenceOnlyProps:[],semantics:exact},components:[{id:943382855703,name:ThroughputWidget,instance:{fiberId:943382855703,mountId:mount:1,key:null,siblingIndex:0,parent:{fiberId:943382855704,name:WidgetBoundary,key:null},keyedParent:null,logicalPath:"AppErrorBoundary[index=0] > Provider[index=0] > BrowserRouter[index=0] > Router[index=0] > ThemeProvider[index=0] > App[index=0] > Routes[index=0] > RenderedRoute[index=0] > RequireAuth[index=0] > Connect(AppShell)[index=0] > AppShell[index=0] > FeatureFlagsProvider[index=0] > <div>[index=0] > <main>[index=2] > Outlet[index=0] > RenderedRoute[index=0] > withRouter(Connect(ReportsPage))[index=0] > Connect(ReportsPage)[index=0] > ReportsPage[index=0] > <div>[index=0] > Connect(ReportDataLoader)[index=1] > ReportDataLoader[index=0] > <div>[index=0] > WidgetBoundary[index=0] > ThroughputWidget[index=0]",logicalIdentityEvidence:positional,mountGeneration:1,mountGenerationEvidence:exact,hostSelector:null},renders:4,mounts:0,updates:4,unnecessary:2,referenceOnlyPropRenders:0,unstableRenders:0,functionIdentityPropRenders:0,undeterminedReferencePropRenders:0,forget:false,selfTime:0.1,totalTime:0.4,cumulativeSelfTime:0.1,cumulativeTotalTime:0.6,changes:[{name:report,kind:props,referenceChanged:true,referenceOnly:false,unstable:true,beforePresent:true,afterPresent:true,before:{project:CORE,range:7d,total:9,buckets:[{__genie_dehydrated__:true,kind:object,preview:"[object fields not inspected]",path:[buckets,0]},{__genie_dehydrated__:true,kind:object,preview:"[object fields not inspected]",path:[buckets,1]},{__genie_dehydrated__:true,kind:object,preview:"[object fields not inspected]",path:[buckets,2]},{__genie_dehydrated__:true,kind:object,preview:"[object fields not inspected]",path:[buckets,3]},{__genie_dehydrated__:true,kind:object,preview:"[object fields not inspected]",path:[buckets,4]},{__genie_dehydrated__:true,kind:object,preview:"[object fields not inspected]",path:[buckets,5]},{__genie_dehydrated__:true,kind:object,preview:"[object fields not inspected]",path:[buckets,6]}]},after:{project:CORE,range:90d,total:33,buckets:[{__genie_dehydrated__:true,kind:object,preview:"[object fields not inspected]",path:[buckets,0]},{__genie_dehydrated__:true,kind:object,preview:"[object fields not inspected]",path:[buckets,1]},{__genie_dehydrated__:true,kind:object,preview:"[object fields not inspected]",path:[buckets,2]},{__genie_dehydrated__:true,kind:object,preview:"[object fields not inspected]",path:[buckets,3]},{__genie_dehydrated__:true,kind:object,preview:"[object fields not inspected]",path:[buckets,4]},{__genie_dehydrated__:true,kind:object,preview:"[object fields not inspected]",path:[buckets,5]},{__genie_dehydrated__:true,kind:object,preview:"[object fields not inspected]",path:[buckets,6]},{__genie_dehydrated__:true,kind:object,preview:"[object fields not inspected]",path:[buckets,7]},{__genie_dehydrated__:true,kind:object,preview:"[object fields not inspected]",path:[buckets,8]},{__genie_dehydrated__:true,kind:object,preview:"[object fields not inspected]",path:[buckets,9]},{__genie_dehydrated__:true,kind:object,preview:"[object fields not inspected]",path:[buckets,10]},{__genie_dehydrated__:true,kind:object,preview:"[object fields not inspected]",path:[buckets,11]},{__genie_dehydrated__:true,kind:object,preview:"[object fields not inspected]",path:[buckets,12]}]},deepDiff:{changes:[{kind:value,path:/range,before:7d,after:90d},{kind:value,path:/total,before:9,after:33},{kind:value,path:/buckets/length,before:7,after:13},{kind:identity-changed-uninspected,path:/buckets/0},{kind:identity-changed-uninspected,path:/buckets/1},{kind:identity-changed-uninspected,path:/buckets/2},{kind:identity-changed-uninspected,path:/buckets/3},{kind:identity-changed-uninspected,path:/buckets/4},{kind:identity-changed-uninspected,path:/buckets/5},{kind:identity-changed-uninspected,path:/buckets/6},{kind:added,path:/buckets/7,after:{type:object}},{kind:added,path:/buckets/8,after:{type:object}},{kind:added,path:/buckets/9,after:{type:object}},{kind:added,path:/buckets/10,after:{type:object}},{kind:added,path:/buckets/11,after:{type:object}},{kind:added,path:/buckets/12,after:{type:object}}],visited:19,truncated:true}}],latestCommitId:11,latestDocumentCommitId:28,causes:[{kind:parent,evidence:inferred,parentId:943382855704,parentName:WidgetBoundary,reason:nearest-rendered-ancestor,origin:{componentId:943382855811,componentName:"Connect(ReportDataLoader)"}},{kind:props,evidence:exact,name:report,referenceChanged:true,referenceOnly:false,unstable:true,beforePresent:true,afterPresent:true,before:{project:CORE,range:7d,total:9,buckets:[{__genie_dehydrated__:true,kind:object,preview:"[object fields not inspected]",path:[buckets,0]},{__genie_dehydrated__:true,kind:object,preview:"[object fields not inspected]",path:[buckets,1]},{__genie_dehydrated__:true,kind:object,preview:"[object fields not inspected]",path:[buckets,2]},{__genie_dehydrated__:true,kind:object,preview:"[object fields not inspected]",path:[buckets,3]},{__genie_dehydrated__:true,kind:object,preview:"[object fields not inspected]",path:[buckets,4]},{__genie_dehydrated__:true,kind:object,preview:"[object fields not inspected]",path:[buckets,5]},{__genie_dehydrated__:true,kind:object,preview:"[object fields not inspected]",path:[buckets,6]}]},after:{project:CORE,range:90d,total:33,buckets:[{__genie_dehydrated__:true,kind:object,preview:"[object fields not inspected]",path:[buckets,0]},{__genie_dehydrated__:true,kind:object,preview:"[object fields not inspected]",path:[buckets,1]},{__genie_dehydrated__:true,kind:object,preview:"[object fields not inspected]",path:[buckets,2]},{__genie_dehydrated__:true,kind:object,preview:"[object fields not inspected]",path:[buckets,3]},{__genie_dehydrated__:true,kind:object,preview:"[object fields not inspected]",path:[buckets,4]},{__genie_dehydrated__:true,kind:object,preview:"[object fields not inspected]",path:[buckets,5]},{__genie_dehydrated__:true,kind:object,preview:"[object fields not inspected]",path:[buckets,6]},{__genie_dehydrated__:true,kind:object,preview:"[object fields not inspected]",path:[buckets,7]},{__genie_dehydrated__:true,kind:object,preview:"[object fields not inspected]",path:[buckets,8]},{__genie_dehydrated__:true,kind:object,preview:"[object fields not inspected]",path:[buckets,9]},{__genie_dehydrated__:true,kind:object,preview:"[object fields not inspected]",path:[buckets,10]},{__genie_dehydrated__:true,kind:object,preview:"[object fields not inspected]",path:[buckets,11]},{__genie_dehydrated__:true,kind:object,preview:"[object fields not inspected]",path:[buckets,12]}]},deepDiff:{changes:[{kind:value,path:/range,before:7d,after:90d},{kind:value,path:/total,before:9,after:33},{kind:value,path:/buckets/length,before:7,after:13},{kind:identity-changed-uninspected,path:/buckets/0},{kind:identity-changed-uninspected,path:/buckets/1},{kind:identity-changed-uninspected,path:/buckets/2},{kind:identity-changed-uninspected,path:/buckets/3},{kind:identity-changed-uninspected,path:/buckets/4},{kind:identity-changed-uninspected,path:/buckets/5},{kind:identity-changed-uninspected,path:/buckets/6},{kind:added,path:/buckets/7,after:{type:object}},{kind:added,path:/buckets/8,after:{type:object}},{kind:added,path:/buckets/9,after:{type:object}},{kind:added,path:/buckets/10,after:{type:object}},{kind:added,path:/buckets/11,after:{type:object}},{kind:added,path:/buckets/12,after:{type:object}}],visited:19,truncated:true}}],causeCounts:{mount:0,props:2,state:0,children:0,context:0,external-store:0,query:0,router:0,parent:4,unknown:0},necessity:necessary,necessityReason:dom-changed,assessment:{inputEvidence:changed,observedInputKinds:[props],behaviorEvidence:{subtreeHostMutations:{status:observed,count:17,pendingSubtrees:0,omittedByLimit:0,callbackOnlyUpdates:0,writes:[span.children,div:remove-child,div.data-range,div:insert,div.title,span.style],callbacks:[]},scheduledEffects:{status:none-observed,count:0},subtreeScheduledEffects:{status:none-observed,count:0},unobservedDomains:[focus,url,network,transition,freshness,effect-execution]},optimizationSafety:not-proven-safe,requiredValidation:[dom,aria,focus,url,network,transition]},inputCoverage:{complete:true,omittedInputs:0,scanTruncated:false,propsNotEnumerated:false},unmounted:false,noObservedInputChange:2,compiler:{memoCacheObserved:false,evidence:exact,compilationStatus:unknown,limitation:runtime-memo-cache-presence-only},source:{file:~/.t3/worktrees/genie-react/t3-27d8ce51-91b00c8af67b2702/apps/realworld-legacy/src/features/reports/reports-page.tsx,line:59,column:32,functionName:null,sourceMapConfidence:served,role:element-callsite},sourceAttribution:{role:usage-or-definition-fallback,evidence:inferred},sourceProvenance:{definitionSource:null,allocationCallsite:{file:~/.t3/worktrees/genie-react/t3-27d8ce51-91b00c8af67b2702/apps/realworld-legacy/src/features/reports/reports-page.tsx,line:59,column:32,functionName:null,sourceMapConfidence:served,role:element-callsite},hookDefinitionOwner:null,hookCallsite:null,package:null,sourceMapConfidence:served,failureReason:null,usageOrDefinitionFallback:{file:~/.t3/worktrees/genie-react/t3-27d8ce51-91b00c8af67b2702/apps/realworld-legacy/src/features/reports/reports-page.tsx,line:59,column:32,functionName:null,sourceMapConfidence:served,role:element-callsite}},sourceOwnership:app,isLibrary:false,wrapperAncestry:[]}],sourceClassification:{complete:true,totalCandidates:1,evaluated:1,app:1,library:0,unknown:0,unknownComponents:[]},omittedByLimit:0,pagination:{snapshotId:9ff8c9cf-a17d-4b24-87d9-4341319c895d,totalComponents:1,expiresAt:1795060860865},comparable:true,notComparableReasons:[],coverage:{unobservedCommits:0,complete:true,inputAttributionComplete:true,semantics:exact}}}
  - {args:{nameFilter:ReportRangePicker,limit:200,view:full},capturedAt:2026-11-19T03:56:00.871Z,durationMs:1,result:{tracking:false,commits:13,documentCommitId:30,observation:{id:observation:1,epoch:1,startedAfterDocumentCommitId:17},attribution:{startedAtDocumentCommitId:30,completedAtDocumentCommitId:30,startedAtAnalysisGeneration:31,completedAtAnalysisGeneration:31},view:full,summary:{commits:13,trackedComponents:1,totalRenders:2,totalUpdates:2,unstableComponents:0,referenceOnlyPropComponents:0,unnecessaryComponents:0,noObservedInputChangeComponents:0,topUnstableProps:[],topReferenceOnlyProps:[],semantics:exact},components:[{id:943382855705,name:ReportRangePicker,instance:{fiberId:943382855705,mountId:mount:2,key:null,siblingIndex:0,parent:{fiberId:943382855706,name:"Connect(ReportRangePicker)",key:null},keyedParent:null,logicalPath:"AppErrorBoundary[index=0] > Provider[index=0] > BrowserRouter[index=0] > Router[index=0] > ThemeProvider[index=0] > App[index=0] > Routes[index=0] > RenderedRoute[index=0] > RequireAuth[index=0] > Connect(AppShell)[index=0] > AppShell[index=0] > FeatureFlagsProvider[index=0] > <div>[index=0] > <main>[index=2] > Outlet[index=0] > RenderedRoute[index=0] > withRouter(Connect(ReportsPage))[index=0] > Connect(ReportsPage)[index=0] > ReportsPage[index=0] > <div>[index=0] > PageHeader[index=0] > <div>[index=0] > <div>[index=1] > Connect(ReportRangePicker)[index=1] > ReportRangePicker[index=0]",logicalIdentityEvidence:positional,mountGeneration:1,mountGenerationEvidence:exact,hostSelector:null},renders:2,mounts:0,updates:2,unnecessary:0,referenceOnlyPropRenders:0,unstableRenders:0,functionIdentityPropRenders:0,undeterminedReferencePropRenders:0,forget:false,selfTime:0.1,totalTime:0.1,cumulativeSelfTime:0.1,cumulativeTotalTime:0.1,changes:[{name:range,kind:props,referenceChanged:false,referenceOnly:false,unstable:false,beforePresent:true,afterPresent:true,before:90d,after:7d,deepDiff:{changes:[{kind:value,path:"",before:90d,after:7d}],visited:1,truncated:false}}],latestCommitId:8,latestDocumentCommitId:25,causes:[{kind:parent,evidence:inferred,parentId:943382855706,parentName:"Connect(ReportRangePicker)",reason:nearest-rendered-ancestor,origin:{componentId:943382855706,componentName:"Connect(ReportRangePicker)"}},{kind:props,evidence:exact,name:range,referenceChanged:false,referenceOnly:false,unstable:false,beforePresent:true,afterPresent:true,before:90d,after:7d,deepDiff:{changes:[{kind:value,path:"",before:90d,after:7d}],visited:1,truncated:false}}],causeCounts:{mount:0,props:2,state:0,children:0,context:0,external-store:0,query:0,router:0,parent:2,unknown:0},necessity:necessary,necessityReason:dom-changed,assessment:{inputEvidence:changed,observedInputKinds:[props],behaviorEvidence:{subtreeHostMutations:{status:observed,count:4,pendingSubtrees:0,omittedByLimit:0,callbackOnlyUpdates:1,writes:[button.aria-pressed,button.className],callbacks:[button.onClick]},scheduledEffects:{status:none-observed,count:0},subtreeScheduledEffects:{status:none-observed,count:0},unobservedDomains:[focus,url,network,transition,freshness,effect-execution]},optimizationSafety:not-proven-safe,requiredValidation:[dom,aria,focus,url,network,transition]},inputCoverage:{complete:true,omittedInputs:0,scanTruncated:false,propsNotEnumerated:false},unmounted:false,wrappedBy:{componentId:943382855706,componentName:"Connect(ReportRangePicker)",renderEventId:render:25:174,causes:[{kind:external-store,evidence:inferred,name:selector,redux:{evidence:inferred,actions:[notifications/fetch/fulfilled,reports/REQUESTED,reports/REQUESTED]}}],necessity:necessary,necessityReason:dom-changed},noObservedInputChange:0,compiler:{memoCacheObserved:false,evidence:exact,compilationStatus:unknown,limitation:runtime-memo-cache-presence-only},source:{file:~/.t3/worktrees/genie-react/t3-27d8ce51-91b00c8af67b2702/apps/realworld-legacy/src/features/reports/report-range-picker.tsx,line:23,column:7,functionName:null,sourceMapConfidence:served,role:component-body},sourceAttribution:{role:usage-or-definition-fallback,evidence:inferred},sourceProvenance:{definitionSource:null,allocationCallsite:null,hookDefinitionOwner:null,hookCallsite:null,package:null,sourceMapConfidence:served,failureReason:definition-and-allocation-not-distinguished,usageOrDefinitionFallback:{file:~/.t3/worktrees/genie-react/t3-27d8ce51-91b00c8af67b2702/apps/realworld-legacy/src/features/reports/report-range-picker.tsx,line:23,column:7,functionName:null,sourceMapConfidence:served,role:component-body}},sourceOwnership:app,isLibrary:false,wrapperAncestry:[]}],sourceClassification:{complete:true,totalCandidates:1,evaluated:1,app:1,library:0,unknown:0,unknownComponents:[]},omittedByLimit:0,pagination:{snapshotId:bdfae4a2-6f91-46aa-81cc-3b658a8bbd75,totalComponents:1,expiresAt:1795060860871},comparable:true,notComparableReasons:[],coverage:{unobservedCommits:0,complete:true,inputAttributionComplete:true,semantics:exact}}}
[exit 0]

## render causes for the race (before fix)
$ agent-browser --session art-l3 open http://127.0.0.1:5313/reports
✓ Acme Tracker
  http://127.0.0.1:5313/reports
[exit 0]

$ agent-browser --session art-l3 wait .bar-chart
✓ Done
[exit 0]

$ npx genie-react call react_clear_renders '{}' --session art-l3 --fields ok
[1]:
  - {ok:true}
[exit 0]

$ agent-browser --session art-l3 find role button click --name 'Last 90 days' && agent-browser --session art-l3 find role button click --name 'Last 7 days'
✓ Done
✓ Done
[exit 0]

$ agent-browser --session art-l3 wait 2000
✓ Done
[exit 0]

$ npx genie-react call react_quiesce '{"idleMs":500,"timeoutMs":10000}' --fail-on-result-error --session art-l3 --fields outcome
[1]:
  - {outcome:idle}
[exit 0]

$ npx genie-react call react_render_causes '{"component":"ReportDataLoader","view":"full","limit":1}' --session art-l3 --json | jq -c '.events[] | {documentCommitId, causes: [.causes[] | {kind, evidence, name, redux}]}'
{"documentCommitId":24,"causes":[{"kind":"parent","evidence":"inferred","name":null,"redux":null},{"kind":"props","evidence":"exact","name":"throughput","redux":null},{"kind":"props","evidence":"exact","name":"cycleTime","redux":null},{"kind":"props","evidence":"exact","name":"workload","redux":null}]}
[exit 0]

$ npx genie-react call react_render_causes '{"component":"Connect(ReportDataLoader)","view":"full","limit":10}' --session art-l3 --json | jq -c '{events: [.events[] | {documentCommitId, causes: [.causes[] | {kind, evidence, name, redux: (.redux // .reduxActions // null)}]}]}'
{"events":[]}
[exit 0]

$ npx genie-react call react_render_causes '{"component":"ReportDataLoader","exact":false,"view":"full","limit":10}' --session art-l3 --json > /tmp/docs7/art-l3-rc.json; jq -c '.componentMatch, [.events[] | {componentName, documentCommitId, causes: [.causes[] | {kind, evidence, name}]}]' /tmp/docs7/art-l3-rc.json
{"component":"ReportDataLoader","exact":false,"status":"ambiguous","matchedNames":["Connect(ReportDataLoader)","ReportDataLoader"],"matchedNameCount":2,"similarNames":[]}
[{"componentName":"ReportDataLoader","documentCommitId":24,"causes":[{"kind":"parent","evidence":"inferred","name":null},{"kind":"props","evidence":"exact","name":"throughput"},{"kind":"props","evidence":"exact","name":"cycleTime"},{"kind":"props","evidence":"exact","name":"workload"}]},{"componentName":"ReportDataLoader","documentCommitId":22,"causes":[{"kind":"parent","evidence":"inferred","name":null},{"kind":"props","evidence":"exact","name":"status"},{"kind":"props","evidence":"exact","name":"throughput"},{"kind":"props","evidence":"exact","name":"cycleTime"},{"kind":"props","evidence":"exact","name":"workload"}]},{"componentName":"ReportDataLoader","documentCommitId":20,"causes":[{"kind":"parent","evidence":"inferred","name":null},{"kind":"children","evidence":"exact","name":null}]},{"componentName":"ReportDataLoader","documentCommitId":18,"causes":[{"kind":"parent","evidence":"inferred","name":null},{"kind":"props","evidence":"exact","name":"status"},{"kind":"children","evidence":"exact","name":null}]}]
[exit 0]

## verify before fix (3 runs)
$ agent-browser --session art-l3 open http://127.0.0.1:5313/reports
✓ Acme Tracker
  http://127.0.0.1:5313/reports
[exit 0]

$ agent-browser --session art-l3 wait .bar-chart
✓ Done
[exit 0]

$ npx genie-react verify begin --session art-l3 --name 'switch 90d then 7d' --claim 'render ThroughputWidget max 3' --claim 'render ReportRangePicker min 1' --claim 'boundaries clean'
recording vfy_1bb074f5-90cc-4ad8-b419-29731dfad9a0 "switch 90d then 7d"
  url "http://127.0.0.1:5313/reports"
  1 null render ThroughputWidget max 3  {}
  2 null render ReportRangePicker min 1  {}
  3 null boundaries clean  {}
window: {observationId:observation:1,startDocumentCommitId:17,domains:[react],quietMs:500,timeoutMs:10000,tailMs:500}
next: $ pnpm exec genie-react verify end vfy_1bb074f5-90cc-4ad8-b419-29731dfad9a0 --session art-l3
session: {sessionId:484749c8-5d32-42fc-b89c-a2866f036089,logicalSessionId:1e6ce341-b817-4b36-8f5f-771775037b31,documentGeneration:12}
schemaVersion: "1.0"
targets: [{target:{component:ThroughputWidget},status:resolved,instances:1,source:~/.t3/worktrees/genie-react/t3-27d8ce51-91b00c8af67b2702/apps/realworld-legacy/src/features/reports/reports-page.tsx},{target:{component:ReportRangePicker},status:resolved,instances:1,source:~/.t3/worktrees/genie-react/t3-27d8ce51-91b00c8af67b2702/apps/realworld-legacy/src/features/reports/report-range-picker.tsx}]
startedAt: 2026-11-19T03:56:39.547Z
expiresAt: 2026-11-19T04:01:39.557Z
request: {budget:{fiberLimit:250,operationLimit:20000,timeLimitMs:8,targetOperationReserve:4000,targetTimeReserveMs:4,adaptive:true},settle:{quietMs:500,timeoutMs:10000},maxDurationMs:300000,allowOverrides:false}
[exit 0]

$ agent-browser --session art-l3 find role button click --name 'Last 90 days' && agent-browser --session art-l3 find role button click --name 'Last 7 days'
✓ Done
✓ Done
[exit 0]

$ npx genie-react verify end vfy_1bb074f5-90cc-4ad8-b419-29731dfad9a0 --session art-l3
fail vfy_1bb074f5-90cc-4ad8-b419-29731dfad9a0 "switch 90d then 7d"  9 commits, quiet after 2007 ms (react)
  url "http://127.0.0.1:5313/reports"
  1 fail render ThroughputWidget max 3  {renders:4,mounts:0,updates:4,remounts:0,semantics:exact,instances:1,activeInstances:1}
      claim: {kind:renders,target:{component:ThroughputWidget},max:3,counting:renders,allowRemount:false}
      deciding: [{kind:instance,mountId:mount:1,renders:4,mounts:0,updates:4,mountGeneration:1,latestDocumentCommitId:24,source:~/.t3/worktrees/genie-react/t3-27d8ce51-91b00c8af67b2702/apps/realworld-legacy/src/features/reports/reports-page.tsx:59:32}]
  2 pass render ReportRangePicker min 1  {renders:2,mounts:0,updates:2,remounts:0,semantics:exact,instances:1,activeInstances:1}
      claim: {kind:renders,target:{component:ReportRangePicker},min:1,counting:renders,allowRemount:false}
      deciding: [{kind:instance,mountId:mount:2,renders:2,mounts:0,updates:2,mountGeneration:1,latestDocumentCommitId:21,source:~/.t3/worktrees/genie-react/t3-27d8ce51-91b00c8af67b2702/apps/realworld-legacy/src/features/reports/report-range-picker.tsx:23:7}]
  3 pass boundaries clean  {caughtDuringWindow:0,caughtAtEnd:0}
      claim: {kind:boundaries-clean,scope:window}
      deciding: [{kind:boundary-log,scope:window,complete:true,afterDocumentCommitId:17}]
      caveats: [uncaught-errors-outside-boundaries-unobserved]
window: {observationId:observation:1,startDocumentCommitId:17,settledDocumentCommitId:25,frozenDocumentCommitId:26,commits:9,settle:{outcome:met,quietMs:500,timeoutMs:10000,waitedMs:2007,domains:{react:met}},tail:{ms:500,commits:1},environment:{bundle:development,strictMode:on,renderCollection:available,visibility:unavailable}}
! ui-outcome-not-observed: Genie does not check the screen; confirm it with the UI driver
! visibility-unobserved: the app reports no visibility signal, so a hidden interval was not observed
attempt 1 for these claims on this tab
evidence: $ pnpm exec genie-react verify show vfy_1bb074f5-90cc-4ad8-b419-29731dfad9a0 --claim 1 --session art-l3
session: {sessionId:484749c8-5d32-42fc-b89c-a2866f036089,logicalSessionId:1e6ce341-b817-4b36-8f5f-771775037b31,documentGeneration:12}
schemaVersion: "1.0"
exitCode: 1
stage: end
ledger: {fingerprint:cf_d47388e250e4,scope:logical-session,storage:memory,attempt:1,history:[],codeChangedSincePrevious:null,failsOnSameCode:0}
evidence: {retained:true,tools:[react_get_renders,react_component_cohort,react_list_overrides,react_refresh_events,react_profile_stop,react_error_state]}
startedAt: 2026-11-19T03:56:39.547Z
endedAt: 2026-11-19T03:56:42.382Z
request: {budget:{fiberLimit:250,operationLimit:20000,timeLimitMs:8,targetOperationReserve:4000,targetTimeReserveMs:4,adaptive:true},settle:{quietMs:500,timeoutMs:10000},maxDurationMs:300000,allowOverrides:false}
[exit 1]

$ agent-browser --session art-l3 eval "JSON.stringify({pressed: document.querySelector('[aria-label=\"Date range\"] [aria-pressed=true]').textContent, chartRange: document.querySelector('.bar-chart').dataset.range, bars: document.querySelectorAll('.bar-chart__bar').length})"
"{\"pressed\":\"Last 7 days\",\"chartRange\":\"90d\",\"bars\":13}"
[exit 0]

$ agent-browser --session art-l3 open http://127.0.0.1:5313/reports
✓ Acme Tracker
  http://127.0.0.1:5313/reports
[exit 0]

$ agent-browser --session art-l3 wait .bar-chart
✓ Done
[exit 0]

$ npx genie-react verify begin --session art-l3 --name 'switch 90d then 7d' --claim 'render ThroughputWidget max 3' --claim 'render ReportRangePicker min 1' --claim 'boundaries clean'
recording vfy_17dba6c5-60bf-4d5a-8775-ac75cede7916 "switch 90d then 7d"
  url "http://127.0.0.1:5313/reports"
  1 null render ThroughputWidget max 3  {}
  2 null render ReportRangePicker min 1  {}
  3 null boundaries clean  {}
window: {observationId:observation:1,startDocumentCommitId:17,domains:[react],quietMs:500,timeoutMs:10000,tailMs:500}
next: $ pnpm exec genie-react verify end vfy_17dba6c5-60bf-4d5a-8775-ac75cede7916 --session art-l3
session: {sessionId:2df5e5f7-9b7a-49ed-b8d7-75559fb82c55,logicalSessionId:1e6ce341-b817-4b36-8f5f-771775037b31,documentGeneration:13}
schemaVersion: "1.0"
targets: [{target:{component:ThroughputWidget},status:resolved,instances:1,source:~/.t3/worktrees/genie-react/t3-27d8ce51-91b00c8af67b2702/apps/realworld-legacy/src/features/reports/reports-page.tsx},{target:{component:ReportRangePicker},status:resolved,instances:1,source:~/.t3/worktrees/genie-react/t3-27d8ce51-91b00c8af67b2702/apps/realworld-legacy/src/features/reports/report-range-picker.tsx}]
startedAt: 2026-11-19T03:56:42.960Z
expiresAt: 2026-11-19T04:01:42.971Z
request: {budget:{fiberLimit:250,operationLimit:20000,timeLimitMs:8,targetOperationReserve:4000,targetTimeReserveMs:4,adaptive:true},settle:{quietMs:500,timeoutMs:10000},maxDurationMs:300000,allowOverrides:false}
[exit 0]

$ agent-browser --session art-l3 find role button click --name 'Last 90 days' && agent-browser --session art-l3 find role button click --name 'Last 7 days'
✓ Done
✓ Done
[exit 0]

$ npx genie-react verify end vfy_17dba6c5-60bf-4d5a-8775-ac75cede7916 --session art-l3
fail vfy_17dba6c5-60bf-4d5a-8775-ac75cede7916 "switch 90d then 7d"  9 commits, quiet after 2002 ms (react)
  url "http://127.0.0.1:5313/reports"
  1 fail render ThroughputWidget max 3  {renders:4,mounts:0,updates:4,remounts:0,semantics:exact,instances:1,activeInstances:1}
      claim: {kind:renders,target:{component:ThroughputWidget},max:3,counting:renders,allowRemount:false}
      deciding: [{kind:instance,mountId:mount:1,renders:4,mounts:0,updates:4,mountGeneration:1,latestDocumentCommitId:24,source:~/.t3/worktrees/genie-react/t3-27d8ce51-91b00c8af67b2702/apps/realworld-legacy/src/features/reports/reports-page.tsx:59:32}]
  2 pass render ReportRangePicker min 1  {renders:2,mounts:0,updates:2,remounts:0,semantics:exact,instances:1,activeInstances:1}
      claim: {kind:renders,target:{component:ReportRangePicker},min:1,counting:renders,allowRemount:false}
      deciding: [{kind:instance,mountId:mount:2,renders:2,mounts:0,updates:2,mountGeneration:1,latestDocumentCommitId:21,source:~/.t3/worktrees/genie-react/t3-27d8ce51-91b00c8af67b2702/apps/realworld-legacy/src/features/reports/report-range-picker.tsx:23:7}]
  3 pass boundaries clean  {caughtDuringWindow:0,caughtAtEnd:0}
      claim: {kind:boundaries-clean,scope:window}
      deciding: [{kind:boundary-log,scope:window,complete:true,afterDocumentCommitId:17}]
      caveats: [uncaught-errors-outside-boundaries-unobserved]
window: {observationId:observation:1,startDocumentCommitId:17,settledDocumentCommitId:25,frozenDocumentCommitId:26,commits:9,settle:{outcome:met,quietMs:500,timeoutMs:10000,waitedMs:2002,domains:{react:met}},tail:{ms:500,commits:1},environment:{bundle:development,strictMode:on,renderCollection:available,visibility:unavailable}}
! ui-outcome-not-observed: Genie does not check the screen; confirm it with the UI driver
! visibility-unobserved: the app reports no visibility signal, so a hidden interval was not observed
attempt 2 for these claims on this tab; previous fail vfy_1bb074f5-90cc-4ad8-b419-29731dfad9a0; document reloaded since
evidence: $ pnpm exec genie-react verify show vfy_17dba6c5-60bf-4d5a-8775-ac75cede7916 --claim 1 --session art-l3
session: {sessionId:2df5e5f7-9b7a-49ed-b8d7-75559fb82c55,logicalSessionId:1e6ce341-b817-4b36-8f5f-771775037b31,documentGeneration:13}
schemaVersion: "1.0"
exitCode: 1
stage: end
ledger: {fingerprint:cf_d47388e250e4,scope:logical-session,storage:memory,attempt:2,history:[{verificationId:vfy_1bb074f5-90cc-4ad8-b419-29731dfad9a0,verdict:fail,reasons:[],endedAt:2026-11-19T03:56:42.382Z}],codeChangedSincePrevious:document-reloaded,failsOnSameCode:0}
evidence: {retained:true,tools:[react_get_renders,react_component_cohort,react_list_overrides,react_refresh_events,react_profile_stop,react_error_state]}
startedAt: 2026-11-19T03:56:42.960Z
endedAt: 2026-11-19T03:56:45.789Z
request: {budget:{fiberLimit:250,operationLimit:20000,timeLimitMs:8,targetOperationReserve:4000,targetTimeReserveMs:4,adaptive:true},settle:{quietMs:500,timeoutMs:10000},maxDurationMs:300000,allowOverrides:false}
[exit 1]

$ agent-browser --session art-l3 eval "JSON.stringify({pressed: document.querySelector('[aria-label=\"Date range\"] [aria-pressed=true]').textContent, chartRange: document.querySelector('.bar-chart').dataset.range, bars: document.querySelectorAll('.bar-chart__bar').length})"
"{\"pressed\":\"Last 7 days\",\"chartRange\":\"90d\",\"bars\":13}"
[exit 0]

$ agent-browser --session art-l3 open http://127.0.0.1:5313/reports
✓ Acme Tracker
  http://127.0.0.1:5313/reports
[exit 0]

$ agent-browser --session art-l3 wait .bar-chart
✓ Done
[exit 0]

$ npx genie-react verify begin --session art-l3 --name 'switch 90d then 7d' --claim 'render ThroughputWidget max 3' --claim 'render ReportRangePicker min 1' --claim 'boundaries clean'
recording vfy_9bc49787-cfcd-4c4c-a9f8-4b18268116d4 "switch 90d then 7d"
  url "http://127.0.0.1:5313/reports"
  1 null render ThroughputWidget max 3  {}
  2 null render ReportRangePicker min 1  {}
  3 null boundaries clean  {}
window: {observationId:observation:1,startDocumentCommitId:17,domains:[react],quietMs:500,timeoutMs:10000,tailMs:500}
next: $ pnpm exec genie-react verify end vfy_9bc49787-cfcd-4c4c-a9f8-4b18268116d4 --session art-l3
session: {sessionId:c36e62ef-32fd-4426-9bd0-2b680652a0db,logicalSessionId:1e6ce341-b817-4b36-8f5f-771775037b31,documentGeneration:14}
schemaVersion: "1.0"
targets: [{target:{component:ThroughputWidget},status:resolved,instances:1,source:~/.t3/worktrees/genie-react/t3-27d8ce51-91b00c8af67b2702/apps/realworld-legacy/src/features/reports/reports-page.tsx},{target:{component:ReportRangePicker},status:resolved,instances:1,source:~/.t3/worktrees/genie-react/t3-27d8ce51-91b00c8af67b2702/apps/realworld-legacy/src/features/reports/report-range-picker.tsx}]
startedAt: 2026-11-19T03:56:46.358Z
expiresAt: 2026-11-19T04:01:46.368Z
request: {budget:{fiberLimit:250,operationLimit:20000,timeLimitMs:8,targetOperationReserve:4000,targetTimeReserveMs:4,adaptive:true},settle:{quietMs:500,timeoutMs:10000},maxDurationMs:300000,allowOverrides:false}
[exit 0]

$ agent-browser --session art-l3 find role button click --name 'Last 90 days' && agent-browser --session art-l3 find role button click --name 'Last 7 days'
✓ Done
✓ Done
[exit 0]

$ npx genie-react verify end vfy_9bc49787-cfcd-4c4c-a9f8-4b18268116d4 --session art-l3
fail vfy_9bc49787-cfcd-4c4c-a9f8-4b18268116d4 "switch 90d then 7d"  9 commits, quiet after 2003 ms (react)
  url "http://127.0.0.1:5313/reports"
  1 fail render ThroughputWidget max 3  {renders:4,mounts:0,updates:4,remounts:0,semantics:exact,instances:1,activeInstances:1}
      claim: {kind:renders,target:{component:ThroughputWidget},max:3,counting:renders,allowRemount:false}
      deciding: [{kind:instance,mountId:mount:1,renders:4,mounts:0,updates:4,mountGeneration:1,latestDocumentCommitId:24,source:~/.t3/worktrees/genie-react/t3-27d8ce51-91b00c8af67b2702/apps/realworld-legacy/src/features/reports/reports-page.tsx:59:32}]
  2 pass render ReportRangePicker min 1  {renders:2,mounts:0,updates:2,remounts:0,semantics:exact,instances:1,activeInstances:1}
      claim: {kind:renders,target:{component:ReportRangePicker},min:1,counting:renders,allowRemount:false}
      deciding: [{kind:instance,mountId:mount:2,renders:2,mounts:0,updates:2,mountGeneration:1,latestDocumentCommitId:21,source:~/.t3/worktrees/genie-react/t3-27d8ce51-91b00c8af67b2702/apps/realworld-legacy/src/features/reports/report-range-picker.tsx:23:7}]
  3 pass boundaries clean  {caughtDuringWindow:0,caughtAtEnd:0}
      claim: {kind:boundaries-clean,scope:window}
      deciding: [{kind:boundary-log,scope:window,complete:true,afterDocumentCommitId:17}]
      caveats: [uncaught-errors-outside-boundaries-unobserved]
window: {observationId:observation:1,startDocumentCommitId:17,settledDocumentCommitId:25,frozenDocumentCommitId:26,commits:9,settle:{outcome:met,quietMs:500,timeoutMs:10000,waitedMs:2003,domains:{react:met}},tail:{ms:500,commits:1},environment:{bundle:development,strictMode:on,renderCollection:available,visibility:unavailable}}
! ui-outcome-not-observed: Genie does not check the screen; confirm it with the UI driver
! visibility-unobserved: the app reports no visibility signal, so a hidden interval was not observed
attempt 3 for these claims on this tab; previous fail vfy_17dba6c5-60bf-4d5a-8775-ac75cede7916; document reloaded since
evidence: $ pnpm exec genie-react verify show vfy_9bc49787-cfcd-4c4c-a9f8-4b18268116d4 --claim 1 --session art-l3
session: {sessionId:c36e62ef-32fd-4426-9bd0-2b680652a0db,logicalSessionId:1e6ce341-b817-4b36-8f5f-771775037b31,documentGeneration:14}
schemaVersion: "1.0"
exitCode: 1
stage: end
ledger: {fingerprint:cf_d47388e250e4,scope:logical-session,storage:memory,attempt:3,history:[{verificationId:vfy_1bb074f5-90cc-4ad8-b419-29731dfad9a0,verdict:fail,reasons:[],endedAt:2026-11-19T03:56:42.382Z},{verificationId:vfy_17dba6c5-60bf-4d5a-8775-ac75cede7916,verdict:fail,reasons:[],endedAt:2026-11-19T03:56:45.789Z}],codeChangedSincePrevious:document-reloaded,failsOnSameCode:0}
evidence: {retained:true,tools:[react_get_renders,react_component_cohort,react_list_overrides,react_refresh_events,react_profile_stop,react_error_state]}
startedAt: 2026-11-19T03:56:46.358Z
endedAt: 2026-11-19T03:56:49.161Z
request: {budget:{fiberLimit:250,operationLimit:20000,timeLimitMs:8,targetOperationReserve:4000,targetTimeReserveMs:4,adaptive:true},settle:{quietMs:500,timeoutMs:10000},maxDurationMs:300000,allowOverrides:false}
[exit 1]

$ agent-browser --session art-l3 eval "JSON.stringify({pressed: document.querySelector('[aria-label=\"Date range\"] [aria-pressed=true]').textContent, chartRange: document.querySelector('.bar-chart').dataset.range, bars: document.querySelectorAll('.bar-chart__bar').length})"
"{\"pressed\":\"Last 7 days\",\"chartRange\":\"90d\",\"bars\":13}"
[exit 0]

## after the fix
diff --git a/apps/realworld-legacy/src/features/reports/state/actions.ts b/apps/realworld-legacy/src/features/reports/state/actions.ts
index 9787945..1db464c 100644
--- a/apps/realworld-legacy/src/features/reports/state/actions.ts
+++ b/apps/realworld-legacy/src/features/reports/state/actions.ts
@@ -36,15 +36,17 @@ export function removeReportNote(id: string): ReportsAction {
 }
 
 export function loadReports(projectKey: string, range: ReportRange): ReportsThunk {
-  return async (dispatch) => {
+  return async (dispatch, getState) => {
     dispatch({ type: REPORTS_REQUESTED, projectKey, range })
     const query = toQueryString({ project: projectKey, range })
     try {
       const [throughput, cycleTime, workload] = await Promise.all([
         request<ThroughputReport>(`/api/reports/throughput${query}`),
         request<CycleTimeReport>(`/api/reports/cycle-time${query}`),
         request<WorkloadReport>(`/api/reports/workload${toQueryString({ project: projectKey })}`),
       ])
+      const current = getState().reports
+      if (current.projectKey !== projectKey || current.range !== range) return
       dispatch({ type: REPORTS_RECEIVED, throughput, cycleTime, workload })
     } catch (error) {
       dispatch({
## verify after fix (3 runs)
$ agent-browser --session art-l3 open http://127.0.0.1:5313/reports
✓ Acme Tracker
  http://127.0.0.1:5313/reports
[exit 0]

$ agent-browser --session art-l3 wait .bar-chart
✓ Done
[exit 0]

$ npx genie-react verify begin --session art-l3 --name 'switch 90d then 7d' --claim 'render ThroughputWidget max 3' --claim 'render ReportRangePicker min 1' --claim 'boundaries clean'
recording vfy_541b3c0c-a4da-475d-b3f5-9c8bf9a9f6af "switch 90d then 7d"
  url "http://127.0.0.1:5313/reports"
  1 null render ThroughputWidget max 3  {}
  2 null render ReportRangePicker min 1  {}
  3 null boundaries clean  {}
window: {observationId:observation:1,startDocumentCommitId:17,domains:[react],quietMs:500,timeoutMs:10000,tailMs:500}
next: $ pnpm exec genie-react verify end vfy_541b3c0c-a4da-475d-b3f5-9c8bf9a9f6af --session art-l3
session: {sessionId:4d505630-881b-4e03-b2da-0444af114f02,logicalSessionId:1e6ce341-b817-4b36-8f5f-771775037b31,documentGeneration:16}
schemaVersion: "1.0"
targets: [{target:{component:ThroughputWidget},status:resolved,instances:1,source:~/.t3/worktrees/genie-react/t3-27d8ce51-91b00c8af67b2702/apps/realworld-legacy/src/features/reports/reports-page.tsx},{target:{component:ReportRangePicker},status:resolved,instances:1,source:~/.t3/worktrees/genie-react/t3-27d8ce51-91b00c8af67b2702/apps/realworld-legacy/src/features/reports/report-range-picker.tsx}]
startedAt: 2026-11-19T03:57:03.288Z
expiresAt: 2026-11-19T04:02:03.305Z
request: {budget:{fiberLimit:250,operationLimit:20000,timeLimitMs:8,targetOperationReserve:4000,targetTimeReserveMs:4,adaptive:true},settle:{quietMs:500,timeoutMs:10000},maxDurationMs:300000,allowOverrides:false}
[exit 0]

$ agent-browser --session art-l3 find role button click --name 'Last 90 days' && agent-browser --session art-l3 find role button click --name 'Last 7 days'
✓ Done
✓ Done
[exit 0]

$ npx genie-react verify end vfy_541b3c0c-a4da-475d-b3f5-9c8bf9a9f6af --session art-l3
pass vfy_541b3c0c-a4da-475d-b3f5-9c8bf9a9f6af "switch 90d then 7d"  7 commits, quiet after 1095 ms (react)
  url "http://127.0.0.1:5313/reports"
  1 pass render ThroughputWidget max 3  {renders:3,mounts:0,updates:3,remounts:0,semantics:exact,instances:1,activeInstances:1}
      claim: {kind:renders,target:{component:ThroughputWidget},max:3,counting:renders,allowRemount:false}
      deciding: [{kind:coverage,complete:true,targetedComplete:true,semantics:exact},{kind:instance,mountId:mount:1,renderingState:mounted-rendering,source:~/.t3/worktrees/genie-react/t3-27d8ce51-91b00c8af67b2702/apps/realworld-legacy/src/features/reports/reports-page.tsx:59:32}]
  2 pass render ReportRangePicker min 1  {renders:2,mounts:0,updates:2,remounts:0,semantics:exact,instances:1,activeInstances:1}
      claim: {kind:renders,target:{component:ReportRangePicker},min:1,counting:renders,allowRemount:false}
      deciding: [{kind:instance,mountId:mount:2,renders:2,mounts:0,updates:2,mountGeneration:1,latestDocumentCommitId:21,source:~/.t3/worktrees/genie-react/t3-27d8ce51-91b00c8af67b2702/apps/realworld-legacy/src/features/reports/report-range-picker.tsx:23:7}]
  3 pass boundaries clean  {caughtDuringWindow:0,caughtAtEnd:0}
      claim: {kind:boundaries-clean,scope:window}
      deciding: [{kind:boundary-log,scope:window,complete:true,afterDocumentCommitId:17}]
      caveats: [uncaught-errors-outside-boundaries-unobserved]
window: {observationId:observation:1,startDocumentCommitId:17,settledDocumentCommitId:23,frozenDocumentCommitId:24,commits:7,settle:{outcome:met,quietMs:500,timeoutMs:10000,waitedMs:1095,domains:{react:met}},tail:{ms:500,commits:1},environment:{bundle:development,strictMode:on,renderCollection:available,visibility:unavailable}}
! ui-outcome-not-observed: Genie does not check the screen; confirm it with the UI driver
! visibility-unobserved: the app reports no visibility signal, so a hidden interval was not observed
attempt 4 for these claims on this tab; previous fail vfy_9bc49787-cfcd-4c4c-a9f8-4b18268116d4; document reloaded since
evidence: $ pnpm exec genie-react verify show vfy_541b3c0c-a4da-475d-b3f5-9c8bf9a9f6af --session art-l3
session: {sessionId:4d505630-881b-4e03-b2da-0444af114f02,logicalSessionId:1e6ce341-b817-4b36-8f5f-771775037b31,documentGeneration:16}
schemaVersion: "1.0"
exitCode: 0
stage: end
ledger: {fingerprint:cf_d47388e250e4,scope:logical-session,storage:memory,attempt:4,history:[{verificationId:vfy_1bb074f5-90cc-4ad8-b419-29731dfad9a0,verdict:fail,reasons:[],endedAt:2026-11-19T03:56:42.382Z},{verificationId:vfy_17dba6c5-60bf-4d5a-8775-ac75cede7916,verdict:fail,reasons:[],endedAt:2026-11-19T03:56:45.789Z},{verificationId:vfy_9bc49787-cfcd-4c4c-a9f8-4b18268116d4,verdict:fail,reasons:[],endedAt:2026-11-19T03:56:49.161Z}],codeChangedSincePrevious:document-reloaded,failsOnSameCode:0}
evidence: {retained:true,tools:[react_get_renders,react_component_cohort,react_list_overrides,react_refresh_events,react_profile_stop,react_error_state]}
startedAt: 2026-11-19T03:57:03.288Z
endedAt: 2026-11-19T03:57:05.212Z
request: {budget:{fiberLimit:250,operationLimit:20000,timeLimitMs:8,targetOperationReserve:4000,targetTimeReserveMs:4,adaptive:true},settle:{quietMs:500,timeoutMs:10000},maxDurationMs:300000,allowOverrides:false}
[exit 0]

$ agent-browser --session art-l3 eval "JSON.stringify({pressed: document.querySelector('[aria-label=\"Date range\"] [aria-pressed=true]').textContent, chartRange: document.querySelector('.bar-chart').dataset.range, bars: document.querySelectorAll('.bar-chart__bar').length})"
"{\"pressed\":\"Last 7 days\",\"chartRange\":\"7d\",\"bars\":7}"
[exit 0]

$ agent-browser --session art-l3 open http://127.0.0.1:5313/reports
✓ Acme Tracker
  http://127.0.0.1:5313/reports
[exit 0]

$ agent-browser --session art-l3 wait .bar-chart
✓ Done
[exit 0]

$ npx genie-react verify begin --session art-l3 --name 'switch 90d then 7d' --claim 'render ThroughputWidget max 3' --claim 'render ReportRangePicker min 1' --claim 'boundaries clean'
recording vfy_96c0c204-23e9-4b8e-b9b4-d0f126839cc5 "switch 90d then 7d"
  url "http://127.0.0.1:5313/reports"
  1 null render ThroughputWidget max 3  {}
  2 null render ReportRangePicker min 1  {}
  3 null boundaries clean  {}
window: {observationId:observation:1,startDocumentCommitId:17,domains:[react],quietMs:500,timeoutMs:10000,tailMs:500}
next: $ pnpm exec genie-react verify end vfy_96c0c204-23e9-4b8e-b9b4-d0f126839cc5 --session art-l3
session: {sessionId:22f55ec3-5f4a-444a-a6e6-6e0b36b4a618,logicalSessionId:1e6ce341-b817-4b36-8f5f-771775037b31,documentGeneration:17}
schemaVersion: "1.0"
targets: [{target:{component:ThroughputWidget},status:resolved,instances:1,source:~/.t3/worktrees/genie-react/t3-27d8ce51-91b00c8af67b2702/apps/realworld-legacy/src/features/reports/reports-page.tsx},{target:{component:ReportRangePicker},status:resolved,instances:1,source:~/.t3/worktrees/genie-react/t3-27d8ce51-91b00c8af67b2702/apps/realworld-legacy/src/features/reports/report-range-picker.tsx}]
startedAt: 2026-11-19T03:57:05.817Z
expiresAt: 2026-11-19T04:02:05.839Z
request: {budget:{fiberLimit:250,operationLimit:20000,timeLimitMs:8,targetOperationReserve:4000,targetTimeReserveMs:4,adaptive:true},settle:{quietMs:500,timeoutMs:10000},maxDurationMs:300000,allowOverrides:false}
[exit 0]

$ agent-browser --session art-l3 find role button click --name 'Last 90 days' && agent-browser --session art-l3 find role button click --name 'Last 7 days'
✓ Done
✓ Done
[exit 0]

$ npx genie-react verify end vfy_96c0c204-23e9-4b8e-b9b4-d0f126839cc5 --session art-l3
pass vfy_96c0c204-23e9-4b8e-b9b4-d0f126839cc5 "switch 90d then 7d"  7 commits, quiet after 1092 ms (react)
  url "http://127.0.0.1:5313/reports"
  1 pass render ThroughputWidget max 3  {renders:3,mounts:0,updates:3,remounts:0,semantics:exact,instances:1,activeInstances:1}
      claim: {kind:renders,target:{component:ThroughputWidget},max:3,counting:renders,allowRemount:false}
      deciding: [{kind:coverage,complete:true,targetedComplete:true,semantics:exact},{kind:instance,mountId:mount:1,renderingState:mounted-rendering,source:~/.t3/worktrees/genie-react/t3-27d8ce51-91b00c8af67b2702/apps/realworld-legacy/src/features/reports/reports-page.tsx:59:32}]
  2 pass render ReportRangePicker min 1  {renders:2,mounts:0,updates:2,remounts:0,semantics:exact,instances:1,activeInstances:1}
      claim: {kind:renders,target:{component:ReportRangePicker},min:1,counting:renders,allowRemount:false}
      deciding: [{kind:instance,mountId:mount:2,renders:2,mounts:0,updates:2,mountGeneration:1,latestDocumentCommitId:21,source:~/.t3/worktrees/genie-react/t3-27d8ce51-91b00c8af67b2702/apps/realworld-legacy/src/features/reports/report-range-picker.tsx:23:7}]
  3 pass boundaries clean  {caughtDuringWindow:0,caughtAtEnd:0}
      claim: {kind:boundaries-clean,scope:window}
      deciding: [{kind:boundary-log,scope:window,complete:true,afterDocumentCommitId:17}]
      caveats: [uncaught-errors-outside-boundaries-unobserved]
window: {observationId:observation:1,startDocumentCommitId:17,settledDocumentCommitId:23,frozenDocumentCommitId:24,commits:7,settle:{outcome:met,quietMs:500,timeoutMs:10000,waitedMs:1092,domains:{react:met}},tail:{ms:500,commits:1},environment:{bundle:development,strictMode:on,renderCollection:available,visibility:unavailable}}
! ui-outcome-not-observed: Genie does not check the screen; confirm it with the UI driver
! visibility-unobserved: the app reports no visibility signal, so a hidden interval was not observed
attempt 5 for these claims on this tab; previous pass vfy_541b3c0c-a4da-475d-b3f5-9c8bf9a9f6af; document reloaded since
evidence: $ pnpm exec genie-react verify show vfy_96c0c204-23e9-4b8e-b9b4-d0f126839cc5 --session art-l3
session: {sessionId:22f55ec3-5f4a-444a-a6e6-6e0b36b4a618,logicalSessionId:1e6ce341-b817-4b36-8f5f-771775037b31,documentGeneration:17}
schemaVersion: "1.0"
exitCode: 0
stage: end
ledger: {fingerprint:cf_d47388e250e4,scope:logical-session,storage:memory,attempt:5,history:[{verificationId:vfy_1bb074f5-90cc-4ad8-b419-29731dfad9a0,verdict:fail,reasons:[],endedAt:2026-11-19T03:56:42.382Z},{verificationId:vfy_17dba6c5-60bf-4d5a-8775-ac75cede7916,verdict:fail,reasons:[],endedAt:2026-11-19T03:56:45.789Z},{verificationId:vfy_9bc49787-cfcd-4c4c-a9f8-4b18268116d4,verdict:fail,reasons:[],endedAt:2026-11-19T03:56:49.161Z},{verificationId:vfy_541b3c0c-a4da-475d-b3f5-9c8bf9a9f6af,verdict:pass,reasons:[],endedAt:2026-11-19T03:57:05.212Z}],codeChangedSincePrevious:document-reloaded,failsOnSameCode:0}
evidence: {retained:true,tools:[react_get_renders,react_component_cohort,react_list_overrides,react_refresh_events,react_profile_stop,react_error_state]}
startedAt: 2026-11-19T03:57:05.817Z
endedAt: 2026-11-19T03:57:07.744Z
request: {budget:{fiberLimit:250,operationLimit:20000,timeLimitMs:8,targetOperationReserve:4000,targetTimeReserveMs:4,adaptive:true},settle:{quietMs:500,timeoutMs:10000},maxDurationMs:300000,allowOverrides:false}
[exit 0]

$ agent-browser --session art-l3 eval "JSON.stringify({pressed: document.querySelector('[aria-label=\"Date range\"] [aria-pressed=true]').textContent, chartRange: document.querySelector('.bar-chart').dataset.range, bars: document.querySelectorAll('.bar-chart__bar').length})"
"{\"pressed\":\"Last 7 days\",\"chartRange\":\"7d\",\"bars\":7}"
[exit 0]

$ agent-browser --session art-l3 open http://127.0.0.1:5313/reports
✓ Acme Tracker
  http://127.0.0.1:5313/reports
[exit 0]

$ agent-browser --session art-l3 wait .bar-chart
✓ Done
[exit 0]

$ npx genie-react verify begin --session art-l3 --name 'switch 90d then 7d' --claim 'render ThroughputWidget max 3' --claim 'render ReportRangePicker min 1' --claim 'boundaries clean'
recording vfy_19f2783e-14b1-4d23-995d-d39f599d73b9 "switch 90d then 7d"
  url "http://127.0.0.1:5313/reports"
  1 null render ThroughputWidget max 3  {}
  2 null render ReportRangePicker min 1  {}
  3 null boundaries clean  {}
window: {observationId:observation:1,startDocumentCommitId:17,domains:[react],quietMs:500,timeoutMs:10000,tailMs:500}
next: $ pnpm exec genie-react verify end vfy_19f2783e-14b1-4d23-995d-d39f599d73b9 --session art-l3
session: {sessionId:1eae537b-011f-40b0-aef7-b9071b79325e,logicalSessionId:1e6ce341-b817-4b36-8f5f-771775037b31,documentGeneration:18}
schemaVersion: "1.0"
targets: [{target:{component:ThroughputWidget},status:resolved,instances:1,source:~/.t3/worktrees/genie-react/t3-27d8ce51-91b00c8af67b2702/apps/realworld-legacy/src/features/reports/reports-page.tsx},{target:{component:ReportRangePicker},status:resolved,instances:1,source:~/.t3/worktrees/genie-react/t3-27d8ce51-91b00c8af67b2702/apps/realworld-legacy/src/features/reports/report-range-picker.tsx}]
startedAt: 2026-11-19T03:57:08.347Z
expiresAt: 2026-11-19T04:02:08.357Z
request: {budget:{fiberLimit:250,operationLimit:20000,timeLimitMs:8,targetOperationReserve:4000,targetTimeReserveMs:4,adaptive:true},settle:{quietMs:500,timeoutMs:10000},maxDurationMs:300000,allowOverrides:false}
[exit 0]

$ agent-browser --session art-l3 find role button click --name 'Last 90 days' && agent-browser --session art-l3 find role button click --name 'Last 7 days'
✓ Done
✓ Done
[exit 0]

$ npx genie-react verify end vfy_19f2783e-14b1-4d23-995d-d39f599d73b9 --session art-l3
pass vfy_19f2783e-14b1-4d23-995d-d39f599d73b9 "switch 90d then 7d"  7 commits, quiet after 942 ms (react)
  url "http://127.0.0.1:5313/reports"
  1 pass render ThroughputWidget max 3  {renders:3,mounts:0,updates:3,remounts:0,semantics:exact,instances:1,activeInstances:1}
      claim: {kind:renders,target:{component:ThroughputWidget},max:3,counting:renders,allowRemount:false}
      deciding: [{kind:coverage,complete:true,targetedComplete:true,semantics:exact},{kind:instance,mountId:mount:1,renderingState:mounted-rendering,source:~/.t3/worktrees/genie-react/t3-27d8ce51-91b00c8af67b2702/apps/realworld-legacy/src/features/reports/reports-page.tsx:59:32}]
  2 pass render ReportRangePicker min 1  {renders:2,mounts:0,updates:2,remounts:0,semantics:exact,instances:1,activeInstances:1}
      claim: {kind:renders,target:{component:ReportRangePicker},min:1,counting:renders,allowRemount:false}
      deciding: [{kind:instance,mountId:mount:2,renders:2,mounts:0,updates:2,mountGeneration:1,latestDocumentCommitId:21,source:~/.t3/worktrees/genie-react/t3-27d8ce51-91b00c8af67b2702/apps/realworld-legacy/src/features/reports/report-range-picker.tsx:23:7}]
  3 pass boundaries clean  {caughtDuringWindow:0,caughtAtEnd:0}
      claim: {kind:boundaries-clean,scope:window}
      deciding: [{kind:boundary-log,scope:window,complete:true,afterDocumentCommitId:17}]
      caveats: [uncaught-errors-outside-boundaries-unobserved]
window: {observationId:observation:1,startDocumentCommitId:17,settledDocumentCommitId:23,frozenDocumentCommitId:24,commits:7,settle:{outcome:met,quietMs:500,timeoutMs:10000,waitedMs:942,domains:{react:met}},tail:{ms:500,commits:1},environment:{bundle:development,strictMode:on,renderCollection:available,visibility:unavailable}}
! ui-outcome-not-observed: Genie does not check the screen; confirm it with the UI driver
! visibility-unobserved: the app reports no visibility signal, so a hidden interval was not observed
attempt 6 for these claims on this tab; previous pass vfy_96c0c204-23e9-4b8e-b9b4-d0f126839cc5; document reloaded since
evidence: $ pnpm exec genie-react verify show vfy_19f2783e-14b1-4d23-995d-d39f599d73b9 --session art-l3
session: {sessionId:1eae537b-011f-40b0-aef7-b9071b79325e,logicalSessionId:1e6ce341-b817-4b36-8f5f-771775037b31,documentGeneration:18}
schemaVersion: "1.0"
exitCode: 0
stage: end
ledger: {fingerprint:cf_d47388e250e4,scope:logical-session,storage:memory,attempt:6,history:[{verificationId:vfy_1bb074f5-90cc-4ad8-b419-29731dfad9a0,verdict:fail,reasons:[],endedAt:2026-11-19T03:56:42.382Z},{verificationId:vfy_17dba6c5-60bf-4d5a-8775-ac75cede7916,verdict:fail,reasons:[],endedAt:2026-11-19T03:56:45.789Z},{verificationId:vfy_9bc49787-cfcd-4c4c-a9f8-4b18268116d4,verdict:fail,reasons:[],endedAt:2026-11-19T03:56:49.161Z},{verificationId:vfy_541b3c0c-a4da-475d-b3f5-9c8bf9a9f6af,verdict:pass,reasons:[],endedAt:2026-11-19T03:57:05.212Z},{verificationId:vfy_96c0c204-23e9-4b8e-b9b4-d0f126839cc5,verdict:pass,reasons:[],endedAt:2026-11-19T03:57:07.744Z}],codeChangedSincePrevious:document-reloaded,failsOnSameCode:0}
evidence: {retained:true,tools:[react_get_renders,react_component_cohort,react_list_overrides,react_refresh_events,react_profile_stop,react_error_state]}
startedAt: 2026-11-19T03:57:08.347Z
endedAt: 2026-11-19T03:57:10.146Z
request: {budget:{fiberLimit:250,operationLimit:20000,timeLimitMs:8,targetOperationReserve:4000,targetTimeReserveMs:4,adaptive:true},settle:{quietMs:500,timeoutMs:10000},maxDurationMs:300000,allowOverrides:false}
[exit 0]

$ agent-browser --session art-l3 eval "JSON.stringify({pressed: document.querySelector('[aria-label=\"Date range\"] [aria-pressed=true]').textContent, chartRange: document.querySelector('.bar-chart').dataset.range, bars: document.querySelectorAll('.bar-chart__bar').length})"
"{\"pressed\":\"Last 7 days\",\"chartRange\":\"7d\",\"bars\":7}"
[exit 0]

## after fix: timeline + redux_actions
$ agent-browser --session art-l3 open http://127.0.0.1:5313/reports
✓ Acme Tracker
  http://127.0.0.1:5313/reports
[exit 0]

$ agent-browser --session art-l3 wait .bar-chart
✓ Done
[exit 0]

$ npx genie-react call redux_actions '{"limit":1}' --session art-l3 --json | jq .latestSequence
146

$ npx genie-react call timeline_start '{"name":"range switch after fix","queryValues":"plain"}' --session art-l3 --json
{"id":"timeline-d9cfee2e-9cad-42d6-ad3c-924f16875e72","name":"range switch after fix","state":"recording","stopReason":null,"durationMs":0.7,"maxEvents":1000,"maxDurationMs":30000,"eventCount":0,"truncated":false,"correlation":"temporal-only","clock":"performance.now","ordering":"observation-time-then-sequence","coverage":{"request":{"status":"available","code":"resource-timing-and-fetch","detail":"Fetch/XHR Resource Timing joined with the app's fetch and XMLHttpRequest calls made during the recording, which add method, outcome (including an abort after the response headers), when the app finished reading the body, and requests still in flight at stop. A request the app sent through a fetch reference captured before recording has method null. Requests seen only through those calls, and requests still in flight, are added when the recording stops. Requests started before recording may appear without a method. Worker and non-fetch/XHR requests are absent. Cross-origin detailed timing and responseReceived require Timing-Allow-Origin. URLs omit credentials and fragments; query parameter values are salted hashes unless queryValues is plain."},"query":{"status":"unavailable","code":"no-query-client","detail":"No QueryClient supplied. Only the supplied QueryCache is observed."},"react":{"status":"available","code":"react-root-commits","detail":"Supported development React root commits; hook must precede React. renderDurationMs is root actualDuration when positive, otherwise null with renderDurationUnavailable saying why; not commit wall time, native UI timing, effects or component attribution. No Fiber tree traversal."},"navigation":{"status":"unavailable","code":"no-tanstack-router","detail":"No TanStack Router supplied; other routers and native navigation are not observed."}},"queryValues":"plain","genieRequestsExcluded":0}
[exit 0]

$ agent-browser --session art-l3 find role button click --name 'Last 90 days' && agent-browser --session art-l3 find role button click --name 'Last 7 days'
✓ Done
✓ Done
[exit 0]

$ agent-browser --session art-l3 wait 2000
✓ Done
[exit 0]

$ npx genie-react call react_quiesce '{"idleMs":500,"timeoutMs":10000}' --fail-on-result-error --session art-l3 --fields outcome
[1]:
  - {outcome:idle}
[exit 0]

$ npx genie-react call timeline_stop '{"id":"timeline-d9cfee2e-9cad-42d6-ad3c-924f16875e72"}' --session art-l3 --fields stopReason,eventCount,truncated
[1]:
  - {stopReason:manual,eventCount:15,truncated:false}
[exit 0]

$ npx genie-react call timeline_read '{"id":"timeline-d9cfee2e-9cad-42d6-ad3c-924f16875e72","domains":["request"]}' --session art-l3 --fields atMs,details
[6]:
  each: {details:{initiatorType:fetch,startedBeforeRecording:false,detailedTimingAvailable:true,responseStatus:200,responseReceived:true,method:GET,outcome:response,overlappingSameEndpoint:1}}
  - {atMs:109.1,details:{url:http://127.0.0.1:5313/api/reports/cycle-time,query:"?project=CORE&range=90d",startMs:47,endMs:108.5,durationMs:61.5,bodyReadMs:108.9,finishedAfterNewer:false,bodyReadLast:false}}
  - {atMs:109.3,details:{url:http://127.0.0.1:5313/api/reports/workload,query:"?project=CORE",startMs:47.1,endMs:108.7,durationMs:61.6,bodyReadMs:109.2,finishedAfterNewer:false,bodyReadLast:false}}
  - {atMs:136.9,details:{url:http://127.0.0.1:5313/api/reports/throughput,query:"?project=CORE&range=7d",startMs:74.9,endMs:136.4,durationMs:61.5,bodyReadMs:136.9,finishedAfterNewer:false,bodyReadLast:false}}
  - {atMs:136.9,details:{url:http://127.0.0.1:5313/api/reports/cycle-time,query:"?project=CORE&range=7d",startMs:75,endMs:136.5,durationMs:61.5,bodyReadMs:136.9,finishedAfterNewer:false,bodyReadLast:true}}
  - {atMs:174.8,details:{url:http://127.0.0.1:5313/api/reports/workload,query:"?project=CORE",startMs:75,endMs:170.5,durationMs:95.5,bodyReadMs:170.9,finishedAfterNewer:false,bodyReadLast:true}}
  - {atMs:1309.3,details:{url:http://127.0.0.1:5313/api/reports/throughput,query:"?project=CORE&range=90d",startMs:47,endMs:1308.9,durationMs:1261.9,bodyReadMs:1309.1,finishedAfterNewer:true,bodyReadLast:true}}
[exit 0]

$ npx genie-react call redux_actions '{"afterSequence":146,"typePrefix":"reports/","view":"full"}' --session art-l3 --json | jq -c '[.records[] | {sequence, type, parentActionId, range: .payload.range, throughputRange: .payload.throughput.range}]'
[{"sequence":148,"type":"reports/REQUESTED","parentActionId":"redux-store:1/action:147","range":"90d","throughputRange":null},{"sequence":166,"type":"reports/REQUESTED","parentActionId":"redux-store:1/action:165","range":"7d","throughputRange":null},{"sequence":183,"type":"reports/RECEIVED","parentActionId":"redux-store:1/action:165","range":null,"throughputRange":"7d"}]
[exit 0]

$ npx genie-react call redux_state '{"path":["reports","range"]}' --session art-l3 --fields value
[1]:
  - {value:7d}
[exit 0]

$ agent-browser --session art-l3 eval "JSON.stringify({pressed: document.querySelector('[aria-label=\"Date range\"] [aria-pressed=true]').textContent, chartRange: document.querySelector('.bar-chart').dataset.range, bars: document.querySelectorAll('.bar-chart__bar').length})"
"{\"pressed\":\"Last 7 days\",\"chartRange\":\"7d\",\"bars\":7}"
[exit 0]

## reverted with: git checkout -- src/features/reports/state/actions.ts
## limitation test: shipped code, 90d latency 5000 ms
$ npx genie-react call app_backend_faults '{"rules":[{"method":"GET","path":"/api/reports/throughput","query":{"range":"90d"},"latencyMs":5000}]}' --session art-l3
rules[1]:
  - {method:GET,path:/api/reports/throughput,query:{range:90d},latencyMs:5000,status:null,times:null,hits:0}
[exit 0]

$ agent-browser --session art-l3 open http://127.0.0.1:5313/reports
✓ Acme Tracker
  http://127.0.0.1:5313/reports
[exit 0]

$ agent-browser --session art-l3 wait .bar-chart
✓ Done
[exit 0]

$ npx genie-react verify begin --session art-l3 --name 'switch 90d then 7d' --claim 'render ThroughputWidget max 3' --claim 'render ReportRangePicker min 1' --claim 'boundaries clean'
recording vfy_078b910d-aca6-4523-81d1-fb6468b185b8 "switch 90d then 7d"
  url "http://127.0.0.1:5313/reports"
  1 null render ThroughputWidget max 3  {}
  2 null render ReportRangePicker min 1  {}
  3 null boundaries clean  {}
window: {observationId:observation:1,startDocumentCommitId:17,domains:[react],quietMs:500,timeoutMs:10000,tailMs:500}
next: $ pnpm exec genie-react verify end vfy_078b910d-aca6-4523-81d1-fb6468b185b8 --session art-l3
session: {sessionId:68e9018e-cdb7-46ee-8cd9-4ddefd5dbe4e,logicalSessionId:1e6ce341-b817-4b36-8f5f-771775037b31,documentGeneration:21}
schemaVersion: "1.0"
targets: [{target:{component:ThroughputWidget},status:resolved,instances:1,source:~/.t3/worktrees/genie-react/t3-27d8ce51-91b00c8af67b2702/apps/realworld-legacy/src/features/reports/reports-page.tsx},{target:{component:ReportRangePicker},status:resolved,instances:1,source:~/.t3/worktrees/genie-react/t3-27d8ce51-91b00c8af67b2702/apps/realworld-legacy/src/features/reports/report-range-picker.tsx}]
startedAt: 2026-11-19T03:57:47.511Z
expiresAt: 2026-11-19T04:02:47.521Z
request: {budget:{fiberLimit:250,operationLimit:20000,timeLimitMs:8,targetOperationReserve:4000,targetTimeReserveMs:4,adaptive:true},settle:{quietMs:500,timeoutMs:10000},maxDurationMs:300000,allowOverrides:false}
[exit 0]

$ agent-browser --session art-l3 find role button click --name 'Last 90 days' && agent-browser --session art-l3 find role button click --name 'Last 7 days'
✓ Done
✓ Done
[exit 0]

$ npx genie-react verify end vfy_078b910d-aca6-4523-81d1-fb6468b185b8 --session art-l3
pass vfy_078b910d-aca6-4523-81d1-fb6468b185b8 "switch 90d then 7d"  7 commits, quiet after 1099 ms (react)
  url "http://127.0.0.1:5313/reports"
  1 pass render ThroughputWidget max 3  {renders:3,mounts:0,updates:3,remounts:0,semantics:exact,instances:1,activeInstances:1}
      claim: {kind:renders,target:{component:ThroughputWidget},max:3,counting:renders,allowRemount:false}
      deciding: [{kind:coverage,complete:true,targetedComplete:true,semantics:exact},{kind:instance,mountId:mount:1,renderingState:mounted-rendering,source:~/.t3/worktrees/genie-react/t3-27d8ce51-91b00c8af67b2702/apps/realworld-legacy/src/features/reports/reports-page.tsx:59:32}]
  2 pass render ReportRangePicker min 1  {renders:2,mounts:0,updates:2,remounts:0,semantics:exact,instances:1,activeInstances:1}
      claim: {kind:renders,target:{component:ReportRangePicker},min:1,counting:renders,allowRemount:false}
      deciding: [{kind:instance,mountId:mount:2,renders:2,mounts:0,updates:2,mountGeneration:1,latestDocumentCommitId:21,source:~/.t3/worktrees/genie-react/t3-27d8ce51-91b00c8af67b2702/apps/realworld-legacy/src/features/reports/report-range-picker.tsx:23:7}]
  3 pass boundaries clean  {caughtDuringWindow:0,caughtAtEnd:0}
      claim: {kind:boundaries-clean,scope:window}
      deciding: [{kind:boundary-log,scope:window,complete:true,afterDocumentCommitId:17}]
      caveats: [uncaught-errors-outside-boundaries-unobserved]
window: {observationId:observation:1,startDocumentCommitId:17,settledDocumentCommitId:23,frozenDocumentCommitId:24,commits:7,settle:{outcome:met,quietMs:500,timeoutMs:10000,waitedMs:1099,domains:{react:met}},tail:{ms:500,commits:1},environment:{bundle:development,strictMode:on,renderCollection:available,visibility:unavailable}}
! ui-outcome-not-observed: Genie does not check the screen; confirm it with the UI driver
! visibility-unobserved: the app reports no visibility signal, so a hidden interval was not observed
attempt 7 for these claims on this tab; previous pass vfy_19f2783e-14b1-4d23-995d-d39f599d73b9; document reloaded since
evidence: $ pnpm exec genie-react verify show vfy_078b910d-aca6-4523-81d1-fb6468b185b8 --session art-l3
session: {sessionId:68e9018e-cdb7-46ee-8cd9-4ddefd5dbe4e,logicalSessionId:1e6ce341-b817-4b36-8f5f-771775037b31,documentGeneration:21}
schemaVersion: "1.0"
exitCode: 0
stage: end
ledger: {fingerprint:cf_d47388e250e4,scope:logical-session,storage:memory,attempt:7,history:[{verificationId:vfy_1bb074f5-90cc-4ad8-b419-29731dfad9a0,verdict:fail,reasons:[],endedAt:2026-11-19T03:56:42.382Z},{verificationId:vfy_17dba6c5-60bf-4d5a-8775-ac75cede7916,verdict:fail,reasons:[],endedAt:2026-11-19T03:56:45.789Z},{verificationId:vfy_9bc49787-cfcd-4c4c-a9f8-4b18268116d4,verdict:fail,reasons:[],endedAt:2026-11-19T03:56:49.161Z},{verificationId:vfy_541b3c0c-a4da-475d-b3f5-9c8bf9a9f6af,verdict:pass,reasons:[],endedAt:2026-11-19T03:57:05.212Z},{verificationId:vfy_96c0c204-23e9-4b8e-b9b4-d0f126839cc5,verdict:pass,reasons:[],endedAt:2026-11-19T03:57:07.744Z},{verificationId:vfy_19f2783e-14b1-4d23-995d-d39f599d73b9,verdict:pass,reasons:[],endedAt:2026-11-19T03:57:10.146Z}],codeChangedSincePrevious:document-reloaded,failsOnSameCode:0}
evidence: {retained:true,tools:[react_get_renders,react_component_cohort,react_list_overrides,react_refresh_events,react_profile_stop,react_error_state]}
startedAt: 2026-11-19T03:57:47.511Z
endedAt: 2026-11-19T03:57:49.449Z
request: {budget:{fiberLimit:250,operationLimit:20000,timeLimitMs:8,targetOperationReserve:4000,targetTimeReserveMs:4,adaptive:true},settle:{quietMs:500,timeoutMs:10000},maxDurationMs:300000,allowOverrides:false}
[exit 0]

$ agent-browser --session art-l3 eval "JSON.stringify({pressed: document.querySelector('[aria-label=\"Date range\"] [aria-pressed=true]').textContent, chartRange: document.querySelector('.bar-chart').dataset.range, bars: document.querySelectorAll('.bar-chart__bar').length})"
"{\"pressed\":\"Last 7 days\",\"chartRange\":\"7d\",\"bars\":7}"
[exit 0]

$ agent-browser --session art-l3 wait 5000
✓ Done
[exit 0]

$ agent-browser --session art-l3 eval "JSON.stringify({pressed: document.querySelector('[aria-label=\"Date range\"] [aria-pressed=true]').textContent, chartRange: document.querySelector('.bar-chart').dataset.range, bars: document.querySelectorAll('.bar-chart__bar').length})"
"{\"pressed\":\"Last 7 days\",\"chartRange\":\"90d\",\"bars\":13}"
[exit 0]

$ npx genie-react call app_backend_faults '{"rules":[]}' --session art-l3
rules: []
[exit 0]

## limitation workaround: shipped code, 90d latency 5000 ms, --tail-ms 6000
$ npx genie-react call app_backend_faults '{"rules":[{"method":"GET","path":"/api/reports/throughput","query":{"range":"90d"},"latencyMs":5000}]}' --session art-l3
rules[1]:
  - {method:GET,path:/api/reports/throughput,query:{range:90d},latencyMs:5000,status:null,times:null,hits:0}
[exit 0]

$ agent-browser --session art-l3 open http://127.0.0.1:5313/reports
✓ Acme Tracker
  http://127.0.0.1:5313/reports
[exit 0]

$ agent-browser --session art-l3 wait .bar-chart
✓ Done
[exit 0]

$ npx genie-react verify begin --session art-l3 --name 'switch 90d then 7d' --tail-ms 6000 --claim 'render ThroughputWidget max 3' --claim 'render ReportRangePicker min 1' --claim 'boundaries clean'
recording vfy_7c44d117-f168-4c3d-a8a1-339d3e5ad21e "switch 90d then 7d"
  url "http://127.0.0.1:5313/reports"
  1 null render ThroughputWidget max 3  {}
  2 null render ReportRangePicker min 1  {}
  3 null boundaries clean  {}
window: {observationId:observation:1,startDocumentCommitId:17,domains:[react],quietMs:500,timeoutMs:10000,tailMs:6000}
next: $ pnpm exec genie-react verify end vfy_7c44d117-f168-4c3d-a8a1-339d3e5ad21e --session art-l3
session: {sessionId:beb8723f-e98d-4450-9863-873e99007904,logicalSessionId:1e6ce341-b817-4b36-8f5f-771775037b31,documentGeneration:22}
schemaVersion: "1.0"
targets: [{target:{component:ThroughputWidget},status:resolved,instances:1,source:~/.t3/worktrees/genie-react/t3-27d8ce51-91b00c8af67b2702/apps/realworld-legacy/src/features/reports/reports-page.tsx},{target:{component:ReportRangePicker},status:resolved,instances:1,source:~/.t3/worktrees/genie-react/t3-27d8ce51-91b00c8af67b2702/apps/realworld-legacy/src/features/reports/report-range-picker.tsx}]
startedAt: 2026-11-19T03:58:13.135Z
expiresAt: 2026-11-19T04:03:13.146Z
request: {budget:{fiberLimit:250,operationLimit:20000,timeLimitMs:8,targetOperationReserve:4000,targetTimeReserveMs:4,adaptive:true},settle:{quietMs:500,timeoutMs:10000},tailMs:6000,maxDurationMs:300000,allowOverrides:false}
[exit 0]

$ agent-browser --session art-l3 find role button click --name 'Last 90 days' && agent-browser --session art-l3 find role button click --name 'Last 7 days'
✓ Done
✓ Done
[exit 0]

$ npx genie-react verify end vfy_7c44d117-f168-4c3d-a8a1-339d3e5ad21e --session art-l3
fail vfy_7c44d117-f168-4c3d-a8a1-339d3e5ad21e "switch 90d then 7d"  13 commits, quiet after 1098 ms (react)
  url "http://127.0.0.1:5313/reports"
  1 fail render ThroughputWidget max 3  {renders:4,mounts:0,updates:4,remounts:0,semantics:exact,instances:1,activeInstances:1}
      claim: {kind:renders,target:{component:ThroughputWidget},max:3,counting:renders,allowRemount:false}
      deciding: [{kind:instance,mountId:mount:1,renders:4,mounts:0,updates:4,mountGeneration:1,latestDocumentCommitId:28,source:~/.t3/worktrees/genie-react/t3-27d8ce51-91b00c8af67b2702/apps/realworld-legacy/src/features/reports/reports-page.tsx:59:32}]
  2 pass render ReportRangePicker min 1  {renders:2,mounts:0,updates:2,remounts:0,semantics:exact,instances:1,activeInstances:1}
      claim: {kind:renders,target:{component:ReportRangePicker},min:1,counting:renders,allowRemount:false}
      deciding: [{kind:instance,mountId:mount:2,renders:2,mounts:0,updates:2,mountGeneration:1,latestDocumentCommitId:21,source:~/.t3/worktrees/genie-react/t3-27d8ce51-91b00c8af67b2702/apps/realworld-legacy/src/features/reports/report-range-picker.tsx:23:7}]
  3 pass boundaries clean  {caughtDuringWindow:0,caughtAtEnd:0}
      claim: {kind:boundaries-clean,scope:window}
      deciding: [{kind:boundary-log,scope:window,complete:true,afterDocumentCommitId:17}]
      caveats: [uncaught-errors-outside-boundaries-unobserved]
window: {observationId:observation:1,startDocumentCommitId:17,settledDocumentCommitId:23,frozenDocumentCommitId:30,commits:13,settle:{outcome:met,quietMs:500,timeoutMs:10000,waitedMs:1098,domains:{react:met}},tail:{ms:6000,commits:7},environment:{bundle:development,strictMode:on,renderCollection:available,visibility:unavailable}}
! ui-outcome-not-observed: Genie does not check the screen; confirm it with the UI driver
! visibility-unobserved: the app reports no visibility signal, so a hidden interval was not observed
attempt 8 for these claims on this tab; previous pass vfy_078b910d-aca6-4523-81d1-fb6468b185b8; document reloaded since
evidence: $ pnpm exec genie-react verify show vfy_7c44d117-f168-4c3d-a8a1-339d3e5ad21e --claim 1 --session art-l3
session: {sessionId:beb8723f-e98d-4450-9863-873e99007904,logicalSessionId:1e6ce341-b817-4b36-8f5f-771775037b31,documentGeneration:22}
schemaVersion: "1.0"
exitCode: 1
stage: end
ledger: {fingerprint:cf_d47388e250e4,scope:logical-session,storage:memory,attempt:8,history:[{verificationId:vfy_1bb074f5-90cc-4ad8-b419-29731dfad9a0,verdict:fail,reasons:[],endedAt:2026-11-19T03:56:42.382Z},{verificationId:vfy_17dba6c5-60bf-4d5a-8775-ac75cede7916,verdict:fail,reasons:[],endedAt:2026-11-19T03:56:45.789Z},{verificationId:vfy_9bc49787-cfcd-4c4c-a9f8-4b18268116d4,verdict:fail,reasons:[],endedAt:2026-11-19T03:56:49.161Z},{verificationId:vfy_541b3c0c-a4da-475d-b3f5-9c8bf9a9f6af,verdict:pass,reasons:[],endedAt:2026-11-19T03:57:05.212Z},{verificationId:vfy_96c0c204-23e9-4b8e-b9b4-d0f126839cc5,verdict:pass,reasons:[],endedAt:2026-11-19T03:57:07.744Z},{verificationId:vfy_19f2783e-14b1-4d23-995d-d39f599d73b9,verdict:pass,reasons:[],endedAt:2026-11-19T03:57:10.146Z},{verificationId:vfy_078b910d-aca6-4523-81d1-fb6468b185b8,verdict:pass,reasons:[],endedAt:2026-11-19T03:57:49.449Z}],codeChangedSincePrevious:document-reloaded,failsOnSameCode:0}
evidence: {retained:true,tools:[react_get_renders,react_component_cohort,react_list_overrides,react_refresh_events,react_profile_stop,react_error_state]}
startedAt: 2026-11-19T03:58:13.135Z
endedAt: 2026-11-19T03:58:20.568Z
request: {budget:{fiberLimit:250,operationLimit:20000,timeLimitMs:8,targetOperationReserve:4000,targetTimeReserveMs:4,adaptive:true},settle:{quietMs:500,timeoutMs:10000},tailMs:6000,maxDurationMs:300000,allowOverrides:false}
[exit 1]

$ agent-browser --session art-l3 eval "JSON.stringify({pressed: document.querySelector('[aria-label=\"Date range\"] [aria-pressed=true]').textContent, chartRange: document.querySelector('.bar-chart').dataset.range, bars: document.querySelectorAll('.bar-chart__bar').length})"
"{\"pressed\":\"Last 7 days\",\"chartRange\":\"90d\",\"bars\":13}"
[exit 0]

$ npx genie-react call app_backend_faults '{"rules":[]}' --session art-l3
rules: []
[exit 0]

```


## Re-run on Genie 1.1.0

- Date: 2026-11-19 (UTC times appear in the log)
- Commit: `ce408cb205c0e798cb04c35512772b7454283141` (`git rev-parse HEAD`), app source unmodified except for the two temporary changes below, both reverted with `git checkout`
- App: `apps/realworld-legacy` (Acme Tracker), URL http://127.0.0.1:5231/reports
- Genie CLI and hub: 1.1.0 (workspace build, `node_modules/.bin/genie-react --version` in the app prints `1.1.0`), hub on port 15231, session `upd-a`, driver agent-browser 0.39.1

### Setup

```bash
pnpm install && pnpm build && pnpm install   # the second install links the freshly built genie-react bin into the apps
cd apps/realworld-legacy
GENIE_HUB_PORT=15231 pnpm hub
PORT=5231 GENIE_HUB_PORT=15231 pnpm dev
```

Every command below ran from `apps/realworld-legacy`. Each block is the command, its full output, and its exit code. Lines starting with `##` are notes added between commands. The home directory is shown as `~`.

`verify` in 1.1.0 waits on the `network` domain only when the app registers `requestWatchCollector`. This app's bundled client in `src/devtools/connect-genie.ts` lists its collectors by hand and does not include it, so the runs marked "request watch on" used this temporary change:

```diff
-import { memoryCollector, perfCollector, timelineCollector } from 'genie-react/collectors'
+import { memoryCollector, perfCollector, requestWatchCollector, timelineCollector } from 'genie-react/collectors'
@@
     timelineCollector(),
+    requestWatchCollector(),
     reduxCollector(store, { name: 'app' }),
```

The runs marked "temporary fix applied" also used the `loadReports` fix from the article:

```diff
-  return async (dispatch) => {
+  return async (dispatch, getState) => {
     dispatch({ type: REPORTS_REQUESTED, projectKey, range })
@@
       ])
+      const current = getState().reports
+      if (current.projectKey !== projectKey || current.range !== range) return
       dispatch({ type: REPORTS_RECEIVED, throughput, cycleTime, workload })
```

The first race capture below numbered its Redux records 153 to 206. The article quotes the second capture, from a fresh load under "before fix again", whose numbering (147 to 200) matches the after-fix capture.

Not reproduced here: exploratory reads between the logged commands, all on the before-fix window from "render causes for the race". `react_render_causes` with `{"view":"full","limit":100}` (written to a file, as the output exceeded `--max-bytes`) and `jq` over its `external-store` causes showed Redux links on `AccountMenu`, `NotificationsMenu` and `LastSyncedLabel` and none on `ReportDataLoader`, `ThroughputWidget` or `ReportRangePicker`. The article quotes none of their output.

### Log

```text
$ date -u +%Y-%m-%dT%H:%M:%SZ; git rev-parse HEAD; git status --short; node_modules/.bin/genie-react --version
2026-11-19T08:55:37Z
ce408cb205c0e798cb04c35512772b7454283141
## ali/articles-update-a...origin/main
1.1.0
[exit 0]

$ agent-browser --session upd-a open http://127.0.0.1:5231/login
[agent-browser] launched browser
✓ Acme Tracker
  http://127.0.0.1:5231/login
[exit 0]

$ npx genie-react status --session upd-a --wait 15000 --select /ready
status: ok
selection: {expression:/ready,matchedPathCount:1,matchedPaths:[/ready],omittedPathCount:50}
result: true
[exit 0]

$ npx genie-react call app_sign_in '{"email":"dana@acme.test"}' --session upd-a
user: {id:u-1,name:"Dana Whitfield",email:dana@acme.test,title:Designer,team:Infra}
[exit 0]

$ agent-browser --session upd-a open http://127.0.0.1:5231/reports
✓ Acme Tracker
  http://127.0.0.1:5231/reports
[exit 0]

$ agent-browser --session upd-a wait .bar-chart
✓ Done
[exit 0]

$ agent-browser --session upd-a eval "JSON.stringify({pressed: document.querySelector('[aria-label=\"Date range\"] [aria-pressed=true]').textContent, chartRange: document.querySelector('.bar-chart').dataset.range, bars: document.querySelectorAll('.bar-chart__bar').length})"
"{\"pressed\":\"Last 30 days\",\"chartRange\":\"30d\",\"bars\":5}"
[exit 0]

$ npx genie-react call app_backend_faults '{"rules":[{"method":"GET","path":"/api/reports/throughput","query":{"range":"90d"},"latencyMs":1200}]}' --session upd-a
rules[1]:
  - {method:GET,path:/api/reports/throughput,query:{range:90d},latencyMs:1200,status:null,times:null,hits:0}
[exit 0]

$ npx genie-react call redux_actions '{"limit":1}' --session upd-a --select /latestSequence
status: ok
selection:
  expression: /latestSequence
  matchedPathCount: 1
  matchedPaths: [/latestSequence]
  omittedPathCount: 54
result: 146
[exit 0]

$ npx genie-react call timeline_start '{"name":"range switch","queryValues":"plain"}' --session upd-a --json
{"id":"timeline-dded37e4-7df9-44b5-8744-a1872561cf0e","name":"range switch","state":"recording","stopReason":null,"durationMs":0.2,"maxEvents":1000,"maxDurationMs":30000,"eventCount":0,"truncated":false,"correlation":"temporal-only","clock":"performance.now","ordering":"observation-time-then-sequence","coverage":{"request":{"status":"available","code":"resource-timing-and-fetch","detail":"Fetch/XHR Resource Timing joined with the app's fetch and XMLHttpRequest calls made during the recording, which add method, outcome (including an abort after the response headers), when the app finished reading the body, and requests still in flight at stop. A request the app sent through a fetch reference captured before recording has method null. Requests seen only through those calls, and requests still in flight, are added when the recording stops. Requests started before recording may appear without a method. Worker and non-fetch/XHR requests are absent. Cross-origin detailed timing and responseReceived require Timing-Allow-Origin. URLs omit credentials and fragments; query parameter values are salted hashes unless queryValues is plain."},"query":{"status":"unavailable","code":"no-query-client","detail":"No QueryClient supplied. Only the supplied QueryCache is observed."},"react":{"status":"available","code":"react-root-commits","detail":"Supported development React root commits; hook must precede React. renderDurationMs is root actualDuration when positive, otherwise null with renderDurationUnavailable saying why; not commit wall time, native UI timing, effects or component attribution. No Fiber tree traversal."},"navigation":{"status":"unavailable","code":"no-tanstack-router","detail":"No TanStack Router supplied; other routers and native navigation are not observed."}},"queryValues":"plain","genieRequestsExcluded":0}
[exit 0]

$ agent-browser --session upd-a find role button click --name 'Last 90 days' && agent-browser --session upd-a find role button click --name 'Last 7 days'
✓ Done
✓ Done
[exit 0]

$ agent-browser --session upd-a wait 2000
✓ Done
[exit 0]

$ npx genie-react call react_quiesce '{"idleMs":500,"timeoutMs":10000}' --fail-on-result-error --session upd-a --fields outcome,elapsedMs
[1]:
  - {outcome:idle,elapsedMs:1103}
[exit 0]

$ npx genie-react call timeline_stop '{"id":"timeline-dded37e4-7df9-44b5-8744-a1872561cf0e"}' --session upd-a --fields stopReason,eventCount,truncated,queryValues
[1]:
  - {stopReason:manual,eventCount:23,truncated:false,queryValues:plain}
[exit 0]

$ npx genie-react call timeline_read '{"id":"timeline-dded37e4-7df9-44b5-8744-a1872561cf0e","domains":["request"]}' --session upd-a --fields atMs,details
[6]:
  each: {details:{initiatorType:fetch,startedBeforeRecording:false,detailedTimingAvailable:true,responseStatus:200,responseReceived:true,method:GET,outcome:response,overlappingSameEndpoint:1}}
  - {atMs:93.2,details:{url:http://127.0.0.1:5231/api/reports/cycle-time,query:"?project=CORE&range=90d",startMs:29.9,endMs:92.2,durationMs:62.3,bodyReadMs:92.9,finishedAfterNewer:false,bodyReadLast:false}}
  - {atMs:93.3,details:{url:http://127.0.0.1:5231/api/reports/workload,query:"?project=CORE",startMs:29.9,endMs:92.4,durationMs:62.5,bodyReadMs:93.3,finishedAfterNewer:false,bodyReadLast:false}}
  - {atMs:123.9,details:{url:http://127.0.0.1:5231/api/reports/throughput,query:"?project=CORE&range=7d",startMs:61.9,endMs:123.5,durationMs:61.6,bodyReadMs:123.9,finishedAfterNewer:false,bodyReadLast:false}}
  - {atMs:124,details:{url:http://127.0.0.1:5231/api/reports/cycle-time,query:"?project=CORE&range=7d",startMs:62,endMs:123.6,durationMs:61.6,bodyReadMs:124,finishedAfterNewer:false,bodyReadLast:true}}
  - {atMs:159.5,details:{url:http://127.0.0.1:5231/api/reports/workload,query:"?project=CORE",startMs:62,endMs:154.1,durationMs:92.1,bodyReadMs:154.4,finishedAfterNewer:false,bodyReadLast:true}}
  - {atMs:1297,details:{url:http://127.0.0.1:5231/api/reports/throughput,query:"?project=CORE&range=90d",startMs:29.8,endMs:1291.9,durationMs:1262.1,bodyReadMs:1292.3,finishedAfterNewer:true,bodyReadLast:true}}
[exit 0]

$ agent-browser --session upd-a eval "JSON.stringify({pressed: document.querySelector('[aria-label=\"Date range\"] [aria-pressed=true]').textContent, chartRange: document.querySelector('.bar-chart').dataset.range, bars: document.querySelectorAll('.bar-chart__bar').length})"
"{\"pressed\":\"Last 7 days\",\"chartRange\":\"90d\",\"bars\":13}"
[exit 0]

$ npx genie-react call redux_actions '{"afterSequence":146,"typePrefix":"reports/"}' --session upd-a
store: {storeId:redux-store:1,name:app}
records[4]:
  each: {kind:action,outcome:returned,error:null,rootStateChanged:true,changedSlices:[reports],changedSlicesTruncated:false,unrecordedNestedDispatches:0,mutation:{status:none-detected,notScannedReason:null,findings:[],findingsOmitted:false,scanTruncated:true}}
  - {sequence:154,actionId:redux-store:1/action:154,type:reports/REQUESTED,label:reports/REQUESTED,parentActionId:redux-store:1/action:153,at:1795078560188,durationMs:0.1,mutation:{objectsCompared:16}}
  - {sequence:172,actionId:redux-store:1/action:172,type:reports/REQUESTED,label:reports/REQUESTED,parentActionId:redux-store:1/action:171,at:1795078560221,durationMs:0,mutation:{objectsCompared:16}}
  - {sequence:189,actionId:redux-store:1/action:189,type:reports/RECEIVED,label:reports/RECEIVED,parentActionId:redux-store:1/action:171,at:1795078560314,durationMs:0.1,mutation:{objectsCompared:16}}
  - {sequence:206,actionId:redux-store:1/action:206,type:reports/RECEIVED,label:reports/RECEIVED,parentActionId:redux-store:1/action:153,at:1795078561452,durationMs:0.2,mutation:{objectsCompared:18}}
matched: 4
omittedBefore: 0
more: false
nextAfterSequence: 206
latestSequence: 222
coverage:
  historyLimit: 500
  evictedRecords: 0
  unrecordedChanges: 0
  mutationDetection: true
  libraryActions:
    recorded: false
    counted: 186
    byType: [{kind:action,type:service/subscriptions/internal_probeSubscription,count:119},{kind:thunk,type:null,count:36},{kind:action,type:service/executeQuery/rejected,count:16},{kind:action,type:service/subscriptions/unsubscribeQueryResult,count:9},{kind:action,type:service/executeQuery/pending,count:2},{kind:unrecorded-change,type:null,count:2},{kind:action,type:service/executeQuery/fulfilled,count:2}]
    otherTypesCount: 0
[exit 0]

$ npx genie-react call redux_actions '{"afterSequence":146,"typePrefix":"reports/","view":"full"}' --session upd-a --json | jq -c '{matched, records: [.records[] | {sequence, type, parentActionId, range: .payload.range, throughputRange: .payload.throughput.range, total: .payload.throughput.total}]}'
{"matched":4,"records":[{"sequence":154,"type":"reports/REQUESTED","parentActionId":"redux-store:1/action:153","range":"90d","throughputRange":null,"total":null},{"sequence":172,"type":"reports/REQUESTED","parentActionId":"redux-store:1/action:171","range":"7d","throughputRange":null,"total":null},{"sequence":189,"type":"reports/RECEIVED","parentActionId":"redux-store:1/action:171","range":null,"throughputRange":"7d","total":9},{"sequence":206,"type":"reports/RECEIVED","parentActionId":"redux-store:1/action:153","range":null,"throughputRange":"90d","total":33}]}
[exit 0]

$ npx genie-react call redux_state '{"path":["reports","range"]}' --session upd-a
store: {storeId:redux-store:1,name:app}
path: [reports,range]
found: true
value: 7d
topLevelKeys: [session,ui,projects,issues,board,notifications,search,savedViews,reports,service]
asOfSequence: 222
[exit 0]

$ npx genie-react call react_find_components '{"component":"ThroughputWidget"}' --session upd-a --fields id,name
[1]:
  - {id:4609607205037,name:ThroughputWidget}
[exit 0]

$ npx genie-react call react_inspect_component '{"id":4609607205037}' --session upd-a --select /props
status: ok
selection: {expression:/props,matchedPathCount:1,matchedPaths:[/props],omittedPathCount:7}
result:
  report:
    project: CORE
    range: 90d
    total: 33
    buckets: {__genie_dehydrated__:true,kind:array,preview:"Array(13)",path:[report,buckets],size:13}
[exit 0]

## render causes for the race (before fix)

$ agent-browser --session upd-a open http://127.0.0.1:5231/reports
✓ Acme Tracker
  http://127.0.0.1:5231/reports
[exit 0]

$ agent-browser --session upd-a wait .bar-chart
✓ Done
[exit 0]

$ npx genie-react call react_clear_renders '{}' --session upd-a --fields ok
[1]:
  - {ok:true}
[exit 0]

$ agent-browser --session upd-a find role button click --name 'Last 90 days' && agent-browser --session upd-a find role button click --name 'Last 7 days'
✓ Done
✓ Done
[exit 0]

$ agent-browser --session upd-a wait 2000
✓ Done
[exit 0]

$ npx genie-react call react_quiesce '{"idleMs":500,"timeoutMs":10000}' --fail-on-result-error --session upd-a --fields outcome
[1]:
  - {outcome:idle}
[exit 0]

$ npx genie-react call react_render_causes '{"component":"ReportDataLoader","view":"full","limit":10}' --session upd-a --json | jq -c '[.events[] | {documentCommitId, causes: [.causes[] | {kind, evidence, name, redux}]}]'
[{"documentCommitId":24,"causes":[{"kind":"parent","evidence":"inferred","name":null,"redux":null},{"kind":"props","evidence":"exact","name":"throughput","redux":null},{"kind":"props","evidence":"exact","name":"cycleTime","redux":null},{"kind":"props","evidence":"exact","name":"workload","redux":null}]},{"documentCommitId":22,"causes":[{"kind":"parent","evidence":"inferred","name":null,"redux":null},{"kind":"props","evidence":"exact","name":"status","redux":null},{"kind":"props","evidence":"exact","name":"throughput","redux":null},{"kind":"props","evidence":"exact","name":"cycleTime","redux":null},{"kind":"props","evidence":"exact","name":"workload","redux":null}]},{"documentCommitId":20,"causes":[{"kind":"parent","evidence":"inferred","name":null,"redux":null},{"kind":"children","evidence":"exact","name":null,"redux":null}]},{"documentCommitId":18,"causes":[{"kind":"parent","evidence":"inferred","name":null,"redux":null},{"kind":"props","evidence":"exact","name":"status","redux":null},{"kind":"children","evidence":"exact","name":null,"redux":null}]}]
[exit 0]

$ npx genie-react call react_render_causes '{"component":"Connect(ReportDataLoader)","view":"full","limit":10}' --session upd-a --json | jq -c '{events: [.events[] | {documentCommitId}]}'
{"events":[]}
[exit 0]

## verify before fix, 90d latency 1200 ms (3 runs)

$ agent-browser --session upd-a open http://127.0.0.1:5231/reports
✓ Acme Tracker
  http://127.0.0.1:5231/reports
[exit 0]

$ agent-browser --session upd-a wait .bar-chart
✓ Done
[exit 0]

$ npx genie-react verify begin --session upd-a --name 'switch 90d then 7d' --claim 'render ThroughputWidget max 3' --claim 'render ReportRangePicker min 1' --claim 'boundaries clean'
recording vfy_a26e2a05-6078-402a-8e88-73fd0651d782 "switch 90d then 7d"
  url "http://127.0.0.1:5231/reports"
  1 recording render ThroughputWidget max 3
  2 recording render ReportRangePicker min 1
  3 recording boundaries clean
window: {observationId:observation:1,startDocumentCommitId:17,domains:[react],quietMs:500,timeoutMs:10000,tailMs:500}
next: $ npx genie-react verify end vfy_a26e2a05-6078-402a-8e88-73fd0651d782 --session upd-a
session: {sessionId:9a0ee386-fcac-4fe0-85fa-458d6aff8159,logicalSessionId:c2bb8a8e-e0ef-46a5-a676-b347282a2d7f,documentGeneration:4}
schemaVersion: "1.0"
targets: [{target:{component:ThroughputWidget},status:resolved,instances:1,source:~/.t3/worktrees/genie-react/t3-30e9ccc5-7f0438b9817ce5ab/apps/realworld-legacy/src/features/reports/reports-page.tsx},{target:{component:ReportRangePicker},status:resolved,instances:1,source:~/.t3/worktrees/genie-react/t3-30e9ccc5-7f0438b9817ce5ab/apps/realworld-legacy/src/features/reports/report-range-picker.tsx}]
startedAt: 2026-11-19T08:57:25.518Z
expiresAt: 2026-11-19T09:02:25.532Z
request: {budget:{fiberLimit:250,operationLimit:20000,timeLimitMs:8,targetOperationReserve:4000,targetTimeReserveMs:4,adaptive:true},settle:{quietMs:500,timeoutMs:10000},maxDurationMs:300000,allowOverrides:false}
[exit 0]

$ agent-browser --session upd-a find role button click --name 'Last 90 days' && agent-browser --session upd-a find role button click --name 'Last 7 days'
✓ Done
✓ Done
[exit 0]

$ npx genie-react verify end vfy_a26e2a05-6078-402a-8e88-73fd0651d782 --session upd-a
fail vfy_a26e2a05-6078-402a-8e88-73fd0651d782 "switch 90d then 7d"  9 commits, quiet after 2011 ms (react)
  url "http://127.0.0.1:5231/reports"
  1 fail render ThroughputWidget max 3  {renders:4,mounts:0,updates:4,remounts:0,semantics:exact,instances:1,activeInstances:1}
      claim: {kind:renders,target:{component:ThroughputWidget},max:3,counting:renders,allowRemount:false}
      deciding: [{kind:instance,mountId:mount:1,renders:4,mounts:0,updates:4,mountGeneration:1,latestDocumentCommitId:24,source:~/.t3/worktrees/genie-react/t3-30e9ccc5-7f0438b9817ce5ab/apps/realworld-legacy/src/features/reports/reports-page.tsx:59:32}]
  2 pass render ReportRangePicker min 1  {renders:2,mounts:0,updates:2,remounts:0,semantics:exact,instances:1,activeInstances:1}
      claim: {kind:renders,target:{component:ReportRangePicker},min:1,counting:renders,allowRemount:false}
      deciding: [{kind:instance,mountId:mount:2,renders:2,mounts:0,updates:2,mountGeneration:1,latestDocumentCommitId:21,source:~/.t3/worktrees/genie-react/t3-30e9ccc5-7f0438b9817ce5ab/apps/realworld-legacy/src/features/reports/report-range-picker.tsx:23:7}]
  3 pass boundaries clean  {caughtDuringWindow:0,caughtAtEnd:0}
      claim: {kind:boundaries-clean,scope:window}
      deciding: [{kind:boundary-log,scope:window,complete:true,afterDocumentCommitId:17}]
      caveats: [uncaught-errors-outside-boundaries-unobserved]
window: {observationId:observation:1,startDocumentCommitId:17,settledDocumentCommitId:25,frozenDocumentCommitId:26,commits:9,settle:{outcome:met,quietMs:500,timeoutMs:10000,waitedMs:2011,domains:{react:met}},tail:{ms:500,commits:1},environment:{bundle:development,strictMode:on,renderCollection:available,visibility:unavailable}}
! ui-outcome-not-observed: Genie does not check the screen; confirm it with the UI driver
! visibility-unobserved: the app reports no visibility signal, so a hidden interval was not observed
attempt 1 for these claims on this tab
evidence: $ npx genie-react verify show vfy_a26e2a05-6078-402a-8e88-73fd0651d782 --claim 1 --session upd-a
session: {sessionId:9a0ee386-fcac-4fe0-85fa-458d6aff8159,logicalSessionId:c2bb8a8e-e0ef-46a5-a676-b347282a2d7f,documentGeneration:4}
schemaVersion: "1.0"
exitCode: 1
stage: end
ledger: {fingerprint:cf_1c6b0a4e5c53,scope:logical-session,storage:memory,attempt:1,history:[],codeChangedSincePrevious:null,failsOnSameCode:0}
evidence: {retained:true,tools:[react_get_renders,react_component_cohort,react_list_overrides,react_refresh_events,react_profile_stop,react_error_state]}
startedAt: 2026-11-19T08:57:25.518Z
endedAt: 2026-11-19T08:57:28.362Z
request: {budget:{fiberLimit:250,operationLimit:20000,timeLimitMs:8,targetOperationReserve:4000,targetTimeReserveMs:4,adaptive:true},settle:{quietMs:500,timeoutMs:10000},maxDurationMs:300000,allowOverrides:false}
[exit 1]

$ agent-browser --session upd-a eval "JSON.stringify({pressed: document.querySelector('[aria-label=\"Date range\"] [aria-pressed=true]').textContent, chartRange: document.querySelector('.bar-chart').dataset.range, bars: document.querySelectorAll('.bar-chart__bar').length})"
"{\"pressed\":\"Last 7 days\",\"chartRange\":\"90d\",\"bars\":13}"
[exit 0]

$ agent-browser --session upd-a open http://127.0.0.1:5231/reports
✓ Acme Tracker
  http://127.0.0.1:5231/reports
[exit 0]

$ agent-browser --session upd-a wait .bar-chart
✓ Done
[exit 0]

$ npx genie-react verify begin --session upd-a --name 'switch 90d then 7d' --claim 'render ThroughputWidget max 3' --claim 'render ReportRangePicker min 1' --claim 'boundaries clean'
recording vfy_40446178-f5d3-4778-87da-43304dccf9d0 "switch 90d then 7d"
  url "http://127.0.0.1:5231/reports"
  1 recording render ThroughputWidget max 3
  2 recording render ReportRangePicker min 1
  3 recording boundaries clean
window: {observationId:observation:1,startDocumentCommitId:17,domains:[react],quietMs:500,timeoutMs:10000,tailMs:500}
next: $ npx genie-react verify end vfy_40446178-f5d3-4778-87da-43304dccf9d0 --session upd-a
session: {sessionId:b410a25d-dd83-403f-b6be-689476be9c12,logicalSessionId:c2bb8a8e-e0ef-46a5-a676-b347282a2d7f,documentGeneration:5}
schemaVersion: "1.0"
targets: [{target:{component:ThroughputWidget},status:resolved,instances:1,source:~/.t3/worktrees/genie-react/t3-30e9ccc5-7f0438b9817ce5ab/apps/realworld-legacy/src/features/reports/reports-page.tsx},{target:{component:ReportRangePicker},status:resolved,instances:1,source:~/.t3/worktrees/genie-react/t3-30e9ccc5-7f0438b9817ce5ab/apps/realworld-legacy/src/features/reports/report-range-picker.tsx}]
startedAt: 2026-11-19T08:58:03.378Z
expiresAt: 2026-11-19T09:03:03.390Z
request: {budget:{fiberLimit:250,operationLimit:20000,timeLimitMs:8,targetOperationReserve:4000,targetTimeReserveMs:4,adaptive:true},settle:{quietMs:500,timeoutMs:10000},maxDurationMs:300000,allowOverrides:false}
[exit 0]

$ agent-browser --session upd-a find role button click --name 'Last 90 days' && agent-browser --session upd-a find role button click --name 'Last 7 days'
✓ Done
✓ Done
[exit 0]

$ npx genie-react verify end vfy_40446178-f5d3-4778-87da-43304dccf9d0 --session upd-a
fail vfy_40446178-f5d3-4778-87da-43304dccf9d0 "switch 90d then 7d"  9 commits, quiet after 2012 ms (react)
  url "http://127.0.0.1:5231/reports"
  1 fail render ThroughputWidget max 3  {renders:4,mounts:0,updates:4,remounts:0,semantics:exact,instances:1,activeInstances:1}
      claim: {kind:renders,target:{component:ThroughputWidget},max:3,counting:renders,allowRemount:false}
      deciding: [{kind:instance,mountId:mount:1,renders:4,mounts:0,updates:4,mountGeneration:1,latestDocumentCommitId:24,source:~/.t3/worktrees/genie-react/t3-30e9ccc5-7f0438b9817ce5ab/apps/realworld-legacy/src/features/reports/reports-page.tsx:59:32}]
  2 pass render ReportRangePicker min 1  {renders:2,mounts:0,updates:2,remounts:0,semantics:exact,instances:1,activeInstances:1}
      claim: {kind:renders,target:{component:ReportRangePicker},min:1,counting:renders,allowRemount:false}
      deciding: [{kind:instance,mountId:mount:2,renders:2,mounts:0,updates:2,mountGeneration:1,latestDocumentCommitId:21,source:~/.t3/worktrees/genie-react/t3-30e9ccc5-7f0438b9817ce5ab/apps/realworld-legacy/src/features/reports/report-range-picker.tsx:23:7}]
  3 pass boundaries clean  {caughtDuringWindow:0,caughtAtEnd:0}
      claim: {kind:boundaries-clean,scope:window}
      deciding: [{kind:boundary-log,scope:window,complete:true,afterDocumentCommitId:17}]
      caveats: [uncaught-errors-outside-boundaries-unobserved]
window: {observationId:observation:1,startDocumentCommitId:17,settledDocumentCommitId:25,frozenDocumentCommitId:26,commits:9,settle:{outcome:met,quietMs:500,timeoutMs:10000,waitedMs:2012,domains:{react:met}},tail:{ms:500,commits:1},environment:{bundle:development,strictMode:on,renderCollection:available,visibility:unavailable}}
! ui-outcome-not-observed: Genie does not check the screen; confirm it with the UI driver
! visibility-unobserved: the app reports no visibility signal, so a hidden interval was not observed
attempt 2 for these claims on this tab; previous fail vfy_a26e2a05-6078-402a-8e88-73fd0651d782; document reloaded since
evidence: $ npx genie-react verify show vfy_40446178-f5d3-4778-87da-43304dccf9d0 --claim 1 --session upd-a
session: {sessionId:b410a25d-dd83-403f-b6be-689476be9c12,logicalSessionId:c2bb8a8e-e0ef-46a5-a676-b347282a2d7f,documentGeneration:5}
schemaVersion: "1.0"
exitCode: 1
stage: end
ledger: {fingerprint:cf_1c6b0a4e5c53,scope:logical-session,storage:memory,attempt:2,history:[{verificationId:vfy_a26e2a05-6078-402a-8e88-73fd0651d782,verdict:fail,reasons:[],endedAt:2026-11-19T08:57:28.362Z}],codeChangedSincePrevious:document-reloaded,failsOnSameCode:0}
evidence: {retained:true,tools:[react_get_renders,react_component_cohort,react_list_overrides,react_refresh_events,react_profile_stop,react_error_state]}
startedAt: 2026-11-19T08:58:03.378Z
endedAt: 2026-11-19T08:58:06.226Z
request: {budget:{fiberLimit:250,operationLimit:20000,timeLimitMs:8,targetOperationReserve:4000,targetTimeReserveMs:4,adaptive:true},settle:{quietMs:500,timeoutMs:10000},maxDurationMs:300000,allowOverrides:false}
[exit 1]

$ agent-browser --session upd-a eval "JSON.stringify({pressed: document.querySelector('[aria-label=\"Date range\"] [aria-pressed=true]').textContent, chartRange: document.querySelector('.bar-chart').dataset.range, bars: document.querySelectorAll('.bar-chart__bar').length})"
"{\"pressed\":\"Last 7 days\",\"chartRange\":\"90d\",\"bars\":13}"
[exit 0]

$ agent-browser --session upd-a open http://127.0.0.1:5231/reports
✓ Acme Tracker
  http://127.0.0.1:5231/reports
[exit 0]

$ agent-browser --session upd-a wait .bar-chart
✓ Done
[exit 0]

$ npx genie-react verify begin --session upd-a --name 'switch 90d then 7d' --claim 'render ThroughputWidget max 3' --claim 'render ReportRangePicker min 1' --claim 'boundaries clean'
recording vfy_35f47e8b-d3d5-4439-b119-cfdcb5afe58f "switch 90d then 7d"
  url "http://127.0.0.1:5231/reports"
  1 recording render ThroughputWidget max 3
  2 recording render ReportRangePicker min 1
  3 recording boundaries clean
window: {observationId:observation:1,startDocumentCommitId:17,domains:[react],quietMs:500,timeoutMs:10000,tailMs:500}
next: $ npx genie-react verify end vfy_35f47e8b-d3d5-4439-b119-cfdcb5afe58f --session upd-a
session: {sessionId:d1289a79-717d-4a02-b43e-91d539b6efe8,logicalSessionId:c2bb8a8e-e0ef-46a5-a676-b347282a2d7f,documentGeneration:6}
schemaVersion: "1.0"
targets: [{target:{component:ThroughputWidget},status:resolved,instances:1,source:~/.t3/worktrees/genie-react/t3-30e9ccc5-7f0438b9817ce5ab/apps/realworld-legacy/src/features/reports/reports-page.tsx},{target:{component:ReportRangePicker},status:resolved,instances:1,source:~/.t3/worktrees/genie-react/t3-30e9ccc5-7f0438b9817ce5ab/apps/realworld-legacy/src/features/reports/report-range-picker.tsx}]
startedAt: 2026-11-19T08:58:06.793Z
expiresAt: 2026-11-19T09:03:06.802Z
request: {budget:{fiberLimit:250,operationLimit:20000,timeLimitMs:8,targetOperationReserve:4000,targetTimeReserveMs:4,adaptive:true},settle:{quietMs:500,timeoutMs:10000},maxDurationMs:300000,allowOverrides:false}
[exit 0]

$ agent-browser --session upd-a find role button click --name 'Last 90 days' && agent-browser --session upd-a find role button click --name 'Last 7 days'
✓ Done
✓ Done
[exit 0]

$ npx genie-react verify end vfy_35f47e8b-d3d5-4439-b119-cfdcb5afe58f --session upd-a
fail vfy_35f47e8b-d3d5-4439-b119-cfdcb5afe58f "switch 90d then 7d"  9 commits, quiet after 2161 ms (react)
  url "http://127.0.0.1:5231/reports"
  1 fail render ThroughputWidget max 3  {renders:4,mounts:0,updates:4,remounts:0,semantics:exact,instances:1,activeInstances:1}
      claim: {kind:renders,target:{component:ThroughputWidget},max:3,counting:renders,allowRemount:false}
      deciding: [{kind:instance,mountId:mount:1,renders:4,mounts:0,updates:4,mountGeneration:1,latestDocumentCommitId:24,source:~/.t3/worktrees/genie-react/t3-30e9ccc5-7f0438b9817ce5ab/apps/realworld-legacy/src/features/reports/reports-page.tsx:59:32}]
  2 pass render ReportRangePicker min 1  {renders:2,mounts:0,updates:2,remounts:0,semantics:exact,instances:1,activeInstances:1}
      claim: {kind:renders,target:{component:ReportRangePicker},min:1,counting:renders,allowRemount:false}
      deciding: [{kind:instance,mountId:mount:2,renders:2,mounts:0,updates:2,mountGeneration:1,latestDocumentCommitId:21,source:~/.t3/worktrees/genie-react/t3-30e9ccc5-7f0438b9817ce5ab/apps/realworld-legacy/src/features/reports/report-range-picker.tsx:23:7}]
  3 pass boundaries clean  {caughtDuringWindow:0,caughtAtEnd:0}
      claim: {kind:boundaries-clean,scope:window}
      deciding: [{kind:boundary-log,scope:window,complete:true,afterDocumentCommitId:17}]
      caveats: [uncaught-errors-outside-boundaries-unobserved]
window: {observationId:observation:1,startDocumentCommitId:17,settledDocumentCommitId:25,frozenDocumentCommitId:26,commits:9,settle:{outcome:met,quietMs:500,timeoutMs:10000,waitedMs:2161,domains:{react:met}},tail:{ms:500,commits:1},environment:{bundle:development,strictMode:on,renderCollection:available,visibility:unavailable}}
! ui-outcome-not-observed: Genie does not check the screen; confirm it with the UI driver
! visibility-unobserved: the app reports no visibility signal, so a hidden interval was not observed
attempt 3 for these claims on this tab; previous fail vfy_40446178-f5d3-4778-87da-43304dccf9d0; document reloaded since
evidence: $ npx genie-react verify show vfy_35f47e8b-d3d5-4439-b119-cfdcb5afe58f --claim 1 --session upd-a
session: {sessionId:d1289a79-717d-4a02-b43e-91d539b6efe8,logicalSessionId:c2bb8a8e-e0ef-46a5-a676-b347282a2d7f,documentGeneration:6}
schemaVersion: "1.0"
exitCode: 1
stage: end
ledger: {fingerprint:cf_1c6b0a4e5c53,scope:logical-session,storage:memory,attempt:3,history:[{verificationId:vfy_a26e2a05-6078-402a-8e88-73fd0651d782,verdict:fail,reasons:[],endedAt:2026-11-19T08:57:28.362Z},{verificationId:vfy_40446178-f5d3-4778-87da-43304dccf9d0,verdict:fail,reasons:[],endedAt:2026-11-19T08:58:06.226Z}],codeChangedSincePrevious:document-reloaded,failsOnSameCode:0}
evidence: {retained:true,tools:[react_get_renders,react_component_cohort,react_list_overrides,react_refresh_events,react_profile_stop,react_error_state]}
startedAt: 2026-11-19T08:58:06.793Z
endedAt: 2026-11-19T08:58:09.757Z
request: {budget:{fiberLimit:250,operationLimit:20000,timeLimitMs:8,targetOperationReserve:4000,targetTimeReserveMs:4,adaptive:true},settle:{quietMs:500,timeoutMs:10000},maxDurationMs:300000,allowOverrides:false}
[exit 1]

$ agent-browser --session upd-a eval "JSON.stringify({pressed: document.querySelector('[aria-label=\"Date range\"] [aria-pressed=true]').textContent, chartRange: document.querySelector('.bar-chart').dataset.range, bars: document.querySelectorAll('.bar-chart__bar').length})"
"{\"pressed\":\"Last 7 days\",\"chartRange\":\"90d\",\"bars\":13}"
[exit 0]

## shipped code, 90d latency 5000 ms, app setup as shipped (no requestWatchCollector)

$ npx genie-react call app_backend_faults '{"rules":[{"method":"GET","path":"/api/reports/throughput","query":{"range":"90d"},"latencyMs":5000}]}' --session upd-a
rules[1]:
  - {method:GET,path:/api/reports/throughput,query:{range:90d},latencyMs:5000,status:null,times:null,hits:0}
[exit 0]

$ agent-browser --session upd-a open http://127.0.0.1:5231/reports
✓ Acme Tracker
  http://127.0.0.1:5231/reports
[exit 0]

$ agent-browser --session upd-a wait .bar-chart
✓ Done
[exit 0]

$ npx genie-react verify begin --session upd-a --name 'switch 90d then 7d' --claim 'render ThroughputWidget max 3' --claim 'render ReportRangePicker min 1' --claim 'boundaries clean'
recording vfy_a6e85c4a-ce93-4411-8e8b-55bbb422cbd3 "switch 90d then 7d"
  url "http://127.0.0.1:5231/reports"
  1 recording render ThroughputWidget max 3
  2 recording render ReportRangePicker min 1
  3 recording boundaries clean
window: {observationId:observation:1,startDocumentCommitId:17,domains:[react],quietMs:500,timeoutMs:10000,tailMs:500}
next: $ npx genie-react verify end vfy_a6e85c4a-ce93-4411-8e8b-55bbb422cbd3 --session upd-a
session: {sessionId:aa5a24b5-5687-4525-a1c6-a0fc4990ab35,logicalSessionId:c2bb8a8e-e0ef-46a5-a676-b347282a2d7f,documentGeneration:7}
schemaVersion: "1.0"
targets: [{target:{component:ThroughputWidget},status:resolved,instances:1,source:~/.t3/worktrees/genie-react/t3-30e9ccc5-7f0438b9817ce5ab/apps/realworld-legacy/src/features/reports/reports-page.tsx},{target:{component:ReportRangePicker},status:resolved,instances:1,source:~/.t3/worktrees/genie-react/t3-30e9ccc5-7f0438b9817ce5ab/apps/realworld-legacy/src/features/reports/report-range-picker.tsx}]
startedAt: 2026-11-19T08:58:15.842Z
expiresAt: 2026-11-19T09:03:15.851Z
request: {budget:{fiberLimit:250,operationLimit:20000,timeLimitMs:8,targetOperationReserve:4000,targetTimeReserveMs:4,adaptive:true},settle:{quietMs:500,timeoutMs:10000},maxDurationMs:300000,allowOverrides:false}
[exit 0]

$ agent-browser --session upd-a find role button click --name 'Last 90 days' && agent-browser --session upd-a find role button click --name 'Last 7 days'
✓ Done
✓ Done
[exit 0]

$ npx genie-react verify end vfy_a6e85c4a-ce93-4411-8e8b-55bbb422cbd3 --session upd-a
pass vfy_a6e85c4a-ce93-4411-8e8b-55bbb422cbd3 "switch 90d then 7d"  7 commits, quiet after 1092 ms (react)
  url "http://127.0.0.1:5231/reports"
  1 pass render ThroughputWidget max 3  {renders:3,mounts:0,updates:3,remounts:0,semantics:exact,instances:1,activeInstances:1}
      claim: {kind:renders,target:{component:ThroughputWidget},max:3,counting:renders,allowRemount:false}
      deciding: [{kind:coverage,complete:true,targetedComplete:true,semantics:exact},{kind:instance,mountId:mount:1,renderingState:mounted-rendering,source:~/.t3/worktrees/genie-react/t3-30e9ccc5-7f0438b9817ce5ab/apps/realworld-legacy/src/features/reports/reports-page.tsx:59:32}]
  2 pass render ReportRangePicker min 1  {renders:2,mounts:0,updates:2,remounts:0,semantics:exact,instances:1,activeInstances:1}
      claim: {kind:renders,target:{component:ReportRangePicker},min:1,counting:renders,allowRemount:false}
      deciding: [{kind:instance,mountId:mount:2,renders:2,mounts:0,updates:2,mountGeneration:1,latestDocumentCommitId:21,source:~/.t3/worktrees/genie-react/t3-30e9ccc5-7f0438b9817ce5ab/apps/realworld-legacy/src/features/reports/report-range-picker.tsx:23:7}]
  3 pass boundaries clean  {caughtDuringWindow:0,caughtAtEnd:0}
      claim: {kind:boundaries-clean,scope:window}
      deciding: [{kind:boundary-log,scope:window,complete:true,afterDocumentCommitId:17}]
      caveats: [uncaught-errors-outside-boundaries-unobserved]
window: {observationId:observation:1,startDocumentCommitId:17,settledDocumentCommitId:23,frozenDocumentCommitId:24,commits:7,settle:{outcome:met,quietMs:500,timeoutMs:10000,waitedMs:1092,domains:{react:met}},tail:{ms:500,commits:1},environment:{bundle:development,strictMode:on,renderCollection:available,visibility:unavailable}}
! ui-outcome-not-observed: Genie does not check the screen; confirm it with the UI driver
! visibility-unobserved: the app reports no visibility signal, so a hidden interval was not observed
attempt 4 for these claims on this tab; previous fail vfy_35f47e8b-d3d5-4439-b119-cfdcb5afe58f; document reloaded since
evidence: $ npx genie-react verify show vfy_a6e85c4a-ce93-4411-8e8b-55bbb422cbd3 --session upd-a
session: {sessionId:aa5a24b5-5687-4525-a1c6-a0fc4990ab35,logicalSessionId:c2bb8a8e-e0ef-46a5-a676-b347282a2d7f,documentGeneration:7}
schemaVersion: "1.0"
exitCode: 0
stage: end
ledger: {fingerprint:cf_1c6b0a4e5c53,scope:logical-session,storage:memory,attempt:4,history:[{verificationId:vfy_a26e2a05-6078-402a-8e88-73fd0651d782,verdict:fail,reasons:[],endedAt:2026-11-19T08:57:28.362Z},{verificationId:vfy_40446178-f5d3-4778-87da-43304dccf9d0,verdict:fail,reasons:[],endedAt:2026-11-19T08:58:06.226Z},{verificationId:vfy_35f47e8b-d3d5-4439-b119-cfdcb5afe58f,verdict:fail,reasons:[],endedAt:2026-11-19T08:58:09.757Z}],codeChangedSincePrevious:document-reloaded,failsOnSameCode:0}
evidence: {retained:true,tools:[react_get_renders,react_component_cohort,react_list_overrides,react_refresh_events,react_profile_stop,react_error_state]}
startedAt: 2026-11-19T08:58:15.842Z
endedAt: 2026-11-19T08:58:17.737Z
request: {budget:{fiberLimit:250,operationLimit:20000,timeLimitMs:8,targetOperationReserve:4000,targetTimeReserveMs:4,adaptive:true},settle:{quietMs:500,timeoutMs:10000},maxDurationMs:300000,allowOverrides:false}
[exit 0]

$ agent-browser --session upd-a eval "JSON.stringify({pressed: document.querySelector('[aria-label=\"Date range\"] [aria-pressed=true]').textContent, chartRange: document.querySelector('.bar-chart').dataset.range, bars: document.querySelectorAll('.bar-chart__bar').length})"
"{\"pressed\":\"Last 7 days\",\"chartRange\":\"7d\",\"bars\":7}"
[exit 0]

$ agent-browser --session upd-a wait 5000
✓ Done
[exit 0]

$ agent-browser --session upd-a eval "JSON.stringify({pressed: document.querySelector('[aria-label=\"Date range\"] [aria-pressed=true]').textContent, chartRange: document.querySelector('.bar-chart').dataset.range, bars: document.querySelectorAll('.bar-chart__bar').length})"
"{\"pressed\":\"Last 7 days\",\"chartRange\":\"90d\",\"bars\":13}"
[exit 0]

## same, with --domains react,network on an app without requestWatchCollector

$ agent-browser --session upd-a open http://127.0.0.1:5231/reports
✓ Acme Tracker
  http://127.0.0.1:5231/reports
[exit 0]

$ agent-browser --session upd-a wait .bar-chart
✓ Done
[exit 0]

$ npx genie-react verify begin --session upd-a --name 'switch 90d then 7d' --domains react,network --claim 'render ThroughputWidget max 3' --claim 'render ReportRangePicker min 1' --claim 'boundaries clean'
recording vfy_1a81b598-70d1-49fb-90ff-8d47c23aaae5 "switch 90d then 7d"
  url "http://127.0.0.1:5231/reports"
  1 recording render ThroughputWidget max 3
  2 recording render ReportRangePicker min 1
  3 recording boundaries clean
window: {observationId:observation:1,startDocumentCommitId:17,domains:[react,network],quietMs:500,timeoutMs:10000,tailMs:500}
next: $ npx genie-react verify end vfy_1a81b598-70d1-49fb-90ff-8d47c23aaae5 --session upd-a
session: {sessionId:442b9662-b1fe-4923-b400-b24d39ba3660,logicalSessionId:c2bb8a8e-e0ef-46a5-a676-b347282a2d7f,documentGeneration:8}
schemaVersion: "1.0"
targets: [{target:{component:ThroughputWidget},status:resolved,instances:1,source:~/.t3/worktrees/genie-react/t3-30e9ccc5-7f0438b9817ce5ab/apps/realworld-legacy/src/features/reports/reports-page.tsx},{target:{component:ReportRangePicker},status:resolved,instances:1,source:~/.t3/worktrees/genie-react/t3-30e9ccc5-7f0438b9817ce5ab/apps/realworld-legacy/src/features/reports/report-range-picker.tsx}]
startedAt: 2026-11-19T08:58:31.138Z
expiresAt: 2026-11-19T09:03:31.148Z
request: {budget:{fiberLimit:250,operationLimit:20000,timeLimitMs:8,targetOperationReserve:4000,targetTimeReserveMs:4,adaptive:true},settle:{quietMs:500,timeoutMs:10000,domains:[react,network]},maxDurationMs:300000,allowOverrides:false}
[exit 0]

$ agent-browser --session upd-a find role button click --name 'Last 90 days' && agent-browser --session upd-a find role button click --name 'Last 7 days'
✓ Done
✓ Done
[exit 0]

$ npx genie-react verify end vfy_1a81b598-70d1-49fb-90ff-8d47c23aaae5 --session upd-a
refused vfy_1a81b598-70d1-49fb-90ff-8d47c23aaae5 "switch 90d then 7d"  6 commits, not quiet after 24 ms (react, network)
  url "http://127.0.0.1:5231/reports"
  1 refused render ThroughputWidget max 3  not_quiescent: The app did not settle within the timeout (Generic network quiet is not instrumented by this app.), so later work could still change the answer.
      observed: {renders:3,mounts:0,updates:3,remounts:0,semantics:exact,instances:1,activeInstances:1}
      evidence:{settle:failed,waitedMs:24,timeoutMs:10000},fix:{action:begin-again,settle:{timeoutMs:20000}}
      fix: $ npx genie-react verify begin --session upd-a --name 'switch 90d then 7d' --claim 'render ThroughputWidget max 3' --claim 'render ReportRangePicker min 1' --claim 'boundaries clean' --timeout-ms 20000 --domains 'react,network'
      claim: {kind:renders,target:{component:ThroughputWidget},max:3,counting:renders,allowRemount:false}
      deciding: [{kind:instance,mountId:mount:1,renders:3,mounts:0,updates:3,mountGeneration:1,latestDocumentCommitId:22,source:~/.t3/worktrees/genie-react/t3-30e9ccc5-7f0438b9817ce5ab/apps/realworld-legacy/src/features/reports/reports-page.tsx:59:32}]
  2 pass render ReportRangePicker min 1  {renders:2,mounts:0,updates:2,remounts:0,semantics:exact,instances:1,activeInstances:1}
      claim: {kind:renders,target:{component:ReportRangePicker},min:1,counting:renders,allowRemount:false}
      deciding: [{kind:instance,mountId:mount:2,renders:2,mounts:0,updates:2,mountGeneration:1,latestDocumentCommitId:21,source:~/.t3/worktrees/genie-react/t3-30e9ccc5-7f0438b9817ce5ab/apps/realworld-legacy/src/features/reports/report-range-picker.tsx:23:7}]
  3 refused boundaries clean  not_quiescent: The app did not settle within the timeout (Generic network quiet is not instrumented by this app.), so later work could still change the answer.
      observed: {caughtDuringWindow:0,caughtAtEnd:0}
      evidence:{settle:failed,waitedMs:24,timeoutMs:10000},fix:{action:begin-again,settle:{timeoutMs:20000}}
      fix: $ npx genie-react verify begin --session upd-a --name 'switch 90d then 7d' --claim 'render ThroughputWidget max 3' --claim 'render ReportRangePicker min 1' --claim 'boundaries clean' --timeout-ms 20000 --domains 'react,network'
      claim: {kind:boundaries-clean,scope:window}
      deciding: []
      caveats: [uncaught-errors-outside-boundaries-unobserved]
window: {observationId:observation:1,startDocumentCommitId:17,settledDocumentCommitId:22,frozenDocumentCommitId:23,commits:6,settle:{outcome:failed,reason:"Generic network quiet is not instrumented by this app.",quietMs:500,timeoutMs:10000,waitedMs:24,domains:{react:pending,network:unsupported}},tail:{ms:500,commits:1},environment:{bundle:development,strictMode:on,renderCollection:available,visibility:unavailable}}
! ui-outcome-not-observed: Genie does not check the screen; confirm it with the UI driver
! visibility-unobserved: the app reports no visibility signal, so a hidden interval was not observed
! not-settled: the app did not settle within the timeout
attempt 5 for these claims on this tab; previous pass vfy_a6e85c4a-ce93-4411-8e8b-55bbb422cbd3; document reloaded since
evidence: $ npx genie-react verify show vfy_1a81b598-70d1-49fb-90ff-8d47c23aaae5 --claim 1 --session upd-a
session: {sessionId:442b9662-b1fe-4923-b400-b24d39ba3660,logicalSessionId:c2bb8a8e-e0ef-46a5-a676-b347282a2d7f,documentGeneration:8}
schemaVersion: "1.0"
exitCode: 4
stage: end
ledger: {fingerprint:cf_1c6b0a4e5c53,scope:logical-session,storage:memory,attempt:5,history:[{verificationId:vfy_a26e2a05-6078-402a-8e88-73fd0651d782,verdict:fail,reasons:[],endedAt:2026-11-19T08:57:28.362Z},{verificationId:vfy_40446178-f5d3-4778-87da-43304dccf9d0,verdict:fail,reasons:[],endedAt:2026-11-19T08:58:06.226Z},{verificationId:vfy_35f47e8b-d3d5-4439-b119-cfdcb5afe58f,verdict:fail,reasons:[],endedAt:2026-11-19T08:58:09.757Z},{verificationId:vfy_a6e85c4a-ce93-4411-8e8b-55bbb422cbd3,verdict:pass,reasons:[],endedAt:2026-11-19T08:58:17.737Z}],codeChangedSincePrevious:document-reloaded,failsOnSameCode:0}
evidence: {retained:true,tools:[react_get_renders,react_component_cohort,react_list_overrides,react_refresh_events,react_profile_stop,react_error_state]}
startedAt: 2026-11-19T08:58:31.138Z
endedAt: 2026-11-19T08:58:31.988Z
request: {budget:{fiberLimit:250,operationLimit:20000,timeLimitMs:8,targetOperationReserve:4000,targetTimeReserveMs:4,adaptive:true},settle:{quietMs:500,timeoutMs:10000,domains:[react,network]},maxDurationMs:300000,allowOverrides:false}
[exit 4]

$ agent-browser --session upd-a eval "JSON.stringify({pressed: document.querySelector('[aria-label=\"Date range\"] [aria-pressed=true]').textContent, chartRange: document.querySelector('.bar-chart').dataset.range, bars: document.querySelectorAll('.bar-chart__bar').length})"
"{\"pressed\":\"Last 7 days\",\"chartRange\":\"7d\",\"bars\":7}"
[exit 0]

## temporary setup change: requestWatchCollector() added to src/devtools/connect-genie.ts (diff in the notes)
## shipped code, 90d latency 5000 ms, request watch on

$ agent-browser --session upd-a open http://127.0.0.1:5231/reports
✓ Acme Tracker
  http://127.0.0.1:5231/reports
[exit 0]

$ agent-browser --session upd-a wait .bar-chart
✓ Done
[exit 0]

$ npx genie-react verify begin --session upd-a --name 'switch 90d then 7d' --claim 'render ThroughputWidget max 3' --claim 'render ReportRangePicker min 1' --claim 'boundaries clean'
recording vfy_e1330315-7fc8-4124-ba79-d2e9ab8935af "switch 90d then 7d"
  url "http://127.0.0.1:5231/reports"
  1 recording render ThroughputWidget max 3
  2 recording render ReportRangePicker min 1
  3 recording boundaries clean
window: {observationId:observation:1,startDocumentCommitId:17,domains:[react,network],quietMs:500,timeoutMs:10000,tailMs:500}
next: $ npx genie-react verify end vfy_e1330315-7fc8-4124-ba79-d2e9ab8935af --session upd-a
session: {sessionId:01338a6b-bfbf-4b7d-850d-f291e7b5211f,logicalSessionId:c2bb8a8e-e0ef-46a5-a676-b347282a2d7f,documentGeneration:10}
schemaVersion: "1.0"
targets: [{target:{component:ThroughputWidget},status:resolved,instances:1,source:~/.t3/worktrees/genie-react/t3-30e9ccc5-7f0438b9817ce5ab/apps/realworld-legacy/src/features/reports/reports-page.tsx},{target:{component:ReportRangePicker},status:resolved,instances:1,source:~/.t3/worktrees/genie-react/t3-30e9ccc5-7f0438b9817ce5ab/apps/realworld-legacy/src/features/reports/report-range-picker.tsx}]
startedAt: 2026-11-19T08:58:54.235Z
expiresAt: 2026-11-19T09:03:54.250Z
request: {budget:{fiberLimit:250,operationLimit:20000,timeLimitMs:8,targetOperationReserve:4000,targetTimeReserveMs:4,adaptive:true},settle:{quietMs:500,timeoutMs:10000},maxDurationMs:300000,allowOverrides:false}
[exit 0]

$ agent-browser --session upd-a find role button click --name 'Last 90 days' && agent-browser --session upd-a find role button click --name 'Last 7 days'
✓ Done
✓ Done
[exit 0]

$ npx genie-react verify end vfy_e1330315-7fc8-4124-ba79-d2e9ab8935af --session upd-a
fail vfy_e1330315-7fc8-4124-ba79-d2e9ab8935af "switch 90d then 7d"  13 commits, quiet after 5998 ms (react, network)
  url "http://127.0.0.1:5231/reports"
  1 fail render ThroughputWidget max 3  {renders:4,mounts:0,updates:4,remounts:0,semantics:exact,instances:1,activeInstances:1}
      claim: {kind:renders,target:{component:ThroughputWidget},max:3,counting:renders,allowRemount:false}
      deciding: [{kind:instance,mountId:mount:1,renders:4,mounts:0,updates:4,mountGeneration:1,latestDocumentCommitId:28,source:~/.t3/worktrees/genie-react/t3-30e9ccc5-7f0438b9817ce5ab/apps/realworld-legacy/src/features/reports/reports-page.tsx:59:32}]
  2 pass render ReportRangePicker min 1  {renders:2,mounts:0,updates:2,remounts:0,semantics:exact,instances:1,activeInstances:1}
      claim: {kind:renders,target:{component:ReportRangePicker},min:1,counting:renders,allowRemount:false}
      deciding: [{kind:instance,mountId:mount:2,renders:2,mounts:0,updates:2,mountGeneration:1,latestDocumentCommitId:21,source:~/.t3/worktrees/genie-react/t3-30e9ccc5-7f0438b9817ce5ab/apps/realworld-legacy/src/features/reports/report-range-picker.tsx:23:7}]
  3 pass boundaries clean  {caughtDuringWindow:0,caughtAtEnd:0}
      claim: {kind:boundaries-clean,scope:window}
      deciding: [{kind:boundary-log,scope:window,complete:true,afterDocumentCommitId:17}]
      caveats: [uncaught-errors-outside-boundaries-unobserved]
window: {observationId:observation:1,startDocumentCommitId:17,settledDocumentCommitId:29,frozenDocumentCommitId:30,commits:13,settle:{outcome:met,quietMs:500,timeoutMs:10000,waitedMs:5998,domains:{react:met,network:met}},tail:{ms:500,commits:1},environment:{bundle:development,strictMode:on,renderCollection:available,visibility:unavailable}}
! ui-outcome-not-observed: Genie does not check the screen; confirm it with the UI driver
! visibility-unobserved: the app reports no visibility signal, so a hidden interval was not observed
attempt 6 for these claims on this tab; previous refused vfy_1a81b598-70d1-49fb-90ff-8d47c23aaae5 (not_quiescent, not_quiescent); document reloaded since
evidence: $ npx genie-react verify show vfy_e1330315-7fc8-4124-ba79-d2e9ab8935af --claim 1 --session upd-a
session: {sessionId:01338a6b-bfbf-4b7d-850d-f291e7b5211f,logicalSessionId:c2bb8a8e-e0ef-46a5-a676-b347282a2d7f,documentGeneration:10}
schemaVersion: "1.0"
exitCode: 1
stage: end
ledger: {fingerprint:cf_1c6b0a4e5c53,scope:logical-session,storage:memory,attempt:6,history:[{verificationId:vfy_a26e2a05-6078-402a-8e88-73fd0651d782,verdict:fail,reasons:[],endedAt:2026-11-19T08:57:28.362Z},{verificationId:vfy_40446178-f5d3-4778-87da-43304dccf9d0,verdict:fail,reasons:[],endedAt:2026-11-19T08:58:06.226Z},{verificationId:vfy_35f47e8b-d3d5-4439-b119-cfdcb5afe58f,verdict:fail,reasons:[],endedAt:2026-11-19T08:58:09.757Z},{verificationId:vfy_a6e85c4a-ce93-4411-8e8b-55bbb422cbd3,verdict:pass,reasons:[],endedAt:2026-11-19T08:58:17.737Z},{verificationId:vfy_1a81b598-70d1-49fb-90ff-8d47c23aaae5,verdict:refused,reasons:[not_quiescent,not_quiescent],endedAt:2026-11-19T08:58:31.988Z}],codeChangedSincePrevious:document-reloaded,failsOnSameCode:0}
evidence: {retained:true,tools:[react_get_renders,react_component_cohort,react_list_overrides,react_refresh_events,request_watch_start,request_watch_stop,react_profile_stop,react_error_state]}
startedAt: 2026-11-19T08:58:54.235Z
endedAt: 2026-11-19T08:59:01.063Z
request: {budget:{fiberLimit:250,operationLimit:20000,timeLimitMs:8,targetOperationReserve:4000,targetTimeReserveMs:4,adaptive:true},settle:{quietMs:500,timeoutMs:10000},maxDurationMs:300000,allowOverrides:false}
[exit 1]

$ agent-browser --session upd-a eval "JSON.stringify({pressed: document.querySelector('[aria-label=\"Date range\"] [aria-pressed=true]').textContent, chartRange: document.querySelector('.bar-chart').dataset.range, bars: document.querySelectorAll('.bar-chart__bar').length})"
"{\"pressed\":\"Last 7 days\",\"chartRange\":\"90d\",\"bars\":13}"
[exit 0]

## shipped code, 90d latency 5000 ms, request watch on, --timeout-ms 3000

$ agent-browser --session upd-a open http://127.0.0.1:5231/reports
✓ Acme Tracker
  http://127.0.0.1:5231/reports
[exit 0]

$ agent-browser --session upd-a wait .bar-chart
✓ Done
[exit 0]

$ npx genie-react verify begin --session upd-a --name 'switch 90d then 7d' --timeout-ms 3000 --claim 'render ThroughputWidget max 3' --claim 'render ReportRangePicker min 1' --claim 'boundaries clean'
recording vfy_6c5b8109-008d-4927-8749-48aec4306b9c "switch 90d then 7d"
  url "http://127.0.0.1:5231/reports"
  1 recording render ThroughputWidget max 3
  2 recording render ReportRangePicker min 1
  3 recording boundaries clean
window: {observationId:observation:1,startDocumentCommitId:17,domains:[react,network],quietMs:500,timeoutMs:3000,tailMs:500}
next: $ npx genie-react verify end vfy_6c5b8109-008d-4927-8749-48aec4306b9c --session upd-a
session: {sessionId:ee8da435-dbff-4dcd-ac56-39f40e595a69,logicalSessionId:c2bb8a8e-e0ef-46a5-a676-b347282a2d7f,documentGeneration:11}
schemaVersion: "1.0"
targets: [{target:{component:ThroughputWidget},status:resolved,instances:1,source:~/.t3/worktrees/genie-react/t3-30e9ccc5-7f0438b9817ce5ab/apps/realworld-legacy/src/features/reports/reports-page.tsx},{target:{component:ReportRangePicker},status:resolved,instances:1,source:~/.t3/worktrees/genie-react/t3-30e9ccc5-7f0438b9817ce5ab/apps/realworld-legacy/src/features/reports/report-range-picker.tsx}]
startedAt: 2026-11-19T08:59:08.253Z
expiresAt: 2026-11-19T09:04:08.263Z
request: {budget:{fiberLimit:250,operationLimit:20000,timeLimitMs:8,targetOperationReserve:4000,targetTimeReserveMs:4,adaptive:true},settle:{quietMs:500,timeoutMs:3000},maxDurationMs:300000,allowOverrides:false}
[exit 0]

$ agent-browser --session upd-a find role button click --name 'Last 90 days' && agent-browser --session upd-a find role button click --name 'Last 7 days'
✓ Done
✓ Done
[exit 0]

$ npx genie-react verify end vfy_6c5b8109-008d-4927-8749-48aec4306b9c --session upd-a
refused vfy_6c5b8109-008d-4927-8749-48aec4306b9c "switch 90d then 7d"  9 commits, not quiet after 3096 ms (react, network)
  url "http://127.0.0.1:5231/reports"
  1 refused render ThroughputWidget max 3  not_quiescent: The app did not settle within the timeout (1 request is still in flight: GET http://127.0.0.1:5231/api/reports/throughput (3186 ms)), so later work could still change the answer.
      observed: {renders:3,mounts:0,updates:3,remounts:0,semantics:exact,instances:1,activeInstances:1}
      evidence:{settle:timed-out,waitedMs:3096,timeoutMs:3000},fix:{action:begin-again,settle:{timeoutMs:6000}}
      fix: $ npx genie-react verify begin --session upd-a --name 'switch 90d then 7d' --claim 'render ThroughputWidget max 3' --claim 'render ReportRangePicker min 1' --claim 'boundaries clean' --timeout-ms 6000
      claim: {kind:renders,target:{component:ThroughputWidget},max:3,counting:renders,allowRemount:false}
      deciding: [{kind:instance,mountId:mount:1,renders:3,mounts:0,updates:3,mountGeneration:1,latestDocumentCommitId:22,source:~/.t3/worktrees/genie-react/t3-30e9ccc5-7f0438b9817ce5ab/apps/realworld-legacy/src/features/reports/reports-page.tsx:59:32}]
  2 pass render ReportRangePicker min 1  {renders:2,mounts:0,updates:2,remounts:0,semantics:exact,instances:1,activeInstances:1}
      claim: {kind:renders,target:{component:ReportRangePicker},min:1,counting:renders,allowRemount:false}
      deciding: [{kind:instance,mountId:mount:2,renders:2,mounts:0,updates:2,mountGeneration:1,latestDocumentCommitId:21,source:~/.t3/worktrees/genie-react/t3-30e9ccc5-7f0438b9817ce5ab/apps/realworld-legacy/src/features/reports/report-range-picker.tsx:23:7}]
  3 refused boundaries clean  not_quiescent: The app did not settle within the timeout (1 request is still in flight: GET http://127.0.0.1:5231/api/reports/throughput (3186 ms)), so later work could still change the answer.
      observed: {caughtDuringWindow:0,caughtAtEnd:0}
      evidence:{settle:timed-out,waitedMs:3096,timeoutMs:3000},fix:{action:begin-again,settle:{timeoutMs:6000}}
      fix: $ npx genie-react verify begin --session upd-a --name 'switch 90d then 7d' --claim 'render ThroughputWidget max 3' --claim 'render ReportRangePicker min 1' --claim 'boundaries clean' --timeout-ms 6000
      claim: {kind:boundaries-clean,scope:window}
      deciding: []
      caveats: [uncaught-errors-outside-boundaries-unobserved]
window: {observationId:observation:1,startDocumentCommitId:17,settledDocumentCommitId:25,frozenDocumentCommitId:26,commits:9,settle:{outcome:timed-out,reason:"1 request is still in flight: GET http://127.0.0.1:5231/api/reports/throughput (3186 ms)",quietMs:500,timeoutMs:3000,waitedMs:3096,domains:{react:pending,network:pending}},tail:{ms:500,commits:1},environment:{bundle:development,strictMode:on,renderCollection:available,visibility:unavailable}}
! ui-outcome-not-observed: Genie does not check the screen; confirm it with the UI driver
! visibility-unobserved: the app reports no visibility signal, so a hidden interval was not observed
! not-settled: the app did not settle within the timeout
attempt 7 for these claims on this tab; previous fail vfy_e1330315-7fc8-4124-ba79-d2e9ab8935af; document reloaded since
evidence: $ npx genie-react verify show vfy_6c5b8109-008d-4927-8749-48aec4306b9c --claim 1 --session upd-a
session: {sessionId:ee8da435-dbff-4dcd-ac56-39f40e595a69,logicalSessionId:c2bb8a8e-e0ef-46a5-a676-b347282a2d7f,documentGeneration:11}
schemaVersion: "1.0"
exitCode: 4
stage: end
ledger: {fingerprint:cf_1c6b0a4e5c53,scope:logical-session,storage:memory,attempt:7,history:[{verificationId:vfy_a26e2a05-6078-402a-8e88-73fd0651d782,verdict:fail,reasons:[],endedAt:2026-11-19T08:57:28.362Z},{verificationId:vfy_40446178-f5d3-4778-87da-43304dccf9d0,verdict:fail,reasons:[],endedAt:2026-11-19T08:58:06.226Z},{verificationId:vfy_35f47e8b-d3d5-4439-b119-cfdcb5afe58f,verdict:fail,reasons:[],endedAt:2026-11-19T08:58:09.757Z},{verificationId:vfy_a6e85c4a-ce93-4411-8e8b-55bbb422cbd3,verdict:pass,reasons:[],endedAt:2026-11-19T08:58:17.737Z},{verificationId:vfy_1a81b598-70d1-49fb-90ff-8d47c23aaae5,verdict:refused,reasons:[not_quiescent,not_quiescent],endedAt:2026-11-19T08:58:31.988Z},{verificationId:vfy_e1330315-7fc8-4124-ba79-d2e9ab8935af,verdict:fail,reasons:[],endedAt:2026-11-19T08:59:01.063Z}],codeChangedSincePrevious:document-reloaded,failsOnSameCode:0}
evidence: {retained:true,tools:[react_get_renders,react_component_cohort,react_list_overrides,react_refresh_events,request_watch_start,request_watch_stop,react_profile_stop,react_error_state]}
startedAt: 2026-11-19T08:59:08.253Z
endedAt: 2026-11-19T08:59:12.146Z
request: {budget:{fiberLimit:250,operationLimit:20000,timeLimitMs:8,targetOperationReserve:4000,targetTimeReserveMs:4,adaptive:true},settle:{quietMs:500,timeoutMs:3000},maxDurationMs:300000,allowOverrides:false}
[exit 4]

$ agent-browser --session upd-a eval "JSON.stringify({pressed: document.querySelector('[aria-label=\"Date range\"] [aria-pressed=true]').textContent, chartRange: document.querySelector('.bar-chart').dataset.range, bars: document.querySelectorAll('.bar-chart__bar').length})"
"{\"pressed\":\"Last 7 days\",\"chartRange\":\"7d\",\"bars\":7}"
[exit 0]

$ npx genie-react call app_backend_faults '{"rules":[{"method":"GET","path":"/api/reports/throughput","query":{"range":"90d"},"latencyMs":1200}]}' --session upd-a
rules[1]:
  - {method:GET,path:/api/reports/throughput,query:{range:90d},latencyMs:1200,status:null,times:null,hits:0}
[exit 0]

## verify before fix, 90d latency 1200 ms, request watch on (3 runs)

$ agent-browser --session upd-a open http://127.0.0.1:5231/reports
✓ Acme Tracker
  http://127.0.0.1:5231/reports
[exit 0]

$ agent-browser --session upd-a wait .bar-chart
✓ Done
[exit 0]

$ npx genie-react verify begin --session upd-a --name 'switch 90d then 7d' --claim 'render ThroughputWidget max 3' --claim 'render ReportRangePicker min 1' --claim 'boundaries clean'
recording vfy_8cf7d291-bb3c-47ab-8e3e-ed9ff9d58d6a "switch 90d then 7d"
  url "http://127.0.0.1:5231/reports"
  1 recording render ThroughputWidget max 3
  2 recording render ReportRangePicker min 1
  3 recording boundaries clean
window: {observationId:observation:1,startDocumentCommitId:17,domains:[react,network],quietMs:500,timeoutMs:10000,tailMs:500}
next: $ npx genie-react verify end vfy_8cf7d291-bb3c-47ab-8e3e-ed9ff9d58d6a --session upd-a
session: {sessionId:73cc5789-2991-41fa-9da2-cf60ddee8eb2,logicalSessionId:c2bb8a8e-e0ef-46a5-a676-b347282a2d7f,documentGeneration:12}
schemaVersion: "1.0"
targets: [{target:{component:ThroughputWidget},status:resolved,instances:1,source:~/.t3/worktrees/genie-react/t3-30e9ccc5-7f0438b9817ce5ab/apps/realworld-legacy/src/features/reports/reports-page.tsx},{target:{component:ReportRangePicker},status:resolved,instances:1,source:~/.t3/worktrees/genie-react/t3-30e9ccc5-7f0438b9817ce5ab/apps/realworld-legacy/src/features/reports/report-range-picker.tsx}]
startedAt: 2026-11-19T08:59:28.419Z
expiresAt: 2026-11-19T09:04:28.430Z
request: {budget:{fiberLimit:250,operationLimit:20000,timeLimitMs:8,targetOperationReserve:4000,targetTimeReserveMs:4,adaptive:true},settle:{quietMs:500,timeoutMs:10000},maxDurationMs:300000,allowOverrides:false}
[exit 0]

$ agent-browser --session upd-a find role button click --name 'Last 90 days' && agent-browser --session upd-a find role button click --name 'Last 7 days'
✓ Done
✓ Done
[exit 0]

$ npx genie-react verify end vfy_8cf7d291-bb3c-47ab-8e3e-ed9ff9d58d6a --session upd-a
fail vfy_8cf7d291-bb3c-47ab-8e3e-ed9ff9d58d6a "switch 90d then 7d"  9 commits, quiet after 2164 ms (react, network)
  url "http://127.0.0.1:5231/reports"
  1 fail render ThroughputWidget max 3  {renders:4,mounts:0,updates:4,remounts:0,semantics:exact,instances:1,activeInstances:1}
      claim: {kind:renders,target:{component:ThroughputWidget},max:3,counting:renders,allowRemount:false}
      deciding: [{kind:instance,mountId:mount:1,renders:4,mounts:0,updates:4,mountGeneration:1,latestDocumentCommitId:24,source:~/.t3/worktrees/genie-react/t3-30e9ccc5-7f0438b9817ce5ab/apps/realworld-legacy/src/features/reports/reports-page.tsx:59:32}]
  2 pass render ReportRangePicker min 1  {renders:2,mounts:0,updates:2,remounts:0,semantics:exact,instances:1,activeInstances:1}
      claim: {kind:renders,target:{component:ReportRangePicker},min:1,counting:renders,allowRemount:false}
      deciding: [{kind:instance,mountId:mount:2,renders:2,mounts:0,updates:2,mountGeneration:1,latestDocumentCommitId:21,source:~/.t3/worktrees/genie-react/t3-30e9ccc5-7f0438b9817ce5ab/apps/realworld-legacy/src/features/reports/report-range-picker.tsx:23:7}]
  3 pass boundaries clean  {caughtDuringWindow:0,caughtAtEnd:0}
      claim: {kind:boundaries-clean,scope:window}
      deciding: [{kind:boundary-log,scope:window,complete:true,afterDocumentCommitId:17}]
      caveats: [uncaught-errors-outside-boundaries-unobserved]
window: {observationId:observation:1,startDocumentCommitId:17,settledDocumentCommitId:25,frozenDocumentCommitId:26,commits:9,settle:{outcome:met,quietMs:500,timeoutMs:10000,waitedMs:2164,domains:{react:met,network:met}},tail:{ms:500,commits:1},environment:{bundle:development,strictMode:on,renderCollection:available,visibility:unavailable}}
! ui-outcome-not-observed: Genie does not check the screen; confirm it with the UI driver
! visibility-unobserved: the app reports no visibility signal, so a hidden interval was not observed
attempt 8 for these claims on this tab; previous refused vfy_6c5b8109-008d-4927-8749-48aec4306b9c (not_quiescent, not_quiescent); document reloaded since
evidence: $ npx genie-react verify show vfy_8cf7d291-bb3c-47ab-8e3e-ed9ff9d58d6a --claim 1 --session upd-a
session: {sessionId:73cc5789-2991-41fa-9da2-cf60ddee8eb2,logicalSessionId:c2bb8a8e-e0ef-46a5-a676-b347282a2d7f,documentGeneration:12}
schemaVersion: "1.0"
exitCode: 1
stage: end
ledger: {fingerprint:cf_1c6b0a4e5c53,scope:logical-session,storage:memory,attempt:8,history:[{verificationId:vfy_a26e2a05-6078-402a-8e88-73fd0651d782,verdict:fail,reasons:[],endedAt:2026-11-19T08:57:28.362Z},{verificationId:vfy_40446178-f5d3-4778-87da-43304dccf9d0,verdict:fail,reasons:[],endedAt:2026-11-19T08:58:06.226Z},{verificationId:vfy_35f47e8b-d3d5-4439-b119-cfdcb5afe58f,verdict:fail,reasons:[],endedAt:2026-11-19T08:58:09.757Z},{verificationId:vfy_a6e85c4a-ce93-4411-8e8b-55bbb422cbd3,verdict:pass,reasons:[],endedAt:2026-11-19T08:58:17.737Z},{verificationId:vfy_1a81b598-70d1-49fb-90ff-8d47c23aaae5,verdict:refused,reasons:[not_quiescent,not_quiescent],endedAt:2026-11-19T08:58:31.988Z},{verificationId:vfy_e1330315-7fc8-4124-ba79-d2e9ab8935af,verdict:fail,reasons:[],endedAt:2026-11-19T08:59:01.063Z},{verificationId:vfy_6c5b8109-008d-4927-8749-48aec4306b9c,verdict:refused,reasons:[not_quiescent,not_quiescent],endedAt:2026-11-19T08:59:12.146Z}],codeChangedSincePrevious:document-reloaded,failsOnSameCode:0}
evidence: {retained:true,tools:[react_get_renders,react_component_cohort,react_list_overrides,react_refresh_events,request_watch_start,request_watch_stop,react_profile_stop,react_error_state]}
startedAt: 2026-11-19T08:59:28.419Z
endedAt: 2026-11-19T08:59:31.381Z
request: {budget:{fiberLimit:250,operationLimit:20000,timeLimitMs:8,targetOperationReserve:4000,targetTimeReserveMs:4,adaptive:true},settle:{quietMs:500,timeoutMs:10000},maxDurationMs:300000,allowOverrides:false}
[exit 1]

$ agent-browser --session upd-a eval "JSON.stringify({pressed: document.querySelector('[aria-label=\"Date range\"] [aria-pressed=true]').textContent, chartRange: document.querySelector('.bar-chart').dataset.range, bars: document.querySelectorAll('.bar-chart__bar').length})"
"{\"pressed\":\"Last 7 days\",\"chartRange\":\"90d\",\"bars\":13}"
[exit 0]

$ agent-browser --session upd-a open http://127.0.0.1:5231/reports
✓ Acme Tracker
  http://127.0.0.1:5231/reports
[exit 0]

$ agent-browser --session upd-a wait .bar-chart
✓ Done
[exit 0]

$ npx genie-react verify begin --session upd-a --name 'switch 90d then 7d' --claim 'render ThroughputWidget max 3' --claim 'render ReportRangePicker min 1' --claim 'boundaries clean'
recording vfy_08db048c-c7c3-4b6f-8eca-90ae750121ac "switch 90d then 7d"
  url "http://127.0.0.1:5231/reports"
  1 recording render ThroughputWidget max 3
  2 recording render ReportRangePicker min 1
  3 recording boundaries clean
window: {observationId:observation:1,startDocumentCommitId:17,domains:[react,network],quietMs:500,timeoutMs:10000,tailMs:500}
next: $ npx genie-react verify end vfy_08db048c-c7c3-4b6f-8eca-90ae750121ac --session upd-a
session: {sessionId:84773508-70d0-49cf-8cf9-6d6d760d7bac,logicalSessionId:c2bb8a8e-e0ef-46a5-a676-b347282a2d7f,documentGeneration:13}
schemaVersion: "1.0"
targets: [{target:{component:ThroughputWidget},status:resolved,instances:1,source:~/.t3/worktrees/genie-react/t3-30e9ccc5-7f0438b9817ce5ab/apps/realworld-legacy/src/features/reports/reports-page.tsx},{target:{component:ReportRangePicker},status:resolved,instances:1,source:~/.t3/worktrees/genie-react/t3-30e9ccc5-7f0438b9817ce5ab/apps/realworld-legacy/src/features/reports/report-range-picker.tsx}]
startedAt: 2026-11-19T08:59:31.922Z
expiresAt: 2026-11-19T09:04:31.933Z
request: {budget:{fiberLimit:250,operationLimit:20000,timeLimitMs:8,targetOperationReserve:4000,targetTimeReserveMs:4,adaptive:true},settle:{quietMs:500,timeoutMs:10000},maxDurationMs:300000,allowOverrides:false}
[exit 0]

$ agent-browser --session upd-a find role button click --name 'Last 90 days' && agent-browser --session upd-a find role button click --name 'Last 7 days'
✓ Done
✓ Done
[exit 0]

$ npx genie-react verify end vfy_08db048c-c7c3-4b6f-8eca-90ae750121ac --session upd-a
fail vfy_08db048c-c7c3-4b6f-8eca-90ae750121ac "switch 90d then 7d"  9 commits, quiet after 2011 ms (react, network)
  url "http://127.0.0.1:5231/reports"
  1 fail render ThroughputWidget max 3  {renders:4,mounts:0,updates:4,remounts:0,semantics:exact,instances:1,activeInstances:1}
      claim: {kind:renders,target:{component:ThroughputWidget},max:3,counting:renders,allowRemount:false}
      deciding: [{kind:instance,mountId:mount:1,renders:4,mounts:0,updates:4,mountGeneration:1,latestDocumentCommitId:24,source:~/.t3/worktrees/genie-react/t3-30e9ccc5-7f0438b9817ce5ab/apps/realworld-legacy/src/features/reports/reports-page.tsx:59:32}]
  2 pass render ReportRangePicker min 1  {renders:2,mounts:0,updates:2,remounts:0,semantics:exact,instances:1,activeInstances:1}
      claim: {kind:renders,target:{component:ReportRangePicker},min:1,counting:renders,allowRemount:false}
      deciding: [{kind:instance,mountId:mount:2,renders:2,mounts:0,updates:2,mountGeneration:1,latestDocumentCommitId:21,source:~/.t3/worktrees/genie-react/t3-30e9ccc5-7f0438b9817ce5ab/apps/realworld-legacy/src/features/reports/report-range-picker.tsx:23:7}]
  3 pass boundaries clean  {caughtDuringWindow:0,caughtAtEnd:0}
      claim: {kind:boundaries-clean,scope:window}
      deciding: [{kind:boundary-log,scope:window,complete:true,afterDocumentCommitId:17}]
      caveats: [uncaught-errors-outside-boundaries-unobserved]
window: {observationId:observation:1,startDocumentCommitId:17,settledDocumentCommitId:25,frozenDocumentCommitId:26,commits:9,settle:{outcome:met,quietMs:500,timeoutMs:10000,waitedMs:2011,domains:{react:met,network:met}},tail:{ms:500,commits:1},environment:{bundle:development,strictMode:on,renderCollection:available,visibility:unavailable}}
! ui-outcome-not-observed: Genie does not check the screen; confirm it with the UI driver
! visibility-unobserved: the app reports no visibility signal, so a hidden interval was not observed
attempt 9 for these claims on this tab; previous fail vfy_8cf7d291-bb3c-47ab-8e3e-ed9ff9d58d6a; document reloaded since
evidence: $ npx genie-react verify show vfy_08db048c-c7c3-4b6f-8eca-90ae750121ac --claim 1 --session upd-a
session: {sessionId:84773508-70d0-49cf-8cf9-6d6d760d7bac,logicalSessionId:c2bb8a8e-e0ef-46a5-a676-b347282a2d7f,documentGeneration:13}
schemaVersion: "1.0"
exitCode: 1
stage: end
ledger: {fingerprint:cf_1c6b0a4e5c53,scope:logical-session,storage:memory,attempt:9,history:[{verificationId:vfy_a26e2a05-6078-402a-8e88-73fd0651d782,verdict:fail,reasons:[],endedAt:2026-11-19T08:57:28.362Z},{verificationId:vfy_40446178-f5d3-4778-87da-43304dccf9d0,verdict:fail,reasons:[],endedAt:2026-11-19T08:58:06.226Z},{verificationId:vfy_35f47e8b-d3d5-4439-b119-cfdcb5afe58f,verdict:fail,reasons:[],endedAt:2026-11-19T08:58:09.757Z},{verificationId:vfy_a6e85c4a-ce93-4411-8e8b-55bbb422cbd3,verdict:pass,reasons:[],endedAt:2026-11-19T08:58:17.737Z},{verificationId:vfy_1a81b598-70d1-49fb-90ff-8d47c23aaae5,verdict:refused,reasons:[not_quiescent,not_quiescent],endedAt:2026-11-19T08:58:31.988Z},{verificationId:vfy_e1330315-7fc8-4124-ba79-d2e9ab8935af,verdict:fail,reasons:[],endedAt:2026-11-19T08:59:01.063Z},{verificationId:vfy_6c5b8109-008d-4927-8749-48aec4306b9c,verdict:refused,reasons:[not_quiescent,not_quiescent],endedAt:2026-11-19T08:59:12.146Z},{verificationId:vfy_8cf7d291-bb3c-47ab-8e3e-ed9ff9d58d6a,verdict:fail,reasons:[],endedAt:2026-11-19T08:59:31.381Z}],codeChangedSincePrevious:document-reloaded,failsOnSameCode:0}
evidence: {retained:true,tools:[react_get_renders,react_component_cohort,react_list_overrides,react_refresh_events,request_watch_start,request_watch_stop,react_profile_stop,react_error_state]}
startedAt: 2026-11-19T08:59:31.922Z
endedAt: 2026-11-19T08:59:34.746Z
request: {budget:{fiberLimit:250,operationLimit:20000,timeLimitMs:8,targetOperationReserve:4000,targetTimeReserveMs:4,adaptive:true},settle:{quietMs:500,timeoutMs:10000},maxDurationMs:300000,allowOverrides:false}
[exit 1]

$ agent-browser --session upd-a eval "JSON.stringify({pressed: document.querySelector('[aria-label=\"Date range\"] [aria-pressed=true]').textContent, chartRange: document.querySelector('.bar-chart').dataset.range, bars: document.querySelectorAll('.bar-chart__bar').length})"
"{\"pressed\":\"Last 7 days\",\"chartRange\":\"90d\",\"bars\":13}"
[exit 0]

$ agent-browser --session upd-a open http://127.0.0.1:5231/reports
✓ Acme Tracker
  http://127.0.0.1:5231/reports
[exit 0]

$ agent-browser --session upd-a wait .bar-chart
✓ Done
[exit 0]

$ npx genie-react verify begin --session upd-a --name 'switch 90d then 7d' --claim 'render ThroughputWidget max 3' --claim 'render ReportRangePicker min 1' --claim 'boundaries clean'
recording vfy_782a1a53-50b5-41c6-b8e7-ee38c83425fc "switch 90d then 7d"
  url "http://127.0.0.1:5231/reports"
  1 recording render ThroughputWidget max 3
  2 recording render ReportRangePicker min 1
  3 recording boundaries clean
window: {observationId:observation:1,startDocumentCommitId:17,domains:[react,network],quietMs:500,timeoutMs:10000,tailMs:500}
next: $ npx genie-react verify end vfy_782a1a53-50b5-41c6-b8e7-ee38c83425fc --session upd-a
session: {sessionId:12407fbc-f41a-4e13-b414-3df83a868c95,logicalSessionId:c2bb8a8e-e0ef-46a5-a676-b347282a2d7f,documentGeneration:14}
schemaVersion: "1.0"
targets: [{target:{component:ThroughputWidget},status:resolved,instances:1,source:~/.t3/worktrees/genie-react/t3-30e9ccc5-7f0438b9817ce5ab/apps/realworld-legacy/src/features/reports/reports-page.tsx},{target:{component:ReportRangePicker},status:resolved,instances:1,source:~/.t3/worktrees/genie-react/t3-30e9ccc5-7f0438b9817ce5ab/apps/realworld-legacy/src/features/reports/report-range-picker.tsx}]
startedAt: 2026-11-19T08:59:35.306Z
expiresAt: 2026-11-19T09:04:35.317Z
request: {budget:{fiberLimit:250,operationLimit:20000,timeLimitMs:8,targetOperationReserve:4000,targetTimeReserveMs:4,adaptive:true},settle:{quietMs:500,timeoutMs:10000},maxDurationMs:300000,allowOverrides:false}
[exit 0]

$ agent-browser --session upd-a find role button click --name 'Last 90 days' && agent-browser --session upd-a find role button click --name 'Last 7 days'
✓ Done
✓ Done
[exit 0]

$ npx genie-react verify end vfy_782a1a53-50b5-41c6-b8e7-ee38c83425fc --session upd-a
fail vfy_782a1a53-50b5-41c6-b8e7-ee38c83425fc "switch 90d then 7d"  9 commits, quiet after 2014 ms (react, network)
  url "http://127.0.0.1:5231/reports"
  1 fail render ThroughputWidget max 3  {renders:4,mounts:0,updates:4,remounts:0,semantics:exact,instances:1,activeInstances:1}
      claim: {kind:renders,target:{component:ThroughputWidget},max:3,counting:renders,allowRemount:false}
      deciding: [{kind:instance,mountId:mount:1,renders:4,mounts:0,updates:4,mountGeneration:1,latestDocumentCommitId:24,source:~/.t3/worktrees/genie-react/t3-30e9ccc5-7f0438b9817ce5ab/apps/realworld-legacy/src/features/reports/reports-page.tsx:59:32}]
  2 pass render ReportRangePicker min 1  {renders:2,mounts:0,updates:2,remounts:0,semantics:exact,instances:1,activeInstances:1}
      claim: {kind:renders,target:{component:ReportRangePicker},min:1,counting:renders,allowRemount:false}
      deciding: [{kind:instance,mountId:mount:2,renders:2,mounts:0,updates:2,mountGeneration:1,latestDocumentCommitId:21,source:~/.t3/worktrees/genie-react/t3-30e9ccc5-7f0438b9817ce5ab/apps/realworld-legacy/src/features/reports/report-range-picker.tsx:23:7}]
  3 pass boundaries clean  {caughtDuringWindow:0,caughtAtEnd:0}
      claim: {kind:boundaries-clean,scope:window}
      deciding: [{kind:boundary-log,scope:window,complete:true,afterDocumentCommitId:17}]
      caveats: [uncaught-errors-outside-boundaries-unobserved]
window: {observationId:observation:1,startDocumentCommitId:17,settledDocumentCommitId:25,frozenDocumentCommitId:26,commits:9,settle:{outcome:met,quietMs:500,timeoutMs:10000,waitedMs:2014,domains:{react:met,network:met}},tail:{ms:500,commits:1},environment:{bundle:development,strictMode:on,renderCollection:available,visibility:unavailable}}
! ui-outcome-not-observed: Genie does not check the screen; confirm it with the UI driver
! visibility-unobserved: the app reports no visibility signal, so a hidden interval was not observed
attempt 10 for these claims on this tab; previous fail vfy_08db048c-c7c3-4b6f-8eca-90ae750121ac; document reloaded since
evidence: $ npx genie-react verify show vfy_782a1a53-50b5-41c6-b8e7-ee38c83425fc --claim 1 --session upd-a
session: {sessionId:12407fbc-f41a-4e13-b414-3df83a868c95,logicalSessionId:c2bb8a8e-e0ef-46a5-a676-b347282a2d7f,documentGeneration:14}
schemaVersion: "1.0"
exitCode: 1
stage: end
ledger: {fingerprint:cf_1c6b0a4e5c53,scope:logical-session,storage:memory,attempt:10,history:[{verificationId:vfy_a26e2a05-6078-402a-8e88-73fd0651d782,verdict:fail,reasons:[],endedAt:2026-11-19T08:57:28.362Z},{verificationId:vfy_40446178-f5d3-4778-87da-43304dccf9d0,verdict:fail,reasons:[],endedAt:2026-11-19T08:58:06.226Z},{verificationId:vfy_35f47e8b-d3d5-4439-b119-cfdcb5afe58f,verdict:fail,reasons:[],endedAt:2026-11-19T08:58:09.757Z},{verificationId:vfy_a6e85c4a-ce93-4411-8e8b-55bbb422cbd3,verdict:pass,reasons:[],endedAt:2026-11-19T08:58:17.737Z},{verificationId:vfy_1a81b598-70d1-49fb-90ff-8d47c23aaae5,verdict:refused,reasons:[not_quiescent,not_quiescent],endedAt:2026-11-19T08:58:31.988Z},{verificationId:vfy_e1330315-7fc8-4124-ba79-d2e9ab8935af,verdict:fail,reasons:[],endedAt:2026-11-19T08:59:01.063Z},{verificationId:vfy_6c5b8109-008d-4927-8749-48aec4306b9c,verdict:refused,reasons:[not_quiescent,not_quiescent],endedAt:2026-11-19T08:59:12.146Z},{verificationId:vfy_8cf7d291-bb3c-47ab-8e3e-ed9ff9d58d6a,verdict:fail,reasons:[],endedAt:2026-11-19T08:59:31.381Z},{verificationId:vfy_08db048c-c7c3-4b6f-8eca-90ae750121ac,verdict:fail,reasons:[],endedAt:2026-11-19T08:59:34.746Z}],codeChangedSincePrevious:document-reloaded,failsOnSameCode:0}
evidence: {retained:true,tools:[react_get_renders,react_component_cohort,react_list_overrides,react_refresh_events,request_watch_start,request_watch_stop,react_profile_stop,react_error_state]}
startedAt: 2026-11-19T08:59:35.306Z
endedAt: 2026-11-19T08:59:38.168Z
request: {budget:{fiberLimit:250,operationLimit:20000,timeLimitMs:8,targetOperationReserve:4000,targetTimeReserveMs:4,adaptive:true},settle:{quietMs:500,timeoutMs:10000},maxDurationMs:300000,allowOverrides:false}
[exit 1]

$ agent-browser --session upd-a eval "JSON.stringify({pressed: document.querySelector('[aria-label=\"Date range\"] [aria-pressed=true]').textContent, chartRange: document.querySelector('.bar-chart').dataset.range, bars: document.querySelectorAll('.bar-chart__bar').length})"
"{\"pressed\":\"Last 7 days\",\"chartRange\":\"90d\",\"bars\":13}"
[exit 0]

## temporary fix applied to src/features/reports/state/actions.ts (diff as in the article)
## verify after fix, 90d latency 1200 ms, request watch on (3 runs)

$ agent-browser --session upd-a open http://127.0.0.1:5231/reports
✓ Acme Tracker
  http://127.0.0.1:5231/reports
[exit 0]

$ agent-browser --session upd-a wait .bar-chart
✓ Done
[exit 0]

$ npx genie-react verify begin --session upd-a --name 'switch 90d then 7d' --claim 'render ThroughputWidget max 3' --claim 'render ReportRangePicker min 1' --claim 'boundaries clean'
recording vfy_6ee2529e-a489-475f-8e86-da8ea34f19d8 "switch 90d then 7d"
  url "http://127.0.0.1:5231/reports"
  1 recording render ThroughputWidget max 3
  2 recording render ReportRangePicker min 1
  3 recording boundaries clean
window: {observationId:observation:1,startDocumentCommitId:17,domains:[react,network],quietMs:500,timeoutMs:10000,tailMs:500}
next: $ npx genie-react verify end vfy_6ee2529e-a489-475f-8e86-da8ea34f19d8 --session upd-a
session: {sessionId:ef9bb012-1676-4c55-ae19-8776d92bce1f,logicalSessionId:c2bb8a8e-e0ef-46a5-a676-b347282a2d7f,documentGeneration:16}
schemaVersion: "1.0"
targets: [{target:{component:ThroughputWidget},status:resolved,instances:1,source:~/.t3/worktrees/genie-react/t3-30e9ccc5-7f0438b9817ce5ab/apps/realworld-legacy/src/features/reports/reports-page.tsx},{target:{component:ReportRangePicker},status:resolved,instances:1,source:~/.t3/worktrees/genie-react/t3-30e9ccc5-7f0438b9817ce5ab/apps/realworld-legacy/src/features/reports/report-range-picker.tsx}]
startedAt: 2026-11-19T08:59:55.381Z
expiresAt: 2026-11-19T09:04:55.394Z
request: {budget:{fiberLimit:250,operationLimit:20000,timeLimitMs:8,targetOperationReserve:4000,targetTimeReserveMs:4,adaptive:true},settle:{quietMs:500,timeoutMs:10000},maxDurationMs:300000,allowOverrides:false}
[exit 0]

$ agent-browser --session upd-a find role button click --name 'Last 90 days' && agent-browser --session upd-a find role button click --name 'Last 7 days'
✓ Done
✓ Done
[exit 0]

$ npx genie-react verify end vfy_6ee2529e-a489-475f-8e86-da8ea34f19d8 --session upd-a
pass vfy_6ee2529e-a489-475f-8e86-da8ea34f19d8 "switch 90d then 7d"  7 commits, quiet after 1109 ms (react, network)
  url "http://127.0.0.1:5231/reports"
  1 pass render ThroughputWidget max 3  {renders:3,mounts:0,updates:3,remounts:0,semantics:exact,instances:1,activeInstances:1}
      claim: {kind:renders,target:{component:ThroughputWidget},max:3,counting:renders,allowRemount:false}
      deciding: [{kind:coverage,complete:true,targetedComplete:true,semantics:exact},{kind:instance,mountId:mount:1,renderingState:mounted-rendering,source:~/.t3/worktrees/genie-react/t3-30e9ccc5-7f0438b9817ce5ab/apps/realworld-legacy/src/features/reports/reports-page.tsx:59:32}]
  2 pass render ReportRangePicker min 1  {renders:2,mounts:0,updates:2,remounts:0,semantics:exact,instances:1,activeInstances:1}
      claim: {kind:renders,target:{component:ReportRangePicker},min:1,counting:renders,allowRemount:false}
      deciding: [{kind:instance,mountId:mount:2,renders:2,mounts:0,updates:2,mountGeneration:1,latestDocumentCommitId:21,source:~/.t3/worktrees/genie-react/t3-30e9ccc5-7f0438b9817ce5ab/apps/realworld-legacy/src/features/reports/report-range-picker.tsx:23:7}]
  3 pass boundaries clean  {caughtDuringWindow:0,caughtAtEnd:0}
      claim: {kind:boundaries-clean,scope:window}
      deciding: [{kind:boundary-log,scope:window,complete:true,afterDocumentCommitId:17}]
      caveats: [uncaught-errors-outside-boundaries-unobserved]
window: {observationId:observation:1,startDocumentCommitId:17,settledDocumentCommitId:23,frozenDocumentCommitId:24,commits:7,settle:{outcome:met,quietMs:500,timeoutMs:10000,waitedMs:1109,domains:{react:met,network:met}},tail:{ms:500,commits:1},environment:{bundle:development,strictMode:on,renderCollection:available,visibility:unavailable}}
! ui-outcome-not-observed: Genie does not check the screen; confirm it with the UI driver
! visibility-unobserved: the app reports no visibility signal, so a hidden interval was not observed
attempt 11 for these claims on this tab; previous fail vfy_782a1a53-50b5-41c6-b8e7-ee38c83425fc; document reloaded since
evidence: $ npx genie-react verify show vfy_6ee2529e-a489-475f-8e86-da8ea34f19d8 --session upd-a
session: {sessionId:ef9bb012-1676-4c55-ae19-8776d92bce1f,logicalSessionId:c2bb8a8e-e0ef-46a5-a676-b347282a2d7f,documentGeneration:16}
schemaVersion: "1.0"
exitCode: 0
stage: end
ledger: {fingerprint:cf_1c6b0a4e5c53,scope:logical-session,storage:memory,attempt:11,history:[{verificationId:vfy_a26e2a05-6078-402a-8e88-73fd0651d782,verdict:fail,reasons:[],endedAt:2026-11-19T08:57:28.362Z},{verificationId:vfy_40446178-f5d3-4778-87da-43304dccf9d0,verdict:fail,reasons:[],endedAt:2026-11-19T08:58:06.226Z},{verificationId:vfy_35f47e8b-d3d5-4439-b119-cfdcb5afe58f,verdict:fail,reasons:[],endedAt:2026-11-19T08:58:09.757Z},{verificationId:vfy_a6e85c4a-ce93-4411-8e8b-55bbb422cbd3,verdict:pass,reasons:[],endedAt:2026-11-19T08:58:17.737Z},{verificationId:vfy_1a81b598-70d1-49fb-90ff-8d47c23aaae5,verdict:refused,reasons:[not_quiescent,not_quiescent],endedAt:2026-11-19T08:58:31.988Z},{verificationId:vfy_e1330315-7fc8-4124-ba79-d2e9ab8935af,verdict:fail,reasons:[],endedAt:2026-11-19T08:59:01.063Z},{verificationId:vfy_6c5b8109-008d-4927-8749-48aec4306b9c,verdict:refused,reasons:[not_quiescent,not_quiescent],endedAt:2026-11-19T08:59:12.146Z},{verificationId:vfy_8cf7d291-bb3c-47ab-8e3e-ed9ff9d58d6a,verdict:fail,reasons:[],endedAt:2026-11-19T08:59:31.381Z},{verificationId:vfy_08db048c-c7c3-4b6f-8eca-90ae750121ac,verdict:fail,reasons:[],endedAt:2026-11-19T08:59:34.746Z},{verificationId:vfy_782a1a53-50b5-41c6-b8e7-ee38c83425fc,verdict:fail,reasons:[],endedAt:2026-11-19T08:59:38.168Z}],codeChangedSincePrevious:document-reloaded,failsOnSameCode:0}
evidence: {retained:true,tools:[react_get_renders,react_component_cohort,react_list_overrides,react_refresh_events,request_watch_start,request_watch_stop,react_profile_stop,react_error_state]}
startedAt: 2026-11-19T08:59:55.381Z
endedAt: 2026-11-19T08:59:57.303Z
request: {budget:{fiberLimit:250,operationLimit:20000,timeLimitMs:8,targetOperationReserve:4000,targetTimeReserveMs:4,adaptive:true},settle:{quietMs:500,timeoutMs:10000},maxDurationMs:300000,allowOverrides:false}
[exit 0]

$ agent-browser --session upd-a eval "JSON.stringify({pressed: document.querySelector('[aria-label=\"Date range\"] [aria-pressed=true]').textContent, chartRange: document.querySelector('.bar-chart').dataset.range, bars: document.querySelectorAll('.bar-chart__bar').length})"
"{\"pressed\":\"Last 7 days\",\"chartRange\":\"7d\",\"bars\":7}"
[exit 0]

$ agent-browser --session upd-a open http://127.0.0.1:5231/reports
✓ Acme Tracker
  http://127.0.0.1:5231/reports
[exit 0]

$ agent-browser --session upd-a wait .bar-chart
✓ Done
[exit 0]

$ npx genie-react verify begin --session upd-a --name 'switch 90d then 7d' --claim 'render ThroughputWidget max 3' --claim 'render ReportRangePicker min 1' --claim 'boundaries clean'
recording vfy_20c20d7d-15d7-41f8-bbf2-5218a27b9a35 "switch 90d then 7d"
  url "http://127.0.0.1:5231/reports"
  1 recording render ThroughputWidget max 3
  2 recording render ReportRangePicker min 1
  3 recording boundaries clean
window: {observationId:observation:1,startDocumentCommitId:17,domains:[react,network],quietMs:500,timeoutMs:10000,tailMs:500}
next: $ npx genie-react verify end vfy_20c20d7d-15d7-41f8-bbf2-5218a27b9a35 --session upd-a
session: {sessionId:3f7adeee-8c7c-44c5-bd01-69cbd707c701,logicalSessionId:c2bb8a8e-e0ef-46a5-a676-b347282a2d7f,documentGeneration:17}
schemaVersion: "1.0"
targets: [{target:{component:ThroughputWidget},status:resolved,instances:1,source:~/.t3/worktrees/genie-react/t3-30e9ccc5-7f0438b9817ce5ab/apps/realworld-legacy/src/features/reports/reports-page.tsx},{target:{component:ReportRangePicker},status:resolved,instances:1,source:~/.t3/worktrees/genie-react/t3-30e9ccc5-7f0438b9817ce5ab/apps/realworld-legacy/src/features/reports/report-range-picker.tsx}]
startedAt: 2026-11-19T08:59:57.849Z
expiresAt: 2026-11-19T09:04:57.857Z
request: {budget:{fiberLimit:250,operationLimit:20000,timeLimitMs:8,targetOperationReserve:4000,targetTimeReserveMs:4,adaptive:true},settle:{quietMs:500,timeoutMs:10000},maxDurationMs:300000,allowOverrides:false}
[exit 0]

$ agent-browser --session upd-a find role button click --name 'Last 90 days' && agent-browser --session upd-a find role button click --name 'Last 7 days'
✓ Done
✓ Done
[exit 0]

$ npx genie-react verify end vfy_20c20d7d-15d7-41f8-bbf2-5218a27b9a35 --session upd-a
pass vfy_20c20d7d-15d7-41f8-bbf2-5218a27b9a35 "switch 90d then 7d"  7 commits, quiet after 1097 ms (react, network)
  url "http://127.0.0.1:5231/reports"
  1 pass render ThroughputWidget max 3  {renders:3,mounts:0,updates:3,remounts:0,semantics:exact,instances:1,activeInstances:1}
      claim: {kind:renders,target:{component:ThroughputWidget},max:3,counting:renders,allowRemount:false}
      deciding: [{kind:coverage,complete:true,targetedComplete:true,semantics:exact},{kind:instance,mountId:mount:1,renderingState:mounted-rendering,source:~/.t3/worktrees/genie-react/t3-30e9ccc5-7f0438b9817ce5ab/apps/realworld-legacy/src/features/reports/reports-page.tsx:59:32}]
  2 pass render ReportRangePicker min 1  {renders:2,mounts:0,updates:2,remounts:0,semantics:exact,instances:1,activeInstances:1}
      claim: {kind:renders,target:{component:ReportRangePicker},min:1,counting:renders,allowRemount:false}
      deciding: [{kind:instance,mountId:mount:2,renders:2,mounts:0,updates:2,mountGeneration:1,latestDocumentCommitId:21,source:~/.t3/worktrees/genie-react/t3-30e9ccc5-7f0438b9817ce5ab/apps/realworld-legacy/src/features/reports/report-range-picker.tsx:23:7}]
  3 pass boundaries clean  {caughtDuringWindow:0,caughtAtEnd:0}
      claim: {kind:boundaries-clean,scope:window}
      deciding: [{kind:boundary-log,scope:window,complete:true,afterDocumentCommitId:17}]
      caveats: [uncaught-errors-outside-boundaries-unobserved]
window: {observationId:observation:1,startDocumentCommitId:17,settledDocumentCommitId:23,frozenDocumentCommitId:24,commits:7,settle:{outcome:met,quietMs:500,timeoutMs:10000,waitedMs:1097,domains:{react:met,network:met}},tail:{ms:500,commits:1},environment:{bundle:development,strictMode:on,renderCollection:available,visibility:unavailable}}
! ui-outcome-not-observed: Genie does not check the screen; confirm it with the UI driver
! visibility-unobserved: the app reports no visibility signal, so a hidden interval was not observed
attempt 12 for these claims on this tab; previous pass vfy_6ee2529e-a489-475f-8e86-da8ea34f19d8; document reloaded since
evidence: $ npx genie-react verify show vfy_20c20d7d-15d7-41f8-bbf2-5218a27b9a35 --session upd-a
session: {sessionId:3f7adeee-8c7c-44c5-bd01-69cbd707c701,logicalSessionId:c2bb8a8e-e0ef-46a5-a676-b347282a2d7f,documentGeneration:17}
schemaVersion: "1.0"
exitCode: 0
stage: end
ledger: {fingerprint:cf_1c6b0a4e5c53,scope:logical-session,storage:memory,attempt:12,history:[{verificationId:vfy_a26e2a05-6078-402a-8e88-73fd0651d782,verdict:fail,reasons:[],endedAt:2026-11-19T08:57:28.362Z},{verificationId:vfy_40446178-f5d3-4778-87da-43304dccf9d0,verdict:fail,reasons:[],endedAt:2026-11-19T08:58:06.226Z},{verificationId:vfy_35f47e8b-d3d5-4439-b119-cfdcb5afe58f,verdict:fail,reasons:[],endedAt:2026-11-19T08:58:09.757Z},{verificationId:vfy_a6e85c4a-ce93-4411-8e8b-55bbb422cbd3,verdict:pass,reasons:[],endedAt:2026-11-19T08:58:17.737Z},{verificationId:vfy_1a81b598-70d1-49fb-90ff-8d47c23aaae5,verdict:refused,reasons:[not_quiescent,not_quiescent],endedAt:2026-11-19T08:58:31.988Z},{verificationId:vfy_e1330315-7fc8-4124-ba79-d2e9ab8935af,verdict:fail,reasons:[],endedAt:2026-11-19T08:59:01.063Z},{verificationId:vfy_6c5b8109-008d-4927-8749-48aec4306b9c,verdict:refused,reasons:[not_quiescent,not_quiescent],endedAt:2026-11-19T08:59:12.146Z},{verificationId:vfy_8cf7d291-bb3c-47ab-8e3e-ed9ff9d58d6a,verdict:fail,reasons:[],endedAt:2026-11-19T08:59:31.381Z},{verificationId:vfy_08db048c-c7c3-4b6f-8eca-90ae750121ac,verdict:fail,reasons:[],endedAt:2026-11-19T08:59:34.746Z},{verificationId:vfy_782a1a53-50b5-41c6-b8e7-ee38c83425fc,verdict:fail,reasons:[],endedAt:2026-11-19T08:59:38.168Z},{verificationId:vfy_6ee2529e-a489-475f-8e86-da8ea34f19d8,verdict:pass,reasons:[],endedAt:2026-11-19T08:59:57.303Z}],codeChangedSincePrevious:document-reloaded,failsOnSameCode:0}
evidence: {retained:true,tools:[react_get_renders,react_component_cohort,react_list_overrides,react_refresh_events,request_watch_start,request_watch_stop,react_profile_stop,react_error_state]}
startedAt: 2026-11-19T08:59:57.849Z
endedAt: 2026-11-19T08:59:59.761Z
request: {budget:{fiberLimit:250,operationLimit:20000,timeLimitMs:8,targetOperationReserve:4000,targetTimeReserveMs:4,adaptive:true},settle:{quietMs:500,timeoutMs:10000},maxDurationMs:300000,allowOverrides:false}
[exit 0]

$ agent-browser --session upd-a eval "JSON.stringify({pressed: document.querySelector('[aria-label=\"Date range\"] [aria-pressed=true]').textContent, chartRange: document.querySelector('.bar-chart').dataset.range, bars: document.querySelectorAll('.bar-chart__bar').length})"
"{\"pressed\":\"Last 7 days\",\"chartRange\":\"7d\",\"bars\":7}"
[exit 0]

$ agent-browser --session upd-a open http://127.0.0.1:5231/reports
✓ Acme Tracker
  http://127.0.0.1:5231/reports
[exit 0]

$ agent-browser --session upd-a wait .bar-chart
✓ Done
[exit 0]

$ npx genie-react verify begin --session upd-a --name 'switch 90d then 7d' --claim 'render ThroughputWidget max 3' --claim 'render ReportRangePicker min 1' --claim 'boundaries clean'
recording vfy_882f28ce-cf99-4dc8-9840-e11d8239be47 "switch 90d then 7d"
  url "http://127.0.0.1:5231/reports"
  1 recording render ThroughputWidget max 3
  2 recording render ReportRangePicker min 1
  3 recording boundaries clean
window: {observationId:observation:1,startDocumentCommitId:17,domains:[react,network],quietMs:500,timeoutMs:10000,tailMs:500}
next: $ npx genie-react verify end vfy_882f28ce-cf99-4dc8-9840-e11d8239be47 --session upd-a
session: {sessionId:b98921d2-11be-46c9-97cf-5fca244c6c1b,logicalSessionId:c2bb8a8e-e0ef-46a5-a676-b347282a2d7f,documentGeneration:18}
schemaVersion: "1.0"
targets: [{target:{component:ThroughputWidget},status:resolved,instances:1,source:~/.t3/worktrees/genie-react/t3-30e9ccc5-7f0438b9817ce5ab/apps/realworld-legacy/src/features/reports/reports-page.tsx},{target:{component:ReportRangePicker},status:resolved,instances:1,source:~/.t3/worktrees/genie-react/t3-30e9ccc5-7f0438b9817ce5ab/apps/realworld-legacy/src/features/reports/report-range-picker.tsx}]
startedAt: 2026-11-19T09:00:00.312Z
expiresAt: 2026-11-19T09:05:00.322Z
request: {budget:{fiberLimit:250,operationLimit:20000,timeLimitMs:8,targetOperationReserve:4000,targetTimeReserveMs:4,adaptive:true},settle:{quietMs:500,timeoutMs:10000},maxDurationMs:300000,allowOverrides:false}
[exit 0]

$ agent-browser --session upd-a find role button click --name 'Last 90 days' && agent-browser --session upd-a find role button click --name 'Last 7 days'
✓ Done
✓ Done
[exit 0]

$ npx genie-react verify end vfy_882f28ce-cf99-4dc8-9840-e11d8239be47 --session upd-a
pass vfy_882f28ce-cf99-4dc8-9840-e11d8239be47 "switch 90d then 7d"  7 commits, quiet after 1090 ms (react, network)
  url "http://127.0.0.1:5231/reports"
  1 pass render ThroughputWidget max 3  {renders:3,mounts:0,updates:3,remounts:0,semantics:exact,instances:1,activeInstances:1}
      claim: {kind:renders,target:{component:ThroughputWidget},max:3,counting:renders,allowRemount:false}
      deciding: [{kind:coverage,complete:true,targetedComplete:true,semantics:exact},{kind:instance,mountId:mount:1,renderingState:mounted-rendering,source:~/.t3/worktrees/genie-react/t3-30e9ccc5-7f0438b9817ce5ab/apps/realworld-legacy/src/features/reports/reports-page.tsx:59:32}]
  2 pass render ReportRangePicker min 1  {renders:2,mounts:0,updates:2,remounts:0,semantics:exact,instances:1,activeInstances:1}
      claim: {kind:renders,target:{component:ReportRangePicker},min:1,counting:renders,allowRemount:false}
      deciding: [{kind:instance,mountId:mount:2,renders:2,mounts:0,updates:2,mountGeneration:1,latestDocumentCommitId:21,source:~/.t3/worktrees/genie-react/t3-30e9ccc5-7f0438b9817ce5ab/apps/realworld-legacy/src/features/reports/report-range-picker.tsx:23:7}]
  3 pass boundaries clean  {caughtDuringWindow:0,caughtAtEnd:0}
      claim: {kind:boundaries-clean,scope:window}
      deciding: [{kind:boundary-log,scope:window,complete:true,afterDocumentCommitId:17}]
      caveats: [uncaught-errors-outside-boundaries-unobserved]
window: {observationId:observation:1,startDocumentCommitId:17,settledDocumentCommitId:23,frozenDocumentCommitId:24,commits:7,settle:{outcome:met,quietMs:500,timeoutMs:10000,waitedMs:1090,domains:{react:met,network:met}},tail:{ms:500,commits:1},environment:{bundle:development,strictMode:on,renderCollection:available,visibility:unavailable}}
! ui-outcome-not-observed: Genie does not check the screen; confirm it with the UI driver
! visibility-unobserved: the app reports no visibility signal, so a hidden interval was not observed
attempt 13 for these claims on this tab; previous pass vfy_20c20d7d-15d7-41f8-bbf2-5218a27b9a35; document reloaded since
evidence: $ npx genie-react verify show vfy_882f28ce-cf99-4dc8-9840-e11d8239be47 --session upd-a
session: {sessionId:b98921d2-11be-46c9-97cf-5fca244c6c1b,logicalSessionId:c2bb8a8e-e0ef-46a5-a676-b347282a2d7f,documentGeneration:18}
schemaVersion: "1.0"
exitCode: 0
stage: end
ledger: {fingerprint:cf_1c6b0a4e5c53,scope:logical-session,storage:memory,attempt:13,history:[{verificationId:vfy_a26e2a05-6078-402a-8e88-73fd0651d782,verdict:fail,reasons:[],endedAt:2026-11-19T08:57:28.362Z},{verificationId:vfy_40446178-f5d3-4778-87da-43304dccf9d0,verdict:fail,reasons:[],endedAt:2026-11-19T08:58:06.226Z},{verificationId:vfy_35f47e8b-d3d5-4439-b119-cfdcb5afe58f,verdict:fail,reasons:[],endedAt:2026-11-19T08:58:09.757Z},{verificationId:vfy_a6e85c4a-ce93-4411-8e8b-55bbb422cbd3,verdict:pass,reasons:[],endedAt:2026-11-19T08:58:17.737Z},{verificationId:vfy_1a81b598-70d1-49fb-90ff-8d47c23aaae5,verdict:refused,reasons:[not_quiescent,not_quiescent],endedAt:2026-11-19T08:58:31.988Z},{verificationId:vfy_e1330315-7fc8-4124-ba79-d2e9ab8935af,verdict:fail,reasons:[],endedAt:2026-11-19T08:59:01.063Z},{verificationId:vfy_6c5b8109-008d-4927-8749-48aec4306b9c,verdict:refused,reasons:[not_quiescent,not_quiescent],endedAt:2026-11-19T08:59:12.146Z},{verificationId:vfy_8cf7d291-bb3c-47ab-8e3e-ed9ff9d58d6a,verdict:fail,reasons:[],endedAt:2026-11-19T08:59:31.381Z},{verificationId:vfy_08db048c-c7c3-4b6f-8eca-90ae750121ac,verdict:fail,reasons:[],endedAt:2026-11-19T08:59:34.746Z},{verificationId:vfy_782a1a53-50b5-41c6-b8e7-ee38c83425fc,verdict:fail,reasons:[],endedAt:2026-11-19T08:59:38.168Z},{verificationId:vfy_6ee2529e-a489-475f-8e86-da8ea34f19d8,verdict:pass,reasons:[],endedAt:2026-11-19T08:59:57.303Z},{verificationId:vfy_20c20d7d-15d7-41f8-bbf2-5218a27b9a35,verdict:pass,reasons:[],endedAt:2026-11-19T08:59:59.761Z}],codeChangedSincePrevious:document-reloaded,failsOnSameCode:0}
evidence: {retained:true,tools:[react_get_renders,react_component_cohort,react_list_overrides,react_refresh_events,request_watch_start,request_watch_stop,react_profile_stop,react_error_state]}
startedAt: 2026-11-19T09:00:00.312Z
endedAt: 2026-11-19T09:00:02.201Z
request: {budget:{fiberLimit:250,operationLimit:20000,timeLimitMs:8,targetOperationReserve:4000,targetTimeReserveMs:4,adaptive:true},settle:{quietMs:500,timeoutMs:10000},maxDurationMs:300000,allowOverrides:false}
[exit 0]

$ agent-browser --session upd-a eval "JSON.stringify({pressed: document.querySelector('[aria-label=\"Date range\"] [aria-pressed=true]').textContent, chartRange: document.querySelector('.bar-chart').dataset.range, bars: document.querySelectorAll('.bar-chart__bar').length})"
"{\"pressed\":\"Last 7 days\",\"chartRange\":\"7d\",\"bars\":7}"
[exit 0]

## verify after fix, 90d latency 5000 ms, request watch on

$ npx genie-react call app_backend_faults '{"rules":[{"method":"GET","path":"/api/reports/throughput","query":{"range":"90d"},"latencyMs":5000}]}' --session upd-a
rules[1]:
  - {method:GET,path:/api/reports/throughput,query:{range:90d},latencyMs:5000,status:null,times:null,hits:0}
[exit 0]

$ agent-browser --session upd-a open http://127.0.0.1:5231/reports
✓ Acme Tracker
  http://127.0.0.1:5231/reports
[exit 0]

$ agent-browser --session upd-a wait .bar-chart
✓ Done
[exit 0]

$ npx genie-react verify begin --session upd-a --name 'switch 90d then 7d' --claim 'render ThroughputWidget max 3' --claim 'render ReportRangePicker min 1' --claim 'boundaries clean'
recording vfy_cbe487c4-c895-4a14-9ea7-5f760bb4b800 "switch 90d then 7d"
  url "http://127.0.0.1:5231/reports"
  1 recording render ThroughputWidget max 3
  2 recording render ReportRangePicker min 1
  3 recording boundaries clean
window: {observationId:observation:1,startDocumentCommitId:17,domains:[react,network],quietMs:500,timeoutMs:10000,tailMs:500}
next: $ npx genie-react verify end vfy_cbe487c4-c895-4a14-9ea7-5f760bb4b800 --session upd-a
session: {sessionId:bf3b434b-654a-400f-8630-c2a795ddf370,logicalSessionId:c2bb8a8e-e0ef-46a5-a676-b347282a2d7f,documentGeneration:19}
schemaVersion: "1.0"
targets: [{target:{component:ThroughputWidget},status:resolved,instances:1,source:~/.t3/worktrees/genie-react/t3-30e9ccc5-7f0438b9817ce5ab/apps/realworld-legacy/src/features/reports/reports-page.tsx},{target:{component:ReportRangePicker},status:resolved,instances:1,source:~/.t3/worktrees/genie-react/t3-30e9ccc5-7f0438b9817ce5ab/apps/realworld-legacy/src/features/reports/report-range-picker.tsx}]
startedAt: 2026-11-19T09:00:10.892Z
expiresAt: 2026-11-19T09:05:10.902Z
request: {budget:{fiberLimit:250,operationLimit:20000,timeLimitMs:8,targetOperationReserve:4000,targetTimeReserveMs:4,adaptive:true},settle:{quietMs:500,timeoutMs:10000},maxDurationMs:300000,allowOverrides:false}
[exit 0]

$ agent-browser --session upd-a find role button click --name 'Last 90 days' && agent-browser --session upd-a find role button click --name 'Last 7 days'
✓ Done
✓ Done
[exit 0]

$ npx genie-react verify end vfy_cbe487c4-c895-4a14-9ea7-5f760bb4b800 --session upd-a
pass vfy_cbe487c4-c895-4a14-9ea7-5f760bb4b800 "switch 90d then 7d"  11 commits, quiet after 5071 ms (react, network)
  url "http://127.0.0.1:5231/reports"
  1 pass render ThroughputWidget max 3  {renders:3,mounts:0,updates:3,remounts:0,semantics:exact,instances:1,activeInstances:1}
      claim: {kind:renders,target:{component:ThroughputWidget},max:3,counting:renders,allowRemount:false}
      deciding: [{kind:coverage,complete:true,targetedComplete:true,semantics:exact},{kind:instance,mountId:mount:1,renderingState:mounted-rendering,source:~/.t3/worktrees/genie-react/t3-30e9ccc5-7f0438b9817ce5ab/apps/realworld-legacy/src/features/reports/reports-page.tsx:59:32}]
  2 pass render ReportRangePicker min 1  {renders:2,mounts:0,updates:2,remounts:0,semantics:exact,instances:1,activeInstances:1}
      claim: {kind:renders,target:{component:ReportRangePicker},min:1,counting:renders,allowRemount:false}
      deciding: [{kind:instance,mountId:mount:2,renders:2,mounts:0,updates:2,mountGeneration:1,latestDocumentCommitId:21,source:~/.t3/worktrees/genie-react/t3-30e9ccc5-7f0438b9817ce5ab/apps/realworld-legacy/src/features/reports/report-range-picker.tsx:23:7}]
  3 pass boundaries clean  {caughtDuringWindow:0,caughtAtEnd:0}
      claim: {kind:boundaries-clean,scope:window}
      deciding: [{kind:boundary-log,scope:window,complete:true,afterDocumentCommitId:17}]
      caveats: [uncaught-errors-outside-boundaries-unobserved]
window: {observationId:observation:1,startDocumentCommitId:17,settledDocumentCommitId:27,frozenDocumentCommitId:28,commits:11,settle:{outcome:met,quietMs:500,timeoutMs:10000,waitedMs:5071,domains:{react:met,network:met}},tail:{ms:500,commits:1},environment:{bundle:development,strictMode:on,renderCollection:available,visibility:unavailable}}
! ui-outcome-not-observed: Genie does not check the screen; confirm it with the UI driver
! visibility-unobserved: the app reports no visibility signal, so a hidden interval was not observed
attempt 14 for these claims on this tab; previous pass vfy_882f28ce-cf99-4dc8-9840-e11d8239be47; document reloaded since
evidence: $ npx genie-react verify show vfy_cbe487c4-c895-4a14-9ea7-5f760bb4b800 --session upd-a
session: {sessionId:bf3b434b-654a-400f-8630-c2a795ddf370,logicalSessionId:c2bb8a8e-e0ef-46a5-a676-b347282a2d7f,documentGeneration:19}
schemaVersion: "1.0"
exitCode: 0
stage: end
ledger: {fingerprint:cf_1c6b0a4e5c53,scope:logical-session,storage:memory,attempt:14,history:[{verificationId:vfy_a26e2a05-6078-402a-8e88-73fd0651d782,verdict:fail,reasons:[],endedAt:2026-11-19T08:57:28.362Z},{verificationId:vfy_40446178-f5d3-4778-87da-43304dccf9d0,verdict:fail,reasons:[],endedAt:2026-11-19T08:58:06.226Z},{verificationId:vfy_35f47e8b-d3d5-4439-b119-cfdcb5afe58f,verdict:fail,reasons:[],endedAt:2026-11-19T08:58:09.757Z},{verificationId:vfy_a6e85c4a-ce93-4411-8e8b-55bbb422cbd3,verdict:pass,reasons:[],endedAt:2026-11-19T08:58:17.737Z},{verificationId:vfy_1a81b598-70d1-49fb-90ff-8d47c23aaae5,verdict:refused,reasons:[not_quiescent,not_quiescent],endedAt:2026-11-19T08:58:31.988Z},{verificationId:vfy_e1330315-7fc8-4124-ba79-d2e9ab8935af,verdict:fail,reasons:[],endedAt:2026-11-19T08:59:01.063Z},{verificationId:vfy_6c5b8109-008d-4927-8749-48aec4306b9c,verdict:refused,reasons:[not_quiescent,not_quiescent],endedAt:2026-11-19T08:59:12.146Z},{verificationId:vfy_8cf7d291-bb3c-47ab-8e3e-ed9ff9d58d6a,verdict:fail,reasons:[],endedAt:2026-11-19T08:59:31.381Z},{verificationId:vfy_08db048c-c7c3-4b6f-8eca-90ae750121ac,verdict:fail,reasons:[],endedAt:2026-11-19T08:59:34.746Z},{verificationId:vfy_782a1a53-50b5-41c6-b8e7-ee38c83425fc,verdict:fail,reasons:[],endedAt:2026-11-19T08:59:38.168Z},{verificationId:vfy_6ee2529e-a489-475f-8e86-da8ea34f19d8,verdict:pass,reasons:[],endedAt:2026-11-19T08:59:57.303Z},{verificationId:vfy_20c20d7d-15d7-41f8-bbf2-5218a27b9a35,verdict:pass,reasons:[],endedAt:2026-11-19T08:59:59.761Z},{verificationId:vfy_882f28ce-cf99-4dc8-9840-e11d8239be47,verdict:pass,reasons:[],endedAt:2026-11-19T09:00:02.201Z}],codeChangedSincePrevious:document-reloaded,failsOnSameCode:0}
evidence: {retained:true,tools:[react_get_renders,react_component_cohort,react_list_overrides,react_refresh_events,request_watch_start,request_watch_stop,react_profile_stop,react_error_state]}
startedAt: 2026-11-19T09:00:10.892Z
endedAt: 2026-11-19T09:00:16.765Z
request: {budget:{fiberLimit:250,operationLimit:20000,timeLimitMs:8,targetOperationReserve:4000,targetTimeReserveMs:4,adaptive:true},settle:{quietMs:500,timeoutMs:10000},maxDurationMs:300000,allowOverrides:false}
[exit 0]

$ agent-browser --session upd-a eval "JSON.stringify({pressed: document.querySelector('[aria-label=\"Date range\"] [aria-pressed=true]').textContent, chartRange: document.querySelector('.bar-chart').dataset.range, bars: document.querySelectorAll('.bar-chart__bar').length})"
"{\"pressed\":\"Last 7 days\",\"chartRange\":\"7d\",\"bars\":7}"
[exit 0]

$ agent-browser --session upd-a wait 5000
✓ Done
[exit 0]

$ agent-browser --session upd-a eval "JSON.stringify({pressed: document.querySelector('[aria-label=\"Date range\"] [aria-pressed=true]').textContent, chartRange: document.querySelector('.bar-chart').dataset.range, bars: document.querySelectorAll('.bar-chart__bar').length})"
"{\"pressed\":\"Last 7 days\",\"chartRange\":\"7d\",\"bars\":7}"
[exit 0]

## after fix: timeline + redux_actions, 90d latency 1200 ms

$ npx genie-react call app_backend_faults '{"rules":[{"method":"GET","path":"/api/reports/throughput","query":{"range":"90d"},"latencyMs":1200}]}' --session upd-a
rules[1]:
  - {method:GET,path:/api/reports/throughput,query:{range:90d},latencyMs:1200,status:null,times:null,hits:0}
[exit 0]

$ agent-browser --session upd-a open http://127.0.0.1:5231/reports
✓ Acme Tracker
  http://127.0.0.1:5231/reports
[exit 0]

$ agent-browser --session upd-a wait .bar-chart
✓ Done
[exit 0]

$ npx genie-react call redux_actions '{"limit":1}' --session upd-a --json | jq .latestSequence
146
[exit 0]

$ npx genie-react call timeline_start '{"name":"range switch after fix","queryValues":"plain"}' --session upd-a --json
{"id":"timeline-8d0806a0-2c0d-4e17-a093-6118ec2f11de","name":"range switch after fix","state":"recording","stopReason":null,"durationMs":0.3,"maxEvents":1000,"maxDurationMs":30000,"eventCount":0,"truncated":false,"correlation":"temporal-only","clock":"performance.now","ordering":"observation-time-then-sequence","coverage":{"request":{"status":"available","code":"resource-timing-and-fetch","detail":"Fetch/XHR Resource Timing joined with the app's fetch and XMLHttpRequest calls made during the recording, which add method, outcome (including an abort after the response headers), when the app finished reading the body, and requests still in flight at stop. A request the app sent through a fetch reference captured before recording has method null. Requests seen only through those calls, and requests still in flight, are added when the recording stops. Requests started before recording may appear without a method. Worker and non-fetch/XHR requests are absent. Cross-origin detailed timing and responseReceived require Timing-Allow-Origin. URLs omit credentials and fragments; query parameter values are salted hashes unless queryValues is plain."},"query":{"status":"unavailable","code":"no-query-client","detail":"No QueryClient supplied. Only the supplied QueryCache is observed."},"react":{"status":"available","code":"react-root-commits","detail":"Supported development React root commits; hook must precede React. renderDurationMs is root actualDuration when positive, otherwise null with renderDurationUnavailable saying why; not commit wall time, native UI timing, effects or component attribution. No Fiber tree traversal."},"navigation":{"status":"unavailable","code":"no-tanstack-router","detail":"No TanStack Router supplied; other routers and native navigation are not observed."}},"queryValues":"plain","genieRequestsExcluded":0}
[exit 0]

$ agent-browser --session upd-a find role button click --name 'Last 90 days' && agent-browser --session upd-a find role button click --name 'Last 7 days'
✓ Done
✓ Done
[exit 0]

$ agent-browser --session upd-a wait 2000
✓ Done
[exit 0]

$ npx genie-react call react_quiesce '{"idleMs":500,"timeoutMs":10000}' --fail-on-result-error --session upd-a --fields outcome
[1]:
  - {outcome:idle}
[exit 0]

$ npx genie-react call timeline_stop '{"id":"timeline-8d0806a0-2c0d-4e17-a093-6118ec2f11de"}' --session upd-a --fields stopReason,eventCount,truncated
[1]:
  - {stopReason:manual,eventCount:14,truncated:false}
[exit 0]

$ npx genie-react call timeline_read '{"id":"timeline-8d0806a0-2c0d-4e17-a093-6118ec2f11de","domains":["request"]}' --session upd-a --fields atMs,details
[6]:
  each: {details:{initiatorType:fetch,startedBeforeRecording:false,detailedTimingAvailable:true,responseStatus:200,responseReceived:true,method:GET,outcome:response,overlappingSameEndpoint:1}}
  - {atMs:96.6,details:{url:http://127.0.0.1:5231/api/reports/cycle-time,query:"?project=CORE&range=90d",startMs:33.5,endMs:95.8,durationMs:62.3,bodyReadMs:96.2,finishedAfterNewer:false,bodyReadLast:false}}
  - {atMs:96.6,details:{url:http://127.0.0.1:5231/api/reports/workload,query:"?project=CORE",startMs:33.5,endMs:96,durationMs:62.5,bodyReadMs:96.6,finishedAfterNewer:false,bodyReadLast:false}}
  - {atMs:129.3,details:{url:http://127.0.0.1:5231/api/reports/throughput,query:"?project=CORE&range=7d",startMs:66.6,endMs:128.8,durationMs:62.2,bodyReadMs:129.2,finishedAfterNewer:false,bodyReadLast:false}}
  - {atMs:129.3,details:{url:http://127.0.0.1:5231/api/reports/cycle-time,query:"?project=CORE&range=7d",startMs:66.7,endMs:128.9,durationMs:62.2,bodyReadMs:129.3,finishedAfterNewer:false,bodyReadLast:true}}
  - {atMs:161,details:{url:http://127.0.0.1:5231/api/reports/workload,query:"?project=CORE",startMs:66.7,endMs:157.1,durationMs:90.4,bodyReadMs:157.3,finishedAfterNewer:false,bodyReadLast:true}}
  - {atMs:1296.7,details:{url:http://127.0.0.1:5231/api/reports/throughput,query:"?project=CORE&range=90d",startMs:33.4,endMs:1296.1,durationMs:1262.7,bodyReadMs:1296.6,finishedAfterNewer:true,bodyReadLast:true}}
[exit 0]

$ npx genie-react call redux_actions '{"afterSequence":146,"typePrefix":"reports/","view":"full"}' --session upd-a --json | jq -c '{matched, records: [.records[] | {sequence, type, parentActionId, range: .payload.range, throughputRange: .payload.throughput.range}]}'
{"matched":3,"records":[{"sequence":148,"type":"reports/REQUESTED","parentActionId":"redux-store:1/action:147","range":"90d","throughputRange":null},{"sequence":166,"type":"reports/REQUESTED","parentActionId":"redux-store:1/action:165","range":"7d","throughputRange":null},{"sequence":183,"type":"reports/RECEIVED","parentActionId":"redux-store:1/action:165","range":null,"throughputRange":"7d"}]}
[exit 0]

$ npx genie-react call redux_state '{"path":["reports","range"]}' --session upd-a --fields value
[1]:
  - {value:7d}
[exit 0]

$ agent-browser --session upd-a eval "JSON.stringify({pressed: document.querySelector('[aria-label=\"Date range\"] [aria-pressed=true]').textContent, chartRange: document.querySelector('.bar-chart').dataset.range, bars: document.querySelectorAll('.bar-chart__bar').length})"
"{\"pressed\":\"Last 7 days\",\"chartRange\":\"7d\",\"bars\":7}"
[exit 0]

## reverted with: git checkout -- src/features/reports/state/actions.ts src/devtools/connect-genie.ts
## before fix again, app as shipped, fresh load, for the article's timeline and Redux sections

$ agent-browser --session upd-a open http://127.0.0.1:5231/reports
✓ Acme Tracker
  http://127.0.0.1:5231/reports
[exit 0]

$ agent-browser --session upd-a wait .bar-chart
✓ Done
[exit 0]

$ npx genie-react call app_backend_faults '{"rules":[{"method":"GET","path":"/api/reports/throughput","query":{"range":"90d"},"latencyMs":1200}]}' --session upd-a
rules[1]:
  - {method:GET,path:/api/reports/throughput,query:{range:90d},latencyMs:1200,status:null,times:null,hits:0}
[exit 0]

$ npx genie-react call redux_actions '{"limit":1}' --session upd-a --select /latestSequence
status: ok
selection:
  expression: /latestSequence
  matchedPathCount: 1
  matchedPaths: [/latestSequence]
  omittedPathCount: 54
result: 146
[exit 0]

$ npx genie-react call timeline_start '{"name":"range switch","queryValues":"plain"}' --session upd-a --json
{"id":"timeline-30f30778-63cc-40a1-8ff1-fc36a7ca66d6","name":"range switch","state":"recording","stopReason":null,"durationMs":0.2,"maxEvents":1000,"maxDurationMs":30000,"eventCount":0,"truncated":false,"correlation":"temporal-only","clock":"performance.now","ordering":"observation-time-then-sequence","coverage":{"request":{"status":"available","code":"resource-timing-and-fetch","detail":"Fetch/XHR Resource Timing joined with the app's fetch and XMLHttpRequest calls made during the recording, which add method, outcome (including an abort after the response headers), when the app finished reading the body, and requests still in flight at stop. A request the app sent through a fetch reference captured before recording has method null. Requests seen only through those calls, and requests still in flight, are added when the recording stops. Requests started before recording may appear without a method. Worker and non-fetch/XHR requests are absent. Cross-origin detailed timing and responseReceived require Timing-Allow-Origin. URLs omit credentials and fragments; query parameter values are salted hashes unless queryValues is plain."},"query":{"status":"unavailable","code":"no-query-client","detail":"No QueryClient supplied. Only the supplied QueryCache is observed."},"react":{"status":"available","code":"react-root-commits","detail":"Supported development React root commits; hook must precede React. renderDurationMs is root actualDuration when positive, otherwise null with renderDurationUnavailable saying why; not commit wall time, native UI timing, effects or component attribution. No Fiber tree traversal."},"navigation":{"status":"unavailable","code":"no-tanstack-router","detail":"No TanStack Router supplied; other routers and native navigation are not observed."}},"queryValues":"plain","genieRequestsExcluded":0}
[exit 0]

$ agent-browser --session upd-a find role button click --name 'Last 90 days' && agent-browser --session upd-a find role button click --name 'Last 7 days'
✓ Done
✓ Done
[exit 0]

$ agent-browser --session upd-a wait 2000
✓ Done
[exit 0]

$ npx genie-react call react_quiesce '{"idleMs":500,"timeoutMs":10000}' --fail-on-result-error --session upd-a --fields outcome,elapsedMs
[1]:
  - {outcome:idle,elapsedMs:641}
[exit 0]

$ npx genie-react call timeline_stop '{"id":"timeline-30f30778-63cc-40a1-8ff1-fc36a7ca66d6"}' --session upd-a --fields stopReason,eventCount,truncated,queryValues
[1]:
  - {stopReason:manual,eventCount:15,truncated:false,queryValues:plain}
[exit 0]

$ npx genie-react call timeline_read '{"id":"timeline-30f30778-63cc-40a1-8ff1-fc36a7ca66d6","domains":["request"]}' --session upd-a --fields atMs,details
[6]:
  each: {details:{initiatorType:fetch,startedBeforeRecording:false,detailedTimingAvailable:true,responseStatus:200,responseReceived:true,method:GET,outcome:response,overlappingSameEndpoint:1}}
  - {atMs:100.2,details:{url:http://127.0.0.1:5231/api/reports/cycle-time,query:"?project=CORE&range=90d",startMs:38,endMs:99.6,durationMs:61.6,bodyReadMs:99.9,finishedAfterNewer:false,bodyReadLast:false}}
  - {atMs:100.2,details:{url:http://127.0.0.1:5231/api/reports/workload,query:"?project=CORE",startMs:38,endMs:99.6,durationMs:61.6,bodyReadMs:100.3,finishedAfterNewer:false,bodyReadLast:false}}
  - {atMs:133.3,details:{url:http://127.0.0.1:5231/api/reports/throughput,query:"?project=CORE&range=7d",startMs:70.8,endMs:133,durationMs:62.2,bodyReadMs:133.3,finishedAfterNewer:false,bodyReadLast:false}}
  - {atMs:133.3,details:{url:http://127.0.0.1:5231/api/reports/cycle-time,query:"?project=CORE&range=7d",startMs:70.8,endMs:133.1,durationMs:62.3,bodyReadMs:133.3,finishedAfterNewer:false,bodyReadLast:true}}
  - {atMs:165.4,details:{url:http://127.0.0.1:5231/api/reports/workload,query:"?project=CORE",startMs:70.8,endMs:160.7,durationMs:89.9,bodyReadMs:160.9,finishedAfterNewer:false,bodyReadLast:true}}
  - {atMs:1312,details:{url:http://127.0.0.1:5231/api/reports/throughput,query:"?project=CORE&range=90d",startMs:37.9,endMs:1301.4,durationMs:1263.5,bodyReadMs:1302.2,finishedAfterNewer:true,bodyReadLast:true}}
[exit 0]

$ agent-browser --session upd-a eval "JSON.stringify({pressed: document.querySelector('[aria-label=\"Date range\"] [aria-pressed=true]').textContent, chartRange: document.querySelector('.bar-chart').dataset.range, bars: document.querySelectorAll('.bar-chart__bar').length})"
"{\"pressed\":\"Last 7 days\",\"chartRange\":\"90d\",\"bars\":13}"
[exit 0]

$ npx genie-react call redux_actions '{"afterSequence":146,"typePrefix":"reports/","view":"full"}' --session upd-a --json | jq -c '{matched, records: [.records[] | {sequence, type, parentActionId, range: .payload.range, throughputRange: .payload.throughput.range, total: .payload.throughput.total}]}'
{"matched":4,"records":[{"sequence":148,"type":"reports/REQUESTED","parentActionId":"redux-store:1/action:147","range":"90d","throughputRange":null,"total":null},{"sequence":166,"type":"reports/REQUESTED","parentActionId":"redux-store:1/action:165","range":"7d","throughputRange":null,"total":null},{"sequence":183,"type":"reports/RECEIVED","parentActionId":"redux-store:1/action:165","range":null,"throughputRange":"7d","total":9},{"sequence":200,"type":"reports/RECEIVED","parentActionId":"redux-store:1/action:147","range":null,"throughputRange":"90d","total":33}]}
[exit 0]

$ npx genie-react call redux_state '{"path":["reports","range"]}' --session upd-a
store: {storeId:redux-store:1,name:app}
path: [reports,range]
found: true
value: 7d
topLevelKeys: [session,ui,projects,issues,board,notifications,search,savedViews,reports,service]
asOfSequence: 216
[exit 0]

$ npx genie-react call react_find_components '{"component":"ThroughputWidget"}' --session upd-a --fields id,name
[1]:
  - {id:11268819779757,name:ThroughputWidget}
[exit 0]

$ npx genie-react call react_inspect_component '{"id":11268819779757}' --session upd-a --select /props
status: ok
selection: {expression:/props,matchedPathCount:1,matchedPaths:[/props],omittedPathCount:7}
result:
  report:
    project: CORE
    range: 90d
    total: 33
    buckets: {__genie_dehydrated__:true,kind:array,preview:"Array(13)",path:[report,buckets],size:13}
[exit 0]

$ npx genie-react call app_backend_faults '{"rules":[]}' --session upd-a
rules: []
[exit 0]
```
