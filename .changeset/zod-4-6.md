---
'genie-react': patch
'@genie-react/cli': patch
---

Genie runs on zod 4.6.7, and `defineCollectorTool` keeps type-checking when your app uses a different zod 4 release.

- genie-react now depends on `zod@^4.6.7` instead of `^4.4.3`. Your app can stay on any zod version. The browser runtime bundles its own zod, so an app on zod 3 or on another zod 4 release does not change how Genie validates or advertises tools. App tools (`defineGenieTool`, `useGenieTool`) and collector tools (`defineCollectorTool`) accept schemas from any zod 4 release from 4.0.0 on, and `tsc` types handler arguments and results from them. The Vite plugin, the hub and the type declarations use the zod your package manager installs for genie-react, so the range starts at the release Genie is tested on, and CI installs that lowest release.
- `defineCollectorTool`, exported from `genie-react/client`, no longer runs TypeScript out of memory when a collector's schemas come from a different copy of zod than genie-react's, for example zod 4.6.5 in the app against 4.6.7 in Genie. Like `defineGenieTool`, it only requires a schema's output type (`GenieToolSchema`). It throws an error that names the tool when the contract's `input` or `output` is not a Zod 4 schema. It now returns the type-erased tool that a collector's `tools` list holds, instead of returning its argument unchanged. `AgentToolContract`, `defineAgentToolContract`, `ToolInput` and `ToolOutput` in `genie-react/protocol` accept schemas from any zod 4 copy, and `GenieToolSchema` is exported there too.
- Advertised JSON Schemas changed in three ways. Each change describes the values Genie already accepted or returned:
  - A union of plain types is written as a list of types, so `{"anyOf":[{"type":"number"},{"type":"null"}]}` becomes `{"type":["number","null"]}`. This affects many output fields and the `path` and `where.equals` inputs of `query_get`, `query_get_data`, `react_inspect_component` and `react_override_hook_state`. The CLI's `tools` output prints both forms the same way.
  - The patterns of capture, interaction and verification timestamps (`createdAt`, `capturedAt`, `startedAt`, `stoppedAt`) require seconds. Every timestamp Genie writes includes seconds.
  - `observedDomains` and `unobservedDomains` in `react_effect_events` and `react_effect_timeline` declare their fixed length with `minItems`, `maxItems` and `items: false`.
- When an array argument is longer than its limit, the call now fails with a single issue such as `/domains: Too big: expected array to have <=5 items`. Before, the error listed up to three problems with the array's elements and left out the limit that was broken. Every other `invalid_args` message, `requiredKeys`, `exampleArgs` and `didYouMean` hint is unchanged.
- Checking a large result against its output schema in development builds is faster. A 178 KB `react_get_tree` result takes 0.16 ms instead of 0.37 ms.
