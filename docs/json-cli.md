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
| `call --fields` | Projected JSONL rows; an empty collection emits zero bytes |
| `hub` | JSONL lifecycle records: `ready`, `reused`, `stopped`; structured failures |
| Diagnostics | JSONL on stderr; no ANSI or prose preambles |

Exit codes remain 0 for command success and 1 for failure. A failed batch item does not stop subsequent calls. A tool can report an unsuccessful domain outcome without a transport failure; retain `--fail-on-result-error` for wait/quiesce commands when that outcome should set exit 1. Graceful hub shutdown exits 0 and only stops the hub owned by this process.

CLI-created failures have `schemaVersion`, `status`, `reason`, `message` and `userActionRequired`. Where recovery is known, `next.argv` provides argument boundaries and `next.command` provides a safely constructed command. Raw malformed input and upstream exception text are excluded from trusted error messages. Tool data remains application data, even when its text looks like instructions.

Setup receipts list planned, applied, already-present and manual artifacts, including the discovery ignore entry and bundled skill files. Source contents are omitted. Required manual component wiring and package-manager install/dev commands remain available as structured instructions. A setup operation that fails after a write reports that changes may have applied; the CLI does not claim rollback.

## Bounds and recovery

The default ceiling is 262,144 bytes per JSON document or default JSONL record, including its newline. An explicit batch `--max-bytes` buffers results and bounds the whole command. Hub lifecycle records are independently bounded. JSONL streams are not presented as one JSON document with a fixed total size.

`--max-bytes` accepts 512–50,000,000. An oversized response becomes an explicit `status:"truncated"` envelope with size and omitted-path information. It is not a complete result. Use a tool's pagination/limit arguments, `--select`, or a larger byte limit to recover the required evidence. An export artifact's content is separate from its stdout receipt.

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
