---
'genie-react': patch
---

Fixes from a blind agent field run:

- Component names resolve through `memo()`/`forwardRef` wrappers: react-refresh's `_c`/`_c2` placeholder names no longer mask a wrapper's `displayName` or the inner function's real name, so renders/errors/find report the component you named — previously, memoizing an arrow component made it drop out of `react_find_components` and show as `_c` in reports, exactly when verifying the memoization fix mattered most.
- The react tools accept `component`/`query`/`name` interchangeably for their component-name argument (remapped before validation only when unambiguous, so unknown-key rejection still guards everything else).
