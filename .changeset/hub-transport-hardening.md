---
'genie-react': minor
'@genie-react/cli': minor
---

Make waits, before/after comparisons and routing report what really happened, and harden the local hub.

- `react_quiesce` and `devtools_wait` (`react-quiet`, `settled`) no longer report React idle while a transition is suspended or a Suspense boundary is showing its fallback while it waits for data. Before, both returned `idle` as soon as commits stopped, even though the screen was still loading. A new read-only tool, `react_pending_work`, reports that pending work. The quiesce result now includes the last `pendingWork` sample, and a timeout names the blocking boundaries in `reason`. With an older app runtime that lacks the tool, `pendingWork` is `null` and idle covers commits only.
- `devtools_capture_compare` no longer turns noise into a significant change. When most runs had the same value, for example render counts like `5, 5, 6, 5, 6`, outlier rejection dropped every run that differed from the median, and the comparison could report a regression or improvement the data did not support. Outliers are now judged over both cohorts together, with a mean-absolute-deviation fallback when the MAD is zero. Comparisons of the same build now report false changes at the stated confidence level instead of about twice that rate.
- `devtools_capture_compare` now discards the earliest captures of each cohort as warm-up, by creation time. Before, it discarded the first IDs in the list, so a cohort copied from `devtools_capture_list` (newest first) dropped the steadiest run and kept the cold one.
- The permutation test now treats near-equal mean differences as ties relative to the data's magnitude, so large values such as heap bytes no longer get p-values that are too small.
- An exported capture now re-verifies against its own checksum when it contains dates or other non-JSON values. Before, dates were hashed as `{}`, so the checksum ignored them.
- A call that changes app state no longer runs on another tab when the targeted tab has stopped sending heartbeats (frozen, hung or throttled in the background). It fails with `busy` and names the tab. Read-only calls still answer from the live tab and are marked `retargeted`.
- The hub now accepts a tool response only from the tab the request was sent to. Before, any connected tab that sent a matching request ID could answer another tab's call.
- One app connection now speaks for one document. Before, a connection that announced several session IDs left phantom sessions behind after it closed, which made untargeted calls ambiguous.
- The CLI no longer gives up on `devtools_wait` or `devtools_interaction_stop` before the `timeoutMs` you asked for. Before, a wait longer than 20 seconds failed with a CLI timeout while the hub was still waiting.
- The hub now reports its version in status (`hub: {version, protocol}`), and each app session reports `runtimeVersion`. The CLI refuses a hub from another `major.minor` release line, or one that does not report a version, with `reason: "bridge_rejected"`, `errorCode: "version-mismatch"` and `details.versions` naming both. Status warns when an app runtime comes from another release line. Install the same version of `genie-react` and `@genie-react/cli`.
- The standalone hub (`genie-react hub`, Next.js) answers plain HTTP requests only when `Host` is an IP address, a loopback name or an allowed host, so a DNS-rebinding page can no longer read the project path from `/__genie/info`.
- Frames larger than 64 MiB now close the connection instead of being buffered.
- `startGenie()` and `<Genie />` from `genie-react/native` no longer connect to the hub in a production build, even when the app skipped the `__DEV__` guard.
- Added `SECURITY.md` with the threat model, what is and is not a security boundary, how to treat tool output, and how to report a vulnerability.
