# Evidence: Select one row and all 100 redraw: the inline arrow that breaks PureComponent

- Article: apps/docs/content/docs/articles/one-click-redraws-100-rows.mdx
- Date: 2026-11-19
- Commit: 6867352ba46ec3998fe8cda0ba915536fddfa666 (`git rev-parse HEAD`); app fixes were applied from the answer key in evals/realworld/legacy, measured, and reverted with `git checkout -- src`. No app fix is committed.
- App: apps/realworld-legacy (Acme Tracker), dev server http://127.0.0.1:5211, standalone Genie hub ws://127.0.0.1:15212/__genie/ws
- Genie: genie-react and @genie-react/cli 1.0.2 built from this checkout (`pnpm install`, `pnpm build`)
- Driver: agent-browser 0.39.1, session `art-l1`
- Redaction: the absolute checkout path is replaced by `<repo>`. Nothing else is edited.

## Servers

Run from apps/realworld-legacy:

```bash
GENIE_HUB_PORT=15212 npx genie-react hub --port 15212
PORT=5211 GENIE_HUB_PORT=15212 pnpm exec webpack serve --mode development --port 5211
```

## Logging

Each command below is printed as `$ <command>` (shell-quoted with printf %q), followed by its full stdout and stderr and `[exit <code>]`. Lines starting with `#` are notes written during the run. Where a note says "jq summary", the lines that follow are jq projections of the JSON output printed directly above them. `node /tmp/art-l1/apply-fix.mjs <id>` applies the exact `referenceFix` edits from evals/realworld/legacy/<id>.json, and the `git diff` after it shows the change.

## Setup

```text

# setup

$ npx genie-react tools app_sign_in --session art-l1 
app_sign_in "Sign in"
description: "Signs the browser in through the real login thunk (default dana@acme.test). Every user's password is \"password\". Returns the signed-in user; navigate afterwards to reach a screen."
group: app.session
inputJsonSchema {$schema:https://json-schema.org/draft/2020-12/schema,type:object}: (arguments; name? is optional)
  email?: string default:dana@acme.test format:email pattern:"^(?:[A-Za-z0-9_'+\\-]+\\.)*[A-Za-z0-9_'+\\-]*[A-Za-z0-9_+-]@(?:[A-Za-z0-9][A-Za-z0-9\\-]*\\.)+[A-Za-z]{2,}$"
annotations: {readOnlyHint:false,idempotentHint:true}
output: outline (top-level fields; name? is optional)
  next: $ pnpm exec genie-react tools app_sign_in --output-schema --session baaaae42-4044-481c-b7cf-b4daf51a6cc5
[exit 0]

$ npx genie-react tools app_backend_reset --session art-l1 
app_backend_reset "Backend reset"
description: "Regenerates the mock backend from a seed and clears injected faults. Redux keeps what it already loaded, so reload the page afterwards. notificationPollMs sets how often the app polls notifications."
group: app.backend
inputJsonSchema {$schema:https://json-schema.org/draft/2020-12/schema,type:object}: (arguments; name? is optional)
  seed?: integer default:2019
  notificationPollMs?: integer default:15000 minimum:100 maximum:120000
annotations: {readOnlyHint:false,destructiveHint:true}
output: outline (top-level fields; name? is optional)
  next: $ pnpm exec genie-react tools app_backend_reset --output-schema --session baaaae42-4044-481c-b7cf-b4daf51a6cc5
[exit 0]

```

## issue-row-inline-handler

```text

# Sign in and open the issue table

$ npx genie-react call app_backend_reset \{\} --session art-l1 
seed: 2019
issues: 3240
notificationPollMs: 15000
[exit 0]

$ npx genie-react call app_sign_in \{\} --session art-l1 
user: {id:u-1,name:"Dana Whitfield",email:dana@acme.test,title:Designer,team:Infra}
[exit 0]

$ agent-browser --session art-l1 open http://127.0.0.1:5211/issues 
✓ Acme Tracker
  http://127.0.0.1:5211/issues
[exit 0]

$ npx genie-react status --wait 15000 --session art-l1 
selectedBridgeUrl: ws://127.0.0.1:15212/__genie/ws
sessionSelector:
  requested: art-l1
  source: flag
  resolvedSessionId: 1f2f04d3-2804-41a5-a981-04af2ded6b07
  implicit: false
  agentBrowser: {session:art-l1,via:selector,logicalSessionId:baaaae42-4044-481c-b7cf-b4daf51a6cc5}
connected: true
ready: true
sessionId: 1f2f04d3-2804-41a5-a981-04af2ded6b07
app: {name:"Acme Tracker",url:http://127.0.0.1:5211/issues,reactVersion:18.3.1,reactMounted:true}
domains: [session,react,memory,perf,timeline,redux,app]
toolCount: 61
sessions[1] (sessionId {fields}):
  1f2f04d3-2804-41a5-a981-04af2ded6b07 {logicalSessionId:baaaae42-4044-481c-b7cf-b4daf51a6cc5,documentGeneration:3,predecessorSessionId:0e102e5e-510b-415b-b7dc-e45a95ea360e,logicalSessionCollision:false,collisionWithSessionIds:[],app:{name:"Acme Tracker",url:http://127.0.0.1:5211/issues,reactVersion:18.3.1,reactMounted:true},domains:[session,react,memory,perf,timeline,redux,app],toolCount:61,connectedAt:1795060364237,ready:true,readyAt:1795060364237,current:true,origin:http://127.0.0.1:5211,originUnverified:true,runtimeVersion:1.0.2}
warnings: []
hub: {version:1.0.2,protocol:1}
[exit 0]

$ agent-browser --session art-l1 snapshot -i 
- generic "☰Acme TrackerSynced 0s agoNew issue🔔4DWBoardIssuesReportsSettingsProjectsCORECore PlatformWEBWeb Ap" [ref=e1] clickable [onclick]
  - button "Toggle sidebar" [ref=e2]
  - link "Acme Tracker" [ref=e3]
  - searchbox "Search issues" [ref=e12]
  - button "New issue" [ref=e4]
  - button "Notifications, 4 unread" [expanded=false, ref=e13]
  - button "Account" [expanded=false, ref=e14]
  - link "Board" [ref=e15]
  - link "Issues" [ref=e16]
  - link "Reports" [ref=e17]
  - link "Settings" [ref=e18]
  - heading "PROJECTS" [level=2, ref=e19]
  - link "CORE Core Platform" [ref=e784]
  - link "WEB Web App" [ref=e785]
  - link "MOB Mobile" [ref=e786]
  - link "OPS Operations" [ref=e787]
  - link "DATA Data Pipeline" [ref=e788]
  - link "SEC Security" [ref=e789]
  - link "DOCS Documentation" [ref=e790]
  - link "INFRA Infrastructure" [ref=e791]
  - heading "All issues" [level=1, ref=e5]
  - searchbox "Filter issues" [ref=e6]
  - combobox "Status" [expanded=false, ref=e7]: Any status
    - option "Any status" [selected, ref=e23]
    - option "Backlog" [ref=e24]
    - option "To do" [ref=e25]
    - option "In progress" [ref=e26]
    - option "In review" [ref=e27]
    - option "Done" [ref=e28]
  - combobox "Priority" [expanded=false, ref=e8]: Any priority
    - option "Any priority" [selected, ref=e29]
    - option "Urgent" [ref=e30]
    - option "High" [ref=e31]
    - option "Medium" [ref=e32]
    - option "Low" [ref=e33]
  - combobox "Assignee" [expanded=false, ref=e9]: Anyone
    - option "Anyone" [selected, ref=e34]
    - option "Unassigned" [ref=e35]
    - option "Dana Whitfield" [ref=e36]
    - option "Priya Raman" [ref=e37]
    - option "Marcus Okafor" [ref=e38]
    - option "Lena Brandt" [ref=e39]
    - option "Tomás Ruiz" [ref=e40]
    - option "Aiko Tanaka" [ref=e41]
    - option "Femi Adeyemi" [ref=e42]
    - option "Noor Haddad" [ref=e43]
    - option "Oskar Lindqvist" [ref=e44]
    - option "Rhea Kapoor" [ref=e45]
    - option "Jonah Mercer" [ref=e46]
    - option "Mei Chen" [ref=e47]
    - option "Kwame Mensah" [ref=e48]
    - option "Sofia Rossi" [ref=e49]
    - option "Idris Karimi" [ref=e50]
    - option "Hana Sato" [ref=e51]
    - option "Elliot Graves" [ref=e52]
    - option "Zara Malik" [ref=e53]
    - option "Mateo Herrera" [ref=e54]
    - option "Ines Duarte" [ref=e55]
    - option "Ravi Iyer" [ref=e56]
    - option "Greta Vogel" [ref=e57]
    - option "Sami Nasser" [ref=e58]
    - option "Talia Levi" [ref=e59]
    - option "Bruno Costa" [ref=e60]
    - option "Yuki Mori" [ref=e61]
    - option "Amara Eze" [ref=e62]
    - option "Felix Novak" [ref=e63]
    - option "Leila Farah" [ref=e64]
    - option "Owen Byrne" [ref=e65]
    - option "Nadia Petrova" [ref=e66]
    - option "Hugo Laurent" [ref=e67]
    - option "Chloe Dubois" [ref=e68]
    - option "Arjun Menon" [ref=e69]
    - option "Maya Ortiz" [ref=e70]
    - option "Theo Walsh" [ref=e71]
  - combobox "Project" [expanded=false, ref=e10]: All projects
    - option "All projects" [selected, ref=e72]
    - option "Core Platform" [ref=e73]
    - option "Web App" [ref=e74]
    - option "Mobile" [ref=e75]
    - option "Operations" [ref=e76]
    - option "Data Pipeline" [ref=e77]
    - option "Security" [ref=e78]
    - option "Documentation" [ref=e79]
    - option "Infrastructure" [ref=e80]
  - button "Reset" [ref=e11]
  - textbox "View name" [ref=e20]
  - button "Save view" [disabled, ref=e21]
  - columnheader "Key" [ref=e792]
    - button "Key" [ref=e998]
  - columnheader "Title" [ref=e793]
    - button "Title" [ref=e999]
  - columnheader "Status" [ref=e794]
    - button "Status" [ref=e1000]
  - columnheader "Priority" [ref=e795]
    - button "Priority" [ref=e1001]
  - columnheader "Assignee" [ref=e796]
  - columnheader "Updated ▼" [ref=e797]
    - button "Updated ▼" [ref=e1002]
  - cell "Select CORE-1" [ref=e81]
    - checkbox "Select CORE-1" [checked=false, ref=e798]
  - cell "CORE-1" [ref=e82]
  - cell "Migrate push notification opt-out" [ref=e83]
    - button "Migrate push notification opt-out" [ref=e799]
  - cell "Backlog" [ref=e84]
  - cell "Urgent" [ref=e85]
  - cell "Zara Malik" [ref=e86]
  - cell "just now" [ref=e87]
  - cell "Select CORE-27" [ref=e88]
    - checkbox "Select CORE-27" [checked=false, ref=e800]
  - cell "CORE-27" [ref=e89]
  - cell "Document cache invalidation" [ref=e90]
    - button "Document cache invalidation" [ref=e801]
  - cell "Backlog" [ref=e91]
  - cell "Urgent" [ref=e92]
  - cell "Theo Walsh" [ref=e93]
  - cell "just now" [ref=e94]
  - cell "Select CORE-37" [ref=e95]
    - checkbox "Select CORE-37" [checked=false, ref=e802]
  - cell "CORE-37" [ref=e96]
  - cell "Refactor keyboard navigation" [ref=e97]
    - button "Refactor keyboard navigation" [ref=e803]
  - cell "Backlog" [ref=e98]
  - cell "Medium" [ref=e99]
  - cell "Rhea Kapoor" [ref=e100]
  - cell "just now" [ref=e101]
  - cell "Select CORE-40" [ref=e102]
    - checkbox "Select CORE-40" [checked=false, ref=e804]
  - cell "CORE-40" [ref=e103]
  - cell "Remove timezone handling" [ref=e104]
    - button "Remove timezone handling" [ref=e805]
  - cell "To do" [ref=e105]
  - cell "Low" [ref=e106]
  - cell "Elliot Graves" [ref=e107]
  - cell "just now" [ref=e108]
  - cell "Select CORE-41" [ref=e109]
    - checkbox "Select CORE-41" [checked=false, ref=e806]
  - cell "CORE-41" [ref=e110]
  - cell "Add GDPR export" [ref=e111]
    - button "Add GDPR export" [ref=e807]
  - cell "In review" [ref=e112]
  - cell "Low" [ref=e113]
  - cell "Unassigned" [ref=e114]
  - cell "just now" [ref=e115]
  - cell "Select CORE-52" [ref=e116]
    - checkbox "Select CORE-52" [checked=false, ref=e808]
  - cell "CORE-52" [ref=e117]
  - cell "Refactor attachment previews" [ref=e118]
    - button "Refactor attachment previews" [ref=e809]
  - cell "In review" [ref=e119]
  - cell "High" [ref=e120]
  - cell "Lena Brandt" [ref=e121]
  - cell "just now" [ref=e122]
  - cell "Select CORE-87" [ref=e123]
    - checkbox "Select CORE-87" [checked=false, ref=e810]
  - cell "CORE-87" [ref=e124]
  - cell "Investigate Kafka consumer lag" [ref=e125]
    - button "Investigate Kafka consumer lag" [ref=e811]
  - cell "Backlog" [ref=e126]
  - cell "Medium" [ref=e127]
  - cell "Talia Levi" [ref=e128]
  - cell "just now" [ref=e129]
  - cell "Select CORE-94" [ref=e130]
    - checkbox "Select CORE-94" [checked=false, ref=e812]
  - cell "CORE-94" [ref=e131]
  - cell "Speed up push notification opt-out" [ref=e132]
    - button "Speed up push notification opt-out" [ref=e813]
  - cell "In review" [ref=e133]
  - cell "Low" [ref=e134]
  - cell "Marcus Okafor" [ref=e135]
  - cell "just now" [ref=e136]
  - cell "Select CORE-101" [ref=e137]
    - checkbox "Select CORE-101" [checked=false, ref=e814]
  - cell "CORE-101" [ref=e138]
  - cell "Refactor feature flag cleanup" [ref=e139]
    - button "Refactor feature flag cleanup" [ref=e815]
  - cell "In progress" [ref=e140]
  - cell "Low" [ref=e141]
  - cell "Mateo Herrera" [ref=e142]
  - cell "just now" [ref=e143]
  - cell "Select CORE-107" [ref=e144]
    - checkbox "Select CORE-107" [checked=false, ref=e816]
  - cell "CORE-107" [ref=e145]
  - cell "Investigate session timeout warning" [ref=e146]
    - button "Investigate session timeout warning" [ref=e817]
  - cell "To do" [ref=e147]
  - cell "Urgent" [ref=e148]
  - cell "Zara Malik" [ref=e149]
  - cell "just now" [ref=e150]
  - cell "Select CORE-115" [ref=e151]
    - checkbox "Select CORE-115" [checked=false, ref=e818]
  - cell "CORE-115" [ref=e152]
  - cell "Fix dark mode contrast" [ref=e153]
    - button "Fix dark mode contrast" [ref=e819]
  - cell "To do" [ref=e154]
  - cell "Urgent" [ref=e155]
  - cell "Unassigned" [ref=e156]
  - cell "just now" [ref=e157]
  - cell "Select CORE-127" [ref=e158]
    - checkbox "Select CORE-127" [checked=false, ref=e820]
  - cell "CORE-127" [ref=e159]
  - cell "Add push notification opt-out" [ref=e160]
    - button "Add push notification opt-out" [ref=e821]
  - cell "In progress" [ref=e161]
  - cell "High" [ref=e162]
  - cell "Yuki Mori" [ref=e163]
  - cell "just now" [ref=e164]
  - cell "Select CORE-144" [ref=e165]
    - checkbox "Select CORE-144" [checked=false, ref=e822]
  - cell "CORE-144" [ref=e166]
  - cell "Speed up billing email template" [ref=e167]
    - button "Speed up billing email template" [ref=e823]
  - cell "In progress" [ref=e168]
  - cell "High" [ref=e169]
  - cell "Unassigned" [ref=e170]
  - cell "just now" [ref=e171]
  - cell "Select CORE-149" [ref=e172]
    - checkbox "Select CORE-149" [checked=false, ref=e824]
  - cell "CORE-149" [ref=e173]
  - cell "Speed up password reset throttling" [ref=e174]
    - button "Speed up password reset throttling" [ref=e825]
  - cell "Backlog" [ref=e175]
  - cell "High" [ref=e176]
  - cell "Unassigned" [ref=e177]
  - cell "just now" [ref=e178]
  - cell "Select CORE-167" [ref=e179]
    - checkbox "Select CORE-167" [checked=false, ref=e826]
  - cell "CORE-167" [ref=e180]
  - cell "Speed up attachment previews" [ref=e181]
    - button "Speed up attachment previews" [ref=e827]
  - cell "In progress" [ref=e182]
  - cell "Medium" [ref=e183]
  - cell "Mei Chen" [ref=e184]
  - cell "just now" [ref=e185]
  - cell "Select CORE-169" [ref=e186]
    - checkbox "Select CORE-169" [checked=false, ref=e828]
  - cell "CORE-169" [ref=e187]
  - cell "Investigate dark mode contrast" [ref=e188]
    - button "Investigate dark mode contrast" [ref=e829]
  - cell "To do" [ref=e189]
  - cell "Low" [ref=e190]
  - cell "Aiko Tanaka" [ref=e191]
  - cell "just now" [ref=e192]
  - cell "Select CORE-206" [ref=e193]
    - checkbox "Select CORE-206" [checked=false, ref=e830]
  - cell "CORE-206" [ref=e194]
  - cell "Migrate avatar upload" [ref=e195]
    - button "Migrate avatar upload" [ref=e831]
  - cell "Backlog" [ref=e196]
  - cell "Low" [ref=e197]
  - cell "Unassigned" [ref=e198]
  - cell "just now" [ref=e199]
  - cell "Select CORE-235" [ref=e200]
    - checkbox "Select CORE-235" [checked=false, ref=e832]
  - cell "CORE-235" [ref=e201]
  - cell "Add feature flag cleanup" [ref=e202]
    - button "Add feature flag cleanup" [ref=e833]
  - cell "In review" [ref=e203]
  - cell "Urgent" [ref=e204]
  - cell "Sami Nasser" [ref=e205]
  - cell "just now" [ref=e206]
  - cell "Select CORE-238" [ref=e207]
    - checkbox "Select CORE-238" [checked=false, ref=e834]
  - cell "CORE-238" [ref=e208]
  - cell "Investigate report scheduler" [ref=e209]
    - button "Investigate report scheduler" [ref=e835]
  - cell "To do" [ref=e210]
  - cell "Low" [ref=e211]
  - cell "Unassigned" [ref=e212]
  - cell "just now" [ref=e213]
  - cell "Select CORE-239" [ref=e214]
    - checkbox "Select CORE-239" [checked=false, ref=e836]
  - cell "CORE-239" [ref=e215]
  - cell "Remove session timeout warning" [ref=e216]
    - button "Remove session timeout warning" [ref=e837]
  - cell "Backlog" [ref=e217]
  - cell "Urgent" [ref=e218]
  - cell "Femi Adeyemi" [ref=e219]
  - cell "just now" [ref=e220]
  - cell "Select CORE-258" [ref=e221]
    - checkbox "Select CORE-258" [checked=false, ref=e838]
  - cell "CORE-258" [ref=e222]
  - cell "Refactor deploy pipeline caching" [ref=e223]
    - button "Refactor deploy pipeline caching" [ref=e839]
  - cell "In review" [ref=e224]
  - cell "Medium" [ref=e225]
  - cell "Unassigned" [ref=e226]
  - cell "just now" [ref=e227]
  - cell "Select CORE-265" [ref=e228]
    - checkbox "Select CORE-265" [checked=false, ref=e840]
  - cell "CORE-265" [ref=e229]
  - cell "Migrate rate limiter headers" [ref=e230]
    - button "Migrate rate limiter headers" [ref=e841]
  - cell "To do" [ref=e231]
  - cell "Medium" [ref=e232]
  - cell "Bruno Costa" [ref=e233]
  - cell "just now" [ref=e234]
  - cell "Select CORE-277" [ref=e235]
    - checkbox "Select CORE-277" [checked=false, ref=e842]
  - cell "CORE-277" [ref=e236]
  - cell "Remove database connection pool" [ref=e237]
    - button "Remove database connection pool" [ref=e843]
  - cell "In progress" [ref=e238]
  - cell "Medium" [ref=e239]
  - cell "Chloe Dubois" [ref=e240]
  - cell "just now" [ref=e241]
  - cell "Select CORE-280" [ref=e242]
    - checkbox "Select CORE-280" [checked=false, ref=e844]
  - cell "CORE-280" [ref=e243]
  - cell "Investigate error page copy" [ref=e244]
    - button "Investigate error page copy" [ref=e845]
  - cell "To do" [ref=e245]
  - cell "Medium" [ref=e246]
  - cell "Tomás Ruiz" [ref=e247]
  - cell "just now" [ref=e248]
  - cell "Select CORE-290" [ref=e249]
    - checkbox "Select CORE-290" [checked=false, ref=e846]
  - cell "CORE-290" [ref=e250]
  - cell "Document CSV import validation" [ref=e251]
    - button "Document CSV import validation" [ref=e847]
  - cell "To do" [ref=e252]
  - cell "High" [ref=e253]
  - cell "Lena Brandt" [ref=e254]
  - cell "just now" [ref=e255]
  - cell "Select CORE-311" [ref=e256]
    - checkbox "Select CORE-311" [checked=false, ref=e848]
  - cell "CORE-311" [ref=e257]
  - cell "Migrate error page copy" [ref=e258]
    - button "Migrate error page copy" [ref=e849]
  - cell "Backlog" [ref=e259]
  - cell "High" [ref=e260]
  - cell "Ravi Iyer" [ref=e261]
  - cell "just now" [ref=e262]
  - cell "Select CORE-321" [ref=e263]
    - checkbox "Select CORE-321" [checked=false, ref=e850]
  - cell "CORE-321" [ref=e264]
  - cell "Fix attachment previews" [ref=e265]
    - button "Fix attachment previews" [ref=e851]
  - cell "To do" [ref=e266]
  - cell "High" [ref=e267]
  - cell "Felix Novak" [ref=e268]
  - cell "just now" [ref=e269]
  - cell "Select CORE-334" [ref=e270]
    - checkbox "Select CORE-334" [checked=false, ref=e852]
  - cell "CORE-334" [ref=e271]
  - cell "Document onboarding checklist" [ref=e272]
    - button "Document onboarding checklist" [ref=e853]
  - cell "Backlog" [ref=e273]
  - cell "Medium" [ref=e274]
  - cell "Aiko Tanaka" [ref=e275]
  - cell "just now" [ref=e276]
  - cell "Select CORE-347" [ref=e277]
    - checkbox "Select CORE-347" [checked=false, ref=e854]
  - cell "CORE-347" [ref=e278]
  - cell "Investigate error page copy" [ref=e279]
    - button "Investigate error page copy" [ref=e855]
  - cell "In progress" [ref=e280]
  - cell "Medium" [ref=e281]
  - cell "Maya Ortiz" [ref=e282]
  - cell "just now" [ref=e283]
  - cell "Select CORE-350" [ref=e284]
    - checkbox "Select CORE-350" [checked=false, ref=e856]
  - cell "CORE-350" [ref=e285]
  - cell "Document API key rotation" [ref=e286]
    - button "Document API key rotation" [ref=e857]
  - cell "Backlog" [ref=e287]
  - cell "Low" [ref=e288]
  - cell "Kwame Mensah" [ref=e289]
  - cell "just now" [ref=e290]
  - cell "Select CORE-360" [ref=e291]
    - checkbox "Select CORE-360" [checked=false, ref=e858]
  - cell "CORE-360" [ref=e292]
  - cell "Remove timezone handling" [ref=e293]
    - button "Remove timezone handling" [ref=e859]
  - cell "In progress" [ref=e294]
  - cell "High" [ref=e295]
  - cell "Unassigned" [ref=e296]
  - cell "just now" [ref=e297]
  - cell "Select CORE-362" [ref=e298]
    - checkbox "Select CORE-362" [checked=false, ref=e860]
  - cell "CORE-362" [ref=e299]
  - cell "Migrate SSO metadata refresh" [ref=e300]
    - button "Migrate SSO metadata refresh" [ref=e861]
  - cell "Backlog" [ref=e301]
  - cell "High" [ref=e302]
  - cell "Jonah Mercer" [ref=e303]
  - cell "just now" [ref=e304]
  - cell "Select CORE-368" [ref=e305]
    - checkbox "Select CORE-368" [checked=false, ref=e862]
  - cell "CORE-368" [ref=e306]
  - cell "Fix GDPR export" [ref=e307]
    - button "Fix GDPR export" [ref=e863]
  - cell "Backlog" [ref=e308]
  - cell "High" [ref=e309]
  - cell "Bruno Costa" [ref=e310]
  - cell "just now" [ref=e311]
  - cell "Select CORE-369" [ref=e312]
    - checkbox "Select CORE-369" [checked=false, ref=e864]
  - cell "CORE-369" [ref=e313]
  - cell "Fix search ranking" [ref=e314]
    - button "Fix search ranking" [ref=e865]
  - cell "To do" [ref=e315]
  - cell "Medium" [ref=e316]
  - cell "Zara Malik" [ref=e317]
  - cell "just now" [ref=e318]
  - cell "Select CORE-385" [ref=e319]
    - checkbox "Select CORE-385" [checked=false, ref=e866]
  - cell "CORE-385" [ref=e320]
  - cell "Refactor API key rotation" [ref=e321]
    - button "Refactor API key rotation" [ref=e867]
  - cell "In progress" [ref=e322]
  - cell "Low" [ref=e323]
  - cell "Zara Malik" [ref=e324]
  - cell "just now" [ref=e325]
  - cell "Select CORE-399" [ref=e326]
    - checkbox "Select CORE-399" [checked=false, ref=e868]
  - cell "CORE-399" [ref=e327]
  - cell "Investigate webhook retries" [ref=e328]
    - button "Investigate webhook retries" [ref=e869]
  - cell "To do" [ref=e329]
  - cell "Medium" [ref=e330]
  - cell "Lena Brandt" [ref=e331]
  - cell "just now" [ref=e332]
  - cell "Select CORE-420" [ref=e333]
    - checkbox "Select CORE-420" [checked=false, ref=e870]
  - cell "CORE-420" [ref=e334]
  - cell "Migrate Kafka consumer lag" [ref=e335]
    - button "Migrate Kafka consumer lag" [ref=e871]
  - cell "To do" [ref=e336]
  - cell "High" [ref=e337]
  - cell "Elliot Graves" [ref=e338]
  - cell "just now" [ref=e339]
  - cell "Select WEB-7" [ref=e340]
    - checkbox "Select WEB-7" [checked=false, ref=e872]
  - cell "WEB-7" [ref=e341]
  - cell "Speed up SSO metadata refresh" [ref=e342]
    - button "Speed up SSO metadata refresh" [ref=e873]
  - cell "In review" [ref=e343]
  - cell "Medium" [ref=e344]
  - cell "Lena Brandt" [ref=e345]
  - cell "just now" [ref=e346]
  - cell "Select WEB-24" [ref=e347]
    - checkbox "Select WEB-24" [checked=false, ref=e874]
  - cell "WEB-24" [ref=e348]
  - cell "Fix rate limiter headers" [ref=e349]
    - button "Fix rate limiter headers" [ref=e875]
  - cell "To do" [ref=e350]
  - cell "Medium" [ref=e351]
  - cell "Marcus Okafor" [ref=e352]
  - cell "just now" [ref=e353]
  - cell "Select WEB-78" [ref=e354]
    - checkbox "Select WEB-78" [checked=false, ref=e876]
  - cell "WEB-78" [ref=e355]
  - cell "Speed up search ranking" [ref=e356]
    - button "Speed up search ranking" [ref=e877]
  - cell "In progress" [ref=e357]
  - cell "Medium" [ref=e358]
  - cell "Unassigned" [ref=e359]
  - cell "just now" [ref=e360]
  - cell "Select WEB-79" [ref=e361]
    - checkbox "Select WEB-79" [checked=false, ref=e878]
  - cell "WEB-79" [ref=e362]
  - cell "Investigate API key rotation" [ref=e363]
    - button "Investigate API key rotation" [ref=e879]
  - cell "In review" [ref=e364]
  - cell "Low" [ref=e365]
  - cell "Ines Duarte" [ref=e366]
  - cell "just now" [ref=e367]
  - cell "Select WEB-111" [ref=e368]
    - checkbox "Select WEB-111" [checked=false, ref=e880]
  - cell "WEB-111" [ref=e369]
  - cell "Migrate feature flag cleanup" [ref=e370]
    - button "Migrate feature flag cleanup" [ref=e881]
  - cell "To do" [ref=e371]
  - cell "Medium" [ref=e372]
  - cell "Owen Byrne" [ref=e373]
  - cell "just now" [ref=e374]
  - cell "Select WEB-137" [ref=e375]
    - checkbox "Select WEB-137" [checked=false, ref=e882]
  - cell "WEB-137" [ref=e376]
  - cell "Add SSO metadata refresh" [ref=e377]
    - button "Add SSO metadata refresh" [ref=e883]
  - cell "Backlog" [ref=e378]
  - cell "Urgent" [ref=e379]
  - cell "Mei Chen" [ref=e380]
  - cell "just now" [ref=e381]
  - cell "Select WEB-157" [ref=e382]
    - checkbox "Select WEB-157" [checked=false, ref=e884]
  - cell "WEB-157" [ref=e383]
  - cell "Speed up dashboard filters" [ref=e384]
    - button "Speed up dashboard filters" [ref=e885]
  - cell "Backlog" [ref=e385]
  - cell "Low" [ref=e386]
  - cell "Idris Karimi" [ref=e387]
  - cell "just now" [ref=e388]
  - cell "Select WEB-164" [ref=e389]
    - checkbox "Select WEB-164" [checked=false, ref=e886]
  - cell "WEB-164" [ref=e390]
  - cell "Document onboarding checklist" [ref=e391]
    - button "Document onboarding checklist" [ref=e887]
  - cell "Backlog" [ref=e392]
  - cell "Low" [ref=e393]
  - cell "Ines Duarte" [ref=e394]
  - cell "just now" [ref=e395]
  - cell "Select WEB-177" [ref=e396]
    - checkbox "Select WEB-177" [checked=false, ref=e888]
  - cell "WEB-177" [ref=e397]
  - cell "Document timezone handling" [ref=e398]
    - button "Document timezone handling" [ref=e889]
  - cell "In progress" [ref=e399]
  - cell "High" [ref=e400]
  - cell "Unassigned" [ref=e401]
  - cell "just now" [ref=e402]
  - cell "Select WEB-193" [ref=e403]
    - checkbox "Select WEB-193" [checked=false, ref=e890]
  - cell "WEB-193" [ref=e404]
  - cell "Fix timezone handling" [ref=e405]
    - button "Fix timezone handling" [ref=e891]
  - cell "In progress" [ref=e406]
  - cell "Medium" [ref=e407]
  - cell "Leila Farah" [ref=e408]
  - cell "just now" [ref=e409]
  - cell "Select WEB-196" [ref=e410]
    - checkbox "Select WEB-196" [checked=false, ref=e892]
  - cell "WEB-196" [ref=e411]
  - cell "Fix password reset throttling" [ref=e412]
    - button "Fix password reset throttling" [ref=e893]
  - cell "In review" [ref=e413]
  - cell "Medium" [ref=e414]
  - cell "Noor Haddad" [ref=e415]
  - cell "just now" [ref=e416]
  - cell "Select WEB-215" [ref=e417]
    - checkbox "Select WEB-215" [checked=false, ref=e894]
  - cell "WEB-215" [ref=e418]
  - cell "Speed up Kafka consumer lag" [ref=e419]
    - button "Speed up Kafka consumer lag" [ref=e895]
  - cell "In review" [ref=e420]
  - cell "Low" [ref=e421]
  - cell "Unassigned" [ref=e422]
  - cell "just now" [ref=e423]
  - cell "Select WEB-293" [ref=e424]
    - checkbox "Select WEB-293" [checked=false, ref=e896]
  - cell "WEB-293" [ref=e425]
  - cell "Add rate limiter headers" [ref=e426]
    - button "Add rate limiter headers" [ref=e897]
  - cell "Backlog" [ref=e427]
  - cell "Low" [ref=e428]
  - cell "Mei Chen" [ref=e429]
  - cell "just now" [ref=e430]
  - cell "Select WEB-295" [ref=e431]
    - checkbox "Select WEB-295" [checked=false, ref=e898]
  - cell "WEB-295" [ref=e432]
  - cell "Migrate dashboard filters" [ref=e433]
    - button "Migrate dashboard filters" [ref=e899]
  - cell "To do" [ref=e434]
  - cell "Low" [ref=e435]
  - cell "Yuki Mori" [ref=e436]
  - cell "just now" [ref=e437]
  - cell "Select WEB-305" [ref=e438]
    - checkbox "Select WEB-305" [checked=false, ref=e900]
  - cell "WEB-305" [ref=e439]
  - cell "Migrate SSO metadata refresh" [ref=e440]
    - button "Migrate SSO metadata refresh" [ref=e901]
  - cell "In review" [ref=e441]
  - cell "Low" [ref=e442]
  - cell "Bruno Costa" [ref=e443]
  - cell "just now" [ref=e444]
  - cell "Select WEB-307" [ref=e445]
    - checkbox "Select WEB-307" [checked=false, ref=e902]
  - cell "WEB-307" [ref=e446]
  - cell "Fix attachment previews" [ref=e447]
    - button "Fix attachment previews" [ref=e903]
  - cell "To do" [ref=e448]
  - cell "High" [ref=e449]
  - cell "Theo Walsh" [ref=e450]
  - cell "just now" [ref=e451]
  - cell "Select WEB-308" [ref=e452]
    - checkbox "Select WEB-308" [checked=false, ref=e904]
  - cell "WEB-308" [ref=e453]
  - cell "Investigate push notification opt-out" [ref=e454]
    - button "Investigate push notification opt-out" [ref=e905]
  - cell "Backlog" [ref=e455]
  - cell "Low" [ref=e456]
  - cell "Kwame Mensah" [ref=e457]
  - cell "just now" [ref=e458]
  - cell "Select WEB-316" [ref=e459]
    - checkbox "Select WEB-316" [checked=false, ref=e906]
  - cell "WEB-316" [ref=e460]
  - cell "Remove GDPR export" [ref=e461]
    - button "Remove GDPR export" [ref=e907]
  - cell "In review" [ref=e462]
  - cell "Low" [ref=e463]
  - cell "Leila Farah" [ref=e464]
  - cell "just now" [ref=e465]
  - cell "Select WEB-349" [ref=e466]
    - checkbox "Select WEB-349" [checked=false, ref=e908]
  - cell "WEB-349" [ref=e467]
  - cell "Fix avatar upload" [ref=e468]
    - button "Fix avatar upload" [ref=e909]
  - cell "In progress" [ref=e469]
  - cell "High" [ref=e470]
  - cell "Ines Duarte" [ref=e471]
  - cell "just now" [ref=e472]
  - cell "Select WEB-375" [ref=e473]
    - checkbox "Select WEB-375" [checked=false, ref=e910]
  - cell "WEB-375" [ref=e474]
  - cell "Remove deploy pipeline caching" [ref=e475]
    - button "Remove deploy pipeline caching" [ref=e911]
  - cell "To do" [ref=e476]
  - cell "High" [ref=e477]
  - cell "Unassigned" [ref=e478]
  - cell "just now" [ref=e479]
  - cell "Select WEB-393" [ref=e480]
    - checkbox "Select WEB-393" [checked=false, ref=e912]
  - cell "WEB-393" [ref=e481]
  - cell "Document feature flag cleanup" [ref=e482]
    - button "Document feature flag cleanup" [ref=e913]
  - cell "In progress" [ref=e483]
  - cell "Urgent" [ref=e484]
  - cell "Elliot Graves" [ref=e485]
  - cell "just now" [ref=e486]
  - cell "Select WEB-395" [ref=e487]
    - checkbox "Select WEB-395" [checked=false, ref=e914]
  - cell "WEB-395" [ref=e488]
  - cell "Speed up invoice export" [ref=e489]
    - button "Speed up invoice export" [ref=e915]
  - cell "Backlog" [ref=e490]
  - cell "High" [ref=e491]
  - cell "Hugo Laurent" [ref=e492]
  - cell "just now" [ref=e493]
  - cell "Select WEB-449" [ref=e494]
    - checkbox "Select WEB-449" [checked=false, ref=e916]
  - cell "WEB-449" [ref=e495]
  - cell "Add login redirect loop" [ref=e496]
    - button "Add login redirect loop" [ref=e917]
  - cell "Backlog" [ref=e497]
  - cell "Medium" [ref=e498]
  - cell "Idris Karimi" [ref=e499]
  - cell "just now" [ref=e500]
  - cell "Select WEB-454" [ref=e501]
    - checkbox "Select WEB-454" [checked=false, ref=e918]
  - cell "WEB-454" [ref=e502]
  - cell "Investigate search ranking" [ref=e503]
    - button "Investigate search ranking" [ref=e919]
  - cell "To do" [ref=e504]
  - cell "Urgent" [ref=e505]
  - cell "Ravi Iyer" [ref=e506]
  - cell "just now" [ref=e507]
  - cell "Select WEB-457" [ref=e508]
    - checkbox "Select WEB-457" [checked=false, ref=e920]
  - cell "WEB-457" [ref=e509]
  - cell "Add dashboard filters" [ref=e510]
    - button "Add dashboard filters" [ref=e921]
  - cell "In progress" [ref=e511]
  - cell "High" [ref=e512]
  - cell "Noor Haddad" [ref=e513]
  - cell "just now" [ref=e514]
  - cell "Select WEB-480" [ref=e515]
    - checkbox "Select WEB-480" [checked=false, ref=e922]
  - cell "WEB-480" [ref=e516]
  - cell "Migrate avatar upload" [ref=e517]
    - button "Migrate avatar upload" [ref=e923]
  - cell "In progress" [ref=e518]
  - cell "High" [ref=e519]
  - cell "Jonah Mercer" [ref=e520]
  - cell "just now" [ref=e521]
  - cell "Select WEB-491" [ref=e522]
    - checkbox "Select WEB-491" [checked=false, ref=e924]
  - cell "WEB-491" [ref=e523]
  - cell "Fix SSO metadata refresh" [ref=e524]
    - button "Fix SSO metadata refresh" [ref=e925]
  - cell "Backlog" [ref=e525]
  - cell "Low" [ref=e526]
  - cell "Noor Haddad" [ref=e527]
  - cell "just now" [ref=e528]
  - cell "Select WEB-503" [ref=e529]
    - checkbox "Select WEB-503" [checked=false, ref=e926]
  - cell "WEB-503" [ref=e530]
  - cell "Fix avatar upload" [ref=e531]
    - button "Fix avatar upload" [ref=e927]
  - cell "Backlog" [ref=e532]
  - cell "Low" [ref=e533]
  - cell "Felix Novak" [ref=e534]
  - cell "just now" [ref=e535]
  - cell "Select WEB-507" [ref=e536]
    - checkbox "Select WEB-507" [checked=false, ref=e928]
  - cell "WEB-507" [ref=e537]
  - cell "Fix audit log pagination" [ref=e538]
    - button "Fix audit log pagination" [ref=e929]
  - cell "Backlog" [ref=e539]
  - cell "High" [ref=e540]
  - cell "Elliot Graves" [ref=e541]
  - cell "just now" [ref=e542]
  - cell "Select MOB-26" [ref=e543]
    - checkbox "Select MOB-26" [checked=false, ref=e930]
  - cell "MOB-26" [ref=e544]
  - cell "Migrate keyboard navigation" [ref=e545]
    - button "Migrate keyboard navigation" [ref=e931]
  - cell "In progress" [ref=e546]
  - cell "Low" [ref=e547]
  - cell "Unassigned" [ref=e548]
  - cell "just now" [ref=e549]
  - cell "Select MOB-32" [ref=e550]
    - checkbox "Select MOB-32" [checked=false, ref=e932]
  - cell "MOB-32" [ref=e551]
  - cell "Document audit log pagination" [ref=e552]
    - button "Document audit log pagination" [ref=e933]
  - cell "Backlog" [ref=e553]
  - cell "Low" [ref=e554]
  - cell "Idris Karimi" [ref=e555]
  - cell "just now" [ref=e556]
  - cell "Select MOB-52" [ref=e557]
    - checkbox "Select MOB-52" [checked=false, ref=e934]
  - cell "MOB-52" [ref=e558]
  - cell "Document database connection pool" [ref=e559]
    - button "Document database connection pool" [ref=e935]
  - cell "Backlog" [ref=e560]
  - cell "Medium" [ref=e561]
  - cell "Nadia Petrova" [ref=e562]
  - cell "just now" [ref=e563]
  - cell "Select MOB-124" [ref=e564]
    - checkbox "Select MOB-124" [checked=false, ref=e936]
  - cell "MOB-124" [ref=e565]
  - cell "Investigate cache invalidation" [ref=e566]
    - button "Investigate cache invalidation" [ref=e937]
  - cell "Backlog" [ref=e567]
  - cell "High" [ref=e568]
  - cell "Nadia Petrova" [ref=e569]
  - cell "just now" [ref=e570]
  - cell "Select MOB-155" [ref=e571]
    - checkbox "Select MOB-155" [checked=false, ref=e938]
  - cell "MOB-155" [ref=e572]
  - cell "Migrate error page copy" [ref=e573]
    - button "Migrate error page copy" [ref=e939]
  - cell "Backlog" [ref=e574]
  - cell "High" [ref=e575]
  - cell "Femi Adeyemi" [ref=e576]
  - cell "just now" [ref=e577]
  - cell "Select MOB-184" [ref=e578]
    - checkbox "Select MOB-184" [checked=false, ref=e940]
  - cell "MOB-184" [ref=e579]
  - cell "Add CSV import validation" [ref=e580]
    - button "Add CSV import validation" [ref=e941]
  - cell "To do" [ref=e581]
  - cell "Medium" [ref=e582]
  - cell "Idris Karimi" [ref=e583]
  - cell "just now" [ref=e584]
  - cell "Select MOB-191" [ref=e585]
    - checkbox "Select MOB-191" [checked=false, ref=e942]
  - cell "MOB-191" [ref=e586]
  - cell "Migrate SSO metadata refresh" [ref=e587]
    - button "Migrate SSO metadata refresh" [ref=e943]
  - cell "Backlog" [ref=e588]
  - cell "Low" [ref=e589]
  - cell "Priya Raman" [ref=e590]
  - cell "just now" [ref=e591]
  - cell "Select MOB-203" [ref=e592]
    - checkbox "Select MOB-203" [checked=false, ref=e944]
  - cell "MOB-203" [ref=e593]
  - cell "Migrate webhook retries" [ref=e594]
    - button "Migrate webhook retries" [ref=e945]
  - cell "In progress" [ref=e595]
  - cell "Medium" [ref=e596]
  - cell "Noor Haddad" [ref=e597]
  - cell "just now" [ref=e598]
  - cell "Select MOB-247" [ref=e599]
    - checkbox "Select MOB-247" [checked=false, ref=e946]
  - cell "MOB-247" [ref=e600]
  - cell "Add dashboard filters" [ref=e601]
    - button "Add dashboard filters" [ref=e947]
  - cell "Backlog" [ref=e602]
  - cell "Medium" [ref=e603]
  - cell "Unassigned" [ref=e604]
  - cell "just now" [ref=e605]
  - cell "Select MOB-272" [ref=e606]
    - checkbox "Select MOB-272" [checked=false, ref=e948]
  - cell "MOB-272" [ref=e607]
  - cell "Migrate attachment previews" [ref=e608]
    - button "Migrate attachment previews" [ref=e949]
  - cell "In progress" [ref=e609]
  - cell "Urgent" [ref=e610]
  - cell "Unassigned" [ref=e611]
  - cell "just now" [ref=e612]
  - cell "Select MOB-277" [ref=e613]
    - checkbox "Select MOB-277" [checked=false, ref=e950]
  - cell "MOB-277" [ref=e614]
  - cell "Fix audit log pagination" [ref=e615]
    - button "Fix audit log pagination" [ref=e951]
  - cell "To do" [ref=e616]
  - cell "High" [ref=e617]
  - cell "Tomás Ruiz" [ref=e618]
  - cell "just now" [ref=e619]
  - cell "Select MOB-305" [ref=e620]
    - checkbox "Select MOB-305" [checked=false, ref=e952]
  - cell "MOB-305" [ref=e621]
  - cell "Speed up GDPR export" [ref=e622]
    - button "Speed up GDPR export" [ref=e953]
  - cell "In progress" [ref=e623]
  - cell "Low" [ref=e624]
  - cell "Amara Eze" [ref=e625]
  - cell "just now" [ref=e626]
  - cell "Select MOB-322" [ref=e627]
    - checkbox "Select MOB-322" [checked=false, ref=e954]
  - cell "MOB-322" [ref=e628]
  - cell "Add keyboard navigation" [ref=e629]
    - button "Add keyboard navigation" [ref=e955]
  - cell "To do" [ref=e630]
  - cell "Urgent" [ref=e631]
  - cell "Aiko Tanaka" [ref=e632]
  - cell "just now" [ref=e633]
  - cell "Select MOB-328" [ref=e634]
    - checkbox "Select MOB-328" [checked=false, ref=e956]
  - cell "MOB-328" [ref=e635]
  - cell "Fix cache invalidation" [ref=e636]
    - button "Fix cache invalidation" [ref=e957]
  - cell "In progress" [ref=e637]
  - cell "High" [ref=e638]
  - cell "Greta Vogel" [ref=e639]
  - cell "just now" [ref=e640]
  - cell "Select MOB-415" [ref=e641]
    - checkbox "Select MOB-415" [checked=false, ref=e958]
  - cell "MOB-415" [ref=e642]
  - cell "Fix Kafka consumer lag" [ref=e643]
    - button "Fix Kafka consumer lag" [ref=e959]
  - cell "To do" [ref=e644]
  - cell "Low" [ref=e645]
  - cell "Aiko Tanaka" [ref=e646]
  - cell "just now" [ref=e647]
  - cell "Select MOB-416" [ref=e648]
    - checkbox "Select MOB-416" [checked=false, ref=e960]
  - cell "MOB-416" [ref=e649]
  - cell "Document avatar upload" [ref=e650]
    - button "Document avatar upload" [ref=e961]
  - cell "In progress" [ref=e651]
  - cell "High" [ref=e652]
  - cell "Maya Ortiz" [ref=e653]
  - cell "just now" [ref=e654]
  - cell "Select MOB-423" [ref=e655]
    - checkbox "Select MOB-423" [checked=false, ref=e962]
  - cell "MOB-423" [ref=e656]
  - cell "Migrate Kafka consumer lag" [ref=e657]
    - button "Migrate Kafka consumer lag" [ref=e963]
  - cell "In progress" [ref=e658]
  - cell "Low" [ref=e659]
  - cell "Elliot Graves" [ref=e660]
  - cell "just now" [ref=e661]
  - cell "Select MOB-438" [ref=e662]
    - checkbox "Select MOB-438" [checked=false, ref=e964]
  - cell "MOB-438" [ref=e663]
  - cell "Migrate feature flag cleanup" [ref=e664]
    - button "Migrate feature flag cleanup" [ref=e965]
  - cell "Backlog" [ref=e665]
  - cell "Low" [ref=e666]
  - cell "Elliot Graves" [ref=e667]
  - cell "just now" [ref=e668]
  - cell "Select MOB-443" [ref=e669]
    - checkbox "Select MOB-443" [checked=false, ref=e966]
  - cell "MOB-443" [ref=e670]
  - cell "Migrate avatar upload" [ref=e671]
    - button "Migrate avatar upload" [ref=e967]
  - cell "In review" [ref=e672]
  - cell "Medium" [ref=e673]
  - cell "Bruno Costa" [ref=e674]
  - cell "just now" [ref=e675]
  - cell "Select MOB-462" [ref=e676]
    - checkbox "Select MOB-462" [checked=false, ref=e968]
  - cell "MOB-462" [ref=e677]
  - cell "Refactor GDPR export" [ref=e678]
    - button "Refactor GDPR export" [ref=e969]
  - cell "Backlog" [ref=e679]
  - cell "Medium" [ref=e680]
  - cell "Unassigned" [ref=e681]
  - cell "just now" [ref=e682]
  - cell "Select OPS-33" [ref=e683]
    - checkbox "Select OPS-33" [checked=false, ref=e970]
  - cell "OPS-33" [ref=e684]
  - cell "Remove GDPR export" [ref=e685]
    - button "Remove GDPR export" [ref=e971]
  - cell "In progress" [ref=e686]
  - cell "High" [ref=e687]
  - cell "Amara Eze" [ref=e688]
  - cell "just now" [ref=e689]
  - cell "Select OPS-41" [ref=e690]
    - checkbox "Select OPS-41" [checked=false, ref=e972]
  - cell "OPS-41" [ref=e691]
  - cell "Document CSV import validation" [ref=e692]
    - button "Document CSV import validation" [ref=e973]
  - cell "Backlog" [ref=e693]
  - cell "Urgent" [ref=e694]
  - cell "Greta Vogel" [ref=e695]
  - cell "just now" [ref=e696]
  - cell "Select OPS-67" [ref=e697]
    - checkbox "Select OPS-67" [checked=false, ref=e974]
  - cell "OPS-67" [ref=e698]
  - cell "Add mobile deep links" [ref=e699]
    - button "Add mobile deep links" [ref=e975]
  - cell "In progress" [ref=e700]
  - cell "Low" [ref=e701]
  - cell "Zara Malik" [ref=e702]
  - cell "just now" [ref=e703]
  - cell "Select OPS-82" [ref=e704]
    - checkbox "Select OPS-82" [checked=false, ref=e976]
  - cell "OPS-82" [ref=e705]
  - cell "Document invoice export" [ref=e706]
    - button "Document invoice export" [ref=e977]
  - cell "In review" [ref=e707]
  - cell "Urgent" [ref=e708]
  - cell "Oskar Lindqvist" [ref=e709]
  - cell "just now" [ref=e710]
  - cell "Select OPS-120" [ref=e711]
    - checkbox "Select OPS-120" [checked=false, ref=e978]
  - cell "OPS-120" [ref=e712]
  - cell "Speed up rate limiter headers" [ref=e713]
    - button "Speed up rate limiter headers" [ref=e979]
  - cell "To do" [ref=e714]
  - cell "Medium" [ref=e715]
  - cell "Hana Sato" [ref=e716]
  - cell "just now" [ref=e717]
  - cell "Select OPS-165" [ref=e718]
    - checkbox "Select OPS-165" [checked=false, ref=e980]
  - cell "OPS-165" [ref=e719]
  - cell "Speed up Kafka consumer lag" [ref=e720]
    - button "Speed up Kafka consumer lag" [ref=e981]
  - cell "Backlog" [ref=e721]
  - cell "Low" [ref=e722]
  - cell "Talia Levi" [ref=e723]
  - cell "just now" [ref=e724]
  - cell "Select OPS-177" [ref=e725]
    - checkbox "Select OPS-177" [checked=false, ref=e982]
  - cell "OPS-177" [ref=e726]
  - cell "Refactor GDPR export" [ref=e727]
    - button "Refactor GDPR export" [ref=e983]
  - cell "In progress" [ref=e728]
  - cell "Medium" [ref=e729]
  - cell "Mei Chen" [ref=e730]
  - cell "just now" [ref=e731]
  - cell "Select OPS-189" [ref=e732]
    - checkbox "Select OPS-189" [checked=false, ref=e984]
  - cell "OPS-189" [ref=e733]
  - cell "Fix rate limiter headers" [ref=e734]
    - button "Fix rate limiter headers" [ref=e985]
  - cell "Backlog" [ref=e735]
  - cell "High" [ref=e736]
  - cell "Oskar Lindqvist" [ref=e737]
  - cell "just now" [ref=e738]
  - cell "Select OPS-242" [ref=e739]
    - checkbox "Select OPS-242" [checked=false, ref=e986]
  - cell "OPS-242" [ref=e740]
  - cell "Refactor rate limiter headers" [ref=e741]
    - button "Refactor rate limiter headers" [ref=e987]
  - cell "Backlog" [ref=e742]
  - cell "High" [ref=e743]
  - cell "Maya Ortiz" [ref=e744]
  - cell "just now" [ref=e745]
  - cell "Select OPS-248" [ref=e746]
    - checkbox "Select OPS-248" [checked=false, ref=e988]
  - cell "OPS-248" [ref=e747]
  - cell "Document onboarding checklist" [ref=e748]
    - button "Document onboarding checklist" [ref=e989]
  - cell "In progress" [ref=e749]
  - cell "High" [ref=e750]
  - cell "Bruno Costa" [ref=e751]
  - cell "just now" [ref=e752]
  - cell "Select OPS-253" [ref=e753]
    - checkbox "Select OPS-253" [checked=false, ref=e990]
  - cell "OPS-253" [ref=e754]
  - cell "Speed up push notification opt-out" [ref=e755]
    - button "Speed up push notification opt-out" [ref=e991]
  - cell "To do" [ref=e756]
  - cell "High" [ref=e757]
  - cell "Lena Brandt" [ref=e758]
  - cell "just now" [ref=e759]
  - cell "Select OPS-261" [ref=e760]
    - checkbox "Select OPS-261" [checked=false, ref=e992]
  - cell "OPS-261" [ref=e761]
  - cell "Remove invoice export" [ref=e762]
    - button "Remove invoice export" [ref=e993]
  - cell "To do" [ref=e763]
  - cell "Medium" [ref=e764]
  - cell "Idris Karimi" [ref=e765]
  - cell "just now" [ref=e766]
  - cell "Select OPS-280" [ref=e767]
    - checkbox "Select OPS-280" [checked=false, ref=e994]
  - cell "OPS-280" [ref=e768]
  - cell "Migrate error page copy" [ref=e769]
    - button "Migrate error page copy" [ref=e995]
  - cell "In review" [ref=e770]
  - cell "Medium" [ref=e771]
  - cell "Unassigned" [ref=e772]
  - cell "just now" [ref=e773]
  - cell "Select OPS-334" [ref=e774]
    - checkbox "Select OPS-334" [checked=false, ref=e996]
  - cell "OPS-334" [ref=e775]
  - cell "Add permission matrix" [ref=e776]
    - button "Add permission matrix" [ref=e997]
  - cell "Backlog" [ref=e777]
  - cell "Low" [ref=e778]
  - cell "Elliot Graves" [ref=e779]
  - cell "just now" [ref=e780]
  - combobox "Rows per page" [expanded=false, ref=e781]: 100
    - option "50" [ref=e1003]
    - option "100" [selected, ref=e1004]
    - option "250" [ref=e1005]
  - navigation "Pagination" [ref=e22]
    - button "Previous" [disabled, ref=e782]
    - button "Next" [ref=e783]
[exit 0]

$ agent-browser --session art-l1 eval document.querySelectorAll\(\".issue-row\"\).length 
100
[exit 0]

$ npx genie-react tools react_clear_renders --session art-l1 
react_clear_renders "Start a render measurement"
description: "Clear profile aggregates and start a new observation window. The returned observation ID joins later render and effect evidence; it does not imply that a browser interaction happened. Arguments: component: minimum characters 1, maximum characters 160; component: minimum items 1, maximum items 50; component[]: minimum characters 1, maximum characters 160; components: maximum items 50; components[]: minimum characters 1, maximum characters 160; roots: maximum items 20; budget.fiberLimit: minimum 50, maximum 20000; budget.operationLimit: minimum 1000, maximum 2000000; budget.timeLimitMs: minimum 1, maximum 500; budget.targetOperationReserve: minimum 100, maximum 500000; budget.targetTimeReserveMs: minimum 0.5, maximum 250; lifecycle.bufferLimit: minimum 100, maximum 20000; lifecycle.targetReserve: minimum 0, maximum 5000."
group: react.render
inputJsonSchema {$schema:https://json-schema.org/draft/2020-12/schema,type:object}: (arguments; name? is optional)
  component?: anyOf:[{type:string,minLength:1,maxLength:160},{minItems:1,maxItems:50,type:array,items:{type:string,minLength:1,maxLength:160}}] — "Reserve analysis work for these components: one display name or a list, matched exactly (case-sensitive) like the read tools. Pass exact:false to match every name containing one, ignoring case."
  exact?: boolean default:true — "false matches each component value as a case-insensitive substring."
  components?: array default:[] maxItems:50 items:{type:string,minLength:1,maxLength:160} — "Deprecated: use component with exact:false. Reserves analysis for display names containing any value, ignoring case."
  roots?: array default:[] maxItems:20 items:{type:integer} — "Reserve analysis work for these component node IDs and their descendants."
  budget?: object default:{fiberLimit:250,operationLimit:20000,timeLimitMs:8,targetOperationReserve:4000,targetTimeReserveMs:4,adaptive:true} properties:{fiberLimit:{default:250,type:integer,minimum:50,maximum:20000},operationLimit:{default:20000,type:integer,minimum:1000,maximum:2000000},timeLimitMs:{default:8,type:number,minimum:1,maximum:500},targetOperationReserve:{default:4000,type:integer,minimum:100,maximum:500000},targetTimeReserveMs:{default:4,type:number,minimum:0.5,maximum:250},adaptive:{default:true,type:boolean}}
  lifecycle?: object default:{bufferLimit:1000,targetReserve:100} properties:{bufferLimit:{default:1000,description:"Bounds pending unmounts per commit and the unmounted components whose renders stay in the report.",type:integer,minimum:100,maximum:20000},targetReserve:{default:100,type:integer,minimum:0,maximum:5000}}
annotations: {idempotentHint:false}
output: outline (top-level fields; name? is optional)
  ok: boolean
  tracking: boolean
  documentCommitId: integer
  observation: object
  observationConfig: object
  strictMode: "on" | "off" | "partial" | "unknown"
  deprecations?: array<string>
  next: $ pnpm exec genie-react tools react_clear_renders --output-schema --session baaaae42-4044-481c-b7cf-b4daf51a6cc5
[exit 0]

# Investigate: select one row with default budget

$ npx genie-react call react_clear_renders \{\"component\":\"IssueRow\"\} --session art-l1 
ok: true
tracking: true
documentCommitId: 27
observation: {id:observation:1,epoch:1,startedAfterDocumentCommitId:27}
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

$ agent-browser --session art-l1 click .issue-row:nth-child\(4\)\ input\[type=\"checkbox\"\] 
✓ Done
[exit 0]

$ npx genie-react call react_quiesce \{\"idleMs\":500,\"timeoutMs\":10000\} --fail-on-result-error --session art-l1 
ok: true
outcome: idle
elapsedMs: 1275
observedCommits: 1
documentCommitId: 29
sessionId: 1f2f04d3-2804-41a5-a981-04af2ded6b07
renderCollection: available
pendingWork:
  documentCommitId: 29
  scheduledRoots: 0
  suspendedBoundaries: 0
  dehydratedBoundaries: 0
  boundaries: []
  scanTruncated: false
  scannedFibers: 2258
[exit 0]

$ npx genie-react call react_component_cohort \{\"component\":\"IssueRow\",\"exact\":true,\"limit\":3\} --session art-l1 
attribution:
  status: current
  startedAtDocumentCommitId: 29
  completedAtDocumentCommitId: 29
  startedAtAnalysisGeneration: 30
  completedAtAnalysisGeneration: 30
documentCommitId: 29
ownershipCoverage:
  complete: true
  totalCandidates: 100
  app: 100
  library: 0
  unknown: 0
  affects: ownership-labels
observation: {id:observation:1,epoch:1,startedAfterDocumentCommitId:27}
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
returned: 3
omittedByLimit: 97
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
  parent: {fiberId:6342945276088,name:IssueTable,key:null}
  keyedParent: null
  logicalIdentityEvidence: keyed
  mountGenerationEvidence: exact
  renderingState: mounted-rendering
  reactVisibility: not-hidden
instances[3]:
  each: {status:mounted-updated,mountGeneration:1,hostSelector:tr.issue-row}
  - {mountId:mount:1,fiberId:6342945276113,key:iss-1,siblingIndex:0,logicalPath:"IssueRow[key=\"iss-1\"]"}
  - {mountId:mount:2,fiberId:6342945276133,key:iss-27,siblingIndex:1,logicalPath:"IssueRow[key=\"iss-27\"]"}
  - {mountId:mount:3,fiberId:6342945276153,key:iss-37,siblingIndex:2,logicalPath:"IssueRow[key=\"iss-37\"]"}
[exit 0]

$ npx genie-react call react_render_causes \{\"component\":\"IssueRow\",\"limit\":3\} --session art-l1 
componentMatch:
  component: IssueRow
  exact: true
  status: matched
  matchedNames: [IssueRow]
  matchedNameCount: 1
  similarNames: []
tracking: true
commits: 8
documentCommitId: 35
observation: {id:observation:1,epoch:1,startedAfterDocumentCommitId:27}
attribution:
  status: current
  startedAtDocumentCommitId: 35
  completedAtDocumentCommitId: 35
  startedAtAnalysisGeneration: 36
  completedAtAnalysisGeneration: 36
view: summary
events[3] (componentName #componentId {fields}, then ← kind evidence name {fields} per cause):
  each: {documentCommitId:34,necessity:unknown,necessityReason:callbacks-changed,inputEvidence:changed,source:{location:<repo>/apps/realworld-legacy/src/features/issues/issue-table.tsx:48:15,role:element-callsite,ownership:app}}
  IssueRow #6342945276765 {renderEventId:render:34:1577,mountId:mount:34,key:iss-369}
    ← props exact onToggle
  IssueRow #6342945276745 {renderEventId:render:34:1576,mountId:mount:33,key:iss-368}
    ← props exact onToggle
  IssueRow #6342945276725 {renderEventId:render:34:1575,mountId:mount:32,key:iss-362}
    ← props exact onToggle
omittedByLimit: 65
sourceClassification:
  complete: true
  affects: result
  totalCandidates: 68
  evaluated: 68
  app: 68
  library: 0
  unknown: 0
  unknownComponents: []
  unknownComponentsOmitted: 0
renderEventRetention: {evictedEvents:365,earliestDocumentCommitId:28,latestDocumentCommitId:35}
coverage:
  skippedCommitFibers: 198
  droppedUnmountFibers: 0
  analysisFailedFibers: 0
  pausedCommits: 0
  unobservedCommits: 0
  refreshCommitsExcluded: 0
  truncatedInputFibers: 1
  propsNotEnumeratedFibers: 0
  budgetExhaustedCommits: 3
  budgetExhaustedSubsystems[5]:
    each: {commits:3}
    - {subsystem:target:input-equivalence}
    - {subsystem:target:instance-ancestry}
    - {subsystem:target:instance-siblings}
    - {subsystem:target:target-error-state}
    - {subsystem:target:target-fibers}
  budgetAdvice:
    exhaustedLimits: [targetOperationReserve]
    suggestedBudget: {fiberLimit:750,operationLimit:90000,timeLimitMs:36,targetOperationReserve:12000,targetTimeReserveMs:12}
    next: "targetOperationReserve ran out. Run react_clear_renders with {\"budget\":{\"fiberLimit\":750,\"operationLimit\":90000,\"timeLimitMs\":36,\"targetOperationReserve\":12000,\"targetTimeReserveMs\":12}}, repeat the step, and read again."
  incompleteBecause[2]:
    - {reason:budget-exhausted,fibers:198,detail:"3 commits ran out of analysis budget.",next:"targetOperationReserve ran out. Run react_clear_renders with {\"budget\":{\"fiberLimit\":750,\"operationLimit\":90000,\"timeLimitMs\":36,\"targetOperationReserve\":12000,\"targetTimeReserveMs\":12}}, repeat the step, and read again."}
    - {reason:inputs-truncated,fibers:1,components:[IssueTableToolbar],detail:"An input held values Genie compares only in part, such as functions, class instances or objects past the inspected depth; read deepDiff.truncated on these components."}
  complete: false
  inputAttributionComplete: false
  semantics: lower-bound
  coverageDomain: render-causality
  droppedRenderEvents: 365
[exit 0]

# Repeat with the budget from budgetAdvice

$ npx genie-react call react_clear_renders \{\"component\":\"IssueRow\",\"budget\":\{\"fiberLimit\":750,\"operationLimit\":90000,\"timeLimitMs\":36,\"targetOperationReserve\":12000,\"targetTimeReserveMs\":12\}\} --session art-l1 
ok: true
tracking: true
documentCommitId: 41
observation: {id:observation:2,epoch:2,startedAfterDocumentCommitId:41}
observationConfig:
  adaptive: true
  adaptiveScale: 1
  fiberLimit: 750
  operationLimit: 90000
  timeLimitMs: 36
  targetOperationReserve: 12000
  targetTimeReserveMs: 12
  lifecycleBufferLimit: 1000
  lifecycleTargetReserve: 100
strictMode: on
[exit 0]

$ agent-browser --session art-l1 click .issue-row:nth-child\(5\)\ input\[type=\"checkbox\"\] 
✓ Done
[exit 0]

$ npx genie-react call react_quiesce \{\"idleMs\":500,\"timeoutMs\":10000\} --fail-on-result-error --session art-l1 
ok: true
outcome: idle
elapsedMs: 642
observedCommits: 0
documentCommitId: 43
sessionId: 1f2f04d3-2804-41a5-a981-04af2ded6b07
renderCollection: available
pendingWork:
  documentCommitId: 43
  scheduledRoots: 0
  suspendedBoundaries: 0
  dehydratedBoundaries: 0
  boundaries: []
  scanTruncated: false
  scannedFibers: 2258
[exit 0]

$ npx genie-react call react_component_cohort \{\"component\":\"IssueRow\",\"exact\":true,\"limit\":3\} --session art-l1 
attribution:
  status: current
  startedAtDocumentCommitId: 43
  completedAtDocumentCommitId: 43
  startedAtAnalysisGeneration: 45
  completedAtAnalysisGeneration: 45
documentCommitId: 43
ownershipCoverage:
  complete: true
  totalCandidates: 100
  app: 100
  library: 0
  unknown: 0
  affects: ownership-labels
observation: {id:observation:2,epoch:2,startedAfterDocumentCommitId:41}
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
returned: 3
omittedByLimit: 97
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
  parent: {fiberId:6342945276088,name:IssueTable,key:null}
  keyedParent: null
  logicalIdentityEvidence: keyed
  mountGenerationEvidence: exact
  renderingState: mounted-rendering
  reactVisibility: not-hidden
instances[3]:
  each: {status:mounted-updated,mountGeneration:1,hostSelector:tr.issue-row}
  - {mountId:mount:1,fiberId:6342945276113,key:iss-1,siblingIndex:0,logicalPath:"IssueRow[key=\"iss-1\"]"}
  - {mountId:mount:2,fiberId:6342945276133,key:iss-27,siblingIndex:1,logicalPath:"IssueRow[key=\"iss-27\"]"}
  - {mountId:mount:3,fiberId:6342945276153,key:iss-37,siblingIndex:2,logicalPath:"IssueRow[key=\"iss-37\"]"}
[exit 0]

$ npx genie-react call react_render_causes \{\"component\":\"IssueRow\",\"limit\":3\} --session art-l1 
componentMatch:
  component: IssueRow
  exact: true
  status: matched
  matchedNames: [IssueRow]
  matchedNameCount: 1
  similarNames: []
tracking: true
commits: 5
documentCommitId: 46
observation: {id:observation:2,epoch:2,startedAfterDocumentCommitId:41}
attribution:
  status: current
  startedAtDocumentCommitId: 46
  completedAtDocumentCommitId: 46
  startedAtAnalysisGeneration: 48
  completedAtAnalysisGeneration: 48
view: summary
events[3] (componentName #componentId {fields}, then ← kind evidence name {fields} per cause):
  each: {documentCommitId:42,necessity:unknown,necessityReason:callbacks-changed,inputEvidence:changed,source:{location:<repo>/apps/realworld-legacy/src/features/issues/issue-table.tsx:48:15,role:element-callsite,ownership:app}}
  IssueRow #6342945278076 {renderEventId:render:42:2418,mountId:mount:521,key:iss-1754}
    ← props exact onToggle
  IssueRow #6342945278057 {renderEventId:render:42:2417,mountId:mount:520,key:iss-1700}
    ← props exact onToggle
  IssueRow #6342945278037 {renderEventId:render:42:2416,mountId:mount:519,key:iss-1681}
    ← props exact onToggle
omittedByLimit: 97
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
renderEventRetention: {evictedEvents:0,earliestDocumentCommitId:42,latestDocumentCommitId:46}
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

$ npx genie-react call react_render_causes \{\"component\":\"IssueRow\",\"limit\":1,\"view\":\"full\"\} --session art-l1 
componentMatch:
  component: IssueRow
  exact: true
  status: matched
  matchedNames: [IssueRow]
  matchedNameCount: 1
  similarNames: []
tracking: true
commits: 11
documentCommitId: 52
observation: {id:observation:2,epoch:2,startedAfterDocumentCommitId:41}
attribution:
  status: current
  startedAtDocumentCommitId: 52
  completedAtDocumentCommitId: 52
  startedAtAnalysisGeneration: 54
  completedAtAnalysisGeneration: 54
view: full
events[1] (componentName #componentId {fields}, then ← kind evidence name {fields} per cause):
  IssueRow #6342945278076 {renderEventId:render:52:4097,observationId:observation:2,commitId:11,documentCommitId:52,instance:{fiberId:6342945278076,mountId:mount:521,key:iss-1754,siblingIndex:99,parent:{fiberId:6342945276088,name:IssueTable,key:null},keyedParent:null,logicalPath:"AppErrorBoundary[index=0] > Provider[index=0] > BrowserRouter[index=0] > Router[index=0] > ThemeProvider[index=0] > App[index=0] > Routes[index=0] > RenderedRoute[index=0] > RequireAuth[index=0] > Connect(AppShell)[index=0] > AppShell[index=0] > FeatureFlagsProvider[index=0] > <div>[index=0] > <main>[index=2] > Outlet[index=0] > RenderedRoute[index=0] > IssuesPage[index=0] > <div>[index=0] > withRouter(Connect(IssueTable))[index=3] > Connect(IssueTable)[index=0] > IssueTable[index=0] > <div>[index=0] > <table>[index=0] > <tbody>[index=1] > IssueRow[key=\"iss-1754\"]",logicalIdentityEvidence:keyed,mountGeneration:1,mountGenerationEvidence:exact,hostSelector:null},necessity:unknown,necessityReason:callbacks-changed,assessment:{inputEvidence:changed,observedInputKinds:[props],behaviorEvidence:{subtreeHostMutations:{status:none-observed,count:0,pendingSubtrees:0,omittedByLimit:0,callbackOnlyUpdates:2,writes:[],callbacks:[input.onChange,button.onClick]},scheduledEffects:{status:none-observed,count:0},subtreeScheduledEffects:{status:none-observed,count:0},unobservedDomains:[focus,url,network,transition,freshness,effect-execution]},optimizationSafety:not-proven-safe,requiredValidation:[dom,aria,focus,url,network,transition]},inputCoverage:{complete:true,omittedInputs:0,scanTruncated:false,propsNotEnumerated:false},source:{file:<repo>/apps/realworld-legacy/src/features/issues/issue-table.tsx,line:48,column:15,functionName:null,sourceMapConfidence:served,role:element-callsite},sourceAttribution:{role:usage-or-definition-fallback,evidence:inferred},sourceOwnership:app,isLibrary:false}
    ← props exact onToggle {referenceChanged:true,referenceOnly:false,unstable:true,beforePresent:true,afterPresent:true,before:{__genie_dehydrated__:true,kind:function,preview:"ƒ onToggle()",path:[]},after:{__genie_dehydrated__:true,kind:function,preview:"ƒ onToggle()",path:[]},deepDiff:{changes:[{kind:identity-changed-uninspected,path:""}],visited:1,truncated:true}}
omittedByLimit: 161
sourceClassification:
  complete: true
  affects: result
  totalCandidates: 162
  evaluated: 162
  app: 162
  library: 0
  unknown: 0
  unknownComponents: []
  unknownComponentsOmitted: 0
renderEventRetention: {evictedEvents:566,earliestDocumentCommitId:51,latestDocumentCommitId:52}
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
  droppedRenderEvents: 566
[exit 0]

# Verify before the fix

$ npx genie-react verify begin --name select\ one\ issue\ row --claim render\ IssueRow\ max\ 1 --claim render\ IssueTable\ min\ 1 --claim boundaries\ clean --session art-l1 
recording vfy_a87c7413-4b9f-4907-b866-20986e2cf588 "select one issue row"
  url "http://127.0.0.1:5211/issues"
  1 null render IssueRow max 1  {}
  2 null render IssueTable min 1  {}
  3 null boundaries clean  {}
window: {observationId:observation:3,startDocumentCommitId:61,domains:[react],quietMs:500,timeoutMs:10000,tailMs:500}
next: $ pnpm exec genie-react verify end vfy_a87c7413-4b9f-4907-b866-20986e2cf588 --session art-l1
session: {sessionId:1f2f04d3-2804-41a5-a981-04af2ded6b07,logicalSessionId:baaaae42-4044-481c-b7cf-b4daf51a6cc5,documentGeneration:3}
schemaVersion: "1.0"
targets: [{target:{component:IssueRow},status:resolved,instances:100,source:<repo>/apps/realworld-legacy/src/features/issues/issue-table.tsx},{target:{component:IssueTable},status:resolved,instances:1,source:<repo>/apps/realworld-legacy/src/features/issues/issue-table.tsx}]
startedAt: 2026-11-19T03:53:23.856Z
expiresAt: 2026-11-19T03:58:23.879Z
request: {budget:{fiberLimit:250,operationLimit:20000,timeLimitMs:8,targetOperationReserve:4000,targetTimeReserveMs:4,adaptive:true},settle:{quietMs:500,timeoutMs:10000},maxDurationMs:300000,allowOverrides:false}
[exit 0]

$ agent-browser --session art-l1 click .issue-row:nth-child\(6\)\ input\[type=\"checkbox\"\] 
✓ Done
[exit 0]

$ npx genie-react verify end vfy_a87c7413-4b9f-4907-b866-20986e2cf588 --session art-l1 
fail vfy_a87c7413-4b9f-4907-b866-20986e2cf588 "select one issue row"  5 commits, quiet after 645 ms (react)
  url "http://127.0.0.1:5211/issues"
  1 fail render IssueRow max 1  {renders:28,mounts:0,updates:28,remounts:0,semantics:lower-bound,instances:100,activeInstances:100}
      claim: {kind:renders,target:{component:IssueRow},max:1,counting:renders,allowRemount:false}
      deciding: [{kind:instance,mountId:mount:1,key:iss-1,renders:1,mounts:0,updates:1,mountGeneration:1,latestDocumentCommitId:64,source:<repo>/apps/realworld-legacy/src/features/issues/issue-table.tsx:48:15},{kind:instance,mountId:mount:2,key:iss-27,renders:1,mounts:0,updates:1,mountGeneration:1,latestDocumentCommitId:64,source:<repo>/apps/realworld-legacy/src/features/issues/issue-table.tsx:48:15},{kind:instance,mountId:mount:3,key:iss-37,renders:1,mounts:0,updates:1,mountGeneration:1,latestDocumentCommitId:64,source:<repo>/apps/realworld-legacy/src/features/issues/issue-table.tsx:48:15}]
  2 pass render IssueTable min 1  {renders:1,mounts:0,updates:1,remounts:0,semantics:lower-bound,instances:1,activeInstances:1}
      claim: {kind:renders,target:{component:IssueTable},min:1,counting:renders,allowRemount:false}
      deciding: [{kind:instance,mountId:mount:52,renders:1,mounts:0,updates:1,mountGeneration:1,latestDocumentCommitId:64,source:<repo>/apps/realworld-legacy/src/features/issues/issue-table.tsx:43:7}]
      caveats: [count-is-a-lower-bound]
  3 pass boundaries clean  {caughtDuringWindow:0,caughtAtEnd:0}
      claim: {kind:boundaries-clean,scope:window}
      deciding: [{kind:boundary-log,scope:window,complete:true,afterDocumentCommitId:61}]
      caveats: [uncaught-errors-outside-boundaries-unobserved]
window: {observationId:observation:3,startDocumentCommitId:61,settledDocumentCommitId:65,frozenDocumentCommitId:66,commits:5,settle:{outcome:met,quietMs:500,timeoutMs:10000,waitedMs:645,domains:{react:met}},tail:{ms:500,commits:1},environment:{bundle:development,strictMode:on,renderCollection:available,visibility:unavailable}}
! ui-outcome-not-observed: Genie does not check the screen; confirm it with the UI driver
! visibility-unobserved: the app reports no visibility signal, so a hidden interval was not observed
attempt 1 for these claims on this tab
evidence: $ pnpm exec genie-react verify show vfy_a87c7413-4b9f-4907-b866-20986e2cf588 --claim 1 --session art-l1
session: {sessionId:1f2f04d3-2804-41a5-a981-04af2ded6b07,logicalSessionId:baaaae42-4044-481c-b7cf-b4daf51a6cc5,documentGeneration:3}
schemaVersion: "1.0"
exitCode: 1
stage: end
ledger: {fingerprint:cf_22a3bf630a1d,scope:logical-session,storage:memory,attempt:1,history:[],codeChangedSincePrevious:null,failsOnSameCode:0}
evidence: {retained:true,tools:[react_get_renders,react_component_cohort,react_list_overrides,react_refresh_events,react_profile_stop,react_error_state]}
startedAt: 2026-11-19T03:53:23.856Z
endedAt: 2026-11-19T03:53:27.615Z
request: {budget:{fiberLimit:250,operationLimit:20000,timeLimitMs:8,targetOperationReserve:4000,targetTimeReserveMs:4,adaptive:true},settle:{quietMs:500,timeoutMs:10000},maxDurationMs:300000,allowOverrides:false}
[exit 1]

# Verify before the fix, with the budget Genie advised

$ npx genie-react verify begin --name select\ one\ issue\ row --claim render\ IssueRow\ max\ 1 --claim render\ IssueTable\ min\ 1 --claim boundaries\ clean --budget \{\"fiberLimit\":750,\"operationLimit\":90000,\"timeLimitMs\":36,\"targetOperationReserve\":12000,\"targetTimeReserveMs\":12\} --session art-l1 
recording vfy_e35cdab1-edc9-449b-91b7-eddc28776733 "select one issue row"
  url "http://127.0.0.1:5211/issues"
  1 null render IssueRow max 1  {}
  2 null render IssueTable min 1  {}
  3 null boundaries clean  {}
window: {observationId:observation:4,startDocumentCommitId:74,domains:[react],quietMs:500,timeoutMs:10000,tailMs:500}
next: $ pnpm exec genie-react verify end vfy_e35cdab1-edc9-449b-91b7-eddc28776733 --session art-l1
session: {sessionId:1f2f04d3-2804-41a5-a981-04af2ded6b07,logicalSessionId:baaaae42-4044-481c-b7cf-b4daf51a6cc5,documentGeneration:3}
schemaVersion: "1.0"
targets: [{target:{component:IssueRow},status:resolved,instances:100,source:<repo>/apps/realworld-legacy/src/features/issues/issue-table.tsx},{target:{component:IssueTable},status:resolved,instances:1,source:<repo>/apps/realworld-legacy/src/features/issues/issue-table.tsx}]
startedAt: 2026-11-19T03:53:34.181Z
expiresAt: 2026-11-19T03:58:34.193Z
request: {budget:{fiberLimit:750,operationLimit:90000,timeLimitMs:36,targetOperationReserve:12000,targetTimeReserveMs:12,adaptive:true},settle:{quietMs:500,timeoutMs:10000},maxDurationMs:300000,allowOverrides:false}
[exit 0]

$ agent-browser --session art-l1 click .issue-row:nth-child\(7\)\ input\[type=\"checkbox\"\] 
✓ Done
[exit 0]

$ npx genie-react verify end vfy_e35cdab1-edc9-449b-91b7-eddc28776733 --session art-l1 
fail vfy_e35cdab1-edc9-449b-91b7-eddc28776733 "select one issue row"  3 commits, quiet after 645 ms (react)
  url "http://127.0.0.1:5211/issues"
  1 fail render IssueRow max 1  {renders:100,mounts:0,updates:100,remounts:0,semantics:lower-bound,instances:100,activeInstances:100}
      claim: {kind:renders,target:{component:IssueRow},max:1,counting:renders,allowRemount:false}
      deciding: [{kind:instance,mountId:mount:1,key:iss-1,renders:1,mounts:0,updates:1,mountGeneration:1,latestDocumentCommitId:75,source:<repo>/apps/realworld-legacy/src/features/issues/issue-table.tsx:48:15},{kind:instance,mountId:mount:2,key:iss-27,renders:1,mounts:0,updates:1,mountGeneration:1,latestDocumentCommitId:75,source:<repo>/apps/realworld-legacy/src/features/issues/issue-table.tsx:48:15},{kind:instance,mountId:mount:3,key:iss-37,renders:1,mounts:0,updates:1,mountGeneration:1,latestDocumentCommitId:75,source:<repo>/apps/realworld-legacy/src/features/issues/issue-table.tsx:48:15}]
  2 pass render IssueTable min 1  {renders:1,mounts:0,updates:1,remounts:0,semantics:lower-bound,instances:1,activeInstances:1}
      claim: {kind:renders,target:{component:IssueTable},min:1,counting:renders,allowRemount:false}
      deciding: [{kind:instance,mountId:mount:52,renders:1,mounts:0,updates:1,mountGeneration:1,latestDocumentCommitId:75,source:<repo>/apps/realworld-legacy/src/features/issues/issue-table.tsx:43:7}]
      caveats: [count-is-a-lower-bound]
  3 pass boundaries clean  {caughtDuringWindow:0,caughtAtEnd:0}
      claim: {kind:boundaries-clean,scope:window}
      deciding: [{kind:boundary-log,scope:window,complete:true,afterDocumentCommitId:74}]
      caveats: [uncaught-errors-outside-boundaries-unobserved]
window: {observationId:observation:4,startDocumentCommitId:74,settledDocumentCommitId:76,frozenDocumentCommitId:77,commits:3,settle:{outcome:met,quietMs:500,timeoutMs:10000,waitedMs:645,domains:{react:met}},tail:{ms:500,commits:1},environment:{bundle:development,strictMode:on,renderCollection:available,visibility:unavailable}}
! ui-outcome-not-observed: Genie does not check the screen; confirm it with the UI driver
! visibility-unobserved: the app reports no visibility signal, so a hidden interval was not observed
attempt 2 for these claims on this tab; previous fail vfy_a87c7413-4b9f-4907-b866-20986e2cf588; no code change observed
evidence: $ pnpm exec genie-react verify show vfy_e35cdab1-edc9-449b-91b7-eddc28776733 --claim 1 --session art-l1
session: {sessionId:1f2f04d3-2804-41a5-a981-04af2ded6b07,logicalSessionId:baaaae42-4044-481c-b7cf-b4daf51a6cc5,documentGeneration:3}
schemaVersion: "1.0"
exitCode: 1
stage: end
ledger: {fingerprint:cf_22a3bf630a1d,scope:logical-session,storage:memory,attempt:2,history:[{verificationId:vfy_a87c7413-4b9f-4907-b866-20986e2cf588,verdict:fail,reasons:[],endedAt:2026-11-19T03:53:27.615Z}],codeChangedSincePrevious:none-observed,failsOnSameCode:1}
evidence: {retained:true,tools:[react_get_renders,react_component_cohort,react_list_overrides,react_refresh_events,react_profile_stop,react_error_state]}
startedAt: 2026-11-19T03:53:34.181Z
endedAt: 2026-11-19T03:53:35.679Z
request: {budget:{fiberLimit:750,operationLimit:90000,timeLimitMs:36,targetOperationReserve:12000,targetTimeReserveMs:12,adaptive:true},settle:{quietMs:500,timeoutMs:10000},maxDurationMs:300000,allowOverrides:false}
[exit 1]

# Apply the reference fix

$ node /tmp/art-l1/apply-fix.mjs issue-row-inline-handler 
applied 3 edits
[exit 0]

$ git diff 
diff --git a/apps/realworld-legacy/src/features/issues/issue-row.tsx b/apps/realworld-legacy/src/features/issues/issue-row.tsx
index b790cc6..636ec0c 100644
--- a/apps/realworld-legacy/src/features/issues/issue-row.tsx
+++ b/apps/realworld-legacy/src/features/issues/issue-row.tsx
@@ -7,24 +7,24 @@ import { UserName } from '../../components/user-name'
 interface IssueRowProps {
   issue: Issue
   selected: boolean
-  onToggle: () => void
+  onToggle: (id: string) => void
   onOpen: (key: string) => void
 }
 
 export class IssueRow extends PureComponent<IssueRowProps> {
   render() {
     const { issue, selected, onToggle, onOpen } = this.props
     return (
       <tr
         className={selected ? 'issue-row issue-row--selected' : 'issue-row'}
         data-issue-key={issue.key}
       >
         <td>
           <input
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
[exit 0]

# Reload and verify after the fix

$ agent-browser --session art-l1 open http://127.0.0.1:5211/issues 
✓ Acme Tracker
  http://127.0.0.1:5211/issues
[exit 0]

$ npx genie-react status --wait 15000 --session art-l1 
selectedBridgeUrl: ws://127.0.0.1:15212/__genie/ws
sessionSelector:
  requested: art-l1
  source: flag
  resolvedSessionId: 6aba0b4b-562a-4bf0-a60e-55107492d867
  implicit: false
  agentBrowser: {session:art-l1,via:selector,logicalSessionId:baaaae42-4044-481c-b7cf-b4daf51a6cc5}
connected: true
ready: true
sessionId: 6aba0b4b-562a-4bf0-a60e-55107492d867
app: {name:"Acme Tracker",url:http://127.0.0.1:5211/issues,reactVersion:18.3.1,reactMounted:true}
domains: [session,react,memory,perf,timeline,redux,app]
toolCount: 61
sessions[1] (sessionId {fields}):
  6aba0b4b-562a-4bf0-a60e-55107492d867 {logicalSessionId:baaaae42-4044-481c-b7cf-b4daf51a6cc5,documentGeneration:5,predecessorSessionId:c5798235-a865-42d7-80ca-7a54b724d9cd,logicalSessionCollision:false,collisionWithSessionIds:[],app:{name:"Acme Tracker",url:http://127.0.0.1:5211/issues,reactVersion:18.3.1,reactMounted:true},domains:[session,react,memory,perf,timeline,redux,app],toolCount:61,connectedAt:1795060432097,ready:true,readyAt:1795060432097,current:true,origin:http://127.0.0.1:5211,originUnverified:true,runtimeVersion:1.0.2}
warnings: []
hub: {version:1.0.2,protocol:1}
[exit 0]

$ agent-browser --session art-l1 wait .issue-row 
✓ Done
[exit 0]

$ npx genie-react verify begin --name select\ one\ issue\ row --claim render\ IssueRow\ max\ 1 --claim render\ IssueTable\ min\ 1 --claim boundaries\ clean --budget \{\"fiberLimit\":750,\"operationLimit\":90000,\"timeLimitMs\":36,\"targetOperationReserve\":12000,\"targetTimeReserveMs\":12\} --session art-l1 
recording vfy_de478e7d-9173-4eeb-aa53-283cb4d5bfda "select one issue row"
  url "http://127.0.0.1:5211/issues"
  1 null render IssueRow max 1  {}
  2 null render IssueTable min 1  {}
  3 null boundaries clean  {}
window: {observationId:observation:1,startDocumentCommitId:17,domains:[react],quietMs:500,timeoutMs:10000,tailMs:500}
next: $ pnpm exec genie-react verify end vfy_de478e7d-9173-4eeb-aa53-283cb4d5bfda --session art-l1
session: {sessionId:6aba0b4b-562a-4bf0-a60e-55107492d867,logicalSessionId:baaaae42-4044-481c-b7cf-b4daf51a6cc5,documentGeneration:5}
schemaVersion: "1.0"
targets: [{target:{component:IssueRow},status:resolved,instances:100,source:<repo>/apps/realworld-legacy/src/features/issues/issue-table.tsx},{target:{component:IssueTable},status:resolved,instances:1,source:<repo>/apps/realworld-legacy/src/features/issues/issue-table.tsx}]
startedAt: 2026-11-19T03:53:52.622Z
expiresAt: 2026-11-19T03:58:52.645Z
request: {budget:{fiberLimit:750,operationLimit:90000,timeLimitMs:36,targetOperationReserve:12000,targetTimeReserveMs:12,adaptive:true},settle:{quietMs:500,timeoutMs:10000},maxDurationMs:300000,allowOverrides:false}
[exit 0]

$ agent-browser --session art-l1 click .issue-row:nth-child\(4\)\ input\[type=\"checkbox\"\] 
✓ Done
[exit 0]

$ npx genie-react verify end vfy_de478e7d-9173-4eeb-aa53-283cb4d5bfda --session art-l1 
pass vfy_de478e7d-9173-4eeb-aa53-283cb4d5bfda "select one issue row"  3 commits, quiet after 936 ms (react)
  url "http://127.0.0.1:5211/issues"
  1 pass render IssueRow max 1  {renders:1,mounts:0,updates:1,remounts:0,semantics:exact,instances:100,activeInstances:100}
      claim: {kind:renders,target:{component:IssueRow},max:1,counting:renders,allowRemount:false}
      deciding: [{kind:coverage,complete:true,targetedComplete:true,semantics:exact},{kind:instance,mountId:mount:1,renderingState:mounted-rendering,source:<repo>/apps/realworld-legacy/src/features/issues/issue-table.tsx:48:15},{kind:instance,mountId:mount:2,renderingState:mounted-rendering,source:<repo>/apps/realworld-legacy/src/features/issues/issue-table.tsx:48:15}]
  2 pass render IssueTable min 1  {renders:1,mounts:0,updates:1,remounts:0,semantics:exact,instances:1,activeInstances:1}
      claim: {kind:renders,target:{component:IssueTable},min:1,counting:renders,allowRemount:false}
      deciding: [{kind:instance,mountId:mount:101,renders:1,mounts:0,updates:1,mountGeneration:1,latestDocumentCommitId:18,source:<repo>/apps/realworld-legacy/src/features/issues/issue-table.tsx:43:7}]
  3 pass boundaries clean  {caughtDuringWindow:0,caughtAtEnd:0}
      claim: {kind:boundaries-clean,scope:window}
      deciding: [{kind:boundary-log,scope:window,complete:true,afterDocumentCommitId:17}]
      caveats: [uncaught-errors-outside-boundaries-unobserved]
window: {observationId:observation:1,startDocumentCommitId:17,settledDocumentCommitId:19,frozenDocumentCommitId:20,commits:3,settle:{outcome:met,quietMs:500,timeoutMs:10000,waitedMs:936,domains:{react:met}},tail:{ms:500,commits:1},environment:{bundle:development,strictMode:on,renderCollection:available,visibility:unavailable}}
! ui-outcome-not-observed: Genie does not check the screen; confirm it with the UI driver
! visibility-unobserved: the app reports no visibility signal, so a hidden interval was not observed
attempt 3 for these claims on this tab; previous fail vfy_e35cdab1-edc9-449b-91b7-eddc28776733; document reloaded since
evidence: $ pnpm exec genie-react verify show vfy_de478e7d-9173-4eeb-aa53-283cb4d5bfda --session art-l1
session: {sessionId:6aba0b4b-562a-4bf0-a60e-55107492d867,logicalSessionId:baaaae42-4044-481c-b7cf-b4daf51a6cc5,documentGeneration:5}
schemaVersion: "1.0"
exitCode: 0
stage: end
ledger: {fingerprint:cf_22a3bf630a1d,scope:logical-session,storage:memory,attempt:3,history:[{verificationId:vfy_a87c7413-4b9f-4907-b866-20986e2cf588,verdict:fail,reasons:[],endedAt:2026-11-19T03:53:27.615Z},{verificationId:vfy_e35cdab1-edc9-449b-91b7-eddc28776733,verdict:fail,reasons:[],endedAt:2026-11-19T03:53:35.679Z}],codeChangedSincePrevious:document-reloaded,failsOnSameCode:0}
evidence: {retained:true,tools:[react_get_renders,react_component_cohort,react_list_overrides,react_refresh_events,react_profile_stop,react_error_state]}
startedAt: 2026-11-19T03:53:52.622Z
endedAt: 2026-11-19T03:53:54.375Z
request: {budget:{fiberLimit:750,operationLimit:90000,timeLimitMs:36,targetOperationReserve:12000,targetTimeReserveMs:12,adaptive:true},settle:{quietMs:500,timeoutMs:10000},maxDurationMs:300000,allowOverrides:false}
[exit 0]

# Confirm the screen

$ agent-browser --session art-l1 is checked .issue-row:nth-child\(4\)\ input\[type=\"checkbox\"\] 
true
[exit 0]

# Cohort after the fix

$ npx genie-react call react_clear_renders \{\"component\":\"IssueRow\",\"budget\":\{\"fiberLimit\":750,\"operationLimit\":90000,\"timeLimitMs\":36,\"targetOperationReserve\":12000,\"targetTimeReserveMs\":12\}\} --session art-l1 
ok: true
tracking: true
documentCommitId: 25
observation: {id:observation:2,epoch:2,startedAfterDocumentCommitId:25}
observationConfig:
  adaptive: true
  adaptiveScale: 1
  fiberLimit: 750
  operationLimit: 90000
  timeLimitMs: 36
  targetOperationReserve: 12000
  targetTimeReserveMs: 12
  lifecycleBufferLimit: 1000
  lifecycleTargetReserve: 100
strictMode: on
[exit 0]

$ agent-browser --session art-l1 click .issue-row:nth-child\(9\)\ input\[type=\"checkbox\"\] 
✓ Done
[exit 0]

$ npx genie-react call react_quiesce \{\"idleMs\":500,\"timeoutMs\":10000\} --fail-on-result-error --session art-l1 
ok: true
outcome: idle
elapsedMs: 802
observedCommits: 1
documentCommitId: 27
sessionId: 6aba0b4b-562a-4bf0-a60e-55107492d867
renderCollection: available
pendingWork:
  documentCommitId: 27
  scheduledRoots: 0
  suspendedBoundaries: 0
  dehydratedBoundaries: 0
  boundaries: []
  scanTruncated: false
  scannedFibers: 2258
[exit 0]

$ npx genie-react call react_component_cohort \{\"component\":\"IssueRow\",\"exact\":true,\"limit\":3\} --session art-l1 
attribution:
  status: current
  startedAtDocumentCommitId: 27
  completedAtDocumentCommitId: 27
  startedAtAnalysisGeneration: 29
  completedAtAnalysisGeneration: 29
documentCommitId: 27
ownershipCoverage:
  complete: true
  totalCandidates: 100
  app: 100
  library: 0
  unknown: 0
  affects: ownership-labels
observation: {id:observation:2,epoch:2,startedAfterDocumentCommitId:25}
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
returned: 3
omittedByLimit: 97
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
  parent: {fiberId:12087933796377,name:IssueTable,key:null}
  keyedParent: null
  logicalIdentityEvidence: keyed
  mountGenerationEvidence: exact
  renderingState: mounted-rendering
  reactVisibility: not-hidden
instances[3]:
  each: {status:mounted-idle,mountGeneration:1,hostSelector:tr.issue-row}
  - {mountId:mount:1,fiberId:12087933796376,key:iss-1,siblingIndex:0,logicalPath:"IssueRow[key=\"iss-1\"]"}
  - {mountId:mount:2,fiberId:12087933796378,key:iss-27,siblingIndex:1,logicalPath:"IssueRow[key=\"iss-27\"]"}
  - {mountId:mount:3,fiberId:12087933796379,key:iss-37,siblingIndex:2,logicalPath:"IssueRow[key=\"iss-37\"]"}
[exit 0]

$ npx genie-react call react_render_causes \{\"component\":\"IssueRow\",\"limit\":3\} --session art-l1 
componentMatch:
  component: IssueRow
  exact: true
  status: matched
  matchedNames: [IssueRow]
  matchedNameCount: 1
  similarNames: []
tracking: true
commits: 3
documentCommitId: 28
observation: {id:observation:2,epoch:2,startedAfterDocumentCommitId:25}
attribution:
  status: current
  startedAtDocumentCommitId: 28
  completedAtDocumentCommitId: 28
  startedAtAnalysisGeneration: 30
  completedAtAnalysisGeneration: 30
view: summary
events[1] (componentName #componentId {fields}, then ← kind evidence name {fields} per cause):
  IssueRow #12087933796385 {renderEventId:render:26:48,documentCommitId:26,mountId:mount:9,key:iss-101,necessity:necessary,necessityReason:dom-changed,inputEvidence:changed,source:{location:<repo>/apps/realworld-legacy/src/features/issues/issue-table.tsx:48:15,role:element-callsite,ownership:app}}
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
renderEventRetention: {evictedEvents:0,earliestDocumentCommitId:26,latestDocumentCommitId:28}
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

# Revert the fix

$ git checkout -- src 
[exit 0]

$ git status --short 
## t3/legacy-react-bug-audit
[exit 0]

```

## Re-run on Genie 1.1.0

- Date: 2026-11-19
- Commit: ce408cb205c0e798cb04c35512772b7454283141 (`git rev-parse HEAD`, tag `genie-react@1.1.0`)
- Genie: `genie-react` and `@genie-react/cli` 1.1.0 built from this checkout (`pnpm install && pnpm build`, exit 0). `node_modules/.bin/genie-react --version` in apps/realworld-legacy printed `1.1.0`, and `status` reported `hub: {version:1.1.0,protocol:1}` and `runtimeVersion:1.1.0`.
- App: apps/realworld-legacy (Acme Tracker), dev server http://127.0.0.1:5233, standalone Genie hub ws://127.0.0.1:15233/__genie/ws
- Driver: agent-browser 0.39.1, session `upd-c`
- App fixes: `node /tmp/upd-c/apply-fix.mjs <id>` applies the exact `referenceFix` edits from evals/realworld/legacy/<id>.json. Each fix was measured and then reverted with `git checkout -- src`. No app change is committed.
- Redaction: the home directory is replaced by `~`. Nothing else is edited.

Servers, run from apps/realworld-legacy:

```bash
GENIE_HUB_PORT=15233 node_modules/.bin/genie-react hub --port 15233
PORT=5233 GENIE_HUB_PORT=15233 pnpm exec webpack serve --mode development --port 5233
```

Each command below is printed as `$ <command>` (shell-quoted with printf %q) and run from apps/realworld-legacy, followed by its full stdout and stderr and `[exit <code>]`. Lines starting with `#` are notes written during the run. Some commands were filtered on screen during the run, but the log holds their full output.

What 1.1.0 changed for this article:

- The counts and verdicts hold. With the default budget the first cohort read is 34 updated and 66 unknown. With the advised budget it is 100 of 100. `verify` fails at 100 renders (`lower-bound`, exit 1) before the fix with the advised budget and at 28 with the default budget, and passes at 1 render (`exact`, exit 0) after the fix. The cohort after the fix shows 1 updated row with `props exact selected`.
- `react_component_cohort` now prints `coverage.budgetAdvice` itself. On 1.0.2 the article read the advice from `react_render_causes`.
- The first default-budget `verify` run below had about 10 seconds between `begin` and the click, so app timer commits added renders (`renders:90`, 13 commits). The repeat with `begin`, click and `end` back to back gave `renders:28`, as on 1.0.2.

### Commands and output, in order

```text
# Sign in and open the issue table

$ npx genie-react call app_backend_reset \{\} --session upd-c
seed: 2019
issues: 3240
notificationPollMs: 15000
[exit 0]

$ npx genie-react call app_sign_in \{\} --session upd-c
user: {id:u-1,name:"Dana Whitfield",email:dana@acme.test,title:Designer,team:Infra}
[exit 0]

$ agent-browser --session upd-c open http://127.0.0.1:5233/issues
✓ Acme Tracker
  http://127.0.0.1:5233/issues
[exit 0]

$ npx genie-react status --wait 15000 --session upd-c --select /app
status: ok
selection: {expression:/app,matchedPathCount:1,matchedPaths:[/app],omittedPathCount:48}
result: {name:"Acme Tracker",url:http://127.0.0.1:5233/issues,reactVersion:18.3.1,reactMounted:true}
[exit 0]

$ agent-browser --session upd-c wait .issue-row
✓ Done
[exit 0]

$ agent-browser --session upd-c eval document.querySelectorAll\(\".issue-row\"\).length
100
[exit 0]

# Investigate: select one row with default budget

$ npx genie-react call react_clear_renders \{\"component\":\"IssueRow\"\} --session upd-c
ok: true
tracking: true
documentCommitId: 16
observation: {id:observation:1,epoch:1,startedAfterDocumentCommitId:16}
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

$ agent-browser --session upd-c click .issue-row:nth-child\(4\)\ input\[type=\"checkbox\"\]
✓ Done
[exit 0]

$ npx genie-react call react_quiesce \{\"idleMs\":500,\"timeoutMs\":10000\} --fail-on-result-error --session upd-c
ok: true
outcome: idle
elapsedMs: 966
observedCommits: 1
renderWindow: {id:observation:1,startedAfterDocumentCommitId:16,commits:2}
documentCommitId: 18
sessionId: 9e3b9443-f06a-4a9a-b17c-838c8e6e3b12
renderCollection: available
pendingWork:
  documentCommitId: 18
  scheduledRoots: 0
  suspendedBoundaries: 0
  dehydratedBoundaries: 0
  boundaries: []
  scanTruncated: false
  scannedFibers: 2258
[exit 0]

$ npx genie-react call react_component_cohort \{\"component\":\"IssueRow\",\"exact\":true,\"limit\":3\} --session upd-c
attribution:
  status: current
  startedAtDocumentCommitId: 18
  completedAtDocumentCommitId: 18
  startedAtAnalysisGeneration: 19
  completedAtAnalysisGeneration: 19
documentCommitId: 18
ownershipCoverage:
  complete: true
  totalCandidates: 100
  app: 100
  library: 0
  unknown: 0
  affects: ownership-labels
observation: {id:observation:1,epoch:1,startedAfterDocumentCommitId:16}
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
returned: 3
omittedByLimit: 97
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
  budgetAdvice:
    exhaustedLimits: [targetOperationReserve]
    suggestedBudget: {fiberLimit:750,operationLimit:90000,timeLimitMs:36,targetOperationReserve:12000,targetTimeReserveMs:12}
    next: "targetOperationReserve ran out. Run react_clear_renders with {\"budget\":{\"fiberLimit\":750,\"operationLimit\":90000,\"timeLimitMs\":36,\"targetOperationReserve\":12000,\"targetTimeReserveMs\":12}}, repeat the step, and read again."
  generationHistoryEvictions: 0
view: summary
shared:
  logicalPathPrefix: "AppErrorBoundary[index=0] > Provider[index=0] > BrowserRouter[index=0] > Router[index=0] > ThemeProvider[index=0] > App[index=0] > Routes[index=0] > RenderedRoute[index=0] > RequireAuth[index=0] > Connect(AppShell)[index=0] > AppShell[index=0] > FeatureFlagsProvider[index=0] > <div>[index=0] > <main>[index=2] > Outlet[index=0] > RenderedRoute[index=0] > IssuesPage[index=0] > <div>[index=0] > withRouter(Connect(IssueTable))[index=3] > Connect(IssueTable)[index=0] > IssueTable[index=0] > <div>[index=0] > <table>[index=0] > <tbody>[index=1]"
  componentName: IssueRow
  sourceOwnership: app
  source: ~/.t3/worktrees/genie-react/t3-090de32c-b027366200f6923c/apps/realworld-legacy/src/features/issues/issue-table.tsx:48:15
  parent: {fiberId:92056584376,name:IssueTable,key:null}
  keyedParent: null
  logicalIdentityEvidence: keyed
  mountGenerationEvidence: exact
  renderingState: mounted-rendering
  reactVisibility: not-hidden
instances[3]:
  each: {status:mounted-updated,mountGeneration:1,hostSelector:tr.issue-row}
  - {mountId:mount:1,fiberId:92056584401,key:iss-1,siblingIndex:0,logicalPath:"IssueRow[key=\"iss-1\"]"}
  - {mountId:mount:2,fiberId:92056584421,key:iss-27,siblingIndex:1,logicalPath:"IssueRow[key=\"iss-27\"]"}
  - {mountId:mount:3,fiberId:92056584441,key:iss-37,siblingIndex:2,logicalPath:"IssueRow[key=\"iss-37\"]"}
[exit 0]

$ npx genie-react call react_render_causes \{\"component\":\"IssueRow\",\"limit\":3\} --session upd-c
componentMatch:
  component: IssueRow
  exact: true
  status: matched
  matchedNames: [IssueRow]
  matchedNameCount: 1
  similarNames: []
tracking: true
commits: 3
documentCommitId: 19
observation: {id:observation:1,epoch:1,startedAfterDocumentCommitId:16}
attribution:
  status: current
  startedAtDocumentCommitId: 19
  completedAtDocumentCommitId: 19
  startedAtAnalysisGeneration: 20
  completedAtAnalysisGeneration: 20
view: summary
events[3] (componentName #componentId {fields}, then ← kind evidence name {fields} per cause):
  each: {documentCommitId:17,necessity:unknown,necessityReason:callbacks-changed,inputEvidence:changed,source:{location:~/.t3/worktrees/genie-react/t3-090de32c-b027366200f6923c/apps/realworld-legacy/src/features/issues/issue-table.tsx:48:15,role:element-callsite,ownership:app}}
  IssueRow #92056585053 {renderEventId:render:17:34,mountId:mount:34,key:iss-369}
    ← props exact onToggle
  IssueRow #92056585033 {renderEventId:render:17:33,mountId:mount:33,key:iss-368}
    ← props exact onToggle
  IssueRow #92056585013 {renderEventId:render:17:32,mountId:mount:32,key:iss-362}
    ← props exact onToggle
omittedByLimit: 31
sourceClassification:
  complete: true
  affects: result
  totalCandidates: 34
  evaluated: 34
  app: 34
  library: 0
  unknown: 0
  unknownComponents: []
  unknownComponentsOmitted: 0
renderEventRetention: {evictedEvents:0,earliestDocumentCommitId:17,latestDocumentCommitId:19}
coverage:
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
  budgetAdvice:
    exhaustedLimits: [targetOperationReserve]
    suggestedBudget: {fiberLimit:750,operationLimit:90000,timeLimitMs:36,targetOperationReserve:12000,targetTimeReserveMs:12}
    next: "targetOperationReserve ran out. Run react_clear_renders with {\"budget\":{\"fiberLimit\":750,\"operationLimit\":90000,\"timeLimitMs\":36,\"targetOperationReserve\":12000,\"targetTimeReserveMs\":12}}, repeat the step, and read again."
  incompleteBecause[2]:
    - {reason:budget-exhausted,fibers:66,detail:"1 commits ran out of analysis budget.",next:"targetOperationReserve ran out. Run react_clear_renders with {\"budget\":{\"fiberLimit\":750,\"operationLimit\":90000,\"timeLimitMs\":36,\"targetOperationReserve\":12000,\"targetTimeReserveMs\":12}}, repeat the step, and read again."}
    - {reason:inputs-truncated,fibers:1,components:[IssueTableToolbar],detail:"An input held values Genie compares only in part, such as functions, class instances or objects past the inspected depth; read deepDiff.truncated on these components."}
  complete: false
  inputAttributionComplete: false
  semantics: lower-bound
  coverageDomain: render-causality
  droppedRenderEvents: 0
[exit 0]

# Repeat with the budget from budgetAdvice

$ npx genie-react call react_clear_renders \{\"component\":\"IssueRow\",\"budget\":\{\"fiberLimit\":750,\"operationLimit\":90000,\"timeLimitMs\":36,\"targetOperationReserve\":12000,\"targetTimeReserveMs\":12\}\} --session upd-c
ok: true
tracking: true
documentCommitId: 28
observation: {id:observation:2,epoch:2,startedAfterDocumentCommitId:28}
observationConfig:
  adaptive: true
  adaptiveScale: 1
  fiberLimit: 750
  operationLimit: 90000
  timeLimitMs: 36
  targetOperationReserve: 12000
  targetTimeReserveMs: 12
  lifecycleBufferLimit: 1000
  lifecycleTargetReserve: 100
strictMode: on
[exit 0]

$ agent-browser --session upd-c click .issue-row:nth-child\(5\)\ input\[type=\"checkbox\"\]
✓ Done
[exit 0]

$ npx genie-react call react_quiesce \{\"idleMs\":500,\"timeoutMs\":10000\} --fail-on-result-error --session upd-c
ok: true
outcome: idle
elapsedMs: 956
observedCommits: 1
renderWindow: {id:observation:2,startedAfterDocumentCommitId:28,commits:2}
documentCommitId: 30
sessionId: 9e3b9443-f06a-4a9a-b17c-838c8e6e3b12
renderCollection: available
pendingWork:
  documentCommitId: 30
  scheduledRoots: 0
  suspendedBoundaries: 0
  dehydratedBoundaries: 0
  boundaries: []
  scanTruncated: false
  scannedFibers: 2258
[exit 0]

$ npx genie-react call react_component_cohort \{\"component\":\"IssueRow\",\"exact\":true,\"limit\":3\} --session upd-c
attribution:
  status: current
  startedAtDocumentCommitId: 30
  completedAtDocumentCommitId: 30
  startedAtAnalysisGeneration: 32
  completedAtAnalysisGeneration: 32
documentCommitId: 30
ownershipCoverage:
  complete: true
  totalCandidates: 100
  app: 100
  library: 0
  unknown: 0
  affects: ownership-labels
observation: {id:observation:2,epoch:2,startedAfterDocumentCommitId:28}
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
returned: 3
omittedByLimit: 97
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
  source: ~/.t3/worktrees/genie-react/t3-090de32c-b027366200f6923c/apps/realworld-legacy/src/features/issues/issue-table.tsx:48:15
  parent: {fiberId:92056584376,name:IssueTable,key:null}
  keyedParent: null
  logicalIdentityEvidence: keyed
  mountGenerationEvidence: exact
  renderingState: mounted-rendering
  reactVisibility: not-hidden
instances[3]:
  each: {status:mounted-updated,mountGeneration:1,hostSelector:tr.issue-row}
  - {mountId:mount:1,fiberId:92056584401,key:iss-1,siblingIndex:0,logicalPath:"IssueRow[key=\"iss-1\"]"}
  - {mountId:mount:2,fiberId:92056584421,key:iss-27,siblingIndex:1,logicalPath:"IssueRow[key=\"iss-27\"]"}
  - {mountId:mount:3,fiberId:92056584441,key:iss-37,siblingIndex:2,logicalPath:"IssueRow[key=\"iss-37\"]"}
[exit 0]

$ npx genie-react call react_render_causes \{\"component\":\"IssueRow\",\"limit\":3\} --session upd-c
componentMatch:
  component: IssueRow
  exact: true
  status: matched
  matchedNames: [IssueRow]
  matchedNameCount: 1
  similarNames: []
tracking: true
commits: 3
documentCommitId: 31
observation: {id:observation:2,epoch:2,startedAfterDocumentCommitId:28}
attribution:
  status: current
  startedAtDocumentCommitId: 31
  completedAtDocumentCommitId: 31
  startedAtAnalysisGeneration: 33
  completedAtAnalysisGeneration: 33
view: summary
events[3] (componentName #componentId {fields}, then ← kind evidence name {fields} per cause):
  each: {documentCommitId:29,necessity:unknown,necessityReason:callbacks-changed,inputEvidence:changed,source:{location:~/.t3/worktrees/genie-react/t3-090de32c-b027366200f6923c/apps/realworld-legacy/src/features/issues/issue-table.tsx:48:15,role:element-callsite,ownership:app}}
  IssueRow #92056586364 {renderEventId:render:29:882,mountId:mount:521,key:iss-1754}
    ← props exact onToggle
  IssueRow #92056586345 {renderEventId:render:29:881,mountId:mount:520,key:iss-1700}
    ← props exact onToggle
  IssueRow #92056586325 {renderEventId:render:29:880,mountId:mount:519,key:iss-1681}
    ← props exact onToggle
omittedByLimit: 97
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
renderEventRetention: {evictedEvents:0,earliestDocumentCommitId:29,latestDocumentCommitId:31}
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

$ npx genie-react call react_render_causes \{\"component\":\"IssueRow\",\"limit\":1,\"view\":\"full\"\} --session upd-c
componentMatch:
  component: IssueRow
  exact: true
  status: matched
  matchedNames: [IssueRow]
  matchedNameCount: 1
  similarNames: []
tracking: true
commits: 3
documentCommitId: 31
observation: {id:observation:2,epoch:2,startedAfterDocumentCommitId:28}
attribution:
  status: current
  startedAtDocumentCommitId: 31
  completedAtDocumentCommitId: 31
  startedAtAnalysisGeneration: 33
  completedAtAnalysisGeneration: 33
view: full
events[1] (componentName #componentId {fields}, then ← kind evidence name {fields} per cause):
  IssueRow #92056586364 {renderEventId:render:29:882,observationId:observation:2,commitId:1,documentCommitId:29,instance:{fiberId:92056586364,mountId:mount:521,key:iss-1754,siblingIndex:99,parent:{fiberId:92056584376,name:IssueTable,key:null},keyedParent:null,logicalPath:"AppErrorBoundary[index=0] > Provider[index=0] > BrowserRouter[index=0] > Router[index=0] > ThemeProvider[index=0] > App[index=0] > Routes[index=0] > RenderedRoute[index=0] > RequireAuth[index=0] > Connect(AppShell)[index=0] > AppShell[index=0] > FeatureFlagsProvider[index=0] > <div>[index=0] > <main>[index=2] > Outlet[index=0] > RenderedRoute[index=0] > IssuesPage[index=0] > <div>[index=0] > withRouter(Connect(IssueTable))[index=3] > Connect(IssueTable)[index=0] > IssueTable[index=0] > <div>[index=0] > <table>[index=0] > <tbody>[index=1] > IssueRow[key=\"iss-1754\"]",logicalIdentityEvidence:keyed,mountGeneration:1,mountGenerationEvidence:exact,hostSelector:null},necessity:unknown,necessityReason:callbacks-changed,assessment:{inputEvidence:changed,observedInputKinds:[props],behaviorEvidence:{subtreeHostMutations:{status:none-observed,count:0,pendingSubtrees:0,omittedByLimit:0,callbackOnlyUpdates:2,writes:[],callbacks:[input.onChange,button.onClick]},scheduledEffects:{status:none-observed,count:0},subtreeScheduledEffects:{status:none-observed,count:0},unobservedDomains:[focus,url,network,transition,freshness,effect-execution]},optimizationSafety:not-proven-safe,requiredValidation:[dom,aria,focus,url,network,transition]},inputCoverage:{complete:true,omittedInputs:0,scanTruncated:false,propsNotEnumerated:false},source:{file:~/.t3/worktrees/genie-react/t3-090de32c-b027366200f6923c/apps/realworld-legacy/src/features/issues/issue-table.tsx,line:48,column:15,functionName:null,sourceMapConfidence:served,role:element-callsite},sourceAttribution:{role:usage-or-definition-fallback,evidence:inferred},sourceOwnership:app,isLibrary:false}
    ← props exact onToggle {referenceChanged:true,referenceOnly:false,unstable:true,beforePresent:true,afterPresent:true,before:{__genie_dehydrated__:true,kind:function,preview:"ƒ onToggle()",path:[]},after:{__genie_dehydrated__:true,kind:function,preview:"ƒ onToggle()",path:[]},deepDiff:{changes:[{kind:identity-changed-uninspected,path:""}],visited:1,truncated:true}}
omittedByLimit: 99
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
renderEventRetention: {evictedEvents:0,earliestDocumentCommitId:29,latestDocumentCommitId:31}
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

# Verify before the fix

$ npx genie-react verify begin --name select\ one\ issue\ row --claim render\ IssueRow\ max\ 1 --claim render\ IssueTable\ min\ 1 --claim boundaries\ clean --session upd-c
recording vfy_7b9029bd-f414-490b-acc9-9d1db6709dd8 "select one issue row"
  url "http://127.0.0.1:5233/issues"
  1 recording render IssueRow max 1
  2 recording render IssueTable min 1
  3 recording boundaries clean
window: {observationId:observation:3,startDocumentCommitId:40,domains:[react],quietMs:500,timeoutMs:10000,tailMs:500}
next: $ npx genie-react verify end vfy_7b9029bd-f414-490b-acc9-9d1db6709dd8 --session upd-c
session: {sessionId:9e3b9443-f06a-4a9a-b17c-838c8e6e3b12,logicalSessionId:e3bf1489-86ce-4bcb-9de1-5f396364758d,documentGeneration:9}
schemaVersion: "1.0"
targets: [{target:{component:IssueRow},status:resolved,instances:100,source:~/.t3/worktrees/genie-react/t3-090de32c-b027366200f6923c/apps/realworld-legacy/src/features/issues/issue-table.tsx},{target:{component:IssueTable},status:resolved,instances:1,source:~/.t3/worktrees/genie-react/t3-090de32c-b027366200f6923c/apps/realworld-legacy/src/features/issues/issue-table.tsx}]
startedAt: 2026-11-19T08:59:40.835Z
expiresAt: 2026-11-19T09:04:40.848Z
request: {budget:{fiberLimit:250,operationLimit:20000,timeLimitMs:8,targetOperationReserve:4000,targetTimeReserveMs:4,adaptive:true},settle:{quietMs:500,timeoutMs:10000},maxDurationMs:300000,allowOverrides:false}
[exit 0]

$ agent-browser --session upd-c click .issue-row:nth-child\(6\)\ input\[type=\"checkbox\"\]
✓ Done
[exit 0]

$ npx genie-react verify end vfy_7b9029bd-f414-490b-acc9-9d1db6709dd8 --session upd-c
fail vfy_7b9029bd-f414-490b-acc9-9d1db6709dd8 "select one issue row"  13 commits, quiet after 649 ms (react)
  url "http://127.0.0.1:5233/issues"
  1 fail render IssueRow max 1  {renders:90,mounts:0,updates:90,remounts:0,semantics:lower-bound,instances:100,activeInstances:100}
      claim: {kind:renders,target:{component:IssueRow},max:1,counting:renders,allowRemount:false}
      deciding: [{kind:instance,mountId:mount:1,key:iss-1,renders:3,mounts:0,updates:3,mountGeneration:1,latestDocumentCommitId:53,source:~/.t3/worktrees/genie-react/t3-090de32c-b027366200f6923c/apps/realworld-legacy/src/features/issues/issue-table.tsx:48:15},{kind:instance,mountId:mount:2,key:iss-27,renders:3,mounts:0,updates:3,mountGeneration:1,latestDocumentCommitId:53,source:~/.t3/worktrees/genie-react/t3-090de32c-b027366200f6923c/apps/realworld-legacy/src/features/issues/issue-table.tsx:48:15},{kind:instance,mountId:mount:3,key:iss-37,renders:3,mounts:0,updates:3,mountGeneration:1,latestDocumentCommitId:53,source:~/.t3/worktrees/genie-react/t3-090de32c-b027366200f6923c/apps/realworld-legacy/src/features/issues/issue-table.tsx:48:15}]
  2 pass render IssueTable min 1  {renders:3,mounts:0,updates:3,remounts:0,semantics:lower-bound,instances:1,activeInstances:1}
      claim: {kind:renders,target:{component:IssueTable},min:1,counting:renders,allowRemount:false}
      deciding: [{kind:instance,mountId:mount:52,renders:3,mounts:0,updates:3,mountGeneration:1,latestDocumentCommitId:53,source:~/.t3/worktrees/genie-react/t3-090de32c-b027366200f6923c/apps/realworld-legacy/src/features/issues/issue-table.tsx:43:7}]
      caveats: [count-is-a-lower-bound]
  3 pass boundaries clean  {caughtDuringWindow:0,caughtAtEnd:0}
      claim: {kind:boundaries-clean,scope:window}
      deciding: [{kind:boundary-log,scope:window,complete:true,afterDocumentCommitId:40}]
      caveats: [uncaught-errors-outside-boundaries-unobserved]
window: {observationId:observation:3,startDocumentCommitId:40,settledDocumentCommitId:50,frozenDocumentCommitId:53,commits:13,settle:{outcome:met,quietMs:500,timeoutMs:10000,waitedMs:649,domains:{react:met}},tail:{ms:500,commits:3},environment:{bundle:development,strictMode:on,renderCollection:available,visibility:unavailable}}
! ui-outcome-not-observed: Genie does not check the screen; confirm it with the UI driver
! visibility-unobserved: the app reports no visibility signal, so a hidden interval was not observed
attempt 1 for these claims on this tab
evidence: $ npx genie-react verify show vfy_7b9029bd-f414-490b-acc9-9d1db6709dd8 --claim 1 --session upd-c
session: {sessionId:9e3b9443-f06a-4a9a-b17c-838c8e6e3b12,logicalSessionId:e3bf1489-86ce-4bcb-9de1-5f396364758d,documentGeneration:9}
schemaVersion: "1.0"
exitCode: 1
stage: end
ledger: {fingerprint:cf_3fb208467104,scope:logical-session,storage:memory,attempt:1,history:[],codeChangedSincePrevious:null,failsOnSameCode:0}
evidence: {retained:true,tools:[react_get_renders,react_component_cohort,react_list_overrides,react_refresh_events,react_profile_stop,react_error_state]}
startedAt: 2026-11-19T08:59:40.835Z
endedAt: 2026-11-19T08:59:51.154Z
request: {budget:{fiberLimit:250,operationLimit:20000,timeLimitMs:8,targetOperationReserve:4000,targetTimeReserveMs:4,adaptive:true},settle:{quietMs:500,timeoutMs:10000},maxDurationMs:300000,allowOverrides:false}
[exit 1]

# Verify before the fix, with the budget Genie advised

$ npx genie-react verify begin --name select\ one\ issue\ row --claim render\ IssueRow\ max\ 1 --claim render\ IssueTable\ min\ 1 --claim boundaries\ clean --budget \{\"fiberLimit\":750,\"operationLimit\":90000,\"timeLimitMs\":36,\"targetOperationReserve\":12000,\"targetTimeReserveMs\":12\} --session upd-c
recording vfy_d8a59fdb-cd65-46f3-abce-ce0c38bac77c "select one issue row"
  url "http://127.0.0.1:5233/issues"
  1 recording render IssueRow max 1
  2 recording render IssueTable min 1
  3 recording boundaries clean
window: {observationId:observation:4,startDocumentCommitId:53,domains:[react],quietMs:500,timeoutMs:10000,tailMs:500}
next: $ npx genie-react verify end vfy_d8a59fdb-cd65-46f3-abce-ce0c38bac77c --session upd-c
session: {sessionId:9e3b9443-f06a-4a9a-b17c-838c8e6e3b12,logicalSessionId:e3bf1489-86ce-4bcb-9de1-5f396364758d,documentGeneration:9}
schemaVersion: "1.0"
targets: [{target:{component:IssueRow},status:resolved,instances:100,source:~/.t3/worktrees/genie-react/t3-090de32c-b027366200f6923c/apps/realworld-legacy/src/features/issues/issue-table.tsx},{target:{component:IssueTable},status:resolved,instances:1,source:~/.t3/worktrees/genie-react/t3-090de32c-b027366200f6923c/apps/realworld-legacy/src/features/issues/issue-table.tsx}]
startedAt: 2026-11-19T08:59:51.399Z
expiresAt: 2026-11-19T09:04:51.410Z
request: {budget:{fiberLimit:750,operationLimit:90000,timeLimitMs:36,targetOperationReserve:12000,targetTimeReserveMs:12,adaptive:true},settle:{quietMs:500,timeoutMs:10000},maxDurationMs:300000,allowOverrides:false}
[exit 0]

$ agent-browser --session upd-c click .issue-row:nth-child\(7\)\ input\[type=\"checkbox\"\]
✓ Done
[exit 0]

$ npx genie-react verify end vfy_d8a59fdb-cd65-46f3-abce-ce0c38bac77c --session upd-c
fail vfy_d8a59fdb-cd65-46f3-abce-ce0c38bac77c "select one issue row"  3 commits, quiet after 798 ms (react)
  url "http://127.0.0.1:5233/issues"
  1 fail render IssueRow max 1  {renders:100,mounts:0,updates:100,remounts:0,semantics:lower-bound,instances:100,activeInstances:100}
      claim: {kind:renders,target:{component:IssueRow},max:1,counting:renders,allowRemount:false}
      deciding: [{kind:instance,mountId:mount:1,key:iss-1,renders:1,mounts:0,updates:1,mountGeneration:1,latestDocumentCommitId:54,source:~/.t3/worktrees/genie-react/t3-090de32c-b027366200f6923c/apps/realworld-legacy/src/features/issues/issue-table.tsx:48:15},{kind:instance,mountId:mount:2,key:iss-27,renders:1,mounts:0,updates:1,mountGeneration:1,latestDocumentCommitId:54,source:~/.t3/worktrees/genie-react/t3-090de32c-b027366200f6923c/apps/realworld-legacy/src/features/issues/issue-table.tsx:48:15},{kind:instance,mountId:mount:3,key:iss-37,renders:1,mounts:0,updates:1,mountGeneration:1,latestDocumentCommitId:54,source:~/.t3/worktrees/genie-react/t3-090de32c-b027366200f6923c/apps/realworld-legacy/src/features/issues/issue-table.tsx:48:15}]
  2 pass render IssueTable min 1  {renders:1,mounts:0,updates:1,remounts:0,semantics:lower-bound,instances:1,activeInstances:1}
      claim: {kind:renders,target:{component:IssueTable},min:1,counting:renders,allowRemount:false}
      deciding: [{kind:instance,mountId:mount:52,renders:1,mounts:0,updates:1,mountGeneration:1,latestDocumentCommitId:54,source:~/.t3/worktrees/genie-react/t3-090de32c-b027366200f6923c/apps/realworld-legacy/src/features/issues/issue-table.tsx:43:7}]
      caveats: [count-is-a-lower-bound]
  3 pass boundaries clean  {caughtDuringWindow:0,caughtAtEnd:0}
      claim: {kind:boundaries-clean,scope:window}
      deciding: [{kind:boundary-log,scope:window,complete:true,afterDocumentCommitId:53}]
      caveats: [uncaught-errors-outside-boundaries-unobserved]
window: {observationId:observation:4,startDocumentCommitId:53,settledDocumentCommitId:55,frozenDocumentCommitId:56,commits:3,settle:{outcome:met,quietMs:500,timeoutMs:10000,waitedMs:798,domains:{react:met}},tail:{ms:500,commits:1},environment:{bundle:development,strictMode:on,renderCollection:available,visibility:unavailable}}
! ui-outcome-not-observed: Genie does not check the screen; confirm it with the UI driver
! visibility-unobserved: the app reports no visibility signal, so a hidden interval was not observed
attempt 2 for these claims on this tab; previous fail vfy_7b9029bd-f414-490b-acc9-9d1db6709dd8; no code change observed
evidence: $ npx genie-react verify show vfy_d8a59fdb-cd65-46f3-abce-ce0c38bac77c --claim 1 --session upd-c
session: {sessionId:9e3b9443-f06a-4a9a-b17c-838c8e6e3b12,logicalSessionId:e3bf1489-86ce-4bcb-9de1-5f396364758d,documentGeneration:9}
schemaVersion: "1.0"
exitCode: 1
stage: end
ledger: {fingerprint:cf_3fb208467104,scope:logical-session,storage:memory,attempt:2,history:[{verificationId:vfy_7b9029bd-f414-490b-acc9-9d1db6709dd8,verdict:fail,reasons:[],endedAt:2026-11-19T08:59:51.154Z}],codeChangedSincePrevious:none-observed,failsOnSameCode:1}
evidence: {retained:true,tools:[react_get_renders,react_component_cohort,react_list_overrides,react_refresh_events,react_profile_stop,react_error_state]}
startedAt: 2026-11-19T08:59:51.399Z
endedAt: 2026-11-19T08:59:53.035Z
request: {budget:{fiberLimit:750,operationLimit:90000,timeLimitMs:36,targetOperationReserve:12000,targetTimeReserveMs:12,adaptive:true},settle:{quietMs:500,timeoutMs:10000},maxDurationMs:300000,allowOverrides:false}
[exit 1]

# Verify before the fix with the default budget, repeated with begin, click and end back to back (the run above had 10 s between begin and click)

$ npx genie-react verify begin --name select\ one\ issue\ row --claim render\ IssueRow\ max\ 1 --claim render\ IssueTable\ min\ 1 --claim boundaries\ clean --session upd-c
recording vfy_40bab0be-c9db-4862-8fcf-593aee12dc03 "select one issue row"
  url "http://127.0.0.1:5233/issues"
  1 recording render IssueRow max 1
  2 recording render IssueTable min 1
  3 recording boundaries clean
window: {observationId:observation:5,startDocumentCommitId:66,domains:[react],quietMs:500,timeoutMs:10000,tailMs:500}
next: $ npx genie-react verify end vfy_40bab0be-c9db-4862-8fcf-593aee12dc03 --session upd-c
session: {sessionId:9e3b9443-f06a-4a9a-b17c-838c8e6e3b12,logicalSessionId:e3bf1489-86ce-4bcb-9de1-5f396364758d,documentGeneration:9}
schemaVersion: "1.0"
targets: [{target:{component:IssueRow},status:resolved,instances:100,source:~/.t3/worktrees/genie-react/t3-090de32c-b027366200f6923c/apps/realworld-legacy/src/features/issues/issue-table.tsx},{target:{component:IssueTable},status:resolved,instances:1,source:~/.t3/worktrees/genie-react/t3-090de32c-b027366200f6923c/apps/realworld-legacy/src/features/issues/issue-table.tsx}]
startedAt: 2026-11-19T09:00:02.992Z
expiresAt: 2026-11-19T09:05:03.004Z
request: {budget:{fiberLimit:250,operationLimit:20000,timeLimitMs:8,targetOperationReserve:4000,targetTimeReserveMs:4,adaptive:true},settle:{quietMs:500,timeoutMs:10000},maxDurationMs:300000,allowOverrides:false}
[exit 0]

$ agent-browser --session upd-c click .issue-row:nth-child\(8\)\ input\[type=\"checkbox\"\]
✓ Done
[exit 0]

$ npx genie-react verify end vfy_40bab0be-c9db-4862-8fcf-593aee12dc03 --session upd-c
fail vfy_40bab0be-c9db-4862-8fcf-593aee12dc03 "select one issue row"  3 commits, quiet after 1107 ms (react)
  url "http://127.0.0.1:5233/issues"
  1 fail render IssueRow max 1  {renders:28,mounts:0,updates:28,remounts:0,semantics:lower-bound,instances:100,activeInstances:100}
      claim: {kind:renders,target:{component:IssueRow},max:1,counting:renders,allowRemount:false}
      deciding: [{kind:instance,mountId:mount:1,key:iss-1,renders:1,mounts:0,updates:1,mountGeneration:1,latestDocumentCommitId:67,source:~/.t3/worktrees/genie-react/t3-090de32c-b027366200f6923c/apps/realworld-legacy/src/features/issues/issue-table.tsx:48:15},{kind:instance,mountId:mount:2,key:iss-27,renders:1,mounts:0,updates:1,mountGeneration:1,latestDocumentCommitId:67,source:~/.t3/worktrees/genie-react/t3-090de32c-b027366200f6923c/apps/realworld-legacy/src/features/issues/issue-table.tsx:48:15},{kind:instance,mountId:mount:3,key:iss-37,renders:1,mounts:0,updates:1,mountGeneration:1,latestDocumentCommitId:67,source:~/.t3/worktrees/genie-react/t3-090de32c-b027366200f6923c/apps/realworld-legacy/src/features/issues/issue-table.tsx:48:15}]
  2 pass render IssueTable min 1  {renders:1,mounts:0,updates:1,remounts:0,semantics:lower-bound,instances:1,activeInstances:1}
      claim: {kind:renders,target:{component:IssueTable},min:1,counting:renders,allowRemount:false}
      deciding: [{kind:instance,mountId:mount:52,renders:1,mounts:0,updates:1,mountGeneration:1,latestDocumentCommitId:67,source:~/.t3/worktrees/genie-react/t3-090de32c-b027366200f6923c/apps/realworld-legacy/src/features/issues/issue-table.tsx:43:7}]
      caveats: [count-is-a-lower-bound]
  3 pass boundaries clean  {caughtDuringWindow:0,caughtAtEnd:0}
      claim: {kind:boundaries-clean,scope:window}
      deciding: [{kind:boundary-log,scope:window,complete:true,afterDocumentCommitId:66}]
      caveats: [uncaught-errors-outside-boundaries-unobserved]
window: {observationId:observation:5,startDocumentCommitId:66,settledDocumentCommitId:68,frozenDocumentCommitId:69,commits:3,settle:{outcome:met,quietMs:500,timeoutMs:10000,waitedMs:1107,domains:{react:met}},tail:{ms:500,commits:1},environment:{bundle:development,strictMode:on,renderCollection:available,visibility:unavailable}}
! ui-outcome-not-observed: Genie does not check the screen; confirm it with the UI driver
! visibility-unobserved: the app reports no visibility signal, so a hidden interval was not observed
attempt 3 for these claims on this tab; previous fail vfy_d8a59fdb-cd65-46f3-abce-ce0c38bac77c; no code change observed
evidence: $ npx genie-react verify show vfy_40bab0be-c9db-4862-8fcf-593aee12dc03 --claim 1 --session upd-c
session: {sessionId:9e3b9443-f06a-4a9a-b17c-838c8e6e3b12,logicalSessionId:e3bf1489-86ce-4bcb-9de1-5f396364758d,documentGeneration:9}
schemaVersion: "1.0"
exitCode: 1
stage: end
ledger: {fingerprint:cf_3fb208467104,scope:logical-session,storage:memory,attempt:3,history:[{verificationId:vfy_7b9029bd-f414-490b-acc9-9d1db6709dd8,verdict:fail,reasons:[],endedAt:2026-11-19T08:59:51.154Z},{verificationId:vfy_d8a59fdb-cd65-46f3-abce-ce0c38bac77c,verdict:fail,reasons:[],endedAt:2026-11-19T08:59:53.035Z}],codeChangedSincePrevious:none-observed,failsOnSameCode:2}
evidence: {retained:true,tools:[react_get_renders,react_component_cohort,react_list_overrides,react_refresh_events,react_profile_stop,react_error_state]}
startedAt: 2026-11-19T09:00:02.992Z
endedAt: 2026-11-19T09:00:04.914Z
request: {budget:{fiberLimit:250,operationLimit:20000,timeLimitMs:8,targetOperationReserve:4000,targetTimeReserveMs:4,adaptive:true},settle:{quietMs:500,timeoutMs:10000},maxDurationMs:300000,allowOverrides:false}
[exit 1]

# Apply the reference fix

$ node /tmp/upd-c/apply-fix.mjs issue-row-inline-handler
applied 3 edits
[exit 0]

$ git diff -- src
diff --git a/apps/realworld-legacy/src/features/issues/issue-row.tsx b/apps/realworld-legacy/src/features/issues/issue-row.tsx
index b790cc6..636ec0c 100644
--- a/apps/realworld-legacy/src/features/issues/issue-row.tsx
+++ b/apps/realworld-legacy/src/features/issues/issue-row.tsx
@@ -7,24 +7,24 @@ import { UserName } from '../../components/user-name'
 interface IssueRowProps {
   issue: Issue
   selected: boolean
-  onToggle: () => void
+  onToggle: (id: string) => void
   onOpen: (key: string) => void
 }
 
 export class IssueRow extends PureComponent<IssueRowProps> {
   render() {
     const { issue, selected, onToggle, onOpen } = this.props
     return (
       <tr
         className={selected ? 'issue-row issue-row--selected' : 'issue-row'}
         data-issue-key={issue.key}
       >
         <td>
           <input
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
[exit 0]

# Reload and verify after the fix

$ agent-browser --session upd-c open http://127.0.0.1:5233/issues
✓ Acme Tracker
  http://127.0.0.1:5233/issues
[exit 0]

$ npx genie-react status --wait 15000 --session upd-c --select /app
status: ok
selection: {expression:/app,matchedPathCount:1,matchedPaths:[/app],omittedPathCount:48}
result: {name:"Acme Tracker",url:http://127.0.0.1:5233/issues,reactVersion:18.3.1,reactMounted:true}
[exit 0]

$ agent-browser --session upd-c wait .issue-row
✓ Done
[exit 0]

$ npx genie-react verify begin --name select\ one\ issue\ row --claim render\ IssueRow\ max\ 1 --claim render\ IssueTable\ min\ 1 --claim boundaries\ clean --budget \{\"fiberLimit\":750,\"operationLimit\":90000,\"timeLimitMs\":36,\"targetOperationReserve\":12000,\"targetTimeReserveMs\":12\} --session upd-c
recording vfy_366cd00a-079a-44f3-8da9-9ea65203b808 "select one issue row"
  url "http://127.0.0.1:5233/issues"
  1 recording render IssueRow max 1
  2 recording render IssueTable min 1
  3 recording boundaries clean
window: {observationId:observation:1,startDocumentCommitId:16,domains:[react],quietMs:500,timeoutMs:10000,tailMs:500}
next: $ npx genie-react verify end vfy_366cd00a-079a-44f3-8da9-9ea65203b808 --session upd-c
session: {sessionId:f557c14c-458c-47f3-928a-d361010c9b84,logicalSessionId:e3bf1489-86ce-4bcb-9de1-5f396364758d,documentGeneration:11}
schemaVersion: "1.0"
targets: [{target:{component:IssueRow},status:resolved,instances:100,source:~/.t3/worktrees/genie-react/t3-090de32c-b027366200f6923c/apps/realworld-legacy/src/features/issues/issue-table.tsx},{target:{component:IssueTable},status:resolved,instances:1,source:~/.t3/worktrees/genie-react/t3-090de32c-b027366200f6923c/apps/realworld-legacy/src/features/issues/issue-table.tsx}]
startedAt: 2026-11-19T09:00:18.183Z
expiresAt: 2026-11-19T09:05:18.206Z
request: {budget:{fiberLimit:750,operationLimit:90000,timeLimitMs:36,targetOperationReserve:12000,targetTimeReserveMs:12,adaptive:true},settle:{quietMs:500,timeoutMs:10000},maxDurationMs:300000,allowOverrides:false}
[exit 0]

$ agent-browser --session upd-c click .issue-row:nth-child\(4\)\ input\[type=\"checkbox\"\]
✓ Done
[exit 0]

$ npx genie-react verify end vfy_366cd00a-079a-44f3-8da9-9ea65203b808 --session upd-c
pass vfy_366cd00a-079a-44f3-8da9-9ea65203b808 "select one issue row"  3 commits, quiet after 937 ms (react)
  url "http://127.0.0.1:5233/issues"
  1 pass render IssueRow max 1  {renders:1,mounts:0,updates:1,remounts:0,semantics:exact,instances:100,activeInstances:100}
      claim: {kind:renders,target:{component:IssueRow},max:1,counting:renders,allowRemount:false}
      deciding: [{kind:coverage,complete:true,targetedComplete:true,semantics:exact},{kind:instance,mountId:mount:1,renderingState:mounted-rendering,source:~/.t3/worktrees/genie-react/t3-090de32c-b027366200f6923c/apps/realworld-legacy/src/features/issues/issue-table.tsx:48:15},{kind:instance,mountId:mount:2,renderingState:mounted-rendering,source:~/.t3/worktrees/genie-react/t3-090de32c-b027366200f6923c/apps/realworld-legacy/src/features/issues/issue-table.tsx:48:15}]
  2 pass render IssueTable min 1  {renders:1,mounts:0,updates:1,remounts:0,semantics:exact,instances:1,activeInstances:1}
      claim: {kind:renders,target:{component:IssueTable},min:1,counting:renders,allowRemount:false}
      deciding: [{kind:instance,mountId:mount:101,renders:1,mounts:0,updates:1,mountGeneration:1,latestDocumentCommitId:17,source:~/.t3/worktrees/genie-react/t3-090de32c-b027366200f6923c/apps/realworld-legacy/src/features/issues/issue-table.tsx:43:7}]
  3 pass boundaries clean  {caughtDuringWindow:0,caughtAtEnd:0}
      claim: {kind:boundaries-clean,scope:window}
      deciding: [{kind:boundary-log,scope:window,complete:true,afterDocumentCommitId:16}]
      caveats: [uncaught-errors-outside-boundaries-unobserved]
window: {observationId:observation:1,startDocumentCommitId:16,settledDocumentCommitId:18,frozenDocumentCommitId:19,commits:3,settle:{outcome:met,quietMs:500,timeoutMs:10000,waitedMs:937,domains:{react:met}},tail:{ms:500,commits:1},environment:{bundle:development,strictMode:on,renderCollection:available,visibility:unavailable}}
! ui-outcome-not-observed: Genie does not check the screen; confirm it with the UI driver
! visibility-unobserved: the app reports no visibility signal, so a hidden interval was not observed
attempt 4 for these claims on this tab; previous fail vfy_40bab0be-c9db-4862-8fcf-593aee12dc03; document reloaded since
evidence: $ npx genie-react verify show vfy_366cd00a-079a-44f3-8da9-9ea65203b808 --session upd-c
session: {sessionId:f557c14c-458c-47f3-928a-d361010c9b84,logicalSessionId:e3bf1489-86ce-4bcb-9de1-5f396364758d,documentGeneration:11}
schemaVersion: "1.0"
exitCode: 0
stage: end
ledger: {fingerprint:cf_3fb208467104,scope:logical-session,storage:memory,attempt:4,history:[{verificationId:vfy_7b9029bd-f414-490b-acc9-9d1db6709dd8,verdict:fail,reasons:[],endedAt:2026-11-19T08:59:51.154Z},{verificationId:vfy_d8a59fdb-cd65-46f3-abce-ce0c38bac77c,verdict:fail,reasons:[],endedAt:2026-11-19T08:59:53.035Z},{verificationId:vfy_40bab0be-c9db-4862-8fcf-593aee12dc03,verdict:fail,reasons:[],endedAt:2026-11-19T09:00:04.914Z}],codeChangedSincePrevious:document-reloaded,failsOnSameCode:0}
evidence: {retained:true,tools:[react_get_renders,react_component_cohort,react_list_overrides,react_refresh_events,react_profile_stop,react_error_state]}
startedAt: 2026-11-19T09:00:18.183Z
endedAt: 2026-11-19T09:00:19.919Z
request: {budget:{fiberLimit:750,operationLimit:90000,timeLimitMs:36,targetOperationReserve:12000,targetTimeReserveMs:12,adaptive:true},settle:{quietMs:500,timeoutMs:10000},maxDurationMs:300000,allowOverrides:false}
[exit 0]

# Confirm the screen

$ agent-browser --session upd-c is checked .issue-row:nth-child\(4\)\ input\[type=\"checkbox\"\]
true
[exit 0]

# Cohort after the fix

$ npx genie-react call react_clear_renders \{\"component\":\"IssueRow\",\"budget\":\{\"fiberLimit\":750,\"operationLimit\":90000,\"timeLimitMs\":36,\"targetOperationReserve\":12000,\"targetTimeReserveMs\":12\}\} --session upd-c --select /ok
status: ok
selection: {expression:/ok,matchedPathCount:1,matchedPaths:[/ok],omittedPathCount:15}
result: true
[exit 0]

$ agent-browser --session upd-c click .issue-row:nth-child\(9\)\ input\[type=\"checkbox\"\]
✓ Done
[exit 0]

$ npx genie-react call react_quiesce \{\"idleMs\":500,\"timeoutMs\":10000\} --fail-on-result-error --session upd-c --select /outcome
status: ok
selection: {expression:/outcome,matchedPathCount:1,matchedPaths:[/outcome],omittedPathCount:16}
result: idle
[exit 0]

$ npx genie-react call react_component_cohort \{\"component\":\"IssueRow\",\"exact\":true,\"limit\":3\} --session upd-c
attribution:
  status: current
  startedAtDocumentCommitId: 30
  completedAtDocumentCommitId: 30
  startedAtAnalysisGeneration: 32
  completedAtAnalysisGeneration: 32
documentCommitId: 30
ownershipCoverage:
  complete: true
  totalCandidates: 100
  app: 100
  library: 0
  unknown: 0
  affects: ownership-labels
observation: {id:observation:2,epoch:2,startedAfterDocumentCommitId:28}
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
returned: 3
omittedByLimit: 97
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
  source: ~/.t3/worktrees/genie-react/t3-090de32c-b027366200f6923c/apps/realworld-legacy/src/features/issues/issue-table.tsx:48:15
  parent: {fiberId:11840604078105,name:IssueTable,key:null}
  keyedParent: null
  logicalIdentityEvidence: keyed
  mountGenerationEvidence: exact
  renderingState: mounted-rendering
  reactVisibility: not-hidden
instances[3]:
  each: {status:mounted-idle,mountGeneration:1,hostSelector:tr.issue-row}
  - {mountId:mount:1,fiberId:11840604078104,key:iss-1,siblingIndex:0,logicalPath:"IssueRow[key=\"iss-1\"]"}
  - {mountId:mount:2,fiberId:11840604078106,key:iss-27,siblingIndex:1,logicalPath:"IssueRow[key=\"iss-27\"]"}
  - {mountId:mount:3,fiberId:11840604078107,key:iss-37,siblingIndex:2,logicalPath:"IssueRow[key=\"iss-37\"]"}
[exit 0]

$ npx genie-react call react_render_causes \{\"component\":\"IssueRow\",\"limit\":3\} --session upd-c
componentMatch:
  component: IssueRow
  exact: true
  status: matched
  matchedNames: [IssueRow]
  matchedNameCount: 1
  similarNames: []
tracking: true
commits: 3
documentCommitId: 31
observation: {id:observation:2,epoch:2,startedAfterDocumentCommitId:28}
attribution:
  status: current
  startedAtDocumentCommitId: 31
  completedAtDocumentCommitId: 31
  startedAtAnalysisGeneration: 33
  completedAtAnalysisGeneration: 33
view: summary
events[1] (componentName #componentId {fields}, then ← kind evidence name {fields} per cause):
  IssueRow #11840604078113 {renderEventId:render:29:48,documentCommitId:29,mountId:mount:9,key:iss-101,necessity:necessary,necessityReason:dom-changed,inputEvidence:changed,source:{location:~/.t3/worktrees/genie-react/t3-090de32c-b027366200f6923c/apps/realworld-legacy/src/features/issues/issue-table.tsx:48:15,role:element-callsite,ownership:app}}
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
renderEventRetention: {evictedEvents:0,earliestDocumentCommitId:29,latestDocumentCommitId:31}
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

# Revert the fix

$ git checkout -- src
[exit 0]

$ git status --short -- src
## ali/articles-update-c
[exit 0]
```
