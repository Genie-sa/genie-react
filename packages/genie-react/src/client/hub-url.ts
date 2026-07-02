import { GENIE_WS_PATH } from '../protocol'

/** Derives the hub's WS URL from the `<script src>` that loaded the client, so the served bundle needs no baked-in address. */
export function deriveHubWsUrl(scriptSrc: string | undefined, fallbackPort: number): string {
  if (scriptSrc) {
    try {
      const src = new URL(scriptSrc)
      const protocol = src.protocol === 'https:' ? 'wss' : 'ws'
      return `${protocol}://${src.host}${GENIE_WS_PATH}`
    } catch {
      // malformed src — fall through to the default port
    }
  }
  return `ws://localhost:${fallbackPort}${GENIE_WS_PATH}`
}
