---
'genie-react': patch
'@genie-react/cli': patch
---

A window now records `setState` and `forceUpdate` calls on a class component that rendered only before the window opened. Since analysis became observed-only, such a class was never instrumented, so its first updates in a window went unrecorded and a check for an unwanted `componentDidUpdate` reset could pass on missing evidence.
