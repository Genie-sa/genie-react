# Evidence: your-agent-cant-read-the-react-profiler

- Date: 2026-11-19 (log timestamps are local time, UTC+3)
- Commit: `6867352ba46ec3998fe8cda0ba915536fddfa666`
- App: `apps/realworld-dashboard` (Meridian Ops, Vite 8, React 19.3.1 in StrictMode), dev server `DASHBOARD_PORT=5222`, URL `http://127.0.0.1:5222/`
- Genie: workspace build of `genie-react` and `@genie-react/cli` 1.0.2 at that commit
- React DevTools: standalone `react-devtools` 8.0.0 (Electron 23.3.13, header shows `8.0.0-1d34f91dfd`) from npm in `/tmp/art-m2/rdt`, started with
  `PORT=8298 ./node_modules/.bin/react-devtools --remote-debugging-port=9298`. Electron's own installer exited without unpacking on Node 26,
  so the cached `electron-v23.3.13-darwin-arm64.zip` was unpacked into `node_modules/electron/dist` with `ditto` and `path.txt` was written by hand.
- Browser driver: agent-browser 0.43.0, session `art-m2`, headless
- Seeded bug: `evals/realworld/dashboard/dashboard-sidebar-rerenders-cards.json`. The reference fix was applied only for the "after" verify run and reverted with `git checkout`.

## How the runs were done

Takes A to C2 ran on a scratch copy, `apps/art-m2-scratch-profiler`: the dashboard with Genie unchanged plus
`<script src="http://localhost:8298"></script>` as the first tag in `<head>` of `index.html`, so the React DevTools Profiler and Genie
recorded the same click. The copy was served on port 5222 and deleted afterwards. The verify runs at the end used the unchanged app.

The Profiler UI was driven over the Chrome DevTools Protocol with the script below (`/tmp/art-m2/tools/cdp.mjs`): `eval` runs JavaScript
in the DevTools window, `shot` saves a screenshot. Screenshots: `node cdp.mjs shot <file> 1400 900`.

```js
// usage: node cdp.mjs eval '<js>' | node cdp.mjs shot <path> [w h]
const [, , cmd, arg, w, h] = process.argv
const list = await (await fetch('http://127.0.0.1:9298/json/list')).json()
const page = list.find((t) => t.type === 'page')
const ws = new WebSocket(page.webSocketDebuggerUrl)
let id = 0
const pending = new Map()
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) } }
await new Promise((r) => (ws.onopen = r))
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })) })
if (cmd === 'eval') {
  const r = await send('Runtime.evaluate', { expression: arg, awaitPromise: true, returnByValue: true })
  console.log(JSON.stringify(r.result?.result?.value ?? r.result, null, 1))
} else if (cmd === 'shot') {
  if (w) await send('Emulation.setDeviceMetricsOverride', { width: +w, height: +h, deviceScaleFactor: 2, mobile: false })
  const r = await send('Page.captureScreenshot', { format: 'png' })
  const fs = await import('node:fs')
  fs.writeFileSync(arg, Buffer.from(r.result.data, 'base64'))
  console.log('saved', arg)
}
ws.close()

```

Steps that ran outside the logging wrapper, with their output:

- Open the Profiler tab: clicked the label with text `Profiler`. The empty state read "No profiling data has been recorded".
- After take B, clicked the `StatCard (Memo) (0.2ms of 0.3ms)` bar. The side panel text was `"Rendered at:\n1s for 6ms"`. Screenshot: `profiler-statcard.png`.
- Take B screenshot: `profiler-flamegraph.png` (one commit; "What caused this update? AppShell"; Render 6ms).
- Settings, Profiler tab: `Record why each component rendered while profiling checked=false` before the change, then turned on.
- Take C and C2 screenshot: `profiler-record-why-empty.png` ("No profiling data has been recorded").

The screenshots are in `apps/docs/public/articles/your-agent-cant-read-the-react-profiler/`, resized to 1400 px wide.

Every logged command ran through a wrapper that appended the command, its combined stdout and stderr, and its exit code.
Lines in square brackets are notes written at the time. No value was changed.

## Full log

```text
[setup] scratch copy apps/art-m2-scratch-profiler = apps/realworld-dashboard with Genie unchanged plus the standalone React DevTools script tag; react-devtools 8.0.0 standalone started with PORT=8298 and --remote-debugging-port=9298 so its UI can be scripted over CDP
3a4
>     <script src="http://localhost:8298"></script>

[07:09:02] $ agent-browser --session art-m2 open http://127.0.0.1:5222/login
[agent-browser] launched browser
✓ Meridian Ops
  http://127.0.0.1:5222/login
[exit 0]

[07:09:05] $ npx genie-react status --session art-m2 --wait 15000 | grep -E '^(ready|app):'
ready: true
app: {name:"Meridian Ops",url:http://127.0.0.1:5222/login,reactVersion:19.3.1,reactMounted:true}
[exit 0]

[07:09:05] $ node /tmp/art-m2/tools/cdp.mjs eval 'document.body.innerText.slice(0,200)'
"8.0.0-1d34f91dfd\nComponents\nProfiler\nSuspense\nQueryClientProvider\nContext.Provider\nAuthProvider\nContext.Provider\nApp\nRouterProvider\nRouterContextProvider\nContext.Provider\nMatches\nTransitioner\nSuspense"
[exit 0]

[07:09:17] $ npx genie-react call app_login_as '{"role":"manager"}' --session art-m2
changed: true
role: manager
userId: u-manager
[exit 0]

[07:09:17] $ agent-browser --session art-m2 open http://127.0.0.1:5222/
✓ Meridian Ops
  http://127.0.0.1:5222/
[exit 0]

[07:09:18] $ npx genie-react call devtools_wait '{"condition":"settled","timeoutMs":10000}' --session art-m2 | head -3
ok: true
condition: settled
waitedMs: 934
[exit 0]

[07:09:19] $ agent-browser --session art-m2 snapshot -i | head -12
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
  - heading "Good morning, Priya" [level=1, ref=e12]
[exit 0]

===== take A: one sidebar collapse recorded by the React DevTools Profiler (default settings) and Genie at the same time =====

[07:09:41] $ npx genie-react call react_clear_renders '{}' --session art-m2 | head -3
ok: true
tracking: true
documentCommitId: 12
[exit 0]

[07:09:41] $ node /tmp/art-m2/tools/cdp.mjs eval '(()=>{const b=[...document.querySelectorAll("button")].find(b=>b.getAttribute("title")==="Start recording"); b.click(); return "clicked Start recording"})()'
{
 "result": {
  "type": "object",
  "subtype": "error",
  "className": "TypeError",
  "description": "TypeError: Cannot read properties of undefined (reading 'click')\n    at <anonymous>:1:112\n    at <anonymous>:1:155",
  "objectId": "7246306590243680481.1.1"
 },
 "exceptionDetails": {
  "exceptionId": 1,
  "text": "Uncaught",
  "lineNumber": 0,
  "columnNumber": 111,
  "scriptId": "248",
  "exception": {
   "type": "object",
   "subtype": "error",
   "className": "TypeError",
   "description": "TypeError: Cannot read properties of undefined (reading 'click')\n    at <anonymous>:1:112\n    at <anonymous>:1:155",
   "objectId": "7246306590243680481.1.2"
  }
 }
}
[exit 0]

[07:09:42] $ agent-browser --session art-m2 click @e2
✓ Done
[exit 0]

[07:09:42] $ npx genie-react call react_quiesce '{"idleMs":500,"timeoutMs":10000}' --fail-on-result-error --session art-m2 | head -4
ok: true
outcome: idle
elapsedMs: 749
observedCommits: 0
[exit 0]

[07:09:43] $ node /tmp/art-m2/tools/cdp.mjs eval '(()=>{const b=[...document.querySelectorAll("button")].find(b=>b.getAttribute("title")==="Stop recording"); b.click(); return "clicked Stop recording"})()'
{
 "result": {
  "type": "object",
  "subtype": "error",
  "className": "TypeError",
  "description": "TypeError: Cannot read properties of undefined (reading 'click')\n    at <anonymous>:1:111\n    at <anonymous>:1:153",
  "objectId": "7246306590243680481.1.1"
 },
 "exceptionDetails": {
  "exceptionId": 2,
  "text": "Uncaught",
  "lineNumber": 0,
  "columnNumber": 110,
  "scriptId": "249",
  "exception": {
   "type": "object",
   "subtype": "error",
   "className": "TypeError",
   "description": "TypeError: Cannot read properties of undefined (reading 'click')\n    at <anonymous>:1:111\n    at <anonymous>:1:153",
   "objectId": "7246306590243680481.1.2"
  }
 }
}
[exit 0]

[07:09:45] $ agent-browser --session art-m2 snapshot -i | grep -i sidebar
  - button "Expand sidebar" [ref=e2]
[exit 0]
[note] take A is void: the CDP selector for the record button matched nothing, so the Profiler never recorded. Expanding the sidebar again and repeating as take B.

[07:10:01] $ agent-browser --session art-m2 click @e2
✓ Done
[exit 0]

[07:10:02] $ agent-browser --session art-m2 snapshot -i | grep -i sidebar
  - button "Collapse sidebar" [ref=e2]
[exit 0]

===== take B =====

[07:10:02] $ npx genie-react call react_clear_renders '{}' --session art-m2 | head -3
ok: true
tracking: true
documentCommitId: 14
[exit 0]

[07:10:02] $ node /tmp/art-m2/tools/cdp.mjs eval 'document.querySelector("button[class*=RecordToggle]").click(); document.querySelector("button[class*=RecordToggle]").className'
"Button___1-PiG InactiveRecordToggle___2CUtF"
[exit 0]

[07:10:03] $ agent-browser --session art-m2 click @e2
✓ Done
[exit 0]

[07:10:03] $ npx genie-react call react_quiesce '{"idleMs":500,"timeoutMs":10000}' --fail-on-result-error --session art-m2 | head -4
ok: true
outcome: idle
elapsedMs: 731
observedCommits: 0
[exit 0]

[07:10:04] $ node /tmp/art-m2/tools/cdp.mjs eval 'document.querySelector("button[class*=RecordToggle]").click(); document.querySelector("button[class*=RecordToggle]").className'
"Button___1-PiG ActiveRecordToggle___1Cpcb"
[exit 0]

[07:10:06] $ agent-browser --session art-m2 snapshot -i | grep -i sidebar
  - button "Expand sidebar" [ref=e2]
[exit 0]

[07:10:15] $ npx genie-react call react_get_renders '{"sort":"renders","limit":15,"appOnly":true}' --session art-m2 --fields name,renders,necessity,necessityReason
[15]:
  each: {renders:1}
  - {name:AppShell,necessity:necessary,necessityReason:dom-changed}
  - {name:PreferencesProvider,necessity:necessary,necessityReason:dom-changed}
  - {name:SidebarNav,necessity:necessary,necessityReason:dom-changed}
  - {name:sidebar-nav.tsx,necessity:necessary,necessityReason:dom-changed}
  - {name:sidebar-nav.tsx,necessity:necessary,necessityReason:dom-changed}
  - {name:sidebar-nav.tsx,necessity:necessary,necessityReason:dom-changed}
  - {name:sidebar-nav.tsx,necessity:necessary,necessityReason:dom-changed}
  - {name:sidebar-nav.tsx,necessity:necessary,necessityReason:dom-changed}
  - {name:sidebar-nav.tsx,necessity:necessary,necessityReason:dom-changed}
  - {name:TopBar,necessity:unnecessary,necessityReason:inputs-unchanged}
  - {name:NotificationBell,necessity:unnecessary,necessityReason:inputs-unchanged}
  - {name:NotificationsDrawer,necessity:unknown,necessityReason:effects-scheduled}
  - {name:Drawer,necessity:unknown,necessityReason:effects-scheduled}
  - {name:OverlayFrame,necessity:unknown,necessityReason:effects-scheduled}
  - {name:UserMenu,necessity:unknown,necessityReason:callbacks-changed}
[exit 0]

[07:10:23] $ npx genie-react call react_get_renders '{"sort":"renders","limit":80,"appOnly":true}' --session art-m2 --fields name,renders,necessity,necessityReason
[41]:
  each: {renders:1}
  - {name:AppShell,necessity:necessary,necessityReason:dom-changed}
  - {name:PreferencesProvider,necessity:necessary,necessityReason:dom-changed}
  - {name:SidebarNav,necessity:necessary,necessityReason:dom-changed}
  - {name:sidebar-nav.tsx,necessity:necessary,necessityReason:dom-changed}
  - {name:sidebar-nav.tsx,necessity:necessary,necessityReason:dom-changed}
  - {name:sidebar-nav.tsx,necessity:necessary,necessityReason:dom-changed}
  - {name:sidebar-nav.tsx,necessity:necessary,necessityReason:dom-changed}
  - {name:sidebar-nav.tsx,necessity:necessary,necessityReason:dom-changed}
  - {name:sidebar-nav.tsx,necessity:necessary,necessityReason:dom-changed}
  - {name:TopBar,necessity:unnecessary,necessityReason:inputs-unchanged}
  - {name:NotificationBell,necessity:unnecessary,necessityReason:inputs-unchanged}
  - {name:NotificationsDrawer,necessity:unknown,necessityReason:effects-scheduled}
  - {name:Drawer,necessity:unknown,necessityReason:effects-scheduled}
  - {name:OverlayFrame,necessity:unknown,necessityReason:effects-scheduled}
  - {name:UserMenu,necessity:unknown,necessityReason:callbacks-changed}
  - {name:Avatar,necessity:unnecessary,necessityReason:inputs-unchanged}
  - {name:StatCard,necessity:unnecessary,necessityReason:output-unchanged}
  - {name:StatCard,necessity:unnecessary,necessityReason:output-unchanged}
  - {name:StatCard,necessity:unnecessary,necessityReason:output-unchanged}
  - {name:StatCard,necessity:unnecessary,necessityReason:output-unchanged}
  - {name:OrdersTrendCard,necessity:unknown,necessityReason:callbacks-changed}
  - {name:Card,necessity:unknown,necessityReason:callbacks-changed}
  - {name:CardHeader,necessity:unknown,necessityReason:callbacks-changed}
  - {name:Select,necessity:unknown,necessityReason:callbacks-changed}
  - {name:CardBody,necessity:unnecessary,necessityReason:output-unchanged}
  - {name:LineChart,necessity:unnecessary,necessityReason:output-unchanged}
  - {name:RevenueByRegionCard,necessity:unknown,necessityReason:effects-scheduled}
  - {name:Card,necessity:unnecessary,necessityReason:inputs-unchanged}
  - {name:CardHeader,necessity:unnecessary,necessityReason:inputs-unchanged}
  - {name:CardBody,necessity:unnecessary,necessityReason:inputs-unchanged}
  - {name:BarList,necessity:unnecessary,necessityReason:inputs-unchanged}
  - {name:RecentActivityCard,necessity:unknown,necessityReason:effects-scheduled}
  - {name:Card,necessity:unnecessary,necessityReason:output-unchanged}
  - {name:CardHeader,necessity:unnecessary,necessityReason:inputs-unchanged}
  - {name:CardBody,necessity:unnecessary,necessityReason:output-unchanged}
  - {name:Avatar,necessity:unnecessary,necessityReason:inputs-unchanged}
  - {name:Avatar,necessity:unnecessary,necessityReason:inputs-unchanged}
  - {name:Avatar,necessity:unnecessary,necessityReason:inputs-unchanged}
  - {name:Avatar,necessity:unnecessary,necessityReason:inputs-unchanged}
  - {name:Avatar,necessity:unnecessary,necessityReason:inputs-unchanged}
  - {name:Avatar,necessity:unnecessary,necessityReason:inputs-unchanged}
[exit 0]

[07:10:28] $ npx genie-react call react_render_causes '{"component":"StatCard","limit":1}' --session art-m2
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
events[1] (componentName #componentId {fields}, then ← kind evidence name {fields} per cause):
  StatCard #17220923031780 {renderEventId:render:15:209,documentCommitId:15,mountId:mount:52,necessity:unnecessary,necessityReason:output-unchanged,inputEvidence:incomplete,inputCoverage:{complete:false,scanTruncated:true},source:{location:/src/features/dashboard/dashboard-page.tsx:55:9,role:element-callsite,ownership:app}}
    ← context exact "Context(PreferencesProvider)" {contextIndex:0}
omittedByLimit: 3
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
    - {reason:inputs-truncated,fibers:9,components:[NotificationsDrawer,UserMenu,StatCard,OrdersTrendCard,RevenueByRegionCard,RecentActivityCard],detail:"An input held values Genie compares only in part, such as functions, class instances or objects past the inspected depth; read deepDiff.truncated on these components."}
  complete: false
  inputAttributionComplete: false
  semantics: lower-bound
  coverageDomain: render-causality
  droppedRenderEvents: 0
[exit 0]

[07:10:28] $ npx genie-react call react_render_causes '{"component":"PreferencesProvider","limit":1}' --session art-m2 --select /events
status: ok
selection: {expression:/events,matchedPathCount:1,matchedPaths:[/events],omittedPathCount:57}
result[1]:
  - {renderEventId:render:15:158,documentCommitId:15,componentId:17220923031604,componentName:PreferencesProvider,mountId:mount:4,causes:[{kind:parent,evidence:inferred,name:AppShell},{kind:children,evidence:exact}],necessity:necessary,necessityReason:dom-changed,inputEvidence:changed,source:{location:/src/layout/app-shell.tsx:36:5,role:element-callsite,ownership:app}}
[exit 0]

[07:10:32] $ npx genie-react call react_render_causes '{"component":"StatCard","limit":1,"view":"full"}' --session art-m2 --json | jq -c '.events[0].causes'
[{"kind":"context","evidence":"exact","contextIndex":0,"contextId":"context:1","name":"Context(PreferencesProvider)","provider":{"componentId":17220923031604,"componentName":"PreferencesProvider"},"before":{"formatMoney":{"__genie_dehydrated__":true,"kind":"function","preview":"ƒ formatMoney()","path":["formatMoney"]},"formatCompactMoney":{"__genie_dehydrated__":true,"kind":"function","preview":"ƒ formatCompactMoney()","path":["formatCompactMoney"]},"formatNumber":{"__genie_dehydrated__":true,"kind":"function","preview":"ƒ formatNumber()","path":["formatNumber"]},"formatPercent":{"__genie_dehydrated__":true,"kind":"function","preview":"ƒ formatPercent()","path":["formatPercent"]},"formatDate":{"__genie_dehydrated__":true,"kind":"function","preview":"ƒ formatDate()","path":["formatDate"]},"formatDateTime":{"__genie_dehydrated__":true,"kind":"function","preview":"ƒ formatDateTime()","path":["formatDateTime"]},"formatRelative":{"__genie_dehydrated__":true,"kind":"function","preview":"ƒ formatRelative()","path":["formatRelative"]},"theme":"light","resolvedTheme":"light","locale":"en-US","setTheme":{"__genie_dehydrated__":true,"kind":"function","preview":"ƒ setTheme()","path":["setTheme"]},"setLocale":{"__genie_dehydrated__":true,"kind":"function","preview":"ƒ setLocale()","path":["setLocale"]}},"after":{"formatMoney":{"__genie_dehydrated__":true,"kind":"function","preview":"ƒ formatMoney()","path":["formatMoney"]},"formatCompactMoney":{"__genie_dehydrated__":true,"kind":"function","preview":"ƒ formatCompactMoney()","path":["formatCompactMoney"]},"formatNumber":{"__genie_dehydrated__":true,"kind":"function","preview":"ƒ formatNumber()","path":["formatNumber"]},"formatPercent":{"__genie_dehydrated__":true,"kind":"function","preview":"ƒ formatPercent()","path":["formatPercent"]},"formatDate":{"__genie_dehydrated__":true,"kind":"function","preview":"ƒ formatDate()","path":["formatDate"]},"formatDateTime":{"__genie_dehydrated__":true,"kind":"function","preview":"ƒ formatDateTime()","path":["formatDateTime"]},"formatRelative":{"__genie_dehydrated__":true,"kind":"function","preview":"ƒ formatRelative()","path":["formatRelative"]},"theme":"light","resolvedTheme":"light","locale":"en-US","setTheme":{"__genie_dehydrated__":true,"kind":"function","preview":"ƒ setTheme()","path":["setTheme"]},"setLocale":{"__genie_dehydrated__":true,"kind":"function","preview":"ƒ setLocale()","path":["setLocale"]}},"deepDiff":{"changes":[{"kind":"identity-changed-uninspected","path":"/setTheme"},{"kind":"identity-changed-uninspected","path":"/setLocale"}],"visited":13,"truncated":true}}]
[exit 0]
[take C setup] React DevTools settings > Profiler: 'Record why each component rendered while profiling' was checked=false by default; turning it on
true

[07:11:30] $ agent-browser --session art-m2 click @e2
✓ Done
[exit 0]

===== take C: same collapse, Profiler with 'Record why each component rendered' on =====

[07:11:31] $ agent-browser --session art-m2 snapshot -i | grep -i sidebar
  - button "Collapse sidebar" [ref=e2]
[exit 0]

[07:11:31] $ npx genie-react call react_clear_renders '{}' --session art-m2 | head -3
ok: true
tracking: true
documentCommitId: 16
[exit 0]

[07:11:31] $ node /tmp/art-m2/tools/cdp.mjs eval 'document.querySelector("button[class*=RecordToggle]").click(); "toggled record"'
"toggled record"
[exit 0]

[07:11:32] $ agent-browser --session art-m2 click @e2
✓ Done
[exit 0]

[07:11:32] $ npx genie-react call react_quiesce '{"idleMs":500,"timeoutMs":10000}' --fail-on-result-error --session art-m2 | head -4
ok: true
outcome: idle
elapsedMs: 731
observedCommits: 0
[exit 0]

[07:11:33] $ node /tmp/art-m2/tools/cdp.mjs eval 'document.querySelector("button[class*=RecordToggle]").click(); "toggled record"'
"toggled record"
[exit 0]

[07:11:35] $ agent-browser --session art-m2 snapshot -i | grep -i sidebar
  - button "Expand sidebar" [ref=e2]
[exit 0]

[07:11:35] $ agent-browser --session art-m2 console | grep -c 'instrumentation encountered an error'
1
[exit 0]

[07:11:50] $ agent-browser --session art-m2 console --json | jq '[.. | strings | select(test("instrumentation encountered an error"))] | length'
2
[exit 0]

[07:11:50] $ agent-browser --session art-m2 click @e2
✓ Done
[exit 0]

===== take C2: repeat of take C (Record why on), expand then collapse =====

[07:11:51] $ node /tmp/art-m2/tools/cdp.mjs eval 'document.querySelector("button[class*=RecordToggle]").click(); "toggled record"'
"toggled record"
[exit 0]

[07:11:52] $ agent-browser --session art-m2 click @e2
✓ Done
[exit 0]

[07:11:53] $ node /tmp/art-m2/tools/cdp.mjs eval 'document.querySelector("button[class*=RecordToggle]").click(); "toggled record"'
"toggled record"
[exit 0]

[07:11:55] $ agent-browser --session art-m2 snapshot -i | grep -i sidebar
  - button "Expand sidebar" [ref=e2]
[exit 0]

[07:11:55] $ node /tmp/art-m2/tools/cdp.mjs eval 'document.body.innerText.includes("No profiling data has been recorded")'
true
[exit 0]

[07:11:55] $ agent-browser --session art-m2 console --json | jq '[.. | strings | select(test("instrumentation encountered an error"))] | length'
4
[exit 0]
Bippy instrumentation encountered an error: {stack: "Error: Unknown Fiber. Needs to be a function compo…drenRecursively (http://localhost:8298/:10519:26)", message: "Unknown Fiber. Needs to be a funct
Error: Unknown Fiber. Needs to be a function component to inspect hooks.
    at inspectHooksOfFiberImpl (http://localhost:8298/:651:70)
    at __webpack_modules__.786.exports.inspectHooksOfFiber (http://localhost:8298/:705:10)
    at inspectHooks (http://localhost:8298/:11323:55)
    at getChangeDescription (http://localhost:8298/:8813:27)
    at recordProfilingDurations (http://localhost:8298/:10271:37)
    at updateFiberRecursively (http://localhost:8298/:10823:15)
    at updateVirtualChildrenRecursively (http://localhost:8298/:10514:26)
    at updateChildrenRecursively (http://localhost:8298/:10547:12)
    at updateFiberRecursively (http://localhost:8298/:10776:26)
    at updateVirtualChildrenRecursively (http://localhost:8298/:10519:26)
---
Bippy instrumentation encountered an error: {stack: "Error: Unknown Fiber. Needs to be a function compo…drenRecursively (http://localhost:8298/:10519:26)", message: "Unknown Fiber. Needs to be a funct
Error: Unknown Fiber. Needs to be a function component to inspect hooks.
    at inspectHooksOfFiberImpl (http://localhost:8298/:651:70)
    at __webpack_modules__.786.exports.inspectHooksOfFiber (http://localhost:8298/:705:10)
    at inspectHooks (http://localhost:8298/:11323:55)
    at getChangeDescription (http://localhost:8298/:8813:27)
    at recordProfilingDurations (http://localhost:8298/:10271:37)
    at updateFiberRecursively (http://localhost:8298/:10823:15)
    at updateVirtualChildrenRecursively (http://localhost:8298/:10514:26)
    at updateChildrenRecursively (http://localhost:8298/:10547:12)
    at updateFiberRecursively (http://localhost:8298/:10776:26)
    at updateVirtualChildrenRecursively (http://localhost:8298/:10519:26)
---
[teardown] closed agent-browser art-m2 and the standalone React DevTools (Electron) started for this run

===== proof on the real app: apps/realworld-dashboard (no scratch changes), verify before and after the reference fix for PreferencesProvider =====

[07:12:41] $ agent-browser --session art-m2 open http://127.0.0.1:5222/login
[agent-browser] launched browser
✓ Meridian Ops
  http://127.0.0.1:5222/login
[exit 0]

[07:12:43] $ npx genie-react status --session art-m2 --wait 15000 | grep -E '^(ready|app):'
ready: true
app: {name:"Meridian Ops",url:http://127.0.0.1:5222/login,reactVersion:19.3.1,reactMounted:true}
[exit 0]

[07:12:44] $ npx genie-react call app_login_as '{"role":"manager"}' --session art-m2
changed: true
role: manager
userId: u-manager
[exit 0]

[07:12:44] $ agent-browser --session art-m2 open http://127.0.0.1:5222/
✓ Meridian Ops
  http://127.0.0.1:5222/
[exit 0]

[07:12:45] $ npx genie-react call devtools_wait '{"condition":"settled","timeoutMs":10000}' --session art-m2 | head -3
ok: true
condition: settled
waitedMs: 776
[exit 0]

[07:12:46] $ agent-browser --session art-m2 snapshot -i | grep -i sidebar
  - button "Collapse sidebar" [ref=e2]
[exit 0]

[07:12:50] $ npx genie-react verify begin --session art-m2 --name "collapse sidebar" --claim 'render StatCard max 0' --claim 'render SidebarNav min 1' | head -2
recording vfy_221d972e-6836-407d-bba6-9f6065f3aac2 "collapse sidebar"
  url "http://127.0.0.1:5222/"
[exit 0]

[07:12:51] $ agent-browser --session art-m2 click @e2
✓ Done
[exit 0]

[07:12:51] $ npx genie-react verify end vfy_221d972e-6836-407d-bba6-9f6065f3aac2 --session art-m2
fail vfy_221d972e-6836-407d-bba6-9f6065f3aac2 "collapse sidebar"  1 commit, quiet after 743 ms (react, query, router)
  url "http://127.0.0.1:5222/"
  1 fail render StatCard max 0  {renders:4,mounts:0,updates:4,remounts:0,semantics:exact,instances:4,activeInstances:4}
      claim: {kind:renders,target:{component:StatCard},max:0,counting:renders,allowRemount:false}
      deciding: [{kind:instance,mountId:mount:1,renders:1,mounts:0,updates:1,mountGeneration:1,latestDocumentCommitId:13,source:/src/features/dashboard/dashboard-page.tsx:35:9},{kind:instance,mountId:mount:2,renders:1,mounts:0,updates:1,mountGeneration:1,latestDocumentCommitId:13,source:/src/features/dashboard/dashboard-page.tsx:42:9},{kind:instance,mountId:mount:3,renders:1,mounts:0,updates:1,mountGeneration:1,latestDocumentCommitId:13,source:/src/features/dashboard/dashboard-page.tsx:49:9}]
  2 pass render SidebarNav min 1  {renders:1,mounts:0,updates:1,remounts:0,semantics:exact,instances:1,activeInstances:1}
      claim: {kind:renders,target:{component:SidebarNav},min:1,counting:renders,allowRemount:false}
      deciding: [{kind:instance,mountId:mount:5,renders:1,mounts:0,updates:1,mountGeneration:1,latestDocumentCommitId:13,source:/src/layout/app-shell.tsx:38:9}]
window: {observationId:observation:1,startDocumentCommitId:12,settledDocumentCommitId:13,frozenDocumentCommitId:13,commits:1,settle:{outcome:met,quietMs:500,timeoutMs:10000,waitedMs:743,domains:{react:met,query:met,router:met}},tail:{ms:500,commits:0},environment:{bundle:development,strictMode:on,renderCollection:available,visibility:document}}
! ui-outcome-not-observed: Genie does not check the screen; confirm it with the UI driver
attempt 1 for these claims on this tab
evidence: $ pnpm exec genie-react verify show vfy_221d972e-6836-407d-bba6-9f6065f3aac2 --claim 1 --session art-m2
session: {sessionId:bc9e3a49-1f16-4233-b970-f4b102929260,logicalSessionId:55a21247-53db-44b0-a57a-d3f511e514a4,documentGeneration:2}
schemaVersion: "1.0"
exitCode: 1
stage: end
ledger: {fingerprint:cf_f19e0e358a80,scope:logical-session,storage:memory,attempt:1,history:[],codeChangedSincePrevious:null,failsOnSameCode:0}
evidence: {retained:true,tools:[react_get_renders,react_component_cohort,react_list_overrides,query_is_fetching,react_refresh_events,browser_visibility,react_profile_stop]}
startedAt: 2026-11-19T04:12:51.225Z
endedAt: 2026-11-19T04:12:52.802Z
request: {budget:{fiberLimit:250,operationLimit:20000,timeLimitMs:8,targetOperationReserve:4000,targetTimeReserveMs:4,adaptive:true},settle:{quietMs:500,timeoutMs:10000},maxDurationMs:300000,allowOverrides:false}
[exit 1]

[07:12:58] $ git diff apps/realworld-dashboard/src/app/preferences.tsx
fatal: ambiguous argument 'apps/realworld-dashboard/src/app/preferences.tsx': unknown revision or path not in the working tree.
Use '--' to separate paths from revisions, like this:
'git <command> [<revision>...] -- [<file>...]'
[exit 128]
[note] the git diff above ran from apps/realworld-dashboard with a repo-relative path; rerun with the app-relative path:

[07:13:06] $ git diff src/app/preferences.tsx
diff --git a/apps/realworld-dashboard/src/app/preferences.tsx b/apps/realworld-dashboard/src/app/preferences.tsx
index d58f840..a186283 100644
--- a/apps/realworld-dashboard/src/app/preferences.tsx
+++ b/apps/realworld-dashboard/src/app/preferences.tsx
@@ -1,4 +1,4 @@
-import { createContext, type ReactNode, useContext, useEffect, useMemo, useState } from 'react'
+import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react'
 import { createFormatters, type Formatters, LOCALES, type Locale } from '../lib/format'
 
 export type Theme = 'light' | 'dark' | 'system'
@@ -41,23 +41,19 @@ export function PreferencesProvider({ children }: { children: ReactNode }) {
     document.documentElement.lang = locale
   }, [resolvedTheme, locale])
 
-  const setTheme = (next: Theme) => {
+  const setTheme = useCallback((next: Theme) => {
     window.localStorage.setItem(THEME_KEY, next)
     setThemeState(next)
-  }
-  const setLocale = (next: Locale) => {
+  }, [])
+  const setLocale = useCallback((next: Locale) => {
     window.localStorage.setItem(LOCALE_KEY, next)
     setLocaleState(next)
-  }
+  }, [])
 
-  const value: PreferencesContextValue = {
-    ...formatters,
-    theme,
-    resolvedTheme,
-    locale,
-    setTheme,
-    setLocale,
-  }
+  const value = useMemo<PreferencesContextValue>(
+    () => ({ ...formatters, theme, resolvedTheme, locale, setTheme, setLocale }),
+    [formatters, theme, resolvedTheme, locale, setTheme, setLocale],
+  )
   return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>
 }
 
[exit 0]

[07:13:11] $ agent-browser --session art-m2 open http://127.0.0.1:5222/
✓ Meridian Ops
  http://127.0.0.1:5222/
[exit 0]

[07:13:11] $ npx genie-react call devtools_wait '{"condition":"settled","timeoutMs":10000}' --session art-m2 | head -3
ok: true
condition: settled
waitedMs: 921
[exit 0]

[07:13:12] $ agent-browser --session art-m2 snapshot -i | grep -i sidebar
  - button "Expand sidebar" [ref=e23]
[exit 0]

[07:13:16] $ agent-browser --session art-m2 click @e23
✓ Done
[exit 0]

[07:13:18] $ agent-browser --session art-m2 snapshot -i | grep -i sidebar
  - button "Collapse sidebar" [ref=e23]
[exit 0]

[07:13:18] $ npx genie-react verify begin --session art-m2 --name "collapse sidebar" --claim 'render StatCard max 0' --claim 'render SidebarNav min 1' | head -2
recording vfy_889a43a7-889b-4d57-932a-498e005142c8 "collapse sidebar"
  url "http://127.0.0.1:5222/"
[exit 0]

[07:13:18] $ agent-browser --session art-m2 click @e23
✓ Done
[exit 0]

[07:13:18] $ npx genie-react verify end vfy_889a43a7-889b-4d57-932a-498e005142c8 --session art-m2
pass vfy_889a43a7-889b-4d57-932a-498e005142c8 "collapse sidebar"  1 commit, quiet after 720 ms (react, query, router)
  url "http://127.0.0.1:5222/"
  1 pass render StatCard max 0  {renders:0,mounts:0,updates:0,remounts:0,semantics:exact,instances:4,activeInstances:4}
      claim: {kind:renders,target:{component:StatCard},max:0,counting:renders,allowRemount:false}
      deciding: [{kind:coverage,complete:true,targetedComplete:true,semantics:exact},{kind:instance,mountId:mount:1,renderingState:mounted-rendering,source:/src/features/dashboard/dashboard-page.tsx:35:9},{kind:instance,mountId:mount:2,renderingState:mounted-rendering,source:/src/features/dashboard/dashboard-page.tsx:42:9}]
  2 pass render SidebarNav min 1  {renders:1,mounts:0,updates:1,remounts:0,semantics:exact,instances:1,activeInstances:1}
      claim: {kind:renders,target:{component:SidebarNav},min:1,counting:renders,allowRemount:false}
      deciding: [{kind:instance,mountId:mount:5,renders:1,mounts:0,updates:1,mountGeneration:1,latestDocumentCommitId:14,source:/src/layout/app-shell.tsx:38:9}]
window: {observationId:observation:1,startDocumentCommitId:13,settledDocumentCommitId:14,frozenDocumentCommitId:14,commits:1,settle:{outcome:met,quietMs:500,timeoutMs:10000,waitedMs:720,domains:{react:met,query:met,router:met}},tail:{ms:500,commits:0},environment:{bundle:development,strictMode:on,renderCollection:available,visibility:document}}
! ui-outcome-not-observed: Genie does not check the screen; confirm it with the UI driver
attempt 2 for these claims on this tab; previous fail vfy_221d972e-6836-407d-bba6-9f6065f3aac2; document reloaded since
evidence: $ pnpm exec genie-react verify show vfy_889a43a7-889b-4d57-932a-498e005142c8 --session art-m2
session: {sessionId:f63fe739-83fe-42f7-b87b-f37baaaa1629,logicalSessionId:55a21247-53db-44b0-a57a-d3f511e514a4,documentGeneration:3}
schemaVersion: "1.0"
exitCode: 0
stage: end
ledger: {fingerprint:cf_f19e0e358a80,scope:logical-session,storage:memory,attempt:2,history:[{verificationId:vfy_221d972e-6836-407d-bba6-9f6065f3aac2,verdict:fail,reasons:[],endedAt:2026-11-19T04:12:52.802Z}],codeChangedSincePrevious:document-reloaded,failsOnSameCode:0}
evidence: {retained:true,tools:[react_get_renders,react_component_cohort,react_list_overrides,query_is_fetching,react_refresh_events,browser_visibility,react_profile_stop]}
startedAt: 2026-11-19T04:13:18.329Z
endedAt: 2026-11-19T04:13:19.839Z
request: {budget:{fiberLimit:250,operationLimit:20000,timeLimitMs:8,targetOperationReserve:4000,targetTimeReserveMs:4,adaptive:true},settle:{quietMs:500,timeoutMs:10000},maxDurationMs:300000,allowOverrides:false}
[exit 0]

[07:13:28] $ git checkout -- src/app/preferences.tsx && git status --short
?? ../art-m2-scratch-dashboard/
?? ../art-m2-scratch-profiler/
[exit 0]
[teardown] stopped the dev server on 5222 and closed agent-browser session art-m2

```
