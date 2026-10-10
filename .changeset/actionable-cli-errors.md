---
"genie-react": minor
"@genie-react/cli": minor
---

Make every CLI failure actionable instead of collapsing it to fixed text. `app/response` and `bridge/result` frames gain optional `errorDetails` (argument issues with JSON Pointer paths, required keys and a minimal call, unknown keys, a `GenieToolError`'s code, message and hint, and an unavailable tool's reason); older peers ignore the field and a malformed shape is dropped rather than rejecting the frame. `GenieToolError` exposes the thrown message as `detail`, and result-cap and serialization failures become `GenieToolError`s with `RESULT_TOO_LARGE` and `RESULT_NOT_SERIALIZABLE` codes.

The CLI composes `message` from those specifics and adds `details`, `errorCode` and `correctedExample`. A missing tool is now `unknown_tool` with did-you-mean suggestions; an advertised but unmounted tool is `tool_unavailable` with its reason; an absent pinned session names itself and lists connected sessions; unknown `--fields` are named. `status` with no connected session adds a `hint` and `next`.

Breaking: every `reason` is now snake_case (`invalid_args`, `tool_error`, `tool_unavailable`, `unknown_session`, `not_connected`, `bridge_connect`, `stale_discovery`, `output_failure`, `max_bytes`); the wire spelling remains in `errorCode`. Batch failure rows drop the duplicated `error` field. See docs/json-cli.md.
