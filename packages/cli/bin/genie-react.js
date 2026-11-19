#!/usr/bin/env node
// pnpm links a workspace bin only if its target exists at install time, and dist/ exists only after a build, so the workspace bin is this committed file. The published package's bin is dist/cli.js (publishConfig.bin).
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const cli = new URL('../dist/cli.js', import.meta.url)

if (existsSync(cli)) {
  await import(cli.href)
} else {
  process.stderr.write(
    `genie-react: ${fileURLToPath(cli)} is missing. Run pnpm build at the genie-react repository root, then retry.\n`,
  )
  process.exitCode = 1
}
