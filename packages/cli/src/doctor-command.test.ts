import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, expect, it, vi } from 'vitest'
import { runDoctorCommand } from './doctor-command'

let cwd: string | null = null

afterEach(async () => {
  vi.restoreAllMocks()
  if (cwd) await rm(cwd, { recursive: true, force: true })
  cwd = null
})

it('reports a --select that matches nothing as invalid input, not an operational failure', async () => {
  cwd = await mkdtemp(join(tmpdir(), 'genie-doctor-command-'))
  const stdout = vi.spyOn(process.stdout, 'write').mockReturnValue(true)

  expect(await runDoctorCommand({ cwd, live: false, select: '/nope' })).toBe(1)
  expect(JSON.parse(String(stdout.mock.calls[0]?.[0]))).toMatchObject({
    reason: 'invalid_input',
    userActionRequired: true,
    details: { selection: { expression: '/nope' } },
  })
})
