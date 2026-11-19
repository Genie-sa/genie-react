---
"genie-react": patch
"@genie-react/cli": patch
---

A `render` claim that passed or failed on a lower-bound count, because an analysis budget such as the target reserve ran out, gave no way to get the exact count. On a board with 840 instances, `render FeatureGate max 0` reported `renders:37` and did not say which limit to raise. The claim now carries `observed.budgetAdvice` with the limits that ran out and a budget sized from what the window saw, and the CLI prints an `exact: $ verify begin … --budget …` line that repeats the run with it.
