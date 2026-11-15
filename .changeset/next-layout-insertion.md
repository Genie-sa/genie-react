---
'@genie-react/cli': patch
---

`init` keeps a one-line `<body>` on one line in a Next.js root layout. The `create-next-app` layout `<body>{children}</body>` became `<body>` followed by `<GenieScript />{children}</body>` on the next line; it is now `<body><GenieScript />{children}</body>`. A body whose content starts on the next line still gets `<GenieScript />` on its own line.
