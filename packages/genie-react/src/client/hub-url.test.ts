import { describe, expect, it } from 'vitest'
import { deriveHubWsUrl } from './hub-url'

describe('deriveHubWsUrl', () => {
  it('derives ws host and port from the loading script src', () => {
    expect(deriveHubWsUrl('http://localhost:4390/__genie/client.js', 1)).toBe(
      'ws://localhost:4390/__genie/ws',
    )
  })

  it('uses wss for https-served scripts', () => {
    expect(deriveHubWsUrl('https://dev.example.test:8443/__genie/client.js', 1)).toBe(
      'wss://dev.example.test:8443/__genie/ws',
    )
  })

  it('falls back to localhost with the default port when there is no script src', () => {
    expect(deriveHubWsUrl(undefined, 4390)).toBe('ws://localhost:4390/__genie/ws')
  })

  it('falls back on a malformed src', () => {
    expect(deriveHubWsUrl('not a url', 4390)).toBe('ws://localhost:4390/__genie/ws')
  })
})
