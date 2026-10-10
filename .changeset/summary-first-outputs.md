---
"genie-react": minor
"@genie-react/cli": minor
---

Return compact summaries by default from the heaviest tools and make oversized CLI output recoverable.

**Breaking changes.** Pass `view:"full"` to restore the previous payloads.

- `react_get_renders` and `react_render_causes` take `view` and default to `"summary"`. A summary omits null, zero, and default fields and the legacy summary aliases (`unstableComponents`, `unnecessaryComponents`, `topUnstableProps`). Changed values are dropped, and the source fields are collapsed into one `source: {location, ownership}`. A summary component record is usually under 500 bytes.
- `devtools_capture_create` returns the `devtools_capture_read` summary and warnings by default.
- `devtools_interaction_stop` returns the following by default:
  - the settle outcome and coverage
  - the top components, each with its top cause
  - the hottest effects
  - the cohort results
  - a `fullView` handle

  Pass `view:"full"` to get the previous payload. Add `sections` with it to fetch only `renders`, `causes`, `effects`, or `cohorts`.
- Timeline coverage entries carry a stable `code`. The `detail` text is now returned only by `timeline_start`. The codes are documented at `/docs/tools/timeline#coverage-codes`.
- The CLI's default `--max-bytes` drops from 262,144 to 102,400. When a `call` or `tools` result is too large, the complete JSON is saved to `.genie/out/` (the newest 20 files are kept). The truncation envelope reports the file in `outputPath`, along with `largestPaths` and runnable `suggestions`: the summary view, a fitting `limit`, a `--select` branch, or a raised `--max-bytes`.
- `genie-react tools <name>` shows the input schema and a one-level `outputOutline`. Pass `--output-schema` for the complete output JSON Schema. Descriptors no longer print safe-integer `minimum`/`maximum` bounds.
