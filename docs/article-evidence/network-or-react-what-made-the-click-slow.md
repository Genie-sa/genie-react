# Evidence: network-or-react-what-made-the-click-slow

Raw evidence for the article at https://genie-react.com/docs/articles/network-or-react-what-made-the-click-slow.

- Date: 2026-11-19 (UTC timestamps in each log header)
- Commit: `6867352ba46ec3998fe8cda0ba915536fddfa666`
- App: `apps/realworld-legacy` (Acme Tracker), dev server `http://127.0.0.1:5223`, standalone Genie hub `ws://127.0.0.1:5224/__genie/ws`, mock API latency at its default of 60 ms, signed in as `dana@acme.test`
- Bug: `issue-table-selector-recompute` from `evals/realworld/legacy/issue-table-selector-recompute.json`. Its reference fix was applied for the "after" runs and reverted with `git checkout -- apps/realworld-legacy`.
- Tools: `genie-react` 1.0.2 (this checkout), `agent-browser` 0.43.0, Google Chrome.

Servers were started from `apps/realworld-legacy` with:

```bash
GENIE_HUB_PORT=5224 pnpm hub
GENIE_HUB_PORT=5224 pnpm exec webpack serve --mode development --port 5223
```

How to read the logs: each `$ ` line is the exact command, followed by its full output. A logging wrapper ran every command and appended `[exit N]`, the shell exit status of the command line. The `timeline_start` line is printed by the wrapper and its JSON output follows. Absolute paths into this checkout are shortened to `<repo>` and the home folder to `~`. Nothing else is edited.

Order of runs: five "Mark all read" timelines, render causes, `verify`, and the row cohort on the shipped code (section 1, first part). Then the fix, the same steps plus three typing timelines (section 2). Then the fix was reverted and three typing timelines ran on the shipped code (section 1, "typing run" parts, appended at the end of that log), followed by one render count while typing ("typing render check") and a check of the notifications button label ("badge check").

## 1. Shipped code (bug present)

~~~~text
# date: 2026-11-19T03:58:58Z
# HEAD: 6867352ba46ec3998fe8cda0ba915536fddfa666
# app: apps/realworld-legacy at http://127.0.0.1:5223 (hub ws://127.0.0.1:5224), shipped code (seeded bug present)
## run 1

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

$ agent-browser --session art-m3 wait '.notifications__count'
✓ Done
[exit 0]

$ agent-browser --session art-m3 click 'button.notifications__trigger'
✓ Done
[exit 0]

$ agent-browser --session art-m3 wait 500
✓ Done
[exit 0]

$ id=$(npx genie-react call timeline_start '{"name":"mark all read"}' --session art-m3 --json | jq -r .id)
{"id":"timeline-2072ae55-bd1d-4ae4-8701-48853c5a0e88","name":"mark all read","state":"recording","stopReason":null,"durationMs":0,"maxEvents":1000,"maxDurationMs":30000,"eventCount":0,"truncated":false,"correlation":"temporal-only","clock":"performance.now","ordering":"observation-time-then-sequence","coverage":{"request":{"status":"available","code":"resource-timing-and-fetch","detail":"Fetch/XHR Resource Timing joined with the app's fetch and XMLHttpRequest calls made during the recording, which add method, outcome (including an abort after the response headers), when the app finished reading the body, and requests still in flight at stop. A request the app sent through a fetch reference captured before recording has method null. Requests seen only through those calls, and requests still in flight, are added when the recording stops. Requests started before recording may appear without a method. Worker and non-fetch/XHR requests are absent. Cross-origin detailed timing and responseReceived require Timing-Allow-Origin. URLs omit credentials and fragments; query parameter values are salted hashes unless queryValues is plain."},"query":{"status":"unavailable","code":"no-query-client","detail":"No QueryClient supplied. Only the supplied QueryCache is observed."},"react":{"status":"available","code":"react-root-commits","detail":"Supported development React root commits; hook must precede React. renderDurationMs is root actualDuration when positive, otherwise null with renderDurationUnavailable saying why; not commit wall time, native UI timing, effects or component attribution. No Fiber tree traversal."},"navigation":{"status":"unavailable","code":"no-tanstack-router","detail":"No TanStack Router supplied; other routers and native navigation are not observed."}},"queryValues":"hashed","genieRequestsExcluded":0}
id=timeline-2072ae55-bd1d-4ae4-8701-48853c5a0e88

$ agent-browser --session art-m3 find text 'Mark all read' click
✓ Done
[exit 0]

$ npx genie-react call react_quiesce '{"idleMs":500,"timeoutMs":10000}' --session art-m3
ok: true
outcome: idle
elapsedMs: 643
observedCommits: 0
documentCommitId: 20
sessionId: 09095b50-fd0e-465d-a480-a042d3d22a40
renderCollection: available
pendingWork:
  documentCommitId: 20
  scheduledRoots: 0
  suspendedBoundaries: 0
  dehydratedBoundaries: 0
  boundaries: []
  scanTruncated: false
  scannedFibers: 2319
[exit 0]

$ npx genie-react call timeline_stop '{"id":"timeline-2072ae55-bd1d-4ae4-8701-48853c5a0e88"}' --session art-m3
id: timeline-2072ae55-bd1d-4ae4-8701-48853c5a0e88
name: "mark all read"
state: stopped
stopReason: manual
durationMs: 1159.1
maxEvents: 1000
maxDurationMs: 30000
eventCount: 3
truncated: false
correlation: temporal-only
clock: performance.now
ordering: observation-time-then-sequence
coverage:
  request: {status:available,code:resource-timing-and-fetch}
  query: {status:unavailable,code:no-query-client}
  react: {status:available,code:react-root-commits}
  navigation: {status:unavailable,code:no-tanstack-router}
queryValues: hashed
genieRequestsExcluded: 22
[exit 0]

$ npx genie-react call timeline_read '{"id":"timeline-2072ae55-bd1d-4ae4-8701-48853c5a0e88"}' --session art-m3
id: timeline-2072ae55-bd1d-4ae4-8701-48853c5a0e88
name: "mark all read"
state: stopped
stopReason: manual
durationMs: 1159.1
maxEvents: 1000
maxDurationMs: 30000
eventCount: 3
truncated: false
correlation: temporal-only
clock: performance.now
ordering: observation-time-then-sequence
coverage:
  request: {status:available,code:resource-timing-and-fetch}
  query: {status:unavailable,code:no-query-client}
  react: {status:available,code:react-root-commits}
  navigation: {status:unavailable,code:no-tanstack-router}
queryValues: hashed
genieRequestsExcluded: 22
events[3] (#sequence atMs domain type {details}):
  #1 94.5 react commit {rendererId:1,renderDurationMs:8.4,renderDurationUnavailable:null,documentCommitId:20}
  #2 95.8 request completed {url:http://127.0.0.1:5223/api/notifications/read,query:null,initiatorType:fetch,startMs:15.5,endMs:78.6,durationMs:63.1,startedBeforeRecording:false,detailedTimingAvailable:true,responseStatus:200,responseReceived:true,method:POST,outcome:response,bodyReadMs:78.9,overlappingSameEndpoint:0,finishedAfterNewer:false,bodyReadLast:null}
  #3 944.9 react commit {rendererId:1,renderDurationMs:0.1,renderDurationUnavailable:null,documentCommitId:21}
matchedEventCount: 3
nextOffset: null
[exit 0]

$ npx genie-react call timeline_read '{"id":"timeline-2072ae55-bd1d-4ae4-8701-48853c5a0e88"}' --session art-m3 --fields domain,type,atMs,details
[3]:
  - {domain:react,type:commit,atMs:94.5,details:{rendererId:1,renderDurationMs:8.4,renderDurationUnavailable:null,documentCommitId:20}}
  - {domain:request,type:completed,atMs:95.8,details:{url:http://127.0.0.1:5223/api/notifications/read,query:null,initiatorType:fetch,startMs:15.5,endMs:78.6,durationMs:63.1,startedBeforeRecording:false,detailedTimingAvailable:true,responseStatus:200,responseReceived:true,method:POST,outcome:response,bodyReadMs:78.9,overlappingSameEndpoint:0,finishedAfterNewer:false,bodyReadLast:null}}
  - {domain:react,type:commit,atMs:944.9,details:{rendererId:1,renderDurationMs:0.1,renderDurationUnavailable:null,documentCommitId:21}}
[exit 0]
## run 2

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

$ agent-browser --session art-m3 wait '.notifications__count'
✓ Done
[exit 0]

$ agent-browser --session art-m3 click 'button.notifications__trigger'
✓ Done
[exit 0]

$ agent-browser --session art-m3 wait 500
✓ Done
[exit 0]

$ id=$(npx genie-react call timeline_start '{"name":"mark all read"}' --session art-m3 --json | jq -r .id)
{"id":"timeline-454fed49-068a-42af-a775-db8f1edb8376","name":"mark all read","state":"recording","stopReason":null,"durationMs":0.2,"maxEvents":1000,"maxDurationMs":30000,"eventCount":0,"truncated":false,"correlation":"temporal-only","clock":"performance.now","ordering":"observation-time-then-sequence","coverage":{"request":{"status":"available","code":"resource-timing-and-fetch","detail":"Fetch/XHR Resource Timing joined with the app's fetch and XMLHttpRequest calls made during the recording, which add method, outcome (including an abort after the response headers), when the app finished reading the body, and requests still in flight at stop. A request the app sent through a fetch reference captured before recording has method null. Requests seen only through those calls, and requests still in flight, are added when the recording stops. Requests started before recording may appear without a method. Worker and non-fetch/XHR requests are absent. Cross-origin detailed timing and responseReceived require Timing-Allow-Origin. URLs omit credentials and fragments; query parameter values are salted hashes unless queryValues is plain."},"query":{"status":"unavailable","code":"no-query-client","detail":"No QueryClient supplied. Only the supplied QueryCache is observed."},"react":{"status":"available","code":"react-root-commits","detail":"Supported development React root commits; hook must precede React. renderDurationMs is root actualDuration when positive, otherwise null with renderDurationUnavailable saying why; not commit wall time, native UI timing, effects or component attribution. No Fiber tree traversal."},"navigation":{"status":"unavailable","code":"no-tanstack-router","detail":"No TanStack Router supplied; other routers and native navigation are not observed."}},"queryValues":"hashed","genieRequestsExcluded":0}
id=timeline-454fed49-068a-42af-a775-db8f1edb8376

$ agent-browser --session art-m3 find text 'Mark all read' click
✓ Done
[exit 0]

$ npx genie-react call react_quiesce '{"idleMs":500,"timeoutMs":10000}' --session art-m3
ok: true
outcome: idle
elapsedMs: 649
observedCommits: 0
documentCommitId: 20
sessionId: 49b6ac71-c366-4b08-a420-5f5ad6269ba0
renderCollection: available
pendingWork:
  documentCommitId: 20
  scheduledRoots: 0
  suspendedBoundaries: 0
  dehydratedBoundaries: 0
  boundaries: []
  scanTruncated: false
  scannedFibers: 2319
[exit 0]

$ npx genie-react call timeline_stop '{"id":"timeline-454fed49-068a-42af-a775-db8f1edb8376"}' --session art-m3
id: timeline-454fed49-068a-42af-a775-db8f1edb8376
name: "mark all read"
state: stopped
stopReason: manual
durationMs: 1198.2
maxEvents: 1000
maxDurationMs: 30000
eventCount: 3
truncated: false
correlation: temporal-only
clock: performance.now
ordering: observation-time-then-sequence
coverage:
  request: {status:available,code:resource-timing-and-fetch}
  query: {status:unavailable,code:no-query-client}
  react: {status:available,code:react-root-commits}
  navigation: {status:unavailable,code:no-tanstack-router}
queryValues: hashed
genieRequestsExcluded: 22
[exit 0]

$ npx genie-react call timeline_read '{"id":"timeline-454fed49-068a-42af-a775-db8f1edb8376"}' --session art-m3
id: timeline-454fed49-068a-42af-a775-db8f1edb8376
name: "mark all read"
state: stopped
stopReason: manual
durationMs: 1198.2
maxEvents: 1000
maxDurationMs: 30000
eventCount: 3
truncated: false
correlation: temporal-only
clock: performance.now
ordering: observation-time-then-sequence
coverage:
  request: {status:available,code:resource-timing-and-fetch}
  query: {status:unavailable,code:no-query-client}
  react: {status:available,code:react-root-commits}
  navigation: {status:unavailable,code:no-tanstack-router}
queryValues: hashed
genieRequestsExcluded: 22
events[3] (#sequence atMs domain type {details}):
  #1 91.9 react commit {rendererId:1,renderDurationMs:8.3,renderDurationUnavailable:null,documentCommitId:20}
  #2 93.2 request completed {url:http://127.0.0.1:5223/api/notifications/read,query:null,initiatorType:fetch,startMs:13.9,endMs:76.6,durationMs:62.7,startedBeforeRecording:false,detailedTimingAvailable:true,responseStatus:200,responseReceived:true,method:POST,outcome:response,bodyReadMs:76.9,overlappingSameEndpoint:0,finishedAfterNewer:false,bodyReadLast:null}
  #3 946 react commit {rendererId:1,renderDurationMs:0.2,renderDurationUnavailable:null,documentCommitId:21}
matchedEventCount: 3
nextOffset: null
[exit 0]

$ npx genie-react call timeline_read '{"id":"timeline-454fed49-068a-42af-a775-db8f1edb8376"}' --session art-m3 --fields domain,type,atMs,details
[3]:
  - {domain:react,type:commit,atMs:91.9,details:{rendererId:1,renderDurationMs:8.3,renderDurationUnavailable:null,documentCommitId:20}}
  - {domain:request,type:completed,atMs:93.2,details:{url:http://127.0.0.1:5223/api/notifications/read,query:null,initiatorType:fetch,startMs:13.9,endMs:76.6,durationMs:62.7,startedBeforeRecording:false,detailedTimingAvailable:true,responseStatus:200,responseReceived:true,method:POST,outcome:response,bodyReadMs:76.9,overlappingSameEndpoint:0,finishedAfterNewer:false,bodyReadLast:null}}
  - {domain:react,type:commit,atMs:946,details:{rendererId:1,renderDurationMs:0.2,renderDurationUnavailable:null,documentCommitId:21}}
[exit 0]
## run 3

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

$ agent-browser --session art-m3 wait '.notifications__count'
✓ Done
[exit 0]

$ agent-browser --session art-m3 click 'button.notifications__trigger'
✓ Done
[exit 0]

$ agent-browser --session art-m3 wait 500
✓ Done
[exit 0]

$ id=$(npx genie-react call timeline_start '{"name":"mark all read"}' --session art-m3 --json | jq -r .id)
{"id":"timeline-df2e1759-4a53-41fb-bbcf-fce54c119f7f","name":"mark all read","state":"recording","stopReason":null,"durationMs":0,"maxEvents":1000,"maxDurationMs":30000,"eventCount":0,"truncated":false,"correlation":"temporal-only","clock":"performance.now","ordering":"observation-time-then-sequence","coverage":{"request":{"status":"available","code":"resource-timing-and-fetch","detail":"Fetch/XHR Resource Timing joined with the app's fetch and XMLHttpRequest calls made during the recording, which add method, outcome (including an abort after the response headers), when the app finished reading the body, and requests still in flight at stop. A request the app sent through a fetch reference captured before recording has method null. Requests seen only through those calls, and requests still in flight, are added when the recording stops. Requests started before recording may appear without a method. Worker and non-fetch/XHR requests are absent. Cross-origin detailed timing and responseReceived require Timing-Allow-Origin. URLs omit credentials and fragments; query parameter values are salted hashes unless queryValues is plain."},"query":{"status":"unavailable","code":"no-query-client","detail":"No QueryClient supplied. Only the supplied QueryCache is observed."},"react":{"status":"available","code":"react-root-commits","detail":"Supported development React root commits; hook must precede React. renderDurationMs is root actualDuration when positive, otherwise null with renderDurationUnavailable saying why; not commit wall time, native UI timing, effects or component attribution. No Fiber tree traversal."},"navigation":{"status":"unavailable","code":"no-tanstack-router","detail":"No TanStack Router supplied; other routers and native navigation are not observed."}},"queryValues":"hashed","genieRequestsExcluded":0}
id=timeline-df2e1759-4a53-41fb-bbcf-fce54c119f7f

$ agent-browser --session art-m3 find text 'Mark all read' click
✓ Done
[exit 0]

$ npx genie-react call react_quiesce '{"idleMs":500,"timeoutMs":10000}' --session art-m3
ok: true
outcome: idle
elapsedMs: 633
observedCommits: 0
documentCommitId: 20
sessionId: d330472e-3dde-4e9d-8484-0158c0728713
renderCollection: available
pendingWork:
  documentCommitId: 20
  scheduledRoots: 0
  suspendedBoundaries: 0
  dehydratedBoundaries: 0
  boundaries: []
  scanTruncated: false
  scannedFibers: 2319
[exit 0]

$ npx genie-react call timeline_stop '{"id":"timeline-df2e1759-4a53-41fb-bbcf-fce54c119f7f"}' --session art-m3
id: timeline-df2e1759-4a53-41fb-bbcf-fce54c119f7f
name: "mark all read"
state: stopped
stopReason: manual
durationMs: 1134.5
maxEvents: 1000
maxDurationMs: 30000
eventCount: 3
truncated: false
correlation: temporal-only
clock: performance.now
ordering: observation-time-then-sequence
coverage:
  request: {status:available,code:resource-timing-and-fetch}
  query: {status:unavailable,code:no-query-client}
  react: {status:available,code:react-root-commits}
  navigation: {status:unavailable,code:no-tanstack-router}
queryValues: hashed
genieRequestsExcluded: 22
[exit 0]

$ npx genie-react call timeline_read '{"id":"timeline-df2e1759-4a53-41fb-bbcf-fce54c119f7f"}' --session art-m3
id: timeline-df2e1759-4a53-41fb-bbcf-fce54c119f7f
name: "mark all read"
state: stopped
stopReason: manual
durationMs: 1134.5
maxEvents: 1000
maxDurationMs: 30000
eventCount: 3
truncated: false
correlation: temporal-only
clock: performance.now
ordering: observation-time-then-sequence
coverage:
  request: {status:available,code:resource-timing-and-fetch}
  query: {status:unavailable,code:no-query-client}
  react: {status:available,code:react-root-commits}
  navigation: {status:unavailable,code:no-tanstack-router}
queryValues: hashed
genieRequestsExcluded: 22
events[3] (#sequence atMs domain type {details}):
  #1 92.9 react commit {rendererId:1,renderDurationMs:8.4,renderDurationUnavailable:null,documentCommitId:20}
  #2 94.1 request completed {url:http://127.0.0.1:5223/api/notifications/read,query:null,initiatorType:fetch,startMs:14.6,endMs:77.1,durationMs:62.5,startedBeforeRecording:false,detailedTimingAvailable:true,responseStatus:200,responseReceived:true,method:POST,outcome:response,bodyReadMs:77.3,overlappingSameEndpoint:0,finishedAfterNewer:false,bodyReadLast:null}
  #3 940.1 react commit {rendererId:1,renderDurationMs:0.1,renderDurationUnavailable:null,documentCommitId:21}
matchedEventCount: 3
nextOffset: null
[exit 0]

$ npx genie-react call timeline_read '{"id":"timeline-df2e1759-4a53-41fb-bbcf-fce54c119f7f"}' --session art-m3 --fields domain,type,atMs,details
[3]:
  - {domain:react,type:commit,atMs:92.9,details:{rendererId:1,renderDurationMs:8.4,renderDurationUnavailable:null,documentCommitId:20}}
  - {domain:request,type:completed,atMs:94.1,details:{url:http://127.0.0.1:5223/api/notifications/read,query:null,initiatorType:fetch,startMs:14.6,endMs:77.1,durationMs:62.5,startedBeforeRecording:false,detailedTimingAvailable:true,responseStatus:200,responseReceived:true,method:POST,outcome:response,bodyReadMs:77.3,overlappingSameEndpoint:0,finishedAfterNewer:false,bodyReadLast:null}}
  - {domain:react,type:commit,atMs:940.1,details:{rendererId:1,renderDurationMs:0.1,renderDurationUnavailable:null,documentCommitId:21}}
[exit 0]
## run 4

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

$ agent-browser --session art-m3 wait '.notifications__count'
✓ Done
[exit 0]

$ agent-browser --session art-m3 click 'button.notifications__trigger'
✓ Done
[exit 0]

$ agent-browser --session art-m3 wait 500
✓ Done
[exit 0]

$ id=$(npx genie-react call timeline_start '{"name":"mark all read"}' --session art-m3 --json | jq -r .id)
{"id":"timeline-b3376a66-1b4a-4465-a74e-355958163cc7","name":"mark all read","state":"recording","stopReason":null,"durationMs":0.1,"maxEvents":1000,"maxDurationMs":30000,"eventCount":0,"truncated":false,"correlation":"temporal-only","clock":"performance.now","ordering":"observation-time-then-sequence","coverage":{"request":{"status":"available","code":"resource-timing-and-fetch","detail":"Fetch/XHR Resource Timing joined with the app's fetch and XMLHttpRequest calls made during the recording, which add method, outcome (including an abort after the response headers), when the app finished reading the body, and requests still in flight at stop. A request the app sent through a fetch reference captured before recording has method null. Requests seen only through those calls, and requests still in flight, are added when the recording stops. Requests started before recording may appear without a method. Worker and non-fetch/XHR requests are absent. Cross-origin detailed timing and responseReceived require Timing-Allow-Origin. URLs omit credentials and fragments; query parameter values are salted hashes unless queryValues is plain."},"query":{"status":"unavailable","code":"no-query-client","detail":"No QueryClient supplied. Only the supplied QueryCache is observed."},"react":{"status":"available","code":"react-root-commits","detail":"Supported development React root commits; hook must precede React. renderDurationMs is root actualDuration when positive, otherwise null with renderDurationUnavailable saying why; not commit wall time, native UI timing, effects or component attribution. No Fiber tree traversal."},"navigation":{"status":"unavailable","code":"no-tanstack-router","detail":"No TanStack Router supplied; other routers and native navigation are not observed."}},"queryValues":"hashed","genieRequestsExcluded":0}
id=timeline-b3376a66-1b4a-4465-a74e-355958163cc7

$ agent-browser --session art-m3 find text 'Mark all read' click
✓ Done
[exit 0]

$ npx genie-react call react_quiesce '{"idleMs":500,"timeoutMs":10000}' --session art-m3
ok: true
outcome: idle
elapsedMs: 629
observedCommits: 0
documentCommitId: 20
sessionId: 6f8b91ef-33e3-493b-9233-ed4aa30094df
renderCollection: available
pendingWork:
  documentCommitId: 20
  scheduledRoots: 0
  suspendedBoundaries: 0
  dehydratedBoundaries: 0
  boundaries: []
  scanTruncated: false
  scannedFibers: 2319
[exit 0]

$ npx genie-react call timeline_stop '{"id":"timeline-b3376a66-1b4a-4465-a74e-355958163cc7"}' --session art-m3
id: timeline-b3376a66-1b4a-4465-a74e-355958163cc7
name: "mark all read"
state: stopped
stopReason: manual
durationMs: 1209.5
maxEvents: 1000
maxDurationMs: 30000
eventCount: 3
truncated: false
correlation: temporal-only
clock: performance.now
ordering: observation-time-then-sequence
coverage:
  request: {status:available,code:resource-timing-and-fetch}
  query: {status:unavailable,code:no-query-client}
  react: {status:available,code:react-root-commits}
  navigation: {status:unavailable,code:no-tanstack-router}
queryValues: hashed
genieRequestsExcluded: 22
[exit 0]

$ npx genie-react call timeline_read '{"id":"timeline-b3376a66-1b4a-4465-a74e-355958163cc7"}' --session art-m3
id: timeline-b3376a66-1b4a-4465-a74e-355958163cc7
name: "mark all read"
state: stopped
stopReason: manual
durationMs: 1209.5
maxEvents: 1000
maxDurationMs: 30000
eventCount: 3
truncated: false
correlation: temporal-only
clock: performance.now
ordering: observation-time-then-sequence
coverage:
  request: {status:available,code:resource-timing-and-fetch}
  query: {status:unavailable,code:no-query-client}
  react: {status:available,code:react-root-commits}
  navigation: {status:unavailable,code:no-tanstack-router}
queryValues: hashed
genieRequestsExcluded: 22
events[3] (#sequence atMs domain type {details}):
  #1 95.4 react commit {rendererId:1,renderDurationMs:8.5,renderDurationUnavailable:null,documentCommitId:20}
  #2 96.7 request completed {url:http://127.0.0.1:5223/api/notifications/read,query:null,initiatorType:fetch,startMs:16.7,endMs:79.7,durationMs:63,startedBeforeRecording:false,detailedTimingAvailable:true,responseStatus:200,responseReceived:true,method:POST,outcome:response,bodyReadMs:80,overlappingSameEndpoint:0,finishedAfterNewer:false,bodyReadLast:null}
  #3 965.7 react commit {rendererId:1,renderDurationMs:0.1,renderDurationUnavailable:null,documentCommitId:21}
matchedEventCount: 3
nextOffset: null
[exit 0]

$ npx genie-react call timeline_read '{"id":"timeline-b3376a66-1b4a-4465-a74e-355958163cc7"}' --session art-m3 --fields domain,type,atMs,details
[3]:
  - {domain:react,type:commit,atMs:95.4,details:{rendererId:1,renderDurationMs:8.5,renderDurationUnavailable:null,documentCommitId:20}}
  - {domain:request,type:completed,atMs:96.7,details:{url:http://127.0.0.1:5223/api/notifications/read,query:null,initiatorType:fetch,startMs:16.7,endMs:79.7,durationMs:63,startedBeforeRecording:false,detailedTimingAvailable:true,responseStatus:200,responseReceived:true,method:POST,outcome:response,bodyReadMs:80,overlappingSameEndpoint:0,finishedAfterNewer:false,bodyReadLast:null}}
  - {domain:react,type:commit,atMs:965.7,details:{rendererId:1,renderDurationMs:0.1,renderDurationUnavailable:null,documentCommitId:21}}
[exit 0]
## run 5

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

$ agent-browser --session art-m3 wait '.notifications__count'
✓ Done
[exit 0]

$ agent-browser --session art-m3 click 'button.notifications__trigger'
✓ Done
[exit 0]

$ agent-browser --session art-m3 wait 500
✓ Done
[exit 0]

$ id=$(npx genie-react call timeline_start '{"name":"mark all read"}' --session art-m3 --json | jq -r .id)
{"id":"timeline-260d45df-63df-4f78-a922-44fca1ac736e","name":"mark all read","state":"recording","stopReason":null,"durationMs":0,"maxEvents":1000,"maxDurationMs":30000,"eventCount":0,"truncated":false,"correlation":"temporal-only","clock":"performance.now","ordering":"observation-time-then-sequence","coverage":{"request":{"status":"available","code":"resource-timing-and-fetch","detail":"Fetch/XHR Resource Timing joined with the app's fetch and XMLHttpRequest calls made during the recording, which add method, outcome (including an abort after the response headers), when the app finished reading the body, and requests still in flight at stop. A request the app sent through a fetch reference captured before recording has method null. Requests seen only through those calls, and requests still in flight, are added when the recording stops. Requests started before recording may appear without a method. Worker and non-fetch/XHR requests are absent. Cross-origin detailed timing and responseReceived require Timing-Allow-Origin. URLs omit credentials and fragments; query parameter values are salted hashes unless queryValues is plain."},"query":{"status":"unavailable","code":"no-query-client","detail":"No QueryClient supplied. Only the supplied QueryCache is observed."},"react":{"status":"available","code":"react-root-commits","detail":"Supported development React root commits; hook must precede React. renderDurationMs is root actualDuration when positive, otherwise null with renderDurationUnavailable saying why; not commit wall time, native UI timing, effects or component attribution. No Fiber tree traversal."},"navigation":{"status":"unavailable","code":"no-tanstack-router","detail":"No TanStack Router supplied; other routers and native navigation are not observed."}},"queryValues":"hashed","genieRequestsExcluded":0}
id=timeline-260d45df-63df-4f78-a922-44fca1ac736e

$ agent-browser --session art-m3 find text 'Mark all read' click
✓ Done
[exit 0]

$ npx genie-react call react_quiesce '{"idleMs":500,"timeoutMs":10000}' --session art-m3
ok: true
outcome: idle
elapsedMs: 644
observedCommits: 0
documentCommitId: 20
sessionId: 7cd6ac29-bf37-47c8-b91e-380387ad0986
renderCollection: available
pendingWork:
  documentCommitId: 20
  scheduledRoots: 0
  suspendedBoundaries: 0
  dehydratedBoundaries: 0
  boundaries: []
  scanTruncated: false
  scannedFibers: 2319
[exit 0]

$ npx genie-react call timeline_stop '{"id":"timeline-260d45df-63df-4f78-a922-44fca1ac736e"}' --session art-m3
id: timeline-260d45df-63df-4f78-a922-44fca1ac736e
name: "mark all read"
state: stopped
stopReason: manual
durationMs: 1152.3
maxEvents: 1000
maxDurationMs: 30000
eventCount: 3
truncated: false
correlation: temporal-only
clock: performance.now
ordering: observation-time-then-sequence
coverage:
  request: {status:available,code:resource-timing-and-fetch}
  query: {status:unavailable,code:no-query-client}
  react: {status:available,code:react-root-commits}
  navigation: {status:unavailable,code:no-tanstack-router}
queryValues: hashed
genieRequestsExcluded: 22
[exit 0]

$ npx genie-react call timeline_read '{"id":"timeline-260d45df-63df-4f78-a922-44fca1ac736e"}' --session art-m3
id: timeline-260d45df-63df-4f78-a922-44fca1ac736e
name: "mark all read"
state: stopped
stopReason: manual
durationMs: 1152.3
maxEvents: 1000
maxDurationMs: 30000
eventCount: 3
truncated: false
correlation: temporal-only
clock: performance.now
ordering: observation-time-then-sequence
coverage:
  request: {status:available,code:resource-timing-and-fetch}
  query: {status:unavailable,code:no-query-client}
  react: {status:available,code:react-root-commits}
  navigation: {status:unavailable,code:no-tanstack-router}
queryValues: hashed
genieRequestsExcluded: 22
events[3] (#sequence atMs domain type {details}):
  #1 92.1 react commit {rendererId:1,renderDurationMs:8.3,renderDurationUnavailable:null,documentCommitId:20}
  #2 93.3 request completed {url:http://127.0.0.1:5223/api/notifications/read,query:null,initiatorType:fetch,startMs:14.2,endMs:77,durationMs:62.8,startedBeforeRecording:false,detailedTimingAvailable:true,responseStatus:200,responseReceived:true,method:POST,outcome:response,bodyReadMs:77.3,overlappingSameEndpoint:0,finishedAfterNewer:false,bodyReadLast:null}
  #3 961.1 react commit {rendererId:1,renderDurationMs:0.1,renderDurationUnavailable:null,documentCommitId:21}
matchedEventCount: 3
nextOffset: null
[exit 0]

$ npx genie-react call timeline_read '{"id":"timeline-260d45df-63df-4f78-a922-44fca1ac736e"}' --session art-m3 --fields domain,type,atMs,details
[3]:
  - {domain:react,type:commit,atMs:92.1,details:{rendererId:1,renderDurationMs:8.3,renderDurationUnavailable:null,documentCommitId:20}}
  - {domain:request,type:completed,atMs:93.3,details:{url:http://127.0.0.1:5223/api/notifications/read,query:null,initiatorType:fetch,startMs:14.2,endMs:77,durationMs:62.8,startedBeforeRecording:false,detailedTimingAvailable:true,responseStatus:200,responseReceived:true,method:POST,outcome:response,bodyReadMs:77.3,overlappingSameEndpoint:0,finishedAfterNewer:false,bodyReadLast:null}}
  - {domain:react,type:commit,atMs:961.1,details:{rendererId:1,renderDurationMs:0.1,renderDurationUnavailable:null,documentCommitId:21}}
[exit 0]
## render causes

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

$ agent-browser --session art-m3 wait '.notifications__count'
✓ Done
[exit 0]

$ agent-browser --session art-m3 click 'button.notifications__trigger'
✓ Done
[exit 0]

$ agent-browser --session art-m3 wait 500
✓ Done
[exit 0]

$ npx genie-react call react_clear_renders '{}' --session art-m3
ok: true
tracking: true
documentCommitId: 19
observation: {id:observation:1,epoch:1,startedAfterDocumentCommitId:19}
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

$ agent-browser --session art-m3 find text 'Mark all read' click
✓ Done
[exit 0]

$ npx genie-react call react_quiesce '{"idleMs":500,"timeoutMs":10000}' --session art-m3
ok: true
outcome: idle
elapsedMs: 1256
observedCommits: 1
documentCommitId: 21
sessionId: 6d330c19-c1c5-4efa-a9c3-c5529f734c10
renderCollection: available
pendingWork:
  documentCommitId: 21
  scheduledRoots: 0
  suspendedBoundaries: 0
  dehydratedBoundaries: 0
  boundaries: []
  scanTruncated: false
  scannedFibers: 2319
[exit 0]

$ npx genie-react call react_get_renders '{"sort":"renders","limit":8}' --session art-m3 --fields name,renders,necessity,necessityReason
[8]:
  each: {renders:1}
  - {name:NotificationsMenu,necessity:necessary,necessityReason:dom-changed}
  - {name:NotificationItem,necessity:necessary,necessityReason:dom-changed}
  - {name:RelativeTime,necessity:unnecessary,necessityReason:inputs-unchanged}
  - {name:NotificationItem,necessity:necessary,necessityReason:dom-changed}
  - {name:RelativeTime,necessity:unnecessary,necessityReason:inputs-unchanged}
  - {name:NotificationItem,necessity:necessary,necessityReason:dom-changed}
  - {name:RelativeTime,necessity:unnecessary,necessityReason:inputs-unchanged}
  - {name:NotificationItem,necessity:unknown,necessityReason:callbacks-changed}
[exit 0]

$ npx genie-react call react_render_causes '{"component":"IssueTable","limit":2}' --session art-m3
componentMatch:
  component: IssueTable
  exact: true
  status: matched
  matchedNames: [IssueTable]
  matchedNameCount: 1
  similarNames: []
tracking: true
commits: 3
documentCommitId: 22
observation: {id:observation:1,epoch:1,startedAfterDocumentCommitId:19}
attribution:
  status: current
  startedAtDocumentCommitId: 22
  completedAtDocumentCommitId: 22
  startedAtAnalysisGeneration: 23
  completedAtAnalysisGeneration: 23
view: summary
events[1] (componentName #componentId {fields}, then ← kind evidence name {fields} per cause):
  IssueTable #2961866490032 {renderEventId:render:20:71,documentCommitId:20,mountId:mount:46,necessity:unnecessary,necessityReason:inputs-unchanged,inputEvidence:changed,wrappedBy:{componentId:2961866490030,componentName:"Connect(IssueTable)",renderEventId:render:20:70,causes:[{kind:external-store,evidence:inferred,name:selector,redux:{evidence:exact,actions:[notifications/markAllRead/fulfilled]}}],necessity:unnecessary,necessityReason:inputs-unchanged},source:{location:<repo>/apps/realworld-legacy/src/features/issues/issue-table.tsx:43:7,role:component-body,ownership:app}}
    ← parent inferred "Connect(IssueTable)"
    ← props exact rows {referenceOnly:true}
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
renderEventRetention: {evictedEvents:0,earliestDocumentCommitId:20,latestDocumentCommitId:22}
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
    - {reason:inputs-truncated,fibers:1,components:[NotificationsMenu],detail:"An input held values Genie compares only in part, such as functions, class instances or objects past the inspected depth; read deepDiff.truncated on these components."}
  complete: false
  inputAttributionComplete: false
  semantics: lower-bound
  coverageDomain: render-causality
  droppedRenderEvents: 0
[exit 0]

$ npx genie-react call react_get_renders '{"limit":1}' --session art-m3 --select /coverage
status: ok
selection: {expression:/coverage,matchedPathCount:1,matchedPaths:[/coverage],omittedPathCount:65}
result:
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
    - {reason:inputs-truncated,fibers:1,components:[NotificationsMenu],detail:"An input held values Genie compares only in part, such as functions, class instances or objects past the inspected depth; read deepDiff.truncated on these components."}
  complete: false
  inputAttributionComplete: false
  semantics: lower-bound
  coverageDomain: render-causality
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

$ agent-browser --session art-m3 wait '.notifications__count'
✓ Done
[exit 0]

$ agent-browser --session art-m3 click 'button.notifications__trigger'
✓ Done
[exit 0]

$ agent-browser --session art-m3 wait 500
✓ Done
[exit 0]

$ npx genie-react verify begin ... (see output)

$ npx genie-react verify begin --session art-m3 --name 'mark all read' --claim 'render IssueTable max 0' --claim 'render NotificationsMenu min 1' --claim 'boundaries clean' > /tmp/art-m3/vb.txt; cat /tmp/art-m3/vb.txt
recording vfy_6ee95163-4ef6-4209-8d7e-4778d87bfbaa "mark all read"
  url "http://127.0.0.1:5223/issues"
  1 null render IssueTable max 0  {}
  2 null render NotificationsMenu min 1  {}
  3 null boundaries clean  {}
window: {observationId:observation:1,startDocumentCommitId:19,domains:[react],quietMs:500,timeoutMs:10000,tailMs:500}
next: $ pnpm exec genie-react verify end vfy_6ee95163-4ef6-4209-8d7e-4778d87bfbaa --session art-m3
session: {sessionId:000919ff-b7cf-4aad-9329-599961fe8644,logicalSessionId:4ddd7a3e-437b-4904-afe1-fb005aad89d6,documentGeneration:14}
schemaVersion: "1.0"
targets: [{target:{component:IssueTable},status:resolved,instances:1,source:<repo>/apps/realworld-legacy/src/features/issues/issue-table.tsx},{target:{component:NotificationsMenu},status:resolved,instances:1,source:<repo>/apps/realworld-legacy/src/layout/top-bar.tsx}]
startedAt: 2026-11-19T03:59:39.264Z
expiresAt: 2026-11-19T04:04:39.279Z
request: {budget:{fiberLimit:250,operationLimit:20000,timeLimitMs:8,targetOperationReserve:4000,targetTimeReserveMs:4,adaptive:true},settle:{quietMs:500,timeoutMs:10000},maxDurationMs:300000,allowOverrides:false}
[exit 0]

$ agent-browser --session art-m3 find text 'Mark all read' click
✓ Done
[exit 0]

$ npx genie-react verify end vfy_6ee95163-4ef6-4209-8d7e-4778d87bfbaa --session art-m3; echo "exit code: $?"
fail vfy_6ee95163-4ef6-4209-8d7e-4778d87bfbaa "mark all read"  3 commits, quiet after 1279 ms (react)
  url "http://127.0.0.1:5223/issues"
  1 fail render IssueTable max 0  {renders:1,mounts:0,updates:1,remounts:0,semantics:exact,instances:1,activeInstances:1}
      claim: {kind:renders,target:{component:IssueTable},max:0,counting:renders,allowRemount:false}
      deciding: [{kind:instance,mountId:mount:1,renders:1,mounts:0,updates:1,mountGeneration:1,latestDocumentCommitId:20,source:<repo>/apps/realworld-legacy/src/features/issues/issue-table.tsx:43:7}]
  2 pass render NotificationsMenu min 1  {renders:1,mounts:0,updates:1,remounts:0,semantics:exact,instances:1,activeInstances:1}
      claim: {kind:renders,target:{component:NotificationsMenu},min:1,counting:renders,allowRemount:false}
      deciding: [{kind:instance,mountId:mount:2,renders:1,mounts:0,updates:1,mountGeneration:1,latestDocumentCommitId:20,source:<repo>/apps/realworld-legacy/src/layout/top-bar.tsx:31:9}]
  3 pass boundaries clean  {caughtDuringWindow:0,caughtAtEnd:0}
      claim: {kind:boundaries-clean,scope:window}
      deciding: [{kind:boundary-log,scope:window,complete:true,afterDocumentCommitId:19}]
      caveats: [uncaught-errors-outside-boundaries-unobserved]
window: {observationId:observation:1,startDocumentCommitId:19,settledDocumentCommitId:21,frozenDocumentCommitId:22,commits:3,settle:{outcome:met,quietMs:500,timeoutMs:10000,waitedMs:1279,domains:{react:met}},tail:{ms:500,commits:1},environment:{bundle:development,strictMode:on,renderCollection:available,visibility:unavailable}}
! ui-outcome-not-observed: Genie does not check the screen; confirm it with the UI driver
! visibility-unobserved: the app reports no visibility signal, so a hidden interval was not observed
attempt 1 for these claims on this tab
evidence: $ pnpm exec genie-react verify show vfy_6ee95163-4ef6-4209-8d7e-4778d87bfbaa --claim 1 --session art-m3
session: {sessionId:000919ff-b7cf-4aad-9329-599961fe8644,logicalSessionId:4ddd7a3e-437b-4904-afe1-fb005aad89d6,documentGeneration:14}
schemaVersion: "1.0"
exitCode: 1
stage: end
ledger: {fingerprint:cf_6567e67801eb,scope:logical-session,storage:memory,attempt:1,history:[],codeChangedSincePrevious:null,failsOnSameCode:0}
evidence: {retained:true,tools:[react_get_renders,react_component_cohort,react_list_overrides,react_refresh_events,react_profile_stop,react_error_state]}
startedAt: 2026-11-19T03:59:39.264Z
endedAt: 2026-11-19T03:59:41.415Z
request: {budget:{fiberLimit:250,operationLimit:20000,timeLimitMs:8,targetOperationReserve:4000,targetTimeReserveMs:4,adaptive:true},settle:{quietMs:500,timeoutMs:10000},maxDurationMs:300000,allowOverrides:false}
exit code: 1
[exit 0]

$ npx genie-react verify show vfy_6ee95163-4ef6-4209-8d7e-4778d87bfbaa --session art-m3 --claim 1
verificationId: vfy_6ee95163-4ef6-4209-8d7e-4778d87bfbaa
verdict: fail
claim:
  index: 1
  text: "render IssueTable max 0"
  claim: {kind:renders,target:{component:IssueTable},max:0,counting:renders,allowRemount:false}
  verdict: fail
  observed: {renders:1,mounts:0,updates:1,remounts:0,semantics:exact,instances:1,activeInstances:1}
  deciding[1]:
    - {kind:instance,mountId:mount:1,renders:1,mounts:0,updates:1,mountGeneration:1,latestDocumentCommitId:20,source:<repo>/apps/realworld-legacy/src/features/issues/issue-table.tsx:43:7}
  caveats: []
evidence:
  records[1]:
    - {mountId:mount:1,key:null,logicalPath:"AppErrorBoundary[index=0] > Provider[index=0] > BrowserRouter[index=0] > Router[index=0] > ThemeProvider[index=0] > App[index=0] > Routes[index=0] > RenderedRoute[index=0] > RequireAuth[index=0] > Connect(AppShell)[index=0] > AppShell[index=0] > FeatureFlagsProvider[index=0] > <div>[index=0] > <main>[index=2] > Outlet[index=0] > RenderedRoute[index=0] > IssuesPage[index=0] > <div>[index=0] > withRouter(Connect(IssueTable))[index=3] > Connect(IssueTable)[index=0] > IssueTable[index=0]",mountGeneration:1,mountGenerationEvidence:exact,renders:1,mounts:0,updates:1,unmounted:false,latestDocumentCommitId:20,sourceFile:<repo>/apps/realworld-legacy/src/features/issues/issue-table.tsx,sourceLocation:<repo>/apps/realworld-legacy/src/features/issues/issue-table.tsx:43:7}
  events: null
  effects: null
  beginInstances[1]:
    - {mountId:mount:1,key:null,renderingState:mounted-rendering,sourceFile:<repo>/apps/realworld-legacy/src/features/issues/issue-table.tsx,sourceLocation:<repo>/apps/realworld-legacy/src/features/issues/issue-table.tsx:43:7}
  endInstances[1]:
    - {mountId:mount:1,key:null,renderingState:mounted-rendering,sourceFile:<repo>/apps/realworld-legacy/src/features/issues/issue-table.tsx,sourceLocation:<repo>/apps/realworld-legacy/src/features/issues/issue-table.tsx:43:7}
evidenceRetained: true
[exit 0]
## row cohort

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

$ agent-browser --session art-m3 wait '.notifications__count'
✓ Done
[exit 0]

$ agent-browser --session art-m3 click 'button.notifications__trigger'
✓ Done
[exit 0]

$ agent-browser --session art-m3 wait 500
✓ Done
[exit 0]

$ npx genie-react call react_clear_renders '{"component":"IssueRow","budget":{"fiberLimit":2000,"timeLimitMs":100}}' --session art-m3
ok: true
tracking: true
documentCommitId: 19
observation: {id:observation:1,epoch:1,startedAfterDocumentCommitId:19}
observationConfig:
  adaptive: true
  adaptiveScale: 1
  fiberLimit: 2000
  operationLimit: 200000
  timeLimitMs: 500
  targetOperationReserve: 4000
  targetTimeReserveMs: 4
  lifecycleBufferLimit: 1000
  lifecycleTargetReserve: 100
strictMode: on
[exit 0]

$ agent-browser --session art-m3 find text 'Mark all read' click
✓ Done
[exit 0]

$ npx genie-react call react_quiesce '{"idleMs":500,"timeoutMs":10000}' --session art-m3
ok: true
outcome: idle
elapsedMs: 1264
observedCommits: 1
documentCommitId: 21
sessionId: 3d4a02b1-6a47-4c80-9bb4-8cfe9efc897d
renderCollection: available
pendingWork:
  documentCommitId: 21
  scheduledRoots: 0
  suspendedBoundaries: 0
  dehydratedBoundaries: 0
  boundaries: []
  scanTruncated: false
  scannedFibers: 2319
[exit 0]

$ npx genie-react call react_component_cohort '{"component":"IssueRow"}' --session art-m3
attribution:
  status: current
  startedAtDocumentCommitId: 21
  completedAtDocumentCommitId: 21
  startedAtAnalysisGeneration: 22
  completedAtAnalysisGeneration: 22
documentCommitId: 21
ownershipCoverage:
  complete: true
  totalCandidates: 100
  app: 100
  library: 0
  unknown: 0
  affects: ownership-labels
observation: {id:observation:1,epoch:1,startedAfterDocumentCommitId:19}
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
returned: 50
omittedByLimit: 50
rendererBundle: development
coverage:
  complete: false
  freezeDetection: disabled
  scannedFibers: 2319
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
  parent: {fiberId:434043355312,name:IssueTable,key:null}
  keyedParent: null
  logicalIdentityEvidence: keyed
  mountGenerationEvidence: exact
  renderingState: mounted-rendering
  reactVisibility: not-hidden
instances[50]:
  each: {mountGeneration:1,hostSelector:tr.issue-row}
  - {status:mounted-updated,mountId:mount:1,fiberId:434043355337,key:iss-1,siblingIndex:0,logicalPath:"IssueRow[key=\"iss-1\"]"}
  - {status:mounted-updated,mountId:mount:2,fiberId:434043355357,key:iss-27,siblingIndex:1,logicalPath:"IssueRow[key=\"iss-27\"]"}
  - {status:mounted-updated,mountId:mount:3,fiberId:434043355377,key:iss-37,siblingIndex:2,logicalPath:"IssueRow[key=\"iss-37\"]"}
  - {status:mounted-updated,mountId:mount:4,fiberId:434043355397,key:iss-40,siblingIndex:3,logicalPath:"IssueRow[key=\"iss-40\"]"}
  - {status:mounted-updated,mountId:mount:5,fiberId:434043355417,key:iss-41,siblingIndex:4,logicalPath:"IssueRow[key=\"iss-41\"]"}
  - {status:mounted-updated,mountId:mount:6,fiberId:434043355436,key:iss-52,siblingIndex:5,logicalPath:"IssueRow[key=\"iss-52\"]"}
  - {status:mounted-updated,mountId:mount:7,fiberId:434043355456,key:iss-87,siblingIndex:6,logicalPath:"IssueRow[key=\"iss-87\"]"}
  - {status:mounted-updated,mountId:mount:8,fiberId:434043355476,key:iss-94,siblingIndex:7,logicalPath:"IssueRow[key=\"iss-94\"]"}
  - {status:mounted-updated,mountId:mount:9,fiberId:434043355496,key:iss-101,siblingIndex:8,logicalPath:"IssueRow[key=\"iss-101\"]"}
  - {status:mounted-updated,mountId:mount:10,fiberId:434043355516,key:iss-107,siblingIndex:9,logicalPath:"IssueRow[key=\"iss-107\"]"}
  - {status:mounted-updated,mountId:mount:11,fiberId:434043355536,key:iss-115,siblingIndex:10,logicalPath:"IssueRow[key=\"iss-115\"]"}
  - {status:mounted-updated,mountId:mount:12,fiberId:434043355555,key:iss-127,siblingIndex:11,logicalPath:"IssueRow[key=\"iss-127\"]"}
  - {status:mounted-updated,mountId:mount:13,fiberId:434043355575,key:iss-144,siblingIndex:12,logicalPath:"IssueRow[key=\"iss-144\"]"}
  - {status:mounted-updated,mountId:mount:14,fiberId:434043355594,key:iss-149,siblingIndex:13,logicalPath:"IssueRow[key=\"iss-149\"]"}
  - {status:mounted-updated,mountId:mount:15,fiberId:434043355613,key:iss-167,siblingIndex:14,logicalPath:"IssueRow[key=\"iss-167\"]"}
  - {status:mounted-updated,mountId:mount:16,fiberId:434043355633,key:iss-169,siblingIndex:15,logicalPath:"IssueRow[key=\"iss-169\"]"}
  - {status:mounted-updated,mountId:mount:17,fiberId:434043355653,key:iss-206,siblingIndex:16,logicalPath:"IssueRow[key=\"iss-206\"]"}
  - {status:mounted-updated,mountId:mount:18,fiberId:434043355672,key:iss-235,siblingIndex:17,logicalPath:"IssueRow[key=\"iss-235\"]"}
  - {status:mounted-updated,mountId:mount:19,fiberId:434043355692,key:iss-238,siblingIndex:18,logicalPath:"IssueRow[key=\"iss-238\"]"}
  - {status:mounted-updated,mountId:mount:20,fiberId:434043355711,key:iss-239,siblingIndex:19,logicalPath:"IssueRow[key=\"iss-239\"]"}
  - {status:mounted-updated,mountId:mount:21,fiberId:434043355731,key:iss-258,siblingIndex:20,logicalPath:"IssueRow[key=\"iss-258\"]"}
  - {status:mounted-updated,mountId:mount:22,fiberId:434043355750,key:iss-265,siblingIndex:21,logicalPath:"IssueRow[key=\"iss-265\"]"}
  - {status:mounted-updated,mountId:mount:23,fiberId:434043355770,key:iss-277,siblingIndex:22,logicalPath:"IssueRow[key=\"iss-277\"]"}
  - {status:mounted-updated,mountId:mount:24,fiberId:434043355790,key:iss-280,siblingIndex:23,logicalPath:"IssueRow[key=\"iss-280\"]"}
  - {status:mounted-updated,mountId:mount:25,fiberId:434043355810,key:iss-290,siblingIndex:24,logicalPath:"IssueRow[key=\"iss-290\"]"}
  - {status:mounted-updated,mountId:mount:26,fiberId:434043355830,key:iss-311,siblingIndex:25,logicalPath:"IssueRow[key=\"iss-311\"]"}
  - {status:mounted-updated,mountId:mount:27,fiberId:434043355850,key:iss-321,siblingIndex:26,logicalPath:"IssueRow[key=\"iss-321\"]"}
  - {status:mounted-updated,mountId:mount:28,fiberId:434043355870,key:iss-334,siblingIndex:27,logicalPath:"IssueRow[key=\"iss-334\"]"}
  - {status:mounted-updated,mountId:mount:29,fiberId:434043355890,key:iss-347,siblingIndex:28,logicalPath:"IssueRow[key=\"iss-347\"]"}
  - {status:mounted-updated,mountId:mount:30,fiberId:434043355910,key:iss-350,siblingIndex:29,logicalPath:"IssueRow[key=\"iss-350\"]"}
  - {status:mounted-updated,mountId:mount:31,fiberId:434043355930,key:iss-360,siblingIndex:30,logicalPath:"IssueRow[key=\"iss-360\"]"}
  - {status:mounted-updated,mountId:mount:32,fiberId:434043355949,key:iss-362,siblingIndex:31,logicalPath:"IssueRow[key=\"iss-362\"]"}
  - {status:mounted-updated,mountId:mount:33,fiberId:434043355969,key:iss-368,siblingIndex:32,logicalPath:"IssueRow[key=\"iss-368\"]"}
  - {status:mounted-updated,mountId:mount:34,fiberId:434043355989,key:iss-369,siblingIndex:33,logicalPath:"IssueRow[key=\"iss-369\"]"}
  - {status:mounted-unknown,mountId:mount:484,fiberId:434043356009,key:iss-385,siblingIndex:34,logicalPath:"IssueRow[key=\"iss-385\"]"}
  - {status:mounted-unknown,mountId:mount:485,fiberId:434043356029,key:iss-399,siblingIndex:35,logicalPath:"IssueRow[key=\"iss-399\"]"}
  - {status:mounted-unknown,mountId:mount:486,fiberId:434043356049,key:iss-420,siblingIndex:36,logicalPath:"IssueRow[key=\"iss-420\"]"}
  - {status:mounted-unknown,mountId:mount:487,fiberId:434043356069,key:iss-427,siblingIndex:37,logicalPath:"IssueRow[key=\"iss-427\"]"}
  - {status:mounted-unknown,mountId:mount:488,fiberId:434043356089,key:iss-444,siblingIndex:38,logicalPath:"IssueRow[key=\"iss-444\"]"}
  - {status:mounted-unknown,mountId:mount:489,fiberId:434043356109,key:iss-498,siblingIndex:39,logicalPath:"IssueRow[key=\"iss-498\"]"}
  - {status:mounted-unknown,mountId:mount:490,fiberId:434043356128,key:iss-499,siblingIndex:40,logicalPath:"IssueRow[key=\"iss-499\"]"}
  - {status:mounted-unknown,mountId:mount:491,fiberId:434043356148,key:iss-531,siblingIndex:41,logicalPath:"IssueRow[key=\"iss-531\"]"}
  - {status:mounted-unknown,mountId:mount:492,fiberId:434043356168,key:iss-557,siblingIndex:42,logicalPath:"IssueRow[key=\"iss-557\"]"}
  - {status:mounted-unknown,mountId:mount:493,fiberId:434043356188,key:iss-577,siblingIndex:43,logicalPath:"IssueRow[key=\"iss-577\"]"}
  - {status:mounted-unknown,mountId:mount:494,fiberId:434043356208,key:iss-584,siblingIndex:44,logicalPath:"IssueRow[key=\"iss-584\"]"}
  - {status:mounted-unknown,mountId:mount:495,fiberId:434043356228,key:iss-597,siblingIndex:45,logicalPath:"IssueRow[key=\"iss-597\"]"}
  - {status:mounted-unknown,mountId:mount:496,fiberId:434043356247,key:iss-613,siblingIndex:46,logicalPath:"IssueRow[key=\"iss-613\"]"}
  - {status:mounted-unknown,mountId:mount:497,fiberId:434043356267,key:iss-616,siblingIndex:47,logicalPath:"IssueRow[key=\"iss-616\"]"}
  - {status:mounted-unknown,mountId:mount:498,fiberId:434043356287,key:iss-635,siblingIndex:48,logicalPath:"IssueRow[key=\"iss-635\"]"}
  - {status:mounted-unknown,mountId:mount:499,fiberId:434043356306,key:iss-713,siblingIndex:49,logicalPath:"IssueRow[key=\"iss-713\"]"}
[exit 0]
## row cohort

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

$ agent-browser --session art-m3 wait '.notifications__count'
✓ Done
[exit 0]

$ agent-browser --session art-m3 click 'button.notifications__trigger'
✓ Done
[exit 0]

$ agent-browser --session art-m3 wait 500
✓ Done
[exit 0]

$ npx genie-react call react_clear_renders '{"component":"IssueRow","budget":{"adaptive":false,"fiberLimit":20000,"operationLimit":2000000,"timeLimitMs":500,"targetOperationReserve":100000,"targetTimeReserveMs":100}}' --session art-m3
ok: true
tracking: true
documentCommitId: 19
observation: {id:observation:1,epoch:1,startedAfterDocumentCommitId:19}
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

$ agent-browser --session art-m3 find text 'Mark all read' click
✓ Done
[exit 0]

$ npx genie-react call react_quiesce '{"idleMs":500,"timeoutMs":10000}' --session art-m3
ok: true
outcome: idle
elapsedMs: 980
observedCommits: 1
documentCommitId: 21
sessionId: 040ba1cd-eb11-480a-b306-cc9c02b30865
renderCollection: available
pendingWork:
  documentCommitId: 21
  scheduledRoots: 0
  suspendedBoundaries: 0
  dehydratedBoundaries: 0
  boundaries: []
  scanTruncated: false
  scannedFibers: 2319
[exit 0]

$ npx genie-react call react_component_cohort '{"component":"IssueRow","limit":1}' --session art-m3
attribution:
  status: current
  startedAtDocumentCommitId: 23
  completedAtDocumentCommitId: 23
  startedAtAnalysisGeneration: 24
  completedAtAnalysisGeneration: 24
documentCommitId: 23
ownershipCoverage:
  complete: true
  totalCandidates: 100
  app: 100
  library: 0
  unknown: 0
  affects: ownership-labels
observation: {id:observation:1,epoch:1,startedAfterDocumentCommitId:19}
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
  scannedFibers: 2319
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
  parent: {fiberId:17462582050992,name:IssueTable,key:null}
  keyedParent: null
  logicalIdentityEvidence: keyed
  mountGenerationEvidence: exact
  renderingState: mounted-rendering
  reactVisibility: not-hidden
instances[1]:
  - {status:mounted-updated,mountId:mount:1,fiberId:17462582051017,key:iss-1,siblingIndex:0,logicalPath:"IssueRow[key=\"iss-1\"]",mountGeneration:1,hostSelector:tr.issue-row}
[exit 0]
## typing run 1

$ agent-browser --session art-m3 open http://127.0.0.1:5223/issues
✓ Acme Tracker
  http://127.0.0.1:5223/issues
[exit 0]

$ agent-browser --session art-m3 wait '.issue-row'
✓ Done
[exit 0]

$ id=$(npx genie-react call timeline_start '{"name":"type view name"}' --session art-m3 --json | jq -r .id)
{"id":"timeline-5bf42178-a4b9-472f-8687-d348dabfb7a8","name":"type view name","state":"recording","stopReason":null,"durationMs":0.1,"maxEvents":1000,"maxDurationMs":30000,"eventCount":0,"truncated":false,"correlation":"temporal-only","clock":"performance.now","ordering":"observation-time-then-sequence","coverage":{"request":{"status":"available","code":"resource-timing-and-fetch","detail":"Fetch/XHR Resource Timing joined with the app's fetch and XMLHttpRequest calls made during the recording, which add method, outcome (including an abort after the response headers), when the app finished reading the body, and requests still in flight at stop. A request the app sent through a fetch reference captured before recording has method null. Requests seen only through those calls, and requests still in flight, are added when the recording stops. Requests started before recording may appear without a method. Worker and non-fetch/XHR requests are absent. Cross-origin detailed timing and responseReceived require Timing-Allow-Origin. URLs omit credentials and fragments; query parameter values are salted hashes unless queryValues is plain."},"query":{"status":"unavailable","code":"no-query-client","detail":"No QueryClient supplied. Only the supplied QueryCache is observed."},"react":{"status":"available","code":"react-root-commits","detail":"Supported development React root commits; hook must precede React. renderDurationMs is root actualDuration when positive, otherwise null with renderDurationUnavailable saying why; not commit wall time, native UI timing, effects or component attribution. No Fiber tree traversal."},"navigation":{"status":"unavailable","code":"no-tanstack-router","detail":"No TanStack Router supplied; other routers and native navigation are not observed."}},"queryValues":"hashed","genieRequestsExcluded":0}
id=timeline-5bf42178-a4b9-472f-8687-d348dabfb7a8

$ agent-browser --session art-m3 type 'input[aria-label="View name"]' 'Sprint triage'
✓ Done
[exit 0]

$ npx genie-react call react_quiesce '{"idleMs":500,"timeoutMs":10000}' --session art-m3
ok: true
outcome: idle
elapsedMs: 655
observedCommits: 0
documentCommitId: 31
sessionId: 03b5dc53-71ca-4eb3-bb4c-1e3dcb9d4078
renderCollection: available
pendingWork:
  documentCommitId: 31
  scheduledRoots: 0
  suspendedBoundaries: 0
  dehydratedBoundaries: 0
  boundaries: []
  scanTruncated: false
  scannedFibers: 2254
[exit 0]

$ npx genie-react call timeline_stop '{"id":"timeline-5bf42178-a4b9-472f-8687-d348dabfb7a8"}' --session art-m3
id: timeline-5bf42178-a4b9-472f-8687-d348dabfb7a8
name: "type view name"
state: stopped
stopReason: manual
durationMs: 1548.3
maxEvents: 1000
maxDurationMs: 30000
eventCount: 15
truncated: false
correlation: temporal-only
clock: performance.now
ordering: observation-time-then-sequence
coverage:
  request: {status:available,code:resource-timing-and-fetch}
  query: {status:unavailable,code:no-query-client}
  react: {status:available,code:react-root-commits}
  navigation: {status:unavailable,code:no-tanstack-router}
queryValues: hashed
genieRequestsExcluded: 27
[exit 0]

$ npx genie-react call timeline_read '{"id":"timeline-5bf42178-a4b9-472f-8687-d348dabfb7a8"}' --session art-m3 --fields domain,type,atMs,details
[15]:
  each: {domain:react,type:commit,details:{rendererId:1}}
  - {atMs:35.8,details:{renderDurationMs:9.3,renderDurationUnavailable:null,documentCommitId:18}}
  - {atMs:54,details:{renderDurationMs:8.6,renderDurationUnavailable:null,documentCommitId:19}}
  - {atMs:69.3,details:{renderDurationMs:8.3,renderDurationUnavailable:null,documentCommitId:20}}
  - {atMs:90.1,details:{renderDurationMs:8.6,renderDurationUnavailable:null,documentCommitId:21}}
  - {atMs:105.4,details:{renderDurationMs:8.3,renderDurationUnavailable:null,documentCommitId:22}}
  - {atMs:119.9,details:{renderDurationMs:8.1,renderDurationUnavailable:null,documentCommitId:23}}
  - {atMs:137.4,details:{renderDurationMs:11.3,renderDurationUnavailable:null,documentCommitId:24}}
  - {atMs:152.3,details:{renderDurationMs:8,renderDurationUnavailable:null,documentCommitId:25}}
  - {atMs:169.4,details:{renderDurationMs:11.3,renderDurationUnavailable:null,documentCommitId:26}}
  - {atMs:184.5,details:{renderDurationMs:8.5,renderDurationUnavailable:null,documentCommitId:27}}
  - {atMs:202.2,details:{renderDurationMs:10.9,renderDurationUnavailable:null,documentCommitId:28}}
  - {atMs:217.2,details:{renderDurationMs:8.3,renderDurationUnavailable:null,documentCommitId:29}}
  - {atMs:235.6,details:{renderDurationMs:9,renderDurationUnavailable:null,documentCommitId:30}}
  - {atMs:398.1,details:{renderDurationMs:0.1,renderDurationUnavailable:null,documentCommitId:31}}
  - {atMs:1397.5,details:{renderDurationMs:null,renderDurationUnavailable:below-clock-resolution,documentCommitId:32}}
[exit 0]
## typing run 2

$ agent-browser --session art-m3 open http://127.0.0.1:5223/issues
✓ Acme Tracker
  http://127.0.0.1:5223/issues
[exit 0]

$ agent-browser --session art-m3 wait '.issue-row'
✓ Done
[exit 0]

$ id=$(npx genie-react call timeline_start '{"name":"type view name"}' --session art-m3 --json | jq -r .id)
{"id":"timeline-79bf323b-a1d8-4a94-aa64-ff56b2342877","name":"type view name","state":"recording","stopReason":null,"durationMs":0.1,"maxEvents":1000,"maxDurationMs":30000,"eventCount":0,"truncated":false,"correlation":"temporal-only","clock":"performance.now","ordering":"observation-time-then-sequence","coverage":{"request":{"status":"available","code":"resource-timing-and-fetch","detail":"Fetch/XHR Resource Timing joined with the app's fetch and XMLHttpRequest calls made during the recording, which add method, outcome (including an abort after the response headers), when the app finished reading the body, and requests still in flight at stop. A request the app sent through a fetch reference captured before recording has method null. Requests seen only through those calls, and requests still in flight, are added when the recording stops. Requests started before recording may appear without a method. Worker and non-fetch/XHR requests are absent. Cross-origin detailed timing and responseReceived require Timing-Allow-Origin. URLs omit credentials and fragments; query parameter values are salted hashes unless queryValues is plain."},"query":{"status":"unavailable","code":"no-query-client","detail":"No QueryClient supplied. Only the supplied QueryCache is observed."},"react":{"status":"available","code":"react-root-commits","detail":"Supported development React root commits; hook must precede React. renderDurationMs is root actualDuration when positive, otherwise null with renderDurationUnavailable saying why; not commit wall time, native UI timing, effects or component attribution. No Fiber tree traversal."},"navigation":{"status":"unavailable","code":"no-tanstack-router","detail":"No TanStack Router supplied; other routers and native navigation are not observed."}},"queryValues":"hashed","genieRequestsExcluded":0}
id=timeline-79bf323b-a1d8-4a94-aa64-ff56b2342877

$ agent-browser --session art-m3 type 'input[aria-label="View name"]' 'Sprint triage'
✓ Done
[exit 0]

$ npx genie-react call react_quiesce '{"idleMs":500,"timeoutMs":10000}' --session art-m3
ok: true
outcome: idle
elapsedMs: 800
observedCommits: 1
documentCommitId: 31
sessionId: 7f60178d-dfd2-4c00-b0e9-dd8186cbfcd7
renderCollection: available
pendingWork:
  documentCommitId: 31
  scheduledRoots: 0
  suspendedBoundaries: 0
  dehydratedBoundaries: 0
  boundaries: []
  scanTruncated: false
  scannedFibers: 2254
[exit 0]

$ npx genie-react call timeline_stop '{"id":"timeline-79bf323b-a1d8-4a94-aa64-ff56b2342877"}' --session art-m3
id: timeline-79bf323b-a1d8-4a94-aa64-ff56b2342877
name: "type view name"
state: stopped
stopReason: manual
durationMs: 1786.4
maxEvents: 1000
maxDurationMs: 30000
eventCount: 15
truncated: false
correlation: temporal-only
clock: performance.now
ordering: observation-time-then-sequence
coverage:
  request: {status:available,code:resource-timing-and-fetch}
  query: {status:unavailable,code:no-query-client}
  react: {status:available,code:react-root-commits}
  navigation: {status:unavailable,code:no-tanstack-router}
queryValues: hashed
genieRequestsExcluded: 27
[exit 0]

$ npx genie-react call timeline_read '{"id":"timeline-79bf323b-a1d8-4a94-aa64-ff56b2342877"}' --session art-m3 --fields domain,type,atMs,details
[15]:
  each: {domain:react,type:commit,details:{rendererId:1}}
  - {atMs:29,details:{renderDurationMs:9.1,renderDurationUnavailable:null,documentCommitId:18}}
  - {atMs:45.4,details:{renderDurationMs:8.2,renderDurationUnavailable:null,documentCommitId:19}}
  - {atMs:63.8,details:{renderDurationMs:10.5,renderDurationUnavailable:null,documentCommitId:20}}
  - {atMs:79.5,details:{renderDurationMs:9.1,renderDurationUnavailable:null,documentCommitId:21}}
  - {atMs:98.5,details:{renderDurationMs:9.1,renderDurationUnavailable:null,documentCommitId:22}}
  - {atMs:114.7,details:{renderDurationMs:8.6,renderDurationUnavailable:null,documentCommitId:23}}
  - {atMs:138.4,details:{renderDurationMs:11.4,renderDurationUnavailable:null,documentCommitId:24}}
  - {atMs:159.5,details:{renderDurationMs:12.2,renderDurationUnavailable:null,documentCommitId:25}}
  - {atMs:176.7,details:{renderDurationMs:9.8,renderDurationUnavailable:null,documentCommitId:26}}
  - {atMs:194.5,details:{renderDurationMs:11.7,renderDurationUnavailable:null,documentCommitId:27}}
  - {atMs:210.5,details:{renderDurationMs:8.4,renderDurationUnavailable:null,documentCommitId:28}}
  - {atMs:228.3,details:{renderDurationMs:11.6,renderDurationUnavailable:null,documentCommitId:29}}
  - {atMs:242.3,details:{renderDurationMs:8,renderDurationUnavailable:null,documentCommitId:30}}
  - {atMs:603.1,details:{renderDurationMs:null,renderDurationUnavailable:below-clock-resolution,documentCommitId:31}}
  - {atMs:1611.5,details:{renderDurationMs:0.1,renderDurationUnavailable:null,documentCommitId:32}}
[exit 0]
## typing run 3

$ agent-browser --session art-m3 open http://127.0.0.1:5223/issues
✓ Acme Tracker
  http://127.0.0.1:5223/issues
[exit 0]

$ agent-browser --session art-m3 wait '.issue-row'
✓ Done
[exit 0]

$ id=$(npx genie-react call timeline_start '{"name":"type view name"}' --session art-m3 --json | jq -r .id)
{"id":"timeline-0af55834-19e3-4b76-ad6d-11fbc2d92db3","name":"type view name","state":"recording","stopReason":null,"durationMs":0.1,"maxEvents":1000,"maxDurationMs":30000,"eventCount":0,"truncated":false,"correlation":"temporal-only","clock":"performance.now","ordering":"observation-time-then-sequence","coverage":{"request":{"status":"available","code":"resource-timing-and-fetch","detail":"Fetch/XHR Resource Timing joined with the app's fetch and XMLHttpRequest calls made during the recording, which add method, outcome (including an abort after the response headers), when the app finished reading the body, and requests still in flight at stop. A request the app sent through a fetch reference captured before recording has method null. Requests seen only through those calls, and requests still in flight, are added when the recording stops. Requests started before recording may appear without a method. Worker and non-fetch/XHR requests are absent. Cross-origin detailed timing and responseReceived require Timing-Allow-Origin. URLs omit credentials and fragments; query parameter values are salted hashes unless queryValues is plain."},"query":{"status":"unavailable","code":"no-query-client","detail":"No QueryClient supplied. Only the supplied QueryCache is observed."},"react":{"status":"available","code":"react-root-commits","detail":"Supported development React root commits; hook must precede React. renderDurationMs is root actualDuration when positive, otherwise null with renderDurationUnavailable saying why; not commit wall time, native UI timing, effects or component attribution. No Fiber tree traversal."},"navigation":{"status":"unavailable","code":"no-tanstack-router","detail":"No TanStack Router supplied; other routers and native navigation are not observed."}},"queryValues":"hashed","genieRequestsExcluded":0}
id=timeline-0af55834-19e3-4b76-ad6d-11fbc2d92db3

$ agent-browser --session art-m3 type 'input[aria-label="View name"]' 'Sprint triage'
✓ Done
[exit 0]

$ npx genie-react call react_quiesce '{"idleMs":500,"timeoutMs":10000}' --session art-m3
ok: true
outcome: idle
elapsedMs: 648
observedCommits: 0
documentCommitId: 31
sessionId: e9572b47-adfc-42a9-a0d5-8764b3a31156
renderCollection: available
pendingWork:
  documentCommitId: 31
  scheduledRoots: 0
  suspendedBoundaries: 0
  dehydratedBoundaries: 0
  boundaries: []
  scanTruncated: false
  scannedFibers: 2254
[exit 0]

$ npx genie-react call timeline_stop '{"id":"timeline-0af55834-19e3-4b76-ad6d-11fbc2d92db3"}' --session art-m3
id: timeline-0af55834-19e3-4b76-ad6d-11fbc2d92db3
name: "type view name"
state: stopped
stopReason: manual
durationMs: 1656.2
maxEvents: 1000
maxDurationMs: 30000
eventCount: 15
truncated: false
correlation: temporal-only
clock: performance.now
ordering: observation-time-then-sequence
coverage:
  request: {status:available,code:resource-timing-and-fetch}
  query: {status:unavailable,code:no-query-client}
  react: {status:available,code:react-root-commits}
  navigation: {status:unavailable,code:no-tanstack-router}
queryValues: hashed
genieRequestsExcluded: 27
[exit 0]

$ npx genie-react call timeline_read '{"id":"timeline-0af55834-19e3-4b76-ad6d-11fbc2d92db3"}' --session art-m3 --fields domain,type,atMs,details
[15]:
  each: {domain:react,type:commit,details:{rendererId:1}}
  - {atMs:32.3,details:{renderDurationMs:10.3,renderDurationUnavailable:null,documentCommitId:18}}
  - {atMs:52.6,details:{renderDurationMs:10.4,renderDurationUnavailable:null,documentCommitId:19}}
  - {atMs:69.2,details:{renderDurationMs:9,renderDurationUnavailable:null,documentCommitId:20}}
  - {atMs:89.8,details:{renderDurationMs:13.9,renderDurationUnavailable:null,documentCommitId:21}}
  - {atMs:107.6,details:{renderDurationMs:9.1,renderDurationUnavailable:null,documentCommitId:22}}
  - {atMs:127.3,details:{renderDurationMs:12.5,renderDurationUnavailable:null,documentCommitId:23}}
  - {atMs:143.8,details:{renderDurationMs:9.1,renderDurationUnavailable:null,documentCommitId:24}}
  - {atMs:163.8,details:{renderDurationMs:9.3,renderDurationUnavailable:null,documentCommitId:25}}
  - {atMs:180.1,details:{renderDurationMs:8.9,renderDurationUnavailable:null,documentCommitId:26}}
  - {atMs:203.3,details:{renderDurationMs:11.4,renderDurationUnavailable:null,documentCommitId:27}}
  - {atMs:220,details:{renderDurationMs:9.2,renderDurationUnavailable:null,documentCommitId:28}}
  - {atMs:235.6,details:{renderDurationMs:8.9,renderDurationUnavailable:null,documentCommitId:29}}
  - {atMs:253.8,details:{renderDurationMs:11.9,renderDurationUnavailable:null,documentCommitId:30}}
  - {atMs:572.2,details:{renderDurationMs:0.1,renderDurationUnavailable:null,documentCommitId:31}}
  - {atMs:1571.9,details:{renderDurationMs:null,renderDurationUnavailable:below-clock-resolution,documentCommitId:32}}
[exit 0]
## typing render check (shipped code)

$ agent-browser --session art-m3 open http://127.0.0.1:5223/issues
✓ Acme Tracker
  http://127.0.0.1:5223/issues
[exit 0]

$ agent-browser --session art-m3 wait .issue-row
✓ Done
[exit 0]

$ npx genie-react call react_clear_renders '{"component":"IssueTable"}' --session art-m3
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

$ agent-browser --session art-m3 type 'input[aria-label="View name"]' 'Sprint triage'
✓ Done
[exit 0]

$ npx genie-react call react_quiesce '{"idleMs":500,"timeoutMs":10000}' --session art-m3
ok: true
outcome: idle
elapsedMs: 811
observedCommits: 1
documentCommitId: 31
sessionId: 05c2f006-c4e2-4dec-a1c0-36ae337dee4a
renderCollection: available
pendingWork:
  documentCommitId: 31
  scheduledRoots: 0
  suspendedBoundaries: 0
  dehydratedBoundaries: 0
  boundaries: []
  scanTruncated: false
  scannedFibers: 2255
[exit 0]

$ npx genie-react call react_get_renders '{"component":"IssueTable"}' --session art-m3 --fields name,renders,necessity,necessityReason
[1]:
  - {name:IssueTable,renders:13,necessity:unnecessary,necessityReason:inputs-unchanged}
[exit 0]

$ npx genie-react call react_get_renders '{"component":"IssueTable"}' --session art-m3 --select /coverage
status: ok
selection: {expression:/coverage,matchedPathCount:1,matchedPaths:[/coverage],omittedPathCount:85}
result:
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
[exit 0]
## badge check (shipped code)

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

$ agent-browser --session art-m3 wait .notifications__count
✓ Done
[exit 0]

$ agent-browser --session art-m3 get attr button.notifications__trigger aria-label
Notifications, 4 unread
[exit 0]

$ agent-browser --session art-m3 click button.notifications__trigger
✓ Done
[exit 0]

$ agent-browser --session art-m3 find text 'Mark all read' click
✓ Done
[exit 0]

$ agent-browser --session art-m3 wait 500
✓ Done
[exit 0]

$ agent-browser --session art-m3 get attr button.notifications__trigger aria-label
Notifications, 0 unread
[exit 0]
~~~~

## 2. Reference fix applied

~~~~text
# date: 2026-11-19T04:00:49Z
# HEAD: 6867352ba46ec3998fe8cda0ba915536fddfa666
# app: apps/realworld-legacy at http://127.0.0.1:5223 (hub ws://127.0.0.1:5224), reference fix from evals/realworld/legacy/issue-table-selector-recompute.json applied temporarily
$ git diff
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
## run 1

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

$ agent-browser --session art-m3 wait '.notifications__count'
✓ Done
[exit 0]

$ agent-browser --session art-m3 click 'button.notifications__trigger'
✓ Done
[exit 0]

$ agent-browser --session art-m3 wait 500
✓ Done
[exit 0]

$ id=$(npx genie-react call timeline_start '{"name":"mark all read"}' --session art-m3 --json | jq -r .id)
{"id":"timeline-92168e3b-acfc-494c-a9d5-49c2a8f0f2d3","name":"mark all read","state":"recording","stopReason":null,"durationMs":0.2,"maxEvents":1000,"maxDurationMs":30000,"eventCount":0,"truncated":false,"correlation":"temporal-only","clock":"performance.now","ordering":"observation-time-then-sequence","coverage":{"request":{"status":"available","code":"resource-timing-and-fetch","detail":"Fetch/XHR Resource Timing joined with the app's fetch and XMLHttpRequest calls made during the recording, which add method, outcome (including an abort after the response headers), when the app finished reading the body, and requests still in flight at stop. A request the app sent through a fetch reference captured before recording has method null. Requests seen only through those calls, and requests still in flight, are added when the recording stops. Requests started before recording may appear without a method. Worker and non-fetch/XHR requests are absent. Cross-origin detailed timing and responseReceived require Timing-Allow-Origin. URLs omit credentials and fragments; query parameter values are salted hashes unless queryValues is plain."},"query":{"status":"unavailable","code":"no-query-client","detail":"No QueryClient supplied. Only the supplied QueryCache is observed."},"react":{"status":"available","code":"react-root-commits","detail":"Supported development React root commits; hook must precede React. renderDurationMs is root actualDuration when positive, otherwise null with renderDurationUnavailable saying why; not commit wall time, native UI timing, effects or component attribution. No Fiber tree traversal."},"navigation":{"status":"unavailable","code":"no-tanstack-router","detail":"No TanStack Router supplied; other routers and native navigation are not observed."}},"queryValues":"hashed","genieRequestsExcluded":0}
id=timeline-92168e3b-acfc-494c-a9d5-49c2a8f0f2d3

$ agent-browser --session art-m3 find text 'Mark all read' click
✓ Done
[exit 0]

$ npx genie-react call react_quiesce '{"idleMs":500,"timeoutMs":10000}' --session art-m3
ok: true
outcome: idle
elapsedMs: 1129
observedCommits: 1
documentCommitId: 23
sessionId: 9494958f-992a-44ab-9013-369fc81cc35e
renderCollection: available
pendingWork:
  documentCommitId: 23
  scheduledRoots: 0
  suspendedBoundaries: 0
  dehydratedBoundaries: 0
  boundaries: []
  scanTruncated: false
  scannedFibers: 2319
[exit 0]

$ npx genie-react call timeline_stop '{"id":"timeline-92168e3b-acfc-494c-a9d5-49c2a8f0f2d3"}' --session art-m3
id: timeline-92168e3b-acfc-494c-a9d5-49c2a8f0f2d3
name: "mark all read"
state: stopped
stopReason: manual
durationMs: 2556.4
maxEvents: 1000
maxDurationMs: 30000
eventCount: 5
truncated: false
correlation: temporal-only
clock: performance.now
ordering: observation-time-then-sequence
coverage:
  request: {status:available,code:resource-timing-and-fetch}
  query: {status:unavailable,code:no-query-client}
  react: {status:available,code:react-root-commits}
  navigation: {status:unavailable,code:no-tanstack-router}
queryValues: hashed
genieRequestsExcluded: 14
[exit 0]

$ npx genie-react call timeline_read '{"id":"timeline-92168e3b-acfc-494c-a9d5-49c2a8f0f2d3"}' --session art-m3
id: timeline-92168e3b-acfc-494c-a9d5-49c2a8f0f2d3
name: "mark all read"
state: stopped
stopReason: manual
durationMs: 2556.4
maxEvents: 1000
maxDurationMs: 30000
eventCount: 5
truncated: false
correlation: temporal-only
clock: performance.now
ordering: observation-time-then-sequence
coverage:
  request: {status:available,code:resource-timing-and-fetch}
  query: {status:unavailable,code:no-query-client}
  react: {status:available,code:react-root-commits}
  navigation: {status:unavailable,code:no-tanstack-router}
queryValues: hashed
genieRequestsExcluded: 14
events[5] (#sequence atMs domain type {details}):
  #1 116.2 react commit {rendererId:1,renderDurationMs:1.4,renderDurationUnavailable:null,documentCommitId:21}
  #2 120 request completed {url:http://127.0.0.1:5223/api/notifications/read,query:null,initiatorType:fetch,startMs:39.7,endMs:104.5,durationMs:64.8,startedBeforeRecording:false,detailedTimingAvailable:true,responseStatus:200,responseReceived:true,method:POST,outcome:response,bodyReadMs:105.1,overlappingSameEndpoint:0,finishedAfterNewer:false,bodyReadLast:null}
  #3 195.9 react commit {rendererId:1,renderDurationMs:null,renderDurationUnavailable:below-clock-resolution,documentCommitId:22}
  #4 1196.3 react commit {rendererId:1,renderDurationMs:null,renderDurationUnavailable:below-clock-resolution,documentCommitId:23}
  #5 2197.7 react commit {rendererId:1,renderDurationMs:0.1,renderDurationUnavailable:null,documentCommitId:24}
matchedEventCount: 5
nextOffset: null
[exit 0]

$ npx genie-react call timeline_read '{"id":"timeline-92168e3b-acfc-494c-a9d5-49c2a8f0f2d3"}' --session art-m3 --fields domain,type,atMs,details
[5]:
  - {domain:react,type:commit,atMs:116.2,details:{rendererId:1,renderDurationMs:1.4,renderDurationUnavailable:null,documentCommitId:21}}
  - {domain:request,type:completed,atMs:120,details:{url:http://127.0.0.1:5223/api/notifications/read,query:null,initiatorType:fetch,startMs:39.7,endMs:104.5,durationMs:64.8,startedBeforeRecording:false,detailedTimingAvailable:true,responseStatus:200,responseReceived:true,method:POST,outcome:response,bodyReadMs:105.1,overlappingSameEndpoint:0,finishedAfterNewer:false,bodyReadLast:null}}
  - {domain:react,type:commit,atMs:195.9,details:{rendererId:1,renderDurationMs:null,renderDurationUnavailable:below-clock-resolution,documentCommitId:22}}
  - {domain:react,type:commit,atMs:1196.3,details:{rendererId:1,renderDurationMs:null,renderDurationUnavailable:below-clock-resolution,documentCommitId:23}}
  - {domain:react,type:commit,atMs:2197.7,details:{rendererId:1,renderDurationMs:0.1,renderDurationUnavailable:null,documentCommitId:24}}
[exit 0]
## run 2

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

$ agent-browser --session art-m3 wait '.notifications__count'
✓ Done
[exit 0]

$ agent-browser --session art-m3 click 'button.notifications__trigger'
✓ Done
[exit 0]

$ agent-browser --session art-m3 wait 500
✓ Done
[exit 0]

$ id=$(npx genie-react call timeline_start '{"name":"mark all read"}' --session art-m3 --json | jq -r .id)
{"id":"timeline-cfabffd0-6a41-47e2-ad3d-a04157d1330e","name":"mark all read","state":"recording","stopReason":null,"durationMs":0.1,"maxEvents":1000,"maxDurationMs":30000,"eventCount":0,"truncated":false,"correlation":"temporal-only","clock":"performance.now","ordering":"observation-time-then-sequence","coverage":{"request":{"status":"available","code":"resource-timing-and-fetch","detail":"Fetch/XHR Resource Timing joined with the app's fetch and XMLHttpRequest calls made during the recording, which add method, outcome (including an abort after the response headers), when the app finished reading the body, and requests still in flight at stop. A request the app sent through a fetch reference captured before recording has method null. Requests seen only through those calls, and requests still in flight, are added when the recording stops. Requests started before recording may appear without a method. Worker and non-fetch/XHR requests are absent. Cross-origin detailed timing and responseReceived require Timing-Allow-Origin. URLs omit credentials and fragments; query parameter values are salted hashes unless queryValues is plain."},"query":{"status":"unavailable","code":"no-query-client","detail":"No QueryClient supplied. Only the supplied QueryCache is observed."},"react":{"status":"available","code":"react-root-commits","detail":"Supported development React root commits; hook must precede React. renderDurationMs is root actualDuration when positive, otherwise null with renderDurationUnavailable saying why; not commit wall time, native UI timing, effects or component attribution. No Fiber tree traversal."},"navigation":{"status":"unavailable","code":"no-tanstack-router","detail":"No TanStack Router supplied; other routers and native navigation are not observed."}},"queryValues":"hashed","genieRequestsExcluded":0}
id=timeline-cfabffd0-6a41-47e2-ad3d-a04157d1330e

$ agent-browser --session art-m3 find text 'Mark all read' click
✓ Done
[exit 0]

$ npx genie-react call react_quiesce '{"idleMs":500,"timeoutMs":10000}' --session art-m3
ok: true
outcome: idle
elapsedMs: 671
observedCommits: 0
documentCommitId: 20
sessionId: a8364d05-6833-43fc-9841-3081f054fafe
renderCollection: available
pendingWork:
  documentCommitId: 20
  scheduledRoots: 0
  suspendedBoundaries: 0
  dehydratedBoundaries: 0
  boundaries: []
  scanTruncated: false
  scannedFibers: 2319
[exit 0]

$ npx genie-react call timeline_stop '{"id":"timeline-cfabffd0-6a41-47e2-ad3d-a04157d1330e"}' --session art-m3
id: timeline-cfabffd0-6a41-47e2-ad3d-a04157d1330e
name: "mark all read"
state: stopped
stopReason: manual
durationMs: 2191.9
maxEvents: 1000
maxDurationMs: 30000
eventCount: 4
truncated: false
correlation: temporal-only
clock: performance.now
ordering: observation-time-then-sequence
coverage:
  request: {status:available,code:resource-timing-and-fetch}
  query: {status:unavailable,code:no-query-client}
  react: {status:available,code:react-root-commits}
  navigation: {status:unavailable,code:no-tanstack-router}
queryValues: hashed
genieRequestsExcluded: 14
[exit 0]

$ npx genie-react call timeline_read '{"id":"timeline-cfabffd0-6a41-47e2-ad3d-a04157d1330e"}' --session art-m3
id: timeline-cfabffd0-6a41-47e2-ad3d-a04157d1330e
name: "mark all read"
state: stopped
stopReason: manual
durationMs: 2191.9
maxEvents: 1000
maxDurationMs: 30000
eventCount: 4
truncated: false
correlation: temporal-only
clock: performance.now
ordering: observation-time-then-sequence
coverage:
  request: {status:available,code:resource-timing-and-fetch}
  query: {status:unavailable,code:no-query-client}
  react: {status:available,code:react-root-commits}
  navigation: {status:unavailable,code:no-tanstack-router}
queryValues: hashed
genieRequestsExcluded: 14
events[4] (#sequence atMs domain type {details}):
  #1 96.3 react commit {rendererId:1,renderDurationMs:1.4,renderDurationUnavailable:null,documentCommitId:19}
  #2 98.1 request completed {url:http://127.0.0.1:5223/api/notifications/read,query:null,initiatorType:fetch,startMs:27.1,endMs:91,durationMs:63.9,startedBeforeRecording:false,detailedTimingAvailable:true,responseStatus:200,responseReceived:true,method:POST,outcome:response,bodyReadMs:91.4,overlappingSameEndpoint:0,finishedAfterNewer:false,bodyReadLast:null}
  #3 580.8 react commit {rendererId:1,renderDurationMs:0.1,renderDurationUnavailable:null,documentCommitId:20}
  #4 1587 react commit {rendererId:1,renderDurationMs:0.1,renderDurationUnavailable:null,documentCommitId:21}
matchedEventCount: 4
nextOffset: null
[exit 0]

$ npx genie-react call timeline_read '{"id":"timeline-cfabffd0-6a41-47e2-ad3d-a04157d1330e"}' --session art-m3 --fields domain,type,atMs,details
[4]:
  - {domain:react,type:commit,atMs:96.3,details:{rendererId:1,renderDurationMs:1.4,renderDurationUnavailable:null,documentCommitId:19}}
  - {domain:request,type:completed,atMs:98.1,details:{url:http://127.0.0.1:5223/api/notifications/read,query:null,initiatorType:fetch,startMs:27.1,endMs:91,durationMs:63.9,startedBeforeRecording:false,detailedTimingAvailable:true,responseStatus:200,responseReceived:true,method:POST,outcome:response,bodyReadMs:91.4,overlappingSameEndpoint:0,finishedAfterNewer:false,bodyReadLast:null}}
  - {domain:react,type:commit,atMs:580.8,details:{rendererId:1,renderDurationMs:0.1,renderDurationUnavailable:null,documentCommitId:20}}
  - {domain:react,type:commit,atMs:1587,details:{rendererId:1,renderDurationMs:0.1,renderDurationUnavailable:null,documentCommitId:21}}
[exit 0]
## run 3

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

$ agent-browser --session art-m3 wait '.notifications__count'
✓ Done
[exit 0]

$ agent-browser --session art-m3 click 'button.notifications__trigger'
✓ Done
[exit 0]

$ agent-browser --session art-m3 wait 500
✓ Done
[exit 0]

$ id=$(npx genie-react call timeline_start '{"name":"mark all read"}' --session art-m3 --json | jq -r .id)
{"id":"timeline-46ce7090-073f-460e-aa88-b06af950f439","name":"mark all read","state":"recording","stopReason":null,"durationMs":0.2,"maxEvents":1000,"maxDurationMs":30000,"eventCount":0,"truncated":false,"correlation":"temporal-only","clock":"performance.now","ordering":"observation-time-then-sequence","coverage":{"request":{"status":"available","code":"resource-timing-and-fetch","detail":"Fetch/XHR Resource Timing joined with the app's fetch and XMLHttpRequest calls made during the recording, which add method, outcome (including an abort after the response headers), when the app finished reading the body, and requests still in flight at stop. A request the app sent through a fetch reference captured before recording has method null. Requests seen only through those calls, and requests still in flight, are added when the recording stops. Requests started before recording may appear without a method. Worker and non-fetch/XHR requests are absent. Cross-origin detailed timing and responseReceived require Timing-Allow-Origin. URLs omit credentials and fragments; query parameter values are salted hashes unless queryValues is plain."},"query":{"status":"unavailable","code":"no-query-client","detail":"No QueryClient supplied. Only the supplied QueryCache is observed."},"react":{"status":"available","code":"react-root-commits","detail":"Supported development React root commits; hook must precede React. renderDurationMs is root actualDuration when positive, otherwise null with renderDurationUnavailable saying why; not commit wall time, native UI timing, effects or component attribution. No Fiber tree traversal."},"navigation":{"status":"unavailable","code":"no-tanstack-router","detail":"No TanStack Router supplied; other routers and native navigation are not observed."}},"queryValues":"hashed","genieRequestsExcluded":0}
id=timeline-46ce7090-073f-460e-aa88-b06af950f439

$ agent-browser --session art-m3 find text 'Mark all read' click
✓ Done
[exit 0]

$ npx genie-react call react_quiesce '{"idleMs":500,"timeoutMs":10000}' --session art-m3
ok: true
outcome: idle
elapsedMs: 946
observedCommits: 1
documentCommitId: 20
sessionId: d3233e41-c7c6-4016-a46e-a5d45b4f8d42
renderCollection: available
pendingWork:
  documentCommitId: 20
  scheduledRoots: 0
  suspendedBoundaries: 0
  dehydratedBoundaries: 0
  boundaries: []
  scanTruncated: false
  scannedFibers: 2319
[exit 0]

$ npx genie-react call timeline_stop '{"id":"timeline-46ce7090-073f-460e-aa88-b06af950f439"}' --session art-m3
id: timeline-46ce7090-073f-460e-aa88-b06af950f439
name: "mark all read"
state: stopped
stopReason: manual
durationMs: 1926.3
maxEvents: 1000
maxDurationMs: 30000
eventCount: 4
truncated: false
correlation: temporal-only
clock: performance.now
ordering: observation-time-then-sequence
coverage:
  request: {status:available,code:resource-timing-and-fetch}
  query: {status:unavailable,code:no-query-client}
  react: {status:available,code:react-root-commits}
  navigation: {status:unavailable,code:no-tanstack-router}
queryValues: hashed
genieRequestsExcluded: 14
[exit 0]

$ npx genie-react call timeline_read '{"id":"timeline-46ce7090-073f-460e-aa88-b06af950f439"}' --session art-m3
id: timeline-46ce7090-073f-460e-aa88-b06af950f439
name: "mark all read"
state: stopped
stopReason: manual
durationMs: 1926.3
maxEvents: 1000
maxDurationMs: 30000
eventCount: 4
truncated: false
correlation: temporal-only
clock: performance.now
ordering: observation-time-then-sequence
coverage:
  request: {status:available,code:resource-timing-and-fetch}
  query: {status:unavailable,code:no-query-client}
  react: {status:available,code:react-root-commits}
  navigation: {status:unavailable,code:no-tanstack-router}
queryValues: hashed
genieRequestsExcluded: 14
events[4] (#sequence atMs domain type {details}):
  #1 100.6 react commit {rendererId:1,renderDurationMs:2.1,renderDurationUnavailable:null,documentCommitId:19}
  #2 103.2 request completed {url:http://127.0.0.1:5223/api/notifications/read,query:null,initiatorType:fetch,startMs:27,endMs:92.4,durationMs:65.4,startedBeforeRecording:false,detailedTimingAvailable:true,responseStatus:200,responseReceived:true,method:POST,outcome:response,bodyReadMs:93.1,overlappingSameEndpoint:0,finishedAfterNewer:false,bodyReadLast:null}
  #3 727.7 react commit {rendererId:1,renderDurationMs:0.1,renderDurationUnavailable:null,documentCommitId:20}
  #4 1726.8 react commit {rendererId:1,renderDurationMs:0.2,renderDurationUnavailable:null,documentCommitId:21}
matchedEventCount: 4
nextOffset: null
[exit 0]

$ npx genie-react call timeline_read '{"id":"timeline-46ce7090-073f-460e-aa88-b06af950f439"}' --session art-m3 --fields domain,type,atMs,details
[4]:
  - {domain:react,type:commit,atMs:100.6,details:{rendererId:1,renderDurationMs:2.1,renderDurationUnavailable:null,documentCommitId:19}}
  - {domain:request,type:completed,atMs:103.2,details:{url:http://127.0.0.1:5223/api/notifications/read,query:null,initiatorType:fetch,startMs:27,endMs:92.4,durationMs:65.4,startedBeforeRecording:false,detailedTimingAvailable:true,responseStatus:200,responseReceived:true,method:POST,outcome:response,bodyReadMs:93.1,overlappingSameEndpoint:0,finishedAfterNewer:false,bodyReadLast:null}}
  - {domain:react,type:commit,atMs:727.7,details:{rendererId:1,renderDurationMs:0.1,renderDurationUnavailable:null,documentCommitId:20}}
  - {domain:react,type:commit,atMs:1726.8,details:{rendererId:1,renderDurationMs:0.2,renderDurationUnavailable:null,documentCommitId:21}}
[exit 0]
## run 4

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

$ agent-browser --session art-m3 wait '.notifications__count'
✓ Done
[exit 0]

$ agent-browser --session art-m3 click 'button.notifications__trigger'
✓ Done
[exit 0]

$ agent-browser --session art-m3 wait 500
✓ Done
[exit 0]

$ id=$(npx genie-react call timeline_start '{"name":"mark all read"}' --session art-m3 --json | jq -r .id)
{"id":"timeline-5d150858-8390-412b-87d4-d2e57c9d6495","name":"mark all read","state":"recording","stopReason":null,"durationMs":0.1,"maxEvents":1000,"maxDurationMs":30000,"eventCount":0,"truncated":false,"correlation":"temporal-only","clock":"performance.now","ordering":"observation-time-then-sequence","coverage":{"request":{"status":"available","code":"resource-timing-and-fetch","detail":"Fetch/XHR Resource Timing joined with the app's fetch and XMLHttpRequest calls made during the recording, which add method, outcome (including an abort after the response headers), when the app finished reading the body, and requests still in flight at stop. A request the app sent through a fetch reference captured before recording has method null. Requests seen only through those calls, and requests still in flight, are added when the recording stops. Requests started before recording may appear without a method. Worker and non-fetch/XHR requests are absent. Cross-origin detailed timing and responseReceived require Timing-Allow-Origin. URLs omit credentials and fragments; query parameter values are salted hashes unless queryValues is plain."},"query":{"status":"unavailable","code":"no-query-client","detail":"No QueryClient supplied. Only the supplied QueryCache is observed."},"react":{"status":"available","code":"react-root-commits","detail":"Supported development React root commits; hook must precede React. renderDurationMs is root actualDuration when positive, otherwise null with renderDurationUnavailable saying why; not commit wall time, native UI timing, effects or component attribution. No Fiber tree traversal."},"navigation":{"status":"unavailable","code":"no-tanstack-router","detail":"No TanStack Router supplied; other routers and native navigation are not observed."}},"queryValues":"hashed","genieRequestsExcluded":0}
id=timeline-5d150858-8390-412b-87d4-d2e57c9d6495

$ agent-browser --session art-m3 find text 'Mark all read' click
✓ Done
[exit 0]

$ npx genie-react call react_quiesce '{"idleMs":500,"timeoutMs":10000}' --session art-m3
ok: true
outcome: idle
elapsedMs: 1101
observedCommits: 1
documentCommitId: 20
sessionId: c4efb000-c011-4c79-b5ab-3275a388bf80
renderCollection: available
pendingWork:
  documentCommitId: 20
  scheduledRoots: 0
  suspendedBoundaries: 0
  dehydratedBoundaries: 0
  boundaries: []
  scanTruncated: false
  scannedFibers: 2319
[exit 0]

$ npx genie-react call timeline_stop '{"id":"timeline-5d150858-8390-412b-87d4-d2e57c9d6495"}' --session art-m3
id: timeline-5d150858-8390-412b-87d4-d2e57c9d6495
name: "mark all read"
state: stopped
stopReason: manual
durationMs: 1942
maxEvents: 1000
maxDurationMs: 30000
eventCount: 4
truncated: false
correlation: temporal-only
clock: performance.now
ordering: observation-time-then-sequence
coverage:
  request: {status:available,code:resource-timing-and-fetch}
  query: {status:unavailable,code:no-query-client}
  react: {status:available,code:react-root-commits}
  navigation: {status:unavailable,code:no-tanstack-router}
queryValues: hashed
genieRequestsExcluded: 14
[exit 0]

$ npx genie-react call timeline_read '{"id":"timeline-5d150858-8390-412b-87d4-d2e57c9d6495"}' --session art-m3
id: timeline-5d150858-8390-412b-87d4-d2e57c9d6495
name: "mark all read"
state: stopped
stopReason: manual
durationMs: 1942
maxEvents: 1000
maxDurationMs: 30000
eventCount: 4
truncated: false
correlation: temporal-only
clock: performance.now
ordering: observation-time-then-sequence
coverage:
  request: {status:available,code:resource-timing-and-fetch}
  query: {status:unavailable,code:no-query-client}
  react: {status:available,code:react-root-commits}
  navigation: {status:unavailable,code:no-tanstack-router}
queryValues: hashed
genieRequestsExcluded: 14
events[4] (#sequence atMs domain type {details}):
  #1 100.7 react commit {rendererId:1,renderDurationMs:1,renderDurationUnavailable:null,documentCommitId:19}
  #2 102 request completed {url:http://127.0.0.1:5223/api/notifications/read,query:null,initiatorType:fetch,startMs:33.1,endMs:96.1,durationMs:63,startedBeforeRecording:false,detailedTimingAvailable:true,responseStatus:200,responseReceived:true,method:POST,outcome:response,bodyReadMs:96.4,overlappingSameEndpoint:0,finishedAfterNewer:false,bodyReadLast:null}
  #3 760.5 react commit {rendererId:1,renderDurationMs:0.1,renderDurationUnavailable:null,documentCommitId:20}
  #4 1767.3 react commit {rendererId:1,renderDurationMs:0.2,renderDurationUnavailable:null,documentCommitId:21}
matchedEventCount: 4
nextOffset: null
[exit 0]

$ npx genie-react call timeline_read '{"id":"timeline-5d150858-8390-412b-87d4-d2e57c9d6495"}' --session art-m3 --fields domain,type,atMs,details
[4]:
  - {domain:react,type:commit,atMs:100.7,details:{rendererId:1,renderDurationMs:1,renderDurationUnavailable:null,documentCommitId:19}}
  - {domain:request,type:completed,atMs:102,details:{url:http://127.0.0.1:5223/api/notifications/read,query:null,initiatorType:fetch,startMs:33.1,endMs:96.1,durationMs:63,startedBeforeRecording:false,detailedTimingAvailable:true,responseStatus:200,responseReceived:true,method:POST,outcome:response,bodyReadMs:96.4,overlappingSameEndpoint:0,finishedAfterNewer:false,bodyReadLast:null}}
  - {domain:react,type:commit,atMs:760.5,details:{rendererId:1,renderDurationMs:0.1,renderDurationUnavailable:null,documentCommitId:20}}
  - {domain:react,type:commit,atMs:1767.3,details:{rendererId:1,renderDurationMs:0.2,renderDurationUnavailable:null,documentCommitId:21}}
[exit 0]
## run 5

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

$ agent-browser --session art-m3 wait '.notifications__count'
✓ Done
[exit 0]

$ agent-browser --session art-m3 click 'button.notifications__trigger'
✓ Done
[exit 0]

$ agent-browser --session art-m3 wait 500
✓ Done
[exit 0]

$ id=$(npx genie-react call timeline_start '{"name":"mark all read"}' --session art-m3 --json | jq -r .id)
{"id":"timeline-1d6a1845-02e6-43cd-8cf5-d3201c9657b4","name":"mark all read","state":"recording","stopReason":null,"durationMs":0.2,"maxEvents":1000,"maxDurationMs":30000,"eventCount":0,"truncated":false,"correlation":"temporal-only","clock":"performance.now","ordering":"observation-time-then-sequence","coverage":{"request":{"status":"available","code":"resource-timing-and-fetch","detail":"Fetch/XHR Resource Timing joined with the app's fetch and XMLHttpRequest calls made during the recording, which add method, outcome (including an abort after the response headers), when the app finished reading the body, and requests still in flight at stop. A request the app sent through a fetch reference captured before recording has method null. Requests seen only through those calls, and requests still in flight, are added when the recording stops. Requests started before recording may appear without a method. Worker and non-fetch/XHR requests are absent. Cross-origin detailed timing and responseReceived require Timing-Allow-Origin. URLs omit credentials and fragments; query parameter values are salted hashes unless queryValues is plain."},"query":{"status":"unavailable","code":"no-query-client","detail":"No QueryClient supplied. Only the supplied QueryCache is observed."},"react":{"status":"available","code":"react-root-commits","detail":"Supported development React root commits; hook must precede React. renderDurationMs is root actualDuration when positive, otherwise null with renderDurationUnavailable saying why; not commit wall time, native UI timing, effects or component attribution. No Fiber tree traversal."},"navigation":{"status":"unavailable","code":"no-tanstack-router","detail":"No TanStack Router supplied; other routers and native navigation are not observed."}},"queryValues":"hashed","genieRequestsExcluded":0}
id=timeline-1d6a1845-02e6-43cd-8cf5-d3201c9657b4

$ agent-browser --session art-m3 find text 'Mark all read' click
✓ Done
[exit 0]

$ npx genie-react call react_quiesce '{"idleMs":500,"timeoutMs":10000}' --session art-m3
ok: true
outcome: idle
elapsedMs: 948
observedCommits: 1
documentCommitId: 20
sessionId: f5a08bab-154b-4d9f-9693-7c46f5174d32
renderCollection: available
pendingWork:
  documentCommitId: 20
  scheduledRoots: 0
  suspendedBoundaries: 0
  dehydratedBoundaries: 0
  boundaries: []
  scanTruncated: false
  scannedFibers: 2319
[exit 0]

$ npx genie-react call timeline_stop '{"id":"timeline-1d6a1845-02e6-43cd-8cf5-d3201c9657b4"}' --session art-m3
id: timeline-1d6a1845-02e6-43cd-8cf5-d3201c9657b4
name: "mark all read"
state: stopped
stopReason: manual
durationMs: 1819.5
maxEvents: 1000
maxDurationMs: 30000
eventCount: 4
truncated: false
correlation: temporal-only
clock: performance.now
ordering: observation-time-then-sequence
coverage:
  request: {status:available,code:resource-timing-and-fetch}
  query: {status:unavailable,code:no-query-client}
  react: {status:available,code:react-root-commits}
  navigation: {status:unavailable,code:no-tanstack-router}
queryValues: hashed
genieRequestsExcluded: 14
[exit 0]

$ npx genie-react call timeline_read '{"id":"timeline-1d6a1845-02e6-43cd-8cf5-d3201c9657b4"}' --session art-m3
id: timeline-1d6a1845-02e6-43cd-8cf5-d3201c9657b4
name: "mark all read"
state: stopped
stopReason: manual
durationMs: 1819.5
maxEvents: 1000
maxDurationMs: 30000
eventCount: 4
truncated: false
correlation: temporal-only
clock: performance.now
ordering: observation-time-then-sequence
coverage:
  request: {status:available,code:resource-timing-and-fetch}
  query: {status:unavailable,code:no-query-client}
  react: {status:available,code:react-root-commits}
  navigation: {status:unavailable,code:no-tanstack-router}
queryValues: hashed
genieRequestsExcluded: 14
events[4] (#sequence atMs domain type {details}):
  #1 95 react commit {rendererId:1,renderDurationMs:1.7,renderDurationUnavailable:null,documentCommitId:19}
  #2 97.7 request completed {url:http://127.0.0.1:5223/api/notifications/read,query:null,initiatorType:fetch,startMs:26.5,endMs:89.6,durationMs:63.1,startedBeforeRecording:false,detailedTimingAvailable:true,responseStatus:200,responseReceived:true,method:POST,outcome:response,bodyReadMs:89.9,overlappingSameEndpoint:0,finishedAfterNewer:false,bodyReadLast:null}
  #3 755 react commit {rendererId:1,renderDurationMs:0.1,renderDurationUnavailable:null,documentCommitId:20}
  #4 1746.8 react commit {rendererId:1,renderDurationMs:0.1,renderDurationUnavailable:null,documentCommitId:21}
matchedEventCount: 4
nextOffset: null
[exit 0]

$ npx genie-react call timeline_read '{"id":"timeline-1d6a1845-02e6-43cd-8cf5-d3201c9657b4"}' --session art-m3 --fields domain,type,atMs,details
[4]:
  - {domain:react,type:commit,atMs:95,details:{rendererId:1,renderDurationMs:1.7,renderDurationUnavailable:null,documentCommitId:19}}
  - {domain:request,type:completed,atMs:97.7,details:{url:http://127.0.0.1:5223/api/notifications/read,query:null,initiatorType:fetch,startMs:26.5,endMs:89.6,durationMs:63.1,startedBeforeRecording:false,detailedTimingAvailable:true,responseStatus:200,responseReceived:true,method:POST,outcome:response,bodyReadMs:89.9,overlappingSameEndpoint:0,finishedAfterNewer:false,bodyReadLast:null}}
  - {domain:react,type:commit,atMs:755,details:{rendererId:1,renderDurationMs:0.1,renderDurationUnavailable:null,documentCommitId:20}}
  - {domain:react,type:commit,atMs:1746.8,details:{rendererId:1,renderDurationMs:0.1,renderDurationUnavailable:null,documentCommitId:21}}
[exit 0]
## render causes

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

$ agent-browser --session art-m3 wait '.notifications__count'
✓ Done
[exit 0]

$ agent-browser --session art-m3 click 'button.notifications__trigger'
✓ Done
[exit 0]

$ agent-browser --session art-m3 wait 500
✓ Done
[exit 0]

$ npx genie-react call react_clear_renders '{}' --session art-m3
ok: true
tracking: true
documentCommitId: 18
observation: {id:observation:1,epoch:1,startedAfterDocumentCommitId:18}
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

$ agent-browser --session art-m3 find text 'Mark all read' click
✓ Done
[exit 0]

$ npx genie-react call react_quiesce '{"idleMs":500,"timeoutMs":10000}' --session art-m3
ok: true
outcome: idle
elapsedMs: 1253
observedCommits: 1
documentCommitId: 20
sessionId: 277915b2-bd60-49e7-a595-3d980b898377
renderCollection: available
pendingWork:
  documentCommitId: 20
  scheduledRoots: 0
  suspendedBoundaries: 0
  dehydratedBoundaries: 0
  boundaries: []
  scanTruncated: false
  scannedFibers: 2319
[exit 0]

$ npx genie-react call react_get_renders '{"sort":"renders","limit":8}' --session art-m3 --fields name,renders,necessity,necessityReason
[8]:
  - {name:LastSyncedLabel,renders:2,necessity:necessary,necessityReason:dom-changed}
  - {name:NotificationsMenu,renders:1,necessity:necessary,necessityReason:dom-changed}
  - {name:NotificationItem,renders:1,necessity:necessary,necessityReason:dom-changed}
  - {name:RelativeTime,renders:1,necessity:unnecessary,necessityReason:inputs-unchanged}
  - {name:NotificationItem,renders:1,necessity:necessary,necessityReason:dom-changed}
  - {name:RelativeTime,renders:1,necessity:unnecessary,necessityReason:inputs-unchanged}
  - {name:NotificationItem,renders:1,necessity:necessary,necessityReason:dom-changed}
  - {name:RelativeTime,renders:1,necessity:unnecessary,necessityReason:inputs-unchanged}
[exit 0]

$ npx genie-react call react_render_causes '{"component":"IssueTable","limit":2}' --session art-m3
componentMatch:
  component: IssueTable
  exact: true
  status: no-match
  matchedNames: []
  matchedNameCount: 0
  similarNames: []
tracking: true
commits: 3
documentCommitId: 21
observation: {id:observation:1,epoch:1,startedAfterDocumentCommitId:18}
attribution:
  status: current
  startedAtDocumentCommitId: 21
  completedAtDocumentCommitId: 21
  startedAtAnalysisGeneration: 22
  completedAtAnalysisGeneration: 22
view: summary
events[0] (componentName #componentId {fields}, then ← kind evidence name {fields} per cause):
omittedByLimit: 0
sourceClassification:
  complete: true
  affects: result
  totalCandidates: 0
  evaluated: 0
  app: 0
  library: 0
  unknown: 0
  unknownComponents: []
  unknownComponentsOmitted: 0
renderEventRetention: {evictedEvents:0,earliestDocumentCommitId:19,latestDocumentCommitId:21}
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
    - {reason:inputs-truncated,fibers:1,components:[NotificationsMenu],detail:"An input held values Genie compares only in part, such as functions, class instances or objects past the inspected depth; read deepDiff.truncated on these components."}
  complete: false
  inputAttributionComplete: false
  semantics: lower-bound
  coverageDomain: render-causality
  droppedRenderEvents: 0
[exit 0]

$ npx genie-react call react_get_renders '{"limit":1}' --session art-m3 --select /coverage
status: ok
selection: {expression:/coverage,matchedPathCount:1,matchedPaths:[/coverage],omittedPathCount:63}
result:
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
    - {reason:inputs-truncated,fibers:1,components:[NotificationsMenu],detail:"An input held values Genie compares only in part, such as functions, class instances or objects past the inspected depth; read deepDiff.truncated on these components."}
  complete: false
  inputAttributionComplete: false
  semantics: lower-bound
  coverageDomain: render-causality
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

$ agent-browser --session art-m3 wait '.notifications__count'
✓ Done
[exit 0]

$ agent-browser --session art-m3 click 'button.notifications__trigger'
✓ Done
[exit 0]

$ agent-browser --session art-m3 wait 500
✓ Done
[exit 0]

$ npx genie-react verify begin ... (see output)

$ npx genie-react verify begin --session art-m3 --name 'mark all read' --claim 'render IssueTable max 0' --claim 'render NotificationsMenu min 1' --claim 'boundaries clean' > /tmp/art-m3/vb.txt; cat /tmp/art-m3/vb.txt
recording vfy_7a226505-7bd9-4aca-b753-ef58cadf7e56 "mark all read"
  url "http://127.0.0.1:5223/issues"
  1 null render IssueTable max 0  {}
  2 null render NotificationsMenu min 1  {}
  3 null boundaries clean  {}
window: {observationId:observation:1,startDocumentCommitId:18,domains:[react],quietMs:500,timeoutMs:10000,tailMs:500}
next: $ pnpm exec genie-react verify end vfy_7a226505-7bd9-4aca-b753-ef58cadf7e56 --session art-m3
session: {sessionId:33ba5c37-6ac7-42e9-b5f8-8b3ec8b7f0d0,logicalSessionId:4ddd7a3e-437b-4904-afe1-fb005aad89d6,documentGeneration:24}
schemaVersion: "1.0"
targets: [{target:{component:IssueTable},status:resolved,instances:1,source:<repo>/apps/realworld-legacy/src/features/issues/issue-table.tsx},{target:{component:NotificationsMenu},status:resolved,instances:1,source:<repo>/apps/realworld-legacy/src/layout/top-bar.tsx}]
startedAt: 2026-11-19T04:01:49.943Z
expiresAt: 2026-11-19T04:06:49.968Z
request: {budget:{fiberLimit:250,operationLimit:20000,timeLimitMs:8,targetOperationReserve:4000,targetTimeReserveMs:4,adaptive:true},settle:{quietMs:500,timeoutMs:10000},maxDurationMs:300000,allowOverrides:false}
[exit 0]

$ agent-browser --session art-m3 find text 'Mark all read' click
✓ Done
[exit 0]

$ npx genie-react verify end vfy_7a226505-7bd9-4aca-b753-ef58cadf7e56 --session art-m3; echo "exit code: $?"
pass vfy_7a226505-7bd9-4aca-b753-ef58cadf7e56 "mark all read"  3 commits, quiet after 940 ms (react)
  url "http://127.0.0.1:5223/issues"
  1 pass render IssueTable max 0  {renders:0,mounts:0,updates:0,remounts:0,semantics:exact,instances:1,activeInstances:1}
      claim: {kind:renders,target:{component:IssueTable},max:0,counting:renders,allowRemount:false}
      deciding: [{kind:coverage,complete:true,targetedComplete:true,semantics:exact},{kind:instance,mountId:mount:1,renderingState:mounted-rendering,source:<repo>/apps/realworld-legacy/src/features/issues/issue-table.tsx:43:7}]
  2 pass render NotificationsMenu min 1  {renders:1,mounts:0,updates:1,remounts:0,semantics:exact,instances:1,activeInstances:1}
      claim: {kind:renders,target:{component:NotificationsMenu},min:1,counting:renders,allowRemount:false}
      deciding: [{kind:instance,mountId:mount:2,renders:1,mounts:0,updates:1,mountGeneration:1,latestDocumentCommitId:19,source:<repo>/apps/realworld-legacy/src/layout/top-bar.tsx:31:9}]
  3 pass boundaries clean  {caughtDuringWindow:0,caughtAtEnd:0}
      claim: {kind:boundaries-clean,scope:window}
      deciding: [{kind:boundary-log,scope:window,complete:true,afterDocumentCommitId:18}]
      caveats: [uncaught-errors-outside-boundaries-unobserved]
window: {observationId:observation:1,startDocumentCommitId:18,settledDocumentCommitId:20,frozenDocumentCommitId:21,commits:3,settle:{outcome:met,quietMs:500,timeoutMs:10000,waitedMs:940,domains:{react:met}},tail:{ms:500,commits:1},environment:{bundle:development,strictMode:on,renderCollection:available,visibility:unavailable}}
! ui-outcome-not-observed: Genie does not check the screen; confirm it with the UI driver
! visibility-unobserved: the app reports no visibility signal, so a hidden interval was not observed
attempt 2 for these claims on this tab; previous fail vfy_6ee95163-4ef6-4209-8d7e-4778d87bfbaa; document reloaded since
evidence: $ pnpm exec genie-react verify show vfy_7a226505-7bd9-4aca-b753-ef58cadf7e56 --session art-m3
session: {sessionId:33ba5c37-6ac7-42e9-b5f8-8b3ec8b7f0d0,logicalSessionId:4ddd7a3e-437b-4904-afe1-fb005aad89d6,documentGeneration:24}
schemaVersion: "1.0"
exitCode: 0
stage: end
ledger: {fingerprint:cf_6567e67801eb,scope:logical-session,storage:memory,attempt:2,history:[{verificationId:vfy_6ee95163-4ef6-4209-8d7e-4778d87bfbaa,verdict:fail,reasons:[],endedAt:2026-11-19T03:59:41.415Z}],codeChangedSincePrevious:document-reloaded,failsOnSameCode:0}
evidence: {retained:true,tools:[react_get_renders,react_component_cohort,react_list_overrides,react_refresh_events,react_profile_stop,react_error_state]}
startedAt: 2026-11-19T04:01:49.943Z
endedAt: 2026-11-19T04:01:51.889Z
request: {budget:{fiberLimit:250,operationLimit:20000,timeLimitMs:8,targetOperationReserve:4000,targetTimeReserveMs:4,adaptive:true},settle:{quietMs:500,timeoutMs:10000},maxDurationMs:300000,allowOverrides:false}
exit code: 0
[exit 0]

$ npx genie-react verify show vfy_7a226505-7bd9-4aca-b753-ef58cadf7e56 --session art-m3 --claim 1
verificationId: vfy_7a226505-7bd9-4aca-b753-ef58cadf7e56
verdict: pass
claim:
  index: 1
  text: "render IssueTable max 0"
  claim: {kind:renders,target:{component:IssueTable},max:0,counting:renders,allowRemount:false}
  verdict: pass
  observed: {renders:0,mounts:0,updates:0,remounts:0,semantics:exact,instances:1,activeInstances:1}
  deciding[2]:
    - {kind:coverage,complete:true,targetedComplete:true,semantics:exact}
    - {kind:instance,mountId:mount:1,renderingState:mounted-rendering,source:<repo>/apps/realworld-legacy/src/features/issues/issue-table.tsx:43:7}
  caveats: []
evidence:
  records: []
  events: null
  effects: null
  beginInstances[1]:
    - {mountId:mount:1,key:null,renderingState:mounted-rendering,sourceFile:<repo>/apps/realworld-legacy/src/features/issues/issue-table.tsx,sourceLocation:<repo>/apps/realworld-legacy/src/features/issues/issue-table.tsx:43:7}
  endInstances[1]:
    - {mountId:mount:1,key:null,renderingState:mounted-rendering,sourceFile:<repo>/apps/realworld-legacy/src/features/issues/issue-table.tsx,sourceLocation:<repo>/apps/realworld-legacy/src/features/issues/issue-table.tsx:43:7}
evidenceRetained: true
[exit 0]
## row cohort

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

$ agent-browser --session art-m3 wait '.notifications__count'
✓ Done
[exit 0]

$ agent-browser --session art-m3 click 'button.notifications__trigger'
✓ Done
[exit 0]

$ agent-browser --session art-m3 wait 500
✓ Done
[exit 0]

$ npx genie-react call react_clear_renders '{"component":"IssueRow","budget":{"adaptive":false,"fiberLimit":20000,"operationLimit":2000000,"timeLimitMs":500,"targetOperationReserve":100000,"targetTimeReserveMs":100}}' --session art-m3
ok: true
tracking: true
documentCommitId: 18
observation: {id:observation:1,epoch:1,startedAfterDocumentCommitId:18}
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

$ agent-browser --session art-m3 find text 'Mark all read' click
✓ Done
[exit 0]

$ npx genie-react call react_quiesce '{"idleMs":500,"timeoutMs":10000}' --session art-m3
ok: true
outcome: idle
elapsedMs: 1103
observedCommits: 1
documentCommitId: 20
sessionId: c4ef0cab-60d1-4ab5-b437-56d5bfafdf01
renderCollection: available
pendingWork:
  documentCommitId: 20
  scheduledRoots: 0
  suspendedBoundaries: 0
  dehydratedBoundaries: 0
  boundaries: []
  scanTruncated: false
  scannedFibers: 2319
[exit 0]

$ npx genie-react call react_component_cohort '{"component":"IssueRow","limit":1}' --session art-m3
attribution:
  status: current
  startedAtDocumentCommitId: 21
  completedAtDocumentCommitId: 21
  startedAtAnalysisGeneration: 22
  completedAtAnalysisGeneration: 22
documentCommitId: 21
ownershipCoverage:
  complete: true
  totalCandidates: 100
  app: 100
  library: 0
  unknown: 0
  affects: ownership-labels
observation: {id:observation:1,epoch:1,startedAfterDocumentCommitId:18}
query: {component:IssueRow,exact:true}
componentMatch:
  component: IssueRow
  exact: true
  status: matched
  matchedNames: [IssueRow]
  matchedNameCount: 1
  similarNames: []
status: mounted-idle
matched: 100
mountedUpdated: 0
mountedIdle: 100
mountedUnknown: 0
unmounted: 0
returned: 1
omittedByLimit: 99
rendererBundle: development
coverage:
  complete: true
  freezeDetection: disabled
  scannedFibers: 2319
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
  parent: {fiberId:7651098362027,name:IssueTable,key:null}
  keyedParent: null
  logicalIdentityEvidence: keyed
  mountGenerationEvidence: exact
  renderingState: mounted-rendering
  reactVisibility: not-hidden
instances[1]:
  - {status:mounted-idle,mountId:mount:46,fiberId:7651098362026,key:iss-1,siblingIndex:0,logicalPath:"IssueRow[key=\"iss-1\"]",mountGeneration:1,hostSelector:tr.issue-row}
[exit 0]
## typing run 1

$ agent-browser --session art-m3 open http://127.0.0.1:5223/issues
✓ Acme Tracker
  http://127.0.0.1:5223/issues
[exit 0]

$ agent-browser --session art-m3 wait '.issue-row'
✓ Done
[exit 0]

$ id=$(npx genie-react call timeline_start '{"name":"type view name"}' --session art-m3 --json | jq -r .id)
{"id":"timeline-0cf89c75-ff33-4609-9d52-bc5643babfff","name":"type view name","state":"recording","stopReason":null,"durationMs":0.1,"maxEvents":1000,"maxDurationMs":30000,"eventCount":0,"truncated":false,"correlation":"temporal-only","clock":"performance.now","ordering":"observation-time-then-sequence","coverage":{"request":{"status":"available","code":"resource-timing-and-fetch","detail":"Fetch/XHR Resource Timing joined with the app's fetch and XMLHttpRequest calls made during the recording, which add method, outcome (including an abort after the response headers), when the app finished reading the body, and requests still in flight at stop. A request the app sent through a fetch reference captured before recording has method null. Requests seen only through those calls, and requests still in flight, are added when the recording stops. Requests started before recording may appear without a method. Worker and non-fetch/XHR requests are absent. Cross-origin detailed timing and responseReceived require Timing-Allow-Origin. URLs omit credentials and fragments; query parameter values are salted hashes unless queryValues is plain."},"query":{"status":"unavailable","code":"no-query-client","detail":"No QueryClient supplied. Only the supplied QueryCache is observed."},"react":{"status":"available","code":"react-root-commits","detail":"Supported development React root commits; hook must precede React. renderDurationMs is root actualDuration when positive, otherwise null with renderDurationUnavailable saying why; not commit wall time, native UI timing, effects or component attribution. No Fiber tree traversal."},"navigation":{"status":"unavailable","code":"no-tanstack-router","detail":"No TanStack Router supplied; other routers and native navigation are not observed."}},"queryValues":"hashed","genieRequestsExcluded":0}
id=timeline-0cf89c75-ff33-4609-9d52-bc5643babfff

$ agent-browser --session art-m3 type 'input[aria-label="View name"]' 'Sprint triage'
✓ Done
[exit 0]

$ npx genie-react call react_quiesce '{"idleMs":500,"timeoutMs":10000}' --session art-m3
ok: true
outcome: idle
elapsedMs: 780
observedCommits: 1
documentCommitId: 30
sessionId: a12456cb-f903-417f-9d24-0804f708b7fb
renderCollection: available
pendingWork:
  documentCommitId: 30
  scheduledRoots: 0
  suspendedBoundaries: 0
  dehydratedBoundaries: 0
  boundaries: []
  scanTruncated: false
  scannedFibers: 2254
[exit 0]

$ npx genie-react call timeline_stop '{"id":"timeline-0cf89c75-ff33-4609-9d52-bc5643babfff"}' --session art-m3
id: timeline-0cf89c75-ff33-4609-9d52-bc5643babfff
name: "type view name"
state: stopped
stopReason: manual
durationMs: 1527.7
maxEvents: 1000
maxDurationMs: 30000
eventCount: 15
truncated: false
correlation: temporal-only
clock: performance.now
ordering: observation-time-then-sequence
coverage:
  request: {status:available,code:resource-timing-and-fetch}
  query: {status:unavailable,code:no-query-client}
  react: {status:available,code:react-root-commits}
  navigation: {status:unavailable,code:no-tanstack-router}
queryValues: hashed
genieRequestsExcluded: 16
[exit 0]

$ npx genie-react call timeline_read '{"id":"timeline-0cf89c75-ff33-4609-9d52-bc5643babfff"}' --session art-m3 --fields domain,type,atMs,details
[15]:
  each: {domain:react,type:commit,details:{rendererId:1,renderDurationUnavailable:null}}
  - {atMs:23.4,details:{renderDurationMs:0.3,documentCommitId:17}}
  - {atMs:25.6,details:{renderDurationMs:0.1,documentCommitId:18}}
  - {atMs:27.2,details:{renderDurationMs:0.4,documentCommitId:19}}
  - {atMs:29.5,details:{renderDurationMs:0.3,documentCommitId:20}}
  - {atMs:31.7,details:{renderDurationMs:0.3,documentCommitId:21}}
  - {atMs:35.7,details:{renderDurationMs:0.2,documentCommitId:22}}
  - {atMs:37.5,details:{renderDurationMs:0.1,documentCommitId:23}}
  - {atMs:38.3,details:{renderDurationMs:0.2,documentCommitId:24}}
  - {atMs:39.5,details:{renderDurationMs:0.2,documentCommitId:25}}
  - {atMs:40.3,details:{renderDurationMs:0.1,documentCommitId:26}}
  - {atMs:42.2,details:{renderDurationMs:0.3,documentCommitId:27}}
  - {atMs:43.2,details:{renderDurationMs:0.1,documentCommitId:28}}
  - {atMs:44.3,details:{renderDurationMs:0.2,documentCommitId:29}}
  - {atMs:353.2,details:{renderDurationMs:0.1,documentCommitId:30}}
  - {atMs:1353.3,details:{renderDurationMs:0.1,documentCommitId:31}}
[exit 0]
## typing run 2

$ agent-browser --session art-m3 open http://127.0.0.1:5223/issues
✓ Acme Tracker
  http://127.0.0.1:5223/issues
[exit 0]

$ agent-browser --session art-m3 wait '.issue-row'
✓ Done
[exit 0]

$ id=$(npx genie-react call timeline_start '{"name":"type view name"}' --session art-m3 --json | jq -r .id)
{"id":"timeline-fae8f0e4-525c-47a7-8fe6-eaea63c8bc2b","name":"type view name","state":"recording","stopReason":null,"durationMs":0,"maxEvents":1000,"maxDurationMs":30000,"eventCount":0,"truncated":false,"correlation":"temporal-only","clock":"performance.now","ordering":"observation-time-then-sequence","coverage":{"request":{"status":"available","code":"resource-timing-and-fetch","detail":"Fetch/XHR Resource Timing joined with the app's fetch and XMLHttpRequest calls made during the recording, which add method, outcome (including an abort after the response headers), when the app finished reading the body, and requests still in flight at stop. A request the app sent through a fetch reference captured before recording has method null. Requests seen only through those calls, and requests still in flight, are added when the recording stops. Requests started before recording may appear without a method. Worker and non-fetch/XHR requests are absent. Cross-origin detailed timing and responseReceived require Timing-Allow-Origin. URLs omit credentials and fragments; query parameter values are salted hashes unless queryValues is plain."},"query":{"status":"unavailable","code":"no-query-client","detail":"No QueryClient supplied. Only the supplied QueryCache is observed."},"react":{"status":"available","code":"react-root-commits","detail":"Supported development React root commits; hook must precede React. renderDurationMs is root actualDuration when positive, otherwise null with renderDurationUnavailable saying why; not commit wall time, native UI timing, effects or component attribution. No Fiber tree traversal."},"navigation":{"status":"unavailable","code":"no-tanstack-router","detail":"No TanStack Router supplied; other routers and native navigation are not observed."}},"queryValues":"hashed","genieRequestsExcluded":0}
id=timeline-fae8f0e4-525c-47a7-8fe6-eaea63c8bc2b

$ agent-browser --session art-m3 type 'input[aria-label="View name"]' 'Sprint triage'
✓ Done
[exit 0]

$ npx genie-react call react_quiesce '{"idleMs":500,"timeoutMs":10000}' --session art-m3
ok: true
outcome: idle
elapsedMs: 927
observedCommits: 1
documentCommitId: 30
sessionId: befa9dee-9cdc-4c9c-bdc0-5d56795d5b11
renderCollection: available
pendingWork:
  documentCommitId: 30
  scheduledRoots: 0
  suspendedBoundaries: 0
  dehydratedBoundaries: 0
  boundaries: []
  scanTruncated: false
  scannedFibers: 2254
[exit 0]

$ npx genie-react call timeline_stop '{"id":"timeline-fae8f0e4-525c-47a7-8fe6-eaea63c8bc2b"}' --session art-m3
id: timeline-fae8f0e4-525c-47a7-8fe6-eaea63c8bc2b
name: "type view name"
state: stopped
stopReason: manual
durationMs: 1544.1
maxEvents: 1000
maxDurationMs: 30000
eventCount: 15
truncated: false
correlation: temporal-only
clock: performance.now
ordering: observation-time-then-sequence
coverage:
  request: {status:available,code:resource-timing-and-fetch}
  query: {status:unavailable,code:no-query-client}
  react: {status:available,code:react-root-commits}
  navigation: {status:unavailable,code:no-tanstack-router}
queryValues: hashed
genieRequestsExcluded: 16
[exit 0]

$ npx genie-react call timeline_read '{"id":"timeline-fae8f0e4-525c-47a7-8fe6-eaea63c8bc2b"}' --session art-m3 --fields domain,type,atMs,details
[15]:
  each: {domain:react,type:commit,details:{rendererId:1}}
  - {atMs:18,details:{renderDurationMs:0.2,renderDurationUnavailable:null,documentCommitId:17}}
  - {atMs:19.7,details:{renderDurationMs:0.2,renderDurationUnavailable:null,documentCommitId:18}}
  - {atMs:20.8,details:{renderDurationMs:0.1,renderDurationUnavailable:null,documentCommitId:19}}
  - {atMs:21.8,details:{renderDurationMs:0.1,renderDurationUnavailable:null,documentCommitId:20}}
  - {atMs:22.7,details:{renderDurationMs:0.2,renderDurationUnavailable:null,documentCommitId:21}}
  - {atMs:23.8,details:{renderDurationMs:null,renderDurationUnavailable:below-clock-resolution,documentCommitId:22}}
  - {atMs:24.6,details:{renderDurationMs:null,renderDurationUnavailable:below-clock-resolution,documentCommitId:23}}
  - {atMs:25.3,details:{renderDurationMs:0.1,renderDurationUnavailable:null,documentCommitId:24}}
  - {atMs:26.2,details:{renderDurationMs:0.1,renderDurationUnavailable:null,documentCommitId:25}}
  - {atMs:26.8,details:{renderDurationMs:0.1,renderDurationUnavailable:null,documentCommitId:26}}
  - {atMs:27.5,details:{renderDurationMs:0.1,renderDurationUnavailable:null,documentCommitId:27}}
  - {atMs:28.2,details:{renderDurationMs:0.1,renderDurationUnavailable:null,documentCommitId:28}}
  - {atMs:28.9,details:{renderDurationMs:null,renderDurationUnavailable:below-clock-resolution,documentCommitId:29}}
  - {atMs:537,details:{renderDurationMs:0.1,renderDurationUnavailable:null,documentCommitId:30}}
  - {atMs:1539.2,details:{renderDurationMs:0.1,renderDurationUnavailable:null,documentCommitId:31}}
[exit 0]
## typing run 3

$ agent-browser --session art-m3 open http://127.0.0.1:5223/issues
✓ Acme Tracker
  http://127.0.0.1:5223/issues
[exit 0]

$ agent-browser --session art-m3 wait '.issue-row'
✓ Done
[exit 0]

$ id=$(npx genie-react call timeline_start '{"name":"type view name"}' --session art-m3 --json | jq -r .id)
{"id":"timeline-949c494f-de32-43c5-9e56-cb119778c414","name":"type view name","state":"recording","stopReason":null,"durationMs":0,"maxEvents":1000,"maxDurationMs":30000,"eventCount":0,"truncated":false,"correlation":"temporal-only","clock":"performance.now","ordering":"observation-time-then-sequence","coverage":{"request":{"status":"available","code":"resource-timing-and-fetch","detail":"Fetch/XHR Resource Timing joined with the app's fetch and XMLHttpRequest calls made during the recording, which add method, outcome (including an abort after the response headers), when the app finished reading the body, and requests still in flight at stop. A request the app sent through a fetch reference captured before recording has method null. Requests seen only through those calls, and requests still in flight, are added when the recording stops. Requests started before recording may appear without a method. Worker and non-fetch/XHR requests are absent. Cross-origin detailed timing and responseReceived require Timing-Allow-Origin. URLs omit credentials and fragments; query parameter values are salted hashes unless queryValues is plain."},"query":{"status":"unavailable","code":"no-query-client","detail":"No QueryClient supplied. Only the supplied QueryCache is observed."},"react":{"status":"available","code":"react-root-commits","detail":"Supported development React root commits; hook must precede React. renderDurationMs is root actualDuration when positive, otherwise null with renderDurationUnavailable saying why; not commit wall time, native UI timing, effects or component attribution. No Fiber tree traversal."},"navigation":{"status":"unavailable","code":"no-tanstack-router","detail":"No TanStack Router supplied; other routers and native navigation are not observed."}},"queryValues":"hashed","genieRequestsExcluded":0}
id=timeline-949c494f-de32-43c5-9e56-cb119778c414

$ agent-browser --session art-m3 type 'input[aria-label="View name"]' 'Sprint triage'
✓ Done
[exit 0]

$ npx genie-react call react_quiesce '{"idleMs":500,"timeoutMs":10000}' --session art-m3
ok: true
outcome: idle
elapsedMs: 777
observedCommits: 1
documentCommitId: 30
sessionId: 7464942e-de93-4bab-bd38-cac2302d3dbb
renderCollection: available
pendingWork:
  documentCommitId: 30
  scheduledRoots: 0
  suspendedBoundaries: 0
  dehydratedBoundaries: 0
  boundaries: []
  scanTruncated: false
  scannedFibers: 2254
[exit 0]

$ npx genie-react call timeline_stop '{"id":"timeline-949c494f-de32-43c5-9e56-cb119778c414"}' --session art-m3
id: timeline-949c494f-de32-43c5-9e56-cb119778c414
name: "type view name"
state: stopped
stopReason: manual
durationMs: 1460.3
maxEvents: 1000
maxDurationMs: 30000
eventCount: 14
truncated: false
correlation: temporal-only
clock: performance.now
ordering: observation-time-then-sequence
coverage:
  request: {status:available,code:resource-timing-and-fetch}
  query: {status:unavailable,code:no-query-client}
  react: {status:available,code:react-root-commits}
  navigation: {status:unavailable,code:no-tanstack-router}
queryValues: hashed
genieRequestsExcluded: 16
[exit 0]

$ npx genie-react call timeline_read '{"id":"timeline-949c494f-de32-43c5-9e56-cb119778c414"}' --session art-m3 --fields domain,type,atMs,details
[14]:
  each: {domain:react,type:commit,details:{rendererId:1}}
  - {atMs:21.8,details:{renderDurationMs:0.4,renderDurationUnavailable:null,documentCommitId:17}}
  - {atMs:24.5,details:{renderDurationMs:0.4,renderDurationUnavailable:null,documentCommitId:18}}
  - {atMs:26.9,details:{renderDurationMs:0.3,renderDurationUnavailable:null,documentCommitId:19}}
  - {atMs:30.7,details:{renderDurationMs:0.3,renderDurationUnavailable:null,documentCommitId:20}}
  - {atMs:33.1,details:{renderDurationMs:0.3,renderDurationUnavailable:null,documentCommitId:21}}
  - {atMs:34.9,details:{renderDurationMs:0.2,renderDurationUnavailable:null,documentCommitId:22}}
  - {atMs:36.8,details:{renderDurationMs:0.2,renderDurationUnavailable:null,documentCommitId:23}}
  - {atMs:38.3,details:{renderDurationMs:null,renderDurationUnavailable:below-clock-resolution,documentCommitId:24}}
  - {atMs:39.7,details:{renderDurationMs:0.2,renderDurationUnavailable:null,documentCommitId:25}}
  - {atMs:41,details:{renderDurationMs:0.2,renderDurationUnavailable:null,documentCommitId:26}}
  - {atMs:42.4,details:{renderDurationMs:0.3,renderDurationUnavailable:null,documentCommitId:27}}
  - {atMs:43.7,details:{renderDurationMs:0.1,renderDurationUnavailable:null,documentCommitId:28}}
  - {atMs:44.8,details:{renderDurationMs:0.2,renderDurationUnavailable:null,documentCommitId:29}}
  - {atMs:523.6,details:{renderDurationMs:0.1,renderDurationUnavailable:null,documentCommitId:30}}
[exit 0]
$ git checkout -- apps/realworld-legacy   # fix reverted
~~~~
