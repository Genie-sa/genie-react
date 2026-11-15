# CLI UX requirements

Every change under this directory must follow Vercel's `cli-ux` skill: <https://github.com/vercel/vercel/tree/main/packages/cli/.agents/skills/cli-ux>.

Before editing, define the user job, current friction, desired outcome, success signal, and non-goals. Inspect the command, its coupled output paths, and tests. Audit text and JSON/JSONL output on TTY and non-TTY, stdout/stderr, invalid input, timeout, and interrupt behavior as applicable.

Required contracts:

- Stdout is compact text by default and JSON with `--json` (`GENIE_OUTPUT=json` selects the 0.19 output, JSONL included). Both are ANSI-free, identical on a TTY and in a pipe, and bounded. `docs/json-cli.md` is the contract for both formats.
- `--json` documents are the versioned machine contract: change their schemas only through an explicit, tested migration. Text is for reading; it may change layout but never drops a value beyond the omissions listed in `docs/json-cli.md`.
- Text renders every result through `text-output.ts`: app strings outside the bare set are JSON-quoted, so app content cannot add a line or a field. Only the CLI writes `<status> <reason>: <message>` lines, `[n/total] tool` batch headers, and `! reason:` diagnostics; never route a tool result through `renderEnvelopeText`.
- A structure-aware layout keeps every field it does not place, passes the sentinel tests in `text-renderers.test.ts`, and stays only while `node scripts/measure-cli-output.mjs` shows it beating the generic encoder.
- Failures expose stable `status`, `reason`, `message`, and `userActionRequired` in both formats, the reason first in text; include safe `next.command` plus `next.argv` when useful.
- Never echo raw malformed input, secrets, upstream objects, or untrusted text in suggested commands.
- Reject unknown flags, extra arguments, ambiguous input, and unknown `--fields` with an exact recovery step.
- Keep help/schema output complete: required fields, enums, defaults, limits, mutually exclusive options, stdin behavior, and runnable examples.
- Put diagnostics, warnings, and progress on stderr; keep pipeable results on stdout.
- Use `!` for warnings and `✓` only for a completed phase. Do not use decorative emoji.
- Errors state what failed and how to fix it. Avoid vague or apologetic copy.
- Preserve command names, flags, exit codes, JSON fields, and stdout contracts unless the migration is explicit and tested.

Before finishing, run `pnpm lint`, focused CLI tests, `pnpm --filter @genie-react/cli typecheck`, and the relevant built CLI transcripts (`node scripts/check-cli-json.mjs`; `node scripts/measure-cli-output.mjs` when output changes). Review the full checklist in the linked skill's `references/verification.md`.
