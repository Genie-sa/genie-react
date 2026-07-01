# @genie-react/tanstack-collector

## 0.1.0

### Minor Changes

- Initial public release of Genie — give an AI coding agent full DevTools access to your live React + TanStack app from your terminal via the `genie` CLI.
- a36626f: Make tool arguments discoverable and consistent for agents.

  - `genie tools` now prints each tool's parameters (name, type, and a `?` for optionals) from the input schema the app already advertises, so an agent can call a tool without guessing argument names.
  - `query_get` and `query_get_data` now accept **either** a `queryHash` or a `queryKey` — whichever you already have from `query_list` — instead of each demanding a different identifier.

### Patch Changes

- Updated dependencies
  - @genie-react/client@0.1.0
  - @genie-react/core@0.1.0
