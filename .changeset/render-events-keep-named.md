---
'genie-react': patch
'@genie-react/cli': patch
---

`react_render_causes` keeps the newest 1,000 render events, and a busy page could evict the render you asked about even after `react_clear_renders` named that component: one keystroke that re-rendered a 100-row table pushed out `AccountMenu`'s first render. The read reported `complete: false` with no reason. Now the newest 500 events of the components a window names are evicted only after every other component's. Any read that lost events lists a `render-events-evicted` entry in `coverage.incompleteBecause`, saying how many of the evicted events belonged to the components it selects, naming them, and giving the next step.
