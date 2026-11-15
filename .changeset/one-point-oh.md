---
'genie-react': major
'@genie-react/cli': major
---

Genie React 1.0: verify fixes, not just read evidence.

1.0 makes Genie the verification step for a coding agent working on a React or React Native app, alongside agent-browser or agent-device:

- `genie-react verify` decides whether a fix worked from declared claims and exits with the verdict. It passes only on exact, complete evidence and refuses with a named fix otherwise.
- The CLI prints compact text written for a model to read by default; `--json` and `GENIE_OUTPUT=json` keep JSON for scripts.
- The app runtime analyzes renders and effects only while a window, span or recording observes them. With nothing observing, a commit costs Genie a counter and a check of the root's flags.
- Several agents can share one app and hub: each keeps its own tab, window and overrides, and a call that would disturb another agent's evidence is refused.
- `genie-react feedback` files a Genie bug as a GitHub issue after the user approves the preview.

The tool contracts, CLI output format and exit codes documented at genie-react.com are stable from this release; breaking changes now need a new major version.
