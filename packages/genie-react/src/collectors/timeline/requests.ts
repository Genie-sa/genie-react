/** What a recording learns by observing fetch and XMLHttpRequest calls the app makes while it records. */
export interface RequestRecord {
  id: number
  initiatorType: 'fetch' | 'xmlhttprequest'
  method: string
  /** Absolute URL, kept in memory to match Resource Timing entries; never reported whole. */
  href: string
  startedAt: number
  headersAt: number | null
  endedAt: number | null
  bodyReadAt: number | null
  status: number | null
  outcome: 'in-flight' | 'response' | 'aborted' | 'aborted-after-response' | 'failed'
  matched: boolean
}

type FetchFunction = typeof fetch

const BODY_READERS = ['json', 'text', 'arrayBuffer', 'blob', 'formData', 'bytes'] as const

function absoluteHref(value: string): string {
  try {
    return new URL(value, globalThis.location?.href).href
  } catch {
    return value
  }
}

function fetchTarget(
  input: unknown,
  init: RequestInit | undefined,
): { method: string; href: string } {
  const request = typeof Request === 'function' && input instanceof Request ? input : null
  const method = (init?.method ?? request?.method ?? 'GET').toUpperCase()
  const href = request ? request.url : input instanceof URL ? input.href : String(input)
  return { method, href: absoluteHref(href) }
}

function signalOf(input: unknown, init: RequestInit | undefined): AbortSignal | null {
  if (init?.signal) return init.signal
  return typeof Request === 'function' && input instanceof Request ? input.signal : null
}

/** Observes the app's fetch and XMLHttpRequest calls until the returned function runs. A wrapper another script installed over Genie's stays in place and simply passes through once recording stops. */
export function observeRequests(onStart: (record: RequestRecord) => void): () => void {
  const now = () => performance.now()
  let active = true
  let nextId = 1
  const begin = (
    initiatorType: RequestRecord['initiatorType'],
    method: string,
    href: string,
  ): RequestRecord => {
    const record: RequestRecord = {
      id: nextId++,
      initiatorType,
      method,
      href,
      startedAt: now(),
      headersAt: null,
      endedAt: null,
      bodyReadAt: null,
      status: null,
      outcome: 'in-flight',
      matched: false,
    }
    onStart(record)
    return record
  }
  const settle = (
    record: RequestRecord,
    outcome: 'aborted' | 'aborted-after-response' | 'failed',
  ) => {
    if (record.outcome !== 'in-flight' && record.outcome !== 'response') return
    record.outcome = outcome
    record.endedAt ??= now()
  }
  const abortOutcome = (record: RequestRecord) =>
    record.headersAt === null ? 'aborted' : 'aborted-after-response'
  const fail = (record: RequestRecord, error: unknown) =>
    settle(
      record,
      (error as { name?: unknown } | null)?.name === 'AbortError' ? abortOutcome(record) : 'failed',
    )
  const restores: Array<() => void> = []

  const originalFetch: FetchFunction | undefined =
    typeof globalThis.fetch === 'function' ? globalThis.fetch : undefined
  if (originalFetch) {
    const trackBody = (record: RequestRecord, response: Response) => {
      for (const name of BODY_READERS) {
        const read = (response as unknown as Record<string, unknown>)[name]
        if (typeof read !== 'function') continue
        Object.defineProperty(response, name, {
          configurable: true,
          writable: true,
          enumerable: false,
          value: function (this: Response, ...args: unknown[]) {
            const result = Reflect.apply(read, this, args) as Promise<unknown>
            return result.then(
              (value) => {
                record.bodyReadAt = now()
                record.endedAt = record.bodyReadAt
                return value
              },
              (error: unknown) => {
                fail(record, error)
                throw error
              },
            )
          },
        })
      }
    }
    const wrapped = function fetch(this: unknown, ...args: Parameters<FetchFunction>) {
      if (!active) return Reflect.apply(originalFetch, this, args)
      const [input, init] = args
      const { method, href } = fetchTarget(input, init)
      const record = begin('fetch', method, href)
      signalOf(input, init)?.addEventListener('abort', () => settle(record, abortOutcome(record)), {
        once: true,
      })
      let pending: Promise<Response>
      try {
        pending = Reflect.apply(originalFetch, this, args) as Promise<Response>
      } catch (error) {
        settle(record, 'failed')
        throw error
      }
      return pending.then(
        (response) => {
          record.headersAt = now()
          record.status = response.status > 0 ? response.status : null
          if (record.outcome === 'in-flight') record.outcome = 'response'
          try {
            trackBody(record, response)
          } catch {
            // A response Genie cannot annotate still reaches the app unchanged.
          }
          return response
        },
        (error: unknown) => {
          fail(record, error)
          throw error
        },
      )
    }
    globalThis.fetch = wrapped as FetchFunction
    restores.push(() => {
      if (globalThis.fetch === wrapped) globalThis.fetch = originalFetch
    })
  }

  const prototype = typeof XMLHttpRequest === 'function' ? XMLHttpRequest.prototype : null
  if (prototype) {
    const targets = new WeakMap<XMLHttpRequest, { method: string; href: string }>()
    const originalOpen = prototype.open
    const originalSend = prototype.send
    const open = function (this: XMLHttpRequest, ...args: unknown[]) {
      if (active) {
        targets.set(this, {
          method: String(args[0] ?? 'GET').toUpperCase(),
          href: absoluteHref(String(args[1] ?? '')),
        })
      }
      return Reflect.apply(originalOpen, this, args)
    }
    const send = function (this: XMLHttpRequest, ...args: unknown[]) {
      const target = active ? targets.get(this) : undefined
      if (target) {
        const record = begin('xmlhttprequest', target.method, target.href)
        this.addEventListener('readystatechange', () => {
          if (this.readyState >= 2 && record.headersAt === null) record.headersAt = now()
        })
        this.addEventListener('load', () => {
          record.status = this.status > 0 ? this.status : null
          record.outcome = 'response'
          record.endedAt = now()
          record.bodyReadAt = record.endedAt
        })
        this.addEventListener('abort', () => settle(record, abortOutcome(record)))
        this.addEventListener('error', () => settle(record, 'failed'))
        this.addEventListener('timeout', () => settle(record, 'failed'))
      }
      return Reflect.apply(originalSend, this, args)
    }
    prototype.open = open as typeof prototype.open
    prototype.send = send as typeof prototype.send
    restores.push(() => {
      if (prototype.open === open) prototype.open = originalOpen
      if (prototype.send === send) prototype.send = originalSend
    })
  }

  return () => {
    active = false
    for (const restore of restores) restore()
  }
}

// ── Query strings ──────────────────────────────────────────────────────────────

export type QueryValues = 'hashed' | 'plain'

const SECRET_NAME =
  /(api[_-]?key|apikey|secret|token|password|passwd|pwd|credential|auth|signature|sig|session|key|code|nonce|otp)/i

/** A salt that never leaves the page, so a reader cannot test guesses against a hash. */
const salt = (() => {
  try {
    const bytes = new Uint32Array(2)
    globalThis.crypto.getRandomValues(bytes)
    return `${bytes[0]?.toString(36)}${bytes[1]?.toString(36)}`
  } catch {
    return Math.random().toString(36).slice(2)
  }
})()

/** 53-bit string hash (cyrb53): fast and synchronous; distinguishes values, not a cryptographic commitment. */
function hashValue(value: string): string {
  let first = 0xdeadbeef
  let second = 0x41c6ce57
  for (const char of `${salt}\u0000${value}`) {
    const code = char.codePointAt(0) ?? 0
    first = Math.imul(first ^ code, 2654435761)
    second = Math.imul(second ^ code, 1597334677)
  }
  first =
    Math.imul(first ^ (first >>> 16), 2246822507) ^ Math.imul(second ^ (second >>> 13), 3266489909)
  second =
    Math.imul(second ^ (second >>> 16), 2246822507) ^ Math.imul(first ^ (first >>> 13), 3266489909)
  return (4294967296 * (2097151 & second) + (first >>> 0))
    .toString(16)
    .padStart(14, '0')
    .slice(0, 10)
}

/** The query string with parameter names kept. Values are a salted hash (`~` and 10 hex digits) unless plain values were asked for; a value whose name looks like a credential stays hashed either way, and an empty value stays empty. */
export function describeQuery(href: string, values: QueryValues, limit: number): string | null {
  let search: string
  try {
    search = new URL(href).search
  } catch {
    return null
  }
  if (search.length <= 1) return null
  const parts = search
    .slice(1)
    .split('&')
    .filter(Boolean)
    .map((pair) => {
      const separator = pair.indexOf('=')
      const rawName = separator < 0 ? pair : pair.slice(0, separator)
      const rawValue = separator < 0 ? null : pair.slice(separator + 1)
      let name = rawName
      let value = rawValue
      try {
        name = decodeURIComponent(rawName.replaceAll('+', ' '))
        value = rawValue === null ? null : decodeURIComponent(rawValue.replaceAll('+', ' '))
      } catch {
        // Keep the encoded text when it does not decode.
      }
      if (value === null) return name
      if (value === '') return `${name}=`
      const shown = values === 'plain' && !SECRET_NAME.test(name) ? value : `~${hashValue(value)}`
      return `${name}=${shown}`
    })
  return `?${parts.join('&')}`.slice(0, limit)
}
