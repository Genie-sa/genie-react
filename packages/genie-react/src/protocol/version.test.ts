import { describe, expect, it } from 'vitest'
import { GENIE_REACT_VERSION, releaseLine, sameReleaseLine } from './version'

describe('release lines', () => {
  it('injects the package version into builds and tests', async () => {
    const { readFile } = await import('node:fs/promises')
    const manifest = JSON.parse(
      await readFile(new URL('../../package.json', import.meta.url), 'utf8'),
    )
    expect(GENIE_REACT_VERSION).toBe(manifest.version)
  })

  it.each([
    ['0.19.0', '0.19.4', true],
    ['0.19.0', '0.19.1-next.2', true],
    ['0.19.0', '0.17.3', false],
    ['1.2.0', '0.2.0', false],
    ['0.19.0', 'unknown', false],
    ['', '', false],
  ])('treats %s and %s as the same line: %s', (left, right, expected) => {
    expect(sameReleaseLine(left, right)).toBe(expected)
  })

  it('rejects malformed versions', () => {
    expect(releaseLine('0.19')).toBeNull()
    expect(releaseLine('v0.19.0')).toBeNull()
  })
})
