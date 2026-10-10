import { beforeEach, describe, expect, it, vi } from 'vitest'

type Cleanup = typeof import('./cleanup.mjs')
let cleanup: Cleanup

beforeEach(async () => {
  vi.resetModules()
  cleanup = await import('./cleanup.mjs')
})

const recorder = () => {
  const released: string[] = []
  const releaser = (key: string) => async () => {
    released.push(key)
  }
  return { released, releaser }
}

describe('cleanup registry', () => {
  it('releases a resource once and forgets it', async () => {
    const { released, releaser } = recorder()
    cleanup.track('a', releaser('a'))
    await cleanup.release('a')
    await cleanup.release('a')
    expect(released).toEqual(['a'])
    expect(cleanup.interrupted()).toBe(false)
  })

  it('releases everything left on shutdown and stops later work', async () => {
    const { released, releaser } = recorder()
    cleanup.track('a', releaser('a'))
    cleanup.track('b', releaser('b'))
    await cleanup.releaseAll()
    expect(released).toEqual(['a', 'b'])
    expect(cleanup.interrupted()).toBe(true)

    expect(() => cleanup.track('c', releaser('c'))).toThrow('interrupted')
    await cleanup.releaseAll()
    expect(released).toEqual(['a', 'b', 'c'])
  })
})
