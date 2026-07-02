import type { ReactElement } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { GenieScript } from './script'

afterEach(() => {
  vi.unstubAllEnvs()
})

function srcOf(element: ReactElement | null): string | undefined {
  return (element?.props as { src?: string } | undefined)?.src
}

describe('GenieScript', () => {
  it('renders a classic script tag pointing at the default hub port', () => {
    const element = GenieScript()
    expect(element?.type).toBe('script')
    expect(srcOf(element)).toBe('http://localhost:4390/__genie/client.js')
  })

  it('prefers an explicit port prop', () => {
    expect(srcOf(GenieScript({ port: 5005 }))).toBe('http://localhost:5005/__genie/client.js')
  })

  it('falls back to GENIE_HUB_PORT from the environment', () => {
    vi.stubEnv('GENIE_HUB_PORT', '4599')
    expect(srcOf(GenieScript())).toBe('http://localhost:4599/__genie/client.js')
  })

  it('renders nothing in production', () => {
    vi.stubEnv('NODE_ENV', 'production')
    expect(GenieScript()).toBeNull()
  })
})
