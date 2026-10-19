---
"genie-react": patch
"@genie-react/cli": patch
---

CLI reliability and clearer failures.

- **A missing or dead bridge fails fast and says so.** A new `bridge_unreachable` failure names the URL and how to start a bridge. It replaces the "No app is connected" and timeout reports. The default address fails at once when nothing listens there, and a hub that dies mid-call fails the call immediately instead of after 20 s. The process exits as soon as it prints.
- **Configuration mistakes are reported as such.** A bad `--url`, `GENIE_BRIDGE_URL` or `GENIE_BRIDGE_PORT` (now validated as 1–65535), several live bridges below a workspace root, and a `doctor --select` that matches nothing now return `invalid_input` with the real message. Unknown options suggest the closest valid one.
- **Agent sandboxes with another `TMPDIR` authenticate.** The hub records its token path in `.genie/bridge.json`, and a 401 from a guessed default port explains that another project's hub answered.
- **One hub per project.** `genie-react hub` and `startGenieHub` reuse a live hub for the same root on any port. A hub or dev server never overwrites or deletes discovery and token files that another live process published.
- **`tools` fails as `not_connected`** after a 3 s grace when no app session exists (`--wait` extends it) instead of listing only hub tools. `batch` waits for an app only when an item needs one, and no longer hangs on open stdin. Use `-` to read the array from stdin.
- **More useful failure output.** Every failure carries `errorCode`. A built-in tool's own error text (for example "Enable render tracking") is shown in `details.app.message`. Retry commands keep `--session`. `hub` passes start errors through, with a `port_busy` reason.
- **`doctor` searches upward** for the discovery file. It treats a missing agent skill as a warning, and accepts `--live --session`.
- **Selections:** a wildcard `--select` returns values aligned with `matchedPaths`, without listing each path twice. A wildcard over an empty collection returns `[]`. `call` rejects non-object arguments.
- **Faster startup:** `--help` and `--version` take about 35 ms instead of about 125 ms, because command modules and the protocol load on demand. A new `genie-react/hub/token` entry exposes the token helpers without the hub server.
