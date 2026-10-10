import { describe, expect, it } from 'vitest'
import { release, releaseAll, track } from './cleanup.mjs'

describe('cleanup registry', () => {
  it('releases once, releases everything left on shutdown, and stops later work', async () => {
    const released: string[] = []
    const releaser = (key: string) => async () => {
      released.push(key)
    }
    track('a', releaser('a'))
    track('b', releaser('b'))
    await release('a')
    await release('a')
    expect(released).toEqual(['a'])

    await releaseAll()
    expect(released).toEqual(['a', 'b'])

    expect(() => track('c', releaser('c'))).toThrow('interrupted')
    await releaseAll()
    expect(released).toEqual(['a', 'b', 'c'])
  })
})
