import { describe, expect, it } from 'vitest'
import {
  evaluateSandboxProbes,
  SIBLING_MARKER,
  sandboxProbes,
  sandboxPrompt,
} from './sandbox-check.mjs'

const probes = sandboxProbes({
  trial: '/tmp/trial',
  repoFile: '/repo/evals/tasks/a.json',
  sibling: '/tmp/genie-eval-sibling',
  url: 'http://127.0.0.1:4310/',
})

function probe(name: string) {
  const found = probes.find((candidate) => candidate.name === name)
  if (!found) throw new Error(`no probe named ${name}`)
  return found
}

const ran = (
  command: string,
  output: string,
  extra: { isError?: boolean; denied?: boolean } = {},
) => ({
  command,
  output,
  isError: extra.isError ?? false,
  denied: extra.denied ?? false,
})

describe('sandbox check', () => {
  it('lists every command in the prompt in order', () => {
    const prompt = sandboxPrompt(probes)
    probes.forEach((candidate, index) => {
      expect(prompt).toContain(`${index + 1}. ${candidate.command}`)
    })
  })

  it('links escapes from inside the trial so only the OS sandbox can stop them', () => {
    expect(probe('read sibling genie-eval dir through a link').link).toEqual({
      path: '/tmp/trial/src/sibling',
      target: '/tmp/genie-eval-sibling',
    })
    expect(probe('write vite.config.ts through a link')).toMatchObject({
      file: '/tmp/trial/vite.config.ts',
      link: { path: '/tmp/trial/src/vite-config-link', target: '/tmp/trial/vite.config.ts' },
    })
  })

  it('passes when allowed probes show their marker and blocked ones do not', () => {
    const outputs: Record<string, string> = {
      'read trial package.json': '{ "dependencies": {} }',
      'read installed genie-react': '{ "name": "genie-react" }',
      'reach agent-browser': 'http://127.0.0.1:4310/?screen=search',
    }
    const commands = probes.map((candidate) =>
      ran(candidate.command, outputs[candidate.name] ?? 'Operation not permitted', {
        isError: !(candidate.name in outputs),
      }),
    )
    const files = {
      '/tmp/trial/src/sandbox-check.txt': 'genie-eval-write-src\n',
      '/tmp/trial/vite.config.ts': 'export default {}\n',
    }
    expect(evaluateSandboxProbes(probes, commands, files).filter((result) => !result.pass)).toEqual(
      [],
    )
  })

  it('fails on a leak, a write that landed, or a command that never ran', () => {
    const link = probe('write vite.config.ts through a link')
    const results = evaluateSandboxProbes(
      probes,
      [
        ran(probe('read sibling genie-eval dir').command, SIBLING_MARKER),
        ran(probe('write vite.config.ts').command, '', { isError: true }),
        ran(link.command, ''),
      ],
      { '/tmp/trial/vite.config.ts': 'genie-eval-write-link\n' },
    )
    const byName = Object.fromEntries(results.map((result) => [result.name, result]))
    expect(byName['read sibling genie-eval dir']?.pass).toBe(false)
    expect(byName['write vite.config.ts']?.pass).toBe(true)
    expect(byName['write vite.config.ts through a link']?.pass).toBe(false)
    expect(byName['read trial package.json']).toMatchObject({
      pass: false,
      detail: 'command was not run',
    })
  })
})
