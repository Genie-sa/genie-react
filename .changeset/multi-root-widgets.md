---
'genie-react': patch
'@genie-react/cli': patch
---

Find and read components when a widget bundles its own React (Clerk, for example). The app root stays primary even when a widget's root renders a bigger tree. `react_find_components` and `react_provenance` search every live root. `react_get_tree` lists the other roots in `otherRoots` so their trees can be read by `rootId`. Overriding a component rendered by a production React copy now fails with a clear error instead of crashing inside the app's renderer. bippy moves to `0.7.3-dev.2c148fc` for its unreleased bundler path and source map fixes, runtime hook hardening, and multi-root identity fixes. Tests now run on React 19.3.
