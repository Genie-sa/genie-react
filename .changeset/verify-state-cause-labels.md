---
'genie-react': patch
'@genie-react/cli': patch
---

`verify` prints state causes the way a claim names them. A claim such as `render App only state[0]` used to print back as `state.state[0]`, and the observed causes read `state.state[0]` or `state.this.state.count`; both now read `state[0]` and `this.state.count`. Claims also accept `hook[<n>]` and `this.state.<field>` without a `state.` prefix, so every printed claim re-parses.
