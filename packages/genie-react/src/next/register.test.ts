import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { get } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GENIE_CLIENT_PATH, GENIE_DISCOVERY_FILE } from '../protocol'
import { registerGenie, stopGenieHub } from './register'

function status(port: number, path: string): Promise<number> {
  return new Promise((resolve, reject) => {
    get({ host: '127.0.0.1', port, path }, (res) => {
      res.resume()
      resolve(res.statusCode ?? 0)
    }).on('error', reject)
  })
}

describe('registerGenie', () => {
  let dir: string

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'genie-next-'))
    await stopGenieHub()
  })

  afterEach(async () => {
    await stopGenieHub()
    vi.unstubAllEnvs()
    await rm(dir, { recursive: true, force: true })
  })

  it('starts a hub, writes discovery, and is idempotent across register() re-runs', async () => {
    const port = 4790 + Math.floor(Math.random() * 100)
    await registerGenie({ port, rootDir: dir })
    await registerGenie({ port, rootDir: dir })

    const discovery = JSON.parse(await readFile(join(dir, GENIE_DISCOVERY_FILE), 'utf8'))
    expect(discovery.port).toBe(port)
    expect(discovery.url).toBe(`ws://localhost:${port}/__genie/ws`)
    expect(await status(port, GENIE_CLIENT_PATH)).toBeGreaterThanOrEqual(200)
  })

  it('no-ops in production', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    await registerGenie({ port: 4899, rootDir: dir })
    await expect(readFile(join(dir, GENIE_DISCOVERY_FILE), 'utf8')).rejects.toMatchObject({
      code: 'ENOENT',
    })
  })

  it('no-ops on the edge runtime', async () => {
    vi.stubEnv('NEXT_RUNTIME', 'edge')
    await registerGenie({ port: 4898, rootDir: dir })
    await expect(readFile(join(dir, GENIE_DISCOVERY_FILE), 'utf8')).rejects.toMatchObject({
      code: 'ENOENT',
    })
  })
})
