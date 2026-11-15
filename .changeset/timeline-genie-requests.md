---
'genie-react': patch
---

The timeline request lane no longer shows Genie's own requests. Genie fetches app source files (`/src/TaskPanel.tsx`, `App.tsx?raw`), source maps and symbolication results to locate components, and those used to appear beside the app's traffic, which skewed "is the delay a request or rendering" answers. They are now left out, and timeline reports count them in `genieRequestsExcluded`. The app's own requests to the same URLs, including its own `?raw` fetches, are still recorded.
