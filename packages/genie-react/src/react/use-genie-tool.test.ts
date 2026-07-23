// @vitest-environment jsdom

import { act, cleanup, render } from '@testing-library/react'
import { createElement, StrictMode } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { z } from 'zod'
import { resetGenieAppToolsForTests } from '../app-tools'
import { createGenieClient } from '../client/client'
import { GENIE_GLOBAL_KEY } from '../protocol'
import { FakeSocket, type Frame, flush, lastHello } from '../test-support/fake-socket'
import { useGenieTool } from './use-genie-tool'

function startClient() {
  const socket = new FakeSocket()
  createGenieClient({ appName: 'test-app', collectors: [], socketFactory: () => socket }).start()
  socket.open()
  return socket
}

function toolIn(socket: FakeSocket, name: string): Frame {
  return lastHello(socket)?.tools.find((tool: Frame) => tool.name === name)
}

function Harness({ value, enabled = true }: { value: number; enabled?: boolean }): null {
  useGenieTool({
    name: 'get_value',
    description: 'Returns the harness value so tests can watch closures stay fresh.',
    kind: 'query',
    input: z.object({}),
    enabled,
    handler: () => ({ value }),
  })
  return null
}

const settle = () => act(() => flush())

afterEach(() => {
  cleanup()
  resetGenieAppToolsForTests()
  globalThis[GENIE_GLOBAL_KEY] = undefined
})

describe('useGenieTool', () => {
  it('registers on mount and tombstones on unmount', async () => {
    const socket = startClient()
    const view = render(createElement(Harness, { value: 1 }))
    await settle()
    expect(toolIn(socket, 'app_get_value').available).toBeUndefined()

    view.unmount()
    await settle()
    expect(toolIn(socket, 'app_get_value').available).toBe(false)
  })

  it('stays registered through a StrictMode double-mount', async () => {
    const socket = startClient()
    render(createElement(StrictMode, null, createElement(Harness, { value: 1 })))
    await settle()
    expect(toolIn(socket, 'app_get_value').available).toBeUndefined()
  })

  it('invokes the latest render closure without re-registering', async () => {
    const socket = startClient()
    const view = render(createElement(Harness, { value: 1 }))
    await settle()
    view.rerender(createElement(Harness, { value: 42 }))
    await settle()

    const hellosBefore = socket.decoded().filter((frame) => frame.kind === 'app/hello').length
    socket.receive({ kind: 'bridge/request', id: 'r1', tool: 'app_get_value', args: {} })
    await settle()

    const response = socket
      .decoded()
      .find((frame) => frame.kind === 'app/response' && frame.id === 'r1')
    expect(response.result).toEqual({ value: 42 })
    const hellosAfter = socket.decoded().filter((frame) => frame.kind === 'app/hello').length
    expect(hellosAfter).toBe(hellosBefore)
  })

  it('honors the enabled gate', async () => {
    const socket = startClient()
    const view = render(createElement(Harness, { value: 1, enabled: false }))
    await settle()
    expect(toolIn(socket, 'app_get_value')).toBeUndefined()

    view.rerender(createElement(Harness, { value: 1, enabled: true }))
    await settle()
    expect(toolIn(socket, 'app_get_value').available).toBeUndefined()
  })
})
