---
'genie-react': patch
'@genie-react/cli': patch
---

`verify begin --domains` accepted a settle domain the app does not report, such as `network` without `requestWatchCollector`, and `verify end` then refused with "did not settle within the timeout" after a few milliseconds, though no timeout ran out. `verify begin` now refuses every claim at once with `capability_unavailable` (exit 4), naming the missing domain and the collector that adds it. When a settle domain cannot be observed during the window, the refusal and the `! not-settled` caveat say Genie could not observe whether the app settled, the verdict line reads `settle not observed after <n> ms (network unsupported)`, and the fix runs `doctor --live` instead of raising the timeout.
