---
"genie-react": minor
"@genie-react/cli": minor
---

Authenticate hub WebSocket connections. Any web page open in the developer's browser could previously connect to the hub as an agent and call every tool, or register a fake app session whose tool descriptions reached the coding agent.

- Agents must present the hub's per-run token as `Authorization: Bearer <token>`, connect from the same machine (a loopback peer address), and send no browser `Origin`. The hub keeps the token out of the project in a private per-user file (`genie-react-<uid>/<sha256 of the app root's real path>.json` under `$XDG_RUNTIME_DIR` or the system temp directory, directory `0700`, file `0600`), so no dev server rooted at the project can serve it. `.genie/bridge.json` keeps only the URL, port and pid, and its URL is now the bound IP literal (`ws://127.0.0.1:<port>` for `genie-react hub` and Next.js, the address Vite bound for Vite) instead of `ws://localhost:<port>`, so a process listening on the other loopback family's port cannot capture the token.
- The CLI pairs a discovered URL only with its own hub's token. For `--url` or `GENIE_BRIDGE_URL`, `GENIE_BRIDGE_TOKEN` wins, then the token of a discovered hub at that address. A `localhost` URL that matches a discovered hub connects to that hub's published address; otherwise the token goes only over `wss://` or to a loopback IP literal, and warns when a discovered hub published no token (an older, unauthenticated `genie-react`). A refused token now fails `call`, `batch` and `tools` at once with a fix, instead of waiting and reporting that no app is connected.
- App connections: the Vite bridge accepts pages from the dev server's own origin (including its IP address with `vite --host`), Vite's `server.allowedHosts`, and the new `allowedOrigins` option. The standalone hub also accepts loopback pages: on the Next.js port under `registerGenie()`, on any port under `genie-react hub`. `status` reports each session's `origin` and marks sessions admitted only as loopback pages with `originUnverified`. Clients without an `Origin` (Node) must connect from the same machine.
- The `genie()` Vite plugin adds `**/.genie/**` to `server.fs.deny` and answers `404` for any request into `.genie`, also when `server.fs.strict` is off.

Breaking:

- Upgrades without `?role=app` or `?role=agent` are refused with HTTP 400 instead of inferring the role from the first frame.
- `@genie-react/cli` older than this release gets HTTP 401 from this hub. Its commands retry for 11 to 14 seconds and then report that no app is connected. Upgrade the CLI and `genie-react` together.
- Custom agent clients must send the token from the private token file and run on the same machine as the hub.
- Pages served from a custom hostname, a tunnel, or a loopback port other than the app's need `allowedOrigins` (`genie()`, `registerGenie()`, `startGenieHub()`, or `GENIE_ALLOWED_ORIGINS` for `genie-react hub`).
- Discovery URLs, `startGenieHub()` results, the Cloudflare-mode client URL, `<GenieScript />` and the hub client's fallback use `127.0.0.1` (or the bound literal) instead of `localhost`, so a process on the other loopback family's port can neither capture the token nor serve the client script. With `--url`/`GENIE_BRIDGE_URL` outside the app folder, use the IP address; the CLI no longer sends the token to a `localhost` name it cannot match to a discovered hub.
- The agent token is no longer in `.genie/bridge.json`; tools that read it there must use `readAgentToken(rootDir)` from `genie-react/hub` or `GENIE_BRIDGE_TOKEN`.
- The `genie()` plugin's `server.fs.deny` entry restates Vite's default deny list when the app sets none, and appends to the app's list otherwise.
