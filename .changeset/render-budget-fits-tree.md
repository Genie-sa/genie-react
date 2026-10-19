---
'genie-react': minor
'@genie-react/cli': minor
---

The adaptive render budget now fits the app's tree. `react_clear_renders` counts the components already mounted and starts the window with a `fiberLimit` that covers them, scaling `operationLimit` and `timeLimitMs` by the same factor, up to the maxima. A commit that renders more components than the limit also grows the budget, and decay never drops it below the largest tree the window has seen. On a 900-component tree the default budget went from `fiberLimit` 250 to 1000, and a full re-render is complete instead of skipping 652 components. When a limit still skips work, `react_render_causes` and `react_get_renders` report `coverage.budgetAdvice`: the `exhaustedLimits` and a `suggestedBudget` estimated to fit the largest lossy commit.
