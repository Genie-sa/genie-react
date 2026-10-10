/** @type {Map<string, () => Promise<unknown>>} */
const pending = new Map()
/** @type {Set<Promise<unknown>>} */
const running = new Set()
let closed = false

/**
 * @param {() => Promise<unknown>} releaser
 */
function start(releaser) {
  const promise = releaser().finally(() => running.delete(promise))
  running.add(promise)
  return promise
}

/**
 * Registers a resource so an interrupt can release it; `release(key)` runs and forgets it.
 * Once `releaseAll` has started, the resource is released at once and the caller is stopped.
 * @param {string} key
 * @param {() => Promise<unknown>} releaser
 */
export function track(key, releaser) {
  if (closed) {
    start(releaser).catch(() => {})
    throw new Error('interrupted')
  }
  pending.set(key, releaser)
}

/**
 * @param {string} key
 */
export async function release(key) {
  const releaser = pending.get(key)
  if (!releaser) return
  pending.delete(key)
  await start(releaser)
}

/**
 * Whether shutdown has begun, after which a trial's outcome reflects the interrupt rather than the agent.
 */
export function interrupted() {
  return closed
}

/**
 * Releases every tracked resource, including releases already in flight, before the process exits.
 */
export async function releaseAll() {
  closed = true
  while (pending.size > 0 || running.size > 0) {
    await Promise.allSettled([...[...pending.keys()].map(release), ...running])
  }
}
