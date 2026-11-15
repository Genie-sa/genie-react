'use strict'

function createRandom(seed) {
  let state = seed >>> 0
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  return {
    next,
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    pick: (items) => items[Math.floor(next() * items.length)],
    weighted: (entries) => {
      const total = entries.reduce((sum, [, weight]) => sum + weight, 0)
      let roll = next() * total
      for (const [value, weight] of entries) {
        roll -= weight
        if (roll <= 0) return value
      }
      return entries[entries.length - 1][0]
    },
    sample: (items, count) => {
      const pool = [...items]
      const chosen = []
      while (chosen.length < count && pool.length > 0) {
        chosen.push(pool.splice(Math.floor(next() * pool.length), 1)[0])
      }
      return chosen
    },
  }
}

function hashSeed(text) {
  let hash = 2166136261
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

module.exports = { createRandom, hashSeed }
