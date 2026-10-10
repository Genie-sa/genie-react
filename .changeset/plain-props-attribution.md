---
"genie-react": patch
"@genie-react/cli": patch
---

Attribute render causes to individual props again. Plain-object props containers are diffed by own enumerable keys without running getters, and plain-object prop values are compared one level deep, so a `memo` child that receives a fresh but equal `{...}` literal reports a reference-only prop change instead of an inferred parent render. Class-instance and other exotic props containers stay unread and still report `propsNotEnumerated`. A Proxy wrapped around an object literal cannot be detected in the browser and is enumerated; React only produces one when app code passes a Proxy straight to the JSX runtime.

`devtools_capture_compare` no longer refuses `react.commits`, `react.renders`, `react.updates`, or `react.selfTimeMs` when only render-cause attribution is incomplete. `react.unnecessary` is still gated on it. Each metric now adds `excludedCaptureIds`, which maps every post-warm-up capture that contributed no sample to the reasons it was dropped. `missingBaselineCaptureIds` and `missingCandidateCaptureIds` keep their existing shape.
