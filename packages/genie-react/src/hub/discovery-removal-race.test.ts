import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { GENIE_DISCOVERY_FILE } from '../protocol'
import { readAgentToken } from './agent-token'
import { removeDiscoveryFile, writeDiscoveryFile } from './discovery'

/** Lets a test stop removal between its ownership check and its delete, and see a publisher find the publish lock taken. */
const hooks: { beforeRm?: (path: string) => Promise<void>; onLockBusy?: () => void } = {}

vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs/promises')>()
  return {
    ...actual,
    rm: async (...args: Parameters<typeof actual.rm>) => {
      await hooks.beforeRm?.(String(args[0]))
      return actual.rm(...args)
    },
    writeFile: async (...args: Parameters<typeof actual.writeFile>) => {
      try {
        return await actual.writeFile(...args)
      } catch (error) {
        if (String(args[0]).endsWith('publish.lock')) hooks.onLockBusy?.()
        throw error
      }
    },
  }
})

let runtime: string
let root: string

beforeEach(async () => {
  runtime = await mkdtemp(join(tmpdir(), 'genie-race-runtime-'))
  root = await mkdtemp(join(tmpdir(), 'genie-race-root-'))
  vi.stubEnv('XDG_RUNTIME_DIR', runtime)
})

afterEach(async () => {
  hooks.beforeRm = undefined
  hooks.onLockBusy = undefined
  vi.unstubAllEnvs()
  await rm(runtime, { recursive: true, force: true })
  await rm(root, { recursive: true, force: true })
})

function signal(): { promise: Promise<void>; fire: () => void } {
  let fire!: () => void
  const promise = new Promise<void>((resolve) => {
    fire = resolve
  })
  return { promise, fire }
}

it('keeps a successor that publishes while the closing hub is between its ownership check and its delete', async () => {
  const closing = await writeDiscoveryFile(root, {
    url: 'ws://127.0.0.1:4390/__genie/ws',
    port: 4390,
    token: 'closing',
  })
  const successor = { url: 'ws://127.0.0.1:4391/__genie/ws', port: 4391, token: 'successor' }
  const discoveryFile = join(root, GENIE_DISCOVERY_FILE)
  const checked = signal()
  const deleteMay = signal()
  hooks.beforeRm = async (path) => {
    if (path !== discoveryFile) return
    hooks.beforeRm = undefined
    checked.fire()
    await deleteMay.promise
  }
  const removal = removeDiscoveryFile(root, closing?.instance)
  await checked.promise

  const blocked = signal()
  hooks.onLockBusy = blocked.fire
  const publication = writeDiscoveryFile(root, successor)
  await Promise.race([blocked.promise, publication])
  deleteMay.fire()
  await Promise.all([removal, publication])

  expect(JSON.parse(await readFile(discoveryFile, 'utf8')).url).toBe(successor.url)
  expect(await readAgentToken(root)).toBe(successor.token)
})
