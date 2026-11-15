import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { z as skewedZod } from 'zod-version-skew'
import { defineAgentToolContract } from '../protocol'
import { FakeSocket } from '../test-support/fake-socket'
import { createGenieClient } from './client'
import { defineCollector, defineCollectorTool } from './collector'

const skewedContract = defineAgentToolContract({
  name: 'cart_get',
  title: 'Cart',
  description: 'Reads one cart',
  group: 'app.cart',
  input: skewedZod.object({ id: skewedZod.string(), limit: skewedZod.number().int().default(10) }),
  output: skewedZod.object({ id: skewedZod.string(), limit: skewedZod.number() }),
  annotations: { readOnlyHint: true },
})

const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

describe('defineCollectorTool', () => {
  it('advertises, validates and runs a tool whose schemas come from another zod 4 copy', async () => {
    const socket = new FakeSocket()
    const client = createGenieClient({
      collectors: [
        defineCollector({
          meta: { id: 'cart', title: 'Cart' },
          tools: [defineCollectorTool({ contract: skewedContract, handler: (args) => args })],
        }),
      ],
      socketFactory: () => socket,
    })
    client.start()
    socket.open()
    socket.receive({ kind: 'bridge/request', id: 'ok', tool: 'cart_get', args: { id: 'c1' } })
    socket.receive({ kind: 'bridge/request', id: 'bad', tool: 'cart_get', args: { id: 1 } })
    await flush()

    const frames = socket.decoded()
    const descriptor = frames
      .find((frame) => frame.kind === 'app/hello')
      .tools.find((tool: { name: string }) => tool.name === 'cart_get')
    expect(descriptor.inputJsonSchema).toMatchObject({
      properties: { id: { type: 'string' }, limit: { type: 'integer', default: 10 } },
      required: ['id'],
    })
    expect(descriptor.outputJsonSchema).toMatchObject({ required: ['id', 'limit'] })
    const response = (id: string) =>
      frames.find((frame) => frame.kind === 'app/response' && frame.id === id)
    expect(response('ok')).toMatchObject({ ok: true, result: { id: 'c1', limit: 10 } })
    expect(response('bad')).toMatchObject({
      ok: false,
      errorCode: 'invalid-args',
      errorDetails: { issues: [{ path: '/id', expected: 'string', received: 'number' }] },
    })
    client.stop()
  })

  it.each([
    ['input', { input: { _zod: { output: {} } } }],
    ['output', { output: { _zod: { def: { type: 'object' } } } }],
  ])('names the tool when its %s is not a Zod 4 schema', (field, schemas) => {
    const contract = {
      ...skewedContract,
      input: z.object({}),
      output: z.unknown(),
      ...schemas,
    }
    expect(() => defineCollectorTool({ contract: contract as never, handler: () => ({}) })).toThrow(
      `defineCollectorTool: "cart_get" ${field} must be a Zod 4 schema`,
    )
  })
})
