import { afterEach, expect, it, vi } from 'vitest'
import { runHub } from './hub-command'

const hub = vi.hoisted(() => ({ startGenieHub: vi.fn(), removeDiscoveryFile: vi.fn() }))
vi.mock('genie-react/hub', () => hub)

afterEach(() => vi.restoreAllMocks())

it('emits one reused event and does not own the existing hub lifecycle', async () => {
  hub.startGenieHub.mockResolvedValue({
    status: 'reused',
    port: 4390,
    url: 'ws://localhost:4390/__genie/ws',
    clientUrl: 'http://localhost:4390/__genie/client.js',
  })
  const stdout = vi.spyOn(process.stdout, 'write').mockReturnValue(true)
  const before = process.listenerCount('SIGINT')
  expect(await runHub()).toBe(0)
  expect(stdout).toHaveBeenCalledTimes(1)
  expect(JSON.parse(String(stdout.mock.calls[0]?.[0]))).toMatchObject({
    event: 'reused',
    status: 'ok',
  })
  expect(process.listenerCount('SIGINT')).toBe(before)
})

it('coalesces repeated signals, emits stopped only after cleanup and removes its handlers', async () => {
  let close: (() => void) | undefined
  const closed = new Promise<void>((resolve) => {
    close = resolve
  })
  const handle = { close: vi.fn(() => closed) }
  hub.startGenieHub.mockResolvedValue({
    status: 'started',
    port: 4390,
    url: 'ws://localhost:4390',
    clientUrl: 'http://localhost:4390',
    handle,
  })
  hub.removeDiscoveryFile.mockResolvedValue(undefined)
  const stdout = vi.spyOn(process.stdout, 'write').mockReturnValue(true)
  const before = process.listenerCount('SIGINT')
  const running = runHub()
  await vi.waitFor(() => expect(stdout).toHaveBeenCalledTimes(1))
  process.emit('SIGINT')
  process.emit('SIGTERM')
  expect(handle.close).toHaveBeenCalledTimes(1)
  expect(stdout).toHaveBeenCalledTimes(1)
  close?.()
  expect(await running).toBe(0)
  expect(stdout.mock.calls.map(([value]) => JSON.parse(String(value)).event)).toEqual([
    'ready',
    'stopped',
  ])
  expect(process.listenerCount('SIGINT')).toBe(before)
})

it('returns a structured cleanup failure and still closes the hub', async () => {
  const handle = { close: vi.fn().mockResolvedValue(undefined) }
  hub.startGenieHub.mockResolvedValue({ status: 'started', handle })
  hub.removeDiscoveryFile.mockRejectedValue(new Error('PRIVATE_UPSTREAM_ERROR'))
  const stdout = vi.spyOn(process.stdout, 'write').mockReturnValue(true)
  const running = runHub()
  await vi.waitFor(() => expect(stdout).toHaveBeenCalledTimes(1))
  process.emit('SIGTERM')
  expect(await running).toBe(1)
  expect(handle.close).toHaveBeenCalledTimes(1)
  expect(JSON.parse(String(stdout.mock.lastCall?.[0]))).toMatchObject({
    status: 'error',
    reason: 'hub_stop_failed',
    userActionRequired: true,
  })
  expect(String(stdout.mock.lastCall?.[0])).not.toContain('PRIVATE_UPSTREAM_ERROR')
})

it('returns a single sanitized failure when startup rejects', async () => {
  hub.startGenieHub.mockRejectedValue(new Error('PRIVATE_STARTUP_ERROR'))
  const stdout = vi.spyOn(process.stdout, 'write').mockReturnValue(true)
  const stderr = vi.spyOn(process.stderr, 'write').mockReturnValue(true)
  expect(await runHub()).toBe(1)
  expect(stdout).toHaveBeenCalledTimes(1)
  expect(JSON.parse(String(stdout.mock.calls[0]?.[0]))).toMatchObject({
    status: 'error',
    reason: 'hub_start_failed',
    userActionRequired: true,
    next: { argv: ['genie-react', 'doctor'] },
  })
  expect(String(stdout.mock.calls[0]?.[0])).not.toContain('PRIVATE_STARTUP_ERROR')
  expect(stderr).not.toHaveBeenCalled()
})
