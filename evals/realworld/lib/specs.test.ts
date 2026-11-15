import { access } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { applyEdits, loadSpecs, readEditedSources, validateSpec } from './specs.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../..')
const DASHBOARD_APP = join(ROOT, 'apps/realworld-dashboard')
const DASHBOARD_CATALOGUE = join(ROOT, 'evals/realworld/dashboard')

const validBug = {
  id: 'sample-bug',
  kind: 'bug',
  category: 'fix',
  symptom: 'The list never shows the new item after saving.',
  truth: { components: ['List'], files: ['src/list.tsx'], cause: 'wrong key' },
  referenceFix: [{ file: 'src/list.tsx', find: 'a', replace: 'b' }],
  probe: { script: 'probes/sample.mjs', genie: 'observable', evidence: ['query_get'] },
}

describe('validateSpec', () => {
  it('accepts a complete bug spec', () => {
    expect(validateSpec(validBug, 'sample-bug.json')).toEqual([])
  })

  it('requires the id to match the file name', () => {
    expect(validateSpec(validBug, 'other.json')).toEqual([
      'other.json: id sample-bug must match the file name',
    ])
  })

  it('requires a blocked probe to explain the missing evidence', () => {
    const blocked = { ...validBug, probe: { ...validBug.probe, genie: 'blocked' } }
    expect(validateSpec(blocked, 'sample-bug.json')).toEqual([
      'sample-bug.json: a blocked probe must explain the missing evidence in blockedReason',
    ])
  })

  it('rejects a decoy that carries a fix or no expectation', () => {
    const decoy = { ...validBug, id: 'sample-decoy', kind: 'decoy' }
    expect(validateSpec(decoy, 'sample-decoy.json')).toEqual([
      'sample-decoy.json: a decoy is correct code and has no referenceFix',
      'sample-decoy.json: a decoy needs expectation "not-flagged" or "known-false-positive"',
    ])
  })

  it('requires a known false positive to cite its finding', () => {
    const { referenceFix: _fix, ...rest } = validBug
    const decoy = {
      ...rest,
      id: 'sample-decoy',
      kind: 'decoy',
      expectation: 'known-false-positive',
    }
    expect(validateSpec(decoy, 'sample-decoy.json')).toEqual([
      'sample-decoy.json: a known false positive must cite its finding',
    ])
  })
})

describe('applyEdits', () => {
  it('replaces the single occurrence of each find text in order', () => {
    const sources = new Map([['a.ts', 'const value = 1\n']])
    applyEdits(sources, [
      { file: 'a.ts', find: 'value = 1', replace: 'value = 2' },
      { file: 'a.ts', find: 'const value', replace: 'let value' },
    ])
    expect(sources.get('a.ts')).toBe('let value = 2\n')
  })

  it('fails when the find text is missing or ambiguous', () => {
    expect(() =>
      applyEdits(new Map([['a.ts', 'x']]), [{ file: 'a.ts', find: 'y', replace: 'z' }]),
    ).toThrow(/not found/)
    expect(() =>
      applyEdits(new Map([['a.ts', 'x x']]), [{ file: 'a.ts', find: 'x', replace: 'z' }]),
    ).toThrow(/ambiguous/)
    expect(() => applyEdits(new Map(), [{ file: 'a.ts', find: 'x', replace: 'z' }])).toThrow(
      /missing file/,
    )
  })
})

describe('dashboard catalogue', () => {
  it('ships 12 to 15 bugs and at least five decoys spread across verify, fix and optimise', async () => {
    const specs = await loadSpecs(DASHBOARD_CATALOGUE)
    const bugs = specs.filter((spec) => spec.kind === 'bug')
    expect(bugs.length).toBeGreaterThanOrEqual(12)
    expect(bugs.length).toBeLessThanOrEqual(15)
    expect(specs.filter((spec) => spec.kind === 'decoy').length).toBeGreaterThanOrEqual(5)
    expect(new Set(bugs.map((spec) => spec.category))).toEqual(
      new Set(['verify', 'fix', 'optimise']),
    )
  })

  it('applies every reference fix to the current app sources and has every probe script', async () => {
    for (const spec of await loadSpecs(DASHBOARD_CATALOGUE)) {
      await expect(
        readEditedSources(DASHBOARD_APP, spec.referenceFix ?? []),
        spec.id,
      ).resolves.toBeInstanceOf(Map)
      await expect(
        access(join(DASHBOARD_CATALOGUE, spec.probe.script)),
        spec.id,
      ).resolves.toBeUndefined()
    }
  })

  it('names truth files that exist in the app', async () => {
    for (const spec of await loadSpecs(DASHBOARD_CATALOGUE)) {
      for (const file of spec.truth.files) {
        await expect(
          access(join(DASHBOARD_APP, file)),
          `${spec.id}: ${file}`,
        ).resolves.toBeUndefined()
      }
    }
  })
})
