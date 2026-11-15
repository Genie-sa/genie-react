import { CheckFailure } from './harness.mjs'

const GENIE_ORIGIN_HINT = /genie|__genie|bippy/i
const ECHO_GRACE_MS = 5_000
const GENIE_SCRIPT = /\/genie-react\/dist\/|genie-react_n_|__genie\//

function initiatorScripts(initiator) {
  const scripts = []
  for (let stack = initiator?.stack; stack; stack = stack.parent) {
    for (const frame of stack.callFrames) scripts.push(frame.url)
  }
  return scripts
}

/** A failed resource load Genie itself started: a 404 from a request Genie initiated, or a fetch Genie's own client attempted on a scheme the browser refuses. */
export function isGenieResourceFailure(entry) {
  if (entry.kind !== 'console.error') return false
  if (entry.initiatedByGenie && /Failed to load resource.*\b404\b/.test(entry.text)) return true
  return GENIE_SCRIPT.test(entry.url) && /^Fetch API cannot load /.test(entry.text)
}

/** Every page error and console error must be claimed by an `expectErrors` window; anything left over fails the app run. */
export class PageErrors {
  #entries = []
  #expectations = []
  #initiators = new Map()

  /** Records which scripts started every request, so a failed resource load can be attributed to Genie's own code instead of guessed from its URL. */
  async traceInitiators(page) {
    const cdp = await page.context().newCDPSession(page)
    cdp.on('Network.requestWillBeSent', (event) => {
      this.#initiators.set(event.request.url, initiatorScripts(event.initiator))
    })
    await cdp.send('Network.enable')
  }

  attach(page) {
    page.on('pageerror', (error) =>
      this.#record({ kind: 'pageerror', text: `${error.message}\n${error.stack ?? ''}` }),
    )
    page.on('console', (message) => {
      if (message.type() !== 'error') return
      const url = message.location()?.url ?? ''
      const initiatedBy = this.#initiators.get(url) ?? []
      this.#record({
        kind: 'console.error',
        text: message.text(),
        url,
        initiatedByGenie: initiatedBy.some((script) => GENIE_SCRIPT.test(script)),
      })
    })
  }

  #record(entry) {
    const now = Date.now()
    this.#expectations = this.#expectations.filter((candidate) => candidate.closesAt > now)
    const expectation = this.#expectations.find((candidate) =>
      candidate.patterns.some((pattern) => pattern.test(entry.text)),
    )
    if (expectation) {
      return
    }
    this.#entries.push(entry)
  }

  /** Claims matching errors while `action` runs and for a short grace period after, because dev tooling such as TanStack devtools echoes console errors back asynchronously. */
  async expectErrors(patterns, action) {
    const expectation = { patterns, closesAt: Number.POSITIVE_INFINITY }
    this.#expectations.push(expectation)
    try {
      return await action()
    } finally {
      expectation.closesAt = Date.now() + ECHO_GRACE_MS
    }
  }

  unexpected() {
    return this.#entries.map((entry) => ({
      ...entry,
      attributedToGenie:
        entry.initiatedByGenie === true ||
        GENIE_ORIGIN_HINT.test(`${entry.text} ${entry.url ?? ''}`),
    }))
  }

  /** Drops the entries `claim` accepts, so a registered known defect no longer counts as unexpected. */
  release(claim) {
    const claimed = this.#entries.filter(claim)
    this.#entries = this.#entries.filter((entry) => !claim(entry))
    return claimed
  }

  assertClean(context) {
    const unexpected = this.unexpected()
    if (unexpected.length === 0) return
    throw new CheckFailure(
      `${context}: ${unexpected.length} unexpected page/console error(s)`,
      unexpected.map((entry) => ({ ...entry, text: entry.text.slice(0, 800) })),
    )
  }
}

export async function openSession(browser, url, sessionName) {
  const context = await browser.newContext()
  const page = await context.newPage()
  const errors = new PageErrors()
  await errors.traceInitiators(page)
  errors.attach(page)
  const target = new URL(url)
  target.searchParams.set('_genie', sessionName)
  await page.goto(target.href, { waitUntil: 'domcontentloaded' })
  return { context, page, errors }
}
