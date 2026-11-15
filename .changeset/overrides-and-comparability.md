---
'genie-react': patch
'@genie-react/cli': patch
---

Fix override resets that skipped mounted components, and capture comparisons that refused a verdict on realistic apps.

- **`react_reset_overrides` restores every override still on screen.** After any commit that re-rendered the app above an overridden component without re-rendering the component itself, Genie judged it unmounted. Reset then reported `skipped-unmounted` and left the override in place, and `react_list_overrides` showed it as `mounted: false` with no `componentId`. A component now counts as mounted until React removes it, so reset restores it and the list agrees. Only a component that really unmounted is reported as `skipped-unmounted`.
- **Comparisons judge only what affects the compared metric.** `devtools_capture_compare` used to answer `not-comparable` for every render metric when a few components had unknown ownership (`app-source-classification-incomplete`), or when the Next.js dev overlay's own production React committed (`fiber-analysis-failed`).
  - Unknown ownership no longer blocks `react.commits`. It no longer blocks the component totals either, as long as every capture in both cohorts names the same unknown components. If they differ, the comparison refuses with `unknown-ownership-differs-between-captures`.
  - Commits by a React renderer Genie does not analyze no longer block render metrics when that renderer hosts none of the counted components. `verify` uses the same rule.
  - Any other analysis failure, or a page with no development renderer, still refuses a verdict. `warnings` name the unknown components and the captures with such commits.
- **`react_get_renders` names unknown-ownership components.** `sourceClassification.unknownComponents` lists them as `Name (file that renders it)`, sorted and capped at 50. `unknownComponentsOmitted` counts any that did not fit.
