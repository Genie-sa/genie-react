---
'@genie-react/cli': minor
---

`status --wait <ms>` waits for the `--session` target, or any app when none is given, to be ready before it reports. On timeout it fails with `not_connected`. `unknown_session` and that failure now carry `details.session.registeredTabs`, which is `0` when no browser tab has registered with the hub, so a client can tell "not ready yet" from "no browser". With no registered tab, `unknown_session` suggests `status --wait` as `next`.
