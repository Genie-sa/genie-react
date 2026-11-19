---
'genie-react': patch
'@genie-react/cli': patch
---

`verify` reported the URL the app connected on, not the page the browser showed. After an in-app navigation from `/orders/o-105000?tab=overview` to `/`, `verify begin` and `verify end` both printed the order URL, and the claim fingerprint that groups reruns used it too. `verify` now reads the page URL at begin and at end, so the printed URL, the fingerprint and the URL in a fix command match the page. `browser_visibility` reports that URL as `url`.
