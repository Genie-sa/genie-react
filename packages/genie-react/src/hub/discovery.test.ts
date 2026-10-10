import { describe, expect, it } from 'vitest'
import { bridgeUrlFor } from './discovery'

describe('bridgeUrlFor', () => {
  it.each([
    ['127.0.0.1', 'ws://127.0.0.1:5173/__genie/ws'],
    ['::1', 'ws://[::1]:5173/__genie/ws'],
    ['0.0.0.0', 'ws://127.0.0.1:5173/__genie/ws'],
    ['::', 'ws://127.0.0.1:5173/__genie/ws'],
    ['192.168.1.20', 'ws://192.168.1.20:5173/__genie/ws'],
  ])('publishes %s as an IP literal', (address, url) => {
    expect(bridgeUrlFor(address, 5173)).toBe(url)
  })
})
