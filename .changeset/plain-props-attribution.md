---
"genie-react": patch
"@genie-react/cli": patch
---

Attribute render causes to individual props again. Plain-object props containers are diffed by own enumerable keys without running getters, and plain-object prop values are compared one level deep, so a `memo` child that receives a fresh but equal `{...}` literal reports a reference-only prop change. Class-instance and other exotic props containers stay unread and still report `propsNotEnumerated`. Objects with symbol keys and React elements passed as props are never called reference-only, and a prop that only appears or disappears now reports an `added` or `removed` change.

Prop changes are the render cause only for components that can skip a render on equal props: `memo` components and classes that extend `PureComponent` or define `shouldComponentUpdate`. Other components keep `parent` as their first cause and list changed props as observed inputs, and reference-only prop changes never mark a render `necessary`. `referenceOnlyPropRenders` now counts only those components and excludes truncated diffs. Two new per-component counts cover the rest: `functionIdentityPropRenders` (only function props changed identity, usually inline callbacks) and `undeterminedReferencePropRenders` (a truncated diff could not classify the change).

In development, Genie's hook now wraps the global `Proxy` constructor and `Proxy.revocable` to record every proxy created after it loads, and never reads the keys of a recorded proxy in props or prop values. The wrapper keeps the constructor's name, length, missing prototype, and errors, installs once per page, and never installs in production builds. A Proxy created before Genie's hook loaded cannot be detected and is still enumerated.

Render-input attribution now draws on its own per-commit and per-component budget. A wide commit that exhausts it reports truncated input coverage instead of skipping render recording.

`react.unnecessary` and the `unnecessary` counts rise after upgrading. Fresh props containers with no changed keys used to report `propsNotEnumerated`, which hid those renders; they are now computable.

`devtools_capture_compare` no longer refuses `react.commits`, `react.renders`, `react.updates`, or `react.selfTimeMs` when only render-cause attribution is incomplete. `react.unnecessary` is still gated on it. Each metric now adds `excludedCaptureIds`, which maps every post-warm-up capture that contributed no sample to the reasons it was dropped. `missingBaselineCaptureIds` and `missingCandidateCaptureIds` keep their existing shape.
