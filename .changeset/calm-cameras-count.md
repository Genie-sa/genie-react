---
"genie-react": patch
---

Reduce synchronous render-analysis overhead for wide component lists by reusing bounded sibling identity scans within each commit. Preserve key uniqueness, reorder handling, deadlines, and incomplete coverage reporting.
