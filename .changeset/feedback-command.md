---
'@genie-react/cli': minor
---

Add `genie-react feedback` for reporting a Genie bug, friction, an idea, or a docs gap to the maintainers. By default it only previews: it prints the exact issue title, body, and destination, saves a private draft, and sends nothing. `feedback --submit --draft <id>` files that draft as a public issue on `Genie-sa/genie-react` through the GitHub CLI, from the account `gh` is signed in to. When `gh` is missing, signed out, offline, or rate limited, the result has the saved report and a prefilled new-issue link instead.

The report carries only your message, the title, and fixed diagnostics (CLI and `genie-react` versions, Node, OS and architecture, package manager, framework, React version). The CLI replaces home and project paths, strips URL credentials and queries, redacts emails and secret-shaped values, and keeps `@mentions`, `#123` references, Markdown, and HTML from rendering. `--reason` and `--tool` group reports by failure, and with `--reason` the CLI returns an open issue with the same failure signature instead of filing another.

`operational_failure` results now carry a `feedback` command with the reason and built-in tool prefilled, and their message says when to use it.
