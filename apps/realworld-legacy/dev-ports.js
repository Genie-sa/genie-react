'use strict'

const DEFAULT_PORT = 4711
const DEFAULT_HUB_PORT = 4712
// Dev servers started side by side take neighbouring ports, so PORT + 1 is usually another app's dev server.
const SUGGESTED_HUB_PORT_OFFSET = 10000
const MAX_PORT = 65535

function portFromEnv(env, name) {
  const value = env[name]
  if (value === undefined || value === '') return undefined
  const port = Number(value)
  if (!Number.isInteger(port) || port < 0 || port > MAX_PORT) {
    throw new Error(`${name} must be an integer from 0 to ${MAX_PORT}`)
  }
  return port
}

/** A copy on its own PORT must name its own hub: on the default hub port its page would join whichever app's hub owns 4712. */
function resolveDevPorts(env = process.env) {
  const port = portFromEnv(env, 'PORT') ?? DEFAULT_PORT
  const hubPort = portFromEnv(env, 'GENIE_HUB_PORT')
  if (hubPort === undefined) {
    if (port === DEFAULT_PORT) return { port, hubPort: DEFAULT_HUB_PORT }
    const suggested = port + SUGGESTED_HUB_PORT_OFFSET
    throw new Error(
      `PORT=${port} needs its own Genie hub port: set GENIE_HUB_PORT${suggested <= MAX_PORT ? `=${suggested}` : ''} for both pnpm dev and pnpm hub`,
    )
  }
  if (hubPort === port) throw new Error('GENIE_HUB_PORT must differ from PORT')
  return { port, hubPort }
}

module.exports = { resolveDevPorts }
