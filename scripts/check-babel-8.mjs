#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const BABEL_VERSION = '8.1.2'
const PLUGIN_TESTS = ['packages/genie-react/src/babel/index.test.ts']

function run(command, args, options) {
  const result = spawnSync(command, args, { stdio: 'inherit', ...options })
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} exited ${result.status ?? result.signal}`)
  }
}

const babelDirectory = mkdtempSync(join(tmpdir(), `genie-babel-${BABEL_VERSION}-`))
try {
  writeFileSync(join(babelDirectory, 'package.json'), '{"private":true}\n')
  run(
    'npm',
    [
      'install',
      '--ignore-scripts',
      '--no-audit',
      '--no-fund',
      '--package-lock=false',
      `@babel/core@${BABEL_VERSION}`,
    ],
    { cwd: babelDirectory },
  )
  console.log(`\nBabel ${BABEL_VERSION}`)
  run('pnpm', ['exec', 'vitest', 'run', '-c', 'vitest.babel8.config.ts', ...PLUGIN_TESTS], {
    cwd: ROOT,
    env: { ...process.env, GENIE_BABEL_DIR: babelDirectory },
  })
} finally {
  rmSync(babelDirectory, { recursive: true, force: true })
}
