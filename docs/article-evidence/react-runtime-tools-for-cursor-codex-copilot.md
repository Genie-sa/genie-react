# Evidence: give Cursor, Codex, and Copilot a view inside your running React app

- Date: 2026-11-19 (UTC times appear in the log)
- Commit: `c46150076cdc8ecf927d31abbd78104804fd7ad7` (`git rev-parse HEAD`). App source unmodified except for the temporary `init` output and the temporary fix shown in the log, both reverted.
- App: `apps/realworld-dashboard` (Meridian Ops), React 19.3.1 in StrictMode, Vite 8 dev server, development bundle
- URLs: http://127.0.0.1:5217/orders
- Genie CLI and runtime: 1.0.2 (workspace build), session `art-l7`, driver agent-browser 0.39.1
- Seeded bug for the demo run: `evals/realworld/dashboard/order-selection-rerenders-sidebar.json`
- The commands ran from a terminal, the same shell commands an agent runs from the installed skill. No session inside Cursor, Codex or Copilot was recorded.
- Docs checked on 2026-11-19:
  - Cursor skills: https://cursor.com/docs/skills
  - Cursor rules and AGENTS.md: https://cursor.com/docs/rules
  - Codex skills: https://learn.chatgpt.com/docs/build-skills (redirect target of https://developers.openai.com/codex/skills)
  - Codex AGENTS.md: https://learn.chatgpt.com/docs/agent-configuration/agents-md
  - Copilot skills: https://docs.github.com/en/copilot/how-tos/copilot-on-github/customize-copilot/customize-cloud-agent/add-skills
  - Copilot CLI skills: https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/add-skills
  - VS Code agent skills: https://code.visualstudio.com/docs/agent-customization/agent-skills
  - Copilot instruction file support: https://docs.github.com/en/copilot/reference/custom-instructions-support

## Setup

```bash
pnpm install && pnpm build
pnpm install --offline   # the first install ran before the CLI was built, so the app had no node_modules/.bin/genie-react until this second install linked it
cd apps/realworld-dashboard
DASHBOARD_PORT=5217 pnpm exec vite --port 5217 --strictPort
```

Every command below ran from `apps/realworld-dashboard`. Each block is the command, its full output, and its exit code (`[exit N]`). Lines starting with `###` are notes added while recording, such as when a temporary fix was applied or reverted.

The `init` run used the same dev server, before the demo run. The `init --dry-run` and `init --yes` runs happened after the performance article's runs (see its evidence file) on the same server.

## Log

```text
$ node_modules/.bin/genie-react init --help | head -30
init: Wire Genie into a Vite, Next.js or other React app
options:
  -h, --help  Describe commands, arguments, options and output; JSON with --json
  --version  Print the CLI package version; a JSON object with --json
  --json  Print JSON instead of compact text; batch collects results into one JSON array (not with --ndjson)
  --max-bytes <value>  Bound stdout bytes including newlines; an oversized call or tools result is written, in the output format, to a private per-user temp directory and replaced by a truncation envelope with its path and retry suggestions (default 102400; 512..50000000)
  --dry-run  Report planned init changes without writing files (default false)
  -y, --yes  Accept safe init defaults (default false)
output:
  default: text
  json: json
  diagnostics: "text lines on stderr; jsonl with --json"
  defaultMaxBytes: 102400
  limitScope: "whole result"
  exits: {0:success,1:failure}
notes:
  Returns planned, applied, already-present and manual artifact outcomes without source contents. No interactive prompts.
examples:
  $ pnpm exec genie-react init --dry-run
[exit 0]

$ node_modules/.bin/genie-react init --dry-run
ok setup_planned: Setup changes are recorded in artifacts.
next: $ pnpm exec genie-react doctor
userActionRequired: false
data:
  framework: tanstack-router
  dryRun: true
  artifacts[7]:
    - {kind:vite_config,status:already,path:~/.t3/worktrees/genie-react/t3-caf9c4aa-a3af8eaa9c0a73ea/apps/realworld-dashboard/vite.config.ts}
    - {kind:root_route,status:already,path:~/.t3/worktrees/genie-react/t3-caf9c4aa-a3af8eaa9c0a73ea/apps/realworld-dashboard/src/routes/__root.tsx}
    - {kind:gitignore,path:~/.t3/worktrees/genie-react/t3-caf9c4aa-a3af8eaa9c0a73ea/apps/realworld-dashboard/.gitignore,status:planned}
    - {kind:agent_skill,path:~/.t3/worktrees/genie-react/t3-caf9c4aa-a3af8eaa9c0a73ea/apps/realworld-dashboard/.agents/skills/genie/SKILL.md,status:planned}
    - {kind:agent_skill,path:~/.t3/worktrees/genie-react/t3-caf9c4aa-a3af8eaa9c0a73ea/apps/realworld-dashboard/.agents/skills/genie/APP_TOOLS.md,status:planned}
    - {kind:agent_skill,path:~/.t3/worktrees/genie-react/t3-caf9c4aa-a3af8eaa9c0a73ea/apps/realworld-dashboard/.agents/skills/genie/EVIDENCE.md,status:planned}
    - {kind:agent_skill,path:~/.t3/worktrees/genie-react/t3-caf9c4aa-a3af8eaa9c0a73ea/apps/realworld-dashboard/.claude/skills/genie,status:planned,link:symlink}
  manualSteps: []
  optionalSteps: []
  commands:
    install: {command:"pnpm add -D genie-react @genie-react/cli",argv:[pnpm,add,"-D",genie-react,@genie-react/cli],condition:"if packages are missing"}
    dev: $ pnpm dev
[exit 0]

$ node_modules/.bin/genie-react init --yes
ok setup_completed: Setup changes are recorded in artifacts.
next: $ pnpm exec genie-react doctor
userActionRequired: false
data:
  framework: tanstack-router
  dryRun: false
  artifacts[7]:
    - {kind:vite_config,status:already,path:~/.t3/worktrees/genie-react/t3-caf9c4aa-a3af8eaa9c0a73ea/apps/realworld-dashboard/vite.config.ts}
    - {kind:root_route,status:already,path:~/.t3/worktrees/genie-react/t3-caf9c4aa-a3af8eaa9c0a73ea/apps/realworld-dashboard/src/routes/__root.tsx}
    - {kind:gitignore,path:~/.t3/worktrees/genie-react/t3-caf9c4aa-a3af8eaa9c0a73ea/apps/realworld-dashboard/.gitignore,status:applied}
    - {kind:agent_skill,path:~/.t3/worktrees/genie-react/t3-caf9c4aa-a3af8eaa9c0a73ea/apps/realworld-dashboard/.agents/skills/genie/SKILL.md,status:applied}
    - {kind:agent_skill,path:~/.t3/worktrees/genie-react/t3-caf9c4aa-a3af8eaa9c0a73ea/apps/realworld-dashboard/.agents/skills/genie/APP_TOOLS.md,status:applied}
    - {kind:agent_skill,path:~/.t3/worktrees/genie-react/t3-caf9c4aa-a3af8eaa9c0a73ea/apps/realworld-dashboard/.agents/skills/genie/EVIDENCE.md,status:applied}
    - {kind:agent_skill,path:~/.t3/worktrees/genie-react/t3-caf9c4aa-a3af8eaa9c0a73ea/apps/realworld-dashboard/.claude/skills/genie,status:applied,link:symlink}
  manualSteps: []
  optionalSteps: []
  commands:
    install: {command:"pnpm add -D genie-react @genie-react/cli",argv:[pnpm,add,"-D",genie-react,@genie-react/cli],condition:"if packages are missing"}
    dev: $ pnpm dev
[exit 0]

$ find .agents .claude -maxdepth 3 -exec ls -ld {} + | awk '{print $1, $9, $10, $11}'
drwxr-xr-x@ .agents  
drwxr-xr-x@ .agents/skills  
drwxr-xr-x@ .agents/skills/genie  
-rw-r--r--@ .agents/skills/genie/APP_TOOLS.md  
-rw-r--r--@ .agents/skills/genie/EVIDENCE.md  
-rw-r--r--@ .agents/skills/genie/SKILL.md  
drwxr-xr-x@ .claude  
drwxr-xr-x@ .claude/skills  
lrwxr-xr-x@ .claude/skills/genie -> ../../.agents/skills/genie
[exit 0]

$ git diff .gitignore
diff --git a/apps/realworld-dashboard/.gitignore b/apps/realworld-dashboard/.gitignore
index 758f9ac..a9fd499 100644
--- a/apps/realworld-dashboard/.gitignore
+++ b/apps/realworld-dashboard/.gitignore
@@ -1,2 +1,3 @@
 .vite
 .variants
+.genie/
[exit 0]

$ grep -n 'genie-react' .agents/skills/genie/SKILL.md | head -5
6:  package: "@genie-react/cli"
17:node_modules/.bin/genie-react status --session my-agent --wait 15000
20:Pass the same `--session` to every Genie command. Connected means `ready: true` on the intended URL; otherwise run `node_modules/.bin/genie-react doctor --live` and follow it. In another browser, add `?_genie=my-agent` to the URL. On native, open the app with agent-device and use the `sessionId` from `status`.
27:node_modules/.bin/genie-react call react_clear_renders '{"component":"CheckoutRow"}' --session my-agent
29:node_modules/.bin/genie-react call react_quiesce '{"idleMs":500,"timeoutMs":10000}' --fail-on-result-error --session my-agent
[exit 0]

$ sed -n 1,8p .agents/skills/genie/SKILL.md
---
name: genie
description: Verify React fixes and see inside a running React or React Native app, alongside agent-browser or agent-device. Use to prove a fix worked, find why a component re-rendered, debug a looping effect, inspect Query, Router, Suspense, hydration or error-boundary state, compare performance before and after a change, or call the app's own app_* tools.
metadata:
  version: "1.0.2"
  package: "@genie-react/cli"
---
[exit 0]

$ node_modules/.bin/genie-react doctor
ok checks_passed: Setup checks passed.
checks[5] (ok|FAIL critical|optional label — detail):
  ok critical "Vite config references genie-react/vite" — vite.config.ts
  ok critical "genie-react resolvable in node_modules"
  ok critical "agent skill matches the bundled CLI guidance" — ".agents/skills/genie · sha256 8be4d791caab"
  ok critical "Claude Code skill matches the bundled CLI guidance" — ".claude/skills/genie (symlink) · sha256 8be4d791caab"
  ok critical "CLI and runtime package versions agree" — "cli 1.0.2 · runtime 1.0.2"
ok: true
framework: tanstack-router
bridge:
  url: ws://127.0.0.1:5217/__genie/ws
  pid: 17205
  tokenFile: /var/folders/2z/yc5fydsd2650snr5nkhw7cmc0000gn/T/genie-react-501/6cba9e794800a8ac9c08264be04f2f4427b7c46293e8664c0ac468e4169df4a8.json
versions: {cli:1.0.2,runtime:1.0.2,bundledSkill:1.0.2,activeSkill:1.0.2}
skill:
  path: .agents/skills/genie
  bundledHash: 8be4d791caab3cd1f598df472927022c9ec1bcc183e580ecac1a6f1d474da628
  activeHash: 8be4d791caab3cd1f598df472927022c9ec1bcc183e580ecac1a6f1d474da628
  current: true
  locations[2]:
    - {path:.agents/skills/genie,symlink:false,conflictPath:null,version:1.0.2,hash:8be4d791caab3cd1f598df472927022c9ec1bcc183e580ecac1a6f1d474da628,current:true}
    - {path:.claude/skills/genie,symlink:true,conflictPath:null,version:1.0.2,hash:8be4d791caab3cd1f598df472927022c9ec1bcc183e580ecac1a6f1d474da628,current:true}
bridgeCandidates[1]:
  - {url:ws://127.0.0.1:5217/__genie/ws,pid:17205,tokenFile:/var/folders/2z/yc5fydsd2650snr5nkhw7cmc0000gn/T/genie-react-501/6cba9e794800a8ac9c08264be04f2f4427b7c46293e8664c0ac468e4169df4a8.json}
remediation: []
userActionRequired: false
[exit 0]

### init changes reverted (rm -rf .agents .claude; git checkout -- .gitignore)
### Demo run: order selection re-renders sidebar
$ agent-browser --session art-l7 open http://127.0.0.1:5217/orders
✓ Meridian Ops
  http://127.0.0.1:5217/orders?sort=placedAt&dir=desc
[exit 0]

$ node_modules/.bin/genie-react status --session art-l7 --wait 15000
selectedBridgeUrl: ws://127.0.0.1:5217/__genie/ws
sessionSelector:
  requested: art-l7
  source: flag
  resolvedSessionId: 90a015cc-14b3-4f28-91f9-bd6c335f4b13
  implicit: false
  agentBrowser: {session:art-l7,via:selector,logicalSessionId:f302b7a7-ad8a-4a18-be94-bcefe0ff9a9b}
connected: true
ready: true
sessionId: 90a015cc-14b3-4f28-91f9-bd6c335f4b13
app: {name:"Meridian Ops",url:http://127.0.0.1:5217/orders,reactVersion:19.3.1,reactMounted:true}
domains: [session,react]
toolCount: 48
sessions[1] (sessionId {fields}):
  90a015cc-14b3-4f28-91f9-bd6c335f4b13 {logicalSessionId:f302b7a7-ad8a-4a18-be94-bcefe0ff9a9b,documentGeneration:8,predecessorSessionId:10596e1c-6045-4401-828b-b1a3143471ed,logicalSessionCollision:false,collisionWithSessionIds:[],app:{name:"Meridian Ops",url:http://127.0.0.1:5217/orders,reactVersion:19.3.1,reactMounted:true},domains:[session,react],toolCount:48,connectedAt:1795061982210,ready:true,readyAt:1795061982210,current:true,origin:http://127.0.0.1:5217,runtimeVersion:1.0.2}
warnings: []
hub: {version:1.0.2,protocol:1}
[exit 0]

$ agent-browser --session art-l7 wait '[role=row][data-order-id]'
✓ Done
[exit 0]

$ agent-browser --session art-l7 snapshot -i -s '[role=row][data-order-id]:nth-of-type(2)'
- gridcell "Select SO-105999" [ref=e142]
  - checkbox "Select SO-105999" [checked=false, ref=e254]
- gridcell "SO-105999" [ref=e143]
  - link "SO-105999" [ref=e255]
- gridcell "Delta Health 5" [ref=e144]
- gridcell "Processing" [ref=e145]
- gridcell "standard" [ref=e146]
- gridcell "EMEA" [ref=e147]
- gridcell "40" [ref=e148]
- gridcell "Mar 2, 2026" [ref=e149]
- gridcell "$8,624.19" [ref=e150]
- gridcell "Actions for SO-105999" [ref=e151]
  - button "Actions for SO-105999" [expanded=false, ref=e277]
[exit 0]

$ node_modules/.bin/genie-react call react_clear_renders '{"component":"SidebarNav"}' --session art-l7 --fields ok
[1]:
  - {ok:true}
[exit 0]

$ agent-browser --session art-l7 check 'input[aria-label="Select SO-105999"]'
✓ Done
[exit 0]

$ node_modules/.bin/genie-react call react_quiesce '{"idleMs":500,"timeoutMs":10000}' --fail-on-result-error --session art-l7 --fields outcome
[1]:
  - {outcome:idle}
[exit 0]

$ node_modules/.bin/genie-react call react_render_causes '{"component":"SidebarNav","limit":5}' --session art-l7
componentMatch:
  component: SidebarNav
  exact: true
  status: matched
  matchedNames: [SidebarNav]
  matchedNameCount: 1
  similarNames: []
tracking: true
commits: 3
documentCommitId: 14
observation: {id:observation:1,epoch:1,startedAfterDocumentCommitId:11}
attribution:
  status: current
  startedAtDocumentCommitId: 14
  completedAtDocumentCommitId: 14
  startedAtAnalysisGeneration: 15
  completedAtAnalysisGeneration: 15
view: summary
events[1] (componentName #componentId {fields}, then ← kind evidence name {fields} per cause):
  SidebarNav #14725211488298 {renderEventId:render:12:1,documentCommitId:12,mountId:mount:1,necessity:unnecessary,necessityReason:output-unchanged,inputEvidence:none-observed,source:{location:/src/layout/app-shell.tsx:38:9,role:element-callsite,ownership:app}}
    ← external-store inferred anonymous-external-store
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
renderEventRetention: {evictedEvents:0,earliestDocumentCommitId:12,latestDocumentCommitId:14}
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

$ node_modules/.bin/genie-react call react_render_causes '{"component":"SidebarNav","view":"full"}' --session art-l7 --fields events
[1]:
  - {events:[{renderEventId:render:12:1,observationId:observation:1,commitId:1,documentCommitId:12,componentId:14725211488298,componentName:SidebarNav,instance:{fiberId:14725211488298,mountId:mount:1,key:null,siblingIndex:0,parent:{fiberId:14725211488295,name:PreferencesProvider,key:null},keyedParent:null,logicalPath:"QueryClientProvider[index=0] > AuthProvider[index=0] > App[index=0] > RouterProvider[index=0] > RouterContextProvider[index=0] > Matches[index=0] > MatchesInner[index=0] > CatchBoundary[index=0] > MatchImpl[index=0] > MatchView[index=0] > CatchBoundary[index=0] > CatchNotFound[index=0] > CatchBoundary[index=0] > MatchInnerImpl[index=0] > RootLayout[index=0] > OutletImpl[index=0] > MatchImpl[index=0] > MatchView[index=0] > CatchBoundary[index=0] > MatchInnerImpl[index=0] > Lazy[index=0] > AuthenticatedLayout[index=0] > PermissionsProvider[index=0] > AppShell[index=0] > PreferencesProvider[index=0] > <div>[index=0] > SidebarNav[index=0]",logicalIdentityEvidence:positional,mountGeneration:1,mountGenerationEvidence:exact,hostSelector:null},causes:[{kind:external-store,evidence:inferred,reason:external-store-snapshot-changed,hookIndex:1,externalStoreIndex:0,subscriberId:subscriber:mount:1:0,selectionEqual:false,subscriptionFired:true,before:{density:comfortable,hiddenColumns:[],recentlyViewed:[],selectedOrderIds:{__genie_dehydrated__:true,kind:object,preview:"[object fields not inspected]",path:[selectedOrderIds]},setDensity:{__genie_dehydrated__:true,kind:function,preview:"ƒ setDensity()",path:[setDensity]},toggleColumn:{__genie_dehydrated__:true,kind:function,preview:"ƒ toggleColumn()",path:[toggleColumn]},pushRecent:{__genie_dehydrated__:true,kind:function,preview:"ƒ pushRecent()",path:[pushRecent]},toggleOrderSelection:{__genie_dehydrated__:true,kind:function,preview:"ƒ toggleOrderSelection()",path:[toggleOrderSelection]},setOrderSelection:{__genie_dehydrated__:true,kind:function,preview:"ƒ setOrderSelection()",path:[setOrderSelection]},clearOrderSelection:{__genie_dehydrated__:true,kind:function,preview:"ƒ clearOrderSelection()",path:[clearOrderSelection]}},after:{density:comfortable,hiddenColumns:[],recentlyViewed:[],selectedOrderIds:{__genie_dehydrated__:true,kind:object,preview:"[object fields not inspected]",path:[selectedOrderIds]},setDensity:{__genie_dehydrated__:true,kind:function,preview:"ƒ setDensity()",path:[setDensity]},toggleColumn:{__genie_dehydrated__:true,kind:function,preview:"ƒ toggleColumn()",path:[toggleColumn]},pushRecent:{__genie_dehydrated__:true,kind:function,preview:"ƒ pushRecent()",path:[pushRecent]},toggleOrderSelection:{__genie_dehydrated__:true,kind:function,preview:"ƒ toggleOrderSelection()",path:[toggleOrderSelection]},setOrderSelection:{__genie_dehydrated__:true,kind:function,preview:"ƒ setOrderSelection()",path:[setOrderSelection]},clearOrderSelection:{__genie_dehydrated__:true,kind:function,preview:"ƒ clearOrderSelection()",path:[clearOrderSelection]}},changedFields:[selectedOrderIds],deepDiff:{changes:[{kind:identity-changed-uninspected,path:/selectedOrderIds}],visited:11,truncated:true},storeId:external-store:1,storeLabel:anonymous-external-store,selector:null,equality:object-is,fanout:null,notificationId:null,competingCandidates:[external-store-snapshot-identity-changed],hookProvenance:{status:unavailable,evidence:unknown,reason:shadow-render-disabled}}],necessity:unnecessary,necessityReason:output-unchanged,assessment:{inputEvidence:none-observed,observedInputKinds:[],behaviorEvidence:{subtreeHostMutations:{status:none-observed,count:0,pendingSubtrees:0,omittedByLimit:0,callbackOnlyUpdates:0,writes:[],callbacks:[]},scheduledEffects:{status:observed,count:1},subtreeScheduledEffects:{status:none-observed,count:0},unobservedDomains:[focus,url,network,transition,freshness,effect-execution]},optimizationSafety:not-proven-safe,requiredValidation:[dom,aria,focus,url,network,transition]},inputCoverage:{complete:true,omittedInputs:0,scanTruncated:false,propsNotEnumerated:false},source:{file:/src/layout/app-shell.tsx,line:38,column:9,functionName:AppShell,sourceMapConfidence:mapped,role:element-callsite},sourceAttribution:{role:usage-or-definition-fallback,evidence:inferred},sourceOwnership:app,isLibrary:false}]}
[exit 0]

$ node_modules/.bin/genie-react call react_get_renders '{"limit":12}' --session art-l7 --fields components
[1]:
  - {components:[{id:14725211488516,name:SyncStatus,mountId:mount:68,renders:10,updates:10,selfTime:0.2,totalTime:0.3,cumulativeSelfTime:1.3,cumulativeTotalTime:2.5,latestDocumentCommitId:23,causeCounts:{state:10},causes:[{kind:state,evidence:exact,name:"state[0]"}],necessity:necessary,necessityReason:dom-changed,inputEvidence:changed,source:{location:/src/features/orders/orders-page.tsx:50:11,role:element-callsite,ownership:app}},{id:14725211488415,name:OrdersTable,mountId:mount:33,renders:2,updates:2,selfTime:0.6,totalTime:1.2,cumulativeSelfTime:1.1,cumulativeTotalTime:2,latestDocumentCommitId:13,causeCounts:{state:1,external-store:1},causes:[{kind:state,evidence:exact,name:"reducer[1]"}],necessity:necessary,necessityReason:dom-changed,inputEvidence:changed,source:{location:/src/features/orders/orders-page.tsx:88:9,role:element-callsite,ownership:app}},{id:14725211488419,name:Checkbox,mountId:mount:34,renders:2,updates:2,selfTime:0,totalTime:0,latestDocumentCommitId:13,causeCounts:{props:2,parent:2},causes:[{kind:parent,evidence:inferred,name:OrdersTable},{kind:props,evidence:exact,name:onChange}],necessity:unknown,necessityReason:callbacks-changed,inputEvidence:changed,source:{location:/src/features/orders/orders-table.tsx:72:11,role:element-callsite,ownership:app}},{id:14725211488298,name:SidebarNav,mountId:mount:1,renders:1,updates:1,selfTime:0.3,totalTime:1.5,latestDocumentCommitId:12,causeCounts:{external-store:1},causes:[{kind:external-store,evidence:inferred,name:anonymous-external-store}],necessity:unnecessary,necessityReason:output-unchanged,inputEvidence:none-observed,source:{location:/src/layout/app-shell.tsx:38:9,role:element-callsite,ownership:app}},{id:14725211488305,name:sidebar-nav.tsx,mountId:mount:2,key:/,renders:1,updates:1,selfTime:0.1,totalTime:0.4,latestDocumentCommitId:12,causeCounts:{props:1,children:1},causes:[{kind:props,evidence:exact,name:activeOptions,referenceOnly:true},{kind:children,evidence:exact}],necessity:unnecessary,necessityReason:output-unchanged,inputEvidence:changed,wrappers:[Anonymous,Anonymous],wraps:{componentId:14725211488306,componentName:Anonymous,renderEventId:render:12:3,causes:[{kind:parent,evidence:inferred,name:Anonymous,origin:SidebarNav},{kind:props,evidence:exact,name:activeOptions,referenceOnly:true},{kind:children,evidence:exact}],necessity:unnecessary,necessityReason:inputs-unchanged},source:{location:/src/layout/sidebar-nav.tsx,role:element-callsite,ownership:unknown}},{id:14725211488316,name:sidebar-nav.tsx,mountId:mount:6,key:/orders,renders:1,updates:1,selfTime:0,totalTime:0.1,latestDocumentCommitId:12,causeCounts:{props:1,children:1},causes:[{kind:props,evidence:exact,name:activeOptions,referenceOnly:true},{kind:children,evidence:exact}],necessity:unnecessary,necessityReason:output-unchanged,inputEvidence:changed,wrappers:[Anonymous,Anonymous],wraps:{componentId:14725211488317,componentName:Anonymous,renderEventId:render:12:7,causes:[{kind:parent,evidence:inferred,name:Anonymous,origin:SidebarNav},{kind:props,evidence:exact,name:activeOptions,referenceOnly:true},{kind:children,evidence:exact}],necessity:unnecessary,necessityReason:inputs-unchanged},source:{location:/src/layout/sidebar-nav.tsx,role:element-callsite,ownership:unknown}},{id:14725211488327,name:sidebar-nav.tsx,mountId:mount:10,key:/customers,renders:1,updates:1,selfTime:0,totalTime:0.2,latestDocumentCommitId:12,causeCounts:{props:1,children:1},causes:[{kind:props,evidence:exact,name:activeOptions,referenceOnly:true},{kind:children,evidence:exact}],necessity:unnecessary,necessityReason:output-unchanged,inputEvidence:changed,wrappers:[Anonymous,Anonymous],wraps:{componentId:14725211488328,componentName:Anonymous,renderEventId:render:12:11,causes:[{kind:parent,evidence:inferred,name:Anonymous,origin:SidebarNav},{kind:props,evidence:exact,name:activeOptions,referenceOnly:true},{kind:children,evidence:exact}],necessity:unnecessary,necessityReason:inputs-unchanged},source:{location:/src/layout/sidebar-nav.tsx,role:element-callsite,ownership:unknown}},{id:14725211488338,name:sidebar-nav.tsx,mountId:mount:14,key:/inventory,renders:1,updates:1,selfTime:0,totalTime:0.2,latestDocumentCommitId:12,causeCounts:{props:1,children:1},causes:[{kind:props,evidence:exact,name:activeOptions,referenceOnly:true},{kind:children,evidence:exact}],necessity:unnecessary,necessityReason:output-unchanged,inputEvidence:changed,wrappers:[Anonymous,Anonymous],wraps:{componentId:14725211488339,componentName:Anonymous,renderEventId:render:12:15,causes:[{kind:parent,evidence:inferred,name:Anonymous,origin:SidebarNav},{kind:props,evidence:exact,name:activeOptions,referenceOnly:true},{kind:children,evidence:exact}],necessity:unnecessary,necessityReason:inputs-unchanged},source:{location:/src/layout/sidebar-nav.tsx,role:element-callsite,ownership:unknown}},{id:14725211488357,name:sidebar-nav.tsx,mountId:mount:18,key:/reports,renders:1,updates:1,selfTime:0,totalTime:0.1,latestDocumentCommitId:12,causeCounts:{props:1,children:1},causes:[{kind:props,evidence:exact,name:activeOptions,referenceOnly:true},{kind:children,evidence:exact}],necessity:unnecessary,necessityReason:output-unchanged,inputEvidence:changed,wrappers:[Anonymous,Anonymous],wraps:{componentId:14725211488358,componentName:Anonymous,renderEventId:render:12:19,causes:[{kind:parent,evidence:inferred,name:Anonymous,origin:SidebarNav},{kind:props,evidence:exact,name:activeOptions,referenceOnly:true},{kind:children,evidence:exact}],necessity:unnecessary,necessityReason:inputs-unchanged},source:{location:/src/layout/sidebar-nav.tsx,role:element-callsite,ownership:unknown}},{id:14725211488368,name:sidebar-nav.tsx,mountId:mount:22,key:/settings,renders:1,updates:1,selfTime:0,totalTime:0.2,latestDocumentCommitId:12,causeCounts:{props:1,children:1},causes:[{kind:props,evidence:exact,name:activeOptions,referenceOnly:true},{kind:children,evidence:exact}],necessity:unnecessary,necessityReason:output-unchanged,inputEvidence:changed,wrappers:[Anonymous,Anonymous],wraps:{componentId:14725211488369,componentName:Anonymous,renderEventId:render:12:23,causes:[{kind:parent,evidence:inferred,name:Anonymous,origin:SidebarNav},{kind:props,evidence:exact,name:activeOptions,referenceOnly:true},{kind:children,evidence:exact}],necessity:unnecessary,necessityReason:inputs-unchanged},source:{location:/src/layout/sidebar-nav.tsx,role:element-callsite,ownership:unknown}},{id:14725211488398,name:BulkActionBar,mountId:mount:28,renders:1,updates:1,selfTime:0.1,totalTime:0.3,latestDocumentCommitId:12,causeCounts:{external-store:1},causes:[{kind:external-store,evidence:inferred,name:anonymous-external-store}],necessity:necessary,necessityReason:dom-changed,inputEvidence:none-observed,source:{location:/src/features/orders/orders-page.tsx:77:9,role:element-callsite,ownership:app}},{id:14725211488403,name:Button,mountId:mount:29,renders:1,updates:0,mounts:1,selfTime:0.1,totalTime:0.1,latestDocumentCommitId:12,causeCounts:{mount:1},causes:[{kind:mount,evidence:exact}],necessity:necessary,necessityReason:mount,inputEvidence:mount,source:{location:/src/features/orders/bulk-action-bar.tsx:21:7,role:element-callsite,ownership:app}}]}
[exit 0]

$ agent-browser --session art-l7 uncheck 'input[aria-label="Select SO-105999"]'
✓ Done
[exit 0]

$ node_modules/.bin/genie-react verify begin --session art-l7 --name 'select one order' --claim 'render SidebarNav max 0' --claim 'render BulkActionBar min 1' --claim 'boundaries clean'
recording vfy_bd8e1d6a-5e03-477a-a0ca-fbfe2e995949 "select one order"
  url "http://127.0.0.1:5217/orders?sort=placedAt&dir=desc"
  1 null render SidebarNav max 0  {}
  2 null render BulkActionBar min 1  {}
  3 null boundaries clean  {}
window: {observationId:observation:2,startDocumentCommitId:29,domains:[react,query,router],quietMs:500,timeoutMs:10000,tailMs:500}
next: $ pnpm exec genie-react verify end vfy_bd8e1d6a-5e03-477a-a0ca-fbfe2e995949 --session art-l7
session: {sessionId:90a015cc-14b3-4f28-91f9-bd6c335f4b13,logicalSessionId:f302b7a7-ad8a-4a18-be94-bcefe0ff9a9b,documentGeneration:8}
schemaVersion: "1.0"
targets: [{target:{component:SidebarNav},status:resolved,instances:1,source:/src/layout/app-shell.tsx},{target:{component:BulkActionBar},status:resolved,instances:1,source:/src/features/orders/orders-page.tsx}]
startedAt: 2026-11-19T04:20:00.795Z
expiresAt: 2026-11-19T04:25:00.804Z
request: {budget:{fiberLimit:250,operationLimit:20000,timeLimitMs:8,targetOperationReserve:4000,targetTimeReserveMs:4,adaptive:true},settle:{quietMs:500,timeoutMs:10000},maxDurationMs:300000,allowOverrides:false}
[exit 0]

$ agent-browser --session art-l7 check 'input[aria-label="Select SO-105999"]'
✓ Done
[exit 0]

$ node_modules/.bin/genie-react verify end vfy_bd8e1d6a-5e03-477a-a0ca-fbfe2e995949 --session art-l7
fail vfy_bd8e1d6a-5e03-477a-a0ca-fbfe2e995949 "select one order"  7 commits, quiet after 1362 ms (react, query, router)
  url "http://127.0.0.1:5217/orders?sort=placedAt&dir=desc"
  1 fail render SidebarNav max 0  {renders:1,mounts:0,updates:1,remounts:0,semantics:exact,instances:1,activeInstances:1}
      claim: {kind:renders,target:{component:SidebarNav},max:0,counting:renders,allowRemount:false}
      deciding: [{kind:instance,mountId:mount:1,renders:1,mounts:0,updates:1,mountGeneration:1,latestDocumentCommitId:33,source:/src/layout/app-shell.tsx:38:9}]
  2 pass render BulkActionBar min 1  {renders:1,mounts:0,updates:1,remounts:0,semantics:exact,instances:1,activeInstances:1}
      claim: {kind:renders,target:{component:BulkActionBar},min:1,counting:renders,allowRemount:false}
      deciding: [{kind:instance,mountId:mount:28,renders:1,mounts:0,updates:1,mountGeneration:1,latestDocumentCommitId:33,source:/src/features/orders/orders-page.tsx:77:9}]
  3 pass boundaries clean  {caughtDuringWindow:0,caughtAtEnd:0}
      claim: {kind:boundaries-clean,scope:window}
      deciding: [{kind:boundary-log,scope:window,complete:true,afterDocumentCommitId:29}]
      caveats: [uncaught-errors-outside-boundaries-unobserved]
window: {observationId:observation:2,startDocumentCommitId:29,settledDocumentCommitId:35,frozenDocumentCommitId:36,commits:7,settle:{outcome:met,quietMs:500,timeoutMs:10000,waitedMs:1362,domains:{react:met,query:met,router:met}},tail:{ms:500,commits:1},environment:{bundle:development,strictMode:on,renderCollection:available,visibility:document}}
! ui-outcome-not-observed: Genie does not check the screen; confirm it with the UI driver
attempt 1 for these claims on this tab
evidence: $ pnpm exec genie-react verify show vfy_bd8e1d6a-5e03-477a-a0ca-fbfe2e995949 --claim 1 --session art-l7
session: {sessionId:90a015cc-14b3-4f28-91f9-bd6c335f4b13,logicalSessionId:f302b7a7-ad8a-4a18-be94-bcefe0ff9a9b,documentGeneration:8}
schemaVersion: "1.0"
exitCode: 1
stage: end
ledger: {fingerprint:cf_2380e6bf6da4,scope:logical-session,storage:memory,attempt:1,history:[],codeChangedSincePrevious:null,failsOnSameCode:0}
evidence: {retained:true,tools:[react_get_renders,react_component_cohort,react_list_overrides,query_is_fetching,react_refresh_events,browser_visibility,react_profile_stop,react_error_state]}
startedAt: 2026-11-19T04:20:00.795Z
endedAt: 2026-11-19T04:20:05.723Z
request: {budget:{fiberLimit:250,operationLimit:20000,timeLimitMs:8,targetOperationReserve:4000,targetTimeReserveMs:4,adaptive:true},settle:{quietMs:500,timeoutMs:10000},maxDurationMs:300000,allowOverrides:false}
[exit 1]

### FIX APPLIED
diff --git a/apps/realworld-dashboard/src/layout/sidebar-nav.tsx b/apps/realworld-dashboard/src/layout/sidebar-nav.tsx
index fd9e6d8..82c92e7 100644
--- a/apps/realworld-dashboard/src/layout/sidebar-nav.tsx
+++ b/apps/realworld-dashboard/src/layout/sidebar-nav.tsx
@@ -29,7 +29,7 @@ const NAV_ITEMS: readonly NavItem[] = [
 ]
 
 export function SidebarNav({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
-  const { recentlyViewed } = useWorkspaceStore()
+  const recentlyViewed = useWorkspaceStore((state) => state.recentlyViewed)
   return (
     <aside
       aria-label="Primary"
$ agent-browser --session art-l7 uncheck 'input[aria-label="Select SO-105999"]'
✓ Done
[exit 0]

$ node_modules/.bin/genie-react verify begin --session art-l7 --name 'select one order' --claim 'render SidebarNav max 0' --claim 'render BulkActionBar min 1' --claim 'boundaries clean'
recording vfy_fa81c07f-2672-4f7b-b8e5-4c1f62f8fb29 "select one order"
  url "http://127.0.0.1:5217/orders?sort=placedAt&dir=desc"
  1 null render SidebarNav max 0  {}
  2 null render BulkActionBar min 1  {}
  3 null boundaries clean  {}
window: {observationId:observation:1,startDocumentCommitId:9,domains:[react,query,router],quietMs:500,timeoutMs:10000,tailMs:500}
next: $ pnpm exec genie-react verify end vfy_fa81c07f-2672-4f7b-b8e5-4c1f62f8fb29 --session art-l7
session: {sessionId:a43768bf-2c64-46a8-8189-01f5b606ec3b,logicalSessionId:f302b7a7-ad8a-4a18-be94-bcefe0ff9a9b,documentGeneration:9}
schemaVersion: "1.0"
targets: [{target:{component:SidebarNav},status:resolved,instances:1,source:/src/layout/app-shell.tsx},{target:{component:BulkActionBar},status:resolved,instances:1,source:/src/features/orders/orders-page.tsx}]
startedAt: 2026-11-19T04:20:14.722Z
expiresAt: 2026-11-19T04:25:14.733Z
request: {budget:{fiberLimit:250,operationLimit:20000,timeLimitMs:8,targetOperationReserve:4000,targetTimeReserveMs:4,adaptive:true},settle:{quietMs:500,timeoutMs:10000},maxDurationMs:300000,allowOverrides:false}
[exit 0]

$ agent-browser --session art-l7 check 'input[aria-label="Select SO-105999"]'
✓ Done
[exit 0]

$ node_modules/.bin/genie-react verify end vfy_fa81c07f-2672-4f7b-b8e5-4c1f62f8fb29 --session art-l7
pass vfy_fa81c07f-2672-4f7b-b8e5-4c1f62f8fb29 "select one order"  7 commits, quiet after 731 ms (react, query, router)
  url "http://127.0.0.1:5217/orders?sort=placedAt&dir=desc"
  1 pass render SidebarNav max 0  {renders:0,mounts:0,updates:0,remounts:0,semantics:exact,instances:1,activeInstances:1}
      claim: {kind:renders,target:{component:SidebarNav},max:0,counting:renders,allowRemount:false}
      deciding: [{kind:coverage,complete:true,targetedComplete:true,semantics:exact},{kind:instance,mountId:mount:1,renderingState:mounted-rendering,source:/src/layout/app-shell.tsx:38:9}]
  2 pass render BulkActionBar min 1  {renders:1,mounts:0,updates:1,remounts:0,semantics:exact,instances:1,activeInstances:1}
      claim: {kind:renders,target:{component:BulkActionBar},min:1,counting:renders,allowRemount:false}
      deciding: [{kind:instance,mountId:mount:2,renders:1,mounts:0,updates:1,mountGeneration:1,latestDocumentCommitId:14,source:/src/features/orders/orders-page.tsx:77:9}]
  3 pass boundaries clean  {caughtDuringWindow:0,caughtAtEnd:0}
      claim: {kind:boundaries-clean,scope:window}
      deciding: [{kind:boundary-log,scope:window,complete:true,afterDocumentCommitId:9}]
      caveats: [uncaught-errors-outside-boundaries-unobserved]
window: {observationId:observation:1,startDocumentCommitId:9,settledDocumentCommitId:15,frozenDocumentCommitId:16,commits:7,settle:{outcome:met,quietMs:500,timeoutMs:10000,waitedMs:731,domains:{react:met,query:met,router:met}},tail:{ms:500,commits:1},environment:{bundle:development,strictMode:on,renderCollection:available,visibility:document}}
! ui-outcome-not-observed: Genie does not check the screen; confirm it with the UI driver
attempt 2 for these claims on this tab; previous fail vfy_bd8e1d6a-5e03-477a-a0ca-fbfe2e995949; document reloaded since
evidence: $ pnpm exec genie-react verify show vfy_fa81c07f-2672-4f7b-b8e5-4c1f62f8fb29 --session art-l7
session: {sessionId:a43768bf-2c64-46a8-8189-01f5b606ec3b,logicalSessionId:f302b7a7-ad8a-4a18-be94-bcefe0ff9a9b,documentGeneration:9}
schemaVersion: "1.0"
exitCode: 0
stage: end
ledger: {fingerprint:cf_2380e6bf6da4,scope:logical-session,storage:memory,attempt:2,history:[{verificationId:vfy_bd8e1d6a-5e03-477a-a0ca-fbfe2e995949,verdict:fail,reasons:[],endedAt:2026-11-19T04:20:05.723Z}],codeChangedSincePrevious:document-reloaded,failsOnSameCode:0}
evidence: {retained:true,tools:[react_get_renders,react_component_cohort,react_list_overrides,query_is_fetching,react_refresh_events,browser_visibility,react_profile_stop,react_error_state]}
startedAt: 2026-11-19T04:20:14.722Z
endedAt: 2026-11-19T04:20:19.740Z
request: {budget:{fiberLimit:250,operationLimit:20000,timeLimitMs:8,targetOperationReserve:4000,targetTimeReserveMs:4,adaptive:true},settle:{quietMs:500,timeoutMs:10000},maxDurationMs:300000,allowOverrides:false}
[exit 0]

$ agent-browser --session art-l7 is visible '[role=toolbar][aria-label="Bulk actions"]'
true
[exit 0]

### FIX REVERTED (git checkout -- src/layout/sidebar-nav.tsx)
```

## Re-run on Genie 1.1.0

- Date: 2026-11-19 (UTC times appear in the log)
- Commit: `ce408cb205c0e798cb04c35512772b7454283141` (`git rev-parse HEAD`, first command below).
  App source unmodified except for the temporary `init` output and the temporary fix shown in the
  log, both reverted.
- App: `apps/realworld-dashboard` (Meridian Ops), React 19.3.1 in StrictMode, Vite 8 dev server,
  development bundle, started from the app folder with
  `DASHBOARD_PORT=5244 pnpm exec vite --port 5244 --strictPort`
- URL: `http://127.0.0.1:5244/orders`
- Genie CLI and runtime: 1.1.0 (workspace build from `pnpm install && pnpm build`), session `upd-h`,
  driver agent-browser 0.43.0. The browser session was already signed in from the
  `debug-a-react-app-with-claude-code` re-run, which ran just before on the same tab.
- The commands ran from a terminal, the same shell commands an agent runs from the installed skill.
  No session inside Cursor, Codex or Copilot was recorded.

Every command below ran from `apps/realworld-dashboard`, in this order, through a wrapper that
records the command, its full output and its exit code (`# exit code: N`). Output is untrimmed. The
home directory path is shown as `~`. Lines starting with `###` are notes added while recording.

One block checks the 1.1.0 change to the `exit` field. A `call` with a `--select` that matches
nothing prints `exit: {code:1,class:failure}`, and `echo` prints the process exit code, 1. 1.0.2
printed `exit: {code:2,class:usage}` for the same failure while the process exited 1 (see the
`what-is-an-agentic-react-tool` evidence). The wrapper's `# exit code: 0` on that block is the exit
code of `echo`.

What changed from the 1.0.2 runs above:

- `doctor` reports version 1.1.0 and hash
  `5c1f2904f7a90b318ef0189be0f2f4367e24003c0e29c812b3889deb72b8980b` for both skill locations.
- The default `react_render_causes` view prints
  `{changedFields:[selectedOrderIds]}` on the external-store cause, so this run skips the
  `"view":"full"` call.
- The skill's step 2 waits with `devtools_wait` condition `settled` and
  `"domains":["react","query","router"]`, so this run uses it in place of `react_quiesce`.
- The verdict lines list `network` among the settled domains.
- Suggested commands from `node_modules/.bin/genie-react` start with `pnpm exec genie-react`, the
  runner Genie takes from the pnpm lockfile when none is set.
- The `attempt` counts on the verify runs (3 and 4) include the two runs with the same claims from
  the `debug-a-react-app-with-claude-code` re-run on the same tab.

```console
$ git rev-parse HEAD
ce408cb205c0e798cb04c35512772b7454283141
# exit code: 0 (09:00:54Z UTC)
```

```console
$ node_modules/.bin/genie-react init --dry-run
ok setup_planned: Setup changes are recorded in artifacts.
next: $ pnpm exec genie-react doctor
userActionRequired: false
data:
  framework: tanstack-router
  dryRun: true
  artifacts[7]:
    each: {status:already}
    - {kind:vite_config,path:~/.t3/worktrees/genie-react/ali-articles-update-h-e6148dda487d643b/apps/realworld-dashboard/vite.config.ts}
    - {kind:root_route,path:~/.t3/worktrees/genie-react/ali-articles-update-h-e6148dda487d643b/apps/realworld-dashboard/src/routes/__root.tsx}
    - {kind:gitignore,path:~/.t3/worktrees/genie-react/ali-articles-update-h-e6148dda487d643b/apps/realworld-dashboard/.gitignore}
    - {kind:agent_skill,path:~/.t3/worktrees/genie-react/ali-articles-update-h-e6148dda487d643b/apps/realworld-dashboard/.agents/skills/genie/SKILL.md}
    - {kind:agent_skill,path:~/.t3/worktrees/genie-react/ali-articles-update-h-e6148dda487d643b/apps/realworld-dashboard/.agents/skills/genie/APP_TOOLS.md}
    - {kind:agent_skill,path:~/.t3/worktrees/genie-react/ali-articles-update-h-e6148dda487d643b/apps/realworld-dashboard/.agents/skills/genie/EVIDENCE.md}
    - {kind:agent_skill,path:~/.t3/worktrees/genie-react/ali-articles-update-h-e6148dda487d643b/apps/realworld-dashboard/.claude/skills/genie,link:symlink}
  manualSteps: []
  optionalSteps: []
  commands:
    install: {command:"pnpm add -D genie-react @genie-react/cli",argv:[pnpm,add,"-D",genie-react,@genie-react/cli],condition:"if packages are missing"}
    dev: $ pnpm dev
# exit code: 0 (09:00:54Z UTC)
```

```console
$ node_modules/.bin/genie-react init --yes
ok setup_completed: Setup changes are recorded in artifacts.
next: $ pnpm exec genie-react doctor
userActionRequired: false
data:
  framework: tanstack-router
  dryRun: false
  artifacts[7]:
    each: {status:already}
    - {kind:vite_config,path:~/.t3/worktrees/genie-react/ali-articles-update-h-e6148dda487d643b/apps/realworld-dashboard/vite.config.ts}
    - {kind:root_route,path:~/.t3/worktrees/genie-react/ali-articles-update-h-e6148dda487d643b/apps/realworld-dashboard/src/routes/__root.tsx}
    - {kind:gitignore,path:~/.t3/worktrees/genie-react/ali-articles-update-h-e6148dda487d643b/apps/realworld-dashboard/.gitignore}
    - {kind:agent_skill,path:~/.t3/worktrees/genie-react/ali-articles-update-h-e6148dda487d643b/apps/realworld-dashboard/.agents/skills/genie/SKILL.md}
    - {kind:agent_skill,path:~/.t3/worktrees/genie-react/ali-articles-update-h-e6148dda487d643b/apps/realworld-dashboard/.agents/skills/genie/APP_TOOLS.md}
    - {kind:agent_skill,path:~/.t3/worktrees/genie-react/ali-articles-update-h-e6148dda487d643b/apps/realworld-dashboard/.agents/skills/genie/EVIDENCE.md}
    - {kind:agent_skill,path:~/.t3/worktrees/genie-react/ali-articles-update-h-e6148dda487d643b/apps/realworld-dashboard/.claude/skills/genie,link:symlink}
  manualSteps: []
  optionalSteps: []
  commands:
    install: {command:"pnpm add -D genie-react @genie-react/cli",argv:[pnpm,add,"-D",genie-react,@genie-react/cli],condition:"if packages are missing"}
    dev: $ pnpm dev
# exit code: 0 (09:00:55Z UTC)
```

```console
$ find .agents .claude -maxdepth 3 -exec ls -ld {} + | awk '{print $1, $9, $10, $11}'
drwxr-xr-x@ .agents  
drwxr-xr-x@ .agents/skills  
drwxr-xr-x@ .agents/skills/genie  
-rw-r--r--@ .agents/skills/genie/APP_TOOLS.md  
-rw-r--r--@ .agents/skills/genie/EVIDENCE.md  
-rw-r--r--@ .agents/skills/genie/SKILL.md  
drwxr-xr-x@ .claude  
drwxr-xr-x@ .claude/skills  
lrwxr-xr-x@ .claude/skills/genie -> ../../.agents/skills/genie
# exit code: 0 (09:00:55Z UTC)
```

```console
$ grep -n 'genie-react' .agents/skills/genie/SKILL.md | head -5
6:  package: "@genie-react/cli"
17:node_modules/.bin/genie-react status --session my-agent --wait 15000
20:Pass the same `--session` to every Genie command. Connected means `ready: true` on the intended URL; otherwise run `node_modules/.bin/genie-react doctor --live` and follow it. In another browser, add `?_genie=my-agent` to the URL. On native, open the app with agent-device and use the `sessionId` from `status`.
27:node_modules/.bin/genie-react call react_clear_renders '{"component":"CheckoutRow"}' --session my-agent
29:node_modules/.bin/genie-react call devtools_wait '{"condition":"settled","domains":["react","query","router"],"timeoutMs":10000}' --fail-on-result-error --session my-agent
# exit code: 0 (09:00:55Z UTC)
```

```console
$ sed -n 1,8p .agents/skills/genie/SKILL.md
---
name: genie
description: Verify React fixes and see inside a running React or React Native app, alongside agent-browser or agent-device. Use to prove a fix worked, find why a component re-rendered, debug a looping effect, inspect Query, Router, Suspense, hydration or error-boundary state, compare performance before and after a change, or call the app's own app_* tools.
metadata:
  version: "1.1.0"
  package: "@genie-react/cli"
---
# exit code: 0 (09:00:55Z UTC)
```

```console
$ node_modules/.bin/genie-react doctor
ok checks_passed: Setup checks passed.
checks[5] (ok|FAIL critical|optional label — detail):
  ok critical "Vite config references genie-react/vite" — vite.config.ts
  ok critical "genie-react resolvable in node_modules"
  ok critical "agent skill matches the bundled CLI guidance" — ".agents/skills/genie · sha256 5c1f2904f7a9"
  ok critical "Claude Code skill matches the bundled CLI guidance" — ".claude/skills/genie (symlink) · sha256 5c1f2904f7a9"
  ok critical "CLI and runtime package versions agree" — "cli 1.1.0 · runtime 1.1.0"
ok: true
framework: tanstack-router
bridge:
  url: ws://127.0.0.1:5244/__genie/ws
  pid: 65337
  tokenFile: /var/folders/vm/fn7s5pmd3d71cnwhh22_9qb00000gn/T/genie-react-501/dd5a72fb517c8fcec82f18f655c72d61586d0d4f84c5a6d4faff89e556980202.json
versions: {cli:1.1.0,runtime:1.1.0,bundledSkill:1.1.0,activeSkill:1.1.0}
skill:
  path: .agents/skills/genie
  bundledHash: 5c1f2904f7a90b318ef0189be0f2f4367e24003c0e29c812b3889deb72b8980b
  activeHash: 5c1f2904f7a90b318ef0189be0f2f4367e24003c0e29c812b3889deb72b8980b
  current: true
  locations[2]:
    - {path:.agents/skills/genie,symlink:false,conflictPath:null,version:1.1.0,hash:5c1f2904f7a90b318ef0189be0f2f4367e24003c0e29c812b3889deb72b8980b,current:true}
    - {path:.claude/skills/genie,symlink:true,conflictPath:null,version:1.1.0,hash:5c1f2904f7a90b318ef0189be0f2f4367e24003c0e29c812b3889deb72b8980b,current:true}
bridgeCandidates[1]:
  - {url:ws://127.0.0.1:5244/__genie/ws,pid:65337,tokenFile:/var/folders/vm/fn7s5pmd3d71cnwhh22_9qb00000gn/T/genie-react-501/dd5a72fb517c8fcec82f18f655c72d61586d0d4f84c5a6d4faff89e556980202.json}
remediation: []
userActionRequired: false
# exit code: 0 (09:00:55Z UTC)
```

### The runs above found the init files from the debug article run still in place, so every artifact says `already`. Reverting them and running init again from a clean folder.

```console
$ rm -rf .agents .claude && git checkout -- .gitignore && git status --short .

# exit code: 0 (09:01:04Z UTC)
```

```console
$ node_modules/.bin/genie-react init --dry-run
ok setup_planned: Setup changes are recorded in artifacts.
next: $ pnpm exec genie-react doctor
userActionRequired: false
data:
  framework: tanstack-router
  dryRun: true
  artifacts[7]:
    - {kind:vite_config,status:already,path:~/.t3/worktrees/genie-react/ali-articles-update-h-e6148dda487d643b/apps/realworld-dashboard/vite.config.ts}
    - {kind:root_route,status:already,path:~/.t3/worktrees/genie-react/ali-articles-update-h-e6148dda487d643b/apps/realworld-dashboard/src/routes/__root.tsx}
    - {kind:gitignore,path:~/.t3/worktrees/genie-react/ali-articles-update-h-e6148dda487d643b/apps/realworld-dashboard/.gitignore,status:planned}
    - {kind:agent_skill,path:~/.t3/worktrees/genie-react/ali-articles-update-h-e6148dda487d643b/apps/realworld-dashboard/.agents/skills/genie/SKILL.md,status:planned}
    - {kind:agent_skill,path:~/.t3/worktrees/genie-react/ali-articles-update-h-e6148dda487d643b/apps/realworld-dashboard/.agents/skills/genie/APP_TOOLS.md,status:planned}
    - {kind:agent_skill,path:~/.t3/worktrees/genie-react/ali-articles-update-h-e6148dda487d643b/apps/realworld-dashboard/.agents/skills/genie/EVIDENCE.md,status:planned}
    - {kind:agent_skill,path:~/.t3/worktrees/genie-react/ali-articles-update-h-e6148dda487d643b/apps/realworld-dashboard/.claude/skills/genie,status:planned,link:symlink}
  manualSteps: []
  optionalSteps: []
  commands:
    install: {command:"pnpm add -D genie-react @genie-react/cli",argv:[pnpm,add,"-D",genie-react,@genie-react/cli],condition:"if packages are missing"}
    dev: $ pnpm dev
# exit code: 0 (09:01:04Z UTC)
```

```console
$ node_modules/.bin/genie-react init --yes
ok setup_completed: Setup changes are recorded in artifacts.
next: $ pnpm exec genie-react doctor
userActionRequired: false
data:
  framework: tanstack-router
  dryRun: false
  artifacts[7]:
    - {kind:vite_config,status:already,path:~/.t3/worktrees/genie-react/ali-articles-update-h-e6148dda487d643b/apps/realworld-dashboard/vite.config.ts}
    - {kind:root_route,status:already,path:~/.t3/worktrees/genie-react/ali-articles-update-h-e6148dda487d643b/apps/realworld-dashboard/src/routes/__root.tsx}
    - {kind:gitignore,path:~/.t3/worktrees/genie-react/ali-articles-update-h-e6148dda487d643b/apps/realworld-dashboard/.gitignore,status:applied}
    - {kind:agent_skill,path:~/.t3/worktrees/genie-react/ali-articles-update-h-e6148dda487d643b/apps/realworld-dashboard/.agents/skills/genie/SKILL.md,status:applied}
    - {kind:agent_skill,path:~/.t3/worktrees/genie-react/ali-articles-update-h-e6148dda487d643b/apps/realworld-dashboard/.agents/skills/genie/APP_TOOLS.md,status:applied}
    - {kind:agent_skill,path:~/.t3/worktrees/genie-react/ali-articles-update-h-e6148dda487d643b/apps/realworld-dashboard/.agents/skills/genie/EVIDENCE.md,status:applied}
    - {kind:agent_skill,path:~/.t3/worktrees/genie-react/ali-articles-update-h-e6148dda487d643b/apps/realworld-dashboard/.claude/skills/genie,status:applied,link:symlink}
  manualSteps: []
  optionalSteps: []
  commands:
    install: {command:"pnpm add -D genie-react @genie-react/cli",argv:[pnpm,add,"-D",genie-react,@genie-react/cli],condition:"if packages are missing"}
    dev: $ pnpm dev
# exit code: 0 (09:01:04Z UTC)
```

```console
$ find .agents .claude -maxdepth 3 -exec ls -ld {} + | awk '{print $1, $9, $10, $11}'
drwxr-xr-x@ .agents  
drwxr-xr-x@ .agents/skills  
drwxr-xr-x@ .agents/skills/genie  
-rw-r--r--@ .agents/skills/genie/APP_TOOLS.md  
-rw-r--r--@ .agents/skills/genie/EVIDENCE.md  
-rw-r--r--@ .agents/skills/genie/SKILL.md  
drwxr-xr-x@ .claude  
drwxr-xr-x@ .claude/skills  
lrwxr-xr-x@ .claude/skills/genie -> ../../.agents/skills/genie
# exit code: 0 (09:01:04Z UTC)
```

```console
$ git diff .gitignore
diff --git a/apps/realworld-dashboard/.gitignore b/apps/realworld-dashboard/.gitignore
index 758f9ac..a9fd499 100644
--- a/apps/realworld-dashboard/.gitignore
+++ b/apps/realworld-dashboard/.gitignore
@@ -1,2 +1,3 @@
 .vite
 .variants
+.genie/
# exit code: 0 (09:01:04Z UTC)
```

```console
$ node_modules/.bin/genie-react doctor
ok checks_passed: Setup checks passed.
checks[5] (ok|FAIL critical|optional label — detail):
  ok critical "Vite config references genie-react/vite" — vite.config.ts
  ok critical "genie-react resolvable in node_modules"
  ok critical "agent skill matches the bundled CLI guidance" — ".agents/skills/genie · sha256 5c1f2904f7a9"
  ok critical "Claude Code skill matches the bundled CLI guidance" — ".claude/skills/genie (symlink) · sha256 5c1f2904f7a9"
  ok critical "CLI and runtime package versions agree" — "cli 1.1.0 · runtime 1.1.0"
ok: true
framework: tanstack-router
bridge:
  url: ws://127.0.0.1:5244/__genie/ws
  pid: 65337
  tokenFile: /var/folders/vm/fn7s5pmd3d71cnwhh22_9qb00000gn/T/genie-react-501/dd5a72fb517c8fcec82f18f655c72d61586d0d4f84c5a6d4faff89e556980202.json
versions: {cli:1.1.0,runtime:1.1.0,bundledSkill:1.1.0,activeSkill:1.1.0}
skill:
  path: .agents/skills/genie
  bundledHash: 5c1f2904f7a90b318ef0189be0f2f4367e24003c0e29c812b3889deb72b8980b
  activeHash: 5c1f2904f7a90b318ef0189be0f2f4367e24003c0e29c812b3889deb72b8980b
  current: true
  locations[2]:
    - {path:.agents/skills/genie,symlink:false,conflictPath:null,version:1.1.0,hash:5c1f2904f7a90b318ef0189be0f2f4367e24003c0e29c812b3889deb72b8980b,current:true}
    - {path:.claude/skills/genie,symlink:true,conflictPath:null,version:1.1.0,hash:5c1f2904f7a90b318ef0189be0f2f4367e24003c0e29c812b3889deb72b8980b,current:true}
bridgeCandidates[1]:
  - {url:ws://127.0.0.1:5244/__genie/ws,pid:65337,tokenFile:/var/folders/vm/fn7s5pmd3d71cnwhh22_9qb00000gn/T/genie-react-501/dd5a72fb517c8fcec82f18f655c72d61586d0d4f84c5a6d4faff89e556980202.json}
remediation: []
userActionRequired: false
# exit code: 0 (09:01:05Z UTC)
```

```console
$ node_modules/.bin/genie-react call react_error_state '{}' --session upd-h --select caughtErrors.0.boundaryName; echo "process exit: $?"
error invalid_input: Tool call failed. --select caughtErrors.0.boundaryName matched no paths. details.selection.available lists the result's top-level paths. Correct --select and retry.
next: $ pnpm exec genie-react tools react_error_state --session upd-h
userActionRequired: true
errorCode: invalid-input
details:
  selection:
    expression: caughtErrors.0.boundaryName
    available: [/blankTreeHint,/caughtErrors,/ownershipCoverage,/scanTruncated,/suspended]
exit: {code:1,class:failure}
process exit: 1
# exit code: 0 (09:01:15Z UTC)
```

### init changes reverted below. Demo run: order selection re-renders sidebar

```console
$ rm -rf .agents .claude && git checkout -- .gitignore && git status --short .

# exit code: 0 (09:01:15Z UTC)
```

```console
$ agent-browser --session upd-h open http://127.0.0.1:5244/orders
✓ Meridian Ops
  http://127.0.0.1:5244/orders?sort=placedAt&dir=desc
# exit code: 0 (09:01:15Z UTC)
```

```console
$ node_modules/.bin/genie-react status --session upd-h --wait 15000
selectedBridgeUrl: ws://127.0.0.1:5244/__genie/ws
sessionSelector:
  requested: upd-h
  source: flag
  resolvedSessionId: 375a492c-5eba-4f19-b6fb-53436e2cd826
  implicit: false
  agentBrowser: {session:upd-h,via:selector,logicalSessionId:90bf66d1-69c3-4cd0-bdaa-8ccbcfbbe2fe}
connected: true
ready: true
sessionId: 375a492c-5eba-4f19-b6fb-53436e2cd826
app:
  name: "Meridian Ops"
  url: "http://127.0.0.1:5244/orders?sort=placedAt&dir=desc"
  reactVersion: 19.3.1
  reactMounted: true
domains: [session,react]
toolCount: 48
sessions[1] (sessionId {fields}):
  375a492c-5eba-4f19-b6fb-53436e2cd826 {logicalSessionId:90bf66d1-69c3-4cd0-bdaa-8ccbcfbbe2fe,documentGeneration:10,predecessorSessionId:01eb56d2-2bf4-46cd-bb12-7852ee56f780,logicalSessionCollision:false,collisionWithSessionIds:[],app:{name:"Meridian Ops",url:"http://127.0.0.1:5244/orders?sort=placedAt&dir=desc",reactVersion:19.3.1,reactMounted:true},domains:[session,react],toolCount:48,connectedAt:1795078875709,ready:true,readyAt:1795078875709,current:true,origin:http://127.0.0.1:5244,runtimeVersion:1.1.0}
warnings: []
hub: {version:1.1.0,protocol:1}
# exit code: 0 (09:01:15Z UTC)
```

```console
$ agent-browser --session upd-h wait '[role=row][data-order-id]'
✓ Done
# exit code: 0 (09:01:16Z UTC)
```

```console
$ agent-browser --session upd-h snapshot -i -s '[role=row][data-order-id]:nth-of-type(2)'
- gridcell "Select SO-105999" [ref=e391]
  - checkbox "Select SO-105999" [checked=false, ref=e483]
- gridcell "SO-105999" [ref=e392]
  - link "SO-105999" [ref=e484]
- gridcell "Delta Health 5" [ref=e393]
- gridcell "Processing" [ref=e394]
- gridcell "standard" [ref=e395]
- gridcell "EMEA" [ref=e396]
- gridcell "40" [ref=e397]
- gridcell "Mar 2, 2026" [ref=e398]
- gridcell "$8,624.19" [ref=e399]
- gridcell "Actions for SO-105999" [ref=e400]
  - button "Actions for SO-105999" [expanded=false, ref=e502]
# exit code: 0 (09:01:16Z UTC)
```

```console
$ node_modules/.bin/genie-react call react_clear_renders '{"component":"SidebarNav"}' --session upd-h --fields ok
[1]:
  - {ok:true}
# exit code: 0 (09:01:23Z UTC)
```

```console
$ agent-browser --session upd-h check 'input[aria-label="Select SO-105999"]'
✓ Done
# exit code: 0 (09:01:23Z UTC)
```

```console
$ node_modules/.bin/genie-react call devtools_wait '{"condition":"settled","domains":["react","query","router"],"timeoutMs":10000}' --fail-on-result-error --session upd-h --fields ok,waitedMs
[1]:
  - {ok:true,waitedMs:943}
# exit code: 0 (09:01:24Z UTC)
```

```console
$ node_modules/.bin/genie-react call react_render_causes '{"component":"SidebarNav","limit":5}' --session upd-h
componentMatch:
  component: SidebarNav
  exact: true
  status: matched
  matchedNames: [SidebarNav]
  matchedNameCount: 1
  similarNames: []
tracking: true
commits: 4
documentCommitId: 18
observation: {id:observation:1,epoch:1,startedAfterDocumentCommitId:14}
attribution:
  status: current
  startedAtDocumentCommitId: 18
  completedAtDocumentCommitId: 18
  startedAtAnalysisGeneration: 19
  completedAtAnalysisGeneration: 19
view: summary
events[1] (componentName #componentId {fields}, then ← kind evidence name {fields} per cause):
  SidebarNav #5233266655274 {renderEventId:render:15:1,documentCommitId:15,mountId:mount:1,necessity:unnecessary,necessityReason:output-unchanged,inputEvidence:none-observed,source:{location:/src/layout/app-shell.tsx:38:9,role:element-callsite,ownership:app}}
    ← external-store inferred anonymous-external-store {changedFields:[selectedOrderIds]}
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
renderEventRetention: {evictedEvents:0,earliestDocumentCommitId:15,latestDocumentCommitId:18}
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
# exit code: 0 (09:01:25Z UTC)
```

```console
$ agent-browser --session upd-h uncheck 'input[aria-label="Select SO-105999"]'
✓ Done
# exit code: 0 (09:01:33Z UTC)
```

```console
$ node_modules/.bin/genie-react verify begin --session upd-h --name 'select one order' --claim 'render SidebarNav max 0' --claim 'render BulkActionBar min 1' --claim 'boundaries clean'
recording vfy_318d0207-1703-42ba-ba27-aba7a53af498 "select one order"
  url "http://127.0.0.1:5244/orders?sort=placedAt&dir=desc"
  1 recording render SidebarNav max 0
  2 recording render BulkActionBar min 1
  3 recording boundaries clean
window: {observationId:observation:2,startDocumentCommitId:28,domains:[react,query,router,network],quietMs:500,timeoutMs:10000,tailMs:500}
next: $ pnpm exec genie-react verify end vfy_318d0207-1703-42ba-ba27-aba7a53af498 --session upd-h
session: {sessionId:375a492c-5eba-4f19-b6fb-53436e2cd826,logicalSessionId:90bf66d1-69c3-4cd0-bdaa-8ccbcfbbe2fe,documentGeneration:10}
schemaVersion: "1.0"
targets: [{target:{component:SidebarNav},status:resolved,instances:1,source:/src/layout/app-shell.tsx},{target:{component:BulkActionBar},status:resolved,instances:1,source:/src/features/orders/orders-page.tsx}]
startedAt: 2026-11-19T09:01:33.783Z
expiresAt: 2026-11-19T09:06:33.788Z
request: {budget:{fiberLimit:250,operationLimit:20000,timeLimitMs:8,targetOperationReserve:4000,targetTimeReserveMs:4,adaptive:true},settle:{quietMs:500,timeoutMs:10000},maxDurationMs:300000,allowOverrides:false}
# exit code: 0 (09:01:33Z UTC)
```

```console
$ agent-browser --session upd-h check 'input[aria-label="Select SO-105999"]'
✓ Done
# exit code: 0 (09:01:39Z UTC)
```

```console
$ node_modules/.bin/genie-react verify end vfy_318d0207-1703-42ba-ba27-aba7a53af498 --session upd-h
fail vfy_318d0207-1703-42ba-ba27-aba7a53af498 "select one order"  10 commits, quiet after 899 ms (react, query, router, network)
  url "http://127.0.0.1:5244/orders?sort=placedAt&dir=desc"
  1 fail render SidebarNav max 0  {renders:1,mounts:0,updates:1,remounts:0,semantics:exact,instances:1,activeInstances:1}
      claim: {kind:renders,target:{component:SidebarNav},max:0,counting:renders,allowRemount:false}
      deciding: [{kind:instance,mountId:mount:1,renders:1,mounts:0,updates:1,mountGeneration:1,latestDocumentCommitId:35,source:/src/layout/app-shell.tsx:38:9}]
  2 pass render BulkActionBar min 1  {renders:1,mounts:0,updates:1,remounts:0,semantics:exact,instances:1,activeInstances:1}
      claim: {kind:renders,target:{component:BulkActionBar},min:1,counting:renders,allowRemount:false}
      deciding: [{kind:instance,mountId:mount:28,renders:1,mounts:0,updates:1,mountGeneration:1,latestDocumentCommitId:35,source:/src/features/orders/orders-page.tsx:77:9}]
  3 pass boundaries clean  {caughtDuringWindow:0,caughtAtEnd:0}
      claim: {kind:boundaries-clean,scope:window}
      deciding: [{kind:boundary-log,scope:window,complete:true,afterDocumentCommitId:28}]
      caveats: [uncaught-errors-outside-boundaries-unobserved]
window: {observationId:observation:2,startDocumentCommitId:28,settledDocumentCommitId:37,frozenDocumentCommitId:38,commits:10,settle:{outcome:met,quietMs:500,timeoutMs:10000,waitedMs:899,domains:{react:met,query:met,router:met,network:met}},tail:{ms:500,commits:1},environment:{bundle:development,strictMode:on,renderCollection:available,visibility:document}}
! ui-outcome-not-observed: Genie does not check the screen; confirm it with the UI driver
attempt 3 for these claims on this tab; previous pass vfy_a080db08-8413-4f17-b45d-78b38765c9a0; document reloaded since
evidence: $ pnpm exec genie-react verify show vfy_318d0207-1703-42ba-ba27-aba7a53af498 --claim 1 --session upd-h
session: {sessionId:375a492c-5eba-4f19-b6fb-53436e2cd826,logicalSessionId:90bf66d1-69c3-4cd0-bdaa-8ccbcfbbe2fe,documentGeneration:10}
schemaVersion: "1.0"
exitCode: 1
stage: end
ledger: {fingerprint:cf_9a318cb45e7b,scope:logical-session,storage:memory,attempt:3,history:[{verificationId:vfy_ca6cec22-2bae-4196-a1c9-39ef31c54fe6,verdict:fail,reasons:[],endedAt:2026-11-19T09:00:22.765Z},{verificationId:vfy_a080db08-8413-4f17-b45d-78b38765c9a0,verdict:pass,reasons:[],endedAt:2026-11-19T09:00:44.315Z}],codeChangedSincePrevious:document-reloaded,failsOnSameCode:0}
evidence: {retained:true,tools:[react_get_renders,react_component_cohort,react_list_overrides,query_is_fetching,react_refresh_events,browser_visibility,request_watch_start,request_watch_stop,react_profile_stop,react_error_state]}
startedAt: 2026-11-19T09:01:33.783Z
endedAt: 2026-11-19T09:01:41.191Z
request: {budget:{fiberLimit:250,operationLimit:20000,timeLimitMs:8,targetOperationReserve:4000,targetTimeReserveMs:4,adaptive:true},settle:{quietMs:500,timeoutMs:10000},maxDurationMs:300000,allowOverrides:false}
# exit code: 1 (09:01:41Z UTC)
```

### FIX APPLIED

```console
$ git diff src/layout/sidebar-nav.tsx
diff --git a/apps/realworld-dashboard/src/layout/sidebar-nav.tsx b/apps/realworld-dashboard/src/layout/sidebar-nav.tsx
index fd9e6d8..82c92e7 100644
--- a/apps/realworld-dashboard/src/layout/sidebar-nav.tsx
+++ b/apps/realworld-dashboard/src/layout/sidebar-nav.tsx
@@ -29,7 +29,7 @@ const NAV_ITEMS: readonly NavItem[] = [
 ]
 
 export function SidebarNav({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
-  const { recentlyViewed } = useWorkspaceStore()
+  const recentlyViewed = useWorkspaceStore((state) => state.recentlyViewed)
   return (
     <aside
       aria-label="Primary"
# exit code: 0 (09:01:48Z UTC)
```

```console
$ agent-browser --session upd-h uncheck 'input[aria-label="Select SO-105999"]'
✓ Done
# exit code: 0 (09:01:50Z UTC)
```

```console
$ node_modules/.bin/genie-react verify begin --session upd-h --name 'select one order' --claim 'render SidebarNav max 0' --claim 'render BulkActionBar min 1' --claim 'boundaries clean'
recording vfy_8b69a7b8-f5cf-489b-9777-712157367ed6 "select one order"
  url "http://127.0.0.1:5244/orders?sort=placedAt&dir=desc"
  1 recording render SidebarNav max 0
  2 recording render BulkActionBar min 1
  3 recording boundaries clean
window: {observationId:observation:1,startDocumentCommitId:8,domains:[react,query,router,network],quietMs:500,timeoutMs:10000,tailMs:500}
next: $ pnpm exec genie-react verify end vfy_8b69a7b8-f5cf-489b-9777-712157367ed6 --session upd-h
session: {sessionId:e44344ad-9b2f-494a-8a7e-52734fbdc7ad,logicalSessionId:90bf66d1-69c3-4cd0-bdaa-8ccbcfbbe2fe,documentGeneration:11}
schemaVersion: "1.0"
targets: [{target:{component:SidebarNav},status:resolved,instances:1,source:/src/layout/app-shell.tsx},{target:{component:BulkActionBar},status:resolved,instances:1,source:/src/features/orders/orders-page.tsx}]
startedAt: 2026-11-19T09:01:50.941Z
expiresAt: 2026-11-19T09:06:50.949Z
request: {budget:{fiberLimit:250,operationLimit:20000,timeLimitMs:8,targetOperationReserve:4000,targetTimeReserveMs:4,adaptive:true},settle:{quietMs:500,timeoutMs:10000},maxDurationMs:300000,allowOverrides:false}
# exit code: 0 (09:01:50Z UTC)
```

```console
$ agent-browser --session upd-h check 'input[aria-label="Select SO-105999"]'
✓ Done
# exit code: 0 (09:01:57Z UTC)
```

```console
$ node_modules/.bin/genie-react verify end vfy_8b69a7b8-f5cf-489b-9777-712157367ed6 --session upd-h
pass vfy_8b69a7b8-f5cf-489b-9777-712157367ed6 "select one order"  11 commits, quiet after 1325 ms (react, query, router, network)
  url "http://127.0.0.1:5244/orders?sort=placedAt&dir=desc"
  1 pass render SidebarNav max 0  {renders:0,mounts:0,updates:0,remounts:0,semantics:exact,instances:1,activeInstances:1}
      claim: {kind:renders,target:{component:SidebarNav},max:0,counting:renders,allowRemount:false}
      deciding: [{kind:coverage,complete:true,targetedComplete:true,semantics:exact},{kind:instance,mountId:mount:1,renderingState:mounted-rendering,source:/src/layout/app-shell.tsx:38:9}]
  2 pass render BulkActionBar min 1  {renders:1,mounts:0,updates:1,remounts:0,semantics:exact,instances:1,activeInstances:1}
      claim: {kind:renders,target:{component:BulkActionBar},min:1,counting:renders,allowRemount:false}
      deciding: [{kind:instance,mountId:mount:2,renders:1,mounts:0,updates:1,mountGeneration:1,latestDocumentCommitId:16,source:/src/features/orders/orders-page.tsx:77:9}]
  3 pass boundaries clean  {caughtDuringWindow:0,caughtAtEnd:0}
      claim: {kind:boundaries-clean,scope:window}
      deciding: [{kind:boundary-log,scope:window,complete:true,afterDocumentCommitId:8}]
      caveats: [uncaught-errors-outside-boundaries-unobserved]
window: {observationId:observation:1,startDocumentCommitId:8,settledDocumentCommitId:18,frozenDocumentCommitId:19,commits:11,settle:{outcome:met,quietMs:500,timeoutMs:10000,waitedMs:1325,domains:{react:met,query:met,router:met,network:met}},tail:{ms:500,commits:1},environment:{bundle:development,strictMode:on,renderCollection:available,visibility:document}}
! ui-outcome-not-observed: Genie does not check the screen; confirm it with the UI driver
attempt 4 for these claims on this tab; previous fail vfy_318d0207-1703-42ba-ba27-aba7a53af498; document reloaded since
evidence: $ pnpm exec genie-react verify show vfy_8b69a7b8-f5cf-489b-9777-712157367ed6 --session upd-h
session: {sessionId:e44344ad-9b2f-494a-8a7e-52734fbdc7ad,logicalSessionId:90bf66d1-69c3-4cd0-bdaa-8ccbcfbbe2fe,documentGeneration:11}
schemaVersion: "1.0"
exitCode: 0
stage: end
ledger: {fingerprint:cf_9a318cb45e7b,scope:logical-session,storage:memory,attempt:4,history:[{verificationId:vfy_ca6cec22-2bae-4196-a1c9-39ef31c54fe6,verdict:fail,reasons:[],endedAt:2026-11-19T09:00:22.765Z},{verificationId:vfy_a080db08-8413-4f17-b45d-78b38765c9a0,verdict:pass,reasons:[],endedAt:2026-11-19T09:00:44.315Z},{verificationId:vfy_318d0207-1703-42ba-ba27-aba7a53af498,verdict:fail,reasons:[],endedAt:2026-11-19T09:01:41.191Z}],codeChangedSincePrevious:document-reloaded,failsOnSameCode:0}
evidence: {retained:true,tools:[react_get_renders,react_component_cohort,react_list_overrides,query_is_fetching,react_refresh_events,browser_visibility,request_watch_start,request_watch_stop,react_profile_stop,react_error_state]}
startedAt: 2026-11-19T09:01:50.941Z
endedAt: 2026-11-19T09:01:59.681Z
request: {budget:{fiberLimit:250,operationLimit:20000,timeLimitMs:8,targetOperationReserve:4000,targetTimeReserveMs:4,adaptive:true},settle:{quietMs:500,timeoutMs:10000},maxDurationMs:300000,allowOverrides:false}
# exit code: 0 (09:01:59Z UTC)
```

```console
$ agent-browser --session upd-h is visible '[role=toolbar][aria-label="Bulk actions"]'
true
# exit code: 0 (09:01:59Z UTC)
```

```console
$ git checkout -- src/layout/sidebar-nav.tsx && git status --short .

# exit code: 0 (09:01:59Z UTC)
```

### FIX REVERTED

