---
"genie-react": patch
"@genie-react/cli": patch
---

A component's first render in a render window now gets an `exact` Redux link when React had no pending work as the window opened. Before, a component that a sibling's update had skipped since its last render got `inferred` with `previous-render-unavailable`, and its candidate actions included dispatches from before the window, such as page-load fetches. An `inferred` link no longer lists actions from before the window.
