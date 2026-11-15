import { describe, expect, it } from 'vitest'
import { LruMap } from './lru-map'

/** The behaviour the old Map-based caches had: `set` moves a key to the newest position, and overflow evicts the oldest. */
class ReferenceLru {
  readonly entries: [number, string][] = []
  readonly evicted: [number, string][] = []

  constructor(private readonly limit: number) {}

  set(key: number, value: string): void {
    const index = this.entries.findIndex(([existing]) => existing === key)
    if (index >= 0) this.entries.splice(index, 1)
    this.entries.push([key, value])
    if (this.entries.length > this.limit)
      this.evicted.push(this.entries.shift() as [number, string])
  }

  delete(key: number): boolean {
    const index = this.entries.findIndex(([existing]) => existing === key)
    if (index < 0) return false
    this.entries.splice(index, 1)
    return true
  }
}

function seededRandom(seed: number): () => number {
  let state = seed
  return () => {
    state = (state * 1_103_515_245 + 12_345) % 2 ** 31
    return state / 2 ** 31
  }
}

describe('LruMap', () => {
  it('matches a reference LRU under random set, get, delete and clear sequences', () => {
    for (let seed = 1; seed <= 40; seed += 1) {
      const random = seededRandom(seed)
      const limit = 1 + Math.floor(random() * 6)
      const evicted: [number, string][] = []
      const lru = new LruMap<number, string>(limit, (key, value) => evicted.push([key, value]))
      let reference = new ReferenceLru(limit)
      let referenceEvictions: [number, string][] = []
      for (let step = 0; step < 300; step += 1) {
        const key = Math.floor(random() * 10)
        const roll = random()
        if (roll < 0.55) {
          lru.set(key, `v${step}`)
          reference.set(key, `v${step}`)
        } else if (roll < 0.75) {
          expect(lru.delete(key)).toBe(reference.delete(key))
        } else if (roll < 0.97) {
          expect(lru.get(key)).toBe(reference.entries.find(([existing]) => existing === key)?.[1])
          expect(lru.has(key)).toBe(reference.entries.some(([existing]) => existing === key))
        } else {
          lru.clear()
          referenceEvictions = [...referenceEvictions, ...reference.evicted]
          reference = new ReferenceLru(limit)
        }
        expect([...lru.keys()], `seed ${seed} step ${step}`).toEqual(
          reference.entries.map(([existing]) => existing),
        )
        expect(lru.size).toBe(reference.entries.length)
      }
      expect(evicted).toEqual([...referenceEvictions, ...reference.evicted])
    }
  })

  it('does not refresh recency on reads, so a key read often but never set is still evicted first', () => {
    const lru = new LruMap<string, number>(2)
    lru.set('read', 1)
    lru.set('written', 2)
    for (let reads = 0; reads < 5; reads += 1) lru.get('read')
    lru.set('new', 3)

    expect([...lru.keys()]).toEqual(['written', 'new'])
  })

  it('stays bounded and keeps the newest keys through churn far past its limit', () => {
    const lru = new LruMap<number, number>(5_000)
    for (let key = 0; key < 60_000; key += 1) {
      lru.set(key, key)
      if (key % 3 === 0) lru.set(key - 1, key)
    }

    expect(lru.size).toBe(5_000)
    expect(lru.has(59_999)).toBe(true)
    expect(lru.has(54_000)).toBe(false)
  })
})
