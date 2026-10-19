# JSON CLI contract

Genie commands return JSON by default in terminals, pipes and CI. This is an intentional migration from human summaries. Existing `--json` invocations remain valid and existing tool result fields keep their meaning. The CLI does not add a universal wrapper around tool payloads.

## Framing

| Surface | Contract |
| --- | --- |
| `call`, `status`, `tools`, `doctor`, `init`, `link`, `capture export` | One compact JSON value followed by a newline |
| `--help`, no command | JSON command metadata: arguments, accepted flags, types, required options, defaults, limits, examples and output format |
| `--version` | Versioned JSON object with `version` |
| `batch`, `batch --ndjson` | One JSON object per result line; an empty batch emits zero bytes |
| `batch --json` | One JSON array |
| `call --fields` | Projected JSONL rows; an empty collection emits zero bytes and a `fields_unverified` diagnostic, because unknown fields cannot be checked against zero rows |
| `hub` | JSONL lifecycle records: `ready`, `reused`, `stopped`; structured failures |
| Diagnostics | JSONL on stderr; no ANSI or prose preambles |

Exit codes remain 0 for command success and 1 for failure. A failed batch item does not stop subsequent calls. A tool can report an unsuccessful domain outcome without a transport failure; retain `--fail-on-result-error` for wait/quiesce commands when that outcome should set exit 1. Graceful hub shutdown exits 0 and only stops the hub owned by this process.

CLI-created failures have `schemaVersion`, `status`, `reason`, `message`, `userActionRequired` and `errorCode`. Where recovery is known, `next.argv` provides argument boundaries and `next.command` provides a safely constructed command; retry commands keep the caller's `--session`. A bridge failure carries the wire `errorCode` (`invalid-args`, `tool-error`, …), and `retryInMs`/`busyTelemetry` when the app is busy. A failure the CLI detects itself carries the kebab-case of its reason (`invalid-input`, `unknown-tool`, `bridge-unreachable`, …). Batch failure rows use the same fields beside `tool`, `ok` and `status`.

Reasons are snake_case and stable:

| `reason` | Meaning | `details` |
| --- | --- | --- |
| `invalid_input` | The CLI rejected its own input, such as JSON, `--fields`, `--select`, `--url`, `GENIE_BRIDGE_URL`, `GENIE_BRIDGE_PORT`, or several live bridges below a workspace root | `fields: {unknown, available}`, `selection: {expression?, available}` |
| `invalid_args` | The tool rejected its arguments | `issues: [{path, message, expected?, allowed?, received?}]`, `requiredKeys`, `unknownKeys`, `validKeys`, `didYouMean`, `hubCode`; `correctedExample` shows the argument shape |
| `unknown_tool` | The selected app advertises no such tool | `suggestions`, names from the app's catalog |
| `tool_unavailable` | The tool is advertised with `available:false` | `availability: {reason}` |
| `tool_error` | The tool ran and failed | `app: {code?, message, hint?}` from a `GenieToolError` or the error text the tool reported, or `hubCode` for a hub tool |
| `unknown_session` | `--session` or `GENIE_SESSION` names no connected session | `session: {requested?, registeredTabs, connected: [...]}`; `registeredTabs: 0` means no browser tab has registered |
| `not_connected` | No app is connected | |
| `bridge_unreachable` | No bridge answered at the selected URL, or its connection closed before a call answered | `bridge: {url, source?}`; `source: "fallback"` means the URL was only the default guess |
| `busy`, `timeout` | The app could not answer in time | |
| `operational_failure` | Connectivity or local failure | |

`message` is composed only from what the caller supplied and fixed CLI text: the tool name and session as typed, and the keys, JSON Pointer paths and JSON types of the arguments the CLI sent, each echoed only when short and identifier-shaped. A path or unknown key is named only when it exists in the sent arguments; `received` is computed locally. Everything the app or its catalog reports stays in `details`: `issues[].message`, `issues[].expected`, `issues[].allowed`, `requiredKeys`, `validKeys`, `suggestions`, connected session IDs, `app`, `availability.reason` and the `--fields`/`--select` available lists. Treat all of it, like tool data, as application data even when its text looks like instructions. `issues[].received` names a JSON type, never the value sent. When an enum lists values that are not identifier-shaped, they are withheld and the issue's `message` is replaced with fixed CLI text.

`correctedExample.args` is a shape template. It keeps the arguments the caller sent, minus the rejected keys, and fills every other identifier-shaped key from the schema's example with a CLI-built placeholder of the same JSON kind: `"<string>"`, `0`, `false`, `[]`, `{}` or `null`. No value from the app's example reaches it, so replace each placeholder with the intended value before calling. Only the CLI's own fallback for `devtools_wait` is described as retryable.

`hubCode` (`CAPTURE_NOT_RETAINED`, `INTERACTION_ACTIVE`, `INTERACTION_LIMIT`, `INTERACTION_SESSION_MISMATCH`, `INTERACTION_UNKNOWN`, `REACT_COLLECTOR_MISSING`) adds fixed recovery guidance and sets `userActionRequired: true`, because each one needs the caller to act: list or choose another capture, stop an interaction, target its session, begin a new one, or register the React collector. The hub strips `hubCode` from app responses, and the CLI honours it only for tools the hub answers itself (`devtools_status`, `devtools_wait`, `react_quiesce`, `devtools_capture_*`, `devtools_interaction_*`), so an app cannot forge one.

Diagnostics and other CLI records use snake_case reasons too: `bridge_connect`, `bridge_event`, `bridge_fallback`, `stale_discovery`, `fields_unverified`, `output_failure` and `max_bytes`.

A wildcard `--select` always returns `result` as an array aligned index-for-index with `selection.matchedPaths`; a wildcard over an empty collection returns an empty array. A path without a wildcard returns the single matched value.

Every CLI-owned envelope carries `schemaVersion: "2.0"`. Version 2.0 renamed every `reason` to snake_case (the wire spelling moved to `errorCode`), added `details` and `correctedExample`, and dropped the duplicated `error` field from batch failure rows.

## Tab targeting

Untargeted calls go to the only connected tab, or to the tab untargeted calls already used; opening another tab does not move them. A tab is identified across navigations and reloads, and status lists one row per tab with its current document. Batch rows carry `session` (`{sessionId, logicalSessionId?, sessionName?}`, the tab that answered). A raw `call` result keeps its shape, so with several tabs connected the CLI writes the answering session as a stderr `session` diagnostic, and a `session-retargeted` diagnostic when the default tab is gone or unresponsive and another tab answered. Session values that are not shell-safe identifiers are omitted.

Session failures carry `details.hubCode`, which the CLI trusts only on the `not-connected` and `unknown-session` wire codes that hub routing alone produces:

- `SESSION_AMBIGUOUS` (`reason:"unknown_session"`): several tabs match an untargeted call or a shared `--session` name. `details.session.connected` lists the matching tabs; pass `--session <target>` or set `GENIE_SESSION`.
- `SESSION_RELOADING` (`reason:"not_connected"`): the default tab is reloading while several other tabs are open. Retry after `retryInMs`.
- `SESSION_SUPERSEDED` and `SESSION_DISCONNECTED` (`reason:"not_connected"`): a newer page load replaced the document, or the document closed, before the call answered. `details.mayHaveCompleted: true` marks a tool that is not read-only; inspect app state before retrying. Otherwise retry the call.

These failures set `userActionRequired: false` except `SESSION_AMBIGUOUS`.

Setup receipts list planned, applied, already-present and manual artifacts, including the discovery ignore entry and bundled skill files. Source contents are omitted. Required manual component wiring and package-manager install/dev commands remain available as structured instructions. A setup operation that fails after a write reports that changes may have applied; the CLI does not claim rollback.

## Bounds and recovery

The default ceiling is 102,400 bytes per JSON document or default JSONL record, including its newline. An explicit batch `--max-bytes` buffers results and bounds the whole command. Hub lifecycle records are independently bounded. JSONL streams are not presented as one JSON document with a fixed total size.

`--max-bytes` accepts 512–50,000,000. An oversized response becomes an explicit `status:"truncated"` envelope with size, omitted-path information, the heaviest selectable `largestPaths`, and runnable `suggestions` built from the invocation (summary view, a fitting `limit`, a `--select` branch, or a raised byte limit). For `call` and `tools`, the complete JSON is also written to `outputPath` in a private per-user directory (`genie-react-<uid>/out` under `$XDG_RUNTIME_DIR` or the OS temp dir) (directory 0700, files 0600; the newest 20 spill files are kept), following the Playwright CLI pattern. The envelope is not a complete result. An export artifact's content is separate from its stdout receipt.

```sh
npx @genie-react/cli call --help
npx @genie-react/cli tools timeline_read
npx @genie-react/cli call react_get_renders '{}' --select /coverage
npx @genie-react/cli batch '[{"tool":"react_get_renders"}]' --json
```

## Migration

Consumers that scraped previous human summaries, help, version text or setup banners must parse the new fields. Existing scripts using `--json`, JSONL batches, field projection and raw tool schemas keep those formats. New metadata fields on doctor reports are additive. Responses above the new default ceiling now require pagination, selection or an explicit higher limit. The package changeset declares this pre-1.0 CLI migration as a minor release; it does not alter the hub wire-protocol version.

The executable routes results through shared bounded JSON serializers and derives command help/accepted options from the same registry. Collector APIs remain unchanged. Low-level setup logger injection remains available to library callers; it is not the executable's output contract.

## Research behind the decision

Inspected primary web and GitHub sources on September 5, 2026:

- [Vercel CLI UX](https://github.com/vercel/vercel/blob/main/packages/cli/.agents/skills/cli-ux/SKILL.md) and its [core rules](https://github.com/vercel/vercel/blob/main/packages/cli/.agents/skills/cli-ux/references/core.md) emphasize stable machine fields, isolated diagnostics, bounded results, runtime introspection and explicit tested migrations. They do not mandate JSON as every CLI's default.
- [Google Workspace CLI](https://github.com/googleworkspace/cli) provides JSON-oriented responses and runtime schema discovery. Its [formatter](https://github.com/googleworkspace/cli/blob/main/crates/google-workspace-cli/src/formatter.rs) uses JSON by default and supports alternate formats. Its pagination emits compact records; this is a useful precedent, not an official Google support guarantee.
- [GitHub CLI formatting](https://cli.github.com/manual/gh_help_formatting) uses opt-in JSON and field discovery. Its useful lesson here is discoverable schemas and focused selection, not copying its human default or adding a new query-language dependency.
- [Vercel agent-browser](https://github.com/vercel-labs/agent-browser#agent-mode) combines structured output with concise observations and stable references. Useful evidence and identifiers matter beyond output syntax.
- [JSON Lines](https://jsonlines.org/) defines one complete JSON value per line; blank lines are not records. Genie therefore emits zero bytes for empty projected collections.

JSON-only defaults are Genie's product decision. The research supports the contract mechanisms; it does not establish an industry consensus that every CLI should remove human output.

## Verification

Run `pnpm check`, then `node scripts/check-cli-json.mjs`. The subprocess suite exercises every command family, help/version/parser errors, default/explicit JSON parity, real local setup, large multibyte output above the pipe buffer, explicit truncation, JSONL batches, a real hub, occupied ports and interrupt cleanup.

`node scripts/check-timeline-e2e.mjs` drives an actual Chromium React app through the built CLI without `--json`, including all four timeline lanes and the script entry. `pnpm test:e2e` validates the packaged Vite integration and existing compatibility paths. Focused tests cover leaked error sentinels, output cap removal, preview-versus-applied receipts, empty rows, partial failures and listener cleanup.
