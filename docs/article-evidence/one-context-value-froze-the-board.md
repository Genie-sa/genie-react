# Evidence: one-context-value-froze-the-board

- Date: 2026-11-19
- Commit: 6867352ba46ec3998fe8cda0ba915536fddfa666 (`git rev-parse HEAD`)
- App: `apps/realworld-legacy` (Acme Tracker), dev server at http://127.0.0.1:5212, standalone Genie hub on port 5213
- Genie: `genie-react` CLI 1.0.2 from this checkout (`npx genie-react` run from `apps/realworld-legacy`), agent-browser 0.39.1
- Session: `art-l2`
- Answer key: `evals/realworld/legacy/feature-flags-provider-value.json`

Absolute paths are shortened: `<repo>` is the checkout root and `<tmp>` is the system temp directory. No other value is changed. Each command is followed by its full output and its exit code as `[exit N]`. Lines starting with `#` are notes written during the run.

## Setup

```
$ pnpm install && pnpm build          # repo root, exit 0
$ pnpm install --offline              # repo root, exit 0; links the freshly built CLI into apps/realworld-legacy/node_modules/.bin
$ cd apps/realworld-legacy
$ GENIE_HUB_PORT=5213 pnpm hub
$ PORT=5212 GENIE_HUB_PORT=5213 pnpm exec webpack serve --mode development --port 5212
```

The first `pnpm hub` started before the CLI bin was linked, so it ran an older global `genie-react` (0.12.2). I stopped that hub, ran `pnpm install --offline`, and restarted it. `npx genie-react --version` then printed `1.0.2`. Every command below ran against the 1.0.2 hub.

Hub output after the restart:

```
> @genie-react/realworld-legacy@ hub <repo>/apps/realworld-legacy
> genie-react hub --port ${GENIE_HUB_PORT:-4712}

ok hub_ready: The local hub is available.
```

## Commands and output, in order

The reference fix was applied with a Python string replace of the two `find` strings from the answer key, then reverted with `git checkout -- apps/realworld-legacy/src/contexts/feature-flags.tsx`. Its diff:

```diff
diff --git a/apps/realworld-legacy/src/contexts/feature-flags.tsx b/apps/realworld-legacy/src/contexts/feature-flags.tsx
index 34b793b..28cd180 100644
--- a/apps/realworld-legacy/src/contexts/feature-flags.tsx
+++ b/apps/realworld-legacy/src/contexts/feature-flags.tsx
@@ -1,19 +1,19 @@
-import { createContext, type ReactNode, useContext } from 'react'
+import { createContext, type ReactNode, useContext, useMemo } from 'react'
 
 export interface FeatureFlagsValue {
   flags: Record<string, boolean>
   isEnabled: (name: string) => boolean
 }
 
 const FeatureFlagsContext = createContext<FeatureFlagsValue>({ flags: {}, isEnabled: () => false })
 
 interface FeatureFlagsProviderProps {
   flags: Record<string, boolean>
   children: ReactNode
 }
 
 export function FeatureFlagsProvider({ flags, children }: FeatureFlagsProviderProps) {
-  const value = { flags, isEnabled: (name: string) => flags[name] === true }
+  const value = useMemo(() => ({ flags, isEnabled: (name: string) => flags[name] === true }), [flags])
   return <FeatureFlagsContext.Provider value={value}>{children}</FeatureFlagsContext.Provider>
 }
 
```

```
$ agent-browser --session art-l2 open 'http://127.0.0.1:5212/login'
✓ Acme Tracker
  http://127.0.0.1:5212/login
[exit 0]

$ npx genie-react status --session art-l2 --wait 15000
selectedBridgeUrl: ws://127.0.0.1:5213/__genie/ws
sessionSelector:
  requested: art-l2
  source: flag
  resolvedSessionId: a3bd648f-2e09-456d-92ce-0707a41fb34f
  implicit: false
  agentBrowser: {session:art-l2,via:selector,logicalSessionId:78de5a45-c576-47c7-b2e0-a17f611dd5ff}
connected: true
ready: true
sessionId: a3bd648f-2e09-456d-92ce-0707a41fb34f
app: {name:"Acme Tracker",url:http://127.0.0.1:5212/login,reactVersion:18.3.1,reactMounted:true}
domains: [session,react,memory,perf,timeline,redux,app]
toolCount: 61
sessions[1] (sessionId {fields}):
  a3bd648f-2e09-456d-92ce-0707a41fb34f {logicalSessionId:78de5a45-c576-47c7-b2e0-a17f611dd5ff,documentGeneration:2,predecessorSessionId:8ad230ab-823e-4cd5-a555-1a156b80e0a4,logicalSessionCollision:false,collisionWithSessionIds:[],app:{name:"Acme Tracker",url:http://127.0.0.1:5212/login,reactVersion:18.3.1,reactMounted:true},domains:[session,react,memory,perf,timeline,redux,app],toolCount:61,connectedAt:1795060315114,ready:true,readyAt:1795060315114,current:true,origin:http://127.0.0.1:5212,originUnverified:true,runtimeVersion:1.0.2}
warnings: []
hub: {version:1.0.2,protocol:1}
[exit 0]

$ npx genie-react call app_sign_in '{}' --session art-l2
user: {id:u-1,name:"Dana Whitfield",email:dana@acme.test,title:Designer,team:Infra}
[exit 0]

$ agent-browser --session art-l2 open 'http://127.0.0.1:5212/board'
✓ Acme Tracker
  http://127.0.0.1:5212/board
[exit 0]

$ npx genie-react status --session art-l2 --wait 15000 --select /app
status: ok
selection: {expression:/app,matchedPathCount:1,matchedPaths:[/app],omittedPathCount:48}
result: {name:"Acme Tracker",url:http://127.0.0.1:5212/board,reactVersion:18.3.1,reactMounted:true}
[exit 0]

$ agent-browser --session art-l2 snapshot -i | head -30
- generic "☰Acme TrackerSynced 0s agoNew issue🔔4DWBoardIssuesReportsSettingsProjectsCORECore PlatformWEBWeb Ap" [ref=e1] clickable [onclick]
  - button "Toggle sidebar" [ref=e2]
  - link "Acme Tracker" [ref=e3]
  - searchbox "Search issues" [ref=e11]
  - button "New issue" [ref=e4]
  - button "Notifications, 4 unread" [expanded=false, ref=e12]
  - button "Account" [expanded=false, ref=e13]
  - link "Board" [ref=e14]
  - link "Issues" [ref=e15]
  - link "Reports" [ref=e16]
  - link "Settings" [ref=e17]
  - heading "PROJECTS" [level=2, ref=e18]
  - link "CORE Core Platform" [ref=e25]
  - link "WEB Web App" [ref=e26]
  - link "MOB Mobile" [ref=e27]
  - link "OPS Operations" [ref=e28]
  - link "DATA Data Pipeline" [ref=e29]
  - link "SEC Security" [ref=e30]
  - link "DOCS Documentation" [ref=e31]
  - link "INFRA Infrastructure" [ref=e32]
  - heading "Core Platform board" [level=1, ref=e5]
  - searchbox "Filter cards" [ref=e19]
  - region "Backlog" [ref=e6]
    - heading "Backlog" [level=2, ref=e20]
    - button "CORE-1 Migrate push notification opt-out" [ref=e33]
    - combobox "Priority of CORE-1" [expanded=false, ref=e34]: Urgent
      - option "Urgent" [selected, ref=e873]
      - option "High" [ref=e874]
      - option "Medium" [ref=e875]
      - option "Low" [ref=e876]
[exit 0]

$ npx genie-react call react_clear_renders '{"budget":{"adaptive":false,"fiberLimit":20000,"operationLimit":2000000,"timeLimitMs":500,"targetOperationReserve":100000,"targetTimeReserveMs":100}}' --session art-l2
ok: true
tracking: true
documentCommitId: 28
observation: {id:observation:1,epoch:1,startedAfterDocumentCommitId:28}
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
strictMode: unknown
[exit 0]

$ agent-browser --session art-l2 click 'button[aria-label="Toggle sidebar"]'
✓ Done
[exit 0]

$ npx genie-react call react_quiesce '{"idleMs":500,"timeoutMs":10000}' --fail-on-result-error --session art-l2
ok: true
outcome: idle
elapsedMs: 835
observedCommits: 1
documentCommitId: 31
sessionId: 8655b5f8-f22d-4c77-8742-245a97316f18
renderCollection: available
pendingWork:
  documentCommitId: 31
  scheduledRoots: 0
  suspendedBoundaries: 0
  dehydratedBoundaries: 0
  boundaries: []
  scanTruncated: false
  scannedFibers: 10567
[exit 0]

$ npx genie-react call react_get_renders '{"limit":12}' --session art-l2
tracking: true
renderCollection: available
bundle: development
timingsBundleDependent: true
countsScope: observed-run
commits: 3
documentCommitId: 31
observation: {id:observation:1,epoch:1,startedAfterDocumentCommitId:28}
attribution:
  status: current
  startedAtDocumentCommitId: 31
  completedAtDocumentCommitId: 31
  startedAtAnalysisGeneration: 32
  completedAtAnalysisGeneration: 32
view: summary
summary:
  commits: 3
  trackedComponents: 1277
  totalRenders: 1281
  totalUpdates: 1281
  referenceOnlyPropComponents: 0
  noObservedInputChangeComponents: 7
  topReferenceOnlyProps: []
  semantics: unknown
  coverageDomain: render-measurement
components[12] (name #id {fields}, then ← kind evidence name {fields} per cause):
  each: {source:{ownership:app}}
  LastSyncedLabel #8975944778198 {mountId:mount:17,renders:2,updates:2,noObservedInputChange:1,selfTime:0.1,totalTime:0.1,latestDocumentCommitId:31,causeCounts:{state:1,parent:1},necessity:necessary,necessityReason:dom-changed,inputEvidence:changed,source:{location:<repo>/apps/realworld-legacy/src/layout/top-bar.tsx:27:9,role:element-callsite}}
    ← state exact "state[0]"
  AccountMenu #8975944778210 {mountId:mount:20,renders:2,updates:2,noObservedInputChange:2,selfTime:0,totalTime:0.1,latestDocumentCommitId:30,causeCounts:{external-store:2},necessity:unnecessary,necessityReason:inputs-unchanged,inputEvidence:none-observed,source:{location:<repo>/apps/realworld-legacy/src/layout/top-bar.tsx:32:9,role:element-callsite}}
    ← external-store inferred anonymous-external-store {redux:{evidence:inferred,actions:[]}}
  Dropdown #8975944778211 {mountId:mount:21,renders:2,updates:2,selfTime:0,totalTime:0.1,latestDocumentCommitId:30,causeCounts:{children:2,parent:2},necessity:unknown,necessityReason:effects-scheduled,inputEvidence:changed,source:{location:<repo>/apps/realworld-legacy/src/layout/account-menu.tsx:15:5,role:element-callsite}}
    ← parent inferred AccountMenu
    ← children exact
  Avatar #8975944778214 {mountId:mount:22,renders:2,updates:2,noObservedInputChange:2,selfTime:0,totalTime:0.1,latestDocumentCommitId:30,causeCounts:{parent:2},necessity:unnecessary,necessityReason:inputs-unchanged,inputEvidence:none-observed,source:{location:<repo>/apps/realworld-legacy/src/layout/account-menu.tsx:25:13,role:element-callsite}}
    ← parent inferred Dropdown {origin:AccountMenu}
  AppShell #8975944778185 {mountId:mount:12,renders:1,updates:1,selfTime:0,totalTime:7.7,latestDocumentCommitId:29,causeCounts:{props:1,parent:1},necessity:necessary,necessityReason:dom-changed,inputEvidence:changed,wrappedBy:{componentId:8975944778183,componentName:"Connect(AppShell)",renderEventId:render:29:3,causes:[{kind:external-store,evidence:inferred,name:selector,redux:{evidence:exact,actions:[ui/sidebarToggled]}}],necessity:necessary,necessityReason:dom-changed},source:{location:<repo>/apps/realworld-legacy/src/layout/app-shell.tsx:23:5,role:component-body}}
    ← parent inferred "Connect(AppShell)"
    ← props exact sidebarCollapsed
  FeatureFlagsProvider #8975944778186 {mountId:mount:13,renders:1,updates:1,selfTime:0.1,totalTime:7.7,latestDocumentCommitId:29,causeCounts:{children:1,parent:1},necessity:necessary,necessityReason:dom-changed,inputEvidence:changed,source:{location:<repo>/apps/realworld-legacy/src/layout/app-shell.tsx:23:5,role:element-callsite}}
    ← parent inferred AppShell {origin:"Connect(AppShell)"}
    ← children exact
  TopBar #8975944778189 {mountId:mount:14,renders:1,updates:1,noObservedInputChange:1,selfTime:0.1,totalTime:0.2,latestDocumentCommitId:29,causeCounts:{parent:1},necessity:unnecessary,necessityReason:inputs-unchanged,inputEvidence:none-observed,source:{location:<repo>/apps/realworld-legacy/src/layout/app-shell.tsx:25:9,role:element-callsite}}
    ← parent inferred FeatureFlagsProvider {origin:"Connect(AppShell)"}
  GlobalSearch #8975944778194 {mountId:mount:16,renders:1,updates:1,noObservedInputChange:1,selfTime:0,totalTime:0,latestDocumentCommitId:29,causeCounts:{parent:1},necessity:unnecessary,necessityReason:inputs-unchanged,inputEvidence:none-observed,source:{location:<repo>/apps/realworld-legacy/src/layout/top-bar.tsx:25:7,role:element-callsite}}
    ← parent inferred TopBar {origin:"Connect(AppShell)"}
  Button #8975944778203 {mountId:mount:18,renders:1,updates:1,selfTime:0,totalTime:0,latestDocumentCommitId:29,causeCounts:{props:1,parent:1},necessity:unknown,necessityReason:callbacks-changed,inputEvidence:changed,source:{location:<repo>/apps/realworld-legacy/src/layout/top-bar.tsx:28:9,role:element-callsite}}
    ← parent inferred TopBar {origin:"Connect(AppShell)"}
    ← props exact onClick
  NotificationsMenu #8975944778205 {mountId:mount:19,renders:1,updates:1,noObservedInputChange:1,selfTime:0.1,totalTime:0.1,latestDocumentCommitId:29,causeCounts:{parent:1},necessity:unnecessary,necessityReason:inputs-unchanged,inputEvidence:none-observed,source:{location:<repo>/apps/realworld-legacy/src/layout/top-bar.tsx:31:9,role:element-callsite}}
    ← parent inferred TopBar {origin:"Connect(AppShell)"}
  SideNav #8975944778216 {mountId:mount:23,renders:1,updates:1,selfTime:0,totalTime:0.2,latestDocumentCommitId:29,causeCounts:{props:1,parent:1},necessity:necessary,necessityReason:dom-changed,inputEvidence:changed,source:{location:<repo>/apps/realworld-legacy/src/layout/app-shell.tsx:26:9,role:element-callsite}}
    ← parent inferred FeatureFlagsProvider {origin:"Connect(AppShell)"}
    ← props exact collapsed
  PriorityPicker #8975944778248 {mountId:mount:33,renders:1,updates:1,selfTime:0,totalTime:0,latestDocumentCommitId:29,causeCounts:{context:1},necessity:unknown,necessityReason:callbacks-changed,inputEvidence:incomplete,inputCoverage:{complete:false,scanTruncated:true},source:{location:<repo>/apps/realworld-legacy/src/features/board/board-card.tsx:20:9,role:element-callsite}}
    ← context exact "Context(FeatureFlagsProvider)" {contextIndex:1}
sourceClassification:
  complete: false
  affects: result
  totalCandidates: 1288
  evaluated: 1288
  app: 437
  library: 11
  unknown: 840
  unknownComponents: ["FeatureGate (<repo>/apps/realworld-legacy/src/features/board/card-meta.tsx)"]
  unknownComponentsOmitted: 0
omittedByLimit: 1265
nextCursor: 439f16fd-b978-4844-80f7-d3cb77ee0588:12
pagination:
  snapshotId: 439f16fd-b978-4844-80f7-d3cb77ee0588
  offset: 0
  totalComponents: 1277
  expiresAt: 1795060632386
comparable: false
notComparableReasons: [render-input-scan-truncated,app-source-classification-incomplete]
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
    - {reason:source-classification-incomplete,fibers:840,detail:"840 of 1288 candidates have unresolved ownership. appOnly keeps them, but any of them may be library code it would hide, so rows and counts can change once ownership resolves.",next:"Pass appOnly:false for counts that do not depend on ownership, or read again shortly: ownership keeps resolving in the background, though a component React rendered without an owner stack stays unknown."}
  complete: false
  inputAttributionComplete: false
  semantics: unknown
  coverageDomain: render-causality
filteredNote: "12 components shown; 11 library components hidden — set appOnly:false to include them"
[exit 0]

$ npx genie-react call react_get_renders '{"component":"FeatureGate","appOnly":false,"limit":2}' --session art-l2 --select /summary
status: ok
selection: {expression:/summary,matchedPathCount:1,matchedPaths:[/summary],omittedPathCount:103}
result:
  commits: 12
  trackedComponents: 840
  totalRenders: 840
  totalUpdates: 840
  referenceOnlyPropComponents: 0
  noObservedInputChangeComponents: 0
  topReferenceOnlyProps: []
  semantics: exact
  coverageDomain: render-measurement
[exit 0]

$ npx genie-react call react_get_renders '{"component":"PriorityPicker","appOnly":false,"limit":2}' --session art-l2 --select /summary
status: ok
selection: {expression:/summary,matchedPathCount:1,matchedPaths:[/summary],omittedPathCount:103}
result:
  commits: 12
  trackedComponents: 420
  totalRenders: 420
  totalUpdates: 420
  referenceOnlyPropComponents: 0
  noObservedInputChangeComponents: 0
  topReferenceOnlyProps: []
  semantics: exact
  coverageDomain: render-measurement
[exit 0]

$ npx genie-react call react_render_causes '{"component":"FeatureGate","limit":1}' --session art-l2
componentMatch:
  component: FeatureGate
  exact: true
  status: matched
  matchedNames: [FeatureGate]
  matchedNameCount: 1
  similarNames: []
tracking: true
commits: 13
documentCommitId: 41
observation: {id:observation:1,epoch:1,startedAfterDocumentCommitId:28}
attribution:
  status: current
  startedAtDocumentCommitId: 41
  completedAtDocumentCommitId: 41
  startedAtAnalysisGeneration: 42
  completedAtAnalysisGeneration: 42
view: summary
events[1] (componentName #componentId {fields}, then ← kind evidence name {fields} per cause):
  FeatureGate #8975944785683 {renderEventId:render:29:1292,documentCommitId:29,mountId:mount:1292,necessity:unnecessary,necessityReason:output-unchanged,inputEvidence:incomplete,inputCoverage:{complete:false,scanTruncated:true},source:{location:<repo>/apps/realworld-legacy/src/features/board/card-meta.tsx:12:7,role:element-callsite,ownership:unknown}}
    ← context exact "Context(FeatureFlagsProvider)" {contextIndex:0}
omittedByLimit: 641
sourceClassification:
  complete: false
  affects: result
  totalCandidates: 642
  evaluated: 642
  app: 0
  library: 0
  unknown: 642
  unknownComponents: [FeatureGate]
  unknownComponentsOmitted: 0
renderEventRetention: {evictedEvents:320,earliestDocumentCommitId:29,latestDocumentCommitId:41}
coverage:
  skippedCommitFibers: 0
  droppedUnmountFibers: 0
  analysisFailedFibers: 0
  pausedCommits: 0
  unobservedCommits: 0
  refreshCommitsExcluded: 0
  truncatedInputFibers: 1275
  propsNotEnumeratedFibers: 0
  budgetExhaustedCommits: 0
  budgetExhaustedSubsystems: []
  incompleteBecause[2]:
    - {reason:inputs-truncated,fibers:1275,components:[PriorityPicker,FeatureGate,BoardColumn],detail:"An input held values Genie compares only in part, such as functions, class instances or objects past the inspected depth; read deepDiff.truncated on these components."}
    - {reason:source-classification-incomplete,fibers:642,detail:"642 of 642 candidates have unresolved ownership. appOnly keeps them, but any of them may be library code it would hide, so rows and counts can change once ownership resolves.",next:"Pass appOnly:false for counts that do not depend on ownership, or read again shortly: ownership keeps resolving in the background, though a component React rendered without an owner stack stays unknown."}
  complete: false
  inputAttributionComplete: false
  semantics: unknown
  coverageDomain: render-causality
  droppedRenderEvents: 320
filteredNote: "1 components shown; 1 shown with ownership \"unknown\" because their source is unresolved"
[exit 0]

$ npx genie-react call react_render_causes '{"component":"FeatureGate","limit":1,"view":"full"}' --session art-l2 --select /events
status: ok
selection: {expression:/events,matchedPathCount:1,matchedPaths:[/events],omittedPathCount:58}
result[1]:
  - {renderEventId:render:29:1292,observationId:observation:1,commitId:1,documentCommitId:29,componentId:8975944785683,componentName:FeatureGate,instance:{fiberId:8975944785683,mountId:mount:1292,key:null,siblingIndex:1,parent:{fiberId:8975944785679,name:CardMeta,key:null},keyedParent:{fiberId:8975944785668,name:BoardCard,key:iss-417},logicalPath:"AppErrorBoundary[index=0] > Provider[index=0] > BrowserRouter[index=0] > Router[index=0] > ThemeProvider[index=0] > App[index=0] > Routes[index=0] > RenderedRoute[index=0] > RequireAuth[index=0] > Connect(AppShell)[index=0] > AppShell[index=0] > FeatureFlagsProvider[index=0] > <div>[index=0] > <main>[index=2] > Outlet[index=0] > RenderedRoute[index=0] > BoardPage[index=0] > <div>[index=0] > <div>[index=1] > BoardColumn[key=\"done\"] > <section>[index=0] > <ol>[index=1] > BoardCard[key=\"iss-417\"] > <li>[index=0] > CardMeta[index=2] > <div>[index=0] > FeatureGate[index=1]",logicalIdentityEvidence:positional,mountGeneration:1,mountGenerationEvidence:exact,hostSelector:null},causes:[{kind:context,evidence:exact,contextIndex:0,contextId:context:1,name:"Context(FeatureFlagsProvider)",provider:{componentId:8975944778186,componentName:FeatureFlagsProvider},before:{flags:{card-estimates:true,card-labels:true,inline-priority:true,reports-workload:true,issue-presence:true},isEnabled:{__genie_dehydrated__:true,kind:function,preview:"ƒ isEnabled()",path:[isEnabled]}},after:{flags:{card-estimates:true,card-labels:true,inline-priority:true,reports-workload:true,issue-presence:true},isEnabled:{__genie_dehydrated__:true,kind:function,preview:"ƒ isEnabled()",path:[isEnabled]}},deepDiff:{changes:[{kind:identity-changed-uninspected,path:/isEnabled}],visited:3,truncated:true}}],necessity:unnecessary,necessityReason:output-unchanged,assessment:{inputEvidence:incomplete,observedInputKinds:[context],behaviorEvidence:{subtreeHostMutations:{status:none-observed,count:0,pendingSubtrees:0,omittedByLimit:0,callbackOnlyUpdates:0,writes:[],callbacks:[]},scheduledEffects:{status:none-observed,count:0},subtreeScheduledEffects:{status:none-observed,count:0},unobservedDomains:[focus,url,network,transition,freshness,effect-execution]},optimizationSafety:not-proven-safe,requiredValidation:[dom,aria,focus,url,network,transition]},inputCoverage:{complete:false,omittedInputs:0,scanTruncated:true,propsNotEnumerated:false},source:{file:<repo>/apps/realworld-legacy/src/features/board/card-meta.tsx,line:12,column:7,functionName:null,sourceMapConfidence:served,role:element-callsite},sourceAttribution:{role:usage-or-definition-fallback,evidence:inferred},sourceOwnership:unknown,isLibrary:false}
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

$ npx genie-react verify begin --session art-l2 --name 'toggle the sidebar' --claim 'render FeatureGate max 0' --claim 'render SideNav min 1' --claim 'boundaries clean'
recording vfy_b01a49f5-d478-49f2-890c-8bf59e9dc9c8 "toggle the sidebar"
  url "http://127.0.0.1:5212/board"
  1 null render FeatureGate max 0  {}
  2 null render SideNav min 1  {}
  3 null boundaries clean  {}
window: {observationId:observation:2,startDocumentCommitId:60,domains:[react],quietMs:500,timeoutMs:10000,tailMs:500}
next: $ pnpm exec genie-react verify end vfy_b01a49f5-d478-49f2-890c-8bf59e9dc9c8 --session art-l2
session: {sessionId:8655b5f8-f22d-4c77-8742-245a97316f18,logicalSessionId:78de5a45-c576-47c7-b2e0-a17f611dd5ff,documentGeneration:3}
schemaVersion: "1.0"
targets: [{target:{component:FeatureGate},status:resolved,instances:200,source:<repo>/apps/realworld-legacy/src/features/board/card-meta.tsx},{target:{component:SideNav},status:resolved,instances:1,source:<repo>/apps/realworld-legacy/src/layout/app-shell.tsx}]
startedAt: 2026-11-19T03:52:36.781Z
expiresAt: 2026-11-19T03:57:36.835Z
request: {budget:{fiberLimit:250,operationLimit:20000,timeLimitMs:8,targetOperationReserve:4000,targetTimeReserveMs:4,adaptive:true},settle:{quietMs:500,timeoutMs:10000},maxDurationMs:300000,allowOverrides:false}
[exit 0]

$ agent-browser --session art-l2 click 'button[aria-label="Toggle sidebar"]'
✓ Done
[exit 0]

$ npx genie-react verify end vfy_b01a49f5-d478-49f2-890c-8bf59e9dc9c8 --session art-l2
fail vfy_b01a49f5-d478-49f2-890c-8bf59e9dc9c8 "toggle the sidebar"  7 commits, quiet after 645 ms (react)
  url "http://127.0.0.1:5212/board"
  1 fail render FeatureGate max 0  {renders:37,mounts:0,updates:37,remounts:0,semantics:lower-bound,instances:200,activeInstances:200}
      claim: {kind:renders,target:{component:FeatureGate},max:0,counting:renders,allowRemount:false}
      deciding: [{kind:instance,mountId:mount:34,renders:1,mounts:0,updates:1,mountGeneration:1,latestDocumentCommitId:64,source:<repo>/apps/realworld-legacy/src/features/board/card-meta.tsx:7:7},{kind:instance,mountId:mount:35,renders:1,mounts:0,updates:1,mountGeneration:1,latestDocumentCommitId:64,source:<repo>/apps/realworld-legacy/src/features/board/card-meta.tsx:12:7},{kind:instance,mountId:mount:37,renders:1,mounts:0,updates:1,mountGeneration:1,latestDocumentCommitId:64,source:<repo>/apps/realworld-legacy/src/features/board/card-meta.tsx:7:7}]
  2 pass render SideNav min 1  {renders:1,mounts:0,updates:1,remounts:0,semantics:lower-bound,instances:1,activeInstances:1}
      claim: {kind:renders,target:{component:SideNav},min:1,counting:renders,allowRemount:false}
      deciding: [{kind:instance,mountId:mount:23,renders:1,mounts:0,updates:1,mountGeneration:1,latestDocumentCommitId:64,source:<repo>/apps/realworld-legacy/src/layout/app-shell.tsx:26:9}]
      caveats: [count-is-a-lower-bound]
  3 pass boundaries clean  {caughtDuringWindow:0,caughtAtEnd:0}
      claim: {kind:boundaries-clean,scope:window}
      deciding: [{kind:boundary-log,scope:window,complete:true,afterDocumentCommitId:60}]
      caveats: [uncaught-errors-outside-boundaries-unobserved]
window: {observationId:observation:2,startDocumentCommitId:60,settledDocumentCommitId:66,frozenDocumentCommitId:67,commits:7,settle:{outcome:met,quietMs:500,timeoutMs:10000,waitedMs:645,domains:{react:met}},tail:{ms:500,commits:1},environment:{bundle:development,strictMode:unknown,renderCollection:available,visibility:unavailable}}
! ui-outcome-not-observed: Genie does not check the screen; confirm it with the UI driver
! visibility-unobserved: the app reports no visibility signal, so a hidden interval was not observed
attempt 1 for these claims on this tab
evidence: $ pnpm exec genie-react verify show vfy_b01a49f5-d478-49f2-890c-8bf59e9dc9c8 --claim 1 --session art-l2
session: {sessionId:8655b5f8-f22d-4c77-8742-245a97316f18,logicalSessionId:78de5a45-c576-47c7-b2e0-a17f611dd5ff,documentGeneration:3}
schemaVersion: "1.0"
exitCode: 1
stage: end
ledger: {fingerprint:cf_fc5ac1e5cce2,scope:logical-session,storage:memory,attempt:1,history:[],codeChangedSincePrevious:null,failsOnSameCode:0}
evidence: {retained:true,tools:[react_get_renders,react_component_cohort,react_list_overrides,react_refresh_events,react_profile_stop,react_error_state]}
startedAt: 2026-11-19T03:52:36.781Z
endedAt: 2026-11-19T03:52:41.688Z
request: {budget:{fiberLimit:250,operationLimit:20000,timeLimitMs:8,targetOperationReserve:4000,targetTimeReserveMs:4,adaptive:true},settle:{quietMs:500,timeoutMs:10000},maxDurationMs:300000,allowOverrides:false}
[exit 1]

$ npx genie-react verify begin --session art-l2 --name 'toggle the sidebar' --claim 'render FeatureGate max 0' --claim 'render SideNav min 1' --claim 'boundaries clean' --budget '{"adaptive":false,"fiberLimit":20000,"operationLimit":2000000,"timeLimitMs":500}'
recording vfy_8d095d2a-164a-4840-97fe-3c46536c4865 "toggle the sidebar"
  url "http://127.0.0.1:5212/board"
  1 null render FeatureGate max 0  {}
  2 null render SideNav min 1  {}
  3 null boundaries clean  {}
window: {observationId:observation:3,startDocumentCommitId:77,domains:[react],quietMs:500,timeoutMs:10000,tailMs:500}
next: $ pnpm exec genie-react verify end vfy_8d095d2a-164a-4840-97fe-3c46536c4865 --session art-l2
session: {sessionId:8655b5f8-f22d-4c77-8742-245a97316f18,logicalSessionId:78de5a45-c576-47c7-b2e0-a17f611dd5ff,documentGeneration:3}
schemaVersion: "1.0"
targets: [{target:{component:FeatureGate},status:resolved,instances:200,source:<repo>/apps/realworld-legacy/src/features/board/card-meta.tsx},{target:{component:SideNav},status:resolved,instances:1,source:<repo>/apps/realworld-legacy/src/layout/app-shell.tsx}]
startedAt: 2026-11-19T03:52:49.516Z
expiresAt: 2026-11-19T03:57:49.548Z
request: {budget:{fiberLimit:20000,operationLimit:2000000,timeLimitMs:500,targetOperationReserve:4000,targetTimeReserveMs:4,adaptive:false},settle:{quietMs:500,timeoutMs:10000},maxDurationMs:300000,allowOverrides:false}
[exit 0]

$ agent-browser --session art-l2 click 'button[aria-label="Toggle sidebar"]'
✓ Done
[exit 0]

$ npx genie-react verify end vfy_8d095d2a-164a-4840-97fe-3c46536c4865 --session art-l2
fail vfy_8d095d2a-164a-4840-97fe-3c46536c4865 "toggle the sidebar"  4 commits, quiet after 1270 ms (react)
  url "http://127.0.0.1:5212/board"
  1 fail render FeatureGate max 0  {renders:37,mounts:0,updates:37,remounts:0,semantics:lower-bound,instances:200,activeInstances:200}
      claim: {kind:renders,target:{component:FeatureGate},max:0,counting:renders,allowRemount:false}
      deciding: [{kind:instance,mountId:mount:34,renders:1,mounts:0,updates:1,mountGeneration:1,latestDocumentCommitId:78,source:<repo>/apps/realworld-legacy/src/features/board/card-meta.tsx:7:7},{kind:instance,mountId:mount:35,renders:1,mounts:0,updates:1,mountGeneration:1,latestDocumentCommitId:78,source:<repo>/apps/realworld-legacy/src/features/board/card-meta.tsx:12:7},{kind:instance,mountId:mount:37,renders:1,mounts:0,updates:1,mountGeneration:1,latestDocumentCommitId:78,source:<repo>/apps/realworld-legacy/src/features/board/card-meta.tsx:7:7}]
  2 pass render SideNav min 1  {renders:1,mounts:0,updates:1,remounts:0,semantics:lower-bound,instances:1,activeInstances:1}
      claim: {kind:renders,target:{component:SideNav},min:1,counting:renders,allowRemount:false}
      deciding: [{kind:instance,mountId:mount:23,renders:1,mounts:0,updates:1,mountGeneration:1,latestDocumentCommitId:78,source:<repo>/apps/realworld-legacy/src/layout/app-shell.tsx:26:9}]
      caveats: [count-is-a-lower-bound]
  3 pass boundaries clean  {caughtDuringWindow:0,caughtAtEnd:0}
      claim: {kind:boundaries-clean,scope:window}
      deciding: [{kind:boundary-log,scope:window,complete:true,afterDocumentCommitId:77}]
      caveats: [uncaught-errors-outside-boundaries-unobserved]
window: {observationId:observation:3,startDocumentCommitId:77,settledDocumentCommitId:80,frozenDocumentCommitId:81,commits:4,settle:{outcome:met,quietMs:500,timeoutMs:10000,waitedMs:1270,domains:{react:met}},tail:{ms:500,commits:1},environment:{bundle:development,strictMode:unknown,renderCollection:available,visibility:unavailable}}
! ui-outcome-not-observed: Genie does not check the screen; confirm it with the UI driver
! visibility-unobserved: the app reports no visibility signal, so a hidden interval was not observed
attempt 2 for these claims on this tab; previous fail vfy_b01a49f5-d478-49f2-890c-8bf59e9dc9c8; no code change observed
evidence: $ pnpm exec genie-react verify show vfy_8d095d2a-164a-4840-97fe-3c46536c4865 --claim 1 --session art-l2
session: {sessionId:8655b5f8-f22d-4c77-8742-245a97316f18,logicalSessionId:78de5a45-c576-47c7-b2e0-a17f611dd5ff,documentGeneration:3}
schemaVersion: "1.0"
exitCode: 1
stage: end
ledger: {fingerprint:cf_fc5ac1e5cce2,scope:logical-session,storage:memory,attempt:2,history:[{verificationId:vfy_b01a49f5-d478-49f2-890c-8bf59e9dc9c8,verdict:fail,reasons:[],endedAt:2026-11-19T03:52:41.688Z}],codeChangedSincePrevious:none-observed,failsOnSameCode:1}
evidence: {retained:true,tools:[react_get_renders,react_component_cohort,react_list_overrides,react_refresh_events,react_profile_stop,react_error_state]}
startedAt: 2026-11-19T03:52:49.516Z
endedAt: 2026-11-19T03:52:51.685Z
request: {budget:{fiberLimit:20000,operationLimit:2000000,timeLimitMs:500,targetOperationReserve:4000,targetTimeReserveMs:4,adaptive:false},settle:{quietMs:500,timeoutMs:10000},maxDurationMs:300000,allowOverrides:false}
[exit 1]

$ npx genie-react verify show vfy_8d095d2a-164a-4840-97fe-3c46536c4865 --claim 1 --session art-l2
truncated max_bytes: The result exceeded --max-bytes. Follow a suggestion, use --select on one of largestPaths, or lower a tool limit.
suggestions: []
maxBytes: 102400
originalBytes: 116597
omittedPathCount: 2489
largestPaths[5]:
  - {path:/evidence/beginInstances,bytes:73657,items:200}
  - {path:/evidence/endInstances,bytes:62627,items:200}
  - {path:/evidence/records,bytes:38965,items:37}
  - {path:/claim/deciding,bytes:806,items:3}
  - {path:/claim/observed,bytes:115}
topLevelPaths: [/claim,/evidence,/evidenceRetained,/verdict,/verificationId]
[exit 0]

# --- reference fix applied to src/contexts/feature-flags.tsx (diff in article), webpack rebuilt
$ agent-browser --session art-l2 open 'http://127.0.0.1:5212/board'
✓ Acme Tracker
  http://127.0.0.1:5212/board
[exit 0]

$ npx genie-react status --session art-l2 --wait 15000 --select /app
status: ok
selection: {expression:/app,matchedPathCount:1,matchedPaths:[/app],omittedPathCount:48}
result: {name:"Acme Tracker",url:http://127.0.0.1:5212/board,reactVersion:18.3.1,reactMounted:true}
[exit 0]

$ npx genie-react verify begin --session art-l2 --name 'toggle the sidebar' --claim 'render FeatureGate max 0' --claim 'render SideNav min 1' --claim 'boundaries clean' --budget '{"adaptive":false,"fiberLimit":20000,"operationLimit":2000000,"timeLimitMs":500}'
recording vfy_b9edc18c-b624-4476-8833-8ea57574c3da "toggle the sidebar"
  url "http://127.0.0.1:5212/board"
  1 null render FeatureGate max 0  {}
  2 null render SideNav min 1  {}
  3 null boundaries clean  {}
window: {observationId:observation:1,startDocumentCommitId:23,domains:[react],quietMs:500,timeoutMs:10000,tailMs:500}
next: $ pnpm exec genie-react verify end vfy_b9edc18c-b624-4476-8833-8ea57574c3da --session art-l2
session: {sessionId:07049bee-44fd-490c-a4af-88023577cf5c,logicalSessionId:78de5a45-c576-47c7-b2e0-a17f611dd5ff,documentGeneration:5}
schemaVersion: "1.0"
targets: [{target:{component:FeatureGate},status:resolved,instances:200,source:<repo>/apps/realworld-legacy/src/features/board/card-meta.tsx,unresolvedSources:80},{target:{component:SideNav},status:resolved,instances:1,source:<repo>/apps/realworld-legacy/src/layout/app-shell.tsx}]
startedAt: 2026-11-19T03:53:26.885Z
expiresAt: 2026-11-19T03:58:26.939Z
request: {budget:{fiberLimit:20000,operationLimit:2000000,timeLimitMs:500,targetOperationReserve:4000,targetTimeReserveMs:4,adaptive:false},settle:{quietMs:500,timeoutMs:10000},maxDurationMs:300000,allowOverrides:false}
[exit 0]

$ agent-browser --session art-l2 click 'button[aria-label="Toggle sidebar"]'
✓ Done
[exit 0]

$ npx genie-react verify end vfy_b9edc18c-b624-4476-8833-8ea57574c3da --session art-l2
pass vfy_b9edc18c-b624-4476-8833-8ea57574c3da "toggle the sidebar"  4 commits, quiet after 634 ms (react)
  url "http://127.0.0.1:5212/board"
  1 pass render FeatureGate max 0  {renders:0,mounts:0,updates:0,remounts:0,semantics:exact,instances:200,activeInstances:200}
      claim: {kind:renders,target:{component:FeatureGate},max:0,counting:renders,allowRemount:false}
      deciding: [{kind:coverage,complete:true,targetedComplete:true,semantics:exact},{kind:instance,mountId:mount:1,renderingState:mounted-rendering,source:<repo>/apps/realworld-legacy/src/features/board/card-meta.tsx:7:7},{kind:instance,mountId:mount:2,renderingState:mounted-rendering,source:<repo>/apps/realworld-legacy/src/features/board/card-meta.tsx:12:7}]
  2 pass render SideNav min 1  {renders:1,mounts:0,updates:1,remounts:0,semantics:exact,instances:1,activeInstances:1}
      claim: {kind:renders,target:{component:SideNav},min:1,counting:renders,allowRemount:false}
      deciding: [{kind:instance,mountId:mount:841,renders:1,mounts:0,updates:1,mountGeneration:1,latestDocumentCommitId:24,source:<repo>/apps/realworld-legacy/src/layout/app-shell.tsx:26:9}]
  3 pass boundaries clean  {caughtDuringWindow:0,caughtAtEnd:0}
      claim: {kind:boundaries-clean,scope:window}
      deciding: [{kind:boundary-log,scope:window,complete:true,afterDocumentCommitId:23}]
      caveats: [uncaught-errors-outside-boundaries-unobserved]
window: {observationId:observation:1,startDocumentCommitId:23,settledDocumentCommitId:26,frozenDocumentCommitId:27,commits:4,settle:{outcome:met,quietMs:500,timeoutMs:10000,waitedMs:634,domains:{react:met}},tail:{ms:500,commits:1},environment:{bundle:development,strictMode:unknown,renderCollection:available,visibility:unavailable}}
! ui-outcome-not-observed: Genie does not check the screen; confirm it with the UI driver
! visibility-unobserved: the app reports no visibility signal, so a hidden interval was not observed
attempt 3 for these claims on this tab; previous fail vfy_8d095d2a-164a-4840-97fe-3c46536c4865; document reloaded since
evidence: $ pnpm exec genie-react verify show vfy_b9edc18c-b624-4476-8833-8ea57574c3da --session art-l2
session: {sessionId:07049bee-44fd-490c-a4af-88023577cf5c,logicalSessionId:78de5a45-c576-47c7-b2e0-a17f611dd5ff,documentGeneration:5}
schemaVersion: "1.0"
exitCode: 0
stage: end
ledger: {fingerprint:cf_fc5ac1e5cce2,scope:logical-session,storage:memory,attempt:3,history:[{verificationId:vfy_b01a49f5-d478-49f2-890c-8bf59e9dc9c8,verdict:fail,reasons:[],endedAt:2026-11-19T03:52:41.688Z},{verificationId:vfy_8d095d2a-164a-4840-97fe-3c46536c4865,verdict:fail,reasons:[],endedAt:2026-11-19T03:52:51.685Z}],codeChangedSincePrevious:document-reloaded,failsOnSameCode:0}
evidence: {retained:true,tools:[react_get_renders,react_component_cohort,react_list_overrides,react_refresh_events,react_profile_stop,react_error_state]}
startedAt: 2026-11-19T03:53:26.885Z
endedAt: 2026-11-19T03:53:28.396Z
request: {budget:{fiberLimit:20000,operationLimit:2000000,timeLimitMs:500,targetOperationReserve:4000,targetTimeReserveMs:4,adaptive:false},settle:{quietMs:500,timeoutMs:10000},maxDurationMs:300000,allowOverrides:false}
[exit 0]

$ npx genie-react call react_clear_renders '{"budget":{"adaptive":false,"fiberLimit":20000,"operationLimit":2000000,"timeLimitMs":500,"targetOperationReserve":100000,"targetTimeReserveMs":100}}' --session art-l2 --select /ok
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

$ npx genie-react call react_get_renders '{"appOnly":false,"limit":15}' --session art-l2 --fields name,renders,causeCounts
[15]:
  - {name:LastSyncedLabel,renders:2,causeCounts:{state:1,parent:1}}
  - {name:AccountMenu,renders:2,causeCounts:{external-store:2}}
  - {name:Dropdown,renders:2,causeCounts:{children:2,parent:2}}
  - {name:Avatar,renders:2,causeCounts:{parent:2}}
  - {name:"Connect(AppShell)",renders:1,causeCounts:{external-store:1}}
  - {name:AppShell,renders:1,causeCounts:{props:1,parent:1}}
  - {name:FeatureFlagsProvider,renders:1,causeCounts:{children:1,parent:1}}
  - {name:TopBar,renders:1,causeCounts:{parent:1}}
  - {name:Link,renders:1,causeCounts:{parent:1}}
  - {name:GlobalSearch,renders:1,causeCounts:{parent:1}}
  - {name:Button,renders:1,causeCounts:{props:1,parent:1}}
  - {name:NotificationsMenu,renders:1,causeCounts:{parent:1}}
  - {name:SideNav,renders:1,causeCounts:{props:1,parent:1}}
  - {name:NavLink,renders:1,causeCounts:{props:1,parent:1}}
  - {name:Link,renders:1,causeCounts:{parent:1}}
[exit 0]

$ npx genie-react call react_get_renders '{"appOnly":false,"limit":1}' --session art-l2 --select /summary
status: ok
selection: {expression:/summary,matchedPathCount:1,matchedPaths:[/summary],omittedPathCount:78}
result:
  commits: 5
  trackedComponents: 38
  totalRenders: 82
  totalUpdates: 72
  referenceOnlyPropComponents: 0
  noObservedInputChangeComponents: 14
  topReferenceOnlyProps: [{name:projects,count:1}]
  semantics: exact
  coverageDomain: render-measurement
[exit 0]

$ npx genie-react call react_get_renders '{"appOnly":false,"limit":40}' --session art-l2 --fields name,renders,updates
[38]:
  - {name:LastSyncedLabel,renders:10,updates:10}
  - {name:AccountMenu,renders:4,updates:4}
  - {name:Dropdown,renders:4,updates:4}
  - {name:Avatar,renders:4,updates:4}
  - {name:NotificationsMenu,renders:3,updates:3}
  - {name:"Connect(ProjectNav)",renders:3,updates:2}
  - {name:ProjectNav,renders:3,updates:2}
  - {name:Link,renders:3,updates:2}
  - {name:Link,renders:3,updates:2}
  - {name:Link,renders:3,updates:2}
  - {name:Link,renders:3,updates:2}
  - {name:Link,renders:3,updates:2}
  - {name:Link,renders:3,updates:2}
  - {name:Link,renders:3,updates:2}
  - {name:Link,renders:3,updates:2}
  - {name:BoardColumn,renders:3,updates:3}
  - {name:BoardColumn,renders:3,updates:3}
  - {name:BoardColumn,renders:3,updates:3}
  - {name:BoardColumn,renders:3,updates:3}
  - {name:BoardColumn,renders:3,updates:3}
  - {name:"Connect(AppShell)",renders:1,updates:1}
  - {name:AppShell,renders:1,updates:1}
  - {name:FeatureFlagsProvider,renders:1,updates:1}
  - {name:TopBar,renders:1,updates:1}
  - {name:Link,renders:1,updates:1}
  - {name:GlobalSearch,renders:1,updates:1}
  - {name:Button,renders:1,updates:1}
  - {name:SideNav,renders:1,updates:1}
  - {name:NavLink,renders:1,updates:1}
  - {name:Link,renders:1,updates:1}
  - {name:NavLink,renders:1,updates:1}
  - {name:Link,renders:1,updates:1}
  - {name:NavLink,renders:1,updates:1}
  - {name:Link,renders:1,updates:1}
  - {name:NavLink,renders:1,updates:1}
  - {name:Link,renders:1,updates:1}
  - {name:Outlet,renders:1,updates:1}
  - {name:ToastStack,renders:1,updates:1}
[exit 0]

# --- after fix: one toggle, totals read right after quiesce
$ npx genie-react call react_clear_renders '{"budget":{"adaptive":false,"fiberLimit":20000,"operationLimit":2000000,"timeLimitMs":500,"targetOperationReserve":100000,"targetTimeReserveMs":100}}' --session art-l2 --select /ok
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

$ npx genie-react call react_get_renders '{"appOnly":false,"limit":1}' --session art-l2 --select /summary
status: ok
selection: {expression:/summary,matchedPathCount:1,matchedPaths:[/summary],omittedPathCount:74}
result:
  commits: 4
  trackedComponents: 28
  totalRenders: 33
  totalUpdates: 33
  referenceOnlyPropComponents: 0
  noObservedInputChangeComponents: 13
  topReferenceOnlyProps: []
  semantics: exact
  coverageDomain: render-measurement
[exit 0]

$ npx genie-react call react_get_renders '{"component":"FeatureGate","appOnly":false,"limit":1}' --session art-l2 --select /summary/totalUpdates
status: ok
selection:
  expression: /summary/totalUpdates
  matchedPathCount: 1
  matchedPaths: [/summary/totalUpdates]
  omittedPathCount: 68
result: 0
[exit 0]

$ npx genie-react call react_get_renders '{"component":"PriorityPicker","appOnly":false,"limit":1}' --session art-l2 --select /summary/totalUpdates
status: ok
selection:
  expression: /summary/totalUpdates
  matchedPathCount: 1
  matchedPaths: [/summary/totalUpdates]
  omittedPathCount: 68
result: 0
[exit 0]

$ npx genie-react call react_get_renders '{"component":"BoardColumn","appOnly":false,"limit":1}' --session art-l2 --select /summary/totalUpdates
status: ok
selection:
  expression: /summary/totalUpdates
  matchedPathCount: 1
  matchedPaths: [/summary/totalUpdates]
  omittedPathCount: 90
result: 5
[exit 0]

# --- fix reverted with git checkout; webpack rebuilt
$ agent-browser --session art-l2 open 'http://127.0.0.1:5212/board'
✓ Acme Tracker
  http://127.0.0.1:5212/board
[exit 0]

$ npx genie-react status --session art-l2 --wait 15000 --select /app
status: ok
selection: {expression:/app,matchedPathCount:1,matchedPaths:[/app],omittedPathCount:48}
result: {name:"Acme Tracker",url:http://127.0.0.1:5212/board,reactVersion:18.3.1,reactMounted:true}
[exit 0]

# --- before fix: one toggle, totals read right after quiesce
$ npx genie-react call react_clear_renders '{"budget":{"adaptive":false,"fiberLimit":20000,"operationLimit":2000000,"timeLimitMs":500,"targetOperationReserve":100000,"targetTimeReserveMs":100}}' --session art-l2 --select /ok
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

$ npx genie-react call react_get_renders '{"appOnly":false,"limit":1}' --session art-l2 --select /summary
status: ok
selection: {expression:/summary,matchedPathCount:1,matchedPaths:[/summary],omittedPathCount:80}
result:
  commits: 3
  trackedComponents: 1288
  totalRenders: 1292
  totalUpdates: 1292
  referenceOnlyPropComponents: 0
  noObservedInputChangeComponents: 13
  topReferenceOnlyProps: []
  semantics: exact
  coverageDomain: render-measurement
[exit 0]

$ npx genie-react call react_get_renders '{"component":"FeatureGate","appOnly":false,"limit":1}' --session art-l2 --select /summary/totalUpdates
status: ok
selection:
  expression: /summary/totalUpdates
  matchedPathCount: 1
  matchedPaths: [/summary/totalUpdates]
  omittedPathCount: 90
result: 840
[exit 0]

$ npx genie-react call react_get_renders '{"component":"PriorityPicker","appOnly":false,"limit":1}' --session art-l2 --select /summary/totalUpdates
status: ok
selection:
  expression: /summary/totalUpdates
  matchedPathCount: 1
  matchedPaths: [/summary/totalUpdates]
  omittedPathCount: 90
result: 420
[exit 0]

$ npx genie-react call react_get_renders '{"component":"BoardColumn","appOnly":false,"limit":1}' --session art-l2 --select /summary/totalUpdates
status: ok
selection:
  expression: /summary/totalUpdates
  matchedPathCount: 1
  matchedPaths: [/summary/totalUpdates]
  omittedPathCount: 94
result: 5
[exit 0]

```

## Inspection outside the log

After the second failing verification I read its stored evidence as JSON to see why it counted 37 renders. This ran between the second verification and applying the fix, and its full output (over 116 KB) was not kept. The command and the projection I printed:

```
$ npx genie-react verify show vfy_8d095d2a-164a-4840-97fe-3c46536c4865 --claim 1 --session art-l2 --json --max-bytes 5000000 > vshow.json
$ jq '{claim: .claim | del(.deciding), ev: (.evidence | del(.beginInstances,.endInstances,.records)), beginKeys: (.evidence.beginInstances[0]|keys), rec0: .evidence.records[0]}' vshow.json | head -120
{
  "claim": {
    "index": 1,
    "text": "render FeatureGate max 0",
    "claim": {
      "kind": "renders",
      "target": {
        "component": "FeatureGate"
      },
      "max": 0,
      "counting": "renders",
      "allowRemount": false
    },
    "verdict": "fail",
    "observed": {
      "renders": 37,
      "mounts": 0,
      "updates": 37,
      "remounts": 0,
      "semantics": "lower-bound",
      "instances": 200,
      "activeInstances": 200
    },
    "caveats": []
  },
  "ev": {
    "events": null,
    "effects": null
  },
  "beginKeys": [
    "key",
    "mountId",
    "renderingState",
    "sourceFile",
    "sourceLocation"
  ],
  "rec0": {
    "mountId": "mount:34",
    "key": null,
    "logicalPath": "AppErrorBoundary[index=0] > Provider[index=0] > BrowserRouter[index=0] > Router[index=0] > ThemeProvider[index=0] > App[index=0] > Routes[index=0] > RenderedRoute[index=0] > RequireAuth[index=0] > Connect(AppShell)[index=0] > AppShell[index=0] > FeatureFlagsProvider[index=0] > <div>[index=0] > <main>[index=2] > Outlet[index=0] > RenderedRoute[index=0] > BoardPage[index=0] > <div>[index=0] > <div>[index=1] > BoardColumn[key=\"backlog\"] > <section>[index=0] > <ol>[index=1] > BoardCard[key=\"iss-1\"] > <li>[index=0] > CardMeta[index=2] > <div>[index=0] > FeatureGate[index=0]",
    "mountGeneration": 1,
    "mountGenerationEvidence": "exact",
    "renders": 1,
    "mounts": 0,
    "updates": 1,
    "unmounted": false,
    "latestDocumentCommitId": 78,
    "sourceFile": "<repo>/apps/realworld-legacy/src/features/board/card-meta.tsx",
    "sourceLocation": "<repo>/apps/realworld-legacy/src/features/board/card-meta.tsx:7:7"
  }
}
```

The text-mode `verify show` in the log above reports `largestPaths` with `/evidence/beginInstances` at 200 items and `/evidence/records` at 37 items.
