import { afterEach, describe, expect, it, vi } from 'vitest'
import { setOutputFormat } from './cli-output'
import { runVerify } from './verify-command'

afterEach(() => {
  setOutputFormat('json')
  vi.restoreAllMocks()
})

describe('runVerify', () => {
  it('prints the exit status it returns for a usage failure', async () => {
    setOutputFormat('json')
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)

    const code = await runVerify('end', 'not-an-id')

    expect(code).toBe(2)
    expect(JSON.parse(stdout.mock.calls.flat().join(''))).toMatchObject({
      reason: 'invalid_input',
      exit: { code: 2, class: 'usage' },
    })
  })
})
