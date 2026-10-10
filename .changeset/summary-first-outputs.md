---
"genie-react": minor
"@genie-react/cli": minor
---

Return compact summaries by default from the heaviest tools and make oversized CLI output recoverable.

**Breaking changes.** Pass `view:"full"` to restore the previous payloads.

- `react_get_renders` and `react_render_causes` take `view` and default to `"summary"`. A summary omits null, zero, and default fields and the legacy summary aliases (`unstableComponents`, `unnecessaryComponents`, `topUnstableProps`). Changed values are dropped, and the source fields are collapsed into one `source: {location, ownership}`. A summary component record is usually under 500 bytes.
- `devtools_capture_create` returns the `devtools_capture_read` summary and warnings by default. Capture summaries add `renders` (render `comparable`, `notComparableReasons`, and coverage `complete`/`semantics`), and a capture is `complete` only when that render evidence is comparable with complete coverage.
- `devtools_interaction_stop` returns the following by default:
  - the settle outcome and coverage
  - render `semantics` and the top components, each with input evidence, non-zero memo counters, and its most frequent cause kind (ties listed, latest-render details labelled as such)
  - the hottest effects
  - the cohort results
  - a `fullView` handle

  Pass `view:"full"` to get the previous payload, now tagged `view:"full"`. Add `sections` with it to fetch only `renders`, `causes`, `effects`, or `cohorts`.
- Timeline coverage entries carry a stable `code`. The `detail` text is now returned only by `timeline_start`. The codes are documented at `/docs/tools/timeline#coverage-codes`.
- The CLI's default `--max-bytes` drops from 262,144 to 102,400. When a `call` or `tools` result is too large, the complete JSON is saved to a private per-user directory (`genie-react-<uid>/out` under `$XDG_RUNTIME_DIR` or the OS temp dir): the directory is 0700 and must be owned by you, files are 0600, and only the newest 20 spill files are kept. Suggestions keep an explicit `--max-bytes`. The truncation envelope reports the file in `outputPath`, along with `largestPaths` and runnable `suggestions`: the summary view, a fitting `limit`, a `--select` branch, or a raised `--max-bytes`.
- `genie-react tools <name>` shows the input schema and a one-level `outputOutline`. Pass `--output-schema` for the complete output JSON Schema; output schemas share repeated subschemas through `$defs`. Descriptors no longer print safe-integer `minimum`/`maximum` bounds.
