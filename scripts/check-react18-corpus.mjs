#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const REACT_VERSIONS = ['18.0.0', '18.3.1']
const CORPORA = [
  'packages/genie-react/src/collectors/react/effect-corpus.test.ts',
  'packages/genie-react/src/collectors/react/error-corpus.test.ts',
  'packages/genie-react/src/collectors/react/refresh-corpus.test.ts',
  'packages/genie-react/src/collectors/react/render-necessity-corpus.test.ts',
  'packages/genie-react/src/collectors/react/render-wrapper-corpus.test.ts',
  'packages/genie-react/src/collectors/redux/redux-render-join.test.ts',
]

function run(command, args, options) {
  const result = spawnSync(command, args, { stdio: 'inherit', ...options })
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} exited ${result.status ?? result.signal}`)
  }
}

for (const version of REACT_VERSIONS) {
  const reactDirectory = mkdtempSync(join(tmpdir(), `genie-react-${version}-`))
  const runtimeDirectory = mkdtempSync(join(tmpdir(), 'genie-react18-vitest-'))
  try {
    writeFileSync(join(reactDirectory, 'package.json'), '{"private":true}\n')
    run(
      'npm',
      [
        'install',
        '--ignore-scripts',
        '--no-audit',
        '--no-fund',
        '--package-lock=false',
        `react@${version}`,
        `react-dom@${version}`,
        'react-redux@8.1.3',
        'react-redux-9@npm:react-redux@9.3.1',
      ],
      { cwd: reactDirectory },
    )
    console.log(`\nReact ${version}`)
    run('pnpm', ['exec', 'vitest', 'run', '-c', 'vitest.react18.config.ts', ...CORPORA], {
      cwd: ROOT,
      env: { ...process.env, GENIE_REACT_DIR: reactDirectory, TMPDIR: runtimeDirectory },
    })
  } finally {
    rmSync(reactDirectory, { recursive: true, force: true })
    rmSync(runtimeDirectory, { recursive: true, force: true })
  }
}
