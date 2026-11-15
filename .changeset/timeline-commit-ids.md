---
'genie-react': patch
---

Every React commit in a timeline now has its own `documentCommitId`. Commits during a Fast Refresh, and app commits in the second after one, used to share the ID of the last analyzed commit, so after a refresh several commits could all report the same number. Fast Refresh commits now take an ID like any other; Genie still does not analyze them, so no render events join it. A commit whose `renderDurationMs` is `null` now says why in `renderDurationUnavailable`: `below-clock-resolution` when the render took less than the page clock can measure, or `no-profiler-timing` when the React build reports no durations.
