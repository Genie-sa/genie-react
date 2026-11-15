---
'genie-react': patch
---

Genie slows large apps less, and tool calls block the page for less time. Every tool reports the same evidence as before; only the cost changed.

- Commits in apps with more than about 5,000 mounted components no longer hit a slow path. Genie's id-to-component cache and its mount-generation history evicted entries in a way that got about 100 times slower once the tree outgrew them. On a fixture with 8,700 components, unmounting most of a long list took 57 ms of commit time with Genie and now takes 25 ms (4 ms without Genie). A full-list re-render went from 105 ms to 86 ms (35 ms without Genie).
- Component identity is now resolved once per ancestor per commit instead of once per rendered component, so wide lists cost less to analyze.
- `react_render_causes` no longer copies every render record on each call. At 34,000 components it answered in 188 ms and now answers in about 1 ms, whatever the tree size. `react_get_renders` copies only the fields that can change while a report resolves; at the same size it went from 230 ms to 34 ms.
- After `react_profile_stop`, commits cost within 10% of no Genie except unmounts, and a long session retains about 1 MB instead of 21 MB: Genie no longer walks the rendered tree of a root it has already seen. Components mounted while profiling is stopped get their ids when a tool first reads them, so their id numbers can differ from before; ids remain stable handles.
- The unmount callback checks the renderer once per commit instead of once per deleted component.

`docs/runtime-overhead.md` has the measured overhead per Genie state, tool-call costs by tree size, and memory over a long session. A new CI job runs the benchmark and fails on a clear regression.
