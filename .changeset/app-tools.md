---
'genie-react': minor
'@genie-react/cli': minor
---

Apps can expose their own agent tools. `useGenieTool` / `defineGenieTool` / `registerGenieTools` register custom actions and queries under the `app` group (optional `group` subgroups as `app.<name>`), with zod-validated args, read-only/action/destructive badges, a `tool-unavailable` error code with recovery hints when the registering component is unmounted, and a per-tool result-size cap. The CLI renders badges and availability in `tools` listings, and a group-family selector (`tools app`, `tools react`) covers subgroups.
