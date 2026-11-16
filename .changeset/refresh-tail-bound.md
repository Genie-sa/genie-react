---
'genie-react': patch
'@genie-react/cli': patch
---

App commits after a Fast Refresh no longer go unanalysed for as long as they keep coming. Genie treats commits up to a second after a refresh as part of it, and each such commit used to restart that second, so interacting quickly after an edit could hide every commit from analysis. The second now counts from the refresh itself, or from the moment the bundler finishes applying the update, and the first pointer, key, input or wheel event ends it early. A bundler update whose completion event never arrives stops hiding commits after 10 seconds.

Commits a window still does not analyse because of a refresh now make render and effect coverage incomplete: `coverage.refreshCommitsExcluded` counts them, `incompleteBecause` lists `commits-during-fast-refresh` with a next step, `react_component_cohort` no longer reports instances `mounted-idle` across them, and `verify` refuses a render count with `coverage_incomplete`.
