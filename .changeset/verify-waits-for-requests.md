---
'genie-react': patch
'@genie-react/cli': patch
---

`verify end` no longer passes while a request the interaction started is still in flight. Settle used to wait only for React (and Query or Router when present), so a slow response that landed after React went quiet changed the screen after a `pass`. Settle now also waits on a `network` domain: every `fetch` and `XMLHttpRequest` call the app started during the window must get its response, up to `--timeout-ms`. A request still in flight at the timeout, or at the freeze after the tail, refuses the claims a late response could change with `not_quiescent`; the message names the request, and the `$` fix raises `--timeout-ms`. The verdict line lists `network` among the settled domains. `--domains` accepts `network`, and leaving it out of `--domains` stops the wait. The new `request_watch_start`, `request_watch_read` and `request_watch_stop` tools (`requestWatchCollector` for manual setups) count the requests; requests from workers, WebSocket and EventSource are not seen.
