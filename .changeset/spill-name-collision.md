---
'@genie-react/cli': patch
---

Every oversized result now keeps its own file. Two results one CLI process spilled in the same millisecond, such as several oversized records in one `batch`, shared a file name, so the second lost its `outputPath`.
