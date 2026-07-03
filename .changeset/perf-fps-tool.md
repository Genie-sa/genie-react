---
'genie-react': minor
'@genie-react/cli': minor
---

New `browser_fps` tool (perf collector): sample the page frame rate on demand via requestAnimationFrame — avg fps, frames dropped against the estimated display refresh rate (fair on 120Hz panels), long frames (>50ms), the single worst stall, and a smooth/degraded/janky verdict using react-scan's thresholds as refresh-rate ratios plus its 150ms hard-stall rule. Registered by `<Genie />` and the script-tag client; the CLI prints a one-line summary. Also bumps bippy to ^0.5.43 (a republish of 0.5.42 — no API changes).
