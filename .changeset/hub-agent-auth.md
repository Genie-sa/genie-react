---
"genie-react": minor
"@genie-react/cli": minor
---

Authenticate hub WebSocket connections. Any web page open in the developer's browser could previously connect to the hub as an agent and call every tool, or register a fake app session whose tool descriptions reached the coding agent.

- Agent connections must send the hub's per-run token as `Authorization: Bearer <token>` and must not carry a browser `Origin`. The hub writes the token to `.genie/bridge.json`, which is now written atomically with owner-only (0600) permissions. The CLI reads it automatically, including for `--url`/`GENIE_BRIDGE_URL` when a discovery file publishes that endpoint; otherwise set `GENIE_BRIDGE_TOKEN`. A refused token gets an actionable CLI and `doctor --live` message. `doctor` output never includes the token.
- App connections from browsers must come from a loopback origin (`localhost`, `127.0.0.1`, `[::1]`, `*.localhost`), from the dev server's own IP-address origin, from a host in Vite's `server.allowedHosts`, or from an origin listed in the new `allowedOrigins` option (`genie()`, `registerGenie()`, `startGenieHub()`, `GENIE_ALLOWED_ORIGINS` for `genie-react hub`). Clients without an `Origin` header, such as React Native and Node, are still accepted.
- Upgrades without an explicit `?role=app|agent` are now refused instead of inferring the role from the first frame.

Migration: custom agent clients must send the token from `.genie/bridge.json`, and custom app clients must pass `?role=app`. Pages served from a custom hostname or tunnel need `allowedOrigins`. Upgrade the CLI and runtime together because an older CLI cannot authenticate to this hub.
