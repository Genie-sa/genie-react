import { type Fiber, getRDTHook } from 'bippy'

/** A data-library query whose fetch began while React rendered a component, which is how a suspense query hook suspends. */
export interface RenderStartedQuery {
  queryHash: string
  queryKey: unknown
  startedAtMs: number
}

type StartedUnder = RenderStartedQuery & { fiber: Fiber; stillFetching: () => boolean }

interface Entry {
  fiber: WeakRef<Fiber>
  /** Live state of the query, or null once it no longer waits on a fetch. */
  read: () => Omit<RenderStartedQuery, 'startedAtMs'> | null
  startedAtMs: number
}

const ENTRY_LIMIT = 100
const entries: Entry[] = []

/** The fiber a development React renderer is working on right now, from the `getCurrentFiber` it hands to DevTools; null outside React work and in production builds. */
export function currentlyRenderingFiber(): Fiber | null {
  try {
    for (const renderer of getRDTHook().renderers.values()) {
      const getCurrentFiber = (renderer as { getCurrentFiber?: unknown }).getCurrentFiber
      const fiber = typeof getCurrentFiber === 'function' ? getCurrentFiber() : null
      if (fiber) return fiber as Fiber
    }
  } catch {
    return null
  }
  return null
}

export function noteRenderStartedQuery(
  fiber: Fiber,
  read: Entry['read'],
  startedAtMs: number,
): void {
  entries.push({ fiber: new WeakRef(fiber), read, startedAtMs })
  if (entries.length > ENTRY_LIMIT) entries.shift()
}

/** Queries still fetching whose starting render sits under the given boundary, in the order those renders started them. */
export function renderStartedQueriesUnder(
  belongsToBoundary: (fiber: Fiber) => boolean,
): StartedUnder[] {
  const found: StartedUnder[] = []
  const seen = new Set<string>()
  for (let index = entries.length - 1; index >= 0; index -= 1) {
    const entry = entries[index] as Entry
    const fiber = entry.fiber.deref()
    const query = fiber ? entry.read() : null
    if (!fiber || !query || seen.has(query.queryHash) || !belongsToBoundary(fiber)) continue
    seen.add(query.queryHash)
    found.push({
      ...query,
      startedAtMs: entry.startedAtMs,
      fiber,
      stillFetching: () => entry.read() !== null,
    })
  }
  return found.reverse()
}

export function resetRenderStartedQueriesForTests(): void {
  entries.length = 0
}
