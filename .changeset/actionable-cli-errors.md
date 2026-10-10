---
"genie-react": minor
"@genie-react/cli": minor
---

Make every CLI failure actionable instead of collapsing it to fixed text. `app/response` and `bridge/result` frames gain optional `errorDetails` (argument issues with JSON Pointer paths, required keys and the schema's example call, unknown keys, a `GenieToolError`'s code, message and hint, an unavailable tool's reason, and a `hubCode` for failures the hub authors, such as `CAPTURE_NOT_RETAINED`; the hub strips a `hubCode` from app responses); older peers ignore the field and a malformed shape is dropped rather than rejecting the frame. `GenieToolError` exposes the thrown message as `detail`, and result-cap and serialization failures become `GenieToolError`s with `RESULT_TOO_LARGE` and `RESULT_NOT_SERIALIZABLE` codes.

The CLI adds `details`, `errorCode` and `correctedExample` to failures. `message` is built only from what the caller typed (tool, session, the keys and JSON types of the arguments it sent) and fixed CLI text; everything the app or its schema reports stays in `details` as app data. `correctedExample` is a shape template: the caller's accepted arguments plus typed placeholders (`"<string>"`, `0`, `false`, `[]`, `{}`) for the other keys in the schema's example, never the app's values. A `hubCode` is honoured only for tools the hub answers itself and sets `userActionRequired: true`. Suggested tool names are labelled as app data. A missing tool is now `unknown_tool` with suggestions; an advertised but unmounted tool is `tool_unavailable` with its reason; an absent pinned session names itself and lists connected sessions in `details`; unknown `--fields` and an unmatched `--select` are named, with the available paths in `details`. `status` with no connected session adds a `hint` and `next`.

Breaking: CLI-owned envelopes now report `schemaVersion: "2.0"`. To migrate:

- Match `reason` in snake_case: `invalid-args` → `invalid_args`, `tool-error` → `tool_error`, `tool-unavailable` → `tool_unavailable` (or `unknown_tool` when the app advertises no such tool), `unknown-session` → `unknown_session`, `not-connected` → `not_connected`, and the diagnostic and record reasons `bridge-connect` → `bridge_connect`, `bridge-event` → `bridge_event`, `bridge-fallback` → `bridge_fallback`, `stale-discovery` → `stale_discovery`, `output-failure` → `output_failure` and `max-bytes` → `max_bytes`.
- Read the bridge's wire code, previously in `reason`, from the new `errorCode` field.
- Read a batch failure row's `message`; the duplicated `error` field is gone.

See docs/json-cli.md.
