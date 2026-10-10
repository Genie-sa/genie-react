import { constants, existsSync } from 'node:fs'
import { access, mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { makeReadOnly, removeWorkspace } from './workspace.mjs'

describe('makeReadOnly', () => {
  it('locks the tree and still lets removeWorkspace delete it', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'genie-eval-test-'))
    await mkdir(join(dir, 'node_modules/pkg'), { recursive: true })
    await writeFile(join(dir, 'node_modules/pkg/index.js'), '')

    await makeReadOnly(dir)
    await expect(access(join(dir, 'node_modules/pkg'), constants.W_OK)).rejects.toThrow()

    await removeWorkspace(dir)
    expect(existsSync(dir)).toBe(false)
  })
})
