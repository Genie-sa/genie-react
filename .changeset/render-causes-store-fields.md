---
'genie-react': patch
'@genie-react/cli': patch
---

The default `react_render_causes` view named an external store cause only by its store label, such as `anonymous-external-store`, and only `view:"full"` said which field changed. The default view now lists up to 10 `changedFields` on an `external-store` cause, so `selectedOrderIds` shows without the full view.
