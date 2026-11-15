---
'genie-react': minor
'@genie-react/cli': minor
---

Render evidence no longer calls a render unnecessary when Genie cannot see its trigger. These fixes come from an audit that compared Genie's reports with renders counted by the app itself, on React 18.3 and 19:

- A `useDeferredValue` deferred pass was graded `unnecessary` and counted in `noObservedInputChange`, even though it is the render that shows the new value. It now has an `unknown` cause with reason `unclassified-hook-changed` and the hook's `hookIndex`, and `assessment.inputEvidence` is `changed`.
- A class `forceUpdate`, or any other render with no observed trigger and no rendered parent, was graded `unnecessary`. React renders a component on its own only for an input it saw change, so these renders are now `necessity: "unknown"` and stay out of `noObservedInputChange`.
- On React 19, the pending render of `useTransition` and `useActionState` was graded `unnecessary` because their pending state was not recognized. It is now an exact `state` cause on that hook.
- A component that unmounted inside the window disappeared from `react_get_renders`, its summary totals, and `react_renders_diff`. Its renders now stay counted and it reports `unmounted: true`, also in `react_renders_since`. Up to `lifecycle.bufferLimit` unmounted components are kept. Older ones are evicted, counted in `coverage.droppedUnmountFibers`, and the counts become a lower bound.
- When the render budget skipped a parent, a targeted child was graded `unnecessary` with no cause. It now names the parent that rendered.
- When a conditional `use(Context)` changed the order of Context reads, a changed Context was missing from the causes while coverage claimed to be complete. Context reads now pair by Context identity.
- `deepDiff` reported "same value, new identity" for arrays with extra properties, such as RegExp match arrays, and for objects whose non-enumerable properties differ. Those comparisons are now marked incomplete.

`renders` now documents that it counts committed renders. Strict Mode's second invocation, render attempts React discarded, and renders React bailed out of are not counted.
