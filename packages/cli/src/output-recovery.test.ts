import { mkdtempSync, readdirSync, readFileSync, rmSync, utimesSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { overflowSuggestions, recoverOverflow, SPILL_DIRECTORY } from './output-recovery'
import type { Overflow } from './result-selection'

const overflow: Overflow = {
  serialized: '{"components":[]}',
  originalBytes: 400_000,
  largestPaths: [
    { path: '/components', bytes: 390_000, items: 200 },
    { path: '/coverage', bytes: 5_000 },
    { path: '/summary', bytes: 300 },
  ],
}

const invocation = {
  command: ['call', 'react_get_renders'],
  args: { limit: 200, view: 'full' },
  flags: ['--session', 'agent-a'],
}

describe('overflow suggestions', () => {
  it('suggests the summary view, a fitting limit, a selectable branch, one item and a raised cap', () => {
    expect(
      overflowSuggestions(overflow, invocation, 100_000).map(({ reason, argv }) => ({
        reason,
        argv: argv.slice(3),
      })),
    ).toEqual([
      {
        reason: 'Request the bounded summary view.',
        argv: ['{"limit":200,"view":"summary"}', '--session', 'agent-a'],
      },
      {
        reason: 'Request at most 40 records.',
        argv: ['{"limit":40,"view":"full"}', '--session', 'agent-a'],
      },
      {
        reason: 'Read only /coverage (5000 bytes).',
        argv: ['{"limit":200,"view":"full"}', '--session', 'agent-a', '--select', '/coverage'],
      },
      {
        reason: 'Inspect one item of /components.',
        argv: ['{"limit":200,"view":"full"}', '--session', 'agent-a', '--select', '/components/0'],
      },
      {
        reason: 'Accept the complete result on stdout.',
        argv: ['{"limit":200,"view":"full"}', '--session', 'agent-a', '--max-bytes', '400000'],
      },
    ])
    expect(overflowSuggestions(overflow, invocation, 100_000)[0]?.command).toBe(
      `genie-react call react_get_renders '{"limit":200,"view":"summary"}' --session agent-a`,
    )
  })

  it('keeps a caller selection instead of proposing paths inside its envelope', () => {
    const suggestions = overflowSuggestions(
      overflow,
      { command: ['tools', 'react_get_renders'], flags: [], select: '/output' },
      100_000,
    )
    expect(suggestions.map(({ argv }) => argv)).toEqual([
      ['genie-react', 'tools', 'react_get_renders', '--select', '/output', '--max-bytes', '400000'],
    ])
  })
})

describe('overflow spill', () => {
  let cwd: string | undefined

  afterEach(() => {
    if (cwd) rmSync(cwd, { recursive: true, force: true })
  })

  it('writes the complete result privately and keeps only the newest spills', () => {
    cwd = mkdtempSync(join(tmpdir(), 'genie-spill-'))
    const directory = join(cwd, SPILL_DIRECTORY)
    const recovery = recoverOverflow(overflow, invocation, {
      cwd,
      label: 'call react_get_renders/../x',
      maxBytes: 100_000,
    })
    expect(recovery.outputPath?.startsWith(`${directory}/call-react_get_renders-..-x-`)).toBe(true)
    expect(readFileSync(recovery.outputPath ?? '', 'utf8')).toBe(`${overflow.serialized}\n`)

    for (let index = 0; index < 25; index += 1) {
      const stale = join(directory, `stale-${index}.json`)
      writeFileSync(stale, '{}')
      utimesSync(stale, new Date(0), new Date(index * 1_000))
    }
    recoverOverflow(overflow, invocation, { cwd, label: 'call', maxBytes: 100_000 })
    const retained = readdirSync(directory)
    expect(retained).toHaveLength(20)
    expect(retained).not.toContain('stale-0.json')
    expect(retained).toContain(recovery.outputPath?.split('/').at(-1))
  })
})
