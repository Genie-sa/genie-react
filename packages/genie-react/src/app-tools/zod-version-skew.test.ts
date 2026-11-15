import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { expect, it } from 'vitest'

const require = createRequire(import.meta.url)
const FIXTURE = fileURLToPath(new URL('../../test/zod-version-skew', import.meta.url))
// The fixture needs about 150 MB; before the fix the same check exhausted 4 GB.
const HEAP_LIMIT_MB = 1024

function versionOf(name: string): string {
  return JSON.parse(readFileSync(require.resolve(`${name}/package.json`), 'utf8')).version
}

it('type-checks app tools whose schemas come from a different zod 4 copy than genie-react', () => {
  expect(versionOf('zod-version-skew')).not.toBe(versionOf('zod'))

  const result = spawnSync(
    process.execPath,
    [
      `--max-old-space-size=${HEAP_LIMIT_MB}`,
      require.resolve('typescript/bin/tsc'),
      '-p',
      FIXTURE,
      '--pretty',
      'false',
    ],
    { encoding: 'utf8', timeout: 60_000 },
  )

  const output = `${result.stdout}${result.stderr}`.split('\n').slice(0, 8).join('\n').trim()
  expect({ status: result.status, signal: result.signal, output }).toEqual({
    status: 0,
    signal: null,
    output: '',
  })
}, 90_000)
