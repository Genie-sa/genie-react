---
'@genie-react/cli': patch
---

`invalid_args` failures now carry `details.didYouMean`, which maps each unknown key to the valid key it most likely meant: a near spelling (`compnent` → `component`), or the one missing required key when only one key was unknown (`react_inspect_component` with `component` → `id`). The rest of the failure JSON is unchanged.
