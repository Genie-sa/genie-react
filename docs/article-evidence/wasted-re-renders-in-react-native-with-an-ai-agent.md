# Evidence: wasted-re-renders-in-react-native-with-an-ai-agent

- Date: 2026-11-19 (Asia/Riyadh, UTC+3)
- Commit: `6867352ba46ec3998fe8cda0ba915536fddfa666`
- App: `examples/expo-demo` in Expo Go 57.0.9, React 19.2.3, React Native 0.86.0, Expo SDK 57, Genie CLI and runtime 1.0.2 built from this commit
- Device: iOS Simulator "iPhone 17e", iOS 27.2 (UDID 805932FB-AD05-40BA-82C1-82090709CB00)
- URL: exp://127.0.0.1:8235 (Metro), Genie hub ws://127.0.0.1:4395/__genie/ws
- Driver: agent-device 0.21.39, session `art-m5`. Genie targets the app by the `sessionId` that `genie-react status` printed, because a React Native app has no session name.
- Background processes, started from `examples/expo-demo`:
  - `npx genie-react hub --port 4395`
  - `EXPO_PUBLIC_GENIE_URL=ws://127.0.0.1:4395/__genie/ws npx expo start --port 8235`
  - `xcrun simctl boot 805932FB-AD05-40BA-82C1-82090709CB00`, then `xcrun simctl install` of Expo Go 57.0.9 from the `iosClientUrl` that https://api.expo.dev/v2/versions/latest lists for SDK 57
- The fix (moving the counter state into a `CounterSection` component) was applied only for the "after" runs and reverted with `git checkout -- examples/expo-demo/App.tsx`. It is not a seeded bug with an answer key. The demo renders its counter in the root component on purpose.

Path redaction: the absolute checkout path is replaced with `<checkout>` and the home directory with `~`. No other value is changed.

The log below is every command in the order it ran, each followed by its full, untrimmed output and its exit code. Commands run from `examples/expo-demo`. A few lines are pipes through `grep` or `head` for readability while capturing; those are logged as run.

```text
date: Thu Nov 19 07:01:48 +03 2026  commit: 6867352ba46ec3998fe8cda0ba915536fddfa666
Setup (background processes): npx genie-react hub --port 4395 ; EXPO_PUBLIC_GENIE_URL=ws://127.0.0.1:4395/__genie/ws npx expo start --port 8235 ; xcrun simctl boot 805932FB-AD05-40BA-82C1-82090709CB00 (iPhone 17e, iOS 27.2); Expo Go 57.0.9 installed with xcrun simctl install

$ agent-device open 'Expo Go' exp://127.0.0.1:8235 --platform ios --device 'iPhone 17e' --session art-m5
Building Apple runner...
Opened: Expo Go
Session state: ~/.agent-device/sessions/art-m5
[exit 0]

$ agent-device open 'Expo Go' exp://127.0.0.1:8235 --platform ios --device 'iPhone 17e' --session art-m5 --relaunch --foreground
Opened: Expo Go
Session state: ~/.agent-device/sessions/art-m5
Warning: The session is open, but the initial interactive snapshot failed (COMMAND_FAILED: app 'host.exp.Exponent' is not running). Run: agent-device snapshot -i
[exit 0]

$ agent-device alert accept --session art-m5
Error (ALERT_DEADLINE_EXCEEDED): alert accept exhausted its deadline. May have reached the device. Next: Run snapshot to check the screen before you retry. The button was activated once. Inspect the current alert before deciding on another action.
Log: ~/.agent-device/sessions/art-m5/runner.log
Error (ALERT_DEADLINE_EXCEEDED): alert accept exhausted its deadline. May have reached the device. Next: Run snapshot to check the screen before you retry. The button was activated once. Inspect the current alert before deciding on another action.
[exit 1]

$ agent-device snapshot -i --session art-m5
Page: Expo Go
App: host.exp.Exponent
Snapshot: 4 nodes
Simulator AX snapshot unavailable (bridge-preparation-pending); used XCTest for this capture while the bridge is still being prepared.
@e1 [alert] "Open in “Expo Go”?"
@e2 [button] "Cancel"
@e3 [button] "Open"
@e4 [text] "Open in “Expo Go”?"
[exit 0]

$ npx genie-react status --wait 15000
selectedBridgeUrl: ws://127.0.0.1:4395/__genie/ws
sessionSelector:
  requested: null
  source: implicit-current
  resolvedSessionId: 94482af4-65c0-42ad-9e19-4f942916db2d
  implicit: true
connected: true
ready: true
sessionId: 94482af4-65c0-42ad-9e19-4f942916db2d
app: {name:"Expo demo",reactVersion:19.2.3,reactMounted:true}
domains: [session,react,memory,perf,plugin,timeline,router,query]
toolCount: 89
sessions[1] (sessionId {fields}):
  94482af4-65c0-42ad-9e19-4f942916db2d {logicalSessionId:e8ccb2d1-242a-4372-9041-b50ebf1a34d4,documentGeneration:1,logicalSessionCollision:false,collisionWithSessionIds:[],app:{name:"Expo demo",reactVersion:19.2.3,reactMounted:true},domains:[session,react,memory,perf,plugin,timeline,router,query],toolCount:89,connectedAt:1795060963025,ready:true,readyAt:1795060963025,current:true,origin:http://127.0.0.1:4395,runtimeVersion:1.0.2}
warnings: []
hub: {version:1.0.2,protocol:1}
[exit 0]

$ agent-device alert dismiss --session art-m5
dismissed
[exit 0]

$ agent-device snapshot -i --session art-m5
Page: Expo Go
App: host.exp.Exponent
Snapshot: 42 visible nodes
@e1 [application] "Expo Go"
@e2 [scroll-area] [scrollable]
  [content below scroll-area hidden]
@e3 [text] "Lifecycle visibility test"
@e4 [text] "Mode: visible"
@e5 [button] "Freeze"
@e6 [button] "Thaw"
@e7 [button] "Hide"
@e8 [button] "Unmount"
@e9 [text] "Preserved count: 0"
@e10 [button] "Increment probe"
@e11 [text] "Native screen: active"
@e12 [other] "active"
@e13 [other] "covered"
@e14 [other] "removed"
@e15 [other] "Screen count: 0"
@e16 [text] "GENIE REACT / EXPO"
@e17 [text] "Native integration demo"
@e18 [text] "This screen exercises the React Native entry point, Metro bundling, and live render inspection through the local Genie hub."
@e19 [text] "Hub URL"
@e20 [text] "ws://127.0.0.1:4395/__genie/ws"
@e21 [text] "expo-demo"
@e22 [button] "Close"
@e23 [text] "SDK version: 57.0.0"
@e24 [scroll-area] [scrollable]
  [content below scroll-area hidden]
@e25 [button] "Reload"
@e26 [button] "Go home"
@e27 [text] "TOOLS"
@e28 [button] "Source code explorer"
@e29 [button] "Toggle performance monitor"
@e30 [button] "Toggle element inspector"
@e31 [button] "Open DevTools"
@e32 [image] "Running"
@e33 [text] "Fast refresh"
@e34 [switch] "1" [checked]
@e35 [switch] "1" [checked]
@e36 [scroll-area] [scrollable]
  [content below scroll-area hidden]
@e37 [image] "dev-tools"
@e38 [text] "This is the developer menu. It gives you access to useful tools in Expo Go."
@e39 [text] "You can open it at any time by pressing the blue button with the gear icon, or with the ⌃ + d keyboard shortcut."
@e40 [text] "(Connect Hardware Keyboard must be enabled on your simulator to use this shortcut, you can toggle it with ⌘ + shift + K.)"
@e41 [button] "Continue"
@e42 [toolbar] "Toolbar"
[exit 0]

$ agent-device press @e22 --settle --session art-m5
Tapped @e22 (349, 399)
settled after 1639ms: +0 -22 (~20 unchanged)
- @e21 [text] "expo-demo"
- @e22 [button] "Close"
- @e23 [text] "SDK version: 57.0.0"
- @e24 [scroll-area]
- @e25 [button] "Reload"
- @e26 [button] "Go home"
- @e27 [text] "TOOLS"
- @e28 [button] "Source code explorer"
… changed lines truncated
unchanged interactive (19):
= @e2~s286561 [scroll-area]
= @e3~s286561 [text] "Lifecycle visibility test"
= @e4~s286561 [text] "Mode: visible"
= @e5~s286561 [button] "Freeze"
= @e6~s286561 [button] "Thaw"
= @e7~s286561 [button] "Hide"
= @e8~s286561 [button] "Unmount"
= @e9~s286561 [text] "Preserved count: 0"
= @e10~s286561 [button] "Increment probe"
= @e11~s286561 [text] "Native screen: active"
= @e12~s286561 [other] "active"
= @e13~s286561 [other] "covered"
= @e14~s286561 [other] "removed"
= @e15~s286561 [other] "Screen count: 0"
= @e16~s286561 [text] "GENIE REACT / EXPO"
= @e17~s286561 [text] "Native integration demo"
= @e18~s286561 [text] "This screen exercises the React Native entry point, Metro bundling, and live render inspection through the local Genie hub."
= @e19~s286561 [text] "Hub URL"
= @e20~s286561 [text] "ws://127.0.0.1:4395/__genie/ws"
[exit 0]

$ agent-device snapshot -i --session art-m5
Page: Expo Go
App: host.exp.Exponent
Snapshot: 20 visible nodes
@e1 [application] "Expo Go"
@e2 [scroll-area] [scrollable]
  [content below scroll-area hidden]
@e3 [text] "Lifecycle visibility test"
@e4 [text] "Mode: visible"
@e5 [button] "Freeze"
@e6 [button] "Thaw"
@e7 [button] "Hide"
@e8 [button] "Unmount"
@e9 [text] "Preserved count: 0"
@e10 [button] "Increment probe"
@e11 [text] "Native screen: active"
@e12 [other] "active"
@e13 [other] "covered"
@e14 [other] "removed"
@e15 [other] "Screen count: 0"
@e16 [text] "GENIE REACT / EXPO"
@e17 [text] "Native integration demo"
@e18 [text] "This screen exercises the React Native entry point, Metro bundling, and live render inspection through the local Genie hub."
@e19 [text] "Hub URL"
@e20 [text] "ws://127.0.0.1:4395/__genie/ws"
[exit 0]

$ agent-device scroll down 300 --settle --session art-m5
Scrolled down by 300 of the viewport (676px)
settled after 700ms: +8 -14 (~6 unchanged)
- @e3 [text] "Lifecycle visibility test"
- @e4 [text] "Mode: visible"
- @e5 [button] "Freeze"
- @e6 [button] "Thaw"
- @e7 [button] "Hide"
- @e8 [button] "Unmount"
- @e9 [text] "Preserved count: 0"
- @e10 [button] "Increment probe"
+ @e7~s286564 [text] "Counter"
+ @e8~s286564 [text] "0"
+ @e9~s286564 [button] "Increment"
+ @e10~s286564 [text] "Memo row: 0"
+ @e11~s286564 [text] "Named row: 0"
+ @e12~s286564 [text] "Explicit row: 0"
+ @e13~s286564 [text] "EXHAUSTIVE TOOL FIXTURES"
+ @e14~s286564 [text] "Deterministic targets for React, Query, Router, profiler, effect, and override tools."
… changed lines truncated
[exit 0]

$ agent-device snapshot -i --session art-m5
Page: Expo Go
App: host.exp.Exponent
Snapshot: 14 visible nodes
@e1 [application] "Expo Go"
@e2 [scroll-area] [scrollable]
  [content above scroll-area hidden]
  [content below scroll-area hidden]
@e3 [text] "Native integration demo"
@e4 [text] "This screen exercises the React Native entry point, Metro bundling, and live render inspection through the local Genie hub."
@e5 [text] "Hub URL"
@e6 [text] "ws://127.0.0.1:4395/__genie/ws"
@e7 [text] "Counter"
@e8 [text] "0"
@e9 [button] "Increment"
@e10 [text] "Memo row: 0"
@e11 [text] "Named row: 0"
@e12 [text] "Explicit row: 0"
@e13 [text] "EXHAUSTIVE TOOL FIXTURES"
@e14 [text] "Deterministic targets for React, Query, Router, profiler, effect, and override tools."
[exit 0]

$ npx genie-react status --session art-m5 --wait 3000
error not_connected: Status check failed. Session art-m5 was not ready within 3000 ms. 1 session is connected; details.session.connected lists their IDs.
next: $ pnpm exec genie-react status --sessions-only
userActionRequired: true
errorCode: not-connected
details:
  session:
    requested: art-m5
    registeredTabs: 1
    connected: [{sessionId:94482af4-65c0-42ad-9e19-4f942916db2d,logicalSessionId:e8ccb2d1-242a-4372-9041-b50ebf1a34d4,current:true,ready:true}]
exit: {code:69,class:unreachable}
[exit 1]
SID=94482af4-65c0-42ad-9e19-4f942916db2d (from genie-react status)

$ npx genie-react call react_clear_renders '{}' --session 94482af4-65c0-42ad-9e19-4f942916db2d
ok: true
tracking: true
documentCommitId: 3
observation: {id:observation:1,epoch:1,startedAfterDocumentCommitId:3}
observationConfig:
  adaptive: true
  adaptiveScale: 1
  fiberLimit: 250
  operationLimit: 20000
  timeLimitMs: 8
  targetOperationReserve: 4000
  targetTimeReserveMs: 4
  lifecycleBufferLimit: 1000
  lifecycleTargetReserve: 100
strictMode: off
[exit 0]

$ agent-device press 'id="increment-button"' --settle --session art-m5
Tapped id="increment-button" (109, 481)
settled after 408ms: +4 -4 (~10 unchanged)
- @e8 [text] "0"
+ @e8~s286568 [text] "1"
- @e10 [text] "Memo row: 0"
- @e11 [text] "Named row: 0"
- @e12 [text] "Explicit row: 0"
+ @e10~s286568 [text] "Memo row: 1"
+ @e11~s286568 [text] "Named row: 1"
+ @e12~s286568 [text] "Explicit row: 1"
[exit 0]

$ npx genie-react call react_quiesce '{"idleMs":500,"timeoutMs":10000}' --fail-on-result-error --session 94482af4-65c0-42ad-9e19-4f942916db2d
ok: true
outcome: idle
elapsedMs: 935
observedCommits: 0
documentCommitId: 7
sessionId: 94482af4-65c0-42ad-9e19-4f942916db2d
renderCollection: "degraded (hook installed after React initialised — commits before that point were not observed)"
pendingWork:
  documentCommitId: 7
  scheduledRoots: 0
  suspendedBoundaries: 0
  dehydratedBoundaries: 0
  boundaries: []
  scanTruncated: false
  scannedFibers: 375
[exit 0]

$ npx genie-react call react_get_renders '{"limit":60}' --session 94482af4-65c0-42ad-9e19-4f942916db2d --fields name,renders,necessity,necessityReason
[4]:
  each: {renders:1}
  - {name:App,necessity:unknown,necessityReason:output-incomplete}
  - {name:Genie,necessity:unnecessary,necessityReason:inputs-unchanged}
  - {name:VisibilityTestbed,necessity:unnecessary,necessityReason:inputs-unchanged}
  - {name:VisibilityProbe,necessity:unknown,necessityReason:output-incomplete}
[exit 0]

$ npx genie-react call react_get_renders '{"limit":60}' --session 94482af4-65c0-42ad-9e19-4f942916db2d --select /coverage
status: ok
selection: {expression:/coverage,matchedPathCount:1,matchedPaths:[/coverage],omittedPathCount:127}
result:
  skippedCommitFibers: 141
  droppedUnmountFibers: 0
  analysisFailedFibers: 0
  pausedCommits: 0
  unobservedCommits: 0
  refreshCommitsExcluded: 0
  truncatedInputFibers: 28
  propsNotEnumeratedFibers: 0
  budgetExhaustedCommits: 1
  budgetExhaustedSubsystems[4]:
    each: {commits:1}
    - {subsystem:commit-fibers}
    - {subsystem:error-state}
    - {subsystem:instance-ancestry}
    - {subsystem:parent-ancestry}
  budgetAdvice:
    exhaustedLimits: [timeLimitMs]
    suggestedBudget: {fiberLimit:250,operationLimit:155000,timeLimitMs:62,targetOperationReserve:4000,targetTimeReserveMs:4}
    next: "timeLimitMs ran out. Run react_clear_renders with {\"budget\":{\"fiberLimit\":250,\"operationLimit\":155000,\"timeLimitMs\":62,\"targetOperationReserve\":4000,\"targetTimeReserveMs\":4}}, repeat the step, and read again."
  incompleteBecause[3]:
    - {reason:budget-exhausted,fibers:141,detail:"1 commits ran out of analysis budget.",next:"timeLimitMs ran out. Run react_clear_renders with {\"budget\":{\"fiberLimit\":250,\"operationLimit\":155000,\"timeLimitMs\":62,\"targetOperationReserve\":4000,\"targetTimeReserveMs\":4}}, repeat the step, and read again."}
    - {reason:inputs-truncated,fibers:28,components:[View,PressabilityDebugView,Text,Pressable,Freeze,Suspender,VisibilityProbe],detail:"An input held values Genie compares only in part, such as functions, class instances or objects past the inspected depth; read deepDiff.truncated on these components."}
    - {reason:source-classification-incomplete,fibers:1,detail:"1 of 35 candidates have unresolved ownership. appOnly keeps them, but any of them may be library code it would hide, so rows and counts can change once ownership resolves.",next:"Pass appOnly:false for counts that do not depend on ownership, or read again shortly: ownership keeps resolving in the background, though a component React rendered without an owner stack stays unknown."}
  complete: false
  inputAttributionComplete: false
  semantics: unknown
  coverageDomain: render-causality
[exit 0]

$ npx genie-react call react_clear_renders '{"budget":{"fiberLimit":250,"operationLimit":155000,"timeLimitMs":62,"targetOperationReserve":4000,"targetTimeReserveMs":4}}' --session 94482af4-65c0-42ad-9e19-4f942916db2d
ok: true
tracking: true
documentCommitId: 7
observation: {id:observation:2,epoch:2,startedAfterDocumentCommitId:7}
observationConfig:
  adaptive: true
  adaptiveScale: 1
  fiberLimit: 250
  operationLimit: 155000
  timeLimitMs: 62
  targetOperationReserve: 4000
  targetTimeReserveMs: 4
  lifecycleBufferLimit: 1000
  lifecycleTargetReserve: 100
strictMode: off
[exit 0]

$ agent-device press 'id="increment-button"' --settle --session art-m5
Tapped id="increment-button" (109, 481)
settled after 463ms: +4 -4 (~10 unchanged)
- @e8 [text] "1"
+ @e8~s286571 [text] "2"
- @e10 [text] "Memo row: 1"
- @e11 [text] "Named row: 1"
- @e12 [text] "Explicit row: 1"
+ @e10~s286571 [text] "Memo row: 2"
+ @e11~s286571 [text] "Named row: 2"
+ @e12~s286571 [text] "Explicit row: 2"
[exit 0]

$ npx genie-react call react_quiesce '{"idleMs":500,"timeoutMs":10000}' --fail-on-result-error --session 94482af4-65c0-42ad-9e19-4f942916db2d
ok: true
outcome: idle
elapsedMs: 839
observedCommits: 0
documentCommitId: 10
sessionId: 94482af4-65c0-42ad-9e19-4f942916db2d
renderCollection: "degraded (hook installed after React initialised — commits before that point were not observed)"
pendingWork:
  documentCommitId: 10
  scheduledRoots: 0
  suspendedBoundaries: 0
  dehydratedBoundaries: 0
  boundaries: []
  scanTruncated: false
  scannedFibers: 375
[exit 0]

$ npx genie-react call react_get_renders '{"limit":80}' --session 94482af4-65c0-42ad-9e19-4f942916db2d --fields name,renders,necessity,necessityReason
[29]:
  each: {renders:1}
  - {name:App,necessity:unknown,necessityReason:effects-scheduled}
  - {name:Genie,necessity:unnecessary,necessityReason:inputs-unchanged}
  - {name:VisibilityTestbed,necessity:unnecessary,necessityReason:inputs-unchanged}
  - {name:VisibilityProbe,necessity:unnecessary,necessityReason:inputs-unchanged}
  - {name:FreezeScreenTestbed,necessity:unnecessary,necessityReason:inputs-unchanged}
  - {name:FrozenScreenProbe,necessity:unnecessary,necessityReason:inputs-unchanged}
  - {name:MemoNameRow,necessity:unnecessary,necessityReason:output-unchanged}
  - {name:InnerNamedRow,necessity:unnecessary,necessityReason:output-unchanged}
  - {name:CustomMemoRow,necessity:unnecessary,necessityReason:output-unchanged}
  - {name:ToolTestbed,necessity:unnecessary,necessityReason:inputs-unchanged}
  - {name:PropFixture,necessity:unnecessary,necessityReason:inputs-unchanged}
  - {name:HookFixture,necessity:unnecessary,necessityReason:inputs-unchanged}
  - {name:AuditButton,necessity:unnecessary,necessityReason:inputs-unchanged}
  - {name:AuditButton,necessity:unnecessary,necessityReason:inputs-unchanged}
  - {name:ContextFixture,necessity:unnecessary,necessityReason:inputs-unchanged}
  - {name:SuspenseFixture,necessity:unnecessary,necessityReason:inputs-unchanged}
  - {name:AuditErrorBoundary,necessity:unnecessary,necessityReason:inputs-unchanged}
  - {name:ErrorFixture,necessity:unnecessary,necessityReason:inputs-unchanged}
  - {name:AuditButton,necessity:unknown,necessityReason:effects-scheduled}
  - {name:EffectFixture,necessity:unnecessary,necessityReason:inputs-unchanged}
  - {name:AuditButton,necessity:unknown,necessityReason:effects-scheduled}
  - {name:SlowRenderer,necessity:unnecessary,necessityReason:inputs-unchanged}
  - {name:AuditButton,necessity:unknown,necessityReason:effects-scheduled}
  - {name:QueryFixture,necessity:unnecessary,necessityReason:inputs-unchanged}
  - {name:AuditButton,necessity:unknown,necessityReason:effects-scheduled}
  - {name:AuditButton,necessity:unknown,necessityReason:effects-scheduled}
  - {name:RouterFixture,necessity:unnecessary,necessityReason:inputs-unchanged}
  - {name:AuditButton,necessity:unknown,necessityReason:effects-scheduled}
  - {name:AuditButton,necessity:unknown,necessityReason:effects-scheduled}
[exit 0]

$ npx genie-react call react_get_renders '{"limit":80}' --session 94482af4-65c0-42ad-9e19-4f942916db2d --select /coverage
status: ok
selection: {expression:/coverage,matchedPathCount:1,matchedPaths:[/coverage],omittedPathCount:650}
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
  complete: false
  inputAttributionComplete: true
  semantics: unknown
  coverageDomain: render-causality
  incompleteBecause[1]:
    - {reason:source-classification-incomplete,fibers:2,detail:"2 of 171 candidates have unresolved ownership. appOnly keeps them, but any of them may be library code it would hide, so rows and counts can change once ownership resolves.",next:"Pass appOnly:false for counts that do not depend on ownership, or read again shortly: ownership keeps resolving in the background, though a component React rendered without an owner stack stays unknown."}
[exit 0]

$ npx genie-react call react_render_causes '{"component":"App","limit":1}' --session 94482af4-65c0-42ad-9e19-4f942916db2d
componentMatch:
  component: App
  exact: true
  status: matched
  matchedNames: [App]
  matchedNameCount: 1
  similarNames: []
tracking: true
commits: 3
documentCommitId: 10
observation: {id:observation:2,epoch:2,startedAfterDocumentCommitId:7}
attribution:
  status: current
  startedAtDocumentCommitId: 10
  completedAtDocumentCommitId: 10
  startedAtAnalysisGeneration: 12
  completedAtAnalysisGeneration: 12
view: summary
events[1] (componentName #componentId {fields}, then ← kind evidence name {fields} per cause):
  App #11709758570505 {renderEventId:render:9:47,documentCommitId:9,mountId:mount:4,necessity:unknown,necessityReason:effects-scheduled,inputEvidence:changed,source:{location:<checkout>/examples/expo-demo/App.tsx:20:5,role:component-body,ownership:app}}
    ← state exact "state[0]"
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
renderEventRetention: {evictedEvents:0,earliestDocumentCommitId:8,latestDocumentCommitId:10}
coverage:
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
  droppedRenderEvents: 0
[exit 0]

$ npx genie-react call react_render_causes '{"component":"MemoNameRow","limit":1}' --session 94482af4-65c0-42ad-9e19-4f942916db2d
componentMatch:
  component: MemoNameRow
  exact: true
  status: matched
  matchedNames: [MemoNameRow]
  matchedNameCount: 1
  similarNames: []
tracking: true
commits: 3
documentCommitId: 10
observation: {id:observation:2,epoch:2,startedAfterDocumentCommitId:7}
attribution:
  status: current
  startedAtDocumentCommitId: 10
  completedAtDocumentCommitId: 10
  startedAtAnalysisGeneration: 12
  completedAtAnalysisGeneration: 12
view: summary
events[1] (componentName #componentId {fields}, then ← kind evidence name {fields} per cause):
  MemoNameRow #11709758570656 {renderEventId:render:9:138,documentCommitId:9,mountId:mount:78,key:.3,necessity:unnecessary,necessityReason:output-unchanged,inputEvidence:changed,source:{location:<checkout>/examples/expo-demo/App.tsx:74:9,role:element-callsite,ownership:app}}
    ← props exact value
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
renderEventRetention: {evictedEvents:0,earliestDocumentCommitId:8,latestDocumentCommitId:10}
coverage:
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
  droppedRenderEvents: 0
[exit 0]

$ npx genie-react call react_render_causes '{"component":"ToolTestbed","limit":1}' --session 94482af4-65c0-42ad-9e19-4f942916db2d
componentMatch:
  component: ToolTestbed
  exact: true
  status: matched
  matchedNames: [ToolTestbed]
  matchedNameCount: 1
  similarNames: []
tracking: true
commits: 3
documentCommitId: 10
observation: {id:observation:2,epoch:2,startedAfterDocumentCommitId:7}
attribution:
  status: current
  startedAtDocumentCommitId: 10
  completedAtDocumentCommitId: 10
  startedAtAnalysisGeneration: 12
  completedAtAnalysisGeneration: 12
view: summary
events[1] (componentName #componentId {fields}, then ← kind evidence name {fields} per cause):
  ToolTestbed #11709758570671 {renderEventId:render:9:144,documentCommitId:9,mountId:mount:84,key:.6,necessity:unnecessary,necessityReason:inputs-unchanged,inputEvidence:none-observed,source:{location:<checkout>/examples/expo-demo/App.tsx:77:9,role:element-callsite,ownership:app}}
    ← parent inferred ScrollView {origin:App}
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
renderEventRetention: {evictedEvents:0,earliestDocumentCommitId:8,latestDocumentCommitId:10}
coverage:
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
  droppedRenderEvents: 0
[exit 0]

$ npx genie-react call react_render_causes '{"component":"VisibilityTestbed","limit":1}' --session 94482af4-65c0-42ad-9e19-4f942916db2d
componentMatch:
  component: VisibilityTestbed
  exact: true
  status: matched
  matchedNames: [VisibilityTestbed]
  matchedNameCount: 1
  similarNames: []
tracking: true
commits: 3
documentCommitId: 10
observation: {id:observation:2,epoch:2,startedAfterDocumentCommitId:7}
attribution:
  status: current
  startedAtDocumentCommitId: 10
  completedAtDocumentCommitId: 10
  startedAtAnalysisGeneration: 12
  completedAtAnalysisGeneration: 12
view: summary
events[1] (componentName #componentId {fields}, then ← kind evidence name {fields} per cause):
  VisibilityTestbed #11709758570514 {renderEventId:render:9:52,documentCommitId:9,mountId:mount:9,key:.0,necessity:unnecessary,necessityReason:inputs-unchanged,inputEvidence:none-observed,source:{location:<checkout>/examples/expo-demo/App.tsx:34:9,role:element-callsite,ownership:app}}
    ← parent inferred ScrollView {origin:App}
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
renderEventRetention: {evictedEvents:0,earliestDocumentCommitId:8,latestDocumentCommitId:10}
coverage:
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
  droppedRenderEvents: 0
[exit 0]

$ npx genie-react call react_render_causes '{"component":"HookFixture","limit":1}' --session 94482af4-65c0-42ad-9e19-4f942916db2d
componentMatch:
  component: HookFixture
  exact: true
  status: matched
  matchedNames: [HookFixture]
  matchedNameCount: 1
  similarNames: []
tracking: true
commits: 3
documentCommitId: 10
observation: {id:observation:2,epoch:2,startedAfterDocumentCommitId:7}
attribution:
  status: current
  startedAtDocumentCommitId: 10
  completedAtDocumentCommitId: 10
  startedAtAnalysisGeneration: 12
  completedAtAnalysisGeneration: 12
view: summary
events[1] (componentName #componentId {fields}, then ← kind evidence name {fields} per cause):
  HookFixture #11709758570689 {renderEventId:render:9:152,documentCommitId:9,mountId:mount:92,necessity:unnecessary,necessityReason:inputs-unchanged,inputEvidence:none-observed,source:{location:<checkout>/examples/expo-demo/components/tool-testbed.tsx:252:9,role:element-callsite,ownership:app}}
    ← parent inferred View {origin:App}
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
renderEventRetention: {evictedEvents:0,earliestDocumentCommitId:8,latestDocumentCommitId:10}
coverage:
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
  droppedRenderEvents: 0
[exit 0]

$ npx genie-react call react_render_causes '{"component":"MemoNameRow","limit":1,"view":"full"}' --session 94482af4-65c0-42ad-9e19-4f942916db2d
componentMatch:
  component: MemoNameRow
  exact: true
  status: matched
  matchedNames: [MemoNameRow]
  matchedNameCount: 1
  similarNames: []
tracking: true
commits: 3
documentCommitId: 10
observation: {id:observation:2,epoch:2,startedAfterDocumentCommitId:7}
attribution:
  status: current
  startedAtDocumentCommitId: 10
  completedAtDocumentCommitId: 10
  startedAtAnalysisGeneration: 12
  completedAtAnalysisGeneration: 12
view: full
events[1] (componentName #componentId {fields}, then ← kind evidence name {fields} per cause):
  MemoNameRow #11709758570656 {renderEventId:render:9:138,observationId:observation:2,commitId:2,documentCommitId:9,instance:{fiberId:11709758570656,mountId:mount:78,key:.3,siblingIndex:3,parent:{fiberId:11709758570510,name:ScrollView,key:null},keyedParent:{fiberId:11709758570502,name:View,key:"0"},logicalPath:"main(RootComponent)[index=0] > AppContainer[index=0] > View[index=0] > <RCTView>[index=0] > View[key=\"0\"] > <RCTView>[index=0] > withDevTools(App)[index=0] > App[index=0] > QueryClientProvider[index=0] > ScrollView[index=1] > ScrollView[index=0] > <RCTScrollView>[index=0] > <RCTScrollContentView>[index=0] > MemoNameRow[key=\".3\"]",logicalIdentityEvidence:keyed,mountGeneration:1,mountGenerationEvidence:exact,hostSelector:null},necessity:unnecessary,necessityReason:output-unchanged,assessment:{inputEvidence:changed,observedInputKinds:[props],behaviorEvidence:{subtreeHostMutations:{status:none-observed,count:0,pendingSubtrees:0,omittedByLimit:0,callbackOnlyUpdates:0,writes:[],callbacks:[]},scheduledEffects:{status:none-observed,count:0},subtreeScheduledEffects:{status:none-observed,count:0},unobservedDomains:[focus,url,network,transition,freshness,effect-execution]},optimizationSafety:not-proven-safe,requiredValidation:[dom,aria,focus,url,network,transition]},inputCoverage:{complete:true,omittedInputs:0,scanTruncated:false,propsNotEnumerated:false},source:{file:<checkout>/examples/expo-demo/App.tsx,line:74,column:9,functionName:App,sourceMapConfidence:mapped,role:element-callsite},sourceAttribution:{role:usage-or-definition-fallback,evidence:inferred},sourceOwnership:app,isLibrary:false}
    ← props exact value {referenceChanged:false,referenceOnly:false,unstable:false,beforePresent:true,afterPresent:true,before:1,after:2,deepDiff:{changes:[{kind:value,path:"",before:1,after:2}],visited:1,truncated:false}}
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
renderEventRetention: {evictedEvents:0,earliestDocumentCommitId:8,latestDocumentCommitId:10}
coverage:
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
  droppedRenderEvents: 0
[exit 0]

$ agent-device snapshot -i --session art-m5
Page: Expo Go
App: host.exp.Exponent
Snapshot: 14 visible nodes
@e1 [application] "Expo Go"
@e2 [scroll-area] [scrollable]
  [content above scroll-area hidden]
  [content below scroll-area hidden]
@e3 [text] "Native integration demo"
@e4 [text] "This screen exercises the React Native entry point, Metro bundling, and live render inspection through the local Genie hub."
@e5 [text] "Hub URL"
@e6 [text] "ws://127.0.0.1:4395/__genie/ws"
@e7 [text] "Counter"
@e8 [text] "2"
@e9 [button] "Increment"
@e10 [text] "Memo row: 2"
@e11 [text] "Named row: 2"
@e12 [text] "Explicit row: 2"
@e13 [text] "EXHAUSTIVE TOOL FIXTURES"
@e14 [text] "Deterministic targets for React, Query, Router, profiler, effect, and override tools."
[exit 0]

===== VERIFY BEFORE FIX =====

$ npx genie-react verify begin --session 94482af4-65c0-42ad-9e19-4f942916db2d --name 'press Increment' --budget '{"fiberLimit":250,"operationLimit":155000,"timeLimitMs":62}' --claim 'render ToolTestbed max 0' --claim 'render VisibilityTestbed max 0' --claim 'render FreezeScreenTestbed max 0' --claim 'render MemoNameRow min 1'
recording vfy_104cacd8-d2dd-4259-b132-f0b7e0e45152 "press Increment"
  1 null render ToolTestbed max 0  {}
  2 null render VisibilityTestbed max 0  {}
  3 null render FreezeScreenTestbed max 0  {}
  4 null render MemoNameRow min 1  {}
window: {observationId:observation:3,startDocumentCommitId:10,domains:[react,query,router],quietMs:500,timeoutMs:10000,tailMs:500}
next: $ pnpm exec genie-react verify end vfy_104cacd8-d2dd-4259-b132-f0b7e0e45152 --session 94482af4-65c0-42ad-9e19-4f942916db2d
session: {sessionId:94482af4-65c0-42ad-9e19-4f942916db2d,logicalSessionId:e8ccb2d1-242a-4372-9041-b50ebf1a34d4,documentGeneration:1}
schemaVersion: "1.0"
targets: [{target:{component:ToolTestbed},status:resolved,instances:1,source:<checkout>/examples/expo-demo/App.tsx},{target:{component:VisibilityTestbed},status:resolved,instances:1,source:<checkout>/examples/expo-demo/App.tsx},{target:{component:FreezeScreenTestbed},status:resolved,instances:1,source:<checkout>/examples/expo-demo/App.tsx},{target:{component:MemoNameRow},status:resolved,instances:1,source:<checkout>/examples/expo-demo/App.tsx}]
startedAt: 2026-11-19T04:04:43.759Z
expiresAt: 2026-11-19T04:09:43.845Z
request: {budget:{fiberLimit:250,operationLimit:155000,timeLimitMs:62,targetOperationReserve:4000,targetTimeReserveMs:4,adaptive:true},settle:{quietMs:500,timeoutMs:10000},maxDurationMs:300000,allowOverrides:false}
[exit 0]

$ agent-device press 'id="increment-button"' --settle --session art-m5
Tapped id="increment-button" (109, 481)
settled after 481ms: +4 -4 (~10 unchanged)
- @e8 [text] "2"
+ @e8~s286575 [text] "3"
- @e10 [text] "Memo row: 2"
- @e11 [text] "Named row: 2"
- @e12 [text] "Explicit row: 2"
+ @e10~s286575 [text] "Memo row: 3"
+ @e11~s286575 [text] "Named row: 3"
+ @e12~s286575 [text] "Explicit row: 3"
[exit 0]

$ npx genie-react verify end vfy_104cacd8-d2dd-4259-b132-f0b7e0e45152 --session 94482af4-65c0-42ad-9e19-4f942916db2d
fail vfy_104cacd8-d2dd-4259-b132-f0b7e0e45152 "press Increment"  3 commits, not quiet after 10033 ms (react, query, router)
  1 fail render ToolTestbed max 0  {renders:1,mounts:0,updates:1,remounts:0,semantics:exact,instances:1,activeInstances:1}
      claim: {kind:renders,target:{component:ToolTestbed},max:0,counting:renders,allowRemount:false}
      deciding: [{kind:instance,mountId:mount:84,key:.6,renders:1,mounts:0,updates:1,mountGeneration:1,latestDocumentCommitId:12,source:<checkout>/examples/expo-demo/App.tsx:77:9}]
  2 fail render VisibilityTestbed max 0  {renders:1,mounts:0,updates:1,remounts:0,semantics:exact,instances:1,activeInstances:1}
      claim: {kind:renders,target:{component:VisibilityTestbed},max:0,counting:renders,allowRemount:false}
      deciding: [{kind:instance,mountId:mount:9,key:.0,renders:1,mounts:0,updates:1,mountGeneration:1,latestDocumentCommitId:12,source:<checkout>/examples/expo-demo/App.tsx:34:9}]
  3 fail render FreezeScreenTestbed max 0  {renders:1,mounts:0,updates:1,remounts:0,semantics:exact,instances:1,activeInstances:1}
      claim: {kind:renders,target:{component:FreezeScreenTestbed},max:0,counting:renders,allowRemount:false}
      deciding: [{kind:instance,mountId:mount:39,key:.1,renders:1,mounts:0,updates:1,mountGeneration:1,latestDocumentCommitId:12,source:<checkout>/examples/expo-demo/App.tsx:35:9}]
  4 pass render MemoNameRow min 1  {renders:1,mounts:0,updates:1,remounts:0,semantics:exact,instances:1,activeInstances:1}
      claim: {kind:renders,target:{component:MemoNameRow},min:1,counting:renders,allowRemount:false}
      deciding: [{kind:instance,mountId:mount:78,key:.3,renders:1,mounts:0,updates:1,mountGeneration:1,latestDocumentCommitId:12,source:<checkout>/examples/expo-demo/App.tsx:74:9}]
window: {observationId:observation:3,startDocumentCommitId:10,settledDocumentCommitId:13,frozenDocumentCommitId:13,commits:3,settle:{outcome:timed-out,reason:"The router has not settled on /.",quietMs:500,timeoutMs:10000,waitedMs:10033,domains:{react:met,query:met,router:pending}},tail:{ms:500,commits:0},environment:{bundle:development,strictMode:off,renderCollection:"degraded (hook installed after React initialised — commits before that point were not observed)",visibility:unavailable}}
! ui-outcome-not-observed: Genie does not check the screen; confirm it with the UI driver
! visibility-unobserved: the app reports no visibility signal, so a hidden interval was not observed
! not-settled: the app did not settle within the timeout
attempt 1 for these claims on this tab
evidence: $ pnpm exec genie-react verify show vfy_104cacd8-d2dd-4259-b132-f0b7e0e45152 --claim 1 --session 94482af4-65c0-42ad-9e19-4f942916db2d
session: {sessionId:94482af4-65c0-42ad-9e19-4f942916db2d,logicalSessionId:e8ccb2d1-242a-4372-9041-b50ebf1a34d4,documentGeneration:1}
schemaVersion: "1.0"
exitCode: 1
stage: end
ledger: {fingerprint:cf_56bb8e1b1a99,scope:logical-session,storage:memory,attempt:1,history:[],codeChangedSincePrevious:null,failsOnSameCode:0}
evidence: {retained:true,tools:[react_get_renders,react_component_cohort,react_list_overrides,query_is_fetching,react_refresh_events,browser_visibility,react_profile_stop]}
startedAt: 2026-11-19T04:04:43.759Z
endedAt: 2026-11-19T04:04:55.778Z
request: {budget:{fiberLimit:250,operationLimit:155000,timeLimitMs:62,targetOperationReserve:4000,targetTimeReserveMs:4,adaptive:true},settle:{quietMs:500,timeoutMs:10000},maxDurationMs:300000,allowOverrides:false}
[exit 1]

$ npx genie-react call router_get_state '{}' --session 94482af4-65c0-42ad-9e19-4f942916db2d
routerId: router:1
pathname: /
resolvedPathname: null
href: /
searchStr: ""
hash: ""
status: pending
statusCode: 200
isLoading: false
isTransitioning: true
loadedAt: 1795060962189
matchCount: 2
settled: false
pendingWork: [navigation-pending]
pendingMatchCount: 0
browserLocation: null
locationSync: unavailable
snapshotAt: 1795061106529
[exit 0]

===== VERIFY BEFORE FIX, --domains react =====

$ npx genie-react verify begin --session 94482af4-65c0-42ad-9e19-4f942916db2d --name 'press Increment' --domains react --budget '{"fiberLimit":250,"operationLimit":155000,"timeLimitMs":62}' --claim 'render ToolTestbed max 0' --claim 'render VisibilityTestbed max 0' --claim 'render FreezeScreenTestbed max 0' --claim 'render MemoNameRow min 1'
recording vfy_e1ae9d36-c634-4b87-a7e4-b9da7400b87f "press Increment"
  1 null render ToolTestbed max 0  {}
  2 null render VisibilityTestbed max 0  {}
  3 null render FreezeScreenTestbed max 0  {}
  4 null render MemoNameRow min 1  {}
window: {observationId:observation:4,startDocumentCommitId:13,domains:[react],quietMs:500,timeoutMs:10000,tailMs:500}
next: $ pnpm exec genie-react verify end vfy_e1ae9d36-c634-4b87-a7e4-b9da7400b87f --session 94482af4-65c0-42ad-9e19-4f942916db2d
session: {sessionId:94482af4-65c0-42ad-9e19-4f942916db2d,logicalSessionId:e8ccb2d1-242a-4372-9041-b50ebf1a34d4,documentGeneration:1}
schemaVersion: "1.0"
targets: [{target:{component:ToolTestbed},status:resolved,instances:1,source:<checkout>/examples/expo-demo/App.tsx},{target:{component:VisibilityTestbed},status:resolved,instances:1,source:<checkout>/examples/expo-demo/App.tsx},{target:{component:FreezeScreenTestbed},status:resolved,instances:1,source:<checkout>/examples/expo-demo/App.tsx},{target:{component:MemoNameRow},status:resolved,instances:1,source:<checkout>/examples/expo-demo/App.tsx}]
startedAt: 2026-11-19T04:05:06.756Z
expiresAt: 2026-11-19T04:10:06.796Z
request: {budget:{fiberLimit:250,operationLimit:155000,timeLimitMs:62,targetOperationReserve:4000,targetTimeReserveMs:4,adaptive:true},settle:{quietMs:500,timeoutMs:10000,domains:[react]},maxDurationMs:300000,allowOverrides:false}
[exit 0]

$ agent-device press 'id="increment-button"' --settle --session art-m5
Tapped id="increment-button" (109, 481)
settled after 480ms: +4 -4 (~10 unchanged)
- @e8 [text] "3"
+ @e8~s286578 [text] "4"
- @e10 [text] "Memo row: 3"
- @e11 [text] "Named row: 3"
- @e12 [text] "Explicit row: 3"
+ @e10~s286578 [text] "Memo row: 4"
+ @e11~s286578 [text] "Named row: 4"
+ @e12~s286578 [text] "Explicit row: 4"
[exit 0]

$ npx genie-react verify end vfy_e1ae9d36-c634-4b87-a7e4-b9da7400b87f --session 94482af4-65c0-42ad-9e19-4f942916db2d
fail vfy_e1ae9d36-c634-4b87-a7e4-b9da7400b87f "press Increment"  3 commits, quiet after 926 ms (react)
  1 fail render ToolTestbed max 0  {renders:1,mounts:0,updates:1,remounts:0,semantics:exact,instances:1,activeInstances:1}
      claim: {kind:renders,target:{component:ToolTestbed},max:0,counting:renders,allowRemount:false}
      deciding: [{kind:instance,mountId:mount:84,key:.6,renders:1,mounts:0,updates:1,mountGeneration:1,latestDocumentCommitId:15,source:<checkout>/examples/expo-demo/App.tsx:77:9}]
  2 fail render VisibilityTestbed max 0  {renders:1,mounts:0,updates:1,remounts:0,semantics:exact,instances:1,activeInstances:1}
      claim: {kind:renders,target:{component:VisibilityTestbed},max:0,counting:renders,allowRemount:false}
      deciding: [{kind:instance,mountId:mount:9,key:.0,renders:1,mounts:0,updates:1,mountGeneration:1,latestDocumentCommitId:15,source:<checkout>/examples/expo-demo/App.tsx:34:9}]
  3 fail render FreezeScreenTestbed max 0  {renders:1,mounts:0,updates:1,remounts:0,semantics:exact,instances:1,activeInstances:1}
      claim: {kind:renders,target:{component:FreezeScreenTestbed},max:0,counting:renders,allowRemount:false}
      deciding: [{kind:instance,mountId:mount:39,key:.1,renders:1,mounts:0,updates:1,mountGeneration:1,latestDocumentCommitId:15,source:<checkout>/examples/expo-demo/App.tsx:35:9}]
  4 pass render MemoNameRow min 1  {renders:1,mounts:0,updates:1,remounts:0,semantics:exact,instances:1,activeInstances:1}
      claim: {kind:renders,target:{component:MemoNameRow},min:1,counting:renders,allowRemount:false}
      deciding: [{kind:instance,mountId:mount:78,key:.3,renders:1,mounts:0,updates:1,mountGeneration:1,latestDocumentCommitId:15,source:<checkout>/examples/expo-demo/App.tsx:74:9}]
window: {observationId:observation:4,startDocumentCommitId:13,settledDocumentCommitId:16,frozenDocumentCommitId:16,commits:3,settle:{outcome:met,quietMs:500,timeoutMs:10000,waitedMs:926,domains:{react:met}},tail:{ms:500,commits:0},environment:{bundle:development,strictMode:off,renderCollection:"degraded (hook installed after React initialised — commits before that point were not observed)",visibility:unavailable}}
! ui-outcome-not-observed: Genie does not check the screen; confirm it with the UI driver
! visibility-unobserved: the app reports no visibility signal, so a hidden interval was not observed
attempt 2 for these claims on this tab; previous fail vfy_104cacd8-d2dd-4259-b132-f0b7e0e45152; no code change observed
evidence: $ pnpm exec genie-react verify show vfy_e1ae9d36-c634-4b87-a7e4-b9da7400b87f --claim 1 --session 94482af4-65c0-42ad-9e19-4f942916db2d
session: {sessionId:94482af4-65c0-42ad-9e19-4f942916db2d,logicalSessionId:e8ccb2d1-242a-4372-9041-b50ebf1a34d4,documentGeneration:1}
schemaVersion: "1.0"
exitCode: 1
stage: end
ledger: {fingerprint:cf_56bb8e1b1a99,scope:logical-session,storage:memory,attempt:2,history:[{verificationId:vfy_104cacd8-d2dd-4259-b132-f0b7e0e45152,verdict:fail,reasons:[],endedAt:2026-11-19T04:04:55.778Z}],codeChangedSincePrevious:none-observed,failsOnSameCode:1}
evidence: {retained:true,tools:[react_get_renders,react_component_cohort,react_list_overrides,query_is_fetching,react_refresh_events,browser_visibility,react_profile_stop]}
startedAt: 2026-11-19T04:05:06.756Z
endedAt: 2026-11-19T04:05:09.667Z
request: {budget:{fiberLimit:250,operationLimit:155000,timeLimitMs:62,targetOperationReserve:4000,targetTimeReserveMs:4,adaptive:true},settle:{quietMs:500,timeoutMs:10000,domains:[react]},maxDurationMs:300000,allowOverrides:false}
[exit 1]

===== APPLIED TEMPORARY FIX (git diff) =====
diff --git a/examples/expo-demo/App.tsx b/examples/expo-demo/App.tsx
index e0edd4e..e81ff20 100644
--- a/examples/expo-demo/App.tsx
+++ b/examples/expo-demo/App.tsx
@@ -14,8 +14,6 @@ const genieUrl = process.env.EXPO_PUBLIC_GENIE_URL ?? `ws://${defaultHubHost}:43
 const geniePlugins = ['expo-audit']
 
 export default function App() {
-  const [count, setCount] = useState(0)
-
   return (
     <QueryClientProvider client={queryClient}>
       {__DEV__ && (
@@ -33,47 +31,7 @@ export default function App() {
       >
         <VisibilityTestbed />
         <FreezeScreenTestbed />
-        <View style={styles.card}>
-          <Text selectable style={styles.eyebrow}>
-            GENIE REACT / EXPO
-          </Text>
-          <Text selectable style={styles.title}>
-            Native integration demo
-          </Text>
-          <Text selectable style={styles.description}>
-            This screen exercises the React Native entry point, Metro bundling, and live render
-            inspection through the local Genie hub.
-          </Text>
-
-          <View style={styles.connection}>
-            <Text selectable style={styles.label}>
-              Hub URL
-            </Text>
-            <Text selectable style={styles.url} testID="genie-hub-url">
-              {genieUrl}
-            </Text>
-          </View>
-
-          <View style={styles.counter}>
-            <Text selectable style={styles.label}>
-              Counter
-            </Text>
-            <Text selectable style={styles.count} testID="counter-value">
-              {count}
-            </Text>
-            <Pressable
-              accessibilityRole="button"
-              onPress={() => setCount((value) => value + 1)}
-              style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
-              testID="increment-button"
-            >
-              <Text style={styles.buttonText}>Increment</Text>
-            </Pressable>
-          </View>
-        </View>
-        <MemoNameRow value={count} />
-        <NamedMemoRow value={count} />
-        <ExplicitMemoRow value={count} />
+        <CounterSection />
         <ToolTestbed />
       </ScrollView>
       <StatusBar style="dark" />
@@ -81,6 +39,56 @@ export default function App() {
   )
 }
 
+function CounterSection() {
+  const [count, setCount] = useState(0)
+
+  return (
+    <>
+    <View style={styles.card}>
+      <Text selectable style={styles.eyebrow}>
+        GENIE REACT / EXPO
+      </Text>
+      <Text selectable style={styles.title}>
+        Native integration demo
+      </Text>
+      <Text selectable style={styles.description}>
+        This screen exercises the React Native entry point, Metro bundling, and live render
+        inspection through the local Genie hub.
+      </Text>
+
+      <View style={styles.connection}>
+        <Text selectable style={styles.label}>
+          Hub URL
+        </Text>
+        <Text selectable style={styles.url} testID="genie-hub-url">
+          {genieUrl}
+        </Text>
+      </View>
+
+      <View style={styles.counter}>
+        <Text selectable style={styles.label}>
+          Counter
+        </Text>
+        <Text selectable style={styles.count} testID="counter-value">
+          {count}
+        </Text>
+        <Pressable
+          accessibilityRole="button"
+          onPress={() => setCount((value) => value + 1)}
+          style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
+          testID="increment-button"
+        >
+          <Text style={styles.buttonText}>Increment</Text>
+        </Pressable>
+      </View>
+    </View>
+    <MemoNameRow value={count} />
+    <NamedMemoRow value={count} />
+    <ExplicitMemoRow value={count} />
+    </>
+  )
+}
+
 const styles = StyleSheet.create({
   container: {
     flexGrow: 1,

$ npx genie-react status --wait 15000
selectedBridgeUrl: ws://127.0.0.1:4395/__genie/ws
sessionSelector:
  requested: null
  source: implicit-current
  resolvedSessionId: 94482af4-65c0-42ad-9e19-4f942916db2d
  implicit: true
connected: true
ready: true
sessionId: 94482af4-65c0-42ad-9e19-4f942916db2d
app: {name:"Expo demo",reactVersion:19.2.3,reactMounted:true}
domains: [session,react,memory,perf,plugin,timeline,router,query]
toolCount: 89
sessions[1] (sessionId {fields}):
  94482af4-65c0-42ad-9e19-4f942916db2d {logicalSessionId:e8ccb2d1-242a-4372-9041-b50ebf1a34d4,documentGeneration:1,logicalSessionCollision:false,collisionWithSessionIds:[],app:{name:"Expo demo",reactVersion:19.2.3,reactMounted:true},domains:[session,react,memory,perf,plugin,timeline,router,query],toolCount:89,connectedAt:1795060963025,ready:true,readyAt:1795060963025,current:true,origin:http://127.0.0.1:4395,runtimeVersion:1.0.2}
warnings: []
hub: {version:1.0.2,protocol:1}
[exit 0]

$ agent-device snapshot -i --session art-m5
Page: Expo Go
App: host.exp.Exponent
Snapshot: 20 visible nodes
@e1 [application] "Expo Go"
@e2 [scroll-area] [scrollable]
  [content below scroll-area hidden]
@e3 [text] "Lifecycle visibility test"
@e4 [text] "Mode: visible"
@e5 [button] "Freeze"
@e6 [button] "Thaw"
@e7 [button] "Hide"
@e8 [button] "Unmount"
@e9 [text] "Preserved count: 0"
@e10 [button] "Increment probe"
@e11 [text] "Native screen: active"
@e12 [other] "active"
@e13 [other] "covered"
@e14 [other] "removed"
@e15 [other] "Screen count: 0"
@e16 [text] "GENIE REACT / EXPO"
@e17 [text] "Native integration demo"
@e18 [text] "This screen exercises the React Native entry point, Metro bundling, and live render inspection through the local Genie hub."
@e19 [text] "Hub URL"
@e20 [text] "ws://127.0.0.1:4395/__genie/ws"
[exit 0]

$ agent-device scroll down 300 --settle --session art-m5
Scrolled down by 300 of the viewport (676px)
settled after 775ms: +10 -14 (~6 unchanged)
- @e3 [text] "Lifecycle visibility test"
- @e4 [text] "Mode: visible"
- @e5 [button] "Freeze"
- @e6 [button] "Thaw"
- @e7 [button] "Hide"
- @e8 [button] "Unmount"
- @e9 [text] "Preserved count: 0"
- @e10 [button] "Increment probe"
+ @e7~s286581 [text] "Counter"
+ @e8~s286581 [text] "0"
+ @e9~s286581 [button] "Increment"
+ @e10~s286581 [text] "Memo row: 0"
+ @e11~s286581 [text] "Named row: 0"
+ @e12~s286581 [text] "Explicit row: 0"
+ @e13~s286581 [text] "EXHAUSTIVE TOOL FIXTURES"
+ @e14~s286581 [text] "Deterministic targets for React, Query, Router, profiler, effect, and override tools."
+ @e15~s286581 [text] "Props, hooks, and context"
+ @e16~s286581 [text] "prop-original"
… changed lines truncated
[exit 0]

$ agent-device snapshot -i --session art-m5
Page: Expo Go
App: host.exp.Exponent
Snapshot: 16 visible nodes
@e1 [application] "Expo Go"
@e2 [scroll-area] [scrollable]
  [content above scroll-area hidden]
  [content below scroll-area hidden]
@e3 [text] "Native integration demo"
@e4 [text] "This screen exercises the React Native entry point, Metro bundling, and live render inspection through the local Genie hub."
@e5 [text] "Hub URL"
@e6 [text] "ws://127.0.0.1:4395/__genie/ws"
@e7 [text] "Counter"
@e8 [text] "0"
@e9 [button] "Increment"
@e10 [text] "Memo row: 0"
@e11 [text] "Named row: 0"
@e12 [text] "Explicit row: 0"
@e13 [text] "EXHAUSTIVE TOOL FIXTURES"
@e14 [text] "Deterministic targets for React, Query, Router, profiler, effect, and override tools."
@e15 [text] "Props, hooks, and context"
@e16 [text] "prop-original"
[exit 0]

===== VERIFY AFTER FIX, --domains react =====

$ npx genie-react verify begin --session 94482af4-65c0-42ad-9e19-4f942916db2d --name 'press Increment' --domains react --budget '{"fiberLimit":250,"operationLimit":155000,"timeLimitMs":62}' --claim 'render ToolTestbed max 0' --claim 'render VisibilityTestbed max 0' --claim 'render FreezeScreenTestbed max 0' --claim 'render MemoNameRow min 1'
recording vfy_14c55cd3-c540-49b7-aea8-1ed38391bf4d "press Increment"
  1 null render ToolTestbed max 0  {}
  2 null render VisibilityTestbed max 0  {}
  3 null render FreezeScreenTestbed max 0  {}
  4 null render MemoNameRow min 1  {}
window: {observationId:observation:5,startDocumentCommitId:18,domains:[react],quietMs:500,timeoutMs:10000,tailMs:500}
next: $ pnpm exec genie-react verify end vfy_14c55cd3-c540-49b7-aea8-1ed38391bf4d --session 94482af4-65c0-42ad-9e19-4f942916db2d
session: {sessionId:94482af4-65c0-42ad-9e19-4f942916db2d,logicalSessionId:e8ccb2d1-242a-4372-9041-b50ebf1a34d4,documentGeneration:1}
schemaVersion: "1.0"
targets: [{target:{component:ToolTestbed},status:resolved,instances:1,source:<checkout>/examples/expo-demo/App.tsx},{target:{component:VisibilityTestbed},status:resolved,instances:1,source:<checkout>/examples/expo-demo/App.tsx},{target:{component:FreezeScreenTestbed},status:resolved,instances:1,source:<checkout>/examples/expo-demo/App.tsx},{target:{component:MemoNameRow},status:resolved,instances:1,source:<checkout>/examples/expo-demo/App.tsx}]
startedAt: 2026-11-19T04:05:44.324Z
expiresAt: 2026-11-19T04:10:44.407Z
request: {budget:{fiberLimit:250,operationLimit:155000,timeLimitMs:62,targetOperationReserve:4000,targetTimeReserveMs:4,adaptive:true},settle:{quietMs:500,timeoutMs:10000,domains:[react]},maxDurationMs:300000,allowOverrides:false}
[exit 0]

$ agent-device press 'id="increment-button"' --settle --session art-m5
Tapped id="increment-button" (109, 413)
settled after 472ms: +4 -4 (~12 unchanged)
- @e8 [text] "0"
+ @e8~s286585 [text] "1"
- @e10 [text] "Memo row: 0"
- @e11 [text] "Named row: 0"
- @e12 [text] "Explicit row: 0"
+ @e10~s286585 [text] "Memo row: 1"
+ @e11~s286585 [text] "Named row: 1"
+ @e12~s286585 [text] "Explicit row: 1"
[exit 0]

$ npx genie-react verify end vfy_14c55cd3-c540-49b7-aea8-1ed38391bf4d --session 94482af4-65c0-42ad-9e19-4f942916db2d
pass vfy_14c55cd3-c540-49b7-aea8-1ed38391bf4d "press Increment"  3 commits, quiet after 801 ms (react)
  1 pass render ToolTestbed max 0  {renders:0,mounts:0,updates:0,remounts:0,semantics:exact,instances:1,activeInstances:1}
      claim: {kind:renders,target:{component:ToolTestbed},max:0,counting:renders,allowRemount:false}
      deciding: [{kind:coverage,complete:true,targetedComplete:true,semantics:exact},{kind:instance,mountId:mount:172,renderingState:mounted-rendering,source:<checkout>/examples/expo-demo/App.tsx:35:9}]
  2 pass render VisibilityTestbed max 0  {renders:0,mounts:0,updates:0,remounts:0,semantics:exact,instances:1,activeInstances:1}
      claim: {kind:renders,target:{component:VisibilityTestbed},max:0,counting:renders,allowRemount:false}
      deciding: [{kind:coverage,complete:true,targetedComplete:true,semantics:exact},{kind:instance,mountId:mount:173,renderingState:mounted-rendering,source:<checkout>/examples/expo-demo/App.tsx:32:9}]
  3 pass render FreezeScreenTestbed max 0  {renders:0,mounts:0,updates:0,remounts:0,semantics:exact,instances:1,activeInstances:1}
      claim: {kind:renders,target:{component:FreezeScreenTestbed},max:0,counting:renders,allowRemount:false}
      deciding: [{kind:coverage,complete:true,targetedComplete:true,semantics:exact},{kind:instance,mountId:mount:174,renderingState:mounted-rendering,source:<checkout>/examples/expo-demo/App.tsx:33:9}]
  4 pass render MemoNameRow min 1  {renders:1,mounts:0,updates:1,remounts:0,semantics:exact,instances:1,activeInstances:1}
      claim: {kind:renders,target:{component:MemoNameRow},min:1,counting:renders,allowRemount:false}
      deciding: [{kind:instance,mountId:mount:175,renders:1,mounts:0,updates:1,mountGeneration:1,latestDocumentCommitId:20,source:<checkout>/examples/expo-demo/App.tsx:85:5}]
window: {observationId:observation:5,startDocumentCommitId:18,settledDocumentCommitId:21,frozenDocumentCommitId:21,commits:3,settle:{outcome:met,quietMs:500,timeoutMs:10000,waitedMs:801,domains:{react:met}},tail:{ms:500,commits:0},environment:{bundle:development,strictMode:off,renderCollection:"degraded (hook installed after React initialised — commits before that point were not observed)",visibility:unavailable}}
! ui-outcome-not-observed: Genie does not check the screen; confirm it with the UI driver
! visibility-unobserved: the app reports no visibility signal, so a hidden interval was not observed
attempt 3 for these claims on this tab; previous fail vfy_e1ae9d36-c634-4b87-a7e4-b9da7400b87f; code changed since (Fast Refresh)
evidence: $ pnpm exec genie-react verify show vfy_14c55cd3-c540-49b7-aea8-1ed38391bf4d --session 94482af4-65c0-42ad-9e19-4f942916db2d
session: {sessionId:94482af4-65c0-42ad-9e19-4f942916db2d,logicalSessionId:e8ccb2d1-242a-4372-9041-b50ebf1a34d4,documentGeneration:1}
schemaVersion: "1.0"
exitCode: 0
stage: end
ledger: {fingerprint:cf_56bb8e1b1a99,scope:logical-session,storage:memory,attempt:3,history:[{verificationId:vfy_104cacd8-d2dd-4259-b132-f0b7e0e45152,verdict:fail,reasons:[],endedAt:2026-11-19T04:04:55.778Z},{verificationId:vfy_e1ae9d36-c634-4b87-a7e4-b9da7400b87f,verdict:fail,reasons:[],endedAt:2026-11-19T04:05:09.667Z}],codeChangedSincePrevious:fast-refresh,failsOnSameCode:0}
evidence: {retained:true,tools:[react_get_renders,react_component_cohort,react_list_overrides,query_is_fetching,react_refresh_events,browser_visibility,react_profile_stop]}
startedAt: 2026-11-19T04:05:44.324Z
endedAt: 2026-11-19T04:05:47.042Z
request: {budget:{fiberLimit:250,operationLimit:155000,timeLimitMs:62,targetOperationReserve:4000,targetTimeReserveMs:4,adaptive:true},settle:{quietMs:500,timeoutMs:10000,domains:[react]},maxDurationMs:300000,allowOverrides:false}
[exit 0]

===== AFTER FIX: render list for one press =====

$ npx genie-react call react_clear_renders '{"budget":{"fiberLimit":250,"operationLimit":155000,"timeLimitMs":62,"targetOperationReserve":4000,"targetTimeReserveMs":4}}' --session 94482af4-65c0-42ad-9e19-4f942916db2d
ok: true
tracking: true
documentCommitId: 21
observation: {id:observation:6,epoch:6,startedAfterDocumentCommitId:21}
observationConfig:
  adaptive: true
  adaptiveScale: 1
  fiberLimit: 250
  operationLimit: 155000
  timeLimitMs: 62
  targetOperationReserve: 4000
  targetTimeReserveMs: 4
  lifecycleBufferLimit: 1000
  lifecycleTargetReserve: 100
strictMode: off
[exit 0]

$ agent-device press 'id="increment-button"' --settle --session art-m5
Tapped id="increment-button" (109, 413)
settled after 446ms: +4 -4 (~12 unchanged)
- @e8 [text] "1"
+ @e8~s286588 [text] "2"
- @e10 [text] "Memo row: 1"
- @e11 [text] "Named row: 1"
- @e12 [text] "Explicit row: 1"
+ @e10~s286588 [text] "Memo row: 2"
+ @e11~s286588 [text] "Named row: 2"
+ @e12~s286588 [text] "Explicit row: 2"
[exit 0]

$ npx genie-react call react_quiesce '{"idleMs":500,"timeoutMs":10000}' --fail-on-result-error --session 94482af4-65c0-42ad-9e19-4f942916db2d
ok: true
outcome: idle
elapsedMs: 719
observedCommits: 0
documentCommitId: 24
sessionId: 94482af4-65c0-42ad-9e19-4f942916db2d
renderCollection: "degraded (hook installed after React initialised — commits before that point were not observed)"
pendingWork:
  documentCommitId: 24
  scheduledRoots: 0
  suspendedBoundaries: 0
  dehydratedBoundaries: 0
  boundaries: []
  scanTruncated: false
  scannedFibers: 376
[exit 0]

$ npx genie-react call react_get_renders '{"limit":80}' --session 94482af4-65c0-42ad-9e19-4f942916db2d --fields name,renders,necessity,necessityReason
[4]:
  each: {renders:1}
  - {name:CounterSection,necessity:unknown,necessityReason:effects-scheduled}
  - {name:MemoNameRow,necessity:unnecessary,necessityReason:output-unchanged}
  - {name:InnerNamedRow,necessity:unnecessary,necessityReason:output-unchanged}
  - {name:CustomMemoRow,necessity:unnecessary,necessityReason:output-unchanged}
[exit 0]

$ npx genie-react call react_get_renders '{"limit":80}' --session 94482af4-65c0-42ad-9e19-4f942916db2d --select /coverage
status: ok
selection: {expression:/coverage,matchedPathCount:1,matchedPaths:[/coverage],omittedPathCount:120}
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

===== REVERTED: git checkout -- examples/expo-demo/App.tsx; git status --short shows only untracked .genie =====
```

## Re-run on Genie 1.1.0

- Date: 2026-11-19 (Asia/Riyadh, UTC+3)
- Commit: `ce408cb205c0e798cb04c35512772b7454283141`
- App: `examples/expo-demo` in Expo Go 57.0.9, React 19.2.3, React Native 0.86.0, Expo SDK 57, TanStack Router 1.170.41, Genie CLI and runtime 1.1.0 built from this commit (`pnpm install`, `pnpm build`)
- Device: iOS Simulator "iPhone 17e", iOS 27.2 (UDID 805932FB-AD05-40BA-82C1-82090709CB00), booted for this run and shut down after it
- URL: exp://127.0.0.1:5241 (Metro), Genie hub ws://127.0.0.1:4495/__genie/ws
- Driver: agent-device 0.21.39, session `upd-e`. Genie targets the app by the `sessionId` that `genie-react status` printed.
- Background processes, started from `examples/expo-demo`:
  - `npx genie-react hub --port 4495`
  - `EXPO_PUBLIC_GENIE_URL=ws://127.0.0.1:4495/__genie/ws npx expo start --port 5241`
  - `xcrun simctl boot 805932FB-AD05-40BA-82C1-82090709CB00`. Expo Go 57.0.9 was already installed on it.
- Differences from the 1.0.2 run: the first window uses the default budget, every `verify` uses no `--budget` and no `--domains`, and the wait step is `devtools_wait` condition `settled` with `"domains":["react","query","router"]`, as the 1.1.0 skill says. iOS showed no "Open in Expo Go?" prompt this time.
- The fix (moving the counter state into a `CounterSection` component, the same diff as the 1.0.2 run) was applied only for the "after" runs and reverted with `git checkout -- examples/expo-demo/App.tsx`.

Path redaction: the absolute checkout path is replaced with `<checkout>` and the home directory with `~`. No other value is changed.

The log below is every command in the order it ran, each followed by its full, untrimmed output and its exit code. Commands run from `examples/expo-demo`. A few lines are pipes through `grep` or `head` for readability while capturing; those are logged as run.

Not in this log: three reads of `react_render_causes` with `"view":"full"` and `--json` for `MemoNameRow`, `ToolTestbed` and `HookFixture`, parsed with a short Python script to print each event's `assessment`. Each listed `subtreeHostMutations.writes: ["#text"]`. The article uses only the `MemoNameRow` value, which the logged full view below also shows.

```text
date: Thu Nov 19 12:01:08 +03 2026  commit: ce408cb205c0e798cb04c35512772b7454283141
Setup (background processes): npx genie-react hub --port 4495 ; EXPO_PUBLIC_GENIE_URL=ws://127.0.0.1:4495/__genie/ws npx expo start --port 5241 ; xcrun simctl boot 805932FB-AD05-40BA-82C1-82090709CB00 (iPhone 17e, iOS 27.2); Expo Go 57.0.9 already installed on that simulator

$ node_modules/.bin/genie-react --version
1.1.0
[exit 0]

$ agent-device open 'Expo Go' exp://127.0.0.1:5241 --platform ios --device 'iPhone 17e' --session upd-e
Opened: Expo Go
Session state: ~/.agent-device/sessions/upd-e
[exit 0]

$ agent-device snapshot -i --session upd-e
Page: Expo Go
App: host.exp.Exponent
Snapshot: 42 visible nodes
@e1 [application] "Expo Go"
@e2 [scroll-area] [scrollable]
  [content below scroll-area hidden]
@e3 [text] "Lifecycle visibility test"
@e4 [text] "Mode: visible"
@e5 [button] "Freeze"
@e6 [button] "Thaw"
@e7 [button] "Hide"
@e8 [button] "Unmount"
@e9 [text] "Preserved count: 0"
@e10 [button] "Increment probe"
@e11 [text] "Native screen: active"
@e12 [other] "active"
@e13 [other] "covered"
@e14 [other] "removed"
@e15 [other] "Screen count: 0"
@e16 [text] "GENIE REACT / EXPO"
@e17 [text] "Native integration demo"
@e18 [text] "This screen exercises the React Native entry point, Metro bundling, and live render inspection through the local Genie hub."
@e19 [text] "Hub URL"
@e20 [text] "ws://127.0.0.1:4495/__genie/ws"
@e21 [text] "expo-demo"
@e22 [button] "Close"
@e23 [text] "SDK version: 57.0.0"
@e24 [scroll-area] [scrollable]
  [content below scroll-area hidden]
@e25 [button] "Reload"
@e26 [button] "Go home"
@e27 [text] "TOOLS"
@e28 [button] "Source code explorer"
@e29 [button] "Toggle performance monitor"
@e30 [button] "Toggle element inspector"
@e31 [button] "Open DevTools"
@e32 [image] "Running"
@e33 [text] "Fast refresh"
@e34 [switch] "1" [checked]
@e35 [switch] "1" [checked]
@e36 [scroll-area] [scrollable]
  [content below scroll-area hidden]
@e37 [image] "dev-tools"
@e38 [text] "This is the developer menu. It gives you access to useful tools in Expo Go."
@e39 [text] "You can open it at any time by pressing the blue button with the gear icon, or with the ⌃ + d keyboard shortcut."
@e40 [text] "(Connect Hardware Keyboard must be enabled on your simulator to use this shortcut, you can toggle it with ⌘ + shift + K.)"
@e41 [button] "Continue"
@e42 [toolbar] "Toolbar"
[exit 0]

$ npx genie-react status --wait 15000
selectedBridgeUrl: ws://127.0.0.1:4495/__genie/ws
sessionSelector:
  requested: null
  source: implicit-current
  resolvedSessionId: d270f501-e559-487a-9c85-b457404b8072
  implicit: true
connected: true
ready: true
sessionId: d270f501-e559-487a-9c85-b457404b8072
app: {name:"Expo demo",reactVersion:19.2.3,reactMounted:true}
domains: [session,react,memory,perf,plugin,timeline,network,router,query]
toolCount: 92
sessions[1] (sessionId {fields}):
  d270f501-e559-487a-9c85-b457404b8072 {logicalSessionId:f9a9d247-5676-410e-929d-96afe5a9b03f,documentGeneration:1,logicalSessionCollision:false,collisionWithSessionIds:[],app:{name:"Expo demo",reactVersion:19.2.3,reactMounted:true},domains:[session,react,memory,perf,plugin,timeline,network,router,query],toolCount:92,connectedAt:1795078881917,ready:true,readyAt:1795078881917,current:true,origin:http://127.0.0.1:4495,runtimeVersion:1.1.0}
warnings: []
hub: {version:1.1.0,protocol:1}
[exit 0]

$ agent-device press @e41 --settle --session upd-e
Tapped @e41 (195, 786)
settled after 857ms: +0 -6 (~36 unchanged)
- @e36 [scroll-area]
- @e37 [image] "dev-tools"
- @e38 [text] "This is the developer menu. It gives you access to useful tools in Expo Go."
- @e39 [text] "You can open it at any time by pressing the blue button with the gear icon, or with the ⌃ + d keyboard shortcut."
- @e40 [text] "(Connect Hardware Keyboard must be enabled on your simulator to use this shortcut, you can toggle it with ⌘ + shift + K.)"
- @e41 [button] "Continue"
unchanged interactive (20):
= @e2~s349212 [scroll-area]
= @e3~s349212 [text] "Lifecycle visibility test"
= @e4~s349212 [text] "Mode: visible"
= @e5~s349212 [button] "Freeze"
= @e6~s349212 [button] "Thaw"
= @e7~s349212 [button] "Hide"
= @e8~s349212 [button] "Unmount"
= @e9~s349212 [text] "Preserved count: 0"
= @e10~s349212 [button] "Increment probe"
= @e11~s349212 [text] "Native screen: active"
= @e12~s349212 [other] "active"
= @e13~s349212 [other] "covered"
= @e14~s349212 [other] "removed"
= @e15~s349212 [other] "Screen count: 0"
= @e16~s349212 [text] "GENIE REACT / EXPO"
= @e17~s349212 [text] "Native integration demo"
= @e18~s349212 [text] "This screen exercises the React Native entry point, Metro bundling, and live render inspection through the local Genie hub."
= @e19~s349212 [text] "Hub URL"
= @e20~s349212 [text] "ws://127.0.0.1:4495/__genie/ws"
= @e21~s349212 [text] "expo-demo"
… more interactive elements not shown, use snapshot -i
[exit 0]

$ agent-device snapshot -i --session upd-e
Page: Expo Go
App: host.exp.Exponent
Snapshot: 36 visible nodes
@e1 [application] "Expo Go"
@e2 [scroll-area] [scrollable]
  [content below scroll-area hidden]
@e3 [text] "Lifecycle visibility test"
@e4 [text] "Mode: visible"
@e5 [button] "Freeze"
@e6 [button] "Thaw"
@e7 [button] "Hide"
@e8 [button] "Unmount"
@e9 [text] "Preserved count: 0"
@e10 [button] "Increment probe"
@e11 [text] "Native screen: active"
@e12 [other] "active"
@e13 [other] "covered"
@e14 [other] "removed"
@e15 [other] "Screen count: 0"
@e16 [text] "GENIE REACT / EXPO"
@e17 [text] "Native integration demo"
@e18 [text] "This screen exercises the React Native entry point, Metro bundling, and live render inspection through the local Genie hub."
@e19 [text] "Hub URL"
@e20 [text] "ws://127.0.0.1:4495/__genie/ws"
@e21 [text] "expo-demo"
@e22 [button] "Close"
@e23 [text] "SDK version: 57.0.0"
@e24 [scroll-area] [scrollable]
  [content below scroll-area hidden]
@e25 [button] "Reload"
@e26 [button] "Go home"
@e27 [text] "TOOLS"
@e28 [button] "Source code explorer"
@e29 [button] "Toggle performance monitor"
@e30 [button] "Toggle element inspector"
@e31 [button] "Open DevTools"
@e32 [image] "Running"
@e33 [text] "Fast refresh"
@e34 [switch] "1" [checked]
@e35 [switch] "1" [checked]
@e36 [toolbar] "Toolbar"
[exit 0]

$ agent-device press @e22 --settle --session upd-e
Tapped @e22 (349, 399)
settled after 852ms: +1 -16 (~20 unchanged)
- @e21 [text] "expo-demo"
- @e22 [button] "Close"
- @e23 [text] "SDK version: 57.0.0"
- @e24 [scroll-area]
- @e25 [button] "Reload"
- @e26 [button] "Go home"
- @e27 [text] "TOOLS"
- @e28 [button] "Source code explorer"
+ @e21~s349216 [image] "Gear Shape, Filled"
… changed lines truncated
[exit 0]

$ agent-device scroll down 300 --settle --session upd-e
Scrolled down by 300 of the viewport (676px)
settled after 1898ms: +10 -14 (~7 unchanged)
- @e3 [text] "Lifecycle visibility test"
- @e4 [text] "Mode: visible"
- @e5 [button] "Freeze"
- @e6 [button] "Thaw"
- @e7 [button] "Hide"
- @e8 [button] "Unmount"
- @e9 [text] "Preserved count: 0"
- @e10 [button] "Increment probe"
+ @e7~s349222 [text] "Counter"
+ @e8~s349222 [text] "0"
+ @e9~s349222 [button] "Increment"
+ @e10~s349222 [text] "Memo row: 0"
+ @e11~s349222 [text] "Named row: 0"
+ @e12~s349222 [text] "Explicit row: 0"
+ @e13~s349222 [text] "EXHAUSTIVE TOOL FIXTURES"
+ @e14~s349222 [text] "Deterministic targets for React, Query, Router, profiler, effect, and override tools."
+ @e15~s349222 [text] "Props, hooks, and context"
+ @e16~s349222 [text] "prop-original"
… changed lines truncated
[exit 0]

$ agent-device snapshot -i --session upd-e
Page: Expo Go
App: host.exp.Exponent
Snapshot: 17 visible nodes
@e1 [application] "Expo Go"
@e2 [scroll-area] [scrollable]
  [content above scroll-area hidden]
  [content below scroll-area hidden]
@e3 [text] "Native integration demo"
@e4 [text] "This screen exercises the React Native entry point, Metro bundling, and live render inspection through the local Genie hub."
@e5 [text] "Hub URL"
@e6 [text] "ws://127.0.0.1:4495/__genie/ws"
@e7 [text] "Counter"
@e8 [text] "0"
@e9 [button] "Increment"
@e10 [text] "Memo row: 0"
@e11 [text] "Named row: 0"
@e12 [text] "Explicit row: 0"
@e13 [text] "EXHAUSTIVE TOOL FIXTURES"
@e14 [text] "Deterministic targets for React, Query, Router, profiler, effect, and override tools."
@e15 [text] "Props, hooks, and context"
@e16 [text] "prop-original"
@e17 [image] "Gear Shape, Filled"
[exit 0]
SID=d270f501-e559-487a-9c85-b457404b8072 (from genie-react status)

$ npx genie-react call react_clear_renders '{}' --session d270f501-e559-487a-9c85-b457404b8072
ok: true
tracking: true
documentCommitId: 3
observation: {id:observation:1,epoch:1,startedAfterDocumentCommitId:3}
observationConfig:
  adaptive: true
  adaptiveScale: 1
  fiberLimit: 250
  operationLimit: 20000
  timeLimitMs: 64
  targetOperationReserve: 4000
  targetTimeReserveMs: 32
  lifecycleBufferLimit: 1000
  lifecycleTargetReserve: 100
strictMode: off
[exit 0]

$ agent-device press 'id="increment-button"' --settle --session upd-e
Tapped id="increment-button" (109, 413)
settled after 396ms: +4 -4 (~13 unchanged)
- @e8 [text] "0"
+ @e8~s349226 [text] "1"
- @e10 [text] "Memo row: 0"
- @e11 [text] "Named row: 0"
- @e12 [text] "Explicit row: 0"
+ @e10~s349226 [text] "Memo row: 1"
+ @e11~s349226 [text] "Named row: 1"
+ @e12~s349226 [text] "Explicit row: 1"
[exit 0]

$ npx genie-react call devtools_wait '{"condition":"settled","domains":["react","query","router"],"timeoutMs":10000}' --fail-on-result-error --session d270f501-e559-487a-9c85-b457404b8072
ok: true
condition: settled
waitedMs: 922
validConditions: [connected,ready,component,query-settled,navigation,react-quiet,settled]
lastObserved:
  react:
    documentCommitId: 7
    renderCollection: available
    quietForMs: 544
    requiredQuietMs: 500
    pendingWork: {documentCommitId:7,scheduledRoots:0,suspendedBoundaries:0,dehydratedBoundaries:0,boundaries:[],scanTruncated:false,scannedFibers:375}
  query: {fetching:0,mutating:0}
  router: {pathname:/,isLoading:false,settled:true,pendingWork:[],settlement:router-settled}
domains:
  react:
    status: met
    lastObserved: {documentCommitId:7,renderCollection:available,quietForMs:544,requiredQuietMs:500,pendingWork:{documentCommitId:7,scheduledRoots:0,suspendedBoundaries:0,dehydratedBoundaries:0,boundaries:[],scanTruncated:false,scannedFibers:375}}
  query: {status:met,lastObserved:{fetching:0,mutating:0}}
  router:
    status: met
    lastObserved: {pathname:/,isLoading:false,settled:true,pendingWork:[],settlement:router-settled}
[exit 0]

$ npx genie-react call react_get_renders '{"limit":80}' --session d270f501-e559-487a-9c85-b457404b8072 --select /coverage
status: ok
selection: {expression:/coverage,matchedPathCount:1,matchedPaths:[/coverage],omittedPathCount:650}
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
  complete: false
  inputAttributionComplete: true
  semantics: unknown
  coverageDomain: render-causality
  incompleteBecause[1]:
    - {reason:source-classification-incomplete,fibers:2,detail:"2 of 171 candidates have unresolved ownership. appOnly keeps them, but any of them may be library code it would hide, so rows and counts can change once ownership resolves.",next:"Pass appOnly:false for counts that do not depend on ownership, or read again shortly: ownership keeps resolving in the background, though a component React rendered without an owner stack stays unknown."}
[exit 0]

$ npx genie-react call react_get_renders '{"limit":80}' --session d270f501-e559-487a-9c85-b457404b8072 --fields name,renders,necessity,necessityReason
[29]:
  each: {renders:1}
  - {name:App,necessity:necessary,necessityReason:dom-changed}
  - {name:Genie,necessity:unnecessary,necessityReason:inputs-unchanged}
  - {name:VisibilityTestbed,necessity:unnecessary,necessityReason:inputs-unchanged}
  - {name:VisibilityProbe,necessity:unnecessary,necessityReason:inputs-unchanged}
  - {name:FreezeScreenTestbed,necessity:unnecessary,necessityReason:inputs-unchanged}
  - {name:FrozenScreenProbe,necessity:unnecessary,necessityReason:inputs-unchanged}
  - {name:MemoNameRow,necessity:necessary,necessityReason:dom-changed}
  - {name:InnerNamedRow,necessity:necessary,necessityReason:dom-changed}
  - {name:CustomMemoRow,necessity:necessary,necessityReason:dom-changed}
  - {name:ToolTestbed,necessity:necessary,necessityReason:dom-changed}
  - {name:PropFixture,necessity:unnecessary,necessityReason:inputs-unchanged}
  - {name:HookFixture,necessity:necessary,necessityReason:dom-changed}
  - {name:AuditButton,necessity:unnecessary,necessityReason:inputs-unchanged}
  - {name:AuditButton,necessity:unnecessary,necessityReason:inputs-unchanged}
  - {name:ContextFixture,necessity:unnecessary,necessityReason:inputs-unchanged}
  - {name:SuspenseFixture,necessity:unnecessary,necessityReason:inputs-unchanged}
  - {name:AuditErrorBoundary,necessity:unnecessary,necessityReason:inputs-unchanged}
  - {name:ErrorFixture,necessity:unnecessary,necessityReason:inputs-unchanged}
  - {name:AuditButton,necessity:unknown,necessityReason:output-incomplete}
  - {name:EffectFixture,necessity:unnecessary,necessityReason:inputs-unchanged}
  - {name:AuditButton,necessity:unknown,necessityReason:effects-scheduled}
  - {name:SlowRenderer,necessity:unnecessary,necessityReason:inputs-unchanged}
  - {name:AuditButton,necessity:unknown,necessityReason:output-incomplete}
  - {name:QueryFixture,necessity:unnecessary,necessityReason:inputs-unchanged}
  - {name:AuditButton,necessity:unknown,necessityReason:effects-scheduled}
  - {name:AuditButton,necessity:unknown,necessityReason:effects-scheduled}
  - {name:RouterFixture,necessity:unnecessary,necessityReason:inputs-unchanged}
  - {name:AuditButton,necessity:unknown,necessityReason:output-incomplete}
  - {name:AuditButton,necessity:unknown,necessityReason:output-incomplete}
[exit 0]

$ npx genie-react call react_get_renders '{"limit":80,"appOnly":false}' --session d270f501-e559-487a-9c85-b457404b8072 --select /coverage
status: ok
selection: {expression:/coverage,matchedPathCount:1,matchedPaths:[/coverage],omittedPathCount:1883}
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

$ npx genie-react call react_render_causes '{"component":"App","limit":1}' --session d270f501-e559-487a-9c85-b457404b8072
componentMatch:
  component: App
  exact: true
  status: matched
  matchedNames: [App]
  matchedNameCount: 1
  similarNames: []
tracking: true
commits: 4
documentCommitId: 7
observation: {id:observation:1,epoch:1,startedAfterDocumentCommitId:3}
attribution:
  status: current
  startedAtDocumentCommitId: 7
  completedAtDocumentCommitId: 7
  startedAtAnalysisGeneration: 8
  completedAtAnalysisGeneration: 8
view: summary
events[1] (componentName #componentId {fields}, then ← kind evidence name {fields} per cause):
  App #10406135332873 {renderEventId:render:5:4,documentCommitId:5,mountId:mount:4,necessity:necessary,necessityReason:dom-changed,inputEvidence:changed,source:{location:<checkout>/examples/expo-demo/App.tsx:20:5,role:component-body,ownership:app}}
    ← state exact "state[0]"
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
renderEventRetention: {evictedEvents:0,earliestDocumentCommitId:4,latestDocumentCommitId:7}
coverage:
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
  droppedRenderEvents: 0
[exit 0]

$ npx genie-react call react_render_causes '{"component":"MemoNameRow","limit":1}' --session d270f501-e559-487a-9c85-b457404b8072
componentMatch:
  component: MemoNameRow
  exact: true
  status: matched
  matchedNames: [MemoNameRow]
  matchedNameCount: 1
  similarNames: []
tracking: true
commits: 4
documentCommitId: 7
observation: {id:observation:1,epoch:1,startedAfterDocumentCommitId:3}
attribution:
  status: current
  startedAtDocumentCommitId: 7
  completedAtDocumentCommitId: 7
  startedAtAnalysisGeneration: 8
  completedAtAnalysisGeneration: 8
view: summary
events[1] (componentName #componentId {fields}, then ← kind evidence name {fields} per cause):
  MemoNameRow #10406135333024 {renderEventId:render:5:95,documentCommitId:5,mountId:mount:78,key:.3,necessity:necessary,necessityReason:dom-changed,inputEvidence:changed,source:{location:<checkout>/examples/expo-demo/App.tsx:74:9,role:element-callsite,ownership:app}}
    ← props exact value
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
renderEventRetention: {evictedEvents:0,earliestDocumentCommitId:4,latestDocumentCommitId:7}
coverage:
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
  droppedRenderEvents: 0
[exit 0]

$ npx genie-react call react_render_causes '{"component":"ToolTestbed","limit":1}' --session d270f501-e559-487a-9c85-b457404b8072
componentMatch:
  component: ToolTestbed
  exact: true
  status: matched
  matchedNames: [ToolTestbed]
  matchedNameCount: 1
  similarNames: []
tracking: true
commits: 4
documentCommitId: 7
observation: {id:observation:1,epoch:1,startedAfterDocumentCommitId:3}
attribution:
  status: current
  startedAtDocumentCommitId: 7
  completedAtDocumentCommitId: 7
  startedAtAnalysisGeneration: 8
  completedAtAnalysisGeneration: 8
view: summary
events[1] (componentName #componentId {fields}, then ← kind evidence name {fields} per cause):
  ToolTestbed #10406135333039 {renderEventId:render:5:101,documentCommitId:5,mountId:mount:84,key:.6,necessity:necessary,necessityReason:dom-changed,inputEvidence:none-observed,source:{location:<checkout>/examples/expo-demo/App.tsx:77:9,role:element-callsite,ownership:app}}
    ← parent inferred ScrollView {origin:App}
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
renderEventRetention: {evictedEvents:0,earliestDocumentCommitId:4,latestDocumentCommitId:7}
coverage:
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
  droppedRenderEvents: 0
[exit 0]

$ npx genie-react call react_render_causes '{"component":"VisibilityTestbed","limit":1}' --session d270f501-e559-487a-9c85-b457404b8072
componentMatch:
  component: VisibilityTestbed
  exact: true
  status: matched
  matchedNames: [VisibilityTestbed]
  matchedNameCount: 1
  similarNames: []
tracking: true
commits: 4
documentCommitId: 7
observation: {id:observation:1,epoch:1,startedAfterDocumentCommitId:3}
attribution:
  status: current
  startedAtDocumentCommitId: 7
  completedAtDocumentCommitId: 7
  startedAtAnalysisGeneration: 8
  completedAtAnalysisGeneration: 8
view: summary
events[1] (componentName #componentId {fields}, then ← kind evidence name {fields} per cause):
  VisibilityTestbed #10406135332882 {renderEventId:render:5:9,documentCommitId:5,mountId:mount:9,key:.0,necessity:unnecessary,necessityReason:inputs-unchanged,inputEvidence:none-observed,source:{location:<checkout>/examples/expo-demo/App.tsx:34:9,role:element-callsite,ownership:app}}
    ← parent inferred ScrollView {origin:App}
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
renderEventRetention: {evictedEvents:0,earliestDocumentCommitId:4,latestDocumentCommitId:7}
coverage:
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
  droppedRenderEvents: 0
[exit 0]

$ npx genie-react call react_render_causes '{"component":"HookFixture","limit":1}' --session d270f501-e559-487a-9c85-b457404b8072
componentMatch:
  component: HookFixture
  exact: true
  status: matched
  matchedNames: [HookFixture]
  matchedNameCount: 1
  similarNames: []
tracking: true
commits: 4
documentCommitId: 7
observation: {id:observation:1,epoch:1,startedAfterDocumentCommitId:3}
attribution:
  status: current
  startedAtDocumentCommitId: 7
  completedAtDocumentCommitId: 7
  startedAtAnalysisGeneration: 8
  completedAtAnalysisGeneration: 8
view: summary
events[1] (componentName #componentId {fields}, then ← kind evidence name {fields} per cause):
  HookFixture #10406135333057 {renderEventId:render:5:109,documentCommitId:5,mountId:mount:92,necessity:necessary,necessityReason:dom-changed,inputEvidence:none-observed,source:{location:<checkout>/examples/expo-demo/components/tool-testbed.tsx:252:9,role:element-callsite,ownership:app}}
    ← parent inferred View {origin:App}
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
renderEventRetention: {evictedEvents:0,earliestDocumentCommitId:4,latestDocumentCommitId:7}
coverage:
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
  droppedRenderEvents: 0
[exit 0]

$ npx genie-react call react_render_causes '{"component":"MemoNameRow","limit":1,"view":"full"}' --session d270f501-e559-487a-9c85-b457404b8072 | grep -E '←|writes|necessity'
events[1] (componentName #componentId {fields}, then ← kind evidence name {fields} per cause):
  MemoNameRow #10406135333024 {renderEventId:render:5:95,observationId:observation:1,commitId:2,documentCommitId:5,instance:{fiberId:10406135333024,mountId:mount:78,key:.3,siblingIndex:3,parent:{fiberId:10406135332878,name:ScrollView,key:null},keyedParent:{fiberId:10406135332870,name:View,key:"0"},logicalPath:"main(RootComponent)[index=0] > AppContainer[index=0] > View[index=0] > <RCTView>[index=0] > View[key=\"0\"] > <RCTView>[index=0] > withDevTools(App)[index=0] > App[index=0] > QueryClientProvider[index=0] > ScrollView[index=1] > ScrollView[index=0] > <RCTScrollView>[index=0] > <RCTScrollContentView>[index=0] > MemoNameRow[key=\".3\"]",logicalIdentityEvidence:keyed,mountGeneration:1,mountGenerationEvidence:exact,hostSelector:null},necessity:necessary,necessityReason:dom-changed,assessment:{inputEvidence:changed,observedInputKinds:[props],behaviorEvidence:{subtreeHostMutations:{status:observed,count:1,pendingSubtrees:0,omittedByLimit:0,callbackOnlyUpdates:0,writes:["#text"],callbacks:[]},scheduledEffects:{status:none-observed,count:0},subtreeScheduledEffects:{status:incomplete,count:0},unobservedDomains:[focus,url,network,transition,freshness,effect-execution]},optimizationSafety:not-proven-safe,requiredValidation:[dom,aria,focus,url,network,transition]},inputCoverage:{complete:true,omittedInputs:0,scanTruncated:false,propsNotEnumerated:false},source:{file:<checkout>/examples/expo-demo/App.tsx,line:74,column:9,functionName:App,sourceMapConfidence:mapped,role:element-callsite},sourceAttribution:{role:usage-or-definition-fallback,evidence:inferred},sourceOwnership:app,isLibrary:false}
    ← props exact value {referenceChanged:false,referenceOnly:false,unstable:false,beforePresent:true,afterPresent:true,before:0,after:1,deepDiff:{changes:[{kind:value,path:"",before:0,after:1}],visited:1,truncated:false}}
[exit 0]

$ npx genie-react verify begin --session d270f501-e559-487a-9c85-b457404b8072 --name 'press Increment' --claim 'render ToolTestbed max 0' --claim 'render VisibilityTestbed max 0' --claim 'render FreezeScreenTestbed max 0' --claim 'render MemoNameRow min 1'
recording vfy_3827dc95-5067-4548-bb86-e1ba4674c779 "press Increment"
  1 recording render ToolTestbed max 0
  2 recording render VisibilityTestbed max 0
  3 recording render FreezeScreenTestbed max 0
  4 recording render MemoNameRow min 1
window: {observationId:observation:2,startDocumentCommitId:7,domains:[react,query,router,network],quietMs:500,timeoutMs:10000,tailMs:500}
next: $ npx genie-react verify end vfy_3827dc95-5067-4548-bb86-e1ba4674c779 --session d270f501-e559-487a-9c85-b457404b8072
session: {sessionId:d270f501-e559-487a-9c85-b457404b8072,logicalSessionId:f9a9d247-5676-410e-929d-96afe5a9b03f,documentGeneration:1}
schemaVersion: "1.0"
targets: [{target:{component:ToolTestbed},status:resolved,instances:1,source:<checkout>/examples/expo-demo/App.tsx},{target:{component:VisibilityTestbed},status:resolved,instances:1,source:<checkout>/examples/expo-demo/App.tsx},{target:{component:FreezeScreenTestbed},status:resolved,instances:1,source:<checkout>/examples/expo-demo/App.tsx},{target:{component:MemoNameRow},status:resolved,instances:1,source:<checkout>/examples/expo-demo/App.tsx}]
startedAt: 2026-11-19T09:02:44.275Z
expiresAt: 2026-11-19T09:07:44.349Z
request: {budget:{fiberLimit:250,operationLimit:20000,timeLimitMs:8,targetOperationReserve:4000,targetTimeReserveMs:4,adaptive:true},settle:{quietMs:500,timeoutMs:10000},maxDurationMs:300000,allowOverrides:false}
[exit 0]

$ agent-device press 'id="increment-button"' --settle --session upd-e
Tapped id="increment-button" (109, 413)
settled after 461ms: +4 -4 (~13 unchanged)
- @e8 [text] "1"
+ @e8~s349229 [text] "2"
- @e10 [text] "Memo row: 1"
- @e11 [text] "Named row: 1"
- @e12 [text] "Explicit row: 1"
+ @e10~s349229 [text] "Memo row: 2"
+ @e11~s349229 [text] "Named row: 2"
+ @e12~s349229 [text] "Explicit row: 2"
[exit 0]

$ npx genie-react verify end vfy_3827dc95-5067-4548-bb86-e1ba4674c779 --session d270f501-e559-487a-9c85-b457404b8072
fail vfy_3827dc95-5067-4548-bb86-e1ba4674c779 "press Increment"  3 commits, quiet after 784 ms (react, query, router, network)
  1 fail render ToolTestbed max 0  {renders:1,mounts:0,updates:1,remounts:0,semantics:exact,instances:1,activeInstances:1}
      claim: {kind:renders,target:{component:ToolTestbed},max:0,counting:renders,allowRemount:false}
      deciding: [{kind:instance,mountId:mount:84,key:.6,renders:1,mounts:0,updates:1,mountGeneration:1,latestDocumentCommitId:9,source:<checkout>/examples/expo-demo/App.tsx:77:9}]
  2 fail render VisibilityTestbed max 0  {renders:1,mounts:0,updates:1,remounts:0,semantics:exact,instances:1,activeInstances:1}
      claim: {kind:renders,target:{component:VisibilityTestbed},max:0,counting:renders,allowRemount:false}
      deciding: [{kind:instance,mountId:mount:9,key:.0,renders:1,mounts:0,updates:1,mountGeneration:1,latestDocumentCommitId:9,source:<checkout>/examples/expo-demo/App.tsx:34:9}]
  3 fail render FreezeScreenTestbed max 0  {renders:1,mounts:0,updates:1,remounts:0,semantics:exact,instances:1,activeInstances:1}
      claim: {kind:renders,target:{component:FreezeScreenTestbed},max:0,counting:renders,allowRemount:false}
      deciding: [{kind:instance,mountId:mount:39,key:.1,renders:1,mounts:0,updates:1,mountGeneration:1,latestDocumentCommitId:9,source:<checkout>/examples/expo-demo/App.tsx:35:9}]
  4 pass render MemoNameRow min 1  {renders:1,mounts:0,updates:1,remounts:0,semantics:exact,instances:1,activeInstances:1}
      claim: {kind:renders,target:{component:MemoNameRow},min:1,counting:renders,allowRemount:false}
      deciding: [{kind:instance,mountId:mount:78,key:.3,renders:1,mounts:0,updates:1,mountGeneration:1,latestDocumentCommitId:9,source:<checkout>/examples/expo-demo/App.tsx:74:9}]
window: {observationId:observation:2,startDocumentCommitId:7,settledDocumentCommitId:10,frozenDocumentCommitId:10,commits:3,settle:{outcome:met,quietMs:500,timeoutMs:10000,waitedMs:784,domains:{react:met,query:met,router:met,network:met}},tail:{ms:500,commits:0},environment:{bundle:development,strictMode:off,renderCollection:available,visibility:unavailable}}
! ui-outcome-not-observed: Genie does not check the screen; confirm it with the UI driver
! visibility-unobserved: the app reports no visibility signal, so a hidden interval was not observed
attempt 1 for these claims on this tab
evidence: $ npx genie-react verify show vfy_3827dc95-5067-4548-bb86-e1ba4674c779 --claim 1 --session d270f501-e559-487a-9c85-b457404b8072
session: {sessionId:d270f501-e559-487a-9c85-b457404b8072,logicalSessionId:f9a9d247-5676-410e-929d-96afe5a9b03f,documentGeneration:1}
schemaVersion: "1.0"
exitCode: 1
stage: end
ledger: {fingerprint:cf_ad631c360b87,scope:logical-session,storage:memory,attempt:1,history:[],codeChangedSincePrevious:null,failsOnSameCode:0}
evidence: {retained:true,tools:[react_get_renders,react_component_cohort,react_list_overrides,query_is_fetching,react_refresh_events,browser_visibility,request_watch_start,request_watch_stop,react_profile_stop]}
startedAt: 2026-11-19T09:02:44.275Z
endedAt: 2026-11-19T09:02:47.020Z
request: {budget:{fiberLimit:250,operationLimit:20000,timeLimitMs:8,targetOperationReserve:4000,targetTimeReserveMs:4,adaptive:true},settle:{quietMs:500,timeoutMs:10000},maxDurationMs:300000,allowOverrides:false}
[exit 1]

===== APPLIED FIX (temporary): moved count state, counter card and the three memo rows from App into a new CounterSection component in examples/expo-demo/App.tsx =====

$ npx genie-react status --wait 15000 | grep -E '^(connected|ready|sessionId|app):'
connected: true
ready: true
sessionId: d270f501-e559-487a-9c85-b457404b8072
app: {name:"Expo demo",reactVersion:19.2.3,reactMounted:true}
[exit 0]

$ agent-device snapshot -i --session upd-e
Page: Expo Go
App: host.exp.Exponent
Snapshot: 21 visible nodes
@e1 [application] "Expo Go"
@e2 [scroll-area] [scrollable]
  [content below scroll-area hidden]
@e3 [text] "Lifecycle visibility test"
@e4 [text] "Mode: visible"
@e5 [button] "Freeze"
@e6 [button] "Thaw"
@e7 [button] "Hide"
@e8 [button] "Unmount"
@e9 [text] "Preserved count: 0"
@e10 [button] "Increment probe"
@e11 [text] "Native screen: active"
@e12 [other] "active"
@e13 [other] "covered"
@e14 [other] "removed"
@e15 [other] "Screen count: 0"
@e16 [text] "GENIE REACT / EXPO"
@e17 [text] "Native integration demo"
@e18 [text] "This screen exercises the React Native entry point, Metro bundling, and live render inspection through the local Genie hub."
@e19 [text] "Hub URL"
@e20 [text] "ws://127.0.0.1:4495/__genie/ws"
@e21 [image] "Gear Shape, Filled"
[exit 0]

$ agent-device scroll down 300 --settle --session upd-e
Scrolled down by 300 of the viewport (676px)
settled after 1861ms: +8 -14 (~7 unchanged)
- @e3 [text] "Lifecycle visibility test"
- @e4 [text] "Mode: visible"
- @e5 [button] "Freeze"
- @e6 [button] "Thaw"
- @e7 [button] "Hide"
- @e8 [button] "Unmount"
- @e9 [text] "Preserved count: 0"
- @e10 [button] "Increment probe"
+ @e7~s349235 [text] "Counter"
+ @e8~s349235 [text] "0"
+ @e9~s349235 [button] "Increment"
+ @e10~s349235 [text] "Memo row: 0"
+ @e11~s349235 [text] "Named row: 0"
+ @e12~s349235 [text] "Explicit row: 0"
+ @e13~s349235 [text] "EXHAUSTIVE TOOL FIXTURES"
+ @e14~s349235 [text] "Deterministic targets for React, Query, Router, profiler, effect, and override tools."
… changed lines truncated
[exit 0]

$ agent-device snapshot -i --session upd-e
Page: Expo Go
App: host.exp.Exponent
Snapshot: 15 visible nodes
@e1 [application] "Expo Go"
@e2 [scroll-area] [scrollable]
  [content above scroll-area hidden]
  [content below scroll-area hidden]
@e3 [text] "Native integration demo"
@e4 [text] "This screen exercises the React Native entry point, Metro bundling, and live render inspection through the local Genie hub."
@e5 [text] "Hub URL"
@e6 [text] "ws://127.0.0.1:4495/__genie/ws"
@e7 [text] "Counter"
@e8 [text] "0"
@e9 [button] "Increment"
@e10 [text] "Memo row: 0"
@e11 [text] "Named row: 0"
@e12 [text] "Explicit row: 0"
@e13 [text] "EXHAUSTIVE TOOL FIXTURES"
@e14 [text] "Deterministic targets for React, Query, Router, profiler, effect, and override tools."
@e15 [image] "Gear Shape, Filled"
[exit 0]

$ npx genie-react verify begin --session d270f501-e559-487a-9c85-b457404b8072 --name 'press Increment' --claim 'render ToolTestbed max 0' --claim 'render VisibilityTestbed max 0' --claim 'render FreezeScreenTestbed max 0' --claim 'render MemoNameRow min 1'
recording vfy_a3b3a2bb-b9d5-4913-9be1-4c6b1bbac009 "press Increment"
  1 recording render ToolTestbed max 0
  2 recording render VisibilityTestbed max 0
  3 recording render FreezeScreenTestbed max 0
  4 recording render MemoNameRow min 1
window: {observationId:observation:3,startDocumentCommitId:12,domains:[react,query,router,network],quietMs:500,timeoutMs:10000,tailMs:500}
next: $ npx genie-react verify end vfy_a3b3a2bb-b9d5-4913-9be1-4c6b1bbac009 --session d270f501-e559-487a-9c85-b457404b8072
session: {sessionId:d270f501-e559-487a-9c85-b457404b8072,logicalSessionId:f9a9d247-5676-410e-929d-96afe5a9b03f,documentGeneration:1}
schemaVersion: "1.0"
targets: [{target:{component:ToolTestbed},status:resolved,instances:1,source:<checkout>/examples/expo-demo/App.tsx},{target:{component:VisibilityTestbed},status:resolved,instances:1,source:<checkout>/examples/expo-demo/App.tsx},{target:{component:FreezeScreenTestbed},status:resolved,instances:1,source:<checkout>/examples/expo-demo/App.tsx},{target:{component:MemoNameRow},status:resolved,instances:1,source:<checkout>/examples/expo-demo/App.tsx}]
startedAt: 2026-11-19T09:03:27.734Z
expiresAt: 2026-11-19T09:08:27.790Z
request: {budget:{fiberLimit:250,operationLimit:20000,timeLimitMs:8,targetOperationReserve:4000,targetTimeReserveMs:4,adaptive:true},settle:{quietMs:500,timeoutMs:10000},maxDurationMs:300000,allowOverrides:false}
[exit 0]

$ agent-device press 'id="increment-button"' --settle --session upd-e
Tapped id="increment-button" (109, 481)
settled after 433ms: +4 -4 (~11 unchanged)
- @e8 [text] "0"
+ @e8~s349239 [text] "1"
- @e10 [text] "Memo row: 0"
- @e11 [text] "Named row: 0"
- @e12 [text] "Explicit row: 0"
+ @e10~s349239 [text] "Memo row: 1"
+ @e11~s349239 [text] "Named row: 1"
+ @e12~s349239 [text] "Explicit row: 1"
[exit 0]

$ npx genie-react verify end vfy_a3b3a2bb-b9d5-4913-9be1-4c6b1bbac009 --session d270f501-e559-487a-9c85-b457404b8072
pass vfy_a3b3a2bb-b9d5-4913-9be1-4c6b1bbac009 "press Increment"  3 commits, quiet after 693 ms (react, query, router, network)
  1 pass render ToolTestbed max 0  {renders:0,mounts:0,updates:0,remounts:0,semantics:exact,instances:1,activeInstances:1}
      claim: {kind:renders,target:{component:ToolTestbed},max:0,counting:renders,allowRemount:false}
      deciding: [{kind:coverage,complete:true,targetedComplete:true,semantics:exact},{kind:instance,mountId:mount:172,renderingState:mounted-rendering,source:<checkout>/examples/expo-demo/App.tsx:35:9}]
  2 pass render VisibilityTestbed max 0  {renders:0,mounts:0,updates:0,remounts:0,semantics:exact,instances:1,activeInstances:1}
      claim: {kind:renders,target:{component:VisibilityTestbed},max:0,counting:renders,allowRemount:false}
      deciding: [{kind:coverage,complete:true,targetedComplete:true,semantics:exact},{kind:instance,mountId:mount:173,renderingState:mounted-rendering,source:<checkout>/examples/expo-demo/App.tsx:32:9}]
  3 pass render FreezeScreenTestbed max 0  {renders:0,mounts:0,updates:0,remounts:0,semantics:exact,instances:1,activeInstances:1}
      claim: {kind:renders,target:{component:FreezeScreenTestbed},max:0,counting:renders,allowRemount:false}
      deciding: [{kind:coverage,complete:true,targetedComplete:true,semantics:exact},{kind:instance,mountId:mount:174,renderingState:mounted-rendering,source:<checkout>/examples/expo-demo/App.tsx:33:9}]
  4 pass render MemoNameRow min 1  {renders:1,mounts:0,updates:1,remounts:0,semantics:exact,instances:1,activeInstances:1}
      claim: {kind:renders,target:{component:MemoNameRow},min:1,counting:renders,allowRemount:false}
      deciding: [{kind:instance,mountId:mount:175,renders:1,mounts:0,updates:1,mountGeneration:1,latestDocumentCommitId:14,source:<checkout>/examples/expo-demo/App.tsx:85:5}]
window: {observationId:observation:3,startDocumentCommitId:12,settledDocumentCommitId:15,frozenDocumentCommitId:15,commits:3,settle:{outcome:met,quietMs:500,timeoutMs:10000,waitedMs:693,domains:{react:met,query:met,router:met,network:met}},tail:{ms:500,commits:0},environment:{bundle:development,strictMode:off,renderCollection:available,visibility:unavailable}}
! ui-outcome-not-observed: Genie does not check the screen; confirm it with the UI driver
! visibility-unobserved: the app reports no visibility signal, so a hidden interval was not observed
attempt 2 for these claims on this tab; previous fail vfy_3827dc95-5067-4548-bb86-e1ba4674c779; code changed since (Fast Refresh)
evidence: $ npx genie-react verify show vfy_a3b3a2bb-b9d5-4913-9be1-4c6b1bbac009 --session d270f501-e559-487a-9c85-b457404b8072
session: {sessionId:d270f501-e559-487a-9c85-b457404b8072,logicalSessionId:f9a9d247-5676-410e-929d-96afe5a9b03f,documentGeneration:1}
schemaVersion: "1.0"
exitCode: 0
stage: end
ledger: {fingerprint:cf_ad631c360b87,scope:logical-session,storage:memory,attempt:2,history:[{verificationId:vfy_3827dc95-5067-4548-bb86-e1ba4674c779,verdict:fail,reasons:[],endedAt:2026-11-19T09:02:47.020Z}],codeChangedSincePrevious:fast-refresh,failsOnSameCode:0}
evidence: {retained:true,tools:[react_get_renders,react_component_cohort,react_list_overrides,query_is_fetching,react_refresh_events,browser_visibility,request_watch_start,request_watch_stop,react_profile_stop]}
startedAt: 2026-11-19T09:03:27.734Z
endedAt: 2026-11-19T09:03:30.245Z
request: {budget:{fiberLimit:250,operationLimit:20000,timeLimitMs:8,targetOperationReserve:4000,targetTimeReserveMs:4,adaptive:true},settle:{quietMs:500,timeoutMs:10000},maxDurationMs:300000,allowOverrides:false}
[exit 0]

$ npx genie-react call react_clear_renders '{}' --session d270f501-e559-487a-9c85-b457404b8072
ok: true
tracking: true
documentCommitId: 15
observation: {id:observation:4,epoch:4,startedAfterDocumentCommitId:15}
observationConfig:
  adaptive: true
  adaptiveScale: 1
  fiberLimit: 250
  operationLimit: 20000
  timeLimitMs: 64
  targetOperationReserve: 4000
  targetTimeReserveMs: 32
  lifecycleBufferLimit: 1000
  lifecycleTargetReserve: 100
strictMode: off
[exit 0]

$ agent-device press 'id="increment-button"' --settle --session upd-e
Tapped id="increment-button" (109, 481)
settled after 470ms: +4 -4 (~11 unchanged)
- @e8 [text] "1"
+ @e8~s349242 [text] "2"
- @e10 [text] "Memo row: 1"
- @e11 [text] "Named row: 1"
- @e12 [text] "Explicit row: 1"
+ @e10~s349242 [text] "Memo row: 2"
+ @e11~s349242 [text] "Named row: 2"
+ @e12~s349242 [text] "Explicit row: 2"
[exit 0]

$ npx genie-react call devtools_wait '{"condition":"settled","domains":["react","query","router"],"timeoutMs":10000}' --fail-on-result-error --session d270f501-e559-487a-9c85-b457404b8072
ok: true
condition: settled
waitedMs: 625
validConditions: [connected,ready,component,query-settled,navigation,react-quiet,settled]
lastObserved:
  react:
    documentCommitId: 18
    renderCollection: available
    quietForMs: 519
    requiredQuietMs: 500
    pendingWork: {documentCommitId:18,scheduledRoots:0,suspendedBoundaries:0,dehydratedBoundaries:0,boundaries:[],scanTruncated:false,scannedFibers:376}
  query: {fetching:0,mutating:0}
  router: {pathname:/,isLoading:false,settled:true,pendingWork:[],settlement:router-settled}
domains:
  react:
    status: met
    lastObserved: {documentCommitId:18,renderCollection:available,quietForMs:519,requiredQuietMs:500,pendingWork:{documentCommitId:18,scheduledRoots:0,suspendedBoundaries:0,dehydratedBoundaries:0,boundaries:[],scanTruncated:false,scannedFibers:376}}
  query: {status:met,lastObserved:{fetching:0,mutating:0}}
  router:
    status: met
    lastObserved: {pathname:/,isLoading:false,settled:true,pendingWork:[],settlement:router-settled}
[exit 0]

$ npx genie-react call react_get_renders '{"limit":80}' --session d270f501-e559-487a-9c85-b457404b8072 --fields name,renders,necessity,necessityReason
[4]:
  each: {renders:1,necessity:necessary,necessityReason:dom-changed}
  - {name:CounterSection}
  - {name:MemoNameRow}
  - {name:InnerNamedRow}
  - {name:CustomMemoRow}
[exit 0]

$ npx genie-react call react_get_renders '{"limit":80}' --session d270f501-e559-487a-9c85-b457404b8072 --select /coverage
status: ok
selection: {expression:/coverage,matchedPathCount:1,matchedPaths:[/coverage],omittedPathCount:120}
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

===== REVERTED FIX: git checkout -- examples/expo-demo/App.tsx; git status --short clean =====
```
