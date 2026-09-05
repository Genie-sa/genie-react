---
"@genie-react/cli": minor
---

Migrate the CLI to JSON output by default, including help, version, setup receipts and failures. Preserve existing tool JSON schemas and --json compatibility, document JSONL batch/fields/hub streams, and bound output with explicit truncation. Diagnostics are JSONL on stderr. Consumers parsing previous human output must migrate to the structured fields; see docs/json-cli.md.
