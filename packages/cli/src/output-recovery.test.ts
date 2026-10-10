import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  symlinkSync,
  utimesSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { agentTokenDirectory, writeAgentToken } from 'genie-react/hub'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { overflowSuggestions, recoverOverflow, spillDirectory } from './output-recovery'
import { genieCommand } from './package-manager'
import type { Overflow } from './result-selection'

const posix = process.platform !== 'win32'

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

const prefix = genieCommand(['call', 'react_get_renders']).argv

describe('overflow suggestions', () => {
  it('suggests the summary view, a fitting limit, a selectable branch, one item and a raised cap', () => {
    expect(
      overflowSuggestions(overflow, invocation, 100_000).map(({ reason, argv }) => ({
        reason,
        argv: argv.slice(prefix.length),
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
        reason: 'Read only the largest selectable branch (largestPaths[1]).',
        argv: ['{"limit":200,"view":"full"}', '--session', 'agent-a', '--select', '/coverage'],
      },
      {
        reason: 'Inspect the first item of the largest array (largestPaths[0]).',
        argv: ['{"limit":200,"view":"full"}', '--session', 'agent-a', '--select', '/components/0'],
      },
      {
        reason: 'Accept the complete result on stdout.',
        argv: ['{"limit":200,"view":"full"}', '--session', 'agent-a', '--max-bytes', '400000'],
      },
    ])
    expect(overflowSuggestions(overflow, invocation, 100_000)[0]?.command).toBe(
      `${genieCommand([]).command} call react_get_renders '{"limit":200,"view":"summary"}' --session agent-a`,
    )
  })

  it('keeps a caller selection instead of proposing paths inside its envelope', () => {
    const suggestions = overflowSuggestions(
      overflow,
      { command: ['tools', 'react_get_renders'], flags: [], select: '/output' },
      100_000,
    )
    expect(suggestions.map(({ argv }) => argv)).toEqual([
      genieCommand(['tools', 'react_get_renders', '--select', '/output', '--max-bytes', '400000'])
        .argv,
    ])
  })

  it('keeps app-derived keys out of reasons, shell-quotes them, and skips overlong paths', () => {
    const hostile = "/data/x'; rm -rf ~; echo '"
    const suggestions = overflowSuggestions(
      {
        ...overflow,
        largestPaths: [
          { path: `/${'k'.repeat(201)}`, bytes: 390_000, items: 3 },
          { path: hostile, bytes: 5_000, items: 2 },
        ],
      },
      { command: ['call', 'query_list'], flags: [] },
      100_000,
    )
    expect(suggestions.map(({ reason }) => reason)).toEqual([
      'Read only the largest selectable branch (largestPaths[1]).',
      'Accept the complete result on stdout.',
    ])
    expect(suggestions[0]?.argv.at(-1)).toBe(hostile)
    expect(suggestions[0]?.command).toBe(
      `${genieCommand([]).command} call query_list --select '/data/x'\\''; rm -rf ~; echo '\\'''`,
    )
  })

  it('keeps an explicit --max-bytes in every retry except the one that raises it', () => {
    const suggestions = overflowSuggestions(overflow, { ...invocation, maxBytes: 20_000 }, 20_000)
    expect(suggestions.map(({ argv }) => argv.slice(argv.indexOf('--max-bytes')))).toEqual([
      ['--max-bytes', '20000'],
      ['--max-bytes', '20000'],
      ['--max-bytes', '20000'],
      ['--max-bytes', '20000'],
      ['--max-bytes', '400000'],
    ])
  })
})

describe('overflow spill', () => {
  let runtime: string
  let project: string

  beforeEach(() => {
    runtime = mkdtempSync(join(tmpdir(), 'genie-spill-runtime-'))
    project = mkdtempSync(join(tmpdir(), 'genie-spill-project-'))
    vi.stubEnv('XDG_RUNTIME_DIR', runtime)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    rmSync(runtime, { recursive: true, force: true })
    rmSync(project, { recursive: true, force: true })
  })

  const spill = (label = 'call') =>
    recoverOverflow(overflow, invocation, { label, maxBytes: 100_000 }).outputPath

  it('writes the complete result to a private per-user directory outside the project', () => {
    const outputPath = spill('call react_get_renders/../x')
    const directory = spillDirectory()

    expect(directory).toBe(join(runtime, `genie-react-${process.getuid?.() ?? 'user'}`, 'out'))
    expect(outputPath?.startsWith(`${directory}/call-react_get_renders-..-x-`)).toBe(true)
    expect(readFileSync(outputPath ?? '', 'utf8')).toBe(`${overflow.serialized}\n`)
    if (posix) {
      expect(statSync(dirname(directory)).mode & 0o777).toBe(0o700)
      expect(statSync(directory).mode & 0o777).toBe(0o700)
      expect(statSync(outputPath ?? '').mode & 0o777).toBe(0o600)
    }
  })

  it('prunes only old regular spill files and leaves other files and symlinks alone', () => {
    const directory = dirname(spill() ?? '')
    const victim = join(project, 'victim.json')
    writeFileSync(victim, '{}')
    const spared = ['notes.json', 'package.json', 'linked-0000000000000-1.json']
    writeFileSync(join(directory, 'notes.json'), '{}')
    writeFileSync(join(directory, 'package.json'), '{}')
    symlinkSync(victim, join(directory, 'linked-0000000000000-1.json'))
    for (let index = 0; index < 25; index += 1) {
      const stale = join(directory, `stale-${String(index).padStart(13, '0')}-1.json`)
      writeFileSync(stale, '{}')
      utimesSync(stale, new Date(0), new Date(index * 1_000))
    }

    const latest = spill()
    const retained = readdirSync(directory)
    expect(retained.filter((name) => !spared.includes(name))).toHaveLength(20)
    expect(retained).toEqual(expect.arrayContaining(spared))
    expect(retained).not.toContain('stale-0000000000000-1.json')
    expect(retained).toContain(latest?.split('/').at(-1))
    expect(existsSync(victim)).toBe(true)
  })

  it.runIf(posix)('refuses a symlinked output directory and tightens a loosened one', () => {
    const base = join(runtime, `genie-react-${process.getuid?.()}`)
    mkdirSync(base, { mode: 0o700 })
    symlinkSync(project, join(base, 'out'))
    writeFileSync(join(project, 'keep-0000000000000-1.json'), '{}')
    expect(spill()).toBeUndefined()
    expect(readdirSync(project)).toEqual(['keep-0000000000000-1.json'])

    rmSync(join(base, 'out'))
    mkdirSync(join(base, 'out'), { mode: 0o700 })
    chmodSync(join(base, 'out'), 0o755)
    expect(spill()).toBeDefined()
    expect(statSync(join(base, 'out')).mode & 0o777).toBe(0o700)
  })

  it.runIf(posix)('refuses a symlinked per-user directory', () => {
    symlinkSync(project, join(runtime, `genie-react-${process.getuid?.()}`))
    expect(spill()).toBeUndefined()
    expect(readdirSync(project)).toEqual([])
  })

  it('shares the per-user directory with the agent token store in either creation order', async () => {
    expect(dirname(spillDirectory())).toBe(agentTokenDirectory())

    expect(spill()).toBeDefined()
    expect(dirname(await writeAgentToken(project, 'secret'))).toBe(agentTokenDirectory())

    rmSync(agentTokenDirectory(), { recursive: true })
    await writeAgentToken(project, 'secret')
    expect(spill()).toBeDefined()
    if (posix) expect(statSync(agentTokenDirectory()).mode & 0o777).toBe(0o700)
  })
})
