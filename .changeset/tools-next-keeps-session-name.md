---
"genie-react": patch
"@genie-react/cli": patch
---

`genie-react tools` suggestions now repeat the `--session` you passed. Before, `tools <name> --session my-agent` printed `next: … --session <tab UUID>` when the name resolved through agent-browser. The `--output-schema` hint and the suggestion for an unknown tool now use `--session my-agent`.
