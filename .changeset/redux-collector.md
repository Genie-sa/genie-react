---
'genie-react': minor
'@genie-react/cli': minor
---

New optional Redux collector. Register it with `reduxCollector(store)` from `genie-react/collectors/redux`, where the store is created, or pass `reduxStore` to `<Genie />` or `startGenie`. It supports Redux 4 and 5 and Redux Toolkit 1.9 and 2.x, with middleware and enhancers. In production builds it resolves to a stub that leaves the store untouched.

- `redux_actions` lists recorded dispatches, oldest first: type, a depth-bounded copy of the action, duration, whether it returned or threw, whether the root state kept its identity, and which top-level slices changed. A thunk is recorded too, and every action it dispatches, at once or later, names it as `parentActionId`. This covers `createAsyncThunk` and RTK Query `initiate`. Filter by type, type prefix, slice, kind or detected mutation, and page forward with `afterSequence`.
- Each action is checked for in-place mutation. `mutation.status: "detected"` lists the state paths where an object that already existed changed during the dispatch, as when a reducer pushes into `state.notes` and returns `state`. The check is bounded per action, and `scanTruncated` says when part of the state was not compared. A change made in place between dispatches is reported at the next dispatch as `mutation-outside-dispatch`.
- `redux_state` reads the state or a path in it, depth-bounded, with the same `where` selection as `query_get`.
- An `external-store` render cause from the collected store now carries `redux`: the actions that changed the state between the component's previous render and this one. Its `evidence` is `exact` only when React's render timing proves that ordering; otherwise it is `inferred` with a `reason`. The summary view shows the action types.
- A state change that reached the store without going through the wrapped `dispatch`, such as an action that middleware dispatches on its own, is recorded as `unrecorded-change` with no type. It is never graded `exact`.
- Dispatch return values, thrown errors, listener order and thunk arguments are unchanged. On a store with 3,240 entities, recording adds about 1–2.5 µs per dispatch and the mutation check about 30–40 µs more; `{ detectMutations: false }` turns the check off.

The skill's Redux recipe is now the fallback for stores the collector cannot wrap.
