---
"genie-react": patch
"@genie-react/cli": patch
---

When the analysis budget ran out, `react_component_cohort` and `react_renders_since` reported the gap without `coverage.budgetAdvice`, so an agent following the skill had no budget to clear with. Both now include it: the cohort whenever the window ran out, and a span when a commit it owns ran out.
