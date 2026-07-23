import type { SocketLike } from '../client/client'
import { decodeFrame, encodeMessage } from '../protocol'

// biome-ignore lint/suspicious/noExplicitAny: tests inspect decoded wire frames
export type Frame = any

/** Shared WebSocket double for client-level suites; one copy so a wire-contract change breaks every suite loudly instead of one silently. */
export class FakeSocket implements SocketLike {
  readyState = 0
  readonly sent: string[] = []
  onopen: ((event: unknown) => void) | null = null
  onmessage: ((event: { data: unknown }) => void) | null = null
  onclose: ((event: unknown) => void) | null = null
  onerror: ((event: unknown) => void) | null = null

  send(data: string): void {
    this.sent.push(data)
  }

  close(): void {
    this.readyState = 3
    this.onclose?.(null)
  }

  open(): void {
    this.readyState = 1
    this.onopen?.(null)
  }

  receive(message: unknown): void {
    this.onmessage?.({ data: encodeMessage(message) })
  }

  decoded(): Frame[] {
    return this.sent.map((raw) => decodeFrame(raw))
  }
}

/** Drains pending microtasks and timer ticks so coalesced refreshes and async handlers settle. */
export const flush = (): Promise<unknown> => new Promise((resolve) => setTimeout(resolve, 0))

/** Newest hello frame the client sent, or undefined before the first one. */
export function lastHello(socket: FakeSocket): Frame {
  return socket
    .decoded()
    .filter((frame) => frame.kind === 'app/hello')
    .at(-1)
}

/** Newest response frame for one request id. */
export function lastResponse(socket: FakeSocket, id: string): Frame {
  return socket
    .decoded()
    .filter((frame) => frame.kind === 'app/response' && frame.id === id)
    .at(-1)
}
