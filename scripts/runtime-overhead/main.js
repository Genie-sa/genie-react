const parameters = new URLSearchParams(location.search)
const genieEnabled = parameters.get('genie') === '1'
const rows = Number(parameters.get('rows') ?? 1000)
const startup = { genieModulesMs: null, mountMs: null, settledAtMs: null }
const longTasks = []
new PerformanceObserver((list) => {
  for (const entry of list.getEntries())
    longTasks.push({ startTime: entry.startTime, duration: entry.duration })
}).observe({ type: 'longtask', buffered: true })

const pendingResponses = new Map()
let appSocket = null

/** Stands in for the hub's WebSocket so a tool call runs the client's real decode, validate, handle and encode path with no network in the measurement. */
function benchSocketFactory() {
  const socket = {
    readyState: 0,
    onopen: null,
    onmessage: null,
    onclose: null,
    onerror: null,
    send(frame) {
      const sentAt = performance.now()
      const message = JSON.parse(frame).json
      if (message.kind === 'app/response')
        pendingResponses.get(message.id)?.(message, sentAt, frame.length)
    },
    close() {
      socket.readyState = 3
    },
  }
  appSocket = socket
  setTimeout(() => {
    socket.readyState = 1
    socket.onopen?.({})
  })
  return socket
}

let Genie = null
if (genieEnabled) {
  const loadStarted = performance.now()
  await import('genie-react/hook')
  await import('genie-react/hook-hmr')
  const client = await import('genie-react/client')
  Genie = (await import('genie-react')).Genie
  startup.genieModulesMs = performance.now() - loadStarted
  client
    .createGenieClient({
      collectors: [client.sessionCollector(), client.reactCollector()],
      socketFactory: benchSocketFactory,
    })
    .start()
}

const React = await import('react')
const { flushSync } = await import('react-dom')
const { mountApp, oracle, metricValue } = await import('./app.jsx')

const mountStarted = performance.now()
let app
flushSync(() => {
  app = mountApp(document.getElementById('root'), {
    rows,
    extras: Genie ? (queryClient) => React.createElement(Genie, { queryClient }) : undefined,
  })
})
startup.mountMs = performance.now() - mountStarted

const nextTask = () => new Promise((resolve) => setTimeout(resolve, 0))
function nextFrame() {
  return new Promise((resolve) =>
    requestAnimationFrame(() => {
      const channel = new MessageChannel()
      channel.port1.onmessage = () => resolve()
      channel.port2.postMessage(null)
    }),
  )
}

async function settle() {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    await nextTask()
    if (
      app.queryClient.isFetching() === 0 &&
      document.querySelector('[data-notes]') &&
      (!genieEnabled || appSocket?.readyState === 1)
    )
      break
  }
  await nextFrame()
}
await settle()
startup.settledAtMs = performance.now()

const percentile = (values, fraction) => {
  if (values.length === 0) return null
  const sorted = [...values].sort((left, right) => left - right)
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * fraction) - 1)]
}
const summarize = (samples) => ({
  count: samples.length,
  medianMs: percentile(samples, 0.5),
  p95Ms: percentile(samples, 0.95),
  maxMs: percentile(samples, 1),
})

function timed(update) {
  const started = performance.now()
  flushSync(update)
  return performance.now() - started
}

const commitOperations = {
  tick: () => timed(() => app.controller.tick()),
  select: (step) => timed(() => app.controller.select((step * 37) % rows)),
  refresh: () => timed(() => app.controller.refresh()),
  unmount: () => {
    flushSync(() => app.controller.setFilter(''))
    return timed(() => app.controller.setFilter('Task 1'))
  },
  mount: () => {
    flushSync(() => app.controller.setFilter('Task 1'))
    return timed(() => app.controller.setFilter(''))
  },
}

function setInputValue(input, value) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
  setter.call(input, value)
  input.dispatchEvent(new Event('input', { bubbles: true }))
}

let summaryRevision = 0
const interactions = {
  'click-row': (step) => document.querySelector(`[data-row="${(step * 53) % rows}"]`).click(),
  'toggle-row-menu': (step) =>
    document.querySelector(`[data-row-actions="${(step * 29) % rows}"]`).click(),
  'type-search': (step) =>
    setInputValue(
      document.querySelector('[data-search]'),
      step % 2 === 0 ? `Task ${step % 9}` : '',
    ),
  'click-refresh': () => document.querySelector('[data-refresh]').click(),
  'click-nav': (step) => document.querySelector(`[data-nav="${step % 40}"]`).click(),
  'query-update': (step) => {
    summaryRevision += 1
    app.queryClient.setQueryData(['metric', step % 12], metricValue(step % 12, summaryRevision))
    app.queryClient.setQueryData(['summary'], {
      open: step,
      done: summaryRevision,
      revision: summaryRevision,
    })
  },
}

async function runInteraction(name, step) {
  const started = performance.now()
  interactions[name](step)
  await nextTask()
  await nextFrame()
  return performance.now() - started
}

/** One fixed sequence per call, so React's own counts must match across Genie modes. */
async function runWorkload({ commitSamples, interactionSamples, warmup }) {
  const commits = {}
  for (const [name, operation] of Object.entries(commitOperations)) {
    for (let step = 0; step < warmup; step += 1) operation(step)
    const samples = []
    for (let step = 0; step < commitSamples; step += 1) samples.push(operation(warmup + step))
    commits[name] = summarize(samples)
    await nextFrame()
  }
  flushSync(() => app.controller.setFilter(''))
  const interactionTimes = {}
  for (const name of Object.keys(interactions)) {
    for (let step = 0; step < warmup; step += 1) await runInteraction(name, step)
    const samples = []
    for (let step = 0; step < interactionSamples; step += 1)
      samples.push(await runInteraction(name, warmup + step))
    interactionTimes[name] = summarize(samples)
  }
  flushSync(() => app.controller.setFilter(''))
  await settle()
  return { commits, interactions: interactionTimes }
}

/** A long mixed session for retained-memory measurement; yields every few steps like a real page. */
async function runSession(steps) {
  const names = Object.keys(commitOperations)
  for (let step = 0; step < steps; step += 1) {
    commitOperations[names[step % names.length]](step)
    if (step % 25 === 24) await runInteraction('query-update', step)
  }
  flushSync(() => app.controller.setFilter(''))
  await settle()
}

let requestSequence = 0
/** Inject one hub request and resolve with the in-page time to answer and the longest main-thread block while it ran. */
function callTool(tool, args = {}) {
  return new Promise((resolve, reject) => {
    if (!appSocket) {
      reject(new Error('Genie is not loaded'))
      return
    }
    const id = `bench-${++requestSequence}`
    let longestGapMs = 0
    let lastTickAt = performance.now()
    let probing = true
    const channel = new MessageChannel()
    channel.port1.onmessage = () => {
      const now = performance.now()
      longestGapMs = Math.max(longestGapMs, now - lastTickAt)
      lastTickAt = now
      if (probing) channel.port2.postMessage(null)
    }
    const started = performance.now()
    pendingResponses.set(id, (message, sentAt, bytes) => {
      probing = false
      pendingResponses.delete(id)
      longestGapMs = Math.max(longestGapMs, sentAt - lastTickAt)
      channel.port1.close()
      resolve({
        ok: message.ok,
        error: message.ok ? undefined : message.error,
        result: message.ok ? message.result : undefined,
        answerMs: sentAt - started,
        blockingMs: longestGapMs,
        bytes,
      })
    })
    channel.port2.postMessage(null)
    appSocket.onmessage({
      data: JSON.stringify({ json: { kind: 'bridge/request', id, tool, args } }),
    })
  })
}

function countFibers() {
  const container = document.getElementById('root')
  const key = Object.keys(container).find((name) => name.startsWith('__reactContainer$'))
  let fiber = container[key].stateNode.current
  let composites = 0
  let total = 0
  const stack = [fiber]
  while (stack.length > 0) {
    fiber = stack.pop()
    total += 1
    if (typeof fiber.type === 'function' || (typeof fiber.type === 'object' && fiber.type !== null))
      composites += 1
    if (fiber.sibling) stack.push(fiber.sibling)
    if (fiber.child) stack.push(fiber.child)
  }
  return { total, composites }
}

window.__bench = {
  startup,
  oracle,
  longTasks,
  fibers: countFibers,
  runWorkload,
  runSession,
  callTool,
}
