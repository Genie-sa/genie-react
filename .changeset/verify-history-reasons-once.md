---
"genie-react": patch
"@genie-react/cli": patch
---

The `verify` rerun history listed a refusal reason once per claim that refused for it, as in `previous refused vfy_… (not_quiescent, not_quiescent)`. Each reason now appears once, in the text line and in `ledger.history[].reasons`.
