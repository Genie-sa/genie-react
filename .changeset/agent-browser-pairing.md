---
"@genie-react/cli": minor
"genie-react": minor
---

Genie and [agent-browser](https://github.com/vercel-labs/agent-browser) now share one session name, so an agent no longer keeps `_genie` in the URL in step with `--session`:

```bash
agent-browser --session my-agent open http://localhost:5173/
npx genie-react status --session my-agent --wait 15000
```

- `--session` and `GENIE_SESSION` accept the name of an agent-browser session. When no tab in the hub carries that name or ID, the CLI reads the Genie identity of the page that session shows with `agent-browser eval` and targets that tab. A name a tab already carries in the hub still wins, so `_genie` names and session IDs work as before. `status` reports the link in `sessionSelector.agentBrowser`.
- Without `--session` or `GENIE_SESSION`, commands follow `AGENT_BROWSER_SESSION`. When that session's page does not run Genie, they use the default tab and print an `agent-browser` diagnostic saying why.
- With no target, several tabs and no default tab yet, a command uses the one tab that a running agent-browser session shows, when exactly one does and no other agent claimed it, and names it in an `agent-browser` diagnostic. When several sessions show tabs, the `SESSION_AMBIGUOUS` failure lists them in `details.agentBrowser.sessions`. Tabs another agent uses are never picked.
- When a named agent-browser session runs but shows no Genie page, or is not running, the `unknown_session` or `not_connected` failure says so in its message and `details.agentBrowser`, with the `agent-browser --session <name> open <app-url>` command.
- `react_component_for_dom` takes an agent-browser snapshot ref: `call react_component_for_dom '{"ref":"@e12"}' --session my-agent` returns the component that renders that element. The CLI reads the element's box and innerHTML with `agent-browser get box` and `get html` in the session that shows the targeted tab. The tool also accepts that `box` directly, matching the element whose `getBoundingClientRect()` equals it even when another element covers it or it is off screen, and using the innerHTML to tell it apart from a wrapper or overlay of the same size. `selector` is now optional in the output and present only for a selector lookup.
- `devtools_status` marks a tab another agent uses with `claimedByOthers: true`, and `status --sessions-only` shows it.
- Genie reads agent-browser only through its documented CLI (`session list`, `get url`, `eval`, `get box`, `get html`), never runs a command on a session that is not running, since agent-browser would launch a browser for it, and gives each command 2 seconds. `GENIE_AGENT_BROWSER` points it at an agent-browser executable that is not on `PATH`.
- Opening the app with `agent-browser --enable react-devtools` works beside Genie: both hooks attach, agent-browser's `react tree`, `react inspect` and `react renders` keep working, and Genie's render causes match a page without the DevTools hook.
