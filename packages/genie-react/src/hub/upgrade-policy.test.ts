import type { IncomingMessage } from 'node:http'
import { describe, expect, it } from 'vitest'
import { isLoopbackAddress, UpgradePolicy } from './upgrade-policy'

function upgrade(
  role: string | null,
  headers: Record<string, string> = {},
  remoteAddress = '127.0.0.1',
): IncomingMessage {
  const query = role === null ? '' : `?role=${role}`
  return {
    url: `/__genie/ws${query}`,
    headers,
    socket: { remoteAddress },
  } as unknown as IncomingMessage
}

const agent = (headers: Record<string, string> = {}, remoteAddress?: string) =>
  upgrade('agent', headers, remoteAddress)
const app = (headers: Record<string, string> = {}, remoteAddress?: string) =>
  upgrade('app', headers, remoteAddress)

describe('isLoopbackAddress', () => {
  it('accepts 127.0.0.0/8, ::1 and IPv4-mapped loopback', () => {
    for (const address of ['127.0.0.1', '127.10.0.2', '::1', '::ffff:127.0.0.1']) {
      expect(isLoopbackAddress(address)).toBe(true)
    }
  })

  it('rejects LAN, unspecified, mapped LAN, hostnames and missing addresses', () => {
    for (const address of ['192.168.1.20', '10.0.2.2', '0.0.0.0', '::', '::ffff:192.168.1.20']) {
      expect(isLoopbackAddress(address)).toBe(false)
    }
    expect(isLoopbackAddress(undefined)).toBe(false)
    expect(isLoopbackAddress('localhost')).toBe(false)
  })
})

describe('UpgradePolicy', () => {
  const policy = new UpgradePolicy({ agentToken: 'secret' })
  const hub = new UpgradePolicy({ agentToken: 'secret', loopbackAppPorts: true })

  it('generates a distinct high-entropy token per hub when none is given', () => {
    const first = new UpgradePolicy().agentToken
    const second = new UpgradePolicy().agentToken
    expect(first).not.toBe(second)
    expect(Buffer.from(first, 'base64url')).toHaveLength(32)
  })

  it('rejects upgrades without an explicit role', () => {
    expect(policy.authorize(upgrade(null))).toMatchObject({ ok: false, status: 400 })
    expect(policy.authorize(upgrade('admin'))).toMatchObject({ ok: false, status: 400 })
  })

  it('requires the agent token as a bearer header and names the version-skew fix', () => {
    expect(policy.authorize(agent())).toMatchObject({
      ok: false,
      status: 401,
      reason: expect.stringContaining('update @genie-react/cli'),
    })
    expect(policy.authorize(agent({ authorization: 'Bearer wrong' }))).toMatchObject({
      ok: false,
      status: 401,
      reason: expect.stringMatching(/^agent token mismatch/),
    })
    expect(policy.authorize(agent({ authorization: 'secret' }))).toMatchObject({ status: 401 })
    expect(policy.authorize(agent({ authorization: 'Bearer secret' }))).toEqual({
      ok: true,
      role: 'agent',
    })
  })

  it('rejects agents carrying any browser origin, even with a valid token', () => {
    for (const origin of ['http://localhost:5173', 'https://evil.example', 'null']) {
      expect(policy.authorize(agent({ authorization: 'Bearer secret', origin }))).toMatchObject({
        ok: false,
        status: 403,
      })
    }
  })

  it('rejects agents from another machine, even with a valid token', () => {
    for (const remote of ['192.168.1.20', '::ffff:10.0.0.5', 'fe80::1']) {
      expect(policy.authorize(agent({ authorization: 'Bearer secret' }, remote))).toMatchObject({
        ok: false,
        status: 403,
        reason: 'agent connections must come from this machine',
      })
    }
    expect(policy.authorize(agent({ authorization: 'Bearer secret' }, '::1'))).toMatchObject({
      ok: true,
    })
  })

  it('accepts origin-less apps only from this machine', () => {
    expect(policy.authorize(app())).toEqual({ ok: true, role: 'app' })
    expect(policy.authorize(app({}, '::ffff:127.0.0.1'))).toEqual({ ok: true, role: 'app' })
    expect(policy.authorize(app({}, '192.168.1.20'))).toMatchObject({ ok: false, status: 403 })
  })

  it("trusts only the embedded bridge's own origin, not other loopback ports", () => {
    expect(
      policy.authorize(app({ origin: 'http://localhost:5173', host: 'localhost:5173' })),
    ).toEqual({ ok: true, role: 'app', origin: 'http://localhost:5173' })
    expect(
      policy.authorize(app({ origin: 'http://[::1]:5173', host: '[::1]:5173' })),
    ).toMatchObject({ ok: true })
    for (const origin of [
      'http://localhost:8080',
      'http://127.0.0.1:5174',
      'https://app.localhost',
    ]) {
      expect(policy.authorize(app({ origin, host: 'localhost:5173' }))).toMatchObject({
        ok: false,
        status: 403,
      })
    }
  })

  it('lets a standalone hub admit loopback pages on any port, flagged as unverified', () => {
    for (const origin of [
      'http://localhost:3000',
      'http://127.0.0.1:5173',
      'http://[::1]:5173',
      'https://app.localhost',
    ]) {
      expect(hub.authorize(app({ origin, host: 'localhost:4390' }))).toEqual({
        ok: true,
        role: 'app',
        origin,
        originUnverified: true,
      })
    }
  })

  it("narrows a standalone hub to the app's loopback ports when they are known", () => {
    const next = new UpgradePolicy({ loopbackAppPorts: [3000] })
    expect(
      next.authorize(app({ origin: 'http://localhost:3000', host: 'localhost:4390' })),
    ).toEqual({ ok: true, role: 'app', origin: 'http://localhost:3000' })
    expect(
      next.authorize(app({ origin: 'http://127.0.0.1:8080', host: 'localhost:4390' })),
    ).toMatchObject({ ok: false, status: 403 })
  })

  it('accepts React Native, whose Origin mirrors the hub URL it dials', () => {
    expect(hub.authorize(app({ origin: 'http://127.0.0.1:4390', host: '127.0.0.1:4390' }))).toEqual(
      { ok: true, role: 'app', origin: 'http://127.0.0.1:4390' },
    )
    expect(hub.authorize(app({ origin: 'http://10.0.2.2:4390', host: '10.0.2.2:4390' }))).toEqual({
      ok: true,
      role: 'app',
      origin: 'http://10.0.2.2:4390',
    })
  })

  it('rejects cross-site and opaque origins', () => {
    for (const origin of ['https://evil.example', 'null', 'file://', 'chrome-extension://abc']) {
      expect(hub.authorize(app({ origin, host: 'localhost:5173' }))).toMatchObject({
        ok: false,
        status: 403,
      })
    }
  })

  it('accepts a same-origin IP-literal page from the LAN, as on `vite --host`', () => {
    expect(
      policy.authorize(
        app({ origin: 'http://192.168.1.20:5173', host: '192.168.1.20:5173' }, '192.168.1.30'),
      ),
    ).toEqual({ ok: true, role: 'app', origin: 'http://192.168.1.20:5173' })
    expect(
      policy.authorize(app({ origin: 'http://192.168.1.20:5173', host: '192.168.1.20:4390' })),
    ).toMatchObject({ ok: false, status: 403 })
  })

  it('rejects a DNS-rebound hostname even though it looks same-origin', () => {
    expect(
      policy.authorize(
        app({ origin: 'http://rebind.evil.example:5173', host: 'rebind.evil.example:5173' }),
      ),
    ).toMatchObject({ ok: false, status: 403 })
  })

  it('accepts same-origin hostnames listed in Vite-style allowedHosts', () => {
    const hosts = new UpgradePolicy({ allowedHosts: ['.example.test', 'dev.box'] })
    expect(
      hosts.authorize(app({ origin: 'http://app.example.test', host: 'app.example.test' })),
    ).toMatchObject({ ok: true, role: 'app' })
    expect(
      hosts.authorize(app({ origin: 'http://dev.box:5173', host: 'dev.box:5173' })),
    ).toMatchObject({ ok: true, role: 'app' })
    expect(
      hosts.authorize(app({ origin: 'http://other.box:5173', host: 'other.box:5173' })),
    ).toMatchObject({ ok: false })
    const any = new UpgradePolicy({ allowedHosts: true })
    expect(any.authorize(app({ origin: 'http://other.box', host: 'other.box' }))).toMatchObject({
      ok: true,
      role: 'app',
    })
  })

  it('accepts explicitly allowed origins regardless of host', () => {
    const allowed = new UpgradePolicy({ allowedOrigins: ['https://tunnel.example.test/'] })
    expect(
      allowed.authorize(app({ origin: 'https://tunnel.example.test', host: 'localhost:4390' })),
    ).toEqual({ ok: true, role: 'app', origin: 'https://tunnel.example.test' })
    expect(() => new UpgradePolicy({ allowedOrigins: ['not a url'] })).toThrow(/invalid allowed/)
  })
})
