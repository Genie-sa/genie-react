import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'

const { resolveDevPorts } = createRequire(import.meta.url)(
  '../../../apps/realworld-legacy/dev-ports.js',
) as {
  resolveDevPorts: (env: Record<string, string | undefined>) => { port: number; hubPort: number }
}

describe('realworld-legacy dev ports', () => {
  it('keeps the default app and hub ports when nothing is set', () => {
    expect(resolveDevPorts({})).toEqual({ port: 4711, hubPort: 4712 })
    expect(resolveDevPorts({ PORT: '4711' })).toEqual({ port: 4711, hubPort: 4712 })
  })

  it("refuses a second copy's PORT without its own hub port instead of joining the default hub", () => {
    expect(() => resolveDevPorts({ PORT: '5212' })).toThrow(
      'PORT=5212 needs its own Genie hub port: set GENIE_HUB_PORT=15212 for both pnpm dev and pnpm hub',
    )
  })

  it('omits a suggestion past the last port', () => {
    expect(() => resolveDevPorts({ PORT: '60000' })).toThrow(
      'PORT=60000 needs its own Genie hub port: set GENIE_HUB_PORT for both pnpm dev and pnpm hub',
    )
  })

  it('uses GENIE_HUB_PORT when it is set', () => {
    expect(resolveDevPorts({ PORT: '5212', GENIE_HUB_PORT: '15212' })).toEqual({
      port: 5212,
      hubPort: 15212,
    })
  })

  it('rejects a hub port equal to the dev server port or outside the port range', () => {
    expect(() => resolveDevPorts({ PORT: '5212', GENIE_HUB_PORT: '5212' })).toThrow(
      'GENIE_HUB_PORT must differ from PORT',
    )
    expect(() => resolveDevPorts({ GENIE_HUB_PORT: '70000' })).toThrow(
      'GENIE_HUB_PORT must be an integer from 0 to 65535',
    )
  })
})
