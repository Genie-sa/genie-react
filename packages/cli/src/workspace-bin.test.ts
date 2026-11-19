import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { copyFile, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

const PACKAGE_DIR = join(import.meta.dirname, '..')
const manifest = JSON.parse(readFileSync(join(PACKAGE_DIR, 'package.json'), 'utf8'))

let packageCopy: string

beforeEach(async () => {
  packageCopy = await mkdtemp(join(tmpdir(), 'genie-workspace-bin-'))
  await mkdir(join(packageCopy, 'bin'))
  await copyFile(
    join(PACKAGE_DIR, manifest.bin['genie-react']),
    join(packageCopy, manifest.bin['genie-react']),
  )
  await writeFile(join(packageCopy, 'package.json'), JSON.stringify({ type: 'module' }))
})

afterEach(async () => {
  await rm(packageCopy, { recursive: true, force: true })
})

function runBin(...args: string[]) {
  return spawnSync(process.execPath, [join(packageCopy, manifest.bin['genie-react']), ...args], {
    encoding: 'utf8',
  })
}

describe('workspace bin', () => {
  it('is a committed file, so one pnpm install links it before the first build', () => {
    expect(existsSync(join(PACKAGE_DIR, manifest.bin['genie-react']))).toBe(true)
    expect(manifest.bin['genie-react']).not.toMatch(/^\.\/dist\//)
  })

  it('publishes the built CLI as the bin, unchanged', () => {
    expect(manifest.publishConfig.bin).toEqual({ 'genie-react': './dist/cli.js' })
    expect(manifest.files).not.toContain('bin')
  })

  it('fails with the build step when the CLI is not built', () => {
    const result = runBin('status')

    expect(result.status).toBe(1)
    expect(result.stdout).toBe('')
    expect(result.stderr).toContain('Run pnpm build at the genie-react repository root')
  })

  it('runs the built CLI with the same arguments and exit code', async () => {
    await mkdir(join(packageCopy, 'dist'))
    await writeFile(
      join(packageCopy, 'dist/cli.js'),
      'process.stdout.write(JSON.stringify(process.argv.slice(2)))\nprocess.exitCode = 3\n',
    )

    const result = runBin('call', 'app_sign_in', '{"email":"a b"}')

    expect(result.status).toBe(3)
    expect(JSON.parse(result.stdout)).toEqual(['call', 'app_sign_in', '{"email":"a b"}'])
  })
})
