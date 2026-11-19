---
"genie-react": patch
"@genie-react/cli": patch
---

A failure's `exit` field now matches the code the process exits with. Before, commands other than `verify` printed the `verify` exit code, such as `exit: {code:2,class:usage}` for invalid arguments, but exited 1. They now print `exit: {code:1,class:failure}`. Exit codes are unchanged: `verify` keeps its taxonomy, and other commands exit 0 or 1. Use `reason` to tell failures apart.
