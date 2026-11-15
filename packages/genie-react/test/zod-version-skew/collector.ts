import { z } from 'zod-version-skew'
import { defineCollector, defineCollectorTool, type GenieCollector } from '../../src/client-entry'
import { defineAgentToolContract, type ToolInput, type ToolOutput } from '../../src/protocol'

const cartContract = defineAgentToolContract({
  name: 'cart_get',
  title: 'Cart',
  description: 'Reads the cart so a collector built on the skewed zod copy is exercised.',
  group: 'app.cart',
  input: z.object({ id: z.string(), limit: z.number().int().default(10) }),
  output: z.object({ id: z.string(), items: z.array(z.string()) }),
  annotations: { readOnlyHint: true },
})

export const wireArgs: ToolInput<typeof cartContract> = { id: 'cart-1' }
export const result: ToolOutput<typeof cartContract> = { id: 'cart-1', items: [] }

export const cartCollector: GenieCollector = defineCollector({
  meta: { id: 'cart', title: 'Cart' },
  tools: [
    defineCollectorTool({
      contract: cartContract,
      handler: ({ id, limit }) => {
        // @ts-expect-error the parsed limit is a number
        const label: string = limit
        return { id: `${id}${label}`, items: [] }
      },
    }),
    defineCollectorTool({
      contract: { ...cartContract, name: 'cart_mistyped' },
      // @ts-expect-error the handler result must match the output schema
      handler: () => ({ id: 1, items: [] }),
    }),
  ],
})
