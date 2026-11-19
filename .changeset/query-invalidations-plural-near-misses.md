---
"genie-react": patch
"@genie-react/cli": patch
---

`query_invalidations` now finds the near miss when one key segment differs by a plural ending or a small typo. Before, `nearMisses` listed only keys that shared the filter's first segment, so `invalidateQueries({queryKey:['task','list']})` against a cached `['tasks','list']` reported none. It now lists `["tasks","list"]` first, then the keys that share the first segment.
