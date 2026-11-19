---
"genie-react": patch
"@genie-react/cli": patch
---

Explain why a `react_effect_audit` effect can be `hot` while `scheduleReason` says `below-schedule-rate`: the schedule rate decides the label only for an effect without a dependency array, and `basis` gives the reason the label holds. The field descriptions and the effect audit docs now say so.
