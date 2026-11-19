# Evidence: test-every-loading-empty-and-error-state

- Date: 2026-11-19
- Commit: `6867352ba46ec3998fe8cda0ba915536fddfa666`
- App: `apps/realworld-dashboard` (Meridian Ops), screens `/customers` and `/customers/c-0042`
- URL: `http://[::1]:5224/` (dev server started with `npx vite --port 5224 --strictPort --host ::1` from `apps/realworld-dashboard`; another process held `127.0.0.1:5224`)
- Driver: agent-browser 0.43.0, session `art-m4`. Genie CLI 1.0.2 from this checkout (`pnpm install && pnpm build`).
- The reference fix for `customer-orders-tab-blanks-page` (`evals/realworld/dashboard/customer-orders-tab-blanks-page.json`) was applied only between the `git diff` and `git checkout` markers below and reverted with git. It is not committed.
- Screenshots taken during the run (`/tmp/art-m4/suspense-forced.png`, `/tmp/art-m4/suspense-fixed-loading.png`) were viewed but not kept in the repo.

Every command below ran in this order from `apps/realworld-dashboard`. Output is complete and untrimmed. `[exit N]` is the command's exit code.

```text

$ agent-browser --session art-m4 open "http://[::1]:5224/login"
✓ Meridian Ops
  http://[::1]:5224/login
[exit 0]

$ npx genie-react status --session art-m4 --wait 15000 --json | jq -c "{ready,app:.app.name,url:.app.url}"
{"ready":true,"app":"Meridian Ops","url":"http://[::1]:5224/login"}
[exit 0]

$ npx genie-react call app_login_as --session art-m4 '{"role":"manager"}'
changed: true
role: manager
userId: u-manager
[exit 0]

$ npx genie-react call app_reset_backend --session art-m4 '{}'
seed: 20260302
faults: []
latency: []
latencyScale: 1
requestCount: 0
counts: {orders:6000,customers:1200,products:2400}
[exit 0]

$ agent-browser --session art-m4 open "http://[::1]:5224/customers"
✓ Meridian Ops
  http://[::1]:5224/customers?page=1&q=
[exit 0]

$ npx genie-react status --session art-m4 --wait 15000 --json | jq -c "{ready,url:.app.url}"
{"ready":true,"url":"http://[::1]:5224/customers?page=1&q="}
[exit 0]

$ npx genie-react call devtools_wait --session art-m4 '{"condition":"settled","timeoutMs":10000}'
ok: true
condition: settled
waitedMs: 623
validConditions: [connected,ready,component,query-settled,navigation,react-quiet,settled]
lastObserved:
  react:
    documentCommitId: 7
    renderCollection: available
    quietForMs: 616
    requiredQuietMs: 500
    pendingWork: {documentCommitId:7,scheduledRoots:0,suspendedBoundaries:0,dehydratedBoundaries:0,boundaries:[],scanTruncated:false,scannedFibers:690}
domains:
  react:
    status: met
    lastObserved: {documentCommitId:7,renderCollection:available,quietForMs:616,requiredQuietMs:500,pendingWork:{documentCommitId:7,scheduledRoots:0,suspendedBoundaries:0,dehydratedBoundaries:0,boundaries:[],scanTruncated:false,scannedFibers:690}}
[exit 0]

$ npx genie-react call query_list --session art-m4 '{}' --fields queryHash,status,observerCount
[2]:
  - {queryHash:"[\"customers\",\"list\",{\"page\":1,\"pageSize\":25,\"q\":\"\"}]",status:success,observerCount:1}
  - {queryHash:"[\"notifications\"]",status:success,observerCount:1}
[exit 0]

$ agent-browser --session art-m4 snapshot -c
- generic [ref=e13] clickable [onclick]
  - complementary "Primary"
    - StaticText "M"
    - StaticText "Meridian Ops"
    - navigation
      - link "Dashboard" [ref=e18]
      - link "Orders" [ref=e19]
      - link "Customers" [ref=e20]
      - link "Inventory" [ref=e21]
      - link "Reports" [ref=e22]
      - link "Settings" [ref=e23]
    - button "Collapse sidebar" [ref=e14]
  - banner
    - button "Search orders, customers, products… ⌘K" [ref=e15]
      - StaticText "Search orders, customers, products…"
      - StaticText "⌘K"
    - button "Notifications, 4 unread" [ref=e16]
      - StaticText "4"
    - button "Account menu" [expanded=false, ref=e24]
  - main
    - sectionheader
      - heading "Customers" [level=1, ref=e25]
      - paragraph
        - StaticText "1,200 accounts"
      - StaticText "Updated 1 second ago"
      - button "Refresh customers" [ref=e26]
    - textbox "Search customers" [ref=e27]
    - combobox "Tier" [expanded=false, ref=e17]: All tiers
      - MenuListPopup
        - option "All tiers" [selected, ref=e29]
        - option "enterprise" [ref=e30]
        - option "growth" [ref=e31]
        - option "starter" [ref=e32]
    - generic
      - table
        - rowgroup
          - row
            - columnheader "Account" [ref=e210]
            - columnheader "Primary contact" [ref=e211]
            - columnheader "Tier" [ref=e212]
            - columnheader "Region" [ref=e213]
            - columnheader "Account manager" [ref=e214]
            - columnheader "Open orders" [ref=e215]
            - columnheader "Lifetime value" [ref=e216]
        - row
          - cell "Acme Supply" [ref=e35]
            - link "Acme Supply" [ref=e217]
          - cell "Ivan Okafor ivan@acmesupply.test" [ref=e36]
            - StaticText "Ivan Okafor"
            - StaticText "ivan@acmesupply.test"
          - cell "starter" [ref=e37]
          - cell "EMEA" [ref=e38]
          - cell "Rosa Costa" [ref=e39]
          - cell "2" [ref=e40]
          - cell "$33,672.10" [ref=e41]
        - row
          - cell "Apex Supply" [ref=e42]
            - link "Apex Supply" [ref=e218]
          - cell "Amara Adeyemi amara@apexsupply.test" [ref=e43]
            - StaticText "Amara Adeyemi"
            - StaticText "amara@apexsupply.test"
          - cell "enterprise" [ref=e44]
          - cell "NA" [ref=e45]
          - cell "Lina Fischer" [ref=e46]
          - cell "4" [ref=e47]
          - cell "$53,109.51" [ref=e48]
        - row
          - cell "Bright Supply" [ref=e49]
            - link "Bright Supply" [ref=e219]
          - cell "Rosa Kowalski rosa@brightsupply.test" [ref=e50]
            - StaticText "Rosa Kowalski"
            - StaticText "rosa@brightsupply.test"
          - cell "starter" [ref=e51]
          - cell "APAC" [ref=e52]
          - cell "Kenji Nakamura" [ref=e53]
          - cell "1" [ref=e54]
          - cell "$13,599.21" [ref=e55]
        - row
          - cell "Cobalt Supply" [ref=e56]
            - link "Cobalt Supply" [ref=e220]
          - cell "Quinn Okafor quinn@cobaltsupply.test" [ref=e57]
            - StaticText "Quinn Okafor"
            - StaticText "quinn@cobaltsupply.test"
          - cell "starter" [ref=e58]
          - cell "APAC" [ref=e59]
          - cell "Morgan Reyes" [ref=e60]
          - cell "1" [ref=e61]
          - cell "$66,580.26" [ref=e62]
        - row
          - cell "Delta Supply" [ref=e63]
            - link "Delta Supply" [ref=e221]
          - cell "Lina Silva lina@deltasupply.test" [ref=e64]
            - StaticText "Lina Silva"
            - StaticText "lina@deltasupply.test"
          - cell "starter" [ref=e65]
          - cell "LATAM" [ref=e66]
          - cell "Sami Haddad" [ref=e67]
          - cell "1" [ref=e68]
          - cell "$34,998.80" [ref=e69]
        - row
          - cell "Evergreen Supply" [ref=e70]
            - link "Evergreen Supply" [ref=e222]
          - cell "Farah Schmidt farah@evergreensupply.test" [ref=e71]
            - StaticText "Farah Schmidt"
            - StaticText "farah@evergreensupply.test"
          - cell "starter" [ref=e72]
          - cell "APAC" [ref=e73]
          - cell "Lina Fischer" [ref=e74]
          - cell "1" [ref=e75]
          - cell "$7,719.24" [ref=e76]
        - row
          - cell "Fulcrum Supply" [ref=e77]
            - link "Fulcrum Supply" [ref=e223]
          - cell "Elena Adeyemi elena@fulcrumsupply.test" [ref=e78]
            - StaticText "Elena Adeyemi"
            - StaticText "elena@fulcrumsupply.test"
          - cell "starter" [ref=e79]
          - cell "LATAM" [ref=e80]
          - cell "Elena Moreau" [ref=e81]
          - cell "3" [ref=e82]
          - cell "$53,920.05" [ref=e83]
        - row
          - cell "Granite Supply" [ref=e84]
            - link "Granite Supply" [ref=e224]
          - cell "Farah Haddad farah@granitesupply.test" [ref=e85]
            - StaticText "Farah Haddad"
            - StaticText "farah@granitesupply.test"
          - cell "growth" [ref=e86]
          - cell "LATAM" [ref=e87]
          - cell "Sami Haddad" [ref=e88]
          - cell "4" [ref=e89]
          - cell "$74,743.03" [ref=e90]
        - row
          - cell "Harbor Supply" [ref=e91]
            - link "Harbor Supply" [ref=e225]
          - cell "Quinn Kowalski quinn@harborsupply.test" [ref=e92]
            - StaticText "Quinn Kowalski"
            - StaticText "quinn@harborsupply.test"
          - cell "growth" [ref=e93]
          - cell "EMEA" [ref=e94]
          - cell "Morgan Reyes" [ref=e95]
          - cell "1" [ref=e96]
          - cell "$20,622.61" [ref=e97]
        - row
          - cell "Ion Supply" [ref=e98]
            - link "Ion Supply" [ref=e226]
          - cell "Jada Lindqvist jada@ionsupply.test" [ref=e99]
            - StaticText "Jada Lindqvist"
            - StaticText "jada@ionsupply.test"
          - cell "starter" [ref=e100]
          - cell "NA" [ref=e101]
          - cell "Lina Fischer" [ref=e102]
          - cell "2" [ref=e103]
          - cell "$43,174.24" [ref=e104]
        - row
          - cell "Juniper Supply" [ref=e105]
            - link "Juniper Supply" [ref=e227]
          - cell "Rosa Costa rosa@junipersupply.test" [ref=e106]
            - StaticText "Rosa Costa"
            - StaticText "rosa@junipersupply.test"
          - cell "growth" [ref=e107]
          - cell "LATAM" [ref=e108]
          - cell "Priya Natarajan" [ref=e109]
          - cell "3" [ref=e110]
          - cell "$67,308.18" [ref=e111]
        - row
          - cell "Keystone Supply" [ref=e112]
            - link "Keystone Supply" [ref=e228]
          - cell "Jada Novak jada@keystonesupply.test" [ref=e113]
            - StaticText "Jada Novak"
            - StaticText "jada@keystonesupply.test"
          - cell "starter" [ref=e114]
          - cell "NA" [ref=e115]
          - cell "Rosa Costa" [ref=e116]
          - cell "1" [ref=e117]
          - cell "$25,833.63" [ref=e118]
        - row
          - cell "Lumen Supply" [ref=e119]
            - link "Lumen Supply" [ref=e229]
          - cell "Omar Haddad omar@lumensupply.test" [ref=e120]
            - StaticText "Omar Haddad"
            - StaticText "omar@lumensupply.test"
          - cell "growth" [ref=e121]
          - cell "NA" [ref=e122]
          - cell "Ben Okafor" [ref=e123]
          - cell "1" [ref=e124]
          - cell "$23,782.58" [ref=e125]
        - row
          - cell "Mosaic Supply" [ref=e126]
            - link "Mosaic Supply" [ref=e230]
          - cell "Diego Nakamura diego@mosaicsupply.test" [ref=e127]
            - StaticText "Diego Nakamura"
            - StaticText "diego@mosaicsupply.test"
          - cell "starter" [ref=e128]
          - cell "EMEA" [ref=e129]
          - cell "Elena Moreau" [ref=e130]
          - cell "2" [ref=e131]
          - cell "$29,709.57" [ref=e132]
        - row
          - cell "Nimbus Supply" [ref=e133]
            - link "Nimbus Supply" [ref=e231]
          - cell "Sami Nakamura sami@nimbussupply.test" [ref=e134]
            - StaticText "Sami Nakamura"
            - StaticText "sami@nimbussupply.test"
          - cell "growth" [ref=e135]
          - cell "LATAM" [ref=e136]
          - cell "Kenji Nakamura" [ref=e137]
          - cell "0" [ref=e138]
          - cell "$40,656.93" [ref=e139]
        - row
          - cell "Orchid Supply" [ref=e140]
            - link "Orchid Supply" [ref=e232]
          - cell "Hana Reyes hana@orchidsupply.test" [ref=e141]
            - StaticText "Hana Reyes"
            - StaticText "hana@orchidsupply.test"
          - cell "growth" [ref=e142]
          - cell "NA" [ref=e143]
          - cell "Omar Ibrahim" [ref=e144]
          - cell "1" [ref=e145]
          - cell "$14,101.75" [ref=e146]
        - row
          - cell "Pioneer Supply" [ref=e147]
            - link "Pioneer Supply" [ref=e233]
          - cell "Noor Lindqvist noor@pioneersupply.test" [ref=e148]
            - StaticText "Noor Lindqvist"
            - StaticText "noor@pioneersupply.test"
          - cell "starter" [ref=e149]
          - cell "APAC" [ref=e150]
          - cell "Tara Novak" [ref=e151]
          - cell "4" [ref=e152]
          - cell "$154,758.81" [ref=e153]
        - row
          - cell "Quarry Supply" [ref=e154]
            - link "Quarry Supply" [ref=e234]
          - cell "Rosa Lindqvist rosa@quarrysupply.test" [ref=e155]
            - StaticText "Rosa Lindqvist"
            - StaticText "rosa@quarrysupply.test"
          - cell "growth" [ref=e156]
          - cell "EMEA" [ref=e157]
          - cell "Kenji Nakamura" [ref=e158]
          - cell "4" [ref=e159]
          - cell "$75,355.49" [ref=e160]
        - row
          - cell "Redwood Supply" [ref=e161]
            - link "Redwood Supply" [ref=e235]
          - cell "Kenji Schmidt kenji@redwoodsupply.test" [ref=e162]
            - StaticText "Kenji Schmidt"
            - StaticText "kenji@redwoodsupply.test"
          - cell "enterprise" [ref=e163]
          - cell "EMEA" [ref=e164]
          - cell "Morgan Reyes" [ref=e165]
          - cell "6" [ref=e166]
          - cell "$83,529.87" [ref=e167]
        - row
          - cell "Summit Supply" [ref=e168]
            - link "Summit Supply" [ref=e236]
          - cell "Amara Lindqvist amara@summitsupply.test" [ref=e169]
            - StaticText "Amara Lindqvist"
            - StaticText "amara@summitsupply.test"
          - cell "starter" [ref=e170]
          - cell "LATAM" [ref=e171]
          - cell "Priya Natarajan" [ref=e172]
          - cell "2" [ref=e173]
          - cell "$24,139.14" [ref=e174]
        - row
          - cell "Tidal Supply" [ref=e175]
            - link "Tidal Supply" [ref=e237]
          - cell "Mateo Lindqvist mateo@tidalsupply.test" [ref=e176]
            - StaticText "Mateo Lindqvist"
            - StaticText "mateo@tidalsupply.test"
          - cell "starter" [ref=e177]
          - cell "EMEA" [ref=e178]
          - cell "Kenji Nakamura" [ref=e179]
          - cell "4" [ref=e180]
          - cell "$58,040.12" [ref=e181]
        - row
          - cell "Union Supply" [ref=e182]
            - link "Union Supply" [ref=e238]
          - cell "Chloe Novak chloe@unionsupply.test" [ref=e183]
            - StaticText "Chloe Novak"
            - StaticText "chloe@unionsupply.test"
          - cell "growth" [ref=e184]
          - cell "NA" [ref=e185]
          - cell "Ben Okafor" [ref=e186]
          - cell "0" [ref=e187]
          - cell "$14,187.34" [ref=e188]
        - row
          - cell "Vertex Supply" [ref=e189]
            - link "Vertex Supply" [ref=e239]
          - cell "Amara Nakamura amara@vertexsupply.test" [ref=e190]
            - StaticText "Amara Nakamura"
            - StaticText "amara@vertexsupply.test"
          - cell "enterprise" [ref=e191]
          - cell "APAC" [ref=e192]
          - cell "Priya Natarajan" [ref=e193]
          - cell "4" [ref=e194]
          - cell "$72,297.20" [ref=e195]
        - row
          - cell "Willow Supply" [ref=e196]
            - link "Willow Supply" [ref=e240]
          - cell "Hana Okafor hana@willowsupply.test" [ref=e197]
            - StaticText "Hana Okafor"
            - StaticText "hana@willowsupply.test"
          - cell "growth" [ref=e198]
          - cell "EMEA" [ref=e199]
          - cell "Priya Natarajan" [ref=e200]
          - cell "2" [ref=e201]
          - cell "$64,325.94" [ref=e202]
        - row
          - cell "Acme Retail" [ref=e203]
            - link "Acme Retail" [ref=e241]
          - cell "Ivan Patel ivan@acmeretail.test" [ref=e204]
            - StaticText "Ivan Patel"
            - StaticText "ivan@acmeretail.test"
          - cell "starter" [ref=e205]
          - cell "EMEA" [ref=e206]
          - cell "Omar Ibrahim" [ref=e207]
          - cell "2" [ref=e208]
          - cell "$23,776.96" [ref=e209]
      - navigation "Pagination" [ref=e28]
        - StaticText "1"
        - StaticText "–"
        - StaticText "25"
        - StaticText " of "
        - StaticText "1200"
        - button "Previous page" [disabled, ref=e33]
        - StaticText "Page "
        - StaticText "1"
        - StaticText " of "
        - StaticText "48"
        - button "Next page" [ref=e34]
  - list "Notifications"
[exit 0]

$ npx genie-react call query_simulate_state --session art-m4 '{"queryKey":["customers","list",{"page":1,"pageSize":25,"q":""}],"state":"pending"}'
ok: true
queryHash: "[\"customers\",\"list\",{\"page\":1,\"pageSize\":25,\"q\":\"\"}]"
simulatedState: pending
originalStatus: success
[exit 0]

$ agent-browser --session art-m4 snapshot -c -s main
- main
  - sectionheader
    - heading "Customers" [level=1, ref=e25]
    - paragraph
      - StaticText "Loading accounts…"
    - StaticText "Updated 12 seconds ago"
    - button "Refresh customers" [ref=e26]
  - textbox "Search customers" [ref=e27]
  - combobox "Tier" [expanded=false, ref=e17]: All tiers
    - MenuListPopup
      - option "All tiers" [selected, ref=e29]
      - option "enterprise" [ref=e30]
      - option "growth" [ref=e31]
      - option "starter" [ref=e32]
  - status "Loading page"
[exit 0]

$ npx genie-react call query_get --session art-m4 '{"queryHash":"[\"customers\",\"list\",{\"page\":1,\"pageSize\":25,\"q\":\"\"}]","depth":1}' --fields status,fetchStatus,dataUpdatedAt,simulatedState
[1]:
  - {status:pending,fetchStatus:fetching,dataUpdatedAt:1795060598694,simulatedState:pending}
[exit 0]

$ npx genie-react call query_simulate_state --session art-m4 '{"queryKey":["customers","list",{"page":1,"pageSize":25,"q":""}],"state":"error","errorMessage":"GET /api/customers failed with 503"}'
ok: true
queryHash: "[\"customers\",\"list\",{\"page\":1,\"pageSize\":25,\"q\":\"\"}]"
simulatedState: error
originalStatus: success
[exit 0]

$ agent-browser --session art-m4 snapshot -c -s main
- main
  - sectionheader
    - heading "Customers" [level=1, ref=e25]
    - paragraph
      - StaticText "Loading accounts…"
    - StaticText "Updated 28 seconds ago"
    - button "Refresh customers" [ref=e26]
  - textbox "Search customers" [ref=e27]
  - combobox "Tier" [expanded=false, ref=e17]: All tiers
    - MenuListPopup
      - option "All tiers" [selected, ref=e29]
      - option "enterprise" [ref=e30]
      - option "growth" [ref=e31]
      - option "starter" [ref=e32]
  - alert
    - paragraph
      - StaticText "Customers could not be loaded"
    - paragraph
      - StaticText "GET /api/customers failed with 503"
    - button "Retry" [ref=e242]
[exit 0]

$ npx genie-react call query_restore_state --session art-m4 '{"all":true}'
ok: true
restored: 1
outcomes[1]:
  - {queryHash:"[\"customers\",\"list\",{\"page\":1,\"pageSize\":25,\"q\":\"\"}]",outcome:restored,refetched:false}
[exit 0]

$ agent-browser --session art-m4 snapshot -c -s main -d 4
- main
  - sectionheader
    - heading "Customers" [level=1, ref=e25]
    - paragraph
      - StaticText "1,200 accounts"
    - StaticText "Updated 1 minute ago"
    - button "Refresh customers" [ref=e26]
  - textbox "Search customers" [ref=e27]
  - combobox "Tier" [expanded=false, ref=e17]: All tiers
    - MenuListPopup
      - option "All tiers" [selected, ref=e29]
      - option "enterprise" [ref=e30]
      - option "growth" [ref=e31]
      - option "starter" [ref=e32]
  - generic
    - table
      - row
        - cell "Acme Supply" [ref=e246]
        - cell "Ivan Okafor ivan@acmesupply.test" [ref=e247]
        - cell "starter" [ref=e248]
        - cell "EMEA" [ref=e249]
        - cell "Rosa Costa" [ref=e250]
        - cell "2" [ref=e251]
        - cell "$33,672.10" [ref=e252]
      - row
        - cell "Apex Supply" [ref=e253]
        - cell "Amara Adeyemi amara@apexsupply.test" [ref=e254]
        - cell "enterprise" [ref=e255]
        - cell "NA" [ref=e256]
        - cell "Lina Fischer" [ref=e257]
        - cell "4" [ref=e258]
        - cell "$53,109.51" [ref=e259]
      - row
        - cell "Bright Supply" [ref=e260]
        - cell "Rosa Kowalski rosa@brightsupply.test" [ref=e261]
        - cell "starter" [ref=e262]
        - cell "APAC" [ref=e263]
        - cell "Kenji Nakamura" [ref=e264]
        - cell "1" [ref=e265]
        - cell "$13,599.21" [ref=e266]
      - row
        - cell "Cobalt Supply" [ref=e267]
        - cell "Quinn Okafor quinn@cobaltsupply.test" [ref=e268]
        - cell "starter" [ref=e269]
        - cell "APAC" [ref=e270]
        - cell "Morgan Reyes" [ref=e271]
        - cell "1" [ref=e272]
        - cell "$66,580.26" [ref=e273]
      - row
        - cell "Delta Supply" [ref=e274]
        - cell "Lina Silva lina@deltasupply.test" [ref=e275]
        - cell "starter" [ref=e276]
        - cell "LATAM" [ref=e277]
        - cell "Sami Haddad" [ref=e278]
        - cell "1" [ref=e279]
        - cell "$34,998.80" [ref=e280]
      - row
        - cell "Evergreen Supply" [ref=e281]
        - cell "Farah Schmidt farah@evergreensupply.test" [ref=e282]
        - cell "starter" [ref=e283]
        - cell "APAC" [ref=e284]
        - cell "Lina Fischer" [ref=e285]
        - cell "1" [ref=e286]
        - cell "$7,719.24" [ref=e287]
      - row
        - cell "Fulcrum Supply" [ref=e288]
        - cell "Elena Adeyemi elena@fulcrumsupply.test" [ref=e289]
        - cell "starter" [ref=e290]
        - cell "LATAM" [ref=e291]
        - cell "Elena Moreau" [ref=e292]
        - cell "3" [ref=e293]
        - cell "$53,920.05" [ref=e294]
      - row
        - cell "Granite Supply" [ref=e295]
        - cell "Farah Haddad farah@granitesupply.test" [ref=e296]
        - cell "growth" [ref=e297]
        - cell "LATAM" [ref=e298]
        - cell "Sami Haddad" [ref=e299]
        - cell "4" [ref=e300]
        - cell "$74,743.03" [ref=e301]
      - row
        - cell "Harbor Supply" [ref=e302]
        - cell "Quinn Kowalski quinn@harborsupply.test" [ref=e303]
        - cell "growth" [ref=e304]
        - cell "EMEA" [ref=e305]
        - cell "Morgan Reyes" [ref=e306]
        - cell "1" [ref=e307]
        - cell "$20,622.61" [ref=e308]
      - row
        - cell "Ion Supply" [ref=e309]
        - cell "Jada Lindqvist jada@ionsupply.test" [ref=e310]
        - cell "starter" [ref=e311]
        - cell "NA" [ref=e312]
        - cell "Lina Fischer" [ref=e313]
        - cell "2" [ref=e314]
        - cell "$43,174.24" [ref=e315]
      - row
        - cell "Juniper Supply" [ref=e316]
        - cell "Rosa Costa rosa@junipersupply.test" [ref=e317]
        - cell "growth" [ref=e318]
        - cell "LATAM" [ref=e319]
        - cell "Priya Natarajan" [ref=e320]
        - cell "3" [ref=e321]
        - cell "$67,308.18" [ref=e322]
      - row
        - cell "Keystone Supply" [ref=e323]
        - cell "Jada Novak jada@keystonesupply.test" [ref=e324]
        - cell "starter" [ref=e325]
        - cell "NA" [ref=e326]
        - cell "Rosa Costa" [ref=e327]
        - cell "1" [ref=e328]
        - cell "$25,833.63" [ref=e329]
      - row
        - cell "Lumen Supply" [ref=e330]
        - cell "Omar Haddad omar@lumensupply.test" [ref=e331]
        - cell "growth" [ref=e332]
        - cell "NA" [ref=e333]
        - cell "Ben Okafor" [ref=e334]
        - cell "1" [ref=e335]
        - cell "$23,782.58" [ref=e336]
      - row
        - cell "Mosaic Supply" [ref=e337]
        - cell "Diego Nakamura diego@mosaicsupply.test" [ref=e338]
        - cell "starter" [ref=e339]
        - cell "EMEA" [ref=e340]
        - cell "Elena Moreau" [ref=e341]
        - cell "2" [ref=e342]
        - cell "$29,709.57" [ref=e343]
      - row
        - cell "Nimbus Supply" [ref=e344]
        - cell "Sami Nakamura sami@nimbussupply.test" [ref=e345]
        - cell "growth" [ref=e346]
        - cell "LATAM" [ref=e347]
        - cell "Kenji Nakamura" [ref=e348]
        - cell "0" [ref=e349]
        - cell "$40,656.93" [ref=e350]
      - row
        - cell "Orchid Supply" [ref=e351]
        - cell "Hana Reyes hana@orchidsupply.test" [ref=e352]
        - cell "growth" [ref=e353]
        - cell "NA" [ref=e354]
        - cell "Omar Ibrahim" [ref=e355]
        - cell "1" [ref=e356]
        - cell "$14,101.75" [ref=e357]
      - row
        - cell "Pioneer Supply" [ref=e358]
        - cell "Noor Lindqvist noor@pioneersupply.test" [ref=e359]
        - cell "starter" [ref=e360]
        - cell "APAC" [ref=e361]
        - cell "Tara Novak" [ref=e362]
        - cell "4" [ref=e363]
        - cell "$154,758.81" [ref=e364]
      - row
        - cell "Quarry Supply" [ref=e365]
        - cell "Rosa Lindqvist rosa@quarrysupply.test" [ref=e366]
        - cell "growth" [ref=e367]
        - cell "EMEA" [ref=e368]
        - cell "Kenji Nakamura" [ref=e369]
        - cell "4" [ref=e370]
        - cell "$75,355.49" [ref=e371]
      - row
        - cell "Redwood Supply" [ref=e372]
        - cell "Kenji Schmidt kenji@redwoodsupply.test" [ref=e373]
        - cell "enterprise" [ref=e374]
        - cell "EMEA" [ref=e375]
        - cell "Morgan Reyes" [ref=e376]
        - cell "6" [ref=e377]
        - cell "$83,529.87" [ref=e378]
      - row
        - cell "Summit Supply" [ref=e379]
        - cell "Amara Lindqvist amara@summitsupply.test" [ref=e380]
        - cell "starter" [ref=e381]
        - cell "LATAM" [ref=e382]
        - cell "Priya Natarajan" [ref=e383]
        - cell "2" [ref=e384]
        - cell "$24,139.14" [ref=e385]
      - row
        - cell "Tidal Supply" [ref=e386]
        - cell "Mateo Lindqvist mateo@tidalsupply.test" [ref=e387]
        - cell "starter" [ref=e388]
        - cell "EMEA" [ref=e389]
        - cell "Kenji Nakamura" [ref=e390]
        - cell "4" [ref=e391]
        - cell "$58,040.12" [ref=e392]
      - row
        - cell "Union Supply" [ref=e393]
        - cell "Chloe Novak chloe@unionsupply.test" [ref=e394]
        - cell "growth" [ref=e395]
        - cell "NA" [ref=e396]
        - cell "Ben Okafor" [ref=e397]
        - cell "0" [ref=e398]
        - cell "$14,187.34" [ref=e399]
      - row
        - cell "Vertex Supply" [ref=e400]
        - cell "Amara Nakamura amara@vertexsupply.test" [ref=e401]
        - cell "enterprise" [ref=e402]
        - cell "APAC" [ref=e403]
        - cell "Priya Natarajan" [ref=e404]
        - cell "4" [ref=e405]
        - cell "$72,297.20" [ref=e406]
      - row
        - cell "Willow Supply" [ref=e407]
        - cell "Hana Okafor hana@willowsupply.test" [ref=e408]
        - cell "growth" [ref=e409]
        - cell "EMEA" [ref=e410]
        - cell "Priya Natarajan" [ref=e411]
        - cell "2" [ref=e412]
        - cell "$64,325.94" [ref=e413]
      - row
        - cell "Acme Retail" [ref=e414]
        - cell "Ivan Patel ivan@acmeretail.test" [ref=e415]
        - cell "starter" [ref=e416]
        - cell "EMEA" [ref=e417]
        - cell "Omar Ibrahim" [ref=e418]
        - cell "2" [ref=e419]
        - cell "$23,776.96" [ref=e420]
    - navigation "Pagination" [ref=e243]
      - StaticText "1"
      - StaticText "–"
      - StaticText "25"
      - StaticText " of "
      - StaticText "1200"
      - button "Previous page" [disabled, ref=e244]
      - StaticText "Page "
      - StaticText "1"
      - StaticText " of "
      - StaticText "48"
      - button "Next page" [ref=e245]
[exit 0]

$ npx genie-react call react_find_components --session art-m4 '{"query":"CustomersPage","exact":true}'
matches[1]:
  - {id:520949334170,name:CustomersPage,path:"QueryClientProvider > AuthProvider > App > RouterProvider > RouterContextProvider > Matches > MatchesInner > CatchBoundary > MatchImpl > MatchView > CatchBoundary > CatchNotFound > CatchBoundary > MatchInnerImpl > RootLayout > OutletImpl > MatchImpl > MatchView > CatchBoundary > MatchInnerImpl > Lazy > AuthenticatedLayout > PermissionsProvider > AppShell > PreferencesProvider > OutletImpl > MatchImpl > MatchView > CatchBoundary > MatchInnerImpl > Lazy > CustomersPage",kind:function,props:{},source:{file:/src/features/customers/customers-page.tsx,line:42,column:5,functionName:CustomersPage,sourceMapConfidence:mapped,role:component-body},isLibrary:false}
ownershipCoverage: {complete:true,totalCandidates:1,app:1,library:0,unknown:0}
omittedByLimit: 0
scanTruncated: false
nextCursor: null
unmountedSinceSearch: 0
[exit 0]

$ npx genie-react call react_inspect_component --session art-m4 '{"id":520949334170}'
id: 520949334170
name: CustomersPage
kind: function
props: {}
hooks[19]:
  - {index:0,kind:ref,hook:useRef,stateful:false,customHooks:[useSearch,useMatch,useStructuralSharing],value:{}}
  - {index:1,kind:callback,hook:useCallback,stateful:false,customHooks:[useSearch,useMatch,useSelector],value:["ƒ anonymous()",[{__genie_dehydrated__:true,kind:object,preview:"{…}",path:[1,0]}]]}
  - {index:2,kind:callback,hook:useCallback,stateful:false,customHooks:[useSearch,useMatch,useSelector],value:["ƒ anonymous()",[{__genie_dehydrated__:true,kind:object,preview:"{…}",path:[1,0]}]]}
  - {index:3,kind:ref,hook:useRef,stateful:false,customHooks:[useSearch,useMatch,useSelector,useSyncExternalStoreWithSelector],value:{current:{hasValue:true,value:{__genie_dehydrated__:true,kind:object,preview:"{…}",path:[current,value]}}}}
  - {index:4,kind:memo,hook:useMemo,stateful:false,customHooks:[useSearch,useMatch,useSelector,useSyncExternalStoreWithSelector],value:[["ƒ anonymous()","ƒ anonymous()"],["ƒ anonymous()","ƒ anonymous()","ƒ anonymous()","ƒ defaultCompare()"]]}
  - {index:5,kind:other,hook:useSyncExternalStore,stateful:false,customHooks:[useSearch,useMatch,useSelector,useSyncExternalStoreWithSelector],value:{page:1,q:""}}
  - {index:6,kind:effect,hook:useSyncExternalStore,stateful:false,customHooks:[useSearch,useMatch,useSelector,useSyncExternalStoreWithSelector],deps:["ƒ anonymous()"]}
  - {index:7,kind:effect,hook:useEffect,stateful:false,customHooks:[useSearch,useMatch,useSelector,useSyncExternalStoreWithSelector],deps:[{page:1,q:""}]}
  - {index:8,kind:callback,hook:useCallback,stateful:false,customHooks:[useNavigate],value:["ƒ anonymous()",[/customers/,{__genie_dehydrated__:true,kind:object,preview:"Router {…}",path:[1,1]}]]}
  - {index:9,kind:state,hook:useState,stateful:true,stateIndex:0,value:""}
  - {index:10,kind:state,hook:useState,stateful:true,stateIndex:1,customHooks:[useDebouncedValue],value:""}
  - {index:11,kind:effect,hook:useEffect,stateful:false,customHooks:[useDebouncedValue],deps:["",250]}
  - {index:12,kind:effect,hook:useEffect,stateful:false,customHooks:[useQuery,useBaseQuery,useClearResetErrorBoundary],deps:[{clearReset:"ƒ clearReset()",reset:"ƒ reset()",isReset:"ƒ isReset()"}]}
  - {index:13,kind:state,hook:useState,stateful:true,stateIndex:2,customHooks:[useQuery,useBaseQuery],value:{listeners:{__type:Set,values:["ƒ anonymous()"]},subscribe:"ƒ bound subscribe()",options:{retry:"ƒ retry()",refetchOnWindowFocus:false,queryKey:{__genie_dehydrated__:true,kind:array,preview:"Array(3)",path:[options,queryKey],size:3},queryFn:"ƒ queryFn()",placeholderData:"ƒ keepPreviousData()",_defaulted:true,queryHash:"[\"customers\",\"list\",{\"page\":1,\"pageSize\":25,\"q\":\"\"}]",refetchOnReconnect:true,throwOnError:false,_optimisticResults:optimistic},refetch:"ƒ bound refetch()"}}
  - {index:14,kind:callback,hook:useCallback,stateful:false,customHooks:[useQuery,useBaseQuery],value:["ƒ anonymous()",[{__genie_dehydrated__:true,kind:object,preview:"QueryObserver {…}",path:[1,0]},true]]}
  - {index:15,kind:other,hook:useSyncExternalStore,stateful:false,customHooks:[useQuery,useBaseQuery],value:{status:success,fetchStatus:idle,isPending:false,isSuccess:true,isError:false,isInitialLoading:false,isLoading:false,data:{items:{__genie_dehydrated__:true,kind:array,preview:"Array(25)",path:[data,items],size:25},total:1200,page:1,pageSize:25},dataUpdatedAt:1795060598694,error:null,errorUpdatedAt:0,failureCount:0,failureReason:null,errorUpdateCount:0,isFetched:true,isFetchedAfterMount:true,isFetching:false,isRefetching:false,isLoadingError:false,isPaused:false,isPlaceholderData:false,isRefetchError:false,isStale:true,refetch:"ƒ bound refetch()",promise:{__genie_dehydrated__:true,kind:promise,preview:Promise,path:[promise]},isEnabled:true}}
  - {index:16,kind:effect,hook:useSyncExternalStore,stateful:false,customHooks:[useQuery,useBaseQuery],deps:["ƒ anonymous()"]}
  - {index:17,kind:effect,hook:useEffect,stateful:false,customHooks:[useQuery,useBaseQuery],deps:[{retry:"ƒ retry()",refetchOnWindowFocus:false,queryKey:{__genie_dehydrated__:true,kind:array,preview:"Array(3)",path:[0,queryKey],size:3},queryFn:"ƒ queryFn()",placeholderData:"ƒ keepPreviousData()",_defaulted:true,queryHash:"[\"customers\",\"list\",{\"page\":1,\"pageSize\":25,\"q\":\"\"}]",refetchOnReconnect:true,throwOnError:false,_optimisticResults:optimistic},{listeners:{__genie_dehydrated__:true,kind:set,preview:"Set(1)",path:[1,listeners],size:1},subscribe:"ƒ bound subscribe()",options:{__genie_dehydrated__:true,kind:object,preview:"{…}",path:[1,options]},refetch:"ƒ bound refetch()"}]}
  - {index:18,kind:effect,hook:useEffect,stateful:false,deps:["","","ƒ anonymous()"]}
customHookGrouping: exact
wrapperAncestry: []
[exit 0]

$ npx genie-react call react_override_hook_state --session art-m4 '{"id":520949334170,"stateIndex":0,"value":"zzqx"}'
ok: true
name: CustomersPage
hookIndex: 9
stateIndex: 0
commitObserved: true
[exit 0]

$ npx genie-react call devtools_wait --session art-m4 '{"condition":"settled","timeoutMs":10000}' --fields ok,waitedMs
[1]:
  - {ok:true,waitedMs:1377}
[exit 0]

$ agent-browser --session art-m4 get url
http://[::1]:5224/customers?page=1&q=zzqx
[exit 0]

$ agent-browser --session art-m4 snapshot -c -s main
- main
  - sectionheader
    - heading "Customers" [level=1, ref=e25]
    - paragraph
      - StaticText "0 accounts"
    - StaticText "Updated now"
    - button "Refresh customers" [ref=e26]
  - textbox "Search customers" [ref=e27]: zzqx
    - StaticText "zzqx"
  - combobox "Tier" [expanded=false, ref=e17]: All tiers
    - MenuListPopup
      - option "All tiers" [selected, ref=e29]
      - option "enterprise" [ref=e30]
      - option "growth" [ref=e31]
      - option "starter" [ref=e32]
  - paragraph
    - StaticText "No customers match"
  - paragraph
    - StaticText "Try a different name or clear the tier filter."
[exit 0]

$ npx genie-react call react_reset_overrides --session art-m4 '{}'
ok: true
cleared: [{kind:hook,componentName:CustomersPage,outcome:restored}]
remaining: 0
commitObserved: true
[exit 0]

$ npx genie-react call devtools_wait --session art-m4 '{"condition":"settled","timeoutMs":10000}' --fields ok,waitedMs
[1]:
  - {ok:true,waitedMs:1542}
[exit 0]

$ agent-browser --session art-m4 get url
http://[::1]:5224/customers?page=1&q=
[exit 0]

$ agent-browser --session art-m4 snapshot -c -s 'main header'
- sectionheader
  - heading "Customers" [level=1, ref=e25]
  - paragraph
    - StaticText "1,200 accounts"
  - StaticText "Updated 1 second ago"
  - button "Refresh customers" [ref=e26]
[exit 0]

$ agent-browser --session art-m4 open "http://[::1]:5224/customers/c-0042"
✓ Meridian Ops
  http://[::1]:5224/customers/c-0042
[exit 0]

$ npx genie-react status --session art-m4 --wait 15000 --json | jq -c "{ready,url:.app.url}"
{"ready":true,"url":"http://[::1]:5224/customers/c-0042"}
[exit 0]

$ agent-browser --session art-m4 find role tab click --name 'Recent orders'
✓ Done
[exit 0]

$ npx genie-react call devtools_wait --session art-m4 '{"condition":"settled","timeoutMs":10000}' --fields ok,waitedMs
[1]:
  - {ok:true,waitedMs:764}
[exit 0]

$ agent-browser --session art-m4 snapshot -c -s main
- main
  - link "All customers" [ref=e668]
  - sectionheader
    - heading "Quarry Retail" [level=1, ref=e677]
    - StaticText "starter"
    - paragraph
      - StaticText "LATAM · Managed by Tara Novak"
    - button "Edit account" [ref=e678]
  - tablist "Customer sections"
    - tab "Profile" [ref=e679]
    - tab "Recent orders" [selected, ref=e680]
  - table "Recent orders"
    - rowgroup
      - row
        - columnheader "Order" [ref=e721]
        - columnheader "Status" [ref=e722]
        - columnheader "Placed" [ref=e723]
        - columnheader "Total" [ref=e724]
    - row
      - cell "SO-105159" [ref=e681]
        - link "SO-105159" [ref=e725]
      - cell "Pending" [ref=e682]
      - cell "Feb 13, 2026" [ref=e683]
      - cell "$1,311.62" [ref=e684]
    - row
      - cell "SO-104085" [ref=e685]
        - link "SO-104085" [ref=e726]
      - cell "Delivered" [ref=e686]
      - cell "Jan 23, 2026" [ref=e687]
      - cell "$12,986.98" [ref=e688]
    - row
      - cell "SO-103582" [ref=e689]
        - link "SO-103582" [ref=e727]
      - cell "Delivered" [ref=e690]
      - cell "Jan 13, 2026" [ref=e691]
      - cell "$4,856.40" [ref=e692]
    - row
      - cell "SO-103559" [ref=e693]
        - link "SO-103559" [ref=e728]
      - cell "Processing" [ref=e694]
      - cell "Jan 12, 2026" [ref=e695]
      - cell "$5,225.36" [ref=e696]
    - row
      - cell "SO-103124" [ref=e697]
        - link "SO-103124" [ref=e729]
      - cell "Processing" [ref=e698]
      - cell "Jan 3, 2026" [ref=e699]
      - cell "$12,253.53" [ref=e700]
    - row
      - cell "SO-102268" [ref=e701]
        - link "SO-102268" [ref=e730]
      - cell "Processing" [ref=e702]
      - cell "Dec 17, 2025" [ref=e703]
      - cell "$10,007.28" [ref=e704]
    - row
      - cell "SO-102109" [ref=e705]
        - link "SO-102109" [ref=e731]
      - cell "Delivered" [ref=e706]
      - cell "Dec 14, 2025" [ref=e707]
      - cell "$20,597.60" [ref=e708]
    - row
      - cell "SO-101900" [ref=e709]
        - link "SO-101900" [ref=e732]
      - cell "Delivered" [ref=e710]
      - cell "Dec 10, 2025" [ref=e711]
      - cell "$14,546.47" [ref=e712]
    - row
      - cell "SO-101273" [ref=e713]
        - link "SO-101273" [ref=e733]
      - cell "Delivered" [ref=e714]
      - cell "Nov 27, 2025" [ref=e715]
      - cell "$962.44" [ref=e716]
    - row
      - cell "SO-100173" [ref=e717]
        - link "SO-100173" [ref=e734]
      - cell "Delivered" [ref=e718]
      - cell "Nov 5, 2025" [ref=e719]
      - cell "$5,061.90" [ref=e720]
[exit 0]

$ npx genie-react call react_find_components --session art-m4 '{"query":"CustomerOrdersPanel","exact":true}' --json | jq -c '.matches[] | {id,name,path}'
{"id":3902246223903,"name":"CustomerOrdersPanel","path":"QueryClientProvider > AuthProvider > App > RouterProvider > RouterContextProvider > Matches > MatchesInner > CatchBoundary > MatchImpl > MatchView > CatchBoundary > CatchNotFound > CatchBoundary > MatchInnerImpl > RootLayout > OutletImpl > MatchImpl > MatchView > CatchBoundary > MatchInnerImpl > Lazy > AuthenticatedLayout > PermissionsProvider > AppShell > PreferencesProvider > OutletImpl > MatchImpl > MatchView > CatchBoundary > MatchInnerImpl > Lazy > CustomerDetailPage > CustomerOrdersPanel"}
[exit 0]

$ npx genie-react call react_toggle_suspense_fallback --session art-m4 '{"id":3902246223903,"showFallback":true}'
ok: true
boundaryId: 3902246223904
showingFallback: true
activeOverrides: 1
[exit 0]

$ agent-browser --session art-m4 snapshot -c -s main
(empty page)
[exit 0]

$ npx genie-react call react_suspense --session art-m4 '{}'
capability: {reactVersion:19.3.1,bundle:development,asyncDebugInfo:available,reason:null}
observedAtMs: 10566.8
documentCommitId: 11
counts: {boundaries:4,fallback:1,transitionPending:0,dehydrated:0,content:3}
omittedByLimit: 0
coverage:
  complete: false
  scanTruncated: false
  fiberScanLimit: 20000
  waitingWithoutBlocker: 1
  unattributedEntries: 0
  unattributedSuspendedRoots: 0
  changedDuringRead: false
  commitScheduled: false
  sourcesPartial: false
  serverAwaits: none
ownershipCoverage: {complete:false,totalCandidates:4,app:0,library:3,unknown:1}
waitingHint: "<Suspense name=\"Suspense\"> #3902246223904 shows its fallback because react_toggle_suspense_fallback holds it; call react_reset_overrides to release it"
view: summary
boundaries[4]:
  each: {name:Suspense,stateEvidence:exact,hydration:null,blockersOmitted:0,source:{sourceMapConfidence:mapped,role:element-callsite},serverComponents:[],serverComponentsOmitted:0,blockers:[]}
  - {id:3902246223904,parentBoundaryId:3902246223906,state:fallback,forced:true,fallbackCommittedSinceMount:true,blockerStatus:not-observable,source:{file:/node_modules/.pnpm/@tanstack+react-router@1.170.41_react-dom@19.3.1_react@19.3.1__react@19.3.1/node_modules/@tanstack/react-router/dist/esm/Match.js,line:70,column:48,functionName:MatchView},sourceOwnership:library}
  - {id:3902246223884,parentBoundaryId:null,state:content,forced:false,fallbackCommittedSinceMount:false,blockerStatus:none,source:{file:/node_modules/.pnpm/@tanstack+react-router@1.170.41_react-dom@19.3.1_react@19.3.1__react@19.3.1/node_modules/@tanstack/react-router/dist/esm/Matches.js,line:23,column:261,functionName:Matches},sourceOwnership:library}
  - {id:3902246223905,parentBoundaryId:3902246223884,state:content,forced:false,fallbackCommittedSinceMount:false,blockerStatus:none,source:{file:/node_modules/.pnpm/@tanstack+react-router@1.170.41_react-dom@19.3.1_react@19.3.1__react@19.3.1/node_modules/@tanstack/react-router/dist/esm/Match.js,line:161,column:54,functionName:OutletImpl},sourceOwnership:library}
  - {id:3902246223906,parentBoundaryId:3902246223905,state:content,forced:false,fallbackCommittedSinceMount:false,blockerStatus:none,source:{file:/src/routes/_app.tsx,line:null,column:null,functionName:AuthenticatedLayout},sourceOwnership:unknown}
[exit 0]

$ agent-browser --session art-m4 snapshot -c
- generic [ref=e664] clickable [onclick]
  - complementary "Primary"
    - StaticText "M"
    - StaticText "Meridian Ops"
    - navigation
      - link "Dashboard" [ref=e669]
      - link "Orders" [ref=e670]
      - link "Customers" [ref=e671]
      - link "Inventory" [ref=e672]
      - link "Reports" [ref=e673]
      - link "Settings" [ref=e674]
      - paragraph
        - StaticText "RECENTLY VIEWED"
      - link "Quarry Retail" [ref=e675]
    - button "Collapse sidebar" [ref=e665]
  - banner
    - button "Search orders, customers, products… ⌘K" [ref=e666]
      - StaticText "Search orders, customers, products…"
      - StaticText "⌘K"
    - button "Notifications, 4 unread" [ref=e667]
      - StaticText "4"
    - button "Account menu" [expanded=false, ref=e676]
  - list "Notifications"
[exit 0]

$ agent-browser --session art-m4 get html main
<div class="space-y-6 p-6" style="display: none !important;"><a class="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800 active" href="/customers" data-status="active" aria-current="page"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-arrow-left size-4" aria-hidden="true"><path d="m12 19-7-7 7-7"></path><path d="M19 12H5"></path></svg>All customers</a><header class="flex flex-wrap items-start justify-between gap-4"><div><div class="flex items-center gap-3"><h1 class="text-xl font-semibold">Quarry Retail</h1><span class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">starter</span></div><p class="mt-1 text-sm text-slate-500">LATAM · Managed by Tara Novak</p></div><button type="button" class="inline-flex items-center justify-center gap-1.5 rounded-md font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 disabled:cursor-not-allowed border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 h-9 px-3.5 text-sm"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-pencil size-4" aria-hidden="true"><path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"></path><path d="m15 5 4 4"></path></svg>Edit account</button></header><div role="tablist" aria-label="Customer sections" class="flex gap-1 border-b border-slate-200 dark:border-slate-800"><button type="button" role="tab" aria-selected="false" class="-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200">Profile</button><button type="button" role="tab" aria-selected="true" class="-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors border-indigo-600 text-indigo-700 dark:text-indigo-300">Recent orders</button></div><section class="rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900"><table aria-label="Recent orders" class="w-full text-sm"><thead class="border-b border-slate-100 text-left text-xs text-slate-500 dark:border-slate-800"><tr><th class="px-4 py-2 font-medium">Order</th><th class="px-4 py-2 font-medium">Status</th><th class="px-4 py-2 font-medium">Placed</th><th class="px-4 py-2 text-right font-medium">Total</th></tr></thead><tbody class="divide-y divide-slate-100 dark:divide-slate-800"><tr><td class="px-4 py-2"><a class="font-medium text-indigo-600 hover:underline" href="/orders/o-105159">SO-105159</a></td><td class="px-4 py-2"><span class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">Pending</span></td><td class="px-4 py-2">Feb 13, 2026</td><td class="px-4 py-2 text-right tabular-nums">$1,311.62</td></tr><tr><td class="px-4 py-2"><a class="font-medium text-indigo-600 hover:underline" href="/orders/o-104085">SO-104085</a></td><td class="px-4 py-2"><span class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">Delivered</span></td><td class="px-4 py-2">Jan 23, 2026</td><td class="px-4 py-2 text-right tabular-nums">$12,986.98</td></tr><tr><td class="px-4 py-2"><a class="font-medium text-indigo-600 hover:underline" href="/orders/o-103582">SO-103582</a></td><td class="px-4 py-2"><span class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">Delivered</span></td><td class="px-4 py-2">Jan 13, 2026</td><td class="px-4 py-2 text-right tabular-nums">$4,856.40</td></tr><tr><td class="px-4 py-2"><a class="font-medium text-indigo-600 hover:underline" href="/orders/o-103559">SO-103559</a></td><td class="px-4 py-2"><span class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300">Processing</span></td><td class="px-4 py-2">Jan 12, 2026</td><td class="px-4 py-2 text-right tabular-nums">$5,225.36</td></tr><tr><td class="px-4 py-2"><a class="font-medium text-indigo-600 hover:underline" href="/orders/o-103124">SO-103124</a></td><td class="px-4 py-2"><span class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300">Processing</span></td><td class="px-4 py-2">Jan 3, 2026</td><td class="px-4 py-2 text-right tabular-nums">$12,253.53</td></tr><tr><td class="px-4 py-2"><a class="font-medium text-indigo-600 hover:underline" href="/orders/o-102268">SO-102268</a></td><td class="px-4 py-2"><span class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300">Processing</span></td><td class="px-4 py-2">Dec 17, 2025</td><td class="px-4 py-2 text-right tabular-nums">$10,007.28</td></tr><tr><td class="px-4 py-2"><a class="font-medium text-indigo-600 hover:underline" href="/orders/o-102109">SO-102109</a></td><td class="px-4 py-2"><span class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">Delivered</span></td><td class="px-4 py-2">Dec 14, 2025</td><td class="px-4 py-2 text-right tabular-nums">$20,597.60</td></tr><tr><td class="px-4 py-2"><a class="font-medium text-indigo-600 hover:underline" href="/orders/o-101900">SO-101900</a></td><td class="px-4 py-2"><span class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">Delivered</span></td><td class="px-4 py-2">Dec 10, 2025</td><td class="px-4 py-2 text-right tabular-nums">$14,546.47</td></tr><tr><td class="px-4 py-2"><a class="font-medium text-indigo-600 hover:underline" href="/orders/o-101273">SO-101273</a></td><td class="px-4 py-2"><span class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">Delivered</span></td><td class="px-4 py-2">Nov 27, 2025</td><td class="px-4 py-2 text-right tabular-nums">$962.44</td></tr><tr><td class="px-4 py-2"><a class="font-medium text-indigo-600 hover:underline" href="/orders/o-100173">SO-100173</a></td><td class="px-4 py-2"><span class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">Delivered</span></td><td class="px-4 py-2">Nov 5, 2025</td><td class="px-4 py-2 text-right tabular-nums">$5,061.90</td></tr></tbody></table></section></div>
[exit 0]

$ agent-browser --session art-m4 screenshot /tmp/art-m4/suspense-forced.png
✓ Screenshot saved to /tmp/art-m4/suspense-forced.png
[exit 0]

$ npx genie-react call react_reset_overrides --session art-m4 '{}'
ok: true
cleared: [{kind:suspense,componentName:Suspense,outcome:released}]
remaining: 0
commitObserved: true
[exit 0]

$ npx genie-react call query_restore_state --session art-m4 '{"all":true}'
ok: true
restored: 0
outcomes: []
[exit 0]

$ agent-browser --session art-m4 snapshot -c -s 'main header'
- sectionheader
  - heading "Quarry Retail" [level=1, ref=e677]
  - StaticText "starter"
  - paragraph
    - StaticText "LATAM · Managed by Tara Novak"
  - button "Edit account" [ref=e678]
[exit 0]

$ agent-browser --session art-m4 open "http://[::1]:5224/customers/c-0042"
✓ Meridian Ops
  http://[::1]:5224/customers/c-0042
[exit 0]

$ npx genie-react status --session art-m4 --wait 15000 --json | jq -c "{ready,url:.app.url}"
{"ready":true,"url":"http://[::1]:5224/customers/c-0042"}
[exit 0]

$ npx genie-react call devtools_wait --session art-m4 '{"condition":"settled","timeoutMs":10000}' --fields ok,waitedMs
[1]:
  - {ok:true,waitedMs:612}
[exit 0]

$ npx genie-react call app_set_latency --session art-m4 '{"rules":[{"path":"/api/customers/c-0042/orders","ms":3000}]}'
seed: 20260302
faults: []
latency: [{path:/api/customers/c-0042/orders,ms:3000}]
latencyScale: 1
requestCount: 81
counts: {orders:6000,customers:1200,products:2400}
[exit 0]

$ npx genie-react verify begin --session art-m4 --name 'open Recent orders' --claim 'render CustomerOrdersPanel min 1' --claim 'boundaries clean'
recording vfy_9f5cbc14-131a-4dde-97f4-34c00055966a "open Recent orders"
  url "http://[::1]:5224/customers/c-0042"
  1 null render CustomerOrdersPanel min 1  {}
  2 null boundaries clean  {}
window: {observationId:observation:1,startDocumentCommitId:6,domains:[react,query,router],quietMs:500,timeoutMs:10000,tailMs:500}
next: $ pnpm exec genie-react verify end vfy_9f5cbc14-131a-4dde-97f4-34c00055966a --session art-m4
session: {sessionId:d92ba689-8b69-4f86-a476-3928288d43a8,logicalSessionId:93c72e49-38e7-4e17-aad5-50316084ea97,documentGeneration:5}
schemaVersion: "1.0"
targets: [{target:{component:CustomerOrdersPanel},status:pending,instances:0}]
startedAt: 2026-11-19T03:59:13.642Z
expiresAt: 2026-11-19T04:04:13.649Z
request: {budget:{fiberLimit:250,operationLimit:20000,timeLimitMs:8,targetOperationReserve:4000,targetTimeReserveMs:4,adaptive:true},settle:{quietMs:500,timeoutMs:10000},maxDurationMs:300000,allowOverrides:false}
[exit 0]

$ agent-browser --session art-m4 find role tab click --name 'Recent orders'
✓ Done
[exit 0]

$ agent-browser --session art-m4 snapshot -c -s main
(empty page)
[exit 0]

$ npx genie-react verify end vfy_9f5cbc14-131a-4dde-97f4-34c00055966a --session art-m4
pass vfy_9f5cbc14-131a-4dde-97f4-34c00055966a "open Recent orders"  4 commits, quiet after 3530 ms (react, query, router)
  url "http://[::1]:5224/customers/c-0042"
  1 pass render CustomerOrdersPanel min 1  {renders:2,mounts:1,updates:1,remounts:0,semantics:exact,instances:1,activeInstances:1}
      claim: {kind:renders,target:{component:CustomerOrdersPanel},min:1,counting:renders,allowRemount:false}
      deciding: [{kind:instance,mountId:mount:23,renders:2,mounts:1,updates:1,mountGeneration:1,latestDocumentCommitId:10,source:/src/features/customers/customer-detail-page.tsx:71:9}]
  2 pass boundaries clean  {caughtDuringWindow:0,caughtAtEnd:0}
      claim: {kind:boundaries-clean,scope:window}
      deciding: [{kind:boundary-log,scope:window,complete:true,afterDocumentCommitId:6}]
      caveats: [uncaught-errors-outside-boundaries-unobserved]
window: {observationId:observation:1,startDocumentCommitId:6,settledDocumentCommitId:10,frozenDocumentCommitId:10,commits:4,settle:{outcome:met,quietMs:500,timeoutMs:10000,waitedMs:3530,domains:{react:met,query:met,router:met}},tail:{ms:500,commits:0},environment:{bundle:development,strictMode:on,renderCollection:available,visibility:document}}
! ui-outcome-not-observed: Genie does not check the screen; confirm it with the UI driver
attempt 1 for these claims on this tab
evidence: $ pnpm exec genie-react verify show vfy_9f5cbc14-131a-4dde-97f4-34c00055966a --session art-m4
session: {sessionId:d92ba689-8b69-4f86-a476-3928288d43a8,logicalSessionId:93c72e49-38e7-4e17-aad5-50316084ea97,documentGeneration:5}
schemaVersion: "1.0"
exitCode: 0
stage: end
ledger: {fingerprint:cf_fbf898bbf4b0,scope:logical-session,storage:memory,attempt:1,history:[],codeChangedSincePrevious:null,failsOnSameCode:0}
evidence: {retained:true,tools:[react_get_renders,react_component_cohort,react_list_overrides,query_is_fetching,react_refresh_events,browser_visibility,react_profile_stop,react_error_state]}
startedAt: 2026-11-19T03:59:13.642Z
endedAt: 2026-11-19T03:59:24.059Z
request: {budget:{fiberLimit:250,operationLimit:20000,timeLimitMs:8,targetOperationReserve:4000,targetTimeReserveMs:4,adaptive:true},settle:{quietMs:500,timeoutMs:10000},maxDurationMs:300000,allowOverrides:false}
[exit 0]

$ agent-browser --session art-m4 snapshot -c -s main -d 3
- main
  - link "All customers" [ref=e748]
  - sectionheader
    - heading "Quarry Retail" [level=1, ref=e749]
    - StaticText "starter"
    - paragraph
      - StaticText "LATAM · Managed by Tara Novak"
    - button "Edit account" [ref=e750]
  - tablist "Customer sections"
    - tab "Profile" [ref=e751]
    - tab "Recent orders" [selected, ref=e752]
  - table "Recent orders"
    - row
      - cell "SO-105159" [ref=e753]
      - cell "Pending" [ref=e754]
      - cell "Feb 13, 2026" [ref=e755]
      - cell "$1,311.62" [ref=e756]
    - row
      - cell "SO-104085" [ref=e757]
      - cell "Delivered" [ref=e758]
      - cell "Jan 23, 2026" [ref=e759]
      - cell "$12,986.98" [ref=e760]
    - row
      - cell "SO-103582" [ref=e761]
      - cell "Delivered" [ref=e762]
      - cell "Jan 13, 2026" [ref=e763]
      - cell "$4,856.40" [ref=e764]
    - row
      - cell "SO-103559" [ref=e765]
      - cell "Processing" [ref=e766]
      - cell "Jan 12, 2026" [ref=e767]
      - cell "$5,225.36" [ref=e768]
    - row
      - cell "SO-103124" [ref=e769]
      - cell "Processing" [ref=e770]
      - cell "Jan 3, 2026" [ref=e771]
      - cell "$12,253.53" [ref=e772]
    - row
      - cell "SO-102268" [ref=e773]
      - cell "Processing" [ref=e774]
      - cell "Dec 17, 2025" [ref=e775]
      - cell "$10,007.28" [ref=e776]
    - row
      - cell "SO-102109" [ref=e777]
      - cell "Delivered" [ref=e778]
      - cell "Dec 14, 2025" [ref=e779]
      - cell "$20,597.60" [ref=e780]
    - row
      - cell "SO-101900" [ref=e781]
      - cell "Delivered" [ref=e782]
      - cell "Dec 10, 2025" [ref=e783]
      - cell "$14,546.47" [ref=e784]
    - row
      - cell "SO-101273" [ref=e785]
      - cell "Delivered" [ref=e786]
      - cell "Nov 27, 2025" [ref=e787]
      - cell "$962.44" [ref=e788]
    - row
      - cell "SO-100173" [ref=e789]
      - cell "Delivered" [ref=e790]
      - cell "Nov 5, 2025" [ref=e791]
      - cell "$5,061.90" [ref=e792]
[exit 0]

$ git diff  (reference fix applied temporarily)
diff --git a/apps/realworld-dashboard/src/features/customers/customer-detail-page.tsx b/apps/realworld-dashboard/src/features/customers/customer-detail-page.tsx
index 79352e5..c93c72e 100644
--- a/apps/realworld-dashboard/src/features/customers/customer-detail-page.tsx
+++ b/apps/realworld-dashboard/src/features/customers/customer-detail-page.tsx
@@ -1,9 +1,10 @@
 import { useSuspenseQuery } from '@tanstack/react-query'
 import { Link, useParams } from '@tanstack/react-router'
 import { ArrowLeft, Pencil } from 'lucide-react'
-import { useEffect, useState } from 'react'
+import { Suspense, useEffect, useState } from 'react'
 import { PermissionGate } from '../../app/permissions'
 import { Button } from '../../components/ui/button'
+import { Skeleton } from '../../components/ui/feedback'
 import { Tabs } from '../../components/ui/tabs'
 import { useWorkspaceStore } from '../../stores/workspace'
 import { CustomerEditModal } from './customer-edit-modal'
@@ -68,7 +69,9 @@ export function CustomerDetailPage() {
           <RelatedAccounts ids={customer.relatedIds} />
         </div>
       ) : (
-        <CustomerOrdersPanel customerId={customer.id} />
+        <Suspense fallback={<Skeleton className="h-64" />}>
+          <CustomerOrdersPanel customerId={customer.id} />
+        </Suspense>
       )}
       {editing && <CustomerEditModal customer={customer} onClose={() => setEditing(false)} />}
     </div>

$ agent-browser --session art-m4 open "http://[::1]:5224/customers/c-0042"
✓ Meridian Ops
  http://[::1]:5224/customers/c-0042
[exit 0]

$ npx genie-react status --session art-m4 --wait 15000 --json | jq -c "{ready,url:.app.url}"
{"ready":true,"url":"http://[::1]:5224/customers/c-0042"}
[exit 0]

$ npx genie-react call devtools_wait --session art-m4 '{"condition":"settled","timeoutMs":10000}' --fields ok,waitedMs
[1]:
  - {ok:true,waitedMs:615}
[exit 0]

$ npx genie-react call app_backend_state --session art-m4 '{}' --fields latency
[1]:
  - {latency:[{path:/api/customers/c-0042/orders,ms:3000}]}
[exit 0]

$ npx genie-react verify begin --session art-m4 --name 'open Recent orders' --claim 'render CustomerOrdersPanel min 1' --claim 'boundaries clean'
recording vfy_5a963876-274f-46a1-b006-6a0ad4d02520 "open Recent orders"
  url "http://[::1]:5224/customers/c-0042"
  1 null render CustomerOrdersPanel min 1  {}
  2 null boundaries clean  {}
window: {observationId:observation:1,startDocumentCommitId:6,domains:[react,query,router],quietMs:500,timeoutMs:10000,tailMs:500}
next: $ pnpm exec genie-react verify end vfy_5a963876-274f-46a1-b006-6a0ad4d02520 --session art-m4
session: {sessionId:a91578ed-0b29-43e4-80a3-01fb957459f1,logicalSessionId:93c72e49-38e7-4e17-aad5-50316084ea97,documentGeneration:7}
schemaVersion: "1.0"
targets: [{target:{component:CustomerOrdersPanel},status:pending,instances:0}]
startedAt: 2026-11-19T03:59:40.924Z
expiresAt: 2026-11-19T04:04:40.927Z
request: {budget:{fiberLimit:250,operationLimit:20000,timeLimitMs:8,targetOperationReserve:4000,targetTimeReserveMs:4,adaptive:true},settle:{quietMs:500,timeoutMs:10000},maxDurationMs:300000,allowOverrides:false}
[exit 0]

$ agent-browser --session art-m4 find role tab click --name 'Recent orders'
✓ Done
[exit 0]

$ agent-browser --session art-m4 snapshot -c -s main
- main
  - link "All customers" [ref=e812]
  - sectionheader
    - heading "Quarry Retail" [level=1, ref=e821]
    - StaticText "starter"
    - paragraph
      - StaticText "LATAM · Managed by Tara Novak"
    - button "Edit account" [ref=e822]
  - tablist "Customer sections"
    - tab "Profile" [ref=e823]
    - tab "Recent orders" [selected, ref=e824]
[exit 0]

$ agent-browser --session art-m4 screenshot /tmp/art-m4/suspense-fixed-loading.png
✓ Screenshot saved to /tmp/art-m4/suspense-fixed-loading.png
[exit 0]

$ npx genie-react verify end vfy_5a963876-274f-46a1-b006-6a0ad4d02520 --session art-m4
pass vfy_5a963876-274f-46a1-b006-6a0ad4d02520 "open Recent orders"  3 commits, quiet after 3246 ms (react, query, router)
  url "http://[::1]:5224/customers/c-0042"
  1 pass render CustomerOrdersPanel min 1  {renders:1,mounts:1,updates:0,remounts:0,semantics:exact,instances:1,activeInstances:1}
      claim: {kind:renders,target:{component:CustomerOrdersPanel},min:1,counting:renders,allowRemount:false}
      deciding: [{kind:instance,mountId:mount:36,renders:1,mounts:1,updates:0,mountGeneration:1,latestDocumentCommitId:9,source:/src/features/customers/customer-detail-page.tsx:73:11}]
  2 pass boundaries clean  {caughtDuringWindow:0,caughtAtEnd:0}
      claim: {kind:boundaries-clean,scope:window}
      deciding: [{kind:boundary-log,scope:window,complete:true,afterDocumentCommitId:6}]
      caveats: [uncaught-errors-outside-boundaries-unobserved]
window: {observationId:observation:1,startDocumentCommitId:6,settledDocumentCommitId:9,frozenDocumentCommitId:9,commits:3,settle:{outcome:met,quietMs:500,timeoutMs:10000,waitedMs:3246,domains:{react:met,query:met,router:met}},tail:{ms:500,commits:0},environment:{bundle:development,strictMode:on,renderCollection:available,visibility:document}}
! ui-outcome-not-observed: Genie does not check the screen; confirm it with the UI driver
attempt 2 for these claims on this tab; previous pass vfy_9f5cbc14-131a-4dde-97f4-34c00055966a; document reloaded since
evidence: $ pnpm exec genie-react verify show vfy_5a963876-274f-46a1-b006-6a0ad4d02520 --session art-m4
session: {sessionId:a91578ed-0b29-43e4-80a3-01fb957459f1,logicalSessionId:93c72e49-38e7-4e17-aad5-50316084ea97,documentGeneration:7}
schemaVersion: "1.0"
exitCode: 0
stage: end
ledger: {fingerprint:cf_fbf898bbf4b0,scope:logical-session,storage:memory,attempt:2,history:[{verificationId:vfy_9f5cbc14-131a-4dde-97f4-34c00055966a,verdict:pass,reasons:[],endedAt:2026-11-19T03:59:24.059Z}],codeChangedSincePrevious:document-reloaded,failsOnSameCode:0}
evidence: {retained:true,tools:[react_get_renders,react_component_cohort,react_list_overrides,query_is_fetching,react_refresh_events,browser_visibility,react_profile_stop,react_error_state]}
startedAt: 2026-11-19T03:59:40.924Z
endedAt: 2026-11-19T03:59:50.306Z
request: {budget:{fiberLimit:250,operationLimit:20000,timeLimitMs:8,targetOperationReserve:4000,targetTimeReserveMs:4,adaptive:true},settle:{quietMs:500,timeoutMs:10000},maxDurationMs:300000,allowOverrides:false}
[exit 0]

$ npx genie-react call react_find_components --session art-m4 '{"query":"CustomerOrdersPanel","exact":true}' --json | jq -c '.matches[] | {id,name}'
{"id":10761174777981,"name":"CustomerOrdersPanel"}
[exit 0]

$ npx genie-react call react_toggle_suspense_fallback --session art-m4 '{"id":10761174777981,"showFallback":true}'
ok: true
boundaryId: 10761174777973
showingFallback: true
activeOverrides: 1
[exit 0]

$ agent-browser --session art-m4 snapshot -c -s main
- main
  - link "All customers" [ref=e812]
  - sectionheader
    - heading "Quarry Retail" [level=1, ref=e821]
    - StaticText "starter"
    - paragraph
      - StaticText "LATAM · Managed by Tara Novak"
    - button "Edit account" [ref=e822]
  - tablist "Customer sections"
    - tab "Profile" [ref=e823]
    - tab "Recent orders" [selected, ref=e824]
[exit 0]

$ npx genie-react call react_suspense --session art-m4 '{}' --json | jq -c '.boundaries[] | {id,state,forced,source:.source.functionName,file:.source.file}'
{"id":10761174777973,"state":"fallback","forced":true,"source":"CustomerDetailPage","file":"/src/features/customers/customer-detail-page.tsx"}
{"id":10761174777868,"state":"content","forced":false,"source":"Matches","file":"/node_modules/.pnpm/@tanstack+react-router@1.170.41_react-dom@19.3.1_react@19.3.1__react@19.3.1/node_modules/@tanstack/react-router/dist/esm/Matches.js"}
{"id":10761174777905,"state":"content","forced":false,"source":"OutletImpl","file":"/node_modules/.pnpm/@tanstack+react-router@1.170.41_react-dom@19.3.1_react@19.3.1__react@19.3.1/node_modules/@tanstack/react-router/dist/esm/Match.js"}
{"id":10761174777916,"state":"content","forced":false,"source":"AuthenticatedLayout","file":"/src/routes/_app.tsx"}
{"id":10761174777930,"state":"content","forced":false,"source":"MatchView","file":"/node_modules/.pnpm/@tanstack+react-router@1.170.41_react-dom@19.3.1_react@19.3.1__react@19.3.1/node_modules/@tanstack/react-router/dist/esm/Match.js"}
[exit 0]

$ npx genie-react call react_reset_overrides --session art-m4 '{}'
ok: true
cleared: [{kind:suspense,componentName:Suspense,outcome:released}]
remaining: 0
commitObserved: true
[exit 0]

$ git checkout -- src/features/customers/customer-detail-page.tsx   (fix reverted)

$ npx genie-react call app_set_latency --session art-m4 '{}' --fields latency
[1]:
  - {latency:[]}
[exit 0]

$ npx genie-react call app_inject_fault --session art-m4 '{"path":"/api/customers","method":"GET","status":503}' --fields faults
[1]:
  - {faults:[{method:GET,path:/api/customers,status:503,remaining:null}]}
[exit 0]

$ agent-browser --session art-m4 open "http://[::1]:5224/customers"
✓ Meridian Ops
  http://[::1]:5224/customers?page=1&q=
[exit 0]

$ agent-browser --session art-m4 wait --text 'Customers could not be loaded'
✗ Wait timed out after 25000ms
[exit 1]

$ agent-browser --session art-m4 snapshot -c -s main
- main
  - alert
    - paragraph
      - StaticText "This page could not be loaded"
    - paragraph
      - StaticText "Injected 503 for GET /api/customers"
    - button "Retry" [ref=e837]
[exit 0]

$ npx genie-react call app_clear_faults --session art-m4 '{}' --fields faults
[1]:
  - {faults:[]}
[exit 0]

$ agent-browser --session art-m4 open "http://[::1]:5224/customers"
✓ Meridian Ops
  http://[::1]:5224/customers?page=1&q=
[exit 0]

$ agent-browser --session art-m4 wait --text '1,200 accounts'
1,200 accounts
[exit 0]

$ npx genie-react call app_inject_fault --session art-m4 '{"path":"/api/customers","method":"GET","status":503}' --fields faults
[1]:
  - {faults:[{method:GET,path:/api/customers,status:503,remaining:null}]}
[exit 0]

$ agent-browser --session art-m4 find label 'Refresh customers' click
✓ Done
[exit 0]

$ agent-browser --session art-m4 wait --text 'Customers could not be loaded'
Customers could not be loaded
[exit 0]

$ agent-browser --session art-m4 snapshot -c -s main -d 4
- main
  - sectionheader
    - heading "Customers" [level=1, ref=e851]
    - paragraph
      - StaticText "1,200 accounts"
    - StaticText "Updated 4 seconds ago"
    - button "Refresh customers" [ref=e852]
  - textbox "Search customers" [ref=e853]
  - combobox "Tier" [expanded=false, ref=e842]: All tiers
    - MenuListPopup
      - option "All tiers" [selected, ref=e854]
      - option "enterprise" [ref=e855]
      - option "growth" [ref=e856]
      - option "starter" [ref=e857]
  - alert
    - paragraph
      - StaticText "Customers could not be loaded"
    - paragraph
      - StaticText "Injected 503 for GET /api/customers"
    - button "Retry" [ref=e858]
[exit 0]

$ npx genie-react call app_clear_faults --session art-m4 '{}' --fields faults
[1]:
  - {faults:[]}
[exit 0]

$ agent-browser --session art-m4 open "http://[::1]:5224/customers"
✓ Meridian Ops
  http://[::1]:5224/customers?page=1&q=
[exit 0]

$ agent-browser --session art-m4 wait --text '1,200 accounts'
1,200 accounts
[exit 0]

$ npx genie-react call query_simulate_state --session art-m4 '{"queryKey":["customers","list",{"page":1,"pageSize":25,"q":""}],"state":"error"}'
ok: true
queryHash: "[\"customers\",\"list\",{\"page\":1,\"pageSize\":25,\"q\":\"\"}]"
simulatedState: error
originalStatus: success
[exit 0]

$ npx genie-react call query_get --session art-m4 '{"queryKey":["customers","list",{"page":1,"pageSize":25,"q":""}],"depth":1}' --json | jq -c '{status,simulatedState,dataUpdatedAt,error,hasData:(.data!=null)}'
{"status":"error","simulatedState":"error","dataUpdatedAt":1795060883396,"error":"Simulated query error","hasData":false}
[exit 0]

$ agent-browser --session art-m4 snapshot -c -s 'main header'
- sectionheader
  - heading "Customers" [level=1, ref=e872]
  - paragraph
    - StaticText "Loading accounts…"
  - StaticText "Updated 1 second ago"
  - button "Refresh customers" [ref=e873]
[exit 0]

$ npx genie-react call query_restore_state --session art-m4 '{"all":true}'
ok: true
restored: 1
outcomes[1]:
  - {queryHash:"[\"customers\",\"list\",{\"page\":1,\"pageSize\":25,\"q\":\"\"}]",outcome:restored,refetched:false}
[exit 0]

$ npx genie-react call react_reset_overrides --session art-m4 '{}'
ok: true
cleared: []
remaining: 0
[exit 0]

$ agent-browser --session art-m4 snapshot -c -s 'main header'
- sectionheader
  - heading "Customers" [level=1, ref=e872]
  - paragraph
    - StaticText "1,200 accounts"
  - StaticText "Updated 1 second ago"
  - button "Refresh customers" [ref=e873]
[exit 0]
```

## Re-run on Genie 1.1.0

- Date: 2026-11-19
- Commit: `ce408cb205c0e798cb04c35512772b7454283141` (`git rev-parse HEAD`)
- App: `apps/realworld-dashboard` (Meridian Ops), screens `/customers` and `/customers/c-0042`
- URL: `http://127.0.0.1:5242/` (dev server started with `DASHBOARD_PORT=5242 pnpm exec vite --port 5242 --strictPort` from `apps/realworld-dashboard`)
- Driver: agent-browser 0.43.0, session `upd-f`. Genie CLI, hub and runtime 1.1.0 from this checkout (`pnpm install && pnpm build`).
- The reference fix for `customer-orders-tab-blanks-page` was applied only between the `git diff` and `git checkout` markers below and reverted with git. It is not committed.
- New in this run: `query_get` reads `dataUpdatedAt` and `dataUpdateCount` during each simulation, the error state runs once more with `"keepData":true`, and both `verify` runs add the claim `suspense CustomerDetailPage hidden max 0`.

Every command below ran in this order from `apps/realworld-dashboard`. Output is complete and untrimmed. A `jq` filter inside a command is part of that command. `[exit N]` is the command's exit code.

```text

$ git rev-parse HEAD
ce408cb205c0e798cb04c35512772b7454283141
[exit 0]

$ node_modules/.bin/genie-react --version
1.1.0
[exit 0]

$ agent-browser --version
agent-browser 0.43.0
[exit 0]

$ agent-browser --session upd-f open "http://127.0.0.1:5242/login"
[agent-browser] launched browser
✓ Meridian Ops
  http://127.0.0.1:5242/login
[exit 0]

$ npx genie-react status --session upd-f --wait 15000 --json | jq -c "{ready,app:.app.name,url:.app.url,runtime:.sessions[0].runtimeVersion,hub:.hub.version}"
{"ready":true,"app":"Meridian Ops","url":"http://127.0.0.1:5242/login","runtime":"1.1.0","hub":"1.1.0"}
[exit 0]

$ npx genie-react call app_login_as --session upd-f '{"role":"manager"}'
changed: true
role: manager
userId: u-manager
[exit 0]

$ npx genie-react call app_reset_backend --session upd-f '{}'
seed: 20260302
faults: []
latency: []
latencyScale: 1
requestCount: 0
counts: {orders:6000,customers:1200,products:2400}
[exit 0]

$ agent-browser --session upd-f open "http://127.0.0.1:5242/customers"
✓ Meridian Ops
  http://127.0.0.1:5242/customers?page=1&q=
[exit 0]

$ npx genie-react status --session upd-f --wait 15000 --json | jq -c "{ready,url:.app.url}"
{"ready":true,"url":"http://127.0.0.1:5242/customers?page=1&q="}
[exit 0]

$ npx genie-react call devtools_wait --session upd-f '{"condition":"settled","domains":["react","query","router"],"timeoutMs":10000}' --fields ok,waitedMs
[1]:
  - {ok:true,waitedMs:621}
[exit 0]

$ npx genie-react call query_list --session upd-f '{}' --fields queryHash,status,observerCount
[2]:
  - {queryHash:"[\"customers\",\"list\",{\"page\":1,\"pageSize\":25,\"q\":\"\"}]",status:success,observerCount:1}
  - {queryHash:"[\"notifications\"]",status:success,observerCount:1}
[exit 0]

$ agent-browser --session upd-f snapshot -c -s 'main header'
- sectionheader
  - heading "Customers" [level=1, ref=e13]
  - paragraph
    - StaticText "1,200 accounts"
  - StaticText "Updated 1 second ago"
  - button "Refresh customers" [ref=e14]
[exit 0]

$ agent-browser --session upd-f snapshot -c -s 'main header'
- sectionheader
  - heading "Customers" [level=1, ref=e13]
  - paragraph
    - StaticText "1,200 accounts"
  - StaticText "Updated 8 seconds ago"
  - button "Refresh customers" [ref=e14]
[exit 0]

$ npx genie-react call query_simulate_state --session upd-f '{"queryKey":["customers","list",{"page":1,"pageSize":25,"q":""}],"state":"pending"}'
ok: true
queryHash: "[\"customers\",\"list\",{\"page\":1,\"pageSize\":25,\"q\":\"\"}]"
simulatedState: pending
originalStatus: success
[exit 0]

$ agent-browser --session upd-f snapshot -c -s main
- main
  - sectionheader
    - heading "Customers" [level=1, ref=e13]
    - paragraph
      - StaticText "Loading accounts…"
    - StaticText "Not synced yet"
    - button "Refresh customers" [ref=e14]
  - textbox "Search customers" [ref=e15]
  - combobox "Tier" [expanded=false, ref=e5]: All tiers
    - MenuListPopup
      - option "All tiers" [selected, ref=e17]
      - option "enterprise" [ref=e18]
      - option "growth" [ref=e19]
      - option "starter" [ref=e20]
  - status "Loading page"
[exit 0]

$ npx genie-react call query_get --session upd-f '{"queryKey":["customers","list",{"page":1,"pageSize":25,"q":""}],"depth":1}' --fields status,fetchStatus,dataUpdatedAt,dataUpdateCount,simulatedState
[1]:
  - {status:pending,fetchStatus:fetching,dataUpdatedAt:0,dataUpdateCount:0,simulatedState:pending}
[exit 0]

$ npx genie-react call query_simulate_state --session upd-f '{"queryKey":["customers","list",{"page":1,"pageSize":25,"q":""}],"state":"error","errorMessage":"GET /api/customers failed with 503"}'
ok: true
queryHash: "[\"customers\",\"list\",{\"page\":1,\"pageSize\":25,\"q\":\"\"}]"
simulatedState: error
originalStatus: success
[exit 0]

$ agent-browser --session upd-f snapshot -c -s main
- main
  - sectionheader
    - heading "Customers" [level=1, ref=e13]
    - paragraph
      - StaticText "Loading accounts…"
    - StaticText "Not synced yet"
    - button "Refresh customers" [ref=e14]
  - textbox "Search customers" [ref=e15]
  - combobox "Tier" [expanded=false, ref=e5]: All tiers
    - MenuListPopup
      - option "All tiers" [selected, ref=e17]
      - option "enterprise" [ref=e18]
      - option "growth" [ref=e19]
      - option "starter" [ref=e20]
  - alert
    - paragraph
      - StaticText "Customers could not be loaded"
    - paragraph
      - StaticText "GET /api/customers failed with 503"
    - button "Retry" [ref=e230]
[exit 0]

$ npx genie-react call query_get --session upd-f '{"queryKey":["customers","list",{"page":1,"pageSize":25,"q":""}],"depth":1}' --json | jq -c '{status,simulatedState,dataUpdatedAt,dataUpdateCount,hasData:(.data!=null)}'
{"status":"error","simulatedState":"error","dataUpdatedAt":0,"dataUpdateCount":0,"hasData":false}
[exit 0]

$ npx genie-react call query_simulate_state --session upd-f '{"queryKey":["customers","list",{"page":1,"pageSize":25,"q":""}],"state":"error","keepData":true,"errorMessage":"GET /api/customers failed with 503"}'
ok: true
queryHash: "[\"customers\",\"list\",{\"page\":1,\"pageSize\":25,\"q\":\"\"}]"
simulatedState: error
originalStatus: success
[exit 0]

$ agent-browser --session upd-f snapshot -c -s main -d 4
- main
  - sectionheader
    - heading "Customers" [level=1, ref=e13]
    - paragraph
      - StaticText "1,200 accounts"
    - StaticText "Updated 17 seconds ago"
    - button "Refresh customers" [ref=e14]
  - textbox "Search customers" [ref=e15]
  - combobox "Tier" [expanded=false, ref=e5]: All tiers
    - MenuListPopup
      - option "All tiers" [selected, ref=e17]
      - option "enterprise" [ref=e18]
      - option "growth" [ref=e19]
      - option "starter" [ref=e20]
  - alert
    - paragraph
      - StaticText "Customers could not be loaded"
    - paragraph
      - StaticText "GET /api/customers failed with 503"
    - button "Retry" [ref=e230]
[exit 0]

$ npx genie-react call query_get --session upd-f '{"queryKey":["customers","list",{"page":1,"pageSize":25,"q":""}],"depth":1}' --json | jq -c '{status,simulatedState,dataUpdatedAt,dataUpdateCount,hasData:(.data!=null),isRefetchError:.observers[0].currentResult.isRefetchError}'
{"status":"error","simulatedState":"error","dataUpdatedAt":1795078601757,"dataUpdateCount":2,"hasData":true,"isRefetchError":true}
[exit 0]

$ npx genie-react call query_restore_state --session upd-f '{"all":true}'
ok: true
restored: 1
outcomes[1]:
  - {queryHash:"[\"customers\",\"list\",{\"page\":1,\"pageSize\":25,\"q\":\"\"}]",outcome:restored,refetched:false}
[exit 0]

$ npx genie-react call query_get --session upd-f '{"queryKey":["customers","list",{"page":1,"pageSize":25,"q":""}],"depth":1}' --json | jq -c '{status,simulatedState,dataUpdatedAt,dataUpdateCount,hasData:(.data!=null)}'
{"status":"success","simulatedState":null,"dataUpdatedAt":1795078601757,"dataUpdateCount":2,"hasData":true}
[exit 0]

$ agent-browser --session upd-f snapshot -c -s 'main header'
- sectionheader
  - heading "Customers" [level=1, ref=e13]
  - paragraph
    - StaticText "1,200 accounts"
  - StaticText "Updated 27 seconds ago"
  - button "Refresh customers" [ref=e14]
[exit 0]

$ npx genie-react call app_inject_fault --session upd-f '{"path":"/api/customers","method":"GET","status":503}' --fields faults
[1]:
  - {faults:[{method:GET,path:/api/customers,status:503,remaining:null}]}
[exit 0]

$ agent-browser --session upd-f find label 'Refresh customers' click
✓ Done
[exit 0]

$ agent-browser --session upd-f wait --text 'Customers could not be loaded'
Customers could not be loaded
[exit 0]

$ agent-browser --session upd-f snapshot -c -s main -d 4
- main
  - sectionheader
    - heading "Customers" [level=1, ref=e13]
    - paragraph
      - StaticText "1,200 accounts"
    - StaticText "Updated 31 seconds ago"
    - button "Refresh customers" [ref=e14]
  - textbox "Search customers" [ref=e15]
  - combobox "Tier" [expanded=false, ref=e5]: All tiers
    - MenuListPopup
      - option "All tiers" [selected, ref=e17]
      - option "enterprise" [ref=e18]
      - option "growth" [ref=e19]
      - option "starter" [ref=e20]
  - alert
    - paragraph
      - StaticText "Customers could not be loaded"
    - paragraph
      - StaticText "Injected 503 for GET /api/customers"
    - button "Retry" [ref=e441]
[exit 0]

$ npx genie-react call query_get --session upd-f '{"queryKey":["customers","list",{"page":1,"pageSize":25,"q":""}],"depth":1}' --json | jq -c '{status,simulatedState,dataUpdatedAt,dataUpdateCount,hasData:(.data!=null),isRefetchError:.observers[0].currentResult.isRefetchError}'
{"status":"error","simulatedState":null,"dataUpdatedAt":1795078601757,"dataUpdateCount":2,"hasData":true,"isRefetchError":true}
[exit 0]

$ npx genie-react call app_clear_faults --session upd-f '{}' --fields faults
[1]:
  - {faults:[]}
[exit 0]

$ npx genie-react call react_find_components --session upd-f '{"query":"CustomersPage","exact":true}'
matches[1]:
  - {id:2418486018335,name:CustomersPage,path:"QueryClientProvider > AuthProvider > App > RouterProvider > RouterContextProvider > Matches > MatchesInner > CatchBoundary > MatchImpl > MatchView > CatchBoundary > CatchNotFound > CatchBoundary > MatchInnerImpl > RootLayout > OutletImpl > MatchImpl > MatchView > CatchBoundary > MatchInnerImpl > Lazy > AuthenticatedLayout > PermissionsProvider > AppShell > PreferencesProvider > OutletImpl > MatchImpl > MatchView > CatchBoundary > MatchInnerImpl > Lazy > CustomersPage",kind:function,props:{},source:{file:/src/features/customers/customers-page.tsx,line:42,column:5,functionName:CustomersPage,sourceMapConfidence:mapped,role:component-body},isLibrary:false}
ownershipCoverage: {complete:true,totalCandidates:1,app:1,library:0,unknown:0}
omittedByLimit: 0
scanTruncated: false
nextCursor: null
unmountedSinceSearch: 0
[exit 0]

$ npx genie-react call react_inspect_component --session upd-f '{"id":2418486018335}'
id: 2418486018335
name: CustomersPage
kind: function
props: {}
hooks[19]:
  - {index:0,kind:ref,hook:useRef,stateful:false,customHooks:[useSearch,useMatch,useStructuralSharing],value:{}}
  - {index:1,kind:callback,hook:useCallback,stateful:false,customHooks:[useSearch,useMatch,useSelector],value:["ƒ anonymous()",[{__genie_dehydrated__:true,kind:object,preview:"{…}",path:[1,0]}]]}
  - {index:2,kind:callback,hook:useCallback,stateful:false,customHooks:[useSearch,useMatch,useSelector],value:["ƒ anonymous()",[{__genie_dehydrated__:true,kind:object,preview:"{…}",path:[1,0]}]]}
  - {index:3,kind:ref,hook:useRef,stateful:false,customHooks:[useSearch,useMatch,useSelector,useSyncExternalStoreWithSelector],value:{current:{hasValue:true,value:{__genie_dehydrated__:true,kind:object,preview:"{…}",path:[current,value]}}}}
  - {index:4,kind:memo,hook:useMemo,stateful:false,customHooks:[useSearch,useMatch,useSelector,useSyncExternalStoreWithSelector],value:[["ƒ anonymous()","ƒ anonymous()"],["ƒ anonymous()","ƒ anonymous()","ƒ anonymous()","ƒ defaultCompare()"]]}
  - {index:5,kind:other,hook:useSyncExternalStore,stateful:false,customHooks:[useSearch,useMatch,useSelector,useSyncExternalStoreWithSelector],value:{page:1,q:""}}
  - {index:6,kind:effect,hook:useSyncExternalStore,stateful:false,customHooks:[useSearch,useMatch,useSelector,useSyncExternalStoreWithSelector],deps:["ƒ anonymous()"]}
  - {index:7,kind:effect,hook:useEffect,stateful:false,customHooks:[useSearch,useMatch,useSelector,useSyncExternalStoreWithSelector],deps:[{page:1,q:""}]}
  - {index:8,kind:callback,hook:useCallback,stateful:false,customHooks:[useNavigate],value:["ƒ anonymous()",[/customers/,{__genie_dehydrated__:true,kind:object,preview:"Router {…}",path:[1,1]}]]}
  - {index:9,kind:state,hook:useState,stateful:true,stateIndex:0,value:""}
  - {index:10,kind:state,hook:useState,stateful:true,stateIndex:1,customHooks:[useDebouncedValue],value:""}
  - {index:11,kind:effect,hook:useEffect,stateful:false,customHooks:[useDebouncedValue],deps:["",250]}
  - {index:12,kind:effect,hook:useEffect,stateful:false,customHooks:[useQuery,useBaseQuery,useClearResetErrorBoundary],deps:[{clearReset:"ƒ clearReset()",reset:"ƒ reset()",isReset:"ƒ isReset()"}]}
  - {index:13,kind:state,hook:useState,stateful:true,stateIndex:2,customHooks:[useQuery,useBaseQuery],value:{listeners:{__type:Set,values:["ƒ anonymous()"]},subscribe:"ƒ bound subscribe()",options:{retry:"ƒ retry()",refetchOnWindowFocus:false,queryKey:{__genie_dehydrated__:true,kind:array,preview:"Array(3)",path:[options,queryKey],size:3},queryFn:"ƒ queryFn()",placeholderData:"ƒ keepPreviousData()",_defaulted:true,queryHash:"[\"customers\",\"list\",{\"page\":1,\"pageSize\":25,\"q\":\"\"}]",refetchOnReconnect:true,throwOnError:false,_optimisticResults:optimistic},refetch:"ƒ bound refetch()"}}
  - {index:14,kind:callback,hook:useCallback,stateful:false,customHooks:[useQuery,useBaseQuery],value:["ƒ anonymous()",[{__genie_dehydrated__:true,kind:object,preview:"QueryObserver {…}",path:[1,0]},true]]}
  - {index:15,kind:other,hook:useSyncExternalStore,stateful:false,customHooks:[useQuery,useBaseQuery],value:{status:error,fetchStatus:idle,isPending:false,isSuccess:false,isError:true,isInitialLoading:false,isLoading:false,data:{items:{__genie_dehydrated__:true,kind:array,preview:"Array(25)",path:[data,items],size:25},total:1200,page:1,pageSize:25},dataUpdatedAt:1795078601757,error:{__type:Error,name:ApiError,message:"Injected 503 for GET /api/customers",status:503,code:injected_fault},errorUpdatedAt:1795078632994,failureCount:3,failureReason:{__type:Error,name:ApiError,message:"Injected 503 for GET /api/customers",status:503,code:injected_fault},errorUpdateCount:1,isFetched:true,isFetchedAfterMount:true,isFetching:false,isRefetching:false,isLoadingError:false,isPaused:false,isPlaceholderData:false,isRefetchError:true,isStale:true,refetch:"ƒ bound refetch()",promise:{__genie_dehydrated__:true,kind:promise,preview:Promise,path:[promise]},isEnabled:true}}
  - {index:16,kind:effect,hook:useSyncExternalStore,stateful:false,customHooks:[useQuery,useBaseQuery],deps:["ƒ anonymous()"]}
  - {index:17,kind:effect,hook:useEffect,stateful:false,customHooks:[useQuery,useBaseQuery],deps:[{retry:"ƒ retry()",refetchOnWindowFocus:false,queryKey:{__genie_dehydrated__:true,kind:array,preview:"Array(3)",path:[0,queryKey],size:3},queryFn:"ƒ queryFn()",placeholderData:"ƒ keepPreviousData()",_defaulted:true,queryHash:"[\"customers\",\"list\",{\"page\":1,\"pageSize\":25,\"q\":\"\"}]",refetchOnReconnect:true,throwOnError:false,_optimisticResults:optimistic},{listeners:{__genie_dehydrated__:true,kind:set,preview:"Set(1)",path:[1,listeners],size:1},subscribe:"ƒ bound subscribe()",options:{__genie_dehydrated__:true,kind:object,preview:"{…}",path:[1,options]},refetch:"ƒ bound refetch()"}]}
  - {index:18,kind:effect,hook:useEffect,stateful:false,deps:["","","ƒ anonymous()"]}
customHookGrouping: exact
wrapperAncestry: []
[exit 0]

$ npx genie-react call react_override_hook_state --session upd-f '{"id":2418486018335,"stateIndex":0,"value":"zzqx"}'
ok: true
name: CustomersPage
hookIndex: 9
stateIndex: 0
commitObserved: true
[exit 0]

$ npx genie-react call devtools_wait --session upd-f '{"condition":"settled","domains":["react","query","router"],"timeoutMs":10000}' --fields ok,waitedMs
[1]:
  - {ok:true,waitedMs:1381}
[exit 0]

$ agent-browser --session upd-f get url
http://127.0.0.1:5242/customers?page=1&q=zzqx
[exit 0]

$ agent-browser --session upd-f snapshot -c -s main
- main
  - sectionheader
    - heading "Customers" [level=1, ref=e13]
    - paragraph
      - StaticText "0 accounts"
    - StaticText "Updated now"
    - button "Refresh customers" [ref=e14]
  - textbox "Search customers" [ref=e15]: zzqx
    - StaticText "zzqx"
  - combobox "Tier" [expanded=false, ref=e5]: All tiers
    - MenuListPopup
      - option "All tiers" [selected, ref=e17]
      - option "enterprise" [ref=e18]
      - option "growth" [ref=e19]
      - option "starter" [ref=e20]
  - paragraph
    - StaticText "No customers match"
  - paragraph
    - StaticText "Try a different name or clear the tier filter."
[exit 0]

$ npx genie-react call react_reset_overrides --session upd-f '{}'
ok: true
cleared: [{kind:hook,componentName:CustomersPage,outcome:restored}]
remaining: 0
commitObserved: true
[exit 0]

$ npx genie-react call devtools_wait --session upd-f '{"condition":"settled","domains":["react","query","router"],"timeoutMs":10000}' --fields ok,waitedMs
[1]:
  - {ok:true,waitedMs:1382}
[exit 0]

$ agent-browser --session upd-f get url
http://127.0.0.1:5242/customers?page=1&q=
[exit 0]

$ agent-browser --session upd-f snapshot -c -s 'main header'
- sectionheader
  - heading "Customers" [level=1, ref=e13]
  - paragraph
    - StaticText "1,200 accounts"
  - StaticText "Updated 1 second ago"
  - button "Refresh customers" [ref=e14]
[exit 0]

$ agent-browser --session upd-f open "http://127.0.0.1:5242/customers/c-0042"
✓ Meridian Ops
  http://127.0.0.1:5242/customers/c-0042
[exit 0]

$ npx genie-react status --session upd-f --wait 15000 --json | jq -c "{ready,url:.app.url}"
{"ready":true,"url":"http://127.0.0.1:5242/customers/c-0042"}
[exit 0]

$ agent-browser --session upd-f find role tab click --name 'Recent orders'
✓ Done
[exit 0]

$ npx genie-react call devtools_wait --session upd-f '{"condition":"settled","domains":["react","query","router"],"timeoutMs":10000}' --fields ok,waitedMs
[1]:
  - {ok:true,waitedMs:765}
[exit 0]

$ agent-browser --session upd-f snapshot -c -s main -d 3
- main
  - link "All customers" [ref=e657]
  - sectionheader
    - heading "Quarry Retail" [level=1, ref=e666]
    - StaticText "starter"
    - paragraph
      - StaticText "LATAM · Managed by Tara Novak"
    - button "Edit account" [ref=e667]
  - tablist "Customer sections"
    - tab "Profile" [ref=e668]
    - tab "Recent orders" [selected, ref=e669]
  - table "Recent orders"
    - row
      - cell "SO-105159" [ref=e670]
      - cell "Pending" [ref=e671]
      - cell "Feb 13, 2026" [ref=e672]
      - cell "$1,311.62" [ref=e673]
    - row
      - cell "SO-104085" [ref=e674]
      - cell "Delivered" [ref=e675]
      - cell "Jan 23, 2026" [ref=e676]
      - cell "$12,986.98" [ref=e677]
    - row
      - cell "SO-103582" [ref=e678]
      - cell "Delivered" [ref=e679]
      - cell "Jan 13, 2026" [ref=e680]
      - cell "$4,856.40" [ref=e681]
    - row
      - cell "SO-103559" [ref=e682]
      - cell "Processing" [ref=e683]
      - cell "Jan 12, 2026" [ref=e684]
      - cell "$5,225.36" [ref=e685]
    - row
      - cell "SO-103124" [ref=e686]
      - cell "Processing" [ref=e687]
      - cell "Jan 3, 2026" [ref=e688]
      - cell "$12,253.53" [ref=e689]
    - row
      - cell "SO-102268" [ref=e690]
      - cell "Processing" [ref=e691]
      - cell "Dec 17, 2025" [ref=e692]
      - cell "$10,007.28" [ref=e693]
    - row
      - cell "SO-102109" [ref=e694]
      - cell "Delivered" [ref=e695]
      - cell "Dec 14, 2025" [ref=e696]
      - cell "$20,597.60" [ref=e697]
    - row
      - cell "SO-101900" [ref=e698]
      - cell "Delivered" [ref=e699]
      - cell "Dec 10, 2025" [ref=e700]
      - cell "$14,546.47" [ref=e701]
    - row
      - cell "SO-101273" [ref=e702]
      - cell "Delivered" [ref=e703]
      - cell "Nov 27, 2025" [ref=e704]
      - cell "$962.44" [ref=e705]
    - row
      - cell "SO-100173" [ref=e706]
      - cell "Delivered" [ref=e707]
      - cell "Nov 5, 2025" [ref=e708]
      - cell "$5,061.90" [ref=e709]
[exit 0]

$ npx genie-react call react_find_components --session upd-f '{"query":"CustomerOrdersPanel","exact":true}' --json | jq -c '.matches[] | {id,name,path}'
{"id":11958380134513,"name":"CustomerOrdersPanel","path":"QueryClientProvider > AuthProvider > App > RouterProvider > RouterContextProvider > Matches > MatchesInner > CatchBoundary > MatchImpl > MatchView > CatchBoundary > CatchNotFound > CatchBoundary > MatchInnerImpl > RootLayout > OutletImpl > MatchImpl > MatchView > CatchBoundary > MatchInnerImpl > Lazy > AuthenticatedLayout > PermissionsProvider > AppShell > PreferencesProvider > OutletImpl > MatchImpl > MatchView > CatchBoundary > MatchInnerImpl > Lazy > CustomerDetailPage > CustomerOrdersPanel"}
[exit 0]

$ npx genie-react call react_toggle_suspense_fallback --session upd-f '{"id":11958380134513,"showFallback":true}'
ok: true
boundaryId: 11958380134450
showingFallback: true
activeOverrides: 1
[exit 0]

$ agent-browser --session upd-f snapshot -c -s main
(empty page)
[exit 0]

$ npx genie-react call react_suspense --session upd-f '{}'
capability: {reactVersion:19.3.1,bundle:development,asyncDebugInfo:available,reason:null}
observedAtMs: 7088.6
documentCommitId: 11
counts: {boundaries:4,fallback:1,transitionPending:0,dehydrated:0,content:3}
omittedByLimit: 0
coverage:
  complete: false
  scanTruncated: false
  fiberScanLimit: 20000
  waitingWithoutBlocker: 1
  unattributedEntries: 0
  unattributedSuspendedRoots: 0
  changedDuringRead: false
  commitScheduled: false
  sourcesPartial: false
  serverAwaits: none
ownershipCoverage: {complete:false,totalCandidates:4,app:0,library:3,unknown:1}
waitingHint: "<Suspense name=\"Suspense\"> #11958380134450 shows its fallback because react_toggle_suspense_fallback holds it; call react_reset_overrides to release it"
view: summary
boundaries[4]:
  each: {name:Suspense,stateEvidence:exact,hydration:null,blockersOmitted:0,source:{sourceMapConfidence:mapped,role:element-callsite},serverComponents:[],serverComponentsOmitted:0,blockers:[]}
  - {id:11958380134450,parentBoundaryId:11958380134436,state:fallback,forced:true,fallbackCommittedSinceMount:true,blockerStatus:not-observable,source:{file:/node_modules/.pnpm/@tanstack+react-router@1.170.41_react-dom@19.3.1_react@19.3.1__react@19.3.1/node_modules/@tanstack/react-router/dist/esm/Match.js,line:70,column:48,functionName:MatchView},sourceOwnership:library}
  - {id:11958380134412,parentBoundaryId:null,state:content,forced:false,fallbackCommittedSinceMount:false,blockerStatus:none,source:{file:/node_modules/.pnpm/@tanstack+react-router@1.170.41_react-dom@19.3.1_react@19.3.1__react@19.3.1/node_modules/@tanstack/react-router/dist/esm/Matches.js,line:23,column:261,functionName:Matches},sourceOwnership:library}
  - {id:11958380134425,parentBoundaryId:11958380134412,state:content,forced:false,fallbackCommittedSinceMount:false,blockerStatus:none,source:{file:/node_modules/.pnpm/@tanstack+react-router@1.170.41_react-dom@19.3.1_react@19.3.1__react@19.3.1/node_modules/@tanstack/react-router/dist/esm/Match.js,line:161,column:54,functionName:OutletImpl},sourceOwnership:library}
  - {id:11958380134436,parentBoundaryId:11958380134425,state:content,forced:false,fallbackCommittedSinceMount:false,blockerStatus:none,source:{file:/src/routes/_app.tsx,line:20,column:7,functionName:AuthenticatedLayout},sourceOwnership:unknown}
[exit 0]

$ npx genie-react call react_reset_overrides --session upd-f '{}'
ok: true
cleared: [{kind:suspense,componentName:Suspense,outcome:released}]
remaining: 0
commitObserved: true
[exit 0]

$ npx genie-react call query_restore_state --session upd-f '{"all":true}'
ok: true
restored: 0
outcomes: []
[exit 0]

$ agent-browser --session upd-f snapshot -c -s 'main header'
- sectionheader
  - heading "Quarry Retail" [level=1, ref=e666]
  - StaticText "starter"
  - paragraph
    - StaticText "LATAM · Managed by Tara Novak"
  - button "Edit account" [ref=e667]
[exit 0]

$ agent-browser --session upd-f open "http://127.0.0.1:5242/customers/c-0042"
✓ Meridian Ops
  http://127.0.0.1:5242/customers/c-0042
[exit 0]

$ npx genie-react status --session upd-f --wait 15000 --json | jq -c "{ready,url:.app.url}"
{"ready":true,"url":"http://127.0.0.1:5242/customers/c-0042"}
[exit 0]

$ npx genie-react call devtools_wait --session upd-f '{"condition":"settled","domains":["react","query","router"],"timeoutMs":10000}' --fields ok,waitedMs
[1]:
  - {ok:true,waitedMs:619}
[exit 0]

$ npx genie-react call app_set_latency --session upd-f '{"rules":[{"path":"/api/customers/c-0042/orders","ms":3000}]}'
seed: 20260302
faults: []
latency: [{path:/api/customers/c-0042/orders,ms:3000}]
latencyScale: 1
requestCount: 61
counts: {orders:6000,customers:1200,products:2400}
[exit 0]

$ npx genie-react verify begin --session upd-f --name 'open Recent orders' --claim 'render CustomerOrdersPanel min 1' --claim 'boundaries clean' --claim 'suspense CustomerDetailPage hidden max 0'
recording vfy_b7e44950-b3a7-4c52-b0c2-ca4806ff231c "open Recent orders"
  url "http://127.0.0.1:5242/customers/c-0042"
  1 recording render CustomerOrdersPanel min 1
  2 recording boundaries clean
  3 recording suspense CustomerDetailPage hidden max 0
window: {observationId:observation:1,startDocumentCommitId:6,domains:[react,query,router,network],quietMs:500,timeoutMs:10000,tailMs:500}
next: $ npx genie-react verify end vfy_b7e44950-b3a7-4c52-b0c2-ca4806ff231c --session upd-f
session: {sessionId:fe9b8724-74df-41dc-b17d-3147df28d180,logicalSessionId:e7ac44c4-a84a-4786-85e2-cbf0eb72cb57,documentGeneration:5}
schemaVersion: "1.0"
targets: [{target:{component:CustomerOrdersPanel},status:pending,instances:0},{target:{component:CustomerDetailPage},status:resolved,instances:1,source:/src/features/customers/customer-detail-page.tsx}]
startedAt: 2026-11-19T08:58:04.620Z
expiresAt: 2026-11-19T09:03:04.648Z
request: {budget:{fiberLimit:250,operationLimit:20000,timeLimitMs:8,targetOperationReserve:4000,targetTimeReserveMs:4,adaptive:true},settle:{quietMs:500,timeoutMs:10000},maxDurationMs:300000,allowOverrides:false}
[exit 0]

$ agent-browser --session upd-f find role tab click --name 'Recent orders'
✓ Done
[exit 0]

$ agent-browser --session upd-f snapshot -c -s main
(empty page)
[exit 0]

$ npx genie-react verify end vfy_b7e44950-b3a7-4c52-b0c2-ca4806ff231c --session upd-f
fail vfy_b7e44950-b3a7-4c52-b0c2-ca4806ff231c "open Recent orders"  4 commits, quiet after 3506 ms (react, query, router, network)
  url "http://127.0.0.1:5242/customers/c-0042"
  1 pass render CustomerOrdersPanel min 1  {renders:2,mounts:1,updates:1,remounts:0,semantics:exact,instances:1,activeInstances:1}
      claim: {kind:renders,target:{component:CustomerOrdersPanel},min:1,counting:renders,allowRemount:false}
      deciding: [{kind:instance,mountId:mount:24,renders:2,mounts:1,updates:1,mountGeneration:1,latestDocumentCommitId:10,source:/src/features/customers/customer-detail-page.tsx:71:9}]
  2 pass boundaries clean  {caughtDuringWindow:0,caughtAtEnd:0}
      claim: {kind:boundaries-clean,scope:window}
      deciding: [{kind:boundary-log,scope:window,complete:true,afterDocumentCommitId:6}]
      caveats: [uncaught-errors-outside-boundaries-unobserved]
  3 fail suspense CustomerDetailPage hidden max 0  {hidden:1,hidesInWindow:1}
      claim: {kind:suspense-hidden,target:{component:CustomerDetailPage},max:0}
      deciding: [{kind:suspense-hide,hideId:hide:7:1,documentCommitId:7,boundary:Suspense,boundaryId:3450888781878}]
window: {observationId:observation:1,startDocumentCommitId:6,settledDocumentCommitId:10,frozenDocumentCommitId:10,commits:4,settle:{outcome:met,quietMs:500,timeoutMs:10000,waitedMs:3506,domains:{react:met,query:met,router:met,network:met}},tail:{ms:500,commits:0},environment:{bundle:development,strictMode:on,renderCollection:available,visibility:document}}
! ui-outcome-not-observed: Genie does not check the screen; confirm it with the UI driver
attempt 1 for these claims on this tab
evidence: $ npx genie-react verify show vfy_b7e44950-b3a7-4c52-b0c2-ca4806ff231c --claim 3 --session upd-f
session: {sessionId:fe9b8724-74df-41dc-b17d-3147df28d180,logicalSessionId:e7ac44c4-a84a-4786-85e2-cbf0eb72cb57,documentGeneration:5}
schemaVersion: "1.0"
exitCode: 1
stage: end
ledger: {fingerprint:cf_5a5c9002323a,scope:logical-session,storage:memory,attempt:1,history:[],codeChangedSincePrevious:null,failsOnSameCode:0}
evidence: {retained:true,tools:[react_get_renders,react_component_cohort,react_list_overrides,query_is_fetching,react_refresh_events,browser_visibility,request_watch_start,request_watch_stop,react_profile_stop,react_error_state]}
startedAt: 2026-11-19T08:58:04.620Z
endedAt: 2026-11-19T08:58:14.549Z
request: {budget:{fiberLimit:250,operationLimit:20000,timeLimitMs:8,targetOperationReserve:4000,targetTimeReserveMs:4,adaptive:true},settle:{quietMs:500,timeoutMs:10000},maxDurationMs:300000,allowOverrides:false}
[exit 1]

$ agent-browser --session upd-f snapshot -c -s main -d 2
- main
  - link "All customers" [ref=e737]
  - sectionheader
    - heading "Quarry Retail" [level=1, ref=e738]
    - StaticText "starter"
    - button "Edit account" [ref=e739]
  - tablist "Customer sections"
    - tab "Profile" [ref=e740]
    - tab "Recent orders" [selected, ref=e741]
  - table "Recent orders"
[exit 0]

$ git diff  (reference fix applied temporarily)
diff --git a/apps/realworld-dashboard/src/features/customers/customer-detail-page.tsx b/apps/realworld-dashboard/src/features/customers/customer-detail-page.tsx
index 79352e5..c93c72e 100644
--- a/apps/realworld-dashboard/src/features/customers/customer-detail-page.tsx
+++ b/apps/realworld-dashboard/src/features/customers/customer-detail-page.tsx
@@ -1,9 +1,10 @@
 import { useSuspenseQuery } from '@tanstack/react-query'
 import { Link, useParams } from '@tanstack/react-router'
 import { ArrowLeft, Pencil } from 'lucide-react'
-import { useEffect, useState } from 'react'
+import { Suspense, useEffect, useState } from 'react'
 import { PermissionGate } from '../../app/permissions'
 import { Button } from '../../components/ui/button'
+import { Skeleton } from '../../components/ui/feedback'
 import { Tabs } from '../../components/ui/tabs'
 import { useWorkspaceStore } from '../../stores/workspace'
 import { CustomerEditModal } from './customer-edit-modal'
@@ -68,7 +69,9 @@ export function CustomerDetailPage() {
           <RelatedAccounts ids={customer.relatedIds} />
         </div>
       ) : (
-        <CustomerOrdersPanel customerId={customer.id} />
+        <Suspense fallback={<Skeleton className="h-64" />}>
+          <CustomerOrdersPanel customerId={customer.id} />
+        </Suspense>
       )}
       {editing && <CustomerEditModal customer={customer} onClose={() => setEditing(false)} />}
     </div>

$ agent-browser --session upd-f open "http://127.0.0.1:5242/customers/c-0042"
✓ Meridian Ops
  http://127.0.0.1:5242/customers/c-0042
[exit 0]

$ npx genie-react status --session upd-f --wait 15000 --json | jq -c "{ready,url:.app.url}"
{"ready":true,"url":"http://127.0.0.1:5242/customers/c-0042"}
[exit 0]

$ npx genie-react call devtools_wait --session upd-f '{"condition":"settled","domains":["react","query","router"],"timeoutMs":10000}' --fields ok,waitedMs
[1]:
  - {ok:true,waitedMs:621}
[exit 0]

$ npx genie-react call app_backend_state --session upd-f '{}' --fields latency
[1]:
  - {latency:[{path:/api/customers/c-0042/orders,ms:3000}]}
[exit 0]

$ npx genie-react verify begin --session upd-f --name 'open Recent orders' --claim 'render CustomerOrdersPanel min 1' --claim 'boundaries clean' --claim 'suspense CustomerDetailPage hidden max 0'
recording vfy_7c6d1cff-15f4-438c-9b22-af86ef34ed1e "open Recent orders"
  url "http://127.0.0.1:5242/customers/c-0042"
  1 recording render CustomerOrdersPanel min 1
  2 recording boundaries clean
  3 recording suspense CustomerDetailPage hidden max 0
window: {observationId:observation:1,startDocumentCommitId:6,domains:[react,query,router,network],quietMs:500,timeoutMs:10000,tailMs:500}
next: $ npx genie-react verify end vfy_7c6d1cff-15f4-438c-9b22-af86ef34ed1e --session upd-f
session: {sessionId:ad8ee8c0-81cb-4133-a945-92c71f421d55,logicalSessionId:e7ac44c4-a84a-4786-85e2-cbf0eb72cb57,documentGeneration:7}
schemaVersion: "1.0"
targets: [{target:{component:CustomerOrdersPanel},status:pending,instances:0},{target:{component:CustomerDetailPage},status:resolved,instances:1,source:/src/features/customers/customer-detail-page.tsx}]
startedAt: 2026-11-19T08:58:29.303Z
expiresAt: 2026-11-19T09:03:29.324Z
request: {budget:{fiberLimit:250,operationLimit:20000,timeLimitMs:8,targetOperationReserve:4000,targetTimeReserveMs:4,adaptive:true},settle:{quietMs:500,timeoutMs:10000},maxDurationMs:300000,allowOverrides:false}
[exit 0]

$ agent-browser --session upd-f find role tab click --name 'Recent orders'
✓ Done
[exit 0]

$ agent-browser --session upd-f snapshot -c -s main
- main
  - link "All customers" [ref=e801]
  - sectionheader
    - heading "Quarry Retail" [level=1, ref=e810]
    - StaticText "starter"
    - paragraph
      - StaticText "LATAM · Managed by Tara Novak"
    - button "Edit account" [ref=e811]
  - tablist "Customer sections"
    - tab "Profile" [ref=e812]
    - tab "Recent orders" [selected, ref=e813]
[exit 0]

$ npx genie-react verify end vfy_7c6d1cff-15f4-438c-9b22-af86ef34ed1e --session upd-f
pass vfy_7c6d1cff-15f4-438c-9b22-af86ef34ed1e "open Recent orders"  3 commits, quiet after 3377 ms (react, query, router, network)
  url "http://127.0.0.1:5242/customers/c-0042"
  1 pass render CustomerOrdersPanel min 1  {renders:1,mounts:1,updates:0,remounts:0,semantics:exact,instances:1,activeInstances:1}
      claim: {kind:renders,target:{component:CustomerOrdersPanel},min:1,counting:renders,allowRemount:false}
      deciding: [{kind:instance,mountId:mount:36,renders:1,mounts:1,updates:0,mountGeneration:1,latestDocumentCommitId:9,source:/src/features/customers/customer-detail-page.tsx:73:11}]
  2 pass boundaries clean  {caughtDuringWindow:0,caughtAtEnd:0}
      claim: {kind:boundaries-clean,scope:window}
      deciding: [{kind:boundary-log,scope:window,complete:true,afterDocumentCommitId:6}]
      caveats: [uncaught-errors-outside-boundaries-unobserved]
  3 pass suspense CustomerDetailPage hidden max 0  {hidden:0,hidesInWindow:0}
      claim: {kind:suspense-hidden,target:{component:CustomerDetailPage},max:0}
      deciding: [{kind:suspense-hide-log,complete:true,afterDocumentCommitId:6}]
window: {observationId:observation:1,startDocumentCommitId:6,settledDocumentCommitId:9,frozenDocumentCommitId:9,commits:3,settle:{outcome:met,quietMs:500,timeoutMs:10000,waitedMs:3377,domains:{react:met,query:met,router:met,network:met}},tail:{ms:500,commits:0},environment:{bundle:development,strictMode:on,renderCollection:available,visibility:document}}
! ui-outcome-not-observed: Genie does not check the screen; confirm it with the UI driver
attempt 2 for these claims on this tab; previous fail vfy_b7e44950-b3a7-4c52-b0c2-ca4806ff231c; document reloaded since
evidence: $ npx genie-react verify show vfy_7c6d1cff-15f4-438c-9b22-af86ef34ed1e --session upd-f
session: {sessionId:ad8ee8c0-81cb-4133-a945-92c71f421d55,logicalSessionId:e7ac44c4-a84a-4786-85e2-cbf0eb72cb57,documentGeneration:7}
schemaVersion: "1.0"
exitCode: 0
stage: end
ledger: {fingerprint:cf_5a5c9002323a,scope:logical-session,storage:memory,attempt:2,history:[{verificationId:vfy_b7e44950-b3a7-4c52-b0c2-ca4806ff231c,verdict:fail,reasons:[],endedAt:2026-11-19T08:58:14.549Z}],codeChangedSincePrevious:document-reloaded,failsOnSameCode:0}
evidence: {retained:true,tools:[react_get_renders,react_component_cohort,react_list_overrides,query_is_fetching,react_refresh_events,browser_visibility,request_watch_start,request_watch_stop,react_profile_stop,react_error_state]}
startedAt: 2026-11-19T08:58:29.303Z
endedAt: 2026-11-19T08:58:37.593Z
request: {budget:{fiberLimit:250,operationLimit:20000,timeLimitMs:8,targetOperationReserve:4000,targetTimeReserveMs:4,adaptive:true},settle:{quietMs:500,timeoutMs:10000},maxDurationMs:300000,allowOverrides:false}
[exit 0]

$ npx genie-react call react_find_components --session upd-f '{"query":"CustomerOrdersPanel","exact":true}' --json | jq -c '.matches[] | {id,name}'
{"id":5353374744701,"name":"CustomerOrdersPanel"}
[exit 0]

$ npx genie-react call react_toggle_suspense_fallback --session upd-f '{"id":5353374744701,"showFallback":true}'
ok: true
boundaryId: 5353374744693
showingFallback: true
activeOverrides: 1
[exit 0]

$ agent-browser --session upd-f snapshot -c -s main
- main
  - link "All customers" [ref=e801]
  - sectionheader
    - heading "Quarry Retail" [level=1, ref=e810]
    - StaticText "starter"
    - paragraph
      - StaticText "LATAM · Managed by Tara Novak"
    - button "Edit account" [ref=e811]
  - tablist "Customer sections"
    - tab "Profile" [ref=e812]
    - tab "Recent orders" [selected, ref=e813]
[exit 0]

$ npx genie-react call react_suspense --session upd-f '{}' --json | jq -c '.boundaries[] | {id,state,forced,source:.source.functionName,file:.source.file}'
{"id":5353374744693,"state":"fallback","forced":true,"source":"CustomerDetailPage","file":"/src/features/customers/customer-detail-page.tsx"}
{"id":5353374744588,"state":"content","forced":false,"source":"Matches","file":"/node_modules/.pnpm/@tanstack+react-router@1.170.41_react-dom@19.3.1_react@19.3.1__react@19.3.1/node_modules/@tanstack/react-router/dist/esm/Matches.js"}
{"id":5353374744627,"state":"content","forced":false,"source":"OutletImpl","file":"/node_modules/.pnpm/@tanstack+react-router@1.170.41_react-dom@19.3.1_react@19.3.1__react@19.3.1/node_modules/@tanstack/react-router/dist/esm/Match.js"}
{"id":5353374744638,"state":"content","forced":false,"source":"AuthenticatedLayout","file":"/src/routes/_app.tsx"}
{"id":5353374744652,"state":"content","forced":false,"source":"MatchView","file":"/node_modules/.pnpm/@tanstack+react-router@1.170.41_react-dom@19.3.1_react@19.3.1__react@19.3.1/node_modules/@tanstack/react-router/dist/esm/Match.js"}
[exit 0]

$ npx genie-react call react_reset_overrides --session upd-f '{}'
ok: true
cleared: [{kind:suspense,componentName:Suspense,outcome:released}]
remaining: 0
commitObserved: true
[exit 0]

$ git checkout -- src/features/customers/customer-detail-page.tsx   (fix reverted)

$ npx genie-react call app_set_latency --session upd-f '{}' --fields latency
[1]:
  - {latency:[]}
[exit 0]

$ npx genie-react call app_clear_faults --session upd-f '{}' --fields faults
[1]:
  - {faults:[]}
[exit 0]

$ npx genie-react call query_restore_state --session upd-f '{"all":true}'
ok: true
restored: 0
outcomes: []
[exit 0]

$ npx genie-react call react_reset_overrides --session upd-f '{}'
ok: true
cleared: []
remaining: 0
[exit 0]

$ npx genie-react call app_inject_fault --session upd-f '{"path":"/api/customers","method":"GET","status":503}' --fields faults
[1]:
  - {faults:[{method:GET,path:/api/customers,status:503,remaining:null}]}
[exit 0]

$ agent-browser --session upd-f open "http://127.0.0.1:5242/customers"
✓ Meridian Ops
  http://127.0.0.1:5242/customers?page=1&q=
[exit 0]

$ agent-browser --session upd-f wait --text 'This page could not be loaded'
This page could not be loaded
[exit 0]

$ agent-browser --session upd-f snapshot -c -s main
- main
  - alert
    - paragraph
      - StaticText "This page could not be loaded"
    - paragraph
      - StaticText "Injected 503 for GET /api/customers"
    - button "Retry" [ref=e826]
[exit 0]

$ npx genie-react call app_clear_faults --session upd-f '{}' --fields faults
[1]:
  - {faults:[]}
[exit 0]

$ agent-browser --session upd-f open "http://127.0.0.1:5242/customers"
✓ Meridian Ops
  http://127.0.0.1:5242/customers?page=1&q=
[exit 0]

$ agent-browser --session upd-f wait --text '1,200 accounts'
1,200 accounts
[exit 0]

$ npx genie-react call query_restore_state --session upd-f '{"all":true}'
ok: true
restored: 0
outcomes: []
[exit 0]

$ npx genie-react call react_reset_overrides --session upd-f '{}'
ok: true
cleared: []
remaining: 0
[exit 0]
```
