import { describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { defineGenieTool, GenieToolError, normalizeAppToolName } from './define'

const definition = {
  description: 'Fills the cart with sample items so checkout flows can be tested end to end.',
  handler: () => ({ ok: true }),
} as const

describe('normalizeAppToolName', () => {
  it('namespaces, snake_cases, and lowercases', () => {
    expect(normalizeAppToolName('seed_cart')).toBe('app_seed_cart')
    expect(normalizeAppToolName('seed-cart')).toBe('app_seed_cart')
    expect(normalizeAppToolName('Seed Cart')).toBe('app_seed_cart')
    expect(normalizeAppToolName('app_seed_cart')).toBe('app_seed_cart')
  })

  it('rejects names that survive normalization malformed', () => {
    expect(() => normalizeAppToolName('seed.cart')).toThrow(/invalid tool name/)
    expect(() => normalizeAppToolName('')).toThrow(/invalid tool name/)
  })
})

describe('defineGenieTool', () => {
  it('derives contract fields: group, title, and kind annotations', () => {
    const query = defineGenieTool({ ...definition, name: 'cart_state', kind: 'query' })
    expect(query.contract.group).toBe('app')
    expect(query.contract.name).toBe('app_cart_state')
    expect(query.contract.title).toBe('Cart state')
    expect(query.contract.annotations).toEqual({ readOnlyHint: true, idempotentHint: true })

    const action = defineGenieTool({ ...definition, name: 'seed-cart', kind: 'action' })
    expect(action.contract.annotations).toEqual({ readOnlyHint: false })

    const destructive = defineGenieTool({
      ...definition,
      name: 'wipe_cart',
      kind: 'action',
      destructive: true,
    })
    expect(destructive.contract.annotations).toEqual({
      readOnlyHint: false,
      destructiveHint: true,
    })
  })

  it('defaults input to an empty object schema and output to unknown', () => {
    const tool = defineGenieTool({ ...definition, name: 'ping', kind: 'query' })
    expect(tool.contract.input.parse({})).toEqual({})
    expect(() => tool.contract.input.parse({ extra: 1 })).not.toThrow()
    expect(tool.contract.output.safeParse('anything').success).toBe(true)
  })

  it('keeps a dev-supplied input schema as the wire contract', () => {
    const tool = defineGenieTool({
      ...definition,
      name: 'seed_cart',
      kind: 'action',
      input: z.object({ count: z.number().int().min(1).max(50).default(3) }),
    })
    expect(tool.contract.input.parse({})).toEqual({ count: 3 })
    expect(tool.contract.input.safeParse({ count: 99 }).success).toBe(false)
  })

  it('rejects a missing kind or handler and warns on thin descriptions', () => {
    const bad = { ...definition, name: 'x_tool' }
    expect(() => defineGenieTool({ ...bad, kind: 'read' as never })).toThrow(/kind/)
    expect(() => defineGenieTool({ ...bad, kind: 'query', handler: undefined as never })).toThrow(
      /handler/,
    )

    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    defineGenieTool({ name: 'terse', description: 'seeds', kind: 'query', handler: () => null })
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('thin description'))
    warn.mockRestore()
  })
})

describe('GenieToolError', () => {
  it('folds code and hint into the agent-visible message', () => {
    const error = new GenieToolError('cart is empty', {
      code: 'CART_EMPTY',
      hint: 'call app_seed_cart first',
    })
    expect(error.message).toBe('[CART_EMPTY] cart is empty — hint: call app_seed_cart first')
    expect(error.code).toBe('CART_EMPTY')
    expect(error.name).toBe('GenieToolError')
  })

  it('renders plain messages without decoration', () => {
    expect(new GenieToolError('nope').message).toBe('nope')
  })
})

describe('compile-time contracts', () => {
  it('rejects kind-mismatched options at the type level', () => {
    const bad = () =>
      defineGenieTool({
        ...definition,
        name: 'x',
        kind: 'query',
        // @ts-expect-error destructive is only expressible on kind: 'action'
        destructive: true,
      })
    expect(typeof bad).toBe('function')
  })

  it('advertises idempotent actions when declared', () => {
    const tool = defineGenieTool({
      ...definition,
      name: 'set_theme',
      kind: 'action',
      idempotent: true,
    })
    expect(tool.contract.annotations).toEqual({ readOnlyHint: false, idempotentHint: true })
  })
})

describe('app subgroups', () => {
  it('namespaces a declared group under app. and normalizes it', () => {
    const tool = defineGenieTool({
      ...definition,
      name: 'increase_steps',
      kind: 'action',
      group: 'Step-Counter',
    })
    expect(tool.contract.group).toBe('app.step_counter')
  })

  it('defaults to the flat app group and rejects malformed groups', () => {
    expect(defineGenieTool({ ...definition, name: 'x', kind: 'query' }).contract.group).toBe('app')
    expect(() =>
      defineGenieTool({ ...definition, name: 'x', kind: 'query', group: 'a.b' }),
    ).toThrow(/invalid group/)
  })
})
