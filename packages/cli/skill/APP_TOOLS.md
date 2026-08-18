# Defining custom app tools

Load this reference only when creating or changing the app-owned tools that Genie exposes as `app_*`.

## 1. Choose the registration lifetime

- Use `useGenieTool` for one component- or route-scoped tool.
- Use `useGenieTools` for several tools owned by one component. Inline handlers see the latest render's state; do not add dependency arrays.
- Pass definitions to `<Genie tools={tools} />` for app-lifetime tools.
- Use `registerGenieTools` outside React, such as in a store or API client. Keep and call its unregister function when that lifetime ends.

This step is complete when every tool has one deliberate owner and lifetime.

## 2. Define the contract

Apps import Zod directly; add it as a direct dependency rather than importing Genie's private copy.

```tsx
import { defineGenieTool, GenieToolError, useGenieTools } from 'genie-react'
import { z } from 'zod'

function AuthDevtools() {
  useGenieTools([
    defineGenieTool({
      name: 'session',
      group: 'auth',
      kind: 'query',
      description: 'Returns the active role and permissions used to gate the current UI.',
      output: z.object({ role: z.string(), canDelete: z.boolean() }),
      handler: () => ({ role, canDelete }),
    }),
    defineGenieTool({
      name: 'login_as',
      group: 'auth',
      kind: 'action',
      idempotent: true,
      description: 'Switches the local session role and returns the permissions now visible in the UI.',
      input: z.object({ role: z.enum(['guest', 'member', 'admin']) }),
      handler: ({ role: nextRole }) => {
        if (nextRole === role) {
          throw new GenieToolError('role is already active', {
            code: 'NO_OP',
            hint: 'query app_session for the current permissions',
          })
        }
        return switchRole(nextRole)
      },
    }),
  ])
  return null
}
```

Contract rules:

- `name` is snake_case (kebab-case is normalized) and becomes `app_<name>`.
- `group: 'auth'` is optional and lists under `app.auth`; use one snake_case segment.
- `kind: 'query'` is read-only and retryable. `kind: 'action'` mutates; add `destructive: true` for no-undo behavior and `idempotent: true` only when the same call is safe to repeat.
- `description` is the agent's only documentation. State what the tool does, when to call it, and what the result means; keep it focused and under 500 characters.
- `input` must be a Zod object schema. Omit it for no arguments. Defaults, constraints, and enums become the advertised JSON Schema.
- `output` is optional; when present, Genie advertises it and checks result drift in development.
- `enabled: false` gates `useGenieTool` registration. To change a mounted hook's name or contract, change its `name`/`enabled` identity rather than closing over dynamic schema text.

This step is complete when discovery describes every argument, mutation property, and result needed to call the tool without reading its implementation.

## 3. Keep the handler bounded and actionable

Read current state at call time. Return plain serializable data, never DOM nodes, fibers, class instances, functions, symbols, or secrets. Results default to a 128KB cap; prefer summary/filter/limit arguments before raising `maxResultBytes`. Keep synchronous work well under one second so the app's main thread remains responsive.

Throw `GenieToolError` for an expected failure the agent can act on:

```ts
throw new GenieToolError('cart is empty', {
  code: 'CART_EMPTY',
  hint: 'seed it with app_seed_cart',
})
```

Plain exceptions are treated as bugs in the app's handler. Do not hide them behind a success result.

This step is complete when success is bounded plain data and every expected failure names a recovery action.

## 4. Register outside React when needed

```ts
import { defineGenieTool, registerGenieTools } from 'genie-react/client'

const unregister = registerGenieTools(
  defineGenieTool({
    name: 'cart_state',
    kind: 'query',
    description: 'Returns current cart line items and totals from the client store.',
    handler: () => useCartStore.getState().summary(),
  }),
)

// Keep this handle and call unregister() when the owning store/module lifetime ends.
```

Registration waits for a late Genie client. Unregistering leaves a bounded unavailable tombstone with its last route so agents can understand how to remount it.

## 5. Verify the agent-facing behavior

With the app running, use the exact installed CLI:

```bash
genie-react doctor --json
genie-react tools app
genie-react tools app.auth
genie-react tools app_login_as
genie-react call app_login_as '{"role":"admin"}' --json
```

Check all of the following:

- The listing has the intended `read-only`, `action`, `destructive`, and availability badges.
- Valid calls return the bounded documented shape; invalid and unknown arguments fail with field-level guidance.
- Expected failures preserve the `GenieToolError` code and hint.
- An action's result is confirmed by a follow-up query and the visible UI.
- Unmounting a route-scoped owner marks the tool unavailable and remounting revives it.
- Temporary roles, fixtures, injected failures, and overrides are restored after verification.

The custom-tool change is complete only when every modified tool passes these checks.
