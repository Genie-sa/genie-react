---
'genie-react': patch
'@genie-react/cli': patch
---

The README's example claim `render OrderRow only props.order` failed on a correct fix whenever rows mounted during the interaction, as a virtualized table does in a short viewport, because `only` counts a first mount as a cause. The README, the bundled agent skill and the Verify a fix guide now use `render OrderRow only props.order,mount` and explain when to list `mount`. Claim semantics are unchanged.
