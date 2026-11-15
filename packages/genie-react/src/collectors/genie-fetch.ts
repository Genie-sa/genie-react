/** Requests Genie makes for itself (app source, source maps, symbolication), so the timeline can leave them out of the app's request lane. */
interface GenieRequest {
  href: string
  startedAt: number
}

/** Requests whose Resource Timing entry has not been claimed yet; with no recording to claim them, the oldest are dropped. */
const MAX_UNCLAIMED = 512
const unclaimed: GenieRequest[] = []
let calling = false

export function absoluteHref(value: string): string {
  try {
    return new URL(value, globalThis.location?.href).href
  } catch {
    return value
  }
}

/** `fetch` for Genie's own reads. It resolves the page's fetch at call time, so the app's mocks and wrappers still apply. */
export function genieFetch(url: string, init?: RequestInit): Promise<Response> {
  unclaimed.push({ href: absoluteHref(url), startedAt: performance.now() })
  if (unclaimed.length > MAX_UNCLAIMED) unclaimed.shift()
  calling = true
  try {
    return fetch(url, init)
  } finally {
    calling = false
  }
}

/** True while `genieFetch` is calling into the page's fetch, so a wrapper below it can pass the call through unrecorded. */
export function isGenieFetchCall(): boolean {
  return calling
}

/** Whether a request to `href` that started at `startTime` is one Genie made; each Genie request is claimed once. */
export function claimGenieRequest(href: string, startTime: number, windowMs: number): boolean {
  let best = -1
  let bestDelta = windowMs
  unclaimed.forEach((request, index) => {
    const delta = Math.abs(request.startedAt - startTime)
    if (request.href === href && delta <= bestDelta) {
      best = index
      bestDelta = delta
    }
  })
  if (best !== -1) unclaimed.splice(best, 1)
  return best !== -1
}

/** Genie requests started at or after `since` that no timing entry has claimed: still in flight, or ended without one. */
export function unclaimedGenieRequestsSince(since: number): number {
  return unclaimed.filter((request) => request.startedAt >= since).length
}
