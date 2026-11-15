import { isArrayValue, isPlainObject } from '../causal/safe-object'

export type StatePath = Array<string | number>

export type MutationChange =
  | 'property-replaced'
  | 'property-added'
  | 'property-removed'
  | 'length-changed'

export interface MutationFinding {
  /** The changed property, or the array whose length changed. */
  path: StatePath
  change: MutationChange
}

export interface ScanLimits {
  /** Property reads per scan, shared between top-level slices. */
  propertyBudget: number
  /** Entries remembered per object or array; a longer one is compared by this prefix (and an array by its length). */
  entriesPerObject: number
  depth: number
}

export const DEFAULT_SCAN_LIMITS: ScanLimits = {
  propertyBudget: 1_000,
  entriesPerObject: 64,
  depth: 6,
}

const MIN_SLICE_BUDGET = 64

interface Signature {
  target: object
  path: StatePath
  /** Null for an array, which is compared by index and length. */
  keys: string[] | null
  values: unknown[]
  /** Every own key was remembered, so a new key is detectable. */
  complete: boolean
  length: number
}

interface SliceSnapshot {
  value: unknown
  signatures: Signature[]
  truncated: boolean
}

/** Shallow identity signatures of the objects reachable from one state, kept per top-level slice so an action only re-reads the slices it replaced. */
export interface StateSnapshot {
  root: unknown
  rootSignature: Signature | null
  slices: Map<string | number, SliceSnapshot>
  truncated: boolean
}

export interface ScanComparison {
  findings: MutationFinding[]
  objectsCompared: number
}

interface Pending {
  target: object
  path: StatePath
}

export function captureState(
  root: unknown,
  limits: ScanLimits = DEFAULT_SCAN_LIMITS,
): StateSnapshot {
  return refreshState(null, root, limits)
}

/** A snapshot of `root` that reuses the previous slice snapshots whose slice kept its identity; their objects are compared, not re-read. */
export function refreshState(
  previous: StateSnapshot | null,
  root: unknown,
  limits: ScanLimits = DEFAULT_SCAN_LIMITS,
): StateSnapshot {
  if (!isScannable(root)) return { root, rootSignature: null, slices: new Map(), truncated: false }
  const rootRead = readEntries(root, Number.POSITIVE_INFINITY)
  if (!rootRead) return { root, rootSignature: null, slices: new Map(), truncated: true }
  const rootSignature = signatureOf(root, [], rootRead)
  const sliceBudget = Math.max(
    MIN_SLICE_BUDGET,
    Math.floor(limits.propertyBudget / Math.max(1, rootRead.values.length)),
  )
  const slices = new Map<string | number, SliceSnapshot>()
  let truncated = false
  rootRead.values.forEach((value, index) => {
    const key = rootRead.keys ? (rootRead.keys[index] as string) : index
    const kept = previous?.slices.get(key)
    const slice =
      kept && Object.is(kept.value, value)
        ? kept
        : captureSlice(value, [key], sliceBudget, limits, root)
    truncated ||= slice.truncated
    slices.set(key, slice)
  })
  return { root, rootSignature, slices, truncated }
}

function captureSlice(
  value: unknown,
  path: StatePath,
  budget: number,
  limits: ScanLimits,
  root: object,
): SliceSnapshot {
  const slice: SliceSnapshot = { value, signatures: [], truncated: false }
  if (!isScannable(value)) return slice
  const visited = new WeakSet<object>([root])
  const queue: Pending[] = [{ target: value, path }]
  let remaining = budget
  for (let next = queue.shift(); next; next = queue.shift()) {
    if (visited.has(next.target)) continue
    visited.add(next.target)
    if (remaining <= 0) {
      slice.truncated = true
      break
    }
    const read = readEntries(next.target, limits.entriesPerObject)
    remaining -= (read?.values.length ?? 0) + 1
    if (!read) continue
    if (!read.complete && read.keys !== null) slice.truncated = true
    if (!isFrozen(next.target)) slice.signatures.push(signatureOf(next.target, next.path, read))
    const atDepthLimit = next.path.length >= limits.depth
    read.values.forEach((child, index) => {
      if (!isScannable(child)) return
      if (atDepthLimit) {
        slice.truncated = true
        return
      }
      const key = read.keys ? (read.keys[index] as string) : index
      queue.push({ target: child, path: [...next.path, key] })
    })
    if (read.keys === null && read.length > read.values.length) slice.truncated = true
  }
  if (queue.length > 0) slice.truncated = true
  return slice
}

/** Compares each captured object against its own current contents: an immutable update never changes an object that already existed. */
export function compareState(snapshot: StateSnapshot, findingLimit: number): ScanComparison {
  const findings: MutationFinding[] = []
  let objectsCompared = 0
  const collect = (signature: Signature): boolean => {
    objectsCompared += 1
    findings.push(...changesOf(signature).slice(0, findingLimit - findings.length))
    return findings.length >= findingLimit
  }
  if (snapshot.rootSignature && collect(snapshot.rootSignature)) {
    return { findings, objectsCompared }
  }
  for (const slice of snapshot.slices.values()) {
    for (const signature of slice.signatures) {
      if (collect(signature)) return { findings, objectsCompared }
    }
  }
  return { findings, objectsCompared }
}

interface EntryRead {
  keys: string[] | null
  values: unknown[]
  complete: boolean
  length: number
}

/** Reads at most `limit` own enumerable entries; stops enumerating a large object early instead of listing every key. */
function readEntries(target: object, limit: number): EntryRead | null {
  try {
    if (isArrayValue(target)) {
      const length = target.length
      const values: unknown[] = []
      for (let index = 0; index < Math.min(length, limit); index += 1) {
        values.push(ownValue(target, index))
      }
      return { keys: null, values, complete: length <= limit, length }
    }
    const keys: string[] = []
    let complete = true
    for (const key in target) {
      if (!Object.hasOwn(target, key)) continue
      if (keys.length >= limit) {
        complete = false
        break
      }
      keys.push(key)
    }
    return { keys, values: keys.map((key) => ownValue(target, key)), complete, length: keys.length }
  } catch {
    return null
  }
}

function signatureOf(target: object, path: StatePath, read: EntryRead): Signature {
  return {
    target,
    path,
    keys: read.keys,
    values: read.values,
    complete: read.complete,
    length: read.length,
  }
}

const ACCESSOR = Symbol('accessor')

/** Reads an own data property without running a getter, so scanning never executes app code. */
function ownValue(target: object, key: string | number): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(target, key)
  if (!descriptor) return undefined
  return 'value' in descriptor ? descriptor.value : ACCESSOR
}

function changesOf(signature: Signature): MutationFinding[] {
  if (signature.keys === null) return arrayChanges(signature)
  const findings: MutationFinding[] = []
  signature.keys.forEach((key, index) => {
    const descriptor = safeDescriptor(signature.target, key)
    if (!descriptor) {
      findings.push({ path: [...signature.path, key], change: 'property-removed' })
      return
    }
    const value = 'value' in descriptor ? descriptor.value : ACCESSOR
    if (!Object.is(value, signature.values[index])) {
      findings.push({ path: [...signature.path, key], change: 'property-replaced' })
    }
  })
  if (signature.complete) {
    const current = readEntries(signature.target, signature.values.length + 1)
    const remembered = new Set(signature.keys)
    const added = (current?.keys ?? []).find((key) => !remembered.has(key))
    if (added !== undefined) {
      findings.push({ path: [...signature.path, added], change: 'property-added' })
    }
  }
  return findings
}

function arrayChanges(signature: Signature): MutationFinding[] {
  const target = signature.target as unknown[]
  let length: number
  try {
    length = target.length
  } catch {
    return []
  }
  const findings: MutationFinding[] =
    length === signature.length ? [] : [{ path: signature.path, change: 'length-changed' }]
  signature.values.forEach((value, index) => {
    if (index < length && !Object.is(value, safeIndex(target, index))) {
      findings.push({ path: [...signature.path, index], change: 'property-replaced' })
    }
  })
  return findings
}

function safeIndex(target: unknown[], index: number): unknown {
  try {
    return ownValue(target, index)
  } catch {
    return ACCESSOR
  }
}

function safeDescriptor(target: object, key: string): PropertyDescriptor | undefined {
  try {
    return Object.getOwnPropertyDescriptor(target, key)
  } catch {
    return undefined
  }
}

function isScannable(value: unknown): value is object {
  return isPlainObject(value) || isArrayValue(value)
}

/** A frozen object cannot change in place, so only its children need a signature. */
function isFrozen(target: object): boolean {
  try {
    return Object.isFrozen(target)
  } catch {
    return false
  }
}
