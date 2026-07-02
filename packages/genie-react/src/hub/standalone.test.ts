import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { get } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { GENIE_CLIENT_PATH } from '../protocol'
import { createStandaloneBridge, type StandaloneBridgeHandle } from './standalone'

interface HttpReply {
  status: number
  body: string
  contentType: string | undefined
}

function request(port: number, path: string): Promise<HttpReply> {
  return new Promise((resolve, reject) => {
    get({ host: '127.0.0.1', port, path }, (res) => {
      let body = ''
      res.on('data', (chunk) => {
        body += String(chunk)
      })
      res.on('end', () =>
        resolve({
          status: res.statusCode ?? 0,
          body,
          contentType: res.headers['content-type'],
        }),
      )
    }).on('error', reject)
  })
}

describe('standalone hub HTTP surface', () => {
  let handle: StandaloneBridgeHandle | null = null
  let dir: string | null = null

  afterEach(async () => {
    await handle?.close()
    handle = null
    if (dir) await rm(dir, { recursive: true, force: true })
    dir = null
  })

  it('serves the client bundle at the client path', async () => {
    dir = await mkdtemp(join(tmpdir(), 'genie-hub-'))
    const bundle = join(dir, 'client.global.js')
    await writeFile(bundle, '(() => { /* genie */ })()\n')
    handle = createStandaloneBridge({ clientBundlePath: bundle })
    const { port } = await handle.listen()

    const reply = await request(port, GENIE_CLIENT_PATH)
    expect(reply.status).toBe(200)
    expect(reply.contentType).toBe('text/javascript')
    expect(reply.body).toContain('genie')
  })

  it('404s the client path when the bundle is not built', async () => {
    dir = await mkdtemp(join(tmpdir(), 'genie-hub-'))
    handle = createStandaloneBridge({ clientBundlePath: join(dir, 'missing.js') })
    const { port } = await handle.listen()

    const reply = await request(port, GENIE_CLIENT_PATH)
    expect(reply.status).toBe(404)
  })

  it('keeps rejecting other HTTP paths with 426', async () => {
    handle = createStandaloneBridge()
    const { port } = await handle.listen()

    const reply = await request(port, '/anything')
    expect(reply.status).toBe(426)
  })

  it('rejects listen() on a busy port instead of crashing the process', async () => {
    handle = createStandaloneBridge()
    const { port } = await handle.listen()
    const second = createStandaloneBridge()

    await expect(second.listen(port)).rejects.toMatchObject({ code: 'EADDRINUSE' })
    await second.close()
  })
})
