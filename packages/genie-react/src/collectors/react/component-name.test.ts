// @vitest-environment jsdom

// biome-ignore-all lint/correctness/useExhaustiveDependencies: fixture effects depend on values chosen so React schedules them on the updates under test
import 'bippy/install-hook-only'
import { act, render } from '@testing-library/react'
import { createElement, useEffect, useState } from 'react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { CollectorContext } from '../../client'
import { reactCollector } from './collector'
import { clearRenders, disposeRenderTracking, startRenderTracking } from './render-tracker'

const context: CollectorContext = {
  pushSnapshot() {},
  pushEvent() {},
  refreshTools() {},
  markActivity() {},
}

const tools = reactCollector().tools ?? []

async function call(name: string, args: Record<string, unknown>): Promise<Record<string, unknown>> {
  const tool = tools.find((entry) => entry.contract.name === name)
  if (!tool) throw new Error(`${name} is not registered`)
  const result = await tool.handler(tool.contract.input.parse(args) as never, context)
  const parsed = tool.contract.output.safeParse(result)
  expect(parsed.error?.issues).toBeUndefined()
  return result as Record<string, unknown>
}

let bumpRow: () => void = () => {}

function Checkout() {
  useEffect(() => {}, [])
  return createElement('section', null, createElement(CheckoutRow))
}

function CheckoutRow() {
  const [count, setCount] = useState(0)
  bumpRow = () => setCount((value) => value + 1)
  useEffect(() => {}, [count])
  return createElement('p', null, count)
}

let unmount: (() => void) | null = null

beforeEach(() => {
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  expect(startRenderTracking()).toBe(true)
})

afterEach(() => {
  unmount?.()
  unmount = null
  disposeRenderTracking()
})

/** Only CheckoutRow renders inside the window; any evidence for Checkout is another component's. */
async function rowOnlyWindow(): Promise<string> {
  unmount = render(createElement(Checkout)).unmount
  clearRenders({ budget: { timeLimitMs: 500, adaptive: false } })
  const { handle } = (await call('react_measure', { label: 'row' })) as { handle: string }
  act(() => bumpRow())
  act(() => bumpRow())
  return handle
}

type Names = (result: Record<string, unknown>) => string[]

const field =
  (list: string, key: string): Names =>
  (result) =>
    ((result[list] as Record<string, unknown>[] | undefined) ?? []).map((row) => String(row[key]))

const NAME_TOOLS: Array<{ tool: string; args?: Record<string, unknown>; names: Names }> = [
  { tool: 'react_get_renders', names: field('components', 'name') },
  { tool: 'react_render_causes', names: field('events', 'componentName') },
  { tool: 'react_renders_since', names: field('components', 'name') },
  { tool: 'react_profile_report', names: field('mostRerendered', 'name') },
  { tool: 'react_provenance', names: field('records', 'name') },
  { tool: 'react_effect_audit', args: { onlyHot: false }, names: field('components', 'name') },
  { tool: 'react_effect_timeline', names: field('events', 'componentName') },
  { tool: 'react_effect_events', names: field('events', 'componentName') },
  { tool: 'react_component_cohort', names: field('instances', 'componentName') },
]

describe('tools that take a component name match it exactly by default', () => {
  it.each(NAME_TOOLS)('$tool never answers Checkout with CheckoutRow evidence', async (entry) => {
    const handle = await rowOnlyWindow()
    const args = { appOnly: false, ...entry.args, handle, component: 'Checkout' }

    const exact = await call(entry.tool, args)
    expect(entry.names(exact)).not.toContain('CheckoutRow')

    const substring = await call(entry.tool, { ...args, exact: false })
    expect(entry.names(substring)).toContain('CheckoutRow')
    expect(substring.componentMatch).toMatchObject({ exact: false })
  })

  it.each(NAME_TOOLS)(
    '$tool reports a missing name and the names it nearly matched',
    async (entry) => {
      const handle = await rowOnlyWindow()
      const result = await call(entry.tool, {
        appOnly: false,
        ...entry.args,
        handle,
        component: 'checkoutrow',
      })

      expect(entry.names(result)).toEqual([])
      expect(result.componentMatch).toMatchObject({
        component: 'checkoutrow',
        exact: true,
        status: 'no-match',
        matchedNames: [],
        similarNames: expect.arrayContaining(['CheckoutRow']),
      })
    },
  )

  it('reports a substring that selects several components as ambiguous', async () => {
    const handle = await rowOnlyWindow()
    const result = await call('react_provenance', {
      appOnly: false,
      handle,
      component: 'checkout',
      exact: false,
    })

    expect(result.componentMatch).toMatchObject({
      status: 'ambiguous',
      matchedNames: ['Checkout', 'CheckoutRow'],
      matchedNameCount: 2,
    })
  })

  it('reports a single exact match as matched', async () => {
    await rowOnlyWindow()
    const result = await call('react_get_renders', { appOnly: false, component: 'CheckoutRow' })

    expect(result.componentMatch).toEqual({
      component: 'CheckoutRow',
      exact: true,
      status: 'matched',
      matchedNames: ['CheckoutRow'],
      matchedNameCount: 1,
      similarNames: [],
    })
  })
})
