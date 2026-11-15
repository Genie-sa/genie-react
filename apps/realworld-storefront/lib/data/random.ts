export type Random = () => number

export function createRandom(seed: number): Random {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let mixed = Math.imul(state ^ (state >>> 15), 1 | state)
    mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4_294_967_296
  }
}

export function integerBetween(random: Random, min: number, max: number): number {
  return min + Math.floor(random() * (max - min + 1))
}

export function pickOne<T>(random: Random, items: readonly T[]): T {
  return items[Math.floor(random() * items.length)] as T
}

export function pickSome<T>(random: Random, items: readonly T[], count: number): T[] {
  const pool = [...items]
  const picked: T[] = []
  while (picked.length < count && pool.length > 0) {
    picked.push(pool.splice(Math.floor(random() * pool.length), 1)[0] as T)
  }
  return picked
}

export function hashString(value: string): number {
  let hash = 2_166_136_261
  for (let index = 0; index < value.length; index += 1) {
    hash = Math.imul(hash ^ value.charCodeAt(index), 16_777_619)
  }
  return hash >>> 0
}
