---
"genie-react": minor
---

Add an on-demand interaction timeline combining completed browser requests, Query cache updates, React root commits, and TanStack Router navigation. Recording uses bounded retention and one monotonic clock, releases listeners when stopped, and reports coverage gaps and temporal-only correlation through timeline_start, timeline_read, and timeline_stop.
