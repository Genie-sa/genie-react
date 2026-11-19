---
"genie-react": patch
"@genie-react/cli": patch
---

When a `verify` run had a refused claim before a failed one, its `evidence:` command pointed at the refused claim, though the failed claim decided the `fail` verdict. The command now opens the first claim whose verdict matches the run's.
