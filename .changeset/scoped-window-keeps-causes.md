---
"genie-react": patch
"@genie-react/cli": patch
---

Naming a component in `react_clear_renders` no longer loses its render causes. Before, every named component shared the 4,000-operation target reserve for input attribution, so with several large selectors one of them came back as `unknown` while an unscoped window named its `external-store` cause. A named component now spends its reserve first and then the general budget.
