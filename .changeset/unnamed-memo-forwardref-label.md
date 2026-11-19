---
"genie-react": patch
"@genie-react/cli": patch
---

Render reads listed TanStack Router `Link` elements, and other `memo(forwardRef(...))` components whose inner function has no name, under the file name of the JSX that rendered them (`sidebar-nav.tsx`) with unknown ownership, so `appOnly:true` kept them. Genie now classifies such a wrapper by the component it wraps, so a library one is hidden, and names a component that has no runtime name after the JSX tag at its call site, such as `Link`.
