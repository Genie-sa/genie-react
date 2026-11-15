import superjson from 'superjson'
import {
  DEFAULT_INSPECT_DEPTH,
  DEFAULT_MAX_ENTRIES,
  DEFAULT_MAX_STRING_LENGTH,
  DEFAULT_PREVIEW_STRING_LENGTH,
} from './constants'
import { errorMessage } from './errors'

/** Wire codec is superjson: bridge frames and dehydrated payloads rely on `Date`/`Map`/`Set`/`BigInt`/`undefined` surviving. */
export function encodeFrame(value: unknown): string {
  return superjson.stringify(value)
}

export function decodeFrame(raw: string): unknown {
  return superjson.parse(raw)
}

export const DEHYDRATED = '__genie_dehydrated__' as const

// Pollution-vector keys superjson refuses to reconstruct — including one would discard the whole payload.
const RESERVED_OBJECT_KEYS: ReadonlySet<string> = new Set(['__proto__', 'constructor', 'prototype'])

export type DehydratedKind =
  | 'object'
  | 'array'
  | 'map'
  | 'set'
  | 'function'
  | 'symbol'
  | 'circular'
  | 'react-element'
  | 'dom-node'
  | 'promise'
  | 'getter-error'
  | 'not-found'
  | 'truncated'
  | 'number'
  | 'date'

/** Placeholder for values too deep/large/circular to serialize; `path` is absolute from the root so the subtree can be re-requested. */
export interface DehydratedNode {
  readonly [DEHYDRATED]: true
  kind: DehydratedKind
  preview: string
  size?: number
  path: ReadonlyArray<string | number>
}

export interface DehydrateOptions {
  depth?: number
  maxStringLength?: number
  maxEntries?: number
  path?: ReadonlyArray<string | number>
}

export function isDehydratedNode(value: unknown): value is DehydratedNode {
  return (
    typeof value === 'object' && value !== null && DEHYDRATED in value && value[DEHYDRATED] === true
  )
}

const REACT_ELEMENT_TYPES = new Set<symbol>([
  Symbol.for('react.element'),
  Symbol.for('react.transitional.element'),
])

interface ReactElementLike {
  $$typeof: symbol
  type?: unknown
}

type OwnRead = { kind: 'value'; value: unknown } | { kind: 'accessor' } | { kind: 'missing' }

/** Reads an own property without running an accessor; a throwing Proxy trap reads as missing. */
function readOwn(value: object, key: PropertyKey): OwnRead {
  let descriptor: PropertyDescriptor | undefined
  try {
    descriptor = Object.getOwnPropertyDescriptor(value, key)
  } catch {
    return { kind: 'missing' }
  }
  if (!descriptor) return { kind: 'missing' }
  return Object.hasOwn(descriptor, 'value')
    ? { kind: 'value', value: descriptor.value }
    : { kind: 'accessor' }
}

/** Looks a data property up the prototype chain without invoking any accessor along the way. */
function readData(value: object, key: PropertyKey): unknown {
  let current: object | null = value
  for (let hops = 0; current && hops < 32; hops += 1) {
    const read = readOwn(current, key)
    if (read.kind === 'value') return read.value
    if (read.kind === 'accessor') return undefined
    try {
      current = Object.getPrototypeOf(current)
    } catch {
      return undefined
    }
  }
  return undefined
}

function isReactElement(value: object): value is ReactElementLike {
  const marker = readData(value, '$$typeof')
  return typeof marker === 'symbol' && REACT_ELEMENT_TYPES.has(marker)
}

const DomNode = (globalThis as { Node?: new (...args: never[]) => object }).Node

interface DomNodeLike {
  nodeName?: string
  id?: string
}

function isDomNode(value: object): value is DomNodeLike {
  return typeof DomNode === 'function' && value instanceof DomNode
}

const isTypedArray = (value: object): value is ArrayLike<number | bigint> =>
  ArrayBuffer.isView(value) && !(value instanceof DataView)

function constructorName(value: object): string | null {
  const ctor = readData(value, 'constructor')
  if (typeof ctor !== 'function') return null
  const name = readData(ctor, 'name')
  return typeof name === 'string' && name ? name : null
}

function errorSummary(value: Error): { name: string; message: string } {
  const name = readData(value, 'name')
  const message = readData(value, 'message')
  return {
    name: typeof name === 'string' ? name : (constructorName(value) ?? 'Error'),
    message: typeof message === 'string' ? message : '',
  }
}

const isInvalidDate = (value: Date): boolean => Number.isNaN(value.getTime())

/** A one-line description of any value; never runs application getters and never throws. */
export function previewValue(
  value: unknown,
  maxStringLength = DEFAULT_PREVIEW_STRING_LENGTH,
): string {
  try {
    return previewUnchecked(value, maxStringLength)
  } catch {
    return '[unreadable]'
  }
}

function previewUnchecked(value: unknown, maxStringLength: number): string {
  switch (typeof value) {
    case 'string':
      return value.length > maxStringLength
        ? `${JSON.stringify(value.slice(0, maxStringLength))}…(${value.length})`
        : JSON.stringify(value)
    case 'number':
    case 'boolean':
      return String(value)
    case 'bigint':
      return `${value}n`
    case 'symbol':
      return value.toString()
    case 'undefined':
      return 'undefined'
    case 'function': {
      const name = readData(value, 'name')
      return `ƒ ${typeof name === 'string' && name ? name : 'anonymous'}()`
    }
    case 'object': {
      if (value === null) return 'null'
      if (Array.isArray(value)) return `Array(${value.length})`
      if (value instanceof Date) return isInvalidDate(value) ? 'Invalid Date' : value.toISOString()
      if (value instanceof Map) return `Map(${value.size})`
      if (value instanceof Set) return `Set(${value.size})`
      if (value instanceof RegExp) return value.toString()
      if (value instanceof Error) {
        const { name, message } = errorSummary(value)
        return message ? `${name}: ${message}` : name
      }
      if (isTypedArray(value)) return `${constructorName(value) ?? 'TypedArray'}(${value.length})`
      if (isReactElement(value)) return reactElementPreview(value)
      if (isDomNode(value)) return domNodePreview(value)
      const ctor = constructorName(value)
      return ctor && ctor !== 'Object' ? `${ctor} {…}` : '{…}'
    }
    default:
      return String(value)
  }
}

function reactElementPreview(value: ReactElementLike): string {
  return `<${componentName(readData(value, 'type'))} />`
}

function componentName(type: unknown): string {
  if (typeof type === 'string') return type
  if (typeof type === 'function' || (typeof type === 'object' && type !== null)) {
    const label = readData(type, 'displayName') ?? readData(type, 'name')
    if (label != null) return String(label)
  }
  return 'Component'
}

function domNodePreview(value: DomNodeLike): string {
  const tag = value.nodeName?.toLowerCase() ?? 'node'
  return value.id ? `<${tag} #${value.id}>` : `<${tag}>`
}

function dehydratedNode(
  kind: DehydratedKind,
  preview: string,
  path: ReadonlyArray<string | number>,
  size?: number,
): DehydratedNode {
  return { [DEHYDRATED]: true, kind, preview, path, ...(size === undefined ? {} : { size }) }
}

// message and cause are own but non-enumerable, so a plain key walk would show an Error as `{}`.
function errorFields(error: Error): Record<string, unknown> {
  const cause = readOwn(error, 'cause')
  return {
    __type: 'Error',
    ...errorSummary(error),
    ...(cause.kind === 'value' ? { cause: previewValue(cause.value) } : {}),
  }
}

const getterPlaceholder = (path: ReadonlyArray<string | number>): DehydratedNode =>
  dehydratedNode('getter-error', '[getter not invoked]', path)

/** Depth- and size-caps a runtime value for the wire (and token budgets), mirroring React DevTools' dehydration. Reads only own data properties, so application getters never run. */
export function dehydrate(input: unknown, options: DehydrateOptions = {}): unknown {
  const depth = options.depth ?? DEFAULT_INSPECT_DEPTH
  const maxStringLength = options.maxStringLength ?? DEFAULT_MAX_STRING_LENGTH
  const maxEntries = options.maxEntries ?? DEFAULT_MAX_ENTRIES
  const basePath = options.path ?? []

  const resolved = resolvePath(input, basePath)
  if (resolved.kind === 'missing') {
    return dehydratedNode('not-found', `path not found: ${formatPath(basePath)}`, basePath)
  }
  if (resolved.kind === 'accessor') return getterPlaceholder(basePath)

  const seen = new WeakSet<object>()

  const truncateString = (value: string): string =>
    value.length > maxStringLength ? `${value.slice(0, maxStringLength)}…(${value.length})` : value

  const walk = (
    value: unknown,
    currentDepth: number,
    path: ReadonlyArray<string | number>,
  ): unknown => {
    if (value === null) return null
    if (typeof value === 'string') return truncateString(value)
    if (typeof value === 'number') {
      return Number.isFinite(value) ? value : dehydratedNode('number', String(value), path)
    }
    if (typeof value === 'boolean' || typeof value === 'undefined') return value
    // bigint is not JSON-serializable; dehydrated output is agent-facing JSON, so stringify it.
    if (typeof value === 'bigint') return `${value}n`
    if (typeof value === 'symbol') return dehydratedNode('symbol', value.toString(), path)
    if (typeof value === 'function') return dehydratedNode('function', previewValue(value), path)

    const obj = value
    if (seen.has(obj)) return dehydratedNode('circular', '[Circular]', path)
    if (value instanceof Date) {
      return isInvalidDate(value) ? dehydratedNode('date', 'Invalid Date', path) : value
    }
    // RegExp has no toJSON (a raw value collapses to "{}"), so emit its source form like bigint/previewValue.
    if (value instanceof RegExp) return value.toString()
    if (typeof Promise !== 'undefined' && value instanceof Promise)
      return dehydratedNode('promise', 'Promise', path)
    if (isReactElement(obj)) return dehydratedNode('react-element', reactElementPreview(obj), path)
    if (isDomNode(obj)) return dehydratedNode('dom-node', domNodePreview(obj), path)

    if (value instanceof Map) {
      if (currentDepth >= depth)
        return dehydratedNode('map', `Map(${value.size})`, path, value.size)
      seen.add(obj)
      const entries: Array<[string | number, unknown]> = []
      let i = 0
      for (const [key, entry] of Map.prototype.entries.call(value)) {
        if (i >= maxEntries) {
          entries.push([
            '…',
            dehydratedNode(
              'truncated',
              `+${value.size - maxEntries} more entries`,
              path,
              value.size,
            ),
          ])
          break
        }
        const safeKey = typeof key === 'string' || typeof key === 'number' ? key : previewValue(key)
        entries.push([safeKey, walk(entry, currentDepth + 1, [...path, safeKey])])
        i++
      }
      seen.delete(obj)
      return { __type: 'Map', entries }
    }

    if (value instanceof Set) {
      if (currentDepth >= depth)
        return dehydratedNode('set', `Set(${value.size})`, path, value.size)
      seen.add(obj)
      const out: unknown[] = []
      let i = 0
      for (const entry of Set.prototype.values.call(value)) {
        if (i >= maxEntries) {
          out.push(
            dehydratedNode(
              'truncated',
              `+${value.size - maxEntries} more entries`,
              path,
              value.size,
            ),
          )
          break
        }
        out.push(walk(entry, currentDepth + 1, [...path, i]))
        i++
      }
      seen.delete(obj)
      return { __type: 'Set', values: out }
    }

    if (Array.isArray(value) || isTypedArray(obj)) {
      const list = obj as ArrayLike<unknown>
      const typedName = Array.isArray(value) ? null : (constructorName(obj) ?? 'TypedArray')
      if (currentDepth >= depth) {
        return dehydratedNode('array', previewValue(value), path, list.length)
      }
      seen.add(obj)
      const limit = Math.min(list.length, maxEntries)
      const items: unknown[] = []
      for (let i = 0; i < limit; i++) {
        const read = typedName ? { kind: 'value' as const, value: list[i] } : readOwn(obj, i)
        items.push(
          read.kind === 'accessor'
            ? getterPlaceholder([...path, i])
            : walk(read.kind === 'value' ? read.value : undefined, currentDepth + 1, [...path, i]),
        )
      }
      if (list.length > maxEntries) {
        items.push(
          dehydratedNode('truncated', `+${list.length - maxEntries} more items`, path, list.length),
        )
      }
      seen.delete(obj)
      return typedName ? { __type: typedName, values: items } : items
    }

    if (currentDepth >= depth) return dehydratedNode('object', previewValue(value), path)

    seen.add(obj)
    const out: Record<string, unknown> = value instanceof Error ? errorFields(value) : {}
    const allKeys = Object.keys(obj)
    const keys = allKeys.filter((key) => !RESERVED_OBJECT_KEYS.has(key))
    const reserved = allKeys.filter((key) => RESERVED_OBJECT_KEYS.has(key))
    for (const key of keys.slice(0, Math.max(0, maxEntries))) {
      const read = readOwn(obj, key)
      if (read.kind === 'accessor') {
        out[key] = getterPlaceholder([...path, key])
        continue
      }
      try {
        out[key] = walk(read.kind === 'value' ? read.value : undefined, currentDepth + 1, [
          ...path,
          key,
        ])
      } catch (error) {
        out[key] = dehydratedNode('getter-error', `[getter threw: ${errorMessage(error)}]`, [
          ...path,
          key,
        ])
      }
    }
    const omitted = Math.max(0, keys.length - maxEntries) + reserved.length
    if (omitted > 0) {
      const note = reserved.length > 0 ? ` (${reserved.join(', ')} cannot be shown)` : ''
      out['…'] = dehydratedNode('truncated', `+${omitted} more keys${note}`, path, allKeys.length)
    }
    seen.delete(obj)
    return out
  }

  return walk(resolved.value, 0, basePath)
}

/** Follows a hydration path through own data properties only, so re-rooting never runs an application getter. */
function resolvePath(input: unknown, path: ReadonlyArray<string | number>): OwnRead {
  let current = input
  for (const segment of path) {
    if (current == null || (typeof current !== 'object' && typeof current !== 'function')) {
      return { kind: 'missing' }
    }
    try {
      if (current instanceof Map) {
        if (!Map.prototype.has.call(current, segment)) return { kind: 'missing' }
        current = Map.prototype.get.call(current, segment)
      } else if (current instanceof Set) {
        const values = [...Set.prototype.values.call(current)]
        if (typeof segment !== 'number' || segment >= values.length) return { kind: 'missing' }
        current = values[segment]
      } else {
        const read = readOwn(current, segment)
        if (read.kind !== 'value') return read
        current = read.value
      }
    } catch {
      // a throwing Proxy trap during re-rooting — mirror the walk's graceful handling
      return { kind: 'missing' }
    }
  }
  return { kind: 'value', value: current }
}

function formatPath(path: ReadonlyArray<string | number>): string {
  return path.length === 0 ? '<root>' : path.join('.')
}

/** `file:line:column`, dropping trailing positions the source map could not resolve. */
export function formatSourceLocation(
  source: { file: string; line: number | null; column: number | null } | null,
): string | null {
  if (!source) return null
  if (source.line === null) return source.file
  return source.column === null
    ? `${source.file}:${source.line}`
    : `${source.file}:${source.line}:${source.column}`
}

export function roundMilliseconds(value: number): number {
  return Math.round(value * 100) / 100
}
