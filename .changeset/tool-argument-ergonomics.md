---
"@genie-react/tanstack-collector": minor
"@genie-react/cli": minor
---

Make tool arguments discoverable and consistent for agents.

- `genie tools` now prints each tool's parameters (name, type, and a `?` for optionals) from the input schema the app already advertises, so an agent can call a tool without guessing argument names.
- `query_get` and `query_get_data` now accept **either** a `queryHash` or a `queryKey` — whichever you already have from `query_list` — instead of each demanding a different identifier.
