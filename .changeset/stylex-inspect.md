---
"genie-react": minor
"@genie-react/cli": minor
---

Add `stylex_inspect`: for apps styled with StyleX in dev mode (`debug: true`), report the applied `stylex.create()` objects by name and source file:line in override order, the CSS each atomic class resolves to (with pseudo/media conditions), `defineVars` tokens with current values, and dynamic style values — by CSS selector or component id. `react_dom_for_component` and `react_component_for_dom` gain a `styleSources` breadcrumb, and DOM selectors skip compiler-generated class names.
