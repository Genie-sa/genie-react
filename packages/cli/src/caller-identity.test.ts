import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { resolveCallerIdentity } from './caller-identity'
import { BridgeConfigError } from './discovery'

describe('resolveCallerIdentity', () => {
  let root: string

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'genie-caller-'))
  })

  afterEach(() => {
    rmSync(root, { recursive: true, force: true })
  })

  const checkout = (name: string, linked = false) => {
    const directory = join(root, name)
    mkdirSync(join(directory, 'src'), { recursive: true })
    if (linked) writeFileSync(join(directory, '.git'), 'gitdir: elsewhere\n')
    else mkdirSync(join(directory, '.git'))
    return directory
  }

  it('prefers GENIE_AGENT over a harness session and the worktree', () => {
    const main = checkout('main')
    expect(
      resolveCallerIdentity(main, { GENIE_AGENT: 'reviewer-2', CLAUDE_CODE_SESSION_ID: 'abc' }),
    ).toEqual({ id: 'agent:reviewer-2', source: 'env' })
  })

  it('rejects a GENIE_AGENT value that is not a plain name', () => {
    expect(() => resolveCallerIdentity(root, { GENIE_AGENT: 'two words' })).toThrow(
      BridgeConfigError,
    )
  })

  it('gives each harness session its own identity and never exposes the raw session ID', () => {
    const first = resolveCallerIdentity(root, { CLAUDE_CODE_SESSION_ID: 'session-one' })
    const second = resolveCallerIdentity(root, { CLAUDE_CODE_SESSION_ID: 'session-two' })
    const codex = resolveCallerIdentity(root, { CODEX_THREAD_ID: 'session-one' })
    expect(first.source).toBe('claude-code')
    expect(new Set([first.id, second.id, codex.id]).size).toBe(3)
    expect(first.id).not.toContain('session-one')
  })

  it('derives the same identity anywhere in one worktree and a different one in another worktree', () => {
    const main = checkout('main')
    const linked = checkout('feature', true)
    const fromRoot = resolveCallerIdentity(main, {})
    expect(fromRoot.source).toBe('worktree')
    expect(resolveCallerIdentity(join(main, 'src'), {})).toEqual(fromRoot)
    expect(resolveCallerIdentity(join(linked, 'src'), {}).id).not.toBe(fromRoot.id)
  })

  it('sends no identity outside any checkout when nothing else identifies the caller', () => {
    expect(resolveCallerIdentity(root, {})).toEqual({})
  })
})
