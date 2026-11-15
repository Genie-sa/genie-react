---
'genie-react': patch
---

Pages with Genie render their first screen sooner. On the 8,747-component benchmark app, Genie's added cost to the first render dropped from 77 to 24 ms, below 0.19.0's 44 ms, and startup blocking time went from 144 to 95 ms (0.19.0: 103 ms). Evidence is unchanged: mount generations, tool catalogs and every read return what they did before.

- The client sends one hello per task instead of one per collector registration or tool refresh. `<Genie />` registers its collectors one at a time, and each hello encoded the whole tool catalog with its JSON Schemas, so a first render paid for about eight of them. The hub keeps only the newest hello, so it receives the same catalog. Tools a collector registers answer calls at once, before the hello goes out.
- Counting the components a commit mounts while nothing observes now folds each position's path onto its parent's as the walk descends from the root, instead of walking up from every mount. The mount generation a later window reports is the same, and where a walk up could resolve a path differently (lineages deeper than the ancestry bound, or a stale `return` link), the walk up is still used.
