interface LruEntry<K, V> {
  key: K
  value: V
  older: LruEntry<K, V> | null
  newer: LruEntry<K, V> | null
}

/** A bounded map that evicts its least recently set key in O(1). Evicting a plain Map's first key is not O(1): V8 keeps deleted entries as holes until it rehashes, and `keys().next()` walks every hole, so churn past the bound made each insertion scan thousands of slots. */
export class LruMap<K, V> {
  private readonly entries = new Map<K, LruEntry<K, V>>()
  private oldest: LruEntry<K, V> | null = null
  private newest: LruEntry<K, V> | null = null

  constructor(
    private readonly limit: number,
    private readonly onEvict?: (key: K, value: V) => void,
  ) {}

  get size(): number {
    return this.entries.size
  }

  /** Reading does not refresh recency; only `set` does. */
  get(key: K): V | undefined {
    return this.entries.get(key)?.value
  }

  has(key: K): boolean {
    return this.entries.has(key)
  }

  /** Store `value` as the most recent entry, then evict the least recent one when the map exceeds its limit. */
  set(key: K, value: V): void {
    const existing = this.entries.get(key)
    if (existing) {
      existing.value = value
      this.unlink(existing)
      this.append(existing)
      return
    }
    const entry: LruEntry<K, V> = { key, value, older: null, newer: null }
    this.entries.set(key, entry)
    this.append(entry)
    if (this.entries.size <= this.limit) return
    const evicted = this.oldest
    if (!evicted) return
    this.unlink(evicted)
    this.entries.delete(evicted.key)
    this.onEvict?.(evicted.key, evicted.value)
  }

  delete(key: K): boolean {
    const entry = this.entries.get(key)
    if (!entry) return false
    this.unlink(entry)
    this.entries.delete(key)
    return true
  }

  clear(): void {
    this.entries.clear()
    this.oldest = null
    this.newest = null
  }

  /** Keys from least to most recently set. */
  *keys(): IterableIterator<K> {
    for (let entry = this.oldest; entry; entry = entry.newer) yield entry.key
  }

  private append(entry: LruEntry<K, V>): void {
    entry.older = this.newest
    entry.newer = null
    if (this.newest) this.newest.newer = entry
    else this.oldest = entry
    this.newest = entry
  }

  private unlink(entry: LruEntry<K, V>): void {
    if (entry.older) entry.older.newer = entry.newer
    else this.oldest = entry.newer
    if (entry.newer) entry.newer.older = entry.older
    else this.newest = entry.older
    entry.older = null
    entry.newer = null
  }
}
