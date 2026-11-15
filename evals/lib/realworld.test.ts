import { execFile } from 'node:child_process'
import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { describe, expect, it } from 'vitest'

const REALWORLD_DIR = join(import.meta.dirname, '../realworld')
const RUNNER = join(REALWORLD_DIR, 'run-probes.mjs')

const suites = readdirSync(REALWORLD_DIR, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && existsSync(join(REALWORLD_DIR, entry.name, 'app.json')))
  .map((entry) => entry.name)

describe('realworld answer keys', () => {
  it('has at least one suite', () => {
    expect(suites.length).toBeGreaterThan(0)
  })

  it.each(suites)('%s reference fixes still apply to the shipped app', async (suite) => {
    const { stdout } = await promisify(execFile)(process.execPath, [RUNNER, suite, '--dry-run'])
    expect(stdout).toContain('are well formed and their reference fixes apply')
  })
})
