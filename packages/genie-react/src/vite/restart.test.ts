import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createServer, type ViteDevServer } from 'vite'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { WebSocket } from 'ws'
import { readAgentToken } from '../hub/agent-token'
import { withPublishLock } from '../hub/discovery'
import { GENIE_DISCOVERY_FILE } from '../protocol'
import { genie } from './plugin'

let root: string
let runtime: string
let server: ViteDevServer | null = null

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'genie-vite-restart-'))
  runtime = await mkdtemp(join(tmpdir(), 'genie-vite-restart-runtime-'))
  vi.stubEnv('XDG_RUNTIME_DIR', runtime)
  await writeFile(join(root, 'index.html'), '<!doctype html><title>t</title>')
})

afterEach(async () => {
  await server?.close()
  server = null
  vi.unstubAllEnvs()
  await rm(root, { recursive: true, force: true })
  await rm(runtime, { recursive: true, force: true })
})

function boundPort(current: ViteDevServer): number {
  const address = current.httpServer?.address()
  if (!address || typeof address === 'string') throw new Error('Vite did not bind a TCP port')
  return address.port
}

const discovery = () =>
  readFile(join(root, GENIE_DISCOVERY_FILE), 'utf8')
    .then((text) => JSON.parse(text) as { port: number })
    .catch(() => null)

/** Publications and removals hold this lock, so taking it waits out one that is mid-flight. */
const quiescent = () => withPublishLock(join(root, '.genie'), async () => {})

function agentAccepted(port: number, token: string | undefined): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new WebSocket(`ws://127.0.0.1:${port}/__genie/ws?role=agent`, {
      headers: { authorization: `Bearer ${token}` },
    })
    socket.once('open', () => {
      socket.close()
      resolve(true)
    })
    socket.once('error', () => resolve(false))
  })
}

describe('genie() across a Vite restart inside the same process', () => {
  it('keeps the restarted server discoverable with its own token after the old server closes', async () => {
    const started = await createServer({
      root,
      configFile: false,
      logLevel: 'silent',
      plugins: [genie({ react: false })],
      server: { host: '127.0.0.1', port: 0 },
    })
    server = started
    await started.listen()
    await expect.poll(async () => (await discovery())?.port).toBe(boundPort(started))
    const firstToken = await readAgentToken(root)

    await started.restart()
    const republished = (token: string | undefined) => token !== undefined && token !== firstToken
    await expect.poll(() => readAgentToken(root)).toSatisfy(republished)
    await quiescent()

    const restartedPort = boundPort(started)
    expect((await discovery())?.port).toBe(restartedPort)
    expect(await agentAccepted(restartedPort, await readAgentToken(root))).toBe(true)

    await started.close()
    server = null
    await expect.poll(discovery).toBeNull()
    expect(await readAgentToken(root)).toBeUndefined()
  })
})
