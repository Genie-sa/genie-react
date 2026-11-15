---
"@genie-react/cli": minor
---

**Breaking:** the CLI now prints compact text by default instead of JSON. Text keeps every field of every result under its JSON name and costs fewer tokens: about 72% of the JSON tokens across recorded results, 42–60% for a component tree and about 75% for render causes. App strings are quoted, so app content cannot fake a field, a failure line or a command. A failure's first line is `error <reason>: <message>`, followed by `next: $ <command>` when a recovery command is known. Exit codes and byte limits are unchanged, and an oversized text result is saved whole as a `.txt` file at `outputPath`.

`--json` prints the same JSON documents as before, with identical schemas. Help is text; `--help --json` returns the JSON metadata. Diagnostics on stderr are text lines, or JSON Lines with `--json`. `batch` prints one block per result; `batch --json` prints one array and `batch --ndjson` prints JSON Lines.

Migration: add `--json` to every command whose output a script parses, or set `GENIE_OUTPUT=json` once to keep the 0.19 behavior, including JSON Lines for `batch`, `call --fields` and `hub`. `GENIE_OUTPUT` accepts only `text` or `json`; any other value fails with `invalid_input`. The format is specified in docs/json-cli.md.
