# CLI output contract

Genie commands print compact text by default: one document per command, written for a model to read. `--json` prints the JSON documents the CLI printed by default from 0.14 through 0.19, with identical schemas. `GENIE_OUTPUT=json` makes every command behave as it did before text became the default, so a script can migrate with one line.

Text is the default because an agent's context is the scarce resource: the same evidence costs fewer tokens as text, and the leading agent CLIs (agent-browser, agent-device, strobe, the Chrome DevTools CLI, dev-browser) default to compact text for the same reason. Text is for reading. Scripts should parse `--json`; the text layout may evolve between releases, while the JSON schemas below are the versioned contract.

## Choosing a format

| Invocation | Output |
| --- | --- |
| no flag, `GENIE_OUTPUT` unset, empty or `text` | text |
| `--json` | JSON, as documented under [JSON contract](#json-contract) |
| `GENIE_OUTPUT=json` | exactly what the same invocation printed in 0.19: JSON, JSONL for `batch`, `call --fields` and `hub` |
| `batch --ndjson` | JSONL in either case |
| `GENIE_OUTPUT` set to anything else | `invalid_input` failure, exit 1 |

`--json` always wins over `GENIE_OUTPUT`. The output is the same on a terminal and in a pipe: there is no TTY detection, no color and no ANSI escapes in either format. Exit codes do not depend on the format. JSON output escapes the line separators, bidirectional controls, zero-width characters and C1 controls inside strings as `\uXXXX`, as text does, so an app string cannot reorder or hide what a terminal shows; the document parses to the same values.

| Surface | Text | `--json` |
| --- | --- | --- |
| `call`, `status`, `tools`, `doctor`, `init`, `link`, `capture export` | one text document | one compact JSON value |
| `--help`, no command | help text: usage, commands, arguments, every option with its type, default, limits, enum and conflicts, output, notes and examples | JSON command metadata |
| `--version` | the version, such as `1.0.0` | `{schemaVersion, status, version}` |
| `call --fields` | the projected rows as one text array; zero rows print zero bytes | JSONL rows; zero rows print zero bytes |
| `call --select`, `tools --select`, `doctor --select` | the selection envelope as text | the selection envelope |
| `batch` | one block per result, printed as each call completes | `--json`: one array; `--ndjson` or `GENIE_OUTPUT=json`: JSONL |
| `hub` | one block per lifecycle event (`ready`, `reused`, `stopped`) | JSONL lifecycle records |
| Diagnostics on stderr | one `! <reason>: <message> {data}` line each | JSONL records |

## Text format

A document is a sequence of lines. Every value of the JSON document appears in it, and the generic encoder's output decodes back to that exact JSON; the tests in `packages/cli/src/text-output.test.ts` prove this with an independent decoder over every recorded result and thousands of generated documents built from hostile strings.

- **Scalars.** Numbers, `true`, `false` and `null` are written as in JSON. A string is written bare when it consists only of ASCII letters, digits and `_ $ . / @ ~ + : -`, does not start with `+ : -`, does not end with `:`, and does not read as a number or literal; every other string is a JSON string literal, which additionally escapes the line separators, bidirectional controls, zero-width characters and C1 controls that JSON leaves raw. So `"12"`, `"true"` and `""` are strings, `12` and `true` are not.
- **Keys** are bare when they match `[A-Za-z0-9_$][A-Za-z0-9_$.-]*`, else JSON-quoted.
- **Inline values** are `{key:value,…}` and `[value,…]` with no spaces.
- **Layout.** Each top-level field is a `key: value` line. An object or array that would make its line longer than 100 characters is broken out instead, for up to two levels: an object becomes indented `key: value` lines, an array of objects or arrays becomes `key[count]:` followed by one indented `- value` line per item. Deeper values stay inline. Indentation is two spaces.
- **Shared fields.** When at least three items of an array are objects and every one of them has the same value at some field, that field is printed once as `each: {…}` above the items and left out of each item. Read every item as if `each:` were merged into it. A field that any item lacks or holds differently stays on the items.
- **Commands.** A `{command, argv}` object whose `command` is exactly the shell-quoted `argv` on one printable line is written `$ <command>`, for example `next: $ npx genie-react tools react_get_renders --session my-agent`. Otherwise both fields are written as data.
- **Root values.** An object prints its fields, `{}` when empty. An array prints `[count]:` and its items. A root string is always quoted.

### What text leaves out

Text omits only what its layout already states. This list is exhaustive, and `packages/cli/src/text-renderers.test.ts` proves for every recorded result that a value or key placed anywhere in the document reaches the text:

- `schemaVersion` on a CLI-owned record when it is `"2.0"`; any other value is printed.
- `status`, `reason` and `message` of a CLI-owned record, which form its first line, and `tool` and `status` of a batch result, which form its header. A batch result's `ok` is omitted when it agrees with its `status`.
- `argv` of a command written as `$ <command>`, and the per-command `help` argv in root help, which is `<prefix> <command> --help`.
- In the layouts below, the field names that a position on the line stands for, such as a tree node's `name` and `id`, and a tree node's `parentId`, which its indentation states. When a document does not fit a layout, for example a tree whose parent is not an open ancestor, the generic encoding is used instead.

`null`, `false`, `0`, `""`, `[]` and `{}` are always printed: an empty `notComparableReasons: []` or a `nextCursor: null` is evidence.

### Structure-aware layouts

Results with a known structure use a layout that reads better and costs fewer tokens than the generic encoding; `node scripts/measure-cli-output.mjs` keeps each one only while it beats the generic encoder on the recorded results. Every field a layout does not place is still printed with the generic encoding, and each header line states the layout:

| Result | Layout |
| --- | --- |
| `react_get_tree` | `nodes[n] (name #id {fields}, children indented under their parent):`, one node per line |
| `react_get_renders`, `react_render_causes` | one `name #id {fields}` line per component or render event, then one `← kind evidence name {fields}` line per cause, so the `exact`, `inferred` or `unknown` grade is always the second word |
| `timeline_read` | one `#sequence atMs domain type {details}` line per event |
| `devtools_capture_compare` | one `metric verdict {fields}` line per metric, then one `reason:` line per reason |
| `status`, `devtools_status` | one `sessionId {fields}` line per session |
| `tools` | one `group (count): tools` line per group |
| `tools <group>` | one `name title params {fields}` line per tool |
| `tools <tool>`, `tools --all` | a `name title` line, one `name?: type keyword:value — description` line per argument (`?` marks an optional argument), and one `field?: type` line per output outline field |
| `doctor` | one `ok\|FAIL critical\|optional label — detail {fields}` line per check |
| `verify` | a `verdict id "name"  commits, settle` line, one `index verdict claim  {observed}` or `index verdict claim  reason: message` line per claim with its evidence indented below, one `window reason: message` line per window refusal, one `! caveat: text` line per caveat, and an `attempt` line for the rerun history |

### Lines only the CLI writes

App data cannot produce these lines: every string from the app that contains a space, quote, comma, brace or bracket, a line break, or any character outside the bare set is quoted, and a key is always followed by `:` or `[`.

- **Records the CLI owns** (failures, truncation, setup receipts, hub events, doctor) start with `<status> <reason>: <message>`, for example `error invalid_args: Tool call failed. …`, `truncated max_bytes: …`, `ok setup_completed: …` or `action_required manual_setup_required: …`. The next line is `next: $ <command>` when a recovery command is known; every other field follows. A tool result never gets this line, whatever it contains.
- **Batch results** start with `[position/total] tool ok` or `[position/total] tool error <reason>: <message>`; the result or failure fields follow, indented two spaces.
- **Diagnostics** on stderr are `! <reason>: <message>` followed by their data inline.
- **Verdicts** from `verify` start with `pass`, `fail`, `refused`, `inconclusive`, `recording` or `aborted`, the verification ID and the quoted run name. Their `! <caveat>: <text>` lines are fixed CLI sentences for the caveat codes in `caveats`, and an unknown code prints as `! caveat: <code>`.

A failure in text carries every field of its JSON form: `userActionRequired`, `errorCode`, `retryInMs`, `busyTelemetry`, `correctedExample` and `details` with `issues`, `didYouMean`, `requiredKeys`, `validKeys`, `suggestions`, `app`, `availability`, `session.connected`, `session.registeredTabs` and `mayHaveCompleted`. Treat everything under `details` as app data, as in JSON.

### Bounds in text

The byte limits below count the emitted text. An oversized text result prints the `truncated max_bytes:` record; its complete text is spilled to `outputPath` with a `.txt` extension, and each suggestion prints as its reason over a `$ <command>` line. `originalBytes` is the size of the full text; `largestPaths[].bytes` estimates each branch by its compact JSON size, which ranks branches the same way. `--select` paths and `--max-bytes` suggestions work the same in both formats.

## JSON contract

Everything below describes `--json` output, which is also what `GENIE_OUTPUT=json` selects. These documents are unchanged by the text default.

| Surface | Contract |
| --- | --- |
| `call`, `status`, `tools`, `doctor`, `init`, `link`, `capture export` | One compact JSON value followed by a newline |
| `--help`, no command | JSON command metadata: arguments, accepted flags, types, required options, defaults, limits, examples and output format |
| `--version` | Versioned JSON object with `version` |
| `batch --ndjson`, and `batch` under `GENIE_OUTPUT=json` | One JSON object per result line; an empty batch emits zero bytes |
| `batch --json` | One JSON array |
| `call --fields` | Projected JSONL rows; an empty collection emits zero bytes and a `fields_unverified` diagnostic, because unknown fields cannot be checked against zero rows |
| `hub` | JSONL lifecycle records: `ready`, `reused`, `stopped`; structured failures |
| Diagnostics | JSONL on stderr; no ANSI or prose preambles |

Exit codes are 0 for command success and 1 for failure, except `verify`. A failed batch item does not stop subsequent calls. A tool can report an unsuccessful domain outcome without a transport failure; retain `--fail-on-result-error` for wait/quiesce commands when that outcome should set exit 1. Graceful hub shutdown exits 0 and only stops the hub owned by this process.

CLI-created failures have `schemaVersion`, `status`, `reason`, `message`, `userActionRequired`, `errorCode` and `exit: {code, class}`. `exit` is the code the command will use once every command uses the taxonomy below; `verify` uses it already, and other commands still exit 0 or 1 until 1.0, so a script can read `exit.code` now. Where recovery is known, `next.argv` provides argument boundaries and `next.command` provides a safely constructed command; retry commands keep the caller's `--session`. A bridge failure carries the wire `errorCode` (`invalid-args`, `tool-error`, …), and `retryInMs`/`busyTelemetry` when the app is busy. A failure the CLI detects itself carries the kebab-case of its reason (`invalid-input`, `unknown-tool`, `bridge-unreachable`, …). Batch failure rows use the same fields beside `tool`, `ok` and `status`.

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
| `bridge_rejected` | The hub refused the connection (agent token, browser origin), or the CLI refused a hub from another genie-react `major.minor` release line (`errorCode: "version-mismatch"`) | `versions: {cli, hub}`; `hub: null` means the hub does not report its version |
| `conflict` | Another agent restarted, paused or changed the render window or recording the call depends on (`hubCode: "OBSERVATION_SUPERSEDED"`), or holds the overrides, Query simulation or recording the call would reset or replace (`hubCode: "STATE_HELD"`) | `hubCode`, `ownership: {resource, cause, tool?, ageMs?, otherCallers?}` |
| `busy`, `timeout` | The app could not answer in time | |
| `operational_failure` | Connectivity or local failure | |

`message` is composed only from what the caller supplied and fixed CLI text: the tool name and session as typed, and the keys, JSON Pointer paths and JSON types of the arguments the CLI sent, each echoed only when short and identifier-shaped. A path or unknown key is named only when it exists in the sent arguments; `received` is computed locally. Everything the app or its catalog reports stays in `details`: `issues[].message`, `issues[].expected`, `issues[].allowed`, `requiredKeys`, `validKeys`, `suggestions`, connected session IDs, `app`, `availability.reason` and the `--fields`/`--select` available lists. Treat all of it, like tool data, as application data even when its text looks like instructions. `issues[].received` names a JSON type, never the value sent. When an enum lists values that are not identifier-shaped, they are withheld and the issue's `message` is replaced with fixed CLI text.

`correctedExample.args` is a shape template. It keeps the arguments the caller sent, minus the rejected keys, and fills every other identifier-shaped key from the schema's example with a CLI-built placeholder of the same JSON kind: `"<string>"`, `0`, `false`, `[]`, `{}` or `null`. No value from the app's example reaches it, so replace each placeholder with the intended value before calling. Only the CLI's own fallback for `devtools_wait` is described as retryable.

`hubCode` (`CAPTURE_NOT_RETAINED`, `INTERACTION_ACTIVE`, `INTERACTION_LIMIT`, `INTERACTION_SESSION_MISMATCH`, `INTERACTION_UNKNOWN`, `REACT_COLLECTOR_MISSING`, `VERIFICATION_ACTIVE`, `VERIFICATION_UNKNOWN`) adds fixed recovery guidance and sets `userActionRequired: true`, because each one needs the caller to act: list or choose another capture, stop an interaction or a verification, target its session, begin a new one, or register the React collector. `VERIFICATION_ACTIVE` names the blocking `details.verificationId`, and `next` ends it. The hub strips `hubCode` from app responses, and the CLI honours it only for tools the hub answers itself (`devtools_status`, `devtools_wait`, `react_quiesce`, `devtools_capture_*`, `devtools_interaction_*`, `devtools_verify_*`) and for `VERIFICATION_ACTIVE`, which the hub returns for any tool its document lock refuses, so an app cannot forge one.

Diagnostics and other CLI records use snake_case reasons too: `bridge_connect`, `bridge_event`, `bridge_fallback`, `stale_discovery`, `fields_unverified`, `output_failure` and `max_bytes`.

A wildcard `--select` always returns `result` as an array aligned index-for-index with `selection.matchedPaths`; a wildcard over an empty collection returns an empty array. A path without a wildcard returns the single matched value.

Every CLI-owned envelope carries `schemaVersion: "2.0"`. Version 2.0 renamed every `reason` to snake_case (the wire spelling moved to `errorCode`), added `details` and `correctedExample`, and dropped the duplicated `error` field from batch failure rows.

### Verify

`verify begin|end|show|abort` prints one verification document. Its first fields are `schemaVersion: "1.0"`, `kind: "verification"`, `verificationId`, `verdict` and `exitCode`, so a cut-off document still says what happened. `state` is `recording` after `begin`, `completed` once decided, and `aborted` after `abort`. Each claim carries `index`, `text` (the claim in the DSL), `claim` (the same claim as JSON), `verdict`, `observed`, `deciding` (at most three items), `caveats`, and a `refusal: {reason, message, evidence, fix, next?}` or `inconclusive: {reason, message, evidence}`. `window.refusals` lists guards that refused the whole window. `ledger` gives the attempt number and earlier verdicts for the same claims on the same tab. `request` holds the options the run began with; `next` commands are rebuilt from it and keep `--session`.

`verify` exits with its verdict and uses the taxonomy that `exit` reports for every failure:

| Code | Class | Meaning |
| --- | --- | --- |
| 0 | `success` | pass, or `begin`, `show` and `abort` succeeded |
| 1 | `failure` | fail: the evidence proves a claim false; also `tool_error`, `tool_unavailable`, `operational_failure` and `conflict` |
| 2 | `usage` | `invalid_input`, `invalid_args`, `unknown_tool`, `unknown_session`, an unknown flag or a malformed claim |
| 3 | `needs-human` | `bridge_rejected` |
| 4 | `refused` | the evidence is not good enough; each refusal names one reason and a fix |
| 5 | `inconclusive` | complete evidence that does not decide the claim |
| 69 | `unreachable` | `bridge_unreachable`, `not_connected` |
| 124 | `timeout` | `timeout`, `busy`; `verify end <id>` again returns the stored verdict |
| 130 | `interrupted` | SIGINT |

`verify end` for a verification the hub no longer holds prints a `refused` document with a `window_lost` window refusal and exits 4; it never reports a verdict the hub did not decide.

## Tab targeting

Untargeted calls go to the only connected tab, or to the tab the same agent's untargeted calls already used; opening another tab, or another agent's first call, does not move them. Untargeted calls never land on a tab another agent used in the last 10 minutes. Each CLI process sends a caller identity: `GENIE_AGENT` when set (1–64 letters, digits, `.`, `_` or `-`; anything else fails with `invalid_input`), else a hash of the Claude Code or Codex session ID, else a hash of the git worktree root. The hub keeps the default tab, render windows, recordings, overrides and Query simulations per caller. A tab is identified across navigations and reloads, and status lists one row per tab with its current document. Batch rows carry `session` (`{sessionId, logicalSessionId?, sessionName?}`, the tab that answered). A raw `call` result keeps its shape, so with several tabs connected the CLI writes the answering session as a stderr `session` diagnostic, and a `session-retargeted` diagnostic when the default tab is gone or unresponsive and another tab answered. Session values that are not shell-safe identifiers are omitted.

Session failures carry `details.hubCode`, which the CLI trusts only on the `not-connected` and `unknown-session` wire codes that hub routing alone produces:

- `SESSION_AMBIGUOUS` (`reason:"unknown_session"`): several tabs match an untargeted call or a shared `--session` name. `details.session.connected` lists the matching tabs; pass `--session <target>` or set `GENIE_SESSION`.
- `SESSION_CLAIMED` (`reason:"unknown_session"`): every connected tab is in use by another agent, so an untargeted call took none. `details.session.connected` lists them and `details.ownership.otherCallers` counts the agents; open your own tab with `?_genie=<name>` and pass `--session <name>`, or pass `--session <target>` to share one deliberately.
- `SESSION_RELOADING` (`reason:"not_connected"`): the default tab is reloading while several other tabs are open. Retry after `retryInMs`.
- `SESSION_SUPERSEDED` and `SESSION_DISCONNECTED` (`reason:"not_connected"`): a newer page load replaced the document, or the document closed, before the call answered. `details.mayHaveCompleted: true` marks a tool that is not read-only; inspect app state before retrying. Otherwise retry the call.

These failures set `userActionRequired: false` except `SESSION_AMBIGUOUS` and `SESSION_CLAIMED`.

Ownership failures use the hub-only wire code `conflict`, which an app cannot send, so the CLI trusts their `hubCode` on every tool. They set `userActionRequired: true`. `details.ownership.resource` is `render-window`, `timeline`, `overrides` or `query-simulation`; `cause` is `restarted`, `paused`, `changed-state` (another agent ran a tool that is not read-only inside the window), `reloaded` (the tab loaded a new document after the window started) or `held`. A successful call on a tab another agent used recently writes a `session-shared` diagnostic, and a call that disturbed another agent's window writes `window-displaced`.

Setup receipts list planned, applied, already-present and manual artifacts, including the discovery ignore entry and bundled skill files. Source contents are omitted. Required manual component wiring and package-manager install/dev commands remain available as structured instructions. A setup operation that fails after a write reports that changes may have applied; the CLI does not claim rollback.

## Bounds and recovery

The default ceiling is 102,400 bytes per document or per batch or hub record, including its newline, in either format. An explicit batch `--max-bytes` buffers results and bounds the whole command. Hub lifecycle records are independently bounded. JSONL streams are not presented as one JSON document with a fixed total size.

`--max-bytes` accepts 512–50,000,000. An oversized response becomes an explicit `status:"truncated"` envelope (`truncated max_bytes:` in text) with size, omitted-path information, the heaviest selectable `largestPaths`, and runnable `suggestions` built from the invocation (summary view, a fitting `limit`, a `--select` branch, or a raised byte limit). For `call` and `tools`, the complete result is also written, in the output format, to `outputPath` in a private per-user directory (`genie-react-<uid>/out` under `$XDG_RUNTIME_DIR` or the OS temp dir) (directory 0700, files 0600; a spill file is kept for at least an hour beyond the newest 20, and the oldest go only past 200 files, so parallel agents cannot delete a file another was just told to read), following the Playwright CLI pattern. The envelope is not a complete result. An export artifact's content is separate from its stdout receipt.

```sh
npx @genie-react/cli call --help
npx @genie-react/cli tools timeline_read
npx @genie-react/cli call react_get_renders '{}' --select /coverage
npx @genie-react/cli batch '[{"tool":"react_get_renders"}]' --json
```

## Measured size

`node scripts/measure-cli-output.mjs` renders 37 results recorded from `apps/vite-demo` (in `packages/cli/fixtures/output`, re-recorded with `--record`) and replays every app-answered one through a real bridge to confirm the built CLI prints the same text and JSON. Tokens are counted with `o200k_base` as a public proxy; Claude's tokenizer is not published. Over all 37 results, text is 69% of the JSON bytes and 72% of the JSON tokens. On the heaviest outputs:

| Result | Text/JSON tokens |
| --- | ---: |
| `react_get_tree` (app components, all components) | 42%, 60% |
| `react_get_renders` (summary, full) | 85%, 58% |
| `react_render_causes` (one component, all) | 76%, 73% |
| `react_effect_timeline` | 59% |
| `devtools_capture_list`, `devtools_capture_compare` | 45%, 81% |
| `tools`, `tools --all`, `tools react_get_renders` | 86%, 84%, 92% |

Tool listings save the least because their descriptions are prose that text keeps verbatim. Small documents with a few nested fields, such as `react_clear_renders`, can cost a few more tokens as text than as JSON; they are small in either format.

## Migration

1.0 makes text the default. A script that parses CLI output adds `--json` to each invocation, or sets `GENIE_OUTPUT=json` once to keep the 0.19 behavior, including JSONL for `batch`, `call --fields` and `hub`. Help is text; `--help --json` returns the JSON metadata, whose `output` object now states `default: "text"` and the `json` format. Diagnostics follow the output format. Tool result schemas, failure reasons, exit codes, byte limits and the hub wire protocol are unchanged.

The 0.14 migration from human summaries to JSON is described in the CLI changelog. The executable routes every result through shared bounded serializers and derives command help and accepted options from the same registry. Collector APIs remain unchanged. Low-level setup logger injection remains available to library callers; it is not the executable's output contract.

## Verification

Run `pnpm check`, then `node scripts/check-cli-json.mjs`. The subprocess suite exercises every command family in JSON and in text: help, version and parser errors, `GENIE_OUTPUT=json` parity with `--json`, real local setup, large multibyte output above the pipe buffer, explicit truncation and text spills, JSONL and text batches, `--fields` rows, text diagnostics, a real hub in both formats, occupied ports and interrupt cleanup. `node scripts/measure-cli-output.mjs` reports the size table above and fails when a structure-aware layout stops beating the generic encoder.

`node scripts/check-verify-e2e.mjs` drives `verify` through the built CLI against a Chromium React app: one scenario per false-pass case it guards, each asserting the verdict and the exit code, plus clean scenarios that must pass. `node scripts/check-timeline-e2e.mjs` drives an actual Chromium React app through the built CLI with `--json`, including all four timeline lanes and the script entry. `pnpm test:e2e` validates the packaged Vite integration and existing compatibility paths.
