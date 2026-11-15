---
'genie-react': minor
---

New `react_suspense` tool reports what a screen is waiting on. It lists every Suspense boundary with its state (`fallback`, `transition-pending` when a transition keeps the old UI on screen, `dehydrated`, or `content`), its parent boundary and source, and the blockers React recorded for it: the `use()` promise, `React.lazy` component, server I/O, RSC stream, or stylesheet, with name, timing, the awaiting component, and stacks. Each blocker carries a `kind` with an `exact`, `inferred`, or `unknown` evidence grade; a promise thrown without `use()` stays `unknown`. Boundaries that already show their content list what that content awaited and for how long, so a before/after run shows whether a fix shortened the wait.

`capability` states what the running React can provide: React 19.2 and later development builds name blockers fully, React 19.0 and 19.1 recognize `use()` and `lazy` without names or timings, and React 18 or production builds list boundaries and states with blockers marked `unavailable`.
