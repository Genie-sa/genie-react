---
'genie-react': patch
'@genie-react/cli': patch
---

A bundled client that listed its collectors by hand, as the install guide showed, left out `requestWatchCollector` and `visibilityCollector`, so `verify` could not wait for the app's requests and reported the URL the app connected on instead of the current page. `genie-react/collectors` now exports `defaultAppCollectors({ queryClient, router, reduxStore })`, the same list `<Genie />` registers, and the install guide spreads it into `createGenieClient`, so a hand-built client picks up new default collectors when it upgrades.
