import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GENIE_DISCOVERY_FILE } from '../protocol'
import { readAgentToken } from './agent-token'
import { writeDiscoveryFile } from './discovery'
import { removeDiscoveryOnExit } from './exit-cleanup'

const info = { url: 'ws://127.0.0.1:4390/__genie/ws', port: 4390, token: 'secret' }
const SIGNALS = ['SIGINT', 'SIGTERM', 'SIGHUP'] as const

describe('removeDiscoveryOnExit', () => {
  let runtime: string
  let root: string
  let saved: Map<string, NodeJS.SignalsListener[]>

  beforeEach(async () => {
    runtime = await mkdtemp(join(tmpdir(), 'genie-exit-runtime-'))
    root = await mkdtemp(join(tmpdir(), 'genie-exit-root-'))
    vi.stubEnv('XDG_RUNTIME_DIR', runtime)
    // The test runner's own signal listeners would otherwise count as another handler.
    saved = new Map(
      SIGNALS.map((signal) => [signal, process.listeners(signal) as NodeJS.SignalsListener[]]),
    )
    for (const signal of SIGNALS) process.removeAllListeners(signal)
    await writeDiscoveryFile(root, info)
  })

  afterEach(async () => {
    for (const signal of SIGNALS) {
      process.removeAllListeners(signal)
      for (const listener of saved.get(signal) ?? []) process.on(signal, listener)
    }
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
    await rm(runtime, { recursive: true, force: true })
    await rm(root, { recursive: true, force: true })
  })

  const published = async () => ({
    discovery: await readFile(join(root, GENIE_DISCOVERY_FILE), 'utf8').catch(() => null),
    token: await readAgentToken(root),
  })

  it('removes both files on a signal another handler exits on, and leaves the exit to it', async () => {
    const kill = vi.spyOn(process, 'kill').mockImplementation(() => true)
    const order: string[] = []
    process.on('SIGTERM', () => order.push('server close'))
    removeDiscoveryOnExit(root)

    process.emit('SIGTERM', 'SIGTERM')

    expect(await published()).toEqual({ discovery: null, token: undefined })
    expect(order).toEqual(['server close'])
    expect(kill).not.toHaveBeenCalled()
  })

  it('re-raises a signal nothing else handles, after removing the files', async () => {
    const kill = vi.spyOn(process, 'kill').mockImplementation(() => true)
    removeDiscoveryOnExit(root)

    process.emit('SIGINT', 'SIGINT')

    expect(await published()).toEqual({ discovery: null, token: undefined })
    expect(kill).toHaveBeenCalledWith(process.pid, 'SIGINT')
    expect(process.listenerCount('SIGINT')).toBe(0)
  })

  it('removes both files on process exit', async () => {
    removeDiscoveryOnExit(root)
    const onExit = process.listeners('exit').at(-1)
    if (!onExit) throw new Error('no exit listener registered')

    onExit(0)

    expect(await published()).toEqual({ discovery: null, token: undefined })
  })

  it('stops listening once unregistered, so a closed server leaves a newer publisher alone', async () => {
    const stop = removeDiscoveryOnExit(root)
    stop()

    expect(process.listenerCount('SIGINT')).toBe(0)
    expect((await published()).discovery).not.toBeNull()
  })
})
