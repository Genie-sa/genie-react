---
'genie-react': minor
---

Genie now analyses renders and effects only while an agent observes them, so a loaded Genie that nobody is asking about adds little to each React commit. Evidence from before a window is no longer collected.

- Render and effect analysis runs while a window from `react_clear_renders`, `react_profile_start`, `devtools_interaction_begin` or `verify begin` is open, while a `react_measure` span is open, and while a timeline records. `react_profile_stop` pauses it as before, and a timeline started after the stop does not resume a frozen window. Before the first window, the per-component analysis no longer runs, which used to roughly double the cost of a large commit.
- Without a window, Genie still records what a later read needs about the present: error boundary catches for `react_error_state` and `verify`, document commit IDs, Suspense blockers, hydration evidence, StrictMode, and the mount generation of each position, so a remount inside a later window is still numbered correctly.
- A render or effect read made with no window open used to report everything since page load. It now reports the commits it did not analyse as `coverage.unobservedCommits`, adds a `commits-not-observed` entry to `coverage.incompleteBecause` that says to open a window and repeat the interaction, and marks the result incomplete. `react_component_cohort` reports such instances `mounted-unknown` rather than `mounted-idle`. Open a window before the interaction you want to measure. To observe a page load, open the page with `_genie_observe` in its URL; the hook then opens a window before React's first commit.
- `tracking` in render and effect results is now true only while the analysis runs. `react_measure` no longer needs a window first, and fails with a clear message while `react_profile_stop` has paused recording.
- `react_override_hook_state` and `react_reset_overrides` report `commitObserved` from document commits, so they detect the commit an override causes with no window open or after a stop.
