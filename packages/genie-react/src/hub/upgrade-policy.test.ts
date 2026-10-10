import type { IncomingMessage } from 'node:http'
import { describe, expect, it } from 'vitest'
import { UpgradePolicy } from './upgrade-policy'

function upgrade(role: string | null, headers: Record<string, string> = {}): IncomingMessage {
  const query = role === null ? '' : `?role=${role}`
  return { url: `/__genie/ws${query}`, headers } as unknown as IncomingMessage
}

const agent = (headers: Record<string, string> = {}) => upgrade('agent', headers)
const app = (headers: Record<string, string> = {}) => upgrade('app', headers)

describe('UpgradePolicy', () => {
  const policy = new UpgradePolicy({ agentToken: 'secret' })

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

  it('requires the agent token as a bearer header', () => {
    expect(policy.authorize(agent())).toMatchObject({ ok: false, status: 401 })
    expect(policy.authorize(agent({ authorization: 'Bearer wrong' }))).toMatchObject({
      ok: false,
      status: 401,
      reason: 'agent token mismatch',
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

  it('accepts origin-less apps, as React Native and Node clients connect', () => {
    expect(policy.authorize(app())).toEqual({ ok: true, role: 'app' })
  })

  it('accepts loopback page origins on any port', () => {
    for (const origin of [
      'http://localhost:3000',
      'http://127.0.0.1:5173',
      'http://[::1]:5173',
      'https://app.localhost',
    ]) {
      expect(policy.authorize(app({ origin, host: 'localhost:4390' }))).toEqual({
        ok: true,
        role: 'app',
      })
    }
  })

  it('rejects cross-site and opaque origins', () => {
    for (const origin of ['https://evil.example', 'null', 'file://', 'chrome-extension://abc']) {
      expect(policy.authorize(app({ origin, host: 'localhost:5173' }))).toMatchObject({
        ok: false,
        status: 403,
      })
    }
  })

  it('accepts a same-origin IP-literal page, as on `vite --host` or a device reaching the hub', () => {
    expect(
      policy.authorize(app({ origin: 'http://192.168.1.20:5173', host: '192.168.1.20:5173' })),
    ).toEqual({ ok: true, role: 'app' })
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
    ).toEqual({ ok: true, role: 'app' })
    expect(hosts.authorize(app({ origin: 'http://dev.box:5173', host: 'dev.box:5173' }))).toEqual({
      ok: true,
      role: 'app',
    })
    expect(
      hosts.authorize(app({ origin: 'http://other.box:5173', host: 'other.box:5173' })),
    ).toMatchObject({ ok: false })
    const any = new UpgradePolicy({ allowedHosts: true })
    expect(any.authorize(app({ origin: 'http://other.box', host: 'other.box' }))).toEqual({
      ok: true,
      role: 'app',
    })
  })

  it('accepts explicitly allowed origins regardless of host', () => {
    const allowed = new UpgradePolicy({ allowedOrigins: ['https://tunnel.example.test/'] })
    expect(
      allowed.authorize(app({ origin: 'https://tunnel.example.test', host: 'localhost:4390' })),
    ).toEqual({ ok: true, role: 'app' })
    expect(() => new UpgradePolicy({ allowedOrigins: ['not a url'] })).toThrow(/invalid allowed/)
  })
})
