---
'genie-react': patch
---

Update bippy to 0.7.2 and adopt its new APIs.

Fiber work tags are now resolved per renderer instead of being compile-time constants, so
component classification stays correct if React renumbers its work tags again. Bippy dropped
its `bippy/react-refresh` entrypoint and a few helpers (`getNearestHostFibers`, `getTimings`,
`toUnsubscribe`); these are vendored locally with identical behavior.

Live overrides now drive the renderer that owns the target fiber (`getRenderer`) instead of
the first capable renderer, so apps with more than one injected renderer edit the right tree.

Source-map resolution now goes through bippy, which decodes inline data-URI maps directly.
This drops the `@jridgewell/sourcemap-codec` dependency and fixes source content being
mangled for non-ASCII characters, which the previous `atob`-based decoder corrupted.

Also fixes live hook overrides passing the hook index as a string rather than a number —
previously masked by JavaScript coercion inside React's `overrideHookState`.
