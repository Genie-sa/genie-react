import { QueryClient } from '@tanstack/react-query'
import { createMemoryHistory, createRootRoute, createRouter } from '@tanstack/react-router'
import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { sessionCollector } from './client'
import { defaultAppCollectors } from './collectors/defaults'
import { reactCollector } from './collectors/react'
import { metaTools } from './protocol'

type Schema = z.ZodType & { _zod: { def: Record<string, unknown>; optout?: string } }

function advertisedContracts() {
  const router = createRouter({ routeTree: createRootRoute(), history: createMemoryHistory() })
  const collectors = [
    sessionCollector(),
    reactCollector(),
    ...defaultAppCollectors({ router, queryClient: new QueryClient() }),
  ]
  return [
    ...metaTools,
    ...collectors.flatMap((collector) => collector.tools ?? []).map((tool) => tool.contract),
  ]
}

/** Paths of required object keys whose schema accepts `undefined`: JSON drops such a value, so the advertised key goes missing from the result. */
function vanishingRequiredKeys(schema: Schema, path: string, seen = new Set<Schema>()): string[] {
  if (seen.has(schema)) return []
  seen.add(schema)
  const def = schema._zod.def
  const children = (value: unknown, childPath: string) =>
    vanishingRequiredKeys(value as Schema, childPath, seen)
  switch (def.type) {
    case 'object':
      return Object.entries(def.shape as Record<string, Schema>).flatMap(([key, field]) => {
        const keyPath = `${path}.${key}`
        const parsed = field.safeParse(undefined)
        const vanishes =
          field._zod.optout !== 'optional' && parsed.success && parsed.data === undefined
        return [...(vanishes ? [keyPath] : []), ...children(field, keyPath)]
      })
    case 'array':
      return children(def.element, `${path}[]`)
    case 'record':
      return children(def.valueType, `${path}{}`)
    case 'union':
      return (def.options as Schema[]).flatMap((option) => children(option, path))
    case 'intersection':
      return [...children(def.left, path), ...children(def.right, path)]
    case 'optional':
    case 'nullable':
    case 'default':
    case 'prefault':
    case 'readonly':
    case 'catch':
    case 'nonoptional':
      return children(def.innerType, path)
    case 'pipe':
      return children(def.out, path)
    case 'lazy':
      return children((def.getter as () => Schema)(), path)
    default:
      return []
  }
}

describe('advertised tool contracts', () => {
  const contracts = advertisedContracts()

  it('covers every collector domain and the hub meta tools', () => {
    const names = new Set(contracts.map((contract) => contract.name))
    for (const name of [
      'devtools_status',
      'react_get_tree',
      'query_get',
      'router_get_state',
      'browser_get_memory',
      'timeline_read',
    ])
      expect(names).toContain(name)
  })

  it('never advertises a required key whose value can be undefined and vanish from the JSON result', () => {
    const vanishing = [
      ...new Set(
        contracts.flatMap((contract) =>
          vanishingRequiredKeys(contract.output as Schema, contract.name),
        ),
      ),
    ]
    expect(vanishing).toEqual([])
  })

  it('declares in the input JSON Schema what an input needs whenever an empty input is rejected', () => {
    const silent = contracts
      .filter((contract) => {
        const schema = z.toJSONSchema(contract.input, { io: 'input' }) as {
          required?: string[]
          anyOf?: unknown[]
          oneOf?: unknown[]
        }
        const declares = (schema.required?.length ?? 0) > 0 || schema.anyOf || schema.oneOf
        return !declares && !contract.input.safeParse({}).success
      })
      .map((contract) => contract.name)
    expect(silent).toEqual([])
  })
})
