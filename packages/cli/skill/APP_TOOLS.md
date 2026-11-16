# Writing app tools

Genie exposes tools the app defines as `app_<name>`. Import everything from `genie-react/tools`, and Zod 4 from the app's own `zod` dependency.

## Pick the owner

- `useGenieTool` or `useGenieTools`: tools that live as long as a component or route. Inline handlers see the latest render's state.
- `<Genie tools={tools} />`: tools for the app's whole lifetime.
- `registerGenieTools` outside React, such as in a store or API client. Call the returned unregister function when that owner goes away.
- For a Redux store, call `reduxCollector(store)` from `genie-react/collectors/redux` instead of writing tools.

## Define the contract

```tsx
useGenieTools([
  defineGenieTool({
    name: 'login_as',
    group: 'auth',
    kind: 'action',
    idempotent: true,
    description: 'Switches the local session role. Read app_session afterward for the permissions the UI now shows.',
    input: z.object({ role: z.enum(['guest', 'member', 'admin']) }),
    output: z.object({ changed: z.boolean(), role: z.string() }),
    handler: ({ role: next }) => {
      const changed = next !== role
      if (changed) switchRole(next)
      return { changed, role: next }
    },
  }),
])
```

- `name` is snake_case. `group` lists the tool under `app.<group>`.
- `kind: 'query'` reads; `kind: 'action'` changes state. Add `destructive: true` when it cannot be undone and `idempotent: true` only when repeating it is safe.
- `description` is all the agent sees: what the tool does, when to call it, and what the result means, under 500 characters.
- `input` is a Zod object; its defaults, limits and enums become the advertised schema. `output` is checked in development.

## Write the handler

Read state at call time and return small, plain, serializable data: no DOM nodes, functions, class instances or secrets. Results are capped at 131,072 bytes, so prefer filter and limit arguments. Keep synchronous work well under a second.

Throw `new GenieToolError(message, { code, hint })` for a failure the agent can recover from, with `hint` as a concrete next step; the CLI exits nonzero with `reason: "tool_error"`. Return an expected outcome, such as an empty cart, as typed data in the output schema instead.

## Check it

```bash
npx genie-react tools app --session my-agent
npx genie-react tools app_login_as --session my-agent
npx genie-react call app_login_as '{"role":"admin"}' --session my-agent
```

A tool is done when its details show the intended inputs and annotations, valid calls return the documented shape, invalid ones fail with field-level messages, an action's effect shows in a follow-up query and on screen, unmounting its owner marks it unavailable, and every role, fixture or fault it set is restored.
